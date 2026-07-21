import { PageShell } from "@/components/shell/page-shell";
import { TelegramConnect } from "@/components/workspaces/telegram-connect";
import { SettingsForm } from "@/components/workspaces/settings-form";
import { getSettingsView } from "@/lib/bot-data";

export default function SettingsPage() {
  const settings = getSettingsView();

  return (
    <div className="px-4 py-4 lg:px-8 lg:py-6">
      <PageShell
        title="Settings"
        subtitle="CMS-first source settings, macro scrape inputs, and Telegram bot connection."
      >
        <div className="space-y-4">
          <TelegramConnect
            initial={{
              telegramAdminChatId: settings.telegramAdminChatId,
              telegramPublicChatId: settings.telegramPublicChatId,
              telegramWritingChatId: settings.telegramWritingChatId,
            }}
          />
          <SettingsForm
            initial={{
              sheetUrl: settings.sheetUrl,
              countries: settings.countries,
              daysAhead: settings.daysAhead,
            }}
          />
        </div>
      </PageShell>
    </div>
  );
}
