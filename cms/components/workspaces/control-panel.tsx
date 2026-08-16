"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

type Settings = {
  sheetUrl: string;
  publishingPaused: string;
  pauseMode?: string;
  postToWritingOnApprove: string;
  dailyQuoteEnabled: string;
  dailyHadithEnabled: string;
  dailyQuoteMode: string;
  dailyHadithMode: string;
};

type MacroRefreshStatus = {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  result: {
    ok?: boolean;
    saved?: number;
    countries?: string[];
    error?: string;
  } | null;
};

export function ControlPanel({
  initialSettings,
  health,
}: {
  initialSettings: Settings;
  health: {
    ok: boolean;
    source: string;
    counts: { pendingOutbox: number; outbox: number; events: number; posts: number };
    botApiUrl?: string;
    message?: string;
  };
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [macroRefresh, setMacroRefresh] = useState<MacroRefreshStatus | null>(null);
  const [refreshError, setRefreshError] = useState("");

  async function loadMacroRefresh() {
    const response = await fetch("/api/macro/refresh", { cache: "no-store" });
    const data = (await response.json()) as MacroRefreshStatus & { error?: string };
    if (!response.ok) throw new Error(data.error || "Unable to read macro refresh status");
    setMacroRefresh(data);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadMacroRefresh().catch((error) => setRefreshError((error as Error).message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!macroRefresh?.running) return;
    const timer = window.setInterval(() => {
      void loadMacroRefresh().catch((error) => setRefreshError((error as Error).message));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [macroRefresh?.running]);

  async function refreshMacroCalendar() {
    setRefreshError("");
    try {
      const response = await fetch("/api/macro/refresh", { method: "POST" });
      const data = (await response.json()) as MacroRefreshStatus & { error?: string };
      if (!response.ok && response.status !== 409) {
        throw new Error(data.error || "Unable to start macro refresh");
      }
      setMacroRefresh(data);
    } catch (error) {
      setRefreshError((error as Error).message);
    }
  }

  async function save(next: Partial<Settings>) {
    const merged = { ...settings, ...next };
    setSettings(merged);
    setSaving(true);
    setStatus("");

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publishing_paused: merged.publishingPaused,
          pause_mode: merged.publishingPaused,
          post_to_writing_on_approve: merged.postToWritingOnApprove,
          daily_quote_enabled: merged.dailyQuoteEnabled,
          daily_hadith_enabled: merged.dailyHadithEnabled,
          daily_quote_mode: merged.dailyQuoteMode,
          daily_hadith_mode: merged.dailyHadithMode,
        }),
      });
      if (!response.ok) throw new Error("Unable to save settings");
      setStatus("Saved");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const publishingLive = settings.publishingPaused !== "true";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <Card className="overflow-hidden">
        <CardHeader className="space-y-4 border-b border-zinc-200 bg-zinc-50/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-xl">Publishing</CardTitle>
              <p className="mt-1 text-sm text-zinc-500">
                Master pause for the CMS publishing flow.
              </p>
            </div>
            <Badge tone={publishingLive ? "success" : "warning"}>
              {publishingLive ? "Publishing LIVE" : "Publishing PAUSED"}
            </Badge>
          </div>
          <div
            className={`rounded-3xl px-4 py-4 text-sm ${
              publishingLive
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-amber-200 bg-amber-50 text-amber-800"
            }`}
          >
            {publishingLive
              ? "The bot can publish approved content and continue the normal flow."
              : "Publishing is stopped. Drafts can still be edited, but approved content will not be sent out."}
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-zinc-200 px-4 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-zinc-950">Pause publishing</div>
                  <div className="text-sm text-zinc-500">
                    Stops scheduled publishing and outbound delivery.
                  </div>
                </div>
                <Switch
                  checked={!publishingLive}
                  onCheckedChange={(checked) =>
                    save({ publishingPaused: checked ? "true" : "false" })
                  }
                />
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-200 px-4 py-4">
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Health</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={health.ok ? "success" : "warning"}>
                  {health.ok ? "Bot ok" : "Needs attention"}
                </Badge>
                <span className="text-sm text-zinc-500">
                  {health.counts.pendingOutbox} pending / {health.counts.outbox} outbox
                </span>
              </div>
              {health.message ? (
                <div className="mt-3 text-sm text-zinc-500">{health.message}</div>
              ) : null}
            </div>
          </div>

          <Separator />

          <div className="rounded-3xl border border-zinc-200 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-medium text-zinc-950">Macro calendar</div>
                <p className="mt-1 text-sm text-zinc-500">
                  Force a high-impact refresh across every supported country.
                </p>
              </div>
              <Button onClick={refreshMacroCalendar} disabled={macroRefresh?.running}>
                {macroRefresh?.running ? "Refreshing macro calendar..." : "Refresh macro calendar (all countries)"}
              </Button>
            </div>
            <div className="mt-3 text-sm text-zinc-500">
              {macroRefresh?.running
                ? `Started ${macroRefresh.startedAt ? new Date(macroRefresh.startedAt).toLocaleString() : "just now"}.`
                : macroRefresh?.result
                  ? macroRefresh.result.ok
                    ? `Last run: ${macroRefresh.result.saved ?? 0} events upserted across ${macroRefresh.result.countries?.length ?? 0} countries.`
                    : `Last run failed: ${macroRefresh.result.error || "Unknown error"}`
                  : refreshError || "No CMS-initiated refresh has run since the bot started."}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-zinc-950">Auto-flow</div>
              <p className="mt-1 text-sm text-zinc-500">
                When content is approved, send it to the writing channel automatically.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-3xl border border-zinc-200 px-4 py-4">
              <div>
                <div className="font-medium text-zinc-950">Post to writing on approve</div>
                <div className="text-sm text-zinc-500">
                  Keeps editors and writers in sync without extra manual steps.
                </div>
              </div>
              <Switch
                checked={settings.postToWritingOnApprove === "true"}
                onCheckedChange={(checked) =>
                  save({ postToWritingOnApprove: checked ? "true" : "false" })
                }
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-zinc-950">Daily content</div>
              <p className="mt-1 text-sm text-zinc-500">
                Control the daily quote workflow. Hadith is kept paused in this CMS.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between rounded-3xl border border-zinc-200 px-4 py-4">
                <div>
                  <div className="font-medium text-zinc-950">Daily quote</div>
                  <div className="text-sm text-zinc-500">
                    Enable or pause the daily quote generator.
                  </div>
                </div>
                <Switch
                  checked={settings.dailyQuoteEnabled === "true"}
                  onCheckedChange={(checked) =>
                    save({ dailyQuoteEnabled: checked ? "true" : "false" })
                  }
                />
              </div>

              <div className="rounded-3xl border border-zinc-200 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-zinc-950">Daily hadith</div>
                    <div className="text-sm text-zinc-500">
                      Kept paused here for now.
                    </div>
                  </div>
                  <Badge tone="muted">Paused</Badge>
                </div>
                <div className="mt-3 text-xs uppercase tracking-[0.18em] text-zinc-500">
                  Mode
                </div>
                <div className="mt-1 text-sm text-zinc-600">
                  {settings.dailyHadithMode || "random"}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold text-zinc-950">Schedule</div>
              <p className="mt-1 text-sm text-zinc-500">
                Read-only explanation of the UTC cron flow used by the bot.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { time: "07:00 UTC", title: "Discover", detail: "Collect macro context for the day." },
                {
                  time: "07:15 UTC",
                  title: "Morning brief",
                  detail: "Prepare the daily market summary and optional legacy sheet sync.",
                },
                { time: "07:30 UTC", title: "Daily quote", detail: "Publish the quote if enabled." },
                {
                  time: "Every minute",
                  title: "Alert watcher",
                  detail: "Run T-30 pre-alerts, exact-release drafts, and actual follow-ups.",
                },
                {
                  time: "Every 5 min",
                  title: "Actual refresh",
                  detail: "Re-pull near-term high-impact events so live actuals arrive quickly.",
                },
              ].map((item) => (
                <div key={item.title} className="rounded-3xl border border-zinc-200 px-4 py-4">
                  <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{item.time}</div>
                  <div className="mt-2 font-medium text-zinc-950">{item.title}</div>
                  <div className="mt-1 text-sm text-zinc-500">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-zinc-500">
              {saving ? "Saving..." : status || "Ready"}
            </div>
            <Button variant="outline" onClick={() => save({ ...settings })}>
              Save snapshot
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-600">
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Bot API</div>
              <div className="mt-1 font-medium text-zinc-950">
                {health.botApiUrl || "127.0.0.1:8788"}
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-zinc-200 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Events</div>
                <div className="mt-1 text-2xl font-semibold text-zinc-950">{health.counts.events}</div>
              </div>
              <div className="rounded-2xl border border-zinc-200 px-4 py-3">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Posts</div>
                <div className="mt-1 text-2xl font-semibold text-zinc-950">{health.counts.posts}</div>
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Pending outbox</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-950">
                {health.counts.pendingOutbox}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-600">
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Legacy Sheets
              </div>
              <div className="mt-1 font-medium text-zinc-950">
                {settings.sheetUrl || "Disabled"}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Publishing paused</div>
              <div className="mt-1 font-medium text-zinc-950">{settings.publishingPaused}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                Auto-flow to writing
              </div>
              <div className="mt-1 font-medium text-zinc-950">
                {settings.postToWritingOnApprove}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Daily quote</div>
              <div className="mt-1 font-medium text-zinc-950">{settings.dailyQuoteEnabled}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Daily hadith</div>
              <div className="mt-1 font-medium text-zinc-950">{settings.dailyHadithMode}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
