import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { getLawyerByUserId, Lawyer } from "../services/lawyerService";
import { getDemoUser, clearDemoSession } from "../lib/firebase";
import { clearSessionUser, isAllowedAdminEmail, setSessionUser } from "../lib/session";
import { useAuthBridge } from "./AuthBridge";

interface UserContextType {
  user: any;
  loading: boolean;
  lawyerProfile: Lawyer | null;
  isSuperAdmin: boolean;
  isAuthorized: boolean;
  toggleLawyerRole: () => void;
  setLawyerProfile: (profile: Lawyer | null) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user: clerkUser, isLoaded } = useAuthBridge();
  const [demoUser, setDemoUser] = useState(getDemoUser());
  const [lawyerProfile, setLawyerProfile] = useState<Lawyer | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const hasInitializedRole = useRef(false);

  const user = clerkUser || demoUser;
  const loading = !isLoaded && !demoUser;
  const isSuperAdmin = isAllowedAdminEmail(user?.email);

  useEffect(() => {
    async function checkLawyer() {
      if (user) {
        if (isSuperAdmin && hasInitializedRole.current) return;

        const authRef = doc(db, "authorized_lawyers", user.email?.toLowerCase().trim() || "");
        const authSnap = await getDoc(authRef);
        const authorized = authSnap.exists();
        setIsAuthorized(authorized);

        import('../services/cleanupService').then(({ cleanupOldConversations }) => {
          cleanupOldConversations(user.uid);
        });

        const profile = await getLawyerByUserId(user.uid);
        
        if (authorized || profile) {
          setLawyerProfile(profile || { id: user.uid, name: user.displayName || "Lawyer" } as any);
        } else {
          setLawyerProfile(null);
        }

        hasInitializedRole.current = true;
      } else {
        setLawyerProfile(null);
        setIsAuthorized(false);
        hasInitializedRole.current = false;
      }
    }
    checkLawyer();
  }, [user, isSuperAdmin]);

  useEffect(() => {
    if (clerkUser) {
      setSessionUser(clerkUser);
      return;
    }

    if (demoUser) {
      setSessionUser(demoUser);
      return;
    }

    clearSessionUser();
  }, [clerkUser, demoUser]);

  useEffect(() => {
    const syncDemo = () => setDemoUser(getDemoUser());
    const handleSignOut = () => {
      clearDemoSession();
      setDemoUser(null);
    };
    window.addEventListener("focus", syncDemo);
    window.addEventListener("storage", syncDemo);
    window.addEventListener("huqiqiyy-demo-session-changed", syncDemo as EventListener);
    window.addEventListener("huqiqiyy-sign-out", handleSignOut);
    return () => {
      window.removeEventListener("focus", syncDemo);
      window.removeEventListener("storage", syncDemo);
      window.removeEventListener("huqiqiyy-demo-session-changed", syncDemo as EventListener);
      window.removeEventListener("huqiqiyy-sign-out", handleSignOut);
    };
  }, []);

  const toggleLawyerRole = async () => {
    if (!user || !isSuperAdmin) return;
    
    if (lawyerProfile) {
      setLawyerProfile(null);
    } else {
      const profile = await getLawyerByUserId(user.uid);
      if (profile) {
        setLawyerProfile(profile);
      } else {
        setLawyerProfile({ id: user.uid, name: user.displayName || "Lawyer" } as any);
      }
    }
  };

  return (
    <UserContext.Provider value={{ 
      user, 
      loading, 
      lawyerProfile, 
      isSuperAdmin, 
      isAuthorized, 
      toggleLawyerRole,
      setLawyerProfile
    }}>
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
