import React, { useEffect, useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import { peopleApi, projectsApi, allocationsApi, refDataApi, type Person, type Project, type Allocation, type Region } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingChange {
  personId: number;
  projectId: number;
  fteValue: number;
  month: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DISCIPLINES = ['Construction', 'Design', 'Commercial', 'Commissioning', 'Other'];

const CONTRACT_COLOURS: Record<string, { bg: string; color: string; border: string }> = {
  'FTE':       { bg: '#F0F0F0', color: '#444444', border: '#D0D0D0' },
  'SNR':       { bg: '#F0F0F0', color: '#444444', border: '#D0D0D0' },
  'VP':        { bg: '#F0F0F0', color: '#444444', border: '#D0D0D0' },
  'Dr':        { bg: '#F0F0F0', color: '#444444', border: '#D0D0D0' },
  'CON':       { bg: '#FFF8E1', color: '#E65100', border: '#F9A825' },
  'A FTE':     { bg: '#FFF0F0', color: '#C0392B', border: '#E31837' },
  'A CON':     { bg: '#FFF8E1', color: '#E65100', border: '#F9A825' },
  'R FTE':     { bg: '#FDE8F6', color: '#AD1457', border: '#E91E8C' },
  'R CON':     { bg: '#FDE8F6', color: '#AD1457', border: '#E91E8C' },
  'R FTE 26':  { bg: '#FDE8F6', color: '#AD1457', border: '#E91E8C' },
};

const STATUS_COLOURS: Record<string, string> = {
  'Approved': '#33CC77',
  'Seeded':   '#F9A825',
  'Proposed': '#5599FF',
};

function contractColour(code: string | null) {
  if (!code) return CONTRACT_COLOURS['FTE'];
  return CONTRACT_COLOURS[code] ?? CONTRACT_COLOURS['FTE'];
}

function fteCellColour(val: number): string {
  if (val <= 0)    return '#AAAAAA';
  if (val < 0.5)   return '#4477EE';
  if (val < 1.0)   return '#D4870A';
  if (val === 1.0) return '#1E8A4A';
  return '#C0392B';
}

function rowTotalColour(total: number, contracted: number): string {
  if (total === 0)                  return '#555555';
  if (total > contracted + 0.01)    return '#E31837';
  if (total >= contracted - 0.01)   return '#33CC77';
  return '#F9A825';
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Allocations() {
  // Selectors
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState(2026);
  const [statusFilter, setStatusFilter] = useState<string>('All');

  // Data
  const [people, setPeople] = useState<Person[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [backendError, setBackendError] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange>>({});
  const [saving, setSaving] = useState(false);

  const pendingCount = Object.keys(pendingChanges).length;

  // ── Load regions once ────────────────────────────────────────────────────

  useEffect(() => {
    refDataApi.regions()
      .then(r => {
        setRegions(r);
        if (r.length > 0) setSelectedRegionId(r[0].id);
      })
      .catch(() => setBackendError(true));
  }, []);

  // ── Load planning data when region or year changes ───────────────────────

  const loadData = useCallback(async () => {
    if (!selectedRegionId) return;
    setLoading(true);
    setBackendError(false);

    try {
      const [peopleData, projectsData, allocData] = await Promise.all([
        peopleApi.list({ is_active: 'true', limit: 500 }).catch(() => [] as Person[]),
        projectsApi.list({ is_active: 'true', limit: 500 }).catch(() => [] as Project[]),
        allocationsApi.list({
          month_from: `${selectedYear}-01-01`,
          month_to:   `${selectedYear}-12-31`,
          limit: 2000,
        }).catch(() => [] as Allocation[]),
      ]);
      setPeople(peopleData);
      setProjects(projectsData);
      setAllocations(allocData);
    } catch {
      setBackendError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedRegionId, selectedYear]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived data ─────────────────────────────────────────────────────────

  const visibleProjects = useMemo(() => {
    let filtered = projects.filter(p => p.region_id === selectedRegionId);
    if (statusFilter !== 'All') filtered = filtered.filter(p => p.status === statusFilter);
    const order: Record<string, number> = { Approved: 0, Seeded: 1, Proposed: 2 };
    return filtered.sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3));
  }, [projects, selectedRegionId, statusFilter]);

  const allocMap = useMemo(() => {
    const m: Record<number, Record<number, { id: number; fte_value: number }>> = {};
    for (const a of allocations) {
      if (!m[a.person_id]) m[a.person_id] = {};
      m[a.person_id][a.project_id] = { id: a.id, fte_value: a.fte_value };
    }
    return m;
  }, [allocations]);

  const peopleByDiscipline = useMemo(() => {
    const groups: Record<string, Person[]> = {};
    for (const d of DISCIPLINES) groups[d] = [];
    for (const p of people) {
      const disc = p.discipline_name ?? 'Other';
      if (groups[disc]) groups[disc].push(p);
      else groups['Other'].push(p);
    }
    return groups;
  }, [people]);

  // ── Cell change handler ──────────────────────────────────────────────────

  function handleCellChange(personId: number, projectId: number, rawValue: string) {
    const fteValue = parseFloat(rawValue) || 0;
    const key = `${personId}_${projectId}`;
    const month = `${selectedYear}-01-01`;
    if (fteValue === 0 && !allocMap[personId]?.[projectId]) {
      const next = { ...pendingChanges };
      delete next[key];
      setPendingChanges(next);
    } else {
      setPendingChanges(prev => ({
        ...prev,
        [key]: { personId, projectId, fteValue, month },
      }));
    }
  }

  // ── Save all pending changes ─────────────────────────────────────────────

  async function handleSaveAll() {
    if (!pendingCount) return;
    setSaving(true);
    try {
      await Promise.all(
        Object.values(pendingChanges).map(ch =>
          allocationsApi.upsert({
            person_id:   ch.personId,
            project_id:  ch.projectId,
            month:       ch.month,
            fte_value:   ch.fteValue,
            is_billable: true,
          })
        )
      );
      toast.success(`Saved ${pendingCount} allocation${pendingCount !== 1 ? 's' : ''}`);
      setPendingChanges({});
      await loadData();
    } catch {
      toast.error('Failed to save — check backend connection');
    } finally {
      setSaving(false);
    }
  }

  // ── Cell value helpers ───────────────────────────────────────────────────

  function getCellValue(personId: number, projectId: number): number {
    const key = `${personId}_${projectId}`;
    if (pendingChanges[key] !== undefined) return pendingChanges[key].fteValue;
    return allocMap[personId]?.[projectId]?.fte_value ?? 0;
  }

  function isCellDirty(personId: number, projectId: number): boolean {
    return `${personId}_${projectId}` in pendingChanges;
  }

  function getPersonTotal(personId: number): number {
    return visibleProjects.reduce((sum, p) => sum + getCellValue(personId, p.id), 0);
  }

  function getDisciplineTotal(discipline: string): number {
    const dPeople = peopleByDiscipline[discipline] ?? [];
    return dPeople.reduce(
      (sum, p) => sum + visibleProjects.reduce((s2, proj) => s2 + getCellValue(p.id, proj.id), 0),
      0
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  const selectedRegionName = regions.find(r => r.id === selectedRegionId)?.name ?? '';
  const STICKY_BG = '#FFFFFF';

  return (
    <div style={{ color: '#111111', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '16px 24px', background: '#FFFFFF',
        borderBottom: '1px solid #E5E5E5', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Allocations Planning</h1>
            <div style={{ width: 40, height: 3, background: '#E31837', borderRadius: 2, marginTop: 5 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {pendingCount > 0 && (
              <span style={{ fontSize: 12, color: '#D4870A', background: '#FFF8E1', padding: '4px 10px', borderRadius: 12, border: '1px solid #F9A825' }}>
                {pendingCount} unsaved change{pendingCount !== 1 ? 's' : ''}
              </span>
            )}
            <button
              onClick={handleSaveAll}
              disabled={saving || pendingCount === 0}
              style={{
                padding: '8px 20px',
                background: pendingCount > 0 ? '#E31837' : '#CCCCCC',
                color: '#FFF', border: 'none', borderRadius: 6,
                fontSize: 14, fontWeight: 600,
                cursor: pendingCount > 0 ? 'pointer' : 'default',
              }}
            >
              {saving ? 'Saving…' : `Save${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
            </button>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Region</label>
            <select
              value={selectedRegionId ?? ''}
              onChange={e => setSelectedRegionId(Number(e.target.value))}
              style={{ padding: '7px 10px', background: '#FFFFFF', border: '1px solid #D5D5D5', borderRadius: 5, color: '#111111', fontSize: 13 }}
            >
              {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Year</label>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              style={{ padding: '7px 10px', background: '#FFFFFF', border: '1px solid #D5D5D5', borderRadius: 5, color: '#111111', fontSize: 13 }}
            >
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
              <option value={2028}>2028</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '7px 10px', background: '#FFFFFF', border: '1px solid #D5D5D5', borderRadius: 5, color: '#111111', fontSize: 13 }}
            >
              <option>All</option>
              <option>Approved</option>
              <option>Seeded</option>
              <option>Proposed</option>
            </select>
          </div>

          <span style={{ fontSize: 12, color: '#999999', marginLeft: 4 }}>
            {visibleProjects.length} project{visibleProjects.length !== 1 ? 's' : ''} · {people.length} people
          </span>
        </div>
      </div>

      {/* ── Backend error banner ── */}
      {backendError && (
        <div style={{ padding: '10px 24px', background: '#FFFBEB', borderBottom: '1px solid #F5DFA0', color: '#996600', fontSize: 13, flexShrink: 0 }}>
          ⚠ Cannot reach backend. Make sure it is running: <code style={{ background: '#F5F5F5', padding: '2px 6px', borderRadius: 3 }}>cd backend && npm start</code>
          <button onClick={loadData} style={{ marginLeft: 12, padding: '3px 10px', background: 'transparent', border: '1px solid #D4870A', color: '#996600', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Retry</button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div className="spinner" />
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && !backendError && visibleProjects.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 8, color: '#666666' }}>
          <div style={{ fontSize: 16 }}>No projects found for {selectedRegionName} {selectedYear}</div>
          <div style={{ fontSize: 13 }}>Add projects in the Projects screen first, then assign them to this region and year.</div>
        </div>
      )}

      {/* ── Planning Grid ── */}
      {!loading && visibleProjects.length > 0 && (
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed', minWidth: '100%' }}>

            <colgroup>
              <col style={{ width: 220 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 50 }} />
              {visibleProjects.map(p => <col key={p.id} style={{ width: 80 }} />)}
              <col style={{ width: 65 }} />
            </colgroup>

            <thead>
              <tr style={{ background: '#F8F9FA' }}>
                <th style={{
                  position: 'sticky', top: 0, left: 0, zIndex: 4,
                  background: '#F8F9FA', borderRight: '2px solid #E0E0E0',
                  borderBottom: '1px solid #E0E0E0', padding: '10px 14px',
                  textAlign: 'left', fontSize: 11, color: '#666666',
                  textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap',
                }}>
                  Person
                </th>
                <th style={{
                  position: 'sticky', top: 0, left: 220, zIndex: 4,
                  background: '#F8F9FA', borderRight: '1px solid #E5E5E5',
                  borderBottom: '1px solid #E0E0E0', padding: '10px 6px',
                  fontSize: 10, color: '#666666', textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>
                  Type
                </th>
                <th style={{
                  position: 'sticky', top: 0, left: 290, zIndex: 4,
                  background: '#F8F9FA', borderRight: '2px solid #D5D5D5',
                  borderBottom: '1px solid #E0E0E0', padding: '10px 6px',
                  fontSize: 10, color: '#666666', textTransform: 'uppercase', whiteSpace: 'nowrap',
                }}>
                  FTE
                </th>

                {visibleProjects.map(p => (
                  <th key={p.id} style={{
                    position: 'sticky', top: 0, zIndex: 3,
                    background: '#F8F9FA', borderBottom: '1px solid #E0E0E0',
                    borderRight: '1px solid #EEEEEE', padding: '6px 4px',
                    textAlign: 'center', minWidth: 80,
                  }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600,
                      color: STATUS_COLOURS[p.status] ?? '#333333',
                      whiteSpace: 'nowrap', overflow: 'hidden',
                      textOverflow: 'ellipsis', maxWidth: 72,
                    }} title={p.name}>
                      {p.name}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginTop: 3 }}>
                      <span style={{
                        fontSize: 9, padding: '1px 4px', borderRadius: 3,
                        background: '#FFFFFF',
                        color: STATUS_COLOURS[p.status] ?? '#666666',
                        border: `1px solid ${STATUS_COLOURS[p.status] ?? '#CCCCCC'}`,
                      }}>
                        {p.status}
                      </span>
                    </div>
                    {p.weight !== 1 && (
                      <div style={{ fontSize: 9, color: '#999999', marginTop: 2 }}>wt:{p.weight}</div>
                    )}
                  </th>
                ))}

                <th style={{
                  position: 'sticky', top: 0, right: 0, zIndex: 4,
                  background: '#F8F9FA', borderLeft: '2px solid #D5D5D5',
                  borderBottom: '1px solid #E0E0E0', padding: '10px 8px',
                  fontSize: 10, color: '#666666', textTransform: 'uppercase', textAlign: 'center',
                }}>
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {DISCIPLINES.map(discipline => {
                const dPeople = peopleByDiscipline[discipline] ?? [];
                if (dPeople.length === 0) return null;
                const disciplineTotal = getDisciplineTotal(discipline);

                return (
                  <React.Fragment key={discipline}>

                    {/* Discipline header row */}
                    <tr>
                      <td colSpan={3 + visibleProjects.length + 1} style={{
                        background: '#F5F6FA',
                        borderLeft: '3px solid #E31837',
                        borderTop: '2px solid #E0E0E0',
                        borderBottom: '1px solid #E0E0E0',
                        padding: '8px 14px',
                        fontWeight: 700, fontSize: 13, color: '#111111',
                        position: 'sticky', left: 0,
                      }}>
                        {discipline}
                        <span style={{ marginLeft: 16, color: '#888888', fontWeight: 400, fontSize: 12 }}>
                          {dPeople.length} {dPeople.length === 1 ? 'person' : 'people'}
                        </span>
                      </td>
                    </tr>

                    {/* Person rows */}
                    {dPeople.map(person => {
                      const total      = getPersonTotal(person.id);
                      const contracted = parseFloat(String(person.contracted_fte ?? 1)) || 1;
                      const cc         = contractColour(person.contract_type_code);

                      return (
                        <tr key={person.id} style={{ borderBottom: '1px solid #F0F0F0' }}>

                          <td style={{
                            position: 'sticky', left: 0, zIndex: 2,
                            background: STICKY_BG, borderRight: '2px solid #E0E0E0',
                            padding: '6px 14px', whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis',
                            maxWidth: 220, color: '#111111', fontWeight: 500,
                          }}>
                            {person.name}
                          </td>

                          <td style={{
                            position: 'sticky', left: 220, zIndex: 2,
                            background: STICKY_BG, borderRight: '1px solid #E5E5E5',
                            padding: '6px 4px', textAlign: 'center',
                          }}>
                            <span style={{
                              fontSize: 10, padding: '2px 5px', borderRadius: 4,
                              background: cc.bg, color: cc.color,
                              border: `1px solid ${cc.border}`, whiteSpace: 'nowrap',
                            }}>
                              {person.contract_type_code ?? 'FTE'}
                            </span>
                          </td>

                          <td style={{
                            position: 'sticky', left: 290, zIndex: 2,
                            background: STICKY_BG, borderRight: '2px solid #D5D5D5',
                            padding: '6px 4px', textAlign: 'center',
                            fontSize: 11, color: '#666666',
                          }}>
                            {contracted.toFixed(1)}
                          </td>

                          {visibleProjects.map(proj => {
                            const val        = getCellValue(person.id, proj.id);
                            const dirty      = isCellDirty(person.id, proj.id);
                            const displayVal = val > 0 ? val.toString() : '';

                            return (
                              <td key={proj.id} style={{
                                padding: '3px 4px', textAlign: 'center',
                                borderRight: '1px solid #EEEEEE',
                                background: dirty ? '#FFFBEB' : 'transparent',
                              }}>
                                <input
                                  type="number"
                                  min="0" max="2" step="0.1"
                                  defaultValue={displayVal}
                                  key={`${person.id}_${proj.id}_${allocations.length}`}
                                  onBlur={e => handleCellChange(person.id, proj.id, e.target.value)}
                                  style={{
                                    width: 56, padding: '4px 2px',
                                    background: '#FFFFFF',
                                    border: dirty ? '2px solid #F9A825' : '1px solid #E0E0E0',
                                    borderRadius: 3, color: fteCellColour(val),
                                    textAlign: 'center', fontSize: 12,
                                    fontFamily: 'monospace', outline: 'none',
                                  }}
                                />
                              </td>
                            );
                          })}

                          <td style={{
                            position: 'sticky', right: 0, zIndex: 2,
                            background: STICKY_BG, borderLeft: '2px solid #D5D5D5',
                            padding: '6px 8px', textAlign: 'center',
                            fontWeight: 700, fontSize: 13,
                            color: rowTotalColour(total, contracted),
                          }}>
                            {total > 0 ? total.toFixed(2) : '—'}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Discipline proposed total row */}
                    <tr style={{ background: '#F5F5F5', borderTop: '1px solid #E8E8E8' }}>
                      <td colSpan={3} style={{
                        position: 'sticky', left: 0, zIndex: 2,
                        background: '#F5F5F5', padding: '5px 14px',
                        fontSize: 11, color: '#888888', fontStyle: 'italic',
                        borderRight: '2px solid #E0E0E0',
                      }}>
                        {discipline} · Proposed
                      </td>
                      {visibleProjects.map(proj => {
                        const projTotal = (peopleByDiscipline[discipline] ?? [])
                          .reduce((s, p) => s + getCellValue(p.id, proj.id), 0);
                        return (
                          <td key={proj.id} style={{
                            padding: '5px 4px', textAlign: 'center',
                            fontSize: 11, color: projTotal > 0 ? '#1E8A4A' : '#CCCCCC',
                            borderRight: '1px solid #EEEEEE',
                          }}>
                            {projTotal > 0 ? projTotal.toFixed(1) : ''}
                          </td>
                        );
                      })}
                      <td style={{
                        position: 'sticky', right: 0, zIndex: 2,
                        background: '#F5F5F5', borderLeft: '2px solid #D5D5D5',
                        padding: '5px 8px', textAlign: 'center',
                        fontSize: 11, color: '#1E8A4A', fontWeight: 700,
                      }}>
                        {disciplineTotal > 0 ? disciplineTotal.toFixed(1) : '—'}
                      </td>
                    </tr>

                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
