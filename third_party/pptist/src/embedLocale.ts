export type EmbedLocale = 'en' | 'zh'

const EN_TRANSLATIONS: Record<string, string> = {
  '添加幻灯片': 'Add slide',
  '输入节名称': 'Section name',
  '无标题节': 'Untitled section',
  '默认节': 'Default section',
  '设计': 'Design',
  '切换': 'Transition',
  '动画': 'Animation',
  '样式': 'Style',
  '位置': 'Position',
  '样式（多选）': 'Style (multiple)',
  '位置（多选）': 'Position (multiple)',
  '背景填充': 'Background Fill',
  '纯色填充': 'Solid fill',
  '图片填充': 'Image fill',
  '渐变填充': 'Gradient fill',
  '缩放': 'Fit',
  '拼贴': 'Tile',
  '缩放铺满': 'Cover',
  '线性渐变': 'Linear gradient',
  '径向渐变': 'Radial gradient',
  '当前色块：': 'Current stop:',
  '渐变角度：': 'Gradient angle:',
  '应用背景到全部': 'Apply background to all',
  '全局主题': 'Global Theme',
  '更多': 'More',
  '搜索字体': 'Search fonts',
  '字体：': 'Font:',
  '默认字体': 'Default font',
  '字体颜色：': 'Font color:',
  '背景颜色：': 'Background color:',
  '主题色：': 'Theme colors:',
  '边框样式：': 'Border style:',
  '边框颜色：': 'Border color:',
  '边框粗细：': 'Border width:',
  '水平阴影：': 'Horizontal shadow:',
  '垂直阴影：': 'Vertical shadow:',
  '模糊距离：': 'Blur distance:',
  '阴影颜色：': 'Shadow color:',
  '应用主题到全部': 'Apply theme to all',
  '全局统一字体': 'Unify fonts globally',
  '从幻灯片提取主题': 'Extract theme from slide',
  '预置主题': 'Preset Themes',
  '设置': 'Set',
  '设置并应用': 'Set and apply',
  '文字 Aa': 'Text Aa',
  '画布尺寸：': 'Canvas size:',
  '宽屏 16:9': 'Widescreen 16:9',
  '未命名演示文稿': 'Untitled presentation',
  '点击输入演讲者备注': 'Click to add speaker notes',
  '导入文件': 'Import file',
  '导出文件': 'Export file',
  '重置幻灯片': 'Reset slides',
  '幻灯片类型标注': 'Slide type labels',
  '快捷操作': 'Shortcuts',
  '意见反馈': 'Feedback',
  '常见问题': 'FAQ',
  '从头开始': 'From beginning',
  '从当前页开始': 'From current slide',
  '导出': 'Export',
  '幻灯片放映（F5）': 'Present (F5)',
  'AI生成PPT': 'Generate PPT with AI',
  '输入一句话，智能生成演示文稿': 'Describe your topic and generate a deck',
  '正在渲染页面 ...': 'Rendering page ...',
  '数据初始化中，请稍等 ...': 'Initializing data, please wait ...',
  '正在导入...': 'Importing...',
  '注：本站仅作测试/演示，不提供任何形式的服务': 'Note: this site is for testing/demo only and does not provide services.',
  '导出范围：': 'Export range:',
  '全部': 'All',
  '当前页': 'Current slide',
  '自定义': 'Custom',
  '导出模式：': 'Export mode:',
  '标准版': 'Standard',
  '纯图版': 'Image only',
  '自定义范围：': 'Custom range:',
  '忽略音频/视频：': 'Ignore audio/video:',
  '覆盖默认母版：': 'Override default master:',
  '导出 PPTX': 'Export PPTX',
  '关闭': 'Close',
  '取消': 'Cancel',
  '确认': 'Confirm',
  '删除': 'Delete',
  '移除': 'Remove',
  '更换': 'Change',
  '替换': 'Replace',
  '全部替换': 'Replace all',
  '输入查找内容': 'Find text',
  '输入替换内容': 'Replace with',
  '忽略大小写': 'Match case off',
  '上一个': 'Previous',
  '下一个': 'Next',
  '搜索图片': 'Search images',
  '插入': 'Insert',
  '最近使用：': 'Recent:',
  '输入 LaTeX 公式': 'Enter LaTeX formula',
  '公式预览': 'Formula preview',
  '输入回复内容': 'Enter reply',
  '回复': 'Reply',
  '本页暂无批注': 'No comments on this slide',
  '清空本页批注': 'Clear comments on this slide',
  '添加批注': 'Add comment',
  '本页无内容': 'No content on this slide',
  '全部显示': 'Show all',
  '全部隐藏': 'Hide all',
  '组合': 'Group',
  '文本': 'Text',
  '图片': 'Image',
  '形状': 'Shape',
  '线条': 'Line',
  '图表': 'Chart',
  '表格': 'Table',
  '视频': 'Video',
  '音频': 'Audio',
  '公式': 'Formula',
  '应用到全部': 'Apply to all',
  '已应用到全部': 'Applied to all',
  '无': 'None',
  '随机': 'Random',
  '左右推移': 'Horizontal push',
  '上下推移': 'Vertical push',
  '左右推移（3D）': 'Horizontal push (3D)',
  '上下推移（3D）': 'Vertical push (3D)',
  '淡入淡出': 'Fade',
  '旋转': 'Rotate',
  '上下展开': 'Expand vertically',
  '左右展开': 'Expand horizontally',
  '放大': 'Zoom in',
  '缩小': 'Zoom out',
  '入场': 'Entrance',
  '退场': 'Exit',
  '强调': 'Emphasis',
  '添加动画': 'Add animation',
  '选中画布中的元素添加动画': 'Select an element on the canvas to add animation',
  '持续时长：': 'Duration:',
  '触发方式：': 'Trigger:',
  '主动触发': 'On click',
  '与上一动画同时': 'With previous',
  '上一动画之后': 'After previous',
  '更换动画': 'Change animation',
  '停止预览': 'Stop preview',
  '预览全部': 'Preview all',
  '预览': 'Preview',
  '弹跳': 'Bounce',
  '弹跳：': 'Bounce:',
  '弹入': 'Bounce in',
  '向右弹入': 'Bounce in from right',
  '向左弹入': 'Bounce in from left',
  '向上弹入': 'Bounce in from bottom',
  '向下弹入': 'Bounce in from top',
  '弹出': 'Bounce out',
  '向左弹出': 'Bounce out to left',
  '向右弹出': 'Bounce out to right',
  '向上弹出': 'Bounce out to top',
  '向下弹出': 'Bounce out to bottom',
  '浮现': 'Fade',
  '浮现：': 'Fade:',
  '浮入': 'Fade in',
  '向下浮入': 'Fade in down',
  '向下长距浮入': 'Fade in down big',
  '向右浮入': 'Fade in from left',
  '向右长距浮入': 'Fade in from left big',
  '向左浮入': 'Fade in from right',
  '向左长距浮入': 'Fade in from right big',
  '向上浮入': 'Fade in up',
  '向上长距浮入': 'Fade in up big',
  '从左上浮入': 'Fade in from top left',
  '从右上浮入': 'Fade in from top right',
  '从左下浮入': 'Fade in from bottom left',
  '从右下浮入': 'Fade in from bottom right',
  '浮出': 'Fade out',
  '向下浮出': 'Fade out down',
  '向下长距浮出': 'Fade out down big',
  '向左浮出': 'Fade out to left',
  '向左长距浮出': 'Fade out to left big',
  '向右浮出': 'Fade out to right',
  '向右长距浮出': 'Fade out to right big',
  '向上浮出': 'Fade out up',
  '向上长距浮出': 'Fade out up big',
  '从左上浮出': 'Fade out to top left',
  '从右上浮出': 'Fade out to top right',
  '从左下浮出': 'Fade out to bottom left',
  '从右下浮出': 'Fade out to bottom right',
  '旋转：': 'Rotate:',
  '旋转进入': 'Rotate in',
  '绕左下进入': 'Rotate in down left',
  '绕右下进入': 'Rotate in down right',
  '绕左上进入': 'Rotate in up left',
  '绕右上进入': 'Rotate in up right',
  '旋转退出': 'Rotate out',
  '绕左下退出': 'Rotate out down left',
  '绕右下退出': 'Rotate out down right',
  '绕左上退出': 'Rotate out up left',
  '绕右上退出': 'Rotate out up right',
  '缩放：': 'Zoom:',
  '放大进入': 'Zoom in',
  '向下放大进入': 'Zoom in down',
  '从左放大进入': 'Zoom in from left',
  '从右放大进入': 'Zoom in from right',
  '向上放大进入': 'Zoom in up',
  '缩小退出': 'Zoom out',
  '向下缩小退出': 'Zoom out down',
  '从左缩小退出': 'Zoom out to left',
  '从右缩小退出': 'Zoom out to right',
  '向上缩小退出': 'Zoom out up',
  '滑入': 'Slide in',
  '滑入：': 'Slide in:',
  '向下滑入': 'Slide in down',
  '从右滑入': 'Slide in from right',
  '从左滑入': 'Slide in from left',
  '向上滑入': 'Slide in up',
  '滑出': 'Slide out',
  '滑出：': 'Slide out:',
  '向下滑出': 'Slide out down',
  '从左滑出': 'Slide out to left',
  '从右滑出': 'Slide out to right',
  '向上滑出': 'Slide out up',
  '翻转': 'Flip',
  '翻转：': 'Flip:',
  'X轴翻转进入': 'Flip in X',
  'Y轴翻转进入': 'Flip in Y',
  'X轴翻转退出': 'Flip out X',
  'Y轴翻转退出': 'Flip out Y',
  '放大滑入': 'Back in',
  '放大滑入：': 'Back in:',
  '向下放大滑入': 'Back in down',
  '从左放大滑入': 'Back in from left',
  '从右放大滑入': 'Back in from right',
  '向上放大滑入': 'Back in up',
  '缩小滑出': 'Back out',
  '缩小滑出：': 'Back out:',
  '向下缩小滑出': 'Back out down',
  '从左缩小滑出': 'Back out to left',
  '从右缩小滑出': 'Back out to right',
  '向上缩小滑出': 'Back out up',
  '飞入': 'Light speed in',
  '飞入：': 'Light speed in:',
  '从右飞入': 'Light speed in from right',
  '从左飞入': 'Light speed in from left',
  '飞出': 'Light speed out',
  '飞出：': 'Light speed out:',
  '从右飞出': 'Light speed out from right',
  '从左飞出': 'Light speed out from left',
  '晃动：': 'Shake:',
  '左右摇晃': 'Shake horizontally',
  '上下摇晃': 'Shake vertically',
  '摇头': 'Head shake',
  '摆动': 'Swing',
  '晃动': 'Wobble',
  '惊恐': 'Tada',
  '果冻': 'Jello',
  '其他': 'Other',
  '其他：': 'Other:',
  '闪烁': 'Flash',
  '脉搏': 'Pulse',
  '橡皮筋': 'Rubber band',
  '心跳（快）': 'Heartbeat (fast)',
}

export function normalizeEmbedLocale(value: string | null | undefined): EmbedLocale {
  return value?.toLowerCase() === 'en' ? 'en' : 'zh'
}

export function translateEmbedUiText(locale: EmbedLocale, value: string): string {
  if (locale !== 'en') return value
  const trimmed = value.trim()
  if (!trimmed) return value

  const exact = EN_TRANSLATIONS[trimmed]
  if (exact) return value.replace(trimmed, exact)

  const sequenceItem = trimmed.match(/^「(.+)」(.+)$/)
  if (sequenceItem) {
    const elType = translateEmbedUiText(locale, sequenceItem[1])
    const effect = translateEmbedUiText(locale, sequenceItem[2])
    if (elType !== sequenceItem[1] || effect !== sequenceItem[2]) {
      return value.replace(trimmed, `"${elType}" ${effect}`)
    }
  }

  const colonLabel = trimmed.match(/^(.+)：$/)
  if (colonLabel) {
    const label = translateEmbedUiText(locale, colonLabel[1])
    if (label !== colonLabel[1]) return value.replace(trimmed, `${label}:`)
  }

  const slideCount = trimmed.match(/^幻灯片\s*(\d+)\s*\/\s*(\d+)$/)
  if (slideCount) return value.replace(trimmed, `Slide ${slideCount[1]} / ${slideCount[2]}`)

  const slideComments = trimmed.match(/^幻灯片\s*(\d+)\s*的批注$/)
  if (slideComments) return value.replace(trimmed, `Slide ${slideComments[1]} comments`)

  const canvasSize = trimmed.match(/^画布尺寸：\s*(.+)$/)
  if (canvasSize) return value.replace(trimmed, `Canvas size: ${canvasSize[1]}`)

  const aspectRatio = trimmed.match(/^(宽屏|标准)\s*(\d+)\s*:\s*(\d+)$/)
  if (aspectRatio) {
    const prefix = aspectRatio[1] === '宽屏' ? 'Widescreen' : 'Standard'
    return value.replace(trimmed, `${prefix} ${aspectRatio[2]}:${aspectRatio[3]}`)
  }

  const paperSize = trimmed.match(/^纸张\s*(.+)$/)
  if (paperSize) return value.replace(trimmed, `Paper ${paperSize[1]}`)

  const portraitSize = trimmed.match(/^竖向\s*(.+)$/)
  if (portraitSize) return value.replace(trimmed, `Portrait ${portraitSize[1]}`)

  const themeColor = trimmed.match(/^幻灯片主题色\s*(\d+)：$/)
  if (themeColor) return value.replace(trimmed, `Slide theme color ${themeColor[1]}:`)

  const chartThemeColor = trimmed.match(/^主题配色\s*(\d+)：$/)
  if (chartThemeColor) return value.replace(trimmed, `Theme color ${chartThemeColor[1]}:`)

  return value
}

function shouldSkipElement(element: Element | null): boolean {
  return Boolean(element?.closest([
    '.thumbnail-slide .elements',
    '.canvas',
    '.canvas-wrap',
    '.editable-element',
    '.element-content',
    '[contenteditable="true"]',
    'input',
    'textarea',
  ].join(',')))
}

function translateTextNode(locale: EmbedLocale, node: Text) {
  if (shouldSkipElement(node.parentElement)) return
  const translated = translateEmbedUiText(locale, node.nodeValue || '')
  if (translated !== node.nodeValue) node.nodeValue = translated
}

function translateElementAttributes(locale: EmbedLocale, element: Element) {
  if (shouldSkipElement(element)) return
  for (const attr of ['title', 'aria-label', 'placeholder']) {
    const current = element.getAttribute(attr)
    if (!current) continue
    const translated = translateEmbedUiText(locale, current)
    if (translated !== current) element.setAttribute(attr, translated)
  }
}

function translateTree(locale: EmbedLocale, root: ParentNode) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    translateTextNode(locale, node as Text)
    node = walker.nextNode()
  }
  if (root instanceof Element) translateElementAttributes(locale, root)
  root.querySelectorAll?.('[title], [aria-label], [placeholder]').forEach(el => translateElementAttributes(locale, el))
}

export function applyEmbedLocale(locale: EmbedLocale) {
  document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN'
  if (locale !== 'en') return () => {}

  document.body.dataset.embedLocale = locale
  translateTree(locale, document.body)

  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'characterData' && mutation.target instanceof Text) {
        translateTextNode(locale, mutation.target)
      }
      else if (mutation.type === 'attributes' && mutation.target instanceof Element) {
        translateElementAttributes(locale, mutation.target)
      }
      else {
        mutation.addedNodes.forEach(node => {
          if (node instanceof Text) translateTextNode(locale, node)
          else if (node instanceof Element) translateTree(locale, node)
        })
      }
    }
  })

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['title', 'aria-label', 'placeholder'],
  })

  return () => observer.disconnect()
}
