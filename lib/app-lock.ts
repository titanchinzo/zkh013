import "server-only";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { NextRequest } from "next/server";

// Апп түгжээ — WebAuthn (passkey). Утас өөрийн түгжээгээр (хурууны хээ, царай, PIN, хээ зурах) хэрэглэгчийг
// баталгаажуулж (userVerification: required), зөвхөн тухайн утсанд байгаа нууц түлхүүрээр гарын үсэг зурна. Сервер
// нийтийн түлхүүрээр нь шалгана. Аппын API-г хаах нь lib/device.ts-д.

const RP_NAME = "013 анги";
const TIMEOUT_MS = 120_000;
/** Challenge-ийн хүчинтэй хугацаа */
export const CHALLENGE_TTL_MS = 3 * 60_000;

type StoredLock = { credentialId: string; publicKey: Buffer; counter: number; transports?: string[] };

/**
 * WebAuthn-ий домэйн, origin. Production-д сайтын албан ёсны хаяг (NEXT_PUBLIC_SITE_URL — https://unit013.mn),
 * хөгжүүлэлтэд хүсэлтийн хаяг (http://localhost:3100). WebAuthn зөвхөн https (эсвэл localhost) дээр ажиллана.
 */
function site(req: NextRequest) {
  const configured = process.env.NODE_ENV === "production" ? process.env.NEXT_PUBLIC_SITE_URL : undefined;
  const url = new URL(configured || req.nextUrl.origin);
  return { rpID: url.hostname, origin: url.origin };
}

/** Анх тохируулах: утасны түгжээгээр баталгаажуулдаг, зөвхөн энэ утсанд (platform) түлхүүр үүсгэнэ */
export function setupOptions(req: NextRequest, deviceId: string, userName: string) {
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: site(req).rpID,
    userID: new TextEncoder().encode(deviceId),
    userName,
    userDisplayName: userName,
    timeout: TIMEOUT_MS,
    attestationType: "none",
    authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
  });
}

/** Түгжээ тайлах: энэ утсанд тохируулсан түлхүүрээр, утасны түгжээгээр баталгаажуулна */
export function unlockOptions(req: NextRequest, lock: StoredLock) {
  return generateAuthenticationOptions({
    rpID: site(req).rpID,
    allowCredentials: [{ id: lock.credentialId, transports: lock.transports }],
    userVerification: "required",
    timeout: TIMEOUT_MS,
  });
}

/** Тохируулсан түлхүүрийг шалгана — амжилттай бол хадгалах өгөгдөл */
export async function verifySetup(req: NextRequest, response: RegistrationResponseJSON, challenge: string) {
  const { rpID, origin } = site(req);
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    requireUserVerification: true,
  });
  if (!result.verified) return null;
  const { credential } = result.registrationInfo;
  return {
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey),
    counter: credential.counter,
    transports: credential.transports ?? [],
  };
}

/** Түгжээ тайлахыг шалгана — амжилттай бол шинэ тоолуур, үгүй бол null */
export async function verifyUnlock(
  req: NextRequest,
  response: AuthenticationResponseJSON,
  challenge: string,
  lock: StoredLock
): Promise<number | null> {
  if (response.id !== lock.credentialId) return null;
  const { rpID, origin } = site(req);
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: origin,
    expectedRPID: rpID,
    credential: {
      id: lock.credentialId,
      publicKey: new Uint8Array(lock.publicKey),
      counter: lock.counter,
      transports: lock.transports,
    },
    requireUserVerification: true,
  });
  return result.verified ? result.authenticationInfo.newCounter : null;
}
