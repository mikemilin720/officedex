<template>
  <div class="slide-preview" ref="containerRef">
    <ThumbnailSlide
      v-if="previewSlide"
      :slide="previewSlide"
      :size="containerWidth"
      :visible="true"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { useSlidesStore } from '@/store'
import type { Slide } from '@/types/slides'
import ThumbnailSlide from './components/ThumbnailSlide/index.vue'

const slidesStore = useSlidesStore()
const containerRef = ref<HTMLElement | null>(null)
const containerWidth = ref(416)
const previewSlide = ref<Slide | null>(null)

function updateSize() {
  if (containerRef.value) {
    containerWidth.value = containerRef.value.clientWidth || 416
  }
}

function onMessage(e: MessageEvent) {
  const data = e.data
  if (!data || typeof data.type !== 'string') return

  if (data.type === 'pptist:preview-set-slide' && data.slide) {
    previewSlide.value = data.slide
    slidesStore.setSlides([data.slide])
    nextTick(updateSize)
  }
}

onMounted(() => {
  updateSize()
  window.addEventListener('message', onMessage)
  window.addEventListener('resize', updateSize)
  window.parent?.postMessage({ type: 'pptist:preview-ready' }, '*')
})

onUnmounted(() => {
  window.removeEventListener('message', onMessage)
  window.removeEventListener('resize', updateSize)
})
</script>

<style scoped>
.slide-preview {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
