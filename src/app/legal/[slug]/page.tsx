import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Mail, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { COMPANY_ADDRESS, COMPANY_NAME, COMPANY_NIF, COMPANY_PHONE, COMPANY_REGISTER, LEGAL_VERSION, SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/site";

type LegalSection = { title: string; paragraphs: string[] };
type LegalPage = { title: string; intro: string; sections: LegalSection[] };
const missingCompanyInfo = !COMPANY_NIF || !COMPANY_ADDRESS || !COMPANY_REGISTER;
const pages: Record<string, LegalPage> = {
  "aviso-legal": {
    title: "Aviso legal", intro: "Información sobre el titular, el acceso y el uso de este sitio web.",
    sections: [
      { title: "Identificación y contacto", paragraphs: [
        `Titular indicado: ${COMPANY_NAME}. Correo electrónico de contacto: ${SUPPORT_EMAIL}.${COMPANY_PHONE ? ` Teléfono: ${COMPANY_PHONE}.` : ""}`,
        `NIF: ${COMPANY_NIF || "pendiente de completar"}. Domicilio social o establecimiento: ${COMPANY_ADDRESS || "pendiente de completar"}. Datos de inscripción registral: ${COMPANY_REGISTER || "pendientes de completar"}.`,
        "Estos datos deberán ser completados y verificados por el titular antes de la publicación comercial, de conformidad con la información exigible por el artículo 10 de la Ley 34/2002 (LSSI-CE).",
      ] },
      { title: "Objeto y acceso", paragraphs: [
        "Este sitio permite solicitar presupuestos orientativos para prototipos PCB y compartir proyectos en la Galería PCB. La versión actual no cobra ni concluye automáticamente un contrato de fabricación.",
        "El acceso es gratuito, salvo el coste de conexión del usuario. Para algunas funciones es necesario registrarse y cumplir las condiciones de uso.",
      ] },
      { title: "Uso y propiedad intelectual", paragraphs: [
        "El usuario se compromete a actuar lícitamente y a no subir archivos que infrinjan derechos, contengan datos ajenos sin legitimación, software dañino o contenidos ilícitos.",
        "Las marcas, diseño y contenidos propios pertenecen a sus titulares. El autor conserva los derechos que legalmente le correspondan sobre su proyecto y autoriza su publicación y descarga conforme a la licencia elegida y a las condiciones de la galería.",
      ] },
      { title: "Enlaces, avisos y responsabilidad", paragraphs: [
        `Los sitios de terceros enlazados tienen sus propias condiciones. Si detectas contenido presuntamente ilícito o que infringe derechos, utiliza el enlace «Notificar contenido» o escribe a ${SUPPORT_EMAIL}. El equipo revisará el aviso y podrá limitar el acceso cuando corresponda.`,
        "No se excluyen ni limitan derechos que sean irrenunciables conforme a la legislación aplicable. Los diseños de terceros deben comprobarse antes de utilizarlos.",
      ] },
    ],
  },
  "privacidad": {
    title: "Política de privacidad", intro: "Te explicamos qué datos utilizamos, para qué y cómo puedes ejercer tus derechos.",
    sections: [
      { title: "Responsable del tratamiento", paragraphs: [
        `${COMPANY_NAME}. Contacto de privacidad: ${SUPPORT_EMAIL}. NIF: ${COMPANY_NIF || "pendiente de completar"}. Domicilio: ${COMPANY_ADDRESS || "pendiente de completar"}.`,
        "Los datos identificativos pendientes y, si corresponde, los de un delegado de protección de datos deben completarse antes de la puesta en marcha comercial.",
      ] },
      { title: "Datos que tratamos", paragraphs: [
        "Datos de cuenta: nombre, correo electrónico, contraseña almacenada mediante una función de derivación y datos de sesión. Datos de solicitudes: contacto, dirección de envío, características, importe orientativo y archivos Gerber. Datos de la galería: nombre público del autor, descripción, imágenes, archivos, licencia y actividad de publicación, descargas, visitas o favoritos.",
        "También tratamos las comunicaciones y avisos que nos envíes, los movimientos de Pennies y cupones y los datos técnicos necesarios para prestar y proteger el servicio, como direcciones IP y registros gestionados por el proveedor de alojamiento. No incluyas en los archivos o notas información personal o sensible que no sea necesaria.",
      ] },
      { title: "Finalidades y bases jurídicas", paragraphs: [
        "Gestionamos la cuenta, las solicitudes, la publicación elegida por el autor, la comunicación relacionada y los Pennies para prestar los servicios solicitados o aplicar medidas precontractuales: artículo 6.1.b del RGPD. Publicar un proyecto implica que el nombre público, la descripción, la imagen y los archivos sean accesibles a terceros.",
        "Gestionamos obligaciones fiscales, contables y requerimientos legales cuando proceda: artículo 6.1.c. Aplicamos medidas de seguridad, prevención de abusos y atención de avisos o reclamaciones en nuestro interés legítimo y, cuando corresponda, para cumplir obligaciones legales: artículos 6.1.f y 6.1.c.",
        "No se realizan envíos publicitarios ni perfiles comerciales en esta versión. Si se incorporan tratamientos que requieren consentimiento, se solicitará de forma independiente, específica y revocable. Los datos obligatorios identificados en cada formulario son necesarios para atender la función solicitada.",
      ] },
      { title: "Destinatarios y transferencias", paragraphs: [
        "Pueden acceder a los datos, cuando sea necesario, proveedores de alojamiento y despliegue como Vercel, el proveedor de PostgreSQL conectado por el titular, el proveedor de correo que se configure y, para una entrega confirmada, el transportista. También se comunicarán cuando exista obligación legal.",
        "La galería es pública: los visitantes podrán ver el nombre del autor y descargar los archivos compartidos. Algunos proveedores, entre ellos Vercel o Google si se utiliza Gmail, pueden intervenir fuera del Espacio Económico Europeo. Antes de operar deben verificarse sus ubicaciones, contratos de encargo y, si existen transferencias internacionales, la decisión de adecuación o las garantías aplicables; puedes solicitar información y copia de las garantías por correo.",
      ] },
      { title: "Plazos de conservación", paragraphs: [
        "Conservamos los datos de cuenta y los proyectos mientras la cuenta o la publicación estén activos y durante el tiempo necesario para gestionar la baja, reclamaciones y posibles responsabilidades. La retirada de una publicación no puede eliminar las copias que terceros ya hayan descargado.",
        "Las solicitudes, documentación comercial y contable se conservan durante la relación y, después, debidamente bloqueadas cuando proceda, durante los plazos legales aplicables; por ejemplo, los plazos tributarios y mercantiles que correspondan. Las comunicaciones y registros de seguridad se limitan al tiempo necesario para su finalidad y obligaciones aplicables. Antes del lanzamiento se deberán concretar los plazos de los proveedores y los procedimientos de borrado.",
      ] },
      { title: "Tus derechos", paragraphs: [
        `Puedes solicitar gratuitamente acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad cuando proceda, así como retirar cualquier consentimiento otorgado, escribiendo a ${SUPPORT_EMAIL}. Indica el derecho que ejercitas y un medio de contacto; si existen dudas razonables podremos pedir información adicional para confirmar tu identidad.`,
        "Responderemos, con carácter general, en el plazo de un mes; podrá ampliarse conforme al RGPD si la solicitud es compleja y se te informa. También puedes presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).",
      ] },
      { title: "Menores, seguridad y decisiones automatizadas", paragraphs: [
        "El registro y las solicitudes de fabricación de esta versión están dirigidos a personas mayores de edad (18 años o más). No solicitamos intencionadamente información de menores para dichas funciones; si detectas un caso, contacta con nosotros.",
        "Usamos medidas técnicas como conexión HTTPS en producción, control de acceso y contraseñas derivadas. Ningún sistema ofrece seguridad absoluta. No tomamos decisiones exclusivamente automatizadas con efectos jurídicos o similares sobre las personas.",
      ] },
    ],
  },
  "cookies": {
    title: "Política de cookies", intro: "Información clara sobre el almacenamiento necesario para la sesión.",
    sections: [
      { title: "Qué es una cookie", paragraphs: ["Una cookie es un pequeño dato que un sitio almacena en tu navegador. Algunas son necesarias para proporcionar funciones solicitadas y otras pueden utilizarse para analítica o publicidad."] },
      { title: "Cookie utilizada en esta versión", paragraphs: [
        "Nombre: espcb_session. Titular: cookie propia de ESPCB. Finalidad: mantener la sesión iniciada y reconocer la cuenta en las funciones solicitadas. Duración máxima: 30 días; se elimina al cerrar sesión o al borrarla en el navegador. Atributos: HttpOnly, SameSite=Lax y Secure cuando la web se sirve en producción mediante HTTPS.",
        "Esta cookie es técnica y necesaria para el servicio de cuenta solicitado. En la versión entregada no se han incorporado cookies de analítica ni publicidad, ni scripts de seguimiento que requieran consentimiento. Por ello no se solicita consentimiento para cookies no esenciales que no se utilizan.",
      ] },
      { title: "Control y cambios", paragraphs: [
        "Puedes cerrar sesión o eliminar y bloquear las cookies desde la configuración de tu navegador. Si bloqueas la cookie de sesión, no podrás usar las funciones que requieren iniciar sesión.",
        "Antes de incorporar analítica, publicidad o tecnologías no esenciales —incluidas integraciones activadas desde Vercel— habrá que actualizar esta política e implantar un mecanismo que permita aceptar, rechazar o configurar con la misma facilidad antes de instalarlas. La continuación de la navegación no constituye consentimiento.",
      ] },
    ],
  },
  "condiciones": {
    title: "Condiciones de uso y Pennies", intro: "Reglas para utilizar el sitio, solicitar una fabricación y compartir diseños.",
    sections: [
      { title: "Cuenta y uso", paragraphs: [
        `El servicio es ofrecido por ${COMPANY_NAME}; puedes contactar en ${SUPPORT_EMAIL}. El registro y el envío de solicitudes están destinados a personas mayores de edad (18 años o más) con capacidad para aceptar estas condiciones.`,
        "Cada usuario debe facilitar datos correctos, custodiar sus credenciales y no utilizar cuentas múltiples, pedidos ficticios o procedimientos automatizados para abusar de la plataforma. Contacta con nosotros si detectas un acceso no autorizado.",
      ] },
      { title: "Solicitud de fabricación y precios", paragraphs: [
        "El cotizador ofrece un importe orientativo por placa calculado según su superficie: 5 € para placas de hasta 2.500 mm² y, por encima de esa superficie, una curva ascendente y amortiguada que parte de esos 5 € y llega a 40 € en el tamaño máximo de 150 × 200 mm (30.000 mm²), redondeada al céntimo y multiplicada por las unidades. La web muestra el desglose, el precio unitario y el envío seleccionado. El precio mostrado se indica con IVA incluido; los impuestos y condiciones se verificarán antes de la contratación efectiva.",
        "El coste de envío se calcula con precios reales según el destino indicado (país, código postal y localidad) y el peso/volumen estimado del paquete: en España se aplican las tarifas oficiales publicadas de Correos vigentes, y para otros países puede añadirse una tarifa en tiempo real de DHL Express cuando esté disponible. El envío económico es gratuito desde 100 € en placas o 20 unidades; los servicios más rápidos mantienen su precio. Si ningún transportista cubre el destino indicado, se ofrece un presupuesto manual antes de confirmar nada. Los plazos de entrega son orientativos y se confirmarán con el pedido.",
        "Al pulsar «Enviar solicitud» no se cobra ni se formaliza automáticamente una compra. Revisamos los Gerber, la capacidad de fabricación, el importe y la entrega; cualquier contratación posterior y sus condiciones deberán confirmarse antes de fabricar o cobrar. Puedes escribirnos para corregir o cancelar una solicitud pendiente.",
      ] },
      { title: "Placas personalizadas y derechos del consumidor", paragraphs: [
        "Cuando se formalice una venta a distancia, los consumidores disponen del derecho de desistimiento de 14 días naturales salvo que resulte aplicable una excepción legal. Para bienes confeccionados conforme a las especificaciones del consumidor o claramente personalizados puede no existir ese derecho, según el artículo 103.c del Real Decreto Legislativo 1/2007; su aplicación se analizará según el pedido concreto.",
        `La posible excepción no elimina la garantía legal de conformidad ni los derechos por productos defectuosos o no conformes. Para incidencias, reclamaciones o, cuando corresponda, desistimiento, contacta con ${SUPPORT_EMAIL} identificando el pedido. Se facilitarán las condiciones y, si procede, el modelo de desistimiento antes de contratar.`,
      ] },
      { title: "Galería y licencias", paragraphs: [
        "Al publicar declaras disponer de derechos y autorizaciones sobre el diseño, los Gerber, la imagen y los datos incluidos. El proyecto, nombre de autor y archivos se hacen públicos y podrán descargarse conforme a la licencia elegida; los proyectos ya descargados por terceros no pueden retirarse de sus dispositivos.",
        `No publiques información ilícita, datos personales de terceros sin base legal o archivos maliciosos. Puedes comunicar contenido presuntamente ilícito mediante el canal «Notificar contenido» o en ${SUPPORT_EMAIL}. Las notificaciones se revisan por personas y las decisiones pueden comunicarse al contacto facilitado.`,
      ] },
      { title: "Naturaleza de los Pennies", paragraphs: [
        "Los Pennies acumulados son puntos de fidelidad de carácter estrictamente promocional. No constituyen dinero de curso legal, no tienen valor comercial fuera de esta plataforma y en ningún caso podrán ser canjeados, reembolsados ni convertidos en dinero en efectivo o crédito monetario real. Son personales e intransferibles y no pueden venderse, cederse ni intercambiarse.",
        "La empresa podrá modificar las tablas de canje por descuentos porcentuales o envíos gratis notificándolo previamente a los usuarios.",
      ] },
      { title: "Obtención y reembolso", paragraphs: [
        "El diseñador recibe 5, 20, 40 o 60 Pennies para categorías de hasta 50×50, 100×100, 100×200 o 150×200 mm, respectivamente, cuando otra persona fabrica su diseño público de la galería y el pedido pasa a pagado. Se conceden una sola vez por línea, independientemente de las unidades.",
        "No se conceden por visitas, descargas, proyectos privados ni fabricación de un diseño propio. Si un pedido pagado se reembolsa, los Pennies concedidos por ese pedido se descuentan del saldo.",
        "No existe un límite de Pennies: cada fabricación de un diseño publicado suma el importe completo que corresponda. Para proteger el programa, todas las concesiones quedan pendientes de revisión y solo se abonan al saldo tras su aprobación; las que no se acrediten se rechazan con su motivo. El titular puede rechazar concesiones fraudulentas, pedidos ficticios o abusos de cuentas múltiples, y anular los Pennies o cupones obtenidos de ese modo.",
      ] },
      { title: "Cupones y uso indebido", paragraphs: [
        "La tabla completa de recompensas y costes está en la página Pennies. El canje es definitivo. Solo se admite un cupón por pedido, de un solo uso y no acumulable. Los descuentos se aplican a una sola placa de la categoría indicada. El cupón de envío solo es válido por debajo de 100 € y cuando el pedido no tenga ya envío estándar gratuito por importe o cantidad.",
        "Si se cancela un pedido aún no pagado, su cupón reservado vuelve a estar disponible. ESPCB podrá anular puntos o cupones obtenidos mediante fraude, pedidos ficticios u otros abusos y suspender las cuentas implicadas, respetando los derechos aplicables.",
      ] },
    ],
  },
  "derechos": {
    title: "Tus derechos de privacidad", intro: "Puedes contactar con nosotros para consultar o ejercer tus derechos sobre tus datos.",
    sections: [
      { title: "Qué puedes solicitar", paragraphs: ["Según corresponda, puedes solicitar acceso a tus datos, rectificación, supresión, oposición, limitación, portabilidad y retirada de tu consentimiento, sin que ello afecte a la licitud anterior. También puedes solicitar información sobre los destinatarios y las garantías de transferencias internacionales."] },
      { title: "Cómo ejercerlos", paragraphs: [
        `Escribe a ${SUPPORT_EMAIL} con el asunto «Derechos de protección de datos», el derecho que solicitas y el correo asociado a tu cuenta o solicitud. No envíes documentos de identidad salvo que te los pidamos para resolver dudas razonables sobre tu identidad.`,
        "Atenderemos la solicitud normalmente en el plazo de un mes, con las posibles ampliaciones previstas por el RGPD. Si no estás conforme, puedes reclamar ante la Agencia Española de Protección de Datos: www.aepd.es.",
      ] },
      { title: "Baja y proyectos públicos", paragraphs: ["Puedes solicitar la baja de tu cuenta y la retirada de tus proyectos por correo. Algunos datos podrán conservarse bloqueados durante los plazos legales y una publicación retirada no elimina copias que terceros ya hayan descargado."] },
    ],
  },
};
export function generateStaticParams() { return Object.keys(pages).map((slug) => ({ slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return { title: `${pages[slug]?.title || "Información legal"} · ESPCB` }; }
export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const page = pages[slug]; if (!page) notFound();
  return <><SiteHeader/><main className="legal-page"><div className="container legal-container"><Link href="/" className="back-link"><ArrowLeft size={16}/> Volver al inicio</Link><p className="eyebrow"><span/> INFORMACIÓN IMPORTANTE</p><h1>{page.title}<span className="heading-dot">.</span></h1><p className="legal-intro">{page.intro}</p>{missingCompanyInfo && <div className="legal-pending"><ShieldCheck size={19}/><p><strong>Información del titular pendiente.</strong> Antes de operar comercialmente, deben completarse el NIF, domicilio y datos registrales y verificarse los proveedores y garantías de protección de datos.</p></div>}<div className="legal-content">{page.sections.map((section, index) => <section key={section.title}><span>{String(index + 1).padStart(2, "0")}</span><div><h2>{section.title}</h2>{section.paragraphs.map((paragraph, i) => <p key={i}>{paragraph}</p>)}</div></section>)}</div><div className="legal-contact"><div><Mail size={20}/><div><strong>¿Necesitas ayuda?</strong><p>Estamos aquí para resolver tus dudas.</p></div></div><a href={SUPPORT_MAILTO}>{SUPPORT_EMAIL} <ArrowUpRight size={15}/></a></div><p className="legal-update">Versión {LEGAL_VERSION} · Sujeta a la incorporación de los datos pendientes y a revisión profesional antes de la actividad comercial.</p></div></main><SiteFooter/></>;
}
