// cortecloud.js
//
// Wraps the two Cortecloud integrations relevant to MobílIA:
//   1. ERP/services API — create the fabrication order from the AI's design spec.
//   2. Checkout API — Cortecloud calls an endpoint of ours to ask for a
//      checkout URL, then we tell it back once payment is confirmed.
//
// Both the order creation and the checkout callbacks should be handled by
// your own backend (Cloud Functions are a natural fit alongside Firebase),
// never called with Cortecloud credentials directly from the client.
// This module just calls your backend's routes for each step.

const BACKEND_BASE = import.meta.env.VITE_BACKEND_BASE_URL;

/**
 * Sends a finished design to your backend, which creates the corresponding
 * service in Cortecloud (materials, cut list, edge-banding, drilling).
 * @param {object} designSpec - structured spec produced by the AI chat
 * @returns {Promise<{ cortecloudServiceId: string, status: string }>}
 */
export async function createFabricationOrder(designSpec) {
  const res = await fetch(`${BACKEND_BASE}/cortecloud/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ designSpec }),
  });
  if (!res.ok) throw new Error("Não foi possível enviar o pedido para fabricação.");
  return res.json();
}

/**
 * Polls (or, better, listens via Firestore) the current status of a
 * Cortecloud service. Status codes follow Cortecloud's own table
 * (Salvo, Autorizado, Enviado p/ produção, Produzido, ...).
 */
export async function getOrderStatus(cortecloudServiceId) {
  const res = await fetch(`${BACKEND_BASE}/cortecloud/orders/${cortecloudServiceId}`);
  if (!res.ok) throw new Error("Não foi possível consultar o status do pedido.");
  return res.json();
}
