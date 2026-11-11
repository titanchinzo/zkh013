// Чатын түүх зөвхөн утсан дээр (хөтчийн IndexedDB) хадгалагдана — сервер зурвасыг хүлээн авагч уншмагц устгадаг.
// Утсыг хүний нөөц хүчингүй болгох, өөр хүн энэ утсаар нэвтрэх үед түүхийг арилгана. Зөвхөн хөтөч дээр дуудна.

// file — хавсаргасан файл (fileStatus: ready — серверт байгаа, downloaded — хүлээн авагч татаж авсан тул серверээс
// устсан, gone — хугацаа дууссан); ephemeral — уншсанаас (readAt) хойш 2 минутад хоёр утаснаас устах зурвас
export type StoredMessage = {
  id: string;
  text: string;
  mine: boolean;
  at: string;
  read?: boolean;
  file?: { id: string; name: string; size: number; type: string };
  fileStatus?: "ready" | "downloaded" | "gone";
  ephemeral?: boolean;
  readAt?: number;
};
export type StoredPerson = { userId: string; rank: string; name: string; position: string; photo: string };
// ack — серверээс хүлээн авч хадгалсан хамгийн сүүлийн зурвас (түүнийг хүртэлх зурвасыг сервер устгана)
export type StoredThread = { key: string; me: string; person: StoredPerson; messages: StoredMessage[]; ack: string | null };

const DB_NAME = "zkh013-chat";
const STORE = "threads";
const OWNER_KEY = "zkh013-chat-owner";
// Нэг хүнтэй хийсэн чатаас утсанд хадгалах зурвасын тоо
export const HISTORY_LIMIT = 500;

let opening: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  opening ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "key" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

/** Нэг гүйлгээ (transaction) — IndexedDB ажиллахгүй бол (хувийн горим г.м) undefined, апп түүхгүйгээр ажилласаар байна */
async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request ? request.result : undefined);
      tx.onerror = () => resolve(undefined);
      tx.onabort = () => resolve(undefined);
    } catch {
      resolve(undefined);
    }
  });
}

const keyOf = (me: string, other: string) => `${me}|${other}`;

function owner() {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

/** Энэ утсан дээрх түүх өөр хүнийх бол арилгаад, одоогийн хүнийх гэж тэмдэглэнэ */
async function claim(me: string) {
  if (owner() === me) return;
  await run("readwrite", (store) => store.clear());
  try {
    localStorage.setItem(OWNER_KEY, me);
  } catch {}
}

/** Сүүлд энэ утсаар чат ашигласан хүн — серверээс хариу ирэхээс өмнө түүхийг харуулахад */
export const historyOwner = owner;

export async function loadThreads(me: string): Promise<StoredThread[]> {
  await claim(me);
  const all = await run<StoredThread[]>("readonly", (store) => store.getAll() as IDBRequest<StoredThread[]>);
  return (all ?? []).filter((t) => t.me === me);
}

export async function loadThread(me: string, other: string): Promise<StoredThread | undefined> {
  await claim(me);
  return run<StoredThread>("readonly", (store) => store.get(keyOf(me, other)) as IDBRequest<StoredThread>);
}

export async function saveThread(me: string, person: StoredPerson, messages: StoredMessage[], ack: string | null) {
  if (owner() !== me) return;
  const thread: StoredThread = { key: keyOf(me, person.userId), me, person, messages: messages.slice(-HISTORY_LIMIT), ack };
  await run("readwrite", (store) => store.put(thread));
}

/** Утсан дээрх бүх чатын түүхийг арилгана (утсыг хүчингүй болгосон, бүртгэл идэвхгүй болсон үед) */
export async function clearChatHistory() {
  try {
    localStorage.removeItem(OWNER_KEY);
  } catch {}
  await run("readwrite", (store) => store.clear());
}
