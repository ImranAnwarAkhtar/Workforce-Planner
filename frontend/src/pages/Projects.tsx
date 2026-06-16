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
const STATUS_ORDER     = { Approved: 0, Seeded: 1, Proposed: 2 } as const;
const COL_W            = 120; // column / card width in px

type ProjectType   = typeof PROJECT_TYPES[number];
type ProjectStatus = typeof PROJECT_STATUSES[number];

const STATUS_META: Record<string, { color: string; bg: string; border: string; dot: string }> = {
  'Approved': { color: '#1E8A4A', bg: '#E8F5EE', border: '#A8D8BF', dot: '#1E8A4A' },
  'Seeded':   { color: '#B5600A', bg: '#FFF3DC', border: '#F0C060', dot: '#D4870A' },
  'Proposed': { color: '#1D4EBB', bg: '#EBF0FF', border: '#BDD0FF', dot: '#4477EE' },
};

const TYPE_META: Record<ProjectType, { color: string; bg: string; border: string }> = {
  Retail:  { color: '#1565C0', bg: '#E3F2FD', border: '#90CAF9' },
  xScale:  { color: '#6A1B9A', bg: '#F3E5F7', border: '#CE93D8' },
  Matrix:  { color: '#006064', bg: '#E0F5F6', border: '#80CBC4' },
};

function statusMeta(s: string) {
  return STATUS_META[s] ?? { color: '#888888', bg: '#F5F5F5', border: '#DDDDDD', dot: '#AAAAAA' };
}
function typeMeta(t: string) {
  return TYPE_META[t as ProjectType] ?? { color: '#555555', bg: '#F0F0F0', border: '#D5D5D5' };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S = {
  page:        { color: '#111111', height: '100%', display: 'flex', flexDirection: 'column' } as React.CSSProperties,
  header:      { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 } as React.CSSProperties,
  title:       { fontSize: 24, fontWeight: 700, margin: 0, color: '#111111' } as React.CSSProperties,
  accent:      { width: 40, height: 3, background: '#E31837', borderRadius: 2, marginTop: 6 } as React.CSSProperties,
  btnPrimary:  { padding: '9px 18px', background: '#E31837', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' as const, flexShrink: 0 } as React.CSSProperties,
  btnSecondary:{ padding: '9px 18px', background: 'transparent', color: '#555555', border: '1px solid #D5D5D5', borderRadius: 6, fontSize: 14, cursor: 'pointer' } as React.CSSProperties,

  statsRow:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, marginBottom: 20 } as React.CSSProperties,
  statCard:    (accent: string) => ({ background: '#FFFFFF', border: '1px solid #E5E5E5', borderTop: `3px solid ${accent}`, borderRadius: 8, padding: '12px 14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' } as React.CSSProperties),
  statNum:     { fontSize: 22, fontWeight: 700, color: '#111111', lineHeight: 1 } as React.CSSProperties,
  statLabel:   { fontSize: 10, color: '#888888', marginTop: 4, textTransform: 'uppercase' as const, letterSpacing: '0.06em' } as React.CSSProperties,

  toolbar:     { display: 'flex', gap: 7, marginBottom: 16, flexWrap: 'wrap' as const, alignItems: 'center' } as React.CSSProperties,
  searchWrap:  { position: 'relative' as const, flex: '1 1 160px', maxWidth: 220 } as React.CSSProperties,
  searchInput: { width: '100%', padding: '6px 10px 6px 28px', background: '#FFFFFF', border: '1px solid #D5D5D5', borderRadius: 6, color: '#111111', fontSize: 12, outline: 'none' } as React.CSSProperties,
  searchIcon:  { position: 'absolute' as const, left: 8, top: '50%', transform: 'translateY(-50%)', color: '#999', pointerEvents: 'none' as const },
  filterSel:   { padding: '6px 8px', background: '#FFFFFF', border: '1px solid #D5D5D5', borderRadius: 6, color: '#111111', fontSize: 12, cursor: 'pointer', outline: 'none' } as React.CSSProperties,

  centerBox:   { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', color: '#999' } as React.CSSProperties,

  overlay:     { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 },
  modal:       { background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 10, width: '100%', maxWidth: 540, maxHeight: '90vh', overflowY: 'auto' as const, padding: '28px 32px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' } as React.CSSProperties,
  modalTitle:  { fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#111111' } as React.CSSProperties,
  fg:          { marginBottom: 16 } as React.CSSProperties,
  lbl:         { display: 'block', fontSize: 11, fontWeight: 700, color: '#666666', marginBottom: 5, letterSpacing: '0.08em', textTransform: 'uppercase' as const } as React.CSSProperties,
  inp:         { width: '100%', padding: '9px 12px', background: '#FFFFFF', border: '1px solid #D5D5D5', borderRadius: 6, color: '#111111', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const } as React.CSSProperties,
  sel:         { width: '100%', padding: '9px 12px', background: '#FFFFFF', border: '1px solid #D5D5D5', borderRadius: 6, color: '#111111', fontSize: 14, outline: 'none', cursor: 'pointer', boxSizing: 'border-box' as const } as React.CSSProperties,
  row2:        { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } as React.CSSProperties,
  row3:        { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 } as React.CSSProperties,
  mFooter:     { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 20, borderTop: '1px solid #EEEEEE' } as React.CSSProperties,

  badge: (bg: string, color: string, border: string): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600,
    letterSpacing: '0.03em', background: bg, color, border: `1px solid ${border}`,
    whiteSpace: 'nowrap' as const,
  }),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function groupByCountry(projects: Project[]): [string, Project[]][] {
  const map = new Map<string, Project[]>();
  for (const p of projects) {
    const key = p.country_name ?? 'Unassigned';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  map.forEach(list => {
    list.sort((a, b) => {
      const sd = (STATUS_ORDER[a.status as keyof typeof STATUS_ORDER] ?? 9)
               - (STATUS_ORDER[b.status as keyof typeof STATUS_ORDER] ?? 9);
      return sd !== 0 ? sd : a.name.localeCompare(b.name);
    });
  });
  return Array.from(map.entries()).sort(([a], [b]) => {
    if (a === 'Unassigned') return 1;
    if (b === 'Unassigned') return -1;
    return a.localeCompare(b);
  });
}

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
  const [search,         setSearch]         = useState('');
  const [statusFilter,   setStatusFilter]   = useState('');
  const [typeFilter,     setTypeFilter]     = useState('');
  const [regionFilter,   setRegionFilter]   = useState('');
  const [countryFilter,  setCountryFilter]  = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState<'true' | 'false' | 'all'>('true');

  const [modalOpen,    setModalOpen]    = useState(false);
  const [editTarget,   setEditTarget]   = useState<Project | null>(null);
  const [form,         setForm]         = useState<FormState>(emptyForm);
  const [nameError,    setNameError]    = useState('');
  const [saving,       setSaving]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  useEffect(() => {
    Promise.all([
      refDataApi.regions().catch(() => [] as Region[]),
      refDataApi.countries().catch(() => [] as Country[]),
    ]).then(([r, c]) => { setRegions(r); setCountries(c); });
  }, []);

  useEffect(() => {
    setFilteredCountries(
      form.region_id
        ? countries.filter(c => String(c.region_id) === form.region_id)
        : countries
    );
  }, [form.region_id, countries]);

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

  const allRegions = useMemo(() => {
    const names = Array.from(new Set(projects.map(p => p.region_name ?? '').filter(Boolean)));
    return names.sort();
  }, [projects]);

  const allCountries = useMemo(() => {
    const source = regionFilter
      ? projects.filter(p => (p.region_name ?? '') === regionFilter)
      : projects;
    const names = Array.from(new Set(source.map(p => p.country_name ?? 'Unassigned')));
    return names.sort((a, b) => {
      if (a === 'Unassigned') return 1;
      if (b === 'Unassigned') return -1;
      return a.localeCompare(b);
    });
  }, [projects, regionFilter]);

  const filtered = useMemo(() => {
    let list = projects;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.region_name   ?? '').toLowerCase().includes(q) ||
        (p.country_name  ?? '').toLowerCase().includes(q) ||
        (p.phase_code    ?? '').toLowerCase().includes(q) ||
        (p.metro         ?? '').toLowerCase().includes(q)
      );
    }
    if (statusFilter)  list = list.filter(p => p.status === statusFilter);
    if (typeFilter)    list = list.filter(p => p.type   === typeFilter);
    if (regionFilter)  list = list.filter(p => (p.region_name ?? '') === regionFilter);
    if (countryFilter) list = list.filter(p => (p.country_name ?? 'Unassigned') === countryFilter);
    return list;
  }, [projects, search, statusFilter, typeFilter, regionFilter, countryFilter]);

  // Country groups and derived matrix for the aligned-row layout
  const countryGroups = useMemo(() => groupByCountry(filtered), [filtered]);
  const countriesList = useMemo(() => countryGroups.map(([c]) => c), [countryGroups]);

  // projectMatrix[country][status] = sorted Project[]
  const projectMatrix = useMemo(() => {
    const m: Record<string, Record<string, Project[]>> = {};
    for (const [country, projs] of countryGroups) {
      m[country] = {
        Approved: projs.filter(p => p.status === 'Approved'),
        Seeded:   projs.filter(p => p.status === 'Seeded'),
        Proposed: projs.filter(p => p.status === 'Proposed'),
      };
    }
    return m;
  }, [countryGroups]);

  // Per-country summary stats
  const countryStats = useMemo(() => {
    const s: Record<string, { total: number; retail: number; xscale: number; matrix: number; weight: number }> = {};
    for (const [country, projs] of countryGroups) {
      s[country] = {
        total:  projs.length,
        retail: projs.filter(p => p.type === 'Retail').length,
        xscale: projs.filter(p => p.type === 'xScale').length,
        matrix: projs.filter(p => p.type === 'Matrix').length,
        weight: projs.reduce((sum, p) => sum + (Number(p.weight) || 1), 0),
      };
    }
    return s;
  }, [countryGroups]);

  const stats = useMemo(() => {
    const all = projects;
    return {
      total:       all.length,
      approved:    all.filter(p => p.status === 'Approved').length,
      seeded:      all.filter(p => p.status === 'Seeded').length,
      proposed:    all.filter(p => p.status === 'Proposed').length,
      retail:      all.filter(p => p.type === 'Retail').length,
      xscale:      all.filter(p => p.type === 'xScale').length,
      totalWeight: all.reduce((s, p) => s + (Number(p.weight) || 1), 0),
    };
  }, [projects]);

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
      metro:      p.metro      ?? '',
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
    { label: 'Total',        value: stats.total,                  color: '#555555' },
    { label: 'Approved',     value: stats.approved,               color: '#1E8A4A' },
    { label: 'Seeded',       value: stats.seeded,                 color: '#D4870A' },
    { label: 'Proposed',     value: stats.proposed,               color: '#4477EE' },
    { label: 'Retail',       value: stats.retail,                 color: '#1565C0' },
    { label: 'xScale',       value: stats.xscale,                 color: '#6A1B9A' },
    { label: 'Total Weight', value: stats.totalWeight.toFixed(1), color: '#E31837' },
  ];

  return (
    <div style={S.page}>

      {/* ── Fixed top section ── */}
      <div style={{ flexShrink: 0 }}>

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

          <select style={S.filterSel} value={regionFilter} onChange={e => { setRegionFilter(e.target.value); setCountryFilter(''); }}>
            <option value="">All regions</option>
            {allRegions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          <select style={S.filterSel} value={countryFilter} onChange={e => setCountryFilter(e.target.value)}>
            <option value="">All countries</option>
            {allCountries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

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
            <span style={{ color: '#666666', fontSize: 12, whiteSpace: 'nowrap' }}>
              {filtered.length} {filtered.length === 1 ? 'project' : 'projects'} · {countriesList.length} {countriesList.length === 1 ? 'country' : 'countries'}
            </span>
          )}

          {(search || statusFilter || typeFilter || regionFilter || countryFilter) && (
            <button
              style={{ ...S.btnSecondary, fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' as const }}
              onClick={() => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setRegionFilter(''); setCountryFilter(''); }}
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable grid section — fills remaining height, scrollbar stays at bottom ── */}
      <div style={{ flex: 1, overflow: 'auto', minHeight: 0, paddingBottom: 12 }}>
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
            <span style={{ color: '#666' }}>No projects found</span>
          </div>
        ) : (
        /* ── Row-aligned grid: rows = status, columns = country ── */
        <div style={{ minWidth: 'max-content' }}>

            {/* Country header row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {countriesList.map(country => {
                const cs = countryStats[country];
                return (
                  <div key={country} style={{ width: COL_W, flexShrink: 0 }}>
                    <div style={{
                      background: '#FFFFFF',
                      border: '1px solid #E0E0E0',
                      borderTop: '3px solid #E31837',
                      borderRadius: 8,
                      padding: '9px 11px 8px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#111111', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {country}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#666666', marginBottom: 5 }}>
                        <span><strong style={{ color: '#111111' }}>{cs.total}</strong> projects</span>
                        <span>Wt: <strong style={{ color: '#E31837' }}>{cs.weight.toFixed(1)}</strong></span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {cs.retail > 0 && (
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#E3F2FD', color: '#1565C0', border: '1px solid #90CAF9', fontWeight: 600 }}>
                            {cs.retail} Retail
                          </span>
                        )}
                        {cs.xscale > 0 && (
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#F3E5F7', color: '#6A1B9A', border: '1px solid #CE93D8', fontWeight: 600 }}>
                            {cs.xscale} xScale
                          </span>
                        )}
                        {cs.matrix > 0 && (
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#E0F5F6', color: '#006064', border: '1px solid #80CBC4', fontWeight: 600 }}>
                            {cs.matrix} Matrix
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Status rows — Approved, then Seeded, then Proposed */}
            {PROJECT_STATUSES.map(status => {
              const sm           = statusMeta(status);
              const statusTotal  = filtered.filter(p => p.status === status).length;
              if (statusTotal === 0) return null;

              return (
                <div key={status} style={{ marginBottom: 20 }}>

                  {/* Status row label */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 8, padding: '6px 12px',
                    background: sm.bg, border: `1px solid ${sm.border}`,
                    borderRadius: 6,
                  }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: sm.dot, display: 'inline-block', flexShrink: 0 }} />
                    <span style={{ fontSize: 11, fontWeight: 700, color: sm.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      {status}
                    </span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: '#FFFFFF',
                      background: sm.color, padding: '0px 6px', borderRadius: 8,
                      lineHeight: '18px',
                    }}>
                      {statusTotal}
                    </span>
                  </div>

                  {/* One cell per country, aligned in columns */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    {countriesList.map(country => {
                      const cards = projectMatrix[country]?.[status] ?? [];
                      return (
                        <div
                          key={country}
                          style={{ width: COL_W, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 7 }}
                        >
                          {cards.map(p => (
                            <ProjectCard
                              key={p.id}
                              project={p}
                              onClick={() => openEdit(p)}
                            />
                          ))}
                          {/* Empty placeholder preserves column width alignment */}
                          {cards.length === 0 && (
                            <div style={{
                              height: 36,
                              border: '1px dashed #E4E4E4',
                              borderRadius: 6,
                              background: '#FAFAFA',
                            }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div style={S.modal}>
            <h2 style={S.modalTitle}>{editTarget ? 'Edit Project' : 'Add Project'}</h2>

            <div style={S.fg}>
              <label style={S.lbl}>Project Name *</label>
              <input
                style={{ ...S.inp, borderColor: nameError ? '#E31837' : '#D5D5D5' }}
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="Enter project name"
                autoFocus
              />
              {nameError && <span style={{ fontSize: 11, color: '#E31837', display: 'block', marginTop: 3 }}>{nameError}</span>}
            </div>

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

            <div style={S.fg}>
              <label style={S.lbl}>Year</label>
              <input
                type="number" min="2020" max="2035" style={S.inp}
                value={form.year}
                onChange={e => setField('year', e.target.value)}
                placeholder="e.g. 2026"
              />
            </div>

            <div style={S.fg}>
              <label style={S.lbl}>Region</label>
              <select style={S.sel} value={form.region_id} onChange={e => setField('region_id', e.target.value)}>
                <option value="">— Select region —</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>

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

            <div style={S.fg}>
              <label style={S.lbl}>Phase Code</label>
              <input
                style={S.inp} value={form.phase_code}
                onChange={e => setField('phase_code', e.target.value)}
                placeholder="e.g. PHASE-1"
              />
            </div>

            <div style={S.mFooter}>
              {editTarget && editTarget.is_active && (
                <button
                  style={{ ...S.btnSecondary, color: '#C0392B', borderColor: '#F5C0BB', marginRight: 'auto' }}
                  onClick={() => { setModalOpen(false); setDeleteTarget(editTarget); }}
                  disabled={saving}
                >
                  Archive
                </button>
              )}
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
            <p style={{ color: '#555555', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Archive <strong style={{ color: '#111111' }}>{deleteTarget.name}</strong>? It will be hidden from active views but all data and allocations are preserved.
            </p>
            <div style={S.mFooter}>
              <button style={S.btnSecondary} onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button style={{ ...S.btnPrimary, background: '#C0392B' }} onClick={handleDeactivate} disabled={deleting}>
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

function ProjectCard({ project: p, onClick }: { project: Project; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  const tm     = typeMeta(p.type);
  const weight = Number(p.weight) || 1;
  const meta   = [p.metro, p.phase_code].filter(Boolean).join(' · ');

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title="Click to edit"
      style={{
        background: hover ? '#FAFAFA' : '#FFFFFF',
        border: `1px solid ${hover ? '#BBBBBB' : '#E4E4E4'}`,
        borderLeft: `3px solid ${tm.color}`,
        borderRadius: 6,
        padding: '7px 9px 6px',
        boxShadow: hover ? '0 2px 6px rgba(0,0,0,0.10)' : '0 1px 2px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.12s, border-color 0.12s, background 0.12s',
        cursor: 'pointer',
        width: '100%',
        boxSizing: 'border-box' as const,
      }}
    >
      {/* Type badge + weight */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ ...S.badge(tm.bg, tm.color, tm.border), fontSize: 9, padding: '1px 5px' }}>{p.type}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: tm.color, lineHeight: 1 }}>
          {weight.toFixed(1)}
        </span>
      </div>

      {/* Project name */}
      <div style={{ fontSize: 11, fontWeight: 700, color: '#111111', lineHeight: 1.35, marginBottom: 4, wordBreak: 'break-word' as const }}>
        {p.name}
      </div>

      {/* Meta — compact single line */}
      {(meta || p.year) && (
        <div style={{ fontSize: 9, color: '#AAAAAA', display: 'flex', gap: 6, flexWrap: 'wrap' as const }}>
          {p.year && <span>FY{p.year}</span>}
          {meta && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1, minWidth: 0 }}>{meta}</span>}
        </div>
      )}
    </div>
  );
}
