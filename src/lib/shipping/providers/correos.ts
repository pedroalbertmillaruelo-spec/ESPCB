import type { PackageInfo, ShippingOption } from "../types";
import { spainZoneFromPostalCode } from "../zones";
import { CORREOS_INTERNATIONAL, correosInternationalPrice, correosZoneFor } from "./correos-international";

/**
 * Correos no ofrece una API de tarifas pública sin contrato de transporte firmado
 * (la integración por API de Correos exige ser cliente con contrato: ver
 * correos.es/es/es/empresas/ecommerce/.../integracion-api). Por eso, para España
 * usamos sus tarifas oficiales publicadas (PVP sin contrato, "Tarifas Correos 2026"),
 * bandeadas por peso. Es un precio real de tarifario público, no una estimación
 * inventada, pero no es una consulta en tiempo real: se marca como `source: "tariff"`.
 *
 * Si en el futuro se firma un contrato y se obtienen credenciales de la API de
 * Correos, basta con añadir un proveedor nuevo con `source: "api"` que llame a esa
 * API real; el resto de la aplicación no necesita cambios.
 */
type Band = { maxKg: number; cents: number };
const PENINSULA_BALEARES_STANDARD: Band[] = [
  { maxKg: 1, cents: 1365 }, { maxKg: 5, cents: 1710 }, { maxKg: 10, cents: 2295 },
  { maxKg: 15, cents: 2781 }, { maxKg: 20, cents: 3365 }, { maxKg: 25, cents: 3901 }, { maxKg: 30, cents: 4425 },
];
const PENINSULA_BALEARES_STANDARD_EXTRA_PER_KG_CENTS = 136;
const PENINSULA_BALEARES_PREMIUM: Band[] = [
  { maxKg: 1, cents: 2015 }, { maxKg: 5, cents: 3121 }, { maxKg: 10, cents: 4364 },
  { maxKg: 15, cents: 5905 }, { maxKg: 20, cents: 7490 }, { maxKg: 25, cents: 9145 }, { maxKg: 30, cents: 10686 },
];
const PENINSULA_BALEARES_PREMIUM_EXTRA_PER_KG_CENTS = 335;
const CANARIAS_CEUTA_MELILLA_STANDARD: Band[] = [
  { maxKg: 1, cents: 2130 }, { maxKg: 5, cents: 3070 }, { maxKg: 10, cents: 3840 },
  { maxKg: 15, cents: 4910 }, { maxKg: 20, cents: 6675 }, { maxKg: 25, cents: 8685 }, { maxKg: 30, cents: 10700 },
];
const CANARIAS_CEUTA_MELILLA_STANDARD_EXTRA_PER_KG_CENTS = 420;

/** Paq Standard Internacional: tarifas oficiales de Correos 2026 por zona. */
export function correosInternationalOptions(country: string, pkg: PackageInfo): ShippingOption[] {
  const zone = correosZoneFor(country);
  if (!zone) return [];
  const cents = correosInternationalPrice(zone, pkg.chargeableGrams);
  if (cents === null) return []; // fuera de los tramos publicados: se pide presupuesto manual
  return [{
    code: "correos_int_standard",
    carrier: "Correos",
    service: `Paq Standard Internacional (${CORREOS_INTERNATIONAL[zone].label})`,
    label: "Correos · Paq Standard Internacional",
    cents,
    etaDays: zone === "EU1" || zone === "EU2" ? "5-9" : "8-15",
    source: "tariff",
    promoEligible: false,
    zone: `international_${zone.toLowerCase()}`,
  }];
}

function priceFromTable(table: Band[], extraPerKgCents: number, chargeableKg: number): number {
  const band = table.find((item) => chargeableKg <= item.maxKg);
  if (band) return band.cents;
  const lastBand = table[table.length - 1];
  const extraKg = Math.ceil(chargeableKg - lastBand.maxKg);
  return lastBand.cents + extraKg * extraPerKgCents;
}

/** Tarifas oficiales de Correos para destinos en España, según el código postal. */
export function correosOptions(postalCode: string, pkg: PackageInfo): ShippingOption[] {
  const zone = spainZoneFromPostalCode(postalCode);
  if (!zone) return [];
  const chargeableKg = pkg.chargeableGrams / 1000;
  if (zone === "peninsula_baleares") {
    return [
      {
        code: "correos_estandar", carrier: "Correos", service: "Paq Estándar", label: "Correos · Paq Estándar",
        cents: priceFromTable(PENINSULA_BALEARES_STANDARD, PENINSULA_BALEARES_STANDARD_EXTRA_PER_KG_CENTS, chargeableKg),
        etaDays: "3-5", source: "tariff", promoEligible: true, zone,
      },
      {
        code: "correos_premium", carrier: "Correos", service: "Paq Premium", label: "Correos · Paq Premium",
        cents: priceFromTable(PENINSULA_BALEARES_PREMIUM, PENINSULA_BALEARES_PREMIUM_EXTRA_PER_KG_CENTS, chargeableKg),
        etaDays: "1-2", source: "tariff", promoEligible: false, zone,
      },
    ];
  }
  return [
    {
      code: "correos_estandar", carrier: "Correos", service: "Paq Estándar (Canarias/Ceuta/Melilla)", label: "Correos · Paq Estándar",
      cents: priceFromTable(CANARIAS_CEUTA_MELILLA_STANDARD, CANARIAS_CEUTA_MELILLA_STANDARD_EXTRA_PER_KG_CENTS, chargeableKg),
      etaDays: "5-8", source: "tariff", promoEligible: true, zone,
    },
  ];
}
