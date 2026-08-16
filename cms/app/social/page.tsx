import { PageShell } from "@/components/shell/page-shell";
import { SocialChannels } from "@/components/workspaces/social-channels";
import { getSettingsView, listOutbox } from "@/lib/bot-data";
import { getEnv } from "@/lib/env";

function maskToken(token: string) {
  if (!token) return "";
  return token.length <= 4 ? "••••" : `••••${token.slice(-4)}`;
}

export default function SocialPage() {
  const settings = getSettingsView();
  const outbox = listOutbox(5);
  const telegramCredentials = {
    adminChatId: settings.telegramAdminChatId || getEnv("TELEGRAM_ADMIN_CHAT_ID"),
    publicChatId: settings.telegramPublicChatId || getEnv("TELEGRAM_PUBLIC_CHAT_ID"),
    writingChatId: settings.telegramWritingChatId || getEnv("TELEGRAM_WRITING_CHAT_ID"),
    maskedBotToken: maskToken(getEnv("TELEGRAM_BOT_TOKEN")),
  };
  const telegramDestinations = [
    {
      key: "admin" as const,
      label: "Admin preview",
      status: "Preview",
    },
    {
      key: "public" as const,
      label: "Public channel",
      status: "Public",
    },
    {
      key: "writing" as const,
      label: "Writing group",
      status: "Writing",
    },
  ];

  return (
    <div className="px-4 py-4 lg:px-8 lg:py-6">
      <PageShell
        title="Social"
        subtitle="Channels live inside Social — choose Telegram or another network."
      >
        <SocialChannels
          telegramDestinations={telegramDestinations}
          initialTelegramCredentials={telegramCredentials}
          outbox={outbox}
          initialSettings={settings}
        />
      </PageShell>
    </div>
  );
}
