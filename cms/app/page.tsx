import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/shell/page-shell";
import { DashboardAi } from "@/components/workspaces/dashboard-ai";
import {
  getBotHealth,
  listLatestPosts,
  listUpcomingEvents,
  listOutbox,
} from "@/lib/bot-data";
import { clampText, formatDate, formatDateTimeUtc } from "@/lib/format";
import Link from "next/link";

export default function Home() {
  const health = getBotHealth();
  const upcoming = listUpcomingEvents(5);
  const drafts = listLatestPosts(4);
  const outbox = listOutbox(4);
  const nextEvent = upcoming[0] ?? null;
  const nextEventLabel = nextEvent
    ? `${nextEvent.title || "Untitled"} · ${nextEvent.currency || "?"} · ${nextEvent.country_code || "?"}`
    : "No upcoming events in the current queue window.";

  return (
    <div className="px-4 py-4 lg:px-8 lg:py-6">
      <PageShell
        title="Dashboard"
        subtitle="KPI snapshot, next events, draft queue, and bot health at a glance."
        actions={
          <>
            <Link
              href="/events"
              className="inline-flex h-9 items-center justify-center rounded-[14px] border border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.82)] px-3 text-sm font-medium text-[var(--fx-text-strong)] transition hover:border-[var(--fx-border-strong)] hover:bg-[var(--fx-sage)]"
            >
              Review events
            </Link>
            <Link
              href="/control"
              className="inline-flex h-9 items-center justify-center rounded-[14px] border border-[var(--fx-ops-ink)] bg-[var(--fx-ops-ink)] px-3 text-sm font-medium text-white transition hover:bg-[var(--fx-ops-slate)]"
            >
              Open control
            </Link>
          </>
        }
      >
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <Card className="overflow-hidden border-[color:rgba(22,49,68,0.14)] bg-[var(--fx-ops-ink)] text-white shadow-[0_24px_70px_rgba(22,49,68,0.22)]">
            <CardHeader className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge className="border-white/10 bg-white/10 text-white">Next release</Badge>
                <span className="text-xs uppercase tracking-[0.22em] text-white/55">
                  {health.ok ? "Bot healthy" : "Needs attention"}
                </span>
              </div>
              <div className="space-y-4">
                <CardTitle className="text-3xl font-medium tracking-[-0.04em] text-white">
                  {nextEvent ? nextEvent.title || "Untitled event" : "Queue clear"}
                </CardTitle>
                <p className="max-w-2xl text-sm leading-6 text-white/72">
                  {nextEventLabel}
                </p>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 border-t border-white/10 p-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.22em] text-white/45">Operational readout</div>
                <div className="text-4xl font-medium tracking-[-0.05em]">
                  {upcoming.length}
                </div>
                <div className="text-sm text-white/70">Events visible in the next queue window.</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/events"
                  className="inline-flex h-9 items-center justify-center rounded-[14px] border border-white/10 bg-white/10 px-3 text-sm font-medium text-white transition hover:bg-white/15"
                >
                  Review events
                </Link>
                <Link
                  href="/content"
                  className="inline-flex h-9 items-center justify-center rounded-[14px] border border-[var(--fx-sage)] bg-[var(--fx-sage)] px-3 text-sm font-medium text-[var(--fx-ops-ink)] transition hover:bg-white"
                >
                  Open content
                </Link>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card>
              <CardHeader className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Bot health</CardTitle>
                  <Badge tone={health.ok ? "success" : "warning"}>
                    {health.ok ? "Healthy" : "Needs attention"}
                  </Badge>
                </div>
                <p className="text-sm text-[var(--fx-text-soft)]">
                  {health.source === "proxy"
                    ? "Proxy health check returned successfully."
                    : health.message || "Local SQLite check succeeded."}
                </p>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader className="space-y-3">
                <CardTitle>Quick counts</CardTitle>
                <p className="text-sm text-[var(--fx-text-soft)]">
                  Drafts, outbox rows, and release pressure in one glance.
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-3 gap-3">
                <div className="rounded-[20px] border border-[var(--fx-border-soft)] bg-[rgba(223,243,235,0.52)] px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--fx-text-soft)]">Drafts</div>
                  <div className="mt-2 text-3xl font-medium tracking-[-0.04em] text-[var(--fx-text-strong)]">
                    {drafts.length}
                  </div>
                </div>
                <div className="rounded-[20px] border border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.76)] px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--fx-text-soft)]">Outbox</div>
                  <div className="mt-2 text-3xl font-medium tracking-[-0.04em] text-[var(--fx-text-strong)]">
                    {outbox.length}
                  </div>
                </div>
                <div className="rounded-[20px] border border-[var(--fx-border-soft)] bg-[rgba(22,49,68,0.04)] px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-[var(--fx-text-soft)]">High impact</div>
                  <div className="mt-2 text-3xl font-medium tracking-[-0.04em] text-[var(--fx-text-strong)]">
                    {upcoming.filter((event) => event.importance === "high").length}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Next events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcoming.slice(0, 5).map((event) => (
                <div
                  key={event.event_key}
                  className="flex items-center justify-between gap-4 rounded-[20px] border border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.78)] px-4 py-3"
                >
                  <div>
                    <div className="font-medium tracking-[-0.02em] text-[var(--fx-text-strong)]">{event.title || "Untitled"}</div>
                    <div className="text-sm text-[var(--fx-text-soft)]">
                      {event.currency || "?"} · {event.country_code || "?"} ·{" "}
                    {formatDateTimeUtc(event.event_time_utc)}
                    </div>
                  </div>
                  <Badge tone={event.importance === "high" ? "warning" : "muted"}>
                    {event.importance || "normal"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Draft queue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {drafts.map((post) => (
                <div
                  key={`${post.post_id}:${post.version}`}
                  className="rounded-[20px] border border-[var(--fx-border-soft)] bg-[rgba(247,245,240,0.55)] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium tracking-[-0.02em] text-[var(--fx-text-strong)]">{post.post_id}</div>
                    <Badge tone={post.status === "published" ? "success" : "default"}>
                      {post.status || "draft"}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-[var(--fx-text-soft)]">{clampText(post.draft_text, 110)}</div>
                  <div className="mt-2 text-xs text-[var(--fx-text-muted)]">{formatDate(post.updated_at)}</div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <DashboardAi upcomingEvents={upcoming} />

        <Card>
          <CardHeader>
            <CardTitle>Recent outbox</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {outbox.map((row) => (
              <div
                key={row.id}
                className="rounded-[20px] border border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.78)] px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium tracking-[-0.02em] text-[var(--fx-text-strong)]">{row.destination_type || "unknown"}</div>
                  <Badge tone={row.status === "sent" ? "success" : "default"}>
                    {row.status || "pending"}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-[var(--fx-text-soft)]">{clampText(row.content_text, 90)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </PageShell>
    </div>
  );
}
