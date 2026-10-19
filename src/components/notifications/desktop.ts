const KEY = "ef-desktop-alerts";

export function desktopAlertsEnabled() {
  try {
    return (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted" &&
      localStorage.getItem(KEY) === "1"
    );
  } catch {
    return false;
  }
}

export function setDesktopAlerts(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
}

/** Show an OS notification while the tab is hidden, if the person opted in. */
export function desktopAlert(title: string, body: string, href: string) {
  if (!desktopAlertsEnabled() || document.visibilityState === "visible") return;
  try {
    const n = new Notification(title, { body, icon: "/icon.svg", tag: href });
    n.onclick = () => {
      window.focus();
      window.location.assign(href);
      n.close();
    };
  } catch {}
}
