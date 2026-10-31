"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertCircle, ArrowRight, Check, CheckCircle2, ChevronDown, FileArchive, Info, LockKeyhole, Package, ShieldCheck, Truck, UploadCloud, X } from "lucide-react";
import { useAuth } from "./providers";
import { PrivacyNotice } from "./privacy-notice";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site";
import { AVISO_DOBLE_CARA_ECO, ETIQUETA_ACEPTAR_CONDICIONES, MENSAJE_DOBLE_CARA_REMACHADORA, MENSAJE_UNA_CARA, requiereAceptacionDobleCara, tiene_remachadora } from "@/lib/pcb/features";
import { resumenHuecos } from "@/lib/gerber/summary";
import type { HolesInfo } from "@/lib/gerber/types";
import { BASE_AREA_MM2, calculateBoardPrice, calculateQuote, euros, MAX_BOARD_AREA_MM2, MAX_QUANTITY, REWARDS } from "@/lib/pricing";
import { COUNTRIES, OTHER_COUNTRY_VALUE } from "@/lib/shipping/countries";
import type { ShippingOption } from "@/lib/shipping/types";
import type { GalleryProject } from "@/lib/gallery";

type Analysis = { layers: number; holes: number; holesInfo?: HolesInfo; facesDetected?: boolean };
type Coupon = { id: string; code: string; rewardCode: string; status: string };
const SOURCE_LABEL: Record<string, string> = { api: "tiempo real", tariff: "tarifa oficial", manual: "a confirmar" };

export function QuoteCalculator() {
  const { user } = useAuth();
  const [width, setWidth] = useState("50"); const [height, setHeight] = useState("50");
  const [quantity, setQuantity] = useState("5"); const [customQuantity, setCustomQuantity] = useState(false);
  const [country, setCountry] = useState("ES"); const [customCountry, setCustomCountry] = useState("");
  const [postalCode, setPostalCode] = useState(""); const [city, setCity] = useState("");
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [shippingSelected, setShippingSelected] = useState("");
  const [shippingLoading, setShippingLoading] = useState(false);
  const [shippingError, setShippingError] = useState("");
  const [shippingWarnings, setShippingWarnings] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null); const [project, setProject] = useState<GalleryProject | null>(null);
  const [measurementsVerified, setMeasurementsVerified] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null); const [accepted, setAccepted] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false); const [checkout, setCheckout] = useState(false);
  const [loading, setLoading] = useState(false); const [sending, setSending] = useState(false);
  const [error, setError] = useState(""); const [checkoutError, setCheckoutError] = useState("");
  const [coupons, setCoupons] = useState<Coupon[]>([]); const [couponId, setCouponId] = useState("");
  const [result, setResult] = useState<{ orderNumber: string; emailSent: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedCoupon = coupons.find((coupon) => coupon.id === couponId);
  const effectiveCountry = country === OTHER_COUNTRY_VALUE ? customCountry.trim().toUpperCase() : country;
  const selectedOption = shippingOptions.find((option) => option.code === shippingSelected);

  let boardQuote: ReturnType<typeof calculateBoardPrice> | null = null; let boardError = "";
  try { boardQuote = calculateBoardPrice(Number(width), Number(height), Number(quantity)); } catch (e) { boardError = e instanceof Error ? e.message : "Comprueba las medidas y la cantidad."; }
  let quote: ReturnType<typeof calculateQuote> | null = null; let quoteError = boardError;
  if (boardQuote && selectedOption) {
    try { quote = calculateQuote(Number(width), Number(height), Number(quantity), { rewardCode: selectedCoupon?.rewardCode, shippingCents: selectedOption.cents, shippingPromoEligible: selectedOption.promoEligible }); }
    catch (e) { quoteError = e instanceof Error ? e.message : "No se ha podido calcular el envío."; }
  } else if (!boardError) quoteError = "Indica tu país y código postal para calcular el envío.";

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("proyecto");
    if (!id) return;
    fetch(`/api/projects/${encodeURIComponent(id)}`).then(async (response) => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const item = data.project as GalleryProject;
      if (item.layers > 2) throw new Error("Actualmente fabricamos placas de una o dos caras. Puedes descargar los Gerbers del proyecto multicapa.");
      setProject(item); setWidth(String(item.width)); setHeight(String(item.height)); setAnalysis({ layers: item.layers, holes: item.holes });
      if (requiereAceptacionDobleCara(item.layers)) setTermsOpen(true);
    }).catch((e) => setError(e instanceof Error ? e.message : "Proyecto no disponible."));
  }, []);

  // Tarifas reales de transportista para el destino indicado (Correos oficial en España; DHL si está configurado).
  useEffect(() => {
    const validDestination = Boolean(boardQuote) && /^[A-Z]{2}$/.test(effectiveCountry) && postalCode.trim().length >= 3;
    let active = true;
    // Sin destino válido no se consulta nada. Todo cambio de estado se hace de forma
    // asíncrona (dentro del temporizador) para no provocar renders en cascada.
    const timeout = setTimeout(() => {
      if (!active) return;
      if (!validDestination) {
        setShippingOptions([]); setShippingSelected(""); setShippingWarnings([]); setShippingLoading(false); return;
      }
      setShippingLoading(true); setShippingError("");
      fetch("/api/shipping/rates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ country: effectiveCountry, postalCode, city, width, height, quantity }) })
        .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; })
        .then((data: { options: ShippingOption[]; warnings: string[] }) => {
          if (!active) return;
          setShippingOptions(data.options); setShippingWarnings(data.warnings || []);
          setShippingSelected((current) => data.options.some((option) => option.code === current) ? current : (data.options[0]?.code || ""));
        })
        .catch((e) => { if (active) { setShippingError(e instanceof Error ? e.message : "No se ha podido calcular el envío."); setShippingOptions([]); setShippingSelected(""); } })
        .finally(() => { if (active) setShippingLoading(false); });
    }, validDestination ? 450 : 250);
    return () => { active = false; clearTimeout(timeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveCountry, postalCode, city, width, height, quantity]);

  async function analyzeFile(chosen: File) {
    setError(""); setFile(null); setAnalysis(null); setAccepted(false); setProject(null); setMeasurementsVerified(false); setLoading(true);
    try {
      if (chosen.size > 2 * 1024 * 1024 || !chosen.name.toLowerCase().endsWith(".zip")) throw new Error("Selecciona un archivo ZIP de hasta 2 MB.");
      const form = new FormData(); form.append("gerber", chosen);
      const valRes = await fetch("/api/gerber/validate", { method: "POST", body: form }); const valData = await valRes.json();
      if (valRes.ok && valData.ok) {
        if (valData.faces.innerFiles.length) throw new Error("Por ahora fabricamos placas de 1 o 2 caras; el ZIP contiene capas internas.");
        setFile(chosen); setWidth(String(Math.min(150, valData.board.shortSideMm))); setHeight(String(Math.min(200, valData.board.longSideMm))); setMeasurementsVerified(true);
        setAnalysis({ layers: valData.faces.count, holes: valData.holes.total, holesInfo: valData.holes, facesDetected: valData.faces.detected });
        if (requiereAceptacionDobleCara(valData.faces.count)) setTermsOpen(true);
        return;
      }
      if (valData.error?.code !== "OUTLINE_NOT_FOUND") throw new Error(valData.error?.message || "No se ha podido validar el ZIP.");
      const response = await fetch("/api/analyze", { method: "POST", body: form }); const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.faces?.innerFiles?.length) throw new Error("Por ahora fabricamos placas de 1 o 2 caras; el ZIP contiene capas internas.");
      setFile(chosen); setAnalysis({ layers: data.layers, holes: data.holes, holesInfo: data.holesInfo, facesDetected: data.faces?.detected });
      if (requiereAceptacionDobleCara(data.layers)) setTermsOpen(true);
    } catch (e) { setError(e instanceof Error ? e.message : "No se ha podido analizar el archivo."); if (inputRef.current) inputRef.current.value = ""; }
    finally { setLoading(false); }
  }
  function selectFile(event: ChangeEvent<HTMLInputElement>) { const chosen = event.target.files?.[0]; if (chosen) void analyzeFile(chosen); }
  function continueOrder() {
    setError("");
    if (!quote) { setError(quoteError); return; }
    if (!analysis || (!file && !project)) { setError("Primero sube tu archivo Gerber en formato ZIP."); inputRef.current?.click(); return; }
    if (requiereAceptacionDobleCara(analysis.layers) && !accepted) { setTermsOpen(true); return; }
    setCheckoutError(""); setCheckout(true);
    if (user) fetch("/api/pennies").then((r) => r.ok ? r.json() : null).then((data) => setCoupons((data?.coupons || []).filter((item: Coupon) => item.status === "available"))).catch(() => setCoupons([]));
    else { setCoupons([]); setCouponId(""); }
  }
  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setCheckoutError(""); if (!quote || !selectedOption) { setCheckoutError(quoteError || "Elige una modalidad de envío."); return; }
    setSending(true); const form = new FormData(event.currentTarget);
    form.set("width", width); form.set("height", height); form.set("quantity", quantity);
    form.set("shippingCountry", effectiveCountry); form.set("shippingPostalCode", postalCode); form.set("shippingCity", city);
    form.set("shippingOptionCode", selectedOption.code);
    form.set("twoSidedAccepted", String(accepted));
    if (project) form.set("projectId", project.id); else if (file) form.set("gerber", file);
    if (couponId) form.set("couponId", couponId);
    try {
      const response = await fetch("/api/orders", { method: "POST", body: form }); const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCheckout(false); setResult(data); setCouponId("");
    } catch (e) { setCheckoutError(e instanceof Error ? e.message : "No se ha podido enviar la solicitud."); }
    finally { setSending(false); }
  }
  const resetProject = () => { setProject(null); setFile(null); setAnalysis(null); setAccepted(false); setMeasurementsVerified(false); setError(""); if (inputRef.current) inputRef.current.value = ""; };
  const holesSummary = analysis?.holesInfo ? resumenHuecos(analysis.holesInfo) : analysis && analysis.holes > 0 ? `${analysis.holes} agujeros/vías detectados` : "Sin taladros detectados";
  return <section className="quote-section" id="cotizador"><div className="container">
    <div className="section-heading quote-heading"><div><p className="eyebrow"><span/> EMPIEZA A CREAR</p><h2>Tu PCB, sin complicaciones<span className="heading-dot">.</span></h2></div><p>Unos pocos detalles y estarás un paso más cerca<br/>de tener tu idea entre las manos.</p></div>
    <div className="quote-layout"><div className="quote-form-card"><div className="card-title-row"><div><span className="mini-number">01</span><h3>Cuéntanos cómo es tu placa</h3></div><span className="card-helper">FÁCIL, ¿VERDAD?</span></div>
      <div className="quote-fields"><div className="field-group"><label>Medidas de la placa <span>en milímetros</span></label><div className="dimensions"><div className="input-unit"><input type="number" aria-label="Ancho de la placa en milímetros" min="1" max="200" step="0.01" value={width} disabled={!!project || measurementsVerified} onChange={(e) => setWidth(e.target.value)}/><span>mm</span></div><span className="dimension-x">×</span><div className="input-unit"><input type="number" aria-label="Alto de la placa en milímetros" min="1" max="200" step="0.01" value={height} disabled={!!project || measurementsVerified} onChange={(e) => setHeight(e.target.value)}/><span>mm</span></div></div><small>{measurementsVerified ? "Medidas verificadas del contorno Gerber." : project ? "Medidas del proyecto publicado." : "Hasta 150 × 200 mm. Admite dos decimales."}</small></div><div className="field-group"><label>¿Cuántas necesitas? <span>unidades</span></label><div className="quantity-options">{[1, 5, 10, 20].map((n) => <button key={n} className={!customQuantity && Number(quantity) === n ? "selected" : ""} onClick={() => { setCustomQuantity(false); setQuantity(String(n)); }} type="button">{n}</button>)}<button type="button" className={`quantity-custom-button ${customQuantity ? "selected" : ""}`} onClick={() => setCustomQuantity(true)}>Personalizada</button></div>{customQuantity && <label className="custom-quantity">Cantidad personalizada<input type="number" min="1" max={MAX_QUANTITY} step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} aria-label="Cantidad personalizada de placas"/></label>}<small>Elige desde 1 hasta {MAX_QUANTITY} placas.</small></div></div>
      <fieldset className="shipping-fieldset"><legend>¿A dónde lo enviamos? <span>· precios reales según destino</span></legend>
        <div className="destination-fields"><label>País<div className="select-wrap"><select value={country} onChange={(e) => setCountry(e.target.value)}>{COUNTRIES.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}<option value={OTHER_COUNTRY_VALUE}>Otro país…</option></select><ChevronDown size={15}/></div></label>{country === OTHER_COUNTRY_VALUE && <label>Código de país <span>(ISO, p. ej. JP)</span><input value={customCountry} maxLength={2} onChange={(e) => setCustomCountry(e.target.value.toUpperCase())} placeholder="JP"/></label>}<label>Código postal<input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} maxLength={10} placeholder="28001" inputMode="text"/></label><label>Localidad <span>(opcional)</span><input value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} placeholder="Madrid"/></label></div>
        {shippingLoading && <p className="shipping-loading">Consultando tarifas reales para tu destino...</p>}
        {shippingError && <p className="form-error">{shippingError}</p>}
        {!shippingLoading && !shippingError && shippingOptions.length > 0 && <div className="shipping-options">{shippingOptions.map((option) => <label key={option.code} className={`shipping-option ${shippingSelected === option.code ? "selected" : ""}`}><input type="radio" name="shipping" value={option.code} checked={shippingSelected === option.code} onChange={() => setShippingSelected(option.code)}/><span className="shipping-icon"><Truck size={18}/></span><span className="shipping-label"><strong>{option.label}</strong><small>{option.etaDays === "a confirmar" ? "Plazo a confirmar" : `${option.etaDays} días`} · {SOURCE_LABEL[option.source]}</small></span><span className="shipping-price">{option.source === "manual" ? "A confirmar" : option.promoEligible && quote?.hasFreeStandard ? <><s>{euros(option.cents)}</s> Gratis</> : euros(option.cents)}</span></label>)}</div>}
        {shippingWarnings.map((warning) => <p key={warning} className="shipping-hint">{warning}</p>)}
        <p className="shipping-hint">Precio real de Correos (tarifa oficial) o DHL (tiempo real, si está disponible) según el destino. Envío económico gratis desde 100 € o 20 placas.</p>
      </fieldset>
      <div className="upload-heading"><div><label>Tu archivo Gerber</label><small>Un ZIP con las capas de tu diseño</small></div><span>MAX. 2 MB</span></div><input ref={inputRef} type="file" accept=".zip,application/zip" hidden onChange={selectFile}/>
      {project ? <div className="file-selected"><span className="file-icon"><Package size={21}/></span><div><strong>{project.title}</strong><small>Diseño de la Galería PCB · {project.width} × {project.height} mm</small></div><button onClick={resetProject} aria-label="Quitar proyecto"><X size={17}/></button></div> : file ? <div className="file-selected"><span className="file-icon"><FileArchive size={21}/></span><div><strong>{file.name}</strong><small>Archivo listo para tu proyecto</small></div><button onClick={resetProject} aria-label="Quitar archivo"><X size={17}/></button></div> : <button type="button" className="upload-zone" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const dropped = event.dataTransfer.files[0]; if (dropped) void analyzeFile(dropped); }}><span className="upload-icon"><UploadCloud size={22}/></span><span><strong>{loading ? "Analizando tu archivo..." : "Haz clic para subir tu archivo"}</strong><small>o arrastra tu ZIP aquí · Gerber hasta 2 MB</small></span><span className="upload-arrow">↗</span></button>}
      {analysis && <div className={`analysis-message ${requiereAceptacionDobleCara(analysis.layers) && !accepted ? "warning" : ""}`}><CheckCircle2 size={17}/><div><strong>{analysis.facesDetected === false ? "Caras no detectadas; se asumen 2" : `${analysis.layers} ${analysis.layers === 1 ? "cara de cobre detectada" : "caras de cobre detectadas"}`} · {holesSummary}</strong><span>{analysis.layers === 1 ? MENSAJE_UNA_CARA : tiene_remachadora ? MENSAJE_DOBLE_CARA_REMACHADORA : accepted ? "Condiciones del prototipo eco aceptadas. Conexión manual entre caras." : AVISO_DOBLE_CARA_ECO}</span></div>{requiereAceptacionDobleCara(analysis.layers) && <button type="button" onClick={() => setTermsOpen(true)}>{accepted ? "Ver aviso" : "Aceptar"}</button>}</div>}
      {error && <p className="form-error quote-error" role="alert"><AlertCircle size={16}/> {error}</p>}
    </div><aside className="quote-summary"><div className="summary-top"><div><p>TU PRESUPUESTO</p><h3>Una idea más cerca.</h3></div><span className="summary-icon"><Package size={21}/></span></div><div className="summary-rule"/>
      <div className="summary-calculation"><span>SUPERFICIE DE TU PLACA</span><strong>{boardQuote ? boardQuote.area.toLocaleString("es-ES", { maximumFractionDigits: 4 }) : "—"} <small>mm²</small></strong><p>{width || "–"} × {height || "–"} mm · tarifa por superficie</p></div>
      <div className="summary-line"><span>Precio por placa <small>{boardQuote ? boardQuote.area <= BASE_AREA_MM2 ? "Precio base de 5,00 € (hasta 2.500 mm²)" : boardQuote.area >= MAX_BOARD_AREA_MM2 ? "Precio máximo de 40,00 €" : "Tarifa amortiguada por superficie" : "Precio base 5,00 €"}</small></span><strong>{boardQuote ? euros(boardQuote.unit) : "—"}</strong></div><div className="summary-line"><span>Placas <small>{quantity || "–"} {Number(quantity) === 1 ? "unidad" : "unidades"}</small></span><strong>{boardQuote ? euros(boardQuote.base) : "—"}</strong></div><div className="summary-line"><span>Envío {selectedOption ? selectedOption.label.toLowerCase() : ""} <small>{selectedOption ? `${selectedOption.etaDays === "a confirmar" ? "Plazo a confirmar" : `${selectedOption.etaDays} días`}` : "Indica tu destino"}</small></span><strong>{!selectedOption ? "—" : selectedOption.source === "manual" ? "Pendiente" : quote ? quote.shipping ? euros(quote.shipping) : "Gratis" : "—"}</strong></div>{selectedOption?.source === "manual" && <p className="shipping-hint">El coste de envío se confirmará contigo antes de fabricar; no se ha incluido en el total.</p>}{quote && quote.discount > 0 && <div className="summary-line"><span>Descuento</span><strong>−{euros(quote.discount)}</strong></div>}<div className="summary-rule"/><div className="summary-total"><div><span>Tu total estimado</span><small>IVA incluido</small></div><strong>{quote ? euros(quote.total) : "—"}</strong></div><button className="btn btn-yellow full" onClick={continueOrder}>Continuar con mi pedido <ArrowRight size={18}/></button><div className="summary-assurance"><LockKeyhole size={15}/><span>Sin pago ahora. Revisamos tu proyecto contigo.</span></div><div className="summary-bottom"><ShieldCheck size={18}/><span>Hecho cerca, pensado para durar.</span></div></aside></div>
    <p className="quote-note"><Info size={15}/> 5 € por placa hasta 2.500 mm² y subida amortiguada hasta 40 € en 150 × 200 mm. El envío se calcula con precios reales según tu destino. Precio orientativo.</p>
  </div>
  {termsOpen && <div className="modal-backdrop" onMouseDown={() => setTermsOpen(false)}><div className="modal terms-modal" role="dialog" aria-modal="true" aria-labelledby="terms-title" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setTermsOpen(false)} aria-label="Cerrar"><X size={20}/></button><div className="modal-alert-icon"><AlertCircle size={24}/></div><p className="eyebrow">IMPORTANTE ANTES DE CONTINUAR</p><h2 id="terms-title">Tu placa tiene dos caras.</h2><div className="terms-box"><p>{AVISO_DOBLE_CARA_ECO}</p><p>Taladros y vías: <strong>{holesSummary}</strong>.</p></div><button className="btn btn-primary full" onClick={() => { setAccepted(true); setTermsOpen(false); }}>{ETIQUETA_ACEPTAR_CONDICIONES} <Check size={18}/></button><button className="text-button centered" onClick={() => setTermsOpen(false)}>Volver a mi proyecto</button></div></div>}
  {checkout && <div className="modal-backdrop" onMouseDown={() => setCheckout(false)}><div className="modal checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setCheckout(false)} aria-label="Cerrar"><X size={20}/></button><p className="eyebrow">YA CASI ESTÁ</p><h2 id="checkout-title">Hablemos de tu idea.</h2><p className="modal-intro">Déjanos tus datos y revisaremos tu solicitud. No se realizará ningún cobro ahora.</p><form className="form-stack" onSubmit={submitOrder}><div className="form-two"><label>Tu nombre<input name="buyerName" defaultValue={user?.name || ""} required minLength={2} maxLength={100} placeholder="Tu nombre"/></label><label>Correo electrónico<input name="buyerEmail" type="email" defaultValue={user?.email || ""} required placeholder="hola@ejemplo.com"/></label></div><label>Dirección de envío <span>(calle, número, piso)</span><textarea name="shippingAddress" required minLength={8} maxLength={300} rows={2} placeholder="Calle, número, piso y puerta"/></label><p className="report-form-help">Destino: {city ? `${city}, ` : ""}{postalCode || "—"}, {COUNTRIES.find((item) => item.code === effectiveCountry)?.name || effectiveCountry || "—"}. <button type="button" className="text-button" onClick={() => setCheckout(false)}>Cambiar destino</button></p><label>¿Algo más que debamos saber? <span>(opcional)</span><textarea name="notes" rows={3} maxLength={1000} placeholder="Cuéntanos un poco sobre tu proyecto..."/></label>{coupons.length > 0 && <label>Tu cupón <span>(opcional)</span><div className="select-wrap"><select value={couponId} onChange={(e) => setCouponId(e.target.value)}><option value="">No aplicar cupón</option>{coupons.map((coupon) => <option key={coupon.id} value={coupon.id}>{REWARDS.find((reward) => reward.code === coupon.rewardCode)?.label} · {coupon.code}</option>)}</select><ChevronDown size={16}/></div></label>}<p className="checkout-shipping"><Truck size={16}/> Envío {selectedOption?.label.toLowerCase()} · {selectedOption && selectedOption.etaDays !== "a confirmar" ? `${selectedOption.etaDays} días` : "plazo a confirmar"} · {quote?.shipping === 0 ? "Gratis" : quote ? euros(quote.shipping) : "—"}</p>{quoteError && <p className="form-error">{quoteError}</p>}<div className="checkout-total"><span>Total estimado <small>· IVA incluido</small></span><strong>{quote ? euros(quote.total) : "—"}</strong></div><p className="report-form-help">Si posteriormente se contrata una placa confeccionada según tus especificaciones, puede aplicarse la excepción legal al desistimiento; tus garantías legales se mantienen. Consulta las condiciones antes de contratar.</p><PrivacyNotice purpose="order"/><label className="legal-check"><input type="checkbox" name="termsAccepted" value="true" required/><span>He leído y acepto las <a href="/legal/condiciones" target="_blank" rel="noopener noreferrer">condiciones de uso y de la solicitud</a>.</span></label><label className="legal-check"><input type="checkbox" name="adultConfirmed" value="true" required/><span>Confirmo que soy mayor de edad (18 años o más).</span></label>{checkoutError && <p className="form-error" role="alert">{checkoutError}</p>}<button className="btn btn-primary full" disabled={sending || !quote}>{sending ? "Enviando solicitud..." : "Enviar solicitud"}<ArrowRight size={17}/></button><p className="fine-print">Esta solicitud no conlleva pago ni confirma una fabricación.</p></form></div></div>}
  {result && <div className="modal-backdrop"><div className="modal success-modal" role="dialog" aria-modal="true"><div className="success-icon"><Check size={28}/></div><p className="eyebrow">¡UNA IDEA EN CAMINO!</p><h2>Solicitud recibida.</h2><p className="modal-intro">Hemos guardado tu solicitud <strong>{result.orderNumber}</strong>. No se ha realizado ningún cobro.</p>{result.emailSent ? <p className="success-info">Nuestro equipo ha recibido los detalles por correo y revisará tu proyecto.</p> : <p className="success-info">El correo automático no está configurado. Tu solicitud está guardada; contacta con <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a> indicando tu referencia.</p>}<button className="btn btn-primary full" onClick={() => setResult(null)}>Entendido <Check size={17}/></button></div></div>}
  </section>;
}
