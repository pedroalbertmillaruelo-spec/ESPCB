import { GerberValidationError } from "@/lib/gerber/errors";
import { MAX_GERBER_BYTES } from "@/lib/gerber/layers";
const MAX_UPLOAD_BYTES = MAX_GERBER_BYTES;
import { allowRequest, clientKey, retryAfterSeconds } from "@/lib/gerber/rate-limit";
import type { GerberValidationResponse } from "@/lib/gerber/types";
import { validateGerberZip } from "@/lib/gerber/validator";

export async function POST(request: Request): Promise<Response> {
  const ip = clientKey(request);
  if (!allowRequest(ip)) {
    const retry = retryAfterSeconds(ip);
    const body: GerberValidationResponse = {
      ok: false,
      error: {
        code: "RATE_LIMITED",
        message: `Demasiadas peticiones desde tu conexión. Por favor espera ${retry} segundos antes de volver a intentarlo.`,
        details: { retryAfterSeconds: retry },
      },
    };
    return Response.json(body, {
      status: 429,
      headers: { "Retry-After": String(retry) },
    });
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let fileBuffer: Uint8Array | null = null;
    let fileName = "gerber.zip";

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("gerber") ?? form.get("file");
      if (!(file instanceof File)) {
        throw new GerberValidationError(
          "FILE_MISSING",
          "No se ha encontrado ningún archivo en la petición. Adjunta un archivo .zip en el campo 'gerber'.",
        );
      }
      if (!file.name.toLowerCase().endsWith(".zip")) {
        throw new GerberValidationError(
          "INVALID_EXTENSION",
          "El archivo debe tener extensión .zip. Comprime tus Gerber en un único archivo .zip.",
        );
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new GerberValidationError(
          "FILE_TOO_LARGE",
          `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y supera el máximo permitido de ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
        );
      }
      fileName = file.name;
      fileBuffer = new Uint8Array(await file.arrayBuffer());
    } else {
      const raw = await request.arrayBuffer();
      if (!raw || raw.byteLength === 0) {
        throw new GerberValidationError("FILE_MISSING", "El cuerpo de la petición está vacío.");
      }
      if (raw.byteLength > MAX_UPLOAD_BYTES) {
        throw new GerberValidationError(
          "FILE_TOO_LARGE",
          `El archivo supera el máximo permitido de ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`,
        );
      }
      fileBuffer = new Uint8Array(raw);
    }

    const result = validateGerberZip(fileBuffer, fileName);
    return Response.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof GerberValidationError) {
      const body: GerberValidationResponse = {
        ok: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
        },
      };
      return Response.json(body, { status: error.httpStatus });
    }

    const body: GerberValidationResponse = {
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Se ha producido un error al validar los Gerber. Si el problema continúa, contacta con nuestro taller.",
      },
    };
    return Response.json(body, { status: 500 });
  }
}
