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
import { clampText, formatDate, formatDateTime } from "@/lib/format";
import Link from "next/link";

export default function Home() {
  const health = getBotHealth();
  const upcoming = listUpcomingEvents(5);
  const drafts = listLatestPosts(4);
  const outbox = listOutbox(4);

  return (
    <div className="px-4 py-4 lg:px-8 lg:py-6">
      <PageShell
        title="Dashboard"
        subtitle="KPI snapshot, next events, draft queue, and bot health at a glance."
        actions={
          <>
            <Link
              href="/events"
              className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50"
            >
              Review events
            </Link>
            <Link
              href="/control"
              className="inline-flex h-9 items-center justify-center rounded-xl border border-zinc-950 bg-zinc-950 px-3 text-sm font-medium text-white transition hover:bg-zinc-800"
            >
              Open control
            </Link>
          </>
        }
      >
        <div className="grid gap-4 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-semibold">{upcoming.length}</div>
              <div className="text-sm text-zinc-500">Visible in the next queue window.</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Drafts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-semibold">{drafts.length}</div>
              <div className="text-sm text-zinc-500">Latest content items in SQLite.</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Outbox</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="text-3xl font-semibold">{outbox.length}</div>
              <div className="text-sm text-zinc-500">Recent delivery rows and status.</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Bot health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Badge tone={health.ok ? "success" : "warning"}>
                {health.ok ? "Healthy" : "Needs attention"}
              </Badge>
              <div className="text-sm text-zinc-500">
                {health.source === "proxy"
                  ? "Proxy health check returned successfully."
                  : health.message || "Local SQLite check succeeded."}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Next events</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcoming.slice(0, 5).map((event) => (
                <div
                  key={event.event_key}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-200 px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-zinc-950">{event.title || "Untitled"}</div>
                    <div className="text-sm text-zinc-500">
                      {event.currency || "?"} · {event.country_code || "?"} ·{" "}
                      {formatDateTime(event.event_time_utc)}
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
                <div key={`${post.post_id}:${post.version}`} className="rounded-2xl border border-zinc-200 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{post.post_id}</div>
                    <Badge tone={post.status === "published" ? "success" : "default"}>
                      {post.status || "draft"}
                    </Badge>
                  </div>
                  <div className="mt-2 text-sm text-zinc-500">{clampText(post.draft_text, 110)}</div>
                  <div className="mt-2 text-xs text-zinc-400">{formatDate(post.updated_at)}</div>
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
              <div key={row.id} className="rounded-2xl border border-zinc-200 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">{row.destination_type || "unknown"}</div>
                  <Badge tone={row.status === "sent" ? "success" : "default"}>
                    {row.status || "pending"}
                  </Badge>
                </div>
                <div className="mt-2 text-sm text-zinc-500">{clampText(row.content_text, 90)}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </PageShell>
    </div>
  );
}
