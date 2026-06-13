import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  allocationsApi, peopleApi, projectsApi,
  type Allocation, type Person, type Project,
  type UpsertAllocationBody,
} from '../services/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toMonthISO(ym: string) { return `${ym}-01`; }

function fmtYM(ym: string): string {
  const [y, m] = ym.split('-');
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function stepMonth(ym: string, delta: number): string {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const tk = { bg2: '#111111', border: '#222222', accent: '#E31837', muted: '#888888' };

const card: React.CSSProperties = { background: tk.bg2, border: `1px solid ${tk.border}`, borderRadius: 8 };

const th: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase', color: tk.muted,
  background: '#0D0D0D', borderBottom: `1px solid ${tk.border}`, whiteSpace: 'nowrap',
};
const td: React.CSSProperties = { padding: '11px 14px', borderBottom: '1px solid #1A1A1A', verticalAlign: 'middle', fontSize: 14 };

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', background: tk.accent, color: '#FFF', border: 'none',
  borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
};
const btnSecondary: React.CSSProperties = {
  padding: '8px 16px', background: 'transparent', color: '#CCC',
  border: '1px solid #333', borderRadius: 6, fontSize: 14, cursor: 'pointer',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 11px', background: '#1A1A1A', border: '1px solid #333',
  borderRadius: 6, color: '#FFF', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };
const label: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, color: tk.muted,
  marginBottom: 5, letterSpacing: '0.07em', textTransform: 'uppercase',
};
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20,
};
const modalBox: React.CSSProperties = {
  background: tk.bg2, border: '1px solid #333', borderRadius: 10,
  width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto', padding: '26px 30px',
};
const modalFooter: React.CSSProperties = {
  display: 'flex', gap: 10, justifyContent: 'flex-end',
  marginTop: 22, paddingTop: 18, borderTop: '1px solid #222',
};

// ---------------------------------------------------------------------------
// FTE bar
// ---------------------------------------------------------------------------

function FteBar({ value, total, contracted }: { value: number; total: number; contracted: number }) {
  const pct = Math.min(100, Math.round((value / (contracted || 1)) * 100));
  const over = total > (contracted || 1) + 0.01;
  const color = over ? '#E31837' : value >= (contracted || 1) - 0.01 ? '#33CC77' : '#FFAA33';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 56, height: 5, background: '#222', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 13, fontWeight: 600, color }}>{value.toFixed(2)}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FormState { person_id: string; project_id: string; fte_value: string; is_billable: boolean }
const emptyForm: FormState = { person_id: '', project_id: '', fte_value: '1', is_billable: true };

export default function Allocations() {
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);

  const [month, setMonth] = useState(currentYM);
  const [personSearch, setPersonSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [showFlagged, setShowFlagged] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Allocation | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Allocation | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reference data
  useEffect(() => {
    peopleApi.list({ is_active: 'true', limit: 500 }).then(setPeople).catch(() => {});
    projectsApi.list({ is_active: 'true', limit: 500 }).then(setProjects).catch(() => {});
  }, []);

  // Allocations for selected month
  const loadAllocations = useCallback(async () => {
    setLoading(true); setError(null);
    const iso = toMonthISO(month);
    try {
      const data = await allocationsApi.list({ month_from: iso, month_to: iso, limit: 500 });
      setAllocations(data);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [month]);

  useEffect(() => { loadAllocations(); }, [loadAllocations]);

  // Person map for FTE lookup
  const personMap = useMemo(() => {
    const m: Record<number, Person> = {};
    for (const p of people) m[p.id] = p;
    return m;
  }, [people]);

  // Per-person FTE totals for this month view
  const personTotals = useMemo(() => {
    const t: Record<number, number> = {};
    for (const a of allocations) t[a.person_id] = (t[a.person_id] || 0) + a.fte_value;
    return t;
  }, [allocations]);

  function isOver(pid: number) {
    return (personTotals[pid] || 0) > ((personMap[pid]?.contracted_fte ?? 1) + 0.01);
  }

  // Filtered list
  const filtered = useMemo(() => {
    let list = allocations;
    if (personSearch.trim()) {
      const q = personSearch.toLowerCase();
      list = list.filter(a => a.person_name.toLowerCase().includes(q));
    }
    if (projectSearch.trim()) {
      const q = projectSearch.toLowerCase();
      list = list.filter(a => a.project_name.toLowerCase().includes(q));
    }
    if (showFlagged) list = list.filter(a => a.flagged_for_review);
    return list;
  }, [allocations, personSearch, projectSearch, showFlagged]);

  // Overallocation count
  const overallocatedCount = useMemo(() => {
    const pids = new Set<number>();
    for (const [pidStr, total] of Object.entries(personTotals)) {
      const pid = Number(pidStr);
      if (total > (personMap[pid]?.contracted_fte ?? 1) + 0.01) pids.add(pid);
    }
    return pids.size;
  }, [personTotals, personMap]);

  function openAdd() {
    setEditTarget(null);
    setForm({ ...emptyForm, project_id: '' });
    setModalOpen(true);
  }

  function openEdit(a: Allocation) {
    setEditTarget(a);
    setForm({ person_id: String(a.person_id), project_id: String(a.project_id), fte_value: String(a.fte_value), is_billable: a.is_billable });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.person_id || !form.project_id) return;
    setSaving(true);
    try {
      const body: UpsertAllocationBody = {
        person_id: parseInt(form.person_id, 10),
        project_id: parseInt(form.project_id, 10),
        month: toMonthISO(month),
        fte_value: Math.max(0, parseFloat(form.fte_value) || 0),
        is_billable: form.is_billable,
      };
      if (editTarget) {
        await allocationsApi.update(editTarget.id, { fte_value: body.fte_value, is_billable: body.is_billable });
      } else {
        await allocationsApi.upsert(body);
      }
      setModalOpen(false);
      loadAllocations();
    } finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await allocationsApi.delete(deleteTarget.id);
      setDeleteTarget(null);
      loadAllocations();
    } finally { setDeleting(false); }
  }

  async function toggleFlag(a: Allocation) {
    await allocationsApi.update(a.id, {
      flagged_for_review: !a.flagged_for_review,
      flag_reason: a.flagged_for_review ? null : 'Flagged for review',
    });
    loadAllocations();
  }

  return (
    <div style={{ color: '#FFF' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Allocations</h1>
          <div style={{ width: 40, height: 3, background: tk.accent, borderRadius: 2, marginTop: 6 }} />
        </div>
        <button style={btnPrimary} onClick={openAdd}>+ Add Allocation</button>
      </div>

      {/* Month navigator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button onClick={() => setMonth(m => stepMonth(m, -1))} style={{ ...btnSecondary, padding: '6px 12px', fontSize: 16 }}>‹</button>
        <div style={{ fontSize: 16, fontWeight: 700, minWidth: 160, textAlign: 'center' }}>{fmtYM(month)}</div>
        <button onClick={() => setMonth(m => stepMonth(m, 1))} style={{ ...btnSecondary, padding: '6px 12px', fontSize: 16 }}>›</button>
        <button onClick={() => setMonth(currentYM())} style={{ ...btnSecondary, padding: '5px 10px', fontSize: 12 }}>Today</button>
        {overallocatedCount > 0 && (
          <div style={{ marginLeft: 8, padding: '4px 12px', background: '#3a1a1a', border: '1px solid #5a2a2a', borderRadius: 6, fontSize: 12, color: '#E31837', fontWeight: 600 }}>
            ⚠ {overallocatedCount} person{overallocatedCount > 1 ? 's' : ''} overallocated
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input style={{ ...inputStyle, flex: '1 1 180px', maxWidth: 240 }} placeholder="Filter by person…" value={personSearch} onChange={e => setPersonSearch(e.target.value)} />
        <input style={{ ...inputStyle, flex: '1 1 180px', maxWidth: 240 }} placeholder="Filter by project…" value={projectSearch} onChange={e => setProjectSearch(e.target.value)} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#CCC', cursor: 'pointer' }}>
          <input type="checkbox" checked={showFlagged} onChange={e => setShowFlagged(e.target.checked)} />
          Flagged only
        </label>
        {!loading && <span style={{ color: '#555', fontSize: 13 }}>{filtered.length} allocations</span>}
      </div>

      {/* Table */}
      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#E31837' }}>
            {error} <button style={{ ...btnSecondary, marginLeft: 12 }} onClick={loadAllocations}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#555' }}>No allocations for this period</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['Person', 'Project', 'Type', 'FTE Allocation', 'Billable', 'Review', ''].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const contracted = personMap[a.person_id]?.contracted_fte ?? 1;
                const total = personTotals[a.person_id] ?? 0;
                const over = isOver(a.person_id);
                return (
                  <tr key={a.id} style={{ background: a.flagged_for_review ? '#1f1200' : 'transparent' }}>
                    <td style={td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {over && <span title="Overallocated" style={{ color: '#E31837', fontSize: 14, lineHeight: 1 }}>⚠</span>}
                        <div>
                          <div style={{ fontWeight: 500, color: over ? '#ffaaaa' : '#FFF' }}>{a.person_name}</div>
                          {over && <div style={{ fontSize: 11, color: '#E31837' }}>Total: {total.toFixed(2)} / {contracted.toFixed(2)}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={td}><span style={{ color: '#CCC' }}>{a.project_name}</span></td>
                    <td style={td}>
                      {a.project_type && (
                        <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: '#222', color: '#888', border: '1px solid #333' }}>
                          {a.project_type}
                        </span>
                      )}
                    </td>
                    <td style={td}>
                      <FteBar value={a.fte_value} total={total} contracted={contracted} />
                    </td>
                    <td style={td}>
                      <span style={{ fontSize: 12, color: a.is_billable ? '#33CC77' : '#888' }}>
                        {a.is_billable ? 'Billable' : 'Non-billable'}
                      </span>
                    </td>
                    <td style={td}>
                      {a.flagged_for_review ? (
                        <span style={{ fontSize: 11, color: '#FFAA33', fontWeight: 600 }}>🚩 Flagged</span>
                      ) : (
                        <span style={{ color: '#444', fontSize: 12 }}>—</span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => openEdit(a)} style={{ padding: '3px 9px', fontSize: 12, background: 'transparent', border: '1px solid #333', color: '#AAA', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => toggleFlag(a)} style={{ padding: '3px 9px', fontSize: 12, background: 'transparent', border: '1px solid #333', color: a.flagged_for_review ? '#FFAA33' : '#666', borderRadius: 4, cursor: 'pointer' }}>
                          {a.flagged_for_review ? 'Unflag' : 'Flag'}
                        </button>
                        <button onClick={() => setDeleteTarget(a)} style={{ padding: '3px 9px', fontSize: 12, background: 'transparent', border: '1px solid #5a2a2a', color: '#cc6666', borderRadius: 4, cursor: 'pointer' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div style={modalBox}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 20, color: '#FFF' }}>
              {editTarget ? 'Edit Allocation' : `Add Allocation — ${fmtYM(month)}`}
            </h2>

            {!editTarget && (
              <>
                <div style={{ marginBottom: 14 }}>
                  <label style={label}>Person *</label>
                  <select style={selectStyle} value={form.person_id} onChange={e => setForm(f => ({ ...f, person_id: e.target.value }))}>
                    <option value="">— Select person —</option>
                    {people.map(p => <option key={p.id} value={p.id}>{p.name}{p.discipline_name ? ` (${p.discipline_name})` : ''}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={label}>Project *</label>
                  <select style={selectStyle} value={form.project_id} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))}>
                    <option value="">— Select project —</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}{p.type ? ` [${p.type}]` : ''}</option>)}
                  </select>
                </div>
              </>
            )}
            {editTarget && (
              <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
                {editTarget.person_name} → {editTarget.project_name}
              </p>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={label}>FTE Value (0–1)</label>
                <input type="number" min="0" max="2" step="0.1" style={inputStyle}
                  value={form.fte_value} onChange={e => setForm(f => ({ ...f, fte_value: e.target.value }))} />
              </div>
              <div style={{ paddingTop: 24 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: '#CCC' }}>
                  <input type="checkbox" checked={form.is_billable} onChange={e => setForm(f => ({ ...f, is_billable: e.target.checked }))} />
                  Billable
                </label>
              </div>
            </div>

            <div style={modalFooter}>
              <button style={btnSecondary} onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button style={btnPrimary} onClick={handleSave} disabled={saving || (!editTarget && (!form.person_id || !form.project_id))}>
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Allocation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div style={{ ...modalBox, maxWidth: 400 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, color: '#FFF' }}>Delete Allocation</h2>
            <p style={{ color: '#CCC', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Remove allocation of <strong style={{ color: '#FFF' }}>{deleteTarget.person_name}</strong> to <strong style={{ color: '#FFF' }}>{deleteTarget.project_name}</strong> for {fmtYM(month)}? This cannot be undone.
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
