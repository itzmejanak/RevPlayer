# RevPlayer — Implementation Plan

Companion to `offline-video-player-prd.md` in this same folder. That doc covers the *what/why*; this one covers the *how*, in build order, with runnable commands.

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | August 8, 2026 |
| **Status** | Draft |

---

## 1. Finalized Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack default for dev + build) |
| Language | TypeScript |
| Styling | Tailwind CSS (v4, via shadcn CLI) |
| UI components | shadcn/ui (Radix-based primitives) |
| Media playback | `@videojs/react` (Video.js v10, beta) |
| State | Zustand |
| Video blob storage | OPFS, with Cache API/IndexedDB fallback |
| Metadata storage | IndexedDB via `idb` |
| PWA / service worker | Serwist (`serwist` + `@serwist/next`) |
| List virtualization | `@tanstack/react-virtual` |
| Testing | Vitest (unit), Playwright (e2e, incl. offline simulation) |
| Deployment | Vercel |

> **On `@videojs/react`:** this is the rebuilt, unified successor to Vidstack/Media Chrome/Plyr, built around React, TypeScript, and Tailwind from the start — see the note in chat for the full reasoning. It's in beta pre-GA, so it's isolated behind a single wrapper component (`components/player/video-player.tsx`, Phase 3) — if an API shifts before GA, only that file changes. Pin the exact version in `package.json` rather than using a caret range.

## 2. Prerequisites

- Node.js ≥ 20.9.0 (LTS)
- Git
- A package manager — commands below use `npm`; swap for `pnpm`/`yarn`/`bun` if you prefer

## 3. Phase 0 — Create the Project (into this folder)

You're already inside `RevPlayer/` with `Plan.md` and `offline-video-player-prd.md` sitting here, so scaffold Next.js directly into `.` rather than a nested subfolder:

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

Since the folder isn't empty (it has your two `.md` files), the CLI may show a confirmation prompt before writing — that's expected and safe to accept; it won't touch your existing markdown.

Add shadcn/ui next. Note the package is `shadcn`, not the older `shadcn-ui` — that name is retired and will error if you use it:

```bash
npx shadcn@latest init -d
```

`-d` skips the interactive prompts and applies defaults. Then pull in the components this build needs up front:

```bash
npx shadcn@latest add button card badge progress slider tabs sheet dialog dropdown-menu
```

Install the remaining core dependencies:

```bash
npm install @videojs/react zustand idb serwist @serwist/next @tanstack/react-virtual
```

## 4. Folder Structure

```
RevPlayer/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx
│  │  ├─ page.tsx                 # Library / Home
│  │  ├─ video/[id]/page.tsx      # Player screen
│  │  ├─ downloads/page.tsx       # Downloads manager
│  │  ├─ settings/page.tsx
│  │  ├─ manifest.ts              # Web App Manifest
│  │  └─ sw.ts                    # Serwist service worker source
│  ├─ components/
│  │  ├─ ui/                      # shadcn components (generated)
│  │  ├─ player/
│  │  │  ├─ video-player.tsx      # Only file that imports @videojs/react
│  │  │  └─ player-controls.tsx   # Custom Tailwind-styled controls
│  │  ├─ library/
│  │  │  ├─ video-grid.tsx
│  │  │  └─ video-card.tsx
│  │  └─ downloads/
│  │     ├─ download-button.tsx
│  │     └─ storage-meter.tsx
│  ├─ lib/
│  │  ├─ storage/
│  │  │  ├─ opfs.ts               # OPFS read/write helpers
│  │  │  ├─ metadata-db.ts        # idb wrapper: videos + progress stores
│  │  │  └─ quota.ts              # navigator.storage.estimate()/persist()
│  │  ├─ download/
│  │  │  └─ download-manager.ts   # chunked, resumable fetch
│  │  └─ store/
│  │     └─ player-store.ts       # Zustand store
│  └─ types/
│     └─ video.ts
├─ public/
│  └─ icons/
├─ next.config.ts
├─ components.json                # shadcn config
└─ package.json
```

## 5. Phased Build Plan

Rough solo-developer estimates included as planning guidance, not commitments — adjust for team size and experience.

### Phase 1 — Foundation (~½–1 day)
- App shell: root layout, nav, light/dark theme via shadcn
- Route skeleton: `/`, `/video/[id]`, `/downloads`, `/settings`
- Next.js 16 note: dynamic route params are async — `const { id } = await params` inside `video/[id]/page.tsx`, not destructured synchronously

### Phase 2 — Storage Layer (~1–2 days)
- `lib/storage/metadata-db.ts` — IndexedDB via `idb`: a `videos` store (id, title, duration, size, quality, status, downloadedAt) and a `progress` store (videoId, position, updatedAt)
- `lib/storage/opfs.ts` — write/read/delete video blobs in OPFS, with a Cache-API/IndexedDB-blob fallback path for browsers with partial OPFS support (e.g. Firefox)
- `lib/storage/quota.ts` — wraps `navigator.storage.estimate()` and requests `navigator.storage.persist()`
- Unit test all three with Vitest before moving on — every later phase depends on this layer being correct

### Phase 3 — Player Component (~2–3 days)
- `components/player/video-player.tsx`: the single file that imports `@videojs/react`
- Two renderers: `<Video src={blobUrl} />` for downloaded content, `<HlsVideo src={url} />` for online streaming
- Build controls on the headless player state/primitives rather than the packaged skin, so everything is styled with your Tailwind/shadcn tokens from day one
- Wire up: play/pause, scrubber with thumbnail preview, volume, speed, captions toggle, fullscreen, keyboard shortcuts, Media Session API, picture-in-picture

### Phase 4 — Download Manager (~2–3 days)
- `lib/download/download-manager.ts`: chunked fetch using HTTP Range requests, resumable on failure, progress events
- Persist status into `metadata-db` as it progresses (`downloading` → `complete` / `failed`)
- `components/downloads/download-button.tsx` (quality picker + size estimate) and `storage-meter.tsx`

### Phase 5 — PWA / Offline Shell (~1–2 days)
- `app/sw.ts` + `@serwist/next` wired into `next.config.ts`: precache the app shell, stale-while-revalidate for thumbnails/metadata
- `app/manifest.ts`: name, icons, `display: "standalone"`
- Offline fallback route
- Background Sync registration for actions queued while offline (e.g. "mark as watched")

### Phase 6 — Library & Screens (~2–3 days)
- Library grid, virtualized via `@tanstack/react-virtual`, with online/downloaded status badges
- Video detail view with quality picker and size estimate before download
- Downloads manager screen, Settings screen
- Search/filter and playlists (Epic C in the PRD)

### Phase 7 — Polish, Test, Ship (~2–3 days)
- Playwright e2e, including simulated-offline scenarios (`context.setOffline(true)`)
- Run a Lighthouse pass against the performance targets in the PRD (Section 7)
- Deploy to Vercel; verify the service worker registers correctly on the production HTTPS domain

## 6. Execution Risks

Distinct from the product risks already in the PRD — these are specific to *building* it:

| Risk | Mitigation |
|---|---|
| `@videojs/react` API shifts before GA | Isolated wrapper (Phase 3), pinned version, watch the changelog before upgrading |
| `create-next-app` running in a non-empty folder | Confirm the prompt; only your two `.md` files exist today, nothing conflicts |
| OPFS partial support in Firefox | Fallback path built and tested explicitly in Phase 2, not bolted on later |
| Service worker caching a stale app shell after deploy | `skipWaiting`/`clientsClaim` (Serwist defaults handle this) + an in-app update prompt |

## 7. Key References

- Video.js v10 docs — videojs.org
- shadcn/ui CLI v4 changelog — ui.shadcn.com/docs/changelog
- Serwist + Next.js — serwist.pages.dev/docs/next
- Next.js 16 docs — nextjs.org/docs
