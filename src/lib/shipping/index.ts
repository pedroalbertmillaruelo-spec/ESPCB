import { estimatePackage } from "./package";
import { correosInternationalOptions, correosOptions } from "./providers/correos";
import { dhlOptions } from "./providers/dhl";
import type { ShippingOption, ShippingQuoteInput, ShippingQuoteResult } from "./types";

export * from "./types";
export { estimatePackage } from "./package";
export { spainZoneFromPostalCode } from "./zones";
export { COUNTRIES, OTHER_COUNTRY_VALUE, isValidCountryCode } from "./countries";

const MANUAL_OPTION: ShippingOption = {
  code: "manual_quote", carrier: "Equipo ESPCB", service: "Presupuesto manual",
  label: "Te confirmamos el coste de envío", cents: 0, etaDays: "a confirmar",
  source: "manual", promoEligible: false, zone: "manual",
};

/**
 * Agrega las tarifas de todos los transportistas configurados para el destino indicado.
 * España usa las tarifas oficiales de Correos; cualquier país puede añadir DHL si está
 * configurado. Si ningún proveedor cubre el destino, se ofrece un presupuesto manual
 * en vez de romper el cotizador o inventar un precio.
 */
export async function getShippingOptions(input: ShippingQuoteInput): Promise<ShippingQuoteResult> {
  const country = input.destination.country.trim().toUpperCase();
  const postalCode = input.destination.postalCode.trim();
  const city = input.destination.city?.trim().slice(0, 100);
  const pkg = estimatePackage(input.widthMm, input.heightMm, input.quantity);
  const warnings: string[] = [];
  let options: ShippingOption[] = [];

  if (country === "ES") {
    options = correosOptions(postalCode, pkg);
    if (options.length === 0) warnings.push("No se ha reconocido el código postal español indicado.");
  } else {
    // Internacional: tarifa oficial de Correos (Paq Standard Internacional) por zona.
    options = correosInternationalOptions(country, pkg);
    if (options.length === 0) warnings.push("El peso del pedido supera los tramos publicados para este destino; confirmaremos el coste contigo.");
  }
  const dhl = await dhlOptions({ country, postalCode, city }, pkg);
  options = options.concat(dhl);

  if (options.length === 0) {
    options = [MANUAL_OPTION];
    warnings.push("No hay ningún transportista configurado para este destino todavía; revisaremos el envío manualmente contigo antes de confirmar nada.");
  }
  options.sort((a, b) => a.cents - b.cents);
  return { options, package: pkg, warnings };
}

export function findShippingOption(options: ShippingOption[], code: string): ShippingOption | undefined {
  return options.find((option) => option.code === code);
}
