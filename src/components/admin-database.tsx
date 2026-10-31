"use client";
import { useState } from "react";
import { Database, TriangleAlert } from "lucide-react";

type Issue =
  | { kind: "missing_table"; table: string }
  | { kind: "missing_column"; table: string; column: string; type: string }
  | { kind: "wrong_type"; table: string; column: string; expected: string; found: string };
type Report = {
  ok: boolean; issues: Issue[]; suggestedSql: string;
  connection: { reachable: boolean; role: string | null; bypassRls: boolean | null };
  rlsBlockedTables: string[];
};

/** Diagnóstico del esquema conectado: explica por qué fallan los pedidos y cómo resolverlo. */
export function AdminDatabase({ token }: { token: string }) {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function inspect() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/admin/db", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se ha podido inspeccionar la base de datos.");
      setReport(data);
    } catch (e) { setError(e instanceof Error ? e.message : "No se ha podido inspeccionar la base de datos."); }
    finally { setLoading(false); }
  }
  return <section className="admin-database"><h2><Database size={19}/> Estado de la base de datos</h2><p>Comprueba que la base conectada en Vercel tiene el esquema completo. Si faltan tablas o columnas, los pedidos y las publicaciones fallan.</p>
    <button className="btn btn-outline" onClick={() => void inspect()} disabled={loading}>{loading ? "Inspeccionando..." : "Inspeccionar esquema"}</button>
    {error && <p className="form-error">{error}</p>}
    {report && (report.ok
      ? <p className="database-ok">Esquema correcto. Rol de conexión: <strong>{report.connection.role}</strong>.</p>
      : <div className="database-issues"><p className="database-alert"><TriangleAlert size={16}/> {report.connection.reachable ? "La base responde, pero el esquema no coincide con el que espera la aplicación." : "No se ha podido conectar con la base de datos. Revisa la URL pooled y los permisos en Vercel."}</p>
        {!report.connection.reachable && <p>Comprueba <code>DATABASE_URL_POOLED</code>, <code>DATABASE_URL</code> o <code>POSTGRES_URL</code> en Settings → Environment Variables y vuelve a desplegar.</p>}
        {report.issues.length > 0 && <ul>{report.issues.map((issue, index) => <li key={index}>{issue.kind === "missing_table" ? <>Falta la tabla <code>{issue.table}</code></> : issue.kind === "missing_column" ? <>Falta la columna <code>{issue.table}.{issue.column}</code></> : <>Tipo distinto en <code>{issue.table}.{issue.column}</code>: se espera {issue.expected}, hay {issue.found}</>}</li>)}</ul>}
        {report.rlsBlockedTables.length > 0 && <p>RLS bloquea la escritura en {report.rlsBlockedTables.map((table) => <code key={table}>{table}</code>)} para el rol <strong>{report.connection.role}</strong>. Crea políticas para ese rol o utiliza un rol propietario.</p>}
        <p><strong>Cómo resolverlo:</strong> ejecuta <code>sql/SCHEMA_ALL.sql</code> completo en el editor SQL de tu proveedor (no borra datos). Si prefieres aplicar solo lo que falta, usa este SQL generado:</p>
        <pre>{report.suggestedSql}</pre></div>)}
  </section>;
}
