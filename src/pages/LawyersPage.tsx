import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "../lib/motion-shim";
import { Calendar, ChevronDown, DollarSign, Filter, Loader2, Scale, Users } from "lucide-react";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { cn } from "../lib/utils";
import { useLanguage } from "../contexts/LanguageContext";
import { useUser } from "../contexts/UserContext";
import LawyerCard from "../components/LawyerCard";
import { Lawyer, getLawyers } from "../services/lawyerService";

export default function LawyersPage() {
  const { user } = useUser();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSpec, setSelectedSpec] = useState("All");
  const [maxPrice, setMaxPrice] = useState(1000);
  const [minRating, setMinRating] = useState(0);
  const [confirmingLawyer, setConfirmingLawyer] = useState<Lawyer | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      const data = await getLawyers();
      if (mounted) {
        setLawyers(data);
        setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const specializations = useMemo(
    () => ["All", ...Array.from(new Set(lawyers.map((l) => l.specialization)))],
    [lawyers],
  );

  const filteredLawyers = lawyers.filter((lawyer) => {
    if (lawyer.isOOO) return false;
    const specMatch = selectedSpec === "All" || lawyer.specialization === selectedSpec;
    const priceMatch = lawyer.price <= maxPrice;
    const ratingMatch = lawyer.rating >= minRating;
    return specMatch && priceMatch && ratingMatch;
  });

  const handleBook = async (lawyerId: string) => {
    const lawyer = lawyers.find((l) => l.id === lawyerId);
    if (lawyer) setConfirmingLawyer(lawyer);
  };

  const confirmBooking = async () => {
    if (!confirmingLawyer) return;

    if (!user) {
      sessionStorage.setItem("booking_handoff", "1");
      window.location.hash = "#/support";
      window.location.reload();
      return;
    }

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
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
        }),
      });

      const session = await response.json();
      if (session.id) {
        await addDoc(collection(db, "consultations"), {
          clientId: user.uid,
          lawyerId: lawyer.id,
          lawyerName: lawyer.name,
          price: typeof lawyer.price === "number" ? `AED ${lawyer.price}` : String(lawyer.price),
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
          meetingType: "video",
          meetingLink: `https://meet.google.com/mock-id-${Math.random().toString(36).substring(7)}`,
          status: "pending",
          paymentStatus: "paid",
          createdAt: serverTimestamp(),
        });
        navigate("/appointments");
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "consultations");
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-6 py-20 md:py-40 text-center space-y-6">
        <Loader2 className="w-16 h-16 text-accent-indigo animate-spin mx-auto" />
        <p className="text-prestige-500 font-black uppercase tracking-widest text-sm animate-pulse">
          Syncing with MOJ Directory...
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-24 space-y-20">
      <div className="text-center space-y-6 max-w-3xl mx-auto">
        <h2 className="text-5xl md:text-6xl font-extrabold text-prestige-950 tracking-tighter leading-none">
          Verified <span className="text-accent-gold italic serif">Consultants</span>
        </h2>
        <p className="text-xl text-prestige-500 font-medium">
          Licensed legal professionals verified by the UAE Ministry of Justice for professional consultation.
        </p>

        <div className="pt-4">
          <button
            onClick={() => navigate("/register-lawyer")}
            className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-accent-indigo bg-accent-indigo/5 px-5 py-2.5 rounded-full border border-accent-indigo/10 hover:bg-accent-indigo hover:text-white transition-all active:scale-95"
          >
            <Scale className="w-3.5 h-3.5" /> Are you a licensed lawyer? Join our network
          </button>
        </div>
      </div>

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
              {specializations.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
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
          {specializations.slice(1, 4).map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSpec(s)}
              className={cn(
                "hidden lg:block px-5 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-sm",
                selectedSpec === s ? "bg-prestige-950 text-white shadow-xl" : "bg-prestige-50 text-prestige-400 hover:bg-prestige-100",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-10">
        <AnimatePresence mode="popLayout">
          {filteredLawyers.map((lawyer) => (
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
                <h3 className="text-3xl font-black text-prestige-950 tracking-tighter">
                  Confirm <span className="text-accent-indigo italic serif font-normal">Booking</span>
                </h3>
                <p className="text-prestige-500 font-medium leading-relaxed">
                  Book a consultation with <span className="text-prestige-950 font-bold">{confirmingLawyer.name}</span> for{" "}
                  <span className="text-accent-indigo font-bold">{confirmingLawyer.price} AED</span>?
                </p>
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
                  {user ? "Confirm" : "Sign In to Book"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {filteredLawyers.length === 0 && (
        <div className="text-center py-20 bg-prestige-50 rounded-[4rem] border-2 border-dashed border-prestige-200">
          <Users className="w-16 h-16 text-prestige-200 mx-auto mb-6" />
          <p className="text-prestige-400 font-bold italic tracking-tight">
            No verified consultants match your current filters.
          </p>
          <button
            onClick={() => {
              setSelectedSpec("All");
              setMaxPrice(2000);
              setMinRating(0);
            }}
            className="mt-6 text-accent-indigo font-black uppercase tracking-widest text-xs hover:underline decoration-2"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}
