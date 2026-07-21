import { PageShell } from "@/components/shell/page-shell";
import { SettingsForm } from "@/components/workspaces/settings-form";
import { getSettingsView } from "@/lib/bot-data";

export default function SettingsPage() {
  const settings = getSettingsView();

  return (
    <div className="px-4 py-4 lg:px-8 lg:py-6">
      <PageShell
        title="Settings"
        subtitle="CMS-first source settings, macro scrape inputs, Telegram channel IDs, and legacy Sheets."
      >
        <SettingsForm initial={settings} />
      </PageShell>
    </div>
  );
}
