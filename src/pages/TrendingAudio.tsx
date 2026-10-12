import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  Music, 
  Users, 
  Video, 
  Eye, 
  Search, 
  TrendingUp, 
  Filter, 
  ChevronRight, 
  Clock,
  Play,
  HelpCircle
} from "lucide-react";
import { motion } from "motion/react";
import { AudioGroup, Creator } from "../types";

export default function TrendingAudio() {
  const navigate = useNavigate();
  const [audios, setAudios] = useState<AudioGroup[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedCreator, setSelectedCreator] = useState("");
  const [minViews, setMinViews] = useState("0");
  const [minScore, setMinScore] = useState("0");
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [audiosRes, creatorsRes] = await Promise.all([
        axios.get<{ data: AudioGroup[] }>("/api/trending/audio?limit=100"),
        axios.get<Creator[]>("/api/creators?enabled=true")
      ]);
      setAudios(audiosRes.data.data);
      setCreators(creatorsRes.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch trending audio data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  // Instant local filtering without reload
  const filteredAudios = audios.filter(audio => {
    // 1. Search Query
    const searchMatch = !search || 
      audio.name.toLowerCase().includes(search.toLowerCase()) || 
      audio.artist.toLowerCase().includes(search.toLowerCase());

    // 2. Creator Filter
    // In our DB schema, audio.creators contains creator names or IDs
    const creatorMatch = !selectedCreator || 
      audio.creators.some(name => name === selectedCreator);

    // 3. Views Filter
    const viewsMatch = audio.totalViews >= Number(minViews);

    // 4. Trend Score Filter
    const scoreMatch = audio.trendScore >= Number(minScore);

    return searchMatch && creatorMatch && viewsMatch && scoreMatch;
  });

  const clearFilters = () => {
    setSearch("");
    setSelectedCreator("");
    setMinViews("0");
    setMinScore("0");
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 bg-zinc-800 rounded-lg"></div>
        <div className="h-14 bg-zinc-800 rounded-xl"></div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-24 bg-zinc-800 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 bg-zinc-950/40 rounded-2xl border border-zinc-800 p-8">
        <p className="text-red-400 font-semibold mb-4">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 bg-purple-600 rounded-lg text-white font-medium hover:bg-purple-700 transition">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/60 pb-5">
        <div>
          <h1 className="text-3xl font-bold font-display text-white tracking-tight flex items-center gap-2.5">
            <Music className="h-7 w-7 text-[#A78BFA]" />
            Trending Audios
          </h1>
          <p className="text-zinc-400 mt-1 text-sm">
            Grouped, deduplicated audio tracks ordered by relative velocity score
          </p>
        </div>
      </div>

      {/* Control Bar: Search & Filter toggle */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search audio name or artist..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-900/40 border border-zinc-800/60 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#7C3AED]/50 focus:ring-1 focus:ring-[#7C3AED]/20 transition-all font-sans"
          />
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-3 rounded-xl border text-sm font-medium flex items-center gap-2 transition-all cursor-pointer ${
              showFilters 
                ? "bg-[#7C3AED]/10 border-[#7C3AED]/30 text-[#A78BFA]" 
                : "bg-zinc-900/40 border border-zinc-800/60 text-zinc-300 hover:border-zinc-700"
            }`}
          >
            <Filter className="h-4 w-4" />
            Filters
            {(selectedCreator || minViews !== "0" || minScore !== "0") && (
              <span className="w-2 h-2 rounded-full bg-[#A78BFA] animate-pulse"></span>
            )}
          </button>

          {(selectedCreator || minViews !== "0" || minScore !== "0" || search) && (
            <button
              onClick={clearFilters}
              className="px-4 py-3 bg-zinc-900 border border-zinc-800/60 hover:border-[#7C3AED]/35 rounded-xl text-zinc-400 text-sm font-medium transition cursor-pointer"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Extended Filters Grid */}
      {showFilters && (
        <motion.div 
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4"
        >
          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Filter by Creator</label>
            <select
              value={selectedCreator}
              onChange={(e) => setSelectedCreator(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 focus:outline-none focus:border-[#7C3AED]/50 focus:ring-1 focus:ring-[#7C3AED]/20"
            >
              <option value="">All Creators</option>
              {creators.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Min Views Traffic</label>
            <select
              value={minViews}
              onChange={(e) => setMinViews(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 focus:outline-none focus:border-[#7C3AED]/50 focus:ring-1 focus:ring-[#7C3AED]/20"
            >
              <option value="0">Any Views</option>
              <option value="500000">Over 500K</option>
              <option value="1000000">Over 1M</option>
              <option value="5000000">Over 5M</option>
              <option value="10000000">Over 10M</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Min Velocity Score</label>
            <select
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-sm text-zinc-200 focus:outline-none focus:border-[#7C3AED]/50 focus:ring-1 focus:ring-[#7C3AED]/20"
            >
              <option value="0">Any Score</option>
              <option value="1000">Over 1,000</option>
              <option value="3000">Over 3,000</option>
              <option value="5000">Over 5,000</option>
              <option value="10000">Over 10,000</option>
            </select>
          </div>
        </motion.div>
      )}

      {/* Audios List */}
      {filteredAudios.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/40 rounded-2xl border border-zinc-800/60 p-8">
          <HelpCircle className="h-10 w-10 text-zinc-600 mb-3" />
          <h3 className="text-base font-semibold text-zinc-300">No matching audios</h3>
          <p className="text-zinc-500 text-xs mt-1 text-center max-w-sm">Try widening your search terms or clearing current filter states.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAudios.map((audio, index) => {
            // Use real thumbnailUrl from the audio group if available, or fall back to an Unsplash image
            const bgId = (index * 13) % 1000;
            const thumbUrl = audio.thumbnailUrl || `https://images.unsplash.com/photo-${1510000000000 + bgId}?w=120&h=120&fit=crop&q=80`;
            
            return (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.03, 0.3) }}
                key={audio.id}
                onClick={() => navigate(`/audio/${audio.id}`)}
                className="bg-zinc-900/40 border border-zinc-800/60 hover:border-[#7C3AED]/50 hover:bg-zinc-900/60 rounded-2xl p-4.5 backdrop-blur-sm transition-all group relative overflow-hidden cursor-pointer hover:scale-[1.01]"
              >
                {/* Visual Rank Tag */}
                <div className="absolute top-0 right-0 px-3 py-1 bg-[#7C3AED]/10 border-l border-b border-[#7C3AED]/20 text-[#A78BFA] font-mono text-[10px] font-bold rounded-bl-lg">
                  RANK #{index + 1}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1.5">
                  <div className="flex items-center gap-4.5">
                    {/* Audio Thumbnail representation */}
                    <div className="relative w-14 h-14 bg-zinc-900 rounded-lg border border-zinc-800/60 overflow-hidden flex-shrink-0 flex items-center justify-center">
                      <img 
                        src={thumbUrl} 
                        alt={audio.name} 
                        className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <Music className="h-5 w-5 text-[#A78BFA] drop-shadow" />
                      </div>
                    </div>

                    <div>
                      <h3 className="text-base font-semibold text-white group-hover:text-[#A78BFA] transition-colors line-clamp-1">{audio.name}</h3>
                      <p className="text-xs text-zinc-400 font-mono mt-0.5">{audio.artist || "Unknown Artist"}</p>
                      
                      {/* Badge Tags Row */}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="bg-zinc-900/60 border border-zinc-800/60 text-zinc-400 font-mono text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Users className="h-3 w-3 text-[#A78BFA]" />
                          <span>{audio.uniqueCreatorsCount} Unique Creators</span>
                        </span>
                        <span className="bg-zinc-900/60 border border-zinc-800/60 text-zinc-400 font-mono text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Video className="h-3 w-3 text-blue-400" />
                          <span>{audio.shortsCount} Videos</span>
                        </span>
                        <span className="bg-zinc-900/60 border border-zinc-800/60 text-zinc-400 font-mono text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Eye className="h-3 w-3 text-emerald-400" />
                          <span>{formatNumber(audio.totalViews)} Views</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Velocity score, Highest Viewed video & Drilldown details */}
                  <div className="flex items-center justify-between sm:justify-end gap-6 border-t border-zinc-900 sm:border-0 pt-3 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <div className="flex items-center gap-1 sm:justify-end text-xs font-mono font-bold text-[#A78BFA] uppercase tracking-wide">
                        <TrendingUp className="h-3.5 w-3.5" />
                        Velocity Score
                      </div>
                      <div className="text-2xl font-black text-white font-mono leading-none mt-1">{audio.trendScore.toLocaleString()}</div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-1 flex items-center gap-1 sm:justify-end">
                        <Clock className="h-3 w-3" />
                        <span>Upd: {new Date(audio.latestUploadDate).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div
                      className="px-4 py-2.5 bg-zinc-900 border border-zinc-800/60 hover:bg-[#7C3AED]/10 hover:border-[#7C3AED]/50 transition rounded-xl text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer flex-shrink-0"
                    >
                      Analyze Sound
                      <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
