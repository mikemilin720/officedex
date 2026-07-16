import { ref, onMounted, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useSlidesStore } from '@/store'

interface LoadSlidesOptions {
  initialLimit?: number
  batchSize?: number
  delayMs?: number
  resetOnSlidesChange?: boolean
}

export default (options: LoadSlidesOptions = {}) => {
  const { slides } = storeToRefs(useSlidesStore())

  const timer = ref<number | null>(null)
  const initialLimit = options.initialLimit ?? 50
  const batchSize = options.batchSize ?? 20
  const delayMs = options.delayMs ?? 600
  const slidesLoadLimit = ref(initialLimit)

  const clearLoadTimer = () => {
    if (!timer.value) return
    clearTimeout(timer.value)
    timer.value = null
  }

  const loadSlide = () => {
    clearLoadTimer()
    if (slides.value.length > slidesLoadLimit.value) {
      timer.value = setTimeout(() => {
        slidesLoadLimit.value = slidesLoadLimit.value + batchSize
        loadSlide()
      }, delayMs)
    }
    else slidesLoadLimit.value = 9999
  }

  const restartLoadSlide = () => {
    clearLoadTimer()
    slidesLoadLimit.value = initialLimit
    loadSlide()
  }

  onMounted(restartLoadSlide)

  if (options.resetOnSlidesChange) {
    watch(() => slides.value.length, () => restartLoadSlide())
  }

  onUnmounted(() => {
    clearLoadTimer()
  })

  return {
    slidesLoadLimit,
  }
}
