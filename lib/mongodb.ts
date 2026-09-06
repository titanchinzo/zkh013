import dns from "node:dns";
import mongoose from "mongoose";

// Зарим Windows машин дээр Node.js-ийн dns.resolveSrv/resolveTxt (c-ares) нь
// системийн бодит DNS сервер биш харин 127.0.0.1 руу асуулга явуулж ECONNREFUSED
// алдаа өгдөг (mongodb+srv:// холболтод хэрэгтэй). Тиймээс нийтийн DNS сервер
// рүү тогтмол шилжүүлнэ. Энэ нь Vercel зэрэг production орчинд нөлөөлдөггүй.
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const MONGODB_URI = process.env.MONGODB_URI;
const isPlaceholderUri = !MONGODB_URI || MONGODB_URI.includes("<user>");

type MongooseCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global._mongooseCache ?? { conn: null, promise: null };
global._mongooseCache = cache;

async function resolveConnectionUri(): Promise<string> {
  if (!isPlaceholderUri) return MONGODB_URI!;

  if (process.env.NODE_ENV === "production") {
    throw new Error("MONGODB_URI орчны хувьсагч тохируулагдаагүй байна (.env.local файлыг үзнэ үү)");
  }

  // Local dev-д MONGODB_URI тохируулаагүй үед санах ойн (in-memory) MongoDB
  // ашиглана. Server дахин асаах бүрд өгөгдөл шинээр эхэлнэ.
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const mem = await MongoMemoryServer.create();
  console.warn(
    "[mongodb] MONGODB_URI тохируулаагүй тул түр зуурын in-memory MongoDB ашиглаж байна. Бодит өгөгдлийг хадгалахын тулд .env.local-д MONGODB_URI-г тохируулна уу."
  );
  return mem.getUri();
}

export async function connectToDatabase() {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    cache.promise = resolveConnectionUri().then((uri) => mongoose.connect(uri));
  }

  cache.conn = await cache.promise;
  return cache.conn;
}
