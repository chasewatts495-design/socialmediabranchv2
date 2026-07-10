"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/primitives";

export function CsvImport({ accountId }: { accountId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/accounts/${accountId}/csv`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        setResult(json.error ?? "Import failed.");
      } else {
        const errs = (json.errors as { line: number; message: string }[]) ?? [];
        setResult(
          `Imported ${json.imported} row${json.imported === 1 ? "" : "s"}.` +
            (errs.length
              ? ` Rejected ${errs.length}: ${errs
                  .slice(0, 3)
                  .map((e) => `line ${e.line} (${e.message})`)
                  .join("; ")}${errs.length > 3 ? "…" : ""}`
              : ""),
        );
        router.refresh();
      }
    } catch {
      setResult("Import failed — check the file and try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm font-medium text-ink transition hover:bg-surface-3 disabled:opacity-50"
      >
        {busy ? <Spinner /> : "Import CSV"}
      </button>
      <a
        href={`/api/accounts/${accountId}/csv`}
        className="text-xs text-accent-strong hover:underline"
        download
      >
        Download template
      </a>
      {result && <p className="w-full text-xs text-muted">{result}</p>}
    </div>
  );
}
