import React, { useState, useEffect } from "react";
import { 
  Clock, 
  Calendar as CalendarIcon, 
  Coffee, 
  Save, 
  Loader2, 
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { cn } from "../lib/utils";
import { Lawyer, WorkingHours } from "../services/lawyerService";
import { useLanguage } from "../contexts/LanguageContext";
import { useUser } from "../contexts/UserContext";

export default function LawyerDashboard() {
  const { t, isRtl } = useLanguage();
  const { user } = useUser();
  const [lawyer, setLawyer] = useState<Lawyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const DAYS_OF_WEEK = [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
  ];

  useEffect(() => {
    async function fetchLawyerProfile() {
      if (!user) return;
      try {
        const lawyerRef = doc(db, "lawyers", user.uid);
        const snap = await getDoc(lawyerRef);
        
        if (snap.exists()) {
          setLawyer({ id: snap.id, ...snap.data() } as Lawyer);
        } else {
          setLawyer(null);
        }
      } catch (err) {
        console.error("Error fetching lawyer profile:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchLawyerProfile();
  }, [user]);

  const handleWorkingHoursChange = (type: 'weekday' | 'friday', field: 'start' | 'end', value: string) => {
    if (!lawyer) return;
    setLawyer(prev => {
      if (!prev) return null;
      const hours = prev.workingHours || {
        weekday: { start: "09:00", end: "18:00" },
        friday: { start: "08:00", end: "12:00" }
      };
      return {
        ...prev,
        workingHours: {
          ...hours,
          [type]: {
            ...hours[type],
            [field]: value
          }
        }
      };
    });
  };

  const toggleOffDay = (day: string) => {
    if (!lawyer) return;
    setLawyer(prev => {
      if (!prev) return null;
      const offDays = prev.offDays || [];
      return {
        ...prev,
        offDays: offDays.includes(day)
          ? offDays.filter(d => d !== day)
          : [...offDays, day]
      };
    });
  };

  const toggleOOO = () => {
    if (!lawyer) return;
    setLawyer(prev => prev ? { ...prev, isOOO: !prev.isOOO } : null);
  };

  const handleSave = async () => {
    if (!user || !lawyer) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const lawyerRef = doc(db, "lawyers", user.uid);
      await updateDoc(lawyerRef, {
        workingHours: lawyer.workingHours,
        offDays: lawyer.offDays,
        isOOO: lawyer.isOOO,
        updatedAt: new Date().toISOString()
      });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error("Error saving lawyer profile:", err);
      setSaveStatus('error');
      handleFirestoreError(err, OperationType.UPDATE, `lawyers/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent-indigo animate-spin" />
      </div>
    );
  }

  if (!lawyer) {
    return (
      <div className="container mx-auto px-6 py-24 text-center space-y-6">
        <div className="w-20 h-20 bg-prestige-100 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-10 h-10 text-prestige-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-prestige-950 tracking-tight">{t("noProfileFound")}</h2>
          <p className="text-prestige-500 font-medium">{t("noProfileFoundDesc")}</p>
        </div>
        <button 
          onClick={() => window.location.href = "/register-lawyer"}
          className="px-8 py-4 bg-accent-indigo text-white rounded-2xl font-black shadow-xl shadow-accent-indigo/20 hover:scale-105 transition-transform"
        >
          {t("registerAsLawyer")}
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-24 max-w-4xl space-y-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2 text-start">
          <span className="text-[10px] font-black text-accent-gold uppercase tracking-[0.3em]">{t("managementPortal")}</span>
          <h1 className="text-4xl md:text-5xl font-black text-prestige-950 tracking-tighter leading-none">
            {t("availabilitySettings").split("Settings")[0]} <span className="text-accent-gold italic serif font-normal">{t("scheduling") || "Settings"}</span>
          </h1>
          <p className="text-prestige-500 font-medium">{t("availabilitySettingsDesc")}</p>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={saving}
          className={cn(
            "px-8 py-4 rounded-2xl font-black flex items-center justify-center gap-3 transition-all min-w-[200px]",
            saveStatus === 'success' 
              ? "bg-emerald-500 text-white" 
              : "bg-prestige-950 text-white hover:bg-black shadow-xl shadow-prestige-950/20 active:scale-95"
          )}
        >
          {saving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : saveStatus === 'success' ? (
            <>
              <CheckCircle2 className="w-5 h-5" />
              {t("savedSuccessfully")}
            </>
          ) : (
            <>
              <Save className="w-5 h-5" />
              {t("saveChanges")}
            </>
          )}
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Availability Controls */}
        <div className="space-y-8">
           <div className="p-6 md:p-8 bg-white border border-prestige-100 rounded-[2rem] md:rounded-[2.5rem] shadow-xl shadow-prestige-900/5 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1 text-start">
                  <h3 className="text-xl font-black text-prestige-950 tracking-tight">{t("visibilityStatus")}</h3>
                  <p className="text-xs font-bold text-prestige-400 uppercase tracking-widest leading-tight">{t("oooToggle")}</p>
                </div>
                <button
                  type="button"
                  onClick={toggleOOO}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-all duration-500",
                    lawyer.isOOO ? "bg-rose-500" : "bg-emerald-500"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 bg-white rounded-full shadow-sm transition-all duration-500 transform",
                    lawyer.isOOO ? "translate-x-6" : "translate-x-0"
                  )} />
                </button>
              </div>

              <div className={cn(
                "p-4 rounded-2xl border flex items-start gap-4 transition-all",
                lawyer.isOOO 
                  ? "bg-rose-50 border-rose-100 text-rose-700" 
                  : "bg-emerald-50 border-emerald-100 text-emerald-700"
              )}>
                <div className="mt-1">
                  {lawyer.isOOO ? <Coffee className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-black uppercase tracking-widest">
                    {lawyer.isOOO ? t("currentlyUnavailable") : t("currentlyAvailable")}
                  </p>
                  <p className="text-xs font-medium leading-relaxed text-start">
                    {lawyer.isOOO 
                      ? t("oooHidden") 
                      : t("oooVisible")}
                  </p>
                </div>
              </div>
           </div>

           <div className="p-6 md:p-8 bg-white border border-prestige-100 rounded-[2rem] md:rounded-[2.5rem] shadow-xl shadow-prestige-900/5 space-y-6 text-start">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-prestige-950 tracking-tight">{t("scheduledDaysOff")}</h3>
                <p className="text-xs font-bold text-prestige-400 uppercase tracking-widest leading-tight">{t("selectHolidays")}</p>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleOffDay(day)}
                    className={cn(
                      "px-5 py-3 rounded-2xl text-[11px] font-black tracking-widest uppercase transition-all border",
                      (lawyer.offDays || []).includes(day)
                        ? "bg-prestige-900 text-white border-prestige-900"
                        : "bg-prestige-50 text-prestige-500 border-prestige-100 hover:border-accent-indigo hover:text-accent-indigo"
                    )}
                  >
                    {day}
                  </button>
                ))}
              </div>
           </div>
        </div>

        {/* Working Hours Controls */}
        <div className="p-6 md:p-8 bg-white border border-prestige-100 rounded-[2rem] md:rounded-[2.5rem] shadow-xl shadow-prestige-900/5 space-y-8 text-start">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-prestige-950 tracking-tight">{t("standardWorkingHours")}</h3>
            <p className="text-xs font-bold text-prestige-400 uppercase tracking-widest leading-tight">{t("sessionTimingDesc")}</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs font-black text-prestige-900 uppercase tracking-widest">
                <Clock className="w-4 h-4 text-accent-indigo" />
                {t("weekdayHoursLabel")}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-prestige-400 uppercase">{t("start")}</span>
                  <input 
                    type="time"
                    value={lawyer.workingHours?.weekday.start || "09:00"}
                    onChange={(e) => handleWorkingHoursChange('weekday', 'start', e.target.value)}
                    className="w-full px-5 py-4 bg-prestige-50 border border-prestige-100 rounded-2xl font-bold text-prestige-950 outline-none focus:ring-2 focus:ring-accent-indigo transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-prestige-400 uppercase">{t("end")}</span>
                  <input 
                    type="time"
                    value={lawyer.workingHours?.weekday.end || "18:00"}
                    onChange={(e) => handleWorkingHoursChange('weekday', 'end', e.target.value)}
                    className="w-full px-5 py-4 bg-prestige-50 border border-prestige-100 rounded-2xl font-bold text-prestige-950 outline-none focus:ring-2 focus:ring-accent-indigo transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="w-full h-px bg-prestige-100" />

            <div className={cn("space-y-4 transition-all duration-300", (lawyer.offDays || []).includes("Friday") && "opacity-40 grayscale pointer-events-none")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-black text-prestige-900 uppercase tracking-widest text-accent-gold">
                  <Clock className="w-4 h-4" />
                  {t("fridayHours")}
                </div>
                {(lawyer.offDays || []).includes("Friday") && (
                  <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest animate-pulse">{t("offDay")}</span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-prestige-400 uppercase">{t("start")}</span>
                  <input 
                    type="time"
                    value={lawyer.workingHours?.friday.start || "08:00"}
                    onChange={(e) => handleWorkingHoursChange('friday', 'start', e.target.value)}
                    className="w-full px-5 py-4 bg-prestige-50 border border-prestige-100 rounded-2xl font-bold text-prestige-950 outline-none focus:ring-2 focus:ring-accent-indigo transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-prestige-400 uppercase">{t("end")}</span>
                  <input 
                    type="time"
                    value={lawyer.workingHours?.friday.end || "12:00"}
                    onChange={(e) => handleWorkingHoursChange('friday', 'end', e.target.value)}
                    className="w-full px-5 py-4 bg-prestige-50 border border-prestige-100 rounded-2xl font-bold text-prestige-950 outline-none focus:ring-2 focus:ring-accent-indigo transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 bg-accent-gold/5 rounded-[2rem] border border-accent-gold/10 text-start">
            <div className="flex gap-4">
              <div className="p-3 bg-accent-gold/10 rounded-xl flex-shrink-0 h-fit">
                <CalendarIcon className="w-5 h-5 text-accent-gold" />
              </div>
              <div className="space-y-2">
                <p className="text-sm font-black text-prestige-950 tracking-tight">{t("smartSlotGeneration")}</p>
                <p className="text-xs font-medium text-prestige-500 leading-relaxed italic">
                  {t("slotGenerationDesc")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
