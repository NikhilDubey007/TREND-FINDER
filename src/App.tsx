import React, { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Link, useLocation } from "react-router-dom";
import { 
  TrendingUp, 
  Users, 
  Video, 
  Music, 
  Settings, 
  Grid, 
  Sparkles, 
  LogOut, 
  Menu, 
  X,
  Bell,
  Heart,
  Instagram,
  Youtube,
  Award
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Import pages
import Dashboard from "./pages/Dashboard";
import TrendingAudio from "./pages/TrendingAudio";
import AudioDetails from "./pages/AudioDetails";
import TrendingVideos from "./pages/TrendingVideos";
import Admin from "./pages/Admin";

interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

function NavigationLayout() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const triggerNotification = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto remove after 4 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const navItems = [
    { name: "Dashboard", path: "/", icon: Grid },
    { name: "Trending Audios", path: "/trending-audio", icon: Music },
    { name: "Trending Videos", path: "/trending-videos", icon: Video },
    { name: "Admin Panel", path: "/admin", icon: Settings }
  ];

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-zinc-100 flex flex-col md:flex-row antialiased select-none font-sans">
      
      {/* Toast Overlay */}
      <div className="fixed top-5 right-5 z-[9999] space-y-3 pointer-events-none max-w-sm w-full">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className={`p-4 rounded-xl border shadow-xl backdrop-blur-md flex items-center gap-3 pointer-events-auto ${
                toast.type === "success" 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                  : toast.type === "error"
                  ? "bg-red-500/10 border-red-500/20 text-red-300"
                  : "bg-[#7C3AED]/10 border-[#7C3AED]/20 text-[#A78BFA]"
              }`}
            >
              <div className="flex-1 text-xs font-semibold">{toast.message}</div>
              <button 
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded transition cursor-pointer"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* MOBILE HEADER BAR */}
      <div className="md:hidden bg-[#0E0E10] border-b border-zinc-800/60 px-4 py-3 flex items-center justify-between z-40 sticky top-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#7C3AED] flex items-center justify-center text-white font-extrabold shadow-md shadow-[#7C3AED]/20">
            <TrendingUp className="h-4.5 w-4.5" />
          </div>
          <span className="font-display font-black tracking-tight text-white text-base">Trend<span className="text-[#7C3AED]">Finder</span></span>
        </div>
        
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white cursor-pointer"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* MOBILE NAVIGATION DRAWER */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="md:hidden fixed top-[57px] left-0 right-0 bg-[#0E0E10] border-b border-zinc-850 p-5 space-y-4 z-30 shadow-2xl backdrop-blur-md"
          >
            <div className="space-y-2">
              {navItems.map((item) => {
                const isActive = item.path === "/" 
                  ? location.pathname === "/" 
                  : location.pathname.startsWith(item.path);
                
                return (
                  <Link
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3.5 px-4 py-3 rounded-xl border text-sm font-semibold transition-all ${
                      isActive 
                        ? "bg-[#7C3AED]/10 border-[#7C3AED]/20 text-[#A78BFA]" 
                        : "bg-transparent border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                    }`}
                  >
                    <item.icon className={`h-4.5 w-4.5 ${isActive ? "text-[#A78BFA]" : "text-zinc-500"}`} />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Mobile Founder Profile */}
            <div className="pt-4 border-t border-zinc-800/60 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-[#A78BFA] bg-[#7C3AED]/10 px-1.5 py-0.5 rounded">Founder</span>
                  <span className="text-xs font-bold text-white">NIKHIL DUBEY</span>
                </div>
                <div className="flex flex-col mt-0.5">
                  <span className="text-[9px] text-zinc-400 font-semibold leading-tight">IIIT GWALIOR</span>
                  <span className="text-[9px] text-zinc-500 font-mono leading-tight">nikhil_dubey_iiitian</span>
                </div>
              </div>
              <div className="flex gap-2">
                <a 
                  href="https://instagram.com/nikhil_dubey_iiitian" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="p-1.5 bg-zinc-900 border border-zinc-800/60 hover:bg-pink-600/10 hover:text-pink-400 text-zinc-400 rounded-lg transition-all"
                  title="Instagram"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a 
                  href="https://youtube.com/@nikhil_dubey_iiitian" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="p-1.5 bg-zinc-900 border border-zinc-800/60 hover:bg-red-600/10 hover:text-red-400 text-zinc-400 rounded-lg transition-all"
                  title="YouTube"
                >
                  <Youtube className="h-4 w-4" />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col justify-between w-64 bg-[#0E0E10] border-r border-zinc-800/60 px-5.5 py-6 flex-shrink-0">
        <div className="space-y-8">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#7C3AED] flex items-center justify-center text-white font-extrabold shadow-lg shadow-[#7C3AED]/20 relative overflow-hidden group">
              <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <TrendingUp className="h-5.5 w-5.5" />
            </div>
            <div>
              <h1 className="font-display font-black tracking-tight text-white text-lg">Trend<span className="text-[#7C3AED]">Finder</span></h1>
              <p className="text-[10px] text-zinc-500 font-mono font-bold uppercase tracking-wider">Creators Intel</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const isActive = item.path === "/" 
                ? location.pathname === "/" 
                : location.pathname.startsWith(item.path);

              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all relative group ${
                    isActive 
                      ? "bg-[#7C3AED]/10 border-[#7C3AED]/20 text-[#A78BFA] font-extrabold shadow-sm" 
                      : "bg-transparent border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-white"
                  }`}
                >
                  <item.icon className={`h-4 w-4 transition-colors ${isActive ? "text-[#A78BFA]" : "text-zinc-500 group-hover:text-zinc-300"}`} />
                  <span>{item.name}</span>
                  
                  {isActive && (
                    <span className="absolute right-3 w-1.5 h-1.5 rounded-full bg-[#A78BFA] animate-pulse"></span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Brand Info */}
        <div className="space-y-3">
          {/* Founder Card */}
          <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/60 relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 w-12 h-12 bg-[#7C3AED]/10 rounded-full blur-xl group-hover:bg-[#7C3AED]/20 transition-all duration-500"></div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded bg-[#7C3AED]/10 border border-[#7C3AED]/20 flex items-center justify-center text-[#A78BFA]">
                <Award className="h-3.5 w-3.5" />
              </div>
              <span className="text-[9px] uppercase font-bold tracking-wider text-zinc-400">Founder Profile</span>
            </div>
            <div className="text-sm font-bold text-white tracking-wide">NIKHIL DUBEY</div>
            <div className="flex flex-col mt-1 space-y-0.5">
              <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-wider">IIIT GWALIOR</span>
              <span className="text-[9px] text-zinc-500 font-mono">nikhil_dubey_iiitian</span>
            </div>
            
            <div className="flex gap-2 mt-3 pt-2.5 border-t border-zinc-800/50">
              <a 
                href="https://instagram.com/nikhil_dubey_iiitian" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex-1 py-1 px-1 bg-zinc-950/60 hover:bg-pink-600/10 hover:text-pink-400 text-zinc-400 rounded-lg text-[9px] font-mono font-bold flex items-center justify-center gap-1 transition-all border border-zinc-800/60 hover:border-pink-500/20"
              >
                <Instagram className="h-3 w-3" />
                <span>Instagram</span>
              </a>
              <a 
                href="https://youtube.com/@nikhil_dubey_iiitian" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="flex-1 py-1 px-1 bg-zinc-950/60 hover:bg-red-600/10 hover:text-red-400 text-zinc-400 rounded-lg text-[9px] font-mono font-bold flex items-center justify-center gap-1 transition-all border border-zinc-800/60 hover:border-red-500/20"
              >
                <Youtube className="h-3 w-3" />
                <span>YouTube</span>
              </a>
            </div>
          </div>

          <div className="bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">System Health</span>
              <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-full font-bold">Active</span>
            </div>
            <div className="w-full bg-zinc-800 h-1 rounded-full">
              <div className="bg-[#7C3AED] h-1 rounded-full" style={{ width: "72%" }}></div>
            </div>
          </div>

          <div className="border-t border-zinc-800/60 pt-4 space-y-2 text-center">
            <div className="flex items-center justify-center gap-1.5 text-[10px] font-mono text-zinc-500">
              <span>Powered by Gemini AI</span>
              <Sparkles className="h-3 w-3 text-[#A78BFA] animate-pulse" />
            </div>
            <div className="text-[9px] text-zinc-600 font-mono">
              &copy; {currentYear} Trend Finder.
            </div>
          </div>
        </div>
      </aside>

      {/* PRIMARY CONTENT PANEL */}
      <main className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-7xl mx-auto w-full">
        <Routes>
          <Route path="/" element={<Dashboard triggerNotification={triggerNotification} />} />
          <Route path="/trending-audio" element={<TrendingAudio />} />
          <Route path="/audio/:audioId" element={<AudioDetails />} />
          <Route path="/trending-videos" element={<TrendingVideos />} />
          <Route path="/admin" element={<Admin triggerNotification={triggerNotification} />} />
        </Routes>
      </main>

    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <NavigationLayout />
    </HashRouter>
  );
}
