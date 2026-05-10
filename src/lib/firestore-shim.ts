type FirestoreCollectionRef = {
  __kind: "collection";
  collectionName: string;
};

type FirestoreDocRef = {
  __kind: "doc";
  collectionName: string;
  id: string;
};

type FirestoreQueryConstraint =
  | { type: "where"; field: string; op: "==" | ">=" | "<=" | ">" | "<"; value: any }
  | { type: "orderBy"; field: string; direction: "asc" | "desc" }
  | { type: "limit"; count: number };

type FirestoreQueryRef = {
  __kind: "query";
  collectionName: string;
  constraints: FirestoreQueryConstraint[];
};

type ServerTimestampMarker = {
  __type: "serverTimestamp";
};

type FirestoreQueryResponseDoc = {
  id: string;
  [key: string]: any;
};

const API_ROOT = "/api/firestore";
const TIMESTAMP_FIELDS = new Set(["createdAt", "updatedAt", "timestamp", "addedAt"]);

function asCollectionName(input: FirestoreCollectionRef | FirestoreQueryRef) {
  return input.collectionName;
}

function normalizeForTransport(value: any): any {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeForTransport(item));
  }
  if (value && typeof value === "object") {
    if ((value as ServerTimestampMarker).__type === "serverTimestamp") {
      return value;
    }
    const output: Record<string, any> = {};
    for (const [key, entry] of Object.entries(value)) {
      output[key] = normalizeForTransport(entry);
    }
    return output;
  }
  return value;
}

function makeTimestamp(value: any) {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Date.parse(value)
      : NaN;
  const millis = Number.isFinite(parsed) ? parsed : Date.now();
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

function reviveDocument(value: any, fieldName?: string): any {
  if (Array.isArray(value)) {
    return value.map((item) => reviveDocument(item));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    const result: Record<string, any> = {};
    for (const [key, entry] of entries) {
      if (TIMESTAMP_FIELDS.has(key)) {
        result[key] = makeTimestamp(entry);
      } else {
        result[key] = reviveDocument(entry, key);
      }
    }
    return result;
  }
  if (fieldName && TIMESTAMP_FIELDS.has(fieldName)) {
    return makeTimestamp(value);
  }
  return value;
}

async function postJSON<T>(endpoint: string, body?: any): Promise<T> {
  const response = await fetch(`${API_ROOT}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(normalizeForTransport(body)),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(message || `Firestore shim request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

class POCDocSnapshot {
  constructor(public ref: FirestoreDocRef, private readonly rawData: FirestoreQueryResponseDoc | null) {}

  get id() {
    return this.ref.id;
  }

  exists() {
    return Boolean(this.rawData);
  }

  data() {
    if (!this.rawData) return undefined;
    const { id, ...rest } = this.rawData;
    return reviveDocument(rest);
  }
}

class POCQuerySnapshot {
  constructor(public docs: POCDocSnapshot[]) {}

  get empty() {
    return this.docs.length === 0;
  }

  get size() {
    return this.docs.length;
  }

  forEach(callback: (doc: POCDocSnapshot) => void) {
    this.docs.forEach(callback);
  }
}

export function collection(_db: any, collectionName: string): FirestoreCollectionRef {
  return { __kind: "collection", collectionName };
}

export function doc(_db: any, collectionName: string, id: string): FirestoreDocRef {
  return { __kind: "doc", collectionName, id };
}

export function where(field: string, op: "==" | ">=" | "<=" | ">" | "<", value: any): FirestoreQueryConstraint {
  return { type: "where", field, op, value: normalizeForTransport(value) };
}

export function orderBy(field: string, direction: "asc" | "desc" = "asc"): FirestoreQueryConstraint {
  return { type: "orderBy", field, direction };
}

export function limit(count: number): FirestoreQueryConstraint {
  return { type: "limit", count };
}

export function query(base: FirestoreCollectionRef | FirestoreQueryRef, ...constraints: FirestoreQueryConstraint[]): FirestoreQueryRef {
  const baseConstraints = base.__kind === "query" ? base.constraints : [];
  return {
    __kind: "query",
    collectionName: asCollectionName(base),
    constraints: [...baseConstraints, ...constraints],
  };
}

export function serverTimestamp(): ServerTimestampMarker {
  return { __type: "serverTimestamp" };
}

export async function getDocs(ref: FirestoreCollectionRef | FirestoreQueryRef): Promise<POCQuerySnapshot> {
  const payload = ref.__kind === "query"
    ? { collectionName: ref.collectionName, constraints: ref.constraints }
    : { collectionName: ref.collectionName, constraints: [] };
  const docs = await postJSON<FirestoreQueryResponseDoc[]>("/query", payload);
  return new POCQuerySnapshot(
    docs.map((docData) => new POCDocSnapshot({ __kind: "doc", collectionName: payload.collectionName, id: docData.id }, docData))
  );
}

export async function getDoc(ref: FirestoreDocRef): Promise<POCDocSnapshot> {
  const docData = await postJSON<FirestoreQueryResponseDoc | null>("/get", {
    collectionName: ref.collectionName,
    docId: ref.id,
  });
  return new POCDocSnapshot(ref, docData);
}

export async function getDocFromServer(ref: FirestoreDocRef) {
  return getDoc(ref);
}

export async function addDoc(ref: FirestoreCollectionRef, data: Record<string, any>): Promise<FirestoreDocRef> {
  const docData = await postJSON<FirestoreQueryResponseDoc>("/add", {
    collectionName: ref.collectionName,
    data,
  });
  return { __kind: "doc", collectionName: ref.collectionName, id: docData.id };
}

export async function setDoc(ref: FirestoreDocRef, data: Record<string, any>) {
  await postJSON("/set", {
    collectionName: ref.collectionName,
    docId: ref.id,
    data,
  });
}

export async function updateDoc(ref: FirestoreDocRef, data: Record<string, any>) {
  await postJSON("/update", {
    collectionName: ref.collectionName,
    docId: ref.id,
    data,
  });
}

export async function deleteDoc(ref: FirestoreDocRef) {
  await postJSON("/delete", {
    collectionName: ref.collectionName,
    docId: ref.id,
  });
}

export function writeBatch(_db: any) {
  const operations: Array<
    | { type: "set"; collectionName: string; docId: string; data: Record<string, any> }
    | { type: "update"; collectionName: string; docId: string; data: Record<string, any> }
    | { type: "delete"; collectionName: string; docId: string }
  > = [];

  return {
    set(ref: FirestoreDocRef, data: Record<string, any>) {
      operations.push({ type: "set", collectionName: ref.collectionName, docId: ref.id, data });
    },
    update(ref: FirestoreDocRef, data: Record<string, any>) {
      operations.push({ type: "update", collectionName: ref.collectionName, docId: ref.id, data });
    },
    delete(ref: FirestoreDocRef) {
      operations.push({ type: "delete", collectionName: ref.collectionName, docId: ref.id });
    },
    async commit() {
      await postJSON("/batch", { operations });
    },
  };
}

export function onSnapshot(
  ref: FirestoreCollectionRef | FirestoreQueryRef,
  callback: (snapshot: POCQuerySnapshot) => void,
  errorCallback?: (error: unknown) => void
) {
  let active = true;
  let lastSignature = "";

  const load = async () => {
    if (!active) return;
    try {
      const snapshot = await getDocs(ref);
      const signature = JSON.stringify(snapshot.docs.map((docSnap) => ({ id: docSnap.id, data: docSnap.data() })));
      if (signature !== lastSignature) {
        lastSignature = signature;
        callback(snapshot);
      }
    } catch (error) {
      console.error("Firestore shim onSnapshot failed:", error);
      errorCallback?.(error);
    }
  };

  void load();
  const timer = window.setInterval(load, 2000);

  return () => {
    active = false;
    window.clearInterval(timer);
  };
}
