import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  headcountApi, refDataApi, tbhCodesApi,
  type Person, type Discipline, type Level, type Country,
} from '../services/api';
import PersonEditPanel from '../components/PersonEditPanel';

const DISCIPLINES = ['Construction', 'Design', 'Commercial', 'Commissioning', 'Other'];

const DISCIPLINE_COLOURS: Record<string, string> = {
  'Construction': '#E65100', 'Design': '#1565C0', 'Commercial': '#1E8A4A',
  'Commissioning': '#6A1B9A', 'Other': '#888888',
};

const TYPE_META: Record<string, { label: string; bg: string; color: string; border: string }> = {
  'R FTE': { label: 'Requested FTE',     bg: '#FEF3F2', color: '#C0392B', border: '#FBBDBA' },
  'R CON': { label: 'Requested Contract', bg: '#FFF8E1', color: '#B5600A', border: '#F9E2A0' },
  'A FTE': { label: 'Approved FTE',      bg: '#EBF7EF', color: '#1E8A4A', border: '#A8DDB5' },
  'A CON': { label: 'Approved Contract', bg: '#EBF2FB', color: '#1565C0', border: '#A8C4E8' },
};

const SEL: React.CSSProperties = {
  padding: '5px 8px', border: '1px solid #D5D5D5',
  borderRadius: 4, fontSize: 12, color: '#111111', background: '#FFFFFF',
};

export default function Headcount() {
  const [records, setRecords]       = useState<Person[]>([]);
  const [loading, setLoading]       = useState(false);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [levels, setLevels]         = useState<Level[]>([]);
  const [countries, setCountries]   = useState<Country[]>([]);
  const [tbhCodes, setTbhCodes]     = useState<{ id: number; tbh_id: string }[]>([]);

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [discFilter, setDiscFilter] = useState('');

  // Edit panel
  const [editPerson, setEditPerson] = useState<Person | null>(null);

  // Approve confirm
  const [approveTarget, setApproveTarget] = useState<Person | null>(null);
  const [approving, setApproving]         = useState(false);

  // Convert to hire modal
  const [convertTarget, setConvertTarget] = useState<Person | null>(null);
  const [convertForm, setConvertForm]     = useState({
    name: '', new_contract_type_code: 'FTE', workday_jr_id: '', notes: '',
  });
  const [converting, setConverting]       = useState(false);

  // Assign TBH
  const [tbhTarget, setTbhTarget]   = useState<Person | null>(null);
  const [tbhValue, setTbhValue]     = useState('');
  const [savingTbh, setSavingTbh]   = useState(false);

  // New request modal
  const [showNew, setShowNew]       = useState(false);
  const [newForm, setNewForm]       = useState({
    name: '', contract_type_code: 'R FTE' as 'R FTE' | 'R CON',
    discipline_id: '', level_id: '', country_id: '', notes: '',
  });
  const [creating, setCreating]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setRecords(await headcountApi.list()); }
    catch { toast.error('Failed to load headcount records'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    Promise.all([
      refDataApi.disciplines(),
      refDataApi.levels(),
      refDataApi.countries(),
      tbhCodesApi.list({ limit: 500 }),
    ]).then(([d, l, c, t]) => {
      setDisciplines(d);
      setLevels(l);
      setCountries(c);
      setTbhCodes(t.map(x => ({ id: x.id, tbh_id: x.tbh_id })));
    }).catch(() => {});
  }, [load]);

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleApprove() {
    if (!approveTarget) return;
    setApproving(true);
    try {
      const updated = await headcountApi.approve(approveTarget.id);
      toast.success(`Approved → ${updated.contract_type_code}`);
      setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
      setApproveTarget(null);
    } catch (err: any) {
      toast.error(err?.message ?? 'Approval failed');
    } finally { setApproving(false); }
  }

  async function handleAssignTbh() {
    if (!tbhTarget) return;
    setSavingTbh(true);
    try {
      const updated = await headcountApi.assignTbh(tbhTarget.id, tbhValue ? Number(tbhValue) : null);
      toast.success('TBH code assigned');
      setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
      setTbhTarget(null);
      setTbhValue('');
    } catch { toast.error('Failed to assign TBH'); }
    finally { setSavingTbh(false); }
  }

  async function handleConvert() {
    if (!convertTarget || !convertForm.name.trim()) {
      toast.error('Hire name is required'); return;
    }
    setConverting(true);
    try {
      const updated = await headcountApi.convert(convertTarget.id, {
        name:                  convertForm.name.trim(),
        new_contract_type_code:convertForm.new_contract_type_code,
        workday_jr_id:         convertForm.workday_jr_id.trim() || undefined,
        notes:                 convertForm.notes.trim() || undefined,
      });
      toast.success(`Converted to ${updated.contract_type_code} — ${updated.name}`);
      setRecords(prev => prev.filter(r => r.id !== updated.id));
      setConvertTarget(null);
    } catch (err: any) {
      toast.error(err?.message ?? 'Conversion failed');
    } finally { setConverting(false); }
  }

  async function handleCreate() {
    if (!newForm.name.trim()) { toast.error('Name is required'); return; }
    setCreating(true);
    try {
      const created = await headcountApi.create({
        name:               newForm.name.trim(),
        contract_type_code: newForm.contract_type_code,
        discipline_id:      newForm.discipline_id ? Number(newForm.discipline_id) : undefined,
        level_id:           newForm.level_id ? Number(newForm.level_id) : undefined,
        country_id:         newForm.country_id ? Number(newForm.country_id) : undefined,
        notes:              newForm.notes.trim() || undefined,
      });
      toast.success('Headcount request created');
      setRecords(prev => [created, ...prev]);
      setShowNew(false);
      setNewForm({ name: '', contract_type_code: 'R FTE', discipline_id: '', level_id: '', country_id: '', notes: '' });
    } catch { toast.error('Failed to create request'); }
    finally { setCreating(false); }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const filtered = records.filter(r => {
    if (typeFilter && r.contract_type_code !== typeFilter) return false;
    if (discFilter && r.discipline_name !== discFilter) return false;
    return true;
  });

  const byDiscipline = DISCIPLINES.map(disc => ({
    discipline: disc,
    rows: filtered.filter(r => (r.discipline_name ?? 'Other') === disc),
  })).filter(g => g.rows.length > 0);

  const ungrouped = filtered.filter(r => !DISCIPLINES.includes(r.discipline_name ?? 'Other'));

  // ── Shared badge ─────────────────────────────────────────────────────────

  function TypeBadge({ code }: { code: string | null }) {
    const meta = TYPE_META[code ?? ''] ?? { label: code ?? '?', bg: '#F0F0F0', color: '#444444', border: '#D0D0D0' };
    return (
      <span style={{
        padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
        background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
        whiteSpace: 'nowrap',
      }}>
        {code}
      </span>
    );
  }

  // ── Row render ────────────────────────────────────────────────────────────

  function RecordRow({ r }: { r: Person }) {
    const isRequested = r.contract_type_code === 'R FTE' || r.contract_type_code === 'R CON';
    const isApproved  = r.contract_type_code === 'A FTE' || r.contract_type_code === 'A CON';
    const allowedConversion = r.contract_type_code === 'A FTE' ? ['FTE', 'SNR'] : ['CON'];

    return (
      <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
        <td style={{ padding: '8px 14px', width: 110 }}>
          <TypeBadge code={r.contract_type_code} />
        </td>
        <td style={{ padding: '8px 14px' }}>
          <div
            style={{ fontWeight: 600, fontSize: 13, cursor: 'pointer', color: '#1565C0',
              textDecoration: 'underline', textDecorationStyle: 'dotted' }}
            onClick={() => setEditPerson(r)}
            title="Click to edit"
          >
            {r.name}
          </div>
          {r.notes && (
            <div style={{ fontSize: 11, color: '#777777', marginTop: 2, maxWidth: 300,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {r.notes}
            </div>
          )}
        </td>
        <td style={{ padding: '8px 14px', fontSize: 12, color: '#444444' }}>
          {r.level_name ?? '—'}
        </td>
        <td style={{ padding: '8px 14px', fontSize: 12, color: '#444444' }}>
          {r.country_names || '—'}
        </td>
        <td style={{ padding: '8px 14px' }}>
          {r.tbh_id
            ? <span style={{ fontSize: 11, fontWeight: 600, color: '#1E8A4A', background: '#EBF7EF',
                padding: '2px 7px', borderRadius: 3, border: '1px solid #A8DDB5' }}>{r.tbh_id}</span>
            : <span style={{ fontSize: 11, color: '#AAAAAA' }}>Not assigned</span>}
        </td>
        <td style={{ padding: '8px 14px' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {isRequested && (
              <button onClick={() => setApproveTarget(r)} style={{
                padding: '4px 10px', background: '#EBF7EF', color: '#1E8A4A',
                border: '1px solid #A8DDB5', borderRadius: 4, fontSize: 11,
                cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
              }}>
                ✓ Approve
              </button>
            )}
            {isApproved && (
              <>
                <button onClick={() => { setTbhTarget(r); setTbhValue(String(r.tbh_code_id ?? '')); }} style={{
                  padding: '4px 10px', background: '#EBF2FB', color: '#1565C0',
                  border: '1px solid #A8C4E8', borderRadius: 4, fontSize: 11,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                  TBH Code
                </button>
                <button onClick={() => {
                  setConvertTarget(r);
                  setConvertForm({
                    name: '', new_contract_type_code: allowedConversion[0],
                    workday_jr_id: '', notes: r.notes ?? '',
                  });
                }} style={{
                  padding: '4px 10px', background: '#FFF8E1', color: '#B5600A',
                  border: '1px solid #F9E2A0', borderRadius: 4, fontSize: 11,
                  cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                  → Convert to Hire
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const counts = {
    total: records.length,
    rFte:  records.filter(r => r.contract_type_code === 'R FTE').length,
    rCon:  records.filter(r => r.contract_type_code === 'R CON').length,
    aFte:  records.filter(r => r.contract_type_code === 'A FTE').length,
    aCon:  records.filter(r => r.contract_type_code === 'A CON').length,
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', color: '#111111' }}>

      {/* Header */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#181A1E', borderBottom: '2px solid #E31837', padding: '8px 16px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFF', lineHeight: 1 }}>Headcount Requests</div>
          <button onClick={() => setShowNew(true)} style={{
            padding: '5px 14px', background: '#E31837', color: '#FFFFFF',
            border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            + New Request
          </button>
        </div>
        <div style={{ padding: '10px 16px', background: '#FFFFFF', borderBottom: '1px solid #E5E5E5' }}>

        {/* Summary chips */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Total', value: counts.total, color: '#444444', bg: '#F0F0F0' },
            { label: 'R FTE', value: counts.rFte, color: '#C0392B', bg: '#FEF3F2' },
            { label: 'R CON', value: counts.rCon, color: '#B5600A', bg: '#FFF8E1' },
            { label: 'A FTE', value: counts.aFte, color: '#1E8A4A', bg: '#EBF7EF' },
            { label: 'A CON', value: counts.aCon, color: '#1565C0', bg: '#EBF2FB' },
          ].map(s => (
            <div key={s.label} style={{
              padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
              color: s.color, background: s.bg, whiteSpace: 'nowrap',
            }}>
              {s.label}: {s.value}
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={SEL}>
            <option value="">All types</option>
            <option value="R FTE">R FTE</option>
            <option value="R CON">R CON</option>
            <option value="A FTE">A FTE</option>
            <option value="A CON">A CON</option>
          </select>
          <select value={discFilter} onChange={e => setDiscFilter(e.target.value)} style={SEL}>
            <option value="">All disciplines</option>
            {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <button onClick={load} style={{
            padding: '5px 12px', background: 'transparent',
            border: '1px solid #D5D5D5', borderRadius: 4, fontSize: 12,
            color: '#555555', cursor: 'pointer',
          }}>↻ Refresh</button>
        </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 40 }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888888' }}>
            No headcount requests found.
            <div style={{ marginTop: 8, fontSize: 13 }}>
              Use "+ New Request" or the "Request headcount" button in the Allocations table.
            </div>
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#F8F9FA', position: 'sticky', top: 0 }}>
                <th style={TH}>Type</th>
                <th style={TH}>Name / Placeholder</th>
                <th style={TH}>Level</th>
                <th style={TH}>Country</th>
                <th style={TH}>TBH Code</th>
                <th style={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {byDiscipline.map(({ discipline, rows }) => (
                <React.Fragment key={discipline}>
                  <tr>
                    <td colSpan={6} style={{
                      padding: '8px 14px', background: '#F2F4F8',
                      borderLeft: `4px solid ${DISCIPLINE_COLOURS[discipline] ?? '#888888'}`,
                      borderTop: '2px solid #D8DDE8', borderBottom: '1px solid #D8DDE8',
                      fontWeight: 700, fontSize: 12, color: DISCIPLINE_COLOURS[discipline] ?? '#444444',
                    }}>
                      {discipline} · {rows.length} {rows.length === 1 ? 'record' : 'records'}
                    </td>
                  </tr>
                  {rows.map(r => <RecordRow key={r.id} r={r} />)}
                </React.Fragment>
              ))}
              {ungrouped.length > 0 && (
                <React.Fragment>
                  <tr>
                    <td colSpan={6} style={{
                      padding: '8px 14px', background: '#F8F9FA',
                      fontWeight: 700, fontSize: 12, color: '#888888',
                    }}>
                      Unassigned discipline
                    </td>
                  </tr>
                  {ungrouped.map(r => <RecordRow key={r.id} r={r} />)}
                </React.Fragment>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Person edit panel ── */}
      <PersonEditPanel
        person={editPerson}
        onClose={() => setEditPerson(null)}
        onSaved={updated => {
          setRecords(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
          setEditPerson(null);
        }}
      />

      {/* ── Approve confirm ── */}
      {approveTarget && (
        <Modal onClose={() => setApproveTarget(null)}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Approve Headcount?</div>
          <p style={{ fontSize: 13, color: '#444444', margin: '0 0 16px' }}>
            This will change <strong>{approveTarget.name}</strong> from{' '}
            <strong>{approveTarget.contract_type_code}</strong> to{' '}
            <strong>{approveTarget.contract_type_code === 'R FTE' ? 'A FTE' : 'A CON'}</strong>.
            <br />A TBH code should then be assigned.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setApproveTarget(null)} style={CANCEL_BTN}>Cancel</button>
            <button onClick={handleApprove} disabled={approving} style={OK_BTN}>
              {approving ? 'Approving…' : 'Approve'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Assign TBH ── */}
      {tbhTarget && (
        <Modal onClose={() => setTbhTarget(null)}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Assign TBH Code</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
              TBH Code
            </label>
            <select
              style={{ padding: '8px 10px', border: '1px solid #D5D5D5', borderRadius: 4, fontSize: 13 }}
              value={tbhValue}
              onChange={e => setTbhValue(e.target.value)}
            >
              <option value="">— Remove assignment —</option>
              {tbhCodes.map(t => <option key={t.id} value={t.id}>{t.tbh_id}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setTbhTarget(null)} style={CANCEL_BTN}>Cancel</button>
            <button onClick={handleAssignTbh} disabled={savingTbh} style={OK_BTN}>
              {savingTbh ? 'Saving…' : 'Assign TBH'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Convert to hire ── */}
      {convertTarget && (
        <Modal onClose={() => setConvertTarget(null)}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>Convert to Named Hire</div>
          <p style={{ fontSize: 12, color: '#666666', margin: '0 0 14px' }}>
            Converting <strong>{convertTarget.name}</strong> ({convertTarget.contract_type_code}).
            Enter the hire's real name and select the final contract type.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Hire's full name *">
              <input style={INP} value={convertForm.name}
                onChange={e => setConvertForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="First Last" />
            </Field>
            <Field label="Contract type *">
              <select style={INP}
                value={convertForm.new_contract_type_code}
                onChange={e => setConvertForm(prev => ({ ...prev, new_contract_type_code: e.target.value }))}>
                {(convertTarget.contract_type_code === 'A FTE' ? ['FTE', 'SNR'] : ['CON'])
                  .map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Workday JR ID">
              <input style={INP} value={convertForm.workday_jr_id}
                onChange={e => setConvertForm(prev => ({ ...prev, workday_jr_id: e.target.value }))}
                placeholder="JR-000000" />
            </Field>
            <Field label="Notes">
              <textarea rows={2} style={{ ...INP, resize: 'vertical', fontFamily: 'inherit' }}
                value={convertForm.notes}
                onChange={e => setConvertForm(prev => ({ ...prev, notes: e.target.value }))} />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={() => setConvertTarget(null)} style={CANCEL_BTN}>Cancel</button>
            <button onClick={handleConvert} disabled={converting} style={OK_BTN}>
              {converting ? 'Converting…' : 'Confirm Hire'}
            </button>
          </div>
        </Modal>
      )}

      {/* ── New request modal ── */}
      {showNew && (
        <Modal onClose={() => setShowNew(false)}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>New Headcount Request</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Field label="Placeholder name *">
              <input style={INP} value={newForm.name}
                onChange={e => setNewForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. TBH – Construction VP" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Type">
                <select style={INP}
                  value={newForm.contract_type_code}
                  onChange={e => setNewForm(prev => ({ ...prev, contract_type_code: e.target.value as 'R FTE' | 'R CON' }))}>
                  <option value="R FTE">R FTE — Employee</option>
                  <option value="R CON">R CON — Contractor</option>
                </select>
              </Field>
              <Field label="Discipline">
                <select style={INP}
                  value={newForm.discipline_id}
                  onChange={e => setNewForm(prev => ({ ...prev, discipline_id: e.target.value }))}>
                  <option value="">— None —</option>
                  {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Level">
                <select style={INP}
                  value={newForm.level_id}
                  onChange={e => setNewForm(prev => ({ ...prev, level_id: e.target.value }))}>
                  <option value="">— None —</option>
                  {levels.map(l => <option key={l.id} value={l.id}>{l.level_name}</option>)}
                </select>
              </Field>
              <Field label="Country">
                <select style={INP}
                  value={newForm.country_id}
                  onChange={e => setNewForm(prev => ({ ...prev, country_id: e.target.value }))}>
                  <option value="">— None —</option>
                  {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Notes / Justification">
              <textarea rows={3} style={{ ...INP, resize: 'vertical', fontFamily: 'inherit' }}
                value={newForm.notes}
                onChange={e => setNewForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Why is this role needed?" />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button onClick={() => setShowNew(false)} style={CANCEL_BTN}>Cancel</button>
            <button onClick={handleCreate} disabled={creating} style={OK_BTN}>
              {creating ? 'Creating…' : 'Submit Request'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Shared small components ────────────────────────────────────────────────

const TH: React.CSSProperties = {
  padding: '9px 14px', textAlign: 'left', fontSize: 11,
  color: '#666666', fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '0.06em', borderBottom: '1px solid #E0E0E0',
  whiteSpace: 'nowrap',
};

const INP: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid #D5D5D5', borderRadius: 4,
  fontSize: 13, width: '100%', boxSizing: 'border-box', background: '#FFFFFF',
};

const CANCEL_BTN: React.CSSProperties = {
  flex: 1, padding: '9px 0', background: '#FFFFFF',
  border: '1px solid #D5D5D5', borderRadius: 5, fontSize: 13,
  color: '#555555', cursor: 'pointer',
};

const OK_BTN: React.CSSProperties = {
  flex: 2, padding: '9px 0', background: '#E31837',
  border: 'none', borderRadius: 5, fontSize: 13,
  fontWeight: 600, color: '#FFFFFF', cursor: 'pointer',
};

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 500,
      }} />
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 440, maxHeight: '85vh', overflowY: 'auto',
        background: '#FFFFFF', borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 501,
        padding: 24,
      }}>
        {children}
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
