import { ref, watch, type Ref, onUnmounted } from 'vue'

export function useDebounce<T>(source: Ref<T>, delay = 350): Readonly<Ref<T>> {
  const debounced = ref(source.value) as Ref<T>
  let timer: ReturnType<typeof setTimeout> | undefined

  const stop = watch(source, (v) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      debounced.value = v
    }, delay)
  }, { flush: 'post' })

  onUnmounted(() => {
    if (timer) clearTimeout(timer)
    stop()
  })

  return debounced
}
