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
// Styles
// ---------------------------------------------------------------------------

const INPUT: React.CSSProperties = {
  width: '100%', padding: '8px 11px', background: '#FFFFFF',
  border: '1px solid #D5D5D5', borderRadius: 6,
  color: '#111111', fontSize: 13, outline: 'none', boxSizing: 'border-box',
};
const SELECT: React.CSSProperties = { ...INPUT, cursor: 'pointer' };
const LABEL: React.CSSProperties = {
  display: 'block', fontSize: 10, fontWeight: 700, color: '#666666',
  marginBottom: 4, letterSpacing: '0.07em', textTransform: 'uppercase',
};
const BTN_PRIMARY: React.CSSProperties = {
  padding: '8px 18px', background: '#E31837', color: '#FFFFFF',
  border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
const BTN_SECONDARY: React.CSSProperties = {
  padding: '8px 18px', background: '#FFFFFF', color: '#555555',
  border: '1px solid #D5D5D5', borderRadius: 6, fontSize: 13, cursor: 'pointer',
};

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  Pending:  { bg: '#FFF8E1', color: '#B5600A', border: '#F9A825' },
  Approved: { bg: '#EBF7EF', color: '#1E8A4A', border: '#A8DDB5' },
  Rejected: { bg: '#FEF3F2', color: '#C0392B', border: '#FBBDBA' },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: '#F0F0F0', color: '#555555', border: '#D0D0D0' };
  return (
    <span style={{
      padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {status}
    </span>
  );
}

function RequestTypeBadge({ type }: { type: string }) {
  return (
    <span style={{
      padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 600,
      background: '#F0F0FF', color: '#4455CC', border: '1px solid #BBCCE8',
      whiteSpace: 'nowrap',
    }}>
      {type}
    </span>
  );
}

function StageProgress({ stage, status }: { stage: number; status: string }) {
  const isApproved = status === 'Approved';
  const isRejected = status === 'Rejected';
  const activeStep = isApproved ? 4 : stage - 1;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 10 }}>
      {STAGE_LABELS.map((lbl, i) => {
        const done    = isApproved || (!isRejected && i < activeStep);
        const current = !isApproved && !isRejected && i === activeStep;
        const dotColor  = isRejected ? '#E0E0E0'
                        : done       ? '#1E8A4A'
                        : current    ? '#B5600A'
                        : '#D0D0D0';
        const textColor = isRejected ? '#BBBBBB'
                        : done       ? '#1E8A4A'
                        : current    ? '#B5600A'
                        : '#AAAAAA';
        return (
          <div key={lbl} style={{ display: 'flex', alignItems: 'center' }}>
            <div title={lbl} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: done ? '#1E8A4A' : current ? '#FFF8E1' : '#F0F0F0',
                border: `2px solid ${dotColor}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: dotColor,
              }}>
                {done && !isRejected ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 9, color: textColor, whiteSpace: 'nowrap' }}>{lbl}</span>
            </div>
            {i < 3 && (
              <div style={{
                width: 28, height: 2, marginBottom: 14,
                background: done && !isRejected ? '#1E8A4A' : '#E0E0E0',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Modal wrapper
// ---------------------------------------------------------------------------

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#FFFFFF', borderRadius: 10, width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto', padding: '24px 28px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)', border: '1px solid #E5E5E5',
      }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: '#111111', marginBottom: 20 }}>{title}</div>
        {children}
      </div>
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
const emptyForm: FormState = {
  request_type: 'New Hire', discipline_id: '', level_id: '', contract_type_id: '',
  region_id: '', country_id: '', project_id: '', justification: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HireRequests() {
  const [requests, setRequests]     = useState<HireRequest[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [levels, setLevels]         = useState<Level[]>([]);
  const [contractTypes, setContractTypes] = useState<ContractType[]>([]);
  const [regions, setRegions]       = useState<Region[]>([]);
  const [countries, setCountries]   = useState<Country[]>([]);

  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm]           = useState<FormState>(emptyForm);
  const [saving, setSaving]       = useState(false);

  const [rejectTarget, setRejectTarget] = useState<HireRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting]       = useState(false);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    Promise.all([
      refDataApi.disciplines().catch(() => [] as Discipline[]),
      refDataApi.levels().catch(() => [] as Level[]),
      refDataApi.contractTypes().catch(() => [] as ContractType[]),
      refDataApi.regions().catch(() => [] as Region[]),
      refDataApi.countries().catch(() => [] as Country[]),
    ]).then(([d, l, c, r, co]) => {
      setDisciplines(d); setLevels(l); setContractTypes(c); setRegions(r); setCountries(co);
    });
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

  const filteredCountries = useMemo(
    () => form.region_id ? countries.filter(c => String(c.region_id) === form.region_id) : countries,
    [form.region_id, countries]
  );

  function setField(k: keyof FormState, v: string) {
    setForm(f => ({ ...f, [k]: v, ...(k === 'region_id' ? { country_id: '' } : {}) }));
  }

  async function handleSubmit() {
    if (!form.request_type) return;
    setSaving(true);
    try {
      const body: CreateHireRequestBody = {
        request_type:     form.request_type,
        discipline_id:    form.discipline_id    ? parseInt(form.discipline_id, 10)    : null,
        level_id:         form.level_id         ? parseInt(form.level_id, 10)         : null,
        contract_type_id: form.contract_type_id ? parseInt(form.contract_type_id, 10) : null,
        region_id:        form.region_id        ? parseInt(form.region_id, 10)        : null,
        country_id:       form.country_id       ? parseInt(form.country_id, 10)       : null,
        justification:    form.justification || null,
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
    all:      requests.length,
    pending:  requests.filter(r => r.status === 'Pending').length,
    approved: requests.filter(r => r.status === 'Approved').length,
    rejected: requests.filter(r => r.status === 'Rejected').length,
  }), [requests]);

  function toggleExpanded(id: number) {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ color: '#111111', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '14px 20px', background: '#FFFFFF', borderBottom: '1px solid #E5E5E5', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Hire Requests</h1>
            <div style={{ width: 36, height: 3, background: '#E31837', borderRadius: 2, marginTop: 4 }} />
          </div>
          <button style={BTN_PRIMARY} onClick={() => { setForm(emptyForm); setModalOpen(true); }}>
            + New Request
          </button>
        </div>

        {/* Status tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid #E5E5E5' }}>
          {[
            { label: `All`,      value: '',         count: counts.all },
            { label: `Pending`,  value: 'Pending',  count: counts.pending },
            { label: `Approved`, value: 'Approved', count: counts.approved },
            { label: `Rejected`, value: 'Rejected', count: counts.rejected },
          ].map(({ label, value, count }) => (
            <button key={value} onClick={() => setStatusFilter(value)} style={{
              padding: '8px 16px', background: 'transparent', border: 'none',
              borderBottom: statusFilter === value ? '2px solid #E31837' : '2px solid transparent',
              color: statusFilter === value ? '#111111' : '#888888',
              fontSize: 13, cursor: 'pointer', fontWeight: statusFilter === value ? 700 : 400,
              marginBottom: -1,
            }}>
              {label}
              <span style={{
                marginLeft: 6, padding: '1px 7px', borderRadius: 10, fontSize: 11,
                background: statusFilter === value ? '#E31837' : '#F0F0F0',
                color: statusFilter === value ? '#FFFFFF' : '#666666',
              }}>
                {count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div className="spinner" />
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#C0392B' }}>
            {error}
            <button style={{ ...BTN_SECONDARY, marginLeft: 12 }} onClick={loadRequests}>Retry</button>
          </div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#888888', fontSize: 14 }}>
            No hire requests found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {requests.map(r => {
              const isExpanded_ = expanded.has(r.id);
              return (
                <div key={r.id} style={{
                  background: '#FFFFFF', border: '1px solid #E5E5E5',
                  borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  overflow: 'hidden',
                }}>
                  {/* Card top */}
                  <div style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Type + status + ID */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                          <RequestTypeBadge type={r.request_type} />
                          <StatusBadge status={r.status} />
                          <span style={{ fontSize: 11, color: '#AAAAAA' }}>#{r.id}</span>
                        </div>

                        {/* Key details chips */}
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                          {r.discipline_name && <Chip label="Discipline" value={r.discipline_name} />}
                          {r.level_name      && <Chip label="Level"      value={r.level_name} />}
                          {r.contract_type_code && <Chip label="Contract" value={r.contract_type_code} />}
                          {r.region_name     && <Chip label="Region"     value={r.region_name} />}
                          {r.country_name    && <Chip label="Country"    value={r.country_name} />}
                          {r.project_name    && <Chip label="Project"    value={r.project_name} />}
                        </div>

                        {/* Stage progress */}
                        <StageProgress stage={r.stage} status={r.status} />

                        {/* Submitter + date */}
                        {r.submitted_by_name && (
                          <div style={{ fontSize: 11, color: '#888888', marginTop: 6 }}>
                            Submitted by <strong style={{ color: '#555555' }}>{r.submitted_by_name}</strong>
                            {' · '}
                            {new Date(r.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'flex-end' }}>
                        {r.status === 'Pending' && (
                          <>
                            <button onClick={() => handleApprove(r.id)} style={{
                              padding: '5px 12px', background: '#EBF7EF', color: '#1E8A4A',
                              border: '1px solid #A8DDB5', borderRadius: 4, fontSize: 12,
                              fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                            }}>
                              ✓ Approve Stage {r.stage}
                            </button>
                            <button onClick={() => { setRejectTarget(r); setRejectReason(''); }} style={{
                              padding: '5px 12px', background: '#FEF3F2', color: '#C0392B',
                              border: '1px solid #FBBDBA', borderRadius: 4, fontSize: 12,
                              fontWeight: 600, cursor: 'pointer',
                            }}>
                              ✕ Reject
                            </button>
                          </>
                        )}
                        <button onClick={() => toggleExpanded(r.id)} style={{
                          padding: '4px 10px', background: 'transparent',
                          border: '1px solid #E0E0E0', borderRadius: 4,
                          fontSize: 11, color: '#888888', cursor: 'pointer',
                        }}>
                          {isExpanded_ ? 'Less ▲' : 'More ▼'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded justification */}
                  {isExpanded_ && (
                    <div style={{
                      padding: '12px 18px', borderTop: '1px solid #F0F0F0',
                      background: '#FAFAFA',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#888888', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                        Justification
                      </div>
                      <div style={{ fontSize: 13, color: '#333333', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                        {r.justification || <span style={{ color: '#AAAAAA', fontStyle: 'italic' }}>No justification provided</span>}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── New Request modal ── */}
      {modalOpen && (
        <Modal title="Submit Hire Request" onClose={() => setModalOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={LABEL}>Request Type *</label>
              <select style={SELECT} value={form.request_type} onChange={e => setField('request_type', e.target.value)}>
                {REQUEST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL}>Level</label>
                <select style={SELECT} value={form.level_id} onChange={e => setField('level_id', e.target.value)}>
                  <option value="">— Any —</option>
                  {levels.map(l => <option key={l.id} value={l.id}>{l.level_name}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL}>Discipline</label>
                <select style={SELECT} value={form.discipline_id} onChange={e => setField('discipline_id', e.target.value)}>
                  <option value="">— Any —</option>
                  {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={LABEL}>Contract Type</label>
                <select style={SELECT} value={form.contract_type_id} onChange={e => setField('contract_type_id', e.target.value)}>
                  <option value="">— Any —</option>
                  {contractTypes.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                </select>
              </div>
              <div>
                <label style={LABEL}>Region</label>
                <select style={SELECT} value={form.region_id} onChange={e => setField('region_id', e.target.value)}>
                  <option value="">— Any —</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            {form.region_id && (
              <div>
                <label style={LABEL}>Country</label>
                <select style={SELECT} value={form.country_id} onChange={e => setField('country_id', e.target.value)}>
                  <option value="">— Any —</option>
                  {filteredCountries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label style={LABEL}>Justification / Business Case</label>
              <textarea
                style={{ ...INPUT, height: 80, resize: 'vertical' as const, fontFamily: 'inherit' }}
                value={form.justification}
                onChange={e => setField('justification', e.target.value)}
                placeholder="Why is this hire needed? What project / workload does it support?"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22, paddingTop: 18, borderTop: '1px solid #EEEEEE' }}>
            <button style={BTN_SECONDARY} onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
            <button style={BTN_PRIMARY} onClick={handleSubmit} disabled={saving}>
              {saving ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Reject modal ── */}
      {rejectTarget && (
        <Modal title={`Reject Request #${rejectTarget.id}`} onClose={() => setRejectTarget(null)}>
          <p style={{ color: '#444444', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
            <RequestTypeBadge type={rejectTarget.request_type} />
            {rejectTarget.discipline_name && ` · ${rejectTarget.discipline_name}`}
            {rejectTarget.level_name && ` · ${rejectTarget.level_name}`}
          </p>
          <div>
            <label style={LABEL}>Rejection Reason (optional)</label>
            <textarea
              style={{ ...INPUT, height: 72, resize: 'vertical' as const, fontFamily: 'inherit' }}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Reason for rejection…"
            />
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 22, paddingTop: 18, borderTop: '1px solid #EEEEEE' }}>
            <button style={BTN_SECONDARY} onClick={() => setRejectTarget(null)} disabled={rejecting}>Cancel</button>
            <button style={{ ...BTN_PRIMARY, background: '#C0392B' }} onClick={handleReject} disabled={rejecting}>
              {rejecting ? 'Rejecting…' : 'Confirm Reject'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared chip
// ---------------------------------------------------------------------------

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span style={{
      padding: '3px 9px', borderRadius: 4, fontSize: 11,
      background: '#F5F5F5', color: '#444444', border: '1px solid #E5E5E5',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ color: '#888888', marginRight: 3 }}>{label}:</span>
      <strong>{value}</strong>
    </span>
  );
}
