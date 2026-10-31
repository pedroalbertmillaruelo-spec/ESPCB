"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Flag } from "lucide-react";
import { PrivacyNotice } from "./privacy-notice";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site";

export function ContentReportForm({ initialProjectId }: { initialProjectId: string }) {
  const projectId = initialProjectId;
  const [location, setLocation] = useState(projectId ? `/galeria?proyecto=${encodeURIComponent(projectId)}` : "");
  const [error, setError] = useState(""); const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ reportNumber: string; receiptSent: boolean; emailProvided: boolean } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setSending(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ projectId, location, reason: form.get("reason"), reporterName: form.get("reporterName"), reporterEmail: form.get("reporterEmail"), goodFaith: form.get("goodFaith") === "true" }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setResult({ reportNumber: data.reportNumber, receiptSent: data.receiptSent, emailProvided: !!form.get("reporterEmail") });
    } catch (e) { setError(e instanceof Error ? e.message : "No se ha podido registrar el aviso."); }
    finally { setSending(false); }
  }
  return <section className="report-page"><div className="container report-container"><Link className="back-link" href="/galeria"><ArrowLeft size={16}/> Volver a la galería</Link><p className="eyebrow"><span/> COMUNIDAD RESPONSABLE</p><h1>Notificar contenido<span className="heading-dot">.</span></h1><p className="report-intro">Si consideras que un diseño o archivo es ilícito o vulnera derechos, cuéntanos dónde está y por qué. Cualquier persona puede enviar un aviso; no necesitas una cuenta.</p><div className="report-card">{result ? <div className="report-success"><Check size={22}/><h2>Aviso registrado.</h2><p>Hemos guardado tu aviso <strong>{result.reportNumber}</strong>. Lo revisaremos de forma diligente.</p>{result.emailProvided && (result.receiptSent ? <p>Se ha enviado un acuse a tu correo.</p> : <p>El acuse automático no se ha enviado. Para solicitar confirmación, escribe a <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a> indicando la referencia.</p>)}<Link className="text-link" href="/galeria">Volver a la galería <ArrowRight size={15}/></Link></div> : <><h2>Cuéntanos qué sucede.</h2><p>Indica la ubicación exacta y aporta una explicación suficiente. No incluyas datos sensibles innecesarios.</p><form className="form-stack" onSubmit={submit}><label>Ubicación del contenido<input name="location" required minLength={5} maxLength={1000} value={location} onChange={(event) => setLocation(event.target.value)} placeholder="URL del proyecto o descripción de su ubicación"/></label><label>Motivo del aviso<textarea name="reason" required minLength={20} maxLength={3000} rows={5} placeholder="Explica qué contenido notificas y por qué consideras que es ilícito o infringe derechos."/></label><div className="form-two"><label>Nombre <span>(opcional)</span><input name="reporterName" maxLength={100} autoComplete="name" placeholder="Tu nombre"/></label><label>Correo electrónico <span>(opcional)</span><input name="reporterEmail" type="email" maxLength={254} autoComplete="email" placeholder="tu@correo.com"/></label></div><p className="report-form-help">El nombre y el correo son opcionales. Si facilitas correo, podremos enviarte un acuse y la decisión. También puedes escribir directamente a <a className="privacy-link" href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a>.</p><PrivacyNotice purpose="report"/><label className="legal-check"><input name="goodFaith" value="true" type="checkbox" required/><span>Declaro de buena fe que la información y los hechos incluidos en el aviso son precisos y completos a mi leal saber y entender.</span></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="btn btn-primary full" disabled={sending}><Flag size={16}/>{sending ? "Registrando aviso..." : "Enviar aviso"}<ArrowRight size={16}/></button></form></>}</div></div></section>;
}
