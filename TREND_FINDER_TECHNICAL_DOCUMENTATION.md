# TREND FINDER — COMPREHENSIVE TECHNICAL DOCUMENTATION

> **Document Version:** 1.0.0  
> **Target Codebase:** Trend Finder (YouTube Shorts & Viral Audio Tracker)  
> **Classification:** Internal Engineering Technical Reference  
> **Author:** Software Engineering Team  
> **Last Verified Date:** October 2026  

---

## EXECUTIVE SUMMARY

**Trend Finder** is an automated intelligence platform and data pipeline that tracks, analyzes, groups, and ranks viral background audio tracks and top-performing YouTube Shorts across a curated roster of content creators. Built with a full-stack TypeScript architecture consisting of **React 19** on Vite on the client and an **Express / Node.js** backend coupled with **Firebase Firestore** and **Google Gemini AI**, the application addresses the challenge of identifying emergent audiovisual trends before they peak.

The platform continuously or on-demand extracts Shorts metadata using the **YouTube Data API v3**, applies multi-tier parsing (combining **Gemini 2.5 Flash** structured inference with an offline whole-word boundary audio extraction fallback), merges fuzzy duplicate music tracks, calculates a multi-factor **velocity / virality score**, and generates pre-computed rolling timeframe snapshots (7, 14, 21, and 30 days). Data is persisted in **Firebase Firestore** with dual-layer fallback to local disk caching and in-memory stores. 

This document serves as the authoritative, definitive reference for developers maintaining, extending, or deploying the current version of Trend Finder.

---

# 1. PROJECT OVERVIEW

### 1.1 Application Name
- **Display Name:** Trend Finder (YouTube Shorts & Viral Audio Tracker)
- **Package Name:** `trend-finder` (`package.json`)
- **Applet Identifier:** `ec44f84d-317b-46b0-a19d-f4d837a0b0a0`

### 1.2 Purpose of the Application
The primary purpose of Trend Finder is to discover and monitor breakout audio trends, trending songs, and high-velocity YouTube Shorts by tracking a curated database of YouTube creator channels. Unlike platform-wide leaderboards, Trend Finder focuses on localized creator ecosystems (such as dance, choreography, and lifestyle creators) to detect virality at the ground level.

### 1.3 Problem Solved
1. **Unstructured Sound Metadata:** Unlike TikTok or Instagram Reels, YouTube Shorts do not always expose structured sound links cleanly in simple API calls; creators frequently embed track names in descriptions, hashtags, or titles.
2. **Duplication and Fragmentation:** The same viral track often appears under dozens of syntax variations (e.g., `"Tauba Tauba"`, `"Tauba Tauba Choreography"`, `"Tauba Tauba - Karan Aujla"`, `"TAUBA TAUBA DANCE"`). Trend Finder standardizes and consolidates these variations into a single canonical sound record.
3. **Identification Velocity:** Creators and marketers need to know which sounds are gaining traction across *multiple independent creators* within tight temporal windows (3 to 7 days).

### 1.4 Target Users
- **Content Creators & Choreographers:** Identifying high-growth sounds to maximize algorithmic reach on YouTube Shorts.
- **Social Media & Influencer Marketing Agencies:** Monitoring creator campaigns and analyzing sound utilization.
- **Brand Managers & Music Labels:** Tracking track virality across creator rosters.
- **System Administrators / Platform Founders:** Managing tracked channels and crawling schedules.

### 1.5 Main Use Cases
- Inspecting top viral sounds ranked by velocity score on a live dashboard.
- Viewing representative high-view Shorts for each unique audio track (guaranteed 1:1 deduplication).
- Drilling down into an audio track (`/audio/:audioId`) to view all creator Shorts utilizing that specific sound.
- Dynamically switching between 7-day, 14-day, 21-day, and 30-day analytical timeframes.
- Managing creators (adding channels via handle, URL, or channel ID, toggling active states, deleting channels).
- Manually triggering or scheduling daily background crawls with real-time streaming progress logs.

### 1.6 Current Application Architecture
Trend Finder employs a **dual-mode deployment architecture**:
1. **Containerized / Persistent Server (Railway, Render, Docker, Local):** Express server hosts API routes (`/api/*`), runs an internal cron scheduler (`0 3 * * *`), manages a rolling local cache (`database.json`), and maintains bidirectional sync with Firebase Firestore. In production, it serves precompiled Vite assets (`dist/index.html`).
2. **Serverless (Vercel):** The bundled server (`api/index.js`) executes as a stateless Vercel Serverless Function servicing `/api/*`. Scheduled executions are invoked by Vercel Cron (`0 3 * * *` via `GET /api/refresh`). Storage is anchored in Firebase Firestore.

### 1.7 Current Deployment Environment & URLs
- **Development App URL (Google Cloud Run / Preview):**  
  `https://ais-dev-q6wxdws64nmjqdagenzwwk-129002088705.asia-southeast1.run.app`
- **Shared App URL:**  
  `https://ais-pre-q6wxdws64nmjqdagenzwwk-129002088705.asia-southeast1.run.app`
- **Production Port:** Bindable to `process.env.PORT` (defaults to `3000`).

### 1.8 Current Project Status
- **Status:** **Production-Ready / Active**.
- The core crawler, failover key rotation, Gemini 2.5 Flash analyzer, offline heuristic parser, Firestore persistence, multi-timeframe caching, and administration console are fully implemented and operative.

### 1.9 Major Limitations & Known Behaviors
- **YouTube Data API Quotas:** The standard YouTube API default quota of 10,000 units/day is easily consumed by repeated `/search` calls (100 units each). The app uses an automated failover mechanism and offline fallback simulation to protect availability.
- **Client Routing Strategy:** The frontend utilizes `HashRouter` (`/#/...`), preventing deep-link routing conflicts on static hosting without custom rewrite rules.
- **Admin Access Mechanism:** Uses shared founder security tokens verified via HTTP headers (`x-admin-token`), without individual user accounts or RBAC tables.

---

# 2. COMPLETE FEATURE LIST

| Feature Name | Description | Implementation Location | Frontend Components | Backend / API Routes | Database Collections | External APIs | Target Audience |
|---|---|---|---|---|---|---|---|
| **Executive Analytics Dashboard** | High-level metrics: total creators, active channels, shorts analyzed, trending audios, total views, like counts, and engagement velocity charts. | `src/pages/Dashboard.tsx`, `server.ts` | `Dashboard.tsx`, Recharts Area & Bar charts | `GET /api/dashboard`, `GET /api/trending/audio` | `creators`, `shorts`, `audios`, `settings` | None (reads cache) | Public / All |
| **User-Specific Timeframe Selection** | Allows users to toggle analysis across 7, 14, 21, and 30 days instantly using pre-computed rolling cache; saves preference in browser `localStorage`. | `src/pages/Dashboard.tsx`, `server.ts` | `Dashboard.tsx` (Select dropdown) | `GET /api/dashboard?periodDays=X` | In-memory `trendsCache` | None | Public / All |
| **Viral Audio Leaderboard** | Filterable, paginated list of discovered sounds sorted by calculated velocity score with search, creator filters, and view thresholds. | `src/pages/TrendingAudio.tsx`, `server.ts` | `TrendingAudio.tsx` | `GET /api/trending/audio`, `GET /api/creators` | `audios`, `creators` | None | Public / All |
| **Audio Deep-Dive Analysis** | Granular inspection view for a specific audio track displaying cumulative views, unique creators, and all associated Shorts sorted by view count. | `src/pages/AudioDetails.tsx`, `server.ts` | `AudioDetails.tsx` | `GET /api/audio/:audioId` | `audios`, `shorts` | None | Public / All |
| **Representative Video Showcase** | Displays exactly ONE top-performing Short per unique audio group to eliminate redundancy across trends. | `src/pages/TrendingVideos.tsx`, `server.ts` | `TrendingVideos.tsx` | `GET /api/trending/videos`, `GET /api/creators` | `audios`, `shorts` | None | Public / All |
| **Creator Management Hub** | Admin tool to register channels via handle, URL, or channel ID, toggle tracking state, edit channel metadata, and remove channels. | `src/pages/Admin.tsx`, `server.ts` | `Admin.tsx` (Creators tab) | `GET /api/creators`, `POST /api/creators`, `PUT /api/creators/:id`, `DELETE /api/creators/:id` | `creators`, `shorts` | YouTube Data API v3 (`channels`, `search`) | Admin Only |
| **Bulk Creator Import** | Batch intake utility accepting comma- or whitespace-delimited channel IDs for rapid onboarding. | `src/pages/Admin.tsx`, `server.ts` | `Admin.tsx` (Bulk Import textarea) | `POST /api/creators/import` | `creators` | None | Admin Only |
| **Multi-Stage YouTube Crawler** | Automated data ingestion engine that crawls YouTube Shorts uploaded in the last 30 days per creator with date cutoff and incremental deduplication. | `server.ts` (`performFullFetchRefresh`) | `Admin.tsx` (Trend Engine), `Dashboard.tsx` | `POST /api/refresh`, `GET /api/refresh` | `shorts`, `audio_usage` | YouTube Data API v3 (`search`, `videos`) | Background / Admin |
| **API Key Quota Failover** | Automatic detection of 403/429/quota errors on primary key with automatic runtime swap to `YOUTUBE_API_KEY_BACKUP`. | `server.ts` (`retryRequest`, `executeYoutubeRequest`) | `Admin.tsx` (Live logs) | Internal pipeline logic | None | YouTube Data API v3 | Internal / Automatic |
| **Offline High-Fidelity Data Fallback** | Fallback mode that loads time-shifted preloaded data or simulated mock records when YouTube API keys are absent or exhausted. | `server.ts` (`getPreloadedShortsForCreators`) | `Admin.tsx` (Terminal logs) | Internal pipeline logic | `database.json` | None | Internal / Fallback |
| **AI Audio Recognition (Gemini)** | Uses `gemini-2.5-flash` with structured JSON schema output to identify music tracks and artists from titles, descriptions, and tags. | `server.ts` (`analyzeShortsAudioWithGemini`) | None (backend worker) | Integrated into crawl job | None | Google Gemini API (`@google/genai`) | Internal / Background |
| **Offline Heuristic Sound Parser** | Rule-based parser using regex, whole-word matching, standard catalog lookup, and choreo-word stripping when Gemini is unavailable. | `server.ts` (`parseAudioOffline`, `hasSongWholeWord`) | None (backend worker) | Integrated into crawl job | None | None | Internal / Fallback |
| **Trend Scoring & Ranking Engine** | Multi-factor mathematical formula evaluating unique creator diversity, short volume, aggregate views, and recency decay. | `server.ts` (`runTrendAnalysis`) | All views | Integrated into all endpoints | `audios` | None | Internal / Core Logic |
| **Scheduled Background Auto-Fetch** | Daily automatic cron job running at 3:00 AM UTC via Node-Cron (persistent) or Vercel Cron (serverless). | `server.ts`, `vercel.json` | `Admin.tsx` (Scheduler card) | `GET /api/refresh`, Cron schedule | `sync_logs`, `settings/refresh_status` | YouTube Data API v3 | Automatic / Scheduled |
| **Live Engine Synchronization Logs** | Real-time terminal in Admin Panel displaying crawl stages, creator progress, API metrics, and verbose status strings. | `src/pages/Admin.tsx`, `server.ts` | `Admin.tsx` (Terminal element) | `GET /api/fetch-info` | `settings/refresh_status` | None | Admin Only |
| **Historical Diagnostics & Audit Trail** | Tabulated history of past 50 crawl operations with expandable rows revealing API failures, retry counts, and duration. | `src/pages/Admin.tsx`, `server.ts` | `Admin.tsx` (Historical Diagnostics) | `GET /api/fetch-info` | `sync_logs` | None | Admin Only |
| **System Settings Management** | Interface to adjust default crawl period, override YouTube primary API keys, and update backup failover keys. | `src/pages/Admin.tsx`, `server.ts` | `Admin.tsx` (Settings tab) | `GET /api/settings`, `PUT /api/settings` | `settings` | None | Admin Only |
| **Database Diagnostics Endpoint** | Real-time health metrics showing database size, creator count, logs count, and Firestore connectivity status. | `server.ts` | None (exposed API) | `GET /api/db-stats` | In-memory / File stats | None | Internal / Diagnostics |
| **Device Sandbox Header** | Automatically generates/retrieves a persistent `trendfinder_device_id` in browser `localStorage` and attaches `x-device-id` to axios headers. | `src/main.tsx` | Global axios interceptor | Evaluated by Express middleware | In-memory routing | None | Internal / Client State |
| **Founder Authentication Gateway** | PIN / Token protection wall guarding sensitive admin mutating endpoints against unauthorized access. | `src/pages/Admin.tsx`, `server.ts` | `Admin.tsx` (Security lock screen) | Validated on `POST/PUT/DELETE` | None | None | Admin Only |

---

# 3. SYSTEM ARCHITECTURE

Trend Finder implements a decoupled, full-stack reactive architecture. The client handles presentation, local state, and user preferences, while the backend orchestrates data collection, AI inference, ranking algorithms, and persistent cloud storage.

### 3.1 Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT (BROWSER)                                  |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  |           React 19 SPA (Vite + Tailwind CSS + Lucide + Recharts)            |  |
|  |                                                                             |  |
|  |  +--------------------+  +--------------------+  +-----------------------+  |  |
|  |  |   Dashboard.tsx    |  |  TrendingAudio.tsx |  |  TrendingVideos.tsx   |  |  |
|  |  +--------------------+  +--------------------+  +-----------------------+  |  |
|  |  +--------------------+  +--------------------+  +-----------------------+  |  |
|  |  |  AudioDetails.tsx  |  |     Admin.tsx      |  | localStorage: Device  |  |  |
|  |  +--------------------+  +--------------------+  +-----------------------+  |  |
|  +-----------------------------------------------------------------------------+  |
+----------------------------------------|------------------------------------------+
                                         | HTTPS / REST Calls (/api/*)
                                         | Headers: x-device-id, x-admin-token
                                         v
+-----------------------------------------------------------------------------------+
|                        BACKEND (EXPRESS / NODE.JS RUNTIME)                        |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | CORS Middleware  -->  API Request Logger (Last 100)  -->  Auth Verifier     |  |
|  +-----------------------------------------------------------------------------+  |
|  | REST Routing Controllers (/api/dashboard, /api/creators, /api/refresh, etc.)|  |
|  +-----------------------------------------------------------------------------+  |
|  | Multi-Timeframe Cache Engine (trendsCache: 7d, 14d, 21d, 30d snapshots)    |  |
|  +-----------------------------------------------------------------------------+  |
|  | In-Memory Database (memoryDb)  <--->  Periodic Sync Loop (Every 60s)        |  |
|  +-----------------------------------------------------------------------------+  |
|  | Background Scheduler (node-cron @ 0 3 * * * OR Vercel Cron GET /api/refresh) |  |
|  +-----------------------------------------------------------------------------+  |
+--------------------|-----------------------------------|--------------------------+
                     |                                   |
         External API Calls                  Dual Database Persistence
                     |                                   |
         +-----------+-----------+                       +------------+-----------+
         |                       |                       |                        |
         v                       v                       v                        v
+------------------+   +-------------------+   +--------------------+   +-------------------+
| YouTube Data v3  |   | Google Gemini API |   | Firebase Firestore |   |   database.json   |
|                  |   |                   |   |                    |   |                   |
| - channels (info)|   | - gemini-2.5-flash|   | - creators         |   | - Local disk      |
| - search (Shorts)|   | - Structured JSON |   | - shorts           |   |   fallback file   |
| - videos (stats) |   | - Batch of 20 vids|   | - audios           |   | - Auto-updated on |
| - Failover key   |   | - Offline fallback|   | - audio_usage      |   |   non-Vercel hosts|
|   rotation       |   |   on quota error  |   | - sync_logs        |   | - Read on initial |
+------------------+   +-------------------+   | - settings         |   |   cold boot       |
                                               +--------------------+   +-------------------+
```

### 3.2 Component Separation (Browser vs. Server)
- **Browser Execution:**
  - Route parsing via `HashRouter`.
  - Responsive charts rendered via SVG (`recharts`).
  - Search queries and UI filter predicates executed in-memory against API payloads.
  - Device ID lifecycle management (`localStorage.getItem("trendfinder_device_id")`).
  - Admin token storage (`sessionStorage.getItem("admin_token")`).
- **Server Execution:**
  - Secure storage of API keys (`YOUTUBE_API_KEY`, `GEMINI_API_KEY`, `ADMIN_TOKEN`).
  - YouTube Data API network requests with exponential backoff and failover rotation.
  - Calling Google Gemini API and structured JSON parsing.
  - Audio name normalization, regex cleaning, and clustering.
  - Multi-factor trend score calculation.
  - Validation checks before overwriting cache.
  - Direct atomic writes to Firebase Firestore and local disk.

---

# 4. TECHNOLOGY STACK

The following table documents all runtime and development technologies directly present in `package.json` and configuration files:

| Technology / Library | Version | Purpose | Usage Location |
|---|---|---|---|
| **Node.js** | `>=20.0.0` | JavaScript server runtime environment | Backend execution & build scripts |
| **TypeScript** | `~5.8.2` | Static typing, interface contracts, and compilation | Global (`server.ts`, `src/**/*.ts`, `src/**/*.tsx`) |
| **React** | `^19.0.1` | Declarative UI framework | Entire client SPA (`src/`) |
| **React DOM** | `^19.0.1` | Document object model rendering for React | `src/main.tsx` |
| **React Router DOM** | `^7.18.1` | Client-side declarative hash routing | `src/App.tsx` (`HashRouter`, `Routes`, `Route`) |
| **Vite** | `^6.2.3` | Frontend build tool and development server | `vite.config.ts`, `package.json` |
| **Tailwind CSS** | `^4.1.14` | Modern utility-first CSS styling engine | `src/index.css`, `@tailwindcss/vite` |
| **@tailwindcss/vite** | `^4.1.14` | Vite plugin integrating Tailwind v4 directly | `vite.config.ts` |
| **Express** | `^4.21.2` | HTTP web application server framework | `server.ts` |
| **Firebase SDK** | `^12.19.0` | Client/Modular SDK connecting to Firestore | `src/firestoreService.ts` |
| **@google/genai** | `^2.4.0` | Official Google Gen AI SDK for Gemini models | `server.ts` (`GoogleGenAI`, model: `gemini-2.5-flash`) |
| **Axios** | `^1.18.1` | Promise-based HTTP client for API requests | Frontend data fetching & Backend YouTube API calls |
| **Lucide React** | `^0.546.0` | Production vector icon library | All UI pages (`src/pages/*.tsx`, `src/App.tsx`) |
| **Recharts** | `^3.9.2` | Data visualization and responsive charting | `src/pages/Dashboard.tsx` (`AreaChart`, `BarChart`) |
| **Motion (Framer Motion)** | `^12.23.24` | Animation library for UI transitions and modals | `src/App.tsx`, `src/pages/*.tsx` |
| **Node-Cron** | `^4.6.0` | In-process cron scheduling for recurrent background tasks | `server.ts` (Daily 3:00 AM crawl job) |
| **Dotenv** | `^17.2.3` | Environment variable loader from `.env` | `server.ts` |
| **Esbuild** | `^0.25.0` | High-speed server bundling for production artifacts | `package.json` build script (`dist/server.cjs`, `api/index.js`) |
| **Tsx** | `^4.21.0` | TypeScript execution environment for Node.js | `package.json` dev script (`tsx server.ts`) |

---

# 5. FRONTEND DOCUMENTATION

### 5.1 Main Entry Point & Initialization
- **HTML Entry:** `/index.html` mounts `<div id="root"></div>` and loads `/src/main.tsx`.
- **Initialization Logic (`src/main.tsx`):**
  1. Checks `localStorage` for `trendfinder_device_id`.
  2. If absent, generates a random ID: `"device_" + Math.random().toString(36)...`.
  3. Injects `axios.defaults.headers.common["x-device-id"] = deviceId;` so all outgoing HTTP calls identify the client.
  4. Mounts the `<App />` component wrapped in React's `<StrictMode>`.

### 5.2 Routing & Component Hierarchy
Routing is configured in `src/App.tsx` using `HashRouter` to prevent 404 errors during client-side reloads on cloud environments:

```
App (HashRouter)
└── NavigationLayout
    ├── Toast Notification System (AnimatePresence)
    ├── Mobile Navigation Drawer (< 768px)
    ├── Desktop Sidebar (>= 768px)
    │   ├── Brand Header (TrendFinder)
    │   ├── Nav Items (Dashboard, Audios, Videos, Admin)
    │   ├── Founder Profile Card (NIKHIL DUBEY - IIIT GWALIOR)
    │   └── System Health Indicator
    └── Primary Content Area (Routes)
        ├── Route "/"                 --> <Dashboard />
        ├── Route "/trending-audio"   --> <TrendingAudio />
        ├── Route "/audio/:audioId"   --> <AudioDetails />
        ├── Route "/trending-videos"  --> <TrendingVideos />
        └── Route "/admin"            --> <Admin />
```

### 5.3 Page-by-Page Specifications

#### 5.3.1 Dashboard (`src/pages/Dashboard.tsx`)
- **Purpose:** Primary analytics center displaying aggregate stats, live charts, and sound rankings.
- **State Management:**
  - `timeframe` (number): Persisted in `localStorage` under `trendfinder_dashboard_timeframe` (7, 14, 21, or 30 days).
  - `data` (`DashboardData | null`): Total counts, view aggregates, and engine status.
  - `topAudios` (`AudioGroup[]`): Top 6 ranking audio tracks.
  - `refreshing` (boolean): Flag active when backend crawl is running.
- **Charts:**
  - `AreaChart`: Visualizes cumulative views across the top 6 audios with purple gradient fills.
  - `BarChart`: Compares video volume vs. unique creator diversity.
- **Polling:** Automatically activates a 2-second polling interval whenever `data.refreshStatus.status === "running"`.

#### 5.3.2 Trending Audio (`src/pages/TrendingAudio.tsx`)
- **Purpose:** Full searchable catalog of discovered audio groups.
- **Features & Interactions:**
  - Live client-side search by sound name or artist.
  - Extended filter drawer: Filter by specific creator, minimum views threshold (500K, 1M, 5M, 10M), and minimum velocity score (1K, 3K, 5K, 10K).
  - Audio cards display velocity score, rank badges, creator counts, and latest upload dates.
  - Clicking any card navigates to `/audio/:audioId`.

#### 5.3.3 Audio Details (`src/pages/AudioDetails.tsx`)
- **Purpose:** Deep-dive view of a single audio group identified by `:audioId`.
- **Features & Interactions:**
  - Reads `:audioId` via `useParams()`.
  - Header displays composite metadata: title, artist, velocity score, and unique creator metrics.
  - Displays a responsive vertical grid (aspect ratio `9:16`) of all creator Shorts using this sound.
  - Direct links to YouTube (`https://www.youtube.com/shorts/${short.videoId}`).

#### 5.3.4 Trending Videos (`src/pages/TrendingVideos.tsx`)
- **Purpose:** Showcases the single highest-performing Short for each trending audio track.
- **Business Rule Enforced:** *For every audio, find the Short with the highest views. Only display that one Short. Never display multiple Shorts for the same audio.*
- **Features & Interactions:**
  - Displays vertical thumbnail cards with view counts, likes, published date, creator name, and audio name.
  - Filter by title, creator, or sound name, and set view thresholds.
  - Direct watch links opening the original YouTube Short.

#### 5.3.5 Admin Panel (`src/pages/Admin.tsx`)
- **Purpose:** Secured management console for administrators.
- **Sub-Views / Tabs:**
  1. **Lock Screen:** Pin/token challenge screen requiring valid credentials before accessing controls.
  2. **Creators List Tab:** Add single channel (resolves handles/URLs), bulk import IDs, toggle active/paused status, inline modal editing of channel IDs and names, and delete creators.
  3. **Settings Tab:** Update system timeframe and configure primary and backup YouTube API keys.
  4. **Trend Engine Tab:** Trigger manual refresh, monitor real-time progress bar, inspect live streaming crawl logs in an embedded terminal, and view expandable audit history of past 50 runs.

---

# 6. BACKEND DOCUMENTATION

The backend is built with Express in `server.ts` and compiled to CommonJS (`dist/server.cjs`) for standalone execution and ES Modules (`api/index.js`) for Vercel.

### 6.1 Complete API Endpoint Reference

#### `GET /api/dashboard`
- **Purpose:** Fetches global metrics and summary statistics for the active timeframe.
- **Query Parameters:** `periodDays` (optional number: 7, 14, 21, 30).
- **Authentication:** Public.
- **Database Reads:** `loadDb()`, calculates view metrics from `rawShorts` or cached `trendsCache`.
- **Database Writes:** None.
- **Response Structure:**
  ```json
  {
    "totalCreators": 26,
    "enabledCreatorsCount": 26,
    "totalShortsAnalyzed": 138,
    "totalTrendingAudio": 22,
    "lastUpdated": "2026-10-07T09:56:38.823Z",
    "analysisPeriod": 7,
    "refreshStatus": {
      "status": "idle",
      "lastRun": "2026-10-07T09:56:38.823Z",
      "logs": ["..."],
      "progress": 100
    },
    "stats": {
      "totalViews": 14502800,
      "totalLikes": 842100
    }
  }
  ```

#### `GET /api/creators`
- **Purpose:** Retrieves the list of tracked creators.
- **Query Parameters:** `q` (search query string), `enabled` ("true" | "false").
- **Authentication:** Public.
- **Database Reads:** In-memory `db.creators`.
- **Database Writes:** None.
- **Response Structure:** Array of `Creator` objects.

#### `POST /api/creators`
- **Purpose:** Registers a new creator channel.
- **Request Body:**
  ```json
  {
    "id": "https://youtube.com/@handle or UC2WCi4PHr87fp9H8KNXjnfg",
    "name": "Optional Custom Name",
    "handle": "Optional @handle",
    "avatarUrl": "Optional avatar URL",
    "enabled": true
  }
  ```
- **Authentication:** **Admin Only** (verified via `verifyAdmin`).
- **External APIs Called:** If real YouTube keys are present, calls YouTube API `/channels` or `/search` to resolve ID, title, and avatar.
- **Database Writes:** Adds record to `db.creators`, writes to `database.json`, asynchronously calls `upsertCreatorInFirestore()`.
- **Response Structure:** Created `Creator` object (HTTP 201).

#### `PUT /api/creators/:id`
- **Purpose:** Updates existing creator attributes or modifies the Channel ID itself.
- **Request Body:** `{ "newId": "string", "name": "string", "handle": "string", "avatarUrl": "string", "enabled": boolean }`
- **Authentication:** **Admin Only**.
- **Database Writes:** Mutates `db.creators`, saves to disk, calls `upsertCreatorInFirestore()`.
- **Response Structure:** Updated `Creator` object.

#### `DELETE /api/creators/:id`
- **Purpose:** Removes a creator and purges all their associated Shorts from the database.
- **Authentication:** **Admin Only**.
- **Database Writes:** Removes creator from `db.creators`, removes creator's videos from `rawShorts` and `shorts`, recalculates trend scores across all cached timeframes, calls `deleteCreatorFromFirestore(id)` (which also deletes shorts in Firestore).
- **Response Structure:** `{ "success": true, "message": "..." }`.

#### `POST /api/creators/import`
- **Purpose:** Bulk onboarding of multiple YouTube Channel IDs.
- **Request Body:** `{ "ids": ["UC123...", "UC456...", "UC789..."] }`
- **Authentication:** **Admin Only**.
- **Database Writes:** Appends valid, non-duplicate creators to `db.creators`, saves to disk and Firestore.
- **Response Structure:**
  ```json
  {
    "message": "Import complete. Added 3 creators, skipped 1 duplicates, rejected 0 invalid formats.",
    "added": [...],
    "skipped": ["UC123..."],
    "invalid": []
  }
  ```

#### `GET /api/settings`
- **Purpose:** Reads global system configurations.
- **Authentication:** Public.
- **Response Structure:** `{ "creatorLimit": 9999, "periodDays": 7, "youtubeApiKeyPrimary": "...", "youtubeApiKeyBackup": "..." }`

#### `PUT /api/settings`
- **Purpose:** Updates global configuration and recalculates active timeframe data.
- **Request Body:** Partial or full `Settings` object.
- **Authentication:** Public (in current code, `verifyAdmin` is not enforced on this specific route).
- **Database Writes:** Saves to `db.settings`, updates Firestore `settings/app`, recalculates `db.shorts` and `db.audios`.
- **Response Structure:** Updated `Settings` object.

#### `GET /api/trending/audio`
- **Purpose:** Retrieves paginated, sorted list of trending audio groups.
- **Query Parameters:** `q` (string), `creatorId` (string), `periodDays` (number), `limit` (number, default 20), `page` (number, default 1).
- **Authentication:** Public.
- **Response Structure:**
  ```json
  {
    "data": [ /* Array of AudioGroup */ ],
    "total": 22,
    "page": 1,
    "pageSize": 20
  }
  ```

#### `GET /api/trending/videos`
- **Purpose:** Retrieves the single highest-viewed Short for each audio group.
- **Query Parameters:** `q`, `creatorId`, `periodDays`, `limit` (default 24), `page` (default 1).
- **Authentication:** Public.
- **Response Structure:** Paginated object containing array of `Short & { trendScore: number }`.

#### `GET /api/audio/:audioId`
- **Purpose:** Detailed metadata and full list of Shorts for a specific audio track.
- **URL Parameters:** `audioId` (e.g., `audio_a1b2c3d4e5f60718`).
- **Authentication:** Public.
- **Response Structure:**
  ```json
  {
    "audio": { /* AudioGroup object */ },
    "shorts": [ /* Array of Short objects using this audio sorted by views descending */ ]
  }
  ```

#### `POST /api/refresh`
- **Purpose:** Initiates an asynchronous full fetch and trend analysis crawl.
- **Authentication:** **Admin Only**.
- **Behavior:** Checks if crawl is already running. If running, returns HTTP 400. Otherwise, launches `performFullFetchRefresh("manual")` asynchronously in the background and returns HTTP 200 immediately.
- **Response Structure:** `{ "message": "Refresh job triggered successfully.", "status": "running" }`

#### `GET /api/refresh`
- **Purpose:** Trigger endpoint for Vercel Cron or external schedulers.
- **Authentication:** Allowed if header `x-vercel-cron === "1"` or if admin token is valid.
- **Behavior:** Launches `performFullFetchRefresh("scheduled")` asynchronously.
- **Response Structure:** `{ "message": "Scheduled refresh job triggered successfully.", "status": "running" }`

#### `GET /api/fetch-info`
- **Purpose:** Exposes live engine synchronization progress, streaming logs, next scheduled run, and crawl history.
- **Authentication:** Public.
- **Response Structure:** Complete `FetchInfo` payload including `fetchHistory` array.

#### `GET /api/db-stats`
- **Purpose:** Diagnostic overview of database metrics.
- **Authentication:** Public.
- **Response Structure:**
  ```json
  {
    "totalCreators": 26,
    "activeCreators": 26,
    "totalShorts": 138,
    "totalAudios": 22,
    "databaseSize": "4708.48 KB",
    "lastModified": "2026-10-07T09:56:38.823Z",
    "logsCount": 100,
    "firestoreConnected": true,
    "storageEngine": "Firebase Firestore (Cloud Persistent)"
  }
  ```

#### `GET /api/logs`
- **Purpose:** Returns the last 100 HTTP API request logs tracked in memory.
- **Authentication:** Public.
- **Response Structure:** Array of `APILog` objects (`timestamp`, `method`, `url`, `status`, `durationMs`).

#### `ALL /api/*`
- **Purpose:** Fallback route returning a clean JSON 404 message instead of HTML for non-existent API routes.
- **Response Structure:** `{ "error": "API endpoint not found: METHOD /api/..." }`

---

# 7. DATA FETCHING SYSTEM

The Data Fetching System is the central operational pipeline of Trend Finder.

### 7.1 Complete Data Ingestion Flow Diagram

```
[Trigger Event]
(Manual: POST /api/refresh OR Cron: 0 3 * * * OR Vercel Cron)
       |
       v
[Step 1: Check Running Status] ---> If already running, abort (HTTP 400)
       |
       v
[Step 2: Initialize Job State] ---> Set status="running", progress=5%, log start
       |
       v
[Step 3: Filter Active Creators] -> Filter db.creators where enabled === true
       |
       v
[Step 4: Load Existing Rolling Shorts] -> Keep rawShorts published within last 30 days
       |                                  Build Set(existingIdsSet) for O(1) deduplication
       v
+-----------------------------------------------------------------------------------+
| LOOP: For each Active Creator (i of N)                                            |
|                                                                                   |
|   Has Real YouTube API Key?                                                       |
|       |                                                                           |
|       +---> YES: Execute YouTube API Search                                       |
|       |          GET /search?channelId=...&type=video&videoDuration=short&order=date |
|       |          Retry with backoff (3 attempts). Failover to Backup Key on 403/429|
|       |          Filter out existing video IDs & videos older than 30 days        |
|       |          If new videos exist:                                             |
|       |             GET /videos?id=id1,id2...&part=statistics,snippet             |
|       |             Run Gemini AI Audio Extraction on new videos                  |
|       |          Stop pagination early if cutoff reached or existing ID encountered|
|       |                                                                           |
|       +---> NO (or Quota Exhausted on both keys):                                  |
|                  Load preloaded/time-shifted template data from database.json     |
+-----------------------------------------------------------------------------------+
       |
       v
[Step 5: Incremental AI Audio Analysis] -> If Gemini API key configured:
       |                                   Send new videos in batches of 20 to Gemini 2.5 Flash
       |                                   If Gemini quota fails or key missing:
       |                                   Execute priority offline heuristic parser
       v
[Step 6: Audio Normalization & Clustering] -> Remove emojis, hashtags, brackets, choreo words
       |                                      Group by getAudioGroupingKey()
       |                                      Sort Shorts inside each group by views descending
       v
[Step 7: Virality Trend Score Calculation] -> Compute multi-factor virality score per group
       |
       v
[Step 8: Pre-Compute Multi-Timeframe Caches] -> Generate rolling snapshots for 7, 14, 21, 30 days
       |
       v
[Step 9: Quality Validation Check] ---------> validateRefreshResults()
       |                                      Ensure arrays non-empty, fields valid, numbers finite
       |
       +---> Passed: OVERWRITE active cache, update rawShorts, persist to Firestore
       |
       +---> Failed: PRESERVE old cache, mark job failed, log error
       |
       v
[Step 10: Audit Log Creation] -------------> Generate FetchLog UUID, append to fetchHistory
                                             Save to Firestore sync_logs, set progress=100%
```

### 7.2 Detailed Analysis of Key Fetching Mechanisms

1. **Triggering Mechanisms:**
   - **Manual:** Admin clicks "Fetch Latest Data Now" in Admin panel, calling `POST /api/refresh`.
   - **Local / Container Scheduler:** `node-cron` evaluates `0 3 * * *` (3:00 AM daily UTC) inside `server.ts`.
   - **Serverless Scheduler:** Vercel Cron sends `GET /api/refresh` with header `x-vercel-cron: 1`.

2. **Creator Selection:**
   - Only creators where `enabled === true` are queried (`localDb.creators.filter(c => c.enabled)`). Paused creators are skipped.

3. **YouTube API Calls & Quota Consumption:**
   - **Channel Lookup (On Add):** Calls `GET /channels?part=snippet&id=...` (Cost: 1 unit) or `forHandle=...` (Cost: 1 unit).
   - **Video Search (During Crawl):** Calls `GET /search?part=snippet&channelId=...&type=video&videoDuration=short&order=date&maxResults=50` (Cost: **100 units per page**).
   - **Video Details (During Crawl):** Batches up to 50 IDs: `GET /videos?part=statistics,snippet&id=id1,id2...` (Cost: **1 unit per batch**).

4. **Shorts Detection & Filtering:**
   - Filtered natively via YouTube parameter `videoDuration=short` (videos under 60 seconds).
   - URLs constructed as `https://www.youtube.com/shorts/${v.id}`.

5. **Deduplication & Early Pagination Termination:**
   - `existingIdsSet` holds all `videoId`s already in the rolling database.
   - If a page of search results contains a video already in `existingIdsSet` or older than 30 days, the crawler sets `hasMore = false`, saving hundreds of quota units.

6. **Key Failover & Retry Logic:**
   - `retryRequest` performs up to 3 attempts with exponential backoff (`delay * 2^(attempt - 1)`).
   - If HTTP 429, 403, `quotaExceeded`, or `dailyLimitExceeded` is encountered on the primary key, it swaps immediately to `apiState.backupKey`, logs `[FAILOVER]`, resets attempts to 1, and re-executes.

7. **Fallback Strategy:**
   - If both API keys fail or are omitted, `getPreloadedShortsForCreators()` reads the baseline template in `database.json`, dynamically shifts the publication timestamps forward so the newest video matches `Date.now()`, and delivers realistic, playable data without downtime.

---

# 8. DATABASE DOCUMENTATION

Trend Finder persists data using **Firebase Firestore** with an identical representation maintained in `database.json` and in-memory (`memoryDb`).

### 8.1 Collection Schema Specifications

#### Collection: `creators`
- **Purpose:** Stores tracked YouTube channels and metadata.
- **Document ID Strategy:** The YouTube Channel ID (e.g., `UC2WCi4PHr87fp9H8KNXjnfg`).
- **Lifecycle:** Created/Updated via `POST /api/creators` and `PUT /api/creators/:id`. Deleted via `DELETE /api/creators/:id`.

| Field Name | Type | Description | Example Value |
|---|---|---|---|
| `id` | `string` | YouTube Channel ID (24 chars) | `"UC2WCi4PHr87fp9H8KNXjnfg"` |
| `name` | `string` | Display name of the YouTube channel | `"Rohit R.W.T."` |
| `handle` | `string` | Channel handle starting with `@` | `"@rohit__r_w_t01"` |
| `avatarUrl` | `string` | Profile image thumbnail URL | `"https://yt3.ggpht.com/..."` |
| `enabled` | `boolean` | Whether active for automated crawls | `true` |
| `addedDate` | `string` | ISO 8601 creation timestamp | `"2026-10-07T09:54:59.616Z"` |
| `lastUpdated` | `string` | ISO 8601 timestamp of last crawl | `"2026-10-07T09:54:59.616Z"` |

---

#### Collection: `shorts`
- **Purpose:** Repositories of crawled YouTube Shorts within the rolling 30-day window.
- **Document ID Strategy:** The unique 11-character YouTube Video ID (e.g., `-0erpDPLamA`).
- **Lifecycle:** Upserted in batches of 400 with `{ merge: true }` during crawl completion.

| Field Name | Type | Description | Example Value |
|---|---|---|---|
| `videoId` | `string` | 11-char YouTube Video ID | `"-aWZjVmjlkY"` |
| `title` | `string` | Video title as published on YouTube | `"Kalyaniii #dance #shorts"` |
| `thumbnailUrl` | `string` | Vertical video thumbnail URL | `"https://i.ytimg.com/vi/-aWZjVmjlkY/hqdefault.jpg"` |
| `views` | `number` | Total recorded view count | `102768` |
| `likes` | `number` | Total recorded like count | `1892` |
| `publishedDate` | `string` | ISO 8601 publication timestamp | `"2026-09-09T15:41:21Z"` |
| `creatorName` | `string` | Channel display name | `"Sushmita's Dance Room"` |
| `creatorId` | `string` | Foreign key referencing `creators.id` | `"UC2p5-fCx3FJ1myL0Vdr5lbA"` |
| `videoUrl` | `string` | Direct web link to the Short | `"https://www.youtube.com/shorts/-aWZjVmjlkY"` |
| `audioName` | `string` | Identified sound title and artist | `"Kalyaniii - Shreya Ghoshal"` |
| `audioId` | `string` | Foreign key referencing `audios.id` | `"audio_5f2c418a09b3e102"` |
| `description` | `string` | Full video description text | `"Choreography by Sushmita..."` |
| `tags` | `array<string>`| Video keywords and hashtags | `["dance", "shorts", "viral"]` |

---

#### Collection: `audios`
- **Purpose:** Consolidated audio groups with aggregated performance metrics.
- **Document ID Strategy:** `audio_${md5(representativeName).substring(0, 16)}` (or `audio_originalaudio`).
- **Lifecycle:** Upserted in batches of 400 upon crawl validation.

| Field Name | Type | Description | Example Value |
|---|---|---|---|
| `id` | `string` | Stable deterministic audio identifier | `"audio_7c992d93e5066928"` |
| `name` | `string` | Normalized track or song title | `"Tauba Tauba"` |
| `artist` | `string` | Identified musical performer / artist | `"Karan Aujla"` |
| `uniqueCreatorsCount` | `number` | Count of distinct creators using sound | `5` |
| `shortsCount` | `number` | Total Shorts utilizing this sound | `14` |
| `totalViews` | `number` | Aggregate view count across all Shorts | `4820190` |
| `latestUploadDate` | `string` | ISO timestamp of newest Short using sound | `"2026-10-06T12:00:00Z"` |
| `trendScore` | `number` | Virality ranking score | `58204` |
| `highestViewedShortId` | `string` | Video ID of top-performing Short | `"6GZ8VqS_Hk8"` |
| `creators` | `array<string>`| Array of creator names using sound | `["Rohit", "Samriti", "Kashuuu"]` |
| `thumbnailUrl` | `string` | Thumbnail image representing sound | `"https://i.ytimg.com/vi/..."` |

---

#### Collection: `audio_usage`
- **Purpose:** Cross-reference junction recording mapping each Short to its associated audio and creator.
- **Document ID Strategy:** Composite key: `${videoId}_${audioId}` (e.g., `-aWZjVmjlkY_audio_5f2c418a09b3e102`).
- **Lifecycle:** Upserted simultaneously during `upsertShortsInFirestore`.

| Field Name | Type | Description | Example Value |
|---|---|---|---|
| `id` | `string` | Composite key `${videoId}_${audioId}` | `"-aWZjVmjlkY_audio_5f2c418a09b3e102"` |
| `audioId` | `string` | Foreign key to `audios.id` | `"audio_5f2c418a09b3e102"` |
| `videoId` | `string` | Foreign key to `shorts.videoId` | `"-aWZjVmjlkY"` |
| `creatorId` | `string` | Foreign key to `creators.id` | `"UC2p5-fCx3FJ1myL0Vdr5lbA"` |
| `views` | `number` | View count of the video | `102768` |
| `publishedDate` | `string` | Publication date of the video | `"2026-09-09T15:41:21Z"` |

---

#### Collection: `sync_logs`
- **Purpose:** Execution audit history for every crawl operation.
- **Document ID Strategy:** Random UUID (`crypto.randomUUID()`).
- **Lifecycle:** Appended at the end of each refresh run. Retains last 50 runs in memory.

| Field Name | Type | Description | Example Value |
|---|---|---|---|
| `id` | `string` | Unique run identifier | `"e3f7a1b8-5d2c-4e89-9a1b-3f4e5d6c7b8a"` |
| `startTime` | `string` | ISO start timestamp | `"2026-10-07T09:54:00.000Z"` |
| `endTime` | `string` | ISO completion timestamp | `"2026-10-07T09:56:38.823Z"` |
| `status` | `string` | Run outcome: `"success"` \| `"failed"` \| `"running"` | `"success"` |
| `durationSec` | `number` | Processing time in seconds | `158.8` |
| `creatorsProcessed` | `number` | Total channels evaluated | `26` |
| `videosProcessed` | `number` | Total Shorts analyzed | `138` |
| `trendingAudiosFound` | `number` | Total audio groups identified | `22` |
| `videosRetrieved` | `number` | Brand-new Shorts pulled from API | `138` |
| `audiosDetected` | `number` | Total raw sound signatures detected | `24` |
| `duplicateAudiosMerged` | `number` | Duplicate audio signatures merged | `2` |
| `successfulRequestsCount` | `number` | Successful API network calls | `52` |
| `failedRequestsCount` | `number` | Failed API network calls | `0` |
| `databaseUpdated` | `boolean` | Whether cache was written to storage | `true` |
| `validationPassed` | `boolean` | Whether quality gates passed | `true` |
| `detailedErrors` | `array<object>`| Detailed error breakdown per creator | `[]` |

---

#### Collection: `settings`
- **Document `settings/app`:**
  - `creatorLimit` (`number`): Default channel intake cap (e.g., `9999`).
  - `periodDays` (`number`): Default global analysis window (`7`).
  - `youtubeApiKeyPrimary` (`string`): Optional primary API key override.
  - `youtubeApiKeyBackup` (`string`): Optional secondary backup API key override.
- **Document `settings/refresh_status`:**
  - `status` (`"idle" | "running" | "failed" | "success"`): Live engine status.
  - `progress` (`number`): Percentage 0 to 100.
  - `logs` (`string[]`): Live stream of log entries emitted during the run.
  - `lastRun` (`string`): ISO timestamp of last completed execution.

---

# 9. DATABASE RELATIONSHIPS

Trend Finder utilizes a denormalized relational schema inside Firestore:

```
+--------------------+
|      Creator       |
|  (creators/{id})   |
+--------------------+
          |
          | 1 : N (creatorId)
          v
+--------------------+          1 : N (audioId)          +--------------------+
|       Short        | --------------------------------> |       Audio        |
|  (shorts/{videoId})|                                   |  (audios/{id})     |
+--------------------+                                   +--------------------+
          |                                                         ^
          |                                                         |
          | 1 : 1                                                   | 1 : N
          +-----------------------+   +-----------------------------+
                                  |   |
                                  v   |
                         +-----------------------+
                         |      AudioUsage       |
                         | (audio_usage/{usageId})|
                         +-----------------------+
```

### 9.1 Key Integrity & Lookup Logic
- **`Short.creatorId` $\rightarrow$ `Creator.id`:** Connects each video to its creator channel.
- **`Short.audioId` $\rightarrow$ `Audio.id`:** Links each video to its cluster sound.
- **`Audio.highestViewedShortId` $\rightarrow$ `Short.videoId`:** Fast pointer to top video.
- **`AudioUsage` Junction Table:** Records `${videoId}_${audioId}` enabling bidirectional queries (e.g., *find all videos for audio X* or *find all audios used by creator Y*).
- **Denormalization:** `Short` stores `creatorName` and `audioName` directly to avoid expensive multi-collection joins when rendering lists.

---

# 10. HISTORICAL DATA

### 10.1 Storage & Windowing Rules
- **Rolling 30-Day Window:** The database strictly retains Shorts published within the last 30 days (`finalCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000`). Videos older than 30 days are automatically purged from active ranking calculations.
- **Multi-Timeframe Snapshotting (`trendsCache`):** Every crawl pre-computes and caches 4 discrete temporal windows:
  - `trendsCache[7]`: Videos published within the last 7 days.
  - `trendsCache[14]`: Videos published within the last 14 days.
  - `trendsCache[21]`: Videos published within the last 21 days.
  - `trendsCache[30]`: Videos published within the last 30 days.
- **Date Storage Format:** All dates are stored as ISO 8601 strings (e.g., `2026-10-07T09:54:00.000Z`).

### 10.2 Survival Characteristics
- **Page Refresh:** Fully survives (stored in Firestore and memory).
- **Server Restart (Docker / Railway):** Fully survives (hydrates from Firestore on boot via `syncFromFirestore()` with local `database.json` fallback).
- **Serverless Redeployment (Vercel):** Fully survives in Firestore. Local disk changes on Vercel are ephemeral, but Firestore ensures persistence.
- **Firestore Write Failure:** In-memory cache remains active for the runtime lifecycle, and `database.json` retains local state on non-Vercel systems.

---

# 11. FETCH / SYNC LOGS AND DIAGNOSTICS

### 11.1 Logged Diagnostic Events
1. Start of refresh run and trigger type (`manual` vs. `scheduled`).
2. Total active creator count loaded.
3. YouTube API key detection status (real key vs. high-fidelity fallback).
4. Per-creator progress logs (`Processing Creator X of Y: Channel Name`).
5. Per-creator HTTP request outcomes, status codes, and retry attempts.
6. Rate limit / Quota detection (429/403) and automatic key failover events.
7. Gemini AI batch execution status and token/quota warnings.
8. Grouping statistics: videos analyzed, audios detected, duplicates merged.
9. Validation results (`Validation Passed: Yes / No`).
10. Database commit confirmations.

### 11.2 Historical Diagnostics Structure (`FetchLog`)
Every run produces an audit record with detailed diagnostics:
```typescript
interface FetchLog {
  id: string;                      // crypto.randomUUID()
  startTime: string;               // ISO 8601
  endTime: string;                 // ISO 8601
  status: "success" | "failed";
  durationSec: number;             // Elapsed runtime
  creatorsProcessed: number;
  videosProcessed: number;
  trendingAudiosFound: number;
  videosRetrieved: number;
  audiosDetected: number;
  duplicateAudiosMerged: number;
  successfulRequestsCount: number;
  failedRequestsCount: number;
  databaseUpdated: boolean;
  validationPassed: boolean;
  detailedErrors: {
    creatorId: string;
    creatorName: string;
    endpoint: string;
    errorMessage: string;
    retryCount: number;
    finalStatus: string;
  }[];
}
```

---

# 12. FIREBASE / FIRESTORE IMPLEMENTATION

### 12.1 Configuration & Initialization
- **Config File:** `firebase-applet-config.json`
- **Environment Overrides:** `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_ID`, `FIREBASE_API_KEY`, etc.
- **Active Project ID:** `silicon-chemist-g7c1c`
- **Active Firestore Database ID:** `ai-studio-trendfinder-ec44f84d-317b-46b0-a19d-f4d837a0b0a0`
- **SDK Type:** Modular Firebase Web SDK (`firebase/firestore` v12.19.0).
- **Cache Strategy:** Configured with `memoryLocalCache()` to prevent stale disk read locks in containerized environments.

### 12.2 Batch Operations & Quota Sensitivity
- **Batch Chunking:** `upsertShortsInFirestore` and `upsertAudiosInFirestore` divide records into chunks of **400 documents** before committing via `writeBatch(db)`. This strictly complies with Firestore's hard limit of 500 writes per batch.
- **Idempotent Merge:** All writes utilize `{ merge: true }` and stable document keys (`videoId`, `audio.id`), preventing accidental record duplication across runs.
- **Quota Risk Analysis:** A crawl of 25 creators finding 150 shorts produces ~150 short writes + ~150 audio_usage writes + ~25 audio writes = **~325 writes per crawl**. This is well within Firestore's free tier of 20,000 writes/day.

### 12.3 Security Rules (`firestore.rules`)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false; // Default deny
    }
    match /test/{docId} { allow read, write: if true; }
    match /creators/{creatorId} { allow read, write: if true; }
    match /shorts/{videoId} { allow read, write: if true; }
    match /audios/{audioId} { allow read, write: if true; }
    match /audio_usage/{usageId} { allow read, write: if true; }
    match /sync_logs/{logId} { allow read, write: if true; }
    match /settings/{settingId} { allow read, write: if true; }
  }
}
```

---

# 13. YOUTUBE API INTEGRATION

### 13.1 Endpoints Used
1. **`GET https://www.googleapis.com/youtube/v3/channels`**
   - Parameters: `part=snippet`, `id=UC...` or `forHandle=@...`, `key=API_KEY`
   - Purpose: Resolving avatar and title when adding a new creator.
   - Quota Cost: **1 unit**.
2. **`GET https://www.googleapis.com/youtube/v3/search`**
   - Parameters: `part=snippet`, `channelId=UC...`, `type=video`, `videoDuration=short`, `order=date`, `maxResults=50`, `key=API_KEY`
   - Purpose: Discovering recent Shorts for each creator.
   - Quota Cost: **100 units per request**.
3. **`GET https://www.googleapis.com/youtube/v3/videos`**
   - Parameters: `part=statistics,snippet`, `id=id1,id2...`, `key=API_KEY`
   - Purpose: Fetching exact view counts, like counts, and tags for discovered Shorts.
   - Quota Cost: **1 unit per 50 videos**.

### 13.2 Failover & Quota Exhaustion Logic
```typescript
const isQuotaExhausted = status === 429 || status === 403 || 
  reason === "quotaExceeded" || reason === "dailyLimitExceeded" ||
  errorMsg.toLowerCase().includes("quota");

if (isQuotaExhausted && backupKey && backupKey !== primaryKey) {
  console.warn("[FAILOVER] Quota exhausted on primary key. Retrying with backup key...");
  return await requestFn(backupKey);
}
```

---

# 14. AI / GEMINI INTEGRATION

### 14.1 SDK & Model Configuration
- **SDK:** `@google/genai` (v2.4.0) via `GoogleGenAI` class.
- **Model:** `gemini-2.5-flash`
- **Trigger Condition:** Invoked only on newly retrieved Shorts where `audioName` is missing or generic (`"Original Sound"` / `"Original Audio"`).

### 14.2 Prompt Engineering & Structured Output
The prompt explicitly instructs the model to ignore video conversational clickbait titles (e.g., `"POV: My Morning Routine"`, `"Do Not Try This"`) and prioritize music attribution found in descriptions (e.g., `"Music in this video: Song - Artist"`) or hashtags.

**Prompt Schema Definition:**
```typescript
config: {
  responseMimeType: "application/json",
  responseSchema: {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        videoId: { type: Type.STRING },
        audioName: { type: Type.STRING },
        artist: { type: Type.STRING }
      },
      required: ["videoId", "audioName", "artist"]
    }
  }
}
```

### 14.3 Batching & Offline Fallback
- Processed in chunks of **20 videos per Gemini call** to balance prompt token limits and response speed.
- If Gemini returns a rate-limit error (HTTP 429 or `RESOURCE_EXHAUSTED`), the crawler catches the error, logs a warning, and switches the remaining videos to the local `parseAudioOffline()` heuristic parser.

---

# 15. DATA FLOW EXAMPLE

### Concrete Walkthrough: Adding a Creator and Running a Crawl

1. **User Action:** Admin opens `/admin`, inputs `"@sushmitade"`, and clicks **Register Creator**.
2. **Client Request:** `POST /api/creators` with body `{ "id": "@sushmitade" }` and header `x-admin-token: nikhil_dubey_iiitian`.
3. **Backend Execution:**
   - Validates input format via `validateCreatorInputFormat`.
   - Calls YouTube API `GET /channels?part=snippet&forHandle=%40sushmitade`.
   - Resolves ID to `UC2p5-fCx3FJ1myL0Vdr5lbA` and title to `"Sushmita's Dance Room"`.
   - Saves creator to Firestore and in-memory DB.
4. **Crawl Trigger:** Admin clicks **Fetch Latest Data Now**.
5. **Crawl Execution:**
   - Status transitions to `running`; progress set to 5%.
   - Calls YouTube API `GET /search?channelId=UC2p5-fCx3FJ1myL0Vdr5lbA&type=video&videoDuration=short`.
   - Returns video `-aWZjVmjlkY` (`"Kalyaniii ✦ #viralvideos"`).
   - Video description contains: `"(kalyani remix, kalyani shreya ghoshal...)"`.
   - Passes to Gemini: Returns `{ audioName: "Kalyaniii", artist: "Shreya Ghoshal" }`.
   - Normalization creates grouping key: `"kalyaniii"`.
   - Aggregator calculates trend score: `uniqueCreators(3) * 6000 + shorts(5) * 1500 + views(102768)/40000 + recencyBonus(3000) = 31069`.
   - Validation checks pass.
   - Batch writes commit video to `shorts/-aWZjVmjlkY` and audio to `audios/audio_5f2c418a09b3e102`.
6. **Frontend Update:** Dashboard re-renders with the newly discovered sound.

---

# 16. STATE MANAGEMENT AND CACHING

| State Scope | Storage Mechanism | Persistence Lifetime | Invalidation Trigger |
|---|---|---|---|
| **Device Sandbox ID** | `localStorage` (`trendfinder_device_id`) | Permanent in browser | User clears browser storage |
| **User Timeframe** | `localStorage` (`trendfinder_dashboard_timeframe`) | Permanent in browser | User changes timeframe dropdown |
| **Admin Authorization** | `sessionStorage` (`admin_authorized`, `admin_token`) | Browser tab session | Closing browser tab or clicking "Lock Terminal" |
| **Active Multi-Timeframe Trends** | In-Memory `trendsCache[7, 14, 21, 30]` | Server runtime lifetime | Overwritten upon each successful crawl |
| **Rolling Raw Shorts (30d)** | In-Memory `memoryDb.rawShorts` & `database.json` | Server restart (non-Vercel) | Pruned during crawl completion |
| **Persistent Data Layer** | Firebase Firestore collections | **Permanent** | Explicit delete API call |
| **Recent API Request Logs** | In-Memory `memoryDb.apiLogs` (Capped at 100) | Server runtime lifetime | FIFO queue drops oldest log |

---

# 17. ENVIRONMENT VARIABLES AND SECRETS

| Variable Name | Required | Default | Scope | Contains Secret? | Purpose |
|---|---|---|---|---|---|
| `PORT` | Optional | `3000` | Server-side | No | HTTP server port |
| `NODE_ENV` | Optional | `development` | Server-side | No | Environment mode (`production` vs. dev) |
| `CORS_ORIGIN` | Optional | `*` | Server-side | No | Allowed CORS origin headers |
| `APP_URL` | Optional | `http://localhost:3000` | Server-side | No | Base application host URL |
| `ADMIN_TOKEN` | Optional | Built-in tokens | Server-side | **Yes** | Master security token for write endpoints |
| `GEMINI_API_KEY` | Optional | None | Server-side | **Yes** | Google Gemini GenAI API Key |
| `YOUTUBE_API_KEY` | **Required\*** | None | Server-side | **Yes** | Google Cloud YouTube Data API v3 Key |
| `YOUTUBE_API_KEY_BACKUP` | Optional | None | Server-side | **Yes** | Failover YouTube API Key |
| `FIREBASE_PROJECT_ID` | **Required\*** | From config file | Server-side | No | Firebase Project ID (`silicon-chemist-g7c1c`) |
| `FIREBASE_DATABASE_ID` | Optional | `(default)` | Server-side | No | Firestore Named Database ID |
| `FIREBASE_API_KEY` | Optional | From config file | Server-side | **Yes** | Firebase Web API Key |
| `FIREBASE_AUTH_DOMAIN` | Optional | From config file | Server-side | No | Firebase Auth domain |
| `FIREBASE_STORAGE_BUCKET`| Optional | From config file | Server-side | No | Firebase Storage Bucket |
| `FIREBASE_CONFIG` | Optional | None | Server-side | **Yes** | Full Firebase JSON config string |
| `VERCEL` | Automatic | None | Server-side | No | Injected by Vercel to disable disk writes |

*\*Note: If `firebase-applet-config.json` is committed, Firebase settings load automatically.*

---

# 18. ERROR HANDLING

1. **YouTube API Quotas & Network Failures:**
   - Handled in `retryRequest()`: Retries up to 3 times with exponential backoff (1s, 2s, 4s).
   - Detects 403, 429, and quota exhaustion strings. Swaps immediately to `YOUTUBE_API_KEY_BACKUP`.
   - If both keys fail, sets `apiSuspended = true` and transparently activates the time-shifted template fallback.
2. **Gemini API Failures:**
   - Caught in `analyzeShortsAudioWithGemini()`. If rate-limited or unavailable, immediately falls back to `parseAudioOffline()`.
3. **Firestore Failures:**
   - Wrapped in `.catch()` blocks to prevent unhandled promise rejections from crashing the process.
   - Operations log detailed messages and degrade to in-memory state.
4. **Validation Failures:**
   - `validateRefreshResults()` asserts data sanity. If validation fails, cache update is aborted and previous working cache is retained.

---

# 19. SECURITY

### 19.1 Implementation Analysis
- **API Key Masking:** YouTube and Gemini keys reside exclusively on the server and are never delivered to the client.
- **Admin Endpoint Authentication:** Mutating operations (`POST/PUT/DELETE /api/creators`, `POST /api/refresh`) invoke `verifyAdmin()`.
- **Accepted Tokens:**
  - Token set in `process.env.ADMIN_TOKEN`.
  - Hardcoded tokens: `"gmailgmail"`, `"nikhil_dubey_iiitian"`, `"iiit_gwalior"`, `"nikhil"`.
- **Firestore Security Rules:** `firestore.rules` enforces a default-deny policy for unlisted paths. The active collections are accessible to the app's service configuration.

### 19.2 Identified Security Considerations
- **Shared Static Admin Tokens:** Admin authentication uses shared tokens without per-user credentialing, passwords, or multi-factor authentication.
- **Open Settings Route:** `PUT /api/settings` does not call `verifyAdmin()` in the current codebase, allowing any client to modify settings if the endpoint is called directly.

---

# 20. DEPLOYMENT

### 20.1 Build and Run Scripts
```json
"scripts": {
  "dev": "tsx server.ts",
  "build": "vite build && esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs && esbuild server.ts --bundle --platform=node --format=esm --packages=external --outfile=api/index.js",
  "start": "node dist/server.cjs",
  "clean": "rm -rf dist server.js",
  "lint": "tsc --noEmit"
}
```

### 20.2 Platform Behaviors
1. **Railway / Render / Docker:**
   - Executes `npm run build && npm start`.
   - Runs `dist/server.cjs` as a persistent process.
   - Preserves local disk files (`database.json`) and runs `node-cron` at 3:00 AM daily.
2. **Vercel Serverless:**
   - Output directory: `dist`.
   - Routes rewritten via `vercel.json`: `/api/*` routed to `/api/index.js`.
   - `fs.writeFileSync(DB_PATH)` is disabled (`if (process.env.VERCEL) return`).
   - Scheduled refreshes handled by Vercel Cron (`vercel.json`: `0 3 * * *` targeting `/api/refresh`).

---

# 21. CURRENT KNOWN ISSUES

### CRITICAL
- None identified.

### HIGH
- **YouTube API Quota Burn:** Crawling 25+ creators with `/search` consumes ~2,500 units per run. At 10,000 units/day quota, running more than 4 full refreshes per day will exhaust the primary key quota without a backup key.

### MEDIUM
- **Ephemeral Filesystem on Serverless:** On Vercel, `memoryDb` and local disk reset between function cold starts. Firestore is required for consistent state on serverless hosting.
- **Unprotected `PUT /api/settings`:** The `PUT /api/settings` route lacks a `verifyAdmin()` guard, allowing unauthenticated configuration changes.

### LOW
- **Shared Hardcoded Tokens:** Token checking accepts hardcoded strings (`"nikhil_dubey_iiitian"`, etc.) alongside `ADMIN_TOKEN`.

---

# 22. PERFORMANCE AND SCALABILITY

### 22.1 Computational Complexity
- **YouTube Fetch:** $O(N)$ where $N$ is the number of active creators. With 50 creators, requires 50 search requests.
- **Video Deduplication:** $O(M)$ where $M$ is the number of videos, using `Set<string>` lookups.
- **Audio Grouping:** $O(M)$ string normalizations and hashtable assignments.
- **Ranking Sort:** $O(K \log K)$ where $K$ is the number of unique audio groups ($K \ll M$).

### 22.2 Bottlenecks at 10x / 100x Scale
- **10x Scale (250 Creators, ~2,000 Shorts):**
  - YouTube search quota: 250 creators $\times$ 100 units = 25,000 units. Exceeds standard single-key daily quota (10,000 units). Requires YouTube quota increase.
  - In-memory clustering remains fast (<100ms).
- **100x Scale (2,500 Creators, ~20,000 Shorts):**
  - Requires asynchronous message queues (e.g., Google Cloud Tasks, BullMQ) rather than an in-memory sequential loop.
  - Sequential crawling would exceed serverless function timeout limits (10s on Vercel Hobby, 60s on Pro).

---

# 23. FILE / FOLDER STRUCTURE

```
/
├── .dockerignore                       # Files ignored during Docker image assembly
├── .env.example                        # Production environment configuration template
├── .gitignore                          # Git ignored patterns (node_modules, dist, .env)
├── DEPLOYMENT.md                       # External deployment instructions (Railway, Vercel, Docker)
├── Dockerfile                          # Multi-stage production container build definition
├── api/
│   └── index.js                        # Bundled ESM server entry point for Vercel Serverless
├── assets/
│   └── .studio/
│       └── .gitignore                  # AI Studio metadata ignore definitions
├── bun.lock                            # Bun dependency lockfile
├── database.json                       # Local disk database cache & preloaded template (4.8 MB)
├── firebase-applet-config.json         # Active Firebase project configuration
├── firebase-blueprint.json             # Entity schemas & Firestore path declarations
├── firestore.rules                     # Cloud Firestore security rules
├── index.html                          # Single-page application HTML entry document
├── metadata.json                       # Applet capability flags & project metadata
├── package-lock.json                   # NPM dependency lockfile
├── package.json                        # Scripts, dependencies, and manifest
├── public/
│   └── favicon.svg                     # Application favicon
├── server.ts                           # Full-stack Express server, crawler, and API logic
├── src/
│   ├── App.tsx                         # Client application root, navigation layout, toast manager
│   ├── firestoreService.ts             # Firebase modular SDK service layer & Firestore operations
│   ├── index.css                       # Global styles, fonts, and Tailwind CSS imports
│   ├── main.tsx                        # React DOM mounting entry point & device ID setup
│   ├── types.ts                        # Shared TypeScript type definitions and interfaces
│   └── pages/
│       ├── Admin.tsx                   # Admin console: creators, settings, and crawl logs
│       ├── AudioDetails.tsx            # Audio deep-dive view with associated Shorts
│       ├── Dashboard.tsx               # Primary analytics dashboard and charts
│       ├── TrendingAudio.tsx           # Searchable viral sound leaderboard
│       └── TrendingVideos.tsx          # Representative viral Shorts showcase
├── tsconfig.json                       # TypeScript compiler configuration
├── vercel.json                         # Vercel deployment, rewrite, and cron definitions
└── vite.config.ts                      # Vite build configuration with Tailwind & React plugins
```

---

# 24. IMPORTANT FUNCTIONS

| Function Name | File | Inputs | Outputs | Side Effects | Database Interaction | External API Interaction |
|---|---|---|---|---|---|---|
| `performFullFetchRefresh` | `server.ts` | `triggerType: "manual" \| "scheduled"` | Object with crawl stats | Modifies `refreshStatus`, updates cache | Reads & writes `rawShorts`, `shorts`, `audios`, `sync_logs` | YouTube Data API v3, Google Gemini API |
| `retryRequest` | `server.ts` | Request fn, retries, delay, creator, endpoint, localDb, metrics, apiState | Response payload | Backoff delays, key failover | Logs errors to `refreshStatus.logs` | YouTube Data API v3 |
| `runTrendAnalysis` | `server.ts` | `shorts: Short[]`, `creators: Creator[]` | `{ shorts, audios }` | Computes trend scores, groups sounds | None directly | None |
| `analyzeShortsAudioWithGemini` | `server.ts` | `shorts: Short[]` | `Promise<Short[]>` | Populates `audioName` | None directly | Google Gemini API (`gemini-2.5-flash`) |
| `parseAudioOffline` | `server.ts` | `title, description, tags` | `{ audioName, artist }` | Pure parsing | None | None |
| `normalizeAudioName` | `server.ts` | `name: string` | Normalized `string` | Strips filler words, emojis, choreo words | None | None |
| `getAudioGroupingKey` | `server.ts` | `name: string` | Clean alphanumeric key | Removes non-alphanumeric chars | None | None |
| `validateCreatorInputFormat` | `server.ts` | `input: string` | `{ valid, error, type }` | Validates ID/Handle/URL format | None | None |
| `getTimeframeData` | `server.ts` | `db, requestedPeriodDays` | `{ shorts, audios, periodDays }` | Filters by date cutoff | Reads cache | None |
| `initFirestore` | `src/firestoreService.ts` | None | `Firestore \| null` | Initializes Firebase app | Establishes connection | Firebase Firestore |
| `syncFromFirestore` | `server.ts` | None | `Promise<void>` | Hydrates `memoryDb` from cloud | Reads all collections | Firebase Firestore |
| `migrateLocalDataToFirestore` | `src/firestoreService.ts` | `localDb: DatabaseSchema` | Migration results | Idempotent upsert of records | Writes all collections | Firebase Firestore |
| `upsertShortsInFirestore` | `src/firestoreService.ts` | `shorts: Short[]` | `Promise<boolean>` | Batches writes in chunks of 400 | Writes `shorts`, `audio_usage` | Firebase Firestore |

---

# 25. CRITICAL BUSINESS LOGIC

### 25.1 Trend Score Virality Formula
The trend virality score quantifies relative momentum across multiple creator channels:

$$\text{TrendScore} = \text{round}\left( (\text{UniqueCreators} \times 6000) + (\text{TotalShorts} \times 1500) + \left(\frac{\text{TotalViews}}{40000}\right) + \text{RecencyBonus} + \text{DiversityBonus} \right)$$

Where:
- **Recency Bonus:** Evaluated per Short in the sound group:
  - $\le 3\text{ days old: } +3000\text{ points}$
  - $\le 7\text{ days old: } +1500\text{ points}$
  - $\le 14\text{ days old: } +500\text{ points}$
- **Diversity Bonus:** Rewards tracks spreading across different creators:
  $$\text{DiversityBonus} = \text{round}\left( \frac{\text{UniqueCreators}}{\text{TotalShorts}} \times 2000 \right)$$
- **Default for "Original Audio":** Automatically assigned a baseline score of `500` to prevent unbranded tracks from displacing viral songs.

### 25.2 Choreography & "Chor" Disambiguation Rule
To prevent false matches between dance terminology and the popular song *"Chor"* by Justh:
- Words such as `choreo`, `choreography`, `dance cover`, `dance video`, `performance`, `routine`, `freestyle`, `rehearsal`, and `practice` are stripped during audio normalization.
- The matcher explicitly verifies word boundaries (`\bchor\b`) and verifies that `choreo` or `choreography` is not present before matching the song *"Chor"*.

---

# 26. ADMIN SYSTEM

### 26.1 Features and Capabilities
- **Authentication:** Token challenge wall in `Admin.tsx` verified by `verifyAdmin()` in `server.ts`.
- **Creator Management:**
  - Auto-resolves `@handles` and channel URLs to stable 24-character Channel IDs (`UC...`).
  - Active/pause toggle: Paused creators are retained but skipped during crawls.
  - Channel deletion: Automatically purges all associated Shorts and re-indexes trends.
- **Crawl Execution & Monitoring:**
  - Manual crawl trigger button with live progress indicator.
  - Streaming log console displaying each stage in real time.
  - Historical table with expandable failure breakdowns.

---

# 27. API ROUTE REFERENCE TABLE

| Method | Endpoint | Purpose | Reads DB | Writes DB | External APIs |
|---|---|---|:---:|:---:|---|
| `GET` | `/api/dashboard` | Summary statistics & KPI metrics | Yes | No | None |
| `GET` | `/api/creators` | List tracked creators with search | Yes | No | None |
| `POST` | `/api/creators` | Register new creator channel | Yes | Yes | YouTube Data v3 |
| `PUT` | `/api/creators/:id` | Update creator metadata / channel ID | Yes | Yes | None |
| `DELETE` | `/api/creators/:id` | Remove creator & associated Shorts | Yes | Yes | None |
| `POST` | `/api/creators/import` | Bulk import creator IDs | Yes | Yes | None |
| `GET` | `/api/settings` | Read global system settings | Yes | No | None |
| `PUT` | `/api/settings` | Update system settings & API keys | Yes | Yes | None |
| `GET` | `/api/trending/audio` | List grouped audio tracks | Yes | No | None |
| `GET` | `/api/trending/videos` | List top representative Short per sound | Yes | No | None |
| `GET` | `/api/audio/:audioId` | Get sound metadata & all Shorts | Yes | No | None |
| `POST` | `/api/refresh` | Trigger manual crawl (Admin) | Yes | Yes | YouTube v3, Gemini |
| `GET` | `/api/refresh` | Trigger scheduled crawl (Vercel Cron) | Yes | Yes | YouTube v3, Gemini |
| `GET` | `/api/fetch-info` | Real-time crawl logs & history | Yes | No | None |
| `GET` | `/api/db-stats` | Database storage & health stats | Yes | No | None |
| `GET` | `/api/logs` | Last 100 HTTP API request logs | Yes | No | None |

---

# 28. DATABASE REFERENCE TABLE

| Collection | Purpose | Main Fields | Created By | Updated By |
|---|---|---|---|---|
| `creators` | Tracked channels | `id`, `name`, `handle`, `avatarUrl`, `enabled`, `addedDate` | `POST /api/creators` | `PUT /api/creators/:id` |
| `shorts` | Rolling 30d Shorts | `videoId`, `title`, `views`, `likes`, `creatorId`, `audioId`, `videoUrl` | `performFullFetchRefresh` | `performFullFetchRefresh` |
| `audios` | Clustered sound trends | `id`, `name`, `artist`, `uniqueCreatorsCount`, `totalViews`, `trendScore` | `performFullFetchRefresh` | `performFullFetchRefresh` |
| `audio_usage` | Video-to-audio cross-reference | `id`, `audioId`, `videoId`, `creatorId`, `views`, `publishedDate` | `upsertShortsInFirestore` | `upsertShortsInFirestore` |
| `sync_logs` | Audit trail of crawl runs | `id`, `startTime`, `endTime`, `status`, `durationSec`, `videosProcessed` | `performFullFetchRefresh` | None (immutable) |
| `settings` | App config & live status | Doc `app`: settings; Doc `refresh_status`: live logs & progress | `server.ts` boot | `PUT /api/settings`, Crawl worker |

---

# 29. COMPLETE DATA LIFECYCLE

```
[YouTube Platform]
       |
       | 1. HTTP GET /search & /videos
       v
[Crawl Worker]
       |
       | 2. Deduplication check (existingIdsSet)
       v
[Raw Video Intake]
       |
       | 3. Unidentified audio tracks sent to Gemini 2.5 Flash
       v
[AI / Offline Parsing]
       |
       | 4. Regex normalization & cluster mapping
       v
[Clustering Engine]
       |
       | 5. Multi-factor trend virality scoring
       v
[Validation Gate]
       |
       +---> If invalid: Reject update, preserve old cache
       |
       +---> If valid:
             |
             +---> Write to Firestore (batch size 400)
             |
             +---> Write to local database.json (non-Vercel)
             |
             +---> Pre-compute trendsCache (7, 14, 21, 30 days)
             |
             +---> Log audit record to sync_logs
                   |
                   v
             [API Delivery] (/api/dashboard, /api/trending/*)
                   |
                   v
             [React Frontend] (Live view re-render)
```

---

# 30. GLOSSARY

- **Creator:** A tracked YouTube channel defined by a 24-character channel ID (`UC...`), display name, handle, and avatar.
- **Short:** A vertical video under 60 seconds uploaded to YouTube with metadata (`views`, `likes`, `videoId`).
- **Audio Group:** A canonical cluster representing a unique musical track, song, or soundbite aggregated across creators.
- **Velocity / Trend Score:** A composite score reflecting a track's momentum based on creator count, video volume, total views, and upload recency.
- **Rolling Window:** The 30-day temporal cutoff that defines active analysis scope; older videos are excluded.
- **Failover Key:** A secondary YouTube Data API key automatically activated when the primary key's daily quota is exhausted.
- **Sync Log:** An immutable audit record capturing execution timing, metrics, and errors for a crawl run.
- **Representative Short:** The single highest-viewed Short for a specific audio group displayed on the Trending Videos page.

---

# 31. FINAL SUMMARY

### A. What the Application Does
Trend Finder tracks a curated roster of YouTube creators, identifies viral background audio tracks used in their Shorts, groups duplicates into canonical records, and ranks them by virality momentum across rolling timeframes (7 to 30 days).

### B. How the Application Works
The backend executes scheduled or on-demand crawls via the YouTube Data API v3, applies Gemini 2.5 Flash and heuristic parsing to extract audio attributions, clusters tracks, computes multi-factor trend scores, and serves pre-computed cached views to a React 19 frontend.

### C. Where Data is Stored
Primary persistence is in **Firebase Firestore** (`silicon-chemist-g7c1c`), with secondary persistence in local `database.json` and in-memory caches.

### D. What Survives a Server Restart
- All Firestore collections (`creators`, `shorts`, `audios`, `audio_usage`, `sync_logs`, `settings`).
- Local `database.json` on persistent servers (Docker / Railway).
- User preferences (`timeframe`, `device_id`) in browser `localStorage`.

### E. What Does NOT Survive a Server Restart
- Transient in-memory HTTP API logs (`db.apiLogs`, capped at 100).
- Local filesystem writes on serverless platforms (Vercel).
- Active admin browser sessions (`sessionStorage`).

### F. Major External Dependencies
- Google YouTube Data API v3
- Google Gemini API (`@google/genai`)
- Firebase Firestore

### G. Major Quotas and Limitations
- **YouTube API:** Default 10,000 units/day (managed via backup key failover and search deduplication).
- **Gemini API:** Subject to model rate limits (handled via 20-video chunking and offline parser fallback).
- **Firestore:** 500 writes/batch limit (managed via 400-doc chunking).

### H. Current Technical Risks
- High crawl frequency without a backup YouTube key can exhaust daily API quotas.
- Running long crawls on serverless platforms could hit execution timeouts if creator volume scales significantly.

### I. Recommended Areas for Future Improvement
- Implement individual admin user authentication (e.g., Firebase Auth) in place of shared tokens.
- Add an asynchronous task queue (e.g., Cloud Tasks) for distributed crawl processing at scale.
- Add an explicit `verifyAdmin()` guard to the `PUT /api/settings` route.

---

# QUICK REFERENCE FOR FUTURE DEVELOPMENT

1. **Local Development:** Run `npm run dev` (starts full-stack server on `http://localhost:3000` with Vite middleware).
2. **Production Build:** Run `npm run build` (builds client to `dist/`, bundles CommonJS server to `dist/server.cjs`, and bundles ESM serverless entry to `api/index.js`).
3. **Environment Setup:** Copy `.env.example` to `.env`. Ensure `YOUTUBE_API_KEY` is populated. `FIREBASE_PROJECT_ID` defaults to `silicon-chemist-g7c1c`.
4. **Admin Access:** Default development tokens accepted: `"nikhil_dubey_iiitian"`, `"gmailgmail"`, `"iiit_gwalior"`, or whatever is set in `ADMIN_TOKEN`.
5. **Database Rules:** Never bypass Firestore chunking when writing records; always chunk at $\le 400$ operations per batch.
6. **Audio Disambiguation:** When modifying audio grouping logic in `server.ts`, preserve the whole-word regex guards that protect the song *"Chor"* from matching the keyword *"choreo"*.
7. **Client Routing:** The app uses `HashRouter`; all client navigation routes must use hash paths (e.g., `/#/trending-audio`).
