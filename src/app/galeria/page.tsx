import { Gallery } from "@/components/gallery";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { getGallery } from "@/lib/gallery";
export const dynamic = "force-dynamic";
export const metadata = { title: "Galería PCB · ESPCB" };
export default async function GalleryPage() {
  return <><SiteHeader/><main><Gallery initialProjects={await getGallery()}/></main><SiteFooter/></>;
}
