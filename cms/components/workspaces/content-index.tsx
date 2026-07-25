"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { clampText, formatDateTime } from "@/lib/format";

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

type Filter = "all" | "daily" | "macro";

function isDailyPost(post: PostRow) {
  const kind = post.kind?.toLowerCase();
  const id = post.post_id.toLowerCase();
  return kind === "daily" || id.startsWith("daily-quote");
}

function isMacroPost(post: PostRow) {
  const kind = post.kind?.toLowerCase();
  const id = post.post_id.toLowerCase();
  return kind === "macro" || kind === "t0" || kind === "actual" || id.startsWith("t30") || id.startsWith("t0") || id.startsWith("actual");
}

function isJunkPost(post: PostRow) {
  const haystacks = [
    post.post_id,
    post.kind || "",
    post.draft_text || "",
    post.request_text || "",
  ].map((value) => value.toLowerCase());

  if (haystacks.some((value) => value.includes("📊 event: event"))) return true;
  if (haystacks.some((value) => value.includes("selftest"))) return true;
  if (haystacks.some((value) => value.includes("smoke"))) return true;
  if (haystacks.some((value) => value.includes("test-"))) return true;
  if (haystacks.some((value) => value.includes("live-t"))) return true;
  if (haystacks.some((value) => value.includes("live-act"))) return true;
  return false;
}

export function ContentIndex({ posts }: { posts: PostRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [kind, setKind] = useState<"daily" | "macro" | "manual">("manual");
  const [title, setTitle] = useState("");
  const [draftText, setDraftText] = useState("");
  const [createMessage, setCreateMessage] = useState("");

  const cleanPosts = useMemo(() => posts.filter((post) => !isJunkPost(post)), [posts]);

  const filtered = useMemo(() => {
    if (filter === "daily") return cleanPosts.filter(isDailyPost);
    if (filter === "macro") return cleanPosts.filter(isMacroPost);
    return cleanPosts;
  }, [cleanPosts, filter]);

  const counts = useMemo(
    () => ({
      all: cleanPosts.length,
      daily: cleanPosts.filter(isDailyPost).length,
      macro: cleanPosts.filter(isMacroPost).length,
    }),
    [cleanPosts]
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>New post</CardTitle>
              <div className="mt-1 text-sm text-zinc-500">
                Create a fresh draft in SQLite, then open it in the editor.
              </div>
            </div>
            <Button variant={showCreate ? "outline" : "default"} onClick={() => setShowCreate((value) => !value)}>
              {showCreate ? "Close" : "New post"}
            </Button>
          </div>
        </CardHeader>
        {showCreate ? (
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                { key: "manual" as const, label: "Manual" },
                { key: "daily" as const, label: "Daily" },
                { key: "macro" as const, label: "Macro" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={`rounded-full px-4 py-2 text-sm font-medium ${
                    kind === item.key
                      ? "bg-zinc-950 text-white"
                      : "border border-zinc-200 bg-white text-zinc-600"
                  }`}
                  onClick={() => setKind(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="space-y-2">
                <Label htmlFor="content-title">Title</Label>
                <Input
                  id="content-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Optional title"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content-draft">Draft text</Label>
                <Textarea
                  id="content-draft"
                  value={draftText}
                  onChange={(event) => setDraftText(event.target.value)}
                  placeholder="Start with a short draft or leave this blank and use AI later."
                  className="min-h-24"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={async () => {
                  setCreating(true);
                  setCreateMessage("");
                  try {
                    const response = await fetch("/api/posts", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ title, draftText, kind, channel: "telegram_admin" }),
                    });
                    const data = await response.json();
                    if (!response.ok || !data.post) throw new Error(data.error || "Unable to create post");
                    router.push(`/content/${data.post.post_id}`);
                  } catch (error) {
                    setCreateMessage((error as Error).message);
                  } finally {
                    setCreating(false);
                  }
                }}
                disabled={creating}
              >
                {creating ? "Creating…" : "Create draft"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setTitle("");
                  setDraftText("");
                  setKind("manual");
                  setCreateMessage("");
                }}
                type="button"
              >
                Reset
              </Button>
              {createMessage ? <span className="text-sm text-zinc-500">{createMessage}</span> : null}
            </div>
          </CardContent>
        ) : null}
      </Card>

      <div className="flex flex-wrap gap-2">
        {[
          { key: "all" as const, label: "All", count: counts.all },
          { key: "daily" as const, label: "Daily posts", count: counts.daily },
          { key: "macro" as const, label: "Macro / event posts", count: counts.macro },
        ].map((item) => (
          <button
            key={item.key}
            className={`rounded-full px-4 py-2 text-sm font-medium ${
              filter === item.key
                ? "bg-zinc-950 text-white"
                : "border border-zinc-200 bg-white text-zinc-600"
            }`}
            onClick={() => setFilter(item.key)}
          >
            {item.label} <span className="opacity-70">{item.count}</span>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{filter === "all" ? "All current drafts" : `${filter === "daily" ? "Daily posts" : "Macro / event posts"}`}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 xl:grid-cols-2">
          {filtered.map((post) => {
            const tone = post.status === "published" ? "success" : "default";
            const kindLabel = isDailyPost(post)
              ? "Daily"
              : isMacroPost(post)
                ? post.kind?.toLowerCase() === "t0"
                  ? "T+0"
                  : post.kind?.toLowerCase() === "actual"
                    ? "Actual"
                    : "Macro"
                : post.kind || "Other";

            return (
              <Link
                key={`${post.post_id}:${post.version}`}
                href={`/content/${post.post_id}`}
                className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-zinc-950">{post.post_id}</div>
                  <Badge tone={tone}>{post.status || "draft"}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                  <Badge tone="muted">{kindLabel}</Badge>
                  <span>Version {post.version}</span>
                  <span>Updated {formatDateTime(post.updated_at)}</span>
                </div>
                <div className="mt-3 text-sm text-zinc-500">
                  {clampText(post.draft_text || post.request_text, 140)}
                </div>
              </Link>
            );
          })}

          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 px-4 py-8 text-sm text-zinc-500">
              No posts in this section yet.
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
