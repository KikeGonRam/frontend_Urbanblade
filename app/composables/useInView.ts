/**
 * true cuando el elemento entra en pantalla (una sola vez). Las gráficas y barras del kit se
 * dibujan hasta entonces para que su animación se vea, en vez de correr fuera de la vista al
 * cargar la página. Sin IntersectionObserver (o con "reducir movimiento") se muestran de una vez.
 */
export function useInView(target: Ref<HTMLElement | null>, rootMargin = "0px 0px -10% 0px") {
  const inView = ref(false);
  let observer: IntersectionObserver | null = null;

  onMounted(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || typeof IntersectionObserver === "undefined" || !target.value) {
      inView.value = true;
      return;
    }
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          inView.value = true;
          observer?.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(target.value);
  });
  onBeforeUnmount(() => observer?.disconnect());

  return inView;
}
