"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { Spinner } from "@/components/ui/primitives";
import { IconSend, IconSparkles } from "@/components/ui/icons";

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
}

const SUGGESTED = [
  "What's working across my accounts right now?",
  "Why did my engagement change this month?",
  "Which platform should I invest more in?",
  "Give me 3 hooks for my next post",
];

/** Minimal markdown: bold + line breaks + bullets (no external deps). */
function renderMarkdown(text: string) {
  const html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^### (.+)$/gm, "<strong>$1</strong>")
    .replace(/^## (.+)$/gm, "<strong>$1</strong>")
    .replace(/^# (.+)$/gm, "<strong>$1</strong>")
    .replace(/^[-•] (.+)$/gm, "<span class='block pl-3'>• $1</span>")
    .replace(/\n/g, "<br/>");
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export function ChatPanel({
  conversationId,
  initialMessages,
}: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeConversation, setActiveConversation] = useState(conversationId);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    setError(null);
    setInput("");
    setMessages((m) => [
      ...m,
      { id: `local-${Date.now()}`, role: "user", content: text },
      { id: `assistant-${Date.now()}`, role: "assistant", content: "" },
    ]);
    setStreaming(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: activeConversation, message: text }),
      });
      if (!res.ok || !res.body) throw new Error("Chat request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6)) as {
            text?: string;
            done?: boolean;
            error?: string;
            conversationId?: string;
          };
          if (data.conversationId) setActiveConversation(data.conversationId);
          if (data.text) {
            setMessages((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { ...last, content: last.content + data.text };
              return copy;
            });
          }
          if (data.error) setError(data.error);
        }
      }
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setStreaming(false);
      router.refresh();
    }
  }

  return (
    <div className="flex h-[60vh] flex-col md:h-[70vh]">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
              <IconSparkles width={24} height={24} />
            </span>
            <p className="max-w-sm text-sm text-muted">
              Ask anything about your accounts — the strategist reads your real
              numbers and the platform playbooks before answering.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-xs text-muted transition hover:border-accent hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                m.role === "user"
                  ? "bg-accent text-white"
                  : "border border-border bg-surface-2",
              )}
            >
              {m.content ? (
                renderMarkdown(m.content)
              ) : (
                <Spinner />
              )}
            </div>
          </div>
        ))}
        {error && (
          <p className="rounded-xl bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your strategist…"
          className="min-h-11 flex-1 rounded-xl border border-border bg-surface-2 px-4 text-sm outline-none placeholder:text-faint focus:border-accent"
          data-testid="chat-input"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          aria-label="Send"
          className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-white transition hover:bg-accent-strong disabled:opacity-50"
        >
          {streaming ? <Spinner className="border-white/40 border-t-white" /> : <IconSend width={18} height={18} />}
        </button>
      </form>
    </div>
  );
}
