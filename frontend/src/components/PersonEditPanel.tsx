import React, { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  peopleApi, refDataApi, tbhCodesApi, countryAllocationsApi, personCommentsApi,
  type Person, type Discipline, type Level, type ContractType, type Region, type Country,
  type CountryAllocation, type PersonComment,
} from '../services/api';

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_GRADIENT = [
  ['#086AE3', '#3A8FF5'],
  ['#33A85C', '#5BC87E'],
  ['#C59000', '#F0B400'],
  ['#00737A', '#009EA8'],
  ['#7739D9', '#9A5FF0'],
];

function avatarGradient(name: string): string {
  const idx = name.charCodeAt(0) % AVATAR_GRADIENT.length;
  const [a, b] = AVATAR_GRADIENT[idx];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

const COUNTRY_FLAGS: Record<string, string> = {
  'Australia': 'au', 'Austria': 'at', 'Bahrain': 'bh', 'Belgium': 'be',
  'Brazil': 'br', 'Canada': 'ca', 'Chile': 'cl', 'China': 'cn',
  'Colombia': 'co', 'Czech Republic': 'cz', 'Denmark': 'dk', 'Egypt': 'eg',
  'Finland': 'fi', 'France': 'fr', 'Germany': 'de', 'Greece': 'gr',
  'Hong Kong': 'hk', 'Hungary': 'hu', 'India': 'in', 'Indonesia': 'id',
  'Ireland': 'ie', 'Israel': 'il', 'Italy': 'it', 'Japan': 'jp',
  'Jordan': 'jo', 'Kenya': 'ke', 'Kuwait': 'kw', 'Luxembourg': 'lu',
  'Malaysia': 'my', 'Mexico': 'mx', 'Morocco': 'ma', 'Netherlands': 'nl',
  'New Zealand': 'nz', 'Nigeria': 'ng', 'Norway': 'no', 'Oman': 'om',
  'Panama': 'pa', 'Peru': 'pe', 'Philippines': 'ph', 'Poland': 'pl',
  'Portugal': 'pt', 'Qatar': 'qa', 'Romania': 'ro', 'Saudi Arabia': 'sa',
  'Singapore': 'sg', 'Slovakia': 'sk', 'South Africa': 'za', 'South Korea': 'kr',
  'Spain': 'es', 'Sweden': 'se', 'Switzerland': 'ch', 'Taiwan': 'tw',
  'Thailand': 'th', 'Turkey': 'tr', 'United Arab Emirates': 'ae',
  'United Kingdom': 'gb', 'United States': 'us', 'Vietnam': 'vn',
  'UK': 'gb', 'USA': 'us', 'UAE': 'ae', 'Korea': 'kr', 'Serbia': 'rs',
};

function flagUrl(country: string): string | null {
  const code = COUNTRY_FLAGS[country];
  return code ? `https://flagcdn.com/w20/${code}.png` : null;
}

interface Props {
  person: Person | null;
  onClose: () => void;
  onSaved: (updated: Person) => void;
  // Allocation context (optional — only passed from Allocations page)
  countryAllocs?: CountryAllocation[];
  countryGroups?: { countryId: number; countryName: string }[];
  selectedCycleId?: number | null;
  onAllocsSaved?: () => void;
}

const FIELD: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
};
const LBL: React.CSSProperties = {
  fontSize: 10, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600,
};
const INPUT: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid #D5D5D5', borderRadius: 4,
  fontSize: 13, color: '#111111', background: '#FFFFFF', outline: 'none',
  width: '100%', boxSizing: 'border-box',
};
const SEL: React.CSSProperties = { ...INPUT, cursor: 'pointer' };

const CONTRACT_CATEGORY_LABELS: Record<string, string> = {
  existing:  'Hired',
  approved:  'Approved (pending hire)',
  requested: 'Requested (pending approval)',
};

const PLACEHOLDER_TYPES = ['R FTE', 'R CON', 'A FTE', 'A CON'];

export default function PersonEditPanel({ person, onClose, onSaved, countryAllocs, countryGroups, selectedCycleId, onAllocsSaved }: Props) {
  const [disciplines, setDisciplines]   = useState<Discipline[]>([]);
  const [levels, setLevels]             = useState<Level[]>([]);
  const [contractTypes, setContractTypes] = useState<ContractType[]>([]);
  const [regions, setRegions]           = useState<Region[]>([]);
  const [countries, setCountries]       = useState<Country[]>([]);
  const [tbhCodes, setTbhCodes]         = useState<{ id: number; tbh_id: string }[]>([]);
  const [saving, setSaving]             = useState(false);

  // Country allocation editing state
  const [allocEntries, setAllocEntries] = useState<Record<number, string>>({});
  const [allocSaving, setAllocSaving]   = useState(false);

  // Comments state
  const [comments, setComments]             = useState<PersonComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError]   = useState(false);
  const [newComment, setNewComment]         = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [commentsTick, setCommentsTick]     = useState(0);

  const [form, setForm] = useState({
    name:             '',
    level_id:         '' as string | number,
    discipline_id:    '' as string | number,
    contract_type_id: '' as string | number,
    contracted_fte:   '1.0',
    tbh_code_id:      '' as string | number,
    workday_jr_id:    '',
    notes:            '',
    region_ids:       [] as number[],
    country_ids:      [] as number[],
  });

  const loadRefData = useCallback(async () => {
    const [d, l, ct, r, c, tbh] = await Promise.all([
      refDataApi.disciplines(),
      refDataApi.levels(),
      refDataApi.contractTypes(),
      refDataApi.regions(),
      refDataApi.countries(),
      tbhCodesApi.list({ limit: 500 }),
    ]);
    setDisciplines(d);
    setLevels(l);
    setContractTypes(ct);
    setRegions(r);
    setCountries(c);
    setTbhCodes(tbh.map(t => ({ id: t.id, tbh_id: t.tbh_id })));
  }, []);

  useEffect(() => { loadRefData(); }, [loadRefData]);

  useEffect(() => {
    if (!person) return;
    setForm({
      name:             person.name ?? '',
      level_id:         person.level_id ?? '',
      discipline_id:    person.discipline_id ?? '',
      contract_type_id: person.contract_type_id ?? '',
      contracted_fte:   String(person.contracted_fte ?? '1.0'),
      tbh_code_id:      person.tbh_code_id ?? '',
      workday_jr_id:    person.workday_jr_id ?? '',
      notes:            person.notes ?? '',
      region_ids:       [],
      country_ids:      [],
    });

    if (person.id) {
      peopleApi.get(person.id).then(detail => {
        setForm(prev => ({
          ...prev,
          region_ids:  detail.regions.map(r => r.region_id),
          country_ids: detail.countries.map(c => c.country_id),
        }));
      }).catch(() => {});
    }
  }, [person]);

  // Initialise alloc entries from passed prop
  useEffect(() => {
    if (!countryAllocs) { setAllocEntries({}); return; }
    const entries: Record<number, string> = {};
    for (const a of countryAllocs) {
      entries[a.country_id] = String(a.fte_value);
    }
    setAllocEntries(entries);
  }, [countryAllocs]);

  // Load comments whenever the person changes
  useEffect(() => {
    if (!person?.id) { setComments([]); return; }
    setCommentsLoading(true);
    setCommentsError(false);
    personCommentsApi.list(person.id)
      .then(rows => setComments(rows))
      .catch(() => setCommentsError(true))
      .finally(() => setCommentsLoading(false));
  }, [person?.id, commentsTick]);

  const allocTotal = countryGroups
    ? countryGroups.reduce((s, g) => s + (parseFloat(allocEntries[g.countryId] ?? '0') || 0), 0)
    : 0;

  async function saveAllocs() {
    if (!person) return;
    const allocs = (countryGroups ?? []).map(g => ({
      country_id: g.countryId,
      fte_value: parseFloat(allocEntries[g.countryId] ?? '0') || 0,
    })).filter(a => a.fte_value > 0);
    if (allocTotal > 1.001) { toast.error(`Total FTE ${allocTotal.toFixed(2)} exceeds 1.0`); return; }
    setAllocSaving(true);
    try {
      await countryAllocationsApi.save(person.id, selectedCycleId ?? null, allocs);
      toast.success('Allocations saved');
      onAllocsSaved?.();
    } catch {
      toast.error('Failed to save allocations');
    } finally {
      setAllocSaving(false);
    }
  }

  async function postComment() {
    if (!person || !newComment.trim()) return;
    setPostingComment(true);
    try {
      await personCommentsApi.create(person.id, newComment.trim());
      setNewComment('');
      setCommentsTick(t => t + 1);
    } catch {
      toast.error('Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  }

  function set(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleRegion(id: number) {
    setForm(prev => ({
      ...prev,
      region_ids: prev.region_ids.includes(id)
        ? prev.region_ids.filter(r => r !== id)
        : [...prev.region_ids, id],
    }));
  }

  function toggleCountry(id: number) {
    setForm(prev => ({
      ...prev,
      country_ids: prev.country_ids.includes(id)
        ? prev.country_ids.filter(c => c !== id)
        : [...prev.country_ids, id],
    }));
  }

  async function handleSave() {
    if (!person || !form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    setSaving(true);
    try {
      const updated = await peopleApi.update(person.id, {
        name:             form.name.trim(),
        level_id:         form.level_id !== '' ? Number(form.level_id) : null,
        discipline_id:    form.discipline_id !== '' ? Number(form.discipline_id) : null,
        contract_type_id: form.contract_type_id !== '' ? Number(form.contract_type_id) : null,
        contracted_fte:   parseFloat(form.contracted_fte) || 1.0,
        tbh_code_id:      form.tbh_code_id !== '' ? Number(form.tbh_code_id) : null,
        workday_jr_id:    form.workday_jr_id.trim() || null,
        notes:            form.notes.trim() || null,
        region_ids:       form.region_ids,
        country_ids:      form.country_ids,
      });
      toast.success('Saved');
      onSaved(updated);
    } catch {
      toast.error('Failed to save — check your connection');
    } finally {
      setSaving(false);
    }
  }

  if (!person) return null;

  const isPlaceholder = PLACEHOLDER_TYPES.includes(person.contract_type_code ?? '');
  const filteredCountries = form.region_ids.length > 0
    ? countries.filter(c => form.region_ids.includes(c.region_id))
    : countries;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)',
          zIndex: 300, transition: 'opacity 0.2s',
        }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, height: '100vh',
        width: 420, background: '#FFFFFF',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        zIndex: 301, display: 'flex', flexDirection: 'column',
        overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{
          padding: '18px 20px 14px', borderBottom: '1px solid #EEEEEE',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111111' }}>
              {isPlaceholder ? 'Headcount Placeholder' : 'Edit Person'}
            </div>
            <div style={{ fontSize: 12, color: '#777777', marginTop: 3 }}>
              {person.contract_type_code && (
                <span style={{
                  padding: '2px 7px', borderRadius: 3, fontSize: 10,
                  background: '#F0F0F0', color: '#444444', marginRight: 6,
                }}>
                  {person.contract_type_code}
                </span>
              )}
              {person.contract_category ? CONTRACT_CATEGORY_LABELS[person.contract_category] ?? '' : ''}
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: '50%', border: 'none',
            background: '#F0F0F0', cursor: 'pointer', fontSize: 16, color: '#666666',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>✕</button>
        </div>

        {/* Form body */}
        <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>

          {/* Name */}
          <div style={FIELD}>
            <label style={LBL}>Name {isPlaceholder && '/ Placeholder title'}</label>
            <input style={INPUT} value={form.name} onChange={e => set('name', e.target.value)}
              placeholder={isPlaceholder ? 'e.g. TBH – Construction VP' : 'Full name'} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Discipline */}
            <div style={FIELD}>
              <label style={LBL}>Discipline</label>
              <select style={SEL} value={form.discipline_id} onChange={e => set('discipline_id', e.target.value)}>
                <option value="">— None —</option>
                {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {/* Level */}
            <div style={FIELD}>
              <label style={LBL}>Level</label>
              <select style={SEL} value={form.level_id} onChange={e => set('level_id', e.target.value)}>
                <option value="">— None —</option>
                {levels.map(l => <option key={l.id} value={l.id}>{l.level_name} ({l.short_code})</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {/* Contract Type */}
            <div style={FIELD}>
              <label style={LBL}>Contract Type</label>
              <select style={SEL} value={form.contract_type_id} onChange={e => set('contract_type_id', e.target.value)}>
                <option value="">— None —</option>
                {contractTypes.map(ct => <option key={ct.id} value={ct.id}>{ct.code}</option>)}
              </select>
            </div>

            {/* FTE */}
            <div style={FIELD}>
              <label style={LBL}>Contracted FTE</label>
              <input style={INPUT} type="number" min="0" max="2" step="0.1"
                value={form.contracted_fte} onChange={e => set('contracted_fte', e.target.value)} />
            </div>
          </div>

          {/* TBH Code */}
          <div style={FIELD}>
            <label style={LBL}>TBH Code {isPlaceholder && <span style={{ color: '#AD050C' }}>*</span>}</label>
            <select style={SEL} value={form.tbh_code_id} onChange={e => set('tbh_code_id', e.target.value)}>
              <option value="">— Not assigned —</option>
              {tbhCodes.map(t => <option key={t.id} value={t.id}>{t.tbh_id}</option>)}
            </select>
          </div>

          {/* Workday JR ID */}
          <div style={FIELD}>
            <label style={LBL}>Workday JR ID</label>
            <input style={INPUT} value={form.workday_jr_id} onChange={e => set('workday_jr_id', e.target.value)}
              placeholder="JR-000000" />
          </div>

          {/* Regions */}
          <div style={FIELD}>
            <label style={LBL}>Regions</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {regions.map(r => {
                const on = form.region_ids.includes(r.id);
                return (
                  <button key={r.id} onClick={() => toggleRegion(r.id)} style={{
                    padding: '4px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                    border: `1px solid ${on ? '#086AE3' : '#DDDDDD'}`,
                    background: on ? '#086AE3' : '#FFFFFF',
                    color: on ? '#FFFFFF' : '#555555',
                    fontWeight: on ? 600 : 400,
                  }}>
                    {r.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Countries (filtered by selected regions) */}
          <div style={FIELD}>
            <label style={LBL}>
              Countries
              {form.region_ids.length > 0 && (
                <span style={{ color: '#888888', fontWeight: 400, marginLeft: 4 }}>(filtered by region)</span>
              )}
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {filteredCountries.map(c => {
                const on = form.country_ids.includes(c.id);
                return (
                  <button key={c.id} onClick={() => toggleCountry(c.id)} style={{
                    padding: '4px 10px', borderRadius: 12, fontSize: 11, cursor: 'pointer',
                    border: `1px solid ${on ? '#33A85C' : '#DDDDDD'}`,
                    background: on ? '#33A85C' : '#FFFFFF',
                    color: on ? '#FFFFFF' : '#555555',
                    fontWeight: on ? 600 : 400,
                  }}>
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes / Comments */}
          <div style={FIELD}>
            <label style={LBL}>Notes / Comments</label>
            <textarea
              rows={4}
              style={{ ...INPUT, resize: 'vertical', fontFamily: 'inherit' }}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Add notes, context, or comments about this person or role…"
            />
          </div>

          {/* ── Country Allocations (only shown when context is passed from Allocations page) ── */}
          {countryGroups && countryGroups.length > 0 && (
            <div style={{ borderTop: '1px solid #EEEEEE', paddingTop: 16 }}>
              <label style={{ ...LBL, display: 'block', marginBottom: 10 }}>Country Allocations</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {countryGroups.map(g => {
                  const flag = flagUrl(g.countryName);
                  const val = allocEntries[g.countryId] ?? '';
                  return (
                    <div key={g.countryId} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
                        {flag && <img src={flag} alt="" width={16} height={12} style={{ borderRadius: 2, objectFit: 'cover', flexShrink: 0 }} />}
                        <span style={{ fontSize: 13, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.countryName}</span>
                      </div>
                      <input
                        type="number" min="0" max="1" step="0.1"
                        value={val}
                        onChange={e => setAllocEntries(prev => ({ ...prev, [g.countryId]: e.target.value }))}
                        placeholder="0.0"
                        style={{ width: 70, padding: '5px 8px', border: '1px solid #D5D5D5', borderRadius: 4, fontSize: 13, textAlign: 'center', outline: 'none' }}
                      />
                    </div>
                  );
                })}
              </div>
              <div style={{
                marginTop: 10, padding: '6px 10px', borderRadius: 5,
                background: allocTotal > 1.001 ? '#FFF0F0' : allocTotal > 0 ? '#F0FFF4' : '#F5F5F5',
                border: `1px solid ${allocTotal > 1.001 ? '#E91C24' : allocTotal > 0 ? '#33A85C' : '#E0E0E0'}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 10,
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#444444' }}>Total FTE</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: allocTotal > 1.001 ? '#AD050C' : allocTotal > 0 ? '#1A7A40' : '#888888' }}>
                  {allocTotal.toFixed(2)}
                </span>
              </div>
              <button
                onClick={saveAllocs}
                disabled={allocSaving || allocTotal > 1.001}
                style={{
                  width: '100%', padding: '8px 0',
                  background: (allocSaving || allocTotal > 1.001) ? '#CCCCCC' : '#086AE3',
                  border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 600, color: '#FFFFFF',
                  cursor: (allocSaving || allocTotal > 1.001) ? 'default' : 'pointer',
                }}
              >
                {allocSaving ? 'Saving…' : 'Save Allocations'}
              </button>
            </div>
          )}

          {/* ── Comments ── */}
          <div style={{ borderTop: '1px solid #EEEEEE', paddingTop: 16 }}>
            <label style={{ ...LBL, display: 'block', marginBottom: 10 }}>
              Comments {comments.length > 0 && `(${comments.length})`}
            </label>

            {commentsLoading && (
              <div style={{ fontSize: 12, color: '#999999', padding: '8px 0' }}>Loading comments…</div>
            )}
            {commentsError && (
              <div style={{ fontSize: 12, color: '#AD050C', padding: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                Failed to load comments.
                <button onClick={() => setCommentsTick(t => t + 1)} style={{ fontSize: 11, color: '#086AE3', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>Retry</button>
              </div>
            )}

            {!commentsLoading && !commentsError && comments.length === 0 && (
              <div style={{ fontSize: 12, color: '#AAAAAA', fontStyle: 'italic', marginBottom: 10 }}>No comments yet.</div>
            )}

            {comments.map(c => (
              <div key={c.id} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  {/* Avatar */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: avatarGradient(c.user_name),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, color: '#FFFFFF', fontSize: 10, fontWeight: 700,
                  }}>
                    {initials(c.user_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#111111' }}>{c.user_name}</span>
                      {c.user_role && (
                        <span style={{
                          fontSize: 9, padding: '1px 5px', borderRadius: 3,
                          background: '#F0F0F0', color: '#555555', border: '1px solid #DDDDDD',
                          fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.04em',
                        }}>{c.user_role}</span>
                      )}
                      <span style={{ fontSize: 10, color: '#AAAAAA', marginLeft: 'auto' }}>{fmtDateTime(c.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div style={{
                  marginLeft: 36, padding: '7px 10px', borderRadius: 6,
                  background: '#F5F6F8', border: '1px solid #EBEBEB',
                  fontSize: 12, color: '#333333', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}>
                  {c.body}
                </div>
              </div>
            ))}

            {/* Post new comment */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <textarea
                rows={2}
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); postComment(); } }}
                placeholder="Add a comment… (Ctrl+Enter to post)"
                style={{
                  ...INPUT, resize: 'vertical', fontFamily: 'inherit',
                  fontSize: 12, padding: '7px 10px',
                }}
              />
              <button
                onClick={postComment}
                disabled={!newComment.trim() || postingComment}
                style={{
                  alignSelf: 'flex-end', padding: '6px 14px',
                  background: (!newComment.trim() || postingComment) ? '#CCCCCC' : '#E91C24',
                  border: 'none', borderRadius: 5, fontSize: 12, fontWeight: 600, color: '#FFFFFF',
                  cursor: (!newComment.trim() || postingComment) ? 'default' : 'pointer',
                }}
              >
                {postingComment ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 20px', borderTop: '1px solid #EEEEEE',
          display: 'flex', gap: 10, flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '9px 0', background: '#FFFFFF',
            border: '1px solid #D5D5D5', borderRadius: 5,
            fontSize: 13, color: '#555555', cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 2, padding: '9px 0', background: saving ? '#CCCCCC' : '#E91C24',
            border: 'none', borderRadius: 5, fontSize: 13,
            fontWeight: 600, color: '#FFFFFF',
            cursor: saving ? 'default' : 'pointer',
          }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </>
  );
}
