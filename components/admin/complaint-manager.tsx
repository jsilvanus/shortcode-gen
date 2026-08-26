"use client";

import { useState } from "react";

type Complaint = { id: string; message: string; createdAt: string; resolvedAt: string | null; shortLink: { code: string; title: string | null } };

export function ComplaintManager({ initial }: { initial: Complaint[] }) {
  const [complaints, setComplaints] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function resolve(id: string) {
    const response = await fetch("/api/admin/complaints", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    if (response.ok) setComplaints(current => current.map(c => c.id === id ? { ...c, resolvedAt: new Date().toISOString() } : c));
    else setError((await response.json().catch(() => null))?.error ?? "Could not resolve this report");
  }

  if (complaints.length === 0) return <p>No reports.</p>;
  return (
    <div>
      {error && <p role="alert">{error}</p>}
      <ul>
        {complaints.map(c => (
          <li key={c.id}>
            <strong>/{c.shortLink.code}</strong>{c.shortLink.title ? ` — ${c.shortLink.title}` : ""} · {new Date(c.createdAt).toLocaleString()}
            {c.resolvedAt ? " · resolved" : <> · <button type="button" onClick={() => resolve(c.id)}>Mark resolved</button></>}
            <p>{c.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
