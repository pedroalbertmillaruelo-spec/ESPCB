/**
 * Parser mínimo de Gerber RS-274X orientado a UNA sola tarea: obtener la
 * bounding box del contorno de la placa (capa Edge.Cuts / GKO / GM1 / Profile).
 *
 * No es un renderizador. Solo interpreta lo necesario para acotar la geometría:
 *
 *  - %FSLAX..Y..*%            formato de coordenadas (ceros omitidos, nº de dígitos)
 *  - %MOMM*% / %MOIN*%        unidades (y las legacy G71 / G70)
 *  - %ADDnn<C|R|O>,..*%       aperturas (solo para informar del ancho de línea)
 *  - Dnn (>=10)               selección de apertura  (también la forma legacy G54Dnn)
 *  - D01 / D02 / D03          dibujar / mover / flash (con modo modal)
 *  - G01 / G02 / G03          interpolación lineal / arco horario / antihorario
 *  - G74 / G75                arco de cuadrante simple / múltiple
 *  - X.. Y.. I.. J..          coordenadas (modales) y centro del arco
 *
 * Para los arcos NO basta con los puntos inicial y final: si el arco pasa por
 * un extremo de la circunferencia (0°, 90°, 180°, 270°) la caja crece. Se
 * calculan esos extremos explícitamente.
 *
 * Convención de medida: se usa la LÍNEA CENTRAL del trazo (no se suma el ancho
 * de la apertura), que es la ruta real de corte/fresado del contorno.
 */

import { GerberValidationError } from "./errors";

const MM_PER_INCH = 25.4;
const TWO_PI = Math.PI * 2;
const EPS = 1e-9;

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface OutlineGeometry {
  unit: "mm" | "in";
  /** Bounding box ya convertida a milímetros. */
  bboxMm: BoundingBox;
  widthMm: number;
  heightMm: number;
  lineWidthMm: number | null;
  drawCount: number;
  warnings: string[];
}

interface CoordFormat {
  /** "L" = ceros iniciales omitidos (estándar). "T" = ceros finales omitidos (legacy). */
  zeros: "L" | "T";
  xInt: number;
  xDec: number;
  yInt: number;
  yDec: number;
}

/** Acumulador de caja delimitadora. */
class Box {
  minX = Infinity;
  minY = Infinity;
  maxX = -Infinity;
  maxY = -Infinity;

  add(x: number, y: number): void {
    if (x < this.minX) this.minX = x;
    if (x > this.maxX) this.maxX = x;
    if (y < this.minY) this.minY = y;
    if (y > this.maxY) this.maxY = y;
  }

  get isEmpty(): boolean {
    return this.minX > this.maxX || this.minY > this.maxY;
  }
}

// ── Expresiones regulares (compiladas una sola vez) ───────────────────────
/** Bloques extendidos: %....% (pueden contener varios comandos separados por '*'). */
const EXTENDED_BLOCK = /%([^%]*)%/g;
/** %FSLAX46Y46  /  %FSTAX24Y24  → ceros, A/I, dígitos X e Y. */
const RE_FORMAT = /^FS([LTD]?)([AI]?).*?X(\d)(\d)Y(\d)(\d)/;
/** %MOMM  /  %MOIN */
const RE_UNITS = /^MO(MM|IN)/;
/** %ADD10C,0.1  /  %ADD11R,0.5X0.3 */
const RE_APERTURE = /^ADD(\d+)([A-Za-z_][\w.]*)(?:,(.*))?$/;
/** Tokens de un bloque de datos: letra + número (G01X100Y-200I50J0D01). */
const RE_TOKEN = /([GDMXYIJ])([+-]?\d*\.?\d+)/g;

export function parseGerberOutline(source: string): OutlineGeometry {
  const text = source.replace(/\r/g, "");
  const warnings: string[] = [];

  // 1) Separar comandos extendidos (%...%) de los bloques de datos.
  const extended: string[] = [];
  const body = text.replace(EXTENDED_BLOCK, (_m, inner: string) => {
    extended.push(inner);
    return "\n";
  });

  // 2) Leer formato, unidades y aperturas del encabezado.
  let format: CoordFormat | null = null;
  let unit: "mm" | "in" = "mm";
  const apertureWidth = new Map<number, number>();

  for (const block of extended) {
    for (const rawCmd of block.split("*")) {
      const cmd = rawCmd.trim();
      if (!cmd) continue;

      const fs = RE_FORMAT.exec(cmd);
      if (fs) {
        if (fs[2] === "I") {
          throw new GerberValidationError(
            "OUTLINE_UNREADABLE",
            "El archivo de contorno usa coordenadas incrementales, que no están soportadas. Expórtalo con coordenadas absolutas.",
          );
        }
        format = {
          zeros: fs[1] === "T" ? "T" : "L",
          xInt: Number(fs[3]),
          xDec: Number(fs[4]),
          yInt: Number(fs[5]),
          yDec: Number(fs[6]),
        };
        continue;
      }

      const mo = RE_UNITS.exec(cmd);
      if (mo) {
        unit = mo[1] === "MM" ? "mm" : "in";
        continue;
      }

      const ad = RE_APERTURE.exec(cmd);
      if (ad) {
        const width = apertureDimension(ad[2], ad[3]);
        if (width !== null) apertureWidth.set(Number(ad[1]), width);
      }
    }
  }

  /** Convierte "-0012345" (o "12.5") al valor numérico real según el formato FS. */
  const readCoord = (raw: string, axis: "x" | "y"): number => {
    if (raw.includes(".")) return parseFloat(raw); // coordenada con punto decimal explícito
    if (!format) {
      throw new GerberValidationError(
        "OUTLINE_UNREADABLE",
        "El archivo de contorno no declara el formato de coordenadas (%FS...%), por lo que no se puede interpretar.",
      );
    }
    const negative = raw.startsWith("-");
    let digits = raw.replace(/^[+-]/, "");
    const intDigits = axis === "x" ? format.xInt : format.yInt;
    const decDigits = axis === "x" ? format.xDec : format.yDec;
    // Ceros finales omitidos: hay que rellenar por la derecha hasta int+dec dígitos.
    if (format.zeros === "T") digits = digits.padEnd(intDigits + decDigits, "0");
    const value = parseInt(digits, 10) / 10 ** decDigits;
    return negative ? -value : value;
  };

  // 3) Recorrer los bloques de datos.
  const drawn = new Box();
  const flashed = new Box();

  let x = 0;
  let y = 0;
  let havePoint = false;
  let mode: 1 | 2 | 3 = 1; // G01 / G02 / G03
  let singleQuadrant = false; // G74 (true) / G75 (false)
  let lastOp: 1 | 2 | 3 | null = null;
  let currentWidth: number | null = null;
  let maxWidth = 0;
  let drawCount = 0;
  let finished = false;

  for (const rawBlock of body.split("*")) {
    if (finished) break;
    const block = rawBlock.replace(/\s+/g, "");
    if (!block || block.startsWith("G04")) continue; // vacío o comentario

    let nx = x;
    let ny = y;
    let i = 0;
    let j = 0;
    let hasCoord = false;
    let op: number | null = null;

    for (const m of block.matchAll(RE_TOKEN)) {
      const value = m[2];
      switch (m[1]) {
        case "G": {
          const g = parseInt(value, 10);
          if (g === 1) mode = 1;
          else if (g === 2) mode = 2;
          else if (g === 3) mode = 3;
          else if (g === 70) unit = "in";
          else if (g === 71) unit = "mm";
          else if (g === 74) singleQuadrant = true;
          else if (g === 75) singleQuadrant = false;
          else if (g === 91) {
            throw new GerberValidationError(
              "OUTLINE_UNREADABLE",
              "El archivo de contorno usa coordenadas incrementales (G91), que no están soportadas.",
            );
          }
          break;
        }
        case "X":
          nx = readCoord(value, "x");
          hasCoord = true;
          break;
        case "Y":
          ny = readCoord(value, "y");
          hasCoord = true;
          break;
        case "I":
          i = readCoord(value, "x");
          break;
        case "J":
          j = readCoord(value, "y");
          break;
        case "D": {
          const d = parseInt(value, 10);
          if (d >= 10) currentWidth = apertureWidth.get(d) ?? null; // selección de apertura
          else op = d;
          break;
        }
        case "M": {
          const mcode = parseInt(value, 10);
          if (mcode === 0 || mcode === 2) finished = true; // fin de programa
          break;
        }
      }
    }

    if (!hasCoord) continue; // bloque solo de modos / aperturas

    // D omitido en la línea → se hereda la última operación (comportamiento modal legacy).
    const effectiveOp = (op ?? lastOp) as 1 | 2 | 3 | null;
    if (op === 1 || op === 2 || op === 3) lastOp = op;

    if (effectiveOp === 2) {
      // Mover sin dibujar
      havePoint = true;
    } else if (effectiveOp === 3) {
      // Flash: se guarda aparte; solo se usará si el archivo no tiene trazos
      flashed.add(nx, ny);
      havePoint = true;
    } else if (effectiveOp === 1) {
      // Dibujar
      if (mode === 1) {
        if (havePoint) drawn.add(x, y);
        drawn.add(nx, ny);
      } else if (havePoint) {
        for (const [px, py] of arcPoints(x, y, nx, ny, i, j, mode === 2, singleQuadrant)) {
          drawn.add(px, py);
        }
      } else {
        drawn.add(nx, ny);
      }
      drawCount += 1;
      if (currentWidth !== null && currentWidth > maxWidth) maxWidth = currentWidth;
      havePoint = true;
    }

    x = nx;
    y = ny;
  }

  // 4) Resultado.
  let box = drawn;
  if (drawn.isEmpty && !flashed.isEmpty) {
    box = flashed;
    warnings.push("El contorno no contiene trazos; las medidas se han calculado a partir de flashes.");
  }
  if (box.isEmpty) {
    throw new GerberValidationError(
      "OUTLINE_INVALID",
      "No se ha encontrado geometría de contorno en el archivo (sin trazos D01 ni flashes D03).",
    );
  }

  const k = unit === "in" ? MM_PER_INCH : 1;
  const bboxMm: BoundingBox = {
    minX: box.minX * k,
    minY: box.minY * k,
    maxX: box.maxX * k,
    maxY: box.maxY * k,
  };
  const widthMm = bboxMm.maxX - bboxMm.minX;
  const heightMm = bboxMm.maxY - bboxMm.minY;

  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm)) {
    throw new GerberValidationError("OUTLINE_UNREADABLE", "No se han podido calcular las dimensiones del contorno.");
  }

  return {
    unit,
    bboxMm,
    widthMm,
    heightMm,
    lineWidthMm: maxWidth > 0 ? maxWidth * k : null,
    drawCount,
    warnings,
  };
}

/** Diámetro/lado menor de una apertura estándar (C, R, O). Otras formas → null. */
function apertureDimension(shape: string, params: string | undefined): number | null {
  if (!params) return null;
  const nums = params
    .split(/x/i)
    .map((p) => parseFloat(p))
    .filter((n) => Number.isFinite(n));
  if (nums.length === 0) return null;
  if (shape === "C") return nums[0];
  if (shape === "R" || shape === "O") return Math.min(nums[0], nums[1] ?? nums[0]);
  return null;
}

const normalizeAngle = (a: number): number => ((a % TWO_PI) + TWO_PI) % TWO_PI;

/**
 * Puntos que definen la caja de un arco: inicio, fin y los extremos de la
 * circunferencia (0°, 90°, 180°, 270°) que caigan dentro del barrido.
 */
function arcPoints(
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  i: number,
  j: number,
  clockwise: boolean,
  singleQuadrant: boolean,
): Array<[number, number]> {
  const points: Array<[number, number]> = [
    [sx, sy],
    [ex, ey],
  ];
  const coincident = Math.hypot(ex - sx, ey - sy) < EPS;

  let cx = sx + i;
  let cy = sy + j;

  if (singleQuadrant) {
    // G74: I/J van sin signo. Se prueba cada combinación de signos y se
    // elige el centro equidistante del inicio y del fin.
    if (coincident) return points;
    const radius = Math.hypot(i, j);
    const tolerance = Math.max(1e-6, radius * 1e-3);
    let found = false;
    for (const si of [1, -1]) {
      for (const sj of [1, -1]) {
        if (found) continue;
        const candX = sx + si * i;
        const candY = sy + sj * j;
        if (Math.abs(Math.hypot(ex - candX, ey - candY) - radius) <= tolerance) {
          cx = candX;
          cy = candY;
          found = true;
        }
      }
    }
    if (!found) return points; // no se pudo determinar el centro: se acota por los extremos
  }

  const radius = Math.hypot(sx - cx, sy - cy);
  if (radius <= EPS) return points;

  const a0 = Math.atan2(sy - cy, sx - cx);
  const a1 = Math.atan2(ey - cy, ex - cx);
  // Barrido angular en el sentido del arco. Inicio == fin en G75 → circunferencia completa.
  let sweep = clockwise ? normalizeAngle(a0 - a1) : normalizeAngle(a1 - a0);
  if (coincident) sweep = TWO_PI;

  for (const theta of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const d = clockwise ? normalizeAngle(a0 - theta) : normalizeAngle(theta - a0);
    if (d <= sweep + EPS) {
      points.push([cx + radius * Math.cos(theta), cy + radius * Math.sin(theta)]);
    }
  }
  return points;
}
