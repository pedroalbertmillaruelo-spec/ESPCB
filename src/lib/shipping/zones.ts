export type SpainZone = "peninsula_baleares" | "canarias_ceuta_melilla";

/**
 * Zona postal española según la agrupación de las tarifas oficiales de Correos.
 * Canarias: prefijos 35 y 38. Ceuta: 51. Melilla: 52. El resto (incluida Baleares,
 * prefijo 07) se tarifica como envío intrapeninsular en las tablas publicadas.
 */
export function spainZoneFromPostalCode(postalCode: string): SpainZone | null {
  const code = postalCode.trim();
  if (!/^\d{5}$/.test(code)) return null;
  const prefix = code.slice(0, 2);
  if (prefix === "35" || prefix === "38" || prefix === "51" || prefix === "52") return "canarias_ceuta_melilla";
  return "peninsula_baleares";
}
