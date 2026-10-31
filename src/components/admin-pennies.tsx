"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Coins, Sparkles, X } from "lucide-react";

type Award = {
  id: string; amount: number; description: string; createdAt: string;
  designerName: string; designerEmail: string; orderNumber: string | null;
  buyerEmail: string | null; width: number | null; height: number | null; quantity: number | null;
};

/**
 * Cola de concesiones de Pennies pendientes de revisión. Ninguna concesión se abona al
 * saldo del diseñador hasta que se aprueba aquí: ese es el único control, sin topes.
 */
export function AdminPennies({ token }: { token: string }) {
  const [awards, setAwards] = useState<Award[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState(""); const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/pennies", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setAwards(data.awards); setTotal(data.totalPending);
    } catch (e) { setError(e instanceof Error ? e.message : "No se han podido cargar las concesiones."); }
  }, [token]);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/pennies", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
      .then((data) => { if (active) { setAwards(data.awards); setTotal(data.totalPending); } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "No se han podido cargar las concesiones."); });
    return () => { active = false; };
  }, [token]);

  async function review(awardId: string, action: "approve" | "reject") {
    let note = "";
    if (action === "reject") {
      note = window.prompt("Motivo del rechazo (obligatorio):") || "";
      if (!note.trim()) return;
    }
    setBusy(true); setError(""); setInfo("");
    try {
      const response = await fetch("/api/admin/pennies", {
        method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ awardId, action, note }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setInfo(action === "approve" ? `Concesión aprobada: +${data.amount ?? 0} Pennies abonados.` : "Concesión rechazada. No se han abonado Pennies.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "No se ha podido revisar."); }
    finally { setBusy(false); }
  }

  async function approveAll() {
    if (!window.confirm(`¿Aprobar las ${awards.length} concesiones pendientes (${total} Pennies)?`)) return;
    setBusy(true); setError(""); setInfo("");
    try {
      const response = await fetch("/api/admin/pennies", {
        method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve_all" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setInfo(`Aprobadas ${data.approved} concesiones: ${data.amount} Pennies abonados.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "No se han podido aprobar."); }
    finally { setBusy(false); }
  }

  return <section className="admin-pennies">
    <div className="admin-pennies-heading"><Sparkles size={22}/><div><h2>Pennies pendientes de revisión</h2><p>Sin topes ni límites: cada fabricación de un diseño suma su importe completo. Nada se abona al diseñador hasta que lo apruebes aquí.</p></div></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {info && <p className="success-message">{info}</p>}
    <div className="admin-pennies-summary">
      <span><strong>{awards.length}</strong> concesiones pendientes</span>
      <span><Coins size={15}/> <strong>{total}</strong> Pennies por revisar</span>
      {awards.length > 0 && <button className="btn btn-outline" onClick={() => void approveAll()} disabled={busy}><Check size={15}/> Aprobar todas</button>}
    </div>
    {awards.length === 0 ? <p className="admin-pennies-empty">No hay concesiones pendientes. Cuando marques un pedido de la galería como pagado, aparecerá aquí para revisarlo.</p> : <div className="admin-award-list">{awards.map((award) => <article key={award.id}>
      <div>
        <strong>+{award.amount} Pennies</strong>
        <p>{award.description}</p>
        <small>{award.designerName} · {award.designerEmail}{award.orderNumber ? ` · pedido ${award.orderNumber}` : ""}</small>
        {award.buyerEmail && <small>Comprador: {award.buyerEmail}{award.width && award.height ? ` · ${award.width} × ${award.height} mm × ${award.quantity}` : ""}</small>}
        <small>{new Date(award.createdAt).toLocaleString("es-ES")}</small>
      </div>
      <div className="admin-award-actions">
        <button onClick={() => void review(award.id, "approve")} disabled={busy}><Check size={14}/> Aprobar y abonar</button>
        <button className="reject" onClick={() => void review(award.id, "reject")} disabled={busy}><X size={14}/> Rechazar</button>
      </div>
    </article>)}</div>}
  </section>;
}
