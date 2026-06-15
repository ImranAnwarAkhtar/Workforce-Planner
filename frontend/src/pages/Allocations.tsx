import React, { useEffect, useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  peopleApi, projectsApi, allocationsApi, refDataApi,
  type Person, type Project, type Allocation, type Region,
} from '../services/api';

interface PendingChange {
  personId: number;
  projectId: number;
  fteValue: number;
  month: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_ORDER: Record<string, number> = {
  'VP': 1, 'S Dr': 2, 'Dr': 3, 'S M': 4, 'M': 5,
  'St': 6, 'Sc': 7, 'Ex': 8, 'Sp': 9, 'In': 10,
  'En': 11, 'Ca': 12, 'Te': 13, 'Cons': 14,
};

const CONTRACT_COLOURS: Record<string, { bg: string; color: string; border: string }> = {
  'FTE':      { bg: '#F0F0F0', color: '#444444', border: '#D0D0D0' },
  'SNR':      { bg: '#F0F0F0', color: '#444444', border: '#D0D0D0' },
  'VP':       { bg: '#F0F0F0', color: '#444444', border: '#D0D0D0' },
  'Dr':       { bg: '#F0F0F0', color: '#444444', border: '#D0D0D0' },
  'CON':      { bg: '#FFF8E1', color: '#E65100', border: '#F9A825' },
  'A FTE':    { bg: '#FFF0F0', color: '#C0392B', border: '#E31837' },
  'A CON':    { bg: '#FFF8E1', color: '#E65100', border: '#F9A825' },
  'R FTE':    { bg: '#FDE8F6', color: '#AD1457', border: '#E91E8C' },
  'R CON':    { bg: '#FDE8F6', color: '#AD1457', border: '#E91E8C' },
  'R FTE 26': { bg: '#FDE8F6', color: '#AD1457', border: '#E91E8C' },
};

const STATUS_COLOURS: Record<string, string> = {
  'Approved': '#33CC77',
  'Seeded':   '#F9A825',
  'Proposed': '#5599FF',
};

const COUNTRY_PALETTE = [
  '#1565C0', '#1E8A4A', '#6A1B9A', '#B5600A',
  '#006064', '#C0392B', '#4477EE', '#D4870A',
];

function countryColor(name: string): string {
  if (!name || name === 'Unassigned') return '#888888';
  const hash = name.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return COUNTRY_PALETTE[hash % COUNTRY_PALETTE.length];
}

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
  if (total === 0)               return '#555555';
  if (total > contracted + 0.01) return '#E31837';
  if (total >= contracted - 0.01) return '#33CC77';
  return '#F9A825';
}

const STICKY_BG = '#FFFFFF';
const ROW1_H = 44;

// ─── Main component ───────────────────────────────────────────────────────────

export default function Allocations() {
  const [regions, setRegions]               = useState<Region[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [selectedYear, setSelectedYear]     = useState(2026);
  const [statusFilter, setStatusFilter]     = useState<string>('All');
  const [collapsedCountries, setCollapsedCountries] = useState<Set<string>>(new Set());

  const [people, setPeople]         = useState<Person[]>([]);
  const [projects, setProjects]     = useState<Project[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);

  const [loading, setLoading]           = useState(false);
  const [backendError, setBackendError] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange>>({});
  const [saving, setSaving]             = useState(false);

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

  // Reset collapsed countries when region changes
  useEffect(() => { setCollapsedCountries(new Set()); }, [selectedRegionId]);

  // ── Load planning data ───────────────────────────────────────────────────

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

  const countryGroups = useMemo(() => {
    const map: Record<string, Project[]> = {};
    for (const p of visibleProjects) {
      const c = p.country_name ?? 'Unassigned';
      if (!map[c]) map[c] = [];
      map[c].push(p);
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([country, projs]) => ({ country, projects: projs }));
  }, [visibleProjects]);

  const allCountryNames = useMemo(() => countryGroups.map(g => g.country), [countryGroups]);

  const allocMap = useMemo(() => {
    const m: Record<number, Record<number, { id: number; fte_value: number }>> = {};
    for (const a of allocations) {
      if (!m[a.person_id]) m[a.person_id] = {};
      m[a.person_id][a.project_id] = { id: a.id, fte_value: a.fte_value };
    }
    return m;
  }, [allocations]);

  const peopleByLevel = useMemo(() => {
    const groups: Record<string, { levelName: string; people: Person[] }> = {};
    for (const p of people) {
      const code = p.level_code ?? 'Unknown';
      if (!groups[code]) groups[code] = { levelName: p.level_name ?? code, people: [] };
      groups[code].people.push(p);
    }
    Object.values(groups).forEach(g => g.people.sort((a, b) => a.name.localeCompare(b.name)));
    return Object.entries(groups)
      .sort(([a], [b]) => (LEVEL_ORDER[a] ?? 99) - (LEVEL_ORDER[b] ?? 99))
      .map(([code, { levelName, people: ppl }]) => ({ code, levelName, people: ppl }));
  }, [people]);

  // ── Collapse/expand ──────────────────────────────────────────────────────

  function toggleCountry(country: string) {
    setCollapsedCountries(prev => {
      const next = new Set(prev);
      if (next.has(country)) next.delete(country); else next.add(country);
      return next;
    });
  }

  const allCollapsed = allCountryNames.length > 0 && collapsedCountries.size >= allCountryNames.length;

  function collapseAll() { setCollapsedCountries(new Set(allCountryNames)); }
  function expandAll()   { setCollapsedCountries(new Set()); }

  // ── Cell helpers ──────────────────────────────────────────────────────────

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

  function getPersonCountryTotal(personId: number, projs: Project[]): number {
    return projs.reduce((sum, p) => sum + getCellValue(personId, p.id), 0);
  }

  function getLevelProjectTotal(levelPeople: Person[], projectId: number): number {
    return levelPeople.reduce((sum, p) => sum + getCellValue(p.id, projectId), 0);
  }

  function getLevelCountryTotal(levelPeople: Person[], projs: Project[]): number {
    return levelPeople.reduce((sum, p) => sum + getPersonCountryTotal(p.id, projs), 0);
  }

  function getLevelGrandTotal(levelPeople: Person[]): number {
    return levelPeople.reduce((sum, p) => sum + getPersonTotal(p.id), 0);
  }

  // ── Cell change + save ───────────────────────────────────────────────────

  function handleCellChange(personId: number, projectId: number, rawValue: string) {
    const fteValue = parseFloat(rawValue) || 0;
    const key   = `${personId}_${projectId}`;
    const month = `${selectedYear}-01-01`;
    if (fteValue === 0 && !allocMap[personId]?.[projectId]) {
      const next = { ...pendingChanges };
      delete next[key];
      setPendingChanges(next);
    } else {
      setPendingChanges(prev => ({ ...prev, [key]: { personId, projectId, fteValue, month } }));
    }
  }

  async function handleSaveAll() {
    if (!pendingCount) return;
    setSaving(true);
    try {
      await Promise.all(
        Object.values(pendingChanges).map(ch =>
          allocationsApi.upsert({
            person_id: ch.personId, project_id: ch.projectId,
            month: ch.month, fte_value: ch.fteValue, is_billable: true,
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

  // ── Total column count (for level-header colSpan) ────────────────────────

  const totalColCount = 3
    + countryGroups.reduce((sum, g) =>
        sum + (collapsedCountries.has(g.country) ? 1 : g.projects.length + 1), 0)
    + 1;

  const selectedRegionName = regions.find(r => r.id === selectedRegionId)?.name ?? '';

  // ─── Render ───────────────────────────────────────────────────────────────

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
              <span style={{
                fontSize: 12, color: '#D4870A', background: '#FFF8E1',
                padding: '4px 10px', borderRadius: 12, border: '1px solid #F9A825',
              }}>
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

          {countryGroups.length > 0 && (
            <button
              onClick={allCollapsed ? expandAll : collapseAll}
              style={{
                padding: '6px 12px', background: 'transparent',
                border: '1px solid #D5D5D5', borderRadius: 5,
                fontSize: 12, color: '#555555', cursor: 'pointer',
              }}
            >
              {allCollapsed ? 'Expand all' : 'Collapse all'}
            </button>
          )}

          <span style={{ fontSize: 12, color: '#999999', marginLeft: 4 }}>
            {visibleProjects.length} project{visibleProjects.length !== 1 ? 's' : ''} · {people.length} people
          </span>
        </div>
      </div>

      {/* ── Error banner ── */}
      {backendError && (
        <div style={{
          padding: '10px 24px', background: '#FFFBEB',
          borderBottom: '1px solid #F5DFA0', color: '#996600', fontSize: 13, flexShrink: 0,
        }}>
          ⚠ Cannot reach backend.
          <button onClick={loadData} style={{
            marginLeft: 12, padding: '3px 10px', background: 'transparent',
            border: '1px solid #D4870A', color: '#996600', borderRadius: 4, cursor: 'pointer', fontSize: 12,
          }}>Retry</button>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div className="spinner" />
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !backendError && visibleProjects.length === 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flex: 1, flexDirection: 'column', gap: 8, color: '#666666',
        }}>
          <div style={{ fontSize: 16 }}>No projects found for {selectedRegionName} {selectedYear}</div>
          <div style={{ fontSize: 13 }}>Add projects in the Projects screen first, then assign them to this region and year.</div>
        </div>
      )}

      {/* ── Planning Grid ── */}
      {!loading && visibleProjects.length > 0 && (
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed', minWidth: '100%' }}>

            <colgroup>
              <col style={{ width: 200 }} />
              <col style={{ width: 65 }} />
              <col style={{ width: 50 }} />
              {countryGroups.map(g =>
                collapsedCountries.has(g.country)
                  ? <col key={`cg-${g.country}`} style={{ width: 65 }} />
                  : <React.Fragment key={`cg-${g.country}`}>
                      {g.projects.map(p => <col key={p.id} style={{ width: 72 }} />)}
                      <col style={{ width: 65 }} />
                    </React.Fragment>
              )}
              <col style={{ width: 65 }} />
            </colgroup>

            <thead>
              {/* ── Row 1: sticky person cols + country headers ── */}
              <tr style={{ background: '#F8F9FA' }}>
                <th rowSpan={2} style={{
                  position: 'sticky', top: 0, left: 0, zIndex: 5,
                  background: '#F8F9FA', borderRight: '2px solid #E0E0E0',
                  borderBottom: '2px solid #D0D0D0', padding: '10px 14px',
                  textAlign: 'left', fontSize: 11, color: '#666666',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  verticalAlign: 'middle',
                }}>
                  Person
                </th>
                <th rowSpan={2} style={{
                  position: 'sticky', top: 0, left: 200, zIndex: 5,
                  background: '#F8F9FA', borderRight: '1px solid #E5E5E5',
                  borderBottom: '2px solid #D0D0D0', padding: '10px 6px',
                  fontSize: 10, color: '#666666', textTransform: 'uppercase',
                  whiteSpace: 'nowrap', verticalAlign: 'middle',
                }}>
                  Type
                </th>
                <th rowSpan={2} style={{
                  position: 'sticky', top: 0, left: 265, zIndex: 5,
                  background: '#F8F9FA', borderRight: '2px solid #D5D5D5',
                  borderBottom: '2px solid #D0D0D0', padding: '10px 6px',
                  fontSize: 10, color: '#666666', textTransform: 'uppercase',
                  whiteSpace: 'nowrap', verticalAlign: 'middle',
                }}>
                  FTE
                </th>

                {countryGroups.map(g => {
                  const isCollapsed = collapsedCountries.has(g.country);
                  const color = countryColor(g.country);
                  if (isCollapsed) {
                    return (
                      <th key={g.country} rowSpan={2} style={{
                        position: 'sticky', top: 0, zIndex: 3,
                        background: '#F8F9FA',
                        borderLeft: `3px solid ${color}`,
                        borderBottom: '2px solid #D0D0D0',
                        borderRight: '1px solid #E0E0E0',
                        padding: '5px 6px',
                        textAlign: 'center', cursor: 'pointer',
                        whiteSpace: 'nowrap', verticalAlign: 'middle',
                      }} onClick={() => toggleCountry(g.country)} title={`Expand ${g.country}`}>
                        <div style={{ fontWeight: 700, color, fontSize: 11 }}>{g.country}</div>
                        <div style={{ fontSize: 9, color: '#999999', marginTop: 2 }}>
                          {g.projects.length}p ▶
                        </div>
                      </th>
                    );
                  }
                  return (
                    <th key={g.country} colSpan={g.projects.length + 1} style={{
                      position: 'sticky', top: 0, zIndex: 3,
                      background: '#F8F9FA',
                      borderLeft: `3px solid ${color}`,
                      borderBottom: '1px solid #D0D0D0',
                      borderRight: '1px solid #DDDDDD',
                      padding: '6px 10px',
                      textAlign: 'center', cursor: 'pointer',
                      fontWeight: 700, color, fontSize: 12,
                      whiteSpace: 'nowrap',
                    }} onClick={() => toggleCountry(g.country)} title={`Collapse ${g.country}`}>
                      {g.country} ▼
                      <span style={{ marginLeft: 6, fontSize: 9, color: '#888888', fontWeight: 400 }}>
                        {g.projects.length} project{g.projects.length !== 1 ? 's' : ''}
                      </span>
                    </th>
                  );
                })}

                <th rowSpan={2} style={{
                  position: 'sticky', top: 0, right: 0, zIndex: 5,
                  background: '#F8F9FA', borderLeft: '2px solid #D5D5D5',
                  borderBottom: '2px solid #D0D0D0', padding: '10px 8px',
                  fontSize: 10, color: '#666666', textTransform: 'uppercase',
                  textAlign: 'center', verticalAlign: 'middle',
                }}>
                  Total
                </th>
              </tr>

              {/* ── Row 2: project headers for expanded countries ── */}
              <tr style={{ background: '#F8F9FA' }}>
                {countryGroups.map(g => {
                  if (collapsedCountries.has(g.country)) return null;
                  const color = countryColor(g.country);
                  return (
                    <React.Fragment key={g.country}>
                      {g.projects.map(p => (
                        <th key={p.id} style={{
                          position: 'sticky', top: ROW1_H, zIndex: 3,
                          background: '#F8F9FA',
                          borderLeft: '1px solid #EEEEEE',
                          borderBottom: '1px solid #D0D0D0',
                          padding: '5px 4px', textAlign: 'center',
                        }}>
                          <div style={{
                            fontSize: 10, fontWeight: 600,
                            color: STATUS_COLOURS[p.status] ?? '#333333',
                            whiteSpace: 'nowrap', overflow: 'hidden',
                            textOverflow: 'ellipsis', maxWidth: 64,
                            margin: '0 auto',
                          }} title={p.name}>
                            {p.name}
                          </div>
                          <span style={{
                            fontSize: 9, padding: '1px 3px', borderRadius: 3,
                            background: '#FFFFFF',
                            color: STATUS_COLOURS[p.status] ?? '#666666',
                            border: `1px solid ${STATUS_COLOURS[p.status] ?? '#CCCCCC'}`,
                            display: 'inline-block', marginTop: 2,
                          }}>
                            {p.status}
                          </span>
                        </th>
                      ))}
                      <th style={{
                        position: 'sticky', top: ROW1_H, zIndex: 3,
                        background: '#EEF4FF',
                        borderLeft: '1px solid #C0C8E0',
                        borderRight: '1px solid #C0C8E0',
                        borderBottom: '1px solid #D0D0D0',
                        padding: '5px 4px', textAlign: 'center',
                        fontSize: 10, color, fontWeight: 700,
                        whiteSpace: 'nowrap',
                      }}>
                        Σ {g.country.slice(0, 3)}
                      </th>
                    </React.Fragment>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {peopleByLevel.map(({ code, levelName, people: levelPeople }) => {
                if (levelPeople.length === 0) return null;
                const levelGrandTotal = getLevelGrandTotal(levelPeople);

                return (
                  <React.Fragment key={code}>

                    {/* Level header row */}
                    <tr>
                      <td colSpan={totalColCount} style={{
                        background: '#EBF0FB',
                        borderLeft: '3px solid #1565C0',
                        borderTop: '2px solid #D0D8F0',
                        borderBottom: '1px solid #D0D8F0',
                        padding: '7px 14px',
                        fontWeight: 700, fontSize: 12, color: '#1565C0',
                        position: 'sticky', left: 0,
                        whiteSpace: 'nowrap',
                      }}>
                        {levelName}
                        <span style={{ marginLeft: 10, color: '#888888', fontWeight: 400, fontSize: 11 }}>
                          {levelPeople.length} {levelPeople.length === 1 ? 'person' : 'people'}
                        </span>
                      </td>
                    </tr>

                    {/* Person rows */}
                    {levelPeople.map(person => {
                      const total      = getPersonTotal(person.id);
                      const contracted = parseFloat(String(person.contracted_fte ?? 1)) || 1;
                      const cc         = contractColour(person.contract_type_code);

                      return (
                        <tr key={person.id} style={{ borderBottom: '1px solid #F0F0F0' }}>

                          {/* Name + discipline badge */}
                          <td style={{
                            position: 'sticky', left: 0, zIndex: 2,
                            background: STICKY_BG, borderRight: '2px solid #E0E0E0',
                            padding: '5px 14px',
                            maxWidth: 200, overflow: 'hidden',
                          }}>
                            <div style={{
                              fontSize: 13, color: '#111111', fontWeight: 500,
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                              {person.name}
                            </div>
                            {person.discipline_name && (
                              <div style={{
                                fontSize: 9, color: '#777777',
                                background: '#F3F4F6', padding: '1px 5px',
                                borderRadius: 3, display: 'inline-block',
                                marginTop: 2, border: '1px solid #E5E5E5',
                                whiteSpace: 'nowrap',
                              }}>
                                {person.discipline_name}
                              </div>
                            )}
                          </td>

                          {/* Contract type badge */}
                          <td style={{
                            position: 'sticky', left: 200, zIndex: 2,
                            background: STICKY_BG, borderRight: '1px solid #E5E5E5',
                            padding: '5px 4px', textAlign: 'center', verticalAlign: 'middle',
                          }}>
                            <span style={{
                              fontSize: 10, padding: '2px 5px', borderRadius: 4,
                              background: cc.bg, color: cc.color,
                              border: `1px solid ${cc.border}`, whiteSpace: 'nowrap',
                            }}>
                              {person.contract_type_code ?? 'FTE'}
                            </span>
                          </td>

                          {/* Contracted FTE */}
                          <td style={{
                            position: 'sticky', left: 265, zIndex: 2,
                            background: STICKY_BG, borderRight: '2px solid #D5D5D5',
                            padding: '5px 4px', textAlign: 'center',
                            fontSize: 11, color: '#666666', verticalAlign: 'middle',
                          }}>
                            {contracted.toFixed(1)}
                          </td>

                          {/* Country groups */}
                          {countryGroups.map(g => {
                            const isCollapsed  = collapsedCountries.has(g.country);
                            const countryTotal = getPersonCountryTotal(person.id, g.projects);
                            const color        = countryColor(g.country);

                            if (isCollapsed) {
                              return (
                                <td key={g.country} style={{
                                  padding: '4px 6px', textAlign: 'center',
                                  fontSize: 12, fontWeight: 600,
                                  color: countryTotal > 0 ? color : '#CCCCCC',
                                  borderLeft: `2px solid ${color}33`,
                                  borderRight: '1px solid #EEEEEE',
                                  background: countryTotal > 0 ? `${color}0A` : 'transparent',
                                  verticalAlign: 'middle',
                                }}>
                                  {countryTotal > 0 ? countryTotal.toFixed(1) : '—'}
                                </td>
                              );
                            }

                            return (
                              <React.Fragment key={g.country}>
                                {g.projects.map(proj => {
                                  const val        = getCellValue(person.id, proj.id);
                                  const dirty      = isCellDirty(person.id, proj.id);
                                  const displayVal = val > 0 ? val.toString() : '';
                                  return (
                                    <td key={proj.id} style={{
                                      padding: '3px 4px', textAlign: 'center',
                                      borderLeft: '1px solid #EEEEEE',
                                      background: dirty ? '#FFFBEB' : 'transparent',
                                      verticalAlign: 'middle',
                                    }}>
                                      <input
                                        type="number"
                                        min="0" max="2" step="0.1"
                                        defaultValue={displayVal}
                                        key={`${person.id}_${proj.id}_${allocations.length}`}
                                        onBlur={e => handleCellChange(person.id, proj.id, e.target.value)}
                                        style={{
                                          width: 52, padding: '3px 2px',
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
                                {/* Country subtotal */}
                                <td style={{
                                  padding: '4px 6px', textAlign: 'center',
                                  fontSize: 12, fontWeight: 600,
                                  color: countryTotal > 0 ? color : '#CCCCCC',
                                  background: countryTotal > 0 ? `${color}0A` : '#F8F9FA',
                                  borderLeft: '1px solid #C0C8E0',
                                  borderRight: '1px solid #C0C8E0',
                                  verticalAlign: 'middle',
                                }}>
                                  {countryTotal > 0 ? countryTotal.toFixed(1) : '—'}
                                </td>
                              </React.Fragment>
                            );
                          })}

                          {/* Grand total */}
                          <td style={{
                            position: 'sticky', right: 0, zIndex: 2,
                            background: STICKY_BG, borderLeft: '2px solid #D5D5D5',
                            padding: '5px 8px', textAlign: 'center',
                            fontWeight: 700, fontSize: 13,
                            color: rowTotalColour(total, contracted),
                            verticalAlign: 'middle',
                          }}>
                            {total > 0 ? total.toFixed(2) : '—'}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Level subtotal row */}
                    <tr style={{ background: '#EEF2F8', borderTop: '1px solid #D0D8F0' }}>
                      <td colSpan={3} style={{
                        position: 'sticky', left: 0, zIndex: 2,
                        background: '#EEF2F8', padding: '5px 14px',
                        fontSize: 11, color: '#1565C0', fontWeight: 700,
                        borderRight: '2px solid #D0D0D0',
                        whiteSpace: 'nowrap',
                      }}>
                        {levelName} · Subtotal
                      </td>
                      {countryGroups.map(g => {
                        const isCollapsed       = collapsedCountries.has(g.country);
                        const countryLevelTotal = getLevelCountryTotal(levelPeople, g.projects);
                        const color             = countryColor(g.country);

                        if (isCollapsed) {
                          return (
                            <td key={g.country} style={{
                              padding: '5px 6px', textAlign: 'center',
                              fontSize: 11, fontWeight: 700,
                              color: countryLevelTotal > 0 ? color : '#CCCCCC',
                              borderLeft: `2px solid ${color}33`,
                              borderRight: '1px solid #D8DFE8',
                            }}>
                              {countryLevelTotal > 0 ? countryLevelTotal.toFixed(1) : '—'}
                            </td>
                          );
                        }

                        return (
                          <React.Fragment key={g.country}>
                            {g.projects.map(proj => {
                              const projTotal = getLevelProjectTotal(levelPeople, proj.id);
                              return (
                                <td key={proj.id} style={{
                                  padding: '5px 4px', textAlign: 'center',
                                  fontSize: 11,
                                  color: projTotal > 0 ? '#1E8A4A' : '#CCCCCC',
                                  borderLeft: '1px solid #D8DFE8',
                                }}>
                                  {projTotal > 0 ? projTotal.toFixed(1) : ''}
                                </td>
                              );
                            })}
                            <td style={{
                              padding: '5px 6px', textAlign: 'center',
                              fontSize: 11, fontWeight: 700,
                              color: countryLevelTotal > 0 ? color : '#CCCCCC',
                              background: countryLevelTotal > 0 ? `${color}0A` : 'transparent',
                              borderLeft: '1px solid #C0C8E0',
                              borderRight: '1px solid #C0C8E0',
                            }}>
                              {countryLevelTotal > 0 ? countryLevelTotal.toFixed(1) : '—'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      <td style={{
                        position: 'sticky', right: 0, zIndex: 2,
                        background: '#EEF2F8', borderLeft: '2px solid #D5D5D5',
                        padding: '5px 8px', textAlign: 'center',
                        fontSize: 11, color: '#1565C0', fontWeight: 700,
                      }}>
                        {levelGrandTotal > 0 ? levelGrandTotal.toFixed(1) : '—'}
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
