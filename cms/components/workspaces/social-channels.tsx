"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ChannelId = "telegram" | "x" | "linkedin" | "instagram";

type TelegramDest = {
  label: string;
  status: string;
  value: string;
};

type SocialSettings = {
  socialXHandle: string;
  socialXEnabled: string;
  socialLinkedInHandle: string;
  socialLinkedInEnabled: string;
  socialInstagramHandle: string;
  socialInstagramEnabled: string;
} & Record<string, string>;

type OutboxRow = {
  id: number;
  destination_type: string | null;
  status: string | null;
};

const CHANNELS: Array<{ id: ChannelId; name: string; blurb: string; ready: boolean }> = [
  {
    id: "telegram",
    name: "Telegram",
    blurb: "Live — admin preview, writing group, public channel. Telegram only for now.",
    ready: true,
  },
  {
    id: "x",
    name: "X",
    blurb: "Connect later to publish the same approved posts.",
    ready: false,
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    blurb: "Connect later for professional syndication.",
    ready: false,
  },
  {
    id: "instagram",
    name: "Instagram",
    blurb: "Connect later for visual teasers.",
    ready: false,
  },
];

export function SocialChannels({
  telegramDestinations,
  outbox,
  initialSettings,
}: {
  telegramDestinations: TelegramDest[];
  outbox: OutboxRow[];
  initialSettings: SocialSettings;
}) {
  const [active, setActive] = useState<ChannelId>("telegram");
  const [settings, setSettings] = useState(initialSettings);
  const [status, setStatus] = useState("");
  const channel = useMemo(
    () => CHANNELS.find((item) => item.id === active) || CHANNELS[0],
    [active]
  );

  const socialKey =
    active === "x"
      ? { handle: "socialXHandle", enabled: "socialXEnabled" }
      : active === "linkedin"
        ? { handle: "socialLinkedInHandle", enabled: "socialLinkedInEnabled" }
        : { handle: "socialInstagramHandle", enabled: "socialInstagramEnabled" };
  const currentHandle = settings[socialKey.handle as keyof SocialSettings];
  const currentEnabled = settings[socialKey.enabled as keyof SocialSettings];

  async function saveSocial(next: Partial<SocialSettings>) {
    const merged = { ...settings, ...next };
    setSettings(merged);
    setStatus("Saving...");
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(merged),
      });
      if (!response.ok) throw new Error("Unable to save social settings");
      setStatus("Saved");
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-serif text-2xl">Social</CardTitle>
          <p className="text-sm text-zinc-500">
            Pick a network under Channels. Telegram is live; others stay selectable stubs until OAuth is wired.
          </p>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Channels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {CHANNELS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActive(item.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  active === item.id
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-zinc-200 bg-white hover:border-emerald-200 hover:bg-zinc-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-zinc-950">{item.name}</div>
                  <Badge tone={item.ready ? "success" : "warning"}>
                    {item.ready ? "Connected" : "Not connected"}
                  </Badge>
                </div>
                <div className="mt-1 text-sm text-zinc-500">{item.blurb}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {channel.id === "telegram" ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Telegram destinations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {telegramDestinations.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-zinc-200 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
                          {item.label}
                        </div>
                        <Badge tone="muted">{item.status}</Badge>
                      </div>
                      <div className="mt-1 font-medium text-zinc-950">{item.value}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Recent delivery</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {outbox.length ? (
                    outbox.map((row) => (
                      <div key={row.id} className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm">
                        <div className="font-medium">{row.destination_type}</div>
                        <div className="text-zinc-500">{row.status}</div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-zinc-500">No recent outbox rows.</div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Connect {channel.name}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-zinc-500">
                  {channel.blurb} Handle + enabled flag are stored locally for now. Telegram only until OAuth is wired.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="handle">{channel.name} handle</Label>
                  <Input
                    id="handle"
                    value={currentHandle}
                    onChange={(event) =>
                      setSettings((prev) => ({ ...prev, [socialKey.handle]: event.target.value }))
                    }
                    placeholder={`@your_${channel.id}_account`}
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 px-4 py-3">
                  <div>
                    <div className="font-medium text-zinc-950">Enabled</div>
                    <div className="text-sm text-zinc-500">Toggle when you are ready to connect later.</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        [socialKey.enabled]: currentEnabled === "true" ? "false" : "true",
                      }))
                    }
                  >
                    {currentEnabled === "true" ? "Enabled" : "Disabled"}
                  </Button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-zinc-500">{status || "Ready"}</span>
                  <Button onClick={() => saveSocial({})}>Save {channel.name}</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
