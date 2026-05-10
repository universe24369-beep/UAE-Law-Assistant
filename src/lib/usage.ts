import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { getSessionUser } from './session';
import { recordOpenRouterUsage } from './openrouterMonitor';

export type UsageType = 'openrouter_query' | 'legal_search' | 'document_generation' | 'support_query';

export type UsageMeta = {
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  utilizationPct?: number;
  usageStage?: 'primary' | 'fallback' | 'free' | 'error';
};

export interface UsageRecord {
  id: string;
  type: UsageType;
  status: 'success' | 'error';
  tokens: number;
  totalTokens?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string | null;
  utilizationPct?: number | null;
  usageStage?: string | null;
  userId: string;
  timestamp: string;
}

const LOCAL_USAGE_KEY = 'huqiqiyy_usage_stats_v1';

export function getLocalUsageStats(): UsageRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_USAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as UsageRecord[] : [];
  } catch {
    return [];
  }
}

function saveLocalUsageStat(entry: UsageRecord) {
  if (typeof window === 'undefined') return;
  try {
    const current = getLocalUsageStats();
    window.localStorage.setItem(LOCAL_USAGE_KEY, JSON.stringify([entry, ...current].slice(0, 500)));
  } catch {
    // Ignore localStorage failures.
  }
}

export async function logUsage(type: UsageType, status: 'success' | 'error' = 'success', tokens?: number, meta?: UsageMeta) {
  const path = 'usage_stats';
  try {
    const user = getSessionUser();
    if (!user) return; // Rules require signed in

    const totalTokens = meta?.totalTokens ?? tokens ?? 0;
    const record: UsageRecord = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      type,
      status,
      tokens: totalTokens,
      totalTokens,
      inputTokens: meta?.inputTokens ?? 0,
      outputTokens: meta?.outputTokens ?? 0,
      model: meta?.model || null,
      utilizationPct: meta?.utilizationPct ?? null,
      usageStage: meta?.usageStage || null,
      userId: user.uid,
      timestamp: new Date().toISOString(),
    };

    await addDoc(collection(db, path), {
      type,
      status,
      tokens: totalTokens,
      totalTokens,
      inputTokens: meta?.inputTokens ?? 0,
      outputTokens: meta?.outputTokens ?? 0,
      model: meta?.model || null,
      utilizationPct: meta?.utilizationPct ?? null,
      usageStage: meta?.usageStage || null,
      userId: user.uid,
      timestamp: serverTimestamp(),
    });

    if (type === 'openrouter_query') {
      recordOpenRouterUsage({
        totalTokens,
        status,
        model: meta?.model,
      });
    }
    saveLocalUsageStat(record);
  } catch (error) {
    const totalTokens = meta?.totalTokens ?? tokens ?? 0;
    const user = getSessionUser();
    if (user) {
      const fallbackRecord: UsageRecord = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
        type,
        status,
        tokens: totalTokens,
        totalTokens,
        inputTokens: meta?.inputTokens ?? 0,
        outputTokens: meta?.outputTokens ?? 0,
        model: meta?.model || null,
        utilizationPct: meta?.utilizationPct ?? null,
        usageStage: meta?.usageStage || null,
        userId: user.uid,
        timestamp: new Date().toISOString(),
      };
      saveLocalUsageStat(fallbackRecord);
      if (type === 'openrouter_query') {
        recordOpenRouterUsage({
          totalTokens,
          status,
          model: meta?.model,
        });
      }
    }

    if (error instanceof Error && error.message.includes("permission")) {
      console.warn("Firestore usage logging is unavailable; falling back to local usage storage.");
      return;
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
