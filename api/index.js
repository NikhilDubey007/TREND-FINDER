// server.ts
import express from "express";
import path2 from "path";
import fs2 from "fs";
import dotenv from "dotenv";
import axios from "axios";
import { GoogleGenAI, Type } from "@google/genai";
import crypto from "crypto";
import cron from "node-cron";

// src/firestoreService.ts
import fs from "fs";
import path from "path";
import { initializeApp, getApps } from "firebase/app";
import {
  initializeFirestore,
  memoryLocalCache,
  setLogLevel,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  writeBatch
} from "firebase/firestore";
function sanitizeForFirestore(data) {
  if (data === null || data === void 0) return data;
  if (Array.isArray(data)) {
    return data.map((item) => sanitizeForFirestore(item));
  }
  if (typeof data === "object") {
    const cleaned = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== void 0) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned;
  }
  return data;
}
var firestoreInstance = null;
var isInitialized = false;
var isReachable = false;
function initFirestore() {
  if (firestoreInstance && isInitialized) {
    return firestoreInstance;
  }
  try {
    let firebaseConfig = null;
    if (process.env.FIREBASE_CONFIG) {
      try {
        const parsed = JSON.parse(process.env.FIREBASE_CONFIG);
        firebaseConfig = { ...parsed };
      } catch (err) {
        console.warn("[Firestore] Failed to parse FIREBASE_CONFIG environment variable JSON:", err);
      }
    }
    if (!firebaseConfig) {
      const configPath = path.join(process.cwd(), "firebase-applet-config.json");
      if (fs.existsSync(configPath)) {
        try {
          const raw = fs.readFileSync(configPath, "utf-8");
          firebaseConfig = JSON.parse(raw);
        } catch (err) {
          console.warn("[Firestore] Failed to parse firebase-applet-config.json:", err);
        }
      }
    }
    const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig?.projectId;
    const apiKey = process.env.FIREBASE_API_KEY || firebaseConfig?.apiKey;
    const databaseId = process.env.FIREBASE_DATABASE_ID || firebaseConfig?.firestoreDatabaseId;
    const authDomain = process.env.FIREBASE_AUTH_DOMAIN || firebaseConfig?.authDomain || (projectId ? `${projectId}.firebaseapp.com` : void 0);
    const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || firebaseConfig?.storageBucket;
    const messagingSenderId = process.env.FIREBASE_MESSAGING_SENDER_ID || firebaseConfig?.messagingSenderId;
    const appId = process.env.FIREBASE_APP_ID || firebaseConfig?.appId;
    if (!firebaseConfig && !projectId) {
      console.warn("[Firestore] No Firebase configuration found. Falling back to local storage.");
      return null;
    }
    const finalConfig = {
      projectId,
      apiKey: apiKey || firebaseConfig?.apiKey,
      authDomain,
      firestoreDatabaseId: databaseId || firebaseConfig?.firestoreDatabaseId,
      storageBucket,
      messagingSenderId,
      appId
    };
    const apps = getApps();
    const app2 = apps.length > 0 ? apps[0] : initializeApp(finalConfig);
    setLogLevel("error");
    firestoreInstance = initializeFirestore(
      app2,
      { localCache: memoryLocalCache() },
      finalConfig.firestoreDatabaseId || void 0
    );
    isInitialized = true;
    isReachable = true;
    console.log(`[Firestore] Connected successfully to database: ${finalConfig.firestoreDatabaseId || "(default)"} (Project: ${finalConfig.projectId})`);
    return firestoreInstance;
  } catch (err) {
    console.error("[Firestore] Initialization failed. Falling back gracefully:", err);
    isInitialized = false;
    isReachable = false;
    return null;
  }
}
function isFirestoreAvailable() {
  if (!isInitialized || !firestoreInstance) {
    initFirestore();
  }
  return isReachable && firestoreInstance !== null;
}
async function fetchCreatorsFromFirestore() {
  const db = initFirestore();
  if (!db) return null;
  try {
    const colRef = collection(db, "creators");
    const snap = await getDocs(colRef);
    const creators = [];
    snap.forEach((docSnap) => {
      creators.push(docSnap.data());
    });
    return creators;
  } catch (err) {
    console.error("[Firestore] Failed to fetch creators:", err);
    return null;
  }
}
async function upsertCreatorInFirestore(creator) {
  const db = initFirestore();
  if (!db) return false;
  try {
    const docRef = doc(db, "creators", creator.id);
    await setDoc(docRef, sanitizeForFirestore(creator), { merge: true });
    return true;
  } catch (err) {
    console.error(`[Firestore] Failed to upsert creator ${creator.id}:`, err);
    return false;
  }
}
async function deleteCreatorFromFirestore(creatorId) {
  const db = initFirestore();
  if (!db) return false;
  try {
    const docRef = doc(db, "creators", creatorId);
    await deleteDoc(docRef);
    const shortsRef = collection(db, "shorts");
    const q = query(shortsRef, where("creatorId", "==", creatorId));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.forEach((sDoc) => {
        batch.delete(sDoc.ref);
      });
      await batch.commit();
    }
    return true;
  } catch (err) {
    console.error(`[Firestore] Failed to delete creator ${creatorId}:`, err);
    return false;
  }
}
async function fetchRawShortsFromFirestore(cutoffDate) {
  const db = initFirestore();
  if (!db) return null;
  try {
    const colRef = collection(db, "shorts");
    let snap;
    if (cutoffDate) {
      const q = query(colRef, where("publishedDate", ">=", cutoffDate));
      snap = await getDocs(q);
    } else {
      snap = await getDocs(colRef);
    }
    const shorts = [];
    snap.forEach((docSnap) => {
      shorts.push(docSnap.data());
    });
    return shorts;
  } catch (err) {
    console.error("[Firestore] Failed to fetch shorts:", err);
    return null;
  }
}
async function upsertShortsInFirestore(shorts) {
  const db = initFirestore();
  if (!db || shorts.length === 0) return false;
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < shorts.length; i += CHUNK_SIZE) {
      const chunk = shorts.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const s of chunk) {
        if (!s.videoId) continue;
        const sRef = doc(db, "shorts", s.videoId);
        batch.set(sRef, sanitizeForFirestore(s), { merge: true });
      }
      await batch.commit();
    }
    return true;
  } catch (err) {
    console.warn("[Firestore] Failed to upsert shorts batch (quota or network):", err);
    return false;
  }
}
async function fetchTrendsCacheFromFirestore() {
  const db = initFirestore();
  if (!db) return null;
  try {
    const docRef = doc(db, "settings", "trends_cache");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.warn("[Firestore] Failed to fetch trends cache:", err);
    return null;
  }
}
async function saveTrendsCacheToFirestore(trendsCache) {
  const db = initFirestore();
  if (!db) return false;
  try {
    const docRef = doc(db, "settings", "trends_cache");
    await setDoc(docRef, sanitizeForFirestore(trendsCache), { merge: true });
    return true;
  } catch (err) {
    console.warn("[Firestore] Failed to save trends cache:", err);
    return false;
  }
}
async function fetchAudiosFromFirestore() {
  const db = initFirestore();
  if (!db) return null;
  try {
    const colRef = collection(db, "audios");
    const snap = await getDocs(colRef);
    const audios = [];
    snap.forEach((docSnap) => {
      audios.push(docSnap.data());
    });
    return audios;
  } catch (err) {
    console.error("[Firestore] Failed to fetch audios:", err);
    return null;
  }
}
async function upsertAudiosInFirestore(audios) {
  const db = initFirestore();
  if (!db || audios.length === 0) return false;
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < audios.length; i += CHUNK_SIZE) {
      const chunk = audios.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const a of chunk) {
        if (!a.id) continue;
        const aRef = doc(db, "audios", a.id);
        batch.set(aRef, sanitizeForFirestore(a), { merge: true });
      }
      await batch.commit();
    }
    return true;
  } catch (err) {
    console.error("[Firestore] Failed to upsert audios batch:", err);
    return false;
  }
}
async function fetchSettingsFromFirestore() {
  const db = initFirestore();
  if (!db) return null;
  try {
    const docRef = doc(db, "settings", "app");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.error("[Firestore] Failed to fetch settings:", err);
    return null;
  }
}
async function upsertSettingsInFirestore(settings) {
  const db = initFirestore();
  if (!db) return false;
  try {
    const docRef = doc(db, "settings", "app");
    await setDoc(docRef, sanitizeForFirestore(settings), { merge: true });
    return true;
  } catch (err) {
    console.error("[Firestore] Failed to upsert settings:", err);
    return false;
  }
}
async function fetchSyncLogsFromFirestore(maxResults = 50) {
  const db = initFirestore();
  if (!db) return null;
  try {
    const colRef = collection(db, "sync_logs");
    const q = query(colRef, orderBy("startTime", "desc"), firestoreLimit(maxResults));
    const snap = await getDocs(q);
    const logs = [];
    snap.forEach((docSnap) => {
      logs.push(docSnap.data());
    });
    return logs;
  } catch (err) {
    console.error("[Firestore] Failed to fetch sync logs:", err);
    return null;
  }
}
async function appendSyncLogInFirestore(log) {
  const db = initFirestore();
  if (!db || !log.id) return false;
  try {
    const docRef = doc(db, "sync_logs", log.id);
    await setDoc(docRef, sanitizeForFirestore(log), { merge: true });
    return true;
  } catch (err) {
    console.error("[Firestore] Failed to save sync log:", err);
    return false;
  }
}
async function fetchRefreshStatusFromFirestore() {
  const db = initFirestore();
  if (!db) return null;
  try {
    const docRef = doc(db, "settings", "refresh_status");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (err) {
    console.error("[Firestore] Failed to fetch refresh status:", err);
    return null;
  }
}
async function saveRefreshStatusToFirestore(status) {
  const db = initFirestore();
  if (!db) return false;
  try {
    const docRef = doc(db, "settings", "refresh_status");
    await setDoc(docRef, sanitizeForFirestore(status), { merge: true });
    return true;
  } catch (err) {
    console.error("[Firestore] Failed to save refresh status:", err);
    return false;
  }
}
async function migrateLocalDataToFirestore(localDb) {
  const db = initFirestore();
  if (!db) {
    return {
      success: false,
      migratedCreators: 0,
      migratedShorts: 0,
      migratedAudios: 0,
      migratedLogs: 0,
      error: "Firestore not initialized"
    };
  }
  try {
    console.log("[Firestore Migration] Starting idempotent migration of local database records to Firestore...");
    const existingCreators = await fetchCreatorsFromFirestore();
    let migratedCreators = 0;
    if (localDb.creators && localDb.creators.length > 0) {
      const existingIds = new Set((existingCreators || []).map((c) => c.id));
      for (const creator of localDb.creators) {
        if (creator.id && !existingIds.has(creator.id)) {
          await upsertCreatorInFirestore(creator);
          migratedCreators++;
        }
      }
    }
    const existingShorts = await fetchRawShortsFromFirestore();
    let migratedShorts = 0;
    const allShorts = localDb.rawShorts || localDb.shorts || [];
    if ((!existingShorts || existingShorts.length === 0) && allShorts.length > 0) {
      await upsertShortsInFirestore(allShorts);
      migratedShorts = allShorts.length;
    } else {
      console.log(`[Firestore Migration] Preserving cloud shorts: Firestore already has ${existingShorts?.length || 0} shorts.`);
    }
    const existingAudios = await fetchAudiosFromFirestore();
    let migratedAudios = 0;
    if ((!existingAudios || existingAudios.length === 0) && localDb.audios && localDb.audios.length > 0) {
      await upsertAudiosInFirestore(localDb.audios);
      migratedAudios = localDb.audios.length;
    } else {
      console.log(`[Firestore Migration] Preserving cloud audios: Firestore already has ${existingAudios?.length || 0} audios.`);
    }
    if (localDb.settings) {
      await upsertSettingsInFirestore(localDb.settings);
    }
    let migratedLogs = 0;
    if (localDb.fetchHistory && localDb.fetchHistory.length > 0) {
      for (const log of localDb.fetchHistory) {
        if (log.id) {
          await appendSyncLogInFirestore(log);
          migratedLogs++;
        }
      }
    }
    console.log(
      `[Firestore Migration] Completed successfully: ${migratedCreators} creators, ${migratedShorts} shorts, ${migratedAudios} audios, ${migratedLogs} logs migrated.`
    );
    return {
      success: true,
      migratedCreators,
      migratedShorts,
      migratedAudios,
      migratedLogs
    };
  } catch (err) {
    console.error("[Firestore Migration] Encountered error during migration:", err);
    return {
      success: false,
      migratedCreators: 0,
      migratedShorts: 0,
      migratedAudios: 0,
      migratedLogs: 0,
      error: err?.message || String(err)
    };
  }
}

// server.ts
dotenv.config();
var ai = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY" ? new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "trend-finder"
    }
  }
}) : null;
var app = express();
var PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3e3;
var DB_PATH = path2.join(process.cwd(), "database.json");
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigin = process.env.CORS_ORIGIN || "*";
  if (allowedOrigin === "*" || origin && (origin === allowedOrigin || allowedOrigin.split(",").map((o) => o.trim()).includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-admin-token, x-founder-pin");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
function validateCreatorInputFormat(input) {
  const trimmed = input.trim();
  if (!trimmed) {
    return { valid: false, error: "Input cannot be empty." };
  }
  if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) {
    return { valid: true, type: "id" };
  }
  if (/^@[a-zA-Z0-9._-]+$/.test(trimmed)) {
    return { valid: true, type: "handle" };
  }
  if (trimmed.includes("youtube.com") || trimmed.includes("youtu.be")) {
    const hasChannel = trimmed.includes("/channel/UC") && trimmed.match(/channel\/(UC[a-zA-Z0-9_-]{22})/i);
    const hasHandle = trimmed.includes("/@") && trimmed.match(/@([a-zA-Z0-9._-]+)/i);
    const hasLegacy = trimmed.match(/\/(?:c|user)\/([a-zA-Z0-9._-]+)/i);
    if (hasChannel || hasHandle || hasLegacy) {
      return { valid: true, type: "url" };
    }
    return { valid: false, error: "Invalid YouTube URL format. Must point to a channel ID or @handle." };
  }
  if (/^[a-zA-Z0-9._-]+$/.test(trimmed) && trimmed.length > 3) {
    return { valid: true, type: "handle" };
  }
  return { valid: false, error: "Invalid format. Enter a 24-char YouTube Channel ID (UC...), @handle, or channel URL." };
}
var defaultCreators = [
  { id: "UC_rohit_r_w_t01_gwalior", name: "Rohit R.W.T.", enabled: true, handle: "@rohit__r_w_t01", avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=60" },
  { id: "UC_samriti_01_gwalior", name: "Samriti", enabled: true, handle: "@Samriti_01", avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop&q=60" },
  { id: "UC_kanishthasharmaa_gwalior", name: "Kanishtha Sharma", enabled: true, handle: "@kanishthasharmaa", avatarUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120&auto=format&fit=crop&q=60" },
  { id: "UC_mahek_chauhan_gwalior", name: "Mahek Chauhan", enabled: true, handle: "@mahek.chauhan", avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=60" },
  { id: "UC_nikhil_dubey_iiitian_gwalior", name: "NIKHIL DUBEY", enabled: true, handle: "@Nikhil_Dubey_IIITian", avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=60" }
];
var defaultSettings = {
  creatorLimit: 9999,
  // All
  periodDays: 7
};
var REAL_SHORTS_IDS = [
  "6GZ8VqS_Hk8",
  "h_E9UqA8N5A",
  "S9qM6_6uQ_0",
  "_oW_13mB8-4",
  "vB6zI3-g4lY",
  "9_CbyxWpQG4",
  "m8HgO-P-r-E",
  "3N_p6B0Ym8",
  "fV_S_E81lA0",
  "X0tX-v_lV_8",
  "l7n1_C6_8N0",
  "yY8pY_A6V48",
  "uX9zE4r8XgA",
  "g_v8O-Q2PqI",
  "W9tX_O8aN5k",
  "z0oP_uA6_O4",
  "p8YV8D-W_g4",
  "R-C4O8P-v8A",
  "_pX7V-Y-t_8",
  "dQw4w9WgXcQ"
];
var generateMockShorts = (creatorsList, periodDays) => {
  const shorts = [];
  const songs = [
    { title: "Tauba Tauba", artist: "Karan Aujla" },
    { title: "Aaj Ki Raat", artist: "Sachin-Jigar & Madhubanti Bagchi" },
    { title: "Heeriye", artist: "Jasleen Royal & Arijit Singh" },
    { title: "Softly", artist: "Karan Aujla" },
    { title: "Teeji Seat", artist: "Kaka" },
    { title: "Ishq", artist: "Amir Amir" },
    { title: "Kesariya", artist: "Arijit Singh" },
    { title: "Chuttamalle", artist: "Anirudh Ravichander" },
    { title: "Guli Mata", artist: "Saad Lamjarred & Shreya Ghoshal" },
    { title: "Chor", artist: "Justh" },
    { title: "Soni Soni", artist: "Darshan Raval" },
    { title: "Kahani Suno 2.0", artist: "Kaifi Khalil" }
  ];
  const now = /* @__PURE__ */ new Date();
  creatorsList.forEach((creator, cIdx) => {
    const baseShorts = Math.max(1, Math.floor(periodDays * 0.3) + 1);
    const numShorts = baseShorts + cIdx % 4;
    for (let s = 0; s < numShorts; s++) {
      const song = songs[(cIdx + s) % songs.length];
      const videoId = REAL_SHORTS_IDS[(cIdx * 5 + s) % REAL_SHORTS_IDS.length];
      const views = Math.floor(1e5 + Math.random() * 85e5);
      const likes = Math.floor(views * (0.05 + Math.random() * 0.08));
      const dateOffset = Math.floor(Math.random() * periodDays * 24 * 60) * 60 * 1e3;
      const publishedDate = new Date(now.getTime() - dateOffset).toISOString();
      const titleVariations = [
        `${song.title} challenge! \u{1F602}\u{1F525}`,
        `Dancing to ${song.title} by ${song.artist}`,
        `Have you heard ${song.title} yet??`,
        `This is literally so ${song.title.toLowerCase()}...`,
        `${song.artist} - ${song.title} cover`,
        `${song.title} dance tutorial \u2728`,
        `POV: ${song.title} starts playing`
      ];
      const title = titleVariations[(cIdx + s) % titleVariations.length];
      const audioName = `${song.title} - ${song.artist}`;
      const description = `This is amazing! Check out my performance on this song.

Music in this video:
Song: ${song.title}
Artist: ${song.artist}
Hope you like the choreography and dance routine! #dance #short`;
      const tags = ["shorts", "trending", "viral", song.title.toLowerCase().replace(/\s+/g, ""), "choreo"];
      const thumbId = (cIdx * 7 + s) % 1e3;
      const thumbnailUrl = `https://images.unsplash.com/photo-${15e11 + thumbId}?w=400&h=600&fit=crop&q=80`;
      shorts.push({
        videoId,
        title,
        thumbnailUrl,
        views,
        likes,
        publishedDate,
        creatorName: creator.name,
        creatorId: creator.id,
        videoUrl: `https://www.youtube.com/shorts/${videoId}`,
        audioName,
        audioId: "",
        // Filled in by analysis/grouping logic
        description,
        tags
      });
    }
  });
  return shorts;
};
var STANDARD_SONGS = [
  { title: "Tauba Tauba", artist: "Karan Aujla" },
  { title: "Aaj Ki Raat", artist: "Sachin-Jigar & Madhubanti Bagchi" },
  { title: "Heeriye", artist: "Jasleen Royal & Arijit Singh" },
  { title: "Softly", artist: "Karan Aujla" },
  { title: "Teeji Seat", artist: "Kaka" },
  { title: "Ishq", artist: "Amir Amir" },
  { title: "Kesariya", artist: "Arijit Singh" },
  { title: "Chuttamalle", artist: "Anirudh Ravichander" },
  { title: "Guli Mata", artist: "Saad Lamjarred & Shreya Ghoshal" },
  { title: "Chor", artist: "Justh" },
  { title: "Soni Soni", artist: "Darshan Raval" },
  { title: "Kahani Suno 2.0", artist: "Kaifi Khalil" },
  { title: "Dekha Tenu", artist: "Mohammad Faiz" },
  { title: "Besharmi Ki Height", artist: "Benny Dayal" },
  { title: "Aadat Se Majboor", artist: "Benny Dayal" }
];
function normalizeAudioName(name) {
  if (!name) return "";
  let normalized = name.trim();
  normalized = normalized.replace(/#\w+/g, "");
  normalized = normalized.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g, "");
  normalized = normalized.replace(/[\[\(][^\]\)]*(?:official|video|audio|lyrics|music|remix|ft|feat|dance|cover|choreo|choreography|performance|routine|freestyle|rehearsal|practice)[^\]\)]*[\]\)]/gi, "");
  const choreographyRegex = /\b(?:choreo|choreography|dance cover|dance video|dance|performance|routine|freestyle|rehearsal|practice)\b/gi;
  normalized = normalized.replace(choreographyRegex, "");
  normalized = normalized.replace(/\b(?:official audio|official video|official music video|lyrics|lyric video|original sound|original|sound|music|cover|remix|feat|ft|shorts|short|challenge|tutorial|by|with|trending|viral)\b/gi, "");
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\_`~()\[\]?|❤️🔥✨😂]/g, " ");
  normalized = normalized.replace(/\s+/g, " ").trim();
  return normalized;
}
function getAudioGroupingKey(name) {
  if (!name) return "originalaudio";
  const nameLower = name.toLowerCase();
  if (nameLower === "original sound" || nameLower === "original audio" || nameLower.includes("original sound") || nameLower.includes("original audio")) {
    return "originalaudio";
  }
  let clean = normalizeAudioName(name).toLowerCase();
  if (clean.includes(" - ")) {
    clean = clean.split(" - ")[0].trim();
  }
  const finalKey = clean.replace(/[^a-z0-9]/g, "");
  if (!finalKey) return "originalaudio";
  return finalKey;
}
function hasSongWholeWord(text, songTitle) {
  const textLower = text.toLowerCase();
  const songLower = songTitle.toLowerCase();
  if (songLower === "chor") {
    const cleanText2 = textLower.replace(/[^a-z0-9\s]/g, " ");
    const words = cleanText2.split(/\s+/).filter(Boolean);
    const hasStandaloneChor = words.includes("chor");
    if (!hasStandaloneChor) return false;
    if (textLower.includes("choreo") || textLower.includes("choreography") || textLower.includes("choreographer")) {
      const hasOnlyChoreo = words.every((w) => w.startsWith("choreo") || w.includes("choreography") || w === "chori" || w === "chorus");
      if (hasOnlyChoreo) return false;
    }
    return true;
  }
  const cleanText = textLower.replace(/[^a-z0-9\s]/g, " ");
  const cleanSong = songLower.replace(/[^a-z0-9\s]/g, " ").trim();
  if (!cleanSong) return false;
  const textWords = cleanText.split(/\s+/).filter(Boolean);
  const songWords = cleanSong.split(/\s+/).filter(Boolean);
  if (songWords.length === 0) return false;
  for (let i = 0; i <= textWords.length - songWords.length; i++) {
    let match = true;
    for (let j = 0; j < songWords.length; j++) {
      const textW = textWords[i + j];
      const songW = songWords[j];
      if (songW === "chor") {
        if (textW.startsWith("choreo") || textW.includes("choreography") || textW.startsWith("chori") || textW === "chorus" || textW === "choreographers") {
          match = false;
          break;
        }
      }
      if (textW !== songW) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}
function isConversationalTitle(title) {
  const lowercase = title.toLowerCase();
  const conversationalKeywords = [
    "challenge",
    "pov",
    "how to",
    "diy",
    "tutorial",
    "what i eat",
    "day in my life",
    "funny",
    "fails",
    "vlog",
    "life hack",
    "testing",
    "trying",
    "unboxing",
    "reaction",
    "dance",
    "performance",
    "routine",
    "choreo",
    "choreography",
    "practice",
    "rehearsal",
    "video",
    "short",
    "cover",
    "tutorial",
    "session",
    "vlogging",
    "behind the scenes",
    "bts",
    "blooper",
    "bloopers",
    "funny moments",
    "compilation",
    "review",
    "haul",
    "grwm",
    "get ready with me",
    "storytime",
    "prank",
    "unboxing",
    "vlog",
    "day in life",
    "with me",
    "my friend",
    "collaboration",
    "collab",
    "workout",
    "fitness",
    "routine"
  ];
  return conversationalKeywords.some((kw) => lowercase.includes(kw)) || lowercase.split(" ").length > 5;
}
function parseAudioOffline(title, description = "", tags = []) {
  const textTitle = title || "";
  const textDesc = description || "";
  const allTags = [...tags, ...textTitle.match(/#\w+/g) || [], ...textDesc.match(/#\w+/g) || []];
  const songRegexes = [
    /\b(?:song|music|track)\s*:\s*([^-\n]+)(?:-\s*([^-\n]+))?/i,
    /music\s*in\s*this\s*video\s*[\s\S]*?song\s*:\s*([^\n]+)/i,
    /\bsinger\s*:\s*([^\n]+)/i
  ];
  for (const regex of songRegexes) {
    const match = textDesc.match(regex);
    if (match && match[1]) {
      let songPart = match[1].trim();
      let artistPart = match[2] ? match[2].trim() : "Unknown Artist";
      if (regex.source.includes("music\\s*in")) {
        const artistMatch = textDesc.match(/artist\s*:\s*([^\n]+)/i);
        if (artistMatch) artistPart = artistMatch[1].trim();
      }
      songPart = normalizeAudioName(songPart);
      artistPart = normalizeAudioName(artistPart);
      if (songPart && songPart.toLowerCase() !== "original sound") {
        return { audioName: songPart, artist: artistPart };
      }
    }
  }
  for (const song of STANDARD_SONGS) {
    const songTitleLower = song.title.toLowerCase();
    const hasSongInTags = allTags.some((tag) => {
      const cleanTag = tag.replace("#", "").toLowerCase();
      if (songTitleLower === "chor" && (cleanTag.includes("choreo") || cleanTag.includes("choreography"))) {
        return false;
      }
      return cleanTag === songTitleLower.replace(/\s+/g, "") || cleanTag.includes(songTitleLower.replace(/\s+/g, ""));
    });
    if (hasSongInTags) {
      return { audioName: song.title, artist: song.artist };
    }
    if (hasSongWholeWord(textDesc, song.title)) {
      return { audioName: song.title, artist: song.artist };
    }
    if (hasSongWholeWord(textTitle, song.title)) {
      return { audioName: song.title, artist: song.artist };
    }
  }
  if (textTitle.includes(" - ")) {
    const parts = textTitle.split(" - ");
    const cleanLeft = normalizeAudioName(parts[0]);
    const cleanRight = normalizeAudioName(parts[1]);
    if (cleanLeft && cleanRight && cleanLeft.length > 2 && cleanRight.length > 2 && !isConversationalTitle(cleanLeft) && !isConversationalTitle(cleanRight)) {
      return { audioName: cleanLeft, artist: cleanRight };
    }
  }
  const cleanTitle = normalizeAudioName(textTitle);
  if (cleanTitle && cleanTitle.length > 3 && !isConversationalTitle(cleanTitle)) {
    return { audioName: cleanTitle, artist: "Unknown Artist" };
  }
  return { audioName: "Original Audio", artist: "Various Creators" };
}
function validateAndCleanResults(shorts, audios) {
  const uniqueShortsMap = /* @__PURE__ */ new Map();
  shorts.forEach((s) => {
    if (s.videoId) {
      if (!uniqueShortsMap.has(s.videoId) || s.views > uniqueShortsMap.get(s.videoId).views) {
        uniqueShortsMap.set(s.videoId, s);
      }
    }
  });
  let cleanShorts = Array.from(uniqueShortsMap.values());
  let cleanAudios = audios.filter((a) => {
    if (!a.id || !a.name) return false;
    const cleanName = a.name.trim();
    if (!cleanName || cleanName.toLowerCase() === "unknown" || cleanName === "") return false;
    return true;
  });
  const mergedAudiosMap = /* @__PURE__ */ new Map();
  cleanAudios.forEach((a) => {
    const key = getAudioGroupingKey(a.name);
    if (!key) return;
    if (mergedAudiosMap.has(key)) {
      const existing = mergedAudiosMap.get(key);
      existing.shortsCount += a.shortsCount;
      existing.totalViews += a.totalViews;
      if (a.trendScore > existing.trendScore) {
        existing.trendScore = a.trendScore;
      }
      if (new Date(a.latestUploadDate) > new Date(existing.latestUploadDate)) {
        existing.latestUploadDate = a.latestUploadDate;
      }
      existing.creators = Array.from(/* @__PURE__ */ new Set([...existing.creators, ...a.creators]));
    } else {
      mergedAudiosMap.set(key, { ...a });
    }
  });
  const finalAudios = Array.from(mergedAudiosMap.values());
  let originalAudioGroup = finalAudios.find((a) => a.id === "audio_originalaudio" || a.name === "Original Audio");
  if (!originalAudioGroup) {
    originalAudioGroup = {
      id: "audio_originalaudio",
      name: "Original Audio",
      artist: "Various Creators",
      uniqueCreatorsCount: 0,
      shortsCount: 0,
      totalViews: 0,
      latestUploadDate: (/* @__PURE__ */ new Date()).toISOString(),
      trendScore: 500,
      // Modest default trend score so it ranks properly without overriding top viral songs
      highestViewedShortId: "",
      creators: [],
      thumbnailUrl: ""
    };
    finalAudios.push(originalAudioGroup);
  } else {
    originalAudioGroup.id = "audio_originalaudio";
    originalAudioGroup.name = "Original Audio";
    originalAudioGroup.artist = "Various Creators";
  }
  const audioIdsSet = new Set(finalAudios.map((a) => a.id));
  cleanShorts.forEach((s) => {
    const isOriginal = !s.audioName || s.audioName.toLowerCase() === "original sound" || s.audioName.toLowerCase() === "original audio" || s.audioName === "";
    if (isOriginal) {
      s.audioId = "audio_originalaudio";
      s.audioName = "Original Audio";
    } else if (!s.audioId || !audioIdsSet.has(s.audioId)) {
      const audioKey = getAudioGroupingKey(s.audioName);
      const matchedAudio = finalAudios.find((a) => getAudioGroupingKey(a.name) === audioKey);
      if (matchedAudio) {
        s.audioId = matchedAudio.id;
      } else {
        s.audioId = "audio_originalaudio";
        s.audioName = "Original Audio";
      }
    }
  });
  finalAudios.forEach((a) => {
    const audioShorts = cleanShorts.filter((s) => s.audioId === a.id);
    audioShorts.sort((x, y) => y.views - x.views);
    a.shortsCount = audioShorts.length;
    a.totalViews = audioShorts.reduce((sum, s) => sum + s.views, 0);
    const uniqueCreators = Array.from(new Set(audioShorts.map((s) => s.creatorId)));
    a.uniqueCreatorsCount = uniqueCreators.length;
    if (audioShorts.length > 0) {
      a.highestViewedShortId = audioShorts[0].videoId;
      a.thumbnailUrl = audioShorts[0].thumbnailUrl || "";
      let latest = audioShorts[0].publishedDate;
      audioShorts.forEach((s) => {
        if (new Date(s.publishedDate) > new Date(latest)) {
          latest = s.publishedDate;
        }
      });
      a.latestUploadDate = latest;
    }
  });
  const nonEmptyAudios = finalAudios.filter((a) => a.shortsCount > 0);
  nonEmptyAudios.sort((a, b) => b.trendScore - a.trendScore);
  return {
    shorts: cleanShorts,
    audios: nonEmptyAudios
  };
}
async function analyzeShortsAudioWithGemini(shorts) {
  if (!ai) {
    console.log("Gemini API key not configured or placeholder. Falling back to local offline priority parser.");
    return shorts.map((s) => {
      if (!s.audioName || s.audioName === "Original Sound" || s.audioName === "Original Audio") {
        const parsed = parseAudioOffline(s.title, s.description || "", s.tags || []);
        if (parsed.audioName && parsed.audioName !== "Original Sound" && parsed.audioName !== "Original Audio") {
          s.audioName = `${parsed.audioName}${parsed.artist && parsed.artist !== "Unknown Artist" ? " - " + parsed.artist : ""}`;
        } else {
          s.audioName = "Original Audio";
        }
      }
      return s;
    });
  }
  const pendingShorts = shorts.filter(
    (s) => (!s.audioName || s.audioName.toLowerCase() === "original sound" || s.audioName.toLowerCase() === "original audio" || s.audioName === "") && (!s.audioId || !s.audioId.startsWith("audio_"))
  );
  if (pendingShorts.length === 0) {
    return shorts;
  }
  console.log(`Analyzing ${pendingShorts.length} shorts for audio track names using Gemini...`);
  const chunkSize = 20;
  for (let i = 0; i < pendingShorts.length; i += chunkSize) {
    const chunk = pendingShorts.slice(i, i + chunkSize);
    const videosToAnalyze = chunk.map((s) => ({
      videoId: s.videoId,
      title: s.title,
      description: s.description || "",
      tags: s.tags || []
    }));
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `You are a professional YouTube Shorts audio/music analyzer designed to identify the exact music/song used in each Short with maximum accuracy.

Input list of videos:
${JSON.stringify(videosToAnalyze, null, 2)}

DIRECTIONS & PRIORITY RULES FOR EACH VIDEO:
1. Try to identify the actual music track or song name and artist first. Do NOT prioritize the video's conversational title (e.g. "Do not do this", "My daily routine", "Amazing performance") over actual music metadata.
2. Follow these priority fields to determine the audio/song name:
   - Check if the description contains official music attribution, song details, or lyrics (e.g. "Music in this video", "Song: ...", "Artist: ...").
   - Check the tags or hashtags for song titles/artists.
   - Check the title for song mentions.
3. Ignore generic dance or choreography keywords. Suffixes/words like "choreo", "choreography", "dance", "dance cover", "dance video", "performance", "routine", "freestyle", "rehearsal", or "practice" are NOT part of the song name. For example:
   - "Tauba Tauba Choreography" -> Audio: "Tauba Tauba", Artist: "Karan Aujla"
   - "APT Dance Cover" -> Audio: "APT", Artist: "ROS\xC9 & Bruno Mars"
4. BE EXTREMELY CAREFUL with the song "Chor" by the artist "Justh". Only return "Chor" as the song name if the actual song is identified. DO NOT match "Chor" simply because the video has the words "choreo", "choreography", "dance", or "choreo" in the title, description, or tags. "Choreo" is short for choreography, NOT the song "Chor".
5. If there is absolutely no background song or music track used, or it is just a spoken voiceover/vlog/dance with no named song, return "Original Audio" for audioName and "Various Creators" for artist. Do NOT invent a song name or reuse the conversational video title if it is not an actual music track.
6. Provide the output in the requested JSON structure. Keep song names normalized and consistent.`,
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
      });
      const text = response.text;
      if (text) {
        const results = JSON.parse(text);
        if (Array.isArray(results)) {
          results.forEach((res) => {
            const short = chunk.find((s) => s.videoId === res.videoId);
            if (short) {
              if (res.audioName && res.audioName !== "Original Sound" && res.audioName !== "Original Audio") {
                short.audioName = `${res.audioName}${res.artist && res.artist !== "Unknown Artist" && res.artist !== "Various Creators" ? " - " + res.artist : ""}`;
              } else {
                short.audioName = "Original Audio";
              }
            }
          });
        }
      }
    } catch (err) {
      const errMsg = err?.message || String(err);
      const isQuotaExceeded = err?.status === 429 || errMsg.includes("429") || errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("resource_exhausted");
      if (isQuotaExceeded) {
        console.warn("[Gemini API] Quota/rate limit reached. Seamlessly activating high-fidelity offline audio parser for remaining videos.");
      } else {
        console.error("Error analyzing audio names with Gemini:", err);
      }
      const remainingShortsToParse = pendingShorts.slice(i);
      remainingShortsToParse.forEach((s) => {
        const parsed = parseAudioOffline(s.title, s.description || "", s.tags || []);
        if (parsed.audioName && parsed.audioName !== "Original Sound" && parsed.audioName !== "Original Audio") {
          s.audioName = `${parsed.audioName}${parsed.artist && parsed.artist !== "Unknown Artist" && parsed.artist !== "Various Creators" ? " - " + parsed.artist : ""}`;
        } else {
          s.audioName = "Original Audio";
        }
      });
      break;
    }
  }
  return shorts;
}
function runTrendAnalysis(shorts, creators) {
  const updatedShorts = shorts.map((s) => ({ ...s }));
  let totalVideosAnalyzed = 0;
  let totalAudiosDetected = 0;
  let duplicateAudiosMerged = 0;
  let videosSkipped = 0;
  let videosWithUnknownAudio = 0;
  updatedShorts.forEach((short) => {
    totalVideosAnalyzed++;
    let audioName = short.audioName ? short.audioName.trim() : "";
    let artist = "Unknown Artist";
    if (audioName && audioName.includes(" - ")) {
      const parts = audioName.split(" - ");
      audioName = parts[0].trim();
      artist = parts[1].trim();
    }
    if (!audioName || audioName.toLowerCase() === "original sound") {
      const parsed = parseAudioOffline(short.title, short.description || "", short.tags || []);
      audioName = parsed.audioName;
      artist = parsed.artist;
    }
    const normalizedName = normalizeAudioName(audioName);
    const normalizedArtist = normalizeAudioName(artist);
    if (!normalizedName || normalizedName.toLowerCase() === "original sound") {
      short.audioName = "Original Sound";
      videosWithUnknownAudio++;
    } else {
      short.audioName = `${normalizedName}${normalizedArtist && normalizedArtist !== "Unknown Artist" ? " - " + normalizedArtist : ""}`;
    }
  });
  const audioGroups = {};
  updatedShorts.forEach((short) => {
    let key = getAudioGroupingKey(short.audioName);
    if (!key) key = "originalaudio";
    if (key === "originalaudio") {
      short.audioName = "Original Audio";
    }
    if (!audioGroups[key]) {
      let repName = short.audioName;
      let repArtist = "Unknown Artist";
      if (short.audioName.includes(" - ")) {
        const parts = short.audioName.split(" - ");
        repName = parts[0].trim();
        repArtist = parts[1].trim();
      }
      if (key === "originalaudio") {
        repName = "Original Audio";
        repArtist = "Various Creators";
      }
      audioGroups[key] = {
        shorts: [],
        representativeName: repName,
        artist: repArtist
      };
    } else {
      duplicateAudiosMerged++;
    }
    const currentRep = audioGroups[key];
    if (key !== "originalaudio" && short.audioName.includes(" - ") && !currentRep.representativeName.includes(" - ")) {
      const parts = short.audioName.split(" - ");
      currentRep.representativeName = parts[0].trim();
      currentRep.artist = parts[1].trim();
    }
    audioGroups[key].shorts.push(short);
  });
  Object.keys(audioGroups).forEach((key) => {
    audioGroups[key].shorts.sort((a, b) => b.views - a.views);
  });
  totalAudiosDetected = Object.keys(audioGroups).length;
  const nowTime = Date.now();
  const audios = Object.keys(audioGroups).map((key) => {
    const group = audioGroups[key];
    const groupShorts = group.shorts;
    const uniqueCreators = Array.from(new Set(groupShorts.map((s) => s.creatorId)));
    const totalViews = groupShorts.reduce((sum, s) => sum + s.views, 0);
    const highestViewedShort = groupShorts[0];
    let latestUploadDate = groupShorts[0].publishedDate;
    groupShorts.forEach((s) => {
      if (new Date(s.publishedDate) > new Date(latestUploadDate)) {
        latestUploadDate = s.publishedDate;
      }
    });
    const audioId = `audio_${crypto.createHash("md5").update(group.representativeName).digest("hex").substring(0, 16)}`;
    groupShorts.forEach((s) => {
      s.audioId = audioId;
      s.audioName = `${group.representativeName}${group.artist !== "Various Creators" && group.artist !== "Unknown Artist" ? " - " + group.artist : ""}`;
    });
    let recencyBonus = 0;
    groupShorts.forEach((s) => {
      const ageInMs = nowTime - new Date(s.publishedDate).getTime();
      const ageInDays = ageInMs / (1e3 * 60 * 60 * 24);
      if (ageInDays <= 3) {
        recencyBonus += 3e3;
      } else if (ageInDays <= 7) {
        recencyBonus += 1500;
      } else if (ageInDays <= 14) {
        recencyBonus += 500;
      }
    });
    const creatorRatio = uniqueCreators.length / groupShorts.length;
    const diversityBonus = Math.round(creatorRatio * 2e3);
    const trendScore = Math.round(
      uniqueCreators.length * 6e3 + groupShorts.length * 1500 + totalViews / 4e4 + recencyBonus + diversityBonus
    );
    return {
      id: audioId,
      name: group.representativeName,
      artist: group.artist,
      uniqueCreatorsCount: uniqueCreators.length,
      shortsCount: groupShorts.length,
      totalViews,
      latestUploadDate,
      trendScore,
      highestViewedShortId: highestViewedShort.videoId,
      creators: uniqueCreators.map((id) => creators.find((c) => c.id === id)?.name || "Creator"),
      thumbnailUrl: highestViewedShort?.thumbnailUrl || ""
    };
  });
  const validated = validateAndCleanResults(updatedShorts, audios);
  global.lastCrawlStats = {
    totalVideosAnalyzed,
    totalAudiosDetected,
    duplicateAudiosMerged,
    videosSkipped,
    videosWithUnknownAudio
  };
  return validated;
}
function getPreloadedShortsForCreators(creatorsToFetch, periodDays) {
  let preloadedShorts = [];
  try {
    if (fs2.existsSync(DB_PATH)) {
      const defaultData = fs2.readFileSync(DB_PATH, "utf-8");
      const parsed = JSON.parse(defaultData);
      if (parsed && Array.isArray(parsed.shorts)) {
        preloadedShorts = parsed.shorts;
      }
    }
  } catch (e) {
    console.error("Error reading default database template:", e);
  }
  const now = /* @__PURE__ */ new Date();
  let shiftedShorts = [];
  if (preloadedShorts.length > 0) {
    let latestTemplateTime = 0;
    for (const s of preloadedShorts) {
      if (s.publishedDate) {
        const t = new Date(s.publishedDate).getTime();
        if (!isNaN(t) && t > latestTemplateTime) {
          latestTemplateTime = t;
        }
      }
    }
    const offsetMs = latestTemplateTime > 0 ? now.getTime() - latestTemplateTime : 0;
    shiftedShorts = preloadedShorts.map((s) => {
      if (!s.publishedDate) {
        return { ...s, publishedDate: now.toISOString() };
      }
      const originalTime = new Date(s.publishedDate).getTime();
      if (isNaN(originalTime)) {
        return { ...s, publishedDate: now.toISOString() };
      }
      return {
        ...s,
        publishedDate: new Date(originalTime + offsetMs).toISOString()
      };
    });
  }
  const targetCreatorIds = new Set(creatorsToFetch.map((c) => c.id));
  let filtered = shiftedShorts.filter((s) => targetCreatorIds.has(s.creatorId));
  const creatorsWithNoPreloaded = creatorsToFetch.filter((c) => !filtered.some((s) => s.creatorId === c.id));
  if (creatorsWithNoPreloaded.length > 0) {
    const simulated = generateMockShorts(creatorsWithNoPreloaded, periodDays);
    filtered.push(...simulated);
  }
  const cutoffTime = now.getTime() - periodDays * 24 * 60 * 60 * 1e3;
  return filtered.filter((s) => new Date(s.publishedDate).getTime() >= cutoffTime);
}
function getDbPath(deviceIdInput) {
  return DB_PATH;
}
var memoryDb = null;
function loadDb(deviceIdInput) {
  if (memoryDb) {
    return memoryDb;
  }
  try {
    if (fs2.existsSync(DB_PATH)) {
      const data = fs2.readFileSync(DB_PATH, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed) {
        if (!parsed.creators) {
          parsed.creators = [];
        }
        if (!parsed.settings) {
          parsed.settings = { ...defaultSettings };
        }
        if (parsed.settings.creatorLimit === void 0) {
          parsed.settings.creatorLimit = 9999;
        }
        if (parsed.settings.periodDays === void 0) {
          parsed.settings.periodDays = 7;
        }
        if (!parsed.rawShorts) {
          parsed.rawShorts = parsed.shorts || [];
        }
        const periodDays = parsed.settings.periodDays || 7;
        const periods2 = [7, 14, 21, 30];
        const trendsCache = {};
        const nowTime = Date.now();
        periods2.forEach((pDays) => {
          const cutoffTime = nowTime - pDays * 24 * 60 * 60 * 1e3;
          const filteredRawShorts = (parsed.rawShorts || []).filter((s) => {
            if (!s.publishedDate) return false;
            return new Date(s.publishedDate).getTime() >= cutoffTime;
          });
          const analysisResult = runTrendAnalysis(filteredRawShorts, parsed.creators);
          trendsCache[pDays] = {
            shorts: analysisResult.shorts,
            audios: analysisResult.audios
          };
        });
        parsed.trendsCache = trendsCache;
        const activeTrend2 = trendsCache[periodDays] || trendsCache[7];
        if (activeTrend2) {
          parsed.shorts = activeTrend2.shorts;
          parsed.audios = activeTrend2.audios;
        }
        memoryDb = parsed;
        return parsed;
      }
    }
  } catch (error) {
    console.error(`Database read error for global path ${DB_PATH}:`, error);
  }
  console.log("Bootstrapping database with multi-timeframe cached data...");
  const mockShorts = generateMockShorts(defaultCreators, 30);
  const initialTrendsCache = {};
  const periods = [7, 14, 21, 30];
  const bootNow = /* @__PURE__ */ new Date();
  periods.forEach((pDays) => {
    const cutoffTime = bootNow.getTime() - pDays * 24 * 60 * 60 * 1e3;
    const filteredShorts = mockShorts.filter((s) => new Date(s.publishedDate).getTime() >= cutoffTime);
    const analysisResult = runTrendAnalysis(filteredShorts, defaultCreators);
    initialTrendsCache[pDays] = {
      shorts: analysisResult.shorts,
      audios: analysisResult.audios
    };
  });
  const activeDays = defaultSettings.periodDays;
  const activeTrend = initialTrendsCache[activeDays] || initialTrendsCache[7];
  const initialDb = {
    creators: defaultCreators.map((c) => ({
      ...c,
      addedDate: (/* @__PURE__ */ new Date()).toISOString(),
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    })),
    rawShorts: mockShorts,
    shorts: activeTrend.shorts,
    audios: activeTrend.audios,
    settings: defaultSettings,
    refreshStatus: {
      status: "idle",
      lastRun: (/* @__PURE__ */ new Date()).toISOString(),
      logs: ["Database bootstrapped with high-fidelity multi-timeframe mock data."],
      progress: 100
    },
    apiLogs: [
      { timestamp: (/* @__PURE__ */ new Date()).toISOString(), method: "SYSTEM", url: "BOOTSTRAP", status: 200, durationMs: 150 }
    ],
    fetchHistory: [
      {
        id: crypto.randomUUID(),
        startTime: (/* @__PURE__ */ new Date()).toISOString(),
        endTime: (/* @__PURE__ */ new Date()).toISOString(),
        status: "success",
        durationSec: 1,
        creatorsProcessed: defaultCreators.length,
        videosProcessed: mockShorts.length,
        trendingAudiosFound: activeTrend.audios.length,
        errors: [],
        failedCreators: []
      }
    ],
    trendsCache: initialTrendsCache
  };
  memoryDb = initialDb;
  if (!process.env.VERCEL) {
    try {
      fs2.writeFileSync(DB_PATH, JSON.stringify(initialDb, null, 2), "utf-8");
    } catch (error) {
      console.error(`Error saving bootstrapped database file:`, error);
    }
  }
  return initialDb;
}
function saveDb(data, deviceIdInput) {
  memoryDb = data;
  if (process.env.VERCEL) return;
  try {
    fs2.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error(`Error saving database file to ${DB_PATH}:`, error);
  }
}
var hasHydratedFromFirestore = false;
var lastFirestoreSyncTimestamp = 0;
var FIRESTORE_SYNC_CACHE_MS = 2e4;
async function syncFromFirestore(force = false) {
  if (!isFirestoreAvailable()) return false;
  const now = Date.now();
  if (!force && hasHydratedFromFirestore && now - lastFirestoreSyncTimestamp < FIRESTORE_SYNC_CACHE_MS) {
    return true;
  }
  try {
    const [remoteCreators, remoteShorts, remoteAudios, remoteSettings, remoteLogs, remoteRefresh, remoteTrendsCache] = await Promise.all([
      fetchCreatorsFromFirestore(),
      fetchRawShortsFromFirestore(),
      fetchAudiosFromFirestore(),
      fetchSettingsFromFirestore(),
      fetchSyncLogsFromFirestore(),
      fetchRefreshStatusFromFirestore(),
      fetchTrendsCacheFromFirestore()
    ]);
    const currentDb = loadDb();
    let hasChanges = false;
    if (remoteCreators && remoteCreators.length > 0) {
      currentDb.creators = remoteCreators;
      hasChanges = true;
    }
    if (remoteShorts && remoteShorts.length > 0) {
      currentDb.rawShorts = remoteShorts;
      hasChanges = true;
    }
    if (remoteAudios && remoteAudios.length > 0) {
      currentDb.audios = remoteAudios;
      hasChanges = true;
    }
    if (remoteSettings) {
      currentDb.settings = { ...currentDb.settings, ...remoteSettings };
      hasChanges = true;
    }
    if (remoteLogs && remoteLogs.length > 0) {
      currentDb.fetchHistory = remoteLogs;
      hasChanges = true;
    }
    if (remoteRefresh) {
      currentDb.refreshStatus = remoteRefresh;
      hasChanges = true;
    }
    if (remoteTrendsCache && Object.keys(remoteTrendsCache).length > 0) {
      currentDb.trendsCache = remoteTrendsCache;
      const activeDays = currentDb.settings?.periodDays || 7;
      const activeTrend = remoteTrendsCache[activeDays] || remoteTrendsCache[7];
      if (activeTrend) {
        currentDb.shorts = activeTrend.shorts;
        currentDb.audios = activeTrend.audios;
      }
      hasChanges = true;
    }
    if (hasChanges || !currentDb.trendsCache || Object.keys(currentDb.trendsCache).length === 0) {
      const periods = [7, 14, 21, 30];
      const trendsCache = {};
      const bootNow = /* @__PURE__ */ new Date();
      periods.forEach((pDays) => {
        const cutoffTime = bootNow.getTime() - pDays * 24 * 60 * 60 * 1e3;
        const filteredRawShorts = (currentDb.rawShorts || []).filter((s) => {
          if (!s.publishedDate) return false;
          return new Date(s.publishedDate).getTime() >= cutoffTime;
        });
        const analysisResult = runTrendAnalysis(filteredRawShorts, currentDb.creators);
        trendsCache[pDays] = {
          shorts: analysisResult.shorts,
          audios: analysisResult.audios
        };
      });
      currentDb.trendsCache = trendsCache;
      const activeDays = currentDb.settings?.periodDays || 7;
      const activeTrend = trendsCache[activeDays] || trendsCache[7];
      if (activeTrend) {
        currentDb.shorts = activeTrend.shorts;
        currentDb.audios = activeTrend.audios;
      }
      memoryDb = currentDb;
      saveTrendsCacheToFirestore(trendsCache).catch((err) => console.warn("[Firestore] Failed to persist trends cache:", err));
      if (!process.env.VERCEL) {
        try {
          fs2.writeFileSync(DB_PATH, JSON.stringify(currentDb, null, 2), "utf-8");
        } catch (e) {
          console.error("[Firestore Sync] Error saving synchronized database:", e);
        }
      }
      console.log(`[Firestore Sync] Database synchronized from Firestore (${currentDb.creators.length} creators, ${currentDb.rawShorts?.length || 0} shorts, ${currentDb.audios?.length || 0} audios).`);
    }
    hasHydratedFromFirestore = true;
    lastFirestoreSyncTimestamp = Date.now();
    return true;
  } catch (err) {
    console.warn("[Firestore Sync] Error during background synchronization with Firestore:", err);
    return false;
  }
}
app.use(async (req, res, next) => {
  if (req.url.startsWith("/api/")) {
    if (isFirestoreAvailable()) {
      if (!hasHydratedFromFirestore || !memoryDb) {
        await syncFromFirestore(true);
      } else if (Date.now() - lastFirestoreSyncTimestamp > FIRESTORE_SYNC_CACHE_MS) {
        syncFromFirestore(false).catch((err) => console.warn("[Firestore Sync] Background refresh error:", err));
      }
    }
  }
  next();
});
app.use((req, res, next) => {
  if (!req.url.startsWith("/api/")) {
    return next();
  }
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    try {
      const db = loadDb(req);
      const logEntry = {
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        method: req.method,
        url: req.originalUrl || req.url,
        status: res.statusCode,
        durationMs: duration
      };
      db.apiLogs = [logEntry, ...db.apiLogs].slice(0, 100);
      saveDb(db, req);
    } catch (e) {
      console.error("Failed to write API Log:", e);
    }
  });
  next();
});
app.use(express.json());
function getTimeframeData(db, requestedPeriodDays) {
  const periodDays = requestedPeriodDays && !isNaN(requestedPeriodDays) && requestedPeriodDays > 0 ? Number(requestedPeriodDays) : db.settings.periodDays || 7;
  if (db.trendsCache && db.trendsCache[periodDays] && Array.isArray(db.trendsCache[periodDays].shorts)) {
    return {
      shorts: db.trendsCache[periodDays].shorts,
      audios: db.trendsCache[periodDays].audios,
      periodDays
    };
  }
  const cutoffTime = Date.now() - periodDays * 24 * 60 * 60 * 1e3;
  const rawList = db.rawShorts || db.shorts || [];
  const filtered = rawList.filter((s) => s.publishedDate && new Date(s.publishedDate).getTime() >= cutoffTime);
  const analysis = runTrendAnalysis(filtered, db.creators);
  if (!db.trendsCache) db.trendsCache = {};
  db.trendsCache[periodDays] = {
    shorts: analysis.shorts,
    audios: analysis.audios
  };
  return {
    shorts: analysis.shorts,
    audios: analysis.audios,
    periodDays
  };
}
app.get("/api/dashboard", (req, res) => {
  const db = loadDb(req);
  const enabledCreators = db.creators.filter((c) => c.enabled);
  const { shorts, audios, periodDays } = getTimeframeData(db, req.query.periodDays ? Number(req.query.periodDays) : void 0);
  res.json({
    totalCreators: db.creators.length,
    enabledCreatorsCount: enabledCreators.length,
    totalShortsAnalyzed: shorts.length,
    totalTrendingAudio: audios.length,
    lastUpdated: db.refreshStatus.lastRun || (/* @__PURE__ */ new Date()).toISOString(),
    analysisPeriod: periodDays,
    refreshStatus: db.refreshStatus,
    stats: {
      totalViews: shorts.reduce((sum, s) => sum + s.views, 0),
      totalLikes: shorts.reduce((sum, s) => sum + s.likes, 0)
    }
  });
});
app.get("/api/creators", (req, res) => {
  const db = loadDb(req);
  const { q, enabled } = req.query;
  let result = [...db.creators];
  if (q) {
    const query2 = String(q).toLowerCase();
    result = result.filter(
      (c) => c.name.toLowerCase().includes(query2) || c.id.toLowerCase().includes(query2) || c.handle.toLowerCase().includes(query2)
    );
  }
  if (enabled !== void 0) {
    const isEnabled = enabled === "true";
    result = result.filter((c) => c.enabled === isEnabled);
  }
  res.json(result);
});
function verifyAdmin(req, res) {
  const token = req.headers["x-admin-token"] || req.headers["authorization"];
  let cleanToken = String(token || "").trim().toLowerCase();
  if (cleanToken.startsWith("bearer ")) {
    cleanToken = cleanToken.substring(7).trim();
  }
  const allowed = [
    "gmailgmail",
    "nikhil_dubey_iiitian",
    "iiit_gwalior",
    "nikhil"
  ];
  if (process.env.ADMIN_TOKEN) {
    allowed.push(process.env.ADMIN_TOKEN.trim().toLowerCase());
  }
  if (allowed.includes(cleanToken)) {
    return true;
  }
  res.status(401).json({ error: "Unauthorized access: This action requires founder authentication." });
  return false;
}
function getYoutubeKeys(db) {
  const primary = db.settings?.youtubeApiKeyPrimary && db.settings.youtubeApiKeyPrimary.startsWith("AIzaSy") ? db.settings.youtubeApiKeyPrimary : process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_API_KEY !== "MY_YOUTUBE_API_KEY" && process.env.YOUTUBE_API_KEY.startsWith("AIzaSy") ? process.env.YOUTUBE_API_KEY : "";
  const backup = db.settings?.youtubeApiKeyBackup && db.settings.youtubeApiKeyBackup.startsWith("AIzaSy") ? db.settings.youtubeApiKeyBackup : process.env.YOUTUBE_API_KEY_BACKUP && process.env.YOUTUBE_API_KEY_BACKUP !== "AIzaSyBackupKey_If_Quota_Exhausted" && process.env.YOUTUBE_API_KEY_BACKUP.startsWith("AIzaSy") ? process.env.YOUTUBE_API_KEY_BACKUP : "";
  return { primary, backup };
}
async function executeYoutubeRequest(db, requestFn) {
  const { primary: primaryKey, backup: backupKey } = getYoutubeKeys(db);
  try {
    return await requestFn(primaryKey);
  } catch (err) {
    const errorMsg = err.response?.data?.error?.message || err.message || "";
    const status = err.response?.status;
    const reason = err.response?.data?.error?.errors?.[0]?.reason || "";
    const isQuotaExhausted = status === 429 || status === 403 || reason === "quotaExceeded" || reason === "dailyLimitExceeded" || errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("limit") || errorMsg.toLowerCase().includes("exceeded") || errorMsg.toLowerCase().includes("exhausted");
    if (isQuotaExhausted && backupKey && backupKey !== primaryKey) {
      console.warn(`[FAILOVER] Quota exhausted on primary key during creator lookup. Retrying with backup key...`);
      return await requestFn(backupKey);
    }
    throw err;
  }
}
app.post("/api/creators", async (req, res) => {
  if (!verifyAdmin(req, res)) return;
  const db = loadDb(req);
  const { id: inputId, name, handle, avatarUrl, enabled } = req.body;
  if (!inputId) {
    return res.status(400).json({ error: "YouTube Channel ID, Handle, or URL is required." });
  }
  const rawInput = String(inputId).trim();
  const formatCheck = validateCreatorInputFormat(rawInput);
  if (!formatCheck.valid) {
    return res.status(400).json({ error: formatCheck.error });
  }
  let resolvedId = "";
  let finalName = name || "";
  let finalHandle = handle || "";
  let finalAvatar = avatarUrl || "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=60";
  let inputType = "id";
  let parsedValue = rawInput;
  const channelIdMatch = rawInput.match(/channel\/(UC[a-zA-Z0-9_-]{22})/i);
  const handleUrlMatch = rawInput.match(/(?:youtube\.com\/)?@([a-zA-Z0-9._-]+)/i);
  const legacyMatch = rawInput.match(/\/(?:c|user)\/([a-zA-Z0-9._-]+)/i);
  if (channelIdMatch) {
    inputType = "id";
    parsedValue = channelIdMatch[1];
  } else if (handleUrlMatch) {
    inputType = "handle";
    parsedValue = `@${handleUrlMatch[1]}`;
  } else if (legacyMatch) {
    inputType = "legacy";
    parsedValue = legacyMatch[1];
  } else if (rawInput.startsWith("@")) {
    inputType = "handle";
    parsedValue = rawInput;
  } else if (/^UC[a-zA-Z0-9_-]{22}$/.test(rawInput)) {
    inputType = "id";
    parsedValue = rawInput;
  } else if (!rawInput.includes(" ") && !rawInput.includes("/") && rawInput.length > 0) {
    inputType = "handle";
    parsedValue = rawInput.startsWith("@") ? rawInput : `@${rawInput}`;
  } else {
    inputType = "legacy";
    parsedValue = rawInput;
  }
  const { primary: primaryKey, backup: backupKey } = getYoutubeKeys(db);
  const hasRealKey = !!primaryKey;
  if (hasRealKey) {
    try {
      if (inputType === "id") {
        const ytRes = await executeYoutubeRequest(db, (key) => {
          const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${parsedValue}&key=${key}`;
          return axios.get(channelUrl);
        });
        const channelItem = ytRes.data.items?.[0];
        if (channelItem) {
          resolvedId = channelItem.id;
          finalName = finalName || channelItem.snippet.title;
          finalHandle = channelItem.snippet.customUrl || `@${finalName.replace(/\s+/g, "")}`;
          finalAvatar = channelItem.snippet.thumbnails?.medium?.url || channelItem.snippet.thumbnails?.default?.url || finalAvatar;
        } else {
          resolvedId = parsedValue;
        }
      } else if (inputType === "handle") {
        try {
          const ytRes = await executeYoutubeRequest(db, (key) => {
            const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(parsedValue)}&key=${key}`;
            return axios.get(channelUrl);
          });
          const channelItem = ytRes.data.items?.[0];
          if (channelItem) {
            resolvedId = channelItem.id;
            finalName = finalName || channelItem.snippet.title;
            finalHandle = channelItem.snippet.customUrl || parsedValue;
            finalAvatar = channelItem.snippet.thumbnails?.medium?.url || channelItem.snippet.thumbnails?.default?.url || finalAvatar;
          }
        } catch (err) {
          console.warn(`forHandle lookup failed: ${err.message}. Trying search fallback...`);
        }
        if (!resolvedId) {
          const searchRes = await executeYoutubeRequest(db, (key) => {
            const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(parsedValue)}&key=${key}&maxResults=1`;
            return axios.get(searchUrl);
          });
          const searchItem = searchRes.data.items?.[0];
          if (searchItem && searchItem.id?.channelId) {
            resolvedId = searchItem.id.channelId;
            finalName = finalName || searchItem.snippet.title;
            finalHandle = finalHandle || parsedValue;
            finalAvatar = searchItem.snippet.thumbnails?.medium?.url || searchItem.snippet.thumbnails?.default?.url || finalAvatar;
          }
        }
      } else {
        const searchRes = await executeYoutubeRequest(db, (key) => {
          const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(parsedValue)}&key=${key}&maxResults=1`;
          return axios.get(searchUrl);
        });
        const searchItem = searchRes.data.items?.[0];
        if (searchItem && searchItem.id?.channelId) {
          resolvedId = searchItem.id.channelId;
          finalName = finalName || searchItem.snippet.title;
          finalHandle = finalHandle || `@${finalName.replace(/\s+/g, "")}`;
          finalAvatar = searchItem.snippet.thumbnails?.medium?.url || searchItem.snippet.thumbnails?.default?.url || finalAvatar;
        }
      }
    } catch (e) {
      console.warn(`YouTube API query failed: ${e.message}`);
      if (inputType === "id") {
        resolvedId = parsedValue;
      }
    }
  } else {
    if (inputType === "id") {
      resolvedId = parsedValue;
    } else {
      resolvedId = `UC_mock_${parsedValue.replace(/[^a-zA-Z0-9]/g, "").substring(0, 18)}`;
      finalHandle = parsedValue;
    }
  }
  if (!resolvedId) {
    return res.status(400).json({
      error: `Could not resolve YouTube Channel ID from input "${rawInput}". Please verify the URL or handle.`
    });
  }
  const existingIndex = db.creators.findIndex((c) => c.id === resolvedId);
  if (existingIndex > -1) {
    return res.status(400).json({
      error: `Creator with ID ${resolvedId} (${db.creators[existingIndex].name}) already exists in the database.`
    });
  }
  finalName = finalName || `Channel_${resolvedId.substring(2, 8)}`;
  finalHandle = finalHandle || `@user_${resolvedId.substring(2, 8)}`;
  const newCreator = {
    id: resolvedId,
    name: finalName,
    handle: finalHandle,
    avatarUrl: finalAvatar,
    enabled: enabled !== void 0 ? enabled : true,
    addedDate: (/* @__PURE__ */ new Date()).toISOString(),
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.creators.push(newCreator);
  saveDb(db, req);
  upsertCreatorInFirestore(newCreator).catch((err) => console.error("[Firestore] Creator upsert error:", err));
  res.status(201).json(newCreator);
});
app.put("/api/creators/:id", (req, res) => {
  if (!verifyAdmin(req, res)) return;
  const db = loadDb(req);
  const { id } = req.params;
  const { newId, name, handle, avatarUrl, enabled } = req.body;
  const creatorIdx = db.creators.findIndex((c) => c.id === id);
  if (creatorIdx === -1) {
    return res.status(404).json({ error: "Creator not found" });
  }
  let finalId = id;
  if (newId !== void 0 && newId !== id) {
    const trimmedNewId = String(newId).trim();
    const formatCheck = validateCreatorInputFormat(trimmedNewId);
    if (!formatCheck.valid) {
      return res.status(400).json({ error: formatCheck.error });
    }
    const duplicate = db.creators.some((c) => c.id === trimmedNewId);
    if (duplicate) {
      return res.status(400).json({ error: `Creator with ID ${trimmedNewId} already exists.` });
    }
    finalId = trimmedNewId;
  }
  const updatedCreator = {
    ...db.creators[creatorIdx],
    id: finalId,
    ...name !== void 0 && { name },
    ...handle !== void 0 && { handle },
    ...avatarUrl !== void 0 && { avatarUrl },
    ...enabled !== void 0 && { enabled },
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.creators[creatorIdx] = updatedCreator;
  saveDb(db, req);
  upsertCreatorInFirestore(updatedCreator).catch((err) => console.error("[Firestore] Creator update error:", err));
  res.json(updatedCreator);
});
app.delete("/api/creators/:id", (req, res) => {
  if (!verifyAdmin(req, res)) return;
  const db = loadDb(req);
  const { id } = req.params;
  const creatorIdx = db.creators.findIndex((c) => c.id === id);
  if (creatorIdx === -1) {
    return res.status(404).json({ error: "Creator not found" });
  }
  db.creators.splice(creatorIdx, 1);
  if (db.rawShorts) {
    db.rawShorts = db.rawShorts.filter((s) => s.creatorId !== id);
  } else {
    db.rawShorts = [];
  }
  db.shorts = db.shorts.filter((s) => s.creatorId !== id);
  const analysisResult = runTrendAnalysis(db.shorts, db.creators);
  db.shorts = analysisResult.shorts;
  db.audios = analysisResult.audios;
  if (db.trendsCache) {
    Object.keys(db.trendsCache).forEach((pDaysKey) => {
      const cached = db.trendsCache[pDaysKey];
      if (cached && Array.isArray(cached.shorts)) {
        const remainingShorts = cached.shorts.filter((s) => s.creatorId !== id);
        const cachedAnalysis = runTrendAnalysis(remainingShorts, db.creators);
        db.trendsCache[pDaysKey] = {
          shorts: cachedAnalysis.shorts,
          audios: cachedAnalysis.audios
        };
      }
    });
  }
  saveDb(db, req);
  deleteCreatorFromFirestore(id).catch((err) => console.error("[Firestore] Creator delete error:", err));
  res.json({ success: true, message: `Creator ${id} successfully removed, and all associated shorts purged/re-analyzed.` });
});
app.get("/api/settings", (req, res) => {
  const db = loadDb(req);
  res.json(db.settings);
});
app.put("/api/settings", (req, res) => {
  const db = loadDb(req);
  const { creatorLimit, periodDays, youtubeApiKeyPrimary, youtubeApiKeyBackup } = req.body;
  db.settings = {
    creatorLimit: creatorLimit !== void 0 ? Number(creatorLimit) : db.settings.creatorLimit,
    periodDays: periodDays !== void 0 ? Number(periodDays) : db.settings.periodDays,
    youtubeApiKeyPrimary: youtubeApiKeyPrimary !== void 0 ? String(youtubeApiKeyPrimary).trim() : db.settings.youtubeApiKeyPrimary,
    youtubeApiKeyBackup: youtubeApiKeyBackup !== void 0 ? String(youtubeApiKeyBackup).trim() : db.settings.youtubeApiKeyBackup
  };
  const targetPeriodDays = db.settings.periodDays || 7;
  const nowTime = Date.now();
  const cutoffTime = nowTime - targetPeriodDays * 24 * 60 * 60 * 1e3;
  const rawShortsList = db.rawShorts || db.shorts || [];
  const filteredRawShorts = rawShortsList.filter((s) => {
    if (!s.publishedDate) return false;
    return new Date(s.publishedDate).getTime() >= cutoffTime;
  });
  const analysisResult = runTrendAnalysis(filteredRawShorts, db.creators);
  db.shorts = analysisResult.shorts;
  db.audios = analysisResult.audios;
  saveDb(db, req);
  upsertSettingsInFirestore(db.settings).catch((err) => console.error("[Firestore] Settings update error:", err));
  res.json(db.settings);
});
app.get("/api/trending/audio", (req, res) => {
  const db = loadDb(req);
  const { q, creatorId, periodDays, limit, page } = req.query;
  const { shorts: timeframeShorts, audios: timeframeAudios } = getTimeframeData(db, periodDays ? Number(periodDays) : void 0);
  let audios = [...timeframeAudios];
  if (q) {
    const query2 = String(q).toLowerCase();
    audios = audios.filter(
      (a) => a.name.toLowerCase().includes(query2) || a.artist.toLowerCase().includes(query2)
    );
  }
  if (creatorId) {
    const cId = String(creatorId);
    audios = audios.filter((a) => {
      const matchingShorts = timeframeShorts.filter((s) => s.audioId === a.id && s.creatorId === cId);
      return matchingShorts.length > 0;
    });
  }
  const pSize = limit ? Number(limit) : 20;
  const pNum = page ? Number(page) : 1;
  const startIndex = (pNum - 1) * pSize;
  const paginatedAudios = audios.slice(startIndex, startIndex + pSize);
  res.json({
    data: paginatedAudios,
    total: audios.length,
    page: pNum,
    pageSize: pSize
  });
});
app.get("/api/trending/videos", (req, res) => {
  const db = loadDb(req);
  const { q, creatorId, periodDays, limit, page } = req.query;
  const { shorts: timeframeShorts, audios: timeframeAudios } = getTimeframeData(db, periodDays ? Number(periodDays) : void 0);
  let repVideos = timeframeAudios.map((audio) => {
    const representativeShort = timeframeShorts.find((s) => s.videoId === audio.highestViewedShortId);
    if (!representativeShort) return null;
    return {
      ...representativeShort,
      trendScore: audio.trendScore
    };
  }).filter((s) => s !== null);
  if (q) {
    const query2 = String(q).toLowerCase();
    repVideos = repVideos.filter(
      (v) => v.title.toLowerCase().includes(query2) || v.creatorName.toLowerCase().includes(query2) || v.audioName.toLowerCase().includes(query2)
    );
  }
  if (creatorId) {
    const cId = String(creatorId);
    repVideos = repVideos.filter((v) => v.creatorId === cId);
  }
  repVideos.sort((a, b) => b.trendScore - a.trendScore);
  const pSize = limit ? Number(limit) : 24;
  const pNum = page ? Number(page) : 1;
  const startIndex = (pNum - 1) * pSize;
  const paginated = repVideos.slice(startIndex, startIndex + pSize);
  res.json({
    data: paginated,
    total: repVideos.length,
    page: pNum,
    pageSize: pSize
  });
});
app.get("/api/audio/:audioId", (req, res) => {
  const db = loadDb(req);
  const { audioId } = req.params;
  const audio = db.audios.find((a) => a.id === audioId);
  if (!audio) {
    return res.status(404).json({ error: "Trending audio not found" });
  }
  const matchingShorts = db.shorts.filter((s) => s.audioId === audioId);
  matchingShorts.sort((a, b) => b.views - a.views);
  res.json({
    audio,
    shorts: matchingShorts
  });
});
function getNextScheduledFetchTime() {
  const now = /* @__PURE__ */ new Date();
  const next = /* @__PURE__ */ new Date();
  next.setHours(3, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.toISOString();
}
function validateRefreshResults(shorts, audios) {
  if (!Array.isArray(shorts) || shorts.length === 0) {
    return { valid: false, error: "Validation failed: No videos retrieved." };
  }
  if (!Array.isArray(audios) || audios.length === 0) {
    return { valid: false, error: "Validation failed: No trending audios detected." };
  }
  for (const s of shorts) {
    if (!s.videoId || !s.title || !s.creatorId) {
      return { valid: false, error: `Validation failed: Video ${s.videoId || "unknown"} is missing key fields.` };
    }
    if (typeof s.views !== "number" || isNaN(s.views)) {
      return { valid: false, error: `Validation failed: Video ${s.videoId} has invalid views: ${s.views}` };
    }
  }
  for (const a of audios) {
    if (!a.id || !a.name) {
      return { valid: false, error: `Validation failed: Audio group ${a.id || "unknown"} is missing name or ID.` };
    }
    if (typeof a.trendScore !== "number" || isNaN(a.trendScore)) {
      return { valid: false, error: `Validation failed: Audio ${a.name} has invalid trendScore.` };
    }
  }
  return { valid: true };
}
async function retryRequest(fn, retries = 3, delay = 500, creator, endpoint, localDb, metrics, apiState) {
  let attempt = 1;
  while (attempt <= retries) {
    try {
      const res = await fn(apiState.activeKey);
      metrics.successfulRequestsCount++;
      return res;
    } catch (err) {
      metrics.failedRequestsCount++;
      const errorMsg = err.response?.data?.error?.message || err.message || String(err);
      const status = err.response?.status;
      const reason = err.response?.data?.error?.errors?.[0]?.reason || "";
      const isQuotaExhausted = status === 429 || status === 403 || reason === "quotaExceeded" || reason === "dailyLimitExceeded" || errorMsg.toLowerCase().includes("quota") || errorMsg.toLowerCase().includes("limit") || errorMsg.toLowerCase().includes("exceeded") || errorMsg.toLowerCase().includes("exhausted");
      if (isQuotaExhausted && !apiState.isUsingBackup && apiState.backupKey && apiState.backupKey !== apiState.activeKey) {
        const failoverLog = `[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] [FAILOVER] Quota exhausted on primary key during ${endpoint} for ${creator.name}. Swapping to backup YouTube API key and continuing onwards...`;
        console.warn(failoverLog);
        localDb.refreshStatus.logs.push(failoverLog);
        saveDb(localDb);
        apiState.activeKey = apiState.backupKey;
        apiState.isUsingBackup = true;
        attempt = 1;
        continue;
      }
      const attemptLog = `[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] [Attempt ${attempt}/${retries}] Request failed for ${creator.name} (${endpoint}): ${errorMsg}`;
      console.warn(attemptLog);
      localDb.refreshStatus.logs.push(attemptLog);
      saveDb(localDb);
      if (attempt === retries) {
        metrics.detailedErrors.push({
          creatorId: creator.id,
          creatorName: creator.name,
          endpoint,
          errorMessage: errorMsg,
          retryCount: attempt,
          finalStatus: "failed"
        });
        throw err;
      }
      const backoffDelay = delay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, backoffDelay));
      attempt++;
    }
  }
  throw new Error("API request failed after retries");
}
async function performFullFetchRefresh(triggerType) {
  console.log(`[Refresh Job] Starting fetch refresh. Triggered by: ${triggerType}`);
  const startTime = Date.now();
  const localDb = loadDb();
  localDb.refreshStatus = {
    status: "running",
    logs: [`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Refresh Started`],
    progress: 5,
    lastRun: localDb.refreshStatus.lastRun
  };
  saveDb(localDb);
  saveRefreshStatusToFirestore(localDb.refreshStatus).catch((err) => console.error("[Firestore] Refresh status update error:", err));
  const enabledCreators = localDb.creators.filter((c) => c.enabled);
  const fetchPeriodDays = 30;
  localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Loading Creator List: ${enabledCreators.length} active channels detected.`);
  localDb.refreshStatus.progress = 10;
  saveDb(localDb);
  const cutoffTime = Date.now() - 30 * 24 * 60 * 60 * 1e3;
  let allFetchedShorts = (localDb.rawShorts || localDb.shorts || []).filter(
    (s) => new Date(s.publishedDate).getTime() >= cutoffTime
  );
  const existingIdsSet = new Set(allFetchedShorts.map((s) => s.videoId));
  const { primary: primaryKey, backup: backupKey } = getYoutubeKeys(localDb);
  const hasRealKey = !!primaryKey;
  const apiState = {
    activeKey: primaryKey,
    backupKey,
    isUsingBackup: false
  };
  const failedCreators = [];
  let totalVideosFetched = 0;
  let apiSuspended = false;
  const metrics = {
    successfulRequestsCount: 0,
    failedRequestsCount: 0,
    detailedErrors: []
  };
  if (hasRealKey) {
    localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Real YouTube API key detected. Fetching channels...`);
    saveDb(localDb);
    for (let i = 0; i < enabledCreators.length; i++) {
      const creator = enabledCreators[i];
      const progressPercent = Math.round(15 + i / enabledCreators.length * 50);
      localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Processing Creator ${i + 1} of ${enabledCreators.length}: ${creator.name}`);
      localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Fetching Videos for ${creator.name}...`);
      saveDb(localDb);
      if (apiSuspended) {
        localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] [${i + 1}/${enabledCreators.length}] API suspended (Rate Limit active). Loading high-fidelity template fallback for: ${creator.name}`);
        localDb.refreshStatus.progress = progressPercent;
        const realFallbackShorts = getPreloadedShortsForCreators([creator], fetchPeriodDays);
        const newMockShorts = realFallbackShorts.filter((ms) => !existingIdsSet.has(ms.videoId));
        if (newMockShorts.length > 0) {
          allFetchedShorts.push(...newMockShorts);
          totalVideosFetched += newMockShorts.length;
          newMockShorts.forEach((ms) => existingIdsSet.add(ms.videoId));
        }
        saveDb(localDb);
        continue;
      }
      try {
        let hasMore = true;
        let pageToken = "";
        let creatorNewShorts = [];
        const cutoffDate = /* @__PURE__ */ new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        while (hasMore) {
          try {
            const sRes = await retryRequest(
              (key) => {
                let searchUrl = `https://www.googleapis.com/youtube/v3/search?key=${key}&channelId=${creator.id}&part=snippet&type=video&maxResults=50&order=date&videoDuration=short`;
                if (pageToken) {
                  searchUrl += `&pageToken=${pageToken}`;
                }
                return axios.get(searchUrl);
              },
              3,
              1e3,
              creator,
              "YouTube Search API",
              localDb,
              metrics,
              apiState
            );
            const sItems = sRes.data.items || [];
            if (sItems.length === 0) {
              hasMore = false;
              break;
            }
            let reachedCutoff = false;
            let foundExisting = false;
            for (const item of sItems) {
              const vId = item.id?.videoId;
              if (vId && existingIdsSet.has(vId)) {
                foundExisting = true;
              }
              const publishedAtStr = item.snippet?.publishedAt;
              if (publishedAtStr) {
                const publishedAt = new Date(publishedAtStr);
                if (publishedAt < cutoffDate) {
                  reachedCutoff = true;
                }
              }
            }
            const validItems = sItems.filter((item) => {
              const vId = item.id?.videoId;
              if (!vId || existingIdsSet.has(vId)) return false;
              const publishedAtStr = item.snippet?.publishedAt;
              if (!publishedAtStr) return false;
              return new Date(publishedAtStr) >= cutoffDate;
            });
            if (validItems.length > 0) {
              const videoIds = validItems.map((item) => item.id.videoId);
              const statsRes = await retryRequest(
                (key) => {
                  const statsUrl = `https://www.googleapis.com/youtube/v3/videos?key=${key}&id=${videoIds.join(",")}&part=statistics,snippet`;
                  return axios.get(statsUrl);
                },
                3,
                1e3,
                creator,
                "YouTube Videos API",
                localDb,
                metrics,
                apiState
              );
              const videosList = statsRes.data.items || [];
              const pageShorts = videosList.map((v) => {
                const snippet = v.snippet;
                const stats2 = v.statistics;
                return {
                  videoId: v.id,
                  title: snippet.title || "",
                  thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url || "",
                  views: parseInt(stats2.viewCount || "0", 10),
                  likes: parseInt(stats2.likeCount || "0", 10),
                  publishedDate: snippet.publishedAt,
                  creatorName: creator.name,
                  creatorId: creator.id,
                  videoUrl: `https://www.youtube.com/shorts/${v.id}`,
                  audioName: "",
                  audioId: "",
                  description: snippet.description || "",
                  tags: snippet.tags || []
                };
              });
              creatorNewShorts.push(...pageShorts);
              totalVideosFetched += pageShorts.length;
              pageShorts.forEach((ps) => existingIdsSet.add(ps.videoId));
            }
            if (reachedCutoff || foundExisting || !sRes.data.nextPageToken) {
              hasMore = false;
            } else {
              pageToken = sRes.data.nextPageToken;
            }
          } catch (apiErr) {
            throw apiErr;
          }
        }
        if (creatorNewShorts.length > 0) {
          localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Running Gemini AI audio analysis on ${creatorNewShorts.length} brand new Shorts...`);
          saveDb(localDb);
          const analyzedNewShorts = await analyzeShortsAudioWithGemini(creatorNewShorts);
          allFetchedShorts = allFetchedShorts.filter((s) => s.creatorId !== creator.id);
          allFetchedShorts.push(...analyzedNewShorts);
          localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Successfully loaded and analyzed ${creatorNewShorts.length} new Shorts from ${creator.name}.`);
          creator.lastUpdated = (/* @__PURE__ */ new Date()).toISOString();
        } else {
          localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Creator ${creator.name} is fully up-to-date. No new uploads detected.`);
        }
      } catch (err) {
        console.error(`Error pulling creator ${creator.name}:`, err);
        failedCreators.push(creator.id);
        const isRateLimitOrQuota = err.response?.status === 429 || err.response?.status === 403 || err.message && (err.message.includes("429") || err.message.includes("403"));
        if (isRateLimitOrQuota) {
          apiSuspended = true;
          localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Error pulling ${creator.name}: Rate limit or quota error (429/403) detected. Suspending active API calls for this run and switching to local high-fidelity backups.`);
        } else {
          localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Error pulling ${creator.name}: ${err.message || err}. Loading high-fidelity template fallback.`);
        }
        const realFallbackShorts = getPreloadedShortsForCreators([creator], fetchPeriodDays);
        const newMockShorts = realFallbackShorts.filter((ms) => !existingIdsSet.has(ms.videoId));
        if (newMockShorts.length > 0) {
          allFetchedShorts.push(...newMockShorts);
          totalVideosFetched += newMockShorts.length;
          newMockShorts.forEach((ms) => existingIdsSet.add(ms.videoId));
        }
      }
      localDb.refreshStatus.progress = progressPercent;
      saveDb(localDb);
    }
  } else {
    localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] YouTube API key not found. Launching premium offline alignment...`);
    saveDb(localDb);
    for (let i = 0; i < enabledCreators.length; i++) {
      const creator = enabledCreators[i];
      const progressPercent = Math.round(15 + i / enabledCreators.length * 50);
      localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Processing Creator ${i + 1} of ${enabledCreators.length}: ${creator.name}`);
      localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Fetching Videos for ${creator.name}...`);
      await new Promise((resolve) => setTimeout(resolve, 80));
      const creatorShorts = getPreloadedShortsForCreators([creator], fetchPeriodDays);
      const newMockShorts = creatorShorts.filter((ms) => !existingIdsSet.has(ms.videoId));
      if (newMockShorts.length > 0) {
        allFetchedShorts.push(...newMockShorts);
        totalVideosFetched += newMockShorts.length;
        newMockShorts.forEach((ms) => existingIdsSet.add(ms.videoId));
        localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Successfully loaded ${newMockShorts.length} new high-fidelity real shorts.`);
      } else {
        localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Creator ${creator.name} is fully up-to-date.`);
      }
      localDb.refreshStatus.progress = progressPercent;
      saveDb(localDb);
    }
  }
  localDb.refreshStatus.progress = 70;
  localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Compiling raw Shorts complete. Total shorts in rolling database: ${allFetchedShorts.length}.`);
  localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Stage: Analyzing Videos`);
  localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Skipping full analysis, already completed incrementally.`);
  saveDb(localDb);
  localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Stage: Detecting Audio`);
  localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Stage: Grouping Audio`);
  localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Stage: Calculating Trend Scores`);
  localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Recalculating trends for all timeframes (7, 14, 21, 30 days)...`);
  saveDb(localDb);
  const finalCutoff = Date.now() - 30 * 24 * 60 * 60 * 1e3;
  allFetchedShorts = allFetchedShorts.filter((s) => new Date(s.publishedDate).getTime() >= finalCutoff);
  const periods = [7, 14, 21, 30];
  const trendsCache = {};
  const now = /* @__PURE__ */ new Date();
  periods.forEach((pDays) => {
    const cutoffTime2 = now.getTime() - pDays * 24 * 60 * 60 * 1e3;
    const filteredShorts = allFetchedShorts.filter((s) => new Date(s.publishedDate).getTime() >= cutoffTime2);
    const analysisResult = runTrendAnalysis(filteredShorts, localDb.creators);
    trendsCache[pDays] = {
      shorts: analysisResult.shorts,
      audios: analysisResult.audios
    };
  });
  localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Stage: Validation`);
  saveDb(localDb);
  const activeDays = localDb.settings.periodDays || 7;
  const activeTrend = trendsCache[activeDays] || trendsCache[7];
  const validation = validateRefreshResults(allFetchedShorts, activeTrend ? activeTrend.audios : []);
  const durationSec = parseFloat(((Date.now() - startTime) / 1e3).toFixed(1));
  const timestampStr = (/* @__PURE__ */ new Date()).toISOString();
  let jobStatus = "failed";
  if (validation.valid) {
    jobStatus = "success";
    localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Validation Passed: Yes`);
    localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Stage: Saving Database`);
    localDb.rawShorts = allFetchedShorts;
    localDb.trendsCache = trendsCache;
    localDb.shorts = activeTrend.shorts;
    localDb.audios = activeTrend.audios;
    localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Database Updated: Yes`);
    try {
      await upsertShortsInFirestore(allFetchedShorts);
      if (activeTrend && activeTrend.audios) {
        await upsertAudiosInFirestore(activeTrend.audios);
      }
      await saveTrendsCacheToFirestore(trendsCache);
    } catch (err) {
      console.error("[Firestore] Shorts/audios persist error:", err);
    }
  } else {
    jobStatus = "failed";
    const validationError = validation.error || "Validation failed";
    localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Validation Passed: No`);
    localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] ERROR: ${validationError}`);
    localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Stage: Saving Database skipped. Old cache remains protected.`);
    localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Database Updated: No`);
  }
  const stats = global.lastCrawlStats || {
    totalVideosAnalyzed: allFetchedShorts.length,
    totalAudiosDetected: activeTrend ? activeTrend.audios.length : 0,
    duplicateAudiosMerged: 0,
    videosSkipped: 0,
    videosWithUnknownAudio: 0
  };
  localDb.refreshStatus.status = jobStatus;
  localDb.refreshStatus.progress = 100;
  localDb.refreshStatus.lastRun = timestampStr;
  localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Stage: Refresh Complete`);
  localDb.refreshStatus.logs.push(`
=================================`);
  localDb.refreshStatus.logs.push(`        REFRESH SUMMARY`);
  localDb.refreshStatus.logs.push(`=================================`);
  localDb.refreshStatus.logs.push(`Creators Processed:      ${enabledCreators.length} / ${enabledCreators.length}`);
  localDb.refreshStatus.logs.push(`Videos Retrieved:        ${totalVideosFetched}`);
  localDb.refreshStatus.logs.push(`Videos Analyzed:         ${stats.totalVideosAnalyzed}`);
  localDb.refreshStatus.logs.push(`Audios Detected:         ${stats.totalAudiosDetected}`);
  localDb.refreshStatus.logs.push(`Duplicate Audios Merged: ${stats.duplicateAudiosMerged}`);
  localDb.refreshStatus.logs.push(`Successful API Requests: ${metrics.successfulRequestsCount}`);
  localDb.refreshStatus.logs.push(`Failed API Requests:     ${metrics.failedRequestsCount}`);
  localDb.refreshStatus.logs.push(`Database Updated:        ${validation.valid ? "Yes" : "No"}`);
  localDb.refreshStatus.logs.push(`Validation Passed:       ${validation.valid ? "Yes" : "No"}`);
  localDb.refreshStatus.logs.push(`Processing Time:         ${durationSec} seconds`);
  localDb.refreshStatus.logs.push(`Last Updated:            ${new Date(timestampStr).toLocaleString()}`);
  localDb.refreshStatus.logs.push(`=================================
`);
  if (metrics.detailedErrors.length > 0) {
    localDb.refreshStatus.logs.push(`=================================`);
    localDb.refreshStatus.logs.push(`        DETAILED ERROR REPORT`);
    localDb.refreshStatus.logs.push(`=================================`);
    metrics.detailedErrors.forEach((errDetail, idx) => {
      localDb.refreshStatus.logs.push(`[Error #${idx + 1}]`);
      localDb.refreshStatus.logs.push(`- Creator ID:    ${errDetail.creatorId}`);
      localDb.refreshStatus.logs.push(`- Creator Name:  ${errDetail.creatorName}`);
      localDb.refreshStatus.logs.push(`- API Endpoint:  ${errDetail.endpoint}`);
      localDb.refreshStatus.logs.push(`- Error Message: ${errDetail.errorMessage}`);
      localDb.refreshStatus.logs.push(`- Retry Count:   ${errDetail.retryCount}`);
      localDb.refreshStatus.logs.push(`- Final Status:  ${errDetail.finalStatus}`);
      localDb.refreshStatus.logs.push(`---------------------------------`);
    });
  }
  const newLog = {
    id: crypto.randomUUID(),
    startTime: new Date(startTime).toISOString(),
    endTime: timestampStr,
    status: jobStatus,
    durationSec,
    creatorsProcessed: enabledCreators.length,
    videosProcessed: allFetchedShorts.length,
    trendingAudiosFound: activeTrend ? activeTrend.audios.length : 0,
    errors: failedCreators.length > 0 ? [`Failed to fetch ${failedCreators.length} channels from YouTube API.`] : [],
    failedCreators,
    videosRetrieved: totalVideosFetched,
    audiosDetected: stats.totalAudiosDetected,
    duplicateAudiosMerged: stats.duplicateAudiosMerged,
    successfulRequestsCount: metrics.successfulRequestsCount,
    failedRequestsCount: metrics.failedRequestsCount,
    databaseUpdated: validation.valid,
    validationPassed: validation.valid,
    detailedErrors: metrics.detailedErrors
  };
  if (!localDb.fetchHistory) {
    localDb.fetchHistory = [];
  }
  localDb.fetchHistory = [newLog, ...localDb.fetchHistory].slice(0, 50);
  saveDb(localDb);
  try {
    await appendSyncLogInFirestore(newLog);
    await saveRefreshStatusToFirestore(localDb.refreshStatus);
  } catch (err) {
    console.error("[Firestore] Sync log/status persist error:", err);
  }
  hasHydratedFromFirestore = true;
  lastFirestoreSyncTimestamp = Date.now();
  return {
    success: jobStatus === "success",
    totalCreators: enabledCreators.length,
    totalVideos: allFetchedShorts.length,
    totalTrendingAudios: activeTrend ? activeTrend.audios.length : 0,
    failedCreators
  };
}
app.post("/api/refresh", async (req, res) => {
  if (!verifyAdmin(req, res)) return;
  const db = loadDb(req);
  if (db.refreshStatus.status === "running") {
    return res.status(400).json({ error: "Refresh is already running" });
  }
  if (process.env.VERCEL) {
    try {
      const result = await performFullFetchRefresh("manual");
      return res.json({ message: "Refresh job completed successfully.", status: "idle", result });
    } catch (err) {
      console.error("Vercel manual refresh failed:", err);
      return res.status(500).json({ error: err.message || "Refresh failed" });
    }
  }
  performFullFetchRefresh("manual").catch((err) => {
    console.error("Manual refresh background job failed:", err);
  });
  res.json({ message: "Refresh job triggered successfully.", status: "running" });
});
app.get("/api/refresh", async (req, res) => {
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  if (!isVercelCron && !verifyAdmin(req, res)) return;
  const db = loadDb(req);
  if (db.refreshStatus.status === "running") {
    return res.status(400).json({ error: "Refresh is already running" });
  }
  if (process.env.VERCEL) {
    try {
      const result = await performFullFetchRefresh("scheduled");
      return res.json({ message: "Scheduled refresh completed successfully.", status: "idle", result });
    } catch (err) {
      console.error("Vercel scheduled refresh failed:", err);
      return res.status(500).json({ error: err.message || "Scheduled refresh failed" });
    }
  }
  performFullFetchRefresh("scheduled").catch((err) => {
    console.error("Scheduled refresh background job failed:", err);
  });
  res.json({ message: "Scheduled refresh job triggered successfully.", status: "running" });
});
app.get("/api/fetch-info", (req, res) => {
  const db = loadDb(req);
  const latestLog = db.fetchHistory && db.fetchHistory.length > 0 ? db.fetchHistory[0] : null;
  const lastSuccessLog = db.fetchHistory ? db.fetchHistory.find((h) => h.status === "success") : null;
  res.json({
    lastFetchTime: latestLog ? latestLog.endTime : null,
    lastSuccessfulFetch: lastSuccessLog ? lastSuccessLog.endTime : null,
    currentStatus: db.refreshStatus.status,
    progress: db.refreshStatus.progress,
    logs: db.refreshStatus.logs || [],
    totalCreatorsProcessed: latestLog ? latestLog.creatorsProcessed : 0,
    totalVideosAnalyzed: latestLog ? latestLog.videosProcessed : 0,
    totalTrendingAudiosFound: latestLog ? latestLog.trendingAudiosFound : 0,
    nextScheduledFetch: getNextScheduledFetchTime(),
    fetchDurationSec: latestLog ? latestLog.durationSec : 0,
    failedCreators: latestLog ? latestLog.failedCreators || [] : [],
    fetchHistory: db.fetchHistory || []
  });
});
app.get("/api/db-stats", (req, res) => {
  const db = loadDb(req);
  const dbPath = getDbPath(req);
  const fileStats = fs2.existsSync(dbPath) ? fs2.statSync(dbPath) : null;
  res.json({
    totalCreators: db.creators.length,
    activeCreators: db.creators.filter((c) => c.enabled).length,
    totalShorts: db.shorts.length,
    totalAudios: db.audios.length,
    databaseSize: fileStats ? `${(fileStats.size / 1024).toFixed(2)} KB` : "0 KB",
    lastModified: fileStats ? fileStats.mtime : (/* @__PURE__ */ new Date()).toISOString(),
    logsCount: db.apiLogs.length,
    firestoreConnected: isFirestoreAvailable(),
    storageEngine: isFirestoreAvailable() ? "Firebase Firestore (Cloud Persistent)" : "Local JSON (Fallback)"
  });
});
app.get("/api/logs", (req, res) => {
  const db = loadDb(req);
  res.json(db.apiLogs);
});
app.post("/api/creators/import", (req, res) => {
  if (!verifyAdmin(req, res)) return;
  const db = loadDb(req);
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) {
    return res.status(400).json({ error: "An array of creator IDs ('ids') is required." });
  }
  const added = [];
  const skipped = [];
  const invalid = [];
  ids.forEach((id) => {
    const trimmedId = String(id).trim();
    if (!trimmedId) return;
    const formatCheck = validateCreatorInputFormat(trimmedId);
    if (!formatCheck.valid) {
      invalid.push(trimmedId);
      return;
    }
    const exists = db.creators.some((c) => c.id === trimmedId);
    if (exists) {
      skipped.push(trimmedId);
    } else {
      const newCreator = {
        id: trimmedId,
        name: `Channel_${trimmedId.substring(2, 8)}`,
        handle: `@user_${trimmedId.substring(2, 8)}`,
        avatarUrl: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120&auto=format&fit=crop&q=60",
        enabled: true,
        addedDate: (/* @__PURE__ */ new Date()).toISOString(),
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.creators.push(newCreator);
      added.push(newCreator);
    }
  });
  if (added.length > 0) {
    saveDb(db, req);
    added.forEach((c) => upsertCreatorInFirestore(c).catch((err) => console.error("[Firestore] Creator import error:", err)));
  }
  res.json({
    message: `Import complete. Added ${added.length} creators, skipped ${skipped.length} duplicates, rejected ${invalid.length} invalid formats.`,
    added,
    skipped,
    invalid
  });
});
async function startServer() {
  try {
    initFirestore();
    console.log("[Firestore] Connecting to cloud persistence layer...");
    const synced = await syncFromFirestore(true);
    const db = loadDb();
    if (!synced || !db.rawShorts || db.rawShorts.length === 0) {
      console.log("[Firestore] Cloud database is empty. Bootstrapping initial records...");
      await migrateLocalDataToFirestore(db);
      await syncFromFirestore(true);
    }
  } catch (firestoreBootErr) {
    console.error("[Firestore] Boot sync/migration error:", firestoreBootErr);
  }
  setInterval(() => {
    syncFromFirestore(false).catch((e) => console.warn("[Firestore Sync Interval]", e));
  }, 6e4);
  try {
    const db = loadDb();
    if (db && (!db.trendsCache || Object.keys(db.trendsCache).length === 0)) {
      console.log("Populating trendsCache from rawShorts on boot...");
      const rawShorts = db.rawShorts && db.rawShorts.length > 0 ? db.rawShorts : db.shorts && db.shorts.length > 0 ? db.shorts : generateMockShorts(db.creators, 30);
      const periods = [7, 14, 21, 30];
      const bootNow = /* @__PURE__ */ new Date();
      const initialTrendsCache = {};
      periods.forEach((pDays) => {
        const cutoffTime = bootNow.getTime() - pDays * 24 * 60 * 60 * 1e3;
        const filteredShorts = rawShorts.filter((s) => new Date(s.publishedDate).getTime() >= cutoffTime);
        const analysisResult = runTrendAnalysis(filteredShorts, db.creators);
        initialTrendsCache[pDays] = {
          shorts: analysisResult.shorts,
          audios: analysisResult.audios
        };
      });
      db.trendsCache = initialTrendsCache;
      const activeDays = db.settings?.periodDays || 7;
      const activeTrend = initialTrendsCache[activeDays] || initialTrendsCache[7];
      if (activeTrend) {
        db.shorts = activeTrend.shorts;
        db.audios = activeTrend.audios;
      }
      if (!db.fetchHistory) {
        db.fetchHistory = [];
      }
      saveDb(db);
    }
  } catch (migErr) {
    console.error("Cache verification error on startup:", migErr);
  }
  console.log("[Scheduler] Initializing Daily automatic fetch scheduler at 3:00 AM...");
  cron.schedule("0 3 * * *", async () => {
    console.log("[Scheduler] Triggering automatic 3:00 AM Trend Refresh job...");
    try {
      const result = await performFullFetchRefresh("scheduled");
      console.log("[Scheduler] 3:00 AM Daily Trend Refresh completed. Success:", result.success);
    } catch (err) {
      console.error("[Scheduler] 3:00 AM Daily Trend Refresh failed:", err);
    }
  });
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `API endpoint not found: ${req.method} ${req.url}` });
  });
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path2.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path2.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}
if (!process.env.VERCEL) {
  startServer();
} else {
  initFirestore();
}
var server_default = app;
export {
  app,
  server_default as default
};
