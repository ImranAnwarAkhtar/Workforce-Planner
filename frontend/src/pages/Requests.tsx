import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  hireRequestsApi, refDataApi,
  type HireRequest, type Discipline, type Level, type ContractType, type Region, type Country,
  type CreateHireRequestBody,
} from '../services/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUEST_TYPES = ['New Hire', 'Backfill', 'Conversion', 'Contractor Extension', 'Contractor to Perm'];
const STAGE_LABELS  = ['Submitted', 'Dept Review', 'Commercial Review', 'Final Approval'];

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const tk = { bg2: '#FFFFFF', border: '#E5E5E5', accent: '#E31837', muted: '#666666' };
const card: React.CSSProperties = { background: tk.bg2, border: `1px solid ${tk.border}`, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
const inputSt: React.CSSProperties = {
  width: '100%', padding: '8px 11px', background: '#FFFFFF', border: '1px solid #D5D5D5',
  borderRadius: 6, color: '#111111', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
const selectSt: React.CSSProperties = { ...inputSt, cursor: 'pointer' };
const labelSt: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: tk.muted, marginBottom: 4, letterSpacing: '0.07em', textTransform: 'uppercase' };
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: tk.accent, color: '#FFF', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '8px 16px', background: 'transparent', color: '#555555', border: '1px solid #D5D5D5', borderRadius: 6, fontSize: 14, cursor: 'pointer' };
const btnGreen: React.CSSProperties = { padding: '5px 12px', background: '#E8F5EE', color: '#1E8A4A', border: '1px solid #A8D8BF', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const btnRed: React.CSSProperties   = { padding: '5px 12px', background: '#FEF0F0', color: '#C0392B', border: '1px solid #F5C0BB', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 };
const modalBox: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 10, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: '26px 30px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' };
const modalFooter: React.CSSProperties = { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22, paddingTop: 18, borderTop: '1px solid #EEEEEE' };

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  Pending:  { bg: '#2B1E0D', color: '#FFAA33', border: '#5E3A1A' },
  Approved: { bg: '#0D2B1E', color: '#33CC77', border: '#1A5E38' },
  Rejected: { bg: '#2B0D0D', color: '#E31837', border: '#5E1A1A' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: '#1A1A1A', color: '#888', border: '#333' };
  return (
    <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
      {status}
    </span>
  );
}

function StageProgress({ stage, status }: { stage: number; status: string }) {
  const completed = status === 'Approved' ? 4 : status === 'Rejected' ? -1 : stage - 1;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {STAGE_LABELS.map((lbl, i) => {
        const done    = status === 'Approved' || i < completed;
        const current = status === 'Pending' && i === completed;
        const reject  = status === 'Rejected';
        const color   = reject ? '#5E1A1A' : done ? '#33CC77' : current ? '#FFAA33' : '#333';
        const bg      = reject ? '#2B0D0D' : done ? '#0D2B1E' : current ? '#2B1E0D' : '#111';
        return (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center' }}>
            <div title={lbl} style={{ width: 22, height: 22, borderRadius: '50%', background: bg, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color }}>
              {done && !reject ? '✓' : i + 1}
            </div>
            {i < 3 && <div style={{ width: 20, height: 2, background: done && !reject ? '#1A5E38' : '#1E1E1E' }} />}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  request_type: string; discipline_id: string; level_id: string;
  contract_type_id: string; region_id: string; country_id: string;
  project_id: string; justification: string;
}
const emptyForm: FormState = { request_type: 'New Hire', discipline_id: '', level_id: '', contract_type_id: '', region_id: '', country_id: '', project_id: '', justification: '' };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HireRequests() {
  const [requests, setRequests] = useState<HireRequest[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [contractTypes, setContractTypes] = useState<ContractType[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);

  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [rejectTarget, setRejectTarget] = useState<HireRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    Promise.all([
      refDataApi.disciplines().catch(() => [] as Discipline[]),
      refDataApi.levels().catch(() => [] as Level[]),
      refDataApi.contractTypes().catch(() => [] as ContractType[]),
      refDataApi.regions().catch(() => [] as Region[]),
      refDataApi.countries().catch(() => [] as Country[]),
    ]).then(([d, l, c, r, co]) => { setDisciplines(d); setLevels(l); setContractTypes(c); setRegions(r); setCountries(co); });
  }, []);

  const loadRequests = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await hireRequestsApi.list({ status: statusFilter || undefined, limit: 200 });
      setRequests(data);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const filteredCountries = useMemo(() => form.region_id ? countries.filter(c => String(c.region_id) === form.region_id) : countries, [form.region_id, countries]);

  function setField(k: keyof FormState, v: string) {
    setForm(f => ({ ...f, [k]: v, ...(k === 'region_id' ? { country_id: '' } : {}) }));
  }

  async function handleSubmit() {
    if (!form.request_type) return;
    setSaving(true);
    try {
      const body: CreateHireRequestBody = {
        request_type: form.request_type,
        discipline_id:    form.discipline_id    ? parseInt(form.discipline_id, 10)    : null,
        level_id:         form.level_id         ? parseInt(form.level_id, 10)         : null,
        contract_type_id: form.contract_type_id ? parseInt(form.contract_type_id, 10) : null,
        region_id:        form.region_id        ? parseInt(form.region_id, 10)        : null,
        country_id:       form.country_id       ? parseInt(form.country_id, 10)       : null,
        justification: form.justification || null,
      };
      await hireRequestsApi.create(body);
      setModalOpen(false);
      setForm(emptyForm);
      loadRequests();
    } finally { setSaving(false); }
  }

  async function handleApprove(id: number) {
    await hireRequestsApi.approve(id).catch(() => {});
    loadRequests();
  }

  async function handleReject() {
    if (!rejectTarget) return;
    setRejecting(true);
    try {
      await hireRequestsApi.reject(rejectTarget.id, rejectReason || undefined);
      setRejectTarget(null); setRejectReason('');
      loadRequests();
    } finally { setRejecting(false); }
  }

  const counts = useMemo(() => ({
    all: requests.length,
    pending: requests.filter(r => r.status === 'Pending').length,
    approved: requests.filter(r => r.status === 'Approved').length,
    rejected: requests.filter(r => r.status === 'Rejected').length,
  }), [requests]);

  return (
    <div style={{ color: '#FFF' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Hire Requests</h1>
          <div style={{ width: 40, height: 3, background: tk.accent, borderRadius: 2, marginTop: 6 }} />
        </div>
        <button style={btnPrimary} onClick={() => { setForm(emptyForm); setModalOpen(true); }}>+ New Request</button>
      </div>

      {/* Status tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid #222' }}>
        {[
          { label: `All (${counts.all})`,         value: '' },
          { label: `Pending (${counts.pending})`,  value: 'Pending' },
          { label: `Approved (${counts.approved})`, value: 'Approved' },
          { label: `Rejected (${counts.rejected})`, value: 'Rejected' },
        ].map(({ label, value }) => (
          <button key={value} onClick={() => setStatusFilter(value)} style={{
            padding: '8px 16px', background: 'transparent', border: 'none',
            borderBottom: statusFilter === value ? `2px solid ${tk.accent}` : '2px solid transparent',
            color: statusFilter === value ? '#FFF' : '#888', fontSize: 14, cursor: 'pointer', fontWeight: statusFilter === value ? 600 : 400,
            marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 40, color: tk.accent }}>
          {error} <button style={{ ...btnSecondary, marginLeft: 12 }} onClick={loadRequests}>Retry</button>
        </div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#555' }}>No hire requests found</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {requests.map(r => (
            <div key={r.id} style={{ ...card, padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  {/* Top row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#1E1A2B', color: '#9977FF', border: '1px solid #3A2A66' }}>
                      {r.request_type}
                    </span>
                    <StatusBadge status={r.status} />
                    <span style={{ fontSize: 11, color: '#555' }}>#{r.id}</span>
                  </div>

                  {/* Details */}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
                    {r.level_name && <span style={{ fontSize: 13, color: '#AAA' }}>Level: <strong style={{ color: '#DDD' }}>{r.level_name}</strong></span>}
                    {r.discipline_name && <span style={{ fontSize: 13, color: '#AAA' }}>Discipline: <strong style={{ color: '#DDD' }}>{r.discipline_name}</strong></span>}
                    {r.contract_type_code && <span style={{ fontSize: 13, color: '#AAA' }}>Contract: <strong style={{ color: '#DDD' }}>{r.contract_type_code}</strong></span>}
                    {r.region_name && <span style={{ fontSize: 13, color: '#AAA' }}>Region: <strong style={{ color: '#DDD' }}>{r.region_name}</strong></span>}
                    {r.project_name && <span style={{ fontSize: 13, color: '#AAA' }}>Project: <strong style={{ color: '#DDD' }}>{r.project_name}</strong></span>}
                  </div>

                  {/* Stage progress */}
                  <StageProgress stage={r.stage} status={r.status} />

                  {r.submitted_by_name && (
                    <div style={{ fontSize: 11, color: '#555', marginTop: 8 }}>
                      Submitted by {r.submitted_by_name} · {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                {r.status === 'Pending' && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexDirection: 'column', alignItems: 'flex-end' }}>
                    <button style={btnGreen} onClick={() => handleApprove(r.id)}>Approve Stage {r.stage}</button>
                    <button style={btnRed} onClick={() => { setRejectTarget(r); setRejectReason(''); }}>Reject</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Request modal */}
      {modalOpen && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div style={modalBox}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18, color: '#FFF' }}>Submit Hire Request</h2>

            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Request Type *</label>
              <select style={selectSt} value={form.request_type} onChange={e => setField('request_type', e.target.value)}>
                {REQUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelSt}>Level / Grade</label>
                <select style={selectSt} value={form.level_id} onChange={e => setField('level_id', e.target.value)}>
                  <option value="">— Any —</option>
                  {levels.map(l => <option key={l.id} value={l.id}>{l.level_name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Discipline</label>
                <select style={selectSt} value={form.discipline_id} onChange={e => setField('discipline_id', e.target.value)}>
                  <option value="">— Any —</option>
                  {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div>
                <label style={labelSt}>Contract Type</label>
                <select style={selectSt} value={form.contract_type_id} onChange={e => setField('contract_type_id', e.target.value)}>
                  <option value="">— Any —</option>
                  {contractTypes.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Region</label>
                <select style={selectSt} value={form.region_id} onChange={e => setField('region_id', e.target.value)}>
                  <option value="">— Any —</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            {form.region_id && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelSt}>Country</label>
                <select style={selectSt} value={form.country_id} onChange={e => setField('country_id', e.target.value)}>
                  <option value="">— Any —</option>
                  {filteredCountries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Justification</label>
              <textarea style={{ ...inputSt, height: 80, resize: 'vertical' as const }}
                value={form.justification} onChange={e => setField('justification', e.target.value)}
                placeholder="Business case / justification for this hire…" />
            </div>

            <div style={modalFooter}>
              <button style={btnSecondary} onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button style={btnPrimary} onClick={handleSubmit} disabled={saving}>
                {saving ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setRejectTarget(null); }}>
          <div style={{ ...modalBox, maxWidth: 420 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 12, color: '#FFF' }}>Reject Request #{rejectTarget.id}</h2>
            <p style={{ color: '#CCC', fontSize: 13, marginBottom: 14 }}>
              {rejectTarget.request_type} · {rejectTarget.discipline_name ?? ''} · {rejectTarget.level_name ?? ''}
            </p>
            <div style={{ marginBottom: 16 }}>
              <label style={labelSt}>Rejection Reason</label>
              <textarea style={{ ...inputSt, height: 72, resize: 'vertical' as const }}
                value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Optional reason…" />
            </div>
            <div style={modalFooter}>
              <button style={btnSecondary} onClick={() => setRejectTarget(null)} disabled={rejecting}>Cancel</button>
              <button style={{ ...btnPrimary, background: '#c41530' }} onClick={handleReject} disabled={rejecting}>
                {rejecting ? 'Rejecting…' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
