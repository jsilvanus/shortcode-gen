"use client";

import { useEffect, useState } from "react";
import { Alert, Autocomplete, Box, Chip, Stack, TextField, Typography } from "@mui/material";

type Entry = { action: string; resourceType: string | null; resourceId: string | null; authMethod: string; apiKeyLabel?: string | null; createdAt: string };
type Member = { id: string; username: string };

function EntryList({ entries }: { entries: Entry[] }) {
  if (!entries.length) return <Typography color="text.secondary">No activity recorded.</Typography>;
  return <Stack spacing={1}>
    {entries.map((e, i) => <Stack key={i} direction="row" alignItems="center" spacing={1} sx={{ p: 1, border: 1, borderColor: "divider", borderRadius: 1 }}>
      <Stack sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle2">{e.action}{e.resourceType ? ` — ${e.resourceType}${e.resourceId ? ` (${e.resourceId})` : ""}` : ""}</Typography>
        <Typography variant="caption" color="text.secondary">{new Date(e.createdAt).toLocaleString()}</Typography>
      </Stack>
      <Chip size="small" label={e.authMethod === "api_key" ? `API key${e.apiKeyLabel ? `: ${e.apiKeyLabel}` : ""}` : "Dashboard"} />
    </Stack>)}
  </Stack>;
}

export function AuditLogViewer({ isDomainAdmin, members }: { isDomainAdmin: boolean; members: Member[] }) {
  const [ownEntries, setOwnEntries] = useState<Entry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberEntries, setMemberEntries] = useState<Entry[] | null>(null);

  useEffect(() => {
    fetch("/api/audit-log").then(async r => {
      const data = await r.json().catch(() => null);
      if (!r.ok) { setError(data?.error ?? "Could not load activity log"); return; }
      setOwnEntries(data);
    });
  }, []);

  useEffect(() => {
    if (!selectedMember) { setMemberEntries(null); return; }
    fetch(`/api/audit-log/members/${encodeURIComponent(selectedMember.id)}`).then(async r => {
      const data = await r.json().catch(() => null);
      if (!r.ok) { setError(data?.error ?? "Could not load member activity"); return; }
      setMemberEntries(data);
    });
  }, [selectedMember]);

  return <Box>
    <Typography variant="h5" sx={{ mb: 1 }}>Activity log</Typography>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Your own actions in this domain. Entries never store your raw account identity, only a per-account pseudonym.</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {ownEntries === null ? <Typography color="text.secondary">Loading…</Typography> : <EntryList entries={ownEntries} />}

    {isDomainAdmin && <Box sx={{ mt: 4 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Look up a member's activity</Typography>
      <Alert severity="warning" sx={{ mb: 2 }}>Viewing a member's activity resolves their pseudonym to their identity, and that lookup is itself recorded in the activity log.</Alert>
      <Autocomplete sx={{ maxWidth: 320, mb: 2 }} options={members} getOptionLabel={m => m.username} value={selectedMember} onChange={(_, value) => setSelectedMember(value)} renderInput={params => <TextField {...params} label="Domain member" />} />
      {selectedMember && (memberEntries === null ? <Typography color="text.secondary">Loading…</Typography> : <EntryList entries={memberEntries} />)}
    </Box>}
  </Box>;
}
