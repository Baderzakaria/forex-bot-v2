"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function ContentIndex({ posts }: { posts: PostRow[] }) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    if (filter === "daily") return posts.filter(isDailyPost);
    if (filter === "macro") return posts.filter(isMacroPost);
    return posts;
  }, [filter, posts]);

  const counts = useMemo(
    () => ({
      all: posts.length,
      daily: posts.filter(isDailyPost).length,
      macro: posts.filter(isMacroPost).length,
    }),
    [posts]
  );

  return (
    <div className="space-y-4">
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
