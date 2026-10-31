/** Procedencia del precio: API en tiempo real, tarifa oficial publicada o presupuesto manual. */
export type ShippingSource = "api" | "tariff" | "manual";

export type ShippingOption = {
  /** Identificador estable para volver a localizar esta opción al recalcular en el servidor. */
  code: string;
  carrier: string;
  service: string;
  label: string;
  cents: number;
  /** Plazo orientativo en días, p. ej. "3-5". */
  etaDays: string;
  source: ShippingSource;
  /** ¿Puede beneficiarse de nuestra promoción de envío gratis por importe o cantidad? */
  promoEligible: boolean;
  zone: string;
};

export type PackageInfo = {
  grams: number;
  volumetricGrams: number;
  /** El mayor entre peso real y volumétrico: el que facturan los transportistas. */
  chargeableGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type ShippingDestination = { country: string; postalCode: string; city?: string };
export type ShippingQuoteInput = { destination: ShippingDestination; widthMm: number; heightMm: number; quantity: number };
export type ShippingQuoteResult = { options: ShippingOption[]; package: PackageInfo; warnings: string[] };
