/**
 * Tarifas internacionales oficiales de Correos 2026 (Paq Standard Internacional, PVP con impuestos).
 * Fuente: "Tarifas Correos 2026 · Península y Baleares", apartado PAQUETERÍA INTERNACIONAL /
 * PAQ STANDARD INTERNACIONAL. Correos agrupa los destinos por zonas; aquí se replica esa
 * agrupación con los países más habituales y se deja el resto en su zona de referencia.
 *
 * Solo se publican los tramos confirmados en el tarifario (hasta 2 kg, el peso real de
 * prácticamente cualquier pedido de prototipos). Para pesos mayores se usa el precio por
 * kilo adicional cuando Correos lo publica para esa zona; si no, se ofrece presupuesto manual.
 */
export type CorreosZone = "EU1" | "EU2" | "EU3" | "AM" | "ASOC1" | "ASOC2" | "AF";

const EU_27 = ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"];
const EU2_EXTRA = ["CH", "NO", "IS", "LI", "AD", "SM", "VA", "MC", "RS", "BA", "AL", "MK", "ME", "TR", "UA", "MD", "GE", "AM", "BY", "RU"];
const EU3_EXTRA = ["XK", "GI", "FO", "GL"];
const ASIA_OCEANIA_1 = ["CN", "JP", "KR", "HK", "TW", "SG", "MY", "TH", "VN", "PH", "ID", "IN", "PK", "BD", "LK", "AU", "NZ"];
const ASIA_OCEANIA_2 = ["AE", "SA", "QA", "KW", "BH", "OM", "IL", "JO", "LB"];
const AFRICA = ["EG", "MA", "TN", "DZ", "NG", "KE", "ZA", "GH", "SN", "CI", "CM", "ET", "TZ", "UG", "AO", "MZ"];

export function correosZoneFor(country: string): CorreosZone | null {
  const code = country.toUpperCase();
  if (code === "ES") return null;
  if (EU_27.includes(code)) return "EU1";
  if (code === "GB") return "EU1"; // Reino Unido se tarifica con Europa 1
  if (EU2_EXTRA.includes(code)) return "EU2";
  if (EU3_EXTRA.includes(code)) return "EU3";
  if (["US", "CA", "MX", "BR", "AR", "CL", "CO", "PE", "UY", "EC", "VE", "CR", "PA", "DO", "GT"].includes(code)) return "AM";
  if (ASIA_OCEANIA_1.includes(code)) return "ASOC1";
  if (AFRICA.includes(code)) return "AF";
  if (ASIA_OCEANIA_2.includes(code)) return "ASOC2";
  return null;
}

type Band = { maxGrams: number; cents: number };
type ZoneTariff = { label: string; bands: Band[]; extraPerKgCents: number | null };

/** Importes PVP oficiales 2026 (impuestos incluidos según zona). */
export const CORREOS_INTERNATIONAL: Record<CorreosZone, ZoneTariff> = {
  EU1: {
    label: "Europa 1", extraPerKgCents: null,
    bands: [
      { maxGrams: 1000, cents: 3307 },
      { maxGrams: 2000, cents: 3648 },
    ],
  },
  EU2: {
    label: "Europa 2", extraPerKgCents: null,
    bands: [
      { maxGrams: 1000, cents: 3475 },
      { maxGrams: 2000, cents: 3929 },
    ],
  },
  EU3: {
    label: "Europa 3", extraPerKgCents: 1261,
    bands: [
      { maxGrams: 1000, cents: 3462 },
      { maxGrams: 2000, cents: 4723 },
    ],
  },
  AM: {
    label: "América", extraPerKgCents: null,
    bands: [
      { maxGrams: 1000, cents: 3796 },
      { maxGrams: 2000, cents: 4779 },
    ],
  },
  ASOC1: {
    label: "Asia y Oceanía 1", extraPerKgCents: null,
    bands: [
      { maxGrams: 1000, cents: 4491 },
      { maxGrams: 2000, cents: 5567 },
    ],
  },
  ASOC2: {
    label: "Asia y Oceanía 2", extraPerKgCents: 1591,
    bands: [
      { maxGrams: 1000, cents: 4491 },
      { maxGrams: 2000, cents: 6082 },
    ],
  },
  AF: {
    label: "África", extraPerKgCents: null,
    bands: [
      { maxGrams: 1000, cents: 4908 },
      { maxGrams: 2000, cents: 5629 },
    ],
  },
};

/** Precio oficial para el peso facturable, o null si excede lo publicado y no hay tramo oficial. */
export function correosInternationalPrice(zone: CorreosZone, chargeableGrams: number): number | null {
  const tariff = CORREOS_INTERNATIONAL[zone];
  const band = tariff.bands.find((item) => chargeableGrams <= item.maxGrams);
  if (band) return band.cents;
  if (tariff.extraPerKgCents === null) return null;
  const last = tariff.bands[tariff.bands.length - 1];
  const extraKg = Math.ceil((chargeableGrams - last.maxGrams) / 1000);
  return last.cents + extraKg * tariff.extraPerKgCents;
}
