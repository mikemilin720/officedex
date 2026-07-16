<template>
  <div
    class="pptist-editor"
    :class="{
      'is-embed-mode': embedMode,
      'is-embed-readonly-mode': readonlyEmbedMode,
      'is-embed-editable-mode': embedMode && embedEditable,
    }"
  >
    <EditorHeader v-if="!embedMode" class="layout-header" />
    <div class="layout-content">
      <Thumbnails :class="readonlyEmbedMode ? 'layout-content-left-offscreen' : 'layout-content-left'" />
      <div class="layout-content-center">
        <CanvasTool v-if="!readonlyEmbedMode" class="center-top" />
        <Canvas class="center-body" :style="{ height: embedMode ? '100%' : `calc(100% - ${remarkHeight + 40}px)` }" />
        <Remark
          v-if="!embedMode"
          class="center-bottom"
          v-model:height="remarkHeight"
          :style="{ height: `${remarkHeight}px` }"
        />
      </div>
      <Toolbar v-if="!embedMode" class="layout-content-right" />
    </div>
  </div>

  <template v-if="!readonlyEmbedMode">
    <SelectPanel v-if="showSelectPanel" />
    <SearchPanel v-if="showSearchPanel" />
    <NotesPanel v-if="showNotesPanel" />
    <MarkupPanel v-if="showMarkupPanel" />
    <SymbolPanel v-if="showSymbolPanel" />
    <ImageLibPanel v-if="showImageLibPanel" />
    <ChartDataEditorDialog />
    <LatexEditorDialog />

    <Modal
      :visible="!!dialogForExport"
      :width="680"
      @closed="closeExportDialog()"
    >
      <ExportDialog />
    </Modal>

    <Modal
      :visible="!!showAIPPTDialog"
      :width="720"
      :closeOnClickMask="false"
      :closeOnEsc="false"
      closeButton
      :wrapStyle="{ opacity: showAIPPTDialog === 'running' ? 0 : 1 }"
      @closed="closeAIPPTDialog()"
    >
      <AIPPTDialog />
    </Modal>
  </template>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useMainStore } from '@/store'
import useGlobalHotkey from '@/hooks/useGlobalHotkey'
import usePasteEvent from '@/hooks/usePasteEvent'

import EditorHeader from './EditorHeader/index.vue'
import Canvas from './Canvas/index.vue'
import CanvasTool from './CanvasTool/index.vue'
import Thumbnails from './Thumbnails/index.vue'
import Toolbar from './Toolbar/index.vue'
import Remark from './Remark/index.vue'
import ChartDataEditorDialog from './ChartDataEditorDialog.vue'
import LatexEditorDialog from './LatexEditorDialog.vue'
import ExportDialog from './ExportDialog/index.vue'
import SelectPanel from './SelectPanel.vue'
import SearchPanel from './SearchPanel.vue'
import NotesPanel from './NotesPanel.vue'
import SymbolPanel from './SymbolPanel.vue'
import MarkupPanel from './MarkupPanel.vue'
import ImageLibPanel from './ImageLibPanel.vue'
import AIPPTDialog from './AIPPTDialog.vue'
import Modal from '@/components/Modal.vue'

const mainStore = useMainStore()
const {
  dialogForExport,
  showSelectPanel,
  showSearchPanel,
  showNotesPanel,
  showSymbolPanel,
  showMarkupPanel,
  showImageLibPanel,
  showAIPPTDialog,
  embedMode,
  embedEditable,
} = storeToRefs(mainStore)
const readonlyEmbedMode = computed(() => embedMode.value && !embedEditable.value)

const closeExportDialog = () => mainStore.setDialogForExport('')
const closeAIPPTDialog = () => mainStore.setAIPPTDialogState(false)

const remarkHeight = ref(40)

useGlobalHotkey()
usePasteEvent()
</script>

<style lang="scss" scoped>
.pptist-editor {
  height: 100%;
}
.layout-header {
  height: 40px;
}
.layout-content {
  height: calc(100% - 40px);
  display: flex;
}
.layout-content-left {
  width: 160px;
  height: 100%;
  flex-shrink: 0;
}
.layout-content-left-offscreen {
  position: fixed;
  left: -9999px;
  top: 0;
  width: 460px;
  height: 100vh;
  pointer-events: none;
  z-index: -1;
  overflow: auto;
}
.layout-content-center {
  position: relative;
  width: calc(100% - 160px - 260px);

  .center-top {
    height: 40px;
  }
}
.is-embed-editable-mode .layout-content-center {
  width: calc(100% - 128px);
  min-width: 0;
  flex: 1 1 auto;
}
.is-embed-editable-mode .layout-content-left {
  width: 128px;
}
.is-embed-editable-mode .center-top {
  position: absolute;
  z-index: 8;
  top: 8px;
  left: 14px;
  right: 14px;
  width: auto;
  height: 32px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
}
.is-embed-editable-mode .center-body {
  height: 100%;
}
.is-embed-readonly-mode .layout-content-center {
  width: 100%;
}
.is-embed-mode .layout-content {
  height: 100%;
}
.layout-content-right {
  width: 260px;
  height: 100%;
}
</style>
