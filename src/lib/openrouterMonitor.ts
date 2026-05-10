import { OPENROUTER_MODELS, OPENROUTER_MONITOR_CONFIG } from "./openrouterModels";

export interface OpenRouterMonitorSnapshot {
  tokenLimit: number;
  warningThresholdPct: number;
  usedTokens: number;
  requestCount: number;
  successCount: number;
  errorCount: number;
  primaryModel: string;
  fallbackModel: string;
  freeModel: string;
  visionModel: string;
  currentMode: "primary" | "fallback" | "free";
  updatedAt: string;
}

const STORAGE_KEY = "huqiqiyy_openrouter_monitor_v1";

function getDefaultSnapshot(): OpenRouterMonitorSnapshot {
  return {
    tokenLimit: OPENROUTER_MONITOR_CONFIG.tokenLimit,
    warningThresholdPct: OPENROUTER_MONITOR_CONFIG.warningThresholdPct,
    usedTokens: 0,
    requestCount: 0,
    successCount: 0,
    errorCount: 0,
    primaryModel: OPENROUTER_MONITOR_CONFIG.primaryModel,
    fallbackModel: OPENROUTER_MONITOR_CONFIG.fallbackModel,
    freeModel: OPENROUTER_MODELS.free,
    visionModel: OPENROUTER_MODELS.vision,
    currentMode: "primary",
    updatedAt: new Date().toISOString(),
  };
}

function sanitizeNumber(value: unknown, fallback: number) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function computeCurrentMode(snapshot: OpenRouterMonitorSnapshot): OpenRouterMonitorSnapshot["currentMode"] {
  if (snapshot.tokenLimit <= 0) return "free";
  const pct = snapshot.usedTokens / snapshot.tokenLimit;
  if (pct >= 1) return "free";
  if (pct >= snapshot.warningThresholdPct / 100) return "fallback";
  return "primary";
}

export function getOpenRouterMonitorSnapshot(): OpenRouterMonitorSnapshot {
  if (typeof window === "undefined") {
    return getDefaultSnapshot();
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSnapshot();

    const parsed = JSON.parse(raw) as Partial<OpenRouterMonitorSnapshot>;
    const snapshot: OpenRouterMonitorSnapshot = {
      ...getDefaultSnapshot(),
      ...parsed,
      tokenLimit: sanitizeNumber(parsed.tokenLimit, OPENROUTER_MONITOR_CONFIG.tokenLimit),
      warningThresholdPct: sanitizeNumber(parsed.warningThresholdPct, OPENROUTER_MONITOR_CONFIG.warningThresholdPct),
      usedTokens: sanitizeNumber(parsed.usedTokens, 0),
      requestCount: sanitizeNumber(parsed.requestCount, 0),
      successCount: sanitizeNumber(parsed.successCount, 0),
      errorCount: sanitizeNumber(parsed.errorCount, 0),
      primaryModel: typeof parsed.primaryModel === "string" ? parsed.primaryModel : OPENROUTER_MONITOR_CONFIG.primaryModel,
      fallbackModel: typeof parsed.fallbackModel === "string" ? parsed.fallbackModel : OPENROUTER_MONITOR_CONFIG.fallbackModel,
      freeModel: typeof parsed.freeModel === "string" ? parsed.freeModel : OPENROUTER_MODELS.free,
      visionModel: typeof parsed.visionModel === "string" ? parsed.visionModel : OPENROUTER_MODELS.vision,
      currentMode: (parsed.currentMode === "primary" || parsed.currentMode === "fallback" || parsed.currentMode === "free")
        ? parsed.currentMode
        : "primary",
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString(),
    };

    snapshot.currentMode = computeCurrentMode(snapshot);
    return snapshot;
  } catch {
    return getDefaultSnapshot();
  }
}

export function saveOpenRouterMonitorSnapshot(snapshot: OpenRouterMonitorSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore localStorage failures.
  }
}

export function resetOpenRouterMonitorSnapshot() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore localStorage failures.
  }
}

export function recordOpenRouterUsage(params: {
  totalTokens?: number;
  status: "success" | "error";
  model?: string;
}) {
  const snapshot = getOpenRouterMonitorSnapshot();
  const totalTokens = Math.max(0, Math.floor(params.totalTokens || 0));

  snapshot.requestCount += 1;
  snapshot.successCount += params.status === "success" ? 1 : 0;
  snapshot.errorCount += params.status === "error" ? 1 : 0;
  snapshot.usedTokens += params.status === "success" ? totalTokens : 0;
  snapshot.updatedAt = new Date().toISOString();
  snapshot.currentMode = computeCurrentMode(snapshot);
  saveOpenRouterMonitorSnapshot(snapshot);
  return snapshot;
}

export function getOpenRouterRoutingState(requestedModel: string, hasImage = false) {
  const snapshot = getOpenRouterMonitorSnapshot();
  const utilizationPct = snapshot.tokenLimit > 0 ? (snapshot.usedTokens / snapshot.tokenLimit) * 100 : 0;
  const isCritical = utilizationPct >= 100;
  const isWarning = utilizationPct >= snapshot.warningThresholdPct;

  const baseCandidates = hasImage
    ? [snapshot.visionModel, requestedModel, snapshot.fallbackModel, snapshot.freeModel]
    : isCritical
      ? [snapshot.freeModel, snapshot.fallbackModel, requestedModel]
      : isWarning
        ? [snapshot.fallbackModel, requestedModel, snapshot.freeModel]
        : [requestedModel, snapshot.fallbackModel, snapshot.freeModel];

  const candidates = [...new Set(baseCandidates.filter(Boolean))];
  return {
    snapshot,
    utilizationPct,
    isWarning,
    isCritical,
    candidates,
  };
}
