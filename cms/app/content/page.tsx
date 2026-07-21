import { PageShell } from "@/components/shell/page-shell";
import { ContentIndex } from "@/components/workspaces/content-index";
import { listAllLatestPosts } from "@/lib/bot-data";

export default function ContentIndexPage() {
  const posts = listAllLatestPosts();

  return (
    <div className="px-4 py-4 lg:px-8 lg:py-6">
      <PageShell
        title="Content"
        subtitle="Daily posts and macro/event drafts live together here. Open any item to edit it with AI and media tools."
      >
        <ContentIndex posts={posts} />
      </PageShell>
    </div>
  );
}
