export interface StorageDriver {
  readonly mode: "local" | "blob";
  /** Persist bytes under key; returns a URL the browser can load. */
  save(
    key: string,
    data: Uint8Array,
    contentType: string,
  ): Promise<{ url: string }>;
  delete(key: string): Promise<void>;
}
