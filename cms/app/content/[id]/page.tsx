import { notFound } from "next/navigation";

import { PageShell } from "@/components/shell/page-shell";
import { ContentEditor } from "@/components/workspaces/content-editor";
import { getPostById, listOutboxForPost } from "@/lib/bot-data";

export default async function ContentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = getPostById(id);
  const outbox = listOutboxForPost(id);

  if (!post) {
    notFound();
  }

  return (
    <div className="px-4 py-4 lg:px-8 lg:py-6">
      <PageShell
      title="Content"
      subtitle="Write the draft, switch to Image for media, and use the shared AI sidecar while editing."
    >
        <ContentEditor key={post.post_id} post={post} outbox={outbox} />
      </PageShell>
    </div>
  );
}
