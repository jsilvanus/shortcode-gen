"use client";

import { useState } from "react";

export function LinkComplaintForm({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("Sending…");
    const response = await fetch(`/api/links/${encodeURIComponent(code)}/complain`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }) });
    if (response.ok) { setStatus("Thanks, this has been reported."); setMessage(""); setOpen(false); }
    else setStatus((await response.json().catch(() => null))?.error ?? "Could not send this report");
  }

  if (!open) return <p><button type="button" onClick={() => setOpen(true)}>Report this link</button> {status && <span role="status">{status}</span>}</p>;
  return (
    <form onSubmit={submit}>
      <label>What's wrong with this link?<textarea required maxLength={2000} value={message} onChange={e => setMessage(e.target.value)} /></label>
      <button type="submit">Send report</button>
      <button type="button" onClick={() => setOpen(false)}>Cancel</button>
      <p aria-live="polite">{status}</p>
    </form>
  );
}
