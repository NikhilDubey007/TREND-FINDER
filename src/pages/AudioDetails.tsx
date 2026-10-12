import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { 
  ArrowLeft, 
  Music, 
  Users, 
  Video, 
  Eye, 
  TrendingUp, 
  ExternalLink,
  Play,
  Calendar,
  ThumbsUp,
  AlertTriangle
} from "lucide-react";
import { motion } from "motion/react";
import { AudioGroup, Short } from "../types";

export default function AudioDetails() {
  const { audioId } = useParams<{ audioId: string }>();
  const navigate = useNavigate();

  const [audio, setAudio] = useState<AudioGroup | null>(null);
  const [shorts, setShorts] = useState<Short[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAudioDetails = async () => {
    setLoading(true);
    try {
      const res = await axios.get<{ audio: AudioGroup; shorts: Short[] }>(`/api/audio/${audioId}`);
      setAudio(res.data.audio);
      setShorts(res.data.shorts);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to load audio details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (audioId) {
      fetchAudioDetails();
    }
  }, [audioId]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-6 w-24 bg-zinc-800 rounded-lg"></div>
        <div className="h-32 bg-zinc-800 rounded-xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-64 bg-zinc-800 rounded-xl"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !audio) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/40 rounded-2xl border border-zinc-800/60 p-8">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-xl font-semibold mb-2">Sound Details Unavailable</h3>
        <p className="text-zinc-400 mb-6 text-center max-w-md">{error || "This audio trend could not be located in the current workspace state."}</p>
        <button 
          onClick={() => navigate("/trending-audio")}
          className="px-5 py-2.5 bg-[#7C3AED] hover:bg-[#6D28D9] transition rounded-xl text-white font-semibold flex items-center gap-2 shadow-lg shadow-[#7C3AED]/20"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Trends
        </button>
      </div>
    );
  }

  // Cover image for details header: use real thumbnailUrl if available, or fall back to Unsplash
  const bgId = (audio.name.length * 17) % 1000;
  const coverUrl = audio.thumbnailUrl || `https://images.unsplash.com/photo-${1510000000000 + bgId}?w=300&h=300&fit=crop&q=80`;

  return (
    <div className="space-y-6">
      {/* Back navigation button */}
      <div>
        <button
          onClick={() => navigate("/trending-audio")}
          className="px-3 py-1.5 bg-zinc-900/40 border border-zinc-800/60 hover:border-zinc-700 rounded-lg text-zinc-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Trends
        </button>
      </div>

      {/* Audio Header Details Banner */}
      <div className="bg-gradient-to-r from-zinc-900/60 to-zinc-900/20 border border-zinc-800/60 rounded-2xl p-6 backdrop-blur-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl -z-10"></div>
        
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {/* Cover art image */}
            <div className="relative w-20 h-20 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden flex-shrink-0 flex items-center justify-center shadow-lg">
              <img 
                src={coverUrl} 
                alt={audio.name} 
                className="w-full h-full object-cover opacity-80"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                <Music className="h-7 w-7 text-[#A78BFA] drop-shadow" />
              </div>
            </div>

            <div>
              <span className="px-2.5 py-0.5 bg-[#7C3AED]/10 border border-[#7C3AED]/20 text-[#A78BFA] font-mono text-[10px] rounded font-bold uppercase tracking-wider">
                Trending Audio ID: {audio.id.substring(6, 14)}
              </span>
              <h1 className="text-2xl md:text-3xl font-bold font-display text-white mt-1.5 tracking-tight">{audio.name}</h1>
              <p className="text-zinc-400 font-mono text-sm mt-0.5">{audio.artist || "Unknown Artist"}</p>
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 flex items-center gap-5">
            <div className="text-center">
              <span className="text-[10px] text-zinc-500 font-mono uppercase font-bold">Velocity Rank Score</span>
              <div className="text-2xl font-black text-[#A78BFA] font-mono mt-1">{audio.trendScore.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Aggregated Mini Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 border-t border-zinc-800/60 pt-6">
          <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/60">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1 font-mono">
              <Users className="h-3.5 w-3.5 text-[#A78BFA]" /> Unique Creators
            </div>
            <div className="text-lg font-bold text-white font-mono">{audio.uniqueCreatorsCount}</div>
          </div>

          <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/60">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1 font-mono">
              <Video className="h-3.5 w-3.5 text-blue-400" /> Total Shorts Use
            </div>
            <div className="text-lg font-bold text-white font-mono">{audio.shortsCount}</div>
          </div>

          <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/60">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1 font-mono">
              <Eye className="h-3.5 w-3.5 text-emerald-400" /> Cumulative Traffic
            </div>
            <div className="text-lg font-bold text-white font-mono">{formatNumber(audio.totalViews)}</div>
          </div>

          <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/60">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1 font-mono">
              <Calendar className="h-3.5 w-3.5 text-pink-400" /> Latest Upload Date
            </div>
            <div className="text-sm font-bold text-white font-mono pt-0.5">{new Date(audio.latestUploadDate).toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      {/* Videos Section List */}
      <div>
        <div className="flex items-center justify-between mb-4.5">
          <h2 className="text-lg font-semibold text-white font-display">Viral Shorts Breakdown</h2>
          <span className="text-xs text-zinc-500 font-mono">Sorted by highest views</span>
        </div>

        {shorts.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900/40 rounded-2xl border border-zinc-800/60 text-zinc-500">
            No Shorts were grouped under this audio signature.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {shorts.map((short, index) => (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(index * 0.04, 0.4) }}
                key={short.videoId}
                className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl overflow-hidden group hover:border-[#7C3AED]/30 transition-all flex flex-col justify-between"
              >
                {/* Shorts Vertical Thumbnail */}
                <div className="relative aspect-[9/16] bg-zinc-900 overflow-hidden border-b border-zinc-900">
                  <img 
                    src={short.thumbnailUrl} 
                    alt={short.title} 
                    className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                  
                  {/* Views overlay */}
                  <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[10px] font-mono text-white flex items-center gap-1 font-bold">
                    <Eye className="h-3 w-3 text-emerald-400" />
                    <span>{short.views.toLocaleString()}</span>
                  </div>

                  {/* Creator Avatar & Handle overlay bottom left */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2">
                    <div className="p-1 bg-black/60 backdrop-blur-md rounded-lg max-w-full truncate">
                      <span className="text-[10px] font-semibold text-white font-sans">{short.creatorName}</span>
                    </div>
                  </div>

                  {/* Large Hover Play trigger */}
                  <a 
                    href={short.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-300"
                  >
                    <div className="w-11 h-11 rounded-full bg-[#7C3AED] flex items-center justify-center text-white shadow-lg shadow-[#7C3AED]/30 scale-90 group-hover:scale-100 transition-transform">
                      <Play className="h-5 w-5 fill-current ml-0.5" />
                    </div>
                  </a>
                </div>

                {/* Content info & Action Button */}
                <div className="p-4 space-y-3.5 flex-1 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-semibold text-white line-clamp-2 leading-relaxed" title={short.title}>
                      {short.title || "Untitled Short"}
                    </h4>
                    
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mt-2">
                      <div className="flex items-center gap-1">
                        <ThumbsUp className="h-3 w-3 text-[#A78BFA]" />
                        <span>{formatNumber(short.likes)} Likes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(short.publishedDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <a 
                    href={short.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full text-center py-2 bg-zinc-900 hover:bg-[#7C3AED] transition border border-zinc-800/60 hover:border-[#7C3AED]/50 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>Watch Short</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
