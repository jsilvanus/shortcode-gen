"use client";

import { useState } from "react";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PauseIcon from "@mui/icons-material/Pause";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import SaveIcon from "@mui/icons-material/Save";
import { Alert, Autocomplete, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, Switch, TextField, Typography } from "@mui/material";

type Collection = { id: string; name: string; isPrivate: boolean };
type Link = { id: string; code: string; title?: string | null; targetUrl: string; description?: string | null; isPrivate: boolean; active: boolean; expiresAt?: string | null; collectionIds: string[]; canEdit: boolean };

export function LinkManager({ initial, collections }: { initial: Link[]; collections: Collection[] }) {
  const [links, setLinks] = useState(initial);
  const [editing, setEditing] = useState<Link | null>(null);
  const [targetUrl, setTargetUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [active, setActive] = useState(true);
  const [selectedCollections, setSelectedCollections] = useState<Collection[]>([]);
  const [error, setError] = useState<string | null>(null);

  function open(link: Link) {
    setEditing(link); setTargetUrl(link.targetUrl); setTitle(link.title ?? ""); setDescription(link.description ?? "");
    setExpiresAt(link.expiresAt ? new Date(link.expiresAt).toISOString().slice(0, 16) : ""); setIsPrivate(link.isPrivate); setActive(link.active);
    setSelectedCollections(collections.filter(c => link.collectionIds.includes(c.id))); setError(null);
  }

  async function save() {
    if (!editing) return;
    const response = await fetch(`/api/links/${encodeURIComponent(editing.code)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ targetUrl, title, description, isPrivate, active, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null, collectionIds: selectedCollections.map(c => c.id) }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) { setError(data?.error ?? "Could not save link"); return; }
    setLinks(current => current.map(l => l.id === editing.id ? { ...l, targetUrl, title, description, isPrivate, active, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null, collectionIds: selectedCollections.map(c => c.id) } : l));
    setEditing(null);
  }

  async function toggle(link: Link) {
    const response = await fetch(`/api/links/${encodeURIComponent(link.code)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ active: !link.active }) });
    if (response.ok) setLinks(current => current.map(l => l.id === link.id ? { ...l, active: !l.active } : l));
  }

  async function remove(link: Link) {
    if (!window.confirm(`Delete /${link.code}? This cannot be undone.`)) return;
    const response = await fetch(`/api/links/${encodeURIComponent(link.code)}`, { method: "DELETE" });
    if (response.ok) setLinks(current => current.filter(l => l.id !== link.id));
    else { const data = await response.json().catch(() => null); setError(data?.error ?? "Could not delete link"); }
  }

  return <Stack spacing={1}>
    {error && <Alert severity="error">{error}</Alert>}
    {links.map(link => <Stack key={link.id} direction="row" alignItems="center" spacing={1} sx={{ p: 1, border: 1, borderColor: "divider", borderRadius: 1 }}>
      <Stack sx={{ minWidth: 0, flex: 1 }}><Typography variant="subtitle2" noWrap>/{link.code}{link.title ? ` — ${link.title}` : ""}</Typography><Typography variant="caption" color="text.secondary" noWrap>{link.targetUrl}</Typography></Stack>
      {link.collectionIds.map(id => <Chip key={id} size="small" label={collections.find(c => c.id === id)?.name ?? "Collection"} />)}
      <Chip size="small" label={link.isPrivate ? "Private" : "Public"} />
      <Chip size="small" label={link.expiresAt ? `Expires ${new Date(link.expiresAt).toLocaleDateString()}` : "No expiry"} />
      {link.canEdit && <><IconButton aria-label={`Edit ${link.code}`} onClick={() => open(link)}><EditIcon /></IconButton><IconButton aria-label={`${link.active ? "Deactivate" : "Activate"} ${link.code}`} onClick={() => toggle(link)}>{link.active ? <PauseIcon /> : <PlayArrowIcon />}</IconButton><IconButton aria-label={`Delete ${link.code}`} color="error" onClick={() => remove(link)}><DeleteIcon /></IconButton></>}
    </Stack>)}
    <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
      <DialogTitle>Edit /{editing?.code}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        <TextField label="Target URL" value={targetUrl} onChange={e => setTargetUrl(e.target.value)} fullWidth required />
        <TextField label="Title" value={title} onChange={e => setTitle(e.target.value)} fullWidth />
        <TextField label="Description" value={description} onChange={e => setDescription(e.target.value)} fullWidth multiline minRows={2} />
        <TextField label="Expires" type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth helperText="Leave empty for no expiry" />
        <Autocomplete multiple options={collections} value={selectedCollections} getOptionLabel={c => c.name} isOptionEqualToValue={(a, b) => a.id === b.id} onChange={(_, value) => setSelectedCollections(value)} renderInput={params => <TextField {...params} label="Collections" placeholder="Add collection" />} />
        <FormControlLabel control={<Switch checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} />} label={isPrivate ? "Private link" : "Public link"} />
        <FormControlLabel control={<Switch checked={active} onChange={e => setActive(e.target.checked)} />} label={active ? "Active" : "Deactivated"} />
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setEditing(null)}>Cancel</Button><Button variant="contained" startIcon={<SaveIcon />} onClick={save}>Save</Button></DialogActions>
    </Dialog>
  </Stack>;
}
