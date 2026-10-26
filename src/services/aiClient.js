// aiClient.js
//
// Single seam between the chat UI and the models powering the design
// conversation. The UI only ever calls `sendMessage`.
//
// The real work happens server-side in the `chat` Cloud Function
// (functions/index.js), which tries Gemini first and falls back to Claude,
// so provider API keys never ship in the client bundle.

import { auth } from "../firebase";

// Same-origin by default: Firebase Hosting rewrites /api/chat to the function
// (and the Vite dev server proxies it).
const AI_ENDPOINT = import.meta.env.VITE_AI_ENDPOINT || "/api/chat";

/**
 * @param {Array<{role: 'user'|'assistant', content: string, imageUrl?: string, designSpec?: object}>} history
 *   Full conversation, oldest first; the last item is the user's new message.
 *   imageUrl is a Firebase Storage download URL under rooms/{uid}/.
 * @returns {Promise<{ reply: string, designSpec?: object, provider?: string }>}
 *   designSpec, when present, is a structured furniture spec ready to be
 *   handed to services/cortecloud.js — dimensions, material, edge-banding,
 *   drilling and cut parts.
 */
export async function sendMessage(history) {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ history }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao conversar com a IA (${response.status})`);
  }

  return response.json();
}
