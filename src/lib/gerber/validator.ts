/**
 * Validador de archivos Gerber (.zip) para el taller.
 *
 * Flujo:
 *   1. Comprueba que los bytes son realmente un zip.
 *   2. Localiza la capa de contorno (Edge.Cuts / GKO / GM1 / Profile).
 *   3. Calcula la bounding box con `parseGerberOutline`.
 *   4. Rechaza si excede 200 × 150 mm (en cualquier orientación).
 *   5. Detecta las CARAS (capas de cobre superior/inferior) y los AGUJEROS (taladros Excellon).
 *   6. Devuelve medidas, área en mm², caras, agujeros y precio unitario (tarifa por superficie).
 *
 * Es una función pura y síncrona (entrada: bytes; salida: resultado o
 * `GerberValidationError`); no toca disco ni red, por lo que es trivial de testear.
 */

import { createHash } from "node:crypto";
import { GerberValidationError } from "./errors";
import {
  DIMENSION_TOLERANCE_MM,
  MAX_LONG_SIDE_MM,
  MAX_SHORT_SIDE_MM,
  MIN_BILLABLE_SIDE_MM,
  MIN_PLAUSIBLE_SIDE_MM,
} from "./limits";
import { calculateBoardUnitCents } from "@/lib/pricing";
import { detectFaces, detectHoles } from "./layers";
import { parseGerberOutline, type OutlineGeometry } from "./parser";
import { looksLikeZip, readZipEntries, type ZipTextEntry } from "./zip-reader";
import type { GerberValidationSuccess } from "./types";

// ── Detección del archivo de contorno ─────────────────────────────────────
/** Extensiones inequívocas de contorno (Protel/Altium/Eagle/EasyEDA…). */
const STRONG_EXT = /\.(gko|gml|profile|oln|outline)$/i;
/** GM1 es la capa mecánica 1: por convención, el contorno en Altium/Protel. */
const GM1_EXT = /\.gm1$/i;
/** Otras capas mecánicas (GM2…GM99): candidatas de baja prioridad. */
const MECH_EXT = /\.gm\d{1,2}$/i;
/** Nombres típicos (KiCad: "-Edge_Cuts.gbr", EasyEDA: "BoardOutlineLayer"…). */
const OUTLINE_NAME = /(edge[\s_.-]?cuts|board[\s_.-]?outline|outline|profile|contorno)/i;
/** Extensiones genéricas de Gerber (se inspeccionan por cabecera X2 si no hay candidatos). */
const GENERIC_GERBER_EXT = /\.(gbr|ger|gbx|art|pho)$/i;

/** Atributo X2 estándar: %TF.FileFunction,Profile,NP*% */
const RE_FILE_FUNCTION = /%TF\.FileFunction,([A-Za-z-]+)/i;

interface Candidate {
  entry: ZipTextEntry;
  score: number;
}

const isOutlineCandidateName = (name: string): boolean =>
  STRONG_EXT.test(name) || MECH_EXT.test(name) || OUTLINE_NAME.test(name);

/**
 * Puntúa un archivo como contorno. Devuelve -1 si el atributo X2 dice
 * explícitamente que NO es un contorno (p. ej. una capa de cobre llamada "outline_copper").
 */
function scoreCandidate(entry: ZipTextEntry): number {
  const fn = RE_FILE_FUNCTION.exec(entry.text.slice(0, 4096))?.[1]?.toLowerCase();
  if (fn === "profile") return 100;
  if (fn && fn !== "other" && fn !== "mechanical") return -1;

  if (STRONG_EXT.test(entry.name)) return 90;
  if (GM1_EXT.test(entry.name)) return 80;
  if (OUTLINE_NAME.test(entry.name)) return 70;
  if (MECH_EXT.test(entry.name)) return 40;
  return 0;
}

function findOutlineCandidates(zip: Uint8Array): Candidate[] {
  // Pasada 1: solo archivos cuyo nombre sugiere "contorno".
  let candidates = readZipEntries(zip, isOutlineCandidateName)
    .map((entry) => ({ entry, score: scoreCandidate(entry) }))
    .filter((c) => c.score > 0);

  // Pasada 2 (fallback): .gbr/.ger genéricos con atributo X2 "Profile" en la cabecera.
  if (candidates.length === 0) {
    candidates = readZipEntries(zip, (n) => GENERIC_GERBER_EXT.test(n))
      .map((entry) => ({ entry, score: scoreCandidate(entry) }))
      .filter((c) => c.score >= 100);
  }

  return candidates.sort((a, b) => b.score - a.score);
}

const round = (value: number, decimals = 2): number => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

/**
 * Valida un .zip de Gerbers. Lanza `GerberValidationError` con un código
 * estable si algo impide aceptar el archivo.
 */
export function validateGerberZip(zip: Uint8Array, originalName: string): GerberValidationSuccess {
  if (!looksLikeZip(zip)) {
    throw new GerberValidationError("NOT_A_ZIP", "El archivo no es un .zip válido. Comprime tus Gerber en un único .zip.");
  }

  const candidates = findOutlineCandidates(zip);
  if (candidates.length === 0) {
    throw new GerberValidationError(
      "OUTLINE_NOT_FOUND",
      "No se ha encontrado la capa de contorno de la placa en el .zip. Incluye el archivo de perfil (.GKO, .GM1, .GML, *-Edge_Cuts.gbr o equivalente) y vuelve a subirlo.",
    );
  }

  // Se prueba cada candidato por orden de prioridad hasta que uno se pueda interpretar.
  let geometry: OutlineGeometry | null = null;
  let chosen: Candidate | null = null;
  let lastError: GerberValidationError | null = null;
  for (const candidate of candidates) {
    try {
      geometry = parseGerberOutline(candidate.entry.text);
      chosen = candidate;
      break;
    } catch (error) {
      if (error instanceof GerberValidationError) lastError = error;
      else throw error;
    }
  }
  if (!geometry || !chosen) {
    throw (
      lastError ??
      new GerberValidationError("OUTLINE_UNREADABLE", "No se ha podido interpretar el archivo de contorno.")
    );
  }

  // ── Comprobaciones de dimensiones ───────────────────────────────────────
  const shortSide = Math.min(geometry.widthMm, geometry.heightMm);
  const longSide = Math.max(geometry.widthMm, geometry.heightMm);

  if (shortSide < MIN_PLAUSIBLE_SIDE_MM) {
    throw new GerberValidationError(
      "OUTLINE_INVALID",
      "El contorno detectado no tiene dimensiones válidas (línea suelta o unidades incorrectas). Revisa que la capa de contorno forme un perímetro cerrado.",
      { measuredWidthMm: round(geometry.widthMm), measuredHeightMm: round(geometry.heightMm), outlineFile: chosen.entry.name },
    );
  }

  if (shortSide > MAX_SHORT_SIDE_MM + DIMENSION_TOLERANCE_MM || longSide > MAX_LONG_SIDE_MM + DIMENSION_TOLERANCE_MM) {
    throw new GerberValidationError(
      "BOARD_TOO_LARGE",
      `La placa mide ${round(longSide, 1)} × ${round(shortSide, 1)} mm y supera el máximo de ${MAX_LONG_SIDE_MM} × ${MAX_SHORT_SIDE_MM} mm de nuestro taller. Reduce el tamaño del diseño y vuelve a subirlo.`,
      {
        measuredWidthMm: round(geometry.widthMm),
        measuredHeightMm: round(geometry.heightMm),
        shortSideMm: round(shortSide),
        longSideMm: round(longSide),
        maxLongSideMm: MAX_LONG_SIDE_MM,
        maxShortSideMm: MAX_SHORT_SIDE_MM,
        outlineFile: chosen.entry.name,
      },
    );
  }

  // ── Caras de cobre y agujeros (vías) ─────────────────────────────────────
  // Se hace DESPUÉS de validar el contorno: si el .zip no es válido no se pierde tiempo aquí.
  const faces = detectFaces(zip);
  const holes = detectHoles(zip);

  // ── Cotización ──────────────────────────────────────────────────────────
  const widthMm = round(geometry.widthMm);
  const heightMm = round(geometry.heightMm);
  const areaMm2 = round(widthMm * heightMm);

  // El cotizador trabaja con lado menor = ancho (≤150) y lado mayor = largo (≤200).
  const billableWidth = Math.min(MAX_SHORT_SIDE_MM, Math.max(MIN_BILLABLE_SIDE_MM, round(shortSide)));
  const billableHeight = Math.min(MAX_LONG_SIDE_MM, Math.max(MIN_BILLABLE_SIDE_MM, round(longSide)));
  const billableArea = round(billableWidth * billableHeight, 4);

  return {
    ok: true,
    file: {
      name: originalName.slice(0, 160),
      sizeBytes: zip.byteLength,
      sha256: createHash("sha256").update(zip).digest("hex"),
    },
    outline: {
      fileName: chosen.entry.name,
      unit: geometry.unit,
      lineWidthMm: geometry.lineWidthMm !== null ? round(geometry.lineWidthMm, 3) : null,
      drawCount: geometry.drawCount,
      warnings: geometry.warnings,
    },
    board: {
      widthMm,
      heightMm,
      shortSideMm: round(shortSide),
      longSideMm: round(longSide),
      areaMm2,
    },
    quote: {
      baseAreaMm2: 2500,
      maxAreaMm2: 30000,
      maxUnitPrice: 40,
      billableWidthMm: billableWidth,
      billableHeightMm: billableHeight,
      billableAreaMm2: billableArea,
      unitPrice: calculateBoardUnitCents(billableWidth, billableHeight) / 100,
    },
    faces,
    holes,
    limits: { maxLongSideMm: MAX_LONG_SIDE_MM, maxShortSideMm: MAX_SHORT_SIDE_MM },
  };
}
