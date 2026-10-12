import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { 
  Settings, 
  Check, 
  AlertCircle,
  Lock,
  Shield,
  ShieldCheck,
  Calendar,
  Sparkles,
  Users,
  Plus,
  Trash2,
  FileDown,
  ToggleLeft,
  ToggleRight,
  Eye,
  RefreshCw,
  HelpCircle,
  Play,
  History,
  Terminal,
  Clock,
  Edit2,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Settings as SystemSettingsType, Creator } from "../types";

export default function Admin({ triggerNotification }: { triggerNotification: (msg: string, type: "success" | "error" | "info") => void }) {
  // Authentication states
  const [authorized, setAuthorized] = useState(() => sessionStorage.getItem("admin_authorized") === "true");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Settings state
  const [sysSettings, setSysSettings] = useState<SystemSettingsType>({ creatorLimit: 9999, periodDays: 7 });
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Creator state
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loadingCreators, setLoadingCreators] = useState(false);
  const [newId, setNewId] = useState("");
  const [newName, setNewName] = useState("");
  const [newHandle, setNewHandle] = useState("");
  const [addingCreator, setAddingCreator] = useState(false);
  const [bulkIds, setBulkIds] = useState("");
  const [importing, setImporting] = useState(false);

  // Editing Creator ID/details state
  const [editingCreator, setEditingCreator] = useState<Creator | null>(null);
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editHandle, setEditHandle] = useState("");
  const [savingCreator, setSavingCreator] = useState(false);
  
  // Deletion confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Trend Indexer Engine Status
  const [fetchInfo, setFetchInfo] = useState<any>(null);
  const [polling, setPolling] = useState(false);
  const [triggering, setTriggering] = useState(false);

  // Active Admin View Tab
  const [activeTab, setActiveTab] = useState<"creators" | "settings" | "engine">("creators");

  // Expanded Log state for Historical Diagnostics Log
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Terminal scroll reference
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const getHeaders = () => {
    const token = sessionStorage.getItem("admin_token") || "";
    return {
      headers: {
        "x-admin-token": token
      }
    };
  };

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const settingsRes = await axios.get<SystemSettingsType>("/api/settings");
      setSysSettings(settingsRes.data);
    } catch (err) {
      console.error(err);
      triggerNotification("Failed to fetch administrative configuration.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchCreators = async () => {
    setLoadingCreators(true);
    try {
      const res = await axios.get<Creator[]>("/api/creators");
      setCreators(res.data);
    } catch (err) {
      console.error(err);
      triggerNotification("Failed to fetch creator database.", "error");
    } finally {
      setLoadingCreators(false);
    }
  };

  const fetchFetchInfo = async () => {
    try {
      const res = await axios.get("/api/fetch-info");
      setFetchInfo(res.data);
      if (res.data.currentStatus === "running") {
        setPolling(true);
      } else {
        setPolling(false);
      }
    } catch (err) {
      console.error("Failed to load engine status", err);
    }
  };

  useEffect(() => {
    if (authorized) {
      fetchSettings();
      fetchCreators();
      fetchFetchInfo();
    }
  }, [authorized]);

  // Handle background status polling
  useEffect(() => {
    let interval: any;
    if (polling && authorized) {
      interval = setInterval(() => {
        fetchFetchInfo();
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [polling, authorized]);

  // Keep terminal scrolled to bottom when log updates
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [fetchInfo?.logs]);

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setAuthError("");

    const inputCleaned = password.trim().toLowerCase();
    const correctCleaned = "nikhil_dubey_iiitian".toLowerCase();
    const altCorrectCleaned = "iiit_gwalior".toLowerCase();

    setTimeout(() => {
      if (inputCleaned === "gmailgmail" || inputCleaned === correctCleaned || inputCleaned === altCorrectCleaned || inputCleaned === "nikhil") {
        setAuthorized(true);
        sessionStorage.setItem("admin_authorized", "true");
        sessionStorage.setItem("admin_token", password.trim());
        triggerNotification("Founder privileges successfully authenticated.", "success");
      } else {
        setAuthError("Invalid Security Token. Access is strictly restricted to the founder.");
        triggerNotification("Access Denied: Invalid security token.", "error");
      }
      setVerifying(false);
    }, 600);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await axios.put("/api/settings", sysSettings);
      triggerNotification("Analysis window updated successfully.", "success");
    } catch (err) {
      triggerNotification("Failed to save settings.", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleCreator = async (creator: Creator) => {
    try {
      const headers = getHeaders();
      const updatedEnabled = !creator.enabled;
      const res = await axios.put<Creator>(`/api/creators/${creator.id}`, { enabled: updatedEnabled }, headers);
      setCreators(creators.map(c => c.id === creator.id ? { ...c, enabled: res.data.enabled } : c));
      triggerNotification(`Creator ${creator.name} is now ${updatedEnabled ? "active" : "inactive"}.`, "success");
    } catch (err: any) {
      triggerNotification(err.response?.data?.error || "Failed to update creator state.", "error");
    }
  };

  const handleDeleteCreator = async (id: string) => {
    try {
      const headers = getHeaders();
      await axios.delete(`/api/creators/${id}`, headers);
      setCreators(creators.filter(c => c.id !== id));
      triggerNotification("Creator removed from analysis database.", "success");
    } catch (err: any) {
      triggerNotification(err.response?.data?.error || "Failed to remove creator.", "error");
    }
  };

  const handleAddCreator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim()) {
      triggerNotification("Channel ID is required.", "error");
      return;
    }
    setAddingCreator(true);
    try {
      const headers = getHeaders();
      const res = await axios.post<Creator>("/api/creators", {
        id: newId.trim(),
        name: newName.trim() || undefined,
        handle: newHandle.trim() || undefined
      }, headers);
      setCreators([...creators, res.data]);
      setNewId("");
      setNewName("");
      setNewHandle("");
      triggerNotification(`Creator ${res.data.name} added successfully.`, "success");
    } catch (err: any) {
      triggerNotification(err.response?.data?.error || "Failed to add creator.", "error");
    } finally {
      setAddingCreator(false);
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const idsArray = bulkIds.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
    if (idsArray.length === 0) {
      triggerNotification("Please enter at least one Channel ID.", "error");
      return;
    }
    setImporting(true);
    try {
      const headers = getHeaders();
      const res = await axios.post<{ message: string }>("/api/creators/import", { ids: idsArray }, headers);
      triggerNotification(res.data.message, "success");
      setBulkIds("");
      fetchCreators();
    } catch (err: any) {
      triggerNotification(err.response?.data?.error || "Bulk import failed.", "error");
    } finally {
      setImporting(false);
    }
  };

  // Inline editing modal triggers
  const startEditingCreator = (c: Creator) => {
    setEditingCreator(c);
    setEditId(c.id);
    setEditName(c.name);
    setEditHandle(c.handle);
  };

  const handleSaveEditedCreator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCreator) return;
    if (!editId.trim()) {
      triggerNotification("Channel ID or handle is required.", "error");
      return;
    }
    setSavingCreator(true);
    try {
      const headers = getHeaders();
      const res = await axios.put<Creator>(`/api/creators/${editingCreator.id}`, {
        newId: editId.trim(),
        name: editName.trim() || undefined,
        handle: editHandle.trim() || undefined
      }, headers);

      setCreators(creators.map(c => c.id === editingCreator.id ? res.data : c));
      setEditingCreator(null);
      triggerNotification("Creator details modified successfully.", "success");
    } catch (err: any) {
      triggerNotification(err.response?.data?.error || "Failed to modify creator.", "error");
    } finally {
      setSavingCreator(false);
    }
  };

  // Manual Trigger Trend Engine Refresh
  const handleTriggerEngine = async () => {
    setTriggering(true);
    try {
      const headers = getHeaders();
      await axios.post("/api/refresh", {}, headers);
      setPolling(true);
      triggerNotification("Trend Indexing Engine started in the background.", "success");
      fetchFetchInfo();
    } catch (err: any) {
      triggerNotification(err.response?.data?.error || "Failed to run Trend Finder Index.", "error");
    } finally {
      setTriggering(false);
    }
  };

  const handleLogout = () => {
    setAuthorized(false);
    setPassword("");
    sessionStorage.removeItem("admin_authorized");
    sessionStorage.removeItem("admin_token");
    triggerNotification("Logged out from administrative hub.", "info");
  };

  // Formatting date helper
  const formatDate = (isoStr: string | null) => {
    if (!isoStr) return "N/A";
    const date = new Date(isoStr);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  // 1. SECURITY WALL (Lock Screen)
  if (!authorized) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full space-y-6 bg-zinc-900/40 border border-zinc-800/80 rounded-3xl p-8 backdrop-blur-md relative overflow-hidden group shadow-2xl shadow-black/40"
        >
          {/* Accent Glow */}
          <div className="absolute -right-16 -top-16 w-32 h-32 bg-[#7C3AED]/5 rounded-full blur-2xl group-hover:bg-[#7C3AED]/15 transition-all duration-700"></div>

          <div className="text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-[#7C3AED]/10 border border-[#7C3AED]/20 flex items-center justify-center text-[#A78BFA]">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Founder Access Control</h2>
              <p className="text-zinc-500 text-xs mt-1">
                Enter access token to modify the backend crawling configurations.
              </p>
            </div>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div>
              <label htmlFor="token" className="block text-[10px] uppercase font-bold tracking-wider text-zinc-400 mb-1.5">
                Admin Security Token
              </label>
              <input
                id="token"
                type="password"
                required
                placeholder="••••••••••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950/80 border border-zinc-850 hover:border-zinc-800 focus:border-[#7C3AED]/50 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-[#7C3AED]/20 transition-all font-mono"
              />
            </div>

            {authError && (
              <div className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl flex items-center gap-2.5 text-xs text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={verifying}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#6D28D9] hover:to-[#7C3AED] disabled:from-zinc-800 disabled:to-zinc-800 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all duration-300 shadow-lg shadow-[#7C3AED]/10 cursor-pointer flex items-center justify-center gap-2"
            >
              {verifying ? (
                <span>Verifying Credentials...</span>
              ) : (
                <>
                  <Shield className="h-3.5 w-3.5" />
                  <span>Authenticate Access</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-zinc-800/60 flex flex-col items-center text-center space-y-1">
            <span className="text-[10px] text-zinc-500">Secured applet developed by</span>
            <span className="text-xs font-bold text-white tracking-wide">NIKHIL DUBEY</span>
            <span className="text-[9px] text-[#A78BFA] font-mono font-bold">IIIT GWALIOR</span>
          </div>
        </motion.div>
      </div>
    );
  }

  // 2. MAIN ADMIN BOARD (Authenticated)
  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/60 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7C3AED] to-[#A78BFA] flex items-center justify-center text-white shadow-lg shadow-[#7C3AED]/15">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-1.5">
              Founder Admin Hub
            </h1>
            <p className="text-zinc-500 text-xs mt-0.5">Manage analysis scope & creator databases</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="bg-zinc-950 p-1 rounded-xl border border-zinc-850 flex text-[11px] font-semibold">
            <button
              onClick={() => setActiveTab("creators")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                activeTab === "creators" ? "bg-zinc-850 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Creators List
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                activeTab === "settings" ? "bg-zinc-850 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </button>
            <button
              onClick={() => {
                setActiveTab("engine");
                fetchFetchInfo();
              }}
              className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                activeTab === "engine" ? "bg-zinc-850 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${polling ? "animate-spin text-purple-400" : ""}`} />
              Trend Engine
            </button>
          </div>

          <button 
            onClick={handleLogout}
            className="px-3.5 py-1.5 bg-zinc-900 border border-zinc-800/85 hover:border-zinc-750 rounded-lg text-[10px] font-bold text-zinc-400 hover:text-white transition cursor-pointer font-sans"
          >
            Lock Terminal
          </button>
        </div>
      </div>

      {activeTab === "settings" && (
        // --- Tab 1: System Settings ---
        loading ? (
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-6 space-y-4 animate-pulse">
            <div className="h-4 w-1/3 bg-zinc-800 rounded"></div>
            <div className="h-10 bg-zinc-800 rounded-lg"></div>
          </div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-6 space-y-6 backdrop-blur-sm"
          >
            <div>
              <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#A78BFA]" />
                Analysis Window Configuration
              </h3>
              <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                Define the historical timeline window of YouTube Shorts details analyzed in the trend index.
              </p>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div>
                <label htmlFor="periodDays" className="block text-xs font-semibold text-zinc-400 mb-2">
                  Analyzing Timeframe
                </label>
                <select
                  id="periodDays"
                  value={sysSettings.periodDays}
                  onChange={(e) => setSysSettings({ ...sysSettings, periodDays: Number(e.target.value) })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-3 text-xs text-zinc-200 focus:outline-none focus:border-[#7C3AED]/50 focus:ring-1 focus:ring-[#7C3AED]/20 cursor-pointer font-sans"
                >
                  <option value="7">Last 7 Days (Cached instant read)</option>
                  <option value="14">Last 14 Days (Cached instant read)</option>
                  <option value="21">Last 21 Days (Cached instant read)</option>
                  <option value="30">Last 30 Days (Cached instant read)</option>
                </select>
                <p className="text-[10px] text-zinc-500 mt-2 font-sans">
                  * Note: Swapping active timeframes instantly changes displayed dashboards for all active users because results are pre-computed in our caching database.
                </p>
              </div>

              <div className="border-t border-zinc-800/80 pt-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-[#A78BFA]" />
                    YouTube API Credentials & Failover
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                    Configure your primary YouTube v3 Data API key and a backup key. The backend will automatically and seamlessly failover to the backup key if the primary key's daily query quota is exhausted, ensuring continuous updates without interruption.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="youtubeApiKeyPrimary" className="block text-xs font-semibold text-zinc-400 mb-2">
                      Primary YouTube API Key (Optional Override)
                    </label>
                    <input
                      type="password"
                      id="youtubeApiKeyPrimary"
                      value={sysSettings.youtubeApiKeyPrimary || ""}
                      placeholder="Defaults to server env YOUTUBE_API_KEY"
                      onChange={(e) => setSysSettings({ ...sysSettings, youtubeApiKeyPrimary: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-[#7C3AED]/50 focus:ring-1 focus:ring-[#7C3AED]/20 font-mono"
                    />
                    <p className="text-[10px] text-zinc-600 mt-1.5">
                      Overrides the default system key. Leave blank to use the backend's .env variable.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="youtubeApiKeyBackup" className="block text-xs font-semibold text-zinc-400 mb-2">
                      Secondary Backup YouTube API Key
                    </label>
                    <input
                      type="password"
                      id="youtubeApiKeyBackup"
                      value={sysSettings.youtubeApiKeyBackup || ""}
                      placeholder="e.g. AIzaSy..."
                      onChange={(e) => setSysSettings({ ...sysSettings, youtubeApiKeyBackup: e.target.value })}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-[#7C3AED]/50 focus:ring-1 focus:ring-[#7C3AED]/20 font-mono"
                    />
                    <p className="text-[10px] text-zinc-600 mt-1.5">
                      The application automatically activates this key when the primary key returns quota exhaustion errors.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#6D28D9] hover:to-[#7C3AED] disabled:bg-zinc-800 disabled:from-zinc-800 disabled:to-zinc-800 transition-all rounded-xl text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-[#7C3AED]/10"
                >
                  <Check className="h-4 w-4" />
                  {savingSettings ? "Saving Settings..." : "Save Configuration"}
                </button>
              </div>
            </form>
          </motion.div>
        )
      )}

      {activeTab === "creators" && (
        // --- Tab 2: Creator Management ---
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left panel: list of creators */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-5 relative overflow-hidden backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-4 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Active Creators List</h3>
                  <p className="text-[10px] text-zinc-500 mt-0.5">Currently tracking {creators.length} creator channels</p>
                </div>
                
                <button 
                  onClick={fetchCreators}
                  disabled={loadingCreators}
                  className="p-1.5 bg-zinc-950 border border-zinc-850 hover:border-zinc-750 text-zinc-400 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingCreators ? "animate-spin" : ""}`} />
                </button>
              </div>

              {loadingCreators ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-14 bg-zinc-800 rounded-xl"></div>
                  ))}
                </div>
              ) : creators.length === 0 ? (
                <div className="text-center py-12">
                  <HelpCircle className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400 font-semibold">No creators registered</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">Add a creator on the right to begin tracking.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {creators.map(c => (
                    <div 
                      key={c.id} 
                      className="p-3 bg-zinc-950/60 border border-zinc-850 rounded-xl flex items-center justify-between hover:border-zinc-800 transition"
                    >
                      <div className="flex items-center gap-3">
                        <img 
                          src={c.avatarUrl} 
                          alt={c.name} 
                          className="w-9 h-9 rounded-full object-cover border border-zinc-800"
                        />
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1">
                            {c.name}
                            {!c.enabled && (
                              <span className="px-1.5 py-0.5 bg-zinc-850 text-zinc-500 rounded text-[8px] font-mono font-bold uppercase tracking-wider">
                                paused
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{c.handle}</div>
                          {c.addedDate && (
                            <div className="text-[9px] text-zinc-650 mt-0.5 font-sans">
                              Added: {new Date(c.addedDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {confirmDeleteId === c.id ? (
                          <div className="flex items-center gap-1 bg-red-950/25 border border-red-900/50 p-1 rounded-lg animate-pulse">
                            <span className="text-[10px] text-red-350 font-bold px-1 font-mono">Are you sure?</span>
                            <button
                              onClick={() => {
                                handleDeleteCreator(c.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[9px] font-bold rounded transition cursor-pointer"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[9px] font-bold rounded transition cursor-pointer"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <>
                            {/* Edit ID/Details */}
                            <button
                              onClick={() => startEditingCreator(c)}
                              title="Edit creator ID or details"
                              className="p-1.5 hover:bg-zinc-850 rounded-lg text-zinc-400 hover:text-white transition cursor-pointer"
                            >
                              <Edit2 className="h-3.5 w-3.5 text-zinc-400" />
                            </button>

                            {/* Toggle active state */}
                            <button
                              onClick={() => handleToggleCreator(c)}
                              title={c.enabled ? "Disable tracking" : "Enable tracking"}
                              className="p-1.5 hover:bg-zinc-850 rounded-lg text-zinc-400 hover:text-white transition cursor-pointer"
                            >
                              {c.enabled ? (
                                <ToggleRight className="h-5 w-5 text-emerald-400" />
                              ) : (
                                <ToggleLeft className="h-5 w-5 text-zinc-600" />
                              )}
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => setConfirmDeleteId(c.id)}
                              title="Delete creator"
                              className="p-1.5 hover:bg-red-950/40 text-zinc-500 hover:text-red-400 rounded-lg transition cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right panel: actions */}
          <div className="space-y-4">
            {/* Action 1: Add Creator */}
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-5 backdrop-blur-sm space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Add Creator Channel</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Register a YouTube channel using its URL, @handle, or Channel ID.</p>
              </div>

              <form onSubmit={handleAddCreator} className="space-y-3">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Channel ID, @Handle, or URL *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. youtube.com/@handle or UC_id..."
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#7C3AED]/50 transition-all font-mono"
                  />
                  <p className="text-[9px] text-zinc-500 mt-1">Accepts full URLs, handles like <code>@username</code>, or direct 24-character IDs starting with <code>UC</code>.</p>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Display Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="Auto-resolved if empty"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#7C3AED]/50 transition-all font-sans"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Handle (Optional)</label>
                  <input
                    type="text"
                    placeholder="Auto-resolved if empty"
                    value={newHandle}
                    onChange={(e) => setNewHandle(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#7C3AED]/50 transition-all font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={addingCreator}
                  className="w-full py-2 px-3 bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#6D28D9] hover:to-[#7C3AED] text-white text-[11px] font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {addingCreator ? "Adding Channel..." : "Register Creator"}
                </button>
              </form>
            </div>

            {/* Action 2: Bulk Import */}
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-3xl p-5 backdrop-blur-sm space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Bulk Import Channels</h3>
                <p className="text-[10px] text-zinc-500 mt-0.5">Paste comma or space-separated YouTube Channel IDs.</p>
              </div>

              <form onSubmit={handleBulkImport} className="space-y-3">
                <textarea
                  rows={4}
                  placeholder="UC_rohit_r_w_t01, UC_samriti_01, UC_kanishthasharmaa"
                  value={bulkIds}
                  onChange={(e) => setBulkIds(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#7C3AED]/50 transition-all font-mono resize-none leading-relaxed"
                />

                <button
                  type="submit"
                  disabled={importing}
                  className="w-full py-2 px-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 hover:border-zinc-750 text-zinc-300 hover:text-white text-[11px] font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <FileDown className="h-3.5 w-3.5 text-[#A78BFA]" />
                  {importing ? "Importing..." : "Bulk Import"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTab === "engine" && (
        // --- Tab 3: Trend Indexer Engine Controls & Logs ---
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Status grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl space-y-2">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Engine Status</span>
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${
                  fetchInfo?.currentStatus === "running" ? "bg-amber-400 animate-pulse" :
                  fetchInfo?.currentStatus === "success" ? "bg-emerald-400" : "bg-red-400"
                }`} />
                <span className="text-sm font-bold text-white uppercase tracking-wide">
                  {fetchInfo?.currentStatus || "IDLE"}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 leading-relaxed">
                {fetchInfo?.currentStatus === "running" ? "Actively downloading YouTube channels and analyzing soundwaves..." : "The cache has been fully refreshed and verified."}
              </p>
            </div>

            <div className="p-5 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl space-y-2">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Scheduled Timing</span>
              <div className="flex items-center gap-1.5 text-white font-bold text-sm">
                <Clock className="h-4 w-4 text-[#A78BFA]" />
                Daily 3:00 AM
              </div>
              <p className="text-[10px] text-zinc-500">
                Next Auto Run: <span className="text-zinc-300 font-semibold font-mono">{formatDate(fetchInfo?.nextScheduledFetch)}</span>
              </p>
            </div>

            <div className="p-5 bg-zinc-900/40 border border-zinc-800/60 rounded-2xl space-y-2">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Last Crawl Duration</span>
              <div className="text-white font-bold text-sm flex items-center gap-1">
                {fetchInfo?.fetchDurationSec || 0} seconds
              </div>
              <p className="text-[10px] text-zinc-500">
                Last Refresh: <span className="text-zinc-300 font-semibold font-mono">{formatDate(fetchInfo?.lastFetchTime)}</span>
              </p>
            </div>
          </div>

          {/* Trigger manual run & progress bar */}
          <div className="p-6 bg-zinc-900/40 border border-zinc-800/60 rounded-3xl relative overflow-hidden space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Play className="h-4 w-4 text-emerald-400 fill-emerald-400" />
                  Manual Trend Refresh Control
                </h3>
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                  Triggers a background query to parse raw YouTube API channels, identify trending audios, perform AI classifications, and cache findings.
                </p>
              </div>

              <button
                onClick={handleTriggerEngine}
                disabled={fetchInfo?.currentStatus === "running" || triggering}
                className="px-5 py-3 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:from-zinc-800 disabled:to-zinc-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-950/20 self-start md:self-auto"
              >
                <RefreshCw className={`h-4 w-4 ${fetchInfo?.currentStatus === "running" ? "animate-spin" : ""}`} />
                {fetchInfo?.currentStatus === "running" ? "Crawler Running..." : "Fetch Latest Data Now"}
              </button>
            </div>

            {fetchInfo?.currentStatus === "running" && (
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-semibold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-ping" />
                    Crawl progress in motion
                  </span>
                  <span className="font-mono text-[#A78BFA] font-bold">{fetchInfo?.progress || 0}%</span>
                </div>
                <div className="w-full h-2.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-850">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${fetchInfo?.progress || 0}%` }}
                    className="h-full bg-gradient-to-r from-[#7C3AED] to-emerald-400"
                    transition={{ ease: "easeOut", duration: 0.5 }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Logs terminal */}
          <div className="bg-zinc-950 border border-zinc-800/80 rounded-2xl p-4 flex flex-col space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
              <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1.5 font-mono uppercase tracking-wider">
                <Terminal className="h-4 w-4 text-emerald-500" />
                Live Engine Synchronization Logs
              </span>
              <span className="text-[9px] px-2 py-0.5 bg-zinc-900 text-zinc-500 rounded-md font-mono">
                {fetchInfo?.logs?.length || 0} entries
              </span>
            </div>

            <div className="font-mono bg-black/40 text-emerald-400/90 p-4 rounded-xl h-64 overflow-y-auto text-[11px] space-y-1.5 select-text scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
              {fetchInfo?.logs && fetchInfo.logs.length > 0 ? (
                fetchInfo.logs.map((log: string, idx: number) => (
                  <div key={idx} className="leading-relaxed hover:bg-zinc-900/30 px-1 py-0.5 rounded transition font-mono whitespace-pre-wrap">
                    {log}
                  </div>
                ))
              ) : (
                <div className="text-zinc-600 italic py-12 text-center">No logs generated. Push 'Fetch Latest Data Now' to initiate diagnostics.</div>
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>

          {/* Fetch history table */}
          <div className="p-5 bg-zinc-900/40 border border-zinc-800/60 rounded-3xl space-y-4">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-[#A78BFA]" />
              <h3 className="text-sm font-bold text-white">Historical Diagnostics Log</h3>
            </div>

            <div className="overflow-x-auto rounded-xl border border-zinc-850">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-850">
                    <th className="p-3 font-semibold">Crawl End Time</th>
                    <th className="p-3 font-semibold">Status</th>
                    <th className="p-3 font-semibold">Duration</th>
                    <th className="p-3 font-semibold text-center">Creators</th>
                    <th className="p-3 font-semibold text-center">Videos</th>
                    <th className="p-3 font-semibold text-center">Audios</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {fetchInfo?.fetchHistory && fetchInfo.fetchHistory.length > 0 ? (
                    fetchInfo.fetchHistory.map((h: any) => (
                      <React.Fragment key={h.id}>
                        <tr 
                          onClick={() => setExpandedLogId(expandedLogId === h.id ? null : h.id)}
                          className="hover:bg-zinc-900/20 text-zinc-300 cursor-pointer transition-colors"
                        >
                          <td className="p-3 font-mono text-[11px] flex items-center gap-1.5">
                            {expandedLogId === h.id ? (
                              <ChevronUp className="h-3 w-3 text-purple-400 shrink-0" />
                            ) : (
                              <ChevronDown className="h-3 w-3 text-zinc-500 shrink-0" />
                            )}
                            {formatDate(h.endTime)}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              h.status === "success" ? "bg-emerald-950/40 border border-emerald-900/30 text-emerald-400" : "bg-red-950/40 border border-red-900/30 text-red-400"
                            }`}>
                              {h.status}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-[11px]">{h.durationSec}s</td>
                          <td className="p-3 font-mono text-[11px] text-center">{h.creatorsProcessed}</td>
                          <td className="p-3 font-mono text-[11px] text-center">{h.videosProcessed}</td>
                          <td className="p-3 font-mono text-[11px] text-center">{h.trendingAudiosFound}</td>
                        </tr>
                        {expandedLogId === h.id && (
                          <tr className="bg-zinc-950/40 border-b border-zinc-850">
                            <td colSpan={6} className="p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-3 bg-zinc-900/50 rounded-xl border border-zinc-850/60 mb-3">
                                <div>
                                  <div className="text-zinc-500 text-[10px] uppercase font-bold">Videos Retrieved</div>
                                  <div className="text-sm font-semibold text-white font-mono mt-0.5">{h.videosRetrieved ?? h.videosProcessed}</div>
                                </div>
                                <div>
                                  <div className="text-zinc-500 text-[10px] uppercase font-bold">Audios Detected</div>
                                  <div className="text-sm font-semibold text-white font-mono mt-0.5">{h.audiosDetected ?? h.trendingAudiosFound}</div>
                                </div>
                                <div>
                                  <div className="text-zinc-500 text-[10px] uppercase font-bold">Duplicates Merged</div>
                                  <div className="text-sm font-semibold text-white font-mono mt-0.5">{h.duplicateAudiosMerged ?? 0}</div>
                                </div>
                                <div>
                                  <div className="text-zinc-500 text-[10px] uppercase font-bold">Validation Passed</div>
                                  <div className="text-sm font-semibold text-white mt-0.5">{h.validationPassed !== false ? "Yes" : "No"}</div>
                                </div>
                                <div>
                                  <div className="text-zinc-500 text-[10px] uppercase font-bold">Successful Requests</div>
                                  <div className="text-sm font-semibold text-emerald-400 font-mono mt-0.5">{h.successfulRequestsCount ?? 0}</div>
                                </div>
                                <div>
                                  <div className="text-zinc-500 text-[10px] uppercase font-bold">Failed Requests</div>
                                  <div className="text-sm font-semibold text-red-400 font-mono mt-0.5">{h.failedRequestsCount ?? 0}</div>
                                </div>
                                <div>
                                  <div className="text-zinc-500 text-[10px] uppercase font-bold">Database Updated</div>
                                  <div className="text-sm font-semibold text-white mt-0.5">{h.databaseUpdated !== false ? "Yes" : "No"}</div>
                                </div>
                                <div>
                                  <div className="text-zinc-500 text-[10px] uppercase font-bold font-sans">Crawl Start Time</div>
                                  <div className="text-[11px] font-mono text-zinc-300 mt-1">{h.startTime ? new Date(h.startTime).toLocaleTimeString() : "N/A"}</div>
                                </div>
                              </div>

                              {h.detailedErrors && h.detailedErrors.length > 0 && (
                                <div className="space-y-2 mt-3">
                                  <div className="text-red-400 text-[10px] uppercase font-bold flex items-center gap-1 font-sans">
                                    <AlertCircle className="h-3 w-3 shrink-0" />
                                    Detailed API Failures & Errors ({h.detailedErrors.length})
                                  </div>
                                  <div className="overflow-hidden rounded-lg border border-red-950/40 divide-y divide-red-950/20 bg-red-950/5 p-2">
                                    {h.detailedErrors.map((errDetail: any, idx: number) => (
                                      <div key={idx} className="p-2 text-[11px] text-zinc-300">
                                        <div className="flex justify-between font-medium text-white mb-1">
                                          <span>{errDetail.creatorName} ({errDetail.endpoint})</span>
                                          <span className="text-red-400 uppercase text-[9px] font-bold bg-red-950/50 px-1.5 py-0.5 rounded border border-red-900/30">
                                            Attempt {errDetail.retryCount}/3 - {errDetail.finalStatus}
                                          </span>
                                        </div>
                                        <div className="font-mono text-red-300 bg-red-950/25 p-1 rounded mt-1 border border-red-900/10">
                                          {errDetail.errorMessage}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-zinc-500 italic">No diagnostic logs found. Run a manual fetch refresh to save history.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}

      {/* Edit Creator Details Dialog Modal */}
      <AnimatePresence>
        {editingCreator && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden"
            >
              {/* Decorative Accent */}
              <div className="absolute -right-16 -top-16 w-32 h-32 bg-[#7C3AED]/5 rounded-full blur-2xl"></div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-base font-bold text-white">Modify Creator Credentials</h3>
                  <p className="text-zinc-500 text-[10px] mt-0.5">Manage details and rewrite Channel ID permanently in our cache.</p>
                </div>

                <form onSubmit={handleSaveEditedCreator} className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">YouTube Channel ID / Handle *</label>
                    <input
                      type="text"
                      required
                      value={editId}
                      onChange={(e) => setEditId(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#7C3AED]/50 transition-all font-mono"
                    />
                    <p className="text-[9px] text-zinc-500 mt-1">Changing the ID will recalculate tracking associations for this channel.</p>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Display Name</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 rounded-xl px-3 py-2 text-xs text-white transition-all font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-wider mb-1">Display Handle</label>
                    <input
                      type="text"
                      required
                      value={editHandle}
                      onChange={(e) => setEditHandle(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 rounded-xl px-3 py-2 text-xs text-white transition-all font-mono"
                    />
                  </div>

                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setEditingCreator(null)}
                      className="px-4 py-2 hover:bg-zinc-850 rounded-xl text-[11px] font-bold text-zinc-400 hover:text-white transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingCreator}
                      className="px-4 py-2 bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] hover:from-[#6D28D9] hover:to-[#7C3AED] disabled:bg-zinc-800 text-white text-[11px] font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5"
                    >
                      {savingCreator ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Brand Footer */}
      <div className="text-center space-y-1">
        <div className="flex items-center justify-center gap-1 text-[10px] font-mono text-zinc-600">
          <span>Configured & Secured by</span>
          <span className="font-semibold text-zinc-500">NIKHIL DUBEY</span>
          <Sparkles className="h-3 w-3 text-[#A78BFA] animate-pulse" />
        </div>
      </div>
    </div>
  );
}
