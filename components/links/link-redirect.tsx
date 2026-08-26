"use client";

import { useEffect, useState } from "react";

export function LinkRedirect({ code, targetUrl, delaySeconds }: { code: string; targetUrl: string; delaySeconds: number }) {
  const [remaining, setRemaining] = useState(delaySeconds);
  const [error, setError] = useState<string | null>(null);

  async function goNow() {
    try {
      const response = await fetch(`/api/links/${encodeURIComponent(code)}/redirect`, { method: "POST" });
      if (!response.ok) { setError((await response.json().catch(() => null))?.error ?? "This link is no longer available"); return; }
      window.location.assign(targetUrl);
    } catch {
      setError("Could not continue to this link right now");
    }
  }

  useEffect(() => {
    if (remaining <= 0) { void goNow(); return; }
    const timer = setTimeout(() => setRemaining(r => r - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  if (error) return <p role="alert">{error}</p>;
  return (
    <p aria-live="polite">
      Continuing in {remaining}s… <button type="button" onClick={() => void goNow()}>Continue now</button>
    </p>
  );
}
