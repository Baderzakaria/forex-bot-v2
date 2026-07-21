"use client";

import { useEffect, useState } from "react";
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
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: welcome },
  ]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [researchEnabled, setResearchEnabled] = useState(defaultResearch);
  const [hits, setHits] = useState<ResearchHit[]>([]);
  const [researchMeta, setResearchMeta] = useState("");

  useEffect(() => {
    setMessages([{ role: "assistant", content: welcome }]);
    setPrompt("");
    setHits([]);
    setResearchMeta("");
  }, [welcome, systemPrompt, contextLabel]);

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
      const payload = (await response.json()) as {
        reply?: string;
        research?: { ok?: boolean; provider?: string; query?: string; hits?: ResearchHit[] };
      };
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
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "flex h-full min-h-[520px] flex-col border-zinc-200 bg-white",
        variant === "panel" ? "border-l" : "rounded-2xl border",
        className
      )}
    >
      <div className="border-b border-zinc-200 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-400">
              {title}
            </div>
            {contextLabel ? (
              <div className="mt-2 inline-flex max-w-full items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">
                <span className="truncate">AI for: {contextLabel}</span>
              </div>
            ) : null}
            {description ? <p className="mt-2 text-sm text-zinc-500">{description}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => setResearchEnabled((value) => !value)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
              researchEnabled
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-white"
            )}
          >
            <Globe2 className="size-3.5" />
            {researchEnabled ? "Web research ON" : "Web research OFF"}
          </button>
        </div>
        {researchMeta ? (
          <div className="mt-3 text-xs text-zinc-500">Last research: {researchMeta}</div>
        ) : null}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className="space-y-2">
            <div
              className={cn(
                "max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-6",
                message.role === "user"
                  ? "ml-auto bg-zinc-950 text-white"
                  : "bg-zinc-50 text-zinc-700 ring-1 ring-zinc-200"
              )}
            >
              <div className="whitespace-pre-wrap">{message.content}</div>
            </div>
            {message.role === "assistant" && onInsert && index > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-zinc-500"
                onClick={() => onInsert(message.content)}
              >
                <ArrowDownToLine className="mr-1 size-3.5" />
                Insert into draft
              </Button>
            ) : null}
          </div>
        ))}

        {hits.length > 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
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
                  className="block rounded-xl border border-zinc-200 bg-white px-3 py-2 transition hover:border-emerald-200"
                >
                  <div className="text-sm font-medium text-zinc-900 line-clamp-2">{hit.title}</div>
                  <div className="mt-1 text-xs text-zinc-500 line-clamp-2">{hit.snippet}</div>
                  <div className="mt-1 text-[11px] text-emerald-700">
                    {hit.source}
                    {hit.publishedAt ? ` · ${hit.publishedAt}` : ""}
                  </div>
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-zinc-200 px-5 py-4">
        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder={
            researchEnabled
              ? "Ask for related news, market reaction, or a short report…"
              : placeholder
          }
          className="min-h-24 resize-none border-zinc-200 bg-zinc-50"
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void send("chat");
            }
          }}
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-zinc-400">⌘/Ctrl + Enter</div>
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
