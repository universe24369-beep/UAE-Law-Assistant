import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { getConfiguredAdminEmails } from "./session";

export type SupportIncidentCategory =
  | "login"
  | "account"
  | "upload"
  | "navigation"
  | "performance"
  | "payment"
  | "bug"
  | "other";

export type SupportIncidentSeverity = "low" | "medium" | "high";
export type SupportIncidentStatus = "new" | "needs_screenshot" | "triaged" | "resolved";

export interface SupportScreenshotAttachment {
  fileName: string;
  mimeType: string;
  fileSize: number;
  previewDataUrl?: string | null;
}

export interface SupportIncidentRecord {
  id: string;
  userId: string;
  userEmail: string | null;
  userRole: "client" | "lawyer";
  route: string;
  pageTitle: string;
  source: "support_mcp";
  category: SupportIncidentCategory;
  severity: SupportIncidentSeverity;
  status: SupportIncidentStatus;
  title: string;
  summary: string;
  userMessage: string;
  testScenarios: string[];
  screenshot: SupportScreenshotAttachment | null;
  manualConfirmationRequired: true;
  publicationGate: "chat_confirmation";
  adminRecipients: string[];
  createdAt: any;
  updatedAt: any;
}

export type SupportIncidentInput = {
  userId: string;
  userEmail: string | null;
  userRole: "client" | "lawyer";
  route: string;
  pageTitle: string;
  message: string;
  screenshot?: SupportScreenshotAttachment | null;
};

const LOCAL_INCIDENT_KEY = "huqiqiyy_support_incidents_v1";

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function makeLocalIncidentId() {
  return `incident-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function buildTitle(category: SupportIncidentCategory, route: string, message: string) {
  const cleaned = normalizeText(message);
  const routeLabel = route.includes("support") ? "support page" : route.replace(/^#?\/?/, "") || "current page";

  switch (category) {
    case "login":
      return `Login flow issue on ${routeLabel}`;
    case "account":
      return `Account access issue on ${routeLabel}`;
    case "upload":
      return `Upload flow issue on ${routeLabel}`;
    case "navigation":
      return `Navigation bug on ${routeLabel}`;
    case "performance":
      return `Page stability issue on ${routeLabel}`;
    case "payment":
      return `Billing or payment issue on ${routeLabel}`;
    case "bug":
      return `Bug report on ${routeLabel}`;
    default:
      return cleaned.length > 90 ? `${cleaned.slice(0, 87)}...` : cleaned;
  }
}

function classifySupportIncident(message: string): { category: SupportIncidentCategory; severity: SupportIncidentSeverity } {
  const normalized = message.toLowerCase();

  if (/(login|log in|sign in|password|otp|magic link|auth)/.test(normalized)) {
    return { category: "login", severity: "high" };
  }

  if (/(account|profile|email|verify|verification)/.test(normalized)) {
    return { category: "account", severity: "medium" };
  }

  if (/(upload|attach|attachment|screenshot|image|pdf|file)/.test(normalized)) {
    return { category: "upload", severity: "medium" };
  }

  if (/(navigate|navigation|button|link|route|menu|tab)/.test(normalized)) {
    return { category: "navigation", severity: "medium" };
  }

  if (/(blank|white screen|crash|freeze|stuck|lag|slow|error|fail|broken|not working|unable to|doesn't work|does not work)/.test(normalized)) {
    return { category: "performance", severity: "high" };
  }

  if (/(payment|invoice|refund|charge|billing)/.test(normalized)) {
    return { category: "payment", severity: "high" };
  }

  if (/(bug|issue|problem|broken|error)/.test(normalized)) {
    return { category: "bug", severity: "medium" };
  }

  return { category: "other", severity: "low" };
}

export function isBugLikeSupportIssue(message: string) {
  const normalized = message.toLowerCase();
  return [
    "bug",
    "issue",
    "problem",
    "error",
    "broken",
    "crash",
    "freeze",
    "stuck",
    "not working",
    "doesn't work",
    "does not work",
    "unable to",
    "blank",
    "white screen",
    "upload failed",
    "login failed",
    "sign in failed",
    "password reset",
    "payment failed",
  ].some((keyword) => normalized.includes(keyword));
}

function buildTestScenarios(category: SupportIncidentCategory, route: string, hasScreenshot: boolean) {
  const routeLabel = route.includes("support") ? "support page" : route;
  const base = [
    `Open ${routeLabel} and reproduce the exact user flow described in the report.`,
    `Repeat the flow as a lawyer and as a client to confirm the issue is role-specific or global.`,
    `Verify the fix or regression path before marking the ticket ready for publish.`,
  ];

  const scenarioMap: Record<SupportIncidentCategory, string[]> = {
    login: [
      `Open the login flow from ${routeLabel} and verify the user can reach a valid auth state.`,
      `Test a fresh email login and a returning-session login separately.`,
      `Confirm the error text disappears after a successful sign-in attempt.`,
    ],
    account: [
      `Open the account/profile area from ${routeLabel} and verify the expected user details render.`,
      `Switch between lawyer and client contexts to confirm the right profile data loads.`,
      `Check that any verification or reset action completes without a blank state.`,
    ],
    upload: [
      `Attach a screenshot or file from ${routeLabel} and verify the attachment preview appears.`,
      `Submit the report with and without an attachment to confirm both paths behave.`,
      `Validate that the uploaded evidence is visible in the admin incident view.`,
    ],
    navigation: [
      `Click the route or button mentioned in the report and confirm the app lands on the expected view.`,
      `Use the browser back button and verify the page state stays intact.`,
      `Check that the same navigation path works after a refresh.`,
    ],
    performance: [
      `Load ${routeLabel} from a cold start and watch for blank or stalled rendering.`,
      `Repeat the flow after a refresh to confirm the problem is reproducible.`,
      `Check browser console errors and network timing for a likely frontend regression.`,
    ],
    payment: [
      `Open the payment or invoice step from ${routeLabel} and verify the request is submitted.`,
      `Confirm that validation errors and successful completions are both visible to the user.`,
      `Check that the incident is visible to admin logins before any publish step.`,
    ],
    bug: base,
    other: base,
  };

  const scenarios = scenarioMap[category] || base;
  if (hasScreenshot) {
    scenarios.unshift("Use the attached screenshot as the primary reproduction clue.");
  }

  return [...new Set(scenarios.map((scenario) => scenario.trim()).filter(Boolean))].slice(0, 4);
}

function buildSummary(message: string) {
  const cleaned = normalizeText(message);
  return cleaned.length > 180 ? `${cleaned.slice(0, 177)}...` : cleaned;
}

function getLocalIncidents(): SupportIncidentRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_INCIDENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SupportIncidentRecord[]) : [];
  } catch {
    return [];
  }
}

function saveLocalIncidents(incidents: SupportIncidentRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_INCIDENT_KEY, JSON.stringify(incidents.slice(0, 250)));
  } catch {
    // Ignore localStorage failures.
  }
}

function appendLocalIncident(incident: SupportIncidentRecord) {
  const current = getLocalIncidents();
  const next = [incident, ...current.filter((item) => item.id !== incident.id)];
  saveLocalIncidents(next);
}

export function getLocalSupportIncidents() {
  return getLocalIncidents();
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read screenshot."));
    reader.readAsDataURL(file);
  });
}

async function buildPreviewDataUrl(file: File) {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return null;
  }

  const dataUrl = await fileToDataUrl(file);

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxWidth = 960;
      const maxHeight = 540;
      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Unable to prepare screenshot preview."));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.72));
    };
    img.onerror = () => reject(new Error("Failed to render screenshot preview."));
    img.src = dataUrl;
  });
}

export async function prepareScreenshotAttachment(file: File): Promise<SupportScreenshotAttachment> {
  const baseAttachment: SupportScreenshotAttachment = {
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
    previewDataUrl: null,
  };

  try {
    const previewDataUrl = await buildPreviewDataUrl(file);
    return { ...baseAttachment, previewDataUrl };
  } catch {
    return baseAttachment;
  }
}

export async function createSupportIncident(input: SupportIncidentInput): Promise<SupportIncidentRecord> {
  const { category, severity } = classifySupportIncident(input.message);
  const route = input.route || "#/support";
  const adminRecipients = getConfiguredAdminEmails();
  const incident: SupportIncidentRecord = {
    id: makeLocalIncidentId(),
    userId: input.userId,
    userEmail: input.userEmail,
    userRole: input.userRole,
    route,
    pageTitle: input.pageTitle,
    source: "support_mcp",
    category,
    severity,
    status: "new",
    title: buildTitle(category, route, input.message),
    summary: buildSummary(input.message),
    userMessage: input.message,
    testScenarios: buildTestScenarios(category, route, Boolean(input.screenshot)),
    screenshot: input.screenshot || null,
    manualConfirmationRequired: true,
    publicationGate: "chat_confirmation",
    adminRecipients,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const docRef = await addDoc(collection(db, "support_incidents"), {
      ...incident,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    incident.id = docRef.id;
  } catch {
    // Firestore is best-effort here. Keep a local copy so admin review still works in dev/test.
  }

  appendLocalIncident(incident);
  return incident;
}

export async function fetchSupportIncidentsFromFirestore() {
  const q = query(collection(db, "support_incidents"), orderBy("updatedAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((incidentDoc) => ({ id: incidentDoc.id, ...incidentDoc.data() })) as SupportIncidentRecord[];
}

export async function acknowledgeSupportIncident(incidentId: string) {
  await updateDoc(doc(db, "support_incidents", incidentId), {
    status: "triaged",
    updatedAt: serverTimestamp(),
  });
}
