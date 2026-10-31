import test from "node:test";
import assert from "node:assert/strict";
import { BASE_AREA_MM2, boardCategory, calculateBoardPrice, calculateBoardUnitCents, calculateQuote, MAX_BOARD_CENTS, MAX_BOARD_AREA_MM2, qualifiesForFreeStandardShipping } from "../src/lib/pricing.ts";

test("precio base de 5 € hasta 2.500 mm² y cantidades personalizadas", () => {
  // 2x2 mm (4 mm²) y 50x50 mm (2.500 mm²) pagan el mínimo; 60x50 mm (3.000 mm²) ya supera el umbral.
  assert.deepEqual([1, 4, 8, 16].map((n) => calculateBoardPrice(2, 2, n).base), [500, 2000, 4000, 8000]);
  assert.equal(calculateQuote(2, 2, 1, { shippingCents: 399, shippingPromoEligible: false }).total, 899);
  assert.equal(calculateBoardPrice(50, 50, 1).unit, 500);
  assert.equal(calculateBoardUnitCents(50, 50), 500);
  assert.equal(calculateBoardUnitCents(60, 50), 593);
  assert.equal(BASE_AREA_MM2, 2500);
});
test("curva amortiguada de 5 € a 40 € y envío con tarifa real", () => {
  // Curva exponencial negativa ascendente: 5 € en 2.500 mm² y 40 € en 30.000 mm² (150 × 200).
  assert.equal(calculateBoardUnitCents(50, 50), 500);       // 2.500 mm² (umbral)
  assert.equal(calculateBoardUnitCents(85, 65), 1041);      // 5.525 mm²
  assert.equal(calculateBoardUnitCents(100, 100), 1755);    // 10.000 mm²
  assert.equal(calculateBoardUnitCents(100, 150), 2448);    // 15.000 mm²
  assert.equal(calculateBoardUnitCents(100, 200), 3045);    // 20.000 mm²
  assert.equal(calculateBoardUnitCents(150, 200), 4000);    // 30.000 mm² → 40 € exactos
  assert.equal(MAX_BOARD_CENTS, 4000);
  // La curva se amortigua: el incremento por mm² es cada vez menor.
  const slope = (a) => calculateBoardUnitCents(Math.sqrt(a), Math.sqrt(a));
  assert.ok((slope(9000) - slope(4000)) > (slope(24000) - slope(19000)), "la pendiente debe decrecer");
  // Tope: nunca por encima de 40 €, aunque se pida una placa mayor (no fabricable).
  assert.equal(calculateBoardUnitCents(200, 200), MAX_BOARD_CENTS);
  assert.equal(MAX_BOARD_AREA_MM2, 30000);
  // El validador de Gerber usa la misma tarifa.
  assert.equal(calculateBoardPrice(100, 100, 1).unit, 1755);
  assert.equal(calculateBoardPrice(100.25, 100.5, 1).unit, 1767); // 10.075,125 mm²
  assert.equal(boardCategory(50.1, 50.1), "100x100");
  assert.throws(() => calculateBoardPrice(2.001, 2, 1));
  assert.equal(calculateQuote(100, 100, 1, { shippingCents: 1365, shippingPromoEligible: true }).shipping, 1365);
  assert.equal(calculateQuote(100, 100, 1, { shippingCents: 2015, shippingPromoEligible: false }).shipping, 2015);
  // El umbral de envío gratis solo se aplica a opciones marcadas como "promoEligible".
  // Con la nueva tarifa, 5 placas de 100×100 suman 87,75 €: aún NO llegan a 100 €.
  assert.equal(calculateQuote(100, 100, 5, { shippingCents: 1710, shippingPromoEligible: true }).shipping, 1710);
  // 6 placas de 100×100 = 105,30 €: superan el umbral y el envío económico es gratis.
  assert.equal(calculateQuote(100, 100, 6, { shippingCents: 1710, shippingPromoEligible: true }).shipping, 0);
  assert.equal(calculateQuote(100, 100, 5, { shippingCents: 3121, shippingPromoEligible: false }).shipping, 3121);
  assert.equal(calculateQuote(2, 2, 20, { shippingCents: 1365, shippingPromoEligible: true }).shipping, 0);
  assert.equal(qualifiesForFreeStandardShipping(10000, 1), true);
  assert.equal(qualifiesForFreeStandardShipping(500, 20), true);
  assert.equal(qualifiesForFreeStandardShipping(500, 1), false);
});
test("los descuentos se limitan a una unidad y su tamaño", () => {
  const q = calculateQuote(100, 100, 3, { rewardCode: "100x100-50", shippingCents: 1710, shippingPromoEligible: true });
  assert.equal(q.base, 1755 * 3); assert.equal(q.discount, Math.round(1755 / 2)); assert.equal(q.total, 1755 * 3 + 1710 - Math.round(1755 / 2));
  assert.throws(() => calculateQuote(2, 2, 3, { rewardCode: "100x100-50", shippingCents: 399, shippingPromoEligible: false }), /tamaño/i);
  assert.equal(calculateQuote(2, 2, 4, { rewardCode: "shipping", shippingCents: 799, shippingPromoEligible: false }).discount, 799);
  assert.throws(() => calculateQuote(2, 2, 20, { rewardCode: "shipping", shippingCents: 1365, shippingPromoEligible: true }), /gratuito/i);
});
test("se rechazan dimensiones, cantidades y envíos inválidos", () => {
  assert.equal(boardCategory(200, 150), "150x200");
  assert.throws(() => calculateBoardPrice(151, 201, 1));
  assert.throws(() => calculateBoardPrice(2, 2, 0));
  assert.throws(() => calculateBoardPrice(2, 2, 1001));
  assert.throws(() => calculateQuote(2, 2, 1, { shippingCents: -5, shippingPromoEligible: false }));
  assert.throws(() => calculateQuote(2, 2, 1, { rewardCode: "no-existe", shippingCents: 399, shippingPromoEligible: false }));
});
