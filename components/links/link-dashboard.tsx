"use client";

import { useMemo, useState } from "react";

type Collection = { id: string; name: string; isPrivate: boolean };
type Link = {
  id: string; code: string; targetUrl: string; ownerId: string; isPrivate: boolean;
  title: string | null; description: string | null; expiresAt: string | Date | null;
  active: boolean; collections: { collection: Collection }[];
};

export function LinkDashboard({ userId, initialLinks, collections }: { userId: string; initialLinks: Link[]; collections: Collection[] }) {
  const [links, setLinks] = useState(initialLinks);
  const [query, setQuery] = useState("");
  const [privacy, setPrivacy] = useState<"all" | "private" | "public">("all");
  const [collectionId, setCollectionId] = useState("all");
  const [selected, setSelected] = useState<Record<string, string[]>>(() => Object.fromEntries(initialLinks.map(l => [l.id, l.collections.map(c => c.collection.id)])));
  const [saving, setSaving] = useState<string | null>(null);

  const filtered = useMemo(() => links.filter(link => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || [link.code, link.targetUrl, link.title ?? "", link.description ?? ""].some(v => v.toLowerCase().includes(q));
    const matchesPrivacy = privacy === "all" || (privacy === "private" ? link.isPrivate : !link.isPrivate);
    const matchesCollection = collectionId === "all" || selected[link.id]?.includes(collectionId);
    return matchesQuery && matchesPrivacy && matchesCollection;
  }), [links, query, privacy, collectionId, selected]);

  async function saveCollections(link: Link, ids: string[]) {
    setSaving(link.id);
    const response = await fetch(`/api/links/${encodeURIComponent(link.code)}/collections`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, collectionIds: ids }) });
    if (response.ok) setSelected(s => ({ ...s, [link.id]: ids }));
    setSaving(null);
  }

  return (
    <main>
      <header>
        <h1>Links</h1>
        <input aria-label="Search links" placeholder="Search links…" value={query} onChange={e => setQuery(e.target.value)} />
      </header>
      <nav aria-label="Privacy filter">
        {(["all", "private", "public"] as const).map(value => <button key={value} type="button" aria-pressed={privacy === value} onClick={() => setPrivacy(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}
      </nav>
      <label>Collection <select value={collectionId} onChange={e => setCollectionId(e.target.value)}><option value="all">All collections</option>{collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>

      <section aria-label="Link list">
        {filtered.map(link => {
          const ids = selected[link.id] ?? [];
          const editable = !link.isPrivate || link.ownerId === userId;
          return <article key={link.id}>
            <div><strong>{link.code}</strong> <span>{link.isPrivate ? "Private" : "Public"}</span></div>
            <div>{link.targetUrl}</div>
            <div aria-label="Collections">
              {ids.map(id => { const c = collections.find(x => x.id === id); return c ? <span key={id} style={{ display: "inline-block", padding: "0.15rem 0.5rem", border: "1px solid currentColor", borderRadius: "999px", marginRight: "0.25rem" }}>{c.name}</span> : null; })}
            </div>
            {editable && <label>Collections <select multiple value={ids} disabled={saving === link.id} onChange={e => void saveCollections(link, Array.from(e.target.selectedOptions, option => option.value))}>{collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>}
          </article>;
        })}
        {!filtered.length && <p>No links match the current filters.</p>}
      </section>
    </main>
  );
}
