import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  projectsApi, refDataApi,
  type Project, type Region, type Country,
  type CreateProjectBody,
} from '../services/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_TYPES    = ['Retail', 'xScale', 'Matrix'] as const;
const PROJECT_STATUSES = ['Approved', 'Seeded', 'Proposed'] as const;
const WEIGHT_OPTIONS   = [0.5, 1.0, 1.5, 2.0] as const;

type ProjectType   = typeof PROJECT_TYPES[number];
type ProjectStatus = typeof PROJECT_STATUSES[number];

const STATUS_META: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  'Approved': { color: '#33CC77', bg: '#0D2B1E', border: '#1A5E38', dot: '#33CC77' },
  'Seeded':   { color: '#F9A825', bg: '#2B1E0D', border: '#5E3A1A', dot: '#F9A825' },
  'Proposed': { color: '#5599FF', bg: '#0D1B2B', border: '#1A3A66', dot: '#5599FF' },
};

const TYPE_META: Record<ProjectType, { color: string; bg: string; border: string }> = {
  Retail:  { color: '#2196F3', bg: '#0D1929', border: '#1A3A5E' },
  xScale:  { color: '#9C27B0', bg: '#1E0D2B', border: '#3A1A5E' },
  Matrix:  { color: '#00BCD4', bg: '#0D2A2E', border: '#1A5A63' },
};

function statusMeta(s: string) {
  return STATUS_META[s as ProjectStatus] ?? { color: '#888', bg: '#1E1E1E', border: '#333' };
}
function typeMeta(t: string) {
  return TYPE_META[t as ProjectType] ?? { color: '#666', bg: '#1A1A1A', border: '#333' };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S = {
  page:        { color: '#FFFFFF' } as React.CSSProperties,
  header:      { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 } as React.CSSProperties,
  title:       { fontSize: 24, fontWeight: 700, margin: 0 } as React.CSSProperties,
  accent:      { width: 40, height: 3, background: '#E31837', borderRadius: 2, marginTop: 6 } as React.CSSProperties,
  btnPrimary:  { padding: '9px 18px', background: '#E31837', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0 } as React.CSSProperties,
  btnSecondary:{ padding: '9px 18px', background: 'transparent', color: '#CCC', border: '1px solid #333', borderRadius: 6, fontSize: 14, cursor: 'pointer' } as React.CSSProperties,

  statsRow:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10, marginBottom: 20 } as React.CSSProperties,
  statCard:    (accent: string) => ({ background: '#111', border: '1px solid #222', borderTop: `3px solid ${accent}`, borderRadius: 8, padding: '12px 14px' } as React.CSSProperties),
  statNum:     { fontSize: 22, fontWeight: 700, color: '#FFF', lineHeight: 1 } as React.CSSProperties,
  statLabel:   { fontSize: 10, color: '#666', marginTop: 4, textTransform: 'uppercase' as const, letterSpacing: '0.06em' } as React.CSSProperties,

  toolbar:     { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' as const, alignItems: 'center' } as React.CSSProperties,
  searchWrap:  { position: 'relative' as const, flex: '1 1 220px', maxWidth: 300 } as React.CSSProperties,
  searchInput: { width: '100%', padding: '9px 12px 9px 34px', background: '#111', border: '1px solid #333', borderRadius: 6, color: '#FFF', fontSize: 14, outline: 'none' } as React.CSSProperties,
  searchIcon:  { position: 'absolute' as const, left: 10, top: '50%', transform: 'translateY(-50%)', color: '#555', pointerEvents: 'none' as const },
  filterSel:   { padding: '9px 12px', background: '#111', border: '1px solid #333', borderRadius: 6, color: '#FFF', fontSize: 13, cursor: 'pointer', outline: 'none' } as React.CSSProperties,

  grid:        { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 } as React.CSSProperties,
  centerBox:   { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: '#555' } as React.CSSProperties,

  overlay:     { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 },
  modal:       { background: '#111', border: '1px solid #333', borderRadius: 10, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' as const, padding: '28px 32px' } as React.CSSProperties,
  modalTitle:  { fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#FFF' } as React.CSSProperties,
  fg:          { marginBottom: 16 } as React.CSSProperties,
  lbl:         { display: 'block', fontSize: 11, fontWeight: 700, color: '#777', marginBottom: 5, letterSpacing: '0.08em', textTransform: 'uppercase' as const } as React.CSSProperties,
  inp:         { width: '100%', padding: '9px 12px', background: '#1A1A1A', border: '1px solid #333', borderRadius: 6, color: '#FFF', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
  sel:         { width: '100%', padding: '9px 12px', background: '#1A1A1A', border: '1px solid #333', borderRadius: 6, color: '#FFF', fontSize: 14, outline: 'none', cursor: 'pointer', boxSizing: 'border-box' as const } as React.CSSProperties,
  row2:        { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } as React.CSSProperties,
  row3:        { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 } as React.CSSProperties,
  mFooter:     { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 20, borderTop: '1px solid #222' } as React.CSSProperties,

  badge: (bg: string, color: string, border: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
    letterSpacing: '0.03em', background: bg, color, border: `1px solid ${border}`,
    whiteSpace: 'nowrap' as const,
  }),
  actionBtn: (danger?: boolean): React.CSSProperties => ({
    padding: '4px 10px', fontSize: 12, fontWeight: 500, background: 'transparent',
    border: `1px solid ${danger ? '#5a2a2a' : '#333'}`,
    color: danger ? '#cc6666' : '#AAA', borderRadius: 4, cursor: 'pointer',
  }),
};

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  name: string; type: string; status: string; weight: string;
  year: string; region_id: string; country_id: string; metro: string; phase_code: string;
}

const emptyForm: FormState = {
  name: '', type: 'Retail', status: 'Proposed', weight: '1.0',
  year: String(new Date().getFullYear()),
  region_id: '', country_id: '', metro: '', phase_code: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Projects() {
  const [projects,  setProjects]  = useState<Project[]>([]);
  const [regions,   setRegions]   = useState<Region[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [filteredCountries, setFilteredCountries] = useState<Country[]>([]);

  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [search,        setSearch]        = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [typeFilter,    setTypeFilter]    = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<'true' | 'false' | 'all'>('true');

  const [modalOpen,   setModalOpen]   = useState(false);
  const [editTarget,  setEditTarget]  = useState<Project | null>(null);
  const [form,        setForm]        = useState<FormState>(emptyForm);
  const [nameError,   setNameError]   = useState('');
  const [saving,      setSaving]      = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting,    setDeleting]    = useState(false);

  // ── Reference data ────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      refDataApi.regions().catch(() => [] as Region[]),
      refDataApi.countries().catch(() => [] as Country[]),
    ]).then(([r, c]) => { setRegions(r); setCountries(c); });
  }, []);

  // ── Country cascade ───────────────────────────────────────────────────────

  useEffect(() => {
    setFilteredCountries(
      form.region_id
        ? countries.filter(c => String(c.region_id) === form.region_id)
        : countries
    );
  }, [form.region_id, countries]);

  // ── Load projects ─────────────────────────────────────────────────────────

  const loadProjects = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setProjects(await projectsApi.list({ is_active: isActiveFilter, limit: 500 }));
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [isActiveFilter]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = projects;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.region_name ?? '').toLowerCase().includes(q) ||
        (p.country_name ?? '').toLowerCase().includes(q) ||
        (p.phase_code ?? '').toLowerCase().includes(q) ||
        (p.metro ?? '').toLowerCase().includes(q)
      );
    }
    if (statusFilter) list = list.filter(p => p.status === statusFilter);
    if (typeFilter)   list = list.filter(p => p.type   === typeFilter);
    return list;
  }, [projects, search, statusFilter, typeFilter]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const all = projects;
    return {
      total:    all.length,
      active:   all.filter(p => p.status === 'Approved').length,
      planning: all.filter(p => p.status === 'Seeded').length,
      onHold:   all.filter(p => p.status === 'Proposed').length,
    };
  }, [projects]);

  // ── Form helpers ──────────────────────────────────────────────────────────

  function openAdd() {
    setEditTarget(null); setForm(emptyForm); setNameError(''); setModalOpen(true);
  }

  function openEdit(p: Project) {
    setEditTarget(p);
    setForm({
      name:       p.name,
      type:       PROJECT_TYPES.includes(p.type as ProjectType) ? p.type : 'Retail',
      status:     PROJECT_STATUSES.includes(p.status as ProjectStatus) ? p.status : 'Proposed',
      weight:     String(p.weight),
      year:       p.year ? String(p.year) : '',
      region_id:  p.region_id  ? String(p.region_id)  : '',
      country_id: p.country_id ? String(p.country_id) : '',
      metro:      p.metro ?? '',
      phase_code: p.phase_code ?? '',
    });
    setNameError(''); setModalOpen(true);
  }

  function setField(key: keyof FormState, value: string) {
    setForm(f => {
      const next = { ...f, [key]: value };
      if (key === 'region_id') next.country_id = '';
      return next;
    });
    if (key === 'name') setNameError('');
  }

  async function handleSave() {
    if (!form.name.trim()) { setNameError('Name is required'); return; }
    setSaving(true);
    try {
      const body: CreateProjectBody = {
        name:       form.name.trim(),
        type:       form.type,
        status:     form.status,
        weight:     parseFloat(form.weight) || 1.0,
        year:       form.year ? parseInt(form.year, 10) : null,
        region_id:  form.region_id  ? parseInt(form.region_id,  10) : null,
        country_id: form.country_id ? parseInt(form.country_id, 10) : null,
        metro:      form.metro.trim()      || null,
        phase_code: form.phase_code.trim() || null,
      };
      if (editTarget) { await projectsApi.update(editTarget.id, body); }
      else            { await projectsApi.create(body); }
      setModalOpen(false);
      loadProjects();
    } finally { setSaving(false); }
  }

  async function handleDeactivate() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await projectsApi.deactivate(deleteTarget.id);
      setDeleteTarget(null);
      loadProjects();
    } finally { setDeleting(false); }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const statItems = [
    { label: 'Total',    value: stats.total,    color: '#555555' },
    { label: 'Approved', value: stats.active,   color: '#33CC77' },
    { label: 'Seeded',   value: stats.planning, color: '#F9A825' },
    { label: 'Proposed', value: stats.onHold,   color: '#5599FF' },
  ];

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Projects</h1>
          <div style={S.accent} />
        </div>
        <button style={S.btnPrimary} onClick={openAdd}>+ Add Project</button>
      </div>

      {/* Stats bar */}
      <div style={S.statsRow}>
        {statItems.map(({ label, value, color }) => (
          <div key={label} style={S.statCard(color)}>
            <div style={S.statNum}>{value}</div>
            <div style={S.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={S.searchWrap}>
          <span style={S.searchIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
            </svg>
          </span>
          <input
            style={S.searchInput}
            placeholder="Search projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <select style={S.filterSel} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        <select style={S.filterSel} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select style={S.filterSel} value={isActiveFilter} onChange={e => setIsActiveFilter(e.target.value as typeof isActiveFilter)}>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
          <option value="all">All</option>
        </select>

        {!loading && (
          <span style={{ color: '#555', fontSize: 13 }}>
            {filtered.length} {filtered.length === 1 ? 'project' : 'projects'}
          </span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={S.centerBox}><div className="spinner" /></div>
      ) : error ? (
        <div style={{ ...S.centerBox, flexDirection: 'column', gap: 12 }}>
          <span style={{ color: '#E31837' }}>Failed to load projects</span>
          <span style={{ fontSize: 12, color: '#555' }}>{error}</span>
          <button style={S.btnSecondary} onClick={loadProjects}>Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...S.centerBox, flexDirection: 'column', gap: 8 }}>
          <span>No projects found</span>
          {(search || statusFilter || typeFilter) && (
            <button style={{ ...S.btnSecondary, fontSize: 13, padding: '6px 14px' }}
              onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); }}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div style={S.grid}>
          {filtered.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              onEdit={() => openEdit(p)}
              onDelete={() => setDeleteTarget(p)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit modal */}
      {modalOpen && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div style={S.modal}>
            <h2 style={S.modalTitle}>{editTarget ? 'Edit Project' : 'Add Project'}</h2>

            {/* Name */}
            <div style={S.fg}>
              <label style={S.lbl}>Project Name *</label>
              <input
                style={{ ...S.inp, borderColor: nameError ? '#E31837' : '#333' }}
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="Enter project name"
                autoFocus
              />
              {nameError && <span style={{ fontSize: 11, color: '#E31837', display: 'block', marginTop: 3 }}>{nameError}</span>}
            </div>

            {/* Type / Status / Weight */}
            <div style={S.row3}>
              <div style={S.fg}>
                <label style={S.lbl}>Type</label>
                <select style={S.sel} value={form.type} onChange={e => setField('type', e.target.value)}>
                  {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={S.fg}>
                <label style={S.lbl}>Status</label>
                <select style={S.sel} value={form.status} onChange={e => setField('status', e.target.value)}>
                  {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={S.fg}>
                <label style={S.lbl}>Weight</label>
                <select style={S.sel} value={form.weight} onChange={e => setField('weight', e.target.value)}>
                  {WEIGHT_OPTIONS.map(w => (
                    <option key={w} value={w}>{w.toFixed(1)}{w === 0.5 ? ' — Half' : w === 1.0 ? ' — Standard' : w === 1.5 ? ' — Heavy' : ' — Double'}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Year */}
            <div style={S.fg}>
              <label style={S.lbl}>Year</label>
              <input
                type="number" min="2020" max="2035" style={S.inp}
                value={form.year}
                onChange={e => setField('year', e.target.value)}
                placeholder="e.g. 2026"
              />
            </div>

            {/* Region */}
            <div style={S.fg}>
              <label style={S.lbl}>Region</label>
              <select style={S.sel} value={form.region_id} onChange={e => setField('region_id', e.target.value)}>
                <option value="">— Select region —</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            {/* Country / Metro */}
            <div style={S.row2}>
              <div style={S.fg}>
                <label style={S.lbl}>Country</label>
                <select
                  style={{ ...S.sel, opacity: filteredCountries.length === 0 ? 0.5 : 1 }}
                  value={form.country_id}
                  onChange={e => setField('country_id', e.target.value)}
                  disabled={filteredCountries.length === 0}
                >
                  <option value="">— Select country —</option>
                  {filteredCountries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={S.fg}>
                <label style={S.lbl}>Metro</label>
                <input
                  style={S.inp} value={form.metro}
                  onChange={e => setField('metro', e.target.value)}
                  placeholder="e.g. London"
                />
              </div>
            </div>

            {/* Phase Code */}
            <div style={S.fg}>
              <label style={S.lbl}>Phase Code</label>
              <input
                style={S.inp} value={form.phase_code}
                onChange={e => setField('phase_code', e.target.value)}
                placeholder="e.g. PHASE-1"
              />
            </div>

            <div style={S.mFooter}>
              <button style={S.btnSecondary} onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button style={S.btnPrimary}   onClick={handleSave}              disabled={saving}>
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Archive confirmation */}
      {deleteTarget && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div style={{ ...S.modal, maxWidth: 420 }}>
            <h2 style={{ ...S.modalTitle, marginBottom: 12 }}>Archive Project</h2>
            <p style={{ color: '#CCC', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Archive <strong style={{ color: '#FFF' }}>{deleteTarget.name}</strong>? It will be hidden from active views but all data and allocations are preserved.
            </p>
            <div style={S.mFooter}>
              <button style={S.btnSecondary} onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button style={{ ...S.btnPrimary, background: '#c41530' }} onClick={handleDeactivate} disabled={deleting}>
                {deleting ? 'Archiving…' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Project card
// ---------------------------------------------------------------------------

function ProjectCard({ project: p, onEdit, onDelete }: { project: Project; onEdit: () => void; onDelete: () => void }) {
  const [hover, setHover] = useState(false);

  const sm   = statusMeta(p.status);
  const tm   = typeMeta(p.type);
  const loc  = [p.metro, p.country_name, p.region_name].filter(Boolean).join(', ');
  const adjCount = (Number(p.weight) || 1).toFixed(1);

  return (
    <div
      style={{
        background: '#111111',
        border: `1px solid ${hover ? '#444' : '#222'}`,
        borderLeft: `4px solid ${tm.color}`,
        borderRadius: 8,
        padding: '18px 18px 16px',
        cursor: 'default',
        transition: 'border-color 0.15s, transform 0.1s',
        transform: hover ? 'translateY(-1px)' : 'none',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Top: badges + weight */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 1 }}>
          {/* Status badge */}
          <span style={S.badge(sm.bg, sm.color, sm.border)}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: sm.color, display: 'inline-block' }} />
            {p.status}
          </span>
          {/* Type badge */}
          <span style={S.badge(tm.bg, tm.color, tm.border)}>
            {p.type}
          </span>
        </div>

        {/* Weight pill — top right */}
        <div style={{ textAlign: 'right', marginLeft: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: tm.color, lineHeight: 1 }}>
            {(Number(p.weight) || 1).toFixed(1)}
          </div>
          <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>
            weight
          </div>
        </div>
      </div>

      {/* Name */}
      <div style={{ fontSize: 15, fontWeight: 700, color: '#FFF', lineHeight: 1.35, marginBottom: 12 }}>
        {p.name}
      </div>

      {/* Meta rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 14 }}>
        {loc && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#999' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#555">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span>{loc}</span>
          </div>
        )}
        {(p.year || p.phase_code) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#999' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#555">
              <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
            </svg>
            <span>{[p.year && `FY${p.year}`, p.phase_code].filter(Boolean).join(' · ')}</span>
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#1E1E1E', marginBottom: 12 }} />

      {/* Footer: Adj Count + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Weight block */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div>
            <div style={{ fontSize: 9, color: '#444', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Adj Count</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: tm.color, lineHeight: 1.2 }}>{adjCount}</div>
          </div>
        </div>

        {/* Phase / year compact */}
        {p.year && (
          <div style={{ padding: '2px 7px', borderRadius: 4, background: '#1A1A1A', border: '1px solid #2A2A2A', fontSize: 10, color: '#555' }}>
            {p.year}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 5 }}>
          <button style={S.actionBtn()} onClick={onEdit}>Edit</button>
          {p.is_active && (
            <button style={S.actionBtn(true)} onClick={onDelete}>Archive</button>
          )}
        </div>
      </div>
    </div>
  );
}
