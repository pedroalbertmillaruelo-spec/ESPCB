import { db } from "@/db";
import { isAdmin } from "@/lib/admin";
import { message } from "@/lib/http";
import { approvePennyAward, listPendingAwards, rejectPennyAward } from "@/lib/pennies-award";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: "No autorizado." }, { status: 401 });
  try {
    const awards = await listPendingAwards();
    const total = awards.reduce((sum, award) => sum + award.amount, 0);
    return Response.json({ awards, totalPending: total }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return Response.json({ error: message(error) }, { status: 500 }); }
}

/**
 * Aprueba o rechaza concesiones pendientes. Sin topes: se abona el importe íntegro.
 * `action: "approve_all"` aprueba de una vez todo lo pendiente que se ha revisado.
 */
export async function PATCH(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: "No autorizado." }, { status: 401 });
  try {
    const body = await request.json();
    const action = String(body.action || "");
    const note = String(body.note || "").trim().slice(0, 500);
    if (!["approve", "reject", "approve_all"].includes(action)) throw new Error("Acción no válida.");
    if (action === "reject" && note.length < 3) throw new Error("Indica un motivo al rechazar (mínimo 3 caracteres).");

    if (action === "approve_all") {
      const pending = await listPendingAwards(500);
      if (pending.length === 0) return Response.json({ ok: true, approved: 0, amount: 0 });
      let amount = 0;
      await db.transaction(async (tx) => {
        for (const award of pending) {
          const result = await approvePennyAward(tx, award.id, note || "Aprobación conjunta tras revisión.");
          amount += result.amount;
        }
      });
      return Response.json({ ok: true, approved: pending.length, amount });
    }

    const awardId = String(body.awardId || "");
    if (!awardId) throw new Error("Falta la concesión a revisar.");
    const result = await db.transaction(async (tx) => action === "approve"
      ? approvePennyAward(tx, awardId, note || "Aprobado tras revisión.")
      : rejectPennyAward(tx, awardId, note));
    return Response.json({ ok: true, ...result });
  } catch (error) { return Response.json({ error: message(error) }, { status: 400 }); }
}
