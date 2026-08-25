"use client";

import { useState } from "react";

export function AliasManager({ domainId, initialAliases }: { domainId: string; initialAliases: { id: string; hostname: string; active: boolean }[] }) {
  const [aliases, setAliases] = useState(initialAliases);
  const [hostname, setHostname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addAlias(event: React.FormEvent) {
    event.preventDefault();
    setError(null); setBusy(true);
    try {
      const response = await fetch(`/api/admin/domains/${domainId}/aliases`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hostname }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to add alias");
      setAliases(current => [...current, data.alias].sort((a, b) => a.hostname.localeCompare(b.hostname)));
      setHostname("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to add alias"); }
    finally { setBusy(false); }
  }

  async function removeAlias(aliasId: string) {
    if (!window.confirm("Remove this alias? The alias will stop resolving to this domain.")) return;
    setError(null); setBusy(true);
    try {
      const response = await fetch(`/api/admin/domains/${domainId}/aliases`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ aliasId }) });
      const data = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to remove alias");
      setAliases(current => current.filter(alias => alias.id !== aliasId));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to remove alias"); }
    finally { setBusy(false); }
  }

  return <section>
    <form onSubmit={addAlias}>
      <label>New alias <input value={hostname} onChange={e => setHostname(e.target.value)} placeholder="short.example.org" required disabled={busy} /></label>
      <button type="submit" disabled={busy}>Add alias</button>
    </form>
    {error && <p role="alert">{error}</p>}
    {aliases.length ? <ul>{aliases.map(alias => <li key={alias.id}>{alias.hostname} {alias.active ? "(active)" : "(inactive)"} <button type="button" onClick={() => removeAlias(alias.id)} disabled={busy}>Remove</button></li>)}</ul> : <p>No aliases configured.</p>}
  </section>;
}
