import type { GerberErrorCode } from "./types";

/** Código HTTP asociado a cada error de validación. */
const HTTP_STATUS: Record<GerberErrorCode, number> = {
  FILE_MISSING: 400,
  INVALID_EXTENSION: 400,
  FILE_TOO_LARGE: 413,
  NOT_A_ZIP: 422,
  ZIP_CORRUPT: 422,
  ZIP_TOO_MANY_ENTRIES: 422,
  ZIP_TOO_LARGE_UNCOMPRESSED: 422,
  OUTLINE_NOT_FOUND: 422,
  OUTLINE_UNREADABLE: 422,
  OUTLINE_INVALID: 422,
  BOARD_TOO_LARGE: 422,
  RATE_LIMITED: 429,
  NETWORK_ERROR: 0, // solo cliente
  INTERNAL_ERROR: 500,
};

/**
 * Error "esperado" del validador: lleva un código estable, un mensaje apto
 * para el usuario y detalles estructurados. El route handler lo serializa tal cual.
 */
export class GerberValidationError extends Error {
  readonly code: GerberErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(code: GerberErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "GerberValidationError";
    this.code = code;
    this.details = details;
  }

  get httpStatus(): number {
    return HTTP_STATUS[this.code] || 422;
  }
}
