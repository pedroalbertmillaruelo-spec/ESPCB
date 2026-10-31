import { randomBytes, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contentReports, projects } from "@/db/schema";
import { validEmail } from "@/lib/auth";
import { allowRequest, clientKey, retryAfterSeconds } from "@/lib/gerber/rate-limit";
import { checkBodySize, checkOrigin, message } from "@/lib/http";
import { sendContentReportMail } from "@/lib/mail";

export async function POST(request: Request) {
  const key = `report:${clientKey(request)}`; const rate = { max: 10, windowMs: 10 * 60 * 1000 };
  if (!allowRequest(key, rate)) return Response.json({ error: "Has enviado demasiados avisos. Inténtalo más tarde." }, { status: 429, headers: { "Retry-After": String(retryAfterSeconds(key, rate)) } });
  try {
    checkOrigin(request); checkBodySize(request);
    if (Number(request.headers.get("content-length") || 0) > 16 * 1024) throw new Error("El aviso es demasiado largo.");
    const body = await request.json();
    const projectId = String(body.projectId || "").trim();
    const location = String(body.location || "").trim();
    const reason = String(body.reason || "").trim();
    const reporterName = String(body.reporterName || "").trim();
    const reporterEmail = String(body.reporterEmail || "").trim().toLowerCase();
    if (location.length < 5 || location.length > 1000) throw new Error("Indica la dirección exacta o la ubicación del contenido.");
    if (reason.length < 20 || reason.length > 3000) throw new Error("Explica el motivo del aviso (entre 20 y 3000 caracteres).");
    if (reporterName.length > 100) throw new Error("El nombre es demasiado largo.");
    if (reporterEmail && !validEmail(reporterEmail)) throw new Error("Introduce un correo válido o déjalo vacío.");
    if (body.goodFaith !== true) throw new Error("Confirma que envías el aviso de buena fe.");
    if (projectId) {
      const [project] = await db.select({ id: projects.id }).from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!project) throw new Error("El proyecto indicado no está disponible. Puedes indicar su ubicación en el aviso.");
    }
    const id = randomUUID(); const reportNumber = `AV-${randomBytes(5).toString("hex").toUpperCase()}`;
    const report = { id, reportNumber, projectId: projectId || null, location, reason, reporterName: reporterName || null, reporterEmail: reporterEmail || null, goodFaith: true };
    await db.insert(contentReports).values(report);
    const notification = await sendContentReportMail(report);
    await db.update(contentReports).set({ emailStatus: notification.teamSent ? "sent" : "not_sent", receiptStatus: !report.reporterEmail ? "not_applicable" : notification.receiptSent ? "sent" : "not_sent" }).where(eq(contentReports.id, id)).catch(console.error);
    return Response.json({ ok: true, reportNumber, receiptSent: notification.receiptSent });
  } catch (error) { return Response.json({ error: message(error) }, { status: 400 }); }
}
