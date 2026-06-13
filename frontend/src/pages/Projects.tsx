import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  projectsApi, refDataApi,
  type Project, type Region, type Country,
  type CreateProjectBody,
} from '../services/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_TYPES = ['BAU', 'Programme', 'Project', 'Internal', 'Strategic', 'Other'];
const PROJECT_STATUSES = ['Planning', 'Active', 'On Hold', 'Completed', 'Cancelled'];

const STATUS_META: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  'Active':    { color: '#33CC77', bg: '#0D2B1E', border: '#1A5E38', dot: '#33CC77' },
  'Planning':  { color: '#5599FF', bg: '#0D1B2B', border: '#1A3A66', dot: '#5599FF' },
  'On Hold':   { color: '#FFAA33', bg: '#2B1E0D', border: '#5E3A1A', dot: '#FFAA33' },
  'Completed': { color: '#888888', bg: '#1E1E1E', border: '#2E2E2E', dot: '#888888' },
  'Cancelled': { color: '#E31837', bg: '#2B0D0D', border: '#5E1A1A', dot: '#E31837' },
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? { color: '#888', bg: '#1E1E1E', border: '#333', dot: '#888' };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S = {
  page: { color: '#FFFFFF' } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 } as React.CSSProperties,
  title: { fontSize: 24, fontWeight: 700, margin: 0 } as React.CSSProperties,
  accent: { width: 40, height: 3, background: '#E31837', borderRadius: 2, marginTop: 6 } as React.CSSProperties,
  btnPrimary: {
    padding: '9px 18px', background: '#E31837', color: '#FFFFFF',
    border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0,
  } as React.CSSProperties,
  btnSecondary: {
    padding: '9px 18px', background: 'transparent', color: '#CCCCCC',
    border: '1px solid #333333', borderRadius: 6, fontSize: 14, cursor: 'pointer',
  } as React.CSSProperties,
  // Stats row
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10, marginBottom: 20 } as React.CSSProperties,
  statCard: (accent: string) => ({
    background: '#111111', border: `1px solid #222222`,
    borderTop: `3px solid ${accent}`,
    borderRadius: 8, padding: '14px 16px',
  } as React.CSSProperties),
  statNum: { fontSize: 24, fontWeight: 700, color: '#FFFFFF', lineHeight: 1 } as React.CSSProperties,
  statLabel: { fontSize: 11, color: '#888888', marginTop: 4, textTransform: 'uppercase' as const, letterSpacing: '0.06em' } as React.CSSProperties,
  // Toolbar
  toolbar: { display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' as const, alignItems: 'center' } as React.CSSProperties,
  searchWrap: { position: 'relative' as const, flex: '1 1 240px', maxWidth: 320 } as React.CSSProperties,
  searchInput: {
    width: '100%', padding: '9px 12px 9px 36px',
    background: '#111111', border: '1px solid #333333', borderRadius: 6,
    color: '#FFFFFF', fontSize: 14, outline: 'none',
  } as React.CSSProperties,
  searchIcon: { position: 'absolute' as const, left: 11, top: '50%', transform: 'translateY(-50%)', color: '#666', pointerEvents: 'none' as const },
  filterSelect: {
    padding: '9px 12px', background: '#111111', border: '1px solid #333333',
    borderRadius: 6, color: '#FFFFFF', fontSize: 14, cursor: 'pointer', outline: 'none',
  } as React.CSSProperties,
  // Grid
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 } as React.CSSProperties,
  // Card
  card: (status: string, hover: boolean): React.CSSProperties => ({
    background: '#111111',
    border: `1px solid ${hover ? '#444' : '#222222'}`,
    borderLeft: `4px solid ${statusMeta(status).dot}`,
    borderRadius: 8,
    padding: 20,
    cursor: 'default',
    transition: 'border-color 0.15s, transform 0.1s',
    transform: hover ? 'translateY(-1px)' : 'none',
  }),
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 } as React.CSSProperties,
  cardName: { fontSize: 16, fontWeight: 700, color: '#FFFFFF', lineHeight: 1.3, marginBottom: 4, flex: 1, paddingRight: 8 } as React.CSSProperties,
  badge: (bg: string, color: string, border: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 5,
    padding: '3px 9px', borderRadius: 12, fontSize: 11, fontWeight: 600,
    letterSpacing: '0.04em', background: bg, color, border: `1px solid ${border}`,
    whiteSpace: 'nowrap' as const,
  }),
  cardMeta: { display: 'flex', flexDirection: 'column' as const, gap: 6, marginBottom: 14 } as React.CSSProperties,
  metaRow: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#AAAAAA' } as React.CSSProperties,
  divider: { height: 1, background: '#1E1E1E', margin: '12px 0' } as React.CSSProperties,
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } as React.CSSProperties,
  actionBtn: (danger?: boolean): React.CSSProperties => ({
    padding: '4px 10px', fontSize: 12, fontWeight: 500,
    background: 'transparent',
    border: `1px solid ${danger ? '#5a2a2a' : '#333333'}`,
    color: danger ? '#cc6666' : '#AAAAAA',
    borderRadius: 4, cursor: 'pointer',
  }),
  centerBox: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: '#666' } as React.CSSProperties,
  // Modal
  overlay: {
    position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20,
  },
  modal: {
    background: '#111111', border: '1px solid #333333', borderRadius: 10,
    width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' as const, padding: '28px 32px',
  } as React.CSSProperties,
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#FFFFFF' } as React.CSSProperties,
  fieldGroup: { marginBottom: 16 } as React.CSSProperties,
  label: { display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 5, letterSpacing: '0.08em', textTransform: 'uppercase' as const } as React.CSSProperties,
  input: {
    width: '100%', padding: '9px 12px', background: '#1A1A1A', border: '1px solid #333333',
    borderRadius: 6, color: '#FFFFFF', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  formSelect: {
    width: '100%', padding: '9px 12px', background: '#1A1A1A', border: '1px solid #333333',
    borderRadius: 6, color: '#FFFFFF', fontSize: 14, outline: 'none', cursor: 'pointer',
  } as React.CSSProperties,
  formRow2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } as React.CSSProperties,
  formRow3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 } as React.CSSProperties,
  modalFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 20, borderTop: '1px solid #222' } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  type: string;
  status: string;
  weight: string;
  year: string;
  region_id: string;
  country_id: string;
  metro: string;
  phase_code: string;
}

const emptyForm: FormState = {
  name: '', type: 'Project', status: 'Planning', weight: '1',
  year: String(new Date().getFullYear()), region_id: '', country_id: '', metro: '', phase_code: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [filteredCountries, setFilteredCountries] = useState<Country[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<'true' | 'false' | 'all'>('true');

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Project | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Reference data ────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      refDataApi.regions().catch(() => [] as Region[]),
      refDataApi.countries().catch(() => [] as Country[]),
    ]).then(([r, c]) => { setRegions(r); setCountries(c); });
  }, []);

  // ── Filter countries when region changes ──────────────────────────────────

  useEffect(() => {
    if (form.region_id) {
      setFilteredCountries(countries.filter(c => String(c.region_id) === form.region_id));
    } else {
      setFilteredCountries(countries);
    }
  }, [form.region_id, countries]);

  // ── Load projects ─────────────────────────────────────────────────────────

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await projectsApi.list({ is_active: isActiveFilter, limit: 500 });
      setProjects(data);
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [isActiveFilter]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // ── Client-side filtering ─────────────────────────────────────────────────

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
    if (typeFilter)   list = list.filter(p => p.type === typeFilter);
    return list;
  }, [projects, search, statusFilter, typeFilter]);

  // ── Stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const all = projects;
    return {
      total:     all.length,
      active:    all.filter(p => p.status === 'Active').length,
      planning:  all.filter(p => p.status === 'Planning').length,
      onHold:    all.filter(p => p.status === 'On Hold').length,
      completed: all.filter(p => p.status === 'Completed').length,
    };
  }, [projects]);

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openAdd() {
    setEditTarget(null);
    setForm(emptyForm);
    setNameError('');
    setModalOpen(true);
  }

  function openEdit(p: Project) {
    setEditTarget(p);
    setForm({
      name: p.name,
      type: p.type,
      status: p.status,
      weight: String(p.weight),
      year: p.year ? String(p.year) : '',
      region_id: p.region_id ? String(p.region_id) : '',
      country_id: p.country_id ? String(p.country_id) : '',
      metro: p.metro ?? '',
      phase_code: p.phase_code ?? '',
    });
    setNameError('');
    setModalOpen(true);
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
    if (!form.type)         { return; }
    if (!form.status)       { return; }

    setSaving(true);
    try {
      const body: CreateProjectBody = {
        name: form.name.trim(),
        type: form.type,
        status: form.status,
        weight: parseFloat(form.weight) || 1,
        year: form.year ? parseInt(form.year, 10) : null,
        region_id: form.region_id ? parseInt(form.region_id, 10) : null,
        country_id: form.country_id ? parseInt(form.country_id, 10) : null,
        metro: form.metro.trim() || null,
        phase_code: form.phase_code.trim() || null,
      };
      if (editTarget) {
        await projectsApi.update(editTarget.id, body);
      } else {
        await projectsApi.create(body);
      }
      setModalOpen(false);
      loadProjects();
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await projectsApi.deactivate(deleteTarget.id);
      setDeleteTarget(null);
      loadProjects();
    } finally {
      setDeleting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

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

      {/* Stats */}
      <div style={S.statsRow}>
        {[
          { label: 'Total',     value: stats.total,     color: '#555555' },
          { label: 'Active',    value: stats.active,    color: '#33CC77' },
          { label: 'Planning',  value: stats.planning,  color: '#5599FF' },
          { label: 'On Hold',   value: stats.onHold,    color: '#FFAA33' },
          { label: 'Completed', value: stats.completed, color: '#888888' },
        ].map(({ label, value, color }) => (
          <div key={label} style={S.statCard(color)}>
            <div style={S.statNum}>{loading ? '—' : value}</div>
            <div style={S.statLabel}>{label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={S.searchWrap}>
          <span style={S.searchIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
          </span>
          <input
            style={S.searchInput}
            placeholder="Search projects…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select style={S.filterSelect} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={S.filterSelect} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select style={S.filterSelect} value={isActiveFilter} onChange={e => setIsActiveFilter(e.target.value as typeof isActiveFilter)}>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
          <option value="all">All</option>
        </select>
        {!loading && (
          <span style={{ color: '#666', fontSize: 13 }}>
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
          <span style={{ fontSize: 12, color: '#666' }}>{error}</span>
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

            <div style={S.fieldGroup}>
              <label style={S.label}>Project Name *</label>
              <input
                style={{ ...S.input, borderColor: nameError ? '#E31837' : '#333333' }}
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="Enter project name"
                autoFocus
              />
              {nameError && <span style={{ fontSize: 11, color: '#E31837', display: 'block', marginTop: 3 }}>{nameError}</span>}
            </div>

            <div style={S.formRow2}>
              <div style={S.fieldGroup}>
                <label style={S.label}>Type</label>
                <select style={S.formSelect} value={form.type} onChange={e => setField('type', e.target.value)}>
                  {PROJECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={S.fieldGroup}>
                <label style={S.label}>Status</label>
                <select style={S.formSelect} value={form.status} onChange={e => setField('status', e.target.value)}>
                  {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div style={S.formRow2}>
              <div style={S.fieldGroup}>
                <label style={S.label}>Year</label>
                <input
                  type="number" min="2020" max="2035" style={S.input}
                  value={form.year} onChange={e => setField('year', e.target.value)}
                  placeholder="e.g. 2025"
                />
              </div>
              <div style={S.fieldGroup}>
                <label style={S.label}>Weight / Priority</label>
                <input
                  type="number" min="0.1" max="5" step="0.1" style={S.input}
                  value={form.weight} onChange={e => setField('weight', e.target.value)}
                  placeholder="1.0"
                />
              </div>
            </div>

            <div style={S.fieldGroup}>
              <label style={S.label}>Region</label>
              <select style={S.formSelect} value={form.region_id} onChange={e => setField('region_id', e.target.value)}>
                <option value="">— Select region —</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

            <div style={S.formRow2}>
              <div style={S.fieldGroup}>
                <label style={S.label}>Country</label>
                <select
                  style={{ ...S.formSelect, opacity: filteredCountries.length === 0 ? 0.5 : 1 }}
                  value={form.country_id}
                  onChange={e => setField('country_id', e.target.value)}
                  disabled={filteredCountries.length === 0}
                >
                  <option value="">— Select country —</option>
                  {filteredCountries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={S.fieldGroup}>
                <label style={S.label}>Metro</label>
                <input
                  style={S.input} value={form.metro}
                  onChange={e => setField('metro', e.target.value)}
                  placeholder="e.g. London"
                />
              </div>
            </div>

            <div style={S.fieldGroup}>
              <label style={S.label}>Phase Code</label>
              <input
                style={S.input} value={form.phase_code}
                onChange={e => setField('phase_code', e.target.value)}
                placeholder="e.g. PHASE-1"
              />
            </div>

            <div style={S.modalFooter}>
              <button style={S.btnSecondary} onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button style={S.btnPrimary} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirmation */}
      {deleteTarget && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div style={{ ...S.modal, maxWidth: 420 }}>
            <h2 style={{ ...S.modalTitle, marginBottom: 12 }}>Archive Project</h2>
            <p style={{ color: '#CCCCCC', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Archive <strong style={{ color: '#FFFFFF' }}>{deleteTarget.name}</strong>? It will be hidden from active views but all data and allocations are preserved.
            </p>
            <div style={S.modalFooter}>
              <button style={S.btnSecondary} onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button
                style={{ ...S.btnPrimary, background: '#c41530' }}
                onClick={handleDeactivate}
                disabled={deleting}
              >
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

interface ProjectCardProps {
  project: Project;
  onEdit: () => void;
  onDelete: () => void;
}

function ProjectCard({ project: p, onEdit, onDelete }: ProjectCardProps) {
  const [hover, setHover] = useState(false);
  const meta = statusMeta(p.status);

  // Health indicator: weight drives a bar
  const healthPct = Math.min(100, Math.round((p.weight / 3) * 100));
  const healthColor = p.weight >= 2 ? '#33CC77' : p.weight >= 1 ? '#FFAA33' : '#E31837';

  const location = [p.metro, p.country_name, p.region_name].filter(Boolean).join(', ');

  return (
    <div
      style={S.card(p.status, hover)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Top row: status badge + type badge */}
      <div style={S.cardTop}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <span style={S.badge(meta.bg, meta.color, meta.border)}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, display: 'inline-block' }} />
              {p.status}
            </span>
            <span style={S.badge('#222222', '#AAAAAA', '#333333')}>{p.type}</span>
          </div>
          <div style={S.cardName}>{p.name}</div>
        </div>
      </div>

      {/* Meta */}
      <div style={S.cardMeta}>
        {location && (
          <div style={S.metaRow}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#666">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <span>{location}</span>
          </div>
        )}
        {(p.year || p.phase_code) && (
          <div style={S.metaRow}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#666">
              <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
            </svg>
            <span>
              {[p.year && `FY${p.year}`, p.phase_code].filter(Boolean).join(' · ')}
            </span>
          </div>
        )}
      </div>

      <div style={S.divider} />

      {/* Health indicator + actions */}
      <div style={S.cardFooter}>
        <div style={{ flex: 1, paddingRight: 12 }}>
          <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            Priority weight
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 4, background: '#222', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ width: `${healthPct}%`, height: '100%', background: healthColor, borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 11, color: healthColor, fontWeight: 600, minWidth: 24 }}>{p.weight.toFixed(1)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button style={S.actionBtn()} onClick={onEdit}>Edit</button>
          {p.is_active && (
            <button style={S.actionBtn(true)} onClick={onDelete}>Archive</button>
          )}
        </div>
      </div>
    </div>
  );
}
