export const OPENROUTER_MODELS = {
  free: import.meta.env.VITE_OPENROUTER_FREE_MODEL || "openrouter/free",
  flash: import.meta.env.VITE_OPENROUTER_FLASH_MODEL || "qwen/qwen3.5-flash-02-23",
  pro: import.meta.env.VITE_OPENROUTER_PRO_MODEL || "qwen/qwen3.5-plus",
  vision: import.meta.env.VITE_OPENROUTER_VISION_MODEL || "google/gemini-2.0-flash-001",
};

export const OPENROUTER_MONITOR_CONFIG = {
  tokenLimit: Number(import.meta.env.VITE_OPENROUTER_TOKEN_LIMIT || 1000000),
  warningThresholdPct: Number(import.meta.env.VITE_OPENROUTER_WARNING_PCT || 90),
  primaryModel: import.meta.env.VITE_OPENROUTER_PRIMARY_MODEL || OPENROUTER_MODELS.pro,
  fallbackModel: import.meta.env.VITE_OPENROUTER_FALLBACK_MODEL || OPENROUTER_MODELS.flash,
};
