import { PageShell } from "@/components/shell/page-shell";
import { EventsBoard } from "@/components/workspaces/events-board";
import { listEvents } from "@/lib/bot-data";

export default function EventsPage() {
  const events = listEvents();

  return (
    <div className="px-4 py-4 lg:px-8 lg:py-6">
      <PageShell
        title="Events"
        subtitle="A month calendar leads the workflow. Click any day to review its high-impact events and draft from the side panel."
      >
        <EventsBoard events={events} />
      </PageShell>
    </div>
  );
}
