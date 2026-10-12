import React, { useState, useEffect } from "react";
import axios from "axios";
import { 
  Video, 
  Eye, 
  Search, 
  TrendingUp, 
  ExternalLink,
  ThumbsUp,
  Calendar,
  Music,
  User,
  Filter,
  HelpCircle
} from "lucide-react";
import { motion } from "motion/react";
import { Short, Creator } from "../types";

export default function TrendingVideos() {
  const [videos, setVideos] = useState<Short[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters State
  const [search, setSearch] = useState("");
  const [selectedCreator, setSelectedCreator] = useState("");
  const [minViews, setMinViews] = useState("0");
  const [showFilters, setShowFilters] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [videosRes, creatorsRes] = await Promise.all([
        axios.get<{ data: Short[] }>("/api/trending/videos?limit=100"),
        axios.get<Creator[]>("/api/creators?enabled=true")
      ]);
      setVideos(videosRes.data.data);
      setCreators(creatorsRes.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError("Failed to fetch trending representative videos.");
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

  // Instant local filtering
  const filteredVideos = videos.filter(video => {
    const searchMatch = !search || 
      video.title.toLowerCase().includes(search.toLowerCase()) || 
      video.creatorName.toLowerCase().includes(search.toLowerCase()) ||
      video.audioName.toLowerCase().includes(search.toLowerCase());

    const creatorMatch = !selectedCreator || video.creatorId === selectedCreator;
    
    const viewsMatch = video.views >= Number(minViews);

    return searchMatch && creatorMatch && viewsMatch;
  });

  const clearFilters = () => {
    setSearch("");
    setSelectedCreator("");
    setMinViews("0");
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-64 bg-zinc-800 rounded-lg"></div>
        <div className="h-14 bg-zinc-800 rounded-xl"></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
            <div key={i} className="h-80 bg-zinc-800 rounded-xl"></div>
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
            <Video className="h-7 w-7 text-[#A78BFA]" />
            Trending Videos
          </h1>
          <p className="text-zinc-400 mt-1 text-sm">
            Top viral Shorts representing each trending audio track — strictly deduplicated
          </p>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search titles, creators, or sounds..."
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
            {(selectedCreator || minViews !== "0") && (
              <span className="w-2 h-2 rounded-full bg-[#A78BFA] animate-pulse"></span>
            )}
          </button>

          {(selectedCreator || minViews !== "0" || search) && (
            <button
              onClick={clearFilters}
              className="px-4 py-3 bg-zinc-900 border border-zinc-800/60 hover:border-zinc-700 rounded-xl text-zinc-400 text-sm font-medium transition cursor-pointer"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <motion.div 
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4"
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
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">Min Views Threshold</label>
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
        </motion.div>
      )}

      {/* Videos Grid */}
      {filteredVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/40 rounded-2xl border border-zinc-800/60 p-8">
          <HelpCircle className="h-10 w-10 text-zinc-600 mb-3" />
          <h3 className="text-base font-semibold text-zinc-300">No matching videos</h3>
          <p className="text-zinc-500 text-xs mt-1 text-center max-w-sm">Try relaxing your search phrase or filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredVideos.map((video, index) => (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: Math.min(index * 0.03, 0.3) }}
              key={video.videoId}
              className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl overflow-hidden group hover:border-[#7C3AED]/30 transition-all flex flex-col justify-between relative"
            >
              {/* Vertical Video Stage */}
              <div className="relative aspect-[9/16] bg-zinc-900 overflow-hidden border-b border-zinc-900">
                <img 
                  src={video.thumbnailUrl} 
                  alt={video.title} 
                  className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />

                {/* Score badge top-right */}
                {video.trendScore && (
                  <div className="absolute top-3 right-3 px-2 py-1 bg-[#7C3AED]/90 backdrop-blur-md rounded text-[10px] font-mono text-white flex items-center gap-1 font-extrabold shadow-md shadow-[#7C3AED]/20">
                    <TrendingUp className="h-3 w-3" />
                    <span>SCORE: {video.trendScore.toLocaleString()}</span>
                  </div>
                )}

                {/* Views Badge */}
                <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-mono text-white flex items-center gap-1 font-bold">
                  <Eye className="h-3 w-3 text-emerald-400" />
                  <span>{video.views.toLocaleString()}</span>
                </div>

                {/* Hover Play Backdrop */}
                <a 
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-full bg-[#7C3AED] flex items-center justify-center text-white shadow-lg shadow-[#7C3AED]/30 scale-90 group-hover:scale-100 transition-transform">
                    <ExternalLink className="h-5 w-5" />
                  </div>
                </a>
              </div>

              {/* Text metadata */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3.5">
                <div className="space-y-1.5">
                  <h4 className="text-xs font-semibold text-white line-clamp-2 leading-relaxed" title={video.title}>
                    {video.title}
                  </h4>
                  
                  {/* Creator Info */}
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-sans">
                    <User className="h-3 w-3 text-[#A78BFA]" />
                    <span className="font-semibold">{video.creatorName}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  {/* Audio Link representation */}
                  {video.audioName && (
                    <div className="p-2 bg-zinc-900/60 border border-zinc-800/60 rounded-lg flex items-center gap-2">
                      <Music className="h-3.5 w-3.5 text-pink-400 flex-shrink-0" />
                      <div className="text-[10px] text-zinc-400 font-mono truncate max-w-full">
                        {video.audioName}
                      </div>
                    </div>
                  )}

                  {/* Date & Likes bottom meta */}
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 border-t border-zinc-900 pt-2">
                    <div className="flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3 text-[#A78BFA]" />
                      <span>{formatNumber(video.likes)} Likes</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(video.publishedDate).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                {/* Redirect YouTube click action */}
                <a 
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full text-center py-2 bg-zinc-900 hover:bg-[#7C3AED] transition border border-zinc-800/60 hover:border-[#7C3AED]/50 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Watch original Short
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
