import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PenniesPageContent } from "@/components/pennies-page";
export const metadata = { title: "Pennies · ESPCB" };
export default function PenniesPage() { return <><SiteHeader/><main><PenniesPageContent/></main><SiteFooter/></>; }
