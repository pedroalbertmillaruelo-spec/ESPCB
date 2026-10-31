import { isAdmin } from "@/lib/admin";
import { inspectSchema, suggestedSql } from "@/lib/db/diagnostics";

export const dynamic = "force-dynamic";

/** Detalle del esquema para el administrador: qué falta y qué SQL lo resuelve. */
export async function GET(request: Request) {
  if (!isAdmin(request)) return Response.json({ error: "No autorizado." }, { status: 401 });
  const report = await inspectSchema();
  return Response.json({ ...report, suggestedSql: suggestedSql(report) }, { headers: { "Cache-Control": "no-store" } });
}
