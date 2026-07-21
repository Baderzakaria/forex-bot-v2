"use client";

import { AiChat } from "@/components/workspaces/ai-chat";
import { formatDateTime } from "@/lib/format";

type UpcomingEvent = {
  event_key: string;
  title: string | null;
  currency: string | null;
  country_code: string | null;
  event_time_utc: string | null;
  importance: string | null;
};

export function DashboardAi({
  upcomingEvents,
}: {
  upcomingEvents: UpcomingEvent[];
}) {
  const contextPayload = {
    type: "dashboard_morning_brief",
    upcomingEvents: upcomingEvents.map((event) => ({
      event_key: event.event_key,
      title: event.title,
      currency: event.currency,
      country_code: event.country_code,
      time: formatDateTime(event.event_time_utc),
      importance: event.importance,
    })),
  };

  return (
    <AiChat
      variant="desk"
      title="AI"
      description="Morning brief and market report drafting from the upcoming event slate."
      welcome="Dashboard AI is ready. Ask for a morning brief, pre-market watchlist, or a concise market report from the next releases."
      systemPrompt="You are the dashboard assistant for forex morning briefs and market report drafting. Use the upcoming events context to prioritize the next releases, note currency, country, time, and importance, and when web research is available weave in related financial news and market implications. Keep answers concise, practical, and publish-ready."
      placeholder="Ask for a morning brief, watchlist, or market report…"
      contextLabel="Dashboard morning brief"
      contextPayload={contextPayload}
      defaultResearch
      className="min-h-[680px]"
    />
  );
}
