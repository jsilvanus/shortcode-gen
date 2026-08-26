"use client";

import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, TextField, Typography } from "@mui/material";

type ApiKey = { id: string; label: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null; expiresAt: string | null; revokedAt: string | null };

export function ApiKeyManager({ initial }: { initial: ApiKey[] }) {
  const [keys, setKeys] = useState(initial);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [issuedToken, setIssuedToken] = useState<string | null>(null);

  function startCreate() { setLabel(""); setError(null); setOpen(true); }

  async function create() {
    setError(null);
    const response = await fetch("/api/api-keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ label }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) { setError(data?.error ?? "Could not create API key"); return; }
    setKeys(current => [{ id: data.id, label: data.label, keyPrefix: data.keyPrefix, createdAt: data.createdAt, lastUsedAt: null, expiresAt: data.expiresAt, revokedAt: null }, ...current]);
    setOpen(false);
    setIssuedToken(data.token);
  }

  async function revoke(key: ApiKey) {
    if (!window.confirm(`Revoke API key "${key.label}"? Anything using it will stop working immediately.`)) return;
    const response = await fetch(`/api/api-keys/${key.id}`, { method: "DELETE" });
    if (response.ok) setKeys(current => current.filter(k => k.id !== key.id));
    else { const data = await response.json().catch(() => null); setError(data?.error ?? "Could not revoke API key"); }
  }

  return <Box>
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
      <Box><Typography variant="h5">API keys</Typography><Typography variant="body2" color="text.secondary">Scoped to this domain, with your current role. Use as an <code>Authorization: Bearer</code> header.</Typography></Box>
      <Button variant="contained" startIcon={<AddIcon />} onClick={startCreate}>New API key</Button>
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Stack spacing={1}>
      {keys.map(key => <Stack key={key.id} direction="row" alignItems="center" spacing={1} sx={{ p: 1, border: 1, borderColor: "divider", borderRadius: 1, opacity: key.revokedAt ? 0.5 : 1 }}>
        <VpnKeyIcon fontSize="small" color={key.revokedAt ? "disabled" : "primary"} />
        <Stack sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle2" noWrap>{key.label}{key.revokedAt ? " (revoked)" : ""}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap>slk_{key.keyPrefix}… · created {new Date(key.createdAt).toLocaleDateString()}{key.lastUsedAt ? ` · last used ${new Date(key.lastUsedAt).toLocaleDateString()}` : " · never used"}</Typography>
        </Stack>
        {!key.revokedAt && <IconButton aria-label={`Revoke ${key.label}`} color="error" onClick={() => revoke(key)}><DeleteIcon /></IconButton>}
      </Stack>)}
      {!keys.length && <Typography color="text.secondary">No API keys yet.</Typography>}
    </Stack>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>New API key</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <TextField autoFocus label="Label" placeholder="e.g. marketing automation" value={label} onChange={e => setLabel(e.target.value)} required inputProps={{ maxLength: 100 }} />
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={create} disabled={!label.trim()}>Create</Button></DialogActions>
    </Dialog>
    <Dialog open={!!issuedToken} onClose={() => setIssuedToken(null)} fullWidth maxWidth="sm">
      <DialogTitle>API key created</DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>Copy this now — it will not be shown again.</Alert>
        <TextField fullWidth value={issuedToken ?? ""} InputProps={{ readOnly: true }} onFocus={e => e.target.select()} />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => { if (issuedToken) navigator.clipboard?.writeText(issuedToken); }}>Copy</Button>
        <Button variant="contained" onClick={() => setIssuedToken(null)}>Done</Button>
      </DialogActions>
    </Dialog>
  </Box>;
}
