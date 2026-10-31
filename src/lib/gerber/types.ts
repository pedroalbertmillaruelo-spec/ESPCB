/**
 * Contrato público (JSON) entre `POST /api/gerber/validate` y el frontend.
 * Sin imports de Node: seguro para importar desde componentes cliente.
 */

export type GerberErrorCode =
  | "FILE_MISSING"
  | "INVALID_EXTENSION"
  | "FILE_TOO_LARGE"
  | "NOT_A_ZIP"
  | "ZIP_CORRUPT"
  | "ZIP_TOO_MANY_ENTRIES"
  | "ZIP_TOO_LARGE_UNCOMPRESSED"
  | "OUTLINE_NOT_FOUND"
  | "OUTLINE_UNREADABLE"
  | "OUTLINE_INVALID"
  | "BOARD_TOO_LARGE"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "INTERNAL_ERROR";

/** Capas de cobre detectadas: 1 cara o doble cara. */
export interface FacesInfo {
  /** 1 = una sola cara · 2 = doble cara (incluye multicapa). */
  count: 1 | 2;
  /** false si no se ha podido leer ninguna capa de cobre (se asume doble cara). */
  detected: boolean;
  copperLayers: number;
  topFile: string | null;
  bottomFile: string | null;
  innerFiles: string[];
}

/** Agujeros (vías y taladros) detectados en los archivos Excellon. */
export interface HolesInfo {
  detected: boolean;
  total: number;
  plated: number;
  nonPlated: number;
  /** Diámetros distintos encontrados, en mm. */
  diametersMm: number[];
  files: string[];
}

export interface GerberValidationSuccess {
  ok: true;
  file: {
    name: string;
    sizeBytes: number;
    /** SHA-256 del .zip recibido (trazabilidad del pedido). */
    sha256: string;
  };
  outline: {
    /** Nombre del archivo del que se ha extraído el contorno. */
    fileName: string;
    unit: "mm" | "in";
    /** Ancho de la línea de contorno (apertura), si se pudo determinar. */
    lineWidthMm: number | null;
    /** Nº de trazos (D01) analizados. */
    drawCount: number;
    warnings: string[];
  };
  /** Medidas reales del contorno (bounding box, línea central), en mm. */
  board: {
    widthMm: number;
    heightMm: number;
    /** Lado menor / mayor, independientes de la orientación del diseño. */
    shortSideMm: number;
    longSideMm: number;
    areaMm2: number;
  };
  /** Datos para alimentar el cotizador (aplican el mínimo facturable por lado). */
  quote: {
    /** Superficie cubierta por el precio base (mm²). */
    baseAreaMm2: number;
    /** Superficie máxima fabricable (mm²) y precio máximo por placa (€). */
    maxAreaMm2: number;
    maxUnitPrice: number;
    billableWidthMm: number;
    billableHeightMm: number;
    billableAreaMm2: number;
    unitPrice: number;
  };
  /** Caras de la placa (detección de capas de cobre). */
  faces: FacesInfo;
  /** Agujeros/vías (detección de taladros Excellon). */
  holes: HolesInfo;
  limits: {
    maxLongSideMm: number;
    maxShortSideMm: number;
  };
}

export interface GerberValidationFailure {
  ok: false;
  error: {
    code: GerberErrorCode;
    /** Mensaje listo para mostrar al usuario (español). */
    message: string;
    details?: Record<string, unknown>;
  };
}

export type GerberValidationResponse = GerberValidationSuccess | GerberValidationFailure;
