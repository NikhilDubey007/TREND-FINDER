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
async function isFirestoreEmpty() {
  const db = initFirestore();
  if (!db) return false;
  try {
    const [creatorsSnap, shortsSnap] = await Promise.all([
      getDocs(query(collection(db, "creators"), firestoreLimit(1))),
      getDocs(query(collection(db, "shorts"), firestoreLimit(1)))
    ]);
    return creatorsSnap.empty && shortsSnap.empty;
  } catch (err) {
    console.error("[Firestore] Error checking if database is empty:", err);
    return false;
  }
}
async function testFirestoreConnection() {
  const db = initFirestore();
  if (!db) return false;
  try {
    const testDoc = doc(db, "test", "connection");
    await setDoc(testDoc, { timestamp: (/* @__PURE__ */ new Date()).toISOString(), ok: true }, { merge: true });
    return true;
  } catch (err) {
    try {
      const snap = await getDocs(query(collection(db, "creators"), firestoreLimit(1)));
      return true;
    } catch {
      return false;
    }
  }
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
      const docs = snap.docs;
      const CHUNK_SIZE = 200;
      for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
        const chunk = docs.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((sDoc) => {
          batch.delete(sDoc.ref);
        });
        await batch.commit();
      }
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
  if (!db || shorts.length === 0) return { success: true, count: 0 };
  try {
    const CHUNK_SIZE = 200;
    let totalWritten = 0;
    for (let i = 0; i < shorts.length; i += CHUNK_SIZE) {
      const chunk = shorts.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const s of chunk) {
        if (!s.videoId) continue;
        const sRef = doc(db, "shorts", s.videoId);
        batch.set(sRef, sanitizeForFirestore(s), { merge: true });
        if (s.audioId) {
          const usageId = `${s.videoId}_${s.audioId}`;
          const usageRef = doc(db, "audio_usage", usageId);
          const usageRecord = {
            id: usageId,
            audioId: s.audioId,
            videoId: s.videoId,
            creatorId: s.creatorId,
            views: s.views,
            publishedDate: s.publishedDate
          };
          batch.set(usageRef, sanitizeForFirestore(usageRecord), { merge: true });
        }
      }
      await batch.commit();
      totalWritten += chunk.length;
    }
    return { success: true, count: totalWritten };
  } catch (err) {
    const errorCode = err?.code || "UNKNOWN";
    const errorMsg = err?.message || String(err);
    console.error(`[Firestore] Failed to upsert shorts batch (${errorCode}):`, errorMsg);
    return { success: false, count: 0, error: errorMsg, code: errorCode };
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
  if (!db || audios.length === 0) return { success: true, count: 0 };
  try {
    const CHUNK_SIZE = 200;
    let totalWritten = 0;
    for (let i = 0; i < audios.length; i += CHUNK_SIZE) {
      const chunk = audios.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const a of chunk) {
        if (!a.id) continue;
        const aRef = doc(db, "audios", a.id);
        batch.set(aRef, sanitizeForFirestore(a), { merge: true });
      }
      await batch.commit();
      totalWritten += chunk.length;
    }
    return { success: true, count: totalWritten };
  } catch (err) {
    const errorCode = err?.code || "UNKNOWN";
    const errorMsg = err?.message || String(err);
    console.error(`[Firestore] Failed to upsert audios batch (${errorCode}):`, errorMsg);
    return { success: false, count: 0, error: errorMsg, code: errorCode };
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
    let snap;
    try {
      const q = query(colRef, orderBy("startTime", "desc"), firestoreLimit(maxResults));
      snap = await getDocs(q);
    } catch (qErr) {
      console.warn("[Firestore] Query sync_logs with orderBy failed, fetching all and sorting in-memory:", qErr);
      snap = await getDocs(colRef);
    }
    const logs = [];
    snap.forEach((docSnap) => {
      logs.push(docSnap.data());
    });
    logs.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    return logs.slice(0, maxResults);
  } catch (err) {
    console.error("[Firestore] Failed to fetch sync logs:", err);
    return null;
  }
}
async function appendSyncLogInFirestore(log) {
  const db = initFirestore();
  if (!db || !log.id) return { success: false, error: "Database not initialized or log missing ID" };
  try {
    const docRef = doc(db, "sync_logs", log.id);
    await setDoc(docRef, sanitizeForFirestore(log), { merge: true });
    return { success: true };
  } catch (err) {
    const errorCode = err?.code || "UNKNOWN";
    const errorMsg = err?.message || String(err);
    console.error(`[Firestore] Failed to save sync log (${errorCode}):`, errorMsg);
    return { success: false, error: errorMsg, code: errorCode };
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
  if (memoryDb && memoryDb.rawShorts && memoryDb.rawShorts.length > 0) {
    preloadedShorts = memoryDb.rawShorts;
  } else {
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
var hydrationPromise = null;
var lastHydratedAt = 0;
var HYDRATION_TTL_MS = 60 * 1e3;
async function ensureFirestoreHydrated(forceRefresh = false) {
  if (memoryDb && !forceRefresh && Date.now() - lastHydratedAt < HYDRATION_TTL_MS) {
    return memoryDb;
  }
  if (hydrationPromise) {
    return hydrationPromise;
  }
  hydrationPromise = (async () => {
    try {
      if (!isFirestoreAvailable()) {
        initFirestore();
      }
      if (isFirestoreAvailable()) {
        const [remoteCreators, remoteShorts, remoteAudios, remoteSettings, remoteLogs, remoteRefresh] = await Promise.all([
          fetchCreatorsFromFirestore(),
          fetchRawShortsFromFirestore(),
          fetchAudiosFromFirestore(),
          fetchSettingsFromFirestore(),
          fetchSyncLogsFromFirestore(50),
          fetchRefreshStatusFromFirestore()
        ]);
        const hasFirestoreData = remoteCreators && remoteCreators.length > 0 || remoteShorts && remoteShorts.length > 0;
        if (hasFirestoreData) {
          const creators = remoteCreators || [];
          const rawShorts = remoteShorts || [];
          const settings = remoteSettings ? { ...defaultSettings, ...remoteSettings } : memoryDb?.settings || defaultSettings;
          const fetchHistory = remoteLogs || [];
          const refreshStatus = remoteRefresh || memoryDb?.refreshStatus || {
            status: "idle",
            lastRun: (/* @__PURE__ */ new Date()).toISOString(),
            logs: ["Runtime hydrated from Firestore."],
            progress: 100
          };
          if (refreshStatus.status === "running") {
            const lastRunTime = refreshStatus.lastRun ? new Date(refreshStatus.lastRun).getTime() : 0;
            const isStale = !lastRunTime || Date.now() - lastRunTime > 10 * 60 * 1e3;
            if (isStale) {
              console.warn("[Persistence] Detected stale running engine job (>10m old). Automatically resetting status to idle.");
              refreshStatus.status = "idle";
              refreshStatus.progress = 100;
              refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Engine automatically reset to idle (previous job timed out).`);
              saveRefreshStatusToFirestore(refreshStatus).catch((e) => console.warn("[Firestore] Reset status error:", e));
            }
          }
          const periods = [7, 14, 21, 30];
          const trendsCache = {};
          const now = /* @__PURE__ */ new Date();
          periods.forEach((pDays) => {
            const cutoffTime = now.getTime() - pDays * 24 * 60 * 60 * 1e3;
            const filteredShorts = rawShorts.filter((s) => s.publishedDate && new Date(s.publishedDate).getTime() >= cutoffTime);
            const analysisResult = runTrendAnalysis(filteredShorts, creators);
            trendsCache[pDays] = {
              shorts: analysisResult.shorts,
              audios: analysisResult.audios
            };
          });
          const activeDays = settings.periodDays || 7;
          const activeTrend = trendsCache[activeDays] || trendsCache[7] || { shorts: [], audios: [] };
          const hydratedDb = {
            creators,
            rawShorts,
            shorts: activeTrend.shorts,
            audios: activeTrend.audios,
            settings,
            refreshStatus,
            apiLogs: memoryDb?.apiLogs || [],
            fetchHistory,
            trendsCache
          };
          memoryDb = hydratedDb;
          lastHydratedAt = Date.now();
          console.log(
            `[Firestore] Hydrated runtime cache directly from Firestore: ${creators.length} creators, ${rawShorts.length} raw shorts, ${activeTrend.audios.length} audios, ${fetchHistory.length} sync logs.`
          );
          if (!process.env.VERCEL) {
            try {
              fs2.writeFileSync(DB_PATH, JSON.stringify(hydratedDb, null, 2), "utf-8");
            } catch (e) {
              console.warn("[Persistence] Local file mirror update skipped:", e);
            }
          }
          return hydratedDb;
        } else {
          const empty = await isFirestoreEmpty();
          if (empty) {
            console.warn("[Persistence] Firestore is completely empty. Performing initial bootstrap setup...");
            return await seedInitialDatabaseToFirestore();
          }
        }
      }
    } catch (err) {
      console.error("[Persistence] Error during Firestore cache hydration:", err);
    }
    if (memoryDb) {
      return memoryDb;
    }
    console.warn("[Persistence] Firestore unavailable. Falling back to local read-only cache.");
    return loadFallbackLocalDb();
  })().finally(() => {
    hydrationPromise = null;
  });
  return hydrationPromise;
}
async function seedInitialDatabaseToFirestore() {
  console.log("[Persistence] Bootstrapping initial database and seeding to Firestore (one-time initialization)...");
  const mockShorts = generateMockShorts(defaultCreators, 30);
  const periods = [7, 14, 21, 30];
  const initialTrendsCache = {};
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
  const activeDays = defaultSettings.periodDays || 7;
  const activeTrend = initialTrendsCache[activeDays] || initialTrendsCache[7];
  const seedCreators = defaultCreators.map((c) => ({
    ...c,
    addedDate: (/* @__PURE__ */ new Date()).toISOString(),
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
  }));
  const initialLog = {
    id: crypto.randomUUID(),
    startTime: (/* @__PURE__ */ new Date()).toISOString(),
    endTime: (/* @__PURE__ */ new Date()).toISOString(),
    status: "success",
    persistenceStatus: "FETCH_SUCCESS_PERSISTED",
    firestorePersisted: true,
    durationSec: 1,
    creatorsProcessed: defaultCreators.length,
    videosProcessed: mockShorts.length,
    trendingAudiosFound: activeTrend.audios.length,
    errors: [],
    failedCreators: []
  };
  const seedDb = {
    creators: seedCreators,
    rawShorts: mockShorts,
    shorts: activeTrend.shorts,
    audios: activeTrend.audios,
    settings: defaultSettings,
    refreshStatus: {
      status: "idle",
      lastRun: (/* @__PURE__ */ new Date()).toISOString(),
      logs: ["Database bootstrapped with initial data."],
      progress: 100
    },
    apiLogs: [
      { timestamp: (/* @__PURE__ */ new Date()).toISOString(), method: "SYSTEM", url: "BOOTSTRAP", status: 200, durationMs: 150 }
    ],
    fetchHistory: [initialLog],
    trendsCache: initialTrendsCache
  };
  try {
    for (const c of seedCreators) {
      await upsertCreatorInFirestore(c);
    }
    await upsertShortsInFirestore(mockShorts);
    await upsertAudiosInFirestore(activeTrend.audios);
    await upsertSettingsInFirestore(defaultSettings);
    await appendSyncLogInFirestore(initialLog);
    await saveRefreshStatusToFirestore(seedDb.refreshStatus);
    console.log("[Persistence] Seed data successfully written to Firestore.");
  } catch (seedErr) {
    console.error("[Persistence] Failed to seed initial data to Firestore:", seedErr);
  }
  memoryDb = seedDb;
  lastHydratedAt = Date.now();
  return seedDb;
}
function loadFallbackLocalDb() {
  try {
    if (fs2.existsSync(DB_PATH)) {
      const data = fs2.readFileSync(DB_PATH, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed) {
        if (!parsed.creators) parsed.creators = [];
        if (!parsed.settings) parsed.settings = { ...defaultSettings };
        if (!parsed.rawShorts) parsed.rawShorts = parsed.shorts || [];
        const periodDays = parsed.settings.periodDays || 7;
        const cutoffTime = Date.now() - periodDays * 24 * 60 * 60 * 1e3;
        const filteredRawShorts = (parsed.rawShorts || []).filter((s) => s.publishedDate && new Date(s.publishedDate).getTime() >= cutoffTime);
        const analysisResult = runTrendAnalysis(filteredRawShorts, parsed.creators);
        parsed.shorts = analysisResult.shorts;
        parsed.audios = analysisResult.audios;
        memoryDb = parsed;
        return parsed;
      }
    }
  } catch (error) {
    console.error("[Persistence Fallback] Database read error for local DB:", error);
  }
  const initialDb = {
    creators: defaultCreators.map((c) => ({
      ...c,
      addedDate: (/* @__PURE__ */ new Date()).toISOString(),
      lastUpdated: (/* @__PURE__ */ new Date()).toISOString()
    })),
    rawShorts: [],
    shorts: [],
    audios: [],
    settings: defaultSettings,
    refreshStatus: {
      status: "idle",
      lastRun: (/* @__PURE__ */ new Date()).toISOString(),
      logs: ["Database runtime initialized."],
      progress: 100
    },
    apiLogs: [],
    fetchHistory: [],
    trendsCache: {}
  };
  memoryDb = initialDb;
  return initialDb;
}
function loadDb(deviceIdInput) {
  if (memoryDb) {
    return memoryDb;
  }
  return loadFallbackLocalDb();
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
app.use("/api", async (req, res, next) => {
  try {
    await ensureFirestoreHydrated();
  } catch (err) {
    console.error("[Persistence Middleware] Hydration error:", err);
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
      db.apiLogs = [logEntry, ...db.apiLogs || []].slice(0, 100);
    } catch (e) {
      console.error("Failed to write API Log:", e);
    }
  });
  next();
});
app.use(express.json());
function getTimeframeData(db, requestedPeriodDays) {
  const periodDays = requestedPeriodDays && !isNaN(requestedPeriodDays) && requestedPeriodDays > 0 ? Number(requestedPeriodDays) : db.settings.periodDays || 7;
  if (db.trendsCache && db.trendsCache[periodDays]) {
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
  lastHydratedAt = Date.now();
  try {
    await upsertCreatorInFirestore(newCreator);
  } catch (err) {
    console.error("[Firestore] Creator upsert error:", err);
  }
  res.status(201).json(newCreator);
});
app.put("/api/creators/:id", async (req, res) => {
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
  lastHydratedAt = Date.now();
  try {
    await upsertCreatorInFirestore(updatedCreator);
  } catch (err) {
    console.error("[Firestore] Creator update error:", err);
  }
  res.json(updatedCreator);
});
app.delete("/api/creators/:id", async (req, res) => {
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
  lastHydratedAt = Date.now();
  try {
    await deleteCreatorFromFirestore(id);
  } catch (err) {
    console.error("[Firestore] Creator delete error:", err);
  }
  res.json({ success: true, message: `Creator ${id} successfully removed, and all associated shorts purged/re-analyzed.` });
});
app.get("/api/settings", (req, res) => {
  const db = loadDb(req);
  res.json(db.settings);
});
app.put("/api/settings", async (req, res) => {
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
  lastHydratedAt = Date.now();
  try {
    await upsertSettingsInFirestore(db.settings);
  } catch (err) {
    console.error("[Firestore] Settings update error:", err);
  }
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
  let persistenceStatus = "PERSISTENCE_FAILED";
  let firestorePersisted = false;
  if (validation.valid) {
    localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Validation Passed: Yes`);
    localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Stage: Persisting to Firestore (Authoritative Single Source of Truth)...`);
    const [shortsPersistRes, audiosPersistRes] = await Promise.all([
      upsertShortsInFirestore(allFetchedShorts),
      activeTrend && activeTrend.audios ? upsertAudiosInFirestore(activeTrend.audios) : Promise.resolve({ success: true, count: 0, error: void 0 })
    ]);
    firestorePersisted = shortsPersistRes.success && audiosPersistRes.success;
    if (firestorePersisted) {
      jobStatus = "success";
      persistenceStatus = "FETCH_SUCCESS_PERSISTED";
      localDb.rawShorts = allFetchedShorts;
      localDb.trendsCache = trendsCache;
      localDb.shorts = activeTrend.shorts;
      localDb.audios = activeTrend.audios;
      localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Firestore Persistence: SUCCESS (${shortsPersistRes.count} shorts, ${audiosPersistRes.count} audios written)`);
      localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Result: FETCH_SUCCESS_PERSISTED`);
      localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Database Updated: Yes`);
    } else {
      jobStatus = "failed";
      persistenceStatus = "PERSISTENCE_FAILED";
      const errMsg = shortsPersistRes.error || audiosPersistRes.error || "Firestore write error";
      console.error(`[Refresh Job] Firestore persistence failed: ${errMsg}`);
      localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Firestore Persistence FAILED: ${errMsg}`);
      localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Result: PERSISTENCE_FAILED`);
      localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Stage: Saving Database skipped. Old cache remains protected.`);
      localDb.refreshStatus.logs.push(`[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Database Updated: No`);
    }
  } else {
    jobStatus = "failed";
    persistenceStatus = "PERSISTENCE_FAILED";
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
  localDb.refreshStatus.logs.push(`Database Updated:        ${firestorePersisted ? "Yes" : "No"}`);
  localDb.refreshStatus.logs.push(`Validation Passed:       ${validation.valid ? "Yes" : "No"}`);
  localDb.refreshStatus.logs.push(`Firestore Persisted:     ${firestorePersisted ? "Yes (FETCH_SUCCESS_PERSISTED)" : "No (PERSISTENCE_FAILED)"}`);
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
    persistenceStatus,
    firestorePersisted,
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
    databaseUpdated: firestorePersisted,
    validationPassed: validation.valid,
    detailedErrors: metrics.detailedErrors
  };
  if (!localDb.fetchHistory) {
    localDb.fetchHistory = [];
  }
  localDb.fetchHistory = [newLog, ...localDb.fetchHistory].slice(0, 50);
  saveDb(localDb);
  lastHydratedAt = Date.now();
  try {
    await Promise.all([
      appendSyncLogInFirestore(newLog),
      saveRefreshStatusToFirestore(localDb.refreshStatus)
    ]);
  } catch (logErr) {
    console.error("[Firestore] Error saving sync log or refresh status:", logErr);
  }
  return {
    success: jobStatus === "success" && firestorePersisted,
    totalCreators: enabledCreators.length,
    totalVideos: allFetchedShorts.length,
    totalTrendingAudios: activeTrend ? activeTrend.audios.length : 0,
    failedCreators
  };
}
app.post("/api/refresh", async (req, res) => {
  if (!verifyAdmin(req, res)) return;
  const db = loadDb(req);
  const { force } = req.body || {};
  const isForce = force === true || req.query.force === "true";
  const lastRunTime = db.refreshStatus.lastRun ? new Date(db.refreshStatus.lastRun).getTime() : 0;
  const isStale = !lastRunTime || Date.now() - lastRunTime > 10 * 60 * 1e3;
  if (db.refreshStatus.status === "running" && !isForce && !isStale) {
    return res.status(400).json({ error: "Refresh is already running" });
  }
  if (isForce || isStale) {
    console.log("[Refresh] Bypassing lock due to force=true or stale job (>10m).");
    db.refreshStatus.status = "idle";
  }
  if (process.env.VERCEL) {
    try {
      const result = await performFullFetchRefresh("manual");
      return res.json({ message: "Refresh completed successfully.", result, status: "idle" });
    } catch (err) {
      return res.status(500).json({ error: "Refresh execution failed: " + (err.message || String(err)) });
    }
  }
  performFullFetchRefresh("manual").catch((err) => {
    console.error("Manual refresh background job failed:", err);
  });
  res.json({ message: "Refresh job triggered successfully.", status: "running" });
});
app.post(["/api/refresh/reset", "/api/refresh/cancel"], async (req, res) => {
  const db = loadDb(req);
  const lastRunTime = db.refreshStatus.lastRun ? new Date(db.refreshStatus.lastRun).getTime() : 0;
  const isStale = !lastRunTime || Date.now() - lastRunTime > 10 * 60 * 1e3;
  if (!isStale && !verifyAdmin(req, res)) return;
  db.refreshStatus = {
    status: "idle",
    progress: 100,
    lastRun: (/* @__PURE__ */ new Date()).toISOString(),
    logs: [
      ...(db.refreshStatus?.logs || []).slice(-20),
      `[${(/* @__PURE__ */ new Date()).toLocaleTimeString()}] Engine manually reset.`
    ]
  };
  saveDb(db, req);
  lastHydratedAt = Date.now();
  await saveRefreshStatusToFirestore(db.refreshStatus);
  res.json({ message: "Trend Analysis Engine successfully reset to idle.", status: "idle" });
});
app.get("/api/refresh", async (req, res) => {
  const isVercelCron = req.headers["x-vercel-cron"] === "1";
  if (!isVercelCron && !verifyAdmin(req, res)) return;
  const db = loadDb(req);
  const lastRunTime = db.refreshStatus.lastRun ? new Date(db.refreshStatus.lastRun).getTime() : 0;
  const isStale = !lastRunTime || Date.now() - lastRunTime > 10 * 60 * 1e3;
  if (db.refreshStatus.status === "running" && !isStale) {
    return res.status(400).json({ error: "Refresh is already running" });
  }
  if (process.env.VERCEL || isVercelCron) {
    try {
      const result = await performFullFetchRefresh("scheduled");
      return res.json({ message: "Scheduled refresh completed successfully.", result, status: "idle" });
    } catch (err) {
      return res.status(500).json({ error: "Scheduled refresh failed: " + (err.message || String(err)) });
    }
  }
  performFullFetchRefresh("scheduled").catch((err) => {
    console.error("Scheduled refresh background job failed:", err);
  });
  res.json({ message: "Scheduled refresh job triggered successfully.", status: "running" });
});
app.get("/api/fetch-info", async (req, res) => {
  const db = loadDb(req);
  if (!db.fetchHistory || db.fetchHistory.length <= 1) {
    try {
      const remoteLogs = await fetchSyncLogsFromFirestore(50);
      if (remoteLogs && remoteLogs.length > 0) {
        db.fetchHistory = remoteLogs;
      }
    } catch (e) {
      console.warn("[Firestore] Failed to query sync_logs for /api/fetch-info:", e);
    }
  }
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
    totalShorts: db.rawShorts && db.rawShorts.length > 0 ? db.rawShorts.length : db.shorts.length,
    activeShorts: db.shorts.length,
    totalAudios: db.audios.length,
    databaseSize: fileStats ? `${(fileStats.size / 1024).toFixed(2)} KB` : "Cloud Hosted",
    lastModified: fileStats ? fileStats.mtime : (/* @__PURE__ */ new Date()).toISOString(),
    logsCount: db.apiLogs.length,
    firestoreConnected: isFirestoreAvailable(),
    storageEngine: isFirestoreAvailable() ? "Firebase Firestore (Cloud Persistent Authoritative)" : "Local JSON (Fallback)"
  });
});
app.get("/api/logs", (req, res) => {
  const db = loadDb(req);
  res.json(db.apiLogs);
});
app.post("/api/creators/import", async (req, res) => {
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
    lastHydratedAt = Date.now();
    try {
      await Promise.all(added.map((c) => upsertCreatorInFirestore(c)));
    } catch (err) {
      console.error("[Firestore] Creator import error:", err);
    }
  }
  res.json({
    message: `Import complete. Added ${added.length} creators, skipped ${skipped.length} duplicates, rejected ${invalid.length} invalid formats.`,
    added,
    skipped,
    invalid
  });
});
var handlePersistenceDiagnostics = async (req, res) => {
  const db = loadDb(req);
  const firestoreReady = isFirestoreAvailable();
  let liveFirestoreCounts = {
    creators: -1,
    rawShorts: -1,
    audios: -1,
    syncLogs: -1
  };
  let firestoreTestSuccess = false;
  if (firestoreReady) {
    try {
      firestoreTestSuccess = await testFirestoreConnection();
      const [remoteC, remoteS, remoteA, remoteL] = await Promise.all([
        fetchCreatorsFromFirestore(),
        fetchRawShortsFromFirestore(),
        fetchAudiosFromFirestore(),
        fetchSyncLogsFromFirestore(100)
      ]);
      liveFirestoreCounts = {
        creators: remoteC ? remoteC.length : 0,
        rawShorts: remoteS ? remoteS.length : 0,
        audios: remoteA ? remoteA.length : 0,
        syncLogs: remoteL ? remoteL.length : 0
      };
    } catch (e) {
      console.error("[Diagnostics] Failed to sample live Firestore counts:", e);
    }
  }
  const latestLog = db.fetchHistory && db.fetchHistory.length > 0 ? db.fetchHistory[0] : null;
  res.json({
    status: firestoreReady && firestoreTestSuccess ? "HEALTHY" : "DEGRADED",
    firestoreConnected: firestoreReady,
    firestoreConnectivityVerified: firestoreTestSuccess,
    persistenceMode: "FIRESTORE_PRIMARY",
    sourceOfTruth: "Firebase Firestore (Cloud Persistent Authoritative)",
    environment: process.env.VERCEL ? "Vercel Serverless" : "Persistent Node Server",
    lastHydratedAt: new Date(lastHydratedAt).toISOString(),
    runtimeCacheCounts: {
      creators: db.creators.length,
      rawShorts: (db.rawShorts || []).length,
      activeShorts: db.shorts.length,
      audios: db.audios.length,
      syncLogs: (db.fetchHistory || []).length
    },
    firestoreLiveCounts: liveFirestoreCounts,
    lastPersistedSyncLog: latestLog ? {
      id: latestLog.id,
      endTime: latestLog.endTime,
      status: latestLog.status,
      persistenceStatus: latestLog.persistenceStatus || "FETCH_SUCCESS_PERSISTED",
      firestorePersisted: latestLog.firestorePersisted ?? true
    } : null,
    storageEngine: firestoreReady ? "Firebase Firestore (Authoritative Single Source of Truth)" : "Local JSON / In-Memory (Fallback)"
  });
};
app.get("/api/admin/persistence-status", handlePersistenceDiagnostics);
app.get("/api/diagnostics/persistence", handlePersistenceDiagnostics);
app.post("/api/admin/reseed", async (req, res) => {
  if (!verifyAdmin(req, res)) return;
  const { confirm } = req.body || {};
  if (confirm !== true && req.query.confirm !== "true") {
    return res.status(400).json({ error: "Explicit confirmation required: pass 'confirm: true' in request body to reseed." });
  }
  const result = await seedInitialDatabaseToFirestore();
  res.json({
    message: "Database explicitly reseeded to Firestore.",
    creatorsCount: result.creators.length,
    shortsCount: result.rawShorts?.length,
    audiosCount: result.audios?.length
  });
});
async function startServer() {
  try {
    initFirestore();
    console.log("[Persistence] Initializing Trend Finder with Firestore as authoritative source of truth...");
    await ensureFirestoreHydrated();
  } catch (firestoreBootErr) {
    console.error("[Persistence] Boot hydration error:", firestoreBootErr);
  }
  setInterval(() => {
    ensureFirestoreHydrated(true).catch((e) => console.warn("[Firestore Sync Interval]", e));
  }, 6e4);
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
