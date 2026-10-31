/** Lista práctica de destinos frecuentes. "OTHER" permite escribir cualquier código ISO-3166-1 alfa-2. */
export const COUNTRIES = [
  { code: "ES", name: "España" },
  { code: "PT", name: "Portugal" },
  { code: "FR", name: "Francia" },
  { code: "DE", name: "Alemania" },
  { code: "IT", name: "Italia" },
  { code: "NL", name: "Países Bajos" },
  { code: "BE", name: "Bélgica" },
  { code: "AT", name: "Austria" },
  { code: "IE", name: "Irlanda" },
  { code: "GB", name: "Reino Unido" },
  { code: "AD", name: "Andorra" },
  { code: "CH", name: "Suiza" },
  { code: "PL", name: "Polonia" },
  { code: "SE", name: "Suecia" },
  { code: "DK", name: "Dinamarca" },
  { code: "FI", name: "Finlandia" },
  { code: "GR", name: "Grecia" },
  { code: "RO", name: "Rumanía" },
  { code: "US", name: "Estados Unidos" },
  { code: "MX", name: "México" },
] as const;
export const OTHER_COUNTRY_VALUE = "OTHER";
export function isValidCountryCode(code: string) { return /^[A-Z]{2}$/.test(code); }
