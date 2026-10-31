"use client";
import { useCallback, useEffect, useState } from "react";
import { SUPPORT_EMAIL } from "@/lib/site";
type Report = { id: string; reportNumber: string; projectId: string | null; location: string; reason: string; reporterName: string | null; reporterEmail: string | null; status: string; decision: string | null; emailStatus: string; receiptStatus: string; decisionEmailStatus: string; createdAt: string };
export function AdminReports({ token }: { token: string }) {
  const [reports, setReports] = useState<Report[]>([]); const [error, setError] = useState(""); const [info, setInfo] = useState("");
  const load = useCallback(async () => { const response = await fetch("/api/admin/reports", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }); if (response.ok) { const data = await response.json(); setReports(data.reports); } else setError("No se han podido consultar los avisos."); }, [token]);
  useEffect(() => {
    let active = true;
    fetch("/api/admin/reports", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error("No se han podido consultar los avisos."); return response.json(); })
      .then((data) => { if (active) setReports(data.reports); })
      .catch(() => { if (active) setError("No se han podido consultar los avisos."); });
    return () => { active = false; };
  }, [token]);
  async function resolve(report: Report, hideProject: boolean) {
    const decision = window.prompt(hideProject ? "Explica la decisión de ocultar el proyecto:" : "Explica la decisión tras revisar el aviso:");
    if (!decision) return; setError(""); setInfo("");
    try {
      const response = await fetch("/api/admin/reports", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: report.id, decision, hideProject }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setInfo(data.needsManualContact ? `Decisión guardada. No se envió el correo: contacta manualmente a ${report.reporterEmail} desde ${SUPPORT_EMAIL}.` : "Decisión guardada.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "No se ha podido guardar la decisión."); }
  }
  async function markReceipt(report: Report) {
    if (!window.confirm("¿Confirmas que ya has enviado el acuse de recibo manualmente?")) return;
    setError("");
    try {
      const response = await fetch("/api/admin/reports", { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ id: report.id, markReceiptSent: true }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setInfo("Acuse manual registrado."); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "No se ha podido actualizar el acuse."); }
  }
  return <section className="admin-report-list"><h2>Avisos de contenido.</h2><p>Revísalos de forma diligente. Si el correo automático falla, envía el acuse y la decisión manualmente. Comunica también al autor las medidas que le afecten cuando corresponda.</p>{error && <p className="form-error">{error}</p>}{info && <p className="success-message">{info}</p>}{reports.length === 0 ? <p>No hay avisos registrados.</p> : reports.map((report) => <article key={report.id}><h3>{report.reportNumber} <span className={`status status-${report.status}`}>{report.status === "pending" ? "Pendiente" : "Resuelto"}</span></h3><p><strong>Ubicación:</strong> {report.location}<br/><strong>Motivo:</strong> {report.reason}</p><small>{new Date(report.createdAt).toLocaleString("es-ES")} · {report.reporterName || "Sin nombre"} · {report.reporterEmail || "Sin correo"}<br/>Correo al equipo: {report.emailStatus} · Acuse: {report.receiptStatus} · Decisión: {report.decisionEmailStatus}</small>{report.decision && <p><strong>Decisión:</strong> {report.decision}</p>}{report.reporterEmail && report.receiptStatus === "not_sent" && <div className="admin-report-actions"><a className="privacy-link" href={`mailto:${encodeURIComponent(report.reporterEmail)}?subject=${encodeURIComponent(`Acuse de tu aviso ${report.reportNumber}`)}&body=${encodeURIComponent(`Hemos recibido tu aviso ${report.reportNumber} y lo revisaremos.\n\nEquipo ESPCB`)}`}>Redactar acuse por correo</a><button onClick={() => void markReceipt(report)}>Marcar acuse enviado manualmente</button></div>}{report.status === "resolved" && report.reporterEmail && report.decisionEmailStatus === "not_sent" && <p><strong>Decisión sin enviar:</strong> comunícala manualmente a {report.reporterEmail}.</p>}{report.status === "pending" && <div className="admin-report-actions"><button onClick={() => void resolve(report, false)}>Resolver sin ocultar</button>{report.projectId && <button onClick={() => void resolve(report, true)}>Ocultar proyecto y resolver</button>}</div>}</article>)}</section>;
}
