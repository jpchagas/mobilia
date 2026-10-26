import { GoogleGenAI } from "@google/genai";
import { SYSTEM_PROMPT, RESPONSE_SCHEMA, parseModelOutput, assistantTurnText } from "../prompt.js";

const MODEL = "gemini-3.8-flash";

function toContents(conversation) {
  return conversation.map((m) => {
    if (m.role === "assistant") {
      return { role: "model", parts: [{ text: assistantTurnText(m) }] };
    }
    const parts = [];
    if (m.image) parts.push({ inlineData: { mimeType: m.image.mimeType, data: m.image.base64 } });
    parts.push({ text: m.text || "(foto do ambiente)" });
    return { role: "user", parts };
  });
}

/** Primary provider. Returns { reply, designSpec } or throws. */
export async function generateWithGemini(conversation, apiKey) {
  // Short timeout: Firebase Hosting cuts proxied requests at 60 s, and the
  // Claude fallback still needs time to run if this one stalls.
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 25_000 } });
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: toContents(conversation),
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 8192,
    },
  });
  if (!response.text) {
    throw new Error(`Gemini returned no text (finishReason: ${response.candidates?.[0]?.finishReason})`);
  }
  return parseModelOutput(response.text);
}
