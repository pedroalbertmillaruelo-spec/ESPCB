/**
 * Lectura segura de .zip EN MEMORIA (nunca se escribe nada en disco).
 *
 * Defensas:
 *  - Nº máximo de entradas (zip con miles de ficheros).
 *  - Tamaño máximo por entrada y presupuesto total descomprimido (zip "bomba").
 *    Se decide con el tamaño declarado en el directorio central ANTES de
 *    descomprimir y fflate no escribe más allá de ese tamaño declarado.
 *  - Solo se descomprimen las entradas que pide el `predicate`.
 *  - Los nombres se usan únicamente como etiqueta: se toma el nombre base, así
 *    que una ruta tipo "../../x" no tiene ningún efecto (no hay acceso a disco).
 */

import { strFromU8, unzipSync } from "fflate";
import { GerberValidationError } from "./errors";
import { MAX_ENTRY_BYTES, MAX_TOTAL_EXTRACTED_BYTES, MAX_ZIP_ENTRIES } from "./limits";

export interface ZipTextEntry {
  /** Nombre base del archivo (sin carpetas). */
  name: string;
  /** Contenido como texto (latin1: los Gerber son ASCII). */
  text: string;
}

/** Firma "PK" de un archivo zip (local file header, o directorio vacío / spanned). */
export function looksLikeZip(bytes: Uint8Array): boolean {
  return (
    bytes.length > 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
  );
}

const baseName = (path: string): string => path.split(/[\\/]/).pop() ?? path;

const isJunkEntry = (path: string): boolean =>
  path.startsWith("__MACOSX/") || baseName(path).startsWith("._") || path.endsWith("/");

/**
 * Descomprime únicamente las entradas cuyo nombre base cumpla `predicate`.
 */
export function readZipEntries(zip: Uint8Array, predicate: (baseName: string) => boolean): ZipTextEntry[] {
  let seen = 0;
  let budget = MAX_TOTAL_EXTRACTED_BYTES;

  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(zip, {
      filter(info) {
        seen += 1;
        if (seen > MAX_ZIP_ENTRIES) {
          throw new GerberValidationError(
            "ZIP_TOO_MANY_ENTRIES",
            `El .zip contiene demasiados archivos (máximo ${MAX_ZIP_ENTRIES}). Sube solo los Gerber y taladros.`,
          );
        }
        if (isJunkEntry(info.name) || !predicate(baseName(info.name))) return false;

        if (info.originalSize > MAX_ENTRY_BYTES) {
          throw new GerberValidationError(
            "ZIP_TOO_LARGE_UNCOMPRESSED",
            `El archivo "${baseName(info.name)}" es demasiado grande para analizarlo (máximo ${MAX_ENTRY_BYTES / 1024 / 1024} MB).`,
          );
        }
        budget -= info.originalSize;
        if (budget < 0) {
          throw new GerberValidationError(
            "ZIP_TOO_LARGE_UNCOMPRESSED",
            "El contenido descomprimido del .zip supera el límite permitido.",
          );
        }
        return true;
      },
    });
  } catch (error) {
    if (error instanceof GerberValidationError) throw error;
    throw new GerberValidationError(
      "ZIP_CORRUPT",
      "No se ha podido leer el .zip: está dañado, cifrado con contraseña o no es un zip válido.",
    );
  }

  return Object.entries(files).map(([path, data]) => ({
    name: baseName(path),
    text: strFromU8(data, true),
  }));
}
