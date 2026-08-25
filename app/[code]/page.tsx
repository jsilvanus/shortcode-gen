import { notFound, redirect } from "next/navigation";
import { getActiveLink } from "@/lib/links/service";

export default async function ShortLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const link = await getActiveLink(code);
  if (!link) notFound();

  return (
    <main>
      <h1>{link.title || `Short link ${link.code}`}</h1>
      {link.description && <p>{link.description}</p>}
      <p>This link will take you to:</p>
      <p><code>{link.targetUrl}</code></p>
      <form action={() => redirect(link.targetUrl)}><button type="submit">Continue</button></form>
    </main>
  );
}
