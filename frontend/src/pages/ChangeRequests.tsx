import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  changeRequestsApi, refDataApi, tbhCodesApi,
  type ChangeRequest, type Level, type Region, type Country, type TbhCode,
  type CreateChangeRequestBody,
} from '../services/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHANGE_TYPES = ['Region Transfer', 'Level Change', 'Contract Type Change', 'Manager Change', 'Borrow/Repurpose', 'Other'];

// ---------------------------------------------------------------------------
// Styles (same tokens as other pages)
// ---------------------------------------------------------------------------

const tk = { bg2: '#FFFFFF', border: '#E5E5E5', accent: '#E31837', muted: '#666666' };
const card: React.CSSProperties = { background: tk.bg2, border: `1px solid ${tk.border}`, borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' };
const inputSt: React.CSSProperties = { width: '100%', padding: '8px 11px', background: '#FFFFFF', border: '1px solid #D5D5D5', borderRadius: 6, color: '#111111', fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const selectSt: React.CSSProperties = { ...inputSt, cursor: 'pointer' };
const labelSt: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: tk.muted, marginBottom: 4, letterSpacing: '0.07em', textTransform: 'uppercase' };
const btnPrimary: React.CSSProperties = { padding: '8px 16px', background: tk.accent, color: '#FFF', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '8px 16px', background: 'transparent', color: '#555555', border: '1px solid #D5D5D5', borderRadius: 6, fontSize: 14, cursor: 'pointer' };
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 };
const modalBox: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 10, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: '26px 30px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' };
const modalFooter: React.CSSProperties = { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22, paddingTop: 18, borderTop: '1px solid #EEEEEE' };

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  Pending:        { background: '#2B1E0D', color: '#FFAA33', border: '1px solid #5E3A1A' },
  Approved:       { background: '#0D2B1E', color: '#33CC77', border: '1px solid #1A5E38' },
  'Auto-Approved':{ background: '#0D1B2B', color: '#5599FF', border: '1px solid #1A3A66' },
  Rejected:       { background: '#2B0D0D', color: '#E31837', border: '1px solid #5E1A1A' },
};

function StatusBadge({ status, autoApproved }: { status: string; autoApproved: boolean }) {
  const displayStatus = autoApproved && status === 'Approved' ? 'Auto-Approved' : status;
  const s = STATUS_STYLE[displayStatus] ?? { background: '#1A1A1A', color: '#888', border: '1px solid #333' };
  return <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600, ...s }}>{displayStatus}</span>;
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  change_type: string; tbh_code_id: string; current_manager: string; new_manager: string;
  new_region_id: string; new_country_id: string; new_level_id: string;
  is_borrowed_or_repurposed: boolean; justification: string;
}

const emptyForm: FormState = {
  change_type: 'Level Change', tbh_code_id: '', current_manager: '', new_manager: '',
  new_region_id: '', new_country_id: '', new_level_id: '', is_borrowed_or_repurposed: false, justification: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChangeRequests() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [tbhCodes, setTbhCodes] = useState<TbhCode[]>([]);

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [actionTarget, setActionTarget] = useState<{ req: ChangeRequest; action: 'approve' | 'reject' } | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    Promise.all([
      refDataApi.levels().catch(() => [] as Level[]),
      refDataApi.regions().catch(() => [] as Region[]),
      refDataApi.countries().catch(() => [] as Country[]),
      tbhCodesApi.list({ limit: 200 }).catch(() => [] as TbhCode[]),
    ]).then(([l, r, c, t]) => { setLevels(l); setRegions(r); setCountries(c); setTbhCodes(t); });
  }, []);

  const loadRequests = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await changeRequestsApi.list({
        status: statusFilter || undefined,
        change_type: typeFilter || undefined,
        limit: 200,
      });
      setRequests(data);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [statusFilter, typeFilter]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const filteredCountries = useMemo(
    () => form.new_region_id ? countries.filter(c => String(c.region_id) === form.new_region_id) : countries,
    [form.new_region_id, countries]
  );

  function setField(k: keyof FormState, v: string | boolean) {
    setForm(f => ({ ...f, [k]: v, ...(k === 'new_region_id' ? { new_country_id: '' } : {}) }));
  }

  async function handleSubmit() {
    if (!form.change_type) return;
    setSaving(true);
    try {
      const body: CreateChangeRequestBody = {
        change_type: form.change_type,
        tbh_code_id:             form.tbh_code_id     ? parseInt(form.tbh_code_id, 10)     : null,
        current_manager:         form.current_manager  || null,
        new_manager:             form.new_manager       || null,
        new_region_id:           form.new_region_id    ? parseInt(form.new_region_id, 10)   : null,
        new_country_id:          form.new_country_id   ? parseInt(form.new_country_id, 10)  : null,
        new_level_id:            form.new_level_id     ? parseInt(form.new_level_id, 10)    : null,
        is_borrowed_or_repurposed: form.is_borrowed_or_repurposed,
        justification:           form.justification    || null,
      };
      await changeRequestsApi.create(body);
      setModalOpen(false);
      setForm(emptyForm);
      loadRequests();
    } finally { setSaving(false); }
  }

  async function handleAction() {
    if (!actionTarget) return;
    setActioning(true);
    try {
      if (actionTarget.action === 'approve') {
        await changeRequestsApi.approve(actionTarget.req.id);
      } else {
        await changeRequestsApi.reject(actionTarget.req.id, actionReason || undefined);
      }
      setActionTarget(null); setActionReason('');
      loadRequests();
    } finally { setActioning(false); }
  }

  const showField = (type: string) => ({
    region:    ['Region Transfer'].includes(type),
    level:     ['Level Change'].includes(type),
    manager:   ['Manager Change'].includes(type),
    borrow:    ['Borrow/Repurpose'].includes(type),
  });

  const fields = showField(form.change_type);

  const counts = useMemo(() => ({
    all: requests.length,
    pending: requests.filter(r => r.status === 'Pending').length,
    approved: requests.filter(r => r.status === 'Approved').length,
    autoApproved: requests.filter(r => r.auto_approved).length,
  }), [requests]);

  return (
    <div style={{ color: '#FFF' }}>
      {/* Page title bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#181A1E', borderRadius: 8, marginBottom: 16, border: '1px solid #2A2C32', borderBottom: '2px solid #E31837', padding: '8px 16px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>Change Requests</div>
        <button style={btnPrimary} onClick={() => { setForm(emptyForm); setModalOpen(true); }}>+ New Request</button>
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: `${counts.all} Total`, color: '#555' },
          { label: `${counts.pending} Pending`, color: '#FFAA33' },
          { label: `${counts.approved} Approved`, color: '#33CC77' },
          { label: `${counts.autoApproved} Auto-Approved`, color: '#5599FF' },
        ].map(({ label, color }) => (
          <div key={label} style={{ padding: '5px 12px', background: '#111', border: '1px solid #222', borderRadius: 6, fontSize: 12, color }}>{label}</div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={{ ...selectSt, flex: '0 0 auto', width: 'auto', minWidth: 160 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
        <select style={{ ...selectSt, flex: '0 0 auto', width: 'auto', minWidth: 200 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All change types</option>
          {CHANGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><div className="spinner" /></div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 40, color: tk.accent }}>
          {error} <button style={{ ...btnSecondary, marginLeft: 12 }} onClick={loadRequests}>Retry</button>
        </div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#555' }}>No change requests found</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {requests.map(r => (
            <div key={r.id} style={{ ...card, padding: '16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  {/* Badges row */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                    <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#1A1A2B', color: '#9977FF', border: '1px solid #3A2A66' }}>
                      {r.change_type}
                    </span>
                    <StatusBadge status={r.status} autoApproved={r.auto_approved} />
                    {r.tbh_id && <span style={{ fontSize: 11, color: '#666', background: '#1A1A1A', padding: '2px 7px', borderRadius: 10, border: '1px solid #333' }}>TBH: {r.tbh_id}</span>}
                  </div>

                  {/* Change detail */}
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 6 }}>
                    {r.new_level_name   && <span style={{ fontSize: 13, color: '#AAA' }}>New Level: <strong style={{ color: '#DDD' }}>{r.new_level_name}</strong></span>}
                    {r.new_region_name  && <span style={{ fontSize: 13, color: '#AAA' }}>New Region: <strong style={{ color: '#DDD' }}>{r.new_region_name}</strong></span>}
                    {r.new_country_name && <span style={{ fontSize: 13, color: '#AAA' }}>New Country: <strong style={{ color: '#DDD' }}>{r.new_country_name}</strong></span>}
                    {r.current_manager  && <span style={{ fontSize: 13, color: '#AAA' }}>From: <strong style={{ color: '#DDD' }}>{r.current_manager}</strong></span>}
                    {r.new_manager      && <span style={{ fontSize: 13, color: '#AAA' }}>To: <strong style={{ color: '#DDD' }}>{r.new_manager}</strong></span>}
                  </div>

                  {r.justification && (
                    <p style={{ fontSize: 12, color: '#666', fontStyle: 'italic', margin: '4px 0 4px', maxWidth: 600 }}>"{r.justification}"</p>
                  )}

                  <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>
                    {r.submitted_by_name && `Submitted by ${r.submitted_by_name} · `}
                    {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {r.approved_by_name && ` · Approved by ${r.approved_by_name}`}
                  </div>
                </div>

                {r.status === 'Pending' && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexDirection: 'column', alignItems: 'flex-end' }}>
                    <button onClick={() => setActionTarget({ req: r, action: 'approve' })}
                      style={{ padding: '5px 12px', background: '#0D2B1E', color: '#33CC77', border: '1px solid #1A5E38', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Approve
                    </button>
                    <button onClick={() => { setActionTarget({ req: r, action: 'reject' }); setActionReason(''); }}
                      style={{ padding: '5px 12px', background: '#2B0D0D', color: '#E31837', border: '1px solid #5E1A1A', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Reject
                    </button>
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
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 18, color: '#FFF' }}>Submit Change Request</h2>

            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Change Type *</label>
              <select style={selectSt} value={form.change_type} onChange={e => setField('change_type', e.target.value)}>
                {CHANGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>TBH Code (if applicable)</label>
              <select style={selectSt} value={form.tbh_code_id} onChange={e => setField('tbh_code_id', e.target.value)}>
                <option value="">— None —</option>
                {tbhCodes.map(t => <option key={t.id} value={t.id}>{t.tbh_id}{t.job_profile ? ` – ${t.job_profile}` : ''}</option>)}
              </select>
            </div>

            {fields.level && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelSt}>New Level</label>
                <select style={selectSt} value={form.new_level_id} onChange={e => setField('new_level_id', e.target.value)}>
                  <option value="">— Select —</option>
                  {levels.map(l => <option key={l.id} value={l.id}>{l.level_name}</option>)}
                </select>
              </div>
            )}

            {fields.region && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelSt}>New Region</label>
                  <select style={selectSt} value={form.new_region_id} onChange={e => setField('new_region_id', e.target.value)}>
                    <option value="">— Select —</option>
                    {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>New Country</label>
                  <select style={{ ...selectSt, opacity: filteredCountries.length === 0 ? 0.5 : 1 }} value={form.new_country_id} onChange={e => setField('new_country_id', e.target.value)} disabled={filteredCountries.length === 0}>
                    <option value="">— Select —</option>
                    {filteredCountries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {fields.manager && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelSt}>Current Manager</label>
                  <input style={inputSt} value={form.current_manager} onChange={e => setField('current_manager', e.target.value)} placeholder="Name" />
                </div>
                <div>
                  <label style={labelSt}>New Manager</label>
                  <input style={inputSt} value={form.new_manager} onChange={e => setField('new_manager', e.target.value)} placeholder="Name" />
                </div>
              </div>
            )}

            {fields.borrow && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, color: '#CCC' }}>
                  <input type="checkbox" checked={form.is_borrowed_or_repurposed} onChange={e => setField('is_borrowed_or_repurposed', e.target.checked)} />
                  Confirm this is a borrow / repurpose
                </label>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={labelSt}>Justification</label>
              <textarea style={{ ...inputSt, height: 72, resize: 'vertical' as const }}
                value={form.justification} onChange={e => setField('justification', e.target.value)}
                placeholder="Business justification…" />
            </div>

            <div style={modalFooter}>
              <button style={btnSecondary} onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button style={btnPrimary} onClick={handleSubmit} disabled={saving}>
                {saving ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve / Reject confirm */}
      {actionTarget && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setActionTarget(null); }}>
          <div style={{ ...modalBox, maxWidth: 400 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 10, color: '#FFF' }}>
              {actionTarget.action === 'approve' ? 'Approve' : 'Reject'} Change Request #{actionTarget.req.id}
            </h2>
            <p style={{ color: '#AAA', fontSize: 13, marginBottom: 14 }}>
              {actionTarget.req.change_type}
              {actionTarget.req.tbh_id && ` · TBH ${actionTarget.req.tbh_id}`}
            </p>
            {actionTarget.action === 'reject' && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelSt}>Reason (optional)</label>
                <textarea style={{ ...inputSt, height: 64, resize: 'vertical' as const }} value={actionReason} onChange={e => setActionReason(e.target.value)} placeholder="Reason for rejection…" />
              </div>
            )}
            <div style={modalFooter}>
              <button style={btnSecondary} onClick={() => setActionTarget(null)} disabled={actioning}>Cancel</button>
              <button
                style={{ ...btnPrimary, background: actionTarget.action === 'approve' ? '#1A5E38' : '#c41530' }}
                onClick={handleAction} disabled={actioning}
              >
                {actioning ? '…' : actionTarget.action === 'approve' ? 'Confirm Approve' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
