// Client-side registry of chat threads currently on screen, so their
// notifications don't pop a toast while the person is already reading them.
const active = new Set<string>();

export function setThreadActive(key: string, on: boolean) {
  if (on) active.add(key);
  else active.delete(key);
}

export function isThreadActive(key: string | null | undefined) {
  return !!key && active.has(key) && typeof document !== "undefined" && document.visibilityState === "visible";
}

export const threadKey = (courseId: string, studentId: string) => `thread:${courseId}:${studentId}`;
