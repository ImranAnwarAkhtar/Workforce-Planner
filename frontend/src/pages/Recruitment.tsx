import { useEffect, useState, useMemo, useCallback } from 'react';
import { tbhCodesApi, refDataApi, type TbhCode, type Region, type CreateTbhCodeBody } from '../services/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQ_STATUSES  = ['Open', 'In Progress', 'Offer Extended', 'Filled', 'On Hold', 'Cancelled'];
const HIRE_TYPES    = ['Net New', 'Backfill', 'Conversion', 'Uplift'];

const STATUS_META: Record<string, { color: string; bg: string; border: string }> = {
  'Open':           { color: '#5599FF', bg: '#0D1B2B', border: '#1A3A66' },
  'In Progress':    { color: '#FFAA33', bg: '#2B1E0D', border: '#5E3A1A' },
  'Offer Extended': { color: '#CC77FF', bg: '#1A0D2B', border: '#4A1A66' },
  'Filled':         { color: '#33CC77', bg: '#0D2B1E', border: '#1A5E38' },
  'On Hold':        { color: '#888888', bg: '#1A1A1A', border: '#333333' },
  'Cancelled':      { color: '#E31837', bg: '#2B0D0D', border: '#5E1A1A' },
};

function statusMeta(s: string | null) {
  return STATUS_META[s ?? ''] ?? { color: '#888', bg: '#1A1A1A', border: '#333' };
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const tk = { bg2: '#FFFFFF', border: '#E5E5E5', accent: '#E31837', muted: '#666666' };
const card: React.CSSProperties = { background: tk.bg2, border: `1px solid ${tk.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tk.muted, background: '#F8F9FA', borderBottom: `1px solid ${tk.border}`, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '11px 14px', borderBottom: '1px solid #F0F0F0', verticalAlign: 'middle', fontSize: 14, color: '#333333' };
const inputSt: React.CSSProperties = { width: '100%', padding: '8px 11px', background: '#FFFFFF', border: '1px solid #D5D5D5', borderRadius: 6, color: '#111111', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const selectSt: React.CSSProperties = { ...inputSt, cursor: 'pointer' };
const labelSt: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: tk.muted, marginBottom: 4, letterSpacing: '0.07em', textTransform: 'uppercase' };
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: tk.accent, color: '#FFF', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '8px 16px', background: 'transparent', color: '#555555', border: '1px solid #D5D5D5', borderRadius: 6, fontSize: 14, cursor: 'pointer' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 };
const modalBox: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 10, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', padding: '26px 30px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' };
const modalFooter: React.CSSProperties = { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22, paddingTop: 18, borderTop: '1px solid #EEEEEE' };
const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 };

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  tbh_id: string; old_tbh: string; funding_year: string; hire_type: string;
  region_id: string; project_type: string; legal_entity: string; location_code: string;
  cost_centre: string; job_profile: string; replaced_emp_name: string; manager_name: string;
  target_hire_date: string; jr_id: string; req_status: string; ta_contact: string;
  candidate_name: string; estimated_hire_date: string; ta_status_comments: string;
  tbh_description: string; fp_and_a_notes: string;
}

const emptyForm: FormState = {
  tbh_id: '', old_tbh: '', funding_year: String(new Date().getFullYear()),
  hire_type: 'Net New', region_id: '', project_type: '', legal_entity: '', location_code: '',
  cost_centre: '', job_profile: '', replaced_emp_name: '', manager_name: '',
  target_hire_date: '', jr_id: '', req_status: 'Open', ta_contact: '', candidate_name: '',
  estimated_hire_date: '', ta_status_comments: '', tbh_description: '', fp_and_a_notes: '',
};

function tbhToForm(t: TbhCode): FormState {
  return {
    tbh_id: t.tbh_id, old_tbh: t.old_tbh ?? '', funding_year: t.funding_year ? String(t.funding_year) : '',
    hire_type: t.hire_type ?? 'Net New', region_id: t.region_id ? String(t.region_id) : '',
    project_type: t.project_type ?? '', legal_entity: t.legal_entity ?? '', location_code: t.location_code ?? '',
    cost_centre: t.cost_centre ?? '', job_profile: t.job_profile ?? '', replaced_emp_name: t.replaced_emp_name ?? '',
    manager_name: t.manager_name ?? '', target_hire_date: t.target_hire_date ? t.target_hire_date.slice(0, 10) : '',
    jr_id: t.jr_id ?? '', req_status: t.req_status ?? 'Open', ta_contact: t.ta_contact ?? '',
    candidate_name: t.candidate_name ?? '', estimated_hire_date: t.estimated_hire_date ? t.estimated_hire_date.slice(0, 10) : '',
    ta_status_comments: t.ta_status_comments ?? '', tbh_description: t.tbh_description ?? '', fp_and_a_notes: t.fp_and_a_notes ?? '',
  };
}

// ---------------------------------------------------------------------------
// Pipeline status summary bar
// ---------------------------------------------------------------------------

function PipelineSummary({ data }: { data: TbhCode[] }) {
  const counts: Record<string, number> = {};
  for (const t of data) { const s = t.req_status ?? 'Open'; counts[s] = (counts[s] || 0) + 1; }
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
      {REQ_STATUSES.map(s => {
        const m = statusMeta(s);
        return (
          <div key={s} style={{ padding: '6px 14px', background: m.bg, border: `1px solid ${m.border}`, borderRadius: 6, fontSize: 12, color: m.color, fontWeight: 600 }}>
            {counts[s] ?? 0} {s}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Recruitment() {
  const [tbhCodes, setTbhCodes] = useState<TbhCode[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [yearFilter, setYearFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TbhCode | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [tbhIdError, setTbhIdError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<TbhCode | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { refDataApi.regions().then(setRegions).catch(() => {}); }, []);

  const loadData = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = {
        req_status: statusFilter || undefined,
        funding_year: yearFilter ? parseInt(yearFilter, 10) : undefined,
        limit: 500,
      };
      const data = await tbhCodesApi.list(params);
      setTbhCodes(data);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [statusFilter, yearFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    if (!search.trim()) return tbhCodes;
    const q = search.toLowerCase();
    return tbhCodes.filter(t =>
      t.tbh_id.toLowerCase().includes(q) ||
      (t.job_profile ?? '').toLowerCase().includes(q) ||
      (t.candidate_name ?? '').toLowerCase().includes(q) ||
      (t.manager_name ?? '').toLowerCase().includes(q) ||
      (t.region_name ?? '').toLowerCase().includes(q)
    );
  }, [tbhCodes, search]);

  const years = useMemo(() => {
    const ys = new Set(tbhCodes.map(t => t.funding_year).filter(Boolean) as number[]);
    return Array.from(ys).sort((a, b) => b - a);
  }, [tbhCodes]);

  function openAdd() { setEditTarget(null); setForm(emptyForm); setTbhIdError(''); setModalOpen(true); }
  function openEdit(t: TbhCode) { setEditTarget(t); setForm(tbhToForm(t)); setTbhIdError(''); setModalOpen(true); }

  function sf(k: keyof FormState, v: string) {
    setForm(f => ({ ...f, [k]: v }));
    if (k === 'tbh_id') setTbhIdError('');
  }

  async function handleSave() {
    if (!form.tbh_id.trim()) { setTbhIdError('TBH ID is required'); return; }
    setSaving(true);
    try {
      const body: CreateTbhCodeBody = {
        tbh_id: form.tbh_id.trim(),
        old_tbh: form.old_tbh || null,
        funding_year: form.funding_year ? parseInt(form.funding_year, 10) : null,
        hire_type: form.hire_type || null,
        region_id: form.region_id ? parseInt(form.region_id, 10) : null,
        project_type: form.project_type || null,
        legal_entity: form.legal_entity || null,
        location_code: form.location_code || null,
        cost_centre: form.cost_centre || null,
        job_profile: form.job_profile || null,
        replaced_emp_name: form.replaced_emp_name || null,
        manager_name: form.manager_name || null,
        target_hire_date: form.target_hire_date || null,
        jr_id: form.jr_id || null,
        req_status: form.req_status || null,
        ta_contact: form.ta_contact || null,
        candidate_name: form.candidate_name || null,
        estimated_hire_date: form.estimated_hire_date || null,
        ta_status_comments: form.ta_status_comments || null,
        tbh_description: form.tbh_description || null,
        fp_and_a_notes: form.fp_and_a_notes || null,
      };
      if (editTarget) {
        await tbhCodesApi.update(editTarget.id, body);
      } else {
        await tbhCodesApi.create(body);
      }
      setModalOpen(false);
      loadData();
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try { await tbhCodesApi.delete(deleteTarget.id); setDeleteTarget(null); loadData(); }
    finally { setDeleting(false); }
  }

  return (
    <div style={{ color: '#FFF' }}>
      {/* Page title bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#181A1E', borderRadius: 8, marginBottom: 16, border: '1px solid #2A2C32', padding: '8px 16px' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>Recruitment Pipeline</div>
          <div style={{ width: 24, height: 2, background: '#E31837', borderRadius: 1, marginTop: 4 }} />
        </div>
        <button style={btnPrimary} onClick={openAdd}>+ Add TBH Code</button>
      </div>

      {/* Pipeline summary */}
      {!loading && <PipelineSummary data={tbhCodes} />}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inputSt, flex: '1 1 200px', maxWidth: 280 }} placeholder="Search TBH ID, role, candidate, manager…" value={search} onChange={e => setSearch(e.target.value)} />
        <select style={{ ...selectSt, width: 'auto', minWidth: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          {REQ_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select style={{ ...selectSt, width: 'auto', minWidth: 120 }} value={yearFilter} onChange={e => setYearFilter(e.target.value)}>
          <option value="">All years</option>
          {years.map(y => <option key={y} value={y}>FY{y}</option>)}
        </select>
        {!loading && <span style={{ color: '#555', fontSize: 13 }}>{filtered.length} records</span>}
      </div>

      {/* Table */}
      <div style={card}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 40, color: tk.accent }}>
            {error} <button style={{ ...btnSecondary, marginLeft: 12 }} onClick={loadData}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#555' }}>No TBH codes found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['TBH ID', 'Job Profile', 'Region', 'Hire Type', 'Status', 'Target Date', 'Candidate', 'Manager', ''].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => {
                const m = statusMeta(t.req_status);
                return (
                  <tr key={t.id} style={{ background: 'transparent' }}>
                    <td style={td}>
                      <div style={{ fontWeight: 600, color: '#FFF' }}>{t.tbh_id}</div>
                      {t.funding_year && <div style={{ fontSize: 11, color: '#555' }}>FY{t.funding_year}</div>}
                    </td>
                    <td style={td}><span style={{ color: '#CCC' }}>{t.job_profile ?? '—'}</span></td>
                    <td style={td}><span style={{ color: '#AAA', fontSize: 13 }}>{t.region_name ?? '—'}</span></td>
                    <td style={td}><span style={{ color: '#888', fontSize: 12 }}>{t.hire_type ?? '—'}</span></td>
                    <td style={td}>
                      <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: m.bg, color: m.color, border: `1px solid ${m.border}` }}>
                        {t.req_status ?? 'Unknown'}
                      </span>
                    </td>
                    <td style={td}><span style={{ color: '#AAA', fontSize: 13 }}>{t.target_hire_date ? new Date(t.target_hire_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</span></td>
                    <td style={td}><span style={{ color: t.candidate_name ? '#CCC' : '#444' }}>{t.candidate_name ?? '—'}</span></td>
                    <td style={td}><span style={{ color: '#888', fontSize: 13 }}>{t.manager_name ?? '—'}</span></td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => openEdit(t)} style={{ padding: '3px 9px', fontSize: 12, background: 'transparent', border: '1px solid #333', color: '#AAA', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => setDeleteTarget(t)} style={{ padding: '3px 9px', fontSize: 12, background: 'transparent', border: '1px solid #5a2a2a', color: '#cc6666', borderRadius: 4, cursor: 'pointer' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div style={modalBox}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18, color: '#FFF' }}>{editTarget ? 'Edit TBH Code' : 'Add TBH Code'}</h2>

            <div style={row2}>
              <div>
                <label style={labelSt}>TBH ID *</label>
                <input style={{ ...inputSt, borderColor: tbhIdError ? tk.accent : '#333' }} value={form.tbh_id} onChange={e => sf('tbh_id', e.target.value)} placeholder="e.g. TBH-2025-001" autoFocus />
                {tbhIdError && <span style={{ fontSize: 11, color: tk.accent, marginTop: 2, display: 'block' }}>{tbhIdError}</span>}
              </div>
              <div>
                <label style={labelSt}>Old TBH ID</label>
                <input style={inputSt} value={form.old_tbh} onChange={e => sf('old_tbh', e.target.value)} placeholder="Optional" />
              </div>
            </div>

            <div style={row2}>
              <div>
                <label style={labelSt}>Funding Year</label>
                <input type="number" min="2020" max="2035" style={inputSt} value={form.funding_year} onChange={e => sf('funding_year', e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>Hire Type</label>
                <select style={selectSt} value={form.hire_type} onChange={e => sf('hire_type', e.target.value)}>
                  {HIRE_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
            </div>

            <div style={row2}>
              <div>
                <label style={labelSt}>Status</label>
                <select style={selectSt} value={form.req_status} onChange={e => sf('req_status', e.target.value)}>
                  {REQ_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Region</label>
                <select style={selectSt} value={form.region_id} onChange={e => sf('region_id', e.target.value)}>
                  <option value="">— Select —</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Job Profile</label>
              <input style={inputSt} value={form.job_profile} onChange={e => sf('job_profile', e.target.value)} placeholder="e.g. Senior Network Engineer" />
            </div>

            <div style={row2}>
              <div>
                <label style={labelSt}>Manager</label>
                <input style={inputSt} value={form.manager_name} onChange={e => sf('manager_name', e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>TA Contact</label>
                <input style={inputSt} value={form.ta_contact} onChange={e => sf('ta_contact', e.target.value)} />
              </div>
            </div>

            <div style={row2}>
              <div>
                <label style={labelSt}>Target Hire Date</label>
                <input type="date" style={inputSt} value={form.target_hire_date} onChange={e => sf('target_hire_date', e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>Estimated Hire Date</label>
                <input type="date" style={inputSt} value={form.estimated_hire_date} onChange={e => sf('estimated_hire_date', e.target.value)} />
              </div>
            </div>

            <div style={row2}>
              <div>
                <label style={labelSt}>Candidate Name</label>
                <input style={inputSt} value={form.candidate_name} onChange={e => sf('candidate_name', e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>JR ID (Workday)</label>
                <input style={inputSt} value={form.jr_id} onChange={e => sf('jr_id', e.target.value)} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>TA Status Comments</label>
              <textarea style={{ ...inputSt, height: 60, resize: 'vertical' as const }} value={form.ta_status_comments} onChange={e => sf('ta_status_comments', e.target.value)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelSt}>Cost Centre</label>
                <input style={inputSt} value={form.cost_centre} onChange={e => sf('cost_centre', e.target.value)} />
              </div>
              <div>
                <label style={labelSt}>Legal Entity</label>
                <input style={inputSt} value={form.legal_entity} onChange={e => sf('legal_entity', e.target.value)} />
              </div>
            </div>

            <div style={modalFooter}>
              <button style={btnSecondary} onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button style={btnPrimary} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add TBH Code'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div style={{ ...modalBox, maxWidth: 380 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, color: '#FFF' }}>Delete TBH Code</h2>
            <p style={{ color: '#CCC', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Permanently delete <strong style={{ color: '#FFF' }}>{deleteTarget.tbh_id}</strong>? This action cannot be undone.
            </p>
            <div style={modalFooter}>
              <button style={btnSecondary} onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button style={{ ...btnPrimary, background: '#c41530' }} onClick={handleDelete} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
