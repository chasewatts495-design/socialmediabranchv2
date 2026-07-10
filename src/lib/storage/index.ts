import type { StorageDriver } from "./types";
import { localDriver } from "./local";
import { blobDriver } from "./vercel-blob";

export function storageMode(): "local" | "blob" {
  if (process.env.STORAGE_DRIVER === "local") return "local";
  if (process.env.STORAGE_DRIVER === "blob") return "blob";
  return process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local";
}

export function getStorage(): StorageDriver {
  return storageMode() === "blob" ? blobDriver : localDriver;
}
