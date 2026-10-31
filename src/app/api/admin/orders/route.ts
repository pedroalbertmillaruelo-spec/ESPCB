import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { coupons, orders } from "@/db/schema";
import { isAdmin } from "@/lib/admin";
import { message } from "@/lib/http";
import { proposePenniesForPaidOrder, reverseAwardForOrder } from "@/lib/pennies-award";

export async function GET(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: "No autorizado." }, { status: 401 });
  const rows = await db.select({ id: orders.id, orderNumber: orders.orderNumber, buyerName: orders.buyerName, buyerEmail: orders.buyerEmail, shippingAddress: orders.shippingAddress, shippingCountry: orders.shippingCountry, shippingPostalCode: orders.shippingPostalCode, shippingCity: orders.shippingCity, shippingCarrier: orders.shippingCarrier, shippingService: orders.shippingService, shippingEtaDays: orders.shippingEtaDays, shippingSource: orders.shippingSource, shippingCents: orders.shippingCents, width: orders.width, height: orders.height, quantity: orders.quantity, layers: orders.layers, holes: orders.holes, totalCents: orders.totalCents, status: orders.status, emailStatus: orders.emailStatus, createdAt: orders.createdAt }).from(orders).orderBy(desc(orders.createdAt)).limit(200);
  return Response.json({ orders: rows });
}

/**
 * Cambios de estado. Al pasar a `paid` se calcula la concesión de Pennies y queda
 * PENDIENTE DE REVISIÓN: no se abona al saldo hasta que el administrador la apruebe.
 * Así no hay topes automáticos y ninguna concesión entra sin pasar por revisión.
 */
export async function PATCH(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: "No autorizado." }, { status: 401 });
  try {
    const { id, status } = await request.json();
    if (typeof id !== "string" || !["paid", "cancelled", "refunded"].includes(status)) throw new Error("Estado no válido.");
    const outcome = await db.transaction(async (tx) => {
      const [order] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
      if (!order) throw new Error("Pedido no encontrado.");
      if (order.status === status) return { status, award: null, reversal: null };
      if (!((order.status === "pending" && ["paid", "cancelled"].includes(status)) || (order.status === "paid" && status === "refunded"))) throw new Error("Transición de estado no permitida.");
      let award = null; let reversal = null;
      if (status === "paid") {
        if (order.couponId) await tx.update(coupons).set({ status: "used" }).where(and(eq(coupons.id, order.couponId), eq(coupons.orderId, order.id)));
        award = await proposePenniesForPaidOrder(tx, {
          id: order.id, orderNumber: order.orderNumber, projectId: order.projectId,
          userId: order.userId, buyerEmail: order.buyerEmail, width: order.width, height: order.height,
        });
      }
      if (status === "cancelled" && order.couponId) await tx.update(coupons).set({ status: "available", orderId: null }).where(and(eq(coupons.id, order.couponId), eq(coupons.orderId, order.id), eq(coupons.status, "reserved")));
      if (status === "refunded") reversal = await reverseAwardForOrder(tx, { id: order.id, orderNumber: order.orderNumber });
      await tx.update(orders).set({ status }).where(eq(orders.id, id));
      return { status, award, reversal };
    });
    if (outcome.award?.reason === "pending_review") console.info("[pennies] Concesión pendiente de revisión", { amount: outcome.award.amount });
    return Response.json({ ok: true, ...outcome });
  } catch (error) { return Response.json({ error: message(error) }, { status: 400 }); }
}
