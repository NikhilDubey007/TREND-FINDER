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
  trendScore?: number;
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

export interface APILog {
  timestamp: string;
  method: string;
  url: string;
  status: number;
  durationMs: number;
}

export interface JobStatus {
  status: "idle" | "running" | "failed" | "success";
  lastRun?: string;
  logs: string[];
  progress: number;
}

export interface Settings {
  creatorLimit: number;
  periodDays: number;
  youtubeApiKeyPrimary?: string;
  youtubeApiKeyBackup?: string;
}

export interface DashboardData {
  totalCreators: number;
  enabledCreatorsCount: number;
  totalShortsAnalyzed: number;
  totalTrendingAudio: number;
  lastUpdated: string;
  analysisPeriod: number;
  refreshStatus: JobStatus;
  stats: {
    totalViews: number;
    totalLikes: number;
  };
}

export interface DatabaseStats {
  totalCreators: number;
  activeCreators: number;
  totalShorts: number;
  totalAudios: number;
  databaseSize: string;
  lastModified: string;
  logsCount: number;
}

export interface FetchLog {
  id: string;
  startTime: string;
  endTime?: string;
  status: "success" | "failed" | "running";
  persistenceStatus?: "FETCH_SUCCESS_PERSISTED" | "FETCH_SUCCESS_LOCAL_ONLY" | "PERSISTENCE_FAILED";
  firestorePersisted?: boolean;
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

export interface FetchInfo {
  lastFetchTime: string | null;
  lastSuccessfulFetch: string | null;
  currentStatus: "idle" | "running" | "failed" | "success";
  progress: number;
  logs: string[];
  totalCreatorsProcessed: number;
  totalVideosAnalyzed: number;
  totalTrendingAudiosFound: number;
  nextScheduledFetch: string;
  fetchDurationSec: number;
  failedCreators: string[];
  fetchHistory: FetchLog[];
}

