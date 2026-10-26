import { getStorage } from "firebase-admin/storage";
import * as logger from "firebase-functions/logger";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// Firebase download URLs look like
// https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<url-encoded path>?alt=media&token=...
function storageLocation(url) {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname !== "firebasestorage.googleapis.com") return null;
    const match = pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/);
    return match ? { bucket: match[1], path: decodeURIComponent(match[2]) } : null;
  } catch {
    return null;
  }
}

/**
 * Reads a room photo straight from our own Storage bucket (never fetches an
 * arbitrary URL), and only from the caller's own rooms/{uid}/ folder.
 * Returns { mimeType, base64 } or null when the photo can't be used.
 */
export async function loadRoomImage(url, uid) {
  const location = storageLocation(url);
  const bucket = getStorage().bucket();
  if (!location || location.bucket !== bucket.name || !location.path.startsWith(`rooms/${uid}/`)) {
    logger.warn("Ignoring image outside the user's rooms folder", { uid });
    return null;
  }
  try {
    const file = bucket.file(location.path);
    const [[metadata], [buffer]] = await Promise.all([file.getMetadata(), file.download()]);
    if (buffer.length > MAX_IMAGE_BYTES) {
      logger.warn("Ignoring image larger than 5 MB", { path: location.path, bytes: buffer.length });
      return null;
    }
    return { mimeType: metadata.contentType || "image/jpeg", base64: buffer.toString("base64") };
  } catch (err) {
    logger.warn("Could not read room image", { path: location.path, error: err.message });
    return null;
  }
}
