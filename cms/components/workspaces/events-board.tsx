"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EventRelativeTimeLabel, EventTimeLabel, NowClock } from "@/components/ui/event-time-label";
import { cn } from "@/lib/utils";
import { formatDateTimeLocal, formatDateTimeUtc } from "@/lib/format";
import {
  type EventRow,
  type EventAlertMeta,
  type RailView,
  getEventTime,
  monthCursorFromKey,
  monthKeyFromDate,
  normalizeDayKey,
  toDayKey,
} from "@/lib/events";
import { EventDrawer, buildDraft } from "@/components/workspaces/event-drawer";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const monthTitles = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const subscribe = () => () => {};

function isHighImpact(event: EventRow) {
  return (event.importance || "").toLowerCase() === "high";
}

function formatMonthTitle(cursor: Date) {
  return `${monthTitles[cursor.getUTCMonth()]} ${cursor.getUTCFullYear()}`;
}

export function EventsBoard({
  events,
  alertMetaByEventKey,
  nowIso,
  initialView,
  initialSelectedDay,
  initialMonthKey,
  initialOpenEventKey,
}: {
  events: EventRow[];
  alertMetaByEventKey: Record<string, EventAlertMeta>;
  nowIso: string;
  initialView: RailView;
  initialSelectedDay: string;
  initialMonthKey: string;
  initialOpenEventKey: string | null;
}) {
  const serverNow = new Date(nowIso);
  const todayIso = toDayKey(nowIso) || nowIso.slice(0, 10);
  const initialDay = normalizeDayKey(initialSelectedDay) || todayIso;
  const initialCursor = monthCursorFromKey(initialMonthKey, serverNow);
  const initialDrawerEvent =
    initialOpenEventKey ? events.find((event) => event.event_key === initialOpenEventKey) ?? null : null;

  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [railView, setRailView] = useState<RailView>(initialView);
  const [cursor, setCursor] = useState(initialCursor);
  const [drawerEventKey, setDrawerEventKey] = useState<string | null>(initialDrawerEvent?.event_key ?? null);
  const [liveNowIso, setLiveNowIso] = useState(nowIso);
  const [draftState, setDraftState] = useState(() => ({
    value: initialDrawerEvent ? buildDraft(initialDrawerEvent) : "",
    dirty: false,
  }));
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  useEffect(() => {
    const tick = () => setLiveNowIso(new Date().toISOString());
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const grouped = events.reduce<Record<string, EventRow[]>>((acc, event) => {
    const dayKey = toDayKey(event.event_time_utc);
    if (!dayKey) return acc;
    acc[dayKey] = acc[dayKey] || [];
    acc[dayKey].push(event);
    return acc;
  }, {});

  const drawerEvent = drawerEventKey
    ? events.find((event) => event.event_key === drawerEventKey) ?? null
    : null;
  const draftText =
    drawerEvent && !draftState.dirty && mounted
      ? buildDraft(drawerEvent, formatDateTimeLocal(drawerEvent.event_time_utc))
      : draftState.value;

  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const leading = firstDay.getUTCDay();
  const monthDays: Array<{ key: string; label: string; day?: number }> = [];

  for (let index = 0; index < leading; index += 1) {
    monthDays.push({ key: `blank-${index}`, label: "" });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    monthDays.push({ key: iso, label: String(day), day });
  }

  const dayEventsForSelection = grouped[selectedDay] || [];
  const selectedEvents = (() => {
    const highImpact = dayEventsForSelection.filter(isHighImpact);
    return highImpact.length > 0 ? highImpact : dayEventsForSelection;
  })();

  const upcomingEvents = events
    .filter((event) => {
      const time = getEventTime(event.event_time_utc);
      return time !== null && time >= serverNow.getTime();
    })
    .slice(0, 8);

  const previousEvents = events
    .filter((event) => {
      const time = getEventTime(event.event_time_utc);
      return time !== null && time < serverNow.getTime();
    })
    .slice(0, 8);

  const railEvents = railView === "day" ? selectedEvents : railView === "upcoming" ? upcomingEvents : previousEvents;
  const contextLabel = drawerEvent
    ? mounted
      ? `${drawerEvent.title || "Event"} · ${drawerEvent.currency || "?"} · ${formatDateTimeLocal(
          drawerEvent.event_time_utc
        )} · ${formatDateTimeUtc(drawerEvent.event_time_utc)}`
      : `${drawerEvent.title || "Event"} · ${drawerEvent.currency || "?"} · ${formatDateTimeUtc(
          drawerEvent.event_time_utc
        )}`
    : undefined;

  function selectDay(dayKey: string) {
    setSelectedDay(dayKey);
    setRailView("day");
    setDrawerEventKey(null);
  }

  function openDraft(event: EventRow) {
    const eventDayKey = normalizeDayKey(toDayKey(event.event_time_utc)) || selectedDay;
    setSelectedDay(eventDayKey);
    setRailView("day");
    setCursor(monthCursorFromKey(eventDayKey.slice(0, 7), cursor));
    setDrawerEventKey(event.event_key);
    setDraftState({ value: buildDraft(event), dirty: false });
  }

  function shiftMonth(delta: number) {
    setCursor((current) => {
      const nextCursor = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + delta, 1));
      setSelectedDay(monthKeyFromDate(nextCursor) + "-01");
      setRailView("day");
      setDrawerEventKey(null);
      return nextCursor;
    });
  }

  const currentMonthPrefix = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`;

  function renderTimerLabel(status: EventAlertMeta["t30"]["status"], atLabel?: string) {
    if (status === "none") return "—";
    return atLabel || status;
  }

  function chipClass(status: EventAlertMeta["t30"]["status"]) {
    if (status === "sent") {
      return "border-transparent bg-[rgba(159,202,90,0.16)] text-[#55712a]";
    }
    if (status === "due") {
      return "border-transparent bg-[rgba(217,164,65,0.16)] text-[#8d6621]";
    }
    if (status === "missed" || status === "past") {
      return "border-transparent bg-[rgba(196,84,72,0.14)] text-[#9a3b2b]";
    }
    return "border-[var(--fx-border-soft)] bg-white text-[var(--fx-text-soft)]";
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.34fr)_minmax(320px,0.66fr)]">
        <Card className="overflow-hidden">
          <CardHeader className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-2xl font-medium tracking-[-0.03em]">Month calendar</CardTitle>
                <p className="mt-1 text-sm text-[var(--fx-text-soft)]">
                  Click a day, then pick an event - AI switches with your selection.
                </p>
                <NowClock
                  nowIso={liveNowIso}
                  className="mt-3 inline-flex rounded-full border border-[var(--fx-border-soft)] bg-[rgba(223,243,235,0.55)] px-4 py-2 text-sm font-medium text-[var(--fx-text-strong)]"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Previous month"
                  onClick={() => shiftMonth(-1)}
                  className="inline-flex size-8 items-center justify-center rounded-full border border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.85)] text-[var(--fx-text-soft)] transition hover:border-[var(--fx-border-strong)] hover:bg-[var(--fx-sage)] hover:text-[var(--fx-text-strong)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <div className="min-w-44 rounded-full border border-[var(--fx-border-soft)] bg-[rgba(223,243,235,0.55)] px-4 py-2 text-center text-sm font-medium text-[var(--fx-text-strong)]">
                  {formatMonthTitle(cursor)}
                </div>
                <button
                  type="button"
                  aria-label="Next month"
                  onClick={() => shiftMonth(1)}
                  className="inline-flex size-8 items-center justify-center rounded-full border border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.85)] text-[var(--fx-text-soft)] transition hover:border-[var(--fx-border-strong)] hover:bg-[var(--fx-sage)] hover:text-[var(--fx-text-strong)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--fx-text-muted)]">
              {weekdayLabels.map((label) => (
                <div key={label} className="py-2">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {monthDays.map((cell) => {
                if (!cell.day) return <div key={cell.key} className="min-h-28 rounded-3xl" />;

                const dayEvents = grouped[cell.key] || [];
                const highImpact = dayEvents.filter(isHighImpact);
                const active = selectedDay === cell.key;

                return (
                  <div
                    key={cell.key}
                    role="button"
                    tabIndex={0}
                    aria-pressed={active}
                    aria-label={`Show events for ${cell.key}`}
                    onClick={() => selectDay(cell.key)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      selectDay(cell.key);
                    }}
                    className={cn(
                      "min-h-28 cursor-pointer rounded-[24px] border px-3 py-3 text-left transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                      active
                        ? "border-[var(--fx-ops-ink)] bg-[var(--fx-sage)] shadow-[0_14px_34px_rgba(22,49,68,0.1)]"
                        : "border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.82)] hover:border-[var(--fx-border-strong)] hover:bg-[rgba(223,243,235,0.4)]",
                      cell.key.startsWith(currentMonthPrefix) ? "" : "opacity-80"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--fx-text-strong)]">{cell.day}</span>
                      {highImpact.length > 0 ? (
                        <Badge tone="success">{highImpact.length}</Badge>
                      ) : dayEvents.length > 0 ? (
                        <Badge tone="muted">{dayEvents.length}</Badge>
                      ) : null}
                    </div>
                    <div className="mt-3 space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <button
                          key={event.event_key}
                          type="button"
                          onClick={(eventClick) => {
                            eventClick.stopPropagation();
                            openDraft(event);
                          }}
                          className="block w-full rounded-[14px] border border-transparent px-2 py-1 text-left text-xs font-medium text-[var(--fx-text-soft)] transition hover:border-[var(--fx-border-soft)] hover:bg-white hover:text-[var(--fx-text-strong)] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <span className="line-clamp-2">{event.title || "Untitled"}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader className="space-y-3">
            <CardTitle className="text-xl font-medium tracking-[-0.03em]">Day panel</CardTitle>
            <div className="flex flex-wrap gap-2">
              {(["day", "upcoming", "previous"] as RailView[]).map((nextView) => (
                <button
                  key={nextView}
                  type="button"
                  aria-current={railView === nextView ? "page" : undefined}
                  onClick={() => setRailView(nextView)}
                  className={cn(
                    "inline-flex items-center justify-center rounded-full border px-3 py-2 text-sm font-medium transition",
                    railView === nextView
                      ? "border-[var(--fx-ops-ink)] bg-[var(--fx-ops-ink)] text-white shadow-[0_10px_22px_rgba(22,49,68,0.14)]"
                      : "border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.82)] text-[var(--fx-text-soft)] hover:border-[var(--fx-border-strong)] hover:bg-[var(--fx-sage)] hover:text-[var(--fx-text-strong)]"
                  )}
                >
                  {nextView[0].toUpperCase() + nextView.slice(1)}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {railEvents.length ? (
              railEvents.map((event) => {
                const eventDayKey = toDayKey(event.event_time_utc) || selectedDay;
                const isOpen = drawerEvent?.event_key === event.event_key;
                const alertMeta = alertMetaByEventKey[event.event_key];
                const t30 = alertMeta?.t30;
                const t0 = alertMeta?.t0;
                const sentAny = Boolean(alertMeta?.sentAny);

                return (
                  <button
                    key={event.event_key}
                    type="button"
                    aria-current={isOpen ? "page" : undefined}
                    onClick={() => openDraft(event)}
                    className={cn(
                      "block w-full rounded-[22px] border px-4 py-3 text-left transition",
                      isOpen
                        ? "border-[var(--fx-ops-ink)] bg-[var(--fx-sage)] ring-1 ring-[rgba(22,49,68,0.14)]"
                        : sentAny
                          ? "border-[rgba(159,202,90,0.45)] bg-[rgba(223,243,235,0.62)] hover:border-[var(--fx-border-strong)] hover:bg-[rgba(223,243,235,0.78)]"
                          : "border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.82)] hover:border-[var(--fx-border-strong)] hover:bg-[rgba(223,243,235,0.38)]"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium tracking-[-0.02em] text-[var(--fx-text-strong)]">{event.title || "Untitled event"}</div>
                        <div className="mt-1 text-sm text-[var(--fx-text-soft)]">{event.currency || "?"}</div>
                        <EventTimeLabel value={event.event_time_utc} className="mt-1 text-xs leading-5" />
                        <EventRelativeTimeLabel
                          value={event.event_time_utc}
                          nowIso={liveNowIso}
                          className="mt-1"
                        />
                        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[var(--fx-text-muted)]">
                          {eventDayKey}
                        </div>
                      </div>
                      {sentAny ? (
                        <Badge tone="success" className="shrink-0">
                          Sent
                        </Badge>
                      ) : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium", chipClass(t30?.status ?? "none"))}
                      >
                        T-30 · {renderTimerLabel(t30?.status ?? "none", t30?.atLabel)}
                      </span>
                      <span
                        className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium", chipClass(t0?.status ?? "none"))}
                      >
                        T+0 · {renderTimerLabel(t0?.status ?? "none", t0?.atLabel)}
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[22px] border border-dashed border-[var(--fx-border-soft)] px-4 py-8 text-sm text-[var(--fx-text-soft)]">
                No events in this view.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {drawerEvent ? (
        <EventDrawer
          key={drawerEvent.event_key}
          event={drawerEvent}
          contextLabel={contextLabel}
          draftText={draftText}
          onDraftTextChange={(value) => setDraftState({ value, dirty: true })}
          onClose={() => setDrawerEventKey(null)}
        />
      ) : (
        <div className="rounded-[28px] border border-dashed border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.58)] px-6 py-10 text-sm text-[var(--fx-text-soft)]">
          Select an event from the day panel to open the half-screen draft + AI workspace.
        </div>
      )}
    </div>
  );
}
