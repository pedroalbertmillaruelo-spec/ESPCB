/**
 * Detección de CARAS (capas de cobre) y de AGUJEROS (vías/taladros) dentro del .zip de Gerbers.
 *
 * · Caras: se buscan las capas de cobre superior e inferior por
 *     - atributo X2 estándar  %TF.FileFunction,Copper,L1,Top*%  /  ,L2,Bot
 *     - extensión/nombre (Protel .GTL/.GBL, KiCad *-F_Cu.gbr/-B_Cu.gbr, Eagle .cmp/.sol,
 *       EasyEDA TopLayer/BottomLayer, internas .g1/.g2 o *-In1_Cu.gbr)
 *   Las capas internas implican doble cara (multicapa).
 *
 * · Agujeros: se leen los taladros Excellon (.drl/.xln/.txt con cabecera M48): tabla de
 *   herramientas (T1C0.8) y coordenadas X/Y. Se distinguen metalizados (PTH) de no metalizados
 *   (NPTH) por el nombre del archivo y se listan los diámetros distintos en mm.
 *
 * Todo se hace EN MEMORIA y solo se descomprimen los archivos candidatos (ver zip-reader).
 * Si no se puede determinar algo, se informa como «no detectado» en lugar de inventarlo.
 */
import { readZipEntries } from "./zip-reader";
import type { FacesInfo, HolesInfo } from "./types";
import { MAX_IMAGE_BYTES, MAX_UPLOAD_BYTES } from "./limits";

export const MAX_GERBER_BYTES = MAX_UPLOAD_BYTES;
export { MAX_IMAGE_BYTES };

// ── Caras ───────────────────────────────────────────────────────────────────────────────
/** Atributo X2 de capa de cobre: %TF.FileFunction,Copper,L1,Top*% */
const RE_X2_COPPER = /%TF\.FileFunction,\s*Copper,\s*L(\d+),\s*(Top|Bot|Inr)/i;

/** Nombres que NO son cobre (máscara, serigrafía, pasta, contorno, mecánicas, documentación). */
const NO_COBRE =
  /(mask|solder|silk|screen|paste|stencil|edge|outline|profile|contour|mechanical|fab|assy|assembly|drawing|document|\.gko$|\.gml$|\.gm\d+$|\.gto$|\.gbo$|\.gts$|\.gbs$|\.gtp$|\.gbp$|\.drl$|\.xln$)/i;

/** ¿Merece la pena leer el archivo para decidir si es una capa de cobre? */
const ES_GERBER = /\.(gbr|ger|gbx|art|pho|gtl|gbl|g\d{1,2}|cmp|sol|top|bot|ly\d+|cu)$/i;

const PARECE_COBRE = /(top|bottom|bot|f[._]?cu|b[._]?cu|in\d+[._]?cu|\.gtl$|\.gbl$|\.g\d+$|\.cmp$|\.sol$)/i;

/** Posición de la capa según su nombre, cuando no hay atributo X2. */
function posicionPorNombre(name: string): "top" | "bottom" | "inner" | null {
  const n = name.toLowerCase();
  if (/\.gtl$|(^|[._-])f[._]?cu([._-]|$)|top[._-]?layer|(^|[._-])top([._-]|$)|\.cmp$/.test(n)) return "top";
  if (/\.gbl$|(^|[._-])b[._]?cu([._-]|$)|bottom[._-]?layer|(^|[._-])(bottom|bot)([._-]|$)|\.sol$/.test(n)) return "bottom";
  if (/\.g\d{1,2}$|(^|[._-])in\d+[._]?cu([._-]|$)/.test(n)) return "inner";
  return null;
}

/**
 * Detecta si la placa es de 1 o 2 caras a partir de las capas de cobre del .zip.
 * `detected: false` significa que no se ha podido leer ninguna capa de cobre (se asume doble cara
 * de forma conservadora y la interfaz lo indica).
 */
export function detectFaces(zip: Uint8Array): FacesInfo {
  const entries = readZipEntries(zip, (name) => ES_GERBER.test(name) || (PARECE_COBRE.test(name) && !/\.[a-z]{4}$/i.test(name)));

  let topFile: string | null = null;
  let bottomFile: string | null = null;
  const innerFiles: string[] = [];
  let copperLayers = 0;

  for (const entry of entries) {
    if (NO_COBRE.test(entry.name)) continue;
    if (entry.name.toLowerCase().endsWith(".zip")) continue;

    // 1) Atributo X2 (la fuente más fiable).
    const x2 = RE_X2_COPPER.exec(entry.text.slice(0, 4096));
    let role: "top" | "bottom" | "inner" | null = null;
    if (x2) {
      const side = x2[2].toLowerCase();
      role = side === "top" ? "top" : side === "bot" ? "bottom" : "inner";
    }
    // 2) Nombre del archivo.
    if (!role) role = posicionPorNombre(entry.name);
    if (!role) continue;

    copperLayers += 1;
    if (role === "top" && !topFile) topFile = entry.name;
    else if (role === "bottom" && !bottomFile) bottomFile = entry.name;
    else if (role === "inner") innerFiles.push(entry.name);
  }

  const detected = copperLayers > 0;
  // Una capa superior o inferior por sí sola es una cara. Capas internas o ambas caras son doble cara.
  const count: 1 | 2 = innerFiles.length > 0 || (topFile && bottomFile) ? 2 : (topFile || bottomFile) ? 1 : 2;

  return { count, detected, copperLayers, topFile, bottomFile, innerFiles: innerFiles.slice(0, 8) };
}

// ── Agujeros (taladros y vías) ──────────────────────────────────────────────────────────
const ES_TALADRO = /\.(drl|xln|drill|exc|nc|ncd|tap|txt)$/i;
const MAX_HITS = 50_000;

/**
 * Cuenta los agujeros leyendo los archivos Excellon del .zip.
 * Devuelve `detected: false` si no hay ningún archivo de taladros legible.
 */
export function detectHoles(zip: Uint8Array): HolesInfo {
  const entries = readZipEntries(zip, (name) => ES_TALADRO.test(name));

  let total = 0;
  let plated = 0;
  let nonPlated = 0;
  const diameters = new Set<number>();
  const files: string[] = [];

  for (const entry of entries) {
    const text = entry.text;
    // Cabecera Excellon: M48 (preamble), M71/M72 (unidades) o tabla de herramientas TnCd.
    if (!/M48|METRIC|INCH|^T\d+.*C[\d.]/im.test(text)) continue;

    const inches = /\bINCH\b|\bM72\b/i.test(text) && !/\bMETRIC\b|\bM71\b/i.test(text);
    const k = inches ? 25.4 : 1;

    // Tabla de herramientas → diámetros distintos.
    for (const tool of text.matchAll(/^\s*T(\d+)[^\n]*?C([\d.]+)/gim)) {
      const d = Number.parseFloat(tool[2]);
      if (Number.isFinite(d) && d > 0) diameters.add(Math.round(d * k * 1000) / 1000);
    }

    // Coordenadas de impacto. Se aceptan decimales o enteros con formato propio del CAD.
    let hits = 0;
    for (const line of text.split(/\r?\n/)) {
      const l = line.trim();
      if (!/^X[+-]?\d/.test(l)) continue;
      if (!/Y[+-]?\d/.test(l)) continue;
      hits += 1;
      if (hits >= MAX_HITS) break;
    }
    if (hits === 0) continue;

    const isNpth = /npth|non[-_. ]?plated/i.test(entry.name);
    total += hits;
    if (isNpth) nonPlated += hits;
    else plated += hits;
    files.push(entry.name);
  }

  return {
    detected: files.length > 0,
    total,
    plated,
    nonPlated,
    diametersMm: [...diameters].sort((a, b) => a - b).slice(0, 12),
    files: files.slice(0, 4),
  };
}

/** Texto corto y legible para la interfaz y el correo. */
export function resumenHuecos(holes: HolesInfo | null | undefined): string {
  if (!holes || !holes.detected || holes.total === 0) return "No se han detectado taladros en el .zip.";
  const platedTxt = holes.plated > 0 ? `${holes.plated} metalizados` : "ninguno metalizado";
  const npthTxt = holes.nonPlated > 0 ? ` · ${holes.nonPlated} no metalizados` : "";
  const medidas = holes.diametersMm.length
    ? ` · diámetros: ${holes.diametersMm.map((d) => `${d.toLocaleString("es-ES")} mm`).join(", ")}`
    : "";
  return `${holes.total} agujeros (${platedTxt}${npthTxt})${medidas}`;
}

export function imageMime(buffer: Uint8Array | Buffer): string | null {
  if (buffer.length > MAX_IMAGE_BYTES) return null;
  const b = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

export async function analyzeGerbers(buffer: Uint8Array | Buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const faces = detectFaces(bytes);
  const holes = detectHoles(bytes);
  return {
    layers: faces.count,
    holes: holes.total,
    files: faces.copperLayers,
    faces,
    holesInfo: holes,
  };
}
