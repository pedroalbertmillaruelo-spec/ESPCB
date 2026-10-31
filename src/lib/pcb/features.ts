/**
 * Interruptor de la remachadora de vías (micro-remaches de cobre).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *  `tiene_remachadora` = false  → las placas de DOBLE CARA muestran un aviso obligatorio
 *                                 (este servicio rápido no metaliza las vías) y el cliente
 *                                 debe aceptarlo antes de poder pedir.
 *  `tiene_remachadora` = true   → el aviso desaparece por completo y se sustituye por el
 *                                 mensaje de «Actualización Profesional» (vías remachadas).
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Para activarlo en el futuro: cambia la constante a `true`, o define la variable de entorno
 * NEXT_PUBLIC_TIENE_REMACHADORA=true en Vercel y vuelve a desplegar (queda incrustada en el
 * build, como el resto de variables NEXT_PUBLIC_*). No hay que tocar ningún componente.
 *
 * Este módulo es isomorfo (cliente y servidor): no importa nada de Node.
 */

/** Lectura ESTÁTICA de la variable (Next solo incrusta NEXT_PUBLIC_* con acceso literal). */
const ENV_TIENE_REMACHADORA = process.env.NEXT_PUBLIC_TIENE_REMACHADORA;

/** Valor por defecto del taller: todavía no hay remachadora. */
export const TIENE_REMACHADORA_DEFAULT = false;

/** `true` solo si se ha activado expresamente por entorno. */
export const tieneRemachadora = ENV_TIENE_REMACHADORA
  ? /^(1|true|yes|on)$/i.test(ENV_TIENE_REMACHADORA.trim())
  : TIENE_REMACHADORA_DEFAULT;

/** Alias en snake_case, como se pidió en la especificación. */
export const tiene_remachadora = tieneRemachadora;

// ── Textos exactos de la lógica de caras ────────────────────────────────────────────────
/** 1 sola cara: mensaje de éxito (verde). */
export const MENSAJE_UNA_CARA =
  "¡Perfecto! Tu diseño de 1 cara califica para nuestro acabado profesional con resina UV y envío rápido.";

/** Doble cara y SIN remachadora: aviso obligatorio (pop-up antes de permitir el pedido). */
export const AVISO_DOBLE_CARA_ECO =
  "⚠️ Aviso de Prototipo Eco: Este servicio rápido no incluye metalizado químico de vías (agujeros conductores). " +
  "Deberás realizar las conexiones entre caras soldando las patas de los componentes por ambos lados o mediante " +
  "puentes de hilo manuales en tu taller. ¿Aceptas estas condiciones para recibir tu placa en tiempo récord?";

/** Doble cara CON remachadora: sustituye al aviso cuando el interruptor está activo. */
export const MENSAJE_DOBLE_CARA_REMACHADORA =
  "🚀 ¡Actualización Profesional! Ahora todas tus PCBs de doble cara incluyen vías con micro-remaches de cobre planos y limpios sin coste adicional.";

/** Etiqueta del botón que desbloquea el pedido en placas de doble cara. */
export const ETIQUETA_ACEPTAR_CONDICIONES = "Aceptar condiciones";

/** ¿Esta placa necesita la aceptación expresa del aviso eco? */
export function requiereAceptacionDobleCara(caras: number | null | undefined): boolean {
  return caras === 2 && !tiene_remachadora;
}

/** Mensaje que corresponde mostrar según las caras detectadas. */
export function mensajeDeCaras(caras: number): { texto: string; tono: "exito" | "aviso" | "profesional" } {
  if (caras === 1) return { texto: MENSAJE_UNA_CARA, tono: "exito" };
  if (tiene_remachadora) return { texto: MENSAJE_DOBLE_CARA_REMACHADORA, tono: "profesional" };
  return { texto: AVISO_DOBLE_CARA_ECO, tono: "aviso" };
}
