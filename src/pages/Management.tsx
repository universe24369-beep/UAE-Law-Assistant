import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs, setDoc, deleteDoc, doc, query, orderBy, onSnapshot, where } from "firebase/firestore";
import { Users, UserPlus, Trash2, ShieldCheck, Mail, Calendar, Loader2, LifeBuoy, MessageSquare, Clock, ArrowRight, ExternalLink, Activity, BarChart3, TrendingUp, Zap, Search, BellRing, CheckCircle2, FileText } from "lucide-react";
import { motion, AnimatePresence } from "../lib/motion-shim";
import { cn } from "../lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Cell, PieChart, Pie } from "recharts";
import { format, subDays, startOfDay } from "date-fns";

import { useLanguage } from "../contexts/LanguageContext";
import { useUser } from "../contexts/UserContext";
import { getLocalUsageStats } from "../lib/usage";
import {
  acknowledgeSupportIncident,
  fetchSupportIncidentsFromFirestore,
  getLocalSupportIncidents,
  SupportIncidentRecord,
} from "../lib/supportMcp";

interface AuthorizedLawyer {
  email: string;
  addedAt: string;
}

interface SupportSession {
  id: string;
  userId: string;
  userEmail: string;
  userRole: "client" | "lawyer";
  messages: any[];
  status: "active" | "resolved";
  updatedAt: any;
}

interface UsageStat {
  id: string;
  type: string;
  status: string;
  tokens: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string | null;
  utilizationPct?: number | null;
  usageStage?: string | null;
  userId: string;
  timestamp: any;
}

export default function Management() {
  const { user, isSuperAdmin } = useUser();
  const { t, isRtl } = useLanguage();
  
  const [activeTab, setActiveTab] = useState<"lawyers" | "support" | "system">("lawyers");
  const [lawyers, setLawyers] = useState<AuthorizedLawyer[]>([]);
  const [supportSessions, setSupportSessions] = useState<SupportSession[]>([]);
  const [supportIncidents, setSupportIncidents] = useState<SupportIncidentRecord[]>([]);
  const [usageStats, setUsageStats] = useState<UsageStat[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingSession, setViewingSession] = useState<SupportSession | null>(null);
  const [viewingIncident, setViewingIncident] = useState<SupportIncidentRecord | null>(null);

  const openRouterStats = usageStats.filter((stat) => stat.type === "openrouter_query");
  const totalOpenRouterTokens = openRouterStats.reduce((sum, stat) => sum + (stat.totalTokens ?? stat.tokens ?? 0), 0);
  const totalOpenRouterRequests = openRouterStats.length;
  const tokenLimit = Number(import.meta.env.VITE_OPENROUTER_TOKEN_LIMIT || 1000000);
  const warningThresholdPct = Number(import.meta.env.VITE_OPENROUTER_WARNING_PCT || 90);
  const tokenUtilizationPct = tokenLimit > 0 ? (totalOpenRouterTokens / tokenLimit) * 100 : 0;
  const isNearLimit = tokenUtilizationPct >= warningThresholdPct;
  const isOverLimit = tokenUtilizationPct >= 100;
  const averageTokens = totalOpenRouterRequests > 0 ? Math.round(totalOpenRouterTokens / totalOpenRouterRequests) : 0;
  const modelCounts = openRouterStats.reduce<Record<string, number>>((acc, stat) => {
    const model = stat.model || "unknown";
    acc[model] = (acc[model] || 0) + 1;
    return acc;
  }, {});

  const formatIncidentStatus = (status: SupportIncidentRecord["status"]) => {
    if (status === "needs_screenshot") return "open";
    return status.replace("_", " ");
  };

  const getIncidentStatusTone = (status: SupportIncidentRecord["status"]) => {
    if (status === "resolved") return "bg-prestige-100 text-prestige-500 border-prestige-200";
    if (status === "triaged") return "bg-accent-indigo/10 text-accent-indigo border-accent-indigo/15";
    return "bg-emerald-50 text-emerald-600 border-emerald-100";
  };

  useEffect(() => {
    if (isSuperAdmin) {
      if (activeTab === "lawyers") {
        fetchLawyers();
      } else if (activeTab === "support") {
        fetchSupportSessions();
        fetchSupportIncidents();
      } else if (activeTab === "system") {
        fetchUsageStats();
      }
    }
  }, [isSuperAdmin, activeTab]);

  const fetchUsageStats = async () => {
    setIsLoading(true);
    try {
      const sevenDaysAgo = subDays(new Date(), 30); // Get last 30 days
      const q = query(
        collection(db, "usage_stats"), 
        where("timestamp", ">=", sevenDaysAgo),
        orderBy("timestamp", "desc")
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as UsageStat[];
      const localStats = getLocalUsageStats();
      const merged = [...list, ...localStats].reduce<UsageStat[]>((acc, entry) => {
        if (!acc.some(item => item.id === entry.id)) {
          acc.push(entry);
        }
        return acc;
      }, []);
      setUsageStats(merged);
    } catch (err) {
      console.error("Error fetching usage stats:", err);
      const localStats = getLocalUsageStats();
      setUsageStats(localStats);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLawyers = async () => {
    setIsLoading(true);
    try {
      const q = query(collection(db, "authorized_lawyers"), orderBy("addedAt", "desc"));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({
        email: doc.id,
        ...doc.data()
      })) as AuthorizedLawyer[];
      setLawyers(list);
    } catch (err) {
      console.error("Error fetching lawyers:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSupportSessions = () => {
    setIsLoading(true);
    const q = query(collection(db, "support_sessions"), orderBy("updatedAt", "desc"));
    
    return onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SupportSession[];
      setSupportSessions(list);
      setIsLoading(false);
    });
  };

  const fetchSupportIncidents = async () => {
    try {
      const incidents = await fetchSupportIncidentsFromFirestore();
      const localIncidents = getLocalSupportIncidents();
      const merged = [...incidents, ...localIncidents].reduce<SupportIncidentRecord[]>((acc, incident) => {
        if (!acc.some((item) => item.id === incident.id)) {
          acc.push(incident);
        }
        return acc;
      }, []);
      setSupportIncidents(merged);
    } catch (err) {
      console.error("Error fetching support incidents:", err);
      setSupportIncidents(getLocalSupportIncidents());
      setIsLoading(false);
    }
  };

  const handleAcknowledgeIncident = async (incidentId: string) => {
    try {
      await acknowledgeSupportIncident(incidentId);
      await fetchSupportIncidents();
    } catch (err) {
      console.error("Error acknowledging support incident:", err);
    }
  };

  const handleAddLawyer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await setDoc(doc(db, "authorized_lawyers", newEmail.toLowerCase().trim()), {
        email: newEmail.toLowerCase().trim(),
        addedAt: new Date().toISOString(),
        addedBy: user?.uid
      });
      setNewEmail("");
      fetchLawyers();
    } catch (err) {
      console.error("Error adding lawyer:", err);
      alert("Failed to add lawyer. Check permissions.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveLawyer = async (email: string) => {
    if (!window.confirm(`Are you sure you want to remove ${email}?`)) return;
    
    try {
      await deleteDoc(doc(db, "authorized_lawyers", email));
      fetchLawyers();
    } catch (err) {
      console.error("Error removing lawyer:", err);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-4">
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center">
          <Trash2 className="w-8 h-8 text-rose-500" />
        </div>
        <h1 className="text-2xl font-black text-prestige-950 uppercase tracking-tight">Access Denied</h1>
        <p className="max-w-md text-prestige-500">This panel is restricted to the Super Admin account.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-prestige-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent-indigo/10 rounded-full border border-accent-indigo/20">
                <ShieldCheck className="w-3.5 h-3.5 text-accent-indigo" />
                <span className="text-[10px] font-black text-accent-indigo uppercase tracking-widest leading-none">{t("adminConsole") || "Super Admin Console"}</span>
              </div>
              <h1 className="text-4xl font-black text-prestige-950 tracking-tighter">{t("management")}</h1>
              <p className="text-prestige-500 font-medium tracking-tight">{t("managementDesc") || "Monitor platform activity and manage users."}</p>
            </div>

            <div className="flex p-1 bg-white rounded-2xl border border-prestige-200 w-fit">
              <button
                onClick={() => setActiveTab("lawyers")}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                  activeTab === "lawyers" ? "bg-prestige-950 text-white shadow-lg" : "text-prestige-400 hover:text-prestige-600"
                )}
              >
                {t("lawyers") || "Lawyers"}
              </button>
              <button
                onClick={() => setActiveTab("support")}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                  activeTab === "support" ? "bg-prestige-950 text-white shadow-lg" : "text-prestige-400 hover:text-prestige-600"
                )}
              >
                {t("tickets")}
              </button>
              <button
                onClick={() => setActiveTab("system")}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all",
                  activeTab === "system" ? "bg-prestige-950 text-white shadow-lg" : "text-prestige-400 hover:text-prestige-600"
                )}
              >
                {t("system")}
              </button>
            </div>
          </div>

          {activeTab === "lawyers" && (
            <form onSubmit={handleAddLawyer} className="flex gap-2 bg-white p-2 rounded-2xl border border-prestige-200 shadow-sm md:w-96">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-prestige-400" />
                <input 
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder={t("newLawyerEmail") || "New Lawyer Email"}
                  className="w-full pl-10 pr-4 py-3 bg-transparent text-sm font-bold outline-none placeholder:text-prestige-300"
                  required
                />
              </div>
              <button 
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-3 bg-accent-indigo text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-prestige-950 transition-all flex items-center gap-2 shadow-lg shadow-accent-indigo/20 disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                {t("authorize") || "Authorize"}
              </button>
            </form>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6">
          {activeTab === "lawyers" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                Array(6).fill(0).map((_, i) => (
                  <div key={i} className="h-32 bg-prestige-200/50 rounded-3xl animate-pulse" />
                ))
              ) : lawyers.length === 0 ? (
                <div className="col-span-full py-12 text-center bg-white rounded-3xl border-2 border-dashed border-prestige-200 space-y-4">
                  <Users className="w-12 h-12 text-prestige-200 mx-auto" />
                  <p className="text-sm font-bold text-prestige-400">{t("noLawyersFound")}</p>
                </div>
              ) : (
                lawyers.map((lawyer) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={lawyer.email}
                    className="bg-white p-6 rounded-3xl border border-prestige-100 shadow-sm hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="w-12 h-12 bg-prestige-50 rounded-xl flex items-center justify-center text-prestige-400 group-hover:bg-accent-indigo/10 group-hover:text-accent-indigo transition-colors">
                        <Mail className="w-6 h-6" />
                      </div>
                      <button 
                        onClick={() => handleRemoveLawyer(lawyer.email)}
                        className="p-2 text-prestige-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-4 space-y-1">
                      <p className="text-sm font-black text-prestige-950 truncate">{lawyer.email}</p>
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-prestige-400 uppercase tracking-widest">
                        <Calendar className="w-3 h-3" />
                        {t("addedOn") || "Added"}: {new Date(lawyer.addedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          ) : activeTab === "support" ? (
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-[2rem] border border-prestige-100 shadow-sm">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                        <BellRing className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-prestige-950 tracking-tight">Support MCP Bug Queue</h3>
                        <p className="text-[10px] font-bold text-prestige-400 uppercase tracking-widest">Admin notifications with test scenarios</p>
                      </div>
                    </div>
                    <p className="text-sm font-medium text-prestige-500 leading-relaxed max-w-3xl">
                      Only bug reports land here. Each incident includes the route, a short summary, test scenarios, and a clear note that nothing gets published until manual confirmation happens in chat.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:min-w-[360px]">
                    <div className="p-4 rounded-2xl bg-prestige-50 border border-prestige-100">
                      <p className="text-[10px] font-black uppercase tracking-widest text-prestige-400 mb-2">Open Incidents</p>
                      <p className="text-2xl font-black text-prestige-950">{supportIncidents.filter((incident) => incident.status !== "resolved").length}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-prestige-50 border border-prestige-100">
                      <p className="text-[10px] font-black uppercase tracking-widest text-prestige-400 mb-2">With Screenshot</p>
                      <p className="text-2xl font-black text-prestige-950">{supportIncidents.filter((incident) => Boolean(incident.screenshot)).length}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-prestige-50 border border-prestige-100">
                      <p className="text-[10px] font-black uppercase tracking-widest text-prestige-400 mb-2">Awaiting Chat Gate</p>
                      <p className="text-2xl font-black text-prestige-950">{supportIncidents.filter((incident) => incident.manualConfirmationRequired).length}</p>
                    </div>
                  </div>
                </div>
              </div>

            <div className="space-y-4">
              {supportIncidents.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-prestige-950 uppercase tracking-widest">Bug notifications</h4>
                    <span className="text-[10px] font-bold text-prestige-400 uppercase tracking-widest">Manual confirmation required in chat</span>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {supportIncidents.map((incident) => (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={incident.id}
                        className="bg-white p-6 rounded-3xl border border-prestige-100 shadow-sm flex flex-col gap-5"
                      >
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                          <div className="space-y-3 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                incident.severity === "high" ? "bg-rose-50 text-rose-600 border-rose-100" : incident.severity === "medium" ? "bg-amber-50 text-amber-600 border-amber-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                              )}>
                                {incident.severity} severity
                              </div>
                              <div className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border",
                                getIncidentStatusTone(incident.status)
                              )}>
                                {formatIncidentStatus(incident.status)}
                              </div>
                              <div className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-white text-prestige-400 border-prestige-100">
                                {incident.category}
                              </div>
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-lg font-black text-prestige-950 tracking-tight">{incident.title}</h4>
                              <p className="text-xs font-bold text-prestige-400 uppercase tracking-widest">
                                {incident.userEmail || incident.userId} • {incident.route} • {incident.pageTitle}
                              </p>
                            </div>
                            <p className="text-sm text-prestige-600 leading-relaxed">{incident.summary}</p>
                            <div className="rounded-2xl bg-prestige-50 border border-prestige-100 p-4 space-y-3">
                              <p className="text-[10px] font-black uppercase tracking-widest text-prestige-400">Test scenarios</p>
                              <div className="flex flex-col gap-2">
                                {incident.testScenarios.map((scenario, index) => (
                                  <div key={index} className="flex items-start gap-2 text-sm text-prestige-700 font-medium">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                    <span>{scenario}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-prestige-400">
                              Publication gate: manual confirmation required in chat before any fix is published.
                            </div>
                            {incident.screenshot ? (
                              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">
                                Screenshot attached upfront for faster triage.
                              </div>
                            ) : (
                              <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600">
                                No screenshot attached yet. Ask for one if the issue is visual or hard to reproduce.
                              </div>
                            )}
                          </div>
                          <div className="flex md:flex-col gap-2">
                            <button
                              onClick={() => setViewingIncident(incident)}
                              className="px-4 py-3 bg-prestige-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-prestige-950/20"
                            >
                              View details
                              <ArrowRight className="w-3 h-3" />
                            </button>
                            {incident.status !== "resolved" && (
                              <button
                                onClick={() => handleAcknowledgeIncident(incident.id)}
                                className="px-4 py-3 bg-prestige-50 text-prestige-700 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-prestige-100 hover:border-accent-indigo/20 hover:text-accent-indigo transition-all"
                              >
                                Mark triaged
                              </button>
                            )}
                          </div>
                        </div>
                        {incident.screenshot?.previewDataUrl && (
                          <div className="rounded-2xl overflow-hidden border border-prestige-100 bg-prestige-50">
                            <img src={incident.screenshot.previewDataUrl} alt={incident.screenshot.fileName} className="w-full max-h-64 object-contain" />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {isLoading ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="h-40 bg-prestige-200/50 rounded-3xl animate-pulse" />
                ))
              ) : supportSessions.length === 0 ? (
                <div className="py-12 text-center bg-white rounded-3xl border-2 border-dashed border-prestige-200 space-y-4">
                  <LifeBuoy className="w-12 h-12 text-prestige-200 mx-auto" />
                  <p className="text-sm font-bold text-prestige-400">{t("noTickets")}</p>
                </div>
              ) : (
                supportSessions.map((session) => (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={session.id}
                    className="bg-white p-6 rounded-3xl border border-prestige-100 shadow-sm flex flex-col md:flex-row md:items-center gap-6"
                  >
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center text-white",
                            session.userRole === "lawyer" ? "bg-accent-indigo" : "bg-prestige-950"
                          )}>
                            {session.userRole === "lawyer" ? <ShieldCheck className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                          </div>
                          <div>
                            <p className="text-sm font-black text-prestige-950 tracking-tight">{session.userEmail}</p>
                            <p className="text-[10px] font-bold text-prestige-400 uppercase tracking-widest">
                              {session.userRole === "lawyer" ? t("lawyer") : t("client")} {t("support")} • {session.messages.length} {t("messagesExchanged")}
                            </p>
                          </div>
                        </div>
                        <div className={cn(
                          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                          session.status === "active" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-prestige-100 text-prestige-400"
                        )}>
                          {session.status === "active" ? t("active") : t("resolved")}
                        </div>
                      </div>
                      
                      <div className="bg-prestige-50 p-4 rounded-2xl border border-prestige-100">
                        <p className="text-xs font-bold text-prestige-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Clock className="w-3 h-3" />
                          {t("latestMessage")}:
                        </p>
                        <p className="text-sm font-medium text-prestige-700 italic">
                          "{session.messages[session.messages.length - 1]?.content.substring(0, 120)}..."
                        </p>
                      </div>
                    </div>

                    <div className="flex md:flex-col gap-2">
                      <button 
                        onClick={() => setViewingSession(session)}
                        className="flex-1 md:w-32 px-4 py-3 bg-prestige-950 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-prestige-950/20"
                      >
                        {t("viewTranscript")}
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}

              {viewingSession && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 md:p-12">
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setViewingSession(null)}
                    className="absolute inset-0 bg-prestige-950/60 backdrop-blur-sm"
                  />
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative w-full max-w-4xl max-h-[80vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
                  >
                    <div className="p-6 border-b border-prestige-100 flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-black text-prestige-950 tracking-tight">{t("viewTranscript")}</h2>
                        <p className="text-[10px] font-bold text-prestige-400 uppercase tracking-widest">{viewingSession.userEmail} • {viewingSession.userRole}</p>
                      </div>
                      <button 
                        onClick={() => setViewingSession(null)}
                        className="p-2 hover:bg-prestige-50 rounded-xl transition-colors text-prestige-400"
                      >
                        {t("close") || "Close"}
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-prestige-50">
                      {viewingSession.messages.map((m, i) => (
                        <div key={i} className={cn(
                          "flex flex-col gap-1 max-w-[80%]",
                          m.role === "user" ? "ml-auto items-end" : "items-start"
                        )}>
                          <span className="text-[10px] font-black uppercase tracking-widest text-prestige-400">
                            {m.role === "user" ? t("user") || "User" : t("aiAssistant") || "Copilot"}
                          </span>
                          <div className={cn(
                            "p-4 rounded-2xl text-sm font-medium",
                            m.role === "user" 
                              ? (viewingSession.userRole === "lawyer" ? "bg-accent-indigo text-white" : "bg-prestige-950 text-white")
                              : "bg-white border border-prestige-100 text-prestige-700"
                          )}>
                            {m.content}
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              )}
              {viewingIncident && (
                <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 md:p-12">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => setViewingIncident(null)}
                    className="absolute inset-0 bg-prestige-950/60 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative w-full max-w-4xl max-h-[80vh] bg-white rounded-3xl shadow-2xl flex flex-col overflow-hidden"
                  >
                    <div className="p-6 border-b border-prestige-100 flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <h2 className="text-xl font-black text-prestige-950 tracking-tight">Incident details</h2>
                        <p className="text-[10px] font-bold text-prestige-400 uppercase tracking-widest">{viewingIncident.userEmail || viewingIncident.userId} • {viewingIncident.route}</p>
                      </div>
                      <button
                        onClick={() => setViewingIncident(null)}
                        className="p-2 hover:bg-prestige-50 rounded-xl transition-colors text-prestige-400"
                      >
                        {t("close") || "Close"}
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-prestige-50">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-white rounded-2xl border border-prestige-100">
                          <p className="text-[10px] font-black uppercase tracking-widest text-prestige-400 mb-1">Severity</p>
                          <p className="text-sm font-black text-prestige-950 capitalize">{viewingIncident.severity}</p>
                        </div>
                        <div className="p-4 bg-white rounded-2xl border border-prestige-100">
                          <p className="text-[10px] font-black uppercase tracking-widest text-prestige-400 mb-1">Status</p>
                          <p className="text-sm font-black text-prestige-950 capitalize">{formatIncidentStatus(viewingIncident.status)}</p>
                        </div>
                        <div className="p-4 bg-white rounded-2xl border border-prestige-100">
                          <p className="text-[10px] font-black uppercase tracking-widest text-prestige-400 mb-1">Gate</p>
                          <p className="text-sm font-black text-prestige-950">Manual chat confirmation</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-prestige-400">Reported issue</p>
                        <div className="p-4 bg-white border border-prestige-100 rounded-2xl text-sm text-prestige-700 leading-relaxed">
                          {viewingIncident.summary}
                        </div>
                      </div>
                      {viewingIncident.screenshot?.previewDataUrl && (
                        <div className="space-y-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-prestige-400">Screenshot</p>
                          <div className="rounded-2xl overflow-hidden border border-prestige-100 bg-white">
                            <img src={viewingIncident.screenshot.previewDataUrl} alt={viewingIncident.screenshot.fileName} className="w-full max-h-[420px] object-contain" />
                          </div>
                        </div>
                      )}
                      <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase tracking-widest text-prestige-400">Test scenarios</p>
                        <div className="space-y-2">
                          {viewingIncident.testScenarios.map((scenario, index) => (
                            <div key={index} className="flex items-start gap-2 text-sm text-prestige-700 font-medium bg-white border border-prestige-100 rounded-2xl p-4">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                              <span>{scenario}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              )}
            </div>
            </div>
          ) : (
            <div className="space-y-12">
               <div className={cn(
                 "bg-white p-8 rounded-[2.5rem] border shadow-xl shadow-prestige-900/5",
                 isOverLimit ? "border-rose-200" : isNearLimit ? "border-amber-200" : "border-prestige-100"
               )}>
                 <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8">
                   <div className="space-y-4 flex-1">
                     <div className="flex items-center gap-3">
                       <div className={cn(
                         "w-11 h-11 rounded-2xl flex items-center justify-center",
                         isOverLimit ? "bg-rose-50 text-rose-600" : isNearLimit ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600"
                       )}>
                         <Zap className="w-5 h-5" />
                       </div>
                       <div>
                         <h3 className="text-xl font-black text-prestige-950 tracking-tight">OpenRouter Token Monitor</h3>
                         <p className="text-[10px] font-bold text-prestige-400 uppercase tracking-widest">Live quota and model routing</p>
                       </div>
                     </div>
                     <div className="space-y-2">
                       <div className="flex items-center justify-between text-xs font-bold uppercase tracking-widest text-prestige-400">
                         <span>Usage</span>
                         <span>{tokenUtilizationPct.toFixed(1)}% of {tokenLimit.toLocaleString()} tokens</span>
                       </div>
                       <div className="h-3 rounded-full bg-prestige-100 overflow-hidden">
                         <div
                           className={cn(
                             "h-full rounded-full transition-all",
                             isOverLimit ? "bg-rose-500" : isNearLimit ? "bg-amber-500" : "bg-emerald-500"
                           )}
                           style={{ width: `${Math.min(tokenUtilizationPct, 100)}%` }}
                         />
                       </div>
                     </div>
                     <p className={cn(
                       "text-sm font-medium leading-relaxed max-w-3xl",
                       isOverLimit ? "text-rose-700" : isNearLimit ? "text-amber-700" : "text-prestige-500"
                     )}>
                       {isOverLimit
                         ? "The current token budget is exhausted. New requests should fall back to the free/emergency model until the quota is reset."
                         : isNearLimit
                           ? "We are at the 90% warning band. The app is now prioritizing the fallback model before the free tier is exhausted."
                           : "The primary model is still active. The app will automatically degrade to the fallback model once the warning threshold is crossed."
                       }
                     </p>
                   </div>
                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:min-w-[420px]">
                     <div className="p-4 rounded-2xl bg-prestige-50 border border-prestige-100">
                       <p className="text-[10px] font-black uppercase tracking-widest text-prestige-400 mb-2">Requests</p>
                       <p className="text-2xl font-black text-prestige-950">{totalOpenRouterRequests}</p>
                     </div>
                     <div className="p-4 rounded-2xl bg-prestige-50 border border-prestige-100">
                       <p className="text-[10px] font-black uppercase tracking-widest text-prestige-400 mb-2">Tokens</p>
                       <p className="text-2xl font-black text-prestige-950">{totalOpenRouterTokens.toLocaleString()}</p>
                     </div>
                     <div className="p-4 rounded-2xl bg-prestige-50 border border-prestige-100">
                       <p className="text-[10px] font-black uppercase tracking-widest text-prestige-400 mb-2">Avg / Req</p>
                       <p className="text-2xl font-black text-prestige-950">{averageTokens.toLocaleString()}</p>
                     </div>
                   </div>
                 </div>
               </div>

               {/* Analytics Grid */}
               <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                 {[
                    { label: t("totalRequests"), value: usageStats.length, color: "text-accent-indigo", icon: Activity },
                    { label: t("successRate"), value: usageStats.length > 0 ? `${((usageStats.filter(s => s.status === 'success').length / usageStats.length) * 100).toFixed(1)}%` : "N/A", color: "text-emerald-500", icon: TrendingUp },
                    { label: "OpenRouter AI", value: totalOpenRouterRequests, color: "text-accent-gold", icon: Zap },
                    { label: "Token Usage", value: `${tokenUtilizationPct.toFixed(1)}%`, color: isOverLimit ? "text-rose-500" : isNearLimit ? "text-amber-500" : "text-sky-500", icon: BarChart3 },
                    { label: "Top Model", value: Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "N/A", color: "text-prestige-700", icon: Search },
                    { label: "Legal Searches", value: usageStats.filter(s => s.type === 'legal_search').length, color: "text-sky-500", icon: BarChart3 },
                 ].map((metric, i) => (
                   <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="bg-white p-6 rounded-[2rem] border border-prestige-100 shadow-sm"
                   >
                     <div className="flex items-center justify-between mb-4">
                       <div className={cn("p-2 rounded-xl bg-opacity-10", metric.color.replace('text-', 'bg-'))}>
                         <metric.icon className={cn("w-5 h-5", metric.color)} />
                       </div>
                     </div>
                     <p className="text-sm font-bold text-prestige-400 uppercase tracking-widest leading-none mb-2">{metric.label}</p>
                     <p className="text-3xl font-black text-prestige-950 tracking-tighter">{metric.value}</p>
                   </motion.div>
                 ))}
               </div>

               {/* Charts Row */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-8 rounded-[2.5rem] border border-prestige-100 shadow-xl shadow-prestige-900/5 h-[450px] flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-8">
                       <div>
                         <h3 className="text-lg font-black text-prestige-950 tracking-tight">{t("usageOverview")}</h3>
                         <p className="text-xs font-bold text-prestige-400 uppercase tracking-widest">{t("last7Days")}</p>
                       </div>
                       <div className="flex items-center gap-4">
                         <div className="flex items-center gap-1.5">
                           <div className="w-2 h-2 bg-accent-indigo rounded-full" />
                           <span className="text-[10px] font-black text-prestige-500 uppercase tracking-widest">Queries</span>
                         </div>
                       </div>
                    </div>
                    <div className="flex-1 w-full">
                       {usageStats.length > 0 ? (
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={Array.from({ length: 7 }).map((_, i) => {
                              const d = subDays(new Date(), i);
                              const dayStr = format(d, 'MMM dd');
                              const count = usageStats.filter(s => {
                                const statDate = s.timestamp?.toDate ? s.timestamp.toDate() : new Date(s.timestamp);
                                return format(statDate, 'yyyy-MM-dd') === format(d, 'yyyy-MM-dd');
                              }).length;
                              return { name: dayStr, count };
                            }).reverse()}>
                              <defs>
                                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                                dy={10}
                                reversed={isRtl}
                              />
                              <YAxis 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
                                dx={isRtl ? 10 : -10}
                                orientation={isRtl ? 'right' : 'left'}
                              />
                              <Tooltip 
                                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 800 }}
                              />
                              <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                            </AreaChart>
                         </ResponsiveContainer>
                       ) : (
                         <div className="h-full flex flex-col items-center justify-center space-y-4">
                           <BarChart3 className="w-12 h-12 text-prestige-100" />
                           <p className="text-sm font-bold text-prestige-300">{t("noUsageData")}</p>
                         </div>
                       )}
                    </div>
                  </motion.div>

                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white p-8 rounded-[2.5rem] border border-prestige-100 shadow-xl shadow-prestige-900/5 h-[450px] flex flex-col"
                  >
                    <div className="flex items-center justify-between mb-8">
                       <div>
                         <h3 className="text-lg font-black text-prestige-950 tracking-tight">{t("apiRequests")}</h3>
                         <p className="text-xs font-bold text-prestige-400 uppercase tracking-widest">Distribution</p>
                       </div>
                    </div>
                    <div className="flex-1 w-full">
                       {usageStats.length > 0 ? (
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                              data={[
                                { name: 'OpenRouter', value: usageStats.filter(s => s.type === 'openrouter_query').length, fill: '#ef4444' },
                                { name: 'Search', value: usageStats.filter(s => s.type === 'legal_search').length, fill: '#3b82f6' },
                                { name: 'Support', value: usageStats.filter(s => s.type === 'support_query').length, fill: '#10b981' },
                              ]}
                              layout="vertical"
                              margin={{ left: 20, right: 20 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                              <XAxis type="number" hide />
                              <YAxis 
                                type="category" 
                                dataKey="name" 
                                axisLine={false} 
                                tickLine={false} 
                                tick={{ fontSize: 10, fontWeight: 800, fill: '#475569' }}
                                width={80}
                                orientation={isRtl ? 'right' : 'left'}
                              />
                              <Tooltip 
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '10px', fontWeight: 800 }}
                              />
                              <Bar dataKey="value" radius={[0, 10, 10, 0]}>
                                {usageStats.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={['#6366f1', '#f59e0b', '#10b981'][index % 3]} />
                                ))}
                              </Bar>
                            </BarChart>
                         </ResponsiveContainer>
                       ) : (
                         <div className="h-full flex flex-col items-center justify-center space-y-4">
                           <TrendingUp className="w-12 h-12 text-prestige-100" />
                           <p className="text-sm font-bold text-prestige-300">{t("noUsageData")}</p>
                         </div>
                       )}
                    </div>
                  </motion.div>
               </div>

               {/* Recent Stats Table */}
               <div className="bg-white rounded-[2.5rem] border border-prestige-100 shadow-xl shadow-prestige-900/5 overflow-hidden">
                  <div className="p-8 border-b border-prestige-50 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-black text-prestige-950 tracking-tight">Recent Activity Log</h3>
                      <p className="text-[10px] font-bold text-prestige-400 uppercase tracking-widest leading-none mt-1">Live requests stream</p>
                    </div>
                    <button 
                      onClick={fetchUsageStats}
                      className="p-3 bg-prestige-50 text-prestige-400 hover:text-accent-indigo rounded-2xl transition-all"
                    >
                      <Activity className={cn("w-4 h-4", isLoading && "animate-spin")} />
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-start">
                      <thead>
                        <tr className="bg-prestige-50/50">
                          <th className="px-8 py-4 text-[10px] font-black text-prestige-400 uppercase tracking-widest text-start">Type</th>
                          <th className="px-8 py-4 text-[10px] font-black text-prestige-400 uppercase tracking-widest text-start">Model / Tokens</th>
                          <th className="px-8 py-4 text-[10px] font-black text-prestige-400 uppercase tracking-widest text-start">Status</th>
                          <th className="px-8 py-4 text-[10px] font-black text-prestige-400 uppercase tracking-widest text-start">User ID</th>
                          <th className="px-8 py-4 text-[10px] font-black text-prestige-400 uppercase tracking-widest text-start">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-prestige-50">
                        {usageStats.slice(0, 10).map((stat) => (
                          <tr key={stat.id} className="hover:bg-prestige-50/30 transition-colors">
                            <td className="px-8 py-4">
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-lg flex items-center justify-center",
                                  stat.type === 'openrouter_query' ? "bg-accent-gold/10 text-accent-gold" : "bg-accent-indigo/10 text-accent-indigo"
                                )}>
                                  {stat.type === 'openrouter_query' ? <Zap className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                                </div>
                                <span className="text-xs font-bold text-prestige-900">{stat.type.replace('_', ' ').toUpperCase()}</span>
                              </div>
                            </td>
                            <td className="px-8 py-4">
                              <div className="space-y-1">
                                <p className="text-xs font-black text-prestige-900 truncate max-w-[220px]">{stat.model || "—"}</p>
                                <p className="text-[10px] font-bold text-prestige-400 uppercase tracking-widest">
                                  {(stat.totalTokens ?? stat.tokens ?? 0).toLocaleString()} tokens
                                </p>
                              </div>
                            </td>
                            <td className="px-8 py-4">
                              <span className={cn(
                                "px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-widest",
                                stat.status === 'success' ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-rose-50 text-rose-600 border border-rose-100"
                              )}>
                                {stat.status}
                              </span>
                            </td>
                            <td className="px-8 py-4 text-[10px] font-mono text-prestige-400 font-bold">
                              {stat.userId.substring(0, 12)}...
                            </td>
                            <td className="px-8 py-4 text-[10px] font-bold text-prestige-500 uppercase tracking-widest">
                              {stat.timestamp?.toDate ? format(stat.timestamp.toDate(), 'HH:mm • MMM dd') : 'Just now'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
