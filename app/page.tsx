"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";

type ChatRole = "assistant" | "user";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
};

const WA_NUMBER = "6281259739956";

function getOrCreateUserId() {
  if (typeof window === "undefined") return "warung-sidik-web";
  const key = "warung_sidik_user_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const next = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  window.localStorage.setItem(key, next);
  return next;
}

function findFinalOrderBlock(text: string) {
  const markerRegex = /-{2,}\s*FINAL_ORDER\s*-{2,}/i;
  const m = text.match(markerRegex);
  if (!m || m.index == null) return null;

  const afterMarker = text.slice(m.index + m[0].length);
  const stopRegex = /\bEND_FINAL_ORDER\b|\bEND_ORDER_SUMMARY\b|\bORDER_SUMMARY\b/i;
  const stop = afterMarker.match(stopRegex);
  const bodyRaw = (stop?.index != null ? afterMarker.slice(0, stop.index) : afterMarker).trim();

  const bodyWithNewlines = bodyRaw
    .replace(/\s*(Nama|Tipe|Pesanan|Jam)\s*:/gi, "\n$1:")
    .replace(/^\s*\n+/, "")
    .trim();

  const lines = bodyWithNewlines
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return "--- FINAL_ORDER ---";
  return ["--- FINAL_ORDER ---", ...lines].join("\n");
}

function normalizeFinalOrderInText(text: string) {
  const markerRegex = /-{2,}\s*FINAL_ORDER\s*-{2,}/i;
  const m = text.match(markerRegex);
  if (!m || m.index == null) return text;

  const finalBlock = findFinalOrderBlock(text);
  if (!finalBlock) return text;

  const before = text.slice(0, m.index).trimEnd();
  const afterMarker = text.slice(m.index + m[0].length);
  const stopRegex = /\bEND_FINAL_ORDER\b|\bEND_ORDER_SUMMARY\b|\bORDER_SUMMARY\b/i;
  const stop = afterMarker.match(stopRegex);
  const after = stop?.index != null ? afterMarker.slice(stop.index) : "";
  const tail = after.trimStart();

  const combined = [
    before.length > 0 ? before : null,
    finalBlock,
    tail.length > 0 ? tail : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  return combined;
}

function extractBlockingAnswer(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const directAnswer = record.answer;
  if (typeof directAnswer === "string") return directAnswer;
  const data = record.data;
  if (data && typeof data === "object") {
    const nested = (data as Record<string, unknown>).answer;
    if (typeof nested === "string") return nested;
  }
  return null;
}

function extractBlockingConversationId(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const direct = record.conversation_id;
  if (typeof direct === "string") return direct;
  const data = record.data;
  if (data && typeof data === "object") {
    const nested = (data as Record<string, unknown>).conversation_id;
    if (typeof nested === "string") return nested;
  }
  return null;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function SendIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"
      />
    </svg>
  );
}

function MarkdownText({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkBreaks]}
      skipHtml
      components={{
        p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            {children}
          </a>
        ),
        code: ({ children }) => (
          <code className="rounded bg-black/5 px-1 py-0.5 font-mono text-[0.95em]">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="overflow-x-auto rounded-xl bg-black/5 p-3 font-mono text-[0.9em]">
            {children}
          </pre>
        ),
        ul: ({ children }) => <ul className="list-disc pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal pl-5">{children}</ol>,
        li: ({ children }) => <li className="my-1">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-[#854836]/25 pl-3 italic">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function MessageBubble({ role, content, createdAt }: ChatMessage) {
  const isUser = role === "user";
  const normalized = isUser ? content : normalizeFinalOrderInText(content);
  const label = isUser ? "Kamu" : "Cak Sidik";
  return (
    <div className={`w-full ${isUser ? "flex justify-end" : "flex justify-start"}`}>
      <div
        className={[
          "flex w-full max-w-[82%] flex-col",
          isUser ? "items-end" : "items-start",
        ].join(" ")}
      >
        <div className="mb-1 flex items-center gap-2 text-[11px] text-black/45">
          <span>{label}</span>
          <span>{formatTime(createdAt)}</span>
        </div>
        <div
          className={[
            "w-fit rounded-2xl px-4 py-3 text-[15px] leading-6 shadow-sm",
            isUser
              ? "bg-[var(--accent)] text-black rounded-br-md border border-black/5"
              : "bg-white text-black rounded-bl-md border border-black/10",
          ].join(" ")}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap">{normalized}</div>
          ) : (
            <MarkdownText content={normalized} />
          )}
        </div>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex w-full justify-start">
      <div className="flex w-full max-w-[82%] flex-col items-start">
        <div className="mb-1 flex items-center gap-2 text-[11px] text-black/45">
          <span>Livechat</span>
          <span>…</span>
        </div>
        <div className="w-fit rounded-2xl rounded-bl-md border border-black/10 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full bg-black/30 animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="inline-block h-2 w-2 rounded-full bg-black/30 animate-bounce"
              style={{ animationDelay: "120ms" }}
            />
            <span
              className="inline-block h-2 w-2 rounded-full bg-black/30 animate-bounce"
              style={{ animationDelay: "240ms" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function WaConfirmModal({
  open,
  waUrl,
  onClose,
  onSend,
}: {
  open: boolean;
  waUrl: string | null;
  onClose: () => void;
  onSend: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 text-black shadow-xl">
        <div className="text-base font-semibold">Kirim pesanan ke WA</div>
        <div className="mt-2 text-sm text-black/70">
          Pesanan kamu sudah siap. Klik Kirim untuk membuka WhatsApp.
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-xl border border-black/15 bg-transparent px-4 py-2 text-sm font-semibold text-black active:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            onClick={onClose}
          >
            Batal
          </button>
          <button
            type="button"
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-black active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            onClick={() => {
              if (waUrl) onSend();
              onClose();
            }}
          >
            Kirim
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatHeader() {
  return (
    <header className="shrink-0 border-b border-black/10 bg-white">
      <div className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex flex-col leading-tight">
            <div className="text-[15px] font-semibold text-black">Cak Sidik</div>
            <div className="text-xs text-black/50">Membantu mencatat pesanan anda!</div>
          </div>
        </div>
      </div>
    </header>
  );
}

function MessagesList({
  messages,
  isSending,
  endRef,
}: {
  messages: ChatMessage[];
  isSending: boolean;
  endRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
      <div className="flex flex-col gap-4">
        {messages.map((m, index) =>
          isSending &&
          index === messages.length - 1 &&
          m.role === "assistant" &&
          m.content.length === 0 ? (
            <TypingBubble key={m.id} />
          ) : (
            <MessageBubble key={m.id} {...m} />
          ),
        )}
        <div ref={endRef} />
      </div>
    </main>
  );
}

function ChatComposer({
  input,
  disabled,
  onInputChange,
  onSend,
}: {
  input: string;
  disabled: boolean;
  onInputChange: (next: string) => void;
  onSend: () => void;
}) {
  return (
    <form
      className="shrink-0 border-t border-black/10 bg-white px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
      onSubmit={(e) => {
        e.preventDefault();
        onSend();
      }}
    >
      <div className="flex items-center gap-3">
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Write a message"
          enterKeyHint="send"
          className="w-full bg-transparent py-3 text-base text-black outline-none placeholder:text-black/35 sm:text-[15px]"
          disabled={disabled}
        />
        <button
          type="submit"
          disabled={disabled || !input.trim()}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--accent)] text-black shadow-sm disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          aria-label="Send"
        >
          <SendIcon />
        </button>
      </div>
      <div className="pt-2 text-center text-[11px] text-black/40">
        Powered by Warung Sidik
      </div>
    </form>
  );
}

export default function Home() {
  const welcomeMessage = useMemo<ChatMessage>(
    () => ({
      id: "welcome",
      role: "assistant",
      content: "Halo! Saya AI Warung Sidik. Kamu mau pesan apa hari ini? Tulis menu + jumlah ya.",
      createdAt: Date.now(),
    }),
    [],
  );
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [userId, setUserId] = useState<string>("warung-sidik-web");
  const [isWaConfirmOpen, setIsWaConfirmOpen] = useState(false);
  const [waUrlToOpen, setWaUrlToOpen] = useState<string | null>(null);
  const [waPromptedMessageId, setWaPromptedMessageId] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setUserId(getOrCreateUserId());
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isSending]);

  useEffect(() => {
    if (isSending) return;
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    if (waPromptedMessageId === lastAssistant.id) return;
    const finalBlock = findFinalOrderBlock(lastAssistant.content);
    if (!finalBlock) return;

    const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(finalBlock)}`;
    setWaUrlToOpen(url);
    setIsWaConfirmOpen(true);
    setWaPromptedMessageId(lastAssistant.id);
  }, [isSending, messages, waPromptedMessageId]);

  useEffect(() => {
    if (!isWaConfirmOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsWaConfirmOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isWaConfirmOpen]);

  const updateMessageContent = useCallback((messageId: string, nextContent: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, content: nextContent } : m)),
    );
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const now = Date.now();
    const userMsg: ChatMessage = {
      id: window.crypto?.randomUUID?.() ?? `${Date.now()}-u`,
      role: "user",
      content: trimmed,
      createdAt: now,
    };
    const assistantId = window.crypto?.randomUUID?.() ?? `${Date.now()}-a`;
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: now,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsSending(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: trimmed,
          conversation_id: conversationId ?? "",
          user: userId,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        updateMessageContent(assistantId, `Maaf, terjadi error.\n${text}`.trim());
        return;
      }

      if (!res.body) {
        const raw = await res.text();
        let parsed: unknown = null;
        try {
          parsed = JSON.parse(raw) as unknown;
        } catch {
          parsed = null;
        }

        const answer = extractBlockingAnswer(parsed) ?? raw;
        const nextConversationId = extractBlockingConversationId(parsed);
        if (nextConversationId) setConversationId(nextConversationId);
        updateMessageContent(assistantId, answer);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullMessage = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith("data:")) continue;
          const jsonText = trimmedLine.slice("data:".length).trim();
          if (!jsonText) continue;

          let data: unknown = null;
          try {
            data = JSON.parse(jsonText) as unknown;
          } catch {
            data = null;
          }
          if (!data || typeof data !== "object") continue;

          const record = data as Record<string, unknown>;
          const nextConversationId = record.conversation_id;
          if (typeof nextConversationId === "string" && nextConversationId) {
            setConversationId(nextConversationId);
          }

          const answerDelta = record.answer;
          if (typeof answerDelta !== "string" || answerDelta.length === 0) continue;

          fullMessage += answerDelta;
          updateMessageContent(assistantId, fullMessage);
        }
      }
    } finally {
      setIsSending(false);
    }
  }, [conversationId, input, isSending, updateMessageContent, userId]);

  return (
    <div className="flex min-h-[100dvh] items-stretch justify-center bg-white text-black sm:items-center sm:p-6">
      <div className="flex h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white shadow-[0_20px_60px_rgba(0,0,0,0.16)] sm:h-[calc(100dvh-3rem)] sm:rounded-3xl sm:border sm:border-black/10">
        <WaConfirmModal
          open={isWaConfirmOpen}
          waUrl={waUrlToOpen}
          onClose={() => setIsWaConfirmOpen(false)}
          onSend={() => {
            if (waUrlToOpen) window.open(waUrlToOpen, "_blank", "noopener,noreferrer");
          }}
        />
        <ChatHeader />
        <MessagesList messages={messages} isSending={isSending} endRef={endRef} />
        <ChatComposer
          input={input}
          disabled={isSending}
          onInputChange={setInput}
          onSend={() => {
            void sendMessage();
          }}
        />
      </div>
    </div>
  );
}
