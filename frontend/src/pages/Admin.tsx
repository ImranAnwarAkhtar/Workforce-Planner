import { useEffect, useState } from 'react';
import { refDataApi, type Discipline, type Level, type ContractType, type Region } from '../services/api';
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
// Admin page
// ---------------------------------------------------------------------------

const TABS = ['Disciplines', 'Levels', 'Contract Types', 'Regions', 'Users', 'Change Rules'] as const;
type Tab = typeof TABS[number];

export default function Admin() {
  const [activeTab, setActiveTab] = useState<Tab>('Disciplines');

  return (
    <div style={{ color: '#111111' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Admin</h1>
        <div style={{ width: 40, height: 3, background: tk.accent, borderRadius: 2, marginTop: 6 }} />
        <p style={{ fontSize: 13, color: '#555555', marginTop: 8 }}>Reference data and system configuration</p>
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
      {activeTab === 'Disciplines'    && <DisciplinesTab />}
      {activeTab === 'Levels'         && <LevelsTab />}
      {activeTab === 'Contract Types' && <ContractTypesTab />}
      {activeTab === 'Regions'        && <RegionsTab />}
      {activeTab === 'Users'          && <UsersTab />}
      {activeTab === 'Change Rules'   && <ChangeRulesTab />}
    </div>
  );
}
