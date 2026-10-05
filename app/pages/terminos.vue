<script setup lang="ts">
/*
 * Términos y Condiciones de uso. Cada regla descrita aquí es la que el sistema aplica de verdad
 * (revisado contra barber el 30-sep-2026): horas para cancelar (de la configuración de la barbería),
 * no-shows, depósitos, puntos, niveles, membresías, paquetes, tarjetas de regalo y pedidos. Si una
 * regla cambia en el código, hay que cambiarla aquí. Datos de contacto en app/utils/legal.ts.
 */
definePageMeta({ layout: 'legal' })

useSeoMeta({
  title: 'Términos y Condiciones — UrbanBlade',
  description: 'Condiciones de uso de UrbanBlade: reservas, cancelaciones, pagos, programa de lealtad y contenido publicado.',
})

const { apiFetch } = useApi()
const { data: shop } = await useAsyncData('terminos-barbershop', () =>
  apiFetch<{ data: { politica_cancelacion?: number | null } }>('/barbershop').catch(() => null),
)
// Horas mínimas para cancelar sin perder lo pagado por adelantado; 24 es el valor por defecto del sistema.
const cancelHours = computed(() => Number(shop.value?.data?.politica_cancelacion) || 24)
const mailto = `mailto:${LEGAL.contactEmail}`
</script>

<template>
  <article class="legal">
    <p class="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-gold">Condiciones de uso</p>
    <h1 class="mb-2 text-3xl font-black uppercase tracking-tight text-ink sm:text-4xl">Términos y <span class="text-gold">Condiciones</span></h1>
    <p class="mb-8 text-xs text-muted">Última actualización: {{ LEGAL.lastUpdated }}</p>

    <div class="mb-10 rounded-2xl border border-gold/30 bg-gold/5 p-5 text-sm leading-relaxed text-muted">
      <p class="mb-1 font-bold text-ink">UrbanBlade es un proyecto académico</p>
      <p>
        UrbanBlade es una plataforma desarrollada por estudiantes (el {{ LEGAL.responsable }}) como proyecto
        escolar, con fines de aprendizaje y demostración. No es una empresa constituida. Los servicios, precios,
        barberos y productos que aparecen pueden ser de demostración, y <strong>los pagos con tarjeta funcionan
        en el modo de prueba de Stripe, por lo que no se cobra dinero real</strong>. Reservar en la plataforma no
        garantiza que el servicio se preste físicamente.
      </p>
    </div>

    <h2>1. Aceptación</h2>
    <p>
      Al crear una cuenta o usar UrbanBlade aceptas estos Términos y nuestro
      <NuxtLink to="/privacidad">Aviso de Privacidad</NuxtLink>. Si no estás de acuerdo, no uses la plataforma.
    </p>

    <h2>2. Qué es UrbanBlade</h2>
    <p>
      Una plataforma web y una app Android para reservar citas de barbería, pagarlas, comprar productos, acumular
      puntos de lealtad y consultar dudas con el asistente Bladebot. Podemos agregar, cambiar o retirar funciones;
      si un cambio te afecta, te lo avisaremos en la plataforma.
    </p>

    <h2>3. Tu cuenta</h2>
    <ul>
      <li>Debes ser mayor de edad para crear una cuenta. Los servicios para menores los reserva su madre, padre o tutor desde su propia cuenta.</li>
      <li>Da información verdadera y mantenla actualizada; puedes entrar con correo y contraseña o con tu cuenta de Google.</li>
      <li>Cuida tu contraseña: eres responsable de lo que se haga desde tu cuenta. Si crees que alguien más entró, cámbiala y escríbenos.</li>
      <li>Podemos suspender cuentas que se usen para fraude o que incumplan estos Términos, y te explicaremos el motivo.</li>
    </ul>

    <h2>4. Reservas</h2>
    <ul>
      <li>Solo se muestran horarios realmente libres del barbero elegido. Al reservar, la cita queda <strong>pendiente</strong> hasta que la barbería la confirma; te avisamos cuando cambia de estado.</li>
      <li>Si una cita pendiente nunca se confirma y su horario ya pasó, se cancela automáticamente.</li>
      <li>Si no llegas a una cita confirmada, 30 minutos después de su hora de término se marca como <strong>inasistencia</strong>.</li>
      <li>Por motivos de fuerza mayor la barbería puede cancelar o reagendar tu cita; te avisaremos lo antes posible.</li>
    </ul>

    <h2>5. Cancelaciones, reembolsos y depósitos</h2>
    <ul>
      <li>Puedes cancelar o reagendar tu cita desde tu cuenta con al menos <strong>{{ cancelHours }} horas de anticipación</strong>. Con menos tiempo ya no se puede hacer desde la plataforma; comunícate con la barbería.</li>
      <li>Si pagaste por adelantado (completo o un depósito) y cancelas a tiempo, o si la barbería cancela tu cita, se te devuelve lo pagado: por tarjeta, el reembolso se hace a la misma tarjeta a través de Stripe.</li>
      <li>Si no asistes a una cita confirmada, lo que hayas pagado por adelantado no se devuelve.</li>
      <li>Si acumulas inasistencias recientes, la barbería puede pedirte un depósito de una parte del precio para tu siguiente reserva. Verás el monto antes de confirmar.</li>
    </ul>

    <h2>6. Precios y pagos</h2>
    <ul>
      <li>Aceptamos efectivo en el salón, transferencia bancaria (el personal la verifica con el comprobante que subes) y tarjeta a través de Stripe.</li>
      <li>El precio siempre lo calcula el sistema a partir del precio real del servicio o producto, nunca de un monto enviado desde tu dispositivo.</li>
      <li>Los descuentos por nivel y por membresía no se suman: se aplica el mayor. La propina es opcional.</li>
      <li>Los precios se muestran en pesos mexicanos. Como es un proyecto académico, no se emiten facturas fiscales (CFDI); los comprobantes que genera la plataforma no tienen validez fiscal.</li>
    </ul>

    <h2>7. Programa de lealtad</h2>
    <ul>
      <li>Ganas 10 puntos por cada cita completada y 5 por cada reseña; también hay puntos de regalo por tu cumpleaños (20) y por invitar a un amigo que complete su primera cita (30, para quien invita).</li>
      <li>Tu nivel depende de tus citas completadas: Regular desde 5 (5 % de descuento), V.I.P desde 10 (10 %) y Leyenda desde 20 (15 %).</li>
      <li>Cada punto vale $1 MXN al canjearlo, hasta un máximo del 50 % del total a pagar.</li>
      <li>Si pasan 180 días sin una cita completada, bajas un nivel por cada periodo de 180 días; si pasan 365 días, tus puntos caducan.</li>
      <li>Los puntos no tienen valor en efectivo, no se pueden transferir ni cambiar por dinero. Si cambiamos estas reglas, te avisaremos antes y respetaremos los puntos que ya tengas.</li>
    </ul>

    <h2>8. Membresías, paquetes, tarjetas de regalo y pedidos</h2>
    <ul>
      <li><strong>Membresías:</strong> son suscripciones mensuales que se cobran automáticamente a tu tarjeta a través de Stripe hasta que las canceles. Al cancelar, conservas los beneficios hasta el final del periodo ya pagado y no se vuelve a cobrar.</li>
      <li><strong>Paquetes:</strong> son sesiones prepagadas; si un paquete tiene vigencia, se indica al comprarlo y las sesiones no usadas vencen en esa fecha.</li>
      <li><strong>Tarjetas de regalo:</strong> no tienen fecha de vencimiento.</li>
      <li><strong>Pedidos de la tienda:</strong> se apartan y se pagan al recogerlos en el salón. Si no se recogen en 3 días, se cancelan automáticamente y los productos vuelven al inventario.</li>
    </ul>

    <h2>9. Contenido que publicas</h2>
    <ul>
      <li>Tus reseñas, calificaciones y comentarios se muestran públicamente con tu nombre y la inicial de tu apellido.</li>
      <li>Solo puedes reseñar a un barbero con el que tuviste una cita completada.</li>
      <li>No publiques contenido falso, ofensivo, discriminatorio, con datos personales de otras personas o que infrinja derechos de terceros. Podemos retirar ese contenido.</li>
      <li>Al publicar nos das permiso de mostrar tu contenido dentro de UrbanBlade mientras no lo borres o no elimines tu cuenta.</li>
      <li>Los barberos que publican fotos de trabajos en su portafolio declaran tener el consentimiento de las personas que aparecen en ellas.</li>
    </ul>

    <h2>10. Bladebot</h2>
    <p>
      Bladebot responde de forma automática con información del negocio y con inteligencia artificial. Sus
      respuestas pueden contener errores: los precios, horarios y disponibilidad que valen son los que muestra la
      plataforma al reservar. No es asesoría profesional de ningún tipo.
    </p>

    <h2>11. Uso permitido</h2>
    <p>No está permitido:</p>
    <ul>
      <li>Usar la plataforma para fraude o actividades ilegales.</li>
      <li>Intentar entrar a cuentas ajenas o a partes restringidas del sistema, o probar vulnerabilidades sin autorización.</li>
      <li>Interferir con el servicio, por ejemplo con bots, extracción masiva de datos o reservas falsas.</li>
    </ul>

    <h2>12. Propiedad intelectual</h2>
    <p>
      El nombre y logotipo de UrbanBlade, sus mascotas (Nava, Bladebot y Bruno), sus textos y su diseño fueron
      creados por el {{ LEGAL.responsable }} para este proyecto y no pueden usarse con fines comerciales sin su
      autorización.
    </p>

    <h2>13. Disponibilidad y responsabilidad</h2>
    <p>
      Por ser un proyecto académico, UrbanBlade se ofrece tal como está: puede tener interrupciones, errores o
      dejar de operar al concluir el proyecto. Si eso ocurre, te avisaremos con anticipación cuando sea posible.
      Nada de lo anterior limita los derechos que te otorga la Ley Federal de Protección al Consumidor.
    </p>

    <h2>14. Cambios a estos Términos</h2>
    <p>
      Si cambiamos estos Términos te lo avisaremos en la plataforma antes de que apliquen. La fecha de «Última
      actualización» indica la versión vigente.
    </p>

    <h2>15. Ley aplicable y quejas</h2>
    <p>
      Estos Términos se rigen por las leyes de los Estados Unidos Mexicanos. Si tienes una queja, escríbenos
      primero para intentar resolverla; también puedes acudir a la Procuraduría Federal del Consumidor (PROFECO).
    </p>

    <h2>16. Contacto</h2>
    <p>Dudas sobre estos Términos: <a :href="mailto">{{ LEGAL.contactEmail }}</a>.</p>
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
