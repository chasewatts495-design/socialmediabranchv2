import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageDriver } from "./types";

const ROOT = () => path.join(process.cwd(), ".data", "uploads");

/** Keys are sanitized to a flat, safe namespace under .data/uploads. */
export function safeKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export const localDriver: StorageDriver = {
  mode: "local",
  async save(key, data, _contentType) {
    const k = safeKey(key);
    await mkdir(ROOT(), { recursive: true });
    await writeFile(path.join(ROOT(), k), data);
    return { url: `/api/media/${k}` };
  },
  async delete(key) {
    const k = safeKey(key);
    await rm(path.join(ROOT(), k), { force: true });
  },
};

export function localFilePath(key: string): string {
  return path.join(ROOT(), safeKey(key));
}
