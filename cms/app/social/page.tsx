import { PageShell } from "@/components/shell/page-shell";
import { SocialChannels } from "@/components/workspaces/social-channels";
import { getSettingsView, listOutbox } from "@/lib/bot-data";
import { getEnv } from "@/lib/env";

export default function SocialPage() {
  const settings = getSettingsView();
  const outbox = listOutbox(5);
  const telegramDestinations = [
    {
      label: "Admin preview",
      status: "Preview",
      value: settings.telegramAdminChatId || getEnv("TELEGRAM_ADMIN_CHAT_ID", "unset"),
    },
    {
      label: "Public channel",
      status: "Public",
      value: settings.telegramPublicChatId || getEnv("TELEGRAM_PUBLIC_CHAT_ID", "unset"),
    },
    {
      label: "Writing group",
      status: "Writing",
      value: settings.telegramWritingChatId || getEnv("TELEGRAM_WRITING_CHAT_ID", "unset"),
    },
  ];

  return (
    <div className="px-4 py-4 lg:px-8 lg:py-6">
      <PageShell
        title="Social"
        subtitle="Channels live inside Social — choose Telegram or another network."
      >
        <SocialChannels telegramDestinations={telegramDestinations} outbox={outbox} />
      </PageShell>
    </div>
  );
}
