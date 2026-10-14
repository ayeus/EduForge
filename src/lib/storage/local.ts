import "server-only";
import path from "node:path";

const ROOT = path.join(process.cwd(), ".uploads");

export function localPath(key: string) {
  const resolved = path.resolve(ROOT, key);
  if (!resolved.startsWith(ROOT + path.sep)) throw new Error("Invalid key");
  return resolved;
}
