import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ContentReportForm } from "@/components/content-report-form";
export const metadata = { title: "Notificar contenido · ESPCB", description: "Comunica contenido de la galería que consideres ilícito o que infrinja derechos." };
export default async function ContentReportPage({ searchParams }: { searchParams: Promise<{ proyecto?: string | string[] }> }) {
  const params = await searchParams;
  const projectId = typeof params.proyecto === "string" ? params.proyecto.slice(0, 100) : "";
  return <><SiteHeader/><main><ContentReportForm initialProjectId={projectId}/></main><SiteFooter/></>;
}
