export interface AppProviderInfo {
  providerId?: string | null;
  email?: string | null;
}

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string;
  emailVerified: boolean;
  isAnonymous: boolean;
  providerData: AppProviderInfo[];
  photoURL?: string | null;
}

const SESSION_USER_KEY = "huqiqiyy_session_user";
const DEFAULT_ADMIN_EMAILS = ["universe.24.369@gmail.com", "quirkly.creative@gmail.com", "digesh116@gmail.com"];

function parseAdminEmails() {
  const raw = import.meta.env.VITE_ADMIN_EMAILS || DEFAULT_ADMIN_EMAILS.join(",");
  return raw
    .split(",")
    .map((email: string) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getConfiguredAdminEmails() {
  return parseAdminEmails();
}

export function isAllowedAdminEmail(email?: string | null) {
  if (!email) return false;
  return parseAdminEmails().includes(email.trim().toLowerCase());
}

export const mapClerkUserToAppUser = (clerkUser: any): AppUser => {
  const email = clerkUser?.primaryEmailAddress?.emailAddress || clerkUser?.emailAddresses?.[0]?.emailAddress || null;
  const firstName = clerkUser?.firstName || "";
  const lastName = clerkUser?.lastName || "";
  const displayName = `${firstName} ${lastName}`.trim() || email || "User";
  const emailVerified = Boolean(
    clerkUser?.emailAddresses?.some((address: any) => address?.verification?.status === "verified")
  );

  return {
    uid: clerkUser?.id || "clerk-user",
    email,
    displayName,
    emailVerified,
    isAnonymous: false,
    providerData: [{ providerId: "clerk", email }],
    photoURL: clerkUser?.imageUrl || null,
  };
};

export const getSessionUser = (): AppUser | null => {
  try {
    const raw = localStorage.getItem(SESSION_USER_KEY);
    return raw ? JSON.parse(raw) as AppUser : null;
  } catch {
    return null;
  }
};

export const setSessionUser = (user: AppUser) => {
  localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
};

export const clearSessionUser = () => {
  localStorage.removeItem(SESSION_USER_KEY);
};
