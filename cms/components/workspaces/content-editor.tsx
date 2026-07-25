"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { AiChat } from "@/components/workspaces/ai-chat";
import { MediaStudio } from "@/components/workspaces/media-studio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";

type PostRow = {
  post_id: string;
  version: number;
  kind: string | null;
  status: string | null;
  draft_text: string | null;
  request_text: string | null;
  metadata: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type OutboxRow = {
  id: number;
  destination_type: string | null;
  destination_id: string | null;
  status: string | null;
  scheduled_at: string | null;
  content_text: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_error: string | null;
};

type ParsedMetadata = {
  attachments?: string[];
  [key: string]: unknown;
};

type Channel = "telegram_admin" | "telegram_writing" | "telegram_public";

function formatLocalDateTimeInput(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 16);
}

function channelLabel(channel: Channel) {
  if (channel === "telegram_public") return "Public";
  if (channel === "telegram_writing") return "Writing";
  return "Admin";
}

function parseMetadata(raw: string | null) {
  try {
    return JSON.parse(raw || "{}") as ParsedMetadata;
  } catch {
    return {};
  }
}

function formatMetadata(metadata: ParsedMetadata) {
  return JSON.stringify(metadata, null, 2);
}

export function ContentEditor({ post, outbox = [] }: { post: PostRow; outbox?: OutboxRow[] }) {
  const router = useRouter();
  const initialMetadata = useMemo(() => parseMetadata(post.metadata), [post.metadata]);
  const [draft, setDraft] = useState(post.draft_text || "");
  const [activePanel, setActivePanel] = useState<"write" | "image">("write");
  const [attachment, setAttachment] = useState(initialMetadata.attachments?.[0] || "");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [queueing, setQueueing] = useState(false);
  const [scheduleAt, setScheduleAt] = useState(() =>
    formatLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000))
  );
  const [channel, setChannel] = useState<Channel>("telegram_admin");
  const [message, setMessage] = useState("");

  const editor = useEditor({
    extensions: [StarterKit],
    content: draft,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "min-h-[420px] rounded-2xl border border-zinc-200 bg-white px-4 py-4 font-serif text-[15px] leading-7 outline-none",
      },
    },
    onUpdate({ editor }) {
      setDraft(editor.getText().length ? editor.getHTML() : "");
    },
  });

  const metadata = useMemo(() => {
    const next = { ...initialMetadata };
    if (attachment) next.attachments = [attachment];
    else delete next.attachments;
    return next;
  }, [attachment, initialMetadata]);

  async function savePost() {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/posts/${post.post_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draftText: draft,
          metadata: formatMetadata(metadata),
        }),
      });
      if (!response.ok) throw new Error("Unable to save post");
      setMessage("Saved");
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function sendTestNow() {
    const plain = editor?.getText()?.trim() || draft.replace(/<[^>]+>/g, " ").trim();
    if (!plain) return;
    setSending(true);
    setMessage("");
    try {
      const res = await fetch("/api/test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: plain, channel }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Send failed");
      setMessage(`Sent test → ${channelLabel(channel).toLowerCase()} (msg ${data.messageId})`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function queueDelivery(nextScheduledAt: string, immediate = false) {
    const plain = editor?.getText()?.trim() || draft.replace(/<[^>]+>/g, " ").trim();
    if (!plain) return;
    if (!nextScheduledAt.trim()) {
      setMessage("Pick a schedule time first.");
      return;
    }
    if (channel === "telegram_public" && !window.confirm("Queue this to the public channel through outbox?")) {
      return;
    }

    setQueueing(true);
    setMessage("");
    try {
      const res = await fetch("/api/outbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postId: post.post_id,
          contentVersion: post.version,
          channel,
          scheduledAt: new Date(nextScheduledAt).toISOString(),
          text: plain,
          createdBy: "cms",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Unable to queue delivery");
      setMessage(
        immediate
          ? `Queued ${channelLabel(channel).toLowerCase()} send now`
          : `Queued ${channelLabel(channel).toLowerCase()} send for ${formatDateTime(data.outbox.scheduled_at)}`
      );
      router.refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setQueueing(false);
    }
  }

  function attachAsset(label: string) {
    setAttachment(label);
    setMessage(label ? `Attached ${label}` : "");
  }

  function insertAiText(text: string) {
    setDraft(text);
    editor?.commands.setContent(text);
  }

  const kindLabel =
    post.kind?.toLowerCase() === "t0"
      ? "T+0"
      : post.kind?.toLowerCase() === "actual"
        ? "Actual"
        : post.kind || "post";

  return (
    <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white">
      <div className="grid min-h-[680px] xl:grid-cols-2">
        <div className="flex flex-col border-b border-zinc-200 xl:border-b-0 xl:border-r">
          <div className="space-y-4 border-b border-zinc-200 px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-serif text-xl text-zinc-950">{post.post_id}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                  <span>Updated {formatDateTime(post.updated_at)}</span>
                  <span>· v{post.version}</span>
                  {post.kind ? <Badge tone="muted">{kindLabel}</Badge> : null}
                </div>
              </div>
              <Badge tone={post.status === "published" ? "success" : "default"}>
                {post.status || "drafted"}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activePanel === "write" ? "default" : "outline"}
                onClick={() => setActivePanel("write")}
              >
                Write
              </Button>
              <Button
                variant={activePanel === "image" ? "default" : "outline"}
                onClick={() => setActivePanel("image")}
              >
                Image
              </Button>
            </div>
          </div>

          <div className="flex-1 space-y-4 p-5">
            {activePanel === "write" ? (
              <>
                <EditorContent editor={editor} />
                <div className="flex flex-wrap items-center gap-2">
                  <Button onClick={savePost} disabled={saving}>
                    {saving ? "Saving…" : "Save draft"}
                  </Button>
                  <Button onClick={sendTestNow} disabled={sending}>
                    {sending ? "Sending…" : "Send test now"}
                  </Button>
                  <Button onClick={() => queueDelivery(new Date().toISOString(), true)} disabled={queueing}>
                    {queueing ? "Queueing…" : "Queue send now"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => editor?.commands.setContent(post.draft_text || "")}
                  >
                    Reset
                  </Button>
                  {message ? <span className="text-sm text-zinc-500">{message}</span> : null}
                </div>
                <div className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm text-zinc-600">
                  Attached media:{" "}
                  <span className="font-medium text-zinc-950">
                    {attachment || "None"}
                  </span>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Schedule</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                      <div className="space-y-2">
                        <Label htmlFor="content-channel">Channel</Label>
                        <select
                          id="content-channel"
                          value={channel}
                          onChange={(event) => setChannel(event.target.value as Channel)}
                          className="h-9 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/10"
                        >
                          <option value="telegram_admin">Admin</option>
                          <option value="telegram_writing">Writing</option>
                          <option value="telegram_public">Public</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="content-schedule">Scheduled at</Label>
                        <Input
                          id="content-schedule"
                          type="datetime-local"
                          value={scheduleAt}
                          onChange={(event) => setScheduleAt(event.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button onClick={() => queueDelivery(scheduleAt)} disabled={queueing}>
                        {queueing ? "Scheduling…" : "Schedule"}
                      </Button>
                      <span className="text-sm text-zinc-500">
                        Public scheduling uses the existing outbox and obeys pause mode.
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {outbox.length ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Outbox for this post</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {outbox.map((row) => (
                        <div
                          key={row.id}
                          className="rounded-2xl border border-zinc-200 px-4 py-3 text-sm"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-medium text-zinc-950">
                              {channelLabel((row.destination_type as Channel) || "telegram_admin")}
                            </div>
                            <Badge tone={row.status === "sent" ? "success" : row.status === "failed" ? "warning" : "default"}>
                              {row.status || "pending"}
                            </Badge>
                          </div>
                          <div className="mt-1 text-zinc-500">
                            {row.scheduled_at ? `Scheduled ${formatDateTime(row.scheduled_at)}` : "No schedule"}
                          </div>
                          {row.last_error ? (
                            <div className="mt-2 text-xs text-amber-700">Last error: {row.last_error}</div>
                          ) : null}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}
              </>
            ) : (
              <MediaStudio
                title="Image"
                contextLabel={post.post_id}
                onAttach={attachAsset}
              />
            )}
          </div>
        </div>

        <AiChat
          key={post.post_id}
          variant="panel"
          title="AI"
          contextLabel={`${post.post_id} · ${kindLabel} · ${post.status || "draft"}`}
          contextPayload={{
            type: "content_post",
            post_id: post.post_id,
            kind: post.kind,
            status: post.status,
            draft,
            request_text: post.request_text,
            attachment,
          }}
          welcome={`Editing ${post.post_id}. Ask for a rewrite — context stays on this post.`}
          systemPrompt="You are helping edit one CMS post. Keep replies concise and publish-ready. Prefer plain text the editor can insert."
          placeholder="Rewrite, shorten, or improve this post…"
          onInsert={insertAiText}
          defaultResearch
        />
      </div>
    </div>
  );
}
