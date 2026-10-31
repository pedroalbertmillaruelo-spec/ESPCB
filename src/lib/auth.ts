import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getSessionSecret } from "@/lib/auth-secret";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "espcb_session";

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}
export async function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const hash = await scrypt(password, salt, 64) as Buffer;
  const original = Buffer.from(expected, "hex");
  return original.length === hash.length && timingSafeEqual(original, hash);
}
async function sign(value: string) {
  return createHmac("sha256", await getSessionSecret()).update(value).digest("base64url");
}
export async function setSession(userId: string) {
  const payload = Buffer.from(JSON.stringify({ id: userId, exp: Date.now() + 30 * 86400_000 })).toString("base64url");
  const signature = await sign(payload);
  (await cookies()).set(SESSION_COOKIE, `${payload}.${signature}`, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 30 * 86400 });
}
export async function clearSession() { (await cookies()).delete(SESSION_COOKIE); }
export async function getUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const actual = Buffer.from(signature);
  const expected = Buffer.from(await sign(payload));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { id: string; exp: number };
    if (!data.id || data.exp < Date.now()) return null;
    const [user] = await db.select({ id: users.id, name: users.name, email: users.email, pennies: users.pennies, termsVersion: users.termsVersion, adultConfirmed: users.adultConfirmed }).from(users).where(eq(users.id, data.id)).limit(1);
    return user || null;
  } catch { return null; }
}
export function validEmail(email: string) { return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
