import { inspectSchema, publicReason } from "@/lib/db/diagnostics";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico público: solo indica si la base conectada está lista.
 * El detalle (tablas, columnas y SQL sugerido) está en /api/admin/db con ADMIN_API_TOKEN.
 */
export async function GET() {
  const report = await inspectSchema();
  const reason = publicReason(report);
  if (report.ok) {
    return Response.json({ ok: true, database: "connected", schema: "installed", reason }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({ ok: false, database: reason === "database_unreachable" ? "unreachable" : "connected", schema: reason === "database_unreachable" ? "unknown" : "outdated", reason }, {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}
