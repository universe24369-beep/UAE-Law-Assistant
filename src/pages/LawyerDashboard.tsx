import React, { useState, useEffect } from "react";
import { 
  Briefcase, 
  Users, 
  Calendar, 
  Search, 
  Plus, 
  ArrowRight, 
  Clock, 
  ShieldCheck, 
  Loader2,
  FileText,
  ChevronRight,
  TrendingUp,
  MoreVertical,
  Activity
} from "lucide-react";
import { db } from "../lib/firebase";
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { cn } from "../lib/utils";
import { useLanguage } from "../contexts/LanguageContext";
import { motion } from "../lib/motion-shim";
import { format } from "date-fns";
import { useUser } from "../contexts/UserContext";

export default function LawyerDashboard() {
  const { t, isRtl } = useLanguage();
  const navigate = useNavigate();
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeCases: 0,
    totalClients: 0,
    upcomingBookings: 0,
    recentChats: 0
  });
  
  const [recentCases, setRecentCases] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchDashboardData = async () => {
      try {
        // 1. Get Stats (Real-time counts would be better, but getDocs for now)
        const casesRef = collection(db, "cases");
        const clientsRef = collection(db, "clients");
        const bookingsRef = collection(db, "consultations");
        
        const [casesSnap, clientsSnap, bookingsSnap] = await Promise.all([
          getDocs(query(casesRef, where("lawyerId", "==", user.uid), where("status", "==", "active"))),
          getDocs(query(clientsRef, where("lawyerId", "==", user.uid))),
          getDocs(query(bookingsRef, where("lawyerId", "==", user.uid), where("status", "==", "confirmed")))
        ]);

        setStats({
          activeCases: casesSnap.size,
          totalClients: clientsSnap.size,
          upcomingBookings: bookingsSnap.size,
          recentChats: 0 // Will update from activity
        });

        // 2. Recent Cases
        const recentCasesList = casesSnap.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
        })).slice(0, 5);
        setRecentCases(recentCasesList);

        // 3. Recent Activity (Lawyer Co-pilot sessions)
        const activityRef = collection(db, "lawyer_co_pilots");
        const activityQuery = query(
          activityRef, 
          where("userId", "==", user.uid), 
          orderBy("updatedAt", "desc"),
          limit(5)
        );
        
        const activitySnap = await getDocs(activityQuery);
        setRecentActivity(activitySnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
      } catch (err) {
        console.error("Dashboard error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 text-accent-indigo animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-12 pb-24 overflow-y-auto scrollbar-hide container mx-auto px-6 pt-12">
      {/* Header & Quick Action */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-2 text-start">
          <span className="text-[10px] font-black text-accent-gold uppercase tracking-[0.3em]">{t("workspaceDashboard") || "Workspace Dashboard"}</span>
          <h1 className="text-4xl md:text-5xl font-black text-prestige-950 tracking-tighter leading-none">
            Welcome, <span className="text-accent-gold italic serif font-normal">Counsel</span>
          </h1>
          <p className="text-prestige-500 font-medium">Manage your legal practice and research in one central workspace.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => navigate("/copilot")}
            className="flex-1 md:flex-none px-6 py-4 bg-accent-gold text-prestige-950 rounded-2xl font-black flex items-center justify-center gap-3 text-sm shadow-xl shadow-accent-gold/20 hover:scale-105 transition-transform"
          >
            <ShieldCheck className="w-5 h-5" />
            Launch Co-pilot
          </button>
          <button 
            onClick={() => { /* Open New Case Modal/Page */ }}
            className="flex-1 md:flex-none px-6 py-4 bg-prestige-950 text-white rounded-2xl font-black flex items-center justify-center gap-3 text-sm shadow-xl shadow-prestige-950/20 hover:scale-105 transition-transform"
          >
            <Plus className="w-5 h-5" />
            New Case
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Active Cases", value: stats.activeCases, icon: Briefcase, color: "text-accent-indigo", bg: "bg-accent-indigo/5" },
          { label: "Total Clients", value: stats.totalClients, icon: Users, color: "text-accent-blue", bg: "bg-accent-blue/5" },
          { label: "Upcoming Sessions", value: stats.upcomingBookings, icon: Calendar, color: "text-accent-gold", bg: "bg-accent-gold/5" },
          { label: "Research Threads", value: recentActivity.length, icon: Activity, color: "text-emerald-500", bg: "bg-emerald-500/5" },
        ].map((stat, idx) => (
          <motion.div 
            key={idx}
            whileHover={{ y: -5 }}
            className="bg-white p-6 rounded-[2rem] border border-prestige-100 shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={cn("p-3 rounded-xl", stat.bg, stat.color)}>
                <stat.icon className="w-5 h-5" />
              </div>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="space-y-1 text-start">
              <p className="text-[10px] font-black text-prestige-400 uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-3xl font-black text-prestige-950">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Content Sections */}
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left: Active Cases */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-black text-prestige-950 tracking-tight">Active Matters</h2>
            <button className="text-xs font-black text-accent-indigo uppercase tracking-widest hover:underline">View All</button>
          </div>
          
          <div className="bg-white rounded-[2.5rem] border border-prestige-100 shadow-sm overflow-hidden">
            {recentCases.length > 0 ? (
              <div className="divide-y divide-prestige-50">
                {recentCases.map((c) => (
                  <div key={c.id} className="p-6 hover:bg-prestige-50 transition-colors flex items-center justify-between group">
                    <div className="flex items-center gap-4 text-start">
                      <div className="w-12 h-12 rounded-xl bg-prestige-100 flex items-center justify-center text-prestige-950">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-black text-prestige-950 tracking-tight">{c.title}</h4>
                        <div className="flex items-center gap-2 text-xs text-prestige-400 font-medium">
                          <span>{c.clientId ? "Client Linked" : "No Client"}</span>
                          <span className="w-1 h-1 bg-prestige-300 rounded-full" />
                          <span>Updated {format(new Date(c.createdAt), 'MMM d')}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate(`/cases/${c.id}`)}
                      className="p-3 rounded-lg text-prestige-400 hover:text-prestige-950 hover:bg-white border border-transparent hover:border-prestige-100 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <ArrowRight className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-20 text-center space-y-4">
                <div className="w-16 h-16 bg-prestige-50 rounded-full flex items-center justify-center mx-auto text-prestige-300">
                  <Briefcase className="w-8 h-8" />
                </div>
                <p className="text-prestige-500 font-medium italic">No active cases found. Start by creating one.</p>
                <button className="text-accent-indigo font-black text-sm uppercase tracking-widest">Create Case</button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Recent Research / Co-pilot */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-2xl font-black text-prestige-950 tracking-tight">AI Insights</h2>
            <button onClick={() => navigate("/history")} className="text-xs font-black text-accent-indigo uppercase tracking-widest hover:underline">History</button>
          </div>

          <div className="space-y-4">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <motion.div 
                  key={activity.id}
                  whileHover={{ x: 5 }}
                  onClick={() => navigate("/copilot")} // Should link to specific chat really
                  className="bg-white p-6 rounded-3xl border border-prestige-100 shadow-sm cursor-pointer hover:border-accent-gold group text-start"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-prestige-400" />
                      <span className="text-[10px] font-bold text-prestige-400 uppercase tracking-widest">
                        {format(activity.updatedAt?.toDate() || new Date(), 'MMM d, p')}
                      </span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-prestige-300 group-hover:text-accent-gold transition-colors" />
                  </div>
                  <h4 className="text-sm font-black text-prestige-950 line-clamp-1 mb-1">
                    {activity.messages?.[activity.messages.length - 2]?.text || "New Research Session"}
                  </h4>
                  <p className="text-xs text-prestige-500 font-medium line-clamp-2 italic leading-relaxed">
                    {activity.messages?.[activity.messages.length - 1]?.text || "Analyzing..."}
                  </p>
                </motion.div>
              ))
            ) : (
              <div className="p-12 text-center bg-prestige-50/50 rounded-3xl border border-dashed border-prestige-200">
                <p className="text-xs text-prestige-400 font-bold uppercase tracking-widest">No Recent Research</p>
              </div>
            )}
            
            {/* Quick Tips / Call to Action */}
            <div className="p-8 bg-prestige-950 rounded-[2.5rem] text-white space-y-4 relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-accent-gold/20 blur-3xl group-hover:bg-accent-gold/40 transition-all duration-1000" />
               <h4 className="text-lg font-black tracking-tight leading-tight">Master the <span className="text-accent-gold italic serif font-normal">Vertical AI</span></h4>
               <p className="text-xs text-prestige-300 font-medium leading-relaxed">
                 Use the Lawyer Co-pilot to analyze complex contracts and retrieve UAE Supreme Court precedents.
               </p>
               <button 
                 onClick={() => navigate("/copilot")}
                 className="flex items-center gap-2 text-accent-gold text-[10px] font-black uppercase tracking-[0.2em] hover:gap-3 transition-all"
               >
                 Launch Research <ArrowRight className="w-3 h-3" />
               </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
