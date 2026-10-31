"use client";

import { createContext, useCallback, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { ArrowRight, CircuitBoard, FileCheck2, X } from "lucide-react";
import { PrivacyNotice } from "./privacy-notice";
import { LEGAL_VERSION } from "@/lib/site";

type User = { id: string; name: string; email: string; pennies: number; termsVersion: string | null; adultConfirmed: boolean };
type AuthMode = "login" | "register" | "terms";
type AuthContextType = { user: User | null; refresh: () => Promise<void>; openAuth: (mode?: "login" | "register") => void; logout: () => Promise<void> };
const AuthContext = createContext<AuthContextType | null>(null);
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("Auth provider missing"); return context; }

export function Providers({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);

  const applyUser = useCallback((next: User | null) => {
    setUser(next);
    // Al cerrar sesión o caducar la cookie, cualquier diálogo de acceso desaparece:
    // antes podía quedarse abierto el aviso de condiciones y bloquear la web.
    if (!next) setMode((current) => (current === "terms" ? null : current));
  }, []);

  const refresh = useCallback(async () => {
    try { const response = await fetch("/api/session", { cache: "no-store" }); const data = await response.json(); applyUser(data.user || null); }
    catch { setUser(null); }
  }, [applyUser]);

  useEffect(() => {
    let active = true;
    fetch("/api/session", { cache: "no-store" }).then((response) => response.json())
      .then((data) => { if (active) applyUser(data.user || null); })
      .catch(() => { if (active) setUser(null); });
    return () => { active = false; };
  }, [applyUser]);

  const needsTerms = Boolean(user && (!user.adultConfirmed || user.termsVersion !== LEGAL_VERSION));

  function openAuth(next: "login" | "register" = "login") { setError(""); setMode(next); }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); setMode(null); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setLoading(true);
    const form = new FormData(event.currentTarget);
    const action = mode === "terms" ? "accept-terms" : mode;
    try {
      const response = await fetch(`/api/auth/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        // Las cookies de sesión son necesarias para aceptar condiciones sobre la cuenta actual.
        credentials: "same-origin", body: JSON.stringify(Object.fromEntries(form)),
      });
      const data = await response.json();
      if (!response.ok) {
        // Sesión caducada o cookie invalidada: en lugar de un error sin salida, se pide
        // volver a iniciar sesión con un mensaje claro.
        if (response.status === 401) { setUser(null); setMode("login"); throw new Error("Tu sesión ha caducado. Vuelve a iniciar sesión: tus datos siguen guardados."); }
        throw new Error(data.error || "No se ha podido completar la operación.");
      }
      applyUser(data.user); setMode(null);
    } catch (e) { setError(e instanceof Error ? e.message : "No se ha podido completar el acceso."); }
    finally { setLoading(false); }
  }

  return <AuthContext.Provider value={{ user, refresh, openAuth, logout }}>
    {children}

    {/* Aviso no bloqueante: la web sigue siendo navegable aunque falte aceptar las condiciones. */}
    {needsTerms && !mode && <div className="terms-banner" role="status">
      <span className="terms-banner-icon"><FileCheck2 size={17}/></span>
      <p>Hemos actualizado las condiciones de uso. Revísalas para seguir usando tu cuenta con normalidad.</p>
      <button className="btn btn-primary" onClick={() => { setError(""); setMode("terms"); }}>Revisar y aceptar</button>
      <button className="terms-banner-close" onClick={() => void logout()} aria-label="Cerrar sesión">Cerrar sesión</button>
    </div>}

    {mode && <div className="modal-backdrop" onMouseDown={() => { if (!loading) { setMode(null); setError(""); } }}><div className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onMouseDown={(e) => e.stopPropagation()}>
      <button className="modal-close" onClick={() => { setMode(null); setError(""); }} aria-label="Cerrar"><X size={20}/></button>
      <div className="auth-mark"><CircuitBoard size={23}/></div><p className="eyebrow">LA COMUNIDAD QUE CREA</p>
      <h2 id="auth-title">{mode === "terms" ? "Un momento antes de continuar." : mode === "login" ? "Qué bien verte de nuevo." : "Toda idea empieza aquí."}</h2>
      <p className="modal-intro">{mode === "terms" ? `Revisa y acepta la versión vigente de las condiciones (${LEGAL_VERSION}) para seguir usando tu cuenta.` : mode === "login" ? "Entra para ver tus proyectos, cupones y Pennies." : "Crea tu cuenta, comparte tus diseños y forma parte de la comunidad."}</p>
      <form onSubmit={submit} className="form-stack">
        {mode === "register" && <label>Nombre<input name="name" required minLength={2} maxLength={80} placeholder="¿Cómo te llamas?" autoComplete="name" /></label>}
        {mode !== "terms" && <><label>Correo electrónico<input name="email" type="email" required placeholder="hola@ejemplo.com" autoComplete="email" /></label><label>Contraseña<input name="password" type="password" required minLength={8} maxLength={200} placeholder="Mínimo 8 caracteres" autoComplete={mode === "login" ? "current-password" : "new-password"} /></label></>}
        {(mode === "register" || mode === "terms") && <><PrivacyNotice purpose="account"/><label className="legal-check"><input type="checkbox" name="acceptTerms" value="true" required/><span>He leído y acepto las <a href="/legal/condiciones" target="_blank" rel="noopener noreferrer">condiciones de uso y de Pennies</a>.</span></label><label className="legal-check"><input type="checkbox" name="adultConfirmed" value="true" required/><span>Confirmo que soy mayor de edad (18 años o más).</span></label></>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="btn btn-primary full" disabled={loading}>{loading ? "Un momento..." : mode === "terms" ? "Aceptar y continuar" : mode === "login" ? "Iniciar sesión" : "Crear mi cuenta"}<ArrowRight size={17}/></button>
      </form>
      {mode === "terms"
        ? <button className="text-button centered" onClick={() => { setMode(null); setError(""); }}>Ahora no</button>
        : <p className="auth-switch">{mode === "login" ? "¿Aún no tienes cuenta?" : "¿Ya tienes cuenta?"} <button onClick={() => { setError(""); setMode(mode === "login" ? "register" : "login"); }}>{mode === "login" ? "Únete a ESPCB" : "Inicia sesión"}</button></p>}
    </div></div>}
  </AuthContext.Provider>;
}
