import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  changeRequestsApi, refDataApi, tbhCodesApi,
  type ChangeRequest, type Level, type Region, type Country, type TbhCode,
  type CreateChangeRequestBody, type ApproveChangeRequestBody,
} from '../services/api';
import { getUser } from '../hooks/useAuth';

// ---------------------------------------------------------------------------
// Constants — must match DB CHECK constraint values
// ---------------------------------------------------------------------------

const CHANGE_TYPES = [
  'Move Region/Country',
  'Change Manager',
  'Change Level or Role',
  'Borrow or Repurpose HC',
  'Cancel TBH',
  'Convert Retail to xScale',
  'Convert xScale to Retail',
] as const;

const APPROVAL_TYPES = [
  'Workforce Planning',
  'VP Required',
  'Director Required',
  'Finance Required',
];

const SENIOR_APPROVER_STATUSES = ['Pending', 'Approved', 'Rejected', 'N/A'];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const tk = { border: '#E0E3E8', accent: '#E91C24', muted: '#5A657B' };
const inputSt: React.CSSProperties  = { width: '100%', padding: '8px 11px', background: '#FFFFFF', border: '1px solid #D5D5D5', borderRadius: 6, color: '#111111', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
const selectSt: React.CSSProperties = { ...inputSt, cursor: 'pointer' };
const labelSt: React.CSSProperties  = { display: 'block', fontSize: 11, fontWeight: 700, color: tk.muted, marginBottom: 4, letterSpacing: '0.07em', textTransform: 'uppercase' };
const fgSt: React.CSSProperties     = { marginBottom: 14 };
const grid2: React.CSSProperties    = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 };
const btnPrimary: React.CSSProperties   = { padding: '8px 18px', background: tk.accent, color: '#FFF', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' };
const btnSecondary: React.CSSProperties = { padding: '8px 18px', background: 'transparent', color: '#555', border: '1px solid #D5D5D5', borderRadius: 6, fontSize: 13, cursor: 'pointer' };
const overlay: React.CSSProperties  = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 };
const modalBox: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #E0E3E8', borderRadius: 10, width: '100%', maxWidth: 580, maxHeight: '90vh', overflowY: 'auto', padding: '26px 30px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' };
const modalFooter: React.CSSProperties = { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22, paddingTop: 18, borderTop: '1px solid #E8E8E8' };
const divider: React.CSSProperties  = { borderTop: '1px solid #F0F0F0', margin: '16px 0' };

const STATUS_PILL: Record<string, React.CSSProperties> = {
  Pending:         { background: '#FFF8E6', color: '#D97706', border: '1px solid #FEDC86' },
  Approved:        { background: '#DFFBE5', color: '#2A8346', border: '1px solid #33A85C' },
  'Auto-Approved': { background: '#CCE3FF', color: '#086AE3', border: '1px solid #086AE3' },
  Rejected:        { background: '#FFEBEE', color: '#AD050C', border: '1px solid #E91C24' },
};

function StatusBadge({ status, autoApproved }: { status: string; autoApproved: boolean }) {
  const label = autoApproved && status === 'Approved' ? 'Auto-Approved' : status;
  const s = STATUS_PILL[label] ?? { background: '#F2F3F4', color: '#5A657B', border: '1px solid #E0E3E8' };
  return <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600, ...s }}>{label}</span>;
}

function SeniorStatusBadge({ status }: { status: string | null }) {
  if (!status || status === 'N/A') return null;
  const colors: Record<string, { bg: string; color: string; border: string }> = {
    Pending:  { bg: '#FFF8E6', color: '#D97706', border: '#FEDC86' },
    Approved: { bg: '#DFFBE5', color: '#2A8346', border: '#33A85C' },
    Rejected: { bg: '#FFEBEE', color: '#AD050C', border: '#E91C24' },
  };
  const c = colors[status] ?? { bg: '#F2F3F4', color: '#5A657B', border: '#E0E3E8' };
  return <span style={{ padding: '2px 7px', borderRadius: 8, fontSize: 10, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>Snr: {status}</span>;
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  change_type: string;
  tbh_code_id: string;
  current_manager: string;
  new_manager: string;
  new_metro_location: string;
  new_region_id: string;
  new_country_id: string;
  new_level_id: string;
  is_borrowed_or_repurposed: boolean;
  justification: string;
  approval_type: string;
  senior_approver: string;
  xscale_vs_retail: string;
  requestor_email: string;
  comments: string;
}

interface ApproveFormState {
  reviewer_notes: string;
  new_tbh_code_assigned: string;
  senior_approver_status: string;
}

const emptyForm: FormState = {
  change_type: 'Change Manager',
  tbh_code_id: '',
  current_manager: '',
  new_manager: '',
  new_metro_location: '',
  new_region_id: '',
  new_country_id: '',
  new_level_id: '',
  is_borrowed_or_repurposed: false,
  justification: '',
  approval_type: 'Workforce Planning',
  senior_approver: '',
  xscale_vs_retail: '',
  requestor_email: '',
  comments: '',
};

const emptyApproveForm: ApproveFormState = {
  reviewer_notes: '',
  new_tbh_code_assigned: '',
  senior_approver_status: 'N/A',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChangeRequests() {
  const currentUser = getUser();

  const [requests,  setRequests]  = useState<ChangeRequest[]>([]);
  const [levels,    setLevels]    = useState<Level[]>([]);
  const [regions,   setRegions]   = useState<Region[]>([]);
  const [countries, setCountries] = useState<Country[]>([]);
  const [tbhCodes,  setTbhCodes]  = useState<TbhCode[]>([]);

  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter,   setTypeFilter]   = useState('');
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  // Submit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [form,      setForm]      = useState<FormState>(emptyForm);
  const [saving,    setSaving]    = useState(false);

  // Approve/Reject modal
  const [actionTarget,  setActionTarget]  = useState<{ req: ChangeRequest; action: 'approve' | 'reject' } | null>(null);
  const [actionReason,  setActionReason]  = useState('');
  const [approveForm,   setApproveForm]   = useState<ApproveFormState>(emptyApproveForm);
  const [actioning,     setActioning]     = useState(false);

  // Detail expand
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    const userEmail = currentUser?.email ?? '';
    setForm(f => ({ ...f, requestor_email: userEmail }));
  }, [currentUser?.email]);

  useEffect(() => {
    Promise.all([
      refDataApi.levels().catch(()   => [] as Level[]),
      refDataApi.regions().catch(()  => [] as Region[]),
      refDataApi.countries().catch(() => [] as Country[]),
      tbhCodesApi.list({ limit: 200 }).catch(() => [] as TbhCode[]),
    ]).then(([l, r, c, t]) => { setLevels(l); setRegions(r); setCountries(c); setTbhCodes(t); });
  }, []);

  const loadRequests = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await changeRequestsApi.list({
        status:      statusFilter || undefined,
        change_type: typeFilter   || undefined,
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

  function setField<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v, ...(k === 'new_region_id' ? { new_country_id: '' } : {}) }));
  }

  const visibleFields = (type: string) => ({
    region:   type === 'Move Region/Country',
    level:    type === 'Change Level or Role',
    manager:  type === 'Change Manager',
    borrow:   type === 'Borrow or Repurpose HC',
    xscale:   type === 'Convert Retail to xScale' || type === 'Convert xScale to Retail',
    metro:    type === 'Move Region/Country',
  });

  async function handleSubmit() {
    if (!form.change_type) return;
    setSaving(true);
    try {
      const body: CreateChangeRequestBody = {
        change_type:               form.change_type,
        tbh_code_id:               form.tbh_code_id     ? parseInt(form.tbh_code_id, 10)    : null,
        current_manager:           form.current_manager  || null,
        new_manager:               form.new_manager      || null,
        new_metro_location:        form.new_metro_location || null,
        new_region_id:             form.new_region_id    ? parseInt(form.new_region_id, 10)  : null,
        new_country_id:            form.new_country_id   ? parseInt(form.new_country_id, 10) : null,
        new_level_id:              form.new_level_id     ? parseInt(form.new_level_id, 10)   : null,
        is_borrowed_or_repurposed: form.is_borrowed_or_repurposed,
        justification:             form.justification    || null,
        approval_type:             form.approval_type    || null,
        senior_approver:           form.senior_approver  || null,
        xscale_vs_retail:          form.xscale_vs_retail || null,
        requestor_email:           form.requestor_email  || null,
        comments:                  form.comments         || null,
      };
      await changeRequestsApi.create(body);
      setModalOpen(false);
      setForm({ ...emptyForm, requestor_email: currentUser?.email ?? '' });
      loadRequests();
    } finally { setSaving(false); }
  }

  async function handleAction() {
    if (!actionTarget) return;
    setActioning(true);
    try {
      if (actionTarget.action === 'approve') {
        const body: ApproveChangeRequestBody = {
          reviewer_notes:         approveForm.reviewer_notes        || null,
          new_tbh_code_assigned:  approveForm.new_tbh_code_assigned || null,
          senior_approver_status: approveForm.senior_approver_status || null,
        };
        await changeRequestsApi.approve(actionTarget.req.id, body);
      } else {
        await changeRequestsApi.reject(
          actionTarget.req.id,
          actionReason || undefined,
          approveForm.reviewer_notes || undefined,
        );
      }
      setActionTarget(null);
      setActionReason('');
      setApproveForm(emptyApproveForm);
      loadRequests();
    } finally { setActioning(false); }
  }

  function openApprove(req: ChangeRequest, action: 'approve' | 'reject') {
    setActionTarget({ req, action });
    setActionReason('');
    setApproveForm({
      ...emptyApproveForm,
      senior_approver_status: req.senior_approver ? 'Pending' : 'N/A',
    });
  }

  function toggleExpand(id: number) {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  const counts = useMemo(() => ({
    all:          requests.length,
    pending:      requests.filter(r => r.status === 'Pending').length,
    approved:     requests.filter(r => r.status === 'Approved' || r.status === 'Auto-Approved').length,
    rejected:     requests.filter(r => r.status === 'Rejected').length,
  }), [requests]);

  const vf = visibleFields(form.change_type);

  return (
    <div style={{ color: '#111111', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Banner */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFFFF', borderRadius: 8, marginBottom: 14, border: '1px solid #E0E3E8', borderBottom: '3px solid #E91C24', padding: '9px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Change Requests</span>
          <div style={{ display: 'flex', gap: 14 }}>
            {[
              { label: 'Total',    value: counts.all,      color: '#5A657B' },
              { label: 'Pending',  value: counts.pending,  color: '#D97706' },
              { label: 'Approved', value: counts.approved, color: '#2A8346' },
              { label: 'Rejected', value: counts.rejected, color: '#AD050C' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color }}>{value}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#5A657B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
        <button style={btnPrimary} onClick={() => { setForm({ ...emptyForm, requestor_email: currentUser?.email ?? '' }); setModalOpen(true); }}>
          + New Request
        </button>
      </div>

      {/* Filters */}
      <div style={{ flexShrink: 0, display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <select style={{ ...selectSt, flex: '0 0 auto', width: 'auto', minWidth: 150 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
        <select style={{ ...selectSt, flex: '0 0 auto', width: 'auto', minWidth: 220 }} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All change types</option>
          {CHANGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#8B93A3' }}>Loading…</div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 40, color: tk.accent }}>
            {error} <button style={{ ...btnSecondary, marginLeft: 12 }} onClick={loadRequests}>Retry</button>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#8B93A3' }}>No change requests found</div>
        ) : (
          requests.map(r => {
            const isExpanded = expanded.has(r.id);
            return (
              <div key={r.id} style={{ background: '#FFFFFF', border: '1px solid #E0E3E8', borderRadius: 8, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Badge row */}
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 7 }}>
                      <span style={{ padding: '2px 9px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: '#EEF4FF', color: '#3B4ECA', border: '1px solid #C7D2FE' }}>
                        {r.change_type}
                      </span>
                      <StatusBadge status={r.status} autoApproved={r.auto_approved} />
                      {r.tbh_id && <span style={{ fontSize: 11, color: '#5A657B', background: '#F2F3F4', padding: '2px 7px', borderRadius: 8, border: '1px solid #E0E3E8' }}>TBH: {r.tbh_id}</span>}
                      {r.approval_type && <span style={{ fontSize: 11, color: '#5A657B', background: '#F2F3F4', padding: '2px 7px', borderRadius: 8, border: '1px solid #E0E3E8' }}>{r.approval_type}</span>}
                      {r.xscale_vs_retail && <span style={{ fontSize: 11, color: '#7739D9', background: '#F3EEFF', padding: '2px 7px', borderRadius: 8, border: '1px solid #DDD0FF' }}>{r.xscale_vs_retail}</span>}
                      <SeniorStatusBadge status={r.senior_approver_status} />
                    </div>

                    {/* Key change detail */}
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: '#374151', marginBottom: 4 }}>
                      {r.current_manager   && <span><span style={{ color: '#8B93A3' }}>From: </span><strong>{r.current_manager}</strong></span>}
                      {r.new_manager       && <span><span style={{ color: '#8B93A3' }}>To: </span><strong>{r.new_manager}</strong></span>}
                      {r.new_level_name    && <span><span style={{ color: '#8B93A3' }}>Level: </span><strong>{r.new_level_name}</strong></span>}
                      {r.new_region_name   && <span><span style={{ color: '#8B93A3' }}>Region: </span><strong>{r.new_region_name}</strong></span>}
                      {r.new_country_name  && <span><span style={{ color: '#8B93A3' }}>Country: </span><strong>{r.new_country_name}</strong></span>}
                      {r.new_metro_location && <span><span style={{ color: '#8B93A3' }}>Metro: </span><strong>{r.new_metro_location}</strong></span>}
                      {r.new_tbh_code_assigned && <span><span style={{ color: '#8B93A3' }}>New TBH: </span><strong style={{ color: '#E91C24' }}>{r.new_tbh_code_assigned}</strong></span>}
                    </div>

                    {r.justification && (
                      <p style={{ fontSize: 12, color: '#6B7280', fontStyle: 'italic', margin: '4px 0', maxWidth: 640 }}>"{r.justification}"</p>
                    )}

                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {r.submitted_by_name && `Submitted by ${r.submitted_by_name}`}
                        {r.requestor_email && ` (${r.requestor_email})`}
                        {` · ${new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                        {r.approved_by_name && ` · Actioned by ${r.approved_by_name}`}
                      </span>
                      {(r.comments || r.reviewer_notes || r.rejection_reason || r.senior_approver) && (
                        <button onClick={() => toggleExpand(r.id)}
                          style={{ fontSize: 11, color: '#086AE3', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                          {isExpanded ? 'Less detail' : 'More detail'}
                        </button>
                      )}
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F0F0F0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {r.senior_approver && (
                          <div style={{ fontSize: 12, color: '#374151' }}>
                            <span style={{ color: '#8B93A3', fontWeight: 600 }}>Senior Approver: </span>{r.senior_approver}
                            {r.senior_approver_status && ` (${r.senior_approver_status})`}
                          </div>
                        )}
                        {r.comments && (
                          <div style={{ fontSize: 12, color: '#374151' }}>
                            <span style={{ color: '#8B93A3', fontWeight: 600 }}>Comments: </span>{r.comments}
                          </div>
                        )}
                        {r.reviewer_notes && (
                          <div style={{ fontSize: 12, color: '#374151' }}>
                            <span style={{ color: '#8B93A3', fontWeight: 600 }}>Reviewer Notes: </span>{r.reviewer_notes}
                          </div>
                        )}
                        {r.rejection_reason && (
                          <div style={{ fontSize: 12, color: '#AD050C' }}>
                            <span style={{ fontWeight: 600 }}>Rejection Reason: </span>{r.rejection_reason}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {r.status === 'Pending' && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexDirection: 'column', alignItems: 'flex-end' }}>
                      <button onClick={() => openApprove(r, 'approve')}
                        style={{ padding: '5px 14px', background: '#EBF7EF', color: '#1A6B3A', border: '1px solid #A8D8BF', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Approve
                      </button>
                      <button onClick={() => openApprove(r, 'reject')}
                        style={{ padding: '5px 14px', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FBBDBA', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Submit Change Request modal ── */}
      {modalOpen && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div style={modalBox}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, color: '#111827' }}>Submit Change Request</h2>

            {/* Change type + TBH Code */}
            <div style={grid2}>
              <div>
                <label style={labelSt}>Change Type *</label>
                <select style={selectSt} value={form.change_type} onChange={e => setField('change_type', e.target.value as FormState['change_type'])}>
                  {CHANGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>TBH Code</label>
                <select style={selectSt} value={form.tbh_code_id} onChange={e => setField('tbh_code_id', e.target.value)}>
                  <option value="">— None —</option>
                  {tbhCodes.map(t => <option key={t.id} value={t.id}>{t.tbh_id}{t.job_profile ? ` – ${t.job_profile}` : ''}</option>)}
                </select>
              </div>
            </div>

            {/* Approval type + Senior approver */}
            <div style={grid2}>
              <div>
                <label style={labelSt}>Approval Type</label>
                <select style={selectSt} value={form.approval_type} onChange={e => setField('approval_type', e.target.value)}>
                  <option value="">— Select —</option>
                  {APPROVAL_TYPES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Senior Approver Name</label>
                <input style={inputSt} value={form.senior_approver} onChange={e => setField('senior_approver', e.target.value)} placeholder="e.g. Jane Smith" />
              </div>
            </div>

            {/* Type-specific fields */}
            {vf.manager && (
              <div style={grid2}>
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

            {vf.level && (
              <div style={fgSt}>
                <label style={labelSt}>New Level or Role</label>
                <select style={selectSt} value={form.new_level_id} onChange={e => setField('new_level_id', e.target.value)}>
                  <option value="">— Select —</option>
                  {levels.map(l => <option key={l.id} value={l.id}>{l.level_name}</option>)}
                </select>
              </div>
            )}

            {vf.region && (
              <div style={grid2}>
                <div>
                  <label style={labelSt}>New Region</label>
                  <select style={selectSt} value={form.new_region_id} onChange={e => setField('new_region_id', e.target.value)}>
                    <option value="">— Select —</option>
                    {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>New Country</label>
                  <select style={{ ...selectSt, opacity: !form.new_region_id ? 0.5 : 1 }} value={form.new_country_id} onChange={e => setField('new_country_id', e.target.value)} disabled={!form.new_region_id}>
                    <option value="">— Select —</option>
                    {filteredCountries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
            )}

            {vf.metro && (
              <div style={fgSt}>
                <label style={labelSt}>New Metro Location</label>
                <input style={inputSt} value={form.new_metro_location} onChange={e => setField('new_metro_location', e.target.value)} placeholder="e.g. TY3, SG2, SY4" />
              </div>
            )}

            {vf.xscale && (
              <div style={fgSt}>
                <label style={labelSt}>xScale vs Retail</label>
                <select style={selectSt} value={form.xscale_vs_retail} onChange={e => setField('xscale_vs_retail', e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="xScale">xScale</option>
                  <option value="Retail">Retail</option>
                </select>
              </div>
            )}

            {vf.borrow && (
              <div style={fgSt}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                  <input type="checkbox" checked={form.is_borrowed_or_repurposed} onChange={e => setField('is_borrowed_or_repurposed', e.target.checked)} />
                  Confirm this headcount is being borrowed / repurposed
                </label>
              </div>
            )}

            <div style={divider} />

            {/* Justification + Comments */}
            <div style={fgSt}>
              <label style={labelSt}>Justification *</label>
              <textarea style={{ ...inputSt, height: 68, resize: 'vertical' }} value={form.justification} onChange={e => setField('justification', e.target.value)} placeholder="Business justification for this change…" />
            </div>

            <div style={fgSt}>
              <label style={labelSt}>Additional Comments</label>
              <textarea style={{ ...inputSt, height: 56, resize: 'vertical' }} value={form.comments} onChange={e => setField('comments', e.target.value)} placeholder="Any additional context or notes…" />
            </div>

            <div style={fgSt}>
              <label style={labelSt}>Requestor Email</label>
              <input style={inputSt} type="email" value={form.requestor_email} onChange={e => setField('requestor_email', e.target.value)} placeholder="your.email@equinix.com" />
            </div>

            <div style={modalFooter}>
              <button style={btnSecondary} onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
              <button style={btnPrimary} onClick={handleSubmit} disabled={saving || !form.change_type || !form.justification}>
                {saving ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approve / Reject modal ── */}
      {actionTarget && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setActionTarget(null); }}>
          <div style={{ ...modalBox, maxWidth: 460 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 6, color: '#111827' }}>
              {actionTarget.action === 'approve' ? 'Approve' : 'Reject'} Request #{actionTarget.req.id}
            </h2>
            <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 18 }}>
              <strong style={{ color: '#374151' }}>{actionTarget.req.change_type}</strong>
              {actionTarget.req.tbh_id && ` · TBH ${actionTarget.req.tbh_id}`}
              {actionTarget.req.submitted_by_name && ` · ${actionTarget.req.submitted_by_name}`}
            </p>

            {actionTarget.action === 'reject' && (
              <div style={fgSt}>
                <label style={labelSt}>Rejection Reason</label>
                <textarea style={{ ...inputSt, height: 64, resize: 'vertical' }} value={actionReason} onChange={e => setActionReason(e.target.value)} placeholder="Reason for rejection…" />
              </div>
            )}

            {actionTarget.action === 'approve' && (
              <>
                <div style={fgSt}>
                  <label style={labelSt}>Assign New TBH Code (if applicable)</label>
                  <input style={inputSt} value={approveForm.new_tbh_code_assigned} onChange={e => setApproveForm(f => ({ ...f, new_tbh_code_assigned: e.target.value }))} placeholder="e.g. APAC-TBH-0042" />
                </div>
                {actionTarget.req.senior_approver && (
                  <div style={fgSt}>
                    <label style={labelSt}>Senior Approver Status ({actionTarget.req.senior_approver})</label>
                    <select style={selectSt} value={approveForm.senior_approver_status} onChange={e => setApproveForm(f => ({ ...f, senior_approver_status: e.target.value }))}>
                      {SENIOR_APPROVER_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}

            <div style={fgSt}>
              <label style={labelSt}>Reviewer Notes</label>
              <textarea style={{ ...inputSt, height: 60, resize: 'vertical' }} value={approveForm.reviewer_notes} onChange={e => setApproveForm(f => ({ ...f, reviewer_notes: e.target.value }))} placeholder="Internal notes for this decision…" />
            </div>

            <div style={modalFooter}>
              <button style={btnSecondary} onClick={() => setActionTarget(null)} disabled={actioning}>Cancel</button>
              <button
                style={{ ...btnPrimary, background: actionTarget.action === 'approve' ? '#16A34A' : '#DC2626' }}
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
