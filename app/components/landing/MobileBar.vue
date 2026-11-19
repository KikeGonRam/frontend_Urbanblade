<script setup lang="ts">
/**
 * Botón fijo de reservar en el teléfono. Se oculta con el menú abierto. Ya sin reservar espacio
 * a la mascota: ella se oculta (yieldSpace) mientras esta barra está en pantalla.
 */
defineProps<{ show: boolean }>()

const { isAuthenticated } = useAuth()
</script>

<template>
  <Transition name="mobile-menu">
    <div v-if="show" class="fixed inset-x-4 bottom-4 z-40 lg:hidden">
      <NuxtLink :to="isAuthenticated ? '/dashboard' : '/reservar'" class="ui-btn min-h-[48px] w-full py-3 text-[12px] tracking-[0.15em] shadow-[0_8px_30px_rgba(0,0,0,0.5)]">
        {{ isAuthenticated ? 'Mi panel' : 'Reservar cita' }}
      </NuxtLink>
    </div>
  </Transition>
</template>

<style scoped>
.mobile-menu-enter-active, .mobile-menu-leave-active { transition: opacity .2s ease, transform .2s ease; }
.mobile-menu-enter-from, .mobile-menu-leave-to { opacity: 0; transform: translateY(-0.75rem); }
</style>
