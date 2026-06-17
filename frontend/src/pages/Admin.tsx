import { useEffect, useState } from 'react';
import { refDataApi, planningCyclesApi, type Discipline, type Level, type ContractType, type Region, type PlanningCycle } from '../services/api';
import { usePlanningCycle } from '../context/PlanningCycleContext';
import axios from 'axios';

const BASE = (process.env.REACT_APP_API_URL ?? 'http://localhost:3001') + '/api';
const rawClient = axios.create({ baseURL: BASE });

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const tk = { bg2: '#FFFFFF', border: '#E5E5E5', accent: '#E31837', muted: '#666666' };
const card: React.CSSProperties = { background: tk.bg2, border: `1px solid ${tk.border}`, borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: tk.muted, background: '#F8F9FA', borderBottom: `1px solid ${tk.border}`, whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '10px 14px', borderBottom: '1px solid #F0F0F0', fontSize: 14, color: '#333333' };
const btnSecondary: React.CSSProperties = { padding: '8px 14px', background: 'transparent', color: '#555555', border: '1px solid #D5D5D5', borderRadius: 6, fontSize: 13, cursor: 'pointer' };

interface ChangeRule { id: number; change_type: string; auto_approve: boolean }
interface User { id: number; name: string; email: string; role: string; is_active: boolean }

// ---------------------------------------------------------------------------
// Loading placeholder
// ---------------------------------------------------------------------------

function LoadingRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} style={td}><div style={{ height: 14, background: '#EEEEEE', borderRadius: 3, width: '70%' }} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab panels
// ---------------------------------------------------------------------------

function DisciplinesTab() {
  const [data, setData] = useState<Discipline[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { refDataApi.disciplines().then(setData).catch(() => {}).finally(() => setLoading(false)); }, []);
  return (
    <div style={card}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>ID</th><th style={th}>Name</th></tr></thead>
        <tbody>
          {loading ? <LoadingRows cols={2} /> : data.length === 0 ? (
            <tr><td colSpan={2} style={{ ...td, textAlign: 'center', color: '#555' }}>No data</td></tr>
          ) : data.map(d => (
            <tr key={d.id}><td style={td}>{d.id}</td><td style={{ ...td, color: '#111111', fontWeight: 500 }}>{d.name}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LevelsTab() {
  const [data, setData] = useState<Level[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { refDataApi.levels().then(setData).catch(() => {}).finally(() => setLoading(false)); }, []);
  return (
    <div style={card}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>ID</th><th style={th}>Level Name</th><th style={th}>Short Code</th><th style={th}>Level #</th></tr></thead>
        <tbody>
          {loading ? <LoadingRows cols={4} /> : data.length === 0 ? (
            <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: '#555' }}>No data</td></tr>
          ) : data.map(l => (
            <tr key={l.id}>
              <td style={td}>{l.id}</td>
              <td style={{ ...td, color: '#111111', fontWeight: 500 }}>{l.level_name}</td>
              <td style={td}><span style={{ padding: '1px 7px', borderRadius: 8, background: '#F0ECFF', color: '#6644BB', border: '1px solid #C5B8F0', fontSize: 11, fontWeight: 600 }}>{l.short_code}</span></td>
              <td style={td}>{l.level_number ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ContractTypesTab() {
  const [data, setData] = useState<ContractType[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { refDataApi.contractTypes().then(setData).catch(() => {}).finally(() => setLoading(false)); }, []);
  return (
    <div style={card}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>ID</th><th style={th}>Code</th><th style={th}>Description</th><th style={th}>Category</th><th style={th}>Colour</th></tr></thead>
        <tbody>
          {loading ? <LoadingRows cols={5} /> : data.length === 0 ? (
            <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#555' }}>No data</td></tr>
          ) : data.map(c => (
            <tr key={c.id}>
              <td style={td}>{c.id}</td>
              <td style={{ ...td, color: '#111111', fontWeight: 600 }}>{c.code}</td>
              <td style={td}>{c.description}</td>
              <td style={td}>{c.category ?? '—'}</td>
              <td style={td}>
                {c.colour_hex
                  ? <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div style={{ width: 14, height: 14, borderRadius: 3, background: c.colour_hex }} /><span style={{ fontSize: 11, color: '#666' }}>{c.colour_hex}</span></div>
                  : <span style={{ color: '#444' }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegionsTab() {
  const [data, setData] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { refDataApi.regions().then(setData).catch(() => {}).finally(() => setLoading(false)); }, []);
  return (
    <div style={card}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>ID</th><th style={th}>Name</th><th style={th}>Code</th></tr></thead>
        <tbody>
          {loading ? <LoadingRows cols={3} /> : data.length === 0 ? (
            <tr><td colSpan={3} style={{ ...td, textAlign: 'center', color: '#555' }}>No data</td></tr>
          ) : data.map(r => (
            <tr key={r.id}>
              <td style={td}>{r.id}</td>
              <td style={{ ...td, color: '#111111', fontWeight: 500 }}>{r.name}</td>
              <td style={td}><span style={{ padding: '1px 7px', borderRadius: 8, background: '#F5F5F5', color: '#666666', border: '1px solid #E0E0E0', fontSize: 11 }}>{r.code}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsersTab() {
  const [data, setData] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    rawClient.get<{ data: User[] }>('/admin/users')
      .then(r => setData(r.data.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);
  return (
    <div style={card}>
      {error && <div style={{ padding: '12px 16px', fontSize: 13, color: '#996600', background: '#FFFBEB', borderBottom: '1px solid #F5DFA0' }}>⚠ Requires PMO role — data may not be available</div>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr><th style={th}>ID</th><th style={th}>Name</th><th style={th}>Email</th><th style={th}>Role</th><th style={th}>Active</th></tr></thead>
        <tbody>
          {loading ? <LoadingRows cols={5} /> : data.length === 0 ? (
            <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#555' }}>No users or insufficient permissions</td></tr>
          ) : data.map(u => (
            <tr key={u.id}>
              <td style={td}>{u.id}</td>
              <td style={{ ...td, color: '#111111', fontWeight: 500 }}>{u.name}</td>
              <td style={td}>{u.email}</td>
              <td style={td}><span style={{ padding: '1px 8px', borderRadius: 10, background: '#F0ECFF', color: '#6644BB', border: '1px solid #C5B8F0', fontSize: 11, fontWeight: 600 }}>{u.role}</span></td>
              <td style={td}>
                <span style={{ color: u.is_active ? '#33CC77' : '#E31837', fontSize: 12, fontWeight: 600 }}>
                  {u.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChangeRulesTab() {
  const [rules, setRules] = useState<ChangeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  useEffect(() => {
    rawClient.get<{ data: ChangeRule[] }>('/admin/change-request-rules')
      .then(r => setRules(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function toggle(rule: ChangeRule) {
    setSaving(rule.id);
    try {
      await rawClient.put(`/admin/change-request-rules/${rule.id}`, { auto_approve: !rule.auto_approve });
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, auto_approve: !r.auto_approve } : r));
    } catch {
      // 403 if not PMO — silently fail
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>
        Toggle auto-approve for each change request type. Auto-approved requests skip the manual PMO review step. Requires PMO role.
      </p>
      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Change Type</th><th style={th}>Auto-Approve</th></tr></thead>
          <tbody>
            {loading ? <LoadingRows cols={2} /> : rules.length === 0 ? (
              <tr><td colSpan={2} style={{ ...td, textAlign: 'center', color: '#555' }}>No rules configured</td></tr>
            ) : rules.map(r => (
              <tr key={r.id}>
                <td style={{ ...td, color: '#111111', fontWeight: 500 }}>{r.change_type}</td>
                <td style={td}>
                  <button
                    onClick={() => toggle(r)}
                    disabled={saving === r.id}
                    style={{
                      padding: '5px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                      cursor: saving === r.id ? 'wait' : 'pointer', border: 'none',
                      background: r.auto_approve ? '#E8F5EE' : '#FEF0F0',
                      color: r.auto_approve ? '#1E8A4A' : '#C0392B',
                      outline: `1px solid ${r.auto_approve ? '#A8D8BF' : '#F5C0BB'}`,
                    }}
                  >
                    {saving === r.id ? '…' : r.auto_approve ? 'ON' : 'OFF'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Planning Cycles tab
// ---------------------------------------------------------------------------

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  draft:        { label: 'Draft',        bg: '#F5F5F5', color: '#666666' },
  active:       { label: 'Active',       bg: '#E8F5EE', color: '#1E8A4A' },
  under_review: { label: 'Under Review', bg: '#FFF3DC', color: '#B5600A' },
  approved:     { label: 'Approved',     bg: '#EBF0FF', color: '#1D4EBB' },
  closed:       { label: 'Closed',       bg: '#EEEEEE', color: '#888888' },
};

const inp: React.CSSProperties = {
  padding: '6px 10px', border: '1px solid #D5D5D5', borderRadius: 5,
  fontSize: 13, boxSizing: 'border-box' as const, width: '100%',
};

function PlanningCyclesTab() {
  const { cycles, reloadCycles } = usePlanningCycle();
  const [creating, setCreating]   = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving]       = useState(false);

  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', copy_from_cycle_id: '' });
  const [editForm, setEditForm] = useState({ name: '', start_date: '', end_date: '', status: 'draft' });

  function startEdit(c: PlanningCycle) {
    setEditingId(c.id);
    setEditForm({ name: c.name, start_date: c.start_date.slice(0, 10), end_date: c.end_date.slice(0, 10), status: c.status });
  }

  async function handleCreate() {
    if (!form.name || !form.start_date || !form.end_date) return;
    setSaving(true);
    try {
      await planningCyclesApi.create({
        name: form.name, start_date: form.start_date, end_date: form.end_date,
        copy_from_cycle_id: form.copy_from_cycle_id ? parseInt(form.copy_from_cycle_id, 10) : null,
      });
      reloadCycles();
      setCreating(false);
      setForm({ name: '', start_date: '', end_date: '', copy_from_cycle_id: '' });
    } finally { setSaving(false); }
  }

  async function handleUpdate(id: number) {
    setSaving(true);
    try {
      await planningCyclesApi.update(id, {
        name: editForm.name, start_date: editForm.start_date,
        end_date: editForm.end_date, status: editForm.status as PlanningCycle['status'],
      });
      reloadCycles();
      setEditingId(null);
    } finally { setSaving(false); }
  }

  const fmtDate = (d: string) => d.slice(0, 10);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <p style={{ fontSize: 13, color: '#666', margin: 0 }}>
          Create and manage planning cycles. Optionally copy projects and allocations from an existing cycle as a starting point — months are automatically shifted to match the new cycle period.
        </p>
        <button
          onClick={() => { setCreating(true); setEditingId(null); }}
          style={{ padding: '7px 14px', background: '#E31837', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', marginLeft: 20, flexShrink: 0 }}
        >+ New Cycle</button>
      </div>

      {creating && (
        <div style={{ ...card, marginBottom: 16, padding: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#111111', marginBottom: 12 }}>New Planning Cycle</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>Name *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. H1 2027" style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>Start Date *</label>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>End Date *</label>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#666', marginBottom: 4, textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>Copy From</label>
              <select value={form.copy_from_cycle_id} onChange={e => setForm(f => ({ ...f, copy_from_cycle_id: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                <option value="">— Start blank —</option>
                {cycles.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setCreating(false)} style={btnSecondary}>Cancel</button>
            <button
              onClick={handleCreate}
              disabled={saving || !form.name || !form.start_date || !form.end_date}
              style={{ padding: '7px 16px', background: '#E31837', color: '#FFF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', opacity: (!form.name || !form.start_date || !form.end_date) ? 0.6 : 1 }}
            >{saving ? 'Creating…' : form.copy_from_cycle_id ? 'Create & Copy' : 'Create'}</button>
          </div>
        </div>
      )}

      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Start Date</th>
              <th style={th}>End Date</th>
              <th style={th}>Status</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {cycles.length === 0
              ? <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: '#555' }}>No planning cycles</td></tr>
              : cycles.map(cycle => {
                  const sm = STATUS_META[cycle.status] ?? STATUS_META.draft;
                  if (editingId === cycle.id) {
                    return (
                      <tr key={cycle.id} style={{ background: '#FAFAFA' }}>
                        <td style={td}><input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={{ ...inp, width: 150 }} /></td>
                        <td style={td}><input type="date" value={editForm.start_date} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} style={inp} /></td>
                        <td style={td}><input type="date" value={editForm.end_date}   onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))}   style={inp} /></td>
                        <td style={td}>
                          <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
                            {Object.entries(STATUS_META).map(([v, { label }]) => <option key={v} value={v}>{label}</option>)}
                          </select>
                        </td>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => handleUpdate(cycle.id)} disabled={saving} style={{ padding: '5px 12px', background: '#E31837', color: '#FFF', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{saving ? '…' : 'Save'}</button>
                            <button onClick={() => setEditingId(null)} style={{ ...btnSecondary, padding: '5px 10px', fontSize: 12 }}>Cancel</button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={cycle.id}>
                      <td style={{ ...td, color: '#111111', fontWeight: 600 }}>{cycle.name}</td>
                      <td style={td}>{fmtDate(cycle.start_date)}</td>
                      <td style={td}>{fmtDate(cycle.end_date)}</td>
                      <td style={td}>
                        <span style={{ padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: sm.bg, color: sm.color }}>
                          {sm.label}
                        </span>
                      </td>
                      <td style={td}>
                        <button onClick={() => startEdit(cycle)} style={{ ...btnSecondary, padding: '5px 10px', fontSize: 12 }}>Edit</button>
                      </td>
                    </tr>
                  );
                })
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin page
// ---------------------------------------------------------------------------

const TABS = ['Planning Cycles', 'Disciplines', 'Levels', 'Contract Types', 'Regions', 'Users', 'Change Rules'] as const;
type Tab = typeof TABS[number];

export default function Admin() {
  const [activeTab, setActiveTab] = useState<Tab>('Planning Cycles');

  return (
    <div style={{ color: '#111111' }}>
      {/* Page title bar */}
      <div style={{ display: 'flex', alignItems: 'center', background: '#181A1E', borderRadius: 8, marginBottom: 16, border: '1px solid #2A2C32', borderBottom: '2px solid #E31837', padding: '8px 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>Admin</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid #E5E5E5', flexWrap: 'wrap' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '8px 16px', background: 'transparent', border: 'none',
            borderBottom: activeTab === tab ? `2px solid ${tk.accent}` : '2px solid transparent',
            color: activeTab === tab ? '#111111' : '#999999', fontSize: 14,
            cursor: 'pointer', fontWeight: activeTab === tab ? 600 : 400, marginBottom: -1,
          }}>{tab}</button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Planning Cycles' && <PlanningCyclesTab />}
      {activeTab === 'Disciplines'    && <DisciplinesTab />}
      {activeTab === 'Levels'         && <LevelsTab />}
      {activeTab === 'Contract Types' && <ContractTypesTab />}
      {activeTab === 'Regions'        && <RegionsTab />}
      {activeTab === 'Users'          && <UsersTab />}
      {activeTab === 'Change Rules'   && <ChangeRulesTab />}
    </div>
  );
}
