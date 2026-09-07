<script setup lang="ts">
/*
 * Términos y Condiciones de uso. Complementa el Aviso de Privacidad
 * (privacidad.vue) -- ver .claude/skills/legal-pages-plan/SKILL.md.
 * Mismo aviso de borrador/no-sustituye-revisión-legal que privacidad.vue.
 */
definePageMeta({ layout: 'legal' })

useSeoMeta({
  title: 'Términos y Condiciones — UrbanBlade',
  description: 'Términos y condiciones de uso de UrbanBlade: reservas, cancelaciones, pagos y programa de lealtad.',
})

const lastUpdated = '6 de septiembre de 2026'
</script>

<template>
  <article>
    <p class="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-gold">Condiciones de uso</p>
    <h1 class="mb-2 text-3xl font-black uppercase tracking-tight text-ink sm:text-4xl">Términos y <span class="text-gold">Condiciones</span></h1>
    <p class="mb-8 text-xs text-muted">Última actualización: {{ lastUpdated }}</p>

    <div class="mb-10 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5 text-sm leading-relaxed text-amber-200">
      <p class="mb-1 font-bold uppercase tracking-wide">Borrador — pendiente de revisión legal</p>
      <p>
        Estos términos cubren lo esencial para operar (reservas, pagos, conducta, responsabilidad), pero
        UrbanBlade es hoy un proyecto escolar sin razón social constituida. Antes de operar como negocio real,
        este documento debe ser revisado por un abogado.
      </p>
    </div>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">1. Aceptación de los términos</h2>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      Al crear una cuenta o usar cualquier funcionalidad de UrbanBlade (reservar citas, comprar productos,
      participar en el programa de lealtad) aceptas estos Términos y Condiciones y nuestro
      <NuxtLink to="/privacidad" class="text-gold hover:underline">Aviso de Privacidad</NuxtLink>. Si no estás de
      acuerdo, por favor no uses el servicio.
    </p>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">2. Descripción del servicio</h2>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      UrbanBlade es una plataforma para agendar citas de barbería, comprar productos de grooming y acumular
      puntos de lealtad. Nos reservamos el derecho de agregar, modificar o retirar funcionalidades en cualquier
      momento, notificándolo cuando el cambio sea relevante para ti.
    </p>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">3. Cuentas de usuario</h2>
    <ul class="mb-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
      <li>Debes proporcionar información veraz al registrarte y mantenerla actualizada.</li>
      <li>Eres responsable de la confidencialidad de tu contraseña y de toda actividad realizada desde tu cuenta.</li>
      <li>Puedes iniciar sesión con correo/contraseña o con tu cuenta de Google.</li>
      <li>Podemos suspender o cancelar cuentas que incumplan estos términos o que se usen de forma fraudulenta.</li>
    </ul>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">4. Reservas, cancelaciones e inasistencias</h2>
    <ul class="mb-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
      <li>Las citas se agendan sujetas a disponibilidad real del barbero elegido.</li>
      <li>Puedes cancelar o reagendar tu cita desde tu panel; te pedimos avisar con la mayor anticipación posible.</li>
      <li>Las inasistencias repetidas sin aviso pueden afectar tu elegibilidad para reservar con anticipación en el futuro.</li>
      <li>Nos reservamos el derecho de cancelar o reagendar una cita por causas de fuerza mayor, avisándote lo antes posible.</li>
    </ul>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">5. Métodos de pago</h2>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      Aceptamos pago en efectivo en sucursal, transferencia bancaria (verificada mediante el comprobante que
      subes) y tarjeta a través de Stripe (función en beta). El precio cobrado siempre se calcula del lado del
      servidor a partir del precio real del servicio o producto — nunca de un monto que tú envíes — para
      protegerte a ti y a nosotros de errores o manipulación. Los descuentos por nivel de lealtad y el canje de
      puntos se aplican automáticamente cuando corresponde, antes de confirmar el cobro.
    </p>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">6. Programa de lealtad</h2>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      Ganas puntos de lealtad por citas completadas y otras acciones dentro de la plataforma (por ejemplo, dejar
      una reseña). Los puntos no tienen valor monetario fuera de UrbanBlade, no son transferibles a otra cuenta
      y pueden canjearse como descuento hasta el porcentaje máximo permitido en cada cobro. Nos reservamos el
      derecho de ajustar las reglas del programa avisando con anticipación razonable.
    </p>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">7. Conducta del usuario</h2>
    <p class="mb-3 text-sm leading-relaxed text-muted">Al usar UrbanBlade te comprometes a no:</p>
    <ul class="mb-4 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
      <li>Usar la plataforma para fines fraudulentos o ilegales.</li>
      <li>Publicar reseñas o comentarios falsos, difamatorios u ofensivos.</li>
      <li>Intentar acceder sin autorización a cuentas de otros usuarios o a partes restringidas del sistema.</li>
      <li>Interferir con el funcionamiento normal del servicio (por ejemplo, mediante bots o scraping masivo).</li>
    </ul>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">8. Propiedad intelectual</h2>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      El nombre UrbanBlade, el logotipo, las mascotas (Nava, Bladebot, Bruno) y el diseño del sitio son
      propiedad de UrbanBlade y no pueden reproducirse ni usarse comercialmente sin autorización previa por
      escrito.
    </p>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">9. Limitación de responsabilidad</h2>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      UrbanBlade pone su mejor esfuerzo en ofrecer un servicio confiable, pero no garantiza que la plataforma
      esté libre de interrupciones o errores en todo momento. En la medida permitida por la ley, no somos
      responsables por daños indirectos derivados del uso o la imposibilidad de uso del servicio, salvo en los
      casos en que la legislación mexicana disponga lo contrario de forma imperativa.
    </p>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">10. Modificaciones a estos términos</h2>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      Podemos actualizar estos Términos y Condiciones. Los cambios relevantes se notificarán por correo o
      mediante un aviso visible en el sitio antes de que entren en vigor. Seguir usando UrbanBlade después de un
      cambio implica tu aceptación de los nuevos términos.
    </p>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">11. Ley aplicable y jurisdicción</h2>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      Estos términos se rigen por las leyes de los Estados Unidos Mexicanos. Cualquier controversia se someterá
      a los tribunales competentes de la Ciudad de México, renunciando a cualquier otro fuero que pudiera
      corresponder por razón de domicilio presente o futuro.
    </p>

    <h2 class="mb-3 mt-10 text-xl font-black uppercase tracking-tight text-ink">12. Contacto</h2>
    <p class="mb-4 text-sm leading-relaxed text-muted">
      Dudas sobre estos términos: <a href="mailto:hola@urbanblade.com" class="text-gold hover:underline">hola@urbanblade.com</a>
      o +52 55 1234 5678.
    </p>
  </article>
</template>
