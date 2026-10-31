import type { PackageInfo, ShippingDestination, ShippingOption } from "../types";

/**
 * DHL Express MyDHL API (real, oficial): https://developer.dhl.com — "DHL Express - MyDHL API".
 * Endpoint de tarifas: POST {base}/rates, cabecera `DHL-API-Key`. Necesita una cuenta DHL
 * Express y credenciales del portal de desarrolladores (sandbox gratuito con alta inmediata).
 *
 * Sin configurar, este proveedor no se activa (devuelve sin opciones) y la aplicación usa
 * las tarifas de Correos para España o, si no hay ninguna disponible, un presupuesto manual.
 * En cuanto se configuran las variables de entorno, las tarifas pasan a ser en tiempo real.
 */
type DhlPrice = { currencyType?: string; priceCurrency: string; price: number };
type DhlProduct = {
  productCode: string;
  productName: string;
  totalPrice?: DhlPrice[];
  deliveryCapabilities?: { totalTransitDays?: number };
};

function dhlConfigured() {
  return Boolean(
    process.env.DHL_API_KEY && process.env.DHL_ACCOUNT_NUMBER &&
    process.env.DHL_ORIGIN_COUNTRY && process.env.DHL_ORIGIN_POSTAL_CODE && process.env.DHL_ORIGIN_CITY,
  );
}

export async function dhlOptions(destination: ShippingDestination, pkg: PackageInfo): Promise<ShippingOption[]> {
  if (!dhlConfigured()) return [];
  const base = (process.env.DHL_API_BASE_URL || "https://express.api.dhl.com/mydhlapi/test").replace(/\/$/, "");
  const originCountry = process.env.DHL_ORIGIN_COUNTRY!;
  const plannedDate = new Date(Date.now() + 24 * 3600 * 1000);
  const body = {
    customerDetails: {
      shipperDetails: { postalCode: process.env.DHL_ORIGIN_POSTAL_CODE, cityName: process.env.DHL_ORIGIN_CITY, countryCode: originCountry },
      receiverDetails: { postalCode: destination.postalCode, cityName: destination.city || destination.postalCode, countryCode: destination.country },
    },
    accounts: [{ typeCode: "shipper", number: process.env.DHL_ACCOUNT_NUMBER }],
    plannedShipmentDateAndTime: `${plannedDate.toISOString().slice(0, 10)}T10:00:00GMT+01:00`,
    unitOfMeasurement: "metric",
    isCustomsDeclarable: destination.country !== originCountry,
    packages: [{ weight: Math.max(0.1, Math.round(pkg.chargeableGrams / 10) / 100), dimensions: { length: pkg.lengthCm, width: pkg.widthCm, height: pkg.heightCm } }],
  };
  try {
    const response = await fetch(`${base}/rates`, {
      method: "POST",
      headers: { "DHL-API-Key": process.env.DHL_API_KEY!, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      console.error("[shipping] DHL rates respondió", response.status, (await response.text().catch(() => "")).slice(0, 500));
      return [];
    }
    const data = (await response.json()) as { products?: DhlProduct[] };
    const options: ShippingOption[] = [];
    for (const product of data.products ?? []) {
      const price = product.totalPrice?.find((item) => item.priceCurrency === "EUR") ?? product.totalPrice?.[0];
      if (!price || !Number.isFinite(price.price)) continue;
      options.push({
        code: `dhl_${product.productCode}`,
        carrier: "DHL Express",
        service: product.productName,
        label: `DHL Express · ${product.productName}`,
        cents: Math.round(price.price * 100),
        etaDays: product.deliveryCapabilities?.totalTransitDays ? String(product.deliveryCapabilities.totalTransitDays) : "1-3",
        source: "api",
        promoEligible: false,
        zone: "dhl",
      });
    }
    return options;
  } catch (error) {
    console.error("[shipping] No se pudo consultar la tarifa de DHL:", error);
    return [];
  }
}
