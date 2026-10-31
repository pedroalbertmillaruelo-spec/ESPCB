export const CATEGORIES = [
  "Audio", "Alimentación", "Microcontroladores", "Sensores", "Iluminación LED",
  "RF & Radio", "Robótica", "Casa Inteligente", "Instrumentación", "Wearables", "Retro",
] as const;
export const DIFFICULTIES = ["Principiante", "Intermedio", "Avanzado", "Experto"] as const;
export const LICENSES = ["CC BY 4.0", "CC BY-SA 4.0", "CC BY-NC-SA 4.0", "CC0 1.0 (Dominio público)", "CERN-OHL-P v2", "TAPR OHL"] as const;
export const CAD_FORMATS = ["KiCad 8", "KiCad 7", "EasyEDA", "Altium Designer", "Eagle", "DipTrace", "Fritzing", "Solo Gerber"] as const;
export const LAYER_OPTIONS = [1, 2, 4, 6] as const;
export const SORTS = [
  { value: "recent", label: "Más recientes" },
  { value: "popular", label: "Más descargados" },
  { value: "liked", label: "Más gustados" },
  { value: "viewed", label: "Más vistos" },
  { value: "oldest", label: "Más antiguos" },
] as const;
export const pexels = (id: number, w = 1200, h = 800) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=${w}&h=${h}`;
export function difficultyTone(difficulty: string) {
  switch (difficulty) {
    case "Principiante": return "text-emerald-300 border-emerald-400/40 bg-emerald-400/10";
    case "Intermedio": return "text-amber-200 border-amber-300/40 bg-amber-300/10";
    case "Avanzado": return "text-orange-300 border-orange-400/40 bg-orange-400/10";
    default: return "text-rose-300 border-rose-400/40 bg-rose-400/10";
  }
}
export function compactNumber(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return String(value);
}
export function slugify(input: string) {
  return input.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "").slice(0, 70);
}
export function timeAgo(date: Date | string) {
  const then = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.max(1, Math.floor((Date.now() - then.getTime()) / 1000));
  const units: [number, string, string][] = [[31536000, "año", "años"], [2592000, "mes", "meses"], [604800, "semana", "semanas"], [86400, "día", "días"], [3600, "hora", "horas"], [60, "minuto", "minutos"]];
  for (const [size, singular, plural] of units) if (seconds >= size) { const amount = Math.floor(seconds / size); return `hace ${amount} ${amount === 1 ? singular : plural}`; }
  return "hace unos segundos";
}
export function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}
export type ProjectCardData = {
  slug: string; title: string; summary: string; category: string; tags: string[]; layers: number;
  difficulty: string; imageUrl: string; downloads: number; likes: number; views: number;
  authorName: string; authorHandle: string; cadFormat: string; featured: boolean; components: number; createdAt: Date;
};
