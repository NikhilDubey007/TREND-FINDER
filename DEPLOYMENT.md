# Trend Finder — External Deployment Guide

This guide details how to build, configure, and deploy **Trend Finder: YouTube Shorts & Viral Audio Tracker** to external hosting platforms such as **Railway**, **Vercel**, **Render**, **Fly.io**, or any standard Docker / Node.js container.

---

## 1. Architecture Overview

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS + Lucide Icons + Recharts.
- **Backend**: Express (Node.js) handling YouTube Data API v3 calls, audio trend normalization, scheduled background fetching, and REST API routes.
- **Database / Storage Layer**: **Firebase Firestore** for persistent cloud storage across deployments and server restarts, with automatic local caching.

---

## 2. Prerequisites & Local Setup

### System Requirements
- Node.js 20+ (recommended: LTS Node 20.x or 22.x)
- npm 10+

### Installation
```bash
git clone <your-repository-url>
cd trend-finder
npm install
```

### Local Development
```bash
# 1. Copy the environment template
cp .env.example .env

# 2. Fill in your API keys in .env (see Environment Variables section below)

# 3. Start local development server (runs full-stack dev server with Vite middleware)
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 3. Production Build & Test Locally

To test the production build locally before deploying:

```bash
# Compile frontend and bundle Express server into dist/
npm run build

# Start production server
npm start
```
The server will bind to `PORT` (defaults to `3000`) and serve both the API endpoints (`/api/*`) and the compiled single-page application (`dist/index.html`).

---

## 4. Environment Variables Reference

Configure these variables in your hosting provider's dashboard (e.g., Railway Variables or Vercel Environment Variables). **Never commit real values into your repository.**

| Variable Name | Required | Default | Description |
|---|---|---|---|
| `PORT` | Optional | `3000` | Port for the HTTP server to listen on. Automatically set by Railway, Render, etc. |
| `NODE_ENV` | Optional | `production` | Set to `production` in live environments. |
| `CORS_ORIGIN` | Optional | `*` | Allowed CORS origins (e.g., `https://my-app.vercel.app` or `*`). |
| `ADMIN_TOKEN` | Recommended | — | Custom secret token to authenticate administrative write actions. |
| `YOUTUBE_API_KEY` | **Required** | — | Google Cloud YouTube Data API v3 key for pulling YouTube Shorts. |
| `YOUTUBE_API_KEY_BACKUP` | Optional | — | Backup YouTube API key used automatically if the primary quota is exhausted. |
| `GEMINI_API_KEY` | Optional | — | Google Gemini API key used for advanced AI audio title recognition and pattern analysis. |
| `FIREBASE_PROJECT_ID` | **Required*** | — | Firebase project ID (e.g., `my-project-12345`). |
| `FIREBASE_DATABASE_ID` | Optional | `(default)` | Firestore database ID if using a named database instead of default. |
| `FIREBASE_API_KEY` | Optional | — | Firebase Web API key. |
| `FIREBASE_AUTH_DOMAIN` | Optional | — | Firebase Auth Domain (e.g., `<project-id>.firebaseapp.com`). |
| `FIREBASE_STORAGE_BUCKET` | Optional | — | Firebase Storage bucket URL if utilized. |
| `FIREBASE_CONFIG` | Optional | — | Full Firebase config JSON string (alternative to setting individual Firebase variables). |

*\*Note: If `firebase-applet-config.json` is committed in your repository, Firebase variables will load from it automatically unless explicitly overridden by environment variables.*

---

## 5. Deploying to Railway (Recommended for Full Persistence & Cron)

Railway runs persistent containerized applications, making it ideal for Trend Finder's 24/7 background cron job (`0 3 * * *` daily 3:00 AM auto-fetch) and continuous Firestore syncing.

### Steps:
1. Push your code to a GitHub or GitLab repository.
2. Sign in to [Railway](https://railway.app/) and click **New Project** → **Deploy from GitHub repo**.
3. Select your Trend Finder repository.
4. Go to the project **Settings**:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
5. Go to the **Variables** tab and add the required environment variables:
   - `YOUTUBE_API_KEY`
   - `YOUTUBE_API_KEY_BACKUP` (optional)
   - `GEMINI_API_KEY` (optional)
   - `ADMIN_TOKEN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_DATABASE_ID` (if using a custom database ID)
   - `FIREBASE_API_KEY`
6. Click **Generate Domain** in the **Networking** settings to expose your app publicly.
7. Railway will build and launch your application. The daily scheduler, background refresh, and Firestore integration will run automatically.

---

## 6. Deploying to Vercel

Trend Finder includes built-in Vercel configuration (`vercel.json` and `api/index.ts`) for serverless deployment.

### Steps:
1. Push your repository to GitHub / GitLab / Bitbucket.
2. Go to [Vercel](https://vercel.com/) and click **Add New...** → **Project**.
3. Import your repository.
4. In **Project Settings**:
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Under **Environment Variables**, add:
   - `YOUTUBE_API_KEY`
   - `YOUTUBE_API_KEY_BACKUP`
   - `GEMINI_API_KEY`
   - `ADMIN_TOKEN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_DATABASE_ID` (if applicable)
   - `FIREBASE_API_KEY`
6. Click **Deploy**.

### Scheduled Refreshes on Vercel:
Because serverless functions do not keep persistent in-memory processes running, `vercel.json` includes a native **Vercel Cron**:
```json
"crons": [
  {
    "path": "/api/refresh",
    "schedule": "0 3 * * *"
  }
]
```
Vercel will trigger `/api/refresh` daily at 3:00 AM UTC automatically.

---

## 7. Deploying with Docker

A production multi-stage `Dockerfile` is included in the project root.

### Build and Run:
```bash
# Build Docker image
docker build -t trend-finder .

# Run container
docker run -d \
  -p 3000:3000 \
  --name trend-finder \
  -e YOUTUBE_API_KEY="your_api_key" \
  -e FIREBASE_PROJECT_ID="your_firebase_project_id" \
  trend-finder
```

---

## 8. Routing & Single-Page Application (SPA)

Trend Finder uses client-side routing via React Router (`/`, `/trends`, `/audio/:id`, `/creators`, `/logs`, `/admin`).

- **Railway / Express Production**: Express automatically serves `dist/index.html` for all non-API routes with direct refresh support. Unhandled API calls return 404 JSON instead of HTML.
- **Vercel**: `vercel.json` provides rewrite rules (`/((?!api/).*)` → `/index.html`), ensuring page reloads and deep links resolve cleanly.

---

## 9. Security Best Practices

1. **Protect Your API Keys**:
   - Ensure `.env` is listed in `.gitignore` (already configured).
   - Never commit Google Cloud, YouTube, or Gemini API keys to Git.
2. **Restrict YouTube API Keys in Google Cloud Console**:
   - In Google Cloud Console, restrict your YouTube API key to the **YouTube Data API v3**.
   - Under Application restrictions, set IP restrictions if using a static IP server, or leave unrestricted if using dynamic cloud runners.
3. **Admin Token**:
   - Set a strong `ADMIN_TOKEN` in production to safeguard refresh triggers and creator management actions.
