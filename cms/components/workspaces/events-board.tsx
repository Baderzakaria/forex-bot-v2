"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { AiChat } from "@/components/workspaces/ai-chat";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";

type EventRow = {
  event_key: string;
  title: string | null;
  currency: string | null;
  country_code: string | null;
  event_time_utc: string | null;
  importance: string | null;
  forecast: string | null;
  previous: string | null;
  actual: string | null;
};

type RailView = "day" | "upcoming" | "previous";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toDayKey(value: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function getMonthCursor(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function sameMonth(dayKey: string, cursor: Date) {
  return dayKey.startsWith(
    `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`
  );
}

function isHighImpact(event: EventRow) {
  return (event.importance || "").toLowerCase() === "high";
}

function formatMonthTitle(cursor: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(cursor);
}

function buildDraft(event: EventRow) {
  return [
    `🔥 HIGH IMPACT EVENT`,
    ``,
    `📍 ${event.country_code || "?"} · ${event.currency || "?"}`,
    `📊 ${event.title || "Event"}`,
    `⏰ ${formatDateTime(event.event_time_utc)}`,
    `📈 Forecast: ${event.forecast || "—"} · Prior: ${event.previous || "—"}`,
  ].join("\n");
}

export function EventsBoard({ events }: { events: EventRow[] }) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [cursor, setCursor] = useState(() => getMonthCursor(new Date()));
  const [selectedDay, setSelectedDay] = useState(todayIso);
  const [railView, setRailView] = useState<RailView>("day");
  const [drawerEvent, setDrawerEvent] = useState<EventRow | null>(null);
  const [draftText, setDraftText] = useState("");
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  const grouped = useMemo(() => {
    return events.reduce<Record<string, EventRow[]>>((acc, event) => {
      const dayKey = toDayKey(event.event_time_utc);
      if (!dayKey) return acc;
      acc[dayKey] = acc[dayKey] || [];
      acc[dayKey].push(event);
      return acc;
    }, {});
  }, [events]);

  const monthDays = useMemo(() => {
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth();
    const firstDay = new Date(Date.UTC(year, month, 1));
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const leading = firstDay.getUTCDay();
    const cells: Array<{ key: string; label: string; day?: number }> = [];
    for (let index = 0; index < leading; index += 1) {
      cells.push({ key: `blank-${index}`, label: "" });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ key: iso, label: String(day), day });
    }
    return cells;
  }, [cursor]);

  const selectedEvents = useMemo(() => {
    const dayEvents = grouped[selectedDay] || [];
    const highImpact = dayEvents.filter(isHighImpact);
    return highImpact.length > 0 ? highImpact : dayEvents;
  }, [grouped, selectedDay]);

  const upcomingEvents = useMemo(
    () =>
      events
        .filter((event) => {
          const time = event.event_time_utc ? new Date(event.event_time_utc).getTime() : 0;
          return time >= Date.now();
        })
        .slice(0, 8),
    [events]
  );

  const previousEvents = useMemo(
    () =>
      events
        .filter((event) => {
          const time = event.event_time_utc ? new Date(event.event_time_utc).getTime() : 0;
          return time < Date.now();
        })
        .slice(0, 8),
    [events]
  );

  const railEvents =
    railView === "day" ? selectedEvents : railView === "upcoming" ? upcomingEvents : previousEvents;

  function openDraft(event: EventRow) {
    setDrawerEvent(event);
    setStatus("");
    setDraftText(buildDraft(event));
  }

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

  const contextLabel = drawerEvent
    ? `${drawerEvent.title || "Event"} · ${drawerEvent.currency || "?"} · ${formatDateTime(drawerEvent.event_time_utc)}`
    : undefined;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card>
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="font-serif text-2xl">Month calendar</CardTitle>
                <p className="mt-1 text-sm text-zinc-500">
                  Click a day, then pick an event — AI switches with your selection.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon-sm" onClick={() => setCursor((c) => new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() - 1, 1)))}>
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="min-w-44 rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-center text-sm font-medium">
                  {formatMonthTitle(cursor)}
                </div>
                <Button variant="outline" size="icon-sm" onClick={() => setCursor((c) => new Date(Date.UTC(c.getUTCFullYear(), c.getUTCMonth() + 1, 1)))}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">
              {weekdayLabels.map((label) => (
                <div key={label} className="py-2">{label}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {monthDays.map((cell) => {
                if (!cell.day) return <div key={cell.key} className="min-h-28 rounded-3xl" />;
                const dayEvents = grouped[cell.key] || [];
                const highImpact = dayEvents.filter(isHighImpact);
                const active = selectedDay === cell.key;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelectedDay(cell.key)}
                    className={`min-h-28 rounded-3xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-emerald-300 bg-emerald-50 shadow-sm"
                        : "border-zinc-200 bg-white hover:border-emerald-200 hover:bg-zinc-50"
                    } ${sameMonth(cell.key, cursor) ? "" : "opacity-80"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-semibold">{cell.day}</div>
                      {highImpact.length > 0 ? (
                        <Badge tone="success">{highImpact.length}</Badge>
                      ) : dayEvents.length > 0 ? (
                        <Badge tone="muted">{dayEvents.length}</Badge>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div key={event.event_key} className="text-xs font-medium text-zinc-700 line-clamp-2">
                          {event.title || "Untitled"}
                        </div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle>Day panel</CardTitle>
            <div className="flex flex-wrap gap-2">
              {(["day", "upcoming", "previous"] as RailView[]).map((view) => (
                <Button
                  key={view}
                  variant={railView === view ? "default" : "outline"}
                  onClick={() => setRailView(view)}
                >
                  {view[0].toUpperCase() + view.slice(1)}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {railEvents.length ? (
              railEvents.map((event) => (
                <button
                  key={event.event_key}
                  type="button"
                  onClick={() => openDraft(event)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    drawerEvent?.event_key === event.event_key
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-zinc-200 hover:border-emerald-200 hover:bg-zinc-50"
                  }`}
                >
                  <div className="font-medium">{event.title || "Untitled event"}</div>
                  <div className="mt-1 text-sm text-zinc-500">
                    {event.currency || "?"} · {formatDateTime(event.event_time_utc)}
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-500">
                No events in this view.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {drawerEvent ? (
        <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white">
          <div className="grid min-h-[640px] xl:grid-cols-2">
            <div className="flex flex-col border-b border-zinc-200 xl:border-b-0 xl:border-r">
              <div className="border-b border-zinc-200 px-5 py-4">
                <div className="font-serif text-xl text-zinc-950">
                  {drawerEvent.title || "Untitled event"}
                </div>
                <div className="mt-1 text-sm text-zinc-500">
                  {drawerEvent.currency || "?"} · {drawerEvent.country_code || "?"} ·{" "}
                  {formatDateTime(drawerEvent.event_time_utc)}
                </div>
              </div>
              <div className="flex-1 space-y-4 p-5">
                <Textarea
                  value={draftText}
                  onChange={(event) => setDraftText(event.target.value)}
                  className="min-h-[360px] resize-none font-serif text-[15px] leading-7"
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={() => setStatus("Draft staged locally.")}>Stage draft</Button>
                  <Button variant="default" onClick={sendTestNow} disabled={sending || !draftText.trim()}>
                    {sending ? "Sending…" : "Send test now"}
                  </Button>
                  <Button variant="outline" onClick={() => setDrawerEvent(null)}>
                    Close
                  </Button>
                  {status ? <span className="text-sm text-zinc-500">{status}</span> : null}
                </div>
              </div>
            </div>

            <AiChat
              key={drawerEvent.event_key}
              variant="panel"
              title="AI"
              contextLabel={contextLabel}
              contextPayload={{
                type: "macro_event",
                ...drawerEvent,
                draftText,
              }}
              welcome={`Linked to ${drawerEvent.title || "this event"}. Ask for a rewrite — I'll stay on this event until you pick another.`}
              systemPrompt={`You are a financial desk editor for one selected macro event. Stay locked to that event. When web research is available, weave related news and market implications into a concise Telegram-ready note. Cite source names briefly. Be publish-ready.`}
              placeholder="Rewrite this event post, tighten the angle, or add risk notes…"
              onInsert={(text) => setDraftText(text)}
              defaultResearch
            />
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-zinc-300 px-6 py-10 text-sm text-zinc-500">
          Select an event from the day panel to open the half-screen draft + AI workspace.
        </div>
      )}
    </div>
  );
}
