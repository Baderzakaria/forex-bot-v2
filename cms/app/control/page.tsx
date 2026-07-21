import { PageShell } from "@/components/shell/page-shell";
import { ControlPanel } from "@/components/workspaces/control-panel";
import { getBotHealth, getSettingsView } from "@/lib/bot-data";

export default function ControlPage() {
  const settings = getSettingsView();
  const health = getBotHealth();

  return (
    <div className="px-4 py-4 lg:px-8 lg:py-6">
      <PageShell
        title="Control"
        subtitle="A plain-language ops panel for publishing, automation, schedule explanations, and bot health."
      >
        <ControlPanel initialSettings={settings} health={health} />
      </PageShell>
    </div>
  );
}
