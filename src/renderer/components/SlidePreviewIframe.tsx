import { useCallback, useEffect, useRef } from "react";
import type { PptistSlide } from "../../shared/pptistProtocol";

const PREVIEW_URL = "/pptist/index.html?mode=slide-preview";

interface SlidePreviewIframeProps {
  slide: PptistSlide;
}

export function SlidePreviewIframe({ slide }: SlidePreviewIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const readyRef = useRef(false);
  const pendingSlideRef = useRef<PptistSlide | null>(null);

  const sendSlide = useCallback((s: PptistSlide) => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    win.postMessage({ type: "pptist:preview-set-slide", slide: s }, "*");
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === "pptist:preview-ready") {
        readyRef.current = true;
        const s = pendingSlideRef.current;
        if (s) {
          pendingSlideRef.current = null;
          sendSlide(s);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [sendSlide]);

  useEffect(() => {
    if (readyRef.current) {
      sendSlide(slide);
    } else {
      pendingSlideRef.current = slide;
    }
  }, [slide, sendSlide]);

  return (
    <iframe
      ref={iframeRef}
      className="living-tree-slide-preview-iframe"
      src={PREVIEW_URL}
      title="Slide Preview"
      sandbox="allow-same-origin allow-scripts"
    />
  );
}
