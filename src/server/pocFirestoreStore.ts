import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

export type FirestoreConstraint =
  | { type: "where"; field: string; op: "==" | ">=" | "<=" | ">" | "<"; value: any }
  | { type: "orderBy"; field: string; direction: "asc" | "desc" }
  | { type: "limit"; count: number };

export interface FirestoreQueryRequest {
  collectionName: string;
  constraints?: FirestoreConstraint[];
}

export interface FirestoreDocRequest {
  collectionName: string;
  docId: string;
}

export interface FirestoreWriteRequest extends FirestoreDocRequest {
  data?: Record<string, any>;
}

export interface FirestoreAddRequest {
  collectionName: string;
  data: Record<string, any>;
}

export interface FirestoreBatchRequest {
  operations: Array<
    | { type: "set"; collectionName: string; docId: string; data: Record<string, any> }
    | { type: "update"; collectionName: string; docId: string; data: Record<string, any> }
    | { type: "delete"; collectionName: string; docId: string }
  >;
}

type FirestoreStore = Record<string, Record<string, Record<string, any>>>;

const STORE_PATH = process.env.POC_STORE_PATH || path.resolve("/tmp", "huqiqiyy-poc-firestore-store.json");

let cachedStore: FirestoreStore = loadStore();

function loadStore(): FirestoreStore {
  try {
    if (!fs.existsSync(STORE_PATH)) return {};
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    return raw ? (JSON.parse(raw) as FirestoreStore) : {};
  } catch {
    return {};
  }
}

function persistStore() {
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(cachedStore, null, 2), "utf8");
  } catch {
    // best-effort persistence for the POC
  }
}

function refreshStoreFromDisk() {
  cachedStore = loadStore();
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function isTimestampPlaceholder(value: any) {
  return Boolean(value && typeof value === "object" && value.__type === "serverTimestamp");
}

function normalizeIncoming(value: any): any {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeIncoming(item));
  }
  if (value && typeof value === "object") {
    if (isTimestampPlaceholder(value)) {
      return new Date().toISOString();
    }
    const output: Record<string, any> = {};
    for (const [key, entry] of Object.entries(value)) {
      output[key] = normalizeIncoming(entry);
    }
    return output;
  }
  return value;
}

function ensureCollection(collectionName: string) {
  cachedStore[collectionName] ||= {};
  return cachedStore[collectionName];
}

function ensureDoc(collectionName: string, docId: string) {
  const collection = ensureCollection(collectionName);
  collection[docId] ||= { id: docId };
  return collection[docId];
}

function compareValues(left: any, right: any) {
  const leftDate = parseDateLike(left);
  const rightDate = parseDateLike(right);
  if (leftDate !== null && rightDate !== null) {
    return leftDate - rightDate;
  }
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  return String(left ?? "").localeCompare(String(right ?? ""));
}

function parseDateLike(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
}

function matchesWhere(doc: Record<string, any>, constraint: Extract<FirestoreConstraint, { type: "where" }>) {
  const actual = doc[constraint.field];
  switch (constraint.op) {
    case "==":
      return actual === constraint.value;
    case ">=":
      return compareValues(actual, constraint.value) >= 0;
    case "<=":
      return compareValues(actual, constraint.value) <= 0;
    case ">":
      return compareValues(actual, constraint.value) > 0;
    case "<":
      return compareValues(actual, constraint.value) < 0;
    default:
      return false;
  }
}

function applyQueryDocs(docs: Record<string, any>[], constraints: FirestoreConstraint[] = []) {
  let filtered = docs;
  const whereConstraints = constraints.filter((constraint): constraint is Extract<FirestoreConstraint, { type: "where" }> => constraint.type === "where");
  for (const constraint of whereConstraints) {
    filtered = filtered.filter((doc) => matchesWhere(doc, constraint));
  }

  const orderConstraint = constraints.find((constraint): constraint is Extract<FirestoreConstraint, { type: "orderBy" }> => constraint.type === "orderBy");
  if (orderConstraint) {
    const directionMultiplier = orderConstraint.direction === "desc" ? -1 : 1;
    filtered = [...filtered].sort((a, b) => directionMultiplier * compareValues(a[orderConstraint.field], b[orderConstraint.field]));
  }

  const limitConstraint = constraints.find((constraint): constraint is Extract<FirestoreConstraint, { type: "limit" }> => constraint.type === "limit");
  if (limitConstraint) {
    filtered = filtered.slice(0, limitConstraint.count);
  }

  return filtered;
}

function wrapTimestampFields(data: Record<string, any>) {
  const timestampFields = new Set(["createdAt", "updatedAt", "timestamp", "addedAt"]);

  const wrap = (value: any, fieldName?: string): any => {
    if (Array.isArray(value)) {
      return value.map((item) => wrap(item));
    }
    if (value && typeof value === "object") {
      if (fieldName && timestampFields.has(fieldName)) {
        return makeTimestamp(value);
      }
      const result: Record<string, any> = {};
      for (const [key, entry] of Object.entries(value)) {
        result[key] = wrap(entry, key);
      }
      return result;
    }
    if (fieldName && timestampFields.has(fieldName)) {
      return makeTimestamp(value);
    }
    return value;
  };

  return wrap(data);
}

function makeTimestamp(value: any) {
  const millis = parseDateLike(value) ?? Date.now();
  const date = new Date(millis);
  return {
    toDate: () => new Date(date.getTime()),
    toMillis: () => date.getTime(),
    valueOf: () => date.getTime(),
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: (date.getTime() % 1000) * 1_000_000,
    _ts: date.toISOString(),
  };
}

export function queryCollection(request: FirestoreQueryRequest) {
  refreshStoreFromDisk();
  const collection = Object.values(cachedStore[request.collectionName] || {});
  const docs = applyQueryDocs(collection.map((doc) => clone(doc)), request.constraints || []);
  return docs.map((doc) => wrapTimestampFields(doc));
}

export function getDocument(request: FirestoreDocRequest) {
  refreshStoreFromDisk();
  const doc = cachedStore[request.collectionName]?.[request.docId];
  return doc ? wrapTimestampFields(clone(doc)) : null;
}

export function setDocument(request: FirestoreWriteRequest) {
  const data = normalizeIncoming(request.data || {});
  ensureCollection(request.collectionName)[request.docId] = { id: request.docId, ...data };
  persistStore();
  return wrapTimestampFields(clone(ensureCollection(request.collectionName)[request.docId]));
}

export function addDocument(request: FirestoreAddRequest) {
  const id = randomUUID();
  const data = normalizeIncoming(request.data || {});
  ensureCollection(request.collectionName)[id] = { id, ...data };
  persistStore();
  return wrapTimestampFields(clone(ensureCollection(request.collectionName)[id]));
}

export function updateDocument(request: FirestoreWriteRequest) {
  const current = ensureDoc(request.collectionName, request.docId);
  Object.assign(current, normalizeIncoming(request.data || {}));
  current.id = request.docId;
  persistStore();
  return wrapTimestampFields(clone(current));
}

export function deleteDocument(request: FirestoreDocRequest) {
  refreshStoreFromDisk();
  if (cachedStore[request.collectionName]) {
    delete cachedStore[request.collectionName][request.docId];
    persistStore();
  }
}

export function commitBatch(request: FirestoreBatchRequest) {
  refreshStoreFromDisk();
  for (const op of request.operations) {
    if (op.type === "delete") {
      if (cachedStore[op.collectionName]) {
        delete cachedStore[op.collectionName][op.docId];
      }
      continue;
    }
    const data = normalizeIncoming(op.data);
    const collection = ensureCollection(op.collectionName);
    if (op.type === "set") {
      collection[op.docId] = { id: op.docId, ...data };
    } else if (op.type === "update") {
      collection[op.docId] = { ...(collection[op.docId] || { id: op.docId }), ...data, id: op.docId };
    }
  }
  persistStore();
}

export function listCollectionIds() {
  refreshStoreFromDisk();
  return Object.keys(cachedStore);
}
