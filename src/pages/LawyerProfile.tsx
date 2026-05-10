import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "../lib/motion-shim";
import { 
  Star, 
  MapPin, 
  Briefcase, 
  GraduationCap, 
  Languages, 
  CheckCircle2, 
  ArrowLeft, 
  Loader2, 
  Calendar,
  MessageSquare,
  ShieldCheck,
  Check,
  Coffee,
  Clock
} from "lucide-react";
import { getLawyerById, Lawyer } from "../services/lawyerService";
import { useLanguage } from "../contexts/LanguageContext";
import { cn } from "../lib/utils";
import { db, signInWithGoogle, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, updateDoc, doc } from "firebase/firestore";
import { useUser } from "../contexts/UserContext";

export default function LawyerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, isRtl } = useLanguage();
  const { user } = useUser();
  const [lawyer, setLawyer] = useState<Lawyer | null>(null);
  const [loading, setLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [meetingType, setMeetingType] = useState<'video' | 'in-person'>('video');

  const getAvailableSlots = () => {
    if (!lawyer || lawyer.isOOO) return [];
    
    const date = new Date(selectedDate);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
    
    if (lawyer.offDays?.includes(dayName)) return [];

    const isFriday = dayName === 'Friday';
    const hours = isFriday 
      ? (lawyer.workingHours?.friday || { start: "08:00", end: "12:00" })
      : (lawyer.workingHours?.weekday || { start: "09:00", end: "18:00" });

    const slots: string[] = [];
    const [startH, startM] = hours.start.split(':').map(Number);
    const [endH, endM] = hours.end.split(':').map(Number);

    let current = new Date();
    current.setHours(startH, startM, 0, 0);
    const end = new Date();
    end.setHours(endH, endM, 0, 0);

    // Personal visit (in-person) uses 1-hour slots
    // Online booking (video) allows 30-min slots
    const step = meetingType === 'in-person' ? 60 : 30;

    while (current < end) {
      const timeStr = current.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      slots.push(timeStr);
      current.setMinutes(current.getMinutes() + step);
    }

    return slots;
  };

  const timeSlots = getAvailableSlots();

  const today = new Date().toISOString().split('T')[0];

  const upcomingDays = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d.toISOString().split('T')[0];
  });

  const isTimeInPast = (dateStr: string, timeStr: string) => {
    if (!dateStr || !timeStr) return false;
    const now = new Date();
    // Use a fixed date for today to compare times correctly
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':').map(Number);
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    
    const selected = new Date(dateStr);
    selected.setHours(hours, minutes, 0, 0);
    return selected < now;
  };

  useEffect(() => {
    // Auto-select first available slot
    const findNextSlot = () => {
      const firstValidTime = timeSlots.find(time => !isTimeInPast(selectedDate, time));
      if (firstValidTime) {
        setSelectedTime(firstValidTime);
      } else {
        // If no slots left today, just clear the time
        setSelectedTime("");
      }
    };
    
    if (loading === false && lawyer) {
      findNextSlot();
    }
  }, [loading, lawyer]);

  useEffect(() => {
    async function load() {
      if (id) {
        setLoading(true);
        const data = await getLawyerById(id);
        setLawyer(data);
        setLoading(false);
      }
    }
    load();
  }, [id]);

  const [searchParams] = useSearchParams();
  const rescheduleId = searchParams.get('reschedule');
  const [showConfirm, setShowConfirm] = useState(false);

  const handleBook = async () => {
    if (!lawyer) return;
    
    if (!user) {
      try {
        await signInWithGoogle();
      } catch (err) {
        console.error("Sign-in error:", err);
      }
      return;
    }

    setShowConfirm(true);
  };

  const confirmBooking = async () => {
    if (!lawyer || !user) return;
    
    setIsBooking(true);
    setShowConfirm(false);
    try {
      const scheduledDateTime = new Date(`${selectedDate} ${selectedTime}`).toISOString();
      const path = "consultations";
      
      if (rescheduleId) {
        await updateDoc(doc(db, path, rescheduleId), {
          scheduledAt: scheduledDateTime,
          meetingType,
          meetingLink: meetingType === 'video' ? `https://meet.google.com/mock-id-${Math.random().toString(36).substring(7)}` : null,
          status: "pending",
        });
      } else {
        await addDoc(collection(db, path), {
          clientId: user.uid,
          lawyerId: lawyer.id,
          lawyerName: lawyer.name,
          price: typeof lawyer.price === 'number' ? `AED ${lawyer.price}` : String(lawyer.price),
          scheduledAt: scheduledDateTime,
          meetingType,
          meetingLink: meetingType === 'video' ? `https://meet.google.com/mock-id-${Math.random().toString(36).substring(7)}` : null,
          status: "pending",
          paymentStatus: "paid",
          createdAt: serverTimestamp(),
        });
      }

      navigate("/appointments");
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "consultations");
    } finally {
      setIsBooking(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-prestige-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 text-accent-indigo animate-spin mx-auto" />
          <p className="text-prestige-400 font-black uppercase tracking-widest text-xs">{t("loadingProfile")}</p>
        </div>
      </div>
    );
  }

  if (!lawyer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-prestige-50">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 bg-prestige-100 rounded-full flex items-center justify-center mx-auto text-prestige-300">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h2 className="text-3xl font-black text-prestige-950">{t("expertNotFound")}</h2>
          <button 
            onClick={() => navigate("/appointments")}
            className="px-8 py-3 bg-accent-indigo text-white rounded-xl font-bold hover:bg-prestige-950 transition-all"
          >
            Return to Appointments
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-prestige-50/30 pb-20">
      {/* Header / Cover */}
      <div className="relative h-[300px] bg-prestige-950 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-prestige-950 via-prestige-950/40 to-transparent z-10" />
        <img 
          src={lawyer.image} 
          alt="cover" 
          className="w-full h-full object-cover opacity-30 blur-sm scale-110 px-0"
        />
        
        <div className="container mx-auto px-6 relative z-20 h-full flex items-end pb-12">
          <button 
            onClick={() => navigate(-1)}
            className={cn(
              "absolute top-8 p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-all border border-white/10",
              isRtl ? "right-6" : "left-6"
            )}
          >
            <ArrowLeft className={cn("w-5 h-5", isRtl && "rotate-180")} />
          </button>
        </div>
      </div>

      <div className="container mx-auto px-6 -mt-24 relative z-30">
        <div className="grid lg:grid-cols-3 gap-10">
          
          {/* Sidebar / Profile Info */}
          <div className="space-y-8">
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-prestige-100 shadow-2xl shadow-prestige-900/5 text-center"
            >
              <div className="relative inline-block mb-6">
                <div className="w-40 h-40 rounded-[2.5rem] overflow-hidden border-4 border-prestige-50 mx-auto shadow-xl">
                  <img src={lawyer.image} alt={lawyer.name} className="w-full h-full object-cover" />
                </div>
                {lawyer.isVerified && (
                  <div className={cn(
                    "absolute -bottom-2 bg-accent-gold p-2 rounded-xl shadow-lg border-2 border-white",
                    isRtl ? "-left-2" : "-right-2"
                  )}>
                    <CheckCircle2 className="w-5 h-5 text-prestige-950" />
                  </div>
                )}
              </div>
              
              <h1 className="text-3xl font-black text-prestige-950 tracking-tighter mb-2">{lawyer.name}</h1>
              <p className="text-accent-indigo font-black uppercase tracking-widest text-[10px] bg-accent-indigo/5 inline-block px-3 py-1 rounded-full mb-6">
                {lawyer.specialization}
              </p>

              <div className="flex items-center justify-center gap-8 py-6 border-y border-prestige-50 my-6">
                <div className="text-center">
                  <div className="flex items-center gap-1 mb-1">
                    <Star className="w-4 h-4 text-accent-gold fill-accent-gold" />
                    <span className="text-lg font-black text-prestige-950">{lawyer.rating}</span>
                  </div>
                  <span className="text-[10px] font-bold text-prestige-400 uppercase tracking-widest">{lawyer.reviews} {t("reviewCount")}</span>
                </div>
                <div className="w-px h-10 bg-prestige-50" />
                <div className="text-center">
                  <div className="text-lg font-black text-prestige-950 mb-1">{lawyer.experience || "10+ Years"}</div>
                  <span className="text-[10px] font-bold text-prestige-400 uppercase tracking-widest">{t("experienceLabel")}</span>
                </div>
              </div>

              <div className="space-y-6 pt-6 border-t border-prestige-50">
                <div className="space-y-4 overflow-hidden">
                  <label className="text-[10px] font-black uppercase tracking-widest text-prestige-400 block text-start">1. {t("chooseDate")}</label>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-2 px-2 no-scrollbar">
                    {upcomingDays.map((dateStr) => {
                      const d = new Date(dateStr);
                      const dayNameShort = d.toLocaleDateString(isRtl ? 'ar-AE' : 'en-US', { weekday: 'short' });
                      const dayNameLong = d.toLocaleDateString('en-US', { weekday: 'long' });
                      const dayNum = d.toLocaleDateString(isRtl ? 'ar-AE' : 'en-US', { day: 'numeric' });
                      const month = d.toLocaleDateString(isRtl ? 'ar-AE' : 'en-US', { month: 'short' });
                      const isOffDay = lawyer?.offDays?.includes(dayNameLong) || lawyer?.isOOO;
                      const isSelected = selectedDate === dateStr;

                      return (
                        <button
                          key={dateStr}
                          type="button"
                          disabled={isOffDay}
                          onClick={() => {
                            setSelectedDate(dateStr);
                            setSelectedTime("");
                          }}
                          className={cn(
                            "min-w-[72px] shrink-0 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all border",
                            isSelected 
                              ? "bg-accent-indigo text-white border-accent-indigo shadow-lg shadow-accent-indigo/20" 
                              : isOffDay 
                                ? "bg-prestige-50 border-prestige-100 text-prestige-300 opacity-50 cursor-not-allowed" 
                                : "bg-white text-prestige-900 border-prestige-100 hover:border-accent-indigo"
                          )}
                        >
                          <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">{dayNameShort}</span>
                          <span className="text-xl font-black leading-none">{dayNum}</span>
                          <span className="text-[10px] font-bold opacity-80">{month}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Calendar className="w-4 h-4 text-prestige-400" />
                    <input 
                      type="date" 
                      min={today}
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setSelectedTime(""); 
                      }}
                      className="bg-transparent border-none text-[10px] font-bold text-prestige-600 outline-none flex-1 max-w-[120px] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-prestige-400 block text-start">2. {t("chooseTime")}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {timeSlots.length > 0 ? (
                      timeSlots.map((time) => {
                        const disabled = selectedDate === today && isTimeInPast(selectedDate, time);
                        return (
                          <button
                            key={time}
                            type="button"
                            disabled={disabled || !selectedDate}
                            onClick={() => setSelectedTime(time)}
                            className={cn(
                              "py-2.5 px-2 rounded-xl text-[10px] font-black transition-all border",
                              selectedTime === time 
                                ? "bg-accent-indigo text-white border-accent-indigo shadow-lg shadow-accent-indigo/20" 
                                : "bg-white text-prestige-600 border-prestige-100 hover:border-accent-indigo disabled:opacity-30 disabled:cursor-not-allowed"
                            )}
                          >
                            {time}
                          </button>
                        );
                      })
                    ) : (
                      <div className="col-span-2 py-8 bg-amber-50 rounded-2xl border border-amber-100 flex flex-col items-center justify-center gap-2">
                        <Coffee className="w-8 h-8 text-amber-500 animate-pulse" />
                        <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest text-center">
                          {t("noSlotsAvailable") || "No slots available."} <br/> {lawyer?.isOOO ? t("oooToggle") : t("selectArchiveDesc")}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-prestige-400 block text-start">3. {t("consultationType")}</label>
                  <div className="flex bg-prestige-50 p-1 rounded-2xl border border-prestige-100">
                    <button 
                      onClick={() => setMeetingType('video')}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 transition-all",
                        meetingType === 'video' ? "bg-white text-accent-indigo shadow-sm" : "text-prestige-400"
                      )}
                    >
                      <ShieldCheck className="w-4 h-4" /> {t("videoCall")}
                    </button>
                    <button 
                      onClick={() => setMeetingType('in-person')}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-[10px] font-black flex items-center justify-center gap-2 transition-all",
                        meetingType === 'in-person' ? "bg-white text-accent-indigo shadow-sm" : "text-prestige-400"
                      )}
                    >
                      <MapPin className="w-4 h-4" /> {t("inPerson")}
                    </button>
                  </div>
                  {meetingType === 'video' && (
                    <div className="flex items-center gap-3 p-3 bg-accent-indigo/5 rounded-xl border border-accent-indigo/10 animate-in fade-in slide-in-from-top-1">
                      <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
                        <img src="https://www.gstatic.com/images/branding/product/2x/meet_48dp.png" alt="Meet" className="w-5 h-5" />
                      </div>
                      <p className="text-[9px] font-bold text-accent-indigo leading-tight text-start">
                        {t("meetLinkNote")}
                      </p>
                    </div>
                  )}
                </div>

                <div className={cn(
                  "flex items-center justify-between px-6 py-5 bg-prestige-950 text-white rounded-3xl border border-white/10 shadow-2xl shadow-prestige-950/20",
                  isRtl && "flex-row-reverse"
                )}>
                  <div className="text-start">
                    <span className="text-[10px] font-black uppercase tracking-widest text-prestige-400 block mb-1">{t("finalTotal")}</span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black">{lawyer.price}</span>
                      <span className="text-xs font-bold text-accent-gold uppercase tracking-[0.2em]">{t("currency")}</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleBook}
                    disabled={isBooking || !selectedDate || !selectedTime}
                    className="px-8 py-4 bg-accent-gold text-prestige-950 rounded-2xl font-black hover:bg-white transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50 disabled:grayscale"
                  >
                    {isBooking ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calendar className="w-5 h-5" />}
                    {rescheduleId ? "Reschedule Consultation" : t("bookNow")}
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Qualifications */}
            <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-prestige-100 shadow-xl shadow-prestige-900/5 space-y-6 text-start">
               <h3 className="text-sm font-black uppercase tracking-widest text-prestige-900 flex items-center gap-3">
                 <GraduationCap className="w-5 h-5 text-accent-gold" /> {t("education")}
               </h3>
               <ul className="space-y-4">
                 {(lawyer.education || ["Zayed University, LLB"]).map((edu, i) => (
                   <li key={i} className="flex gap-4">
                      <div className="w-1.5 h-1.5 bg-prestige-200 rounded-full mt-2 shrink-0" />
                      <span className="text-sm text-prestige-600 font-medium leading-relaxed">{edu}</span>
                   </li>
                 ))}
               </ul>
            </div>

            {/* Languages */}
            <div className="bg-white p-6 md:p-8 rounded-[2rem] md:rounded-[3rem] border border-prestige-100 shadow-xl shadow-prestige-900/5 space-y-6 text-start">
               <h3 className="text-sm font-black uppercase tracking-widest text-prestige-900 flex items-center gap-3">
                 <Languages className="w-5 h-5 text-accent-gold" /> {t("languages")}
               </h3>
               <div className="flex flex-wrap gap-2">
                 {(lawyer.languages || ["Arabic", "English"]).map((lang, i) => (
                   <span key={i} className="px-4 py-2 bg-prestige-50 border border-prestige-100 rounded-xl text-xs font-bold text-prestige-600">
                     {lang}
                   </span>
                 ))}
               </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8 text-start">
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border border-prestige-100 shadow-xl shadow-prestige-900/5 space-y-8"
            >
              <div className="space-y-6">
                <h2 className="text-4xl font-black text-prestige-950 tracking-tighter leading-none">
                  {t("professional")} <span className="text-accent-gold italic serif font-normal">{t("biography")}</span>
                </h2>
                <p className="text-lg text-prestige-500 font-medium leading-relaxed">
                  {lawyer.bio}
                </p>
                <p className="text-prestige-500 font-medium leading-relaxed">
                  {isRtl 
                    ? "مع فهم عميق للممارسات القياسية في دولة الإمارات العربية المتحدة واللوائح المحلية، أقدم دعماً قانونياً استراتيجياً مخصصاً للاحتياجات الفريدة لكل عميل. يعتمد نهجي على النتائج، مع التركيز على الامتثال والكفاءة والنزاهة المهنية."
                    : "With a deep understanding of standard UAE practices and local regulations, I provide strategic legal support tailored to the unique needs of each client. My approach is results-oriented, focusing on compliance, efficiency, and professional integrity."
                  }
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-6 pt-10 border-t border-prestige-50">
                 {isRtl ? [
                   "معتمد من وزارة العدل الإماراتية",
                   "خبير في اللوائح المحلية والاتحادية",
                   "أخصائي حل النزاعات",
                   "مرخص لجميع محاكم الإمارات"
                 ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4 group">
                       <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                         <Check className="w-5 h-5" />
                       </div>
                       <span className="text-sm text-prestige-900 font-extrabold tracking-tight">{item}</span>
                    </div>
                  )) : [
                   "Certified by UAE Ministry of Justice",
                   "Expert in Local & Federal Regulations",
                   "Dispute Resolution Specialist",
                   "Licensed for All Emirates Courts"
                 ].map((item, i) => (
                   <div key={i} className="flex items-center gap-4 group">
                      <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                        <Check className="w-5 h-5" />
                      </div>
                      <span className="text-sm text-prestige-900 font-extrabold tracking-tight">{item}</span>
                   </div>
                 ))}
              </div>
            </motion.div>

            {/* Reviews Section */}
            <div className="bg-white p-8 md:p-12 rounded-[2.5rem] md:rounded-[4rem] border border-prestige-100 shadow-xl shadow-prestige-900/5 space-y-12">
               <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-black text-prestige-950 tracking-tighter leading-none">
                    {t("client")} <span className="text-accent-indigo italic serif font-normal">{t("clientFeedback").split("Feedback")[1] || "Feedback"}</span>
                  </h2>
                  <div className="flex items-center gap-2 px-5 py-2 bg-accent-gold/10 rounded-full border border-accent-gold/20">
                     <Star className="w-4 h-4 text-accent-gold fill-accent-gold" />
                     <span className="text-sm font-black text-accent-gold">{lawyer.rating} Average Rating</span>
                  </div>
               </div>

               <div className="space-y-8">
                 {(lawyer.reviewList || []).map((review, i) => (
                   <div key={review.id} className="space-y-6 p-8 bg-prestige-50 rounded-[2.5rem] border border-prestige-100 hover:border-accent-indigo transition-all duration-500">
                      <div className={cn("flex items-center justify-between", isRtl && "flex-row-reverse")}>
                        <div className={cn("flex items-center gap-4", isRtl && "flex-row-reverse")}>
                           <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white shadow-md">
                             <img src={review.userImage} alt={review.userName} className="w-full h-full object-cover" />
                           </div>
                           <div className={cn(isRtl && "text-right")}>
                             <h4 className="font-black text-prestige-950 leading-tight">{review.userName}</h4>
                             <span className="text-[10px] font-bold text-prestige-400 uppercase tracking-widest">{review.date}</span>
                           </div>
                        </div>
                        <div className="flex items-center gap-1">
                           {[...Array(5)].map((_, idx) => (
                             <Star 
                               key={idx} 
                               className={cn(
                                 "w-3.5 h-3.5",
                                 idx < review.rating ? "text-accent-gold fill-accent-gold" : "text-prestige-200 fill-prestige-100"
                               )} 
                             />
                           ))}
                        </div>
                      </div>
                      <p className={cn("text-prestige-600 font-medium leading-relaxed italic", isRtl && "text-right")}>
                        "{review.comment}"
                      </p>
                   </div>
                 ))}
               </div>

               <button className="w-full py-4 border-2 border-dashed border-prestige-200 rounded-[2rem] text-prestige-400 font-black uppercase tracking-widest text-xs hover:border-accent-indigo hover:text-accent-indigo transition-all flex items-center justify-center gap-2">
                 <MessageSquare className="w-4 h-4" /> {t("loadMoreReviews")}
               </button>
            </div>
          </div>

        </div>
      </div>

      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowConfirm(false)}
              className="absolute inset-0 bg-prestige-950/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[3rem] p-10 border border-prestige-100 shadow-2xl text-center space-y-8"
            >
              <div className="w-20 h-20 bg-accent-gold/10 rounded-[2rem] flex items-center justify-center mx-auto text-accent-gold">
                <Calendar className="w-10 h-10" />
              </div>
              
              <div className="space-y-4">
                <h3 className="text-3xl font-black text-prestige-950 tracking-tighter">{t("confirmBooking").split("Booking")[0]} <span className="text-accent-indigo italic serif font-normal">{t("scheduling") || "Booking"}</span></h3>
                <p className="text-prestige-500 font-medium leading-relaxed">
                  {rescheduleId ? "Reschedule your consultation with " : t("bookConsultationWith")} <span className="text-prestige-950 font-bold">{lawyer.name}</span> {isRtl ? "مقابل" : "for"} <span className="text-accent-indigo font-bold">{lawyer.price} {t("currency")}</span>?
                </p>
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-[10px] font-bold text-emerald-700 flex items-center gap-3 text-start">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  {t("meetLinkSharedNote")}
                </div>
                <div className="p-4 bg-prestige-50 rounded-2xl text-start space-y-2 border border-prestige-100">
                  <div className={cn("flex justify-between text-[10px] font-black uppercase tracking-widest text-prestige-400", isRtl && "flex-row-reverse")}>
                    <span>{t("lawyer")}</span>
                    <span>{lawyer.name}</span>
                  </div>
                  <div className={cn("flex justify-between text-[10px] font-black uppercase tracking-widest text-prestige-400", isRtl && "flex-row-reverse text-right")}>
                    <span>{t("schedule")}</span>
                    <span className="text-prestige-950">{selectedDate} {isRtl ? "في" : "at"} {selectedTime}</span>
                  </div>
                  <div className={cn("flex justify-between text-[10px] font-black uppercase tracking-widest text-prestige-400", isRtl && "flex-row-reverse")}>
                    <span>{t("type")}</span>
                    <span className="text-accent-indigo">{meetingType === 'video' ? t("videoCall") : t("inPerson")}</span>
                  </div>
                  <div className={cn("flex justify-between text-[10px] font-black uppercase tracking-widest text-prestige-400 pt-2 border-t border-prestige-100 mt-2", isRtl && "flex-row-reverse")}>
                    <span>{t("finalTotal")}</span>
                    <span className="text-prestige-950 font-black">{lawyer.price} {t("currency")}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <button 
                  onClick={() => setShowConfirm(false)}
                  className="px-6 py-4 bg-prestige-100 text-prestige-600 rounded-2xl font-black hover:bg-prestige-200 transition-all active:scale-95"
                >
                  {t("back")}
                </button>
                <button 
                  onClick={confirmBooking}
                  className="px-6 py-4 bg-prestige-950 text-white rounded-2xl font-black hover:bg-accent-indigo transition-all shadow-xl shadow-prestige-950/20 active:scale-95"
                >
                  {t("authorize")}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
