"use client";

import { useState } from "react";

type Member = { user: { id: string; username: string }; role: "USER" | "ADMIN" };

export function DomainUserManager({ domainId, initialUsers }: { domainId: string; initialUsers: Member[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"USER" | "ADMIN">("USER");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault(); setError(null); setBusy(true);
    try {
      const response = await fetch(`/api/admin/domains/${domainId}/users`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId, role }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to update user");
      const member = data.user as Member;
      setUsers(current => [...current.filter(m => m.user.id !== member.user.id), member].sort((a, b) => a.user.username.localeCompare(b.user.username)));
      setUserId("");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update user"); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!window.confirm("Remove this user's access to the domain?")) return;
    setError(null); setBusy(true);
    try {
      const response = await fetch(`/api/admin/domains/${domainId}/users`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: id }) });
      const data = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(data?.error || "Unable to remove user");
      setUsers(current => current.filter(m => m.user.id !== id));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to remove user"); }
    finally { setBusy(false); }
  }

  return <section>
    <form onSubmit={save}>
      <label>User ID <input value={userId} onChange={e => setUserId(e.target.value)} required disabled={busy} /></label>
      <label>Role <select value={role} onChange={e => setRole(e.target.value as "USER" | "ADMIN")} disabled={busy}><option value="USER">User</option><option value="ADMIN">Admin</option></select></label>
      <button type="submit" disabled={busy}>Add / update</button>
    </form>
    {error && <p role="alert">{error}</p>}
    <table><thead><tr><th>User</th><th>Role</th><th /></tr></thead><tbody>{users.map(member => <tr key={member.user.id}><td>{member.user.username}</td><td>{member.role}</td><td><button type="button" onClick={() => remove(member.user.id)} disabled={busy}>Remove</button></td></tr>)}</tbody></table>
  </section>;
}
