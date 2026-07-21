"use client";

import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

type ChatField = "telegramAdminChatId" | "telegramPublicChatId" | "telegramWritingChatId";

type TelegramChatSummary = {
  id: string;
  title: string;
  type: string;
};

type TelegramStatus = {
  ok: boolean;
  botUsername: string;
  botId: string;
  maskedToken: string;
  adminChatId: string;
  publicChatId: string;
  writingChatId: string;
  error?: string;
};

type Settings = Record<ChatField, string>;

type Props = {
  initial: Settings;
};

const FIELD_META: Record<
  ChatField,
  { label: string; description: string; placeholder: string }
> = {
  telegramAdminChatId: {
    label: "Admin chat ID",
    description: "Used by test send and admin preview flows.",
    placeholder: "-1001234567890",
  },
  telegramPublicChatId: {
    label: "Public chat ID",
    description: "Used when publishing to the public channel.",
    placeholder: "-1001234567890",
  },
  telegramWritingChatId: {
    label: "Writing chat ID",
    description: "Used for drafting and editorial threads.",
    placeholder: "-1001234567890",
  },
};

export function TelegramConnect({ initial }: Props) {
  const [settings, setSettings] = useState<Settings>(initial);
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionStatus, setActionStatus] = useState("Ready");
  const [discovering, setDiscovering] = useState(false);
  const [discoveredChats, setDiscoveredChats] = useState<TelegramChatSummary[]>([]);
  const [manualChatId, setManualChatId] = useState("");
  const [manualField, setManualField] = useState<ChatField>("telegramAdminChatId");
  const [testSending, setTestSending] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      setLoading(true);
      try {
        const response = await fetch("/api/telegram/status", { cache: "no-store" });
        const data = (await response.json()) as TelegramStatus;
        if (!active) return;
        setStatus(data);
        setSettings((current) => ({
          telegramAdminChatId: data.adminChatId || current.telegramAdminChatId,
          telegramPublicChatId: data.publicChatId || current.telegramPublicChatId,
          telegramWritingChatId: data.writingChatId || current.telegramWritingChatId,
        }));
        if (!data.ok && data.error) {
          setActionStatus(data.error);
        }
      } catch (error) {
        if (!active) return;
        setActionStatus((error as Error).message);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadStatus();

    return () => {
      active = false;
    };
  }, []);

  async function saveSettings(next: Settings, message?: string) {
    setSettings(next);
    setActionStatus(message || "Saving...");
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        telegram_admin_chat_id: next.telegramAdminChatId,
        telegram_public_chat_id: next.telegramPublicChatId,
        telegram_writing_chat_id: next.telegramWritingChatId,
      }),
    });
    const data = (await response.json()) as { ok?: boolean; settings?: Settings; error?: string };
    if (!response.ok) {
      throw new Error(data.error || "Unable to save Telegram settings");
    }
    if (data.settings) {
      setSettings({
        telegramAdminChatId: data.settings.telegramAdminChatId || next.telegramAdminChatId,
        telegramPublicChatId: data.settings.telegramPublicChatId || next.telegramPublicChatId,
        telegramWritingChatId: data.settings.telegramWritingChatId || next.telegramWritingChatId,
      });
    }
    setActionStatus(message || "Saved");
  }

  async function assignChat(field: ChatField, chatId: string) {
    try {
      const next = { ...settings, [field]: chatId } as Settings;
      await saveSettings(next, `${FIELD_META[field].label} saved`);
    } catch (error) {
      setActionStatus((error as Error).message);
    }
  }

  async function validateAndSave(field: ChatField) {
    const chatId = settings[field].trim();
    if (!chatId) {
      setActionStatus(`Missing ${FIELD_META[field].label.toLowerCase()}`);
      return;
    }

    setActionStatus(`Validating ${FIELD_META[field].label.toLowerCase()}...`);
    try {
      const response = await fetch("/api/telegram/validate-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId }),
      });
      const data = (await response.json()) as {
        ok: boolean;
        chat?: TelegramChatSummary;
        error?: string;
      };

      if (!response.ok || !data.ok || !data.chat) {
        throw new Error(data.error || "Unable to validate chat");
      }

      const next = { ...settings, [field]: data.chat.id } as Settings;
      await saveSettings(next, `${FIELD_META[field].label} verified`);
    } catch (error) {
      setActionStatus((error as Error).message);
    }
  }

  async function discoverChats() {
    setDiscovering(true);
    setActionStatus("Discovering recent chats...");
    try {
      const response = await fetch("/api/telegram/discover", { method: "POST" });
      const data = (await response.json()) as {
        ok: boolean;
        chats: TelegramChatSummary[];
        error?: string;
      };

      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Unable to discover chats");
      }

      setDiscoveredChats(data.chats || []);
      setActionStatus(
        data.chats.length ? `Found ${data.chats.length} recent chats` : "No recent chats returned"
      );
    } catch (error) {
      setActionStatus((error as Error).message);
      setDiscoveredChats([]);
    } finally {
      setDiscovering(false);
    }
  }

  async function sendTest() {
    setTestSending(true);
    setActionStatus("Sending test message to admin...");
    try {
      const response = await fetch("/api/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel: "telegram_admin",
          text: "Telegram connect test from the CMS.",
        }),
      });
      const data = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Test send failed");
      }
      setActionStatus("Test message sent to admin chat");
    } catch (error) {
      setActionStatus((error as Error).message);
    } finally {
      setTestSending(false);
    }
  }

  const openBotUrl = status?.botUsername ? `https://t.me/${status.botUsername}` : "";
  const statusTone = loading ? "muted" : status?.ok ? "success" : "warning";
  const statusLabel = loading ? "Loading..." : status?.ok ? "Ready" : "Check token";

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Telegram bot</CardTitle>
            <CardDescription>Read-only bot identity fetched from the server-side token.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">Status</div>
                <div className="mt-1 text-sm text-zinc-950">
                  {loading ? "Loading..." : status?.ok ? "Connected" : "Needs attention"}
                </div>
              </div>
              <Badge tone={statusTone}>{statusLabel}</Badge>
            </div>
            <div className="grid gap-3 rounded-2xl border border-zinc-200 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-500">Bot username</span>
                <span className="font-medium text-zinc-950">{status?.botUsername ? `@${status.botUsername}` : "Unknown"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-500">Bot ID</span>
                <span className="font-medium text-zinc-950">{status?.botId || "Unknown"}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-zinc-500">Token hint</span>
                <span className="font-medium text-zinc-950">{status?.maskedToken || "Unavailable"}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                type="button"
                onClick={() => openBotUrl && window.open(openBotUrl, "_blank", "noreferrer")}
                disabled={!openBotUrl}
              >
                Open bot
              </Button>
              <span className="text-sm text-zinc-500">
                {status?.ok ? "Token stays server-side." : status?.error || "Set TELEGRAM_BOT_TOKEN on the server."}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How to connect</CardTitle>
            <CardDescription>Quick path for a new group or channel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-600">
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">1. Add the bot to your group or channel.</div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">2. Send any message or grant it access so Telegram produces an update.</div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              3. Click Discover, then assign the chat to Admin, Public, or Writing.
            </div>
            <div className="rounded-2xl border border-zinc-200 px-4 py-3">
              4. If discovery is empty, paste a chat ID below and validate it.
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Chat IDs</CardTitle>
            <CardDescription>Paste chat IDs here or fill them from discovery results.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(Object.keys(FIELD_META) as ChatField[]).map((field) => (
              <div key={field} className="space-y-2 rounded-2xl border border-zinc-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Label htmlFor={field}>{FIELD_META[field].label}</Label>
                    <p className="mt-1 text-sm text-zinc-500">{FIELD_META[field].description}</p>
                  </div>
                  <Badge tone="muted">
                    {settings[field].trim() ? "Saved" : "Empty"}
                  </Badge>
                </div>
                <div className="flex flex-col gap-2 md:flex-row">
                  <Input
                    id={field}
                    value={settings[field]}
                    onChange={(event) => setSettings((current) => ({ ...current, [field]: event.target.value }))}
                    placeholder={FIELD_META[field].placeholder}
                  />
                  <Button type="button" variant="outline" onClick={() => validateAndSave(field)}>
                    Validate &amp; save
                  </Button>
                </div>
                <div className="text-xs text-zinc-500">Validation uses Telegram getChat before saving to SQLite.</div>
              </div>
            ))}

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-zinc-950">Manual paste helper</div>
                  <div className="text-sm text-zinc-500">Validate one chat ID and copy it into the selected role.</div>
                </div>
                <Badge tone="muted">{manualField === "telegramAdminChatId" ? "Admin" : manualField === "telegramPublicChatId" ? "Public" : "Writing"}</Badge>
              </div>
              <div className="flex flex-col gap-2 md:flex-row">
                <Input
                  value={manualChatId}
                  onChange={(event) => setManualChatId(event.target.value)}
                  placeholder="-1001234567890 or @groupusername"
                />
                <Button type="button" variant="outline" onClick={() => setManualField("telegramAdminChatId")}>
                  Admin
                </Button>
                <Button type="button" variant="outline" onClick={() => setManualField("telegramPublicChatId")}>
                  Public
                </Button>
                <Button type="button" variant="outline" onClick={() => setManualField("telegramWritingChatId")}>
                  Writing
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    if (!manualChatId.trim()) {
                      setActionStatus("Missing chat ID");
                      return;
                    }
                    setActionStatus("Validating pasted chat ID...");
                    try {
                      const response = await fetch("/api/telegram/validate-chat", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ chatId: manualChatId }),
                      });
                      const data = (await response.json()) as {
                        ok: boolean;
                        chat?: TelegramChatSummary;
                        error?: string;
                      };
                      if (!response.ok || !data.ok || !data.chat) {
                        throw new Error(data.error || "Unable to validate chat");
                      }
                      await assignChat(manualField, data.chat.id);
                      setManualChatId(data.chat.id);
                    } catch (error) {
                      setActionStatus((error as Error).message);
                    }
                  }}
                >
                  Validate pasted ID
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Discover recent chats</CardTitle>
            <CardDescription>
              Reads Telegram updates from the server. If another process already consumes updates, this may return
              empty.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={discoverChats} disabled={discovering}>
                {discovering ? "Discovering..." : "Discover recent chats"}
              </Button>
              <span className="text-sm text-zinc-500">
                Use these buttons to save a chat as Admin, Public, or Writing.
              </span>
            </div>

            <div className="space-y-3">
              {discoveredChats.length ? (
                discoveredChats.map((chat) => (
                  <div key={chat.id} className="rounded-2xl border border-zinc-200 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-zinc-950">{chat.title}</div>
                        <div className="text-sm text-zinc-500">
                          {chat.type} · {chat.id}
                        </div>
                      </div>
                      <Badge tone="muted">{chat.type}</Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => assignChat("telegramAdminChatId", chat.id)}>
                        Admin
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => assignChat("telegramPublicChatId", chat.id)}>
                        Public
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => assignChat("telegramWritingChatId", chat.id)}>
                        Writing
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-zinc-200 px-4 py-5 text-sm text-zinc-500">
                  No chats discovered yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Send test</CardTitle>
            <CardDescription>Uses the saved admin chat ID and the existing /api/test-send route.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-zinc-500">{actionStatus}</span>
            <Button type="button" onClick={sendTest} disabled={testSending}>
              {testSending ? "Sending..." : "Send test to admin"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
