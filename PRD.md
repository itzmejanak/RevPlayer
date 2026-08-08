# StreamVault — Offline-First Video Player
## Product Requirements Document (PRD) & User Stories

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | August 8, 2026 |
| **Status** | Draft |
| **Platform** | Web (Next.js), installable PWA |

> **Note:** "StreamVault" is a placeholder product name — swap in your own branding. This document is written to be handed directly to design/engineering to start building.

---

## 1. Executive Summary

StreamVault is a high-performance, offline-first video player built with Next.js. Users can download videos for local playback, browse and manage a personal library, and get near-native performance — smooth seeking, instant startup, zero buffering for downloaded content — with or without an internet connection. The app installs as a Progressive Web App (PWA) so it behaves like a native app on desktop and mobile.

## 2. Problem Statement

- People with unreliable, slow, or expensive mobile data (commuters, travelers, field workers, rural users) can't reliably stream video, but most web video players assume an always-on connection.
- Native offline video apps solve this but require a platform-specific install (App Store / Play Store), heavy binaries, and separate codebases per platform.
- Most "offline-capable" web apps only cache a shell page — they don't handle large binary media well, don't manage storage quotas gracefully, and feel sluggish next to native players.

**Opportunity:** a single, installable web app that is genuinely fast and reliable offline, using modern browser storage and PWA APIs, without giving up the reach of the web.

## 3. Goals

**Business goals**
- Ship an installable PWA that performs on par with native video apps
- Reduce dependency on constant server/CDN bandwidth via smart local caching
- Drive retention through reliability users can trust — it just works, offline or not

**User goals**
- Watch downloaded content anywhere, with zero buffering and instant seek
- Understand at a glance what's available offline vs. needs a connection
- Manage device storage without digging through browser settings

**Non-goals:** see Section 12, Out of Scope.

## 4. Target Users & Personas

| Persona | Context | Core need |
|---|---|---|
| **Commuter** | Watches shows/lectures on trains, subways, flights with no signal | Reliable playback with zero connectivity |
| **Field worker** | Needs training/safety videos at remote job sites | Guaranteed offline access to critical content |
| **Frequent traveler** | Unpredictable hotel/airport wifi | Download-ahead workflow before losing connection |
| **Data-conscious user** | Limited or metered mobile data plan | Download on Wi-Fi, watch offline to avoid data charges |

## 5. User Stories

Organized by epic. Each story includes acceptance criteria (AC) written so a QA engineer could test them directly.

### Epic A — Download & Storage
- **US-1:** As a user, I want to download a video for offline viewing, so that I can watch it without an internet connection.
  - AC: visible progress indicator; download resumes if interrupted; video appears in "Downloads" once complete; continues in the background where the browser allows it.
- **US-2:** As a user, I want to see how much storage my downloads use, so that I can manage my device space.
  - AC: per-video file size shown; running total and device quota shown (via `navigator.storage.estimate()`).
- **US-3:** As a user, I want to delete downloaded videos, so that I can free up space.
  - AC: delete available from library and detail view; confirmation prompt; storage total updates immediately.
- **US-4:** As a user, I want to choose a download quality, so that I can balance video quality against storage and data usage.
  - AC: quality options shown with an estimated file size before download starts.

### Epic B — Playback
- **US-5:** As a user, I want smooth, instant seeking on downloaded videos, so that I can jump anywhere without waiting.
  - AC: seeking downloaded content triggers zero network calls; scrubbing shows thumbnail previews; no visible stall on seek.
- **US-6:** As a user, I want playback to resume where I left off, so that I don't lose my place between sessions.
  - AC: last position saved locally per video and restored automatically on reopen, across app restarts.
- **US-7:** As a user, I want to control playback speed, captions, and audio track, so that I can tailor playback to my needs.
  - AC: speed control from 0.5x–2x; caption/subtitle toggle when available; settings persist per video.
- **US-8:** As a user, I want picture-in-picture and background playback, so that I can keep watching or listening while using other apps.
  - AC: native PiP toggle; OS-level media controls (Media Session API) show title, artwork, play/pause/seek.

### Epic C — Library & Organization
- **US-9:** As a user, I want to group videos into playlists or folders, so that I can keep related content together.
- **US-10:** As a user, I want to search and filter my library by title, tag, or download status, so that I can find what I want quickly.
  - AC: results update as I type; a "Downloaded only" filter is available.

### Epic D — Connectivity Awareness
- **US-11:** As a user, I want to always know my connection status and which videos are available offline, so that I'm never surprised by a video that won't play.
  - AC: persistent online/offline indicator; "Downloaded" vs. "Streaming only" badge on every thumbnail.
- **US-12:** As a user, I want my watch progress to sync once I'm back online, so that my history is consistent across devices.
  - AC: progress queued locally while offline; synced automatically on reconnect via Background Sync (where supported).

### Epic E — Install & Performance
- **US-13:** As a user, I want to install the app to my home screen, so that it opens and feels like a native app.
  - AC: install prompt on supported browsers; launches standalone with custom icon/splash screen.
- **US-14:** As a user, I want the app to open and respond instantly, so that it never feels like "loading a website."
  - AC: repeat visits load the shell in under 1 second from cache; UI stays at 60fps with 100+ videos in the library.

## 6. Functional Requirements

### 6.1 Ingestion & Download Management
- Add content via (a) local file import (drag-and-drop / file picker) and (b) download from a URL/CDN source, where the source supports CORS.
- Chunked, resumable downloads (HTTP Range requests) so an interrupted download doesn't restart from zero.
- Video blobs stored via the **Origin Private File System (OPFS)** for large-file performance, with a Cache API/IndexedDB fallback for browsers with partial OPFS support.
- Metadata (title, duration, thumbnail, size, quality, tags, progress) stored in **IndexedDB**.

### 6.2 Playback Engine
- Native `<video>` element as the playback core.
- `hls.js` (or `dash.js`) loaded on demand for adaptive streaming when playing online content; direct blob URLs used for downloaded content (no streaming library needed offline).
- Fully custom controls layer for consistent behavior across browsers: play/pause, scrubber with thumbnail preview, volume, speed, captions, fullscreen, PiP.
- Keyboard shortcuts (space, arrow keys, `f` fullscreen, `m` mute, etc.).
- Media Session API wired up for OS/lock-screen media controls.

### 6.3 Offline Architecture
- Service worker (via **Serwist**, the maintained Workbox successor, or `next-pwa`) handling:
  - App-shell precaching for offline navigation.
  - Runtime caching: stale-while-revalidate for metadata/thumbnails, cache-first for static assets.
- Background Sync API to queue actions performed offline (e.g., "mark as watched") and replay them on reconnect.
- Storage-quota monitoring with a low-storage warning and a configurable eviction policy (e.g., oldest-watched-first).

### 6.4 UI/UX
- Responsive layout: mobile-first, scales to tablet/desktop.
- Light/dark theme.
- Skeleton loaders and optimistic UI updates for downloads and deletes.
- Accessible custom video controls (keyboard-operable, ARIA labels, visible focus states).

### 6.5 PWA / Installability
- Web App Manifest with icon set, theme color, `display: standalone`.
- Custom install prompt (`beforeinstallprompt`) and an offline fallback page.

## 7. Non-Functional Requirements — Performance Targets

Performance is a first-class requirement here, not an afterthought:

| Metric | Target |
|---|---|
| LCP (first load) | < 2.0s |
| LCP (repeat, cached) | < 0.8s |
| INP | < 200ms |
| CLS | < 0.1 |
| Time to Interactive (cached) | < 1.5s |
| Initial JS bundle (gzipped) | < 150KB |
| Video start latency (offline) | < 200ms tap-to-first-frame |
| Seek latency (offline) | < 100ms |
| UI frame rate | 60fps sustained, incl. library scroll with 100+ items |
| Lighthouse Performance (mobile) | ≥ 95 |
| Lighthouse PWA score | 100 |
| Offline playback success rate | 100% for fully-downloaded videos, 0 network calls |

Achieved via route-based code splitting, dynamic `import()` for `hls.js` and other heavy libraries, list virtualization in the library view, and aggressive service-worker caching of the app shell.

## 8. Technical Architecture

### 8.1 Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15+ (App Router) | SSG for marketing pages, client components for the offline app shell |
| Language | TypeScript | Type safety across player/storage logic |
| Styling | Tailwind CSS | Fast iteration, small production CSS footprint |
| State | Zustand | Minimal overhead for player/download state |
| Offline/PWA | Serwist (Workbox) | Actively maintained service-worker tooling for Next.js |
| Blob storage | OPFS, with Cache API/IndexedDB fallback | Best raw I/O for large video files |
| Metadata storage | IndexedDB (via `idb`) | Structured queries for library/progress data |
| Playback | `<video>` + `hls.js` (on-demand) | Native playback offline, adaptive streaming online |
| List rendering | `@tanstack/react-virtual` | Smooth scroll for large libraries |
| Testing | Playwright (e2e, incl. offline simulation), Vitest (unit) | Confidence in offline behavior specifically |

### 8.2 Rendering Strategy
- Marketing/landing pages: statically generated (SSG).
- Library and player views: client-rendered within the App Router, since the core experience must function with zero network — this leans on client components and the service worker rather than server rendering.
- `next/dynamic` used to code-split the video engine and any non-critical UI.

### 8.3 Offline Data Flow
1. User taps **Download** → download manager fetches the video in chunks (resumable) → blob written to OPFS.
2. Metadata record written to IndexedDB (`status: downloading` → `complete`).
3. On playback, the player checks IndexedDB for a local record; if present, it reads the OPFS file into a blob URL and plays with no network calls.
4. Watch progress is captured on `timeupdate` (debounced, e.g. every 5s), written to IndexedDB, and — if account sync is in scope — queued via Background Sync for the next time the app is online.

## 9. Key Screens / UX Flows

- **Onboarding** — brief permissions/context screen (storage; notifications optional).
- **Library / Home** — grid of videos (online + downloaded), each with a download-status badge.
- **Video detail** — thumbnail, description, download button with quality picker and size estimate.
- **Player** — fullscreen, custom controls, mobile gestures (swipe for seek/volume/brightness).
- **Downloads manager** — list of downloaded videos, storage usage bar, bulk delete.
- **Settings** — storage limit, default download quality, theme, clear-cache action.

## 10. Success Metrics

- % of sessions that occur fully offline
- Average video start latency, offline vs. online
- PWA install rate (installs / eligible visitors)
- 7-day and 30-day retention
- Failed-download rate (target < 1%)
- Crash-free session rate (target > 99.5%)

## 11. Suggested Milestones

| Phase | Scope |
|---|---|
| **1 — MVP** | Core player, local file playback, basic download-and-store, IndexedDB metadata, installable shell |
| **2 — Streaming & storage** | Adaptive streaming (`hls.js`), quality selection, resume playback, storage management UI |
| **3 — Organization** | Playlists, search/filter, background sync, PiP, keyboard shortcuts, virtualized library |
| **4 — Polish** | Animation/theming pass, accessibility audit, performance hardening, analytics |

## 12. Out of Scope (v1)

- DRM-protected content (Widevine/FairPlay EME) — candidate for a later phase
- Live streaming
- Video transcoding/upload pipeline for user-generated content
- Multi-user accounts and social features (comments, sharing)
- Native app wrappers (Capacitor/React Native) — PWA only for v1

## 13. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| iOS Safari has historically strict/unpredictable storage eviction for PWAs | Test extensively on iOS; request persistent storage via `navigator.storage.persist()`; degrade gracefully with clear messaging |
| Browser storage quota limits large libraries | Quota monitoring, user warnings, adaptive quality to reduce footprint |
| Service worker serves a stale app shell after deploy | Versioned caches, `skipWaiting` + `clients.claim()`, in-app "update available" prompt |
| Codec support varies by browser | Baseline on H.264/AAC (MP4) for max compatibility; AV1/VP9 as progressive enhancement |

## 14. Target & Open Questions

**Target**
- Source videos are either user-provided local files or served from a CORS-enabled origin that allows blob download.
- No DRM requirement for v1.
- Primary targets are modern evergreen browsers (Chrome, Edge, Safari 16.4+, Firefox), with graceful fallback where OPFS support is partial (e.g., Firefox).

**Open questions**
- Is there a backend/CMS providing the video catalog, or is this purely "bring your own video" (local files only)? -- yes
- Is cross-device sync of watch history/progress required? If so, this implies a backend and user accounts. -- no into V1
- Any content licensing/DRM requirements anticipated for future phases? -- NO

---
