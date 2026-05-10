import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "../lib/motion-shim";
import { Scale, Users, Gavel, ShieldCheck, Briefcase, ArrowRight } from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";

export default function Legislation() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const LAW_CATEGORIES = [
    { id: "labor", name: t("laborLaw"), icon: Briefcase, desc: t("laborLawDesc") },
    { id: "commercial", name: t("commercialLaw"), icon: Scale, desc: t("commercialLawDesc") },
    { id: "property", name: t("propertyLaw"), icon: ShieldCheck, desc: t("propertyLawDesc") },
    { id: "civil", name: t("civilLaw"), icon: Gavel, desc: t("civilLawDesc") },
    { id: "criminal", name: t("criminalLaw"), icon: ShieldCheck, desc: t("criminalLawDesc") },
    { id: "personal", name: t("personalStatusLaw"), icon: Users, desc: t("personalStatusLawDesc") }
  ];

  return (
    <div className="container mx-auto px-6 py-24 space-y-20">
      <div className="text-center space-y-6 max-w-3xl mx-auto">
        <h2 className="text-5xl md:text-6xl font-extrabold text-prestige-950 tracking-tighter leading-none">
          {t("legislationDirectory").split("Directory")[0]} <span className="text-accent-gold italic serif font-normal">Directory</span>
        </h2>
        <p className="text-xl text-prestige-50 font-medium">{t("legislationDirectoryDesc")}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {LAW_CATEGORIES.map(cat => (
          <motion.div 
            key={cat.id} 
            whileHover={{ y: -10, scale: 1.02 }}
            className="p-10 bg-white border border-prestige-100 rounded-[2.5rem] cursor-pointer hover:border-accent-indigo hover:shadow-2xl hover:shadow-accent-indigo/10 group transition-all duration-500"
            onClick={() => navigate(`/assistant?q=Tell me about the ${cat.id === 'personal' ? 'Personal Status Law' : cat.name} in UAE`)}
          >
            <div className="w-16 h-16 bg-prestige-50 rounded-2xl flex items-center justify-center text-accent-indigo mb-8 group-hover:bg-accent-indigo group-hover:text-white transition-all duration-500 transform group-hover:rotate-6">
              <cat.icon className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-prestige-900 mb-3 tracking-tight">{cat.name}</h3>
            <p className="text-prestige-500 leading-relaxed font-medium line-clamp-3">{cat.desc}</p>
            <div className="pt-6 mt-6 border-t border-prestige-50 flex items-center gap-2 text-accent-indigo font-black text-xs uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
              {t("exploreLaws")} <ArrowRight className="w-4 h-4" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
