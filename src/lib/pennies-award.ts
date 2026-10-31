import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orders, pennyLedger, projects, users } from "@/db/schema";
import { boardCategory, BOARD_TIERS } from "./pricing";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Concesión de Pennies con revisión manual.
 *
 * Política del negocio: **no hay topes ni límites automáticos**. Si un diseño se fabrica
 * muchas veces, su autor gana los Pennies de todas esas ventas: cada fabricación es un
 * ingreso real. El control no es un límite de cantidad, sino que **todas las concesiones
 * pasan por revisión** antes de abonarse al saldo:
 *
 *   1. Al marcar un pedido como pagado se calcula la concesión completa y se guarda como
 *      `pending` (aún NO se suma al saldo del diseñador).
 *   2. El administrador la revisa en /admin y la aprueba o la rechaza.
 *   3. Solo al aprobar se abona el importe íntegro al saldo.
 *
 * Reglas de procedencia (las de siempre): no se generan Pennies al fabricar un diseño
 * propio ni por diseños privados o no publicados. Todo lo demás se concede completo.
 */
export type AwardOutcome = {
  amount: number;
  awardId: string | null;
  reason: "pending_review" | "own_design" | "not_public" | "no_category" | "no_project" | "already_awarded";
};

/** Crea (pendiente de revisión) la concesión de Pennies de un pedido recién pagado. */
export async function proposePenniesForPaidOrder(tx: Tx, order: {
  id: string; orderNumber: string; projectId: string | null; userId: string | null;
  buyerEmail: string; width: number; height: number;
}): Promise<AwardOutcome> {
  if (!order.projectId) return { amount: 0, awardId: null, reason: "no_project" };

  const [source] = await tx.select({ ownerId: users.id, ownerEmail: users.email, title: projects.title, isPublic: projects.isPublic })
    .from(projects).innerJoin(users, eq(projects.userId, users.id)).where(eq(projects.id, order.projectId)).limit(1);
  if (!source || !source.isPublic) return { amount: 0, awardId: null, reason: "not_public" };

  const category = boardCategory(order.width, order.height);
  if (!category) return { amount: 0, awardId: null, reason: "no_category" };

  // Fabricar tu propio diseño no genera Pennies (no hay venta a un tercero).
  if (source.ownerId === order.userId || source.ownerEmail.toLowerCase() === order.buyerEmail.toLowerCase()) {
    return { amount: 0, awardId: null, reason: "own_design" };
  }

  const [existing] = await tx.select({ id: pennyLedger.id }).from(pennyLedger)
    .where(and(eq(pennyLedger.orderId, order.id), eq(pennyLedger.type, "earned"))).limit(1);
  if (existing) return { amount: 0, awardId: existing.id, reason: "already_awarded" };

  const amount = BOARD_TIERS[category].pennies;
  const awardId = randomUUID();
  await tx.insert(pennyLedger).values({
    id: awardId, userId: source.ownerId, orderId: order.id, type: "earned", amount,
    status: "pending",
    description: `Fabricación de «${source.title}» · ${order.orderNumber}`,
  });
  return { amount, awardId, reason: "pending_review" };
}

/** Abona una concesión revisada. Idempotente: una concesión ya aprobada no se vuelve a sumar. */
export async function approvePennyAward(tx: Tx, awardId: string, note = "") {
  const [award] = await tx.select().from(pennyLedger).where(and(eq(pennyLedger.id, awardId), eq(pennyLedger.type, "earned"))).for("update").limit(1);
  if (!award) throw new Error("Concesión no encontrada.");
  if (award.status === "approved") return { amount: 0, status: "approved" as const };
  if (award.status !== "pending") throw new Error("Esta concesión ya fue rechazada o anulada.");
  await tx.update(pennyLedger).set({ status: "approved", reviewedAt: new Date(), reviewNote: note.slice(0, 500) }).where(eq(pennyLedger.id, awardId));
  await tx.update(users).set({ pennies: sql`${users.pennies} + ${award.amount}` }).where(eq(users.id, award.userId));
  return { amount: award.amount, status: "approved" as const };
}

/** Rechaza una concesión pendiente: no se abona nada al diseñador. */
export async function rejectPennyAward(tx: Tx, awardId: string, note: string) {
  const [award] = await tx.select().from(pennyLedger).where(and(eq(pennyLedger.id, awardId), eq(pennyLedger.type, "earned"))).for("update").limit(1);
  if (!award) throw new Error("Concesión no encontrada.");
  if (award.status !== "pending") throw new Error("Solo se pueden rechazar concesiones pendientes.");
  await tx.update(pennyLedger).set({ status: "rejected", reviewedAt: new Date(), reviewNote: note.slice(0, 500) }).where(eq(pennyLedger.id, awardId));
  return { status: "rejected" as const };
}

/**
 * Al reembolsar un pedido pagado: si la concesión estaba pendiente se anula; si ya se había
 * aprobado, se descuenta el importe concedido.
 */
export async function reverseAwardForOrder(tx: Tx, order: { id: string; orderNumber: string }) {
  const [award] = await tx.select().from(pennyLedger).where(and(eq(pennyLedger.orderId, order.id), eq(pennyLedger.type, "earned"))).for("update").limit(1);
  if (!award) return { reversed: 0, status: "none" as const };
  if (award.status === "pending") {
    await tx.update(pennyLedger).set({ status: "cancelled", reviewedAt: new Date(), reviewNote: "Pedido reembolsado antes de la revisión." }).where(eq(pennyLedger.id, award.id));
    return { reversed: 0, status: "cancelled" as const };
  }
  if (award.status === "approved") {
    await tx.insert(pennyLedger).values({
      id: randomUUID(), userId: award.userId, orderId: order.id, type: "refund", amount: -award.amount,
      status: "approved", reviewedAt: new Date(), description: `Reembolso de ${order.orderNumber}`,
    });
    await tx.update(users).set({ pennies: sql`${users.pennies} - ${award.amount}` }).where(eq(users.id, award.userId));
    return { reversed: award.amount, status: "refunded" as const };
  }
  return { reversed: 0, status: "none" as const };
}

/** Concesiones pendientes de revisión, con datos para el panel (sin importes de otros pedidos). */
export async function listPendingAwards(limit = 200) {
  return db.select({
    id: pennyLedger.id, amount: pennyLedger.amount, description: pennyLedger.description,
    createdAt: pennyLedger.createdAt, orderId: pennyLedger.orderId,
    designerName: users.name, designerEmail: users.email,
    orderNumber: orders.orderNumber, buyerEmail: orders.buyerEmail,
    width: orders.width, height: orders.height, quantity: orders.quantity,
  }).from(pennyLedger)
    .innerJoin(users, eq(pennyLedger.userId, users.id))
    .leftJoin(orders, eq(pennyLedger.orderId, orders.id))
    .where(and(eq(pennyLedger.type, "earned"), eq(pennyLedger.status, "pending")))
    .orderBy(pennyLedger.createdAt)
    .limit(limit);
}
