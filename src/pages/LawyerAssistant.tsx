import React, { useState, useEffect, useRef } from "react";
import { 
  Scale, 
  MessageSquare, 
  Send, 
  Loader2, 
  Gavel, 
  ShieldCheck, 
  RefreshCw, 
  Users, 
  ArrowRight,
  FileText,
  Search,
  BookOpen,
  Zap,
  Library,
  ChevronRight,
  Filter,
  X,
  Paperclip,
  Image as ImageIcon
} from "lucide-react";
import { motion, AnimatePresence } from "../lib/motion-shim";
import { getLawyerCoPilotAdvice } from "../services/legalService";
import { searchLocalLegislation, formatLawsForContext } from "../services/legislationService";
import { searchPrecedents, Precedent } from "../services/precedentService";
import ReactMarkdown from "react-markdown";
import { cn } from "../lib/utils";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, addDoc, query, where, orderBy, serverTimestamp, updateDoc, doc, getDocs, limit } from "firebase/firestore";
import { useLanguage } from "../contexts/LanguageContext";
import { extractTextFromPdf } from "../lib/pdfUtils";
import { useUser } from "../contexts/UserContext";
import { createMarkdownComponents, stripUnsafeLinks } from "../lib/safety";

interface Client {
  id: string;
  name: string;
}

interface Case {
  id: string;
  title: string;
  clientId: string;
}

export default function LawyerAssistant() {
  const { language, isRtl } = useLanguage();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<{ role: 'user' | 'model', text: string, timestamp: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useUser();
  const isSending = useRef(false);
  const markdownComponents = createMarkdownComponents();

  // Client/Case Management State
  const [clients, setClients] = useState<Client[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [isAddingClient, setIsAddingClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [isAddingCase, setIsAddingCase] = useState(false);
  const [newCaseTitle, setNewCaseTitle] = useState("");

  // Document Analysis State
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [pdfContent, setPdfContent] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Precedent Search State
  const [showLibrary, setShowLibrary] = useState(false);
  const [precedentSearchQuery, setPrecedentSearchQuery] = useState("");
  const [precedents, setPrecedents] = useState<Precedent[]>([]);
  const [isSearchingPrecedents, setIsSearchingPrecedents] = useState(false);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>([]);

  useEffect(() => {
    const ALL_PROMPTS = [
      "Draft a notice of dispute for a commercial contract under UAE law.",
      "Analyze ADGM vs DIFC jurisdiction for holding companies.",
      "List the recent changes to the UAE Labor Law on non-compete clauses.",
      "What is the statute of limitations for civil liability claims in UAE?",
      "Compare the process of setting up an LLC in Dubai Mainland vs Freezones.",
      "Outline a defense strategy for a breach of contract claim invoking force majeure.",
      "What are the penalties for bouncing a cheque under the new Commercial Transactions Law?",
      "Summarize the recent amendments to the UAE Family Business Law.",
      "Explain the VAT implications of exporting services from a UAE free zone.",
      "Draft a standard NDA governed by UAE law."
    ];
    // Shuffle and pick 4
    const shuffled = [...ALL_PROMPTS].sort(() => 0.5 - Math.random());
    setSuggestedPrompts(shuffled.slice(0, 4));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch Clients
  useEffect(() => {
    async function fetchClients() {
      if (!user) return;
      try {
        const q = query(collection(db, "clients"), where("lawyerId", "==", user.uid));
        const snap = await getDocs(q);
        const clientList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client));
        setClients(clientList);
      } catch (err) {
        console.error("Error fetching clients:", err);
      }
    }
    fetchClients();
  }, [user]);

  // Fetch Cases for selected client
  useEffect(() => {
    async function fetchCases() {
      if (!selectedClientId || !user) {
        setCases([]);
        return;
      }
      try {
        const q = query(collection(db, "cases"), where("clientId", "==", selectedClientId), where("lawyerId", "==", user.uid));
        const snap = await getDocs(q);
        const caseList = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Case));
        setCases(caseList);
      } catch (err) {
        console.error("Error fetching cases:", err);
      }
    }
    fetchCases();
  }, [selectedClientId, user]);

  // Load Session for selected case
  useEffect(() => {
    async function loadCaseSession() {
      if (!selectedCaseId || !user) {
        setMessages([]);
        setCurrentChatId(null);
        return;
      }
      setIsLoading(true);
      try {
        const q = query(
          collection(db, "lawyer_co_pilots"),
          where("userId", "==", user.uid),
          where("caseId", "==", selectedCaseId),
          orderBy("updatedAt", "desc"),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          const chatDoc = snap.docs[0];
          setMessages(chatDoc.data().messages || []);
          setCurrentChatId(chatDoc.id);
        } else {
          setMessages([]);
          setCurrentChatId(null);
        }
      } catch (err) {
        console.error("Error loading case session:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadCaseSession();
  }, [selectedCaseId, user]);

  const handleAddClient = async () => {
    if (!newClientName.trim() || !user) return;
    setIsDataLoading(true);
    try {
      const docRef = await addDoc(collection(db, "clients"), {
        name: newClientName,
        lawyerId: user.uid,
        createdAt: new Date().toISOString()
      });
      const newClient = { id: docRef.id, name: newClientName };
      setClients(prev => [...prev, newClient]);
      setSelectedClientId(docRef.id);
      setNewClientName("");
      setIsAddingClient(false);
    } catch (err) {
      console.error("Error adding client:", err);
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleAddCase = async () => {
    if (!newCaseTitle.trim() || !selectedClientId || !user) return;
    setIsDataLoading(true);
    try {
      const docRef = await addDoc(collection(db, "cases"), {
        title: newCaseTitle,
        clientId: selectedClientId,
        lawyerId: user.uid,
        status: 'active',
        createdAt: new Date().toISOString()
      });
      const newCase = { id: docRef.id, title: newCaseTitle, clientId: selectedClientId };
      setCases(prev => [...prev, newCase]);
      setSelectedCaseId(docRef.id);
      setNewCaseTitle("");
      setIsAddingCase(false);
    } catch (err) {
      console.error("Error adding case:", err);
    } finally {
      setIsDataLoading(false);
    }
  };

  const handlePrecedentSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!precedentSearchQuery.trim()) return;
    
    setIsSearchingPrecedents(true);
    try {
      const results = await searchPrecedents(precedentSearchQuery);
      setPrecedents(results);
    } catch (err) {
      console.error("Precedent search failed:", err);
    } finally {
      setIsSearchingPrecedents(false);
    }
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isLoading || isSending.current) return;
    
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
    
    isSending.current = true;
    setInput("");
    
    const now = Date.now();
    const userMessage = attachedFile 
      ? `${text}\n\n[Attached Document: ${attachedFile.name}]`
      : text;
      
    setMessages(prev => [...prev, { role: 'user', text: userMessage, timestamp: now }]);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ 
        role: m.role === 'user' ? 'user' : 'model', 
        text: m.text 
      }));

      // Combine input with PDF content & Case Context if available
      let fullPrompt = text;
      const selectedCase = cases.find(c => c.id === selectedCaseId);
      const selectedClient = clients.find(c => c.id === selectedClientId);

      let contextSummary = "";
      if (selectedCase) contextSummary += `Case Title: ${selectedCase.title}. `;
      if (selectedClient) contextSummary += `Client: ${selectedClient.name}. `;

      if (pdfContent) {
        fullPrompt = `[CASE CONTEXT: ${contextSummary}]
        I have attached a legal document for analysis. 
        DOCUMENT CONTENT:
        ${pdfContent}
        
        USER QUESTION:
        ${text || "Please analyze this document and summarize the key legal points."}`;
      } else if (contextSummary) {
        fullPrompt = `[CASE CONTEXT: ${contextSummary}] ${text}`;
      }

      // Search for laws
      const localLaws = await searchLocalLegislation(text || (selectedCase?.title ?? ""));
      const context = formatLawsForContext(localLaws);

      const advice = stripUnsafeLinks(await getLawyerCoPilotAdvice(fullPrompt, history, context, language));
      const assistantNow = Date.now();
      setMessages(prev => [...prev, { role: 'model', text: advice, timestamp: assistantNow }]);
      
      // Clear file after send
      removeFile();

      // Save to Firestore if logged in
      if (user) {
        const baseData = {
          userId: user.uid,
          caseId: selectedCaseId || null,
          messages: [...messages, { role: 'user', text: userMessage, timestamp: now }, { role: 'model', text: advice, timestamp: assistantNow }],
          updatedAt: serverTimestamp(),
          isTechnical: true
        };

        const path = "lawyer_co_pilots";
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
    } catch (error: any) {
      console.error("Technical co-pilot error:", error);
      const errorMessage = error?.message || "";
      let userFriendlyError = "An error occurred while communicating with the AI Strategic Associate.";
      
      if (errorMessage.includes("UNAVAILABLE") || errorMessage.includes("503")) {
        userFriendlyError = "The AI service is currently experiencing high demand. Please try again in a few moments.";
      } else if (errorMessage.includes("permissions") || errorMessage.includes("insufficient")) {
        userFriendlyError = "System permission error. Please refresh and try again.";
      }

      setMessages(prev => [...prev, { 
        role: 'model', 
        text: `⚠️ **${userFriendlyError}**`, 
        timestamp: Date.now() 
      }]);
    } finally {
      setIsLoading(false);
      isSending.current = false;
    }
  };

  const handleReload = () => {
    setMessages([]);
    setCurrentChatId(null);
    setInput("");
    setAttachedFile(null);
    setPdfContent(null);
  };

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

  const removeFile = () => {
    setAttachedFile(null);
    setPdfContent(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="flex-1 flex flex-col h-full relative overflow-hidden bg-prestige-50">
      {/* Background patterns */}
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]">
        <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #000 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      </div>

      <header className="px-8 py-6 bg-white border-b border-prestige-100 flex items-center justify-between relative z-10 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-4 shrink-0">
          <div className="p-3 bg-prestige-950 rounded-2xl text-white shadow-lg">
            <Zap className="w-5 h-5 text-accent-gold" />
          </div>
          <div className="text-start hidden sm:block">
            <h1 className="text-xl font-black text-prestige-950 tracking-tight leading-none mb-1">
              AI Strategic <span className="text-accent-gold italic serif font-normal">Associate</span>
            </h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[10px] font-black text-prestige-400 uppercase tracking-widest">Active Search Enabled</p>
            </div>
          </div>
        </div>

        {/* Client & Case Scoping */}
        <div className="flex items-center gap-3 mx-4 flex-1 max-w-2xl px-4 py-2 bg-prestige-50 rounded-2xl border border-prestige-100">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[8px] font-black text-prestige-400 uppercase tracking-widest mb-1 ml-1 text-start">Client</span>
              <select 
                value={selectedClientId}
                onChange={(e) => {
                  setSelectedClientId(e.target.value);
                  setSelectedCaseId("");
                }}
                className="bg-transparent text-xs font-black text-prestige-950 outline-none truncate"
              >
                <option value="">Select Client</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="w-px h-6 bg-prestige-200" />

            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-[8px] font-black text-prestige-400 uppercase tracking-widest mb-1 ml-1 text-start">Subject / Case</span>
              <select 
                value={selectedCaseId}
                onChange={(e) => setSelectedCaseId(e.target.value)}
                disabled={!selectedClientId}
                className="bg-transparent text-xs font-black text-prestige-950 outline-none truncate disabled:opacity-50"
              >
                <option value="">General (No Case)</option>
                {cases.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {!selectedClientId ? (
              <button 
                onClick={() => setIsAddingClient(true)}
                className="p-2 hover:bg-white rounded-lg text-accent-indigo transition-all shadow-sm"
                title="Add New Client"
              >
                <Users className="w-4 h-4" />
              </button>
            ) : !selectedCaseId ? (
              <button 
                onClick={() => setIsAddingCase(true)}
                className="p-2 hover:bg-white rounded-lg text-accent-gold transition-all shadow-sm"
                title="Add New Case/Subject"
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => setShowLibrary(!showLibrary)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest border",
              showLibrary 
                ? "bg-accent-gold text-prestige-950 border-accent-gold shadow-lg shadow-accent-gold/20" 
                : "bg-white text-prestige-400 border-prestige-100 hover:bg-prestige-50 hover:text-prestige-950"
            )}
          >
            <Library className="w-4 h-4" />
            Precedent Library
          </button>
          <div className="w-px h-8 bg-prestige-100 mx-2" />
          <button 
            onClick={handleReload}
            className="p-3 hover:bg-prestige-50 rounded-xl transition-all text-prestige-400 hover:text-prestige-950"
            title="New Research Session"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* Modals for Client/Case Creation */}
        <AnimatePresence>
          {isAddingClient && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-prestige-950/40 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl border border-prestige-100 space-y-6"
              >
                <div className="space-y-2 text-start">
                  <h3 className="text-2xl font-black text-prestige-950 tracking-tight">New Client</h3>
                  <p className="text-sm font-medium text-prestige-500">Add a new legal client to organize your research sessions.</p>
                </div>
                <input 
                  autoFocus
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="e.g. Al-Futtaim Group, John Doe..."
                  className="w-full px-6 py-4 bg-prestige-50 border border-prestige-100 rounded-2xl font-bold text-prestige-950 outline-none focus:ring-2 focus:ring-accent-indigo transition-all"
                />
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsAddingClient(false)}
                    className="flex-1 py-4 bg-prestige-50 text-prestige-500 font-black rounded-2xl hover:bg-prestige-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddClient}
                    disabled={!newClientName.trim() || isDataLoading}
                    className="flex-1 py-4 bg-prestige-950 text-white font-black rounded-2xl hover:bg-black transition-all disabled:opacity-50"
                  >
                    {isDataLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Create Client"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

          {isAddingCase && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-prestige-950/40 backdrop-blur-sm">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl border border-prestige-100 space-y-6"
              >
                <div className="space-y-2 text-start">
                  <h3 className="text-2xl font-black text-prestige-950 tracking-tight">New Case/Subject</h3>
                  <p className="text-sm font-medium text-prestige-500">Define a specific matter or project for this client.</p>
                </div>
                <input 
                  autoFocus
                  value={newCaseTitle}
                  onChange={(e) => setNewCaseTitle(e.target.value)}
                  placeholder="e.g. Contract Review, Employment Dispute..."
                  className="w-full px-6 py-4 bg-prestige-50 border border-prestige-100 rounded-2xl font-bold text-prestige-950 outline-none focus:ring-2 focus:ring-accent-gold transition-all"
                />
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsAddingCase(false)}
                    className="flex-1 py-4 bg-prestige-50 text-prestige-500 font-black rounded-2xl hover:bg-prestige-100 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddCase}
                    disabled={!newCaseTitle.trim() || isDataLoading}
                    className="flex-1 py-4 bg-accent-gold text-prestige-950 font-black rounded-2xl hover:bg-yellow-500 transition-all disabled:opacity-50"
                  >
                    {isDataLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Create Case"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Main Conversation Area */}
        <div className={cn(
          "flex-1 flex flex-col relative transition-all duration-500",
          showLibrary ? "mr-96" : "mr-0"
        )}>
          <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 pb-32 relative scrollbar-hide">
            {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-12 max-w-4xl mx-auto py-12">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-accent-gold/10 rounded-full border border-accent-gold/20 mb-4">
                <ShieldCheck className="w-4 h-4 text-accent-gold" />
                <span className="text-[10px] font-black text-accent-gold uppercase tracking-[0.2em]">Verified Professional Tool</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-prestige-950 tracking-tighter leading-tight max-w-2xl">
                AI Strategic <span className="text-accent-gold italic serif font-normal">Associate</span> at your service.
              </h2>
              <p className="text-lg text-prestige-500 font-medium leading-relaxed max-w-2xl">
                I can help you with case law analysis, procedural timelines, drafting memorandum outlines, and clarifying jurisdictional nuances in UAE law.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              {[
                {
                  title: "Technical Analysis",
                  q: "Identify potential jurisdictional conflicts between DIFC and Dubai Mainland in commercial disputes.",
                  icon: Gavel
                },
                {
                  title: "Procedural Guidance",
                  q: "What is the statute of limitations for filing a civil liability claim under the New UAE Civil Transactions Law?",
                  icon: BookOpen
                },
                {
                  title: "Drafting Aid",
                  q: "Show me a structured outline for a defense memorandum against an unfair dismissal claim.",
                  icon: FileText
                },
                {
                  title: "Case Strategy",
                  q: "What are the common pitfalls in real estate arbitration proceedings in Sharjah?",
                  icon: Scale
                }
              ].map(item => (
                <button 
                  key={item.q} 
                  onClick={() => handleSend(item.q)}
                  className="p-8 bg-white border border-prestige-100 rounded-[2.5rem] hover:border-accent-indigo hover:shadow-2xl hover:shadow-accent-indigo/10 transition-all text-left group flex items-start gap-5 shadow-sm"
                >
                  <div className="w-12 h-12 rounded-2xl bg-prestige-50 flex items-center justify-center text-prestige-400 group-hover:bg-accent-indigo group-hover:text-white transition-all transform group-hover:scale-110 group-hover:rotate-3 shrink-0">
                    <item.icon className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-accent-gold uppercase tracking-widest">{item.title}</p>
                    <p className="text-prestige-600 group-hover:text-prestige-950 transition-colors font-bold leading-tight">{item.q}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn("flex gap-6", m.role === 'user' ? "flex-row-reverse" : "flex-row")}>
            <div className={cn(
              "w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center mt-1 shadow-lg",
              m.role === 'user' ? "bg-prestige-100 text-prestige-400" : "bg-prestige-950 text-white"
            )}>
              {m.role === 'user' ? <Users className="w-6 h-6" /> : <Zap className="w-6 h-6 text-accent-gold" />}
            </div>
            <div className={cn(
              "max-w-[85%] flex flex-col gap-2",
              m.role === 'user' ? "items-end" : "items-start text-start"
            )}>
              <div className={cn(
                "p-6 rounded-[2rem] text-sm font-medium leading-relaxed shadow-sm border",
                m.role === 'user' 
                  ? "bg-white text-prestige-700 border-prestige-100 rounded-tr-none" 
                  : "bg-white text-prestige-950 border-prestige-200 rounded-tl-none prose prose-prestige max-w-none"
              )}>
                {m.role === 'user' ? (
                  m.text
                ) : (
                  <div className="prose prose-sm prose-prestige max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-p:leading-relaxed">
                    <ReactMarkdown components={markdownComponents}>{m.text}</ReactMarkdown>
                  </div>
                )}
              </div>
              <span className="text-[10px] font-bold text-prestige-400 uppercase tracking-widest px-2">
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-6">
            <div className="w-12 h-12 rounded-2xl bg-prestige-950 text-white flex-shrink-0 flex items-center justify-center mt-1 animate-pulse shadow-lg">
              <Zap className="w-6 h-6 text-accent-gold" />
            </div>
            <div className="p-6 bg-white border border-prestige-200 rounded-[2rem] rounded-tl-none flex items-center gap-3">
              <Loader2 className="w-5 h-5 text-accent-indigo animate-spin" />
              <span className="text-sm font-black text-prestige-950 animate-pulse tracking-tight">ANALYZING LEGAL FRAMEWORK...</span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

        </div>

        {/* Side Panel: Precedent Library */}
        <AnimatePresence>
          {showLibrary && (
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute right-0 top-0 bottom-0 w-96 bg-white border-l border-prestige-100 shadow-2xl z-20 flex flex-col"
            >
              <div className="p-6 border-b border-prestige-100 flex items-center justify-between bg-prestige-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-accent-gold/10 flex items-center justify-center">
                    <Library className="w-4 h-4 text-accent-gold" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-prestige-950 tracking-tight">Precedent Library</h2>
                    <p className="text-[10px] text-prestige-400 font-bold uppercase tracking-widest">Case Law Database</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowLibrary(false)}
                  className="p-2 hover:bg-prestige-100 rounded-lg text-prestige-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 border-b border-prestige-100">
                <form onSubmit={handlePrecedentSearch} className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-prestige-400" />
                  <input 
                    value={precedentSearchQuery}
                    onChange={(e) => setPrecedentSearchQuery(e.target.value)}
                    placeholder="Search keywords, citations..."
                    className="w-full pl-10 pr-4 py-2.5 bg-prestige-50 border border-prestige-100 rounded-xl text-xs font-bold focus:bg-white focus:ring-2 focus:ring-accent-gold outline-none transition-all"
                  />
                  {isSearchingPrecedents && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-accent-gold animate-spin" />
                  )}
                </form>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
                {precedents.length === 0 ? (
                  <div className="text-center py-12 space-y-4">
                    <div className="w-12 h-12 bg-prestige-50 rounded-full flex items-center justify-center mx-auto">
                      <Search className="w-6 h-6 text-prestige-200" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-black text-prestige-950 uppercase tracking-tight">No Precedents Loaded</p>
                      <p className="text-[10px] text-prestige-400 font-medium leading-relaxed px-6">
                        Search by keyword (e.g. "Good Faith") or citation to explore verified UAE precedents.
                      </p>
                    </div>
                  </div>
                ) : (
                  precedents.map((prec) => (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={prec.id}
                      className="p-4 bg-white border border-prestige-100 rounded-2xl hover:border-accent-gold hover:shadow-md transition-all group cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[8px] font-black bg-prestige-950 text-white px-2 py-0.5 rounded uppercase tracking-widest">
                          {prec.jurisdiction}
                        </span>
                        <span className="text-[9px] font-bold text-accent-gold">{prec.citation}</span>
                      </div>
                      <h3 className="text-xs font-black text-prestige-950 group-hover:text-accent-gold transition-colors mb-2 leading-tight">
                        {prec.caseName}
                      </h3>
                      <p className="text-[10px] text-prestige-500 line-clamp-3 mb-3 leading-relaxed font-medium">
                        {prec.summary}
                      </p>
                      <div className="flex flex-wrap gap-1 mb-3">
                        {prec.legalPrinciples.map(principle => (
                          <span key={principle} className="text-[8px] font-bold text-prestige-400 border border-prestige-100 px-2 py-0.5 rounded-full bg-prestige-50/50">
                            {principle}
                          </span>
                        ))}
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSend(`Analyze the technical implications of ${prec.caseName} (${prec.citation}) in relation to my current matter.`);
                        }}
                        className="w-full py-2 bg-prestige-50 hover:bg-accent-gold hover:text-prestige-950 text-[9px] font-black uppercase tracking-widest text-prestige-400 rounded-lg transition-all flex items-center justify-center gap-2"
                      >
                        <Zap className="w-3 h-3" />
                        Analyze with AI
                      </button>
                    </motion.div>
                  ))
                )}
              </div>
              
              <div className="p-4 bg-prestige-50/80 border-t border-prestige-100">
                <div className="flex items-center gap-2 p-3 bg-white rounded-xl border border-prestige-100">
                  <div className="w-6 h-6 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <span className="text-[9px] font-black text-prestige-950 uppercase tracking-widest">MOJ Authenticated Data</span>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      <div className={cn(
        "absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-prestige-50 via-prestige-50 to-transparent z-20 transition-all duration-500",
        showLibrary ? "pr-[26rem]" : "pr-8"
      )}>
        <div className="max-w-4xl mx-auto space-y-4">
          <AnimatePresence>
            {attachedFile && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="p-4 bg-white border border-prestige-200 rounded-2xl flex items-center justify-between shadow-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-prestige-50 rounded-xl flex items-center justify-center text-accent-indigo">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="text-start">
                    <p className="text-[10px] font-black text-prestige-400 uppercase tracking-widest">Document Analysis Active</p>
                    <p className="text-xs font-bold text-prestige-950 truncate max-w-[250px]">{attachedFile.name}</p>
                  </div>
                  {isExtracting && <Loader2 className="w-3 h-3 text-accent-indigo animate-spin" />}
                </div>
                <button onClick={removeFile} className="p-2 hover:bg-prestige-50 rounded-lg text-prestige-400">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="p-2 bg-white border border-prestige-200 rounded-3xl shadow-2xl flex items-center gap-2 focus-within:ring-2 focus-within:ring-accent-indigo transition-all ring-offset-4 ring-offset-prestige-50"
          >
            <div className="flex flex-1 items-center px-2 gap-2">
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-3 hover:bg-prestige-50 rounded-2xl text-prestige-400 transition-colors"
                title="Attach PDF"
              >
                <Paperclip className="w-5 h-5" />
              </button>
              <input 
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={handleFileChange}
              />
              <input 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Submit technical legal query or request drafting outline..."
                className="flex-1 py-4 bg-transparent text-prestige-950 font-bold placeholder:text-prestige-300 outline-none text-sm"
              />
            </div>
            
            <button 
              type="submit"
              disabled={isLoading || (!input.trim() && !pdfContent)}
              className="p-4 bg-prestige-950 text-white rounded-2xl shadow-xl hover:scale-105 active:scale-95 disabled:opacity-50 disabled:grayscale transition-all disabled:scale-100"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          
          <div className="flex justify-center gap-2 mt-4 px-4 overflow-x-auto pb-2 scrollbar-hide whitespace-nowrap">
            {suggestedPrompts.map(prompt => (
              <button
                key={prompt}
                onClick={() => setInput(prompt)}
                className="px-4 py-2 bg-white/50 border border-prestige-200 hover:bg-white hover:border-accent-gold hover:text-accent-gold text-prestige-500 text-[10px] font-bold rounded-xl transition-all shadow-sm flex items-center gap-2"
              >
                <Zap className="w-3 h-3 text-accent-gold/70" />
                {prompt}
              </button>
            ))}
          </div>

          <p className="mt-4 text-center text-[10px] font-bold text-prestige-400 uppercase tracking-widest">
            AI can make mistakes. Verify technical citations against official ministerial decrees.
          </p>
        </div>
      </div>
    </div>
  );
}
