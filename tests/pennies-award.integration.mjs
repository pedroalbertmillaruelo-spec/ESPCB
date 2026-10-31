import test from "node:test";
import assert from "node:assert/strict";
import { sql } from "drizzle-orm";
import { db, pool } from "../src/db/index.ts";
import { approvePennyAward, proposePenniesForPaidOrder, rejectPennyAward, reverseAwardForOrder } from "../src/lib/pennies-award.ts";

/**
 * Integración contra PostgreSQL real. Se omite si no hay base de datos accesible.
 * Comprueba la política pedida por el negocio: SIN TOPES y con revisión manual
 * obligatoria antes de abonar los Pennies.
 */
async function dbReachable() { try { await db.execute(sql`select 1`); return true; } catch { return false; } }

const D = "test-review-designer";
const P = "test-review-project";
const order = (id, buyer) => sql`
  insert into orders (id,order_number,buyer_name,buyer_email,width,height,quantity,layers,holes,gerber_name,gerber_data,base_cents,shipping_cents,total_cents,project_id,status)
  values (${id},${id.toUpperCase()},'Comprador',${buyer},100,100,1,2,0,'a.zip','\\x504b0304'::bytea,2000,1365,3365,${P},'pending')`;
const balance = async () => Number((await db.execute(sql`select pennies from users where id=${D}`)).rows[0].pennies);
const awardOf = async (orderId) => (await db.execute(sql`select id, amount, status from penny_ledger where order_id=${orderId} and type='earned'`)).rows[0];

async function cleanup() {
  await db.execute(sql`delete from penny_ledger where user_id = ${D}`);
  await db.execute(sql`delete from orders where id like 'test-review-%'`);
  await db.execute(sql`delete from projects where id = ${P}`);
  await db.execute(sql`delete from users where id = ${D}`);
}

test("Pennies sin topes, pero con revisión manual antes de abonar", async (t) => {
  if (!(await dbReachable())) { t.skip("PostgreSQL no disponible"); await pool.end(); return; }
  await cleanup();
  await db.execute(sql`insert into users (id,name,email,password_hash,pennies,terms_accepted_at,terms_version,adult_confirmed)
    values (${D},'Diseñadora Review','test-review-designer@example.test','x:y',0,now(),'2026-10-27',true)`);
  await db.execute(sql`insert into projects (id,user_id,title,description,category,width,height,layers,image_type,image_data,gerber_name,gerber_data,is_public)
    values (${P},${D},'Placa review','Proyecto de prueba','Audio',100,100,2,'image/png','\\x89504e47'::bytea,'g.zip','\\x504b0304'::bytea,true)`);

  // 1) Pedido pagado → concesión PENDIENTE. El saldo NO cambia todavía.
  await db.execute(order("test-review-o1", "comprador-1@example.test"));
  const proposed = await db.transaction((tx) => proposePenniesForPaidOrder(tx, {
    id: "test-review-o1", orderNumber: "TEST-REVIEW-1", projectId: P, userId: null,
    buyerEmail: "comprador-1@example.test", width: 100, height: 100,
  }));
  assert.equal(proposed.reason, "pending_review");
  assert.equal(proposed.amount, 20);
  assert.equal(await balance(), 0, "nada se abona sin revisión");
  assert.equal((await awardOf("test-review-o1")).status, "pending");

  // 2) Aprobar → se abona el importe íntegro.
  await db.transaction((tx) => approvePennyAward(tx, proposed.awardId, "Comprobado"));
  assert.equal(await balance(), 20);
  assert.equal((await awardOf("test-review-o1")).status, "approved");

  // Aprobar dos veces no duplica el saldo.
  await db.transaction((tx) => approvePennyAward(tx, proposed.awardId));
  assert.equal(await balance(), 20);

  // 3) Rechazar → no se abona.
  await db.execute(order("test-review-o2", "comprador-2@example.test"));
  const second = await db.transaction((tx) => proposePenniesForPaidOrder(tx, {
    id: "test-review-o2", orderNumber: "TEST-REVIEW-2", projectId: P, userId: null,
    buyerEmail: "comprador-2@example.test", width: 100, height: 100,
  }));
  await db.transaction((tx) => rejectPennyAward(tx, second.awardId, "Pedido ficticio"));
  assert.equal(await balance(), 20, "lo rechazado no se abona");
  assert.equal((await awardOf("test-review-o2")).status, "rejected");

  // 4) SIN TOPE: 15 fabricaciones más del mismo diseño suman todas (15 × 20 = 300).
  let expected = 20;
  for (let i = 0; i < 15; i++) {
    const id = `test-review-bulk-${i}`;
    await db.execute(order(id, `comprador-bulk-${i}@example.test`));
    const proposal = await db.transaction((tx) => proposePenniesForPaidOrder(tx, {
      id, orderNumber: `TEST-BULK-${i}`, projectId: P, userId: null,
      buyerEmail: `comprador-bulk-${i}@example.test`, width: 100, height: 100,
    }));
    await db.transaction((tx) => approvePennyAward(tx, proposal.awardId));
    expected += 20;
  }
  assert.equal(await balance(), expected, "no hay ningún tope: se abonan todas las fabricaciones");

  // 5) Reembolso de una concesión aprobada → descuenta exactamente su importe.
  await db.execute(sql`update orders set status='paid' where id='test-review-o1'`);
  await db.transaction((tx) => reverseAwardForOrder(tx, { id: "test-review-o1", orderNumber: "TEST-REVIEW-1" }));
  assert.equal(await balance(), expected - 20);

  // 6) Fabricar el diseño propio no genera Pennies.
  await db.execute(order("test-review-own", "test-review-designer@example.test"));
  const own = await db.transaction((tx) => proposePenniesForPaidOrder(tx, {
    id: "test-review-own", orderNumber: "TEST-OWN", projectId: P, userId: D,
    buyerEmail: "test-review-designer@example.test", width: 100, height: 100,
  }));
  assert.equal(own.reason, "own_design");

  await cleanup();
  await pool.end();
});
