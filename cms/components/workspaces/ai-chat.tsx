"use client";

import { useState } from "react";
import { ArrowDownToLine, Globe2, Newspaper, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type Message = { role: "user" | "assistant"; content: string };
type ResearchHit = {
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt?: string;
};

export function AiChat({
  title = "AI",
  description,
  placeholder = "Ask for a rewrite, angle, or shorter version…",
  systemPrompt = "You are a CMS writing assistant.",
  welcome = "Ask for a draft, summary, or operational note.",
  contextLabel,
  contextPayload,
  variant = "panel",
  onInsert,
  className,
  defaultResearch = false,
}: {
  title?: string;
  description?: string;
  placeholder?: string;
  systemPrompt?: string;
  welcome?: string;
  contextLabel?: string;
  contextPayload?: Record<string, unknown> | null;
  variant?: "panel" | "desk";
  onInsert?: (text: string) => void;
  className?: string;
  defaultResearch?: boolean;
}) {
  const sessionKey = [
    title,
    description || "",
    placeholder,
    systemPrompt,
    welcome,
    contextLabel || "",
    JSON.stringify(contextPayload || {}),
    variant,
    defaultResearch ? "1" : "0",
  ].join("|");

  return (
    <AiChatSession
      key={sessionKey}
      title={title}
      description={description}
      placeholder={placeholder}
      systemPrompt={systemPrompt}
      welcome={welcome}
      contextLabel={contextLabel}
      contextPayload={contextPayload}
      variant={variant}
      onInsert={onInsert}
      className={className}
      defaultResearch={defaultResearch}
    />
  );
}

function AiChatSession({
  title = "AI",
  description,
  placeholder = "Ask for a rewrite, angle, or shorter version…",
  systemPrompt = "You are a CMS writing assistant.",
  welcome = "Ask for a draft, summary, or operational note.",
  contextLabel,
  contextPayload,
  variant = "panel",
  onInsert,
  className,
  defaultResearch = false,
}: {
  title?: string;
  description?: string;
  placeholder?: string;
  systemPrompt?: string;
  welcome?: string;
  contextLabel?: string;
  contextPayload?: Record<string, unknown> | null;
  variant?: "panel" | "desk";
  onInsert?: (text: string) => void;
  className?: string;
  defaultResearch?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: welcome },
  ]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [researchEnabled, setResearchEnabled] = useState(defaultResearch);
  const [hits, setHits] = useState<ResearchHit[]>([]);
  const [researchMeta, setResearchMeta] = useState("");

  async function send(mode: "chat" | "report" = "chat") {
    const text =
      mode === "report"
        ? prompt.trim() ||
          "Using live financial web research and the selected event/post context, write a concise market report for Telegram: 1) what happened / what is upcoming, 2) related news, 3) market implication, 4) one caution. Keep it under 180 words."
        : prompt.trim();
    if (!text) return;

    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setPrompt("");
    setBusy(true);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system: systemPrompt,
          context: contextPayload || undefined,
          research: researchEnabled || mode === "report",
          researchQuery: text,
          messages: next.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });
      let payload: {
        reply?: string;
        research?: { ok?: boolean; provider?: string; query?: string; hits?: ResearchHit[] };
        error?: string;
      } = {};
      try {
        payload = await response.json();
      } catch {
        payload = {};
      }
      if (!response.ok) {
        throw new Error(payload.error || `AI request failed (${response.status})`);
      }
      if (payload.research?.hits?.length) {
        setHits(payload.research.hits);
        setResearchMeta(
          `${payload.research.provider || "web"} · ${payload.research.hits.length} sources`
        );
      }
      setMessages([
        ...next,
        { role: "assistant", content: payload.reply || "No reply." },
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI request failed";
      setMessages([
        ...next,
        {
          role: "assistant",
          content: `AI request failed: ${message}`,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-[520px] flex-col border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.78)]",
        variant === "panel" ? "border-l" : "rounded-[28px] border",
        className
      )}
    >
      <div className="border-b border-[var(--fx-border-soft)] px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--fx-text-muted)]">
              {title}
            </div>
            {contextLabel ? (
              <div className="mt-2 inline-flex max-w-full items-center rounded-full border border-transparent bg-[var(--fx-sage)] px-3 py-1 text-xs font-medium text-[var(--fx-ops-ink)]">
                <span className="truncate">AI for: {contextLabel}</span>
              </div>
            ) : null}
            {description ? <p className="mt-2 text-sm text-[var(--fx-text-soft)]">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => setResearchEnabled((value) => !value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
              researchEnabled
                ? "border-transparent bg-[var(--fx-sage)] text-[var(--fx-ops-ink)]"
                : "border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.72)] text-[var(--fx-text-soft)] hover:bg-white"
            )}
          >
            <Globe2 className="size-3.5" />
            {researchEnabled ? "Web research ON" : "Web research OFF"}
          </button>
        </div>
        {researchMeta ? (
          <div className="mt-3 text-xs text-[var(--fx-text-soft)]">Last research: {researchMeta}</div>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className="space-y-2">
            <div
              className={cn(
                "max-w-[92%] rounded-[20px] px-3.5 py-2.5 text-sm leading-6 shadow-sm",
                message.role === "user"
                  ? "ml-auto bg-[var(--fx-ops-ink)] text-white"
                  : "bg-[rgba(223,243,235,0.58)] text-[var(--fx-text-strong)] ring-1 ring-[var(--fx-border-soft)]"
              )}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
            {message.role === "assistant" && onInsert && index > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-[var(--fx-text-soft)]"
                onClick={() => onInsert(message.content)}
              >
                <ArrowDownToLine className="mr-1 size-3.5" />
                Insert into draft
              </Button>
            ) : null}
          </div>
        ))}

        {hits.length > 0 ? (
          <div className="rounded-[20px] border border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.72)] p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-[var(--fx-text-soft)]">
              <Newspaper className="size-3.5" />
              Sources
            </div>
            <div className="space-y-2">
              {hits.map((hit) => (
                <a
                  key={hit.url}
                  href={hit.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-[16px] border border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.9)] px-3 py-2 transition hover:border-[var(--fx-border-strong)] hover:bg-[var(--fx-sage)]"
                >
                  <div className="line-clamp-2 text-sm font-medium tracking-[-0.01em] text-[var(--fx-text-strong)]">{hit.title}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-[var(--fx-text-soft)]">{hit.snippet}</div>
                  <div className="mt-1 text-[11px] text-[var(--fx-ops-ink)]">
                    {hit.source}
                    {hit.publishedAt ? ` · ${hit.publishedAt}` : ""}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-[var(--fx-border-soft)] px-5 py-4">
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={
            researchEnabled
              ? "Ask for related news, market reaction, or a short report…"
              : placeholder
          }
          className="min-h-24 resize-none bg-[rgba(255,255,255,0.78)]"
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void send("chat");
            }
          }}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[var(--fx-text-muted)]">⌘/Ctrl + Enter</div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => send("report")}
              disabled={busy}
            >
              <Newspaper className="mr-2 size-4" />
              {busy ? "Researching…" : "Research + report"}
            </Button>
            <Button onClick={() => send("chat")} disabled={busy || !prompt.trim()}>
              <Send className="mr-2 size-4" />
              {busy ? "Sending…" : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
