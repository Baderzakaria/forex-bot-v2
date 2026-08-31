import { PageShell } from "@/components/shell/page-shell";
import { EventsBoard } from "@/components/workspaces/events-board";
import { getEventAlertMeta, listEvents } from "@/lib/bot-data";
import {
  normalizeDayKey,
  normalizeMonthKey,
  normalizeRailView,
  toDayKey,
} from "@/lib/events";

type SearchParams = Record<string, string | string[] | undefined>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams?: SearchParams | Promise<SearchParams>;
}) {
  const params = await Promise.resolve(searchParams ?? {});
  const events = listEvents();
  const nowIso = new Date().toISOString();
  const alertMetaByEventKey = getEventAlertMeta(
    events.map((event) => event.event_key),
    nowIso
  );
  const todayDay = toDayKey(nowIso) || nowIso.slice(0, 10);
  const eventKey = firstParam(params.event);
  const dayKey = normalizeDayKey(firstParam(params.day));
  const monthKey = firstParam(params.month);
  const view = normalizeRailView(firstParam(params.view));
  const openEvent = eventKey ? events.find((event) => event.event_key === eventKey) ?? null : null;
  const selectedDay =
    dayKey || (openEvent ? toDayKey(openEvent.event_time_utc) : "") || todayDay;
  const initialMonthKey = normalizeMonthKey(monthKey) || selectedDay.slice(0, 7);

  return (
    <div className="px-4 py-4 lg:px-8 lg:py-6">
      <PageShell
        title="Events"
        subtitle="A month calendar leads the workflow. Click any day to review its high-impact events and draft from the side panel."
      >
        <EventsBoard
          events={events}
          alertMetaByEventKey={alertMetaByEventKey}
          nowIso={nowIso}
          initialView={view}
          initialSelectedDay={selectedDay}
          initialMonthKey={initialMonthKey}
          initialOpenEventKey={openEvent?.event_key ?? null}
        />
      </PageShell>
    </div>
  );
}
