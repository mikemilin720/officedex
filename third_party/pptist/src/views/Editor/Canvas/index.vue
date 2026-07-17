<template>
  <div
    class="canvas"
    ref="canvasRef"
    @wheel="$event => handleMousewheelCanvas($event)"
    @mousedown="$event => fastRenderMode ? undefined : handleClickBlankArea($event)"
    @dblclick="$event => fastRenderMode ? undefined : handleDblClick($event)"
    v-contextmenu="fastRenderMode ? undefined : contextmenus"
    v-click-outside="removeEditorAreaFocus"
  >
    <ElementCreateSelection
      v-if="creatingElement && !fastRenderMode"
      @created="data => insertElementFromCreateSelection(data)"
    />
    <ShapeCreateCanvas
      v-if="creatingCustomShape && !fastRenderMode"
      @created="data => insertCustomShape(data)"
    />
    <div
      v-if="fastRenderMode"
      class="viewport-wrapper embed-readonly-viewport-wrapper"
      :style="{
        width: viewportStyles.width * canvasScale + 'px',
        height: viewportStyles.height * canvasScale + 'px',
        left: viewportStyles.left + 'px',
        top: viewportStyles.top + 'px',
      }"
    >
      <img
        v-if="fastCanvasImageSrc"
        class="embed-readonly-slide-image"
        :src="fastCanvasImageSrc"
        draggable="false"
      />
      <div
        v-else
        ref="fastSlideRasterRef"
        class="embed-readonly-raster-source"
      >
        <ThumbnailSlide
          v-if="currentSlide"
          class="embed-readonly-slide"
          :slide="fastCanvasSlide"
          :size="viewportStyles.width * canvasScale"
        />
      </div>
    </div>
    <div
      v-else
      class="viewport-wrapper"
      :style="{
        width: viewportStyles.width * canvasScale + 'px',
        height: viewportStyles.height * canvasScale + 'px',
        left: viewportStyles.left + 'px',
        top: viewportStyles.top + 'px',
      }"
    >
      <!-- Slide background must render in all modes (incl. embed); keep it out of
           the editor-only .operates block so the embed preview shows backgrounds. -->
      <ViewportBackground />
      <div class="operates" v-if="!fastRenderMode">
        <AlignmentLine 
          v-for="(line, index) in alignmentLines" 
          :key="index" 
          :type="line.type" 
          :axis="line.axis" 
          :length="line.length"
          :canvasScale="canvasScale"
        />
        <MultiSelectOperate 
          v-if="activeElementIdList.length > 1"
          :elementList="elementList"
          :scaleMultiElement="scaleMultiElement"
          :rotateGroupElement="rotateGroupElement"
        />
        <Operate
          v-for="element in elementList" 
          :key="element.id"
          :elementInfo="element"
          :isSelected="activeElementIdList.includes(element.id)"
          :isActive="handleElementId === element.id"
          :isActiveGroupElement="activeGroupElementId === element.id"
          :isMultiSelect="activeElementIdList.length > 1"
          :rotateElement="rotateElement"
          :scaleElement="scaleElement"
          :dragLineElement="dragLineElement"
          :moveShapeKeypoint="moveShapeKeypoint"
          v-show="!hiddenElementIdList.includes(element.id)"
        />
        <ElementFloatLayer
          :elementList="elementList"
          :canvasRef="canvasRef"
          :viewportStyles="viewportStyles"
          :openLinkDialog="openLinkDialog"
        />
      </div>

      <div 
        class="viewport" 
        ref="viewportRef"
        :style="{ transform: `scale(${canvasScale})` }"
      >
        <MouseSelection 
          v-if="mouseSelectionVisible"
          :top="mouseSelection.top" 
          :left="mouseSelection.left" 
          :width="mouseSelection.width" 
          :height="mouseSelection.height" 
          :quadrant="mouseSelectionQuadrant"
        />      
        <EditableElement 
          v-for="(element, index) in elementList" 
          :key="element.id"
          :elementInfo="element"
          :elementIndex="index + 1"
          :isMultiSelect="activeElementIdList.length > 1"
          :selectElement="selectElement"
          :openLinkDialog="openLinkDialog"
          v-show="!hiddenElementIdList.includes(element.id)"
        />
      </div>
    </div>

    <div class="drag-mask" v-if="spaceKeyState && !fastRenderMode"></div>

    <Ruler :viewportStyles="viewportStyles" :elementList="elementList" v-if="showRuler && !fastRenderMode" />

    <Modal
      v-model:visible="linkDialogVisible" 
      :width="540"
    >
      <LinkDialog @close="linkDialogVisible = false" />
    </Modal>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch, watchEffect, useTemplateRef } from 'vue'
import { throttle } from 'lodash'
import { toPng } from 'html-to-image'
import { storeToRefs } from 'pinia'
import { useMainStore, useSlidesStore, useKeyboardStore } from '@/store'
import type { ContextmenuItem } from '@/components/Contextmenu/types'
import type { PPTElement, PPTShapeElement, Slide } from '@/types/slides'
import type { AlignmentLineProps, CreateCustomShapeData } from '@/types/edit'
import { injectKeySlideScale } from '@/types/injectKey'
import { removeAllRanges } from '@/utils/selection'
import { KEYS } from '@/configs/hotkey'

import useViewportSize from './hooks/useViewportSize'
import useMouseSelection from './hooks/useMouseSelection'
import useDrop from './hooks/useDrop'
import useRotateElement from './hooks/useRotateElement'
import useRotateGroupElement from './hooks/useRotateGroupElement'
import useScaleElement from './hooks/useScaleElement'
import useSelectAndMoveElement from './hooks/useSelectElement'
import useDragElement from './hooks/useDragElement'
import useDragLineElement from './hooks/useDragLineElement'
import useMoveShapeKeypoint from './hooks/useMoveShapeKeypoint'
import useInsertFromCreateSelection from './hooks/useInsertFromCreateSelection'

import useDeleteElement from '@/hooks/useDeleteElement'
import useCopyAndPasteElement from '@/hooks/useCopyAndPasteElement'
import useSelectElement from '@/hooks/useSelectElement'
import useScaleCanvas from '@/hooks/useScaleCanvas'
import useScreening from '@/hooks/useScreening'
import useSlideHandler from '@/hooks/useSlideHandler'
import useCreateElement from '@/hooks/useCreateElement'
import { getFastCanvasSlide } from '@/utils/pptxPerformanceMode'

import EditableElement from './EditableElement.vue'
import MouseSelection from './MouseSelection.vue'
import ViewportBackground from './ViewportBackground.vue'
import ThumbnailSlide from '@/views/components/ThumbnailSlide/index.vue'
import ElementFloatLayer from './ElementFloatLayer/index.vue'
import AlignmentLine from './AlignmentLine.vue'
import Ruler from './Ruler.vue'
import ElementCreateSelection from './ElementCreateSelection.vue'
import ShapeCreateCanvas from './ShapeCreateCanvas.vue'
import MultiSelectOperate from './Operate/MultiSelectOperate.vue'
import Operate from './Operate/index.vue'
import LinkDialog from './LinkDialog.vue'
import Modal from '@/components/Modal.vue'
import message from '@/utils/message'

const FAST_CANVAS_RASTER_CACHE_MIN_ELEMENTS = 1000
const FAST_CANVAS_RASTER_CACHE_LIMIT = 20
const FAST_CANVAS_RASTER_CACHE = new Map<string, string>()

const getFastCanvasRasterCacheKey = (slide: Slide | null | undefined, size: number) => {
  if (!slide?.id) return ''
  const elements = slide.elements || []
  return [
    slide.id,
    elements.length,
    Math.round(size),
    elements[0]?.id || '',
    elements[elements.length - 1]?.id || '',
  ].join(':')
}

const rememberFastCanvasRaster = (key: string, src: string) => {
  if (!key || !src) return
  if (FAST_CANVAS_RASTER_CACHE.has(key)) FAST_CANVAS_RASTER_CACHE.delete(key)
  FAST_CANVAS_RASTER_CACHE.set(key, src)

  while (FAST_CANVAS_RASTER_CACHE.size > FAST_CANVAS_RASTER_CACHE_LIMIT) {
    const oldestKey = FAST_CANVAS_RASTER_CACHE.keys().next().value
    if (!oldestKey) break
    FAST_CANVAS_RASTER_CACHE.delete(oldestKey)
  }
}

const mainStore = useMainStore()
const {
  activeElementIdList,
  activeGroupElementId,
  handleElementId,
  hiddenElementIdList,
  editorAreaFocus,
  gridLineSize,
  showRuler,
  showBubbleMenu,
  creatingElement,
  creatingCustomShape,
  canvasScale,
  textFormatPainter,
  embedMode,
  embedEditable,
  pptxPerformanceMode,
} = storeToRefs(mainStore)
const readonlyEmbedMode = computed(() => embedMode.value && !embedEditable.value)
const fastRenderMode = computed(() => readonlyEmbedMode.value || (pptxPerformanceMode.value && !embedEditable.value))
const { currentSlide, viewportRatio, viewportSize } = storeToRefs(useSlidesStore())
const fastCanvasSlide = computed<Slide>(() => getFastCanvasSlide(currentSlide.value) as Slide)
const { ctrlKeyState, spaceKeyState } = storeToRefs(useKeyboardStore())
const fastSlideRasterRef = useTemplateRef<HTMLElement>('fastSlideRasterRef')
const fastCanvasImageSrc = ref('')
let fastCanvasRasterVersion = 0

const viewportRef = useTemplateRef<HTMLElement>('viewportRef')
const alignmentLines = ref<AlignmentLineProps[]>([])

const linkDialogVisible = ref(false)
const openLinkDialog = () => linkDialogVisible.value = true

watch(handleElementId, () => {
  mainStore.setActiveGroupElementId('')
})

const elementList = ref<PPTElement[]>([])
const setLocalElementList = () => {
  if (fastRenderMode.value) {
    elementList.value = []
    return
  }
  elementList.value = currentSlide.value ? JSON.parse(JSON.stringify(currentSlide.value.elements)) : []
}
watchEffect(setLocalElementList)

const canvasRef = useTemplateRef<HTMLElement>('canvasRef')
const { dragViewport, viewportStyles } = useViewportSize(canvasRef)
const fastCanvasRasterSize = computed(() => viewportStyles.value.width * canvasScale.value)
const fastCanvasRasterCacheKey = computed(() => getFastCanvasRasterCacheKey(currentSlide.value, fastCanvasRasterSize.value))
const fastCanvasShouldRasterCache = computed(() => {
  return fastRenderMode.value && (currentSlide.value?.elements?.length || 0) >= FAST_CANVAS_RASTER_CACHE_MIN_ELEMENTS
})

watch(
  [fastCanvasRasterCacheKey, fastCanvasShouldRasterCache],
  ([cacheKey, shouldCache]) => {
    fastCanvasRasterVersion++
    fastCanvasImageSrc.value = shouldCache && cacheKey ? FAST_CANVAS_RASTER_CACHE.get(cacheKey) || '' : ''
  },
  { immediate: true },
)

watch(
  [fastCanvasRasterCacheKey, fastCanvasShouldRasterCache, fastCanvasImageSrc],
  ([cacheKey, shouldCache, cachedSrc]) => {
    if (!shouldCache || !cacheKey || cachedSrc) return
    const captureVersion = ++fastCanvasRasterVersion

    void nextTick(() => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (captureVersion !== fastCanvasRasterVersion) return
          const el = fastSlideRasterRef.value
          if (!el) return

          toPng(el, {
            pixelRatio: 1,
            skipAutoScale: true,
            cacheBust: false,
          })
            .then(src => {
              if (captureVersion !== fastCanvasRasterVersion) return
              rememberFastCanvasRaster(cacheKey, src)
              fastCanvasImageSrc.value = src
              console.info('[PPTist][Canvas]', 'fast-canvas-raster-cache:set', {
                slideId: currentSlide.value?.id,
                elements: currentSlide.value?.elements?.length || 0,
                cacheSize: FAST_CANVAS_RASTER_CACHE.size,
              })
            })
            .catch(err => {
              console.warn('[PPTist][Canvas] fast canvas raster cache failed', err)
            })
        })
      })
    })
  },
  { immediate: true },
)

useDrop(canvasRef)

const { mouseSelection, mouseSelectionVisible, mouseSelectionQuadrant, updateMouseSelection } = useMouseSelection(elementList, viewportRef)

const { dragElement } = useDragElement(elementList, alignmentLines, canvasScale)
const { dragLineElement } = useDragLineElement(elementList)
const { selectElement } = useSelectAndMoveElement(elementList, dragElement)
const { scaleElement, scaleMultiElement } = useScaleElement(elementList, alignmentLines, canvasScale)
const { rotateElement } = useRotateElement(elementList, viewportRef, canvasScale)
const { rotateGroupElement } = useRotateGroupElement(elementList, viewportRef, canvasScale)
const { moveShapeKeypoint } = useMoveShapeKeypoint(elementList, canvasScale)

const { selectAllElements } = useSelectElement()
const { deleteAllElements } = useDeleteElement()
const { pasteElement } = useCopyAndPasteElement()
const { enterScreeningFromStart } = useScreening()
const { updateSlideIndex } = useSlideHandler()
const { createTextElement, createShapeElement } = useCreateElement()

// 组件渲染时，如果存在元素焦点，需要清除
// 这种情况存在于：有焦点元素的情况下进入了放映模式，再退出时，需要清除原先的焦点（因为可能已经切换了页面）
onMounted(() => {
  if (activeElementIdList.value.length) {
    nextTick(() => mainStore.setActiveElementIdList([]))
  }
})

// 点击画布的空白区域：清空焦点元素、设置画布焦点、清除文字选区、清空格式刷状态
const handleClickBlankArea = (e: MouseEvent) => {
  if (activeElementIdList.value.length) mainStore.setActiveElementIdList([])

  if (!spaceKeyState.value) updateMouseSelection(e)
  else dragViewport(e)

  if (!editorAreaFocus.value) mainStore.setEditorareaFocus(true)
  if (textFormatPainter.value) mainStore.setTextFormatPainter(null)
  removeAllRanges()
}

// 双击空白处插入文本
const handleDblClick = (e: MouseEvent) => {
  if (activeElementIdList.value.length || creatingElement.value || creatingCustomShape.value) return
  if (!viewportRef.value) return

  const viewportRect = viewportRef.value.getBoundingClientRect()
  const left = (e.pageX - viewportRect.x) / canvasScale.value
  const top = (e.pageY - viewportRect.y) / canvasScale.value

  createTextElement({
    left,
    top,
    width: 200 / canvasScale.value, // 除以 canvasScale 是为了与点击选区创建的形式保持相同的宽度
    height: 0,
  })
}

// 画布注销时清空格式刷状态
onUnmounted(() => {
  if (textFormatPainter.value) mainStore.setTextFormatPainter(null)
})

// 移除画布编辑区域焦点
const removeEditorAreaFocus = () => {
  if (editorAreaFocus.value) mainStore.setEditorareaFocus(false)
}

// 滚动鼠标
const { scaleCanvas } = useScaleCanvas()
const throttleScaleCanvas = throttle(scaleCanvas, 100, { leading: true, trailing: false })
const throttleUpdateSlideIndex = throttle(updateSlideIndex, 300, { leading: true, trailing: false })

const handleMousewheelCanvas = (e: WheelEvent) => {
  e.preventDefault()

  // 按住Ctrl键时：缩放画布
  if (ctrlKeyState.value) {
    if (e.deltaY > 0) throttleScaleCanvas('-')
    else if (e.deltaY < 0) throttleScaleCanvas('+')
  }
  // 上下翻页
  else {
    if (e.deltaY > 0) throttleUpdateSlideIndex(KEYS.DOWN)
    else if (e.deltaY < 0) throttleUpdateSlideIndex(KEYS.UP)
  }
}

// 开关标尺
const toggleRuler = () => {
  mainStore.setRulerState(!showRuler.value)
}

// 开关浮动菜单
const toggleBubbleMenu = () => {
  mainStore.setBubbleMenuState(!showBubbleMenu.value)
  message.success(`元素气泡菜单已${showBubbleMenu.value ? '启用' : '禁用'}`)
}

// 在鼠标绘制的范围插入元素
const { insertElementFromCreateSelection, formatCreateSelection } = useInsertFromCreateSelection(viewportRef)

// 插入自定义任意多边形
const insertCustomShape = (data: CreateCustomShapeData) => {
  const {
    start,
    end,
    path,
    viewBox,
  } = data
  const position = formatCreateSelection({ start, end })
  if (position) {
    const supplement: Partial<PPTShapeElement> = {}
    if (data.fill) supplement.fill = data.fill
    if (data.outline) supplement.outline = data.outline
    createShapeElement(position, { path, viewBox }, supplement)
  }

  mainStore.setCreatingCustomShapeState(false)
}

const contextmenus = (): ContextmenuItem[] => {
  return [
    {
      text: '粘贴',
      subText: 'Ctrl + V',
      handler: pasteElement,
    },
    {
      text: '全选',
      subText: 'Ctrl + A',
      handler: selectAllElements,
    },
    {
      text: '标尺',
      subText: showRuler.value ? '√' : '',
      handler: toggleRuler,
    },
    {
      text: '网格线',
      handler: () => mainStore.setGridLineSize(gridLineSize.value ? 0 : 50),
      children: [
        {
          text: '无',
          subText: gridLineSize.value === 0 ? '√' : '',
          handler: () => mainStore.setGridLineSize(0),
        },
        {
          text: '小',
          subText: gridLineSize.value === 25 ? '√' : '',
          handler: () => mainStore.setGridLineSize(25),
        },
        {
          text: '中',
          subText: gridLineSize.value === 50 ? '√' : '',
          handler: () => mainStore.setGridLineSize(50),
        },
        {
          text: '大',
          subText: gridLineSize.value === 100 ? '√' : '',
          handler: () => mainStore.setGridLineSize(100),
        },
      ],
    },
    {
      text: '重置当前页',
      handler: deleteAllElements,
    },
    {
      text: '气泡菜单',
      subText: showBubbleMenu.value ? '√' : '',
      handler: toggleBubbleMenu,
    },
    { divider: true },
    {
      text: '幻灯片放映',
      subText: 'F5',
      handler: enterScreeningFromStart,
    },
  ]
}

provide(injectKeySlideScale, canvasScale)
</script>

<style lang="scss" scoped>
.canvas {
  height: 100%;
  user-select: none;
  overflow: hidden;
  background-color: $lightGray;
  position: relative;
}
.drag-mask {
  cursor: grab;
  @include absolute-0();
}
.viewport-wrapper {
  position: absolute;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.01), 0 0 12px 0 rgba(0, 0, 0, 0.1);
}
.embed-readonly-raster-source,
.embed-readonly-slide-image {
  width: 100%;
  height: 100%;
}
.embed-readonly-slide-image {
  display: block;
  object-fit: fill;
  pointer-events: none;
}
.viewport {
  position: absolute;
  top: 0;
  left: 0;
  transform-origin: 0 0;
}
</style>
