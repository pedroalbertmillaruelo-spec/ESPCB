import { eq } from "drizzle-orm";
import { db } from "@/db";
import { orders } from "@/db/schema";
import { isAdmin } from "@/lib/admin";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(request)) return new Response("No autorizado", { status: 401 });
  const { id } = await params;
  const [order] = await db.select({ data: orders.gerberData, name: orders.gerberName }).from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return new Response("No encontrado", { status: 404 });
  const name = order.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "gerbers.zip";
  return new Response(new Uint8Array(order.data), { headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${name}"`, "X-Content-Type-Options": "nosniff" } });
}
