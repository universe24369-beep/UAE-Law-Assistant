import React, { useState, useEffect, useRef } from "react";
import { HashRouter, Routes, Route, useNavigate, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import { format } from "date-fns";
import { Search, MessageSquare, Scale, Users, Gavel, ShieldCheck, ArrowRight, Send, Loader2, Calendar, CheckCircle2, Briefcase, Mic, MicOff, Volume2, VolumeX, FileText, X, Paperclip, Camera, Image as ImageIcon, RefreshCw, Star, Filter, Tag, ChevronDown, DollarSign, MapPin, Zap } from "lucide-react";
import { motion, AnimatePresence } from "./lib/motion-shim";
import { getLegalAdvice, getLawyerCoPilotAdvice } from "./services/legalService";
import { searchLocalLegislation, formatLawsForContext } from "./services/legislationService";
import { getLawyers, Lawyer, getLawyerByUserId } from "./services/lawyerService";
import ReactMarkdown from "react-markdown";
import LawyerCard from "./components/LawyerCard";
import { cn } from "./lib/utils";
import { db, signInWithGoogle, handleFirestoreError, OperationType } from "./lib/firebase";
import { collection, addDoc, query, where, getDocs, onSnapshot, orderBy, serverTimestamp, updateDoc, doc, setDoc } from "firebase/firestore";
import { useLanguage } from "./contexts/LanguageContext";
import { extractTextFromPdf } from "./lib/pdfUtils";
import { transcribeAudioText, generateSpeechTTS, playPCM16Audio } from "./services/audioService";
import History from "./pages/History";
import { UserProvider, useUser } from "./contexts/UserContext";
import LawyerProfile from "./pages/LawyerProfile";
import LawyerRegistration from "./pages/LawyerRegistration";
import LawyerDashboard from "./pages/LawyerDashboard";
import LawyerAssistant from "./pages/LawyerAssistant";
import Management from "./pages/Management";
import Support from "./pages/Support";
import Legislation from "./pages/Legislation";
import LawyersPage from "./pages/LawyersPage";

import LawyerSettings from "./pages/LawyerSettings";

function Home() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const { user, lawyerProfile, loading } = useUser();
  const { t, isRtl } = useLanguage();

  // Redirect lawyers to dashboard automatically
  useEffect(() => {
    if (!loading && user && lawyerProfile) {
      navigate("/dashboard");
    }
  }, [user, lawyerProfile, loading, navigate]);

  return (
    <div className="space-y-32 pb-32">
      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-prestige-950">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&q=80&w=2000" 
            className="w-full h-full object-cover opacity-30 mix-blend-overlay scale-110 motion-safe:animate-[pulse_10s_infinite]"
            alt="Dubai skyline"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-prestige-950 via-prestige-950/80 to-transparent" />
        </div>
        
        <div className={cn(
          "container mx-auto px-6 relative z-10 items-center",
          lawyerProfile ? "flex flex-col text-center" : "grid lg:grid-cols-2 gap-20"
        )}>
          <motion.div 
            initial={{ opacity: 0, x: isRtl ? 50 : -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={cn("space-y-10", lawyerProfile && "flex flex-col items-center")}
          >
            <div className={cn("space-y-4", lawyerProfile && "max-w-3xl mx-auto")}>
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-accent-gold/20 rounded-full border border-accent-gold/30 backdrop-blur-md">
                <ShieldCheck className="w-4 h-4 text-accent-gold" />
                <span className="text-[10px] font-black text-accent-gold uppercase tracking-[0.2em]">
                  {lawyerProfile ? t("professionalEnvironment") : t("verifiedLaws").toUpperCase()}
                </span>
              </span>
              <h1 className="text-5xl md:text-8xl font-black leading-[0.9] tracking-tighter text-white">
                {!lawyerProfile ? (
                   <>
                    {t("heroTitle")}
                    <br />
                    <span className="text-accent-gold italic serif font-normal">Huqiqiyy</span>
                   </>
                ) : (
                  <>
                    <span className="text-accent-gold italic serif font-normal">{t("aiCoPilot")}</span>
                  </>
                )}
              </h1>
              <p className="text-lg md:text-xl text-prestige-300 max-w-xl font-medium leading-relaxed">
                {lawyerProfile 
                   ? t("aiCoPilotDesc")
                   : "Instant, verified legal analysis based on Federal and Local UAE legislation. Navigate your matters with confidence."}
              </p>
            </div>
            
            <div className={cn("flex flex-col sm:flex-row gap-3 md:gap-4", lawyerProfile && "justify-center w-full")}>
              {lawyerProfile ? (
                <div className="flex flex-col items-center gap-8 w-full">
                  <button 
                    onClick={() => navigate("/assistant")}
                    className="px-8 md:px-10 py-4 md:py-5 bg-accent-gold text-prestige-950 rounded-2xl font-black hover:bg-white transition-all flex items-center justify-center gap-3 text-sm shadow-2xl shadow-accent-gold/20 active:scale-95 group"
                  >
                    <Zap className="w-5 h-5 fill-current group-hover:animate-pulse" />
                    {t("launchAIStrategicAssociate")}
                  </button>

                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="w-full max-w-sm bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 text-start"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-[10px] font-black text-accent-gold uppercase tracking-widest">{t("upcomingAppointment")}</h4>
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                        <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[8px] font-bold text-emerald-500">{t("confirmed")}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-accent-blue/20 flex flex-col items-center justify-center border border-accent-blue/30">
                        <span className="text-[10px] font-black text-accent-blue">APR</span>
                        <span className="text-lg font-black text-white leading-none">29</span>
                      </div>
                      <div className={cn(isRtl && "text-right")}>
                        <p className="text-sm font-bold text-white tracking-tight">{isRtl ? "العميل: سارة المكتوم" : "Client: Sarah Al-Maktoum"}</p>
                        <p className="text-xs text-prestige-400">14:00 • {t("commercialLeaseReview")}</p>
                      </div>
                      <button className={cn("w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all", isRtl ? "mr-auto" : "ml-auto")}>
                        <ArrowRight className={cn("w-4 h-4", isRtl && "rotate-180")} />
                      </button>
                    </div>
                  </motion.div>
                </div>
              ) : (
                <>
                  <button 
                    onClick={() => navigate("/assistant")}
                    className="px-8 md:px-10 py-4 md:py-5 bg-white text-prestige-950 rounded-2xl font-black hover:bg-accent-gold transition-all flex items-center justify-center gap-3 text-sm shadow-2xl shadow-white/5 active:scale-95"
                  >
                    Open Copilot <ArrowRight className={cn("w-5 h-5", isRtl && "rotate-180")} />
                  </button>
                </>
              )}
            </div>
          </motion.div>

          {lawyerProfile ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mt-20 w-full max-w-5xl mx-auto"
            >
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-accent-gold via-accent-indigo to-accent-gold rounded-[3rem] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
                <div className="relative bg-prestige-900/40 backdrop-blur-3xl border border-white/10 p-8 md:p-12 rounded-[3rem] shadow-2xl overflow-hidden">
                  <div className="grid md:grid-cols-3 gap-8">
                    {[
                      { 
                        title: t("regulatoryIntelligence"), 
                        desc: t("regulatoryIntelligenceDesc"),
                        icon: Search,
                        color: "text-accent-gold"
                      },
                      { 
                        title: t("technicalDrafting"), 
                        desc: t("technicalDraftingDesc"),
                        icon: FileText,
                        color: "text-accent-indigo"
                      },
                      { 
                        title: t("proceduralClarity"), 
                        desc: t("proceduralClarityDesc"),
                        icon: Gavel,
                        color: "text-emerald-500"
                      }
                    ].map((item, idx) => (
                      <div key={idx} className="space-y-4 text-start">
                        <div className={cn("w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center", item.color)}>
                          <item.icon className="w-6 h-6" />
                        </div>
                        <h4 className="text-lg font-black text-white tracking-tight">{item.title}</h4>
                        <p className="text-sm text-prestige-400 font-medium leading-relaxed">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="absolute -inset-10 bg-accent-indigo/20 blur-[120px] rounded-full" />
              <div className="relative bg-white/10 backdrop-blur-3xl border border-white/20 p-8 rounded-[3rem] shadow-2xl">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                          <span className="text-[10px] font-black text-white/50 uppercase tracking-widest">{t("globalLegalSync")}</span>
                        </div>
                        <div className="flex -space-x-2">
                          {[1,2,3].map(i => (
                            <div key={i} className="w-6 h-6 rounded-full border-2 border-prestige-900 bg-prestige-800 flex items-center justify-center overflow-hidden">
                                <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="user" />
                            </div>
                          ))}
                        </div>
                    </div>
                    <div className="h-[200px] flex flex-col justify-end space-y-4">
                        <div className="self-start bg-white/5 p-3 rounded-2xl rounded-bl-none text-xs text-white/80 max-w-[80%] border border-white/5">
                          Ask me about UAE Labor Law or Commercial regulations.
                        </div>
                        <div className="self-end bg-accent-indigo p-3 rounded-2xl rounded-br-none text-xs text-white max-w-[80%] shadow-xl shadow-accent-indigo/20">
                          What are the latest changes in the UAE Real Estate law 2024?
                        </div>
                    </div>
                    <div className="pt-4">
                        <div className="relative">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                          <input 
                            type="text" 
                            placeholder={t("typeMessage")}
                            className="w-full bg-white/10 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm outline-none focus:bg-white/20 transition-all placeholder:text-white/20"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && navigate(`/assistant?q=${searchQuery}`)}
                          />
                        </div>
                    </div>
                  </div>
              </div>
            </motion.div>
          )}
        </div>
      </section>

      {/* Features Grid */}
      {!lawyerProfile && (
        <section className="container mx-auto px-6">
          <div className="text-center space-y-6 mb-24">
            <h2 className="text-4xl md:text-5xl font-extrabold text-prestige-950 tracking-tighter">{t("howItWorks")}</h2>
            <p className="text-prestige-500 max-w-2xl mx-auto text-lg font-medium leading-relaxed">A secure workspace for legal research, drafting, and case analysis powered by vertical AI.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: MessageSquare, title: "Research Answers", desc: "Summarize UAE laws with direct article-level references and structured citations." },
              { icon: ShieldCheck, title: "Verified Sources", desc: "Work from verified legislation, matter notes, and trusted legal references." },
              { icon: Gavel, title: "Secure Workflows", desc: "Manage internal research sessions and team analysis in one private workspace." }
            ].map((f, i) => (
              <motion.div 
                key={i} 
                whileHover={{ y: -10 }}
                className="bg-white p-12 rounded-[3rem] border border-prestige-100 hover:border-accent-gold hover:shadow-2xl hover:shadow-accent-gold/10 transition-all duration-500 space-y-8"
              >
                <div className="w-16 h-16 bg-prestige-50 rounded-[1.25rem] flex items-center justify-center text-accent-gold border border-prestige-100">
                  <f.icon className="w-8 h-8" />
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl font-extrabold text-prestige-950 tracking-tight leading-none">{f.title}</h3>
                  <p className="text-base text-prestige-500 leading-relaxed font-medium">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Statistics */}
      {!lawyerProfile && (
        <section className="container mx-auto px-6">
          <div className="bg-prestige-950 py-24 rounded-[4rem] text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent-gold/10 blur-[150px] -mr-64 -mt-64" />
            <div className="container mx-auto px-12 grid grid-cols-2 md:grid-cols-4 gap-12 text-center relative z-10">
              {[
                { label: t("verifiedLaws"), val: "5,000+" },
                { label: t("expertLawyers"), val: "150+" },
                { label: isRtl ? "استشارات" : "Consultations", val: "12k+" },
                { label: isRtl ? "تقييم العملاء" : "Client Rating", val: "4.9/5" }
              ].map((s, i) => (
                <div key={i} className="space-y-4">
                  <div className="text-5xl font-black text-accent-gold tracking-tighter">{s.val}</div>
                  <div className="text-[11px] text-prestige-400 uppercase tracking-[0.3em] font-black">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function Assistant() {
  const navigate = useNavigate();
  const { t, language, isRtl } = useLanguage();
  const { user, lawyerProfile, loading } = useUser();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string, timestamp: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [pdfContent, setPdfContent] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    // Disabled pull-to-refresh as it was causing UX issues and clearing chat accidentally
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Disabled pull-to-refresh
  };

  const handleTouchEnd = () => {
    // Disabled pull-to-refresh
  };

  const handleReload = () => {
    setIsRefreshing(true);
    setMessages([]);
    setAttachedFile(null);
    setCurrentChatId(null);
    setAttachedImage(null);
    setPdfContent(null);
    setInput("");
    setMicError(null);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const isSending = useRef(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        try { mediaRecorderRef.current.stop(); } catch (e) {}
      }
      if (currentAudioSourceRef.current) {
        try { currentAudioSourceRef.current.stop(); } catch (e) {}
      }
    };
  }, []);

  const toggleListening = async () => {
    if (isListening) {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsListening(false);
    } else {
      setMicError(null);
      audioChunksRef.current = [];

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          stream.getTracks().forEach(track => track.stop());
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          audioChunksRef.current = [];

          if (audioBlob.size > 1000) {
            try {
              setIsLoading(true);
              const reader = new FileReader();
              reader.readAsDataURL(audioBlob);
              reader.onloadend = async () => {
                const base64Audio = reader.result as string;
                try {
                  const transcribedText = await transcribeAudioText(base64Audio, 'audio/webm', language);
                  if (transcribedText.trim()) {
                    setInput(transcribedText);
                    handleSend(transcribedText);
                  }
                } catch (transcribeError) {
                  console.error("STT Error:", transcribeError);
                  setMicError("Could not transcribe audio.");
                } finally {
                  setIsLoading(false);
                }
              };
            } catch (err) {
              setIsLoading(false);
              console.error("Blob to base64 error", err);
            }
          }
        };

        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsListening(true);
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message?.includes('allowed')) {
          setMicError("Microphone access blocked. Please allow it in browser settings or use 'Open in New Tab'.");
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError' || err.message?.includes('not found')) {
          setMicError("Microphone not found. Please connect a mic or check system settings.");
        } else {
          console.warn("Mic pre-flight info:", err.message || err);
          setMicError("Microphone error: " + (err.message || "Unknown issue"));
        }
      }
    }
  };

  const speak = async (text: string) => {
    if (!voiceEnabled) return;
    
    if (currentAudioSourceRef.current) {
        try { currentAudioSourceRef.current.stop(); } catch (e) {}
    }

    try {
        const base64TTS = await generateSpeechTTS(text, language);
        if (base64TTS) {
             const source = await playPCM16Audio(base64TTS, 24000);
             currentAudioSourceRef.current = source;
        }
    } catch (err) {
        console.error("TTS Error:", err);
        // Fallback to browser TTS if Gemini fails
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = language === 'ar' ? 'ar-SA' : 'en-US';
        window.speechSynthesis.speak(utterance);
    }
  };

  useEffect(() => {
    if (!lawyerProfile) return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q && !isSending.current) {
      handleSend(q);
    }
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      try {
        setIsExtracting(true);
        setAttachedFile(file);
        const text = await extractTextFromPdf(file);
        setPdfContent(text);
      } catch (error) {
        console.error("PDF Error:", error);
        alert("Could not process PDF. Please try another file.");
      } finally {
        setIsExtracting(false);
      }
    }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedImage(reader.result as string);
        setAttachedFile(null); // Clear PDF if image is selected
        setPdfContent(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeFile = () => {
    setAttachedFile(null);
    setAttachedImage(null);
    setPdfContent(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSend = async (text: string = input) => {
    if ((!text.trim() && !pdfContent) || isLoading || isSending.current) return;
    
    // Safety check - block harmful or off-topic queries
    const harmfulPatterns = [/kill/i, /murder/i, /suicide/i, /assassinate/i, /how to commit a crime/i];
    const offTopicPatterns = [/recipe/i, /weather/i, /movie/i, /music/i];

    if (harmfulPatterns.some(pattern => pattern.test(text)) || offTopicPatterns.some(pattern => pattern.test(text))) {
      const now = Date.now();
      const message = harmfulPatterns.some(pattern => pattern.test(text))
        ? "I cannot assist with this request."
        : "This inquiry appears to be outside the scope of this legal assistance platform. I am designed to help with legal research and analysis. Please feel free to ask a question related to UAE law or legal documentation.";
      
      setMessages(prev => [...prev, { role: 'user', text: text, timestamp: now }, { role: 'model', text: message, timestamp: now + 1 }]);
      return;
    }
    
    setMicError(null);
    isSending.current = true;
    setInput("");
    
    const userMessage = attachedFile 
      ? `${text}\n\n[Attached Document: ${attachedFile.name}]`
      : attachedImage
        ? `${text}\n\n[Attached Image]`
        : text;

    const now = Date.now();
    setMessages(prev => [...prev, { role: 'user', text: userMessage, timestamp: now }]);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ 
        role: m.role === 'user' ? 'user' : 'model', 
        text: m.text 
      }));

      // Combine input with PDF content if available
      let fullPrompt = text;
      if (pdfContent) {
        fullPrompt = `I have attached a legal document for analysis. 
        DOCUMENT CONTENT:
        ${pdfContent}
        
        USER QUESTION:
        ${text || "Please analyze this document and summarize the key legal points."}`;
      }

      // Perform RAG search
      const localLaws = await searchLocalLegislation(text || "legal document analysis");
      const context = formatLawsForContext(localLaws);

      const advice = lawyerProfile 
        ? await getLawyerCoPilotAdvice(fullPrompt, history, context, language)
        : await getLegalAdvice(fullPrompt, history, context, language, attachedImage || undefined);
        
      const assistantNow = Date.now();
      setMessages(prev => [...prev, { role: 'model', text: advice, timestamp: assistantNow }]);
      
      if (voiceEnabled) {
        speak(advice);
      }

      // Clear the file after sending
      removeFile();

      // Save to Firestore if logged in
      if (user) {
        const baseData = {
          userId: user.uid,
          messages: [...messages, { role: 'user', text: userMessage, timestamp: now }, { role: 'model', text: advice, timestamp: assistantNow }],
          updatedAt: serverTimestamp(),
        };

        const path = "ai_conversations";
        try {
          if (currentChatId) {
            await updateDoc(doc(db, path, currentChatId), baseData);
          } else {
            const docRef = await addDoc(collection(db, path), {
              ...baseData,
              createdAt: serverTimestamp()
            });
            setCurrentChatId(docRef.id);
          }
        } catch (err) {
          handleFirestoreError(err, currentChatId ? OperationType.UPDATE : OperationType.CREATE, path);
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      if (error instanceof Error && error.message.includes("unavailable")) {
        setIsOnline(false);
        setMicError("Cloud synchronization paused (Offline)");
      }
    } finally {
      setIsLoading(false);
      isSending.current = false;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden">
      <motion.div 
        className="absolute top-0 left-0 right-0 flex justify-center py-4 pointer-events-none z-10"
        style={{ opacity: pullDistance / 60, y: pullDistance - 40 }}
      >
        <RefreshCw className={cn("w-6 h-6 text-emerald-600", isRefreshing && "animate-spin")} />
      </motion.div>

      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-8 space-y-6 pb-52 chat-container touch-pan-y"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-12 opacity-100 py-12">
            <div className="p-8 bg-accent-indigo rounded-[2rem] text-white shadow-2xl shadow-accent-indigo/20 relative">
              <MessageSquare className="w-12 h-12" />
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-accent-gold rounded-full flex items-center justify-center shadow-lg">
                <ShieldCheck className="w-4 h-4 text-prestige-950" />
              </div>
            </div>
            <div className="space-y-4 max-w-2xl px-6">
              <h2 className="text-4xl md:text-5xl font-black text-prestige-950 tracking-tighter leading-tight">
                {t("askAssistant")}
              </h2>
              <p className="text-lg text-prestige-500 font-medium leading-relaxed">
                {isRtl 
                  ? "صِغ المسألة كإشكال قانوني أو مهمة بحث أو صياغة للحصول على تحليل مهني دقيق."
                  : "Frame the matter as a legal issue, research question, or drafting task for a technical memo-style analysis."
                }
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-3xl px-6">
              {[
                {q: language === 'en' ? "Draft an issue tree for termination claims under UAE Labour Law." : "أعد شجرة مسائل لدعوى إنهاء العلاقة العمالية بموجب قانون العمل الإماراتي.", icon: ShieldCheck},
                {q: language === 'en' ? "Compare mainland, DIFC, and ADGM jurisdiction for a contract dispute." : "قارن الاختصاص بين البر الرئيسي وDIFC وADGM في نزاع عقدي.", icon: Briefcase},
                {q: language === 'en' ? "Map the limitation periods and filing deadlines for a civil claim in Dubai." : "حدّد مدد التقادم ومواعيد رفع الدعوى المدنية في دبي.", icon: Scale},
                {q: language === 'en' ? "Draft a memo on inheritance exposure for an expat with assets in the UAE." : "أعد مذكرة حول مخاطر الميراث لمقيم أجنبي لديه أصول في الإمارات.", icon: Users}
              ].map(item => (
                <button 
                  key={item.q} 
                  onClick={() => handleSend(item.q)}
                  className="p-6 bg-white border border-prestige-100 rounded-3xl hover:border-accent-indigo hover:shadow-2xl hover:shadow-accent-indigo/10 transition-all text-left group flex items-start gap-4"
                >
                  <div className="w-8 h-8 rounded-full bg-prestige-50 flex items-center justify-center text-prestige-400 group-hover:bg-accent-indigo/10 group-hover:text-accent-indigo transition-colors shrink-0">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <span className="text-prestige-600 group-hover:text-prestige-950 transition-colors pt-1 text-sm font-semibold tracking-normal">{item.q}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-5", m.role === 'user' ? (isRtl ? "flex-row" : "flex-row-reverse") : (isRtl ? "flex-row-reverse" : "flex-row"))}>
            <div className={cn(
              "w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center mt-1 shadow-sm",
              m.role === 'user' ? "bg-prestige-100 text-prestige-400" : "bg-accent-indigo text-white"
            )}>
              {m.role === 'user' ? <Users className="w-5 h-5" /> : <Scale className="w-6 h-6" />}
            </div>
            <div className={cn(
              "max-w-[85%] flex flex-col gap-2",
              m.role === 'user' ? "items-end" : "items-start"
            )}>
              <div className={cn(
                "rounded-[2rem] p-7 shadow-xl text-[15px] leading-relaxed",
                m.role === 'user' 
                  ? "bg-prestige-900 text-white rounded-te-none text-start" 
                  : "bg-white border border-prestige-100 rounded-ts-none text-prestige-900 shadow-prestige-900/5 hover:shadow-accent-indigo/5 transition-shadow text-start"
              )}>
                {m.role === 'user' ? (
                  <p className="whitespace-pre-wrap font-medium">{m.text}</p>
                ) : (
                  <>
                    <div className={cn("prose prose-md max-w-none prose-p:leading-relaxed prose-headings:mb-4 prose-headings:mt-8 first:prose-headings:mt-0")}>
                      <ReactMarkdown
                        components={{
                          strong: ({node, ...props}) => <strong className="text-accent-indigo font-black" {...props} />,
                          code: ({node, ...props}) => <code className="bg-prestige-50 text-accent-indigo px-2 py-1 rounded-lg font-mono text-[12px] border border-prestige-100" {...props} />,
                          blockquote: ({node, ...props}) => (
                            <blockquote className={cn("border-accent-gold bg-prestige-50 p-6 italic text-prestige-800 my-6 shadow-sm", isRtl ? "border-r-4 rounded-l-2xl" : "border-l-4 rounded-r-2xl")} {...props} />
                          ),
                          h1: ({node, ...props}) => <h1 className="text-2xl font-black text-prestige-950 tracking-tight" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-xl font-black text-prestige-950 tracking-tight" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-lg font-black text-prestige-950 tracking-tight" {...props} />,
                        }}
                      >
                        {m.text}
                      </ReactMarkdown>
                    </div>
                    <div className="mt-8 pt-6 border-t border-prestige-100 flex items-center justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] text-prestige-400 font-bold uppercase tracking-widest leading-none">{t("formalAssessment")}</span>
                        <span className="text-[10px] text-prestige-300 font-medium italic">{t("consultProfessional")}</span>
                      </div>
                      <div className="flex items-center gap-3">
                         <button 
                          onClick={() => speak(m.text)}
                          className="p-3 bg-prestige-100 text-prestige-500 rounded-2xl hover:bg-accent-indigo hover:text-white transition-all active:scale-95"
                          title="Read aloud"
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => navigate("/assistant")}
                          className="p-3 bg-prestige-950 text-white rounded-2xl hover:bg-accent-gold transition-all flex items-center gap-2 px-5 group active:scale-95 shadow-xl shadow-prestige-950/20"
                        >
                          <span className="text-[10px] font-black uppercase tracking-widest leading-none">{t("assistant")}</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-prestige-400 px-4">
                {format(m.timestamp || Date.now(), 'HH:mm')}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className={cn("flex gap-5", isRtl ? "flex-row-reverse" : "flex-row")}>
             <div className="w-10 h-10 rounded-2xl bg-prestige-50 text-accent-indigo flex items-center justify-center animate-pulse border border-prestige-100 shadow-sm">
                <Scale className="w-5 h-5" />
             </div>
            <div className="bg-white border border-prestige-100 rounded-[2rem] rounded-tl-none p-7 flex items-center gap-4 shadow-xl shadow-prestige-900/5">
              <div className="flex gap-1">
                 <div className="w-2 h-2 bg-accent-indigo rounded-full animate-bounce [animation-delay:-0.3s]" />
                 <div className="w-2 h-2 bg-accent-indigo rounded-full animate-bounce [animation-delay:-0.15s]" />
                 <div className="w-2 h-2 bg-accent-indigo rounded-full animate-bounce" />
              </div>
              <span className="text-xs font-black text-prestige-400 uppercase tracking-[0.2em]">{t("analyzingLegislation") || "Analyzing Legislation..."}</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-8 pt-10 bg-gradient-to-t from-prestige-50 via-prestige-50/95 to-transparent z-20">
        <form 
          onSubmit={handleSubmit}
          className="bg-white border border-prestige-100 p-3 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.1)] rounded-[2.5rem] max-w-4xl mx-auto w-full flex flex-col gap-3 relative focus-within:border-accent-indigo transition-all duration-500"
        >
        <AnimatePresence>
          {(attachedFile || attachedImage) && (
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="px-6 py-4 bg-prestige-50/50 backdrop-blur-sm rounded-[1.5rem] flex items-center justify-between border border-prestige-100"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-accent-indigo shadow-sm border border-prestige-100 overflow-hidden text-2xl">
                  {attachedFile ? "📄" : (attachedImage ? <img src={attachedImage} className="w-full h-full object-cover" alt="attachment" /> : "📁")}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {attachedFile ? t("documentAttached") : t("imageAttached")}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-700 truncate max-w-[200px]">
                      {attachedFile ? attachedFile.name : "Document Image"}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[9px] font-bold border border-emerald-100">
                      EPHEMERAL
                    </span>
                  </div>
                </div>
                {isExtracting && (
                  <span className="text-[10px] text-emerald-600 font-bold animate-pulse ml-2">{t("analyzingDoc")}</span>
                )}
              </div>
              <button 
                type="button"
                onClick={removeFile}
                className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-2">
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf"
            className="hidden"
          />
          <input 
            type="file" 
            ref={imageInputRef}
            onChange={handleImageChange}
            accept="image/*"
            className="hidden"
          />
          <input 
            type="file" 
            ref={cameraInputRef}
            onChange={handleImageChange}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
          
          <div className="flex items-center justify-between px-2 pb-1">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-tight">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Privacy First: Docs processed in-memory & never stored
            </div>
            {!isOnline && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 text-[10px] text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Connection Issue: Some features limited
              </motion.div>
            )}
            {micError && (
              <motion.div 
                initial={{ opacity: 0, x: isRtl ? -10 : 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-[10px] text-red-500 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100"
              >
                <span>{micError}</span>
                {(micError.toLowerCase().includes("blocked") || micError.toLowerCase().includes("denied") || micError.toLowerCase().includes("not allowed") || window.self !== window.top) && (
                  <button 
                    onClick={() => window.open(window.location.href, '_blank')}
                    className="underline text-accent-indigo hover:text-accent-gold ml-1"
                  >
                    Open in New Tab
                  </button>
                )}
              </motion.div>
            )}
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="flex items-center gap-1">
              <button 
                type="button"
                onClick={handleReload}
                className={cn(
                  "p-2.5 rounded-xl transition-all bg-slate-50 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50",
                  isRefreshing && "animate-spin text-emerald-600 bg-emerald-50"
                )}
                title="Reset Chat"
              >
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <div className="w-[1px] h-6 bg-slate-100 mx-1 hidden sm:block" />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "p-2.5 rounded-xl transition-all",
                  attachedFile ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-400 hover:text-slate-600"
                )}
                title={t("uploadPdf")}
              >
                <Paperclip className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>

              <button 
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className={cn(
                  "p-2.5 rounded-xl transition-all",
                  attachedImage ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-400 hover:text-slate-600"
                )}
                title={t("uploadImage")}
              >
                <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>

            <div className="w-[1px] h-6 bg-slate-100 mx-1" />
            
            <button 
              type="button"
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={cn(
                "p-2.5 rounded-xl transition-all",
                voiceEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-400 hover:text-slate-600"
              )}
              title={t("enableVoice")}
            >
              {voiceEnabled ? <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" /> : <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            <button 
              type="button"
              onClick={toggleListening}
              className={cn(
                "p-2.5 rounded-xl transition-all",
                isListening ? "bg-red-50 text-red-600 animate-pulse" : "bg-slate-50 text-slate-400 hover:text-slate-600"
              )}
              title={t("voiceMode")}
            >
              {isListening ? <MicOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Mic className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>
          </div>

          <div className="flex gap-2 items-center">
            <input 
              type="text" 
              placeholder={isListening ? t("startListening") : t("typeMessage")}
              className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 font-medium text-[13px] sm:text-sm transition-all shadow-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button 
              type="submit"
              disabled={(!input.trim() && !attachedFile && !attachedImage) || isLoading}
              className="p-2.5 sm:p-3 bg-emerald-700 text-white rounded-xl hover:bg-emerald-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-700/20"
            >
              <Send className={cn("w-4 h-4 sm:w-5 sm:h-5", isRtl && "rotate-180")} />
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
  );
}

function Lawyers() {
  const { user } = useUser();
  const navigate = useNavigate();
  const { t, isRtl, language } = useLanguage();
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter States
  const [selectedSpec, setSelectedSpec] = useState<string>("All");
  const [maxPrice, setMaxPrice] = useState<number>(1000);
  const [minRating, setMinRating] = useState<number>(0);
  const [confirmingLawyer, setConfirmingLawyer] = useState<Lawyer | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const data = await getLawyers();
      setLawyers(data);
      setIsLoading(false);
    }
    load();
  }, []);

  const specializations = ["All", ...Array.from(new Set(lawyers.map(l => l.specialization)))];

  const filteredLawyers = lawyers.filter(lawyer => {
    // Filter out lawyers who are Out of Office
    if (lawyer.isOOO) return false;

    const specMatch = selectedSpec === "All" || lawyer.specialization === selectedSpec;
    const priceMatch = lawyer.price <= maxPrice;
    const ratingMatch = lawyer.rating >= minRating;
    return specMatch && priceMatch && ratingMatch;
  });

  const handleBook = async (lawyerId: string) => {
    if (!user) {
      if (isAuthLoading) return;
      setIsAuthLoading(true);
      try {
        await signInWithGoogle();
      } catch (err) {
        console.error("Lawyers sign-in error:", err);
      } finally {
        setIsAuthLoading(false);
      }
      return;
    }

    const lawyer = lawyers.find(l => l.id === lawyerId);
    if (!lawyer) return;

    setConfirmingLawyer(lawyer);
  };

  const confirmBooking = async () => {
    if (!confirmingLawyer || !user) return;
    const lawyer = confirmingLawyer;
    setConfirmingLawyer(null);

    try {
      const response = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lawyerId: lawyer.id,
          lawyerName: lawyer.name,
          price: lawyer.price,
          scheduledAt: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        }),
      });

      const session = await response.json();
      if (session.id) {
        const path = "consultations";
        try {
          await addDoc(collection(db, path), {
            clientId: user.uid,
            lawyerId: lawyer.id,
            lawyerName: lawyer.name,
            price: typeof lawyer.price === 'number' ? `AED ${lawyer.price}` : String(lawyer.price),
            scheduledAt: new Date(Date.now() + 86400000).toISOString(),
            meetingType: 'video',
            meetingLink: `https://meet.google.com/mock-id-${Math.random().toString(36).substring(7)}`,
            status: "pending",
            paymentStatus: "paid",
            createdAt: serverTimestamp(),
          });

          navigate("/appointments");
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, path);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-20 md:py-40 text-center space-y-6">
        <Loader2 className="w-16 h-16 text-accent-indigo animate-spin mx-auto" />
        <p className="text-prestige-500 font-black uppercase tracking-widest text-sm animate-pulse">Syncing with MOJ Directory...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-24 space-y-20">
      <div className="text-center space-y-6 max-w-3xl mx-auto">
        <h2 className="text-5xl md:text-6xl font-extrabold text-prestige-950 tracking-tighter leading-none">
          Verified <span className="text-accent-gold italic serif">Consultants</span>
        </h2>
        <p className="text-xl text-prestige-500 font-medium">Licensed legal professionals verified by the UAE Ministry of Justice for professional consultation.</p>
        
        <div className="pt-4">
          <button 
            onClick={() => navigate("/register-lawyer")}
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-accent-indigo bg-accent-indigo/5 px-5 py-2.5 rounded-full border border-accent-indigo/10 hover:bg-accent-indigo hover:text-white transition-all active:scale-95"
          >
            <Scale className="w-3.5 h-3.5" /> Are you a licensed lawyer? Join our network
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 md:p-10 rounded-3xl md:rounded-[3rem] border border-prestige-100 shadow-2xl shadow-prestige-900/5 flex flex-wrap items-end gap-6 md:gap-10">
        <div className="flex-1 min-w-[200px] space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-prestige-400 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5" /> {t("filterSpecialization")}
          </label>
          <div className="relative group">
            <select 
              value={selectedSpec}
              onChange={(e) => setSelectedSpec(e.target.value)}
              className="w-full bg-prestige-50 border border-prestige-100 rounded-2xl px-6 py-4 outline-none focus:ring-2 focus:ring-accent-indigo/20 font-bold transition-all appearance-none text-prestige-900"
            >
              {specializations.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4 text-prestige-400 pointer-events-none group-hover:text-prestige-900 transition-colors" />
          </div>
        </div>

        <div className="flex-1 min-w-[200px] space-y-4">
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-prestige-400 flex items-center gap-2">
             <DollarSign className="w-3.5 h-3.5" /> Max Fee: <span className="text-accent-gold">{t("currency")} {maxPrice}</span>
          </label>
          <input 
            type="range" 
            min="100" 
            max="2000" 
            step="50"
            value={maxPrice}
            onChange={(e) => setMaxPrice(parseInt(e.target.value))}
            className="w-full h-1.5 bg-prestige-100 rounded-lg appearance-none cursor-pointer accent-accent-indigo"
          />
        </div>

        <div className="flex items-center gap-4">
           {specializations.slice(1, 4).map(s => (
             <button 
               key={s}
               onClick={() => setSelectedSpec(s)}
               className={cn(
                 "hidden lg:block px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm",
                 selectedSpec === s ? "bg-prestige-950 text-white shadow-xl" : "bg-prestige-50 text-prestige-400 hover:bg-prestige-100"
               )}
             >
               {s}
             </button>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-10">
        <AnimatePresence mode="popLayout">
          {filteredLawyers.map(lawyer => (
            <motion.div
              layout
              key={lawyer.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4 }}
            >
              <LawyerCard lawyer={lawyer} onBook={handleBook} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {confirmingLawyer && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmingLawyer(null)}
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
                <h3 className="text-3xl font-black text-prestige-950 tracking-tighter">Confirm <span className="text-accent-indigo italic serif font-normal">Booking</span></h3>
                <p className="text-prestige-500 font-medium leading-relaxed">
                  Book a consultation with <span className="text-prestige-950 font-bold">{confirmingLawyer.name}</span> for <span className="text-accent-indigo font-bold">{confirmingLawyer.price} AED</span>?
                </p>
                <div className="p-4 bg-prestige-50 rounded-2xl text-start space-y-2 border border-prestige-100">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-prestige-400">
                    <span>Expert</span>
                    <span>{confirmingLawyer.name}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-prestige-400">
                    <span>Total Fee</span>
                    <span className="text-prestige-950">{confirmingLawyer.price} AED</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4">
                <button 
                  onClick={() => setConfirmingLawyer(null)}
                  className="px-6 py-4 bg-prestige-100 text-prestige-600 rounded-2xl font-black hover:bg-prestige-200 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmBooking}
                  className="px-6 py-4 bg-prestige-950 text-white rounded-2xl font-black hover:bg-accent-indigo transition-all shadow-xl shadow-prestige-950/20 active:scale-95"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {filteredLawyers.length === 0 && (
        <div className="text-center py-20 bg-prestige-50 rounded-[4rem] border-2 border-dashed border-prestige-200">
           <Users className="w-16 h-16 text-prestige-200 mx-auto mb-6" />
           <p className="text-prestige-400 font-bold italic tracking-tight">No verified consultants match your current filters.</p>
           <button 
             onClick={() => { setSelectedSpec("All"); setMaxPrice(2000); setMinRating(0); }}
             className="mt-6 text-accent-indigo font-black uppercase tracking-widest text-xs hover:underline decoration-2"
           >
             Clear all filters
           </button>
        </div>
      )}
    </div>
  );
}

function Appointments() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { t, isRtl } = useLanguage();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelDialog, setCancelDialog] = useState<{ isOpen: boolean; aptId: string | null; isRefundable: boolean }>({ isOpen: false, aptId: null, isRefundable: false });
  const [rescheduleDialog, setRescheduleDialog] = useState<{ isOpen: boolean; aptId: string | null; lawyerId: string | null; isRefundable: boolean }>({ isOpen: false, aptId: null, lawyerId: null, isRefundable: false });

  useEffect(() => {
    if (!user) return;

    const path = "consultations";
    const q = query(
      collection(db, path), 
      where("clientId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAppointments(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) {
    return (
      <div className="container mx-auto px-6 h-[70vh] flex flex-col items-center justify-center space-y-12">
        <div className="p-10 bg-prestige-50 rounded-[3rem] text-prestige-200">
           <Calendar className="w-20 h-20" />
        </div>
        <div className="text-center space-y-4 max-w-sm">
          <h2 className="text-4xl font-black text-prestige-950 tracking-tighter leading-tight">{t("signInToView")}</h2>
          <p className="text-prestige-500 font-medium">Track your legal consultations and professional sessions in a secure workspace.</p>
        </div>
        <button 
          onClick={async () => {
            try {
              await signInWithGoogle();
            } catch (err) {
              console.error("Appointments sign-in error:", err);
            }
          }}
          className="px-12 py-5 bg-prestige-950 text-white rounded-2xl font-black hover:bg-accent-indigo transition-all shadow-2xl shadow-prestige-950/20 active:scale-95"
        >
          {t("signIn") || "Sign in"}
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-24 space-y-16">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-4">
           <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent-gold/10 rounded-xl flex items-center justify-center text-accent-gold">
                <Calendar className="w-6 h-6" />
              </div>
              <span className="text-[10px] font-black text-accent-gold uppercase tracking-[0.3em]">Authorized Workspace</span>
           </div>
           <h2 className="text-4xl md:text-5xl font-black text-prestige-950 tracking-tighter">
             Legal <span className="text-accent-indigo italic serif">Sessions</span>
           </h2>
        </div>
        <p className="text-prestige-500 font-medium max-w-md">Manage your confirmed and pending consultations with UAE licensed legal experts.</p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 md:py-40 gap-6">
          <Loader2 className="w-16 h-16 text-accent-indigo animate-spin" />
          <p className="text-prestige-400 font-black uppercase tracking-widest text-xs animate-pulse">Retreiving Secure Records...</p>
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-white rounded-3xl md:rounded-[4rem] p-10 md:p-24 text-center border-2 border-dashed border-prestige-100 space-y-8 shadow-2xl shadow-prestige-900/5">
          <div className="w-20 h-20 bg-prestige-50 rounded-full flex items-center justify-center mx-auto text-prestige-200">
             <Briefcase className="w-10 h-10" />
          </div>
          <div className="space-y-3">
            <h3 className="text-2xl font-black text-prestige-950">No Appointments Recorded</h3>
            <p className="text-prestige-500 font-medium max-w-sm mx-auto">You haven't booked any legal consultations yet. Explore our directory to find a verified expert.</p>
          </div>
          <button 
             onClick={() => navigate("/assistant")} 
             className="px-8 py-4 bg-accent-indigo text-white rounded-2xl font-black hover:bg-prestige-950 transition-all shadow-xl shadow-accent-indigo/20 active:scale-95 flex items-center gap-3 mx-auto"
          >
             Open Copilot <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 xl:gap-10">
          {appointments.map((apt) => (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={apt.id} 
              className="bg-white p-10 rounded-[3rem] border border-prestige-100 shadow-xl shadow-prestige-900/5 flex flex-col sm:flex-row items-start gap-8 group hover:border-accent-indigo transition-all duration-500"
            >
              <div className="w-16 h-16 bg-prestige-50 rounded-2xl text-accent-indigo flex-shrink-0 flex items-center justify-center border border-prestige-100 group-hover:bg-accent-indigo group-hover:text-white transition-all transform group-hover:rotate-3 shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="flex-1 space-y-6 w-full">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="font-black text-2xl text-prestige-950 tracking-tight leading-tight group-hover:text-accent-indigo transition-colors">{apt.lawyerName}</h3>
                    <p className="text-[10px] text-prestige-400 font-black uppercase tracking-widest">{apt.specialization || "Legal Consultant"}</p>
                  </div>
                  <span className={cn(
                    "px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm",
                    apt.status === 'confirmed' ? "bg-emerald-500 text-white" : 
                    apt.status === 'cancelled' ? "bg-red-500 text-white" : 
                    apt.status === 'await_confirmation' ? "bg-accent-indigo text-white" : "bg-accent-gold text-prestige-950"
                  )}>
                    {apt.status === 'await_confirmation' ? "Awaiting Expert" : apt.status}
                  </span>
                </div>
                
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 py-4 px-6 bg-prestige-50 rounded-2xl border border-prestige-100 text-[11px] font-black text-prestige-700 uppercase tracking-tight">
                      <Calendar className="w-4 h-4 text-accent-indigo" />
                      {new Date(apt.scheduledAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} at {new Date(apt.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex items-center gap-2 py-4 px-6 bg-prestige-50 rounded-2xl border border-prestige-100 text-[11px] font-black text-prestige-700 uppercase tracking-tight">
                      {apt.meetingType === 'video' ? <ShieldCheck className="w-4 h-4 text-emerald-500" /> : <MapPin className="w-4 h-4 text-accent-gold" />}
                      {apt.meetingType === 'video' ? 'Video Conference' : 'In-Person Session'}
                  </div>
                </div>

                {apt.meetingType === 'video' && apt.status === 'confirmed' && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-between group-hover:bg-emerald-100 transition-colors">
                    <div className="flex items-center gap-3">
                      <img src="https://www.gstatic.com/images/branding/product/2x/meet_48dp.png" alt="Meet" className="w-6 h-6" />
                      <span className="text-xs font-black text-emerald-700">Google Meet link is ready</span>
                    </div>
                    <a href={apt.meetingLink} target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase tracking-widest text-emerald-600 hover:underline">Join Now</a>
                  </div>
                )}

                <div className="flex items-center justify-between pt-6 border-t border-prestige-50">
                  <div className="flex items-baseline gap-1">
                     <span className="text-lg font-black text-prestige-950">{apt.price}</span>
                     <span className="text-[10px] font-black text-prestige-400 uppercase tracking-widest">AED</span>
                  </div>
                  <div className="flex gap-4 items-center">
                    {['pending', 'await_confirmation', 'confirmed'].includes(apt.status) && (() => {
                      const scheduledTime = apt.scheduledAt ? new Date(apt.scheduledAt).getTime() : Date.now() + 86400000;
                      const diffHours = (scheduledTime - Date.now()) / (1000 * 60 * 60);
                      const canModify = diffHours > 0;
                      const isRefundable = diffHours >= 6;
                      
                      if (!canModify) {
                        return (
                           <button className="text-[10px] text-accent-indigo font-black uppercase tracking-[0.2em] hover:text-prestige-950 transition-colors flex items-center gap-2 group-btn">
                             Join Session <ArrowRight className="w-3.5 h-3.5 group-btn-hover:translate-x-1 transition-transform" />
                           </button>
                        );
                      }
                      
                      return (
                        <div className="flex gap-4">
                          <button 
                            onClick={() => setCancelDialog({ isOpen: true, aptId: apt.id, isRefundable: isRefundable })}
                            className="text-[10px] text-red-500 font-black uppercase tracking-[0.2em] hover:text-red-700 transition-colors flex items-center gap-1.5"
                          >
                            <X className="w-3.5 h-3.5" /> Cancel
                          </button>
                          <button 
                            onClick={() => {
                               if (!isRefundable) {
                                 setRescheduleDialog({ isOpen: true, aptId: apt.id, lawyerId: apt.lawyerId, isRefundable: false });
                               } else {
                               navigate(`/lawyers/${apt.lawyerId}?reschedule=${apt.id}`);
                               }
                            }}
                            className="text-[10px] text-accent-indigo font-black uppercase tracking-[0.2em] hover:text-prestige-950 transition-colors flex items-center gap-1.5"
                          >
                            <Calendar className="w-3.5 h-3.5" /> Reschedule
                          </button>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {cancelDialog.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-prestige-950/20 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-prestige-100"
             >
                <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-6">
                  <X className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-prestige-950 mb-2">Cancel Appointment?</h3>
                <p className="text-sm font-medium text-prestige-500 mb-8">
                  {cancelDialog.isRefundable 
                    ? "You are eligible for a full refund because you are cancelling more than 6 hours in advance." 
                    : "WARNING: Less than 6 hours remaining. NO REFUND will be issued if you cancel now."}
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setCancelDialog({ isOpen: false, aptId: null, isRefundable: false })} className="flex-1 py-3 text-xs font-black text-prestige-500 uppercase tracking-widest hover:bg-prestige-50 rounded-xl transition-colors">Go Back</button>
                  <button onClick={async () => {
                    try {
                      if (cancelDialog.aptId) {
                        await updateDoc(doc(db, "consultations", cancelDialog.aptId), { status: "cancelled" });
                      }
                    } catch (e) {
                      handleFirestoreError(e, OperationType.UPDATE, "consultations");
                    } finally {
                      setCancelDialog({ isOpen: false, aptId: null, isRefundable: false });
                    }
                  }} className="flex-1 py-3 bg-red-500 text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-red-600 transition-colors shadow-lg shadow-red-500/20">Confirm</button>
                </div>
             </motion.div>
          </div>
        )}

        {rescheduleDialog.isOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-prestige-950/20 backdrop-blur-sm">
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="bg-white rounded-3xl p-8 max-w-sm w-full shadow-2xl border border-prestige-100"
             >
                <div className="w-12 h-12 bg-accent-gold/10 text-accent-gold rounded-2xl flex items-center justify-center mb-6">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-black text-prestige-950 mb-2">Reschedule Session?</h3>
                <p className="text-sm font-medium text-prestige-500 mb-8">
                  Less than 6 hours remaining. Rescheduling now will not be refunded for the current time block. Are you sure?
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setRescheduleDialog({ isOpen: false, aptId: null, lawyerId: null, isRefundable: false })} className="flex-1 py-3 text-xs font-black text-prestige-500 uppercase tracking-widest hover:bg-prestige-50 rounded-xl transition-colors">Go Back</button>
                  <button onClick={() => {
                    navigate(`/lawyers/${rescheduleDialog.lawyerId}?reschedule=${rescheduleDialog.aptId}`);
                    setRescheduleDialog({ isOpen: false, aptId: null, lawyerId: null, isRefundable: false });
                  }} className="flex-1 py-3 bg-accent-indigo text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-prestige-950 transition-colors shadow-lg shadow-accent-indigo/20">Proceed</button>
                </div>
             </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// --- Protected Routes Helper ---

function ProtectedRoute({ requireUser = false, requireLawyer = false, requireAdmin = false, children }: { requireUser?: boolean, requireLawyer?: boolean, requireAdmin?: boolean, children: React.ReactNode }) {
  const { user, lawyerProfile, isSuperAdmin, loading } = useUser();
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-20">
        <Loader2 className="w-8 h-8 text-accent-indigo animate-spin" />
      </div>
    );
  }

  if (!user && (requireUser || requireLawyer || requireAdmin)) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !isSuperAdmin) {
    return <Navigate to="/" replace />;
  }

  if (requireLawyer && !lawyerProfile) {
    // If they aren't a lawyer, guide them to registration or home.
    // Since LawyerDashboard has a custom UI for non-lawyers (which allows registration),
    // maybe we shouldn't block the dashboard?
    // Wait, the prompt says "only lawyers should access the Lawyer Dashboard and Co-pilot features."
    // Let's protect them completely.
    return (
      <div className="container mx-auto px-6 py-24 text-center space-y-6">
        <div className="w-20 h-20 bg-prestige-100 rounded-full flex items-center justify-center mx-auto">
          <ShieldCheck className="w-10 h-10 text-prestige-400" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-prestige-950 tracking-tight">Access Restricted</h2>
          <p className="text-prestige-500 font-medium pb-4">This section is exclusively for registered legal professionals.</p>
          <a href="/register-lawyer" className="inline-block px-8 py-4 bg-accent-indigo text-white rounded-2xl font-black shadow-xl shadow-accent-indigo/20 hover:scale-105 transition-transform">
            {t("registerAsLawyer") || "Register as Lawyer"}
          </a>
        </div>
      </div>
    );
  }

  return children;
}

// --- Main App ---

export default function App() {
  return (
    <HashRouter>
      <UserProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/assistant" element={
              <ProtectedRoute><Assistant /></ProtectedRoute>
             } />
            <Route path="/laws" element={<Legislation />} />
            <Route path="/lawyers" element={<LawyersPage />} />
            <Route path="/lawyers/:id" element={<LawyerProfile />} />
            <Route path="/register-lawyer" element={<LawyerRegistration />} />
            <Route path="/dashboard" element={
              <ProtectedRoute requireLawyer><LawyerDashboard /></ProtectedRoute>
            } />
            <Route path="/copilot" element={
              <ProtectedRoute requireLawyer><LawyerAssistant /></ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute requireLawyer><LawyerSettings /></ProtectedRoute>
            } />
            <Route path="/management" element={
              <ProtectedRoute requireAdmin><Management /></ProtectedRoute>
            } />
            <Route path="/support" element={<Support />} />
            <Route path="/appointments" element={<Appointments />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </Layout>
      </UserProvider>
    </HashRouter>
  );
}
