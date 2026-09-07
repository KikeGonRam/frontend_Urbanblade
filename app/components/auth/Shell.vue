<script setup lang="ts">
/*
 * Layout de dos columnas compartido por login/register/forgot-password/
 * reset-password — puerto de barber/resources/views/layouts/guest.blade.php,
 * pero reemplazando la foto de stock de una barbería por las mascotas de
 * UrbanBlade (más identidad de marca, cero dependencia de una imagen externa).
 * Una mascota por página: Nava (login, "welcome back"), Bladebot (register,
 * "únete al equipo"), Bruno (forgot/reset password, "aquí para ayudarte" --
 * mismo criterio que error.vue: Bruno ya es el personaje de "arreglar cosas").
 */
defineProps<{
  mascot: string
  mascotName: string
}>()

defineOptions({ inheritAttrs: false })
</script>

<template>
  <div class="auth-shell">
    <div class="auth-shell__orbit auth-shell__orbit--a" aria-hidden="true" />
    <div class="auth-shell__orbit auth-shell__orbit--b" aria-hidden="true" />

    <div class="auth-shell__grid">
      <section class="auth-shell__brand">
        <NuxtLink to="/" class="auth-shell__logo">
          <BrandBrandMark class="h-11 w-11" />
          <div>
            <span class="auth-shell__logo-name">Urban<strong>Blade</strong></span>
            <span class="auth-shell__logo-tag">Elite Grooming Studio</span>
          </div>
        </NuxtLink>

        <div class="auth-shell__tagline">
          <p class="auth-shell__eyebrow">
            <span aria-hidden="true" />
            Arte &amp; Precisión
          </p>
          <h2 class="auth-shell__headline">
            Donde el
            <span>estilo</span>
            toma vida.
          </h2>
          <p class="auth-shell__subtitle">Más de una década perfeccionando el arte del grooming masculino. Tu próximo gran look comienza aquí.</p>

          <div class="auth-shell__stats">
            <div><p>500<span>+</span></p><span>Clientes felices</span></div>
            <div><p>10<span>+</span></p><span>Años de experiencia</span></div>
            <div><p>4.9</p><span>Calificación</span></div>
          </div>
        </div>

        <figure class="auth-shell__mascot">
          <span class="auth-shell__mascot-halo" aria-hidden="true" />
          <img :src="`/images/mascots/${mascot}`" :alt="`${mascotName}, mascota de UrbanBlade`" draggable="false">
          <figcaption>{{ mascotName }} está aquí para ayudarte</figcaption>
        </figure>
      </section>

      <section class="auth-shell__form-side">
        <div class="auth-shell__mobile-logo">
          <NuxtLink to="/">
            <BrandBrandMark class="mx-auto h-14 w-14" />
          </NuxtLink>
          <h1>Urban<strong>Blade</strong></h1>
          <p>Acceso Exclusivo</p>
        </div>

        <div class="auth-shell__card">
          <slot />
        </div>

        <p class="auth-shell__footer">&copy; {{ new Date().getFullYear() }} UrbanBlade · Todos los derechos reservados</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.auth-shell {
  position: relative;
  min-height: 100svh;
  overflow: hidden;
  background: #050505;
}
.auth-shell__orbit {
  position: absolute;
  border-radius: 9999px;
  pointer-events: none;
  filter: blur(90px);
}
.auth-shell__orbit--a { top: 8%; left: -8rem; width: 22rem; height: 22rem; background: rgb(var(--gold-rgb) / 0.08); }
.auth-shell__orbit--b { bottom: 12%; right: -4rem; width: 16rem; height: 16rem; background: rgb(var(--gold-rgb) / 0.05); }

.auth-shell__grid {
  position: relative;
  z-index: 1;
  display: grid;
  min-height: 100svh;
}
@media (min-width: 1024px) {
  .auth-shell__grid { grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); }
}

.auth-shell__brand {
  display: none;
  position: relative;
  flex-direction: column;
  justify-content: space-between;
  padding: 3rem 3.5rem;
  background:
    radial-gradient(circle at 15% 20%, rgb(var(--gold-rgb) / 0.05), transparent 26rem),
    #050505;
}
@media (min-width: 1024px) { .auth-shell__brand { display: flex; } }

.auth-shell__logo { display: flex; align-items: center; gap: 0.75rem; width: fit-content; }
.auth-shell__logo-name { display: block; font-weight: 900; text-transform: uppercase; letter-spacing: -0.04em; font-size: 1.25rem; color: #fff; }
.auth-shell__logo-name strong { color: var(--gold); font-weight: 900; }
.auth-shell__logo-tag { display: block; margin-top: -2px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3em; color: var(--muted); }

.auth-shell__tagline { max-width: 30rem; }
.auth-shell__eyebrow { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.25rem; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.4em; color: var(--gold); }
.auth-shell__eyebrow span { display: inline-block; width: 2rem; height: 1px; background: var(--gold); }
.auth-shell__headline { font-size: clamp(2.25rem, 4vw, 3rem); font-weight: 900; text-transform: uppercase; letter-spacing: -0.04em; line-height: 1.05; color: #fff; }
.auth-shell__headline span { display: block; margin-top: 0.25rem; font-family: Georgia, serif; font-style: italic; font-weight: 400; text-transform: none; color: var(--gold); }
.auth-shell__subtitle { margin-top: 1.25rem; max-width: 26rem; font-size: 0.95rem; line-height: 1.7; color: var(--muted); }

.auth-shell__stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; margin-top: 2.5rem; max-width: 26rem; }
.auth-shell__stats > div { padding-left: 1rem; border-left: 2px solid rgb(var(--gold-rgb) / 0.3); }
.auth-shell__stats p { font-size: 1.5rem; font-weight: 900; color: #fff; }
.auth-shell__stats p span { color: var(--gold); }
.auth-shell__stats > div > span { display: block; margin-top: 2px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.15em; color: var(--muted); }

.auth-shell__mascot { position: relative; display: grid; place-items: center; min-height: 14rem; margin-top: 1rem; }
.auth-shell__mascot-halo {
  position: absolute;
  width: min(18rem, 80%);
  aspect-ratio: 1;
  border-radius: 9999px;
  border: 1px solid rgb(var(--gold-rgb) / 0.22);
  background: radial-gradient(circle, rgb(var(--gold-rgb) / 0.13), transparent 67%);
  animation: auth-mascot-halo 5s ease-in-out infinite;
}
.auth-shell__mascot img {
  position: relative;
  z-index: 2;
  width: min(85%, 15rem);
  max-height: 15rem;
  object-fit: contain;
  filter: drop-shadow(0 1.5rem 2.5rem rgba(0, 0, 0, 0.35));
  animation: auth-mascot-float 4.2s ease-in-out infinite;
}
.auth-shell__mascot figcaption {
  position: absolute;
  bottom: 0;
  right: 0;
  z-index: 3;
  border: 1px solid rgb(var(--ink-rgb) / 0.1);
  border-radius: 9999px;
  padding: 0.4rem 0.75rem;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--muted);
  background: rgb(255 255 255 / 0.04);
  backdrop-filter: blur(8px);
}

.auth-shell__form-side {
  display: flex;
  min-height: 100svh;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem;
  background: #080808;
}
.auth-shell__mobile-logo { display: flex; flex-direction: column; align-items: center; margin-bottom: 2rem; }
.auth-shell__mobile-logo h1 { margin-top: 1rem; font-size: 1.5rem; font-weight: 900; text-transform: uppercase; letter-spacing: -0.04em; color: #fff; }
.auth-shell__mobile-logo h1 strong { color: var(--gold); }
.auth-shell__mobile-logo p { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.3em; color: var(--muted); }
@media (min-width: 1024px) { .auth-shell__mobile-logo { display: none; } }

.auth-shell__card {
  position: relative;
  width: 100%;
  max-width: 26rem;
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid rgb(255 255 255 / 0.08);
  background: rgb(15 15 15 / 0.9);
  backdrop-filter: blur(20px);
  padding: 2.5rem 2rem;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8);
}
.auth-shell__card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(to right, transparent, rgb(var(--gold-rgb) / 0.3), transparent);
}

.auth-shell__footer { margin-top: 2rem; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: rgb(255 255 255 / 0.4); }

@keyframes auth-mascot-float { 0%, 100% { transform: translateY(0) rotate(-0.4deg); } 50% { transform: translateY(-10px) rotate(0.5deg); } }
@keyframes auth-mascot-halo { 0%, 100% { opacity: 0.65; transform: scale(0.96); } 50% { opacity: 1; transform: scale(1.04); } }
@media (prefers-reduced-motion: reduce) {
  .auth-shell__mascot img, .auth-shell__mascot-halo { animation: none; }
}
</style>
