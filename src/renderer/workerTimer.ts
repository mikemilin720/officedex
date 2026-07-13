// Timer implementation using a Web Worker so that setTimeout/setInterval are
// NOT throttled when the window loses focus or goes to the background.
// Browsers clamp background-tab timers to ≥1 s; a Worker's timers run at full
// speed regardless.

const workerScript = `
self.onmessage = function(e) {
  const { id, ms, type } = e.data;
  if (type === 'setTimeout') {
    const t = setTimeout(() => { self.postMessage({ id }); }, ms);
    self.addEventListener('message', function cancel(ev) {
      if (ev.data.type === 'clear' && ev.data.id === id) {
        clearTimeout(t);
        self.removeEventListener('message', cancel);
      }
    });
  }
};
`;

let worker: Worker | null = null;
let nextId = 1;
const callbacks = new Map<number, () => void>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === "undefined" || typeof Blob === "undefined") return null;
  try {
    const blob = new Blob([workerScript], { type: "application/javascript" });
    worker = new Worker(URL.createObjectURL(blob));
    worker.onmessage = (e: MessageEvent<{ id: number }>) => {
      const cb = callbacks.get(e.data.id);
      if (cb) {
        callbacks.delete(e.data.id);
        cb();
      }
    };
    return worker;
  } catch {
    return null;
  }
}

export function workerSetTimeout(fn: () => void, ms: number): number {
  const w = getWorker();
  if (!w) return window.setTimeout(fn, ms);
  const id = nextId++;
  callbacks.set(id, fn);
  w.postMessage({ id, ms, type: "setTimeout" });
  return id;
}

export function workerClearTimeout(id: number): void {
  const w = getWorker();
  if (!w) {
    window.clearTimeout(id);
    return;
  }
  callbacks.delete(id);
  w.postMessage({ id, type: "clear" });
}
