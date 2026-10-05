<script setup lang="ts">
/*
 * Aviso de Privacidad Integral (LFPDPPP, México). Cada dato que se menciona aquí corresponde a lo
 * que el sistema realmente guarda y a los proveedores que realmente usa (revisado contra barber,
 * frontend-urban y UrbanBladeMobile el 30-sep-2026). Si se agrega un proveedor o un dato nuevo,
 * hay que agregarlo aquí antes de publicarlo. Datos de contacto en app/utils/legal.ts.
 */
definePageMeta({ layout: 'legal' })

useSeoMeta({
  title: 'Aviso de Privacidad — UrbanBlade',
  description: 'Qué datos personales recaba UrbanBlade, para qué los usa, con quién los comparte y cómo ejercer tus derechos ARCO.',
})

const mailto = `mailto:${LEGAL.contactEmail}`
</script>

<template>
  <article class="legal">
    <p class="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-gold">Protección de datos</p>
    <h1 class="mb-2 text-3xl font-black uppercase tracking-tight text-ink sm:text-4xl">Aviso de <span class="text-gold">Privacidad</span></h1>
    <p class="mb-8 text-xs text-muted">Última actualización: {{ LEGAL.lastUpdated }}</p>

    <div class="mb-10 rounded-2xl border border-gold/30 bg-gold/5 p-5 text-sm leading-relaxed text-muted">
      <p class="mb-1 font-bold text-ink">UrbanBlade es un proyecto académico</p>
      <p>
        UrbanBlade es una plataforma desarrollada por estudiantes (el {{ LEGAL.responsable }}) como proyecto
        escolar. No es una empresa constituida, no tiene razón social ni domicilio fiscal y no cobra dinero real:
        los pagos con tarjeta funcionan en el modo de prueba de Stripe. Aun así, tratamos tus datos conforme a la
        Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) y te explicamos
        aquí, con exactitud, qué hacemos con ellos.
      </p>
    </div>

    <h2>1. Responsable de tus datos</h2>
    <p>
      El responsable del tratamiento es el <strong>{{ LEGAL.responsable }}</strong>, equipo de estudiantes que
      desarrolla y administra la plataforma. Al ser un proyecto académico no contamos con domicilio para oír y
      recibir notificaciones; el medio de contacto oficial para cualquier asunto de privacidad es el correo
      <a :href="mailto">{{ LEGAL.contactEmail }}</a>.
    </p>

    <h2>2. Datos que recabamos</h2>
    <p>Solo los que necesita cada función, según cómo uses UrbanBlade:</p>
    <ul>
      <li><strong>Cuenta:</strong> nombre, correo electrónico y contraseña (se guarda cifrada con un algoritmo de un solo sentido; nadie puede leerla). Si entras con Google, recibimos de tu cuenta de Google tu nombre, correo y foto de perfil.</li>
      <li><strong>Perfil de cliente:</strong> teléfono, fecha de nacimiento (para tu regalo de cumpleaños) y, si lo indicas, sexo; tu foto de perfil, tema visual y preferencias de notificación.</li>
      <li><strong>Citas:</strong> servicio, barbero, fecha, hora, estado de la cita y las notas que escribas para tu barbero.</li>
      <li><strong>Notas internas:</strong> el personal de la barbería puede anotar en tu ficha datos útiles para atenderte (por ejemplo, el corte que prefieres o una alergia). Solo el personal las ve; nunca se muestran en público.</li>
      <li><strong>Pagos:</strong> monto, método (efectivo, transferencia o tarjeta), propina y estado. <strong>El número completo de tu tarjeta nunca llega a nuestros servidores</strong>: lo captura y procesa Stripe. Si decides guardar una tarjeta, Stripe la conserva y nosotros solo recibimos la marca, los últimos 4 dígitos y la fecha de vencimiento para mostrártela.</li>
      <li><strong>Comprobantes de transferencia:</strong> la imagen que subes y el texto que se lee automáticamente de ella (reconocimiento de caracteres) para ayudar al personal a verificar el pago.</li>
      <li><strong>Programa de lealtad y beneficios:</strong> nivel, puntos y su historial, código para invitar amigos, membresías, paquetes, tarjetas de regalo y pedidos de la tienda.</li>
      <li><strong>Contenido que publicas:</strong> reseñas y calificaciones de barberos, y comentarios, reacciones y guardados en el Muro de Inspiración.</li>
      <li><strong>Chat con Bladebot:</strong> si usas el asistente con tu sesión iniciada, guardamos tus mensajes y sus respuestas para mostrarte tu historial y mejorar las respuestas.</li>
      <li><strong>Datos técnicos:</strong> el identificador de tu teléfono para enviarte notificaciones, la dirección IP de cada petición (para limitar intentos de acceso y detectar abusos) y la fecha de uso de tu sesión.</li>
      <li><strong>Solo en la app Android:</strong> estadísticas de uso sin datos de identificación (qué pantallas se abren y en qué paso de la reserva se avanza), reportes de fallos de la app y mediciones de rendimiento, con modelo del teléfono, versión de Android y un identificador de instalación de la app.</li>
    </ul>
    <p>
      <strong>No recabamos datos personales sensibles</strong> (salud, origen étnico, creencias, preferencias
      sexuales, datos biométricos ni datos financieros completos). Por favor no los escribas en notas, reseñas o
      en el chat.
    </p>

    <h2>3. Para qué usamos tus datos</h2>
    <p><strong>Finalidades necesarias</strong> (sin ellas no podemos darte el servicio):</p>
    <ul>
      <li>Crear y administrar tu cuenta e identificarte al iniciar sesión.</li>
      <li>Agendar, confirmar, reagendar y recordarte tus citas.</li>
      <li>Registrar tus pagos, verificar transferencias y emitir comprobantes.</li>
      <li>Administrar tus puntos, nivel, membresía, paquetes, tarjetas de regalo y pedidos.</li>
      <li>Mostrar tus reseñas y comentarios públicos, y moderarlos si incumplen los Términos.</li>
      <li>Responder tus preguntas a través de Bladebot.</li>
      <li>Proteger la plataforma: limitar intentos de acceso, detectar abusos y corregir fallos.</li>
    </ul>
    <p><strong>Finalidades opcionales</strong> (puedes negarte sin perder el servicio, ver sección 6):</p>
    <ul>
      <li>Enviarte promociones, cupones y campañas de la barbería.</li>
      <li>Enviarte notificaciones en tu teléfono.</li>
      <li>Elaborar estadísticas del negocio (por ejemplo, horarios con más citas). Estas estadísticas se calculan de forma agregada y no se usan para tomar decisiones sobre ti.</li>
    </ul>

    <h2>4. Qué ven otras personas</h2>
    <ul>
      <li>En reseñas y comentarios públicos solo se muestra tu <strong>nombre y la inicial de tu apellido</strong> (por ejemplo, «Luis G.»), nunca tu nombre completo, correo ni teléfono.</li>
      <li>El personal de la barbería (recepción, barberos y administración) ve los datos necesarios para atenderte, según su rol.</li>
    </ul>

    <h2>5. Con quién compartimos tus datos</h2>
    <p>
      No vendemos ni rentamos tus datos. Para operar usamos los siguientes proveedores, que tratan la información
      por nuestra cuenta y solo para prestarnos su servicio:
    </p>
    <ul>
      <li><strong>Amazon Web Services</strong>: servidores donde corre la plataforma, almacenamiento de fotos y comprobantes, y protección de claves.</li>
      <li><strong>MongoDB Atlas</strong>: base de datos donde se guarda tu información.</li>
      <li><strong>Stripe</strong>: pagos con tarjeta, tarjetas guardadas y cobro de membresías.</li>
      <li><strong>Google</strong>: inicio de sesión con Google y, en la app Android, Firebase (envío de notificaciones, estadísticas de uso, reportes de fallos y rendimiento, y configuración remota).</li>
      <li><strong>Wikipedia</strong>: para algunas preguntas generales (por ejemplo, sobre un estilo de corte), Bladebot consulta el texto de la pregunta en Wikipedia; no se envía tu nombre ni ningún otro dato de tu cuenta.</li>
    </ul>
    <p>
      Estos proveedores pueden tener servidores fuera de México (principalmente en Estados Unidos), por lo que usar
      UrbanBlade implica una transferencia internacional de tus datos para las finalidades descritas. El asistente
      Bladebot funciona con un modelo de inteligencia artificial que corre en nuestros propios servidores: tus
      mensajes no se envían a empresas externas de inteligencia artificial.
    </p>
    <p>
      Solo compartiríamos tus datos con una autoridad cuando una ley o una orden judicial nos obligue.
    </p>

    <h2>6. Tus derechos (ARCO) y cómo ejercerlos</h2>
    <p>
      Tienes derecho a <strong>Acceder</strong> a tus datos, <strong>Rectificarlos</strong> si son inexactos,
      <strong>Cancelarlos</strong> y <strong>Oponerte</strong> a su uso para fines específicos. También puedes
      revocar tu consentimiento y limitar el uso de tus datos.
    </p>
    <p><strong>Desde tu cuenta, sin escribirnos:</strong></p>
    <ul>
      <li>Ver y corregir tus datos personales en tu perfil (sitio web: <em>Mi perfil</em>; app: <em>Cuenta → Datos</em>).</li>
      <li>Activar o desactivar promociones, correos y notificaciones en las preferencias de notificación de tu cuenta.</li>
      <li>Eliminar tu cuenta (sitio web: <em>Mi perfil → Zona de peligro</em>; app: <em>Cuenta → Seguridad → Eliminar mi cuenta</em>). Se confirma con tu contraseña o, si entraste con Google, escribiendo ELIMINAR. Primero hay que cancelar las citas pendientes.</li>
    </ul>
    <p>
      <strong>Por correo:</strong> escribe a <a :href="mailto">{{ LEGAL.contactEmail }}</a> desde el correo de tu
      cuenta, indicando tu nombre, el derecho que quieres ejercer y qué datos. Si escribes desde otro correo te
      pediremos confirmar tu identidad. Te responderemos en un máximo de 20 días hábiles y, si procede, lo
      haremos efectivo dentro de los 15 días hábiles siguientes, como marca la ley. Si consideras que no
      atendimos tu solicitud, puedes acudir al organismo garante de protección de datos personales.
    </p>
    <p>
      <strong>Qué pasa al eliminar tu cuenta:</strong> se borra tu acceso y se cierran todas tus sesiones. El
      registro de citas y pagos ya realizados puede conservarse como historial del negocio, sin usarse para
      ningún otro fin; si quieres que también se elimine, pídelo por correo.
    </p>

    <h2>7. Cookies y almacenamiento en el navegador</h2>
    <p>En el sitio web solo usamos lo necesario para que funcione:</p>
    <ul>
      <li><strong>ub_token</strong>: mantiene tu sesión iniciada.</li>
      <li><strong>ub_theme</strong>: recuerda el tema visual que elegiste.</li>
      <li><strong>sidebarRail</strong> (almacenamiento local): recuerda si contrajiste el menú lateral.</li>
    </ul>
    <p>
      El sitio web no usa cookies de publicidad ni herramientas de rastreo de terceros. Cuando pagas con tarjeta,
      el formulario de Stripe puede usar sus propias cookies para prevenir fraudes, según la política de
      privacidad de Stripe. Si borras las cookies se cerrará tu sesión.
    </p>

    <h2>8. Cuánto tiempo guardamos tus datos</h2>
    <p>
      Mientras tu cuenta esté activa y el tiempo necesario para las finalidades descritas. Si tu cuenta pasa 365
      días sin una cita completada, tus puntos de lealtad caducan (ver Términos). Al terminar el proyecto
      académico, los datos se eliminarán o se anonimizarán.
    </p>

    <h2>9. Cómo protegemos tus datos</h2>
    <p>
      Todas las conexiones viajan cifradas (HTTPS). Las contraseñas y las llaves de sesión se guardan cifradas
      con algoritmos de un solo sentido. El acceso a la información depende del rol de cada persona, las llaves
      de los proveedores se guardan en un almacén de secretos y la base de datos y el almacenamiento de archivos
      cifran la información guardada. Ningún sistema es infalible; si ocurriera una vulneración que afecte tus
      derechos, te lo informaríamos sin demora.
    </p>

    <h2>10. Menores de edad</h2>
    <p>
      Para crear una cuenta necesitas ser mayor de edad. Los servicios para menores (como el corte infantil) debe
      reservarlos su madre, padre o tutor desde su propia cuenta. Si detectamos una cuenta de un menor creada sin
      autorización, la eliminaremos.
    </p>

    <h2>11. Cambios a este aviso</h2>
    <p>
      Si cambiamos este aviso te lo avisaremos en la plataforma antes de que el cambio aplique. La fecha de
      «Última actualización» indica la versión vigente.
    </p>

    <h2>12. Contacto</h2>
    <p>
      Dudas sobre este aviso o sobre tus datos: <a :href="mailto">{{ LEGAL.contactEmail }}</a>. Consulta también
      nuestros <NuxtLink to="/terminos">Términos y Condiciones</NuxtLink>.
    </p>
  </article>
</template>

<style scoped>
/* Tailwind 4: un <style> de componente no ve la config ni los tokens si no
   referencia la hoja principal (sin emitirla de nuevo). */
@reference "../assets/css/main.css";

.legal :deep(h2) { @apply mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink; }
.legal :deep(p) { @apply mb-4 text-sm leading-relaxed text-muted; }
.legal :deep(ul) { @apply mb-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted; }
.legal :deep(strong) { @apply text-ink; }
.legal :deep(a) { @apply text-gold hover:underline; }
</style>
