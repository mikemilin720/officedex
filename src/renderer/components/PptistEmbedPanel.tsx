import { useCallback, useEffect, useMemo, useRef, useState, useImperativeHandle, forwardRef } from "react";
import type { PptistDeckSnapshot, PptistEditOp, PptistEditRunResult, PptistElementSelection, PptistEvent, PptistSlide } from "../../shared/pptistProtocol";
import type { Artifact } from "../../shared/types";
import { officecli } from "../bridge";
import { useLocale } from "../i18n";

const PPTIST_URL = "/pptist/index.html?mode=embed&editable=1";
const PPTIST_REVIEW_STYLE_ID = "officedex-pptist-review-styles";
const PPTIST_REVIEW_CSS = `
.pptist-editor.is-embed-readonly-mode .layout-content-left-offscreen {
  position: relative !important;
  left: auto !important;
  top: auto !important;
  width: 160px !important;
  height: 100% !important;
  flex: 0 0 160px !important;
  pointer-events: auto !important;
  z-index: auto !important;
  overflow: hidden !important;
  background: #fff !important;
  border-right: 1px solid #e5e7eb !important;
}

.pptist-editor.is-embed-readonly-mode .layout-content-center {
  width: calc(100% - 160px) !important;
  min-width: 0 !important;
  flex: 1 1 auto !important;
}

.pptist-editor.is-embed-readonly-mode .layout-content-left-offscreen .thumbnails {
  width: 100% !important;
  height: 100% !important;
}

.pptist-editor.is-embed-readonly-mode .layout-content-left-offscreen.thumbnails {
  width: 160px !important;
  height: 100% !important;
}

.pptist-editor.is-embed-readonly-mode .layout-content-left-offscreen .thumbnail-slide {
  width: 118px !important;
  height: 66.375px !important;
  cursor: pointer !important;
  pointer-events: none !important;
}

.pptist-editor.is-embed-readonly-mode .layout-content-left-offscreen .thumbnail-slide * {
  cursor: pointer !important;
  pointer-events: none !important;
}

.pptist-editor.is-embed-readonly-mode .layout-content-left-offscreen .thumbnail-slide .elements {
  transform: scale(0.118) !important;
}

.pptist-editor.is-embed-readonly-mode .layout-content-left-offscreen .thumbnail-item {
  padding: 8px 0 !important;
  cursor: pointer !important;
  pointer-events: auto !important;
}
`;
const SNAPSHOT_REQUEST_TIMEOUT_MS = 8000;
const EDIT_RUN_TIMEOUT_MS = 30000;
const EDIT_RUN_COMPLETION_GRACE_MS = 1200;
const AUTOSAVE_EXPORT_TIMEOUT_MS = 45000;
const SAVE_PPTX_BASE_TIMEOUT_MS = 30000;
const SAVE_PPTX_TIMEOUT_PER_MIB_MS = 2000;
const SAVE_PPTX_MAX_TIMEOUT_MS = 300000;
const PARSED_SLIDES_CACHE_RESPONSE_TIMEOUT_MS = 10000;
const SLIDE_SWITCH_MIN_VISIBLE_MS = 220;
const SLIDE_SWITCH_MAX_VISIBLE_MS = 1800;
const PARSED_ARTIFACT_CACHE_LIMIT = 3;
const PERSISTENT_PARSED_ARTIFACT_CACHE_LIMIT = 3;
const PERSISTENT_PARSED_ARTIFACT_DB = "officedex-pptist-parsed-slides";
const PERSISTENT_PARSED_ARTIFACT_STORE = "parsedSlides";

const parsedArtifactSlidesCache = new Map<string, PptistSlide[]>();

interface PersistentParsedSlidesCache {
  get(key: string): Promise<PptistSlide[] | null>;
  set(key: string, slides: PptistSlide[]): Promise<void>;
  delete(key: string): Promise<void>;
}

let persistentParsedSlidesCacheForTests: PersistentParsedSlidesCache | null | undefined;

export function clearPptistParsedSlidesMemoryCacheForTests() {
  parsedArtifactSlidesCache.clear();
}

export function setPptistParsedSlidesPersistentCacheForTests(cache: PersistentParsedSlidesCache | null) {
  persistentParsedSlidesCacheForTests = cache;
}

function cloneSlides(slides: PptistSlide[]): PptistSlide[] {
  return JSON.parse(JSON.stringify(slides)) as PptistSlide[];
}

function getCachedParsedArtifactSlides(cacheKey: string): PptistSlide[] | null {
  const cached = parsedArtifactSlidesCache.get(cacheKey);
  if (!cached) return null;
  parsedArtifactSlidesCache.delete(cacheKey);
  parsedArtifactSlidesCache.set(cacheKey, cached);
  return cloneSlides(cached);
}

function cacheParsedArtifactSlides(cacheKey: string, slides: PptistSlide[]) {
  if (!cacheKey || slides.length === 0) return;
  parsedArtifactSlidesCache.delete(cacheKey);
  parsedArtifactSlidesCache.set(cacheKey, cloneSlides(slides));
  while (parsedArtifactSlidesCache.size > PARSED_ARTIFACT_CACHE_LIMIT) {
    const oldestKey = parsedArtifactSlidesCache.keys().next().value;
    if (!oldestKey) break;
    parsedArtifactSlidesCache.delete(oldestKey);
  }
}

async function invalidateParsedArtifactSlides(cacheKey: string) {
  if (!cacheKey) return;
  parsedArtifactSlidesCache.delete(cacheKey);
  await persistentParsedSlidesCache().delete(cacheKey);
}

function openParsedSlidesCacheDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(PERSISTENT_PARSED_ARTIFACT_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PERSISTENT_PARSED_ARTIFACT_STORE)) {
        const store = db.createObjectStore(PERSISTENT_PARSED_ARTIFACT_STORE, { keyPath: "key" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onerror = () => resolve(null);
    request.onsuccess = () => resolve(request.result);
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
    request.onsuccess = () => resolve(request.result);
  });
}

function getDefaultPersistentParsedSlidesCache(): PersistentParsedSlidesCache {
  return {
    async get(key: string) {
      if (!key) return null;
      const db = await openParsedSlidesCacheDb();
      if (!db) return null;
      try {
        const tx = db.transaction(PERSISTENT_PARSED_ARTIFACT_STORE, "readwrite");
        const store = tx.objectStore(PERSISTENT_PARSED_ARTIFACT_STORE);
        const record = await requestToPromise<{ key: string; slides: PptistSlide[]; updatedAt: number } | undefined>(store.get(key));
        if (!record?.slides?.length) return null;
        await requestToPromise(store.put({ ...record, updatedAt: Date.now() }));
        return cloneSlides(record.slides);
      } finally {
        db.close();
      }
    },
    async set(key: string, slides: PptistSlide[]) {
      if (!key || slides.length === 0) return;
      const db = await openParsedSlidesCacheDb();
      if (!db) return;
      try {
        const tx = db.transaction(PERSISTENT_PARSED_ARTIFACT_STORE, "readwrite");
        const store = tx.objectStore(PERSISTENT_PARSED_ARTIFACT_STORE);
        await requestToPromise(store.put({ key, slides: cloneSlides(slides), updatedAt: Date.now() }));
        const allKeys = await requestToPromise<IDBValidKey[]>(store.index("updatedAt").getAllKeys());
        const overflow = allKeys.length - PERSISTENT_PARSED_ARTIFACT_CACHE_LIMIT;
        for (let i = 0; i < overflow; i += 1) {
          await requestToPromise(store.delete(allKeys[i]));
        }
      } finally {
        db.close();
      }
    },
    async delete(key: string) {
      if (!key) return;
      const db = await openParsedSlidesCacheDb();
      if (!db) return;
      try {
        const tx = db.transaction(PERSISTENT_PARSED_ARTIFACT_STORE, "readwrite");
        await requestToPromise(tx.objectStore(PERSISTENT_PARSED_ARTIFACT_STORE).delete(key));
      } finally {
        db.close();
      }
    },
  };
}

function persistentParsedSlidesCache(): PersistentParsedSlidesCache {
  return persistentParsedSlidesCacheForTests ?? getDefaultPersistentParsedSlidesCache();
}

function pptistImportLog(event: string, details: Record<string, unknown> = {}, source = "OfficeDex.PPTistImport") {
  const atMs = Math.round(performance.now());
  const entry = { atMs, ...details };
  console.info("[OfficeDex][PPTistImport]", event, entry);
  void Promise.resolve(officecli.recordRendererLog({ source, event, atMs, details })).catch(() => {});
}

function elapsedSince(startedAt: number | null) {
  return startedAt === null ? undefined : Math.round(performance.now() - startedAt);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then(resolve, reject)
      .finally(() => window.clearTimeout(timeout));
  });
}

function savePptxTimeoutMs(byteLength: number): number {
  if (!Number.isFinite(byteLength) || byteLength <= 0) return SAVE_PPTX_BASE_TIMEOUT_MS;
  const mib = Math.ceil(byteLength / (1024 * 1024));
  return Math.min(SAVE_PPTX_MAX_TIMEOUT_MS, SAVE_PPTX_BASE_TIMEOUT_MS + mib * SAVE_PPTX_TIMEOUT_PER_MIB_MS);
}

export interface PptistEmbedPanelHandle {
  gotoSlide: (index: number) => void;
  selectElements: (selection: PptistElementSelection) => void;
  exportPptx: (fileName?: string) => void;
  exportPptxBytes: (fileName?: string) => Promise<{ bytes: Uint8Array; fileName?: string }>;
  getSnapshot: () => Promise<PptistDeckSnapshot>;
  applyEditOps: (ops: PptistEditOp[]) => Promise<PptistEditRunResult>;
}

interface PptistEmbedPanelProps {
  /** Complete, positioned slides (charts/images inlined) streamed from the backend. */
  slides: PptistSlide[];
  /** Final generated PPTX artifact. When present, PPTist parses this file and replays its real slides. */
  artifact?: Artifact;
  animateArtifact?: boolean;
  animateSlides?: boolean;
  slideIds?: string[];
  onSlideChanged?: (index: number, slideId: string) => void;
  onSlideThumbnail?: (slideId: string, dataUrl: string) => void;
  onSlideUpdated?: (slideId: string, slide: PptistSlide) => void;
  onSelectionChanged?: (selection: PptistElementSelection) => void;
  onSlidesLoaded?: (slides: PptistSlide[]) => void;
  /** Called when PPTist finishes typing a page in (so the host can reveal its full content). */
  onSlideTyped?: (index: number, slideId: string) => void;
  onAnimationStarted?: () => void;
  autosaveEnabled?: boolean;
  onAutosaveStateChange?: (state: "idle" | "dirty" | "saving" | "saved" | "failed", message?: string) => void;
  onEditOpStarted?: (index: number, op: PptistEditOp) => void;
  onEditOpApplied?: (index: number, op: PptistEditOp) => void;
  /** Called with the saved file path after a successful client-side export. */
  onExported?: (filePath: string) => void;
  /** Called when a client-side export fails. */
  onExportError?: (message: string) => void;
  thumbnailCapturePaused?: boolean;
  ariaLabel?: string;
}

export const PptistEmbedPanel = forwardRef<PptistEmbedPanelHandle, PptistEmbedPanelProps>(
  function PptistEmbedPanel({
    slides,
    artifact,
    animateArtifact = true,
    animateSlides = true,
    slideIds,
    onSlideChanged,
    onSlideThumbnail,
    onSlideUpdated,
    onSelectionChanged,
    onSlidesLoaded,
    onSlideTyped,
    onAnimationStarted,
    autosaveEnabled = false,
    onAutosaveStateChange,
    onEditOpStarted,
    onEditOpApplied,
    onExported,
    onExportError,
    thumbnailCapturePaused = false,
    ariaLabel,
  }, ref) {
    const locale = useLocale();
    const pptistUrl = useMemo(() => `${PPTIST_URL}&lang=${locale}`, [locale]);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const readyRef = useRef(false);
    const sentSlideIdsRef = useRef<Set<string>>(new Set());
    const pendingRef = useRef<(() => void)[]>([]);
    const onExportErrorRef = useRef(onExportError);
    const onAutosaveStateChangeRef = useRef(onAutosaveStateChange);
    const onEditOpStartedRef = useRef(onEditOpStarted);
    const onEditOpAppliedRef = useRef(onEditOpApplied);
    const onAnimationStartedRef = useRef(onAnimationStarted);
    const artifactRef = useRef(artifact);
    const animateArtifactRef = useRef(animateArtifact);
    const animateSlidesRef = useRef(animateSlides);
    const autosaveEnabledRef = useRef(autosaveEnabled);
    const autosaveInFlightRef = useRef(false);
    const autosavePendingRef = useRef(false);
    const activeAutosaveRequestIdRef = useRef<string | null>(null);
    const activeAutosaveCacheKeyRef = useRef("");
    const requestAutosaveRef = useRef<() => void>(() => {});
    const slideSwitchHideTimerRef = useRef<number | null>(null);
    const slideSwitchFallbackTimerRef = useRef<number | null>(null);
    const exportTimeoutsRef = useRef(new Map<string, number>());
    const requestSeqRef = useRef(0);
    const artifactLoadStartedAtRef = useRef<number | null>(null);
    const artifactLoadPostedAtRef = useRef<number | null>(null);
    const artifactCacheKeyRef = useRef("");
    const artifactLogContextRef = useRef<{ fileName?: string; taskId?: string; runId?: string; byteLength?: number }>({});
    const artifactCacheFallbacksRef = useRef(new Map<string, { fallback: () => void; timeout: number }>());
    const snapshotRequestsRef = useRef(new Map<string, { resolve: (snapshot: PptistDeckSnapshot) => void; reject: (error: Error) => void; timeout: number }>());
    const editRunRequestsRef = useRef(new Map<string, {
      resolve: (result: PptistEditRunResult) => void;
      reject: (error: Error) => void;
      timeout: number;
      completionFallbackTimeout: number | null;
      expectedOps: number;
      appliedIndexes: Set<number>;
    }>());
    const exportByteRequestsRef = useRef(new Map<string, { resolve: (result: { bytes: Uint8Array; fileName?: string }) => void; reject: (error: Error) => void; timeout: number }>());
    const [loading, setLoading] = useState(true);
    const [slideSwitching, setSlideSwitching] = useState(false);
    const artifactKey = artifact
      ? `${artifact.taskId}\u0001${artifact.filePath}\u0001${artifact.fileName}\u0001${artifact.documentType}`
      : "";
    const slideIdsKey = slideIds?.join("\u0001") ?? "";
    const artifactCacheKey = artifactKey ? `${artifactKey}\u0001${slideIdsKey}` : "";
    const thumbnailCaptureEnabled = Boolean(onSlideThumbnail);

    useEffect(() => {
      onExportErrorRef.current = onExportError;
    }, [onExportError]);
    useEffect(() => {
      onAutosaveStateChangeRef.current = onAutosaveStateChange;
    }, [onAutosaveStateChange]);
    useEffect(() => {
      onEditOpStartedRef.current = onEditOpStarted;
    }, [onEditOpStarted]);
    useEffect(() => {
      onEditOpAppliedRef.current = onEditOpApplied;
    }, [onEditOpApplied]);
    useEffect(() => {
      onAnimationStartedRef.current = onAnimationStarted;
    }, [onAnimationStarted]);
    useEffect(() => {
      artifactRef.current = artifact;
    }, [artifact]);
    useEffect(() => {
      animateArtifactRef.current = animateArtifact;
    }, [animateArtifact]);
    useEffect(() => {
      animateSlidesRef.current = animateSlides;
    }, [animateSlides]);
    useEffect(() => {
      autosaveEnabledRef.current = autosaveEnabled;
    }, [autosaveEnabled]);
    useEffect(() => {
      artifactCacheKeyRef.current = artifactCacheKey;
    }, [artifactCacheKey]);
    useEffect(() => {
      setLoading(true);
    }, [artifactKey]);
    useEffect(() => {
      readyRef.current = false;
      pendingRef.current = [];
      sentSlideIdsRef.current.clear();
      setLoading(true);
    }, [pptistUrl]);

    const postToEmbed = useCallback((msg: object, transfer?: Transferable[]) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      if (transfer?.length) {
        win.postMessage(msg, "*", transfer);
      } else {
        win.postMessage(msg, "*");
      }
    }, []);

    const revealEmbedThumbnails = useCallback(() => {
      try {
        const doc = iframeRef.current?.contentDocument ?? iframeRef.current?.contentWindow?.document;
        if (!doc?.head) return;
        let style = doc.getElementById(PPTIST_REVIEW_STYLE_ID) as HTMLStyleElement | null;
        if (!style) {
          style = doc.createElement("style");
          style.id = PPTIST_REVIEW_STYLE_ID;
          doc.head.appendChild(style);
        }
        if (style.textContent !== PPTIST_REVIEW_CSS) style.textContent = PPTIST_REVIEW_CSS;
      } catch {
        // The bundled PPTist iframe is same-origin in OfficeDex. If a future
        // build serves it cross-origin, keep the editor usable instead of
        // failing the whole host component.
      }
    }, []);

    const flushPending = useCallback(() => {
      const fns = pendingRef.current.splice(0);
      fns.forEach((fn) => fn());
    }, []);

    const enqueueOrRun = useCallback((fn: () => void) => {
      if (readyRef.current) {
        fn();
      } else {
        pendingRef.current.push(fn);
      }
    }, []);

    useEffect(() => {
      enqueueOrRun(() => {
        postToEmbed({ type: "pptist:set-thumbnail-capture-paused", paused: thumbnailCapturePaused });
      });
    }, [enqueueOrRun, postToEmbed, thumbnailCapturePaused]);

    useEffect(() => {
      enqueueOrRun(() => {
        postToEmbed({ type: "pptist:set-thumbnail-capture-enabled", enabled: thumbnailCaptureEnabled });
      });
    }, [enqueueOrRun, postToEmbed, thumbnailCaptureEnabled]);

    const nextRequestId = useCallback((prefix: string) => {
      requestSeqRef.current += 1;
      return `${prefix}-${Date.now()}-${requestSeqRef.current}`;
    }, []);

    const failAutosave = useCallback((message: string) => {
      onAutosaveStateChangeRef.current?.("failed", message);
      onExportErrorRef.current?.(message);
    }, []);

    const clearExportTimeout = useCallback((requestId?: string) => {
      if (!requestId) return;
      const timeout = exportTimeoutsRef.current.get(requestId);
      if (!timeout) return;
      window.clearTimeout(timeout);
      exportTimeoutsRef.current.delete(requestId);
    }, []);

    const clearSlideSwitchTimers = useCallback(() => {
      if (slideSwitchHideTimerRef.current !== null) {
        window.clearTimeout(slideSwitchHideTimerRef.current);
        slideSwitchHideTimerRef.current = null;
      }
      if (slideSwitchFallbackTimerRef.current !== null) {
        window.clearTimeout(slideSwitchFallbackTimerRef.current);
        slideSwitchFallbackTimerRef.current = null;
      }
    }, []);

    const showSlideSwitching = useCallback(() => {
      clearSlideSwitchTimers();
      setSlideSwitching(true);
      slideSwitchFallbackTimerRef.current = window.setTimeout(() => {
        slideSwitchFallbackTimerRef.current = null;
        slideSwitchHideTimerRef.current = null;
        setSlideSwitching(false);
      }, SLIDE_SWITCH_MAX_VISIBLE_MS);
    }, [clearSlideSwitchTimers]);

    const takeArtifactCacheFallback = useCallback((runId?: string) => {
      if (!runId) return null;
      const pending = artifactCacheFallbacksRef.current.get(runId);
      if (!pending) return null;
      artifactCacheFallbacksRef.current.delete(runId);
      window.clearTimeout(pending.timeout);
      return pending.fallback;
    }, []);

    const clearArtifactCacheFallback = useCallback((runId?: string) => {
      if (!runId) return;
      const pending = artifactCacheFallbacksRef.current.get(runId);
      if (!pending) return;
      artifactCacheFallbacksRef.current.delete(runId);
      window.clearTimeout(pending.timeout);
    }, []);

    const finishSlideSwitching = useCallback(() => {
      if (slideSwitchHideTimerRef.current !== null) {
        window.clearTimeout(slideSwitchHideTimerRef.current);
      }
      if (slideSwitchFallbackTimerRef.current !== null) {
        window.clearTimeout(slideSwitchFallbackTimerRef.current);
        slideSwitchFallbackTimerRef.current = null;
      }
      slideSwitchHideTimerRef.current = window.setTimeout(() => {
        slideSwitchHideTimerRef.current = null;
        setSlideSwitching(false);
      }, SLIDE_SWITCH_MIN_VISIBLE_MS);
    }, []);

    const finishAutosaveCycle = useCallback((requestId: string) => {
      if (activeAutosaveRequestIdRef.current !== requestId) return;
      activeAutosaveRequestIdRef.current = null;
      activeAutosaveCacheKeyRef.current = "";
      autosaveInFlightRef.current = false;
      if (!autosavePendingRef.current) return;
      autosavePendingRef.current = false;
      requestAutosaveRef.current();
    }, []);

    const requestAutosave = useCallback(() => {
      const target = artifactRef.current;
      if (!autosaveEnabledRef.current || !target?.filePath) return;
      onAutosaveStateChangeRef.current?.("dirty");
      if (autosaveInFlightRef.current) {
        autosavePendingRef.current = true;
        return;
      }
      autosaveInFlightRef.current = true;
      onAutosaveStateChangeRef.current?.("saving");
      enqueueOrRun(() => {
        const requestId = nextRequestId("export");
        activeAutosaveRequestIdRef.current = requestId;
        activeAutosaveCacheKeyRef.current = artifactCacheKeyRef.current;
        const timeout = window.setTimeout(() => {
          if (activeAutosaveRequestIdRef.current !== requestId) return;
          exportTimeoutsRef.current.delete(requestId);
          failAutosave("PPTist export timed out. Your in-editor changes are still kept; retry saving after checking the deck content.");
          finishAutosaveCycle(requestId);
        }, AUTOSAVE_EXPORT_TIMEOUT_MS) as unknown as number;
        exportTimeoutsRef.current.set(requestId, timeout);
        postToEmbed({
          type: "pptist:export-pptx",
          requestId,
          fileName: target.fileName || "deck.pptx",
          targetFilePath: target.filePath,
        });
      });
    }, [enqueueOrRun, failAutosave, finishAutosaveCycle, nextRequestId, postToEmbed]);
    requestAutosaveRef.current = requestAutosave;

    const clearEditRunTimers = useCallback((pending: { timeout: number; completionFallbackTimeout: number | null }) => {
      window.clearTimeout(pending.timeout);
      if (pending.completionFallbackTimeout !== null) window.clearTimeout(pending.completionFallbackTimeout);
    }, []);

    const takeEditRun = useCallback((runId: string) => {
      const pending = editRunRequestsRef.current.get(runId);
      if (!pending) return null;
      editRunRequestsRef.current.delete(runId);
      clearEditRunTimers(pending);
      return pending;
    }, [clearEditRunTimers]);

    const resolveEditRun = useCallback((runId: string, result: PptistEditRunResult, autosave = false) => {
      const pending = takeEditRun(runId);
      if (!pending) return;
      pending.resolve(result);
      if (autosave) requestAutosave();
    }, [requestAutosave, takeEditRun]);

    const rejectEditRun = useCallback((runId: string, error: Error) => {
      const pending = takeEditRun(runId);
      if (!pending) return;
      pending.reject(error);
    }, [takeEditRun]);

    const scheduleEditRunCompletionFallback = useCallback((runId: string) => {
      const pending = editRunRequestsRef.current.get(runId);
      if (!pending || pending.completionFallbackTimeout !== null) return;
      pending.completionFallbackTimeout = window.setTimeout(() => {
        const latest = editRunRequestsRef.current.get(runId);
        if (!latest) return;
        resolveEditRun(runId, { ok: true, applied: latest.appliedIndexes.size }, true);
      }, EDIT_RUN_COMPLETION_GRACE_MS);
    }, [resolveEditRun]);

    const noteEditRunApplied = useCallback((runId: string, index: number) => {
      const pending = editRunRequestsRef.current.get(runId);
      if (!pending || index < 0 || index >= pending.expectedOps) return;
      pending.appliedIndexes.add(index);
      if (pending.appliedIndexes.size === pending.expectedOps) {
        scheduleEditRunCompletionFallback(runId);
      }
    }, [scheduleEditRunCompletionFallback]);

    const registerEditRun = useCallback((
      runId: string,
      expectedOps: number,
      resolve: (result: PptistEditRunResult) => void,
      reject: (error: Error) => void,
    ) => {
      const timeout = window.setTimeout(() => {
        rejectEditRun(runId, new Error("PPTist edit timed out. The deck may have changed; retry after checking the slide content."));
      }, EDIT_RUN_TIMEOUT_MS);
      editRunRequestsRef.current.set(runId, {
        resolve,
        reject,
        timeout,
        completionFallbackTimeout: null,
        expectedOps,
        appliedIndexes: new Set(),
      });
    }, [rejectEditRun]);

    const cleanupEditRunRequests = useCallback(() => {
      editRunRequestsRef.current.forEach((pending) => {
        clearEditRunTimers(pending);
        pending.reject(new Error("PPTist embed unmounted"));
      });
      editRunRequestsRef.current.clear();
    }, [clearEditRunTimers]);

    useEffect(() => {
      const onMessage = (e: MessageEvent) => {
        if (e.source !== iframeRef.current?.contentWindow) return;
        const data = e.data as PptistEvent | undefined;
        if (!data || typeof data.type !== "string") return;

        switch (data.type) {
          case "pptist:embed-ready":
            readyRef.current = true;
            if (!artifactRef.current) setLoading(false);
            revealEmbedThumbnails();
            flushPending();
            break;
          case "pptist:slide-changing":
            showSlideSwitching();
            break;
          case "pptist:slide-changed":
            onSlideChanged?.(data.index, data.slideId);
            finishSlideSwitching();
            break;
          case "pptist:slide-thumbnail":
            onSlideThumbnail?.(data.slideId, data.dataUrl);
            break;
          case "pptist:slide-updated":
            onSlideUpdated?.(data.slideId, data.slide);
            break;
          case "pptist:selection-changed":
            onSelectionChanged?.(data.selection);
            break;
          case "pptist:slides-loaded":
            clearArtifactCacheFallback(data.importRunId);
            pptistImportLog("host:slides-loaded", {
              ...artifactLogContextRef.current,
              count: data.count ?? data.slides?.length ?? 0,
              totalMs: elapsedSince(artifactLoadStartedAtRef.current),
              iframeImportMs: elapsedSince(artifactLoadPostedAtRef.current),
            });
            if (artifactRef.current && data.slides?.length) {
              const cacheKey = artifactCacheKeyRef.current;
              cacheParsedArtifactSlides(cacheKey, data.slides);
              void persistentParsedSlidesCache().set(cacheKey, data.slides).catch((err) => {
                pptistImportLog("host:parsed-slides-persistent-cache:write-error", {
                  ...artifactLogContextRef.current,
                  message: err instanceof Error ? err.message : String(err),
                });
              });
            }
            setLoading(false);
            onSlidesLoaded?.(data.slides ?? Array.from({ length: data.count ?? 0 }, (_, index) => ({
              id: slideIds?.[index] ?? `slide-${index + 1}`,
              elements: [],
            })));
            break;
          case "pptist:slides-cache-miss": {
            pptistImportLog("host:parsed-slides-iframe-cache:miss", {
              ...artifactLogContextRef.current,
              runId: data.importRunId,
              cacheKey: data.cacheKey,
              error: data.error,
              totalMs: elapsedSince(artifactLoadStartedAtRef.current),
            });
            const fallback = takeArtifactCacheFallback(data.importRunId);
            fallback?.();
            break;
          }
          case "pptist:import-log":
            pptistImportLog(data.event, {
              ...artifactLogContextRef.current,
              ...(data.details ?? {}),
              iframeAtMs: data.atMs,
            }, "PPTist.Import");
            break;
          case "pptist:slide-typed":
            onSlideTyped?.(data.index, data.slideId);
            break;
          case "pptist:snapshot-result": {
            const pending = snapshotRequestsRef.current.get(data.requestId);
            if (!pending) break;
            snapshotRequestsRef.current.delete(data.requestId);
            window.clearTimeout(pending.timeout);
            if (data.snapshot) pending.resolve(data.snapshot);
            else pending.reject(new Error(data.error || "PPTist snapshot failed"));
            break;
          }
          case "pptist:edit-op-started":
            onEditOpStartedRef.current?.(data.index, data.op);
            break;
          case "pptist:edit-op-applied":
            onEditOpAppliedRef.current?.(data.index, data.op);
            noteEditRunApplied(data.runId, data.index);
            break;
          case "pptist:edit-run-completed": {
            const result = { ok: data.ok, applied: data.applied, error: data.error };
            if (data.ok) {
              resolveEditRun(data.runId, result, true);
            } else {
              rejectEditRun(data.runId, new Error(data.error || "PPTist edit failed"));
            }
            break;
          }
          case "pptist:dirty-changed":
            if (data.dirty) requestAutosave();
            break;
          case "pptist:export-result": {
            const byteRequest = data.requestId ? exportByteRequestsRef.current.get(data.requestId) : undefined;
            if (byteRequest) {
              exportByteRequestsRef.current.delete(data.requestId!);
              clearExportTimeout(data.requestId);
              byteRequest.resolve({ bytes: new Uint8Array(data.buffer), fileName: data.fileName });
              break;
            }
            const autosaveRequestId = data.requestId && activeAutosaveRequestIdRef.current === data.requestId
              ? data.requestId
              : null;
            if (data.requestId && data.targetFilePath && !autosaveRequestId) {
              clearExportTimeout(data.requestId);
              break;
            }
            clearExportTimeout(data.requestId);
            const bytes = new Uint8Array(data.buffer);
            withTimeout(
              officecli.savePptx(bytes, data.fileName || "deck.pptx", data.targetFilePath ? { targetFilePath: data.targetFilePath } : undefined),
              savePptxTimeoutMs(bytes.byteLength),
              "Saving PPTX locally timed out. Your in-editor changes are still kept; retry after checking file access.",
            )
              .then(async (filePath) => {
                if (autosaveRequestId) {
                  await invalidateParsedArtifactSlides(activeAutosaveCacheKeyRef.current);
                }
                onAutosaveStateChangeRef.current?.("saved");
                onExported?.(filePath);
                if (autosaveRequestId) finishAutosaveCycle(autosaveRequestId);
                if (!data.targetFilePath) return officecli.showItemInFolder(filePath);
                return undefined;
              })
              .catch((err) => {
                const msg = err instanceof Error ? err.message : String(err);
                failAutosave(msg);
                if (autosaveRequestId) finishAutosaveCycle(autosaveRequestId);
              });
            break;
          }
          case "pptist:export-error": {
            const byteRequest = data.requestId ? exportByteRequestsRef.current.get(data.requestId) : undefined;
            if (byteRequest) {
              exportByteRequestsRef.current.delete(data.requestId!);
              clearExportTimeout(data.requestId);
              byteRequest.reject(new Error(data.error || "PPTist export failed."));
              break;
            }
            const autosaveRequestId = data.requestId && activeAutosaveRequestIdRef.current === data.requestId
              ? data.requestId
              : null;
            if (data.requestId && !autosaveRequestId) {
              clearExportTimeout(data.requestId);
              break;
            }
            clearExportTimeout(data.requestId);
            failAutosave(data.error || "PPTist export failed.");
            if (autosaveRequestId) finishAutosaveCycle(autosaveRequestId);
            break;
          }
        }
      };
      window.addEventListener("message", onMessage);
      return () => window.removeEventListener("message", onMessage);
    }, [clearArtifactCacheFallback, finishAutosaveCycle, finishSlideSwitching, flushPending, noteEditRunApplied, onSlideChanged, onSlideThumbnail, onSlideUpdated, onSlidesLoaded, onSlideTyped, onExported, onExportError, rejectEditRun, requestAutosave, resolveEditRun, revealEmbedThumbnails, showSlideSwitching, slideIds, takeArtifactCacheFallback]);

    useEffect(() => {
      if (!artifact) return;
      let cancelled = false;
      let issuedToken: string | null = null;
      const slideIdsForLoad = slideIds ? [...slideIds] : undefined;
      const loadStartedAt = performance.now();
      const importRunId = `${artifact.taskId || "artifact"}-${Date.now().toString(36)}`;
      artifactLoadStartedAtRef.current = loadStartedAt;
      artifactLoadPostedAtRef.current = null;
      artifactLogContextRef.current = { fileName: artifact.fileName, taskId: artifact.taskId, runId: importRunId };
      pptistImportLog("host:artifact-load:start", {
        fileName: artifact.fileName,
        taskId: artifact.taskId,
        runId: importRunId,
        slideIds: slideIdsForLoad?.length ?? 0,
      });

      const loadFromArtifact = () => {
        const pendingFallback = takeArtifactCacheFallback(importRunId);
        if (pendingFallback) {
          // The caller is this fallback; clearing it prevents duplicate PPTX reads
          // if the iframe also reports a late miss after a timeout path.
        }
        officecli
        .issuePreviewToken(artifact)
        .then(async (grant) => {
          issuedToken = grant.token;
          pptistImportLog("host:issue-preview-token:end", {
            fileName: artifact.fileName,
            taskId: artifact.taskId,
            runId: importRunId,
            durationMs: elapsedSince(loadStartedAt),
          });
          const readStartedAt = performance.now();
          const result = await officecli.readArtifactFile(grant.token);
          if (cancelled) return;
          const bytes = result.data instanceof Uint8Array ? result.data : new Uint8Array(result.data);
          const copy = new Uint8Array(bytes.byteLength);
          copy.set(bytes);
          artifactLogContextRef.current = { fileName: artifact.fileName, taskId: artifact.taskId, runId: importRunId, byteLength: bytes.byteLength };
          pptistImportLog("host:read-artifact:end", {
            fileName: artifact.fileName,
            taskId: artifact.taskId,
            runId: importRunId,
            byteLength: bytes.byteLength,
            durationMs: elapsedSince(readStartedAt),
            totalMs: elapsedSince(loadStartedAt),
          });
          enqueueOrRun(() => {
            const animate = animateArtifactRef.current;
            if (animate) onAnimationStartedRef.current?.();
            artifactLoadPostedAtRef.current = performance.now();
            pptistImportLog("host:post-load-pptx", {
              fileName: artifact.fileName,
              taskId: artifact.taskId,
              runId: importRunId,
              byteLength: copy.byteLength,
              animate,
              slideIds: slideIdsForLoad?.length ?? 0,
              totalMs: elapsedSince(loadStartedAt),
            });
            postToEmbed({
              type: "pptist:load-pptx",
              buffer: copy.buffer,
              fileName: artifact.fileName,
              animate,
              slideIds: slideIdsForLoad,
              importRunId,
              cacheKey: artifactCacheKey,
            }, [copy.buffer]);
          });
        })
        .catch((err) => {
          setLoading(false);
          const message = err instanceof Error ? err.message : String(err);
          pptistImportLog("host:artifact-load:error", {
            fileName: artifact.fileName,
            taskId: artifact.taskId,
            runId: importRunId,
            message,
            totalMs: elapsedSince(loadStartedAt),
          });
          onExportErrorRef.current?.(message);
        });
      };

      if (artifactCacheKey) {
        const timeout = window.setTimeout(() => {
          const fallback = takeArtifactCacheFallback(importRunId);
          if (!fallback || cancelled) return;
          pptistImportLog("host:parsed-slides-iframe-cache:timeout", {
            fileName: artifact.fileName,
            taskId: artifact.taskId,
            runId: importRunId,
            totalMs: elapsedSince(loadStartedAt),
          });
          fallback();
        }, PARSED_SLIDES_CACHE_RESPONSE_TIMEOUT_MS);
        artifactCacheFallbacksRef.current.set(importRunId, { fallback: loadFromArtifact, timeout });
        enqueueOrRun(() => {
          artifactLoadPostedAtRef.current = performance.now();
          pptistImportLog("host:post-load-slides-cache", {
            fileName: artifact.fileName,
            taskId: artifact.taskId,
            runId: importRunId,
            animate: false,
            totalMs: elapsedSince(loadStartedAt),
          });
          postToEmbed({
            type: "pptist:load-slides-cache",
            cacheKey: artifactCacheKey,
            animate: false,
            importRunId,
          });
        });
      } else {
        loadFromArtifact();
      }

      return () => {
        cancelled = true;
        clearArtifactCacheFallback(importRunId);
        if (issuedToken) {
          void officecli.revokePreviewToken(issuedToken).catch(() => {});
        }
      };
    }, [artifactCacheKey, artifactKey, clearArtifactCacheFallback, enqueueOrRun, postToEmbed, pptistUrl, slideIdsKey, takeArtifactCacheFallback]);

    // Incremental slide push: write each new complete slide into a blank page as
    // it streams in. Slides carry stable ids, so dedup is by id.
    useEffect(() => {
      if (artifact) return;
      for (const slide of slides) {
        if (!slide?.id || sentSlideIdsRef.current.has(slide.id)) continue;
        sentSlideIdsRef.current.add(slide.id);
        enqueueOrRun(() => {
          const animate = animateSlidesRef.current;
          if (animate) onAnimationStartedRef.current?.();
          // animate: type the page in character-by-character (human-like) inside PPTist.
          postToEmbed({ type: "pptist:add-slide", slide, animate });
        });
      }
    }, [slides, enqueueOrRun, postToEmbed, pptistUrl]);

    useImperativeHandle(ref, () => ({
      gotoSlide(index: number) {
        enqueueOrRun(() => {
          pptistImportLog("host:goto-slide:post", {
            ...artifactLogContextRef.current,
            index,
          });
          postToEmbed({ type: "pptist:goto-slide", index });
        });
      },
      selectElements(selection: PptistElementSelection) {
        enqueueOrRun(() => {
          pptistImportLog("host:select-elements:post", {
            ...artifactLogContextRef.current,
            slideId: selection.slideId,
            slideIndex: selection.slideIndex,
            elementIds: selection.elementIds.length,
          });
          postToEmbed({
            type: "pptist:select-elements",
            slideId: selection.slideId,
            slideIndex: selection.slideIndex,
            elementIds: selection.elementIds,
          });
        });
      },
      exportPptx(fileName?: string) {
        enqueueOrRun(() => {
          postToEmbed({ type: "pptist:export-pptx", fileName });
        });
      },
      exportPptxBytes(fileName?: string) {
        return new Promise<{ bytes: Uint8Array; fileName?: string }>((resolve, reject) => {
          const requestId = nextRequestId("export-bytes");
          const timeout = window.setTimeout(() => {
            const pending = exportByteRequestsRef.current.get(requestId);
            if (!pending) return;
            exportByteRequestsRef.current.delete(requestId);
            exportTimeoutsRef.current.delete(requestId);
            pending.reject(new Error("PPTist export timed out. Retry after the editor finishes rendering."));
          }, AUTOSAVE_EXPORT_TIMEOUT_MS) as unknown as number;
          exportTimeoutsRef.current.set(requestId, timeout);
          exportByteRequestsRef.current.set(requestId, { resolve, reject, timeout });
          enqueueOrRun(() => {
            postToEmbed({ type: "pptist:export-pptx", requestId, fileName });
          });
        });
      },
      getSnapshot() {
        return new Promise<PptistDeckSnapshot>((resolve, reject) => {
          const requestId = nextRequestId("snapshot");
          const timeout = window.setTimeout(() => {
            const pending = snapshotRequestsRef.current.get(requestId);
            if (!pending) return;
            snapshotRequestsRef.current.delete(requestId);
            pending.reject(new Error("PPTist snapshot timed out. Retry after the editor finishes loading."));
          }, SNAPSHOT_REQUEST_TIMEOUT_MS);
          snapshotRequestsRef.current.set(requestId, { resolve, reject, timeout });
          enqueueOrRun(() => {
            postToEmbed({ type: "pptist:get-snapshot", requestId });
          });
        });
      },
      applyEditOps(ops: PptistEditOp[]) {
        return new Promise<PptistEditRunResult>((resolve, reject) => {
          const runId = nextRequestId("edit");
          registerEditRun(runId, ops.length, resolve, reject);
          enqueueOrRun(() => {
            postToEmbed({ type: "pptist:apply-edit-ops", runId, ops });
          });
        });
      },
    }), [enqueueOrRun, nextRequestId, postToEmbed, registerEditRun]);

    useEffect(() => {
      return () => {
        autosaveInFlightRef.current = false;
        autosavePendingRef.current = false;
        activeAutosaveRequestIdRef.current = null;
        activeAutosaveCacheKeyRef.current = "";
        clearSlideSwitchTimers();
        exportTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
        exportTimeoutsRef.current.clear();
        snapshotRequestsRef.current.forEach(({ reject, timeout }) => {
          window.clearTimeout(timeout);
          reject(new Error("PPTist embed unmounted"));
        });
        snapshotRequestsRef.current.clear();
        cleanupEditRunRequests();
        exportByteRequestsRef.current.forEach(({ reject, timeout }) => {
          window.clearTimeout(timeout);
          reject(new Error("PPTist embed unmounted"));
        });
        exportByteRequestsRef.current.clear();
      };
    }, [clearSlideSwitchTimers]);

    return (
      <div className="living-tree-pptist-embed" aria-label={ariaLabel}>
        {loading && (
          <div className="living-tree-pptist-loading" role="status" aria-live="polite">
            <span className="living-tree-pptist-loading-spinner" aria-hidden="true" />
            <span>{artifact ? "Preparing deck..." : "Loading slides..."}</span>
          </div>
        )}
        {!loading && slideSwitching && (
          <div className="living-tree-pptist-switching" role="status" aria-live="polite">
            <span className="living-tree-pptist-switching-spinner" aria-hidden="true" />
            <span>Switching slide...</span>
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={pptistUrl}
          title="PPTist Embed"
          sandbox="allow-same-origin allow-scripts allow-downloads allow-popups allow-popups-to-escape-sandbox"
          onLoad={revealEmbedThumbnails}
        />
      </div>
    );
  },
);
