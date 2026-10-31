import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { contentReports, projects } from "@/db/schema";
import { isAdmin } from "@/lib/admin";
import { message } from "@/lib/http";
import { sendReportDecision } from "@/lib/mail";

export async function GET(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: "No autorizado." }, { status: 401 });
  const reports = await db.select().from(contentReports).orderBy(desc(contentReports.createdAt)).limit(200);
  return Response.json({ reports }, { headers: { "Cache-Control": "no-store" } });
}
export async function PATCH(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: "No autorizado." }, { status: 401 });
  try {
    const body = await request.json(); const id = String(body.id || ""); const decision = String(body.decision || "").trim();
    if (body.markReceiptSent === true && id) {
      const [report] = await db.select().from(contentReports).where(eq(contentReports.id, id)).limit(1);
      if (!report || !report.reporterEmail) throw new Error("El aviso no tiene un correo de contacto.");
      await db.update(contentReports).set({ receiptStatus: "manual" }).where(eq(contentReports.id, id));
      return Response.json({ ok: true });
    }
    if (!id || decision.length < 10 || decision.length > 2000 || typeof body.hideProject !== "boolean") throw new Error("Indica una decisión de entre 10 y 2000 caracteres.");
    const report = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(contentReports).where(eq(contentReports.id, id)).for("update");
      if (!current) throw new Error("Aviso no encontrado.");
      if (current.status === "resolved") throw new Error("Este aviso ya está resuelto.");
      if (body.hideProject) {
        if (!current.projectId) throw new Error("Este aviso no está vinculado a un proyecto; revísalo manualmente.");
        await tx.update(projects).set({ isPublic: false }).where(eq(projects.id, current.projectId));
      }
      await tx.update(contentReports).set({ status: "resolved", decision, resolvedAt: new Date() }).where(eq(contentReports.id, id));
      return current;
    });
    const notificationSent = await sendReportDecision({ reportNumber: report.reportNumber, reporterEmail: report.reporterEmail, decision });
    await db.update(contentReports).set({ decisionEmailStatus: !report.reporterEmail ? "not_applicable" : notificationSent ? "sent" : "not_sent" }).where(eq(contentReports.id, id)).catch(console.error);
    return Response.json({ ok: true, notificationSent, needsManualContact: !!report.reporterEmail && !notificationSent });
  } catch (error) { return Response.json({ error: message(error) }, { status: 400 }); }
}
