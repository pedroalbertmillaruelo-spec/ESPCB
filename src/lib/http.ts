export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
  try { if (new URL(origin).host !== host) throw new Error("Origen no permitido."); }
  catch { throw new Error("Origen no permitido."); }
}
export function checkBodySize(request: Request) {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 4.5 * 1024 * 1024) throw new Error("La solicitud supera el límite permitido de 4,5 MB.");
}

/**
 * ¿El error proviene de PostgreSQL (esquema desactualizado, permisos/RLS o conexión)?
 * Drizzle envuelve el fallo del driver: el mensaje incluye la SQL y sus parámetros,
 * con datos personales y archivos del cliente. Ese detalle va a los logs, nunca al navegador.
 */
export function isDatabaseError(error: unknown): boolean {
  for (let current: unknown = error, depth = 0; current && depth < 5; current = (current as { cause?: unknown }).cause, depth++) {
    const candidate = current as { code?: unknown; message?: unknown };
    const code = typeof candidate.code === "string" ? candidate.code : "";
    // SQLSTATE de PostgreSQL: 42703 columna inexistente, 42P01 tabla inexistente, 42501 permisos/RLS…
    if (/^[0-9A-Z]{5}$/.test(code)) return true;
    const text = typeof candidate.message === "string" ? candidate.message : "";
    if (/^Failed query:/i.test(text) || /row-level security|does not exist|connection terminated|ECONNREFUSED|ETIMEDOUT|self-signed|certificate/i.test(text)) return true;
  }
  return false;
}

/** Motivo estable para logs y diagnósticos, sin datos de clientes. */
export function databaseFailureHint(error: unknown): string {
  for (let current: unknown = error, depth = 0; current && depth < 5; current = (current as { cause?: unknown }).cause, depth++) {
    const code = (current as { code?: unknown }).code;
    if (code === "42703") return "Falta una columna: la base necesita la actualización de esquema.";
    if (code === "42P01") return "Falta una tabla: la base necesita la actualización de esquema.";
    if (code === "42501") return "Permisos insuficientes o RLS sin políticas para el rol de conexión.";
    if (code === "42804" || code === "22P02") return "Tipo de columna incompatible: aplica la actualización de esquema.";
  }
  return "Fallo de base de datos no clasificado.";
}

const DATABASE_CLIENT_MESSAGE = "No se ha podido completar la operación en este momento. El equipo ya puede revisar el registro técnico; inténtalo de nuevo o escribe a espcb.soportecnico@gmail.com.";

/**
 * Mensaje seguro para el cliente. Los errores de validación se muestran tal cual;
 * los de base de datos se registran en el servidor (Vercel Logs) y se sustituyen
 * por un aviso neutro para no exponer SQL, datos personales ni archivos subidos.
 */
export function message(error: unknown, fallback = "No se ha podido completar la operación.") {
  if (isDatabaseError(error)) {
    console.error("[db] Operación fallida:", databaseFailureHint(error), error);
    return DATABASE_CLIENT_MESSAGE;
  }
  return error instanceof Error ? error.message : fallback;
}
