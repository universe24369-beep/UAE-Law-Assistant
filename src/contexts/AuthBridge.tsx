import React, { createContext, useContext, useEffect } from "react";
import { useClerk, useUser as useClerkUser } from "@clerk/clerk-react";
import { clearDemoSession } from "../lib/firebase";
import { clearSessionUser, mapClerkUserToAppUser, setSessionUser, AppUser } from "../lib/session";

type AuthBridgeValue = {
  user: AppUser | null;
  isLoaded: boolean;
  openSignIn: () => void;
  signOut: () => Promise<void>;
};

const AuthBridgeContext = createContext<AuthBridgeValue | undefined>(undefined);

export const ClerkAuthBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLoaded, user } = useClerkUser();
  const clerk = useClerk();
  const appUser = user ? mapClerkUserToAppUser(user) : null;

  useEffect(() => {
    if (appUser) {
      setSessionUser(appUser);
    } else {
      clearSessionUser();
    }
  }, [appUser]);

  useEffect(() => {
    const handler = () => clerk.openSignIn();
    window.addEventListener("huqiqiyy-open-sign-in", handler);
    return () => window.removeEventListener("huqiqiyy-open-sign-in", handler);
  }, [clerk]);

  return (
    <AuthBridgeContext.Provider
      value={{
        user: appUser,
        isLoaded,
        openSignIn: () => clerk.openSignIn(),
        signOut: async () => {
          await clerk.signOut();
          clearDemoSession();
          clearSessionUser();
          window.dispatchEvent(new Event("huqiqiyy-sign-out"));
        },
      }}
    >
      {children}
    </AuthBridgeContext.Provider>
  );
};

export const StaticAuthBridge: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AuthBridgeContext.Provider
      value={{
        user: null,
        isLoaded: true,
        openSignIn: () => window.dispatchEvent(new Event("huqiqiyy-open-sign-in")),
        signOut: async () => {
          clearDemoSession();
          clearSessionUser();
          window.dispatchEvent(new Event("huqiqiyy-sign-out"));
        },
      }}
    >
      {children}
    </AuthBridgeContext.Provider>
  );
};

export const useAuthBridge = () => {
  const context = useContext(AuthBridgeContext);
  if (!context) {
    throw new Error("useAuthBridge must be used within an AuthBridge provider");
  }
  return context;
};
