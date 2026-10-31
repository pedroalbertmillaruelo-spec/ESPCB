/**
 * Límites técnicos del taller y límites de seguridad del endpoint.
 *
 * Este archivo NO importa nada de Node: lo usan tanto el servidor (validador)
 * como el cliente (textos del modal y pre-comprobaciones). Solo lee variables
 * de entorno, que en el navegador únicamente existen con prefijo NEXT_PUBLIC_.
 */

// ── Límites técnicos de fabricación ────────────────────────────────────────
/** Lado mayor máximo de la placa (mm). La placa puede girarse 90°. */
export const MAX_LONG_SIDE_MM = 200;
/** Lado menor máximo de la placa (mm). */
export const MAX_SHORT_SIDE_MM = 150;
/** Holgura de redondeo al comparar con el máximo (p. ej. 200.02 mm sigue valiendo). */
export const DIMENSION_TOLERANCE_MM = 0.05;
/** Precisión máxima del proceso (ancho de pista / separación mínima). */
export const PROCESS_PRECISION_MM = 0.1;
/** Valor mínimo recomendado para configurar el DRC en el software CAD. */
export const RECOMMENDED_DRC_MM = 0.12;
/** Menor lado admisible: 1 mm. El mínimo económico es 5 € por placa. */
export const MIN_BILLABLE_SIDE_MM = 1;
/** Por debajo de este lado se considera que el contorno no es válido (línea suelta, unidades erróneas…). */
export const MIN_PLAUSIBLE_SIDE_MM = 1;

// ── Tarifa ─────────────────────────────────────────────────────────────────
/** La tarifa por superficie se calcula con `calculateBoardUnitCents` (src/lib/pricing.ts). */

// ── Límites de seguridad del endpoint ──────────────────────────────────────
/**
 * Next.js solo incrusta `NEXT_PUBLIC_*` en el navegador si se accede con la propiedad ESTÁTICA
 * `process.env.NEXT_PUBLIC_...` (no con `process.env[name]`). Por eso los valores públicos
 * se leen literalmente aquí; las variables privadas solo se consultan en servidor.
 */
const PUBLIC_GERBER_MB = process.env.NEXT_PUBLIC_GERBER_MAX_MB;
const PUBLIC_IMAGE_MB = process.env.NEXT_PUBLIC_GALLERY_IMAGE_MAX_MB;
const PRIVATE_GERBER_MB = typeof window === "undefined" ? process.env.GERBER_MAX_UPLOAD_MB : undefined;
const PRIVATE_IMAGE_MB = typeof window === "undefined" ? process.env.GALLERY_IMAGE_MAX_MB : undefined;

function envMb(values: Array<string | undefined>, dflt: number, min: number, max: number): number {
  for (const raw of values) {
    if (raw === undefined || raw.trim() === "") continue;
    const v = Number(raw);
    if (Number.isFinite(v)) return Math.min(max, Math.max(min, Math.round(v)));
  }
  return dflt;
}

/**
 * Tamaño máximo del .zip subido. Vercel Functions limita la petición a 4,5 MB;
 * 2 MB de Gerbers y 1 MB de portada dejan margen para los campos del formulario.
 */
export const MAX_UPLOAD_BYTES =
  envMb([PUBLIC_GERBER_MB, PRIVATE_GERBER_MB], 2, 1, 2) * 1024 * 1024;
/** Nº máximo de entradas en el zip (defensa frente a zips "bomba"). */
export const MAX_ZIP_ENTRIES = 400;
/** Tamaño máximo (descomprimido) de un único archivo candidato a contorno. */
export const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
/** Presupuesto total de bytes descomprimidos por petición. */
export const MAX_TOTAL_EXTRACTED_BYTES = 24 * 1024 * 1024;
/** Peticiones por IP y ventana (rate limit en memoria). */
export const RATE_LIMIT_MAX_REQUESTS = 40;
export const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

// ── Límites de las subidas de la galería y del pedido ──────────────────────
/** Imagen de portada (png / jpg / webp); máximo 1 MB. */
export const MAX_IMAGE_BYTES =
  envMb([PUBLIC_IMAGE_MB, PRIVATE_IMAGE_MB], 1, 1, 1) * 1024 * 1024;
/** Cuerpo máximo al publicar un diseño: Gerber + portada + datos. */
export const MAX_PUBLISH_BODY_BYTES = MAX_UPLOAD_BYTES + MAX_IMAGE_BYTES + 512 * 1024;
/** Cuerpo máximo de una solicitud de pedido: Gerber + datos del cliente. */
export const MAX_QUOTE_BODY_BYTES = MAX_UPLOAD_BYTES + 256 * 1024;
/** Cuerpo máximo de las peticiones JSON normales. */
export const MAX_JSON_BYTES = 256 * 1024;
