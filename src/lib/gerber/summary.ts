import type { HolesInfo } from "./types";
// Módulo seguro para el navegador: no importa el descompresor ni Buffer.
export function resumenHuecos(holes: HolesInfo | null | undefined): string {
  if (!holes || !holes.detected || holes.total === 0) return "No se han detectado taladros en el ZIP.";
  const plated = holes.plated > 0 ? `${holes.plated} metalizados` : "ninguno metalizado";
  const nonPlated = holes.nonPlated > 0 ? ` · ${holes.nonPlated} no metalizados` : "";
  const sizes = holes.diametersMm.length ? ` · diámetros: ${holes.diametersMm.map((d) => `${d.toLocaleString("es-ES")} mm`).join(", ")}` : "";
  return `${holes.total} agujeros (${plated}${nonPlated})${sizes}`;
}
