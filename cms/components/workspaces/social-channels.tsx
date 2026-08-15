"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ChannelId = "telegram" | "x" | "linkedin" | "instagram";
type SocialChannelId = Exclude<ChannelId, "telegram">;

type TelegramDest = {
  key: "admin" | "public" | "writing";
  label: string;
  status: string;
};

type TelegramCredentials = {
  adminChatId: string;
  publicChatId: string;
  writingChatId: string;
  maskedBotToken: string;
};

type SocialSettings = {
  socialXHandle: string;
  socialXEnabled: string;
  socialLinkedInHandle: string;
  socialLinkedInEnabled: string;
  socialInstagramHandle: string;
  socialInstagramEnabled: string;
  xConsumerKey: string;
  xConsumerSecret: string;
  xAccessToken: string;
  xAccessTokenSecret: string;
  linkedinAccessToken: string;
  linkedinPersonUrn: string;
  instagramAccessToken: string;
  instagramIgUserId: string;
} & Record<string, string>;

type OutboxRow = {
  id: number;
  destination_type: string | null;
  status: string | null;
};

type CredentialField = {
  label: string;
  stateKey: keyof SocialSettings;
  apiKey: string;
  placeholder: string;
};

const CHANNEL_CREDENTIALS: Record<SocialChannelId, CredentialField[]> = {
  x: [
    { label: "Consumer Key", stateKey: "xConsumerKey", apiKey: "x_consumer_key", placeholder: "API key from developer.twitter.com" },
    { label: "Consumer Secret", stateKey: "xConsumerSecret", apiKey: "x_consumer_secret", placeholder: "API secret" },
    { label: "Access Token", stateKey: "xAccessToken", apiKey: "x_access_token", placeholder: "Access token" },
    { label: "Access Token Secret", stateKey: "xAccessTokenSecret", apiKey: "x_access_token_secret", placeholder: "Access token secret" },
  ],
  linkedin: [
    { label: "Access Token", stateKey: "linkedinAccessToken", apiKey: "linkedin_access_token", placeholder: "OAuth 2.0 access token" },
    { label: "Person URN", stateKey: "linkedinPersonUrn", apiKey: "linkedin_person_urn", placeholder: "urn:li:person:XXXXXXXX" },
  ],
  instagram: [
    { label: "Access Token", stateKey: "instagramAccessToken", apiKey: "instagram_access_token", placeholder: "Facebook Page access token" },
    { label: "IG User ID", stateKey: "instagramIgUserId", apiKey: "instagram_ig_user_id", placeholder: "17841400000000000" },
  ],
};

function isChannelConnected(channelId: SocialChannelId, settings: SocialSettings): boolean {
  return CHANNEL_CREDENTIALS[channelId].every((f) => Boolean(settings[f.stateKey]));
}

const CHANNELS: Array<{ id: ChannelId; name: string; blurb: string }> = [
  {
    id: "telegram",
    name: "Telegram",
    blurb: "Live — admin preview, writing group, public channel.",
  },
  {
    id: "x",
    name: "X",
    blurb: "Publish approved posts to X via Twitter API v2.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    blurb: "Syndicate to LinkedIn via UGC Posts API.",
  },
  {
    id: "instagram",
    name: "Instagram",
    blurb: "Post media captions via Instagram Graph API.",
  },
];

const SOCIAL_SETTING_KEYS: Record<
  SocialChannelId,
  { handle: "socialXHandle" | "socialLinkedInHandle" | "socialInstagramHandle"; enabled: "socialXEnabled" | "socialLinkedInEnabled" | "socialInstagramEnabled"; apiHandle: string; apiEnabled: string }
> = {
  x: {
    handle: "socialXHandle",
    enabled: "socialXEnabled",
    apiHandle: "social_x_handle",
    apiEnabled: "social_x_enabled",
  },
  linkedin: {
    handle: "socialLinkedInHandle",
    enabled: "socialLinkedInEnabled",
    apiHandle: "social_linkedin_handle",
    apiEnabled: "social_linkedin_enabled",
  },
  instagram: {
    handle: "socialInstagramHandle",
    enabled: "socialInstagramEnabled",
    apiHandle: "social_instagram_handle",
    apiEnabled: "social_instagram_enabled",
  },
};

export function SocialChannels({
  telegramDestinations,
  initialTelegramCredentials,
  outbox,
  initialSettings,
}: {
  telegramDestinations: TelegramDest[];
  initialTelegramCredentials: TelegramCredentials;
  outbox: OutboxRow[];
  initialSettings: SocialSettings;
}) {
  const [active, setActive] = useState<ChannelId>("telegram");
  const [settings, setSettings] = useState(initialSettings);
  const [telegramCredentials, setTelegramCredentials] = useState(initialTelegramCredentials);
  const [status, setStatus] = useState("");
  const channel = useMemo(
    () => CHANNELS.find((item) => item.id === active) || CHANNELS[0],
    [active]
  );

  const socialKey = active === "telegram" ? null : SOCIAL_SETTING_KEYS[active];
  const currentEnabled = socialKey ? settings[socialKey.enabled] : "false";

  async function saveSocial(keys: (typeof SOCIAL_SETTING_KEYS)[SocialChannelId]) {
    setStatus("Saving...");
    try {
      const payload: Record<string, string> = {
        [keys.apiHandle]: settings[keys.handle],
        [keys.apiEnabled]: settings[keys.enabled],
      };
      // Save credential fields — skip masked placeholder values (user didn't change them)
      if (active !== "telegram") {
        const credFields = CHANNEL_CREDENTIALS[active as SocialChannelId];
        for (const f of credFields) {
          const val = settings[f.stateKey] || "";
          if (val && val !== "••••••••") {
            payload[f.apiKey] = val;
          }
        }
      }
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Unable to save social settings");
      setStatus("Saved — credentials stored securely.");
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  async function saveTelegramCredentials() {
    setStatus("Saving Telegram settings...");
    try {
      const response = await fetch("/api/telegram/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          TELEGRAM_ADMIN_CHAT_ID: telegramCredentials.adminChatId,
          TELEGRAM_PUBLIC_CHAT_ID: telegramCredentials.publicChatId,
          TELEGRAM_WRITING_CHAT_ID: telegramCredentials.writingChatId,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        credentials?: TelegramCredentials;
      };
      if (!response.ok || !data.ok || !data.credentials) {
        throw new Error(data.error || "Unable to save Telegram settings");
      }
      setTelegramCredentials(data.credentials);
      setStatus("Saved to the persistent settings database.");
    } catch (error) {
      setStatus((error as Error).message);
    }
  }

  function destinationValue(destination: TelegramDest) {
    if (destination.key === "admin") return telegramCredentials.adminChatId || "unset";
    if (destination.key === "public") return telegramCredentials.publicChatId || "unset";
    return telegramCredentials.writingChatId || "unset";
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
            {CHANNELS.map((item) => {
              const connected = item.id === "telegram" || isChannelConnected(item.id as SocialChannelId, settings);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActive(item.id);
                    setStatus("");
                  }}
                  aria-pressed={active === item.id}
                  className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                    active === item.id
                      ? "border-emerald-300 bg-emerald-50"
                      : "border-zinc-200 bg-white hover:border-emerald-200 hover:bg-zinc-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-zinc-950">{item.name}</div>
                    <Badge tone={connected ? "success" : "warning"}>
                      {connected ? "Connected" : "Not connected"}
                    </Badge>
                  </div>
                  <div className="mt-1 text-sm text-zinc-500">{item.blurb}</div>
                </button>
              );
            })}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {channel.id === "telegram" ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Telegram credentials</CardTitle>
                  <p className="text-sm text-zinc-500">
                    Chat destinations are saved to persistent bot storage. The bot token remains server-side and is never editable here.
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="telegram-token">Bot token</Label>
                    <Input id="telegram-token" value={telegramCredentials.maskedBotToken || "Not configured"} disabled />
                    <p className="text-xs text-zinc-500">Masked for safety; only the last four characters are shown.</p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="telegram-admin-chat">Admin chat ID</Label>
                      <Input
                        id="telegram-admin-chat"
                        value={telegramCredentials.adminChatId}
                        onChange={(event) =>
                          setTelegramCredentials((current) => ({ ...current, adminChatId: event.target.value }))
                        }
                        placeholder="-1001234567890"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="telegram-public-chat">Public chat ID</Label>
                      <Input
                        id="telegram-public-chat"
                        value={telegramCredentials.publicChatId}
                        onChange={(event) =>
                          setTelegramCredentials((current) => ({ ...current, publicChatId: event.target.value }))
                        }
                        placeholder="-1001234567890 or @channelname"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telegram-writing-chat">Writing chat ID (optional)</Label>
                    <Input
                      id="telegram-writing-chat"
                      value={telegramCredentials.writingChatId}
                      onChange={(event) =>
                        setTelegramCredentials((current) => ({ ...current, writingChatId: event.target.value }))
                      }
                      placeholder="-1001234567890"
                    />
                  </div>
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                    Use different Admin and Public destinations. If they point to the same chat, preview and public posts can appear twice.
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-zinc-500">
                      {status || "Ready"}
                    </span>
                    <Button type="button" onClick={saveTelegramCredentials}>
                      Save Telegram settings
                    </Button>
                  </div>
                </CardContent>
              </Card>
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
                      <div className="mt-1 font-medium text-zinc-950">{destinationValue(item)}</div>
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
                <p className="text-sm text-zinc-500">{channel.blurb}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="handle">{channel.name} handle / username</Label>
                  <Input
                    id="handle"
                    value={socialKey ? settings[socialKey.handle] : ""}
                    onChange={(event) =>
                      setSettings((prev) => ({ ...prev, [socialKey!.handle]: event.target.value }))
                    }
                    placeholder={`@your_${channel.id}_account`}
                  />
                </div>

                <div className="rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">API Credentials</p>
                  {active !== "telegram" && CHANNEL_CREDENTIALS[active as SocialChannelId].map((field) => (
                    <div key={field.apiKey} className="space-y-1">
                      <Label htmlFor={field.apiKey}>{field.label}</Label>
                      <Input
                        id={field.apiKey}
                        type="password"
                        value={settings[field.stateKey] || ""}
                        onChange={(event) =>
                          setSettings((prev) => ({ ...prev, [field.stateKey]: event.target.value }))
                        }
                        placeholder={field.placeholder}
                        autoComplete="off"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 px-4 py-3">
                  <div>
                    <div className="font-medium text-zinc-950">Auto-publish</div>
                    <div className="text-sm text-zinc-500">Enable to publish approved posts to {channel.name}.</div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        [socialKey!.enabled]: currentEnabled === "true" ? "false" : "true",
                      }))
                    }
                  >
                    {currentEnabled === "true" ? "Enabled" : "Disabled"}
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-zinc-500">{status || "Ready"}</span>
                  <Button onClick={() => socialKey && saveSocial(socialKey)}>Save credentials</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
