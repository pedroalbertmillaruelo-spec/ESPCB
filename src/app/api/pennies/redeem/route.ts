import { randomBytes, randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { coupons, pennyLedger, users } from "@/db/schema";
import { getUser } from "@/lib/auth";
import { checkOrigin, message } from "@/lib/http";
import { REWARDS } from "@/lib/pricing";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await getUser();
    if (!user) return Response.json({ error: "Inicia sesión para canjear tus Pennies." }, { status: 401 });
    const { rewardCode } = await request.json();
    const reward = REWARDS.find((item) => item.code === rewardCode);
    if (!reward) throw new Error("Recompensa no encontrada.");
    const code = `PCB-${randomBytes(5).toString("hex").toUpperCase()}`;
    await db.transaction(async (tx) => {
      const [lockedUser] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
      if (!lockedUser || lockedUser.pennies < reward.cost) throw new Error("Todavía no tienes suficientes Pennies para este cupón.");
      await tx.update(users).set({ pennies: sql`${users.pennies} - ${reward.cost}` }).where(eq(users.id, user.id));
      await tx.insert(coupons).values({ id: randomUUID(), userId: user.id, code, rewardCode: reward.code, cost: reward.cost });
      await tx.insert(pennyLedger).values({ id: randomUUID(), userId: user.id, type: "redeemed", amount: -reward.cost, description: `Canje: ${reward.label}` });
    });
    return Response.json({ ok: true, code });
  } catch (error) { return Response.json({ error: message(error) }, { status: 400 }); }
}
