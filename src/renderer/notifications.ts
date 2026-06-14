import { officecli } from "./bridge";

export const NOTIFICATIONS_STORAGE_KEY = "officedex.notifications.enabled";

type NotificationInput = {
  title: string;
  body: string;
};

export function readNotificationsEnabled(): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    return localStorage.getItem(NOTIFICATIONS_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setNotificationsEnabled(enabled: boolean): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, enabled ? "true" : "false");
  } catch {
    // Ignore storage failures (private mode, quota): the in-memory switch still updates.
  }
}

export function maybeNotify({ title, body }: NotificationInput): void {
  try {
    if (!readNotificationsEnabled()) return;
    if (typeof document !== "undefined" && document.hidden !== true) return;

    void officecli.sendDesktopNotification?.({ title, body }).catch(() => undefined);
  } catch {
    // Notifications are best-effort and must never break task event handling.
  }
}
