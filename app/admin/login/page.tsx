"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
    if (!response.ok) { setError("Invalid username or password"); return; }
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    const destination = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/admin/dashboard";
    router.push(destination);
    router.refresh();
  }

  return <main>
    <h1>Sign in</h1>
    <form onSubmit={submit}>
      <label>Username <input name="username" autoComplete="username" required /></label>
      <label>Password <input name="password" type="password" autoComplete="current-password" required /></label>
      <button type="submit">Sign in</button>
    </form>
    {error && <p role="alert">{error}</p>}
  </main>;
}
