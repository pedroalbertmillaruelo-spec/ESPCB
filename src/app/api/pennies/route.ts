import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { coupons, pennyLedger } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { REWARDS } from "@/lib/pricing";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getUser();
  if (!user) return Response.json({ error: "Inicia sesión para ver tus Pennies." }, { status: 401 });
  const [myCoupons, ledger] = await Promise.all([
    db.select().from(coupons).where(eq(coupons.userId, user.id)).orderBy(desc(coupons.createdAt)),
    db.select().from(pennyLedger).where(eq(pennyLedger.userId, user.id)).orderBy(desc(pennyLedger.createdAt)).limit(50),
  ]);
  return Response.json({ user, coupons: myCoupons, ledger, rewards: REWARDS });
}
