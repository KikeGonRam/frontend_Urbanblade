<template>
  <div>
    <NuxtLoadingIndicator :height="2.5" :throttle="150" :duration="2500" color="#d4af37" />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage>
        <template #default="{ Component, route }">
          <Transition name="ub-page" mode="out-in" appear :duration="{ enter: 140, leave: 90 }">
            <component :is="Component" :key="route.fullPath" />
          </Transition>
        </template>
      </NuxtPage>
    </NuxtLayout>
    <UiConfirmModal />
  </div>
</template>

<style>
.ub-page-enter-active,
.ub-page-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}
.ub-page-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.ub-page-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}
</style>
