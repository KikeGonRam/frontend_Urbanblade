<script setup lang="ts">
/*
 * Landing pública — puerto de barber/resources/views/welcome.blade.php
 * (ver .claude/skills/landing-page-plan/SKILL.md para el detalle de fases).
 * Diferencia deliberada frente al original: usa los tokens de tema (bg-main/bg-panel/text-gold/...)
 * en vez de hex fijos, así que respeta los 4 temas del selector en vez de quedar siempre en negro.
 *
 * Esta página solo orquesta: los datos viven en los composables useLanding*, cada sección es un
 * componente de components/landing/ y los efectos (reveal, paralaje, scroll) están aparte, de modo
 * que ningún archivo concentra toda la portada.
 *
 * /services, /barbers y /barbershop (CatalogController) son públicas sin token. El catálogo público
 * completo vive en /servicios y /equipo(/[slug]); aquí solo hay la vista previa. Todos los CTA de
 * reserva van a /reservar, que muestra disponibilidad real sin cuenta y solo pide sesión al confirmar.
 */
import { disconnectReveal, vReveal } from '~/composables/useLandingReveal'

const mobileMenuOpen = ref(false)
const { scrolled, showBar } = useLandingScroll()

const {
  ready, servicesAll, servicesPending, barbers, barbersPending, fewBarbers,
  shop, publicStats, statItems, priceRange,
} = useLandingData()
const { contactInfo, socials, mapAddress, openingHours } = useLandingBusiness(shop)

useLandingSeo({ shop, openingHours, priceRange, socials, publicStats })
useLandingAnchor(servicesPending, barbersPending)
onBeforeUnmount(disconnectReveal)

await ready
</script>

<template>
  <div class="min-h-screen bg-main font-sans text-ink">
    <LandingNavbar v-model:open="mobileMenuOpen" :scrolled="scrolled" />

    <main id="contenido">
      <LandingHero :stats="statItems" />
      <LandingSteps />
      <LandingServices :services="servicesAll" :pending="servicesPending" />
      <LandingTeam :barbers="barbers" :pending="barbersPending" :few="fewBarbers" />
      <LandingMobileAppPromo v-reveal class="reveal" />
      <LandingSocialProof v-if="publicStats.reviews > 0" :stats="publicStats" />
      <!-- Bajo el pliegue: se hidrata al acercarse, no compite con la primera pintura. -->
      <LazyLandingContact
        hydrate-on-visible
        :contact-info="contactInfo" :socials="socials" :map-address="mapAddress" :shop-name="shop?.nombre ?? null"
      />
      <LandingFinalCta />
    </main>

    <LandingFooter :shop="shop" :socials="socials" />
    <LandingMobileBar :show="showBar && !mobileMenuOpen" />

    <!-- yieldSpace también cubre el tope de la página (!scrolled): ahí ya está el botón
         "Reservar mi cita" del propio héroe, y en celulares bajos (p.ej. iPhone 375×812)
         la fila de estadísticas cae justo donde la mascota flota fija, tapándola
         -- hallazgo real de un recorrido de usabilidad (27-oct-2026). -->
    <BrandMascotCompanion :yield-space="(showBar || !scrolled) && !mobileMenuOpen" />
  </div>
</template>
