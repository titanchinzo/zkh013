// Чатын түүх зөвхөн утсан дээр (хөтчийн IndexedDB) хадгалагдана — сервер зурвасыг хүлээн авагч уншмагц устгадаг.
// Утсыг хүний нөөц хүчингүй болгох, өөр хүн энэ утсаар нэвтрэх үед түүхийг арилгана. Зөвхөн хөтөч дээр дуудна.

// file — хавсаргасан файл (fileStatus: ready — серверт байгаа, downloaded — хүлээн авагч татаж авсан тул серверээс
// устсан, gone — хугацаа дууссан); ephemeral — уншсанаас (readAt) хойш 2 минутад хоёр утаснаас устах зурвас;
// from — бүлгийн чатад хэн илгээсэн (цол, нэр)
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
  from?: { userId: string; name: string };
};
// Бүлгийн чатын хувьд userId нь "g:<бүлгийн id>", name нь бүлгийн нэр
export type StoredPerson = { userId: string; rank: string; name: string; position: string; photo: string };
// ack — серверээс хүлээн авч хадгалсан хамгийн сүүлийн зурвас (түүнийг хүртэлх зурвасыг сервер устгана)
export type StoredThread = { key: string; me: string; person: StoredPerson; messages: StoredMessage[]; ack: string | null };

const DB_NAME = "zkh013-chat";
const STORE = "threads";
// Чатаар ирсэн/илгээсэн зураг, бичлэг (сервер татагдмагц устгадаг тул чатын түүхэнд харуулахын тулд утсан дээр)
const FILES = "files";
type StoredFile = { id: string; me: string; blob: Blob };
const OWNER_KEY = "zkh013-chat-owner";
// Нэг хүнтэй хийсэн чатаас утсанд хадгалах зурвасын тоо
export const HISTORY_LIMIT = 500;

let opening: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  opening ??= new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "key" });
        if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: "id" });
      };
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
async function run<T>(
  mode: IDBTransactionMode,
  work: (store: IDBObjectStore) => IDBRequest<T> | void,
  storeName: string = STORE
): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return undefined;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, mode);
      const request = work(tx.objectStore(storeName));
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
  await run("readwrite", (store) => store.clear(), FILES);
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

/** Нэг чатын түүхийг утаснаас арилгана (бүлгээс гарахад тэр бүлгийн чат г.м) */
export async function deleteThread(me: string, other: string) {
  if (owner() !== me) return;
  await run("readwrite", (store) => store.delete(keyOf(me, other)));
}

/** Утсан дээрх бүх чатын түүхийг арилгана (утсыг хүчингүй болгосон, бүртгэл идэвхгүй болсон үед) */
export async function clearChatHistory() {
  try {
    localStorage.removeItem(OWNER_KEY);
  } catch {}
  await run("readwrite", (store) => store.clear());
  await run("readwrite", (store) => store.clear(), FILES);
}

/** Зураг, бичлэгийг утсанд хадгална (энэ утасны эзнийх л) */
export async function saveFileBlob(me: string, id: string, blob: Blob) {
  if (owner() !== me) return;
  await run("readwrite", (store) => store.put({ id, me, blob } satisfies StoredFile), FILES);
}

export async function loadFileBlob(id: string): Promise<Blob | null> {
  const me = owner();
  if (!me) return null;
  const file = await run<StoredFile>("readonly", (store) => store.get(id) as IDBRequest<StoredFile>, FILES);
  return file && file.me === me ? file.blob : null;
}

export async function deleteFileBlobs(ids: string[]) {
  if (!ids.length) return;
  await run("readwrite", (store) => {
    for (const id of ids) store.delete(id);
  }, FILES);
}

/** Чатын түүхэд үлдээгүй (нууц зурвас устсан, 500-аас хэтэрсэн) зураг, бичлэгийг утаснаас устгана */
export async function pruneFileBlobs(keep: Set<string>) {
  const ids = (await run<IDBValidKey[]>("readonly", (store) => store.getAllKeys(), FILES)) ?? [];
  await deleteFileBlobs(ids.map(String).filter((id) => !keep.has(id)));
}
