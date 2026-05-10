import React, { useState } from "react";
import { motion, AnimatePresence } from "../lib/motion-shim";
import { 
  ShieldCheck, 
  Scale, 
  ArrowRight, 
  CheckCircle2, 
  User, 
  Mail, 
  FileText, 
  Briefcase, 
  GraduationCap, 
  Languages as LanguagesIcon,
  Phone,
  ArrowLeft,
  Loader2,
  Upload,
  Clock,
  Calendar as CalendarIcon,
  Coffee
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import { cn } from "../lib/utils";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useUser } from "../contexts/UserContext";

const STEPS = [
  { id: 1, title: "identity", icon: User },
  { id: 2, title: "expertise", icon: Briefcase },
  { id: 3, title: "credentials", icon: ShieldCheck },
  { id: 4, title: "availability", icon: Clock },
];

export default function LawyerRegistration() {
  const navigate = useNavigate();
  const { t, isRtl } = useLanguage();
  const { user } = useUser();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    fullName: user?.displayName || "",
    email: user?.email || "",
    phone: "",
    specializations: [] as string[],
    experience: "",
    licenseNumber: "",
    bio: "",
    education: "",
    languages: "Arabic, English",
    price: "400",
    workingHours: {
      weekday: { start: "09:00", end: "18:00" },
      friday: { start: "08:00", end: "12:00" }
    },
    offDays: ["Saturday", "Sunday"] as string[],
    isOOO: false
  });

  const getWordCount = (text: string) => {
    return text.trim().split(/\s+/).filter(Boolean).length;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    // Experience limit (max 2 digits)
    if (name === "experience") {
      const digits = value.replace(/\D/g, "");
      if (digits.length > 2) return;
      if (parseInt(digits) > 99) return;
      setFormData(prev => ({ ...prev, [name]: digits }));
      return;
    }

    // Phone validation (UAE digits only)
    if (name === "phone") {
      const digits = value.replace(/\D/g, "");
      // UAE mobile numbers (after +971 or 0) are 9 digits starting with 5
      const sanitized = digits.startsWith("0") ? digits.slice(1) : digits;
      if (sanitized.length > 9) return;
      setFormData(prev => ({ ...prev, [name]: sanitized }));
      return;
    }

    // Bio word limit (max 500 words)
    if (name === "bio") {
      const currentWords = getWordCount(value);
      const prevWords = getWordCount(formData.bio);
      
      // If adding a new word exceeds 500, and value is longer (meaning user is typing or pasting)
      if (currentWords > 500 && value.length > formData.bio.length) {
        return;
      }
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleSpecialization = (spec: string) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.includes(spec)
        ? prev.specializations.filter(s => s !== spec)
        : [...prev.specializations, spec]
    }));
  };

  const SPECIALIZATIONS = [
    "Corporate & Commercial",
    "Family Law",
    "Criminal & Defense",
    "Real Estate & Property",
    "Labor & Employment",
    "Financial Services",
    "Intellectual Property",
    "Arbitration & DIFC"
  ];

  const nextStep = () => setStep(prev => Math.min(prev + 1, 4));
  const prevStep = () => setStep(prev => Math.max(prev - 1, 1));

  const toggleOffDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      offDays: prev.offDays.includes(day)
        ? prev.offDays.filter(d => d !== day)
        : [...prev.offDays, day]
    }));
  };

  const handleWorkingHoursChange = (type: 'weekday' | 'friday', field: 'start' | 'end', value: string) => {
    setFormData(prev => ({
      ...prev,
      workingHours: {
        ...prev.workingHours,
        [type]: {
          ...prev.workingHours[type],
          [field]: value
        }
      }
    }));
  };

  const DAYS_OF_WEEK = [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 4) {
      nextStep();
      return;
    }

    setLoading(true);
    try {
      const path = "lawyer_applications";
      await addDoc(collection(db, path), {
        ...formData,
        userId: user?.uid || "anonymous",
        status: "pending",
        userPhoto: user?.photoURL || "",
        createdAt: serverTimestamp(),
      });
      setSubmitted(true);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "lawyer_applications");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-prestige-50 flex items-center justify-center p-6">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-xl w-full bg-white p-12 rounded-[3rem] border border-prestige-100 shadow-2xl text-center space-y-8"
        >
          <div className="w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
          <div className="space-y-4">
            <h2 className="text-4xl font-black text-prestige-950 tracking-tighter">{t("application") || "Application"} <span className="text-accent-gold italic serif font-normal">{t("received")}</span></h2>
            <p className="text-prestige-500 font-medium leading-relaxed">
              {t("applicationReceivedDesc")}
            </p>
          </div>
          <button 
            onClick={() => navigate("/")}
            className="w-full py-5 bg-prestige-950 text-white rounded-2xl font-black hover:bg-accent-indigo transition-all"
          >
            {t("returnHome")}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-prestige-50/50 py-20 px-6">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-3 px-4 py-2 bg-accent-indigo/5 rounded-full border border-accent-indigo/10">
            <Scale className="w-4 h-4 text-accent-indigo" />
            <span className="text-[10px] font-black text-accent-indigo uppercase tracking-[0.2em]">{t("joinNetwork") || "Join the Network"}</span>
          </div>
          <h1 className="text-5xl font-black text-prestige-950 tracking-tighter">{t("registerAsExpert").split("expert")[0]} <span className="text-accent-gold italic serif font-normal">{t("expert")}</span></h1>
          <p className="text-prestige-500 font-medium max-w-xl mx-auto">
            {t("registerAsExpertDesc")}
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-[3rem] border border-prestige-100 shadow-2xl shadow-prestige-900/5 overflow-hidden flex flex-col lg:flex-row">
          
          {/* Progress Sidebar */}
          <div className="lg:w-72 bg-prestige-950 p-10 flex lg:flex-col justify-between lg:justify-start gap-8">
            {STEPS.map((s) => (
              <div key={s.id} className="flex lg:flex-row items-center gap-4">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500",
                  step >= s.id ? "bg-accent-gold text-prestige-950" : "bg-prestige-900 text-prestige-600 border border-prestige-800"
                )}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div className="hidden lg:block text-start">
                  <p className={cn("text-[10px] font-black uppercase tracking-widest leading-none", step >= s.id ? "text-accent-gold" : "text-prestige-600")}>{t("step")} 0{s.id}</p>
                  <p className={cn("text-sm font-bold", step >= s.id ? "text-white" : "text-prestige-600")}>{t(s.title)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Form Content */}
          <div className="flex-1 p-10 md:p-12 text-start">
            <form onSubmit={handleSubmit} className="space-y-8">
              
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div 
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                       <h3 className="text-xl font-black text-prestige-950 tracking-tight">{t("identityDetails")}</h3>
                       <p className="text-xs text-prestige-400 font-bold uppercase tracking-wider">{t("identityDetailsDesc")}</p>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-prestige-500 flex items-center gap-2">
                          <User className="w-3 h-3" /> {t("fullLegalName")}
                        </label>
                        <input 
                          type="text" 
                          name="fullName"
                          required
                          value={formData.fullName}
                          onChange={handleInputChange}
                          placeholder={t("emiratesIdPlaceholder") || "As per Emirates ID"}
                          className="w-full px-5 py-4 bg-prestige-50 border border-prestige-100 rounded-2xl focus:ring-2 focus:ring-accent-indigo focus:border-transparent outline-none transition-all font-bold text-prestige-950"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-prestige-500 flex items-center gap-2">
                          <Mail className="w-3 h-3" /> {t("professionalEmail")}
                        </label>
                        <input 
                          type="email" 
                          name="email"
                          required
                          value={formData.email}
                          onChange={handleInputChange}
                          placeholder="email@firm.ae"
                          className="w-full px-5 py-4 bg-prestige-50 border border-prestige-100 rounded-2xl focus:ring-2 focus:ring-accent-indigo focus:border-transparent outline-none transition-all font-bold text-prestige-950"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-prestige-500 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <Phone className="w-3 h-3" /> {t("contactPhone")}
                          </span>
                          <span className="text-accent-gold">{t("uaeNumbersOnly") || "UAE Numbers Only"}</span>
                        </label>
                        <div className="relative">
                          <div className={cn(
                            "absolute top-1/2 -translate-y-1/2 flex items-center gap-1 border-prestige-100 pr-3",
                            isRtl ? "right-5 border-l pl-3" : "left-5 border-r pr-3"
                          )}>
                            <span className="text-xs font-black text-prestige-400">+971</span>
                          </div>
                          <input 
                            type="tel" 
                            name="phone"
                            required
                            value={formData.phone}
                            onChange={handleInputChange}
                            placeholder="5X XXX XXXX"
                            className={cn(
                              "w-full py-4 bg-prestige-50 border border-prestige-100 rounded-2xl focus:ring-2 focus:ring-accent-indigo focus:border-transparent outline-none transition-all font-bold text-prestige-950",
                              isRtl ? "pr-20 pl-5" : "pl-20 pr-5"
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div 
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                       <h3 className="text-xl font-black text-prestige-950 tracking-tight">{t("legalExpertise")}</h3>
                       <p className="text-xs text-prestige-400 font-bold uppercase tracking-wider">{t("legalExpertiseDesc")}</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4 md:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-prestige-500 flex items-center gap-2">
                          <Briefcase className="w-3 h-3" /> {t("specializationLabel")}
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {SPECIALIZATIONS.map((spec) => (
                            <button
                              key={spec}
                              type="button"
                              onClick={() => toggleSpecialization(spec)}
                              className={cn(
                                "p-4 rounded-2xl text-[10px] font-black text-start transition-all border",
                                formData.specializations.includes(spec)
                                  ? "bg-accent-indigo text-white border-accent-indigo shadow-lg shadow-accent-indigo/10"
                                  : "bg-prestige-50 text-prestige-600 border-prestige-100 hover:border-accent-indigo"
                              )}
                            >
                              {spec}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-prestige-500 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3" /> {t("yearsOfPractice")}
                          </span>
                          <span className="text-accent-gold">{t("limit2Digits")}</span>
                        </label>
                        <input 
                          type="number" 
                          name="experience"
                          required
                          max="99"
                          value={formData.experience}
                          onChange={handleInputChange}
                          placeholder="0-99"
                          className="w-full px-5 py-4 bg-prestige-50 border border-prestige-100 rounded-2xl focus:ring-2 focus:ring-accent-indigo focus:border-transparent outline-none transition-all font-bold text-prestige-950"
                        />
                      </div>
                      <div className="space-y-3 md:col-span-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-prestige-500 flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <FileText className="w-3 h-3" /> {t("professionalBio")}
                          </span>
                          <span className={cn(
                            "font-black tracking-widest",
                            getWordCount(formData.bio) >= 500 ? "text-rose-500" : "text-prestige-400"
                          )}>
                            {getWordCount(formData.bio)} / 500 {t("wordCount")}
                          </span>
                        </label>
                        <textarea 
                          name="bio"
                          required
                          value={formData.bio}
                          onChange={handleInputChange}
                          rows={4}
                          placeholder={t("bioPlaceholder")}
                          className="w-full px-5 py-4 bg-prestige-50 border border-prestige-100 rounded-2xl focus:ring-2 focus:ring-accent-indigo focus:border-transparent outline-none transition-all font-bold text-prestige-950 resize-none"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div 
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                       <h3 className="text-xl font-black text-prestige-950 tracking-tight">{t("certification")}</h3>
                       <p className="text-xs text-prestige-400 font-bold uppercase tracking-wider">{t("certificationDesc")}</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-prestige-500 flex items-center gap-2">
                          <ShieldCheck className="w-3 h-3" /> {t("licenseNumber")}
                        </label>
                        <div className="relative">
                          <input 
                            type="text" 
                            name="licenseNumber"
                            required
                            value={formData.licenseNumber}
                            onChange={handleInputChange}
                            placeholder="MOJ-XXXX-XXXX"
                            className={cn(
                              "w-full px-5 py-4 bg-prestige-50 border border-prestige-100 rounded-2xl focus:ring-2 focus:ring-accent-indigo focus:border-transparent outline-none transition-all font-bold text-prestige-950",
                              isRtl ? "pl-24" : "pr-24"
                            )}
                          />
                          <div className={cn(
                            "absolute top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-2 py-1 bg-amber-50 rounded-lg border border-amber-100",
                            isRtl ? "left-4" : "right-4"
                          )}>
                             <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                             <span className="text-[8px] font-black text-amber-600 uppercase tracking-tight">{t("mojPending")}</span>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-prestige-500 flex items-center gap-2">
                          <GraduationCap className="w-3 h-3" /> {t("highestEducation")}
                        </label>
                        <input 
                          type="text" 
                          name="education"
                          required
                          value={formData.education}
                          onChange={handleInputChange}
                          placeholder="e.g. LLB, Zayed University"
                          className="w-full px-5 py-4 bg-prestige-50 border border-prestige-100 rounded-2xl focus:ring-2 focus:ring-accent-indigo focus:border-transparent outline-none transition-all font-bold text-prestige-950"
                        />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-prestige-500 flex items-center gap-2">
                           <LanguagesIcon className="w-3 h-3" /> {t("languages")}
                         </label>
                         <input 
                           type="text" 
                           name="languages"
                           required
                           value={formData.languages}
                           onChange={handleInputChange}
                           className="w-full px-5 py-4 bg-prestige-50 border border-prestige-100 rounded-2xl focus:ring-2 focus:ring-accent-indigo focus:border-transparent outline-none transition-all font-bold text-prestige-950"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase tracking-widest text-prestige-500 flex items-center gap-2">
                           {t("consultationFee")}
                         </label>
                         <input 
                           type="number" 
                           name="price"
                           required
                           min="100"
                           step="50"
                           value={formData.price}
                           onChange={handleInputChange}
                           className="w-full px-5 py-4 bg-prestige-50 border border-prestige-100 rounded-2xl focus:ring-2 focus:ring-accent-indigo focus:border-transparent outline-none transition-all font-bold text-prestige-950"
                         />
                         <p className="text-[9px] font-bold text-prestige-400 uppercase tracking-tight">{t("feeNote")}</p>
                      </div>

                      <div className="md:col-span-2 pt-4">
                        <div className="p-8 border-2 border-dashed border-prestige-100 rounded-[2rem] bg-prestige-50 flex flex-col items-center justify-center text-center gap-4 hover:border-accent-gold transition-all group">
                           <div className="w-12 h-12 bg-white rounded-xl shadow-md flex items-center justify-center text-prestige-300 group-hover:text-accent-gold transition-colors">
                             <Upload className="w-6 h-6" />
                           </div>
                           <div>
                             <p className="text-sm font-black text-prestige-900 leading-none mb-1">{t("uploadLicense")}</p>
                             <p className="text-[10px] font-bold text-prestige-400 uppercase tracking-widest">{t("pdfMax10")}</p>
                           </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {step === 4 && (
                  <motion.div 
                    key="step4"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-8"
                  >
                    <div className="space-y-2">
                       <h3 className="text-xl font-black text-prestige-950 tracking-tight">{t("availability")} & {t("scheduling") || "Scheduling"}</h3>
                       <p className="text-xs text-prestige-400 font-bold uppercase tracking-wider">{t("availabilityDesc")}</p>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-8">
                      {/* Hours Section */}
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-widest text-prestige-500 flex items-center gap-2">
                            <Clock className="w-3 h-3" /> {t("workingHoursWeekday")}
                          </label>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-prestige-400 uppercase">{t("start")}</span>
                              <input 
                                type="time"
                                value={formData.workingHours.weekday.start}
                                onChange={(e) => handleWorkingHoursChange('weekday', 'start', e.target.value)}
                                className="w-full px-4 py-3 bg-prestige-50 border border-prestige-100 rounded-xl font-bold text-prestige-950 outline-none focus:ring-2 focus:ring-accent-indigo"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-prestige-400 uppercase">{t("end")}</span>
                              <input 
                                type="time"
                                value={formData.workingHours.weekday.end}
                                onChange={(e) => handleWorkingHoursChange('weekday', 'end', e.target.value)}
                                className="w-full px-4 py-3 bg-prestige-50 border border-prestige-100 rounded-xl font-bold text-prestige-950 outline-none focus:ring-2 focus:ring-accent-indigo"
                              />
                            </div>
                          </div>
                        </div>

                        <div className={cn("space-y-4 transition-all duration-300", formData.offDays.includes("Friday") && "opacity-40 grayscale pointer-events-none")}>
                          <label className="text-[10px] font-black uppercase tracking-widest text-prestige-500 flex items-center justify-between gap-2">
                            <span className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-accent-gold" /> {t("fridayHours")}
                            </span>
                            {formData.offDays.includes("Friday") && <span className="text-rose-500 font-black animate-pulse">{t("fridayOffDayNote")}</span>}
                          </label>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-prestige-400 uppercase">{t("start")}</span>
                              <input 
                                type="time"
                                value={formData.workingHours.friday.start}
                                onChange={(e) => handleWorkingHoursChange('friday', 'start', e.target.value)}
                                className="w-full px-4 py-3 bg-prestige-50 border border-prestige-100 rounded-xl font-bold text-prestige-950 outline-none focus:ring-2 focus:ring-accent-indigo"
                              />
                            </div>
                            <div className="space-y-1">
                              <span className="text-[9px] font-bold text-prestige-400 uppercase">{t("end")}</span>
                              <input 
                                type="time"
                                value={formData.workingHours.friday.end}
                                onChange={(e) => handleWorkingHoursChange('friday', 'end', e.target.value)}
                                className="w-full px-4 py-3 bg-prestige-50 border border-prestige-100 rounded-xl font-bold text-prestige-950 outline-none focus:ring-2 focus:ring-accent-indigo"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Days & OOO Section */}
                      <div className="space-y-6">
                        <div className="space-y-4">
                          <label className="text-[10px] font-black uppercase tracking-widest text-prestige-500 flex items-center gap-2">
                            <CalendarIcon className="w-3 h-3" /> {t("offDays")}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {DAYS_OF_WEEK.map((day) => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleOffDay(day)}
                                className={cn(
                                  "px-3 py-2 rounded-xl text-[10px] font-bold transition-all border",
                                  formData.offDays.includes(day)
                                    ? "bg-rose-500 text-white border-rose-500"
                                    : "bg-prestige-50 text-prestige-600 border-prestige-100 hover:border-rose-500 hover:text-rose-500"
                                )}
                              >
                                {day.substring(0, 3)}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="p-6 bg-prestige-50 rounded-[2rem] border border-prestige-100 space-y-4">
                          <div className="flex items-center gap-3">
                            <Coffee className="w-5 h-5 text-accent-gold" />
                            <div className="space-y-1 text-start">
                              <p className="text-sm font-black text-prestige-950">{t("availabilitySetting")}</p>
                              <p className="text-[10px] font-medium text-prestige-400 uppercase tracking-widest leading-tight">{t("availabilitySettingDesc")}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between pt-8 border-t border-prestige-50">
                <button 
                  type="button"
                  onClick={prevStep}
                  disabled={step === 1 || loading}
                  className={cn(
                    "flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all",
                    step === 1 ? "opacity-0 invisible" : "text-prestige-400 hover:text-prestige-950"
                  )}
                >
                  <ArrowLeft className="w-4 h-4" /> {t("back")}
                </button>

                <button 
                  type="submit"
                  disabled={loading}
                  className="px-10 py-5 bg-prestige-950 text-white rounded-2xl font-black hover:bg-accent-indigo transition-all shadow-xl shadow-prestige-950/20 flex items-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      {step === 4 ? t("submitApplication") : t("continue")} 
                      {step < 4 && <ArrowRight className={cn("w-5 h-5", isRtl && "rotate-180")} />}
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-6">
                <p className="text-[10px] font-bold text-prestige-300 uppercase tracking-widest max-w-xs mx-auto">
                  {t("providerTermsNote")}
                </p>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
