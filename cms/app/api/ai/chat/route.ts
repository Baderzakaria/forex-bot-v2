import { NextResponse } from "next/server";

import { chatCompletion } from "@/lib/ai";
import { formatSearchBrief, searchFinancialWeb } from "@/lib/web-search";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    messages?: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    system?: string;
    context?: Record<string, unknown>;
    research?: boolean;
    researchQuery?: string;
  };

  const messages = body.messages?.filter((message) => message.content.trim()) ?? [];
  const lastUser = [...messages].reverse().find((message) => message.role === "user")?.content || "";

  const systemParts = [
    body.system?.trim() ||
      "You are a financial CMS writing assistant for forex/macro Telegram posts and short market reports.",
    "When web research is provided, use it. Cite source names briefly. Do not invent URLs. Prefer concise, publish-ready English.",
  ];

  if (body.context && Object.keys(body.context).length) {
    systemParts.push(`Active CMS context JSON:\n${JSON.stringify(body.context, null, 2)}`);
  }

  let research:
    | {
        ok: boolean;
        query: string;
        provider: string;
        hits: Array<{ title: string; url: string; snippet: string; source: string; publishedAt?: string }>;
        errors: string[];
      }
    | undefined;

  if (body.research) {
    research = await searchFinancialWeb({
      query: body.researchQuery || lastUser,
      context: body.context,
      limit: 6,
    });
    systemParts.push(
      [
        "Live financial web research (use for related news, market reaction, and report drafting):",
        formatSearchBrief(research.hits, research.query),
        research.ok
          ? ""
          : "No web hits returned. Draft carefully from event context only and say sources were unavailable.",
      ]
        .filter(Boolean)
        .join("\n\n")
    );
  }

  const system = systemParts.join("\n\n");
  const normalized =
    messages[0]?.role !== "system"
      ? [{ role: "system" as const, content: system }, ...messages]
      : messages;

  const result = await chatCompletion(
    normalized.length > 0
      ? normalized
      : [
          { role: "system", content: system },
          {
            role: "user",
            content:
              "Write a short market note using any available research and the active event context.",
          },
        ]
  );

  return NextResponse.json({
    ...result,
    research: research
      ? {
          ok: research.ok,
          query: research.query,
          provider: research.provider,
          hits: research.hits,
        }
      : undefined,
  });
}
