import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT, RESPONSE_SCHEMA, parseModelOutput, assistantTurnText } from "../prompt.js";

const MODEL = "claude-opus-5-5";
const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function toMessages(conversation) {
  return conversation.map((m) => {
    if (m.role === "assistant") {
      return { role: "assistant", content: assistantTurnText(m) };
    }
    const content = [];
    if (m.image && SUPPORTED_IMAGE_TYPES.has(m.image.mimeType)) {
      content.push({
        type: "image",
        source: { type: "base64", media_type: m.image.mimeType, data: m.image.base64 },
      });
    }
    content.push({ type: "text", text: m.text || "(foto do ambiente)" });
    return { role: "user", content };
  });
}

/** Fallback provider. Returns { reply, designSpec } or throws. */
export async function generateWithClaude(conversation, apiKey) {
  // No SDK retries: this runs after Gemini already failed, inside Hosting's 60 s window.
  const client = new Anthropic({ apiKey, timeout: 32_000, maxRetries: 0 });
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 16000,
    // If a safety classifier declines, Anthropic re-runs the request on its
    // recommended fallback model inside the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM_PROMPT,
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: RESPONSE_SCHEMA },
    },
    messages: toMessages(conversation),
  });

  if (response.stop_reason === "refusal") {
    throw new Error(`Claude refused (${response.stop_details?.category ?? "unknown"})`);
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("Claude hit max_tokens");
  }
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");
  return parseModelOutput(text);
}
