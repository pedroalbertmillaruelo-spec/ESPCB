export type BoardCategory = "50x50" | "100x100" | "100x200" | "150x200";
export const BOARD_TIERS: Record<BoardCategory, { label: string; pennies: number }> = {
  "50x50": { label: "50 × 50 mm", pennies: 5 },
  "100x100": { label: "100 × 100 mm", pennies: 20 },
  "100x200": { label: "100 × 200 mm", pennies: 40 },
  "150x200": { label: "150 × 200 mm", pennies: 60 },
};

/** Superficie cubierta por el precio base (mm²). Hasta este tamaño, la placa cuesta 5 €. */
export const BASE_AREA_MM2 = 2500;
/** Precio base por placa en céntimos (5,00 €). */
export const MINIMUM_BOARD_CENTS = 500;
/** Superficie de la placa más grande que fabricamos: 150 × 200 mm. */
export const MAX_BOARD_AREA_MM2 = 30000;
/** Precio máximo por placa en céntimos (40,00 €), que se alcanza en 150 × 200 mm. */
export const MAX_BOARD_CENTS = 4000;
/**
 * Amortiguación de la curva (1/mm²). Cuanto menor es k, más suave es la subida inicial y
 * más se parece la curva a una recta. Con k = 0,00003 la curva es claramente amortiguada
 * pero no encarece en exceso las placas medianas.
 */
export const BOARD_CURVE_DAMPING = 0.00003;
export const MAX_QUANTITY = 1000;

export const REWARDS: { code: string; label: string; cost: number; category?: BoardCategory; percent?: number; shipping?: boolean }[] = [
  { code: "shipping", label: "Envío gratis", cost: 50, shipping: true },
  { code: "50x50-100", label: "100 % gratis en placa 50 × 50 mm", cost: 50, category: "50x50", percent: 100 },
  { code: "100x100-50", label: "50 % de descuento en placa 100 × 100 mm", cost: 100, category: "100x100", percent: 50 },
  { code: "100x100-100", label: "100 % gratis en placa 100 × 100 mm", cost: 200, category: "100x100", percent: 100 },
  { code: "100x200-50", label: "50 % de descuento en placa 100 × 200 mm", cost: 200, category: "100x200", percent: 50 },
  { code: "100x200-100", label: "100 % gratis en placa 100 × 200 mm", cost: 400, category: "100x200", percent: 100 },
  { code: "150x200-50", label: "50 % de descuento en placa 150 × 200 mm", cost: 300, category: "150x200", percent: 50 },
  { code: "150x200-100", label: "100 % gratis en placa 150 × 200 mm", cost: 600, category: "150x200", percent: 100 },
];

export function boardCategory(width: number, height: number): BoardCategory | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || Math.abs(width * 100 - Math.round(width * 100)) > 1e-7 || Math.abs(height * 100 - Math.round(height * 100)) > 1e-7) return null;
  const [short, long] = [width, height].sort((a, b) => a - b);
  if (short <= 50 && long <= 50) return "50x50";
  if (short <= 100 && long <= 100) return "100x100";
  if (short <= 100 && long <= 200) return "100x200";
  if (short <= 150 && long <= 200) return "150x200";
  return null;
}

/**
 * Precio de UNA placa a partir de su superficie, en céntimos.
 *
 *   superficie ≤ 2.500 mm²  →  5,00 €
 *   2.500 < superficie < 30.000 mm²  →  curva exponencial negativa ascendente y amortiguada,
 *                                       que arranca en 5 € y llega a 40 € en 150 × 200 mm
 *   superficie ≥ 30.000 mm²  →  40,00 € (tope: el mayor tamaño fabricable)
 *
 * La forma es la de una saturación exponencial normalizada para alcanzar exactamente el
 * valor final:
 *
 *   p(A) = 5 + 35 · (1 − e^(−k·(A − 2.500))) / (1 − e^(−k·27.500))   con k = 0,00003
 *
 * La pendiente disminuye a medida que la placa crece (amortiguación): cada mm² adicional
 * encarece menos que el anterior, de modo que una placa grande no cuesta en proporción
 * directa a su área. Se redondea al céntimo por placa.
 */
export function calculateBoardUnitCents(widthMm: number, heightMm: number): number {
  const area = widthMm * heightMm;
  if (!Number.isFinite(area) || area <= 0) throw new Error("La superficie de la placa no es válida.");
  if (area <= BASE_AREA_MM2) return MINIMUM_BOARD_CENTS;
  if (area >= MAX_BOARD_AREA_MM2) return MAX_BOARD_CENTS;
  const range = MAX_BOARD_AREA_MM2 - BASE_AREA_MM2;
  const normalizer = 1 - Math.exp(-BOARD_CURVE_DAMPING * range);
  const progress = (1 - Math.exp(-BOARD_CURVE_DAMPING * (area - BASE_AREA_MM2))) / normalizer;
  const cents = MINIMUM_BOARD_CENTS + Math.round((MAX_BOARD_CENTS - MINIMUM_BOARD_CENTS) * progress);
  return Math.min(MAX_BOARD_CENTS, Math.max(MINIMUM_BOARD_CENTS, cents));
}

/** Precio de las placas, sin envío. Importes en céntimos: mínimo de 5 € por placa, no por pedido. */
export function calculateBoardPrice(width: number, height: number, quantity: number) {
  const category = boardCategory(width, height);
  if (!category || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) throw new Error(`Indica medidas válidas (máximo 150 × 200 mm, dos decimales) y entre 1 y ${MAX_QUANTITY} unidades.`);
  const area = width * height;
  const unit = calculateBoardUnitCents(width, height);
  const base = unit * quantity;
  return { category, area, unit, base };
}

/** ¿El pedido alcanza el umbral propio de envío económico gratis (no es una tarifa de transportista)? */
export function qualifiesForFreeStandardShipping(baseCents: number, quantity: number) {
  return baseCents >= 10000 || quantity >= 20;
}

/**
 * Calcula el total de un pedido. `shippingCents` y `shippingPromoEligible` llegan ya
 * resueltos desde `src/lib/shipping` (tarifa real de transportista para el destino
 * indicado), nunca de una tabla fija: por eso el envío varía según dónde entregues.
 */
export function calculateQuote(width: number, height: number, quantity: number, params: { rewardCode?: string; shippingCents: number; shippingPromoEligible: boolean }) {
  const { category, area, unit, base } = calculateBoardPrice(width, height, quantity);
  if (!Number.isFinite(params.shippingCents) || params.shippingCents < 0) throw new Error("El precio de envío no es válido.");
  const hasFreeStandard = qualifiesForFreeStandardShipping(base, quantity);
  let shipping = params.shippingCents;
  if (params.shippingPromoEligible && hasFreeStandard) shipping = 0;
  let discount = 0;
  if (params.rewardCode) {
    const reward = REWARDS.find((item) => item.code === params.rewardCode);
    if (!reward) throw new Error("Este cupón no es válido.");
    if (reward.shipping) {
      if (shipping === 0) throw new Error("El cupón de envío no se aplica cuando este envío ya es gratuito.");
      discount = shipping;
    } else {
      if (reward.category !== category) throw new Error("El cupón no corresponde al tamaño de esta placa.");
      discount = Math.round(unit * (reward.percent || 0) / 100);
    }
  }
  return { category, area, unit, base, shipping, discount, total: base + shipping - discount, hasFreeStandard };
}

export function euros(cents: number) { return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(cents / 100); }
