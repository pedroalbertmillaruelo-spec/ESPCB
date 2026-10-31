"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, CircleHelp, Gift, LockKeyhole, Sparkles, X } from "lucide-react";
import { useAuth } from "./providers";
import { BOARD_TIERS, REWARDS } from "@/lib/pricing";

type Coupon = { id: string; code: string; rewardCode: string; status: string };
type Entry = { id: string; amount: number; description: string; createdAt: string; status?: string };
export function PenniesPageContent() {
  const { user, openAuth, refresh } = useAuth();
  const [balance, setBalance] = useState(0);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [ledger, setLedger] = useState<Entry[]>([]);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  async function load() { const response = await fetch("/api/pennies", { cache: "no-store" }); if (response.ok) { const data = await response.json(); setBalance(data.user.pennies); setCoupons(data.coupons); setLedger(data.ledger); } }
  useEffect(() => {
    let active = true;
    if (user) {
      fetch("/api/pennies", { cache: "no-store" }).then(async (response) => response.ok ? response.json() : null)
        .then((data) => { if (active && data) { setBalance(data.user.pennies); setCoupons(data.coupons); setLedger(data.ledger); } })
        .catch(() => {});
    } else {
      queueMicrotask(() => { if (active) { setBalance(0); setCoupons([]); setLedger([]); } });
    }
    return () => { active = false; };
  }, [user]);
  async function redeem() {
    if (!confirm) return; setLoading(true); setError("");
    try { const response = await fetch("/api/pennies/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rewardCode: confirm }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setSuccess(`¡Tu cupón ${data.code} ya está disponible!`); setConfirm(null); await load(); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se ha podido canjear."); }
    finally { setLoading(false); }
  }
  const chosen = REWARDS.find((reward) => reward.code === confirm);
  return <><section className="pennies-page-hero"><div className="container pennies-page-grid"><div><p className="eyebrow light"><span/> LA COMUNIDAD QUE SUMA</p><h1>Compartir ideas<br/><em>tiene premio.</em></h1><p>Los Pennies son nuestra forma de darte las gracias. Comparte tus diseños, inspira a otros y consigue recompensas para seguir creando.</p><Link href="/galeria" className="btn btn-yellow">Ir a la Galería PCB <ArrowRight size={17}/></Link></div><div className="pennies-page-coin"><div className="coin"><span>✳</span><strong>P</strong><small>IDEAS QUE SUMAN</small></div><span>✦</span></div></div></section><section className="pennies-content"><div className="container"><div className="pennies-intro"><div><p className="eyebrow"><span/> PEQUEÑOS PUNTOS, GRANDES IDEAS</p><h2>Tus ideas valen mucho.</h2><p>Cuando otro usuario fabrica un diseño tuyo publicado y el pedido se marca como pagado, ganas Pennies por esa fabricación, sin importar las unidades. No hay límite de puntos: cuanto más se fabrique tu diseño, más ganas. Cada concesión pasa por nuestra revisión antes de abonarse.</p></div><div className="balance-card"><span><Sparkles size={19}/> TU SALDO</span><strong>{user ? balance : "—"} <small>Pennies</small></strong><p>{user ? `Hola, ${user.name.split(" ")[0]}. ¡Sigue compartiendo!` : "Inicia sesión para consultar tu saldo."}</p>{!user && <button onClick={() => openAuth()}>Iniciar sesión <ArrowRight size={15}/></button>}</div></div>
    <div className="earn-panel"><div><span className="panel-icon"><Gift size={22}/></span><div><h3>Así se suman tus Pennies</h3><p>Por cada diseño de la galería que otro usuario fabrique y pague.</p></div></div><div className="earn-tiers">{Object.values(BOARD_TIERS).map((tier) => <div key={tier.label}><span>Hasta {tier.label}</span><strong>+{tier.pennies} <small>Pennies</small></strong></div>)}</div></div>
    <div className="rewards-heading"><div><p className="eyebrow"><span/> ELIGE TU RECOMPENSA</p><h2>Pequeños puntos. Grandes ventajas.</h2><p>Canjea tus Pennies por cupones de un solo uso para tu próxima idea.</p></div></div>{success && <div className="success-message"><Check size={17}/> {success}</div>}<div className="rewards-grid">{REWARDS.map((reward) => <div className="reward-card" key={reward.code}><span className="reward-icon">{reward.shipping ? <Gift size={20}/> : <Sparkles size={20}/>}</span><div><h3>{reward.label}</h3><p>{reward.shipping ? "Para pedidos inferiores a 100 €." : "Se aplica a una placa del tamaño indicado."}</p></div><div className="reward-bottom"><strong>{reward.cost} <small>Pennies</small></strong><button onClick={() => user ? (setError(""), setConfirm(reward.code)) : openAuth()} disabled={!!user && balance < reward.cost}>{!user ? "Iniciar sesión" : balance < reward.cost ? "Saldo insuficiente" : "Canjear"}</button></div></div>)}</div>
    {user && <div className="account-pennies"><div><h3>Mis cupones</h3>{coupons.length === 0 ? <p>Todavía no tienes cupones. ¡Comparte tus diseños para empezar!</p> : <div className="coupon-list">{coupons.map((coupon) => <div key={coupon.id}><span><strong>{REWARDS.find((r) => r.code === coupon.rewardCode)?.label}</strong><small>{coupon.code}</small></span><em>{coupon.status === "available" ? "Disponible" : coupon.status === "reserved" ? "Reservado" : "Utilizado"}</em></div>)}</div>}</div><div><h3>Últimos movimientos</h3>{ledger.length === 0 ? <p>Aún no hay movimientos en tu cuenta.</p> : <div className="coupon-list">{ledger.map((entry) => <div key={entry.id}><span><strong>{entry.description}</strong><small>{new Date(entry.createdAt).toLocaleDateString("es-ES")}</small></span><em>{entry.amount > 0 ? "+" : ""}{entry.amount} P{entry.status === "pending" ? " · En revisión" : entry.status === "rejected" || entry.status === "cancelled" ? " · No abonado" : ""}</em></div>)}</div>}</div></div>}
    <div className="pennies-rules"><div><CircleHelp size={24}/><h3>Las reglas, claras.</h3></div><ul><li>Un solo cupón por pedido; no son acumulables.</li><li>Los cupones de placa se aplican a una placa de la categoría indicada.</li><li>El envío gratis solo se aplica por debajo de 100 € y si el envío no es ya gratuito.</li><li>No se obtienen Pennies por visitas, descargas, diseños privados ni por fabricar un diseño propio.</li><li>No hay topes: todas las fabricaciones de tu diseño suman su importe completo.</li><li>Las concesiones pasan por una revisión manual antes de abonarse al saldo; mientras tanto aparecen como «En revisión».</li><li>El canje es definitivo. Si se cancela un pedido aún no pagado, el cupón reservado vuelve a estar disponible. Si se reembolsa un pedido pagado, se descuentan los Pennies concedidos.</li></ul><p>Los Pennies son puntos promocionales personales e intransferibles. No son dinero, no tienen valor comercial fuera de esta plataforma y no pueden canjearse por efectivo ni crédito monetario real. ESPCB puede modificar las tablas notificándolo previamente y anular puntos o cupones obtenidos mediante fraude o abuso.</p><Link href="/legal/condiciones">Consulta las condiciones completas <ArrowRight size={15}/></Link></div>
  </div></section>
  {chosen && <div className="modal-backdrop" onMouseDown={() => setConfirm(null)}><div className="modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}><button className="modal-close" onClick={() => setConfirm(null)} aria-label="Cerrar"><X size={20}/></button><div className="auth-mark"><Gift size={22}/></div><p className="eyebrow">TU PRÓXIMA RECOMPENSA</p><h2>¿Canjeamos tus Pennies?</h2><p className="modal-intro">Vas a canjear <strong>{chosen.cost} Pennies</strong> por: {chosen.label}.</p><div className="terms-box"><LockKeyhole size={17}/> El canje es definitivo. El cupón es personal y de un solo uso.</div>{error && <p className="form-error">{error}</p>}<button className="btn btn-primary full" disabled={loading} onClick={redeem}>{loading ? "Canjeando..." : "Confirmar canje"}<ArrowRight size={17}/></button><button className="text-button centered" onClick={() => setConfirm(null)}>Ahora no</button></div></div>}
  </>;
}
