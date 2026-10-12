import fs from "fs";
import path from "path";
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
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
  writeBatch,
  Firestore
} from "firebase/firestore";

// Sanitize objects recursively to prevent Firestore 'Unsupported field value: undefined' errors
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) return data;
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === "object") {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data as any)) {
      if (value !== undefined) {
        cleaned[key] = sanitizeForFirestore(value);
      }
    }
    return cleaned;
  }
  return data;
}

export interface Creator {
  id: string;
  name: string;
  enabled: boolean;
  handle: string;
  avatarUrl: string;
  addedDate?: string;
  lastUpdated?: string;
}

export interface Short {
  videoId: string;
  title: string;
  thumbnailUrl: string;
  views: number;
  likes: number;
  publishedDate: string;
  creatorName: string;
  creatorId: string;
  videoUrl: string;
  audioName: string;
  audioId: string;
  description?: string;
  tags?: string[];
}

export interface AudioGroup {
  id: string;
  name: string;
  artist: string;
  uniqueCreatorsCount: number;
  shortsCount: number;
  totalViews: number;
  latestUploadDate: string;
  trendScore: number;
  highestViewedShortId: string;
  creators: string[];
  thumbnailUrl?: string;
}

export interface AudioUsage {
  id: string;
  audioId: string;
  videoId: string;
  creatorId: string;
  views: number;
  publishedDate: string;
}

export interface Settings {
  creatorLimit: number;
  periodDays: number;
  youtubeApiKeyPrimary?: string;
  youtubeApiKeyBackup?: string;
}

export interface JobStatus {
  status: "idle" | "running" | "failed" | "success";
  lastRun?: string;
  logs: string[];
  progress: number;
}

export interface FetchLog {
  id: string;
  startTime: string;
  endTime?: string;
  status: "success" | "failed" | "running";
  durationSec?: number;
  creatorsProcessed: number;
  videosProcessed: number;
  trendingAudiosFound: number;
  errors?: string[];
  failedCreators?: string[];
  videosRetrieved?: number;
  audiosDetected?: number;
  duplicateAudiosMerged?: number;
  successfulRequestsCount?: number;
  failedRequestsCount?: number;
  databaseUpdated?: boolean;
  validationPassed?: boolean;
  detailedErrors?: {
    creatorId: string;
    creatorName: string;
    endpoint: string;
    errorMessage: string;
    retryCount: number;
    finalStatus: string;
  }[];
}

export interface DatabaseSchema {
  creators: Creator[];
  shorts: Short[];
  audios: AudioGroup[];
  settings: Settings;
  refreshStatus: JobStatus;
  apiLogs: any[];
  fetchHistory?: FetchLog[];
  rawShorts?: Short[];
  trendsCache?: {
    [key: string]: {
      shorts: Short[];
      audios: AudioGroup[];
    };
  };
}

let firestoreInstance: Firestore | null = null;
let isInitialized = false;
let isReachable = false;

// Initialize Firebase App & Firestore using configuration
export function initFirestore(): Firestore | null {
  if (firestoreInstance && isInitialized) {
    return firestoreInstance;
  }

  try {
    let firebaseConfig: any = null;

    // 0. Support FIREBASE_CONFIG JSON string if provided in environment
    if (process.env.FIREBASE_CONFIG) {
      try {
        const parsed = JSON.parse(process.env.FIREBASE_CONFIG);
        firebaseConfig = { ...parsed };
      } catch (err) {
        console.warn("[Firestore] Failed to parse FIREBASE_CONFIG environment variable JSON:", err);
      }
    }

    // 1. Try reading firebase-applet-config.json if config not yet fully loaded
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

    // 2. Allow environment variable overrides if provided
    const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig?.projectId;
    const apiKey = process.env.FIREBASE_API_KEY || firebaseConfig?.apiKey;
    const databaseId = process.env.FIREBASE_DATABASE_ID || firebaseConfig?.firestoreDatabaseId;
    const authDomain = process.env.FIREBASE_AUTH_DOMAIN || firebaseConfig?.authDomain || (projectId ? `${projectId}.firebaseapp.com` : undefined);
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
    const app: FirebaseApp = apps.length > 0 ? apps[0] : initializeApp(finalConfig);

    setLogLevel("error");

    firestoreInstance = initializeFirestore(
      app,
      { localCache: memoryLocalCache() },
      finalConfig.firestoreDatabaseId || undefined
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

export function isFirestoreAvailable(): boolean {
  if (!isInitialized || !firestoreInstance) {
    initFirestore();
  }
  return isReachable && firestoreInstance !== null;
}

export async function isFirestoreEmpty(): Promise<boolean> {
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

export async function testFirestoreConnection(): Promise<boolean> {
  const db = initFirestore();
  if (!db) return false;
  try {
    const testDoc = doc(db, "test", "connection");
    await setDoc(testDoc, { timestamp: new Date().toISOString(), ok: true }, { merge: true });
    return true;
  } catch (err: any) {
    try {
      const snap = await getDocs(query(collection(db, "creators"), firestoreLimit(1)));
      return true;
    } catch {
      return false;
    }
  }
}

// -------------------------------------------------------------
// Collection 1: Creators (Collection: 'creators', docId = creator.id)
// -------------------------------------------------------------

export async function fetchCreatorsFromFirestore(): Promise<Creator[] | null> {
  const db = initFirestore();
  if (!db) return null;

  try {
    const colRef = collection(db, "creators");
    const snap = await getDocs(colRef);
    const creators: Creator[] = [];
    snap.forEach((docSnap) => {
      creators.push(docSnap.data() as Creator);
    });
    return creators;
  } catch (err) {
    console.error("[Firestore] Failed to fetch creators:", err);
    return null;
  }
}

export async function upsertCreatorInFirestore(creator: Creator): Promise<boolean> {
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

export async function deleteCreatorFromFirestore(creatorId: string): Promise<boolean> {
  const db = initFirestore();
  if (!db) return false;

  try {
    const docRef = doc(db, "creators", creatorId);
    await deleteDoc(docRef);

    // Also delete shorts belonging to this creator
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

// -------------------------------------------------------------
// Collection 2: Shorts (Collection: 'shorts', docId = videoId)
// -------------------------------------------------------------

export async function fetchRawShortsFromFirestore(cutoffDate?: string): Promise<Short[] | null> {
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

    const shorts: Short[] = [];
    snap.forEach((docSnap) => {
      shorts.push(docSnap.data() as Short);
    });
    return shorts;
  } catch (err) {
    console.error("[Firestore] Failed to fetch shorts:", err);
    return null;
  }
}

export async function upsertShortsInFirestore(shorts: Short[]): Promise<{ success: boolean; count: number; error?: string; code?: string }> {
  const db = initFirestore();
  if (!db || shorts.length === 0) return { success: true, count: 0 };

  try {
    // Write in chunks of 200 to respect Firestore's 500 operation limit per batch (200 shorts + 200 usage docs = 400 operations)
    const CHUNK_SIZE = 200;
    let totalWritten = 0;
    for (let i = 0; i < shorts.length; i += CHUNK_SIZE) {
      const chunk = shorts.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);
      for (const s of chunk) {
        if (!s.videoId) continue;
        const sRef = doc(db, "shorts", s.videoId);
        batch.set(sRef, sanitizeForFirestore(s), { merge: true });

        // Also record in audio_usage collection for cross-reference
        if (s.audioId) {
          const usageId = `${s.videoId}_${s.audioId}`;
          const usageRef = doc(db, "audio_usage", usageId);
          const usageRecord: AudioUsage = {
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
  } catch (err: any) {
    const errorCode = err?.code || "UNKNOWN";
    const errorMsg = err?.message || String(err);
    console.error(`[Firestore] Failed to upsert shorts batch (${errorCode}):`, errorMsg);
    return { success: false, count: 0, error: errorMsg, code: errorCode };
  }
}

// -------------------------------------------------------------
// Collection 3: Audios (Collection: 'audios', docId = audio.id)
// -------------------------------------------------------------

export async function fetchAudiosFromFirestore(): Promise<AudioGroup[] | null> {
  const db = initFirestore();
  if (!db) return null;

  try {
    const colRef = collection(db, "audios");
    const snap = await getDocs(colRef);
    const audios: AudioGroup[] = [];
    snap.forEach((docSnap) => {
      audios.push(docSnap.data() as AudioGroup);
    });
    return audios;
  } catch (err) {
    console.error("[Firestore] Failed to fetch audios:", err);
    return null;
  }
}

export async function upsertAudiosInFirestore(audios: AudioGroup[]): Promise<{ success: boolean; count: number; error?: string; code?: string }> {
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
  } catch (err: any) {
    const errorCode = err?.code || "UNKNOWN";
    const errorMsg = err?.message || String(err);
    console.error(`[Firestore] Failed to upsert audios batch (${errorCode}):`, errorMsg);
    return { success: false, count: 0, error: errorMsg, code: errorCode };
  }
}

// -------------------------------------------------------------
// Collection 4: Settings (Collection: 'settings', docId = 'app')
// -------------------------------------------------------------

export async function fetchSettingsFromFirestore(): Promise<Settings | null> {
  const db = initFirestore();
  if (!db) return null;

  try {
    const docRef = doc(db, "settings", "app");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as Settings;
    }
    return null;
  } catch (err) {
    console.error("[Firestore] Failed to fetch settings:", err);
    return null;
  }
}

export async function upsertSettingsInFirestore(settings: Settings): Promise<boolean> {
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

// -------------------------------------------------------------
// Collection 5: Sync Logs (Collection: 'sync_logs', docId = log.id)
// -------------------------------------------------------------

export async function fetchSyncLogsFromFirestore(maxResults = 50): Promise<FetchLog[] | null> {
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
    const logs: FetchLog[] = [];
    snap.forEach((docSnap) => {
      logs.push(docSnap.data() as FetchLog);
    });
    // Ensure sorted by startTime desc
    logs.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    return logs.slice(0, maxResults);
  } catch (err) {
    console.error("[Firestore] Failed to fetch sync logs:", err);
    return null;
  }
}

export async function appendSyncLogInFirestore(log: FetchLog): Promise<{ success: boolean; error?: string; code?: string }> {
  const db = initFirestore();
  if (!db || !log.id) return { success: false, error: "Database not initialized or log missing ID" };

  try {
    const docRef = doc(db, "sync_logs", log.id);
    await setDoc(docRef, sanitizeForFirestore(log), { merge: true });
    return { success: true };
  } catch (err: any) {
    const errorCode = err?.code || "UNKNOWN";
    const errorMsg = err?.message || String(err);
    console.error(`[Firestore] Failed to save sync log (${errorCode}):`, errorMsg);
    return { success: false, error: errorMsg, code: errorCode };
  }
}

// -------------------------------------------------------------
// System: Refresh Status (Doc: 'settings/refresh_status')
// -------------------------------------------------------------

export async function fetchRefreshStatusFromFirestore(): Promise<JobStatus | null> {
  const db = initFirestore();
  if (!db) return null;

  try {
    const docRef = doc(db, "settings", "refresh_status");
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as JobStatus;
    }
    return null;
  } catch (err) {
    console.error("[Firestore] Failed to fetch refresh status:", err);
    return null;
  }
}

export async function saveRefreshStatusToFirestore(status: JobStatus): Promise<boolean> {
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

// -------------------------------------------------------------
// Safe, Idempotent Database Migration to Firestore
// -------------------------------------------------------------

export async function migrateLocalDataToFirestore(localDb: DatabaseSchema): Promise<{
  success: boolean;
  migratedCreators: number;
  migratedShorts: number;
  migratedAudios: number;
  migratedLogs: number;
  error?: string;
}> {
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

    // 1. Check if creators already exist in Firestore
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

    // 2. Migrate raw shorts with stable videoId as docId
    const allShorts = localDb.rawShorts || localDb.shorts || [];
    let migratedShorts = 0;
    if (allShorts.length > 0) {
      // Chunked upsert with merge: true guarantees idempotency
      await upsertShortsInFirestore(allShorts);
      migratedShorts = allShorts.length;
    }

    // 3. Migrate audio groups with stable audio.id as docId
    let migratedAudios = 0;
    if (localDb.audios && localDb.audios.length > 0) {
      await upsertAudiosInFirestore(localDb.audios);
      migratedAudios = localDb.audios.length;
    }

    // 4. Migrate settings
    if (localDb.settings) {
      await upsertSettingsInFirestore(localDb.settings);
    }

    // 5. Migrate fetch history logs
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
  } catch (err: any) {
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
