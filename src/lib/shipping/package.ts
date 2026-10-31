import type { PackageInfo } from "./types";

/** FR4 estándar: densidad ≈ 1,85 g/cm³ = 0,00185 g/mm³; espesor de fabricación habitual 1,6 mm. */
const FR4_DENSITY_G_PER_MM3 = 0.00185;
const BOARD_THICKNESS_MM = 1.6;

/**
 * Estima el peso y las dimensiones del paquete a partir de la placa y la cantidad.
 * Es una aproximación razonable (no la pesada real del almacén) que se usa únicamente
 * para solicitar tarifas de transportista; no se presenta como una medición exacta.
 */
export function estimatePackage(widthMm: number, heightMm: number, quantity: number): PackageInfo {
  const boardGrams = widthMm * heightMm * BOARD_THICKNESS_MM * FR4_DENSITY_G_PER_MM3;
  const boardsGrams = boardGrams * quantity;
  // Sobre acolchado para pedidos pequeños; caja de cartón para los más grandes.
  const packagingGrams = quantity <= 10 ? 35 : quantity <= 50 ? 90 : 180;
  const grams = Math.max(10, Math.ceil(boardsGrams + packagingGrams));

  const longSideMm = Math.max(widthMm, heightMm);
  const shortSideMm = Math.min(widthMm, heightMm);
  const lengthCm = Math.max(16, Math.ceil((longSideMm + 40) / 10));
  const widthCm = Math.max(12, Math.ceil((shortSideMm + 40) / 10));
  const heightCm = Math.max(1, Math.ceil((quantity * (BOARD_THICKNESS_MM + 0.3) + 15) / 10));

  // Fórmula de peso volumétrico publicada por Correos: largo×ancho×alto(cm) / 6.000 = kg.
  const volumetricGrams = Math.round((lengthCm * widthCm * heightCm * 1000) / 6000);
  const chargeableGrams = Math.max(grams, volumetricGrams);
  return { grams, volumetricGrams, chargeableGrams, lengthCm, widthCm, heightCm };
}
