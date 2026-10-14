import React, { useEffect, useState } from "react";
import axios from "axios";
import { 
  Users, 
  Video, 
  Music, 
  Eye, 
  ThumbsUp, 
  Calendar, 
  RefreshCw, 
  Activity,
  AlertTriangle,
  Play,
  ArrowUpRight,
  Instagram,
  Youtube
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { motion } from "motion/react";
import { Link, useNavigate } from "react-router-dom";
import { DashboardData, AudioGroup } from "../types";

const TIMEFRAME_STORAGE_KEY = "trendfinder_dashboard_timeframe";

export default function Dashboard({ triggerNotification }: { triggerNotification: (msg: string, type: "success" | "error" | "info") => void }) {
  // Read user-specific timeframe preference from localStorage; fallback to default 7 Days
  const [timeframe, setTimeframe] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(TIMEFRAME_STORAGE_KEY);
      if (saved) {
        const parsed = Number(saved);
        if ([7, 14, 21, 30].includes(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      // LocalStorage access fallback
    }
    return 7;
  });

  const [data, setData] = useState<DashboardData | null>(null);
  const [topAudios, setTopAudios] = useState<AudioGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async (silent = false, period: number = timeframe) => {
    if (!silent) setLoading(true);
    try {
      const [dashRes, audioRes] = await Promise.all([
        axios.get<DashboardData>(`/api/dashboard?periodDays=${period}`),
        axios.get<{ data: AudioGroup[] }>(`/api/trending/audio?limit=6&periodDays=${period}`)
      ]);
      setData(dashRes.data);
      setTopAudios(audioRes.data.data);
      setError(null);
      
      if (dashRes.data.refreshStatus.status === "running") {
        setRefreshing(true);
      } else {
        setRefreshing(false);
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to load dashboard analytics data.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData(false, timeframe);
  }, [timeframe]);

  // Poll dashboard data if a refresh job is currently running
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (refreshing) {
      interval = setInterval(() => {
        fetchDashboardData(true, timeframe);
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [refreshing, timeframe]);

  const handleManualRefresh = async () => {
    try {
      setRefreshing(true);
      triggerNotification("Trend Refresh Job initiated on backend...", "info");
      await axios.post("/api/refresh");
      fetchDashboardData(true, timeframe);
    } catch (err: any) {
      triggerNotification(err.response?.data?.error || "Failed to start refresh job", "error");
      setRefreshing(false);
    }
  };

  const [resettingJob, setResettingJob] = useState(false);
  const handleResetStuckJob = async () => {
    setResettingJob(true);
    try {
      await axios.post("/api/refresh/reset");
      triggerNotification("Trend Analysis Engine reset to IDLE.", "success");
      setRefreshing(false);
      fetchDashboardData(true, timeframe);
    } catch (e: any) {
      triggerNotification(e.response?.data?.error || "Failed to reset engine.", "error");
    } finally {
      setResettingJob(false);
    }
  };

  // User-specific timeframe update: updates localStorage immediately without modifying global Firestore settings
  const handleUpdatePeriod = (newDays: number) => {
    try {
      localStorage.setItem(TIMEFRAME_STORAGE_KEY, String(newDays));
    } catch (e) {
      console.warn("Failed to save timeframe to localStorage:", e);
    }
    setTimeframe(newDays);
    triggerNotification(`Displaying analysis for ${newDays} Days...`, "info");
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-zinc-800 rounded-lg"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-28 bg-zinc-800 rounded-xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-96 bg-zinc-800 rounded-xl lg:col-span-2"></div>
          <div className="h-96 bg-zinc-800 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-zinc-950/40 rounded-2xl border border-zinc-800 p-8">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Error Loading Analytics</h3>
        <p className="text-zinc-400 mb-6 text-center max-w-md">{error || "Could not communicate with the trend server."}</p>
        <button 
          onClick={() => fetchDashboardData()}
          className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 transition rounded-lg text-white font-medium flex items-center gap-2 shadow-lg shadow-purple-900/20"
        >
          <RefreshCw className="h-4 w-4" /> Try Again
        </button>
      </div>
    );
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  // Prepare chart data
  const chartData = topAudios.map(audio => ({
    name: audio.name.length > 15 ? audio.name.substring(0, 15) + "..." : audio.name,
    views: audio.totalViews,
    shorts: audio.shortsCount,
    creators: audio.uniqueCreatorsCount
  }));

  const activeJob = data.refreshStatus;

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-5">
        <div>
          <h1 className="text-3xl font-bold font-display text-white tracking-tight">Dashboard</h1>
          <p className="text-zinc-400 mt-1 text-sm">
            Founder: <span className="text-white font-semibold">NIKHIL DUBEY</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-zinc-900 border border-zinc-800/60 rounded-xl px-3 py-1.5 flex items-center gap-2 text-xs font-mono">
            <Calendar className="h-3.5 w-3.5 text-[#A78BFA]" />
            <span className="text-zinc-400">Timeframe:</span>
            <select
              value={timeframe}
              onChange={(e) => handleUpdatePeriod(Number(e.target.value))}
              disabled={refreshing}
              className="bg-transparent text-[#A78BFA] font-bold focus:outline-none border-none p-0 pr-1 select-none font-sans cursor-pointer disabled:opacity-50"
            >
              <option value="7" className="bg-zinc-950 text-zinc-300">7 Days</option>
              <option value="14" className="bg-zinc-950 text-zinc-300">14 Days</option>
              <option value="21" className="bg-zinc-950 text-zinc-300">21 Days</option>
              <option value="30" className="bg-zinc-950 text-zinc-300">30 Days</option>
            </select>
          </div>
          

        </div>
      </div>

      {/* Live Refresh Progress Widget */}
      {refreshing && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }} 
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/80 border border-purple-500/40 rounded-xl p-5 backdrop-blur-md relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-purple-500 to-indigo-500 animate-pulse" style={{ width: `${activeJob.progress}%` }}></div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
                <Activity className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-white">Trend Analysis Engine Running</h4>
                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-mono rounded font-bold">{activeJob.progress}%</span>
                </div>
                <p className="text-xs text-zinc-400 mt-1 max-w-xl font-mono truncate">
                  {activeJob.logs[activeJob.logs.length - 1] || "Initializing YouTube API crawler..."}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-full md:w-48 bg-zinc-800 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${activeJob.progress}%` }}
                ></div>
              </div>
              <button
                onClick={handleResetStuckJob}
                disabled={resettingJob}
                title="Reset stuck engine"
                className="text-[10px] text-zinc-400 hover:text-white px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 rounded-md font-mono shrink-0 cursor-pointer border border-zinc-700/60 transition"
              >
                {resettingJob ? "..." : "Reset"}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Stat 1 */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 p-4.5 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-3 -top-3 w-16 h-16 bg-purple-600/5 rounded-full blur-xl group-hover:bg-purple-600/10 transition-all duration-500"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">Total Creators</span>
            <div className="p-2 bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-lg text-[#A78BFA]">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <h2 className="text-3xl font-bold font-mono text-white">{data.totalCreators}</h2>
          <div className="text-[10px] text-zinc-500 mt-1.5 flex items-center gap-1 font-mono">
            <span className="text-[#A78BFA] font-semibold">{data.enabledCreatorsCount} active</span> channels monitored
          </div>
        </div>

        {/* Stat 2 */}
        <Link 
          to="/trending-videos"
          className="bg-zinc-900/40 border border-zinc-800/60 p-4.5 rounded-2xl relative overflow-hidden group block cursor-pointer hover:border-blue-500/50 hover:bg-zinc-900/60 hover:scale-[1.02] transition-all duration-300"
        >
          <div className="absolute -right-3 -top-3 w-16 h-16 bg-blue-600/5 rounded-full blur-xl group-hover:bg-blue-600/10 transition-all duration-500"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Short Analyzed</span>
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 group-hover:bg-blue-500/20 transition-colors">
              <Video className="h-4 w-4" />
            </div>
          </div>
          <h2 className="text-3xl font-bold font-mono text-white group-hover:text-blue-300 transition-colors">{data.totalShortsAnalyzed}</h2>
          <div className="text-[10px] text-zinc-500 mt-1.5 font-mono">
            Avg <span className="text-blue-400 font-semibold">{(data.totalShortsAnalyzed / Math.max(1, data.totalCreators)).toFixed(1)}</span> shorts per creator
          </div>
        </Link>

        {/* Stat 3 */}
        <Link 
          to="/trending-audio"
          className="bg-zinc-900/40 border border-zinc-800/60 p-4.5 rounded-2xl relative overflow-hidden group block cursor-pointer hover:border-[#7C3AED]/50 hover:bg-zinc-900/60 hover:scale-[1.02] transition-all duration-300"
        >
          <div className="absolute -right-3 -top-3 w-16 h-16 bg-pink-600/5 rounded-full blur-xl group-hover:bg-pink-600/10 transition-all duration-500"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Trending Audio</span>
            <div className="p-2 bg-pink-500/10 border border-pink-500/20 rounded-lg text-[#A78BFA] group-hover:bg-[#7C3AED]/20 transition-colors">
              <Music className="h-4 w-4" />
            </div>
          </div>
          <h2 className="text-3xl font-bold font-mono text-white group-hover:text-purple-300 transition-colors">{data.totalTrendingAudio}</h2>
          <div className="text-[10px] text-zinc-500 mt-1.5 font-mono">
            Unique audio patterns matching rules
          </div>
        </Link>

        {/* Stat 4 */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 p-4.5 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-3 -top-3 w-16 h-16 bg-emerald-600/5 rounded-full blur-xl group-hover:bg-emerald-600/10 transition-all duration-500"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Total Views</span>
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
              <Eye className="h-4 w-4" />
            </div>
          </div>
          <h2 className="text-3xl font-bold font-mono text-white">{formatNumber(data.stats.totalViews)}</h2>
          <div className="text-[10px] text-zinc-500 mt-1.5 font-mono">
            Aggregated traffic on detected shorts
          </div>
        </div>

        {/* Stat 5 */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 p-4.5 rounded-2xl relative overflow-hidden group">
          <div className="absolute -right-3 -top-3 w-16 h-16 bg-amber-600/5 rounded-full blur-xl group-hover:bg-amber-600/10 transition-all duration-500"></div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-zinc-400 font-medium uppercase tracking-wider">Likes Generated</span>
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
              <ThumbsUp className="h-4 w-4" />
            </div>
          </div>
          <h2 className="text-3xl font-bold font-mono text-white">{formatNumber(data.stats.totalLikes)}</h2>
          <div className="text-[10px] text-zinc-500 mt-1.5 font-mono">
            Avg engagement rate <span className="text-emerald-400 font-semibold">{((data.stats.totalLikes / Math.max(1, data.stats.totalViews)) * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recharts Analytics chart */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 p-5 rounded-2xl col-span-2 relative overflow-hidden backdrop-blur-sm">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-base font-semibold text-white">Top 6 Viral Audio Traffic</h3>
              <p className="text-xs text-zinc-500">Comparing total accumulated views across creators</p>
            </div>
            <span className="text-[10px] text-[#A78BFA] font-mono bg-[#7C3AED]/10 border border-[#7C3AED]/20 px-2 py-0.5 rounded-full font-bold">LIVE VIEWS</span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
                <YAxis stroke="#52525b" fontSize={10} tickLine={false} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px" }} 
                  labelStyle={{ fontWeight: "bold", color: "#f3f4f6" }}
                  itemStyle={{ color: "#a78bfa" }}
                />
                <Area type="monotone" dataKey="views" name="Total Views" stroke="#7C3AED" strokeWidth={2} fillOpacity={1} fill="url(#viewsGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Sidebar Mini ranking or details list */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 p-5 rounded-2xl backdrop-blur-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-semibold text-white mb-4">Trending Sound Rank</h3>
            
            {topAudios.length === 0 ? (
              <div className="text-center py-10 text-zinc-500 text-sm">No trending audio detected.</div>
            ) : (
              <div className="space-y-3">
                {topAudios.slice(0, 4).map((audio, index) => (
                  <Link 
                    to={`/audio/${audio.id}`}
                    key={audio.id} 
                    className="p-3 bg-zinc-900/60 rounded-lg border border-zinc-800/60 flex items-center justify-between group hover:border-[#7C3AED]/50 hover:bg-zinc-900/80 transition-all cursor-pointer block"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#7C3AED]/10 border border-[#7C3AED]/20 text-[#A78BFA] font-mono text-xs font-bold flex items-center justify-center group-hover:bg-[#7C3AED]/20 transition-all">
                        #{index + 1}
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-white group-hover:text-[#A78BFA] transition-colors line-clamp-1">{audio.name}</h4>
                        <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">{audio.artist || "Unknown Artist"}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-bold text-white font-mono group-hover:text-purple-300 transition-colors">{formatNumber(audio.totalViews)}</div>
                      <div className="text-[9px] text-zinc-500 mt-0.5 font-mono">{audio.shortsCount} Shorts</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-zinc-800/60 pt-4 mt-4">
            <div className="flex items-center justify-between text-xs text-zinc-500 font-mono">
              <span>Last analyzed:</span>
              <span className="text-zinc-450 font-bold">{new Date(data.lastUpdated).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recharts Shorts Density bar chart */}
      <div className="bg-zinc-900/40 border border-zinc-800/60 p-5 rounded-2xl relative overflow-hidden backdrop-blur-sm">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-base font-semibold text-white">Engagement density</h3>
            <p className="text-xs text-zinc-500">Shorts frequency and unique creators contribution per audio</p>
          </div>
        </div>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" stroke="#52525b" fontSize={10} tickLine={false} />
              <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
              <Tooltip 
                contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "8px" }}
                labelStyle={{ fontWeight: "bold", color: "#f3f4f6" }}
              />
              <Bar dataKey="shorts" name="Videos Count" fill="#a78bfa" radius={[4, 4, 0, 0]} />
              <Bar dataKey="creators" name="Unique Creators" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Founder Spotlight Card */}
      <div className="bg-gradient-to-r from-zinc-900/60 via-zinc-900/40 to-zinc-950/20 border border-zinc-800/60 rounded-2xl p-6 relative overflow-hidden backdrop-blur-sm group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#7C3AED]/5 rounded-full blur-3xl -z-10 group-hover:bg-[#7C3AED]/10 transition-all duration-700"></div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] flex items-center justify-center text-white font-black text-lg shadow-lg shadow-[#7C3AED]/20">
              ND
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white tracking-tight">NIKHIL DUBEY</h3>
                <span className="px-2.5 py-0.5 bg-[#7C3AED]/10 border border-[#7C3AED]/20 text-[#A78BFA] font-mono text-[9px] rounded font-bold uppercase tracking-wider">
                  Founder & IIITian
                </span>
                <span className="px-2.5 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-mono text-[9px] rounded font-bold uppercase tracking-wider">
                  IIIT GWALIOR
                </span>
              </div>
              <p className="text-zinc-400 text-xs mt-1.5 max-w-xl">
                Passionate developer & tech enthusiast from IIIT GWALIOR building modern intelligence tools for creators. Under his vision, TrendFinder aggregates global creator insights in real-time.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <a 
              href="https://instagram.com/nikhil_dubey_iiitian" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="px-4 py-2.5 bg-zinc-900 hover:bg-pink-600/10 hover:text-pink-400 border border-zinc-800 hover:border-pink-500/20 rounded-xl text-xs font-semibold text-zinc-300 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Instagram className="h-4 w-4" />
              <span>@nikhil_dubey_iiitian</span>
            </a>
            <a 
              href="https://youtube.com/@nikhil_dubey_iiitian" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="px-4 py-2.5 bg-zinc-900 hover:bg-red-600/10 hover:text-red-400 border border-zinc-800 hover:border-red-500/20 rounded-xl text-xs font-semibold text-zinc-300 flex items-center gap-2 transition-all cursor-pointer"
            >
              <Youtube className="h-4 w-4" />
              <span>YouTube Channel</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
