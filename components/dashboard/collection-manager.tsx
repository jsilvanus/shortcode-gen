"use client";

import { useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import FolderIcon from "@mui/icons-material/Folder";
import LockIcon from "@mui/icons-material/Lock";
import PublicIcon from "@mui/icons-material/Public";
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Stack, Switch, TextField, Typography } from "@mui/material";

type Collection = { id: string; name: string; description?: string | null; isPrivate: boolean; ownerId?: string };

export function CollectionManager({ initial }: { initial: Collection[] }) {
  const [collections, setCollections] = useState(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function startCreate() { setEditing(null); setName(""); setDescription(""); setIsPrivate(true); setError(null); setOpen(true); }
  function startEdit(c: Collection) { setEditing(c); setName(c.name); setDescription(c.description ?? ""); setIsPrivate(c.isPrivate); setError(null); setOpen(true); }
  async function save() {
    setError(null);
    const payload = { name, description: description || null, isPrivate };
    const response = await fetch(editing ? `/api/collections/${editing.id}` : "/api/collections", { method: editing ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json().catch(() => null);
    if (!response.ok) { setError(data?.error ?? "Could not save collection"); return; }
    setCollections(current => editing ? current.map(c => c.id === data.id ? data : c) : [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
    setOpen(false);
  }
  async function remove(c: Collection) {
    if (!window.confirm(`Delete collection “${c.name}”? Links will not be deleted.`)) return;
    const response = await fetch(`/api/collections/${c.id}`, { method: "DELETE" });
    if (response.ok) setCollections(current => current.filter(x => x.id !== c.id));
    else { const data = await response.json().catch(() => null); setError(data?.error ?? "Could not delete collection"); }
  }

  return <Box>
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
      <Box><Typography variant="h5">Collections</Typography><Typography variant="body2" color="text.secondary">Organise links into reusable groups.</Typography></Box>
      <Button variant="contained" startIcon={<AddIcon />} onClick={startCreate}>New collection</Button>
    </Stack>
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    <Stack direction="row" flexWrap="wrap" gap={1.5}>
      {collections.map(c => <Box key={c.id} sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.5, minWidth: 220 }}>
        <Stack direction="row" alignItems="center" spacing={1}><FolderIcon color="primary" /><Typography fontWeight={600} sx={{ flex: 1 }}>{c.name}</Typography><IconButton size="small" aria-label={`Edit ${c.name}`} onClick={() => startEdit(c)}><EditIcon fontSize="small" /></IconButton><IconButton size="small" aria-label={`Delete ${c.name}`} onClick={() => remove(c)}><DeleteIcon fontSize="small" /></IconButton></Stack>
        {c.description && <Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>{c.description}</Typography>}
        <Chip size="small" sx={{ mt: 1 }} icon={c.isPrivate ? <LockIcon /> : <PublicIcon />} label={c.isPrivate ? "Private" : "Public"} />
      </Box>)}
      {!collections.length && <Typography color="text.secondary">No collections yet.</Typography>}
    </Stack>
    <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" aria-labelledby="collection-dialog-title">
      <DialogTitle id="collection-dialog-title">{editing ? "Edit collection" : "New collection"}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}><TextField autoFocus label="Name" value={name} onChange={e => setName(e.target.value)} required inputProps={{ maxLength: 100 }} /><TextField label="Description" value={description} onChange={e => setDescription(e.target.value)} multiline minRows={2} inputProps={{ maxLength: 500 }} /><FormControlLabel control={<Switch checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} />} label={isPrivate ? "Private collection" : "Public collection"} /></Stack></DialogContent>
      <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={save} disabled={!name.trim()}>Save</Button></DialogActions>
    </Dialog>
  </Box>;
}
