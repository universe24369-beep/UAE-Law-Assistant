import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Scale, MessageSquare, Users, Calendar, LogIn, LogOut, Search, Globe, Paperclip, CheckCircle2, FlaskConical, Loader2, Zap, ShieldCheck, LifeBuoy } from "lucide-react";
import { signInWithGoogle, db } from "../lib/firebase";
import { doc, setDoc, deleteDoc, getDoc } from "firebase/firestore";
import { motion, AnimatePresence } from "../lib/motion-shim";
import { cn } from "../lib/utils";
import { useLanguage } from "../contexts/LanguageContext";
import { useUser } from "../contexts/UserContext";
import { useAuthBridge } from "../contexts/AuthBridge";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, loading, lawyerProfile, isSuperAdmin, toggleLawyerRole } = useUser();
  const { signOut } = useAuthBridge();
  const location = useLocation();
  const { language, setLanguage, t, isRtl } = useLanguage();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isAuthActionLoading, setIsAuthActionLoading] = React.useState(false);
  const [isToggleLoading, setIsToggleLoading] = React.useState(false);
  const isFixedPage = location.pathname === "/assistant" || location.pathname === "/history";

  const handleToggleRole = async () => {
    setIsToggleLoading(true);
    await toggleLawyerRole();
    setIsToggleLoading(false);
  };

  const navItems = lawyerProfile 
    ? [
        { name: t("workspaceHome") || "Dashboard", path: "/dashboard", icon: MessageSquare },
        { name: t("researchCopilot") || "Research", path: "/copilot", icon: ShieldCheck },
        { name: t("legislation"), path: "/laws", icon: Search },
        { name: t("history"), path: "/history", icon: Scale },
      ]
    : [
        { name: t("home"), path: "/", icon: MessageSquare },
        { name: t("assistant"), path: "/assistant", icon: Zap },
        { name: t("myBookings"), path: "/appointments", icon: Calendar },
      ];

  const secondaryNavItems = lawyerProfile
    ? [
        { name: t("settings") || "Settings", path: "/settings", icon: Calendar }, // Scheduling/Availability in settings
        ...(isSuperAdmin ? [{ name: t("admin"), path: "/management", icon: ShieldCheck }] : []),
      ]
    : [
        { name: t("legislation"), path: "/laws", icon: Search },
        { name: t("history"), path: "/history", icon: Scale },
        ...(isSuperAdmin ? [{ name: t("admin"), path: "/management", icon: ShieldCheck }] : []),
      ];

  const handleLogin = async () => {
    if (isAuthActionLoading) return;
    setIsAuthActionLoading(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error("Layout login error:", err);
    } finally {
      setIsAuthActionLoading(false);
    }
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

  return (
    <div className={cn("h-screen bg-prestige-50 flex flex-col font-sans overflow-hidden", isRtl && "font-arabic")}>
      <header className="sticky top-0 z-50 w-full border-b border-prestige-200 bg-white/80 backdrop-blur-xl">
        <div className="container mx-auto px-6 h-20 flex items-center justify-between gap-4">
          <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center gap-3 group shrink-0">
            <div className="w-10 h-10 bg-accent-indigo rounded-xl flex items-center justify-center shadow-lg shadow-accent-indigo/20 group-hover:scale-110 transition-transform">
              <Scale className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm sm:text-base font-extrabold tracking-tight text-prestige-950 leading-tight">Huqiqiyy</span>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black text-accent-gold uppercase tracking-widest leading-none">Co-pilot</span>
                <div className="flex items-center gap-1">
                  <div className="w-1 h-1 bg-accent-indigo rounded-full animate-pulse" />
                  <span className="text-[8px] font-black text-accent-indigo uppercase tracking-widest">UAE</span>
                </div>
              </div>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-10 h-full">
            {[...navItems, ...secondaryNavItems].map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center h-full text-sm font-bold transition-all relative group uppercase tracking-widest text-[11px]",
                    isActive ? "text-accent-indigo" : "text-prestige-500 hover:text-prestige-900"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {item.name}
                  </div>
                  {isActive && (
                    <motion.div 
                      layoutId="nav-underline"
                      className="absolute bottom-0 left-0 right-0 h-1 bg-accent-indigo rounded-t-full"
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-6">
            <div className="hidden sm:flex items-center bg-prestige-100 rounded-full p-1 border border-prestige-200">
              <button 
                onClick={() => setLanguage('en')}
                className={cn(
                  "px-3 py-1 text-[10px] font-black rounded-full transition-all",
                  language === 'en' ? "bg-white text-accent-indigo shadow-sm" : "text-prestige-400 hover:text-prestige-600"
                )}
              >
                EN
              </button>
              <button 
                onClick={() => setLanguage('ar')}
                className={cn(
                  "px-3 py-1 text-[10px] font-black rounded-full transition-all",
                  language === 'ar' ? "bg-white text-accent-indigo shadow-sm" : "text-prestige-400 hover:text-prestige-600"
                )}
              >
                AR
              </button>
            </div>

            {loading || isAuthActionLoading ? (
              <div className="w-10 h-10 rounded-full bg-prestige-200 animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-4 pl-4 border-l border-prestige-200">
                {isSuperAdmin && (
                  <button
                    onClick={handleToggleRole}
                    disabled={isToggleLoading}
                    title="Toggle Lawyer/Client Role"
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all",
                      lawyerProfile 
                        ? "bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100" 
                        : "bg-emerald-50 text-emerald-600 border border-emerald-100 hover:bg-emerald-100"
                    )}
                  >
                    {isToggleLoading ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <FlaskConical className="w-3 h-3" />
                    )}
                    {lawyerProfile ? t("becomeClient") : t("becomeLawyer")}
                  </button>
                )}
                <div className="hidden sm:block text-end">
                  <div className="flex items-center gap-2 justify-end mb-0.5">
                    {lawyerProfile && (
                      <>
                        <Link to="/dashboard" className="text-[9px] font-black bg-accent-gold/10 text-accent-gold px-2 py-0.5 rounded border border-accent-gold/20 hover:bg-accent-gold hover:text-prestige-950 transition-colors uppercase tracking-widest leading-none">
                          Dashboard
                        </Link>
                        <Link to="/copilot" className="text-[9px] font-black bg-accent-indigo/10 text-accent-indigo px-2 py-0.5 rounded border border-accent-indigo/20 hover:bg-accent-indigo hover:text-white transition-colors uppercase tracking-widest leading-none">
                          Co-pilot
                        </Link>
                      </>
                    )}
                    <p className="text-xs font-bold text-prestige-900">{user.displayName}</p>
                  </div>
                  <button onClick={signOut} className="text-[10px] uppercase font-black tracking-widest text-prestige-400 hover:text-red-500 transition-colors">
                    {t("logout")}
                  </button>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="avatar" className="w-10 h-10 rounded-xl border-2 border-prestige-100 shadow-sm object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-xl border-2 border-prestige-100 shadow-sm bg-accent-indigo/10 text-accent-indigo flex items-center justify-center font-black text-xs">
                    {(user.displayName || "U").slice(0, 2).toUpperCase()}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex gap-2">
                <button 
                  onClick={handleLogin}
                  className="p-2.5 sm:px-5 sm:py-2.5 bg-prestige-950 text-white rounded-xl text-sm font-bold hover:bg-prestige-800 transition-all shadow-xl shadow-prestige-950/10 active:scale-95 flex items-center justify-center"
                  disabled={isAuthActionLoading}
                >
                  <span className="hidden sm:inline">{t("login") || "Sign in"}</span>
                  <LogIn className="w-5 h-5 sm:hidden" />
                </button>
              </div>
            )}

            <div className="sm:hidden flex items-center bg-prestige-100 rounded-full p-0.5 border border-prestige-200">
               <button 
                onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
                className="px-2.5 py-1 text-[9px] font-black rounded-full bg-white text-accent-indigo shadow-sm uppercase"
              >
                {language === 'en' ? 'AR' : 'EN'}
              </button>
            </div>

            <button 
              onClick={toggleMobileMenu}
              className="lg:hidden p-2 text-prestige-900 hover:bg-prestige-50 rounded-xl transition-colors"
            >
              <div className="w-6 h-5 flex flex-col justify-between relative">
                <span className={cn("w-full h-0.5 bg-current rounded-full transition-all duration-300", isMobileMenuOpen && "absolute top-2 rotate-45")} />
                <span className={cn("w-full h-0.5 bg-current rounded-full transition-all duration-300", isMobileMenuOpen && "opacity-0")} />
                <span className={cn("w-full h-0.5 bg-current rounded-full transition-all duration-300", isMobileMenuOpen && "absolute top-2 -rotate-45")} />
              </div>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-white border-b border-prestige-200 overflow-hidden"
            >
              <div className="container mx-auto px-6 py-8 space-y-6">
                <div className="grid grid-cols-1 gap-4">
                  {[...navItems, ...secondaryNavItems].map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-4 p-4 rounded-2xl transition-all font-black uppercase tracking-widest text-xs",
                          isActive 
                            ? "bg-accent-indigo text-white shadow-lg shadow-accent-indigo/20" 
                            : "bg-prestige-50 text-prestige-950 hover:bg-prestige-100"
                        )}
                      >
                        <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-accent-indigo")} />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>

                <div className="pt-6 border-t border-prestige-100 flex items-center justify-between">
                  {user ? (
                    <div className="flex flex-col gap-4 w-full">
                      <div className="flex items-center gap-4 w-full">
                        <img src={user.photoURL || ""} alt="avatar" className="w-10 h-10 rounded-xl border-2 border-prestige-100" />
                        <div className="flex-1 text-start">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-prestige-900">{user.displayName}</p>
                    {lawyerProfile && (
                              <>
                                <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="text-[8px] font-black bg-accent-gold/10 text-accent-gold px-1.5 py-0.5 rounded border border-accent-gold/20 uppercase">
                                  Dashboard
                                </Link>
                                <Link to="/copilot" onClick={() => setIsMobileMenuOpen(false)} className="text-[8px] font-black bg-accent-indigo/10 text-accent-indigo px-1.5 py-0.5 rounded border border-accent-indigo/20 uppercase">
                                  Co-pilot
                                </Link>
                              </>
                            )}
                          </div>
                          <button onClick={signOut} className="text-[10px] uppercase font-black tracking-widest text-red-500">
                            {t("logout")}
                          </button>
                        </div>
                      </div>
                      {isSuperAdmin && (
                        <button
                          onClick={handleToggleRole}
                          disabled={isToggleLoading}
                          className={cn(
                            "flex items-center justify-center gap-2 w-full p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border",
                            lawyerProfile 
                              ? "bg-rose-50 text-rose-600 border-rose-100" 
                              : "bg-emerald-50 text-emerald-600 border-emerald-100"
                          )}
                        >
                          {isToggleLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <FlaskConical className="w-4 h-4" />
                          )}
                          {lawyerProfile ? t("becomeClient") : t("becomeLawyer")}
                        </button>
                      )}
                    </div>
                  ) : (
                    <button 
                      onClick={() => {
                        handleLogin();
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full py-4 bg-prestige-950 text-white rounded-2xl font-bold flex items-center justify-center gap-2"
                    >
                      <LogIn className="w-5 h-5" />
                      {t("register")}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <main className={cn("flex-1 flex flex-col min-h-0 relative", !isFixedPage && "overflow-y-auto")}>
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex-1 flex flex-col min-h-0"
        >
          {children}
        </motion.div>

        {/* Floating Support Button */}
        {user && location.pathname !== "/support" && (
          <Link 
            to="/support"
            className={cn(
              "fixed bottom-8 w-14 h-14 rounded-2xl shadow-2xl flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 group z-[100]",
              isRtl ? "left-8" : "right-8",
              lawyerProfile ? "bg-accent-indigo shadow-accent-indigo/30" : "bg-prestige-950 shadow-prestige-900/30"
            )}
          >
            <LifeBuoy className="w-7 h-7" />
            <div className={cn(
              "absolute py-1.5 px-3 bg-white text-prestige-950 text-[10px] font-black uppercase tracking-widest rounded-lg border border-prestige-100 shadow-xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none",
              isRtl ? "left-full ml-3" : "right-full mr-3"
            )}>
              {t("support")}
            </div>
          </Link>
        )}
      </main>
      
      {location.pathname !== "/assistant" && (
        <footer className="px-6 py-4 md:px-8 md:py-10 bg-prestige-950 text-white border-t border-prestige-800 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-8 text-[10px] md:text-[11px] font-bold tracking-widest uppercase">
          <div className="flex flex-col md:flex-row items-center gap-4 md:gap-12">
            <Link to="/" className="hidden md:flex items-center gap-2">
               <Scale className="w-4 h-4 text-accent-gold" />
               <span className="text-prestige-100">{t("appName")}</span>
            </Link>
            <div className="flex gap-6 md:gap-8">
              <span className="text-prestige-400 hover:text-white transition-colors cursor-pointer">{t("privacy")}</span>
              <span className="text-prestige-400 hover:text-white transition-colors cursor-pointer">{t("terms")}</span>
              <Link to="/support" className="text-prestige-400 hover:text-white transition-colors">{t("support")}</Link>
              {lawyerProfile ? (
                <button 
                  onClick={() => {
                    const url = window.location.origin;
                    navigator.clipboard.writeText(`Join me on Huqiqiyy: ${url}`);
                    alert(t("referralCopied"));
                  }}
                  className="text-accent-gold hover:text-white transition-colors flex items-center gap-2"
                >
                  <Users className="w-3 h-3" />
                  {t("referral")}
                </button>
              ) : (
                <Link to="/register-lawyer" className="text-accent-gold hover:text-white transition-colors">{t("joinAsLawyer")}</Link>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 bg-prestige-900/50 px-3 py-1.5 rounded-full border border-prestige-800 scale-90 md:scale-100">
            <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>
            <span className="text-prestige-300 text-[9px] md:text-[10px]">CORE AI ACTIVE</span>
          </div>
        </footer>
      )}
    </div>
  );
}
