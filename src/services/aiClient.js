// aiClient.js
//
// Single seam between the chat UI and whichever multimodal model ends up
// powering the design conversation. The UI only ever calls `sendMessage`;
// swapping Gemini <-> GPT-4o <-> Claude means rewriting the body of the
// call below, not touching ChatScreen.jsx.
//
// Real image + text reasoning should happen server-side (a Cloud Function
// or small API route) so provider API keys never ship in the client bundle.
// This client just calls that endpoint.

const AI_ENDPOINT = import.meta.env.VITE_AI_ENDPOINT; // e.g. your Cloud Function URL

/**
 * @param {Array<{role: 'user'|'assistant', content: string}>} history
 * @param {{ imageBase64?: string, imageMimeType?: string }} attachment
 * @returns {Promise<{ reply: string, designSpec?: object }>}
 *   designSpec, when present, is a structured furniture spec ready to be
 *   handed to services/cortecloud.js — dimensions, material, edge-banding
 *   and drilling, matching what the Cortecloud service-creation endpoint expects.
 */
export async function sendMessage(history, attachment = {}) {
  const response = await fetch(AI_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, attachment }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao conversar com a IA (${response.status})`);
  }

  return response.json();
}
