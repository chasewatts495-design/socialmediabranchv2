import { del, put } from "@vercel/blob";
import type { StorageDriver } from "./types";

export const blobDriver: StorageDriver = {
  mode: "blob",
  async save(key, data, contentType) {
    const res = await put(key, Buffer.from(data), {
      access: "public",
      contentType,
      addRandomSuffix: true,
    });
    return { url: res.url };
  },
  async delete(keyOrUrl) {
    await del(keyOrUrl);
  },
};
