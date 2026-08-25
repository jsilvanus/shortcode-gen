"use client";

import { useState } from "react";

type Collection = { id: string; name: string };

export function LinkForm({ userId, collections, initial }: { userId: string; collections: Collection[]; initial?: { code?: string; targetUrl?: string; isPrivate?: boolean; expiresAt?: string | null; collectionIds?: string[] } }) {
  const [targetUrl, setTargetUrl] = useState(initial?.targetUrl ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [isPrivate, setIsPrivate] = useState(initial?.isPrivate ?? true);
  const [expiresAt, setExpiresAt] = useState(initial?.expiresAt ?? "");
  const [collectionIds, setCollectionIds] = useState(initial?.collectionIds ?? []);
  const [message, setMessage] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setMessage("Saving…");
    const payload = { targetUrl, ownerId: userId, ...(code ? { code } : {}), isPrivate, expiresAt: expiresAt || null, collectionIds };
    const response = await fetch("/api/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setMessage(response.ok ? "Saved" : ((await response.json()).error ?? "Could not save"));
  }

  return <form onSubmit={submit}>
    <label>Target URL<input required type="url" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} /></label>
    <label>Short code (optional)<input value={code} onChange={e => setCode(e.target.value)} /></label>
    <label><input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} /> Private</label>
    <label>Expires<input type="datetime-local" value={expiresAt ?? ""} onChange={e => setExpiresAt(e.target.value)} /></label>
    <label>Collections<select multiple value={collectionIds} onChange={e => setCollectionIds(Array.from(e.target.selectedOptions, o => o.value))}>{collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <button type="submit">Save link</button>
    <p aria-live="polite">{message}</p>
  </form>;
}
