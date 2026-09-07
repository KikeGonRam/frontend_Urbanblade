<script setup lang="ts">
/*
 * Aviso de Privacidad Integral, redactado conforme a la LFPDPPP (Ley
 * Federal de Protección de Datos Personales en Posesión de los
 * Particulares) mexicana. Ver .claude/skills/legal-pages-plan/SKILL.md
 * para el detalle de qué datos reales maneja barber y por qué.
 *
 * NO es un sustituto de revisión legal real -- ver el aviso de borrador
 * más abajo. Los datos entre corchetes (razón social, RFC, domicilio
 * fiscal) son placeholders: este es un proyecto escolar sin entidad legal
 * constituida todavía.
 */
definePageMeta({ layout: 'legal' })

useSeoMeta({
  title: 'Aviso de Privacidad — UrbanBlade',
  description: 'Aviso de privacidad de UrbanBlade: qué datos recabamos, para qué los usamos y cómo ejercer tus derechos ARCO.',
})

const lastUpdated = '6 de septiembre de 2026'
</script>

<template>
  <article>
    <p class="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-gold">Protección de datos</p>
    <h1 class="mb-2 text-3xl font-black uppercase tracking-tight text-ink sm:text-4xl">Aviso de <span class="text-gold">Privacidad</span></h1>
    <p class="mb-8 text-xs text-muted">Última actualización: {{ lastUpdated }}</p>

    <div class="mb-10 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5 text-sm leading-relaxed text-amber-200">
      <p class="mb-1 font-bold uppercase tracking-wide">Borrador — pendiente de revisión legal</p>
      <p>
        Este aviso está redactado para cubrir lo que exige la LFPDPPP (Ley Federal de Protección de Datos
        Personales en Posesión de los Particulares), pero UrbanBlade es hoy un proyecto escolar sin razón social
        constituida. Antes de operar como negocio real con datos reales de clientes, este documento debe ser
        revisado por un abogado y completado con los datos fiscales reales.
      </p>
    </div>

    <p class="mb-4 text-sm leading-relaxed text-muted">
      En UrbanBlade ("nosotros") respetamos tu privacidad y protegemos tus datos personales conforme a la Ley
      Federal de Protección de Datos Personales en Posesión de los Particulares y su Reglamento. Este aviso
      explica qué datos recabamos, para qué los usamos, con quién los compartimos y cómo puedes ejercer tus
      derechos sobre ellos.
    </p>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">1. Responsable del tratamiento</h2>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      El responsable del tratamiento de tus datos personales es <strong class="text-ink">UrbanBlade</strong>
      [razón social pendiente de constitución], con domicilio en Av. de la Reforma 123, Suite 405, Ciudad de
      México, y correo de contacto <a href="mailto:hola@urbanblade.com" class="text-gold hover:underline">hola@urbanblade.com</a>.
    </p>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">2. Datos personales que recabamos</h2>
    <p class="mb-3 text-sm leading-relaxed text-muted">Dependiendo de cómo usas UrbanBlade, podemos recabar:</p>
    <ul class="mb-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
      <li><strong class="text-ink">Datos de identificación y contacto:</strong> nombre, correo electrónico, teléfono.</li>
      <li><strong class="text-ink">Datos de la cuenta:</strong> contraseña (almacenada cifrada, nunca en texto plano), rol, preferencias de notificación.</li>
      <li><strong class="text-ink">Historial de servicio:</strong> citas agendadas, servicios contratados, barbero preferido, reseñas que dejas.</li>
      <li><strong class="text-ink">Datos de pago:</strong> el número de tu tarjeta nunca llega a nuestros servidores — lo procesa directamente Stripe, nuestro procesador de pagos certificado PCI-DSS. Nosotros solo guardamos el monto, método (efectivo/transferencia/tarjeta) y un identificador de la transacción.</li>
      <li><strong class="text-ink">Comprobantes de transferencia:</strong> si pagas por transferencia bancaria, el comprobante que subes se procesa (incluyendo lectura automática/OCR del monto) para verificar tu pago.</li>
      <li><strong class="text-ink">Puntos de lealtad:</strong> tu saldo e historial de puntos ganados/canjeados.</li>
      <li><strong class="text-ink">Datos técnicos:</strong> token de tu dispositivo si activas notificaciones push, cookies de sesión y preferencia de tema visual.</li>
    </ul>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">3. Finalidades del tratamiento</h2>
    <p class="mb-3 text-sm leading-relaxed text-muted">
      <strong class="text-ink">Finalidades primarias</strong> (necesarias para darte el servicio, no puedes oponerte sin dejar de usar UrbanBlade):
    </p>
    <ul class="mb-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
      <li>Crear y administrar tu cuenta.</li>
      <li>Agendar, confirmar y recordar tus citas.</li>
      <li>Procesar tus pagos y emitir comprobantes.</li>
      <li>Administrar tu programa de lealtad.</li>
      <li>Responder tus dudas por el chatbot o soporte directo.</li>
    </ul>
    <p class="mb-3 text-sm leading-relaxed text-muted">
      <strong class="text-ink">Finalidades secundarias</strong> (opcionales — puedes oponerte sin afectar el servicio, ver sección 5):
    </p>
    <ul class="mb-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
      <li>Enviarte promociones, campañas o recordatorios de marketing por correo o WhatsApp.</li>
      <li>Enviarte notificaciones push sobre novedades.</li>
      <li>Análisis interno para mejorar el servicio (estadísticas agregadas, no perfilamiento individual con fines distintos al servicio).</li>
    </ul>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">4. Transferencias de datos</h2>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      Compartimos los datos estrictamente necesarios con los siguientes terceros para poder operar:
    </p>
    <ul class="mb-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
      <li><strong class="text-ink">Stripe, Inc.</strong> (procesamiento de pagos con tarjeta) — datos de pago, monto.</li>
      <li><strong class="text-ink">MongoDB Atlas</strong> (alojamiento de nuestra base de datos) y <strong class="text-ink">Vercel Inc.</strong> (alojamiento del sitio) — estos proveedores pueden alojar servidores fuera de México, lo que constituye una transferencia internacional de tus datos; ambos operan bajo estándares de seguridad reconocidos (cifrado en tránsito y en reposo).</li>
    </ul>
    <p class="mb-4 text-sm leading-relaxed text-muted">No vendemos ni rentamos tus datos personales a terceros con fines publicitarios ajenos a UrbanBlade.</p>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">5. Derechos ARCO y cómo ejercerlos</h2>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      Tienes derecho a <strong class="text-ink">Acceder</strong> a tus datos personales, <strong class="text-ink">Rectificarlos</strong>
      si son inexactos, <strong class="text-ink">Cancelarlos</strong> cuando consideres que no se requieren para
      alguna de las finalidades señaladas, y <strong class="text-ink">Oponerte</strong> al tratamiento de los
      mismos para fines específicos (derechos ARCO). También puedes revocar el consentimiento que nos hayas
      otorgado y limitar el uso o divulgación de tus datos.
    </p>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      Para ejercer cualquiera de estos derechos, escríbenos a
      <a href="mailto:hola@urbanblade.com" class="text-gold hover:underline">hola@urbanblade.com</a> indicando tu
      nombre, el derecho que deseas ejercer y una copia de identificación oficial. Responderemos dentro de los
      plazos que marca la ley (hasta 20 días hábiles para resolver, más 15 días adicionales para hacer efectiva
      la solicitud). Puedes desactivar el envío de marketing directamente desde tu perfil, sin necesidad de
      escribirnos.
    </p>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">6. Cookies y tecnologías de rastreo</h2>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      Usamos únicamente cookies estrictamente necesarias para operar el sitio: una para mantener tu sesión
      iniciada y otra para recordar tu tema visual preferido. No usamos cookies de publicidad ni de rastreo de
      terceros. Puedes borrar estas cookies desde la configuración de tu navegador; hacerlo cerrará tu sesión.
    </p>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">7. Medidas de seguridad</h2>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      Tu contraseña se almacena cifrada (nunca en texto plano). El acceso a la base de datos está restringido y
      las conexiones viajan cifradas (HTTPS/TLS). Ningún sistema es 100% infalible, pero aplicamos medidas
      razonables acorde al tamaño y naturaleza del proyecto para proteger tu información contra pérdida, uso
      indebido o acceso no autorizado.
    </p>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">8. Menores de edad</h2>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      UrbanBlade no está dirigido a menores de edad. Si eres el padre, madre o tutor de un menor que haya creado
      una cuenta sin tu autorización, contáctanos para cancelarla.
    </p>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">9. Cambios a este aviso</h2>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      Podemos actualizar este aviso de privacidad. Si hacemos cambios importantes, te lo notificaremos por
      correo o mediante un aviso visible en el sitio antes de que entren en vigor. La fecha de "última
      actualización" en la parte superior siempre refleja la versión vigente.
    </p>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">10. Contacto</h2>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      Cualquier duda sobre este aviso o sobre el tratamiento de tus datos personales, escríbenos a
      <a href="mailto:hola@urbanblade.com" class="text-gold hover:underline">hola@urbanblade.com</a> o llama al
      +52 55 1234 5678.
    </p>
  </article>
</template>
