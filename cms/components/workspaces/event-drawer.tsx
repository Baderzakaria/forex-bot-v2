"use client";

import { Component, type ReactNode, useEffect, useRef, useState } from "react";

import { AiChat } from "@/components/workspaces/ai-chat";
import { Button } from "@/components/ui/button";
import { EventTimeLabel } from "@/components/ui/event-time-label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTimeUtc } from "@/lib/format";
import { type EventRow } from "@/lib/events";

class AiChatBoundary extends Component<
  { children: ReactNode; eventTitle: string },
  { hasError: boolean; message: string }
> {
  state = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "AI workspace failed to load.",
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[520px] flex-col items-start justify-center gap-3 border-l border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.72)] px-5 py-4">
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--fx-text-muted)]">
            AI workspace
          </div>
          <div className="text-sm font-medium text-[var(--fx-text-strong)]">{this.props.eventTitle}</div>
          <div className="rounded-[18px] border border-transparent bg-[rgba(217,164,65,0.16)] px-4 py-3 text-sm text-[#8d6621]">
            AI panel failed to render: {this.state.message}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function buildDraft(event: EventRow, localTimeLabel?: string | null) {
  return [
    `🔥 HIGH IMPACT EVENT`,
    ``,
    `📍 ${event.country_code || "?"} · ${event.currency || "?"}`,
    `📊 ${event.title || "Event"}`,
    localTimeLabel ? `🕒 Local: ${localTimeLabel}` : null,
    `⏱ UTC: ${formatDateTimeUtc(event.event_time_utc)}`,
    `📈 Forecast: ${event.forecast || "—"} · Prior: ${event.previous || "—"}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

export function EventDrawer({
  event,
  contextLabel,
  draftText,
  onDraftTextChange,
  onClose,
}: {
  event: EventRow;
  contextLabel?: string;
  draftText: string;
  onDraftTextChange: (value: string) => void;
  onClose: () => void;
}) {
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    drawerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  async function sendTestNow() {
    if (!draftText.trim()) return;
    setSending(true);
    setStatus("");
    try {
      const res = await fetch("/api/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: draftText, channel: "telegram_admin" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Send failed");
      setStatus(`Sent test → admin (msg ${data.messageId})`);
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div ref={drawerRef} className="overflow-hidden rounded-[28px] border border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.8)] shadow-[var(--fx-shadow-soft)] backdrop-blur-xl">
      <div className="sticky top-3 z-20 border-b border-[var(--fx-border-soft)] bg-[rgba(223,243,235,0.88)] px-5 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--fx-ops-ink)]">
            AI workspace open
          </div>
          <div className="text-xs text-[var(--fx-text-soft)]">
            Drafting {event.title || "selected event"}
          </div>
        </div>
      </div>
      <div className="grid min-h-[640px] xl:grid-cols-2">
        <div className="flex flex-col border-b border-[var(--fx-border-soft)] xl:border-b-0 xl:border-r">
          <div className="border-b border-[var(--fx-border-soft)] px-5 py-4">
            <div className="text-xl font-medium tracking-[-0.03em] text-[var(--fx-text-strong)]">
              {event.title || "Untitled event"}
            </div>
            <div className="mt-1 text-sm text-[var(--fx-text-soft)]">
              {event.currency || "?"} · {event.country_code || "?"}
            </div>
            <EventTimeLabel
              value={event.event_time_utc}
              className="mt-1 text-sm leading-6"
            />
          </div>
          <div className="flex-1 space-y-4 p-5">
            <Textarea
              value={draftText}
              onChange={(inputEvent) => onDraftTextChange(inputEvent.target.value)}
              className="min-h-[360px] resize-none text-[15px] leading-7"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => setStatus("Draft staged locally.")}>Stage draft</Button>
              <Button variant="default" onClick={sendTestNow} disabled={sending || !draftText.trim()}>
                {sending ? "Sending…" : "Send test now"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
              >
                Close
              </Button>
              {status ? <span className="text-sm text-[var(--fx-text-soft)]">{status}</span> : null}
            </div>
          </div>
        </div>

        <AiChatBoundary key={event.event_key} eventTitle={event.title || "Untitled event"}>
          <AiChat
            key={event.event_key}
            variant="panel"
            title="AI"
            contextLabel={contextLabel}
            contextPayload={{
              type: "macro_event",
              ...event,
              draftText,
            }}
            welcome={`Linked to ${event.title || "this event"}. Ask for a rewrite - I'll stay on this event until you pick another.`}
            systemPrompt={`You are a financial desk editor for one selected macro event. Stay locked to that event. When web research is available, weave related news and market implications into a concise Telegram-ready note. Cite source names briefly. Be publish-ready.`}
            placeholder="Rewrite this event post, tighten the angle, or add risk notes…"
            onInsert={onDraftTextChange}
            defaultResearch
          />
        </AiChatBoundary>
      </div>
    </div>
  );
}
