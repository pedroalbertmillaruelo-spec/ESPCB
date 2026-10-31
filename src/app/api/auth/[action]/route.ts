import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { clearSession, getUser, hashPassword, setSession, validEmail, verifyPassword } from "@/lib/auth";
import { checkOrigin, message } from "@/lib/http";
import { LEGAL_VERSION } from "@/lib/site";
import { allowRequest, clientKey, retryAfterSeconds } from "@/lib/gerber/rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ action: string }> }) {
  try {
    checkOrigin(request);
    const { action } = await params;
    if (action === "logout") { await clearSession(); return Response.json({ ok: true }); }
    if (!["register", "login", "accept-terms"].includes(action)) return Response.json({ error: "Acción no encontrada." }, { status: 404 });
    if (action === "login" || action === "register") {
      const key = `auth:${action}:${clientKey(request)}`; const rate = { max: 10, windowMs: 10 * 60 * 1000 };
      if (!allowRequest(key, rate)) return Response.json({ error: "Demasiados intentos. Vuelve a intentarlo más tarde." }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds(key, rate)) } });
    }
    const body = await request.json();
    const accepted = body.acceptTerms === true || body.acceptTerms === "true";
    const adult = body.adultConfirmed === true || body.adultConfirmed === "true";
    if (action === "accept-terms") {
      const user = await getUser();
      if (!user) return Response.json({ error: "Tu sesión ha caducado. Vuelve a iniciar sesión; tus datos siguen guardados.", code: "SESSION_EXPIRED" }, { status: 401 });
      if (!accepted || !adult) throw new Error("Acepta las condiciones actuales y confirma que eres mayor de edad.");
      await db.update(users).set({ termsAcceptedAt: new Date(), termsVersion: LEGAL_VERSION, adultConfirmed: true }).where(eq(users.id, user.id));
      return Response.json({ user: { ...user, termsVersion: LEGAL_VERSION, adultConfirmed: true } });
    }
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!validEmail(email) || password.length < 8 || password.length > 200) throw new Error("Introduce un correo válido y una contraseña de al menos 8 caracteres.");
    if (action === "register") {
      const name = String(body.name || "").trim();
      if (name.length < 2 || name.length > 80) throw new Error("Introduce un nombre de entre 2 y 80 caracteres.");
      if (!accepted) throw new Error("Debes aceptar las condiciones de uso para crear una cuenta.");
      if (!adult) throw new Error("Confirma que eres mayor de edad para crear una cuenta.");
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing) throw new Error("Ya existe una cuenta con este correo.");
      const id = randomUUID();
      await db.insert(users).values({ id, name, email, passwordHash: await hashPassword(password), termsAcceptedAt: new Date(), termsVersion: LEGAL_VERSION, adultConfirmed: true });
      await setSession(id);
      return Response.json({ user: { id, name, email, pennies: 0, termsVersion: LEGAL_VERSION, adultConfirmed: true } });
    }
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user || !(await verifyPassword(password, user.passwordHash))) throw new Error("El correo o la contraseña no son correctos.");
    await setSession(user.id);
    return Response.json({ user: { id: user.id, name: user.name, email: user.email, pennies: user.pennies, termsVersion: user.termsVersion, adultConfirmed: user.adultConfirmed } });
  } catch (error) { return Response.json({ error: message(error) }, { status: 400 }); }
}
