// MobílIA backend: POST /api/chat (served through the Firebase Hosting rewrite).
//
// Request:  Authorization: Bearer <Firebase ID token>
//           { history: [{ role: "user"|"assistant", content, imageUrl?, designSpec? }] }
// Response: { reply, designSpec, provider }
//
// Gemini is the primary model; if it errors, times out or returns something
// unusable, the same conversation is sent to Claude.

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import { loadRoomImage } from "./src/images.js";
import { generateWithGemini } from "./src/providers/gemini.js";
import { generateWithClaude } from "./src/providers/claude.js";

initializeApp();

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

const MAX_MESSAGES = 60;
const MAX_TEXT_LENGTH = 4000;
const MAX_IMAGES = 3; // most recent room photos sent to the model

async function verifyUser(req) {
  const match = (req.get("Authorization") || "").match(/^Bearer (.+)$/);
  if (!match) return null;
  try {
    return (await getAuth().verifyIdToken(match[1])).uid;
  } catch {
    return null;
  }
}

/** Validates the client history into [{ role, text, imageUrl?, designSpec? }], or null. */
function parseHistory(raw) {
  if (!Array.isArray(raw)) return null;
  const messages = [];
  for (const item of raw.slice(-MAX_MESSAGES)) {
    if (item?.role !== "user" && item?.role !== "assistant") return null;
    const text = typeof item.content === "string" ? item.content.trim().slice(0, MAX_TEXT_LENGTH) : "";
    const imageUrl = item.role === "user" && typeof item.imageUrl === "string" ? item.imageUrl : null;
    const designSpec = item.role === "assistant" && item.designSpec && typeof item.designSpec === "object"
      ? item.designSpec
      : null;
    if (!text && !imageUrl) continue;
    messages.push({ role: item.role, text, imageUrl, designSpec });
  }
  // Models expect the conversation to open and close with the user.
  while (messages[0]?.role === "assistant") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;
  return messages;
}

async function attachImages(messages, uid) {
  const withPhotos = messages.filter((m) => m.imageUrl).slice(-MAX_IMAGES);
  await Promise.all(
    withPhotos.map(async (m) => {
      m.image = await loadRoomImage(m.imageUrl, uid);
    })
  );
  return messages;
}

export const chat = onRequest(
  {
    region: "us-central1",
    secrets: [GEMINI_API_KEY, ANTHROPIC_API_KEY],
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "method_not_allowed" });
      return;
    }
    const uid = await verifyUser(req);
    if (!uid) {
      res.status(401).json({ error: "unauthenticated" });
      return;
    }
    const history = parseHistory(req.body?.history);
    if (!history) {
      res.status(400).json({ error: "invalid_history" });
      return;
    }
    const conversation = await attachImages(history, uid);

    const providers = [
      { name: "gemini", apiKey: GEMINI_API_KEY.value(), generate: generateWithGemini },
      { name: "claude", apiKey: ANTHROPIC_API_KEY.value(), generate: generateWithClaude },
    ].filter((p) => p.apiKey);

    for (const provider of providers) {
      const started = Date.now();
      try {
        const result = await provider.generate(conversation, provider.apiKey);
        logger.info("chat reply", { uid, provider: provider.name, ms: Date.now() - started });
        res.json({ ...result, provider: provider.name });
        return;
      } catch (err) {
        logger.warn(`${provider.name} failed, trying next provider`, {
          uid,
          error: err.message,
          status: err.status,
          ms: Date.now() - started,
        });
      }
    }
    logger.error("All AI providers failed", { uid });
    res.status(502).json({ error: "ai_unavailable" });
  }
);
