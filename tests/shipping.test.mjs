import test from "node:test";
import assert from "node:assert/strict";
import { estimatePackage } from "../src/lib/shipping/package.ts";
import { spainZoneFromPostalCode } from "../src/lib/shipping/zones.ts";
import { correosOptions } from "../src/lib/shipping/providers/correos.ts";
import { correosInternationalPrice, correosZoneFor } from "../src/lib/shipping/providers/correos-international.ts";
import { getShippingOptions, findShippingOption } from "../src/lib/shipping/index.ts";

test("estimación de peso de una placa FR4 es realista", () => {
  const pkg100 = estimatePackage(100, 100, 1);
  // 100x100x1.6mm FR4 (~1.85 g/cm³) pesa en torno a 30 g; + sobre ≈ 35 g => total razonable.
  assert.ok(pkg100.grams > 55 && pkg100.grams < 75, `peso inesperado: ${pkg100.grams}g`);
  const pkg10 = estimatePackage(100, 100, 10);
  assert.ok(pkg10.grams > pkg100.grams, "10 placas deben pesar más que 1");
  assert.ok(pkg100.chargeableGrams >= pkg100.grams, "el peso facturable nunca es menor que el real");
});

test("zonas postales españolas", () => {
  assert.equal(spainZoneFromPostalCode("28001"), "peninsula_baleares");
  assert.equal(spainZoneFromPostalCode("07001"), "peninsula_baleares");
  assert.equal(spainZoneFromPostalCode("35001"), "canarias_ceuta_melilla");
  assert.equal(spainZoneFromPostalCode("38001"), "canarias_ceuta_melilla");
  assert.equal(spainZoneFromPostalCode("51001"), "canarias_ceuta_melilla");
  assert.equal(spainZoneFromPostalCode("52001"), "canarias_ceuta_melilla");
  assert.equal(spainZoneFromPostalCode("abc"), null);
  assert.equal(spainZoneFromPostalCode("123"), null);
});

test("tarifas oficiales de Correos por banda de peso", () => {
  const light = estimatePackage(50, 50, 1); // paquete muy ligero, banda "hasta 1 kg"
  const [standard, premium] = correosOptions("28001", light);
  assert.equal(standard.cents, 1365); assert.equal(standard.promoEligible, true); assert.equal(standard.source, "tariff");
  assert.equal(premium.cents, 2015); assert.equal(premium.promoEligible, false);
  const canarias = correosOptions("35001", light);
  assert.equal(canarias.length, 1); assert.equal(canarias[0].cents, 2130);
  // Fuera de España, Correos no ofrece tarifa.
  assert.equal(correosOptions("", light).length, 0);
});

test("banda superior a 30 kg aplica el extra por kilogramo adicional", () => {
  const heavy = { grams: 32000, volumetricGrams: 0, chargeableGrams: 32000, lengthCm: 30, widthCm: 20, heightCm: 10 };
  const [standard] = correosOptions("28001", heavy);
  // 30kg=4425 + 2kg extra * 136 = 4425+272=4697
  assert.equal(standard.cents, 4425 + 2 * 136);
});

test("el agregador ofrece opciones para España y recupera por código", async () => {
  const result = await getShippingOptions({ destination: { country: "ES", postalCode: "28001" }, widthMm: 100, heightMm: 100, quantity: 5 });
  assert.ok(result.options.length >= 2, "debe haber al menos Estándar y Premium");
  assert.ok(result.options.every((o) => o.cents > 0));
  const picked = findShippingOption(result.options, result.options[0].code);
  assert.equal(picked?.code, result.options[0].code);
  assert.equal(result.warnings.length, 0);
});

test("Finlandia recibe la tarifa internacional real de Correos, no 0 €", async () => {
  const result = await getShippingOptions({ destination: { country: "FI", postalCode: "00100" }, widthMm: 50, heightMm: 50, quantity: 1 });
  assert.ok(result.options.length >= 1, "Finlandia debe tener al menos una tarifa");
  const option = result.options[0];
  assert.notEqual(option.code, "manual_quote", "no debe caer en presupuesto manual");
  assert.equal(option.source, "tariff");
  assert.ok(option.cents > 0, `el precio debe ser real y mayor que 0 (recibido ${option.cents})`);
  assert.equal(option.cents, 3307); // Paq Standard Internacional Europa 1, hasta 1 kg (PVP oficial 2026)
});
test("zonas internacionales: Europa 2 y América usan su propia tarifa", () => {
  assert.equal(correosZoneFor("FI"), "EU1");
  assert.equal(correosZoneFor("CH"), "EU2");
  assert.equal(correosZoneFor("US"), "AM");
  assert.equal(correosZoneFor("JP"), "ASOC1");
  assert.equal(correosZoneFor("NG"), "AF");
  assert.equal(correosZoneFor("ES"), null);
  assert.equal(correosInternationalPrice("EU1", 500), 3307);
  assert.equal(correosInternationalPrice("EU1", 1500), 3648);
  assert.equal(correosInternationalPrice("AM", 500), 3796);
  // Sin tramo oficial publicado para ese peso: se pide presupuesto manual (null), no se inventa.
  assert.equal(correosInternationalPrice("EU1", 7000), null);
  assert.equal(correosInternationalPrice("ASOC2", 3000), 6082 + 1591);
});
test("destino totalmente desconocido cae en presupuesto manual, nunca en 0 € silencioso", async () => {
  const result = await getShippingOptions({ destination: { country: "ZZ", postalCode: "00000" }, widthMm: 50, heightMm: 50, quantity: 1 });
  assert.equal(result.options.length, 1);
  assert.equal(result.options[0].code, "manual_quote");
  assert.equal(result.options[0].source, "manual");
  assert.ok(result.warnings.length > 0);
});
