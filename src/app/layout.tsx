import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./updates.css";
import "./legal-extra.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = { title: "ESPCB · Tus ideas, en buenas manos", description: "Fabricación de prototipos PCB en España. Calcula tu presupuesto, comparte tus diseños y forma parte de nuestra comunidad maker." };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="es"><body><Providers>{children}</Providers></body></html>;
}
