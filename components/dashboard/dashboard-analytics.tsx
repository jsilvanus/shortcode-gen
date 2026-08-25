"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, Button, Card, CardContent, Checkbox, Chip, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import FolderIcon from "@mui/icons-material/Folder";
import LinkIcon from "@mui/icons-material/Link";
import LockIcon from "@mui/icons-material/Lock";
import PublicIcon from "@mui/icons-material/Public";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ClearIcon from "@mui/icons-material/Clear";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type LinkOption = { id: string; code: string; title?: string | null; targetUrl: string; isPrivate: boolean; active: boolean; expiresAt?: string | null; collectionIds: string[] };
type CollectionOption = { id: string; name: string; isPrivate: boolean };
type Stats = { exact: boolean; totals: { pageViews: number; redirects: number; uniqueViews: number; uniqueRedirects: number }; daily: { date: string; pageViews: number; redirects: number }[] };
const ranges = { "7d": 7, "30d": 30, "90d": 90, year: "year" } as const;

export function DashboardAnalytics({ links, collections }: { links: LinkOption[]; collections: CollectionOption[] }) {
  const [selected, setSelected] = useState<string[]>([]), [selectedCollection, setSelectedCollection] = useState(""), [privateFilter, setPrivateFilter] = useState("all"), [statusFilter, setStatusFilter] = useState("all"), [query, setQuery] = useState(""), [range, setRange] = useState<keyof typeof ranges>("30d"), [stats, setStats] = useState<Stats | null>(null), [loading, setLoading] = useState(false);
  const filteredLinks = useMemo(() => links.filter(link => {
    if (selectedCollection && !link.collectionIds.includes(selectedCollection)) return false;
    if (privateFilter === "private" && !link.isPrivate) return false;
    if (privateFilter === "public" && link.isPrivate) return false;
    if (statusFilter === "active" && !link.active) return false;
    if (statusFilter === "expired" && (!link.expiresAt || new Date(link.expiresAt) > new Date())) return false;
    const q = query.trim().toLowerCase(); return !q || link.code.toLowerCase().includes(q) || (link.title ?? "").toLowerCase().includes(q) || link.targetUrl.toLowerCase().includes(q);
  }), [links, selectedCollection, privateFilter, statusFilter, query]);
  const selectedLinks = useMemo(() => links.filter(l => selected.includes(l.id)), [links, selected]);
  const toggleLink = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  useEffect(() => {
    if (!selectedLinks.length) { setStats(null); return; }
    const now = new Date(), value = ranges[range], from = value === "year" ? new Date(Date.UTC(now.getUTCFullYear(), 0, 1)) : new Date(now.getTime() - Number(value) * 86400000);
    setLoading(true); fetch(`/api/dashboard/stats?ids=${encodeURIComponent(selected.join(","))}&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(now.toISOString())}`).then(r => r.ok ? r.json() : null).then(setStats).finally(() => setLoading(false));
  }, [selected, selectedLinks.length, range]);
  const chartData = stats?.daily.map(d => ({ ...d, label: new Date(d.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }) })) ?? [];
  const activeCount = filteredLinks.filter(l => l.active && (!l.expiresAt || new Date(l.expiresAt) > new Date())).length;
  const clearFilters = () => { setSelectedCollection(""); setPrivateFilter("all"); setStatusFilter("all"); setQuery(""); };

  return <Box sx={{ display: "grid", gap: 3 }}>
    <Card variant="outlined"><CardContent>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}><FilterListIcon color="action" /><Typography variant="h6">Filters</Typography></Stack>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} useFlexGap flexWrap="wrap">
        <TextField size="small" label="Search links" value={query} onChange={e => setQuery(e.target.value)} placeholder="Code, title or target" slotProps={{ input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 1 }} /> } }} />
        <FormControl size="small" sx={{ minWidth: 190 }}><InputLabel>Collection</InputLabel><Select value={selectedCollection} label="Collection" onChange={e => setSelectedCollection(e.target.value)} startAdornment={<FolderIcon fontSize="small" sx={{ mr: 1 }} />}><MenuItem value="">All collections</MenuItem>{collections.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}</Select></FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>Visibility</InputLabel><Select value={privateFilter} label="Visibility" onChange={e => setPrivateFilter(e.target.value)}><MenuItem value="all">All</MenuItem><MenuItem value="private">Private</MenuItem><MenuItem value="public">Public</MenuItem></Select></FormControl>
        <FormControl size="small" sx={{ minWidth: 150 }}><InputLabel>Status</InputLabel><Select value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value)}><MenuItem value="all">All</MenuItem><MenuItem value="active">Active</MenuItem><MenuItem value="expired">Expired</MenuItem></Select></FormControl>
      </Stack>
      <Stack direction="row" spacing={1} mt={2} flexWrap="wrap" useFlexGap>
        {selectedCollection && <Chip icon={<FolderIcon />} label={collections.find(c => c.id === selectedCollection)?.name ?? "Collection"} onDelete={() => setSelectedCollection("")} />}
        {privateFilter !== "all" && <Chip icon={privateFilter === "private" ? <LockIcon /> : <PublicIcon />} label={privateFilter === "private" ? "Private" : "Public"} onDelete={() => setPrivateFilter("all")} />}
        {statusFilter !== "all" && <Chip icon={statusFilter === "active" ? <CheckCircleIcon /> : <ScheduleIcon />} label={statusFilter === "active" ? "Active" : "Expired"} onDelete={() => setStatusFilter("all")} />}
        {query && <Chip icon={<SearchIcon />} label={query} onDelete={() => setQuery("")} />}
        {(selectedCollection || privateFilter !== "all" || statusFilter !== "all" || query) && <Button size="small" startIcon={<ClearIcon />} onClick={clearFilters}>Clear filters</Button>}
      </Stack>
    </CardContent></Card>

    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center"><Typography variant="body2" color="text.secondary">{filteredLinks.length} links · {activeCount} active</Typography><Button size="small" variant="outlined" startIcon={<LinkIcon />} onClick={() => setSelected(filteredLinks.map(l => l.id))}>Select filtered</Button><Button size="small" onClick={() => setSelected([])} disabled={!selected.length}>Clear selection</Button><FormControl size="small" sx={{ ml: "auto", minWidth: 130 }}><InputLabel>Range</InputLabel><Select value={range} label="Range" onChange={e => setRange(e.target.value as keyof typeof ranges)}><MenuItem value="7d">7 days</MenuItem><MenuItem value="30d">30 days</MenuItem><MenuItem value="90d">90 days</MenuItem><MenuItem value="year">This year</MenuItem></Select></FormControl></Stack>

    <Card variant="outlined"><CardContent><Typography variant="h6" gutterBottom>Links</Typography><Box sx={{ display: "grid", gap: 1 }}>
      {filteredLinks.map(link => <Box key={link.id} onClick={() => toggleLink(link.id)} sx={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", alignItems: "center", gap: 1, p: 1, borderRadius: 1, cursor: "pointer", bgcolor: selected.includes(link.id) ? "action.selected" : "transparent", "&:hover": { bgcolor: "action.hover" } }}>
        <Checkbox checked={selected.includes(link.id)} onChange={() => toggleLink(link.id)} onClick={e => e.stopPropagation()} />
        <Box sx={{ minWidth: 0 }}><Typography variant="subtitle2" noWrap>{link.title || link.code}</Typography><Typography variant="caption" color="text.secondary" noWrap display="block">/{link.code} · {link.targetUrl}</Typography></Box>
        <Stack direction="row" spacing={0.5} flexWrap="wrap" justifyContent="flex-end">{link.collectionIds.map(id => <Chip key={id} size="small" icon={<FolderIcon />} label={collections.find(c => c.id === id)?.name ?? "Collection"} />)}<Chip size="small" icon={link.isPrivate ? <LockIcon /> : <PublicIcon />} label={link.isPrivate ? "Private" : "Public"} />{link.active && (!link.expiresAt || new Date(link.expiresAt) > new Date()) ? <Chip size="small" icon={<CheckCircleIcon />} label="Active" color="success" variant="outlined" /> : <Chip size="small" icon={<ScheduleIcon />} label="Expired" color="warning" variant="outlined" />}</Stack>
      </Box>)}
      {!filteredLinks.length && <Typography color="text.secondary">No links match these filters.</Typography>}
    </Box></CardContent></Card>

    {loading && <Typography color="text.secondary">Loading statistics…</Typography>}
    {stats && <><Stack direction={{ xs: "column", sm: "row" }} spacing={2}>{[["Page views", stats.totals.pageViews], ["Redirects", stats.totals.redirects], ["Unique visitors", stats.totals.uniqueViews], ["Unique redirects", stats.totals.uniqueRedirects]].map(([label, value]) => <Card key={String(label)} variant="outlined" sx={{ flex: 1 }}><CardContent><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h4">{Number(value).toLocaleString()}</Typography></CardContent></Card>)}</Stack><Card variant="outlined"><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6">Traffic over time</Typography><Chip size="small" label={stats.exact ? "Exact uniques" : "Estimated uniques"} /></Stack><Box sx={{ width: "100%", height: 300, mt: 2 }}><ResponsiveContainer><LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="pageViews" name="Views" stroke="var(--mui-palette-primary-main)" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="redirects" name="Redirects" stroke="var(--mui-palette-secondary-main)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></Box></CardContent></Card></>}
  </Box>;
}
