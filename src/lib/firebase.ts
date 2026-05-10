import { clearSessionUser, getSessionUser, setSessionUser } from "./session";

export const db = {} as Record<string, never>;

const DEMO_USER_KEY = "huqiqiyy_demo_user";

export type DemoUser = {
  uid: string;
  email: string | null;
  displayName: string;
  emailVerified: boolean;
  isAnonymous: boolean;
  providerData: [];
};

export const getDemoUser = (): DemoUser | null => {
  try {
    const raw = localStorage.getItem(DEMO_USER_KEY);
    return raw ? JSON.parse(raw) as DemoUser : null;
  } catch {
    return null;
  }
};

const buildDemoUser = (email?: string | null): DemoUser => {
  const safeEmail = email?.trim().toLowerCase() || "demo@huqiqiyy.local";
  const name = safeEmail.includes("@") ? safeEmail.split("@")[0] : safeEmail;
  return {
    uid: `demo-${safeEmail.replace(/[^a-z0-9]/g, "-")}`,
    email: safeEmail,
    displayName: name.charAt(0).toUpperCase() + name.slice(1) || "Demo User",
    emailVerified: true,
    isAnonymous: true,
    providerData: [],
  };
};

export const startDemoSession = (email?: string | null) => {
  const demoUser = buildDemoUser(email);
  localStorage.setItem(DEMO_USER_KEY, JSON.stringify(demoUser));
  setSessionUser(demoUser);
  return demoUser;
};

export const clearDemoSession = () => {
  localStorage.removeItem(DEMO_USER_KEY);
  clearSessionUser();
};

export const signInWithGoogle = async () => {
  if (!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) {
    const email = window.prompt("Enter your email to sign in for testing");
    if (!email?.trim()) return;
    startDemoSession(email);
    window.dispatchEvent(new Event("huqiqiyy-demo-session-changed"));
    return;
  }
  window.dispatchEvent(new Event("huqiqiyy-open-sign-in"));
};

export const logout = async () => {
  clearDemoSession();
  window.dispatchEvent(new Event("huqiqiyy-sign-out"));
};

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const sessionUser = getSessionUser();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: sessionUser?.uid,
      email: sessionUser?.email,
      emailVerified: sessionUser?.emailVerified,
      isAnonymous: sessionUser?.isAnonymous,
      providerInfo: sessionUser?.providerData || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error:", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
