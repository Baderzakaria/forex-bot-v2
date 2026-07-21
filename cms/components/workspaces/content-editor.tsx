"use client";

import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { AiChat } from "@/components/workspaces/ai-chat";
import { MediaStudio } from "@/components/workspaces/media-studio";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

type ParsedMetadata = {
  attachments?: string[];
  [key: string]: unknown;
};

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

export function ContentEditor({ post }: { post: PostRow }) {
  const initialMetadata = useMemo(() => parseMetadata(post.metadata), [post.metadata]);
  const [draft, setDraft] = useState(post.draft_text || "");
  const [activePanel, setActivePanel] = useState<"write" | "image">("write");
  const [attachment, setAttachment] = useState(initialMetadata.attachments?.[0] || "");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
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

  useEffect(() => {
    const nextDraft = post.draft_text || "";
    setDraft(nextDraft);
    setAttachment(initialMetadata.attachments?.[0] || "");
    editor?.commands.setContent(nextDraft);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, post.post_id]);

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
        body: JSON.stringify({ text: plain, channel: "telegram_admin" }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Send failed");
      setMessage(`Sent test → admin (msg ${data.messageId})`);
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setSending(false);
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
