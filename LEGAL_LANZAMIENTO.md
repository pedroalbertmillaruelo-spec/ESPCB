# Lista de revisión legal antes de lanzar ESPCB

Esta es una lista operativa, no una certificación ni asesoramiento jurídico. La web es actualmente una **solicitud de presupuesto sin pago ni contrato automático de fabricación**. Ningún texto o implementación puede garantizar por sí solo el cumplimiento legal; solicita revisión profesional con los datos reales de la empresa y sus proveedores antes de publicar comercialmente.

## Datos de la empresa imprescindibles

- Verifica que `ESPCB S.L.` sea la denominación social realmente inscrita. Completa `NEXT_PUBLIC_COMPANY_NAME`, `NEXT_PUBLIC_COMPANY_NIF`, `NEXT_PUBLIC_COMPANY_ADDRESS` y `NEXT_PUBLIC_COMPANY_REGISTER` (registro mercantil y datos de inscripción) en Vercel. Añade `NEXT_PUBLIC_COMPANY_PHONE` si existe un teléfono de atención. No inventes valores. Cambiar estas variables públicas requiere un nuevo despliegue.
- Comprueba que el dominio de producción pertenece al titular y que la dirección de contacto, el domicilio y los datos de identificación aparezcan correctos en el aviso legal y la política de privacidad.
- Contacto facilitado: **espcb.soportecnico@gmail.com**. Activa la verificación en dos pasos, protege el acceso y atiende efectivamente la bandeja. Verifica que los correos enviados y recibidos funcionen.

## Protección de datos (RGPD y LOPDGDD)

- Identifica al responsable, las actividades y bases jurídicas reales, los destinatarios, períodos de conservación y el circuito de baja/supresión. Completa y mantén un registro de actividades de tratamiento; evalúa riesgos y, si procede, designa un delegado de protección de datos o realiza una evaluación de impacto.
- Identifica al proveedor de PostgreSQL conectado a Vercel, sus ubicaciones, Vercel, Google/Gmail si se usa y cualquier proveedor de envío o soporte. Formaliza los contratos de encargo y revisa posibles transferencias fuera del EEE (decisión de adecuación, cláusulas contractuales tipo u otras garantías y documentación). La política actual indica que esos detalles deben verificarse; no afirma que ya estén contratados.
- Configura HTTPS y `ADMIN_API_TOKEN` (16+ caracteres), 2FA en Vercel, base de datos y correo, acceso por mínimo privilegio, copias de seguridad, control de acceso y restauración. La clave de firma de sesión (`SESSION_SECRET`) se genera y persiste automáticamente en la base de datos si no la defines tú; si la defines manualmente, usa 32+ caracteres aleatorios. No publiques secretos ni datos reales en entornos de prueba. El límite de intentos incluido funciona por instancia: evalúa un WAF o un limitador compartido en producción.
- Ejecuta `npm audit` periódicamente y actualiza dependencias. La auditoría de producción no mostraba avisos conocidos en la revisión; la herramienta de desarrollo `drizzle-kit` conserva un aviso moderado en un `esbuild` transitivo sin arreglo estable compatible en el momento de la revisión. No expongas herramientas ni servidores de desarrollo a Internet y sigue las actualizaciones del proveedor.
- Define procedimientos reales de conservación, bloqueo, borrado y copias; la web no borra automáticamente las cuentas ni los datos históricos. Atiende las solicitudes de derechos por correo, por regla general en un mes, comprobando la identidad solo cuando existan dudas razonables. Evalúa y notifica brechas de seguridad en los plazos legales aplicables (generalmente 72 horas a la autoridad cuando proceda).
- La cuenta, la solicitud y la publicación muestran información resumida y enlaces a la política. Las casillas de condiciones, mayoría de edad y derechos de publicación no están premarcadas. No se presupone consentimiento para publicidad. Las cuentas anteriores deben revisar las condiciones actuales; no se fabrican aceptaciones retroactivas.
- El registro y las solicitudes están restringidos a mayores de edad. Comprueba que esta decisión se corresponde con la política real de la empresa. Los proyectos publicados muestran el nombre del autor y permiten descargar los archivos: revisa licencias, retirada y datos personales de terceros.

## Cookies y servicios de terceros

- La versión del repositorio usa la cookie propia `espcb_session`, necesaria para iniciar sesión; no incluye analítica o publicidad. Audita también la configuración efectiva de Vercel y las integraciones añadidas en el proyecto.
- Si activas analítica, píxeles, vídeos externos, mapas o cualquier cookie/tecnología no esencial, **no los actives antes de obtener consentimiento válido**. Implanta un gestor que permita aceptar, rechazar y configurar con igual facilidad y retirar la elección, y actualiza la política. No basta con cerrar un aviso o seguir navegando.

## Galería y avisos de contenido

- El canal `/notificar` es accesible sin cuenta; cada proyecto tiene un enlace directo. Los avisos se guardan en PostgreSQL y pueden verse en `/admin` con el token. Si SMTP está activo, se envía un aviso al equipo y un acuse al notificante cuando haya facilitado correo. Si falla, el panel indica que debe enviarse manualmente.
- Asigna una persona para revisar los avisos, responder sin demora indebida, documentar la decisión y comunicar las medidas al notificante y al autor cuando corresponda. Valora con asesoría las obligaciones aplicables de la Ley de Servicios Digitales y las excepciones según la naturaleza y tamaño del servicio; el formulario por sí solo no garantiza su cumplimiento.

## Antes de vender o cobrar

- Confirma con asesoría las obligaciones de la LSSI-CE y normativa de consumidores, IVA y facturación, precios y gastos completos, zonas de entrega, fechas de envío reales, atención de reclamaciones y garantía legal de conformidad.
- El derecho de desistimiento y sus excepciones deben analizarse por producto concreto. El artículo 103.c del RDL 1/2007 puede excluir el desistimiento para bienes confeccionados según especificaciones del consumidor o claramente personalizados; no elimina la garantía legal. Para bienes sin excepción aplicable debe ofrecerse la información y el modelo legal correspondiente antes de contratar.
- Antes de implantar pago o contratación automática, adapta el flujo para obtener una aceptación inequívoca con obligación de pago, proporcionar la información precontractual, conservar el contrato y confirmar la operación por un medio duradero. La versión actual no procesa pagos.
- Comprueba también las obligaciones de accesibilidad aplicables, las condiciones efectivas de los transportistas, las licencias de proyectos y los requisitos sectoriales del producto.

## Fuentes oficiales de referencia

- AEPD, deber de informar: https://www.aepd.es/guias/guia-modelo-clausula-informativa.pdf
- AEPD, cookies: https://www.aepd.es/prensa-y-comunicacion/notas-de-prensa/aepd-actualiza-guia-cookies-para-adaptarla-a-nuevas-directrices-cepd
- AEPD, ejercicio de derechos: https://www.aepd.es/preguntas-frecuentes/1-tus-derechos/2-tus-derechos-de-proteccion-de-datos
- LSSI-CE, Ley 34/2002: https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758
- Consumidores, RDL 1/2007: https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555
- Reglamento de Servicios Digitales: https://eur-lex.europa.eu/eli/reg/2022/2065/oj?locale=es
