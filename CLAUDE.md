# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MobílIA is a React PWA where a user designs custom furniture by chatting with an AI (text + a photo of the room) and can then send the design to Cortecloud for fabrication. UI text, user-facing error messages and the README are in Brazilian Portuguese; keep new UI strings in Portuguese.

## Commands

```bash
npm install
npm run dev       # Vite dev server
npm run build     # production build into dist/ (includes PWA service worker via vite-plugin-pwa)
npm run preview   # serve the built dist/
firebase deploy --only functions,hosting   # Firebase project mobilia-99550 (see .firebaserc); functions need the Blaze plan
(cd functions && npm install)   # Cloud Functions dependencies (separate package)
```

There is no test runner, linter, or TypeScript setup. `dist/` is committed to git, so rebuild before committing if the deployed bundle should match the source.

## Architecture

Plain JS/JSX (no TS), Vite + React 18 + react-router-dom v6, Firebase v10 modular SDK (Auth, Firestore, Storage), lucide-react icons. Each component has a sibling `.css` file; design tokens (colors, fonts) are CSS variables in `src/styles/global.css`.

**Auth flow:** `AuthContext` exposes `{ user, status, login, register, logout }`, where `status` is `"checking" | "ready"`. `Splash` (`/`) waits for `status === "ready"` before redirecting to `/chat` or `/login`, and `RequireAuth` renders nothing until ready. This avoids flashing the login screen for signed-in users, so preserve the pattern when adding routes. `register` exists, but there is no sign-up screen yet.

**Chat and project persistence** (`src/components/ChatScreen.jsx`, the core of the app):
- `/chat` is a new, unsaved, in-memory conversation. The Firestore `projects` doc is created only after the first AI reply succeeds (`persistProject`), which then `navigate`s to `/chat/:projectId` with `replace`.
- `/chat/:projectId` subscribes to that doc via `onSnapshot`; the whole message array is rewritten on every exchange (`updateDoc` with `messages` + `updatedAt`).
- Firestore doc shape (`projects` collection): `{ ownerId, name, createdAt, updatedAt, messages: [{ role, text, photoUrl?, designSpec? }], designSpec?, cortecloudServiceId? }`. `useProjects` queries by `ownerId` ordered by `updatedAt desc`, which needs a composite index.
- Photos are downscaled client-side (max 1600px JPEG), uploaded to Storage at `rooms/{uid}/{timestamp}-{filename}`, and their download URL is kept as the message's `photoUrl`.
- Error bubbles live in `failed` state, never in `messages`, so they are not persisted or sent to the AI.

**AI backend** (`functions/`, separate ESM package, Node 22, Firebase Functions v2):
- `src/services/aiClient.js` → `sendMessage(history)` POSTs `{ history: [{ role, content, imageUrl?, designSpec? }] }` with a Firebase ID token to `/api/chat` (override with `VITE_AI_ENDPOINT`). Hosting rewrites `/api/chat` to the `chat` function; Vite proxies `/api` to the deployed site (or `API_PROXY_TARGET`).
- `functions/index.js` verifies the token, validates history, loads the last 3 photos straight from Storage (only `rooms/{uid}/`, never arbitrary URLs), then tries `src/providers/gemini.js` and falls back to `src/providers/claude.js`. Keys come from the `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` Functions secrets.
- `functions/src/prompt.js` holds the shared Portuguese system prompt and the JSON schema both providers must answer with (`{ reply, designSpec? }`). Earlier assistant turns are replayed to the model as that same JSON.
- Provider timeouts (25 s Gemini, 32 s Claude, no SDK retries) are sized to fit Firebase Hosting's 60 s limit on proxied requests.

**Cortecloud API seam** (thin `fetch` wrapper, currently unused by the UI; backend not in this repo yet):
- `src/services/cortecloud.js` → `createFabricationOrder` / `getOrderStatus` hit `VITE_BACKEND_BASE_URL/cortecloud/orders[...]`. The backend is meant to create the Cortecloud service and handle Cortecloud's checkout callback flow (https://cortecloud.com/api-docs/).
- When an assistant message has a `designSpec`, `ChatScreen` renders a `DesignCard`. Its shape is defined by `RESPONSE_SCHEMA` in `functions/src/prompt.js`: overall dimensions, `environment`, `sheets[]` (type/thickness/color/faces), `edgeBands[]`, `parts[]` (C = `lengthMm` along the grain, L = `widthMm`, `sheet`/`edgeBand` by name, `bandC1/C2/L1/L2`, `canRotate`, `notes`) and `components[]` (enum of Cortecloud categories). Designs saved earlier may lack the newer fields; keep readers tolerant.

**Cortecloud export** (`src/services/cortecloudExport.js`): there is no direct Cortecloud integration, so `DesignCard` offers "Copiar para o Cortecloud" (tab-separated rows on the clipboard, pasted into Cortecloud's *Importar peças → Colar dados da planilha ou Excel*) and "Baixar planilha (.xlsx)" (lazy-loaded `write-excel-file`; on touch devices it opens the share sheet). The parts columns must stay in Cortecloud's template order: Quantidade, Comprimento, Largura, Função, Fita C1, Fita C2, Fita L1, Fita L2, Material, Complemento, Girar (`PART_COLUMNS`). The .xlsx adds Chapas, Fitas, Componentes and Cliente sheets for reference.

**Config:** The Firebase client config is hardcoded in `src/firebase.js` (public client identifiers). The README mentions `.env.example`/`.env.local`, but no `.env.example` exists. The only client env vars are `VITE_AI_ENDPOINT` (optional) and `VITE_BACKEND_BASE_URL`.

**PWA / hosting:** `vite.config.js` configures the manifest and Workbox. Only the app shell (`js/css/html`) is precached, and AI/Firebase calls must never be cached. `firebase.json` serves `dist/` with an SPA rewrite to `/index.html`. Icons in `public/icons/` are placeholders.

## Security rules

The README contains starter Firestore rules: owner-only access to `projects/{id}` via `ownerId == request.auth.uid`. Storage `rooms/{uid}/**` should be writable only by that user. These rules are not deployed from this repo, because `firebase.json` has no firestore/storage sections. The `chat` function uses the Admin SDK, which bypasses rules, so it enforces the `rooms/{uid}/` check itself.
