import { PageShell } from "@/components/shell/page-shell";
import { AiChat } from "@/components/workspaces/ai-chat";

export default function AiPage() {
  return (
    <div className="px-4 py-4 lg:px-8 lg:py-6">
      <PageShell
        title="AI Desk"
        subtitle="General assistant with live financial web research for market notes, related news, and reports."
      >
        <div className="overflow-hidden rounded-[28px] border border-[var(--fx-border-soft)] shadow-[var(--fx-shadow-soft)]">
          <AiChat
            variant="desk"
            title="General AI"
            description="Use this for open questions. For event-locked chat, open Events and select one."
            welcome="General desk ready. Ask for market notes, related news, or a report with live web research."
            systemPrompt="You are a general CMS assistant for forex and macro workflows. Use live financial web research when enabled, summarize related news clearly, and keep replies concise, accurate, and publish-ready."
            defaultResearch
            className="min-h-[70vh]"
          />
        </div>
      </PageShell>
    </div>
  );
}
