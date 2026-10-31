"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, CircuitBoard, Menu, UserRound, X, Sparkles } from "lucide-react";
import { useState } from "react";
import { useAuth } from "./providers";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site";

export function Logo({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`brand ${light ? "brand-light" : ""}`} aria-label="ESPCB, inicio"><span className="brand-symbol"><CircuitBoard size={25} strokeWidth={1.7}/></span><span className="brand-word">espcb<span>.</span><small>IDEAS EN CIRCUITO</small></span></Link>;
}
export function SiteHeader() {
  const { user, openAuth, logout } = useAuth();
  const [menu, setMenu] = useState(false);
  const [account, setAccount] = useState(false);
  const pathname = usePathname();
  return <>
    <div className="announcement"><div className="container announcement-inner"><span><span className="announcement-dot"/> FABRICADO AQUÍ, PARA CREAR EN TODAS PARTES</span><span>¿Hablamos? <a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL}</a></span></div></div>
    <header className="site-header"><div className="container header-inner">
      <Logo />
      <nav className={`main-nav ${menu ? "mobile-open" : ""}`} aria-label="Navegación principal">
        <Link className={pathname === "/" ? "active" : ""} href="/" onClick={() => setMenu(false)}>Inicio</Link>
        <Link href="/#cotizador" onClick={() => setMenu(false)}>Fabricar PCB</Link>
        <Link className={pathname === "/galeria" ? "active" : ""} href="/galeria" onClick={() => setMenu(false)}>Galería PCB</Link>
        <Link href="/#como-funciona" onClick={() => setMenu(false)}>Cómo funciona</Link>
        <Link className={pathname === "/pennies" ? "active pennies-nav" : "pennies-nav"} href="/pennies" onClick={() => setMenu(false)}><Sparkles size={14}/> Pennies</Link>
      </nav>
      <div className="header-actions"><div className="account-wrap"><button className="account-button" onClick={() => user ? setAccount(!account) : openAuth()} aria-label={user ? "Abrir mi cuenta" : "Iniciar sesión"}><UserRound size={18}/><span>{user ? user.name.split(" ")[0] : "Iniciar sesión"}</span></button>
        {account && user && <div className="account-dropdown"><strong>Hola, {user.name.split(" ")[0]}</strong><span>{user.pennies} Pennies</span><Link href="/pennies" onClick={() => setAccount(false)}>Mi cuenta y cupones</Link><button onClick={() => { void logout(); setAccount(false); }}>Cerrar sesión</button></div>}
      </div><Link href="/#cotizador" className="btn btn-header">Calcula tu PCB <ArrowRight size={16}/></Link></div>
      <button className="mobile-toggle" onClick={() => setMenu(!menu)} aria-label={menu ? "Cerrar menú" : "Abrir menú"}>{menu ? <X/> : <Menu/>}</button>
    </div></header>
  </>;
}
