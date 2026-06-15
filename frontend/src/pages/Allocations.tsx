import React, { useEffect, useState, useMemo, useCallback } from 'react';
import toast from 'react-hot-toast';
import {
  peopleApi, projectsApi, allocationsApi, refDataApi, gearingApi,
  headcountApi, type CreateHeadcountBody,
  type Person, type Project, type Allocation, type Region, type GearingConstant,
} from '../services/api';
import PersonEditPanel from '../components/PersonEditPanel';

interface PendingChange {
  personId: number;
  projectId: number;
  fteValue: number;
  month: string;
}

const DISCIPLINES = ['Construction', 'Design', 'Commercial', 'Commissioning', 'Other'];

const DISCIPLINE_COLOURS: Record<string, string> = {
  'Construction': '#E65100',
  'Design':       '#1565C0',
  'Commercial':   '#1E8A4A',
  'Commissioning':'#6A1B9A',
  'Other':        '#888888',
};

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
  if (total === 0)                return '#555555';
  if (total > contracted + 0.01)  return '#E31837';
  if (total >= contracted - 0.01) return '#33CC77';
  return '#F9A825';
}

// Compact shared styles
const SEL: React.CSSProperties = {
  padding: '5px 8px', background: '#FFFFFF', border: '1px solid #D5D5D5',
  borderRadius: 4, color: '#111111', fontSize: 12,
};
const LBL: React.CSSProperties = {
  fontSize: 11, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.06em',
};

const STICKY_BG = '#FFFFFF';
const ROW1_H    = 44;
const FOOT_BG   = '#F0F2F5';
const FOOT_BG2  = '#E8EBF0';
const FOOT_BORDER = '#C8CDD8';

export default function Allocations() {
  // ── Selectors ────────────────────────────────────────────────────────────
  const [regions, setRegions]               = useState<Region[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [selectedYear, setSelectedYear]     = useState(2026);
  const [statusFilter, setStatusFilter]     = useState('All');
  const [countryFilter, setCountryFilter]   = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('');

  // ── Collapse state ────────────────────────────────────────────────────────
  const [collapsedCountries, setCollapsedCountries]     = useState<Set<string>>(new Set());
  const [collapsedDisciplines, setCollapsedDisciplines] = useState<Set<string>>(new Set());
  const [collapsedLevels, setCollapsedLevels]           = useState<Set<string>>(new Set());

  // ── Data ─────────────────────────────────────────────────────────────────
  const [people, setPeople]               = useState<Person[]>([]);
  const [projects, setProjects]           = useState<Project[]>([]);
  const [allocations, setAllocations]     = useState<Allocation[]>([]);
  const [gearingConstants, setGearingConstants] = useState<GearingConstant[]>([]);
  const [refLevels, setRefLevels]         = useState<{ id: number; level_name: string; short_code: string }[]>([]);
  const [refCountries, setRefCountries]   = useState<{ id: number; name: string; region_id: number }[]>([]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [loading, setLoading]               = useState(false);
  const [backendError, setBackendError]     = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, PendingChange>>({});
  const [saving, setSaving]                 = useState(false);

  // Person edit panel
  const [editPerson, setEditPerson] = useState<Person | null>(null);

  // New headcount request modal
  const [requestModal, setRequestModal] = useState<{
    discipline: string; disciplineId?: number;
  } | null>(null);
  const [requestForm, setRequestForm] = useState({
    name: '', contract_type_code: 'R FTE' as 'R FTE' | 'R CON',
    level_id: '', country_id: '', notes: '',
  });
  const [requestSaving, setRequestSaving] = useState(false);

  const pendingCount = Object.keys(pendingChanges).length;

  // ── Load regions + gearing (once) ────────────────────────────────────────

  useEffect(() => {
    refDataApi.regions()
      .then(r => { setRegions(r); if (r.length > 0) setSelectedRegionId(r[0].id); })
      .catch(() => setBackendError(true));
    gearingApi.list().then(setGearingConstants).catch(() => {});
    refDataApi.levels().then(setRefLevels).catch(() => {});
    refDataApi.countries().then(setRefCountries).catch(() => {});
  }, []);

  // Reset country collapse + filter when region changes
  useEffect(() => {
    setCollapsedCountries(new Set());
    setCountryFilter('');
  }, [selectedRegionId]);

  // ── Load planning data ────────────────────────────────────────────────────

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
    } catch { setBackendError(true); }
    finally   { setLoading(false); }
  }, [selectedRegionId, selectedYear]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived: projects + countries ─────────────────────────────────────────

  const visibleProjects = useMemo(() => {
    let f = projects.filter(p => p.region_id === selectedRegionId);
    if (statusFilter !== 'All') f = f.filter(p => p.status === statusFilter);
    const ord: Record<string, number> = { Approved: 0, Seeded: 1, Proposed: 2 };
    return f.sort((a, b) => (ord[a.status] ?? 3) - (ord[b.status] ?? 3));
  }, [projects, selectedRegionId, statusFilter]);

  const countryGroups = useMemo(() => {
    const map: Record<string, Project[]> = {};
    for (const p of visibleProjects) {
      const c = p.country_name ?? 'Unassigned';
      if (!map[c]) map[c] = [];
      map[c].push(p);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
      .map(([country, projs]) => ({ country, projects: projs }));
  }, [visibleProjects]);

  // Filter to displayed countries
  const displayedCountryGroups = useMemo(() =>
    countryFilter ? countryGroups.filter(g => g.country === countryFilter) : countryGroups,
    [countryGroups, countryFilter]);

  const allCountryNames = useMemo(() => displayedCountryGroups.map(g => g.country), [displayedCountryGroups]);

  // ── Derived: allocation map ───────────────────────────────────────────────

  const allocMap = useMemo(() => {
    const m: Record<number, Record<number, { id: number; fte_value: number }>> = {};
    for (const a of allocations) {
      if (!m[a.person_id]) m[a.person_id] = {};
      m[a.person_id][a.project_id] = { id: a.id, fte_value: a.fte_value };
    }
    return m;
  }, [allocations]);

  // ── Derived: people hierarchy (Discipline → Level → People) ───────────────

  const hierarchy = useMemo(() => {
    const discMap: Record<string, Person[]> = {};
    for (const d of DISCIPLINES) discMap[d] = [];
    for (const p of people) {
      const disc = p.discipline_name ?? 'Other';
      if (DISCIPLINES.includes(disc)) discMap[disc].push(p);
      else discMap['Other'].push(p);
    }
    return DISCIPLINES.filter(d => discMap[d].length > 0).map(disc => {
      const discPeople = discMap[disc];
      const lvlMap: Record<string, { levelName: string; people: Person[] }> = {};
      for (const p of discPeople) {
        const code = p.level_code ?? 'Unknown';
        if (!lvlMap[code]) lvlMap[code] = { levelName: p.level_name ?? code, people: [] };
        lvlMap[code].people.push(p);
      }
      Object.values(lvlMap).forEach(g => g.people.sort((a, b) => a.name.localeCompare(b.name)));
      const levels = Object.entries(lvlMap)
        .sort(([a], [b]) => (LEVEL_ORDER[a] ?? 99) - (LEVEL_ORDER[b] ?? 99))
        .map(([code, { levelName, people: ppl }]) => ({ code, levelName, people: ppl }));
      const discId = discPeople[0]?.discipline_id ?? undefined;
      return { discipline: disc, disciplineId: discId, levels, allPeople: discPeople };
    });
  }, [people]);

  const displayedHierarchy = useMemo(() =>
    disciplineFilter ? hierarchy.filter(h => h.discipline === disciplineFilter) : hierarchy,
    [hierarchy, disciplineFilter]);

  // ── Derived: gearing map ──────────────────────────────────────────────────

  const gearingMap = useMemo(() => {
    const map: Record<string, Record<string, { min: number; max: number }>> = {};
    for (const gc of gearingConstants) {
      if (!map[gc.discipline_name]) map[gc.discipline_name] = {};
      map[gc.discipline_name][gc.project_type] = { min: gc.min_divisor, max: gc.max_divisor };
    }
    return map;
  }, [gearingConstants]);

  // ── Toggles ───────────────────────────────────────────────────────────────

  function toggleCountry(c: string) {
    setCollapsedCountries(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; });
  }
  function toggleDiscipline(d: string) {
    setCollapsedDisciplines(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; });
  }
  function toggleLevel(k: string) {
    setCollapsedLevels(prev => { const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n; });
  }
  const allCollapsed = allCountryNames.length > 0 && collapsedCountries.size >= allCountryNames.length;
  function collapseAllCountries() { setCollapsedCountries(new Set(allCountryNames)); }
  function expandAllCountries()   { setCollapsedCountries(new Set()); }

  // ── Cell value helpers ────────────────────────────────────────────────────

  function getCellValue(personId: number, projectId: number): number {
    const key = `${personId}_${projectId}`;
    if (pendingChanges[key] !== undefined) return pendingChanges[key].fteValue;
    return allocMap[personId]?.[projectId]?.fte_value ?? 0;
  }
  function isCellDirty(personId: number, projectId: number): boolean {
    return `${personId}_${projectId}` in pendingChanges;
  }

  // Person total is across DISPLAYED country groups only
  const displayedProjectIds = useMemo(() =>
    displayedCountryGroups.flatMap(g => g.projects.map(p => p.id)),
    [displayedCountryGroups]);

  function getPersonTotal(personId: number): number {
    return displayedProjectIds.reduce((s, pid) => s + getCellValue(personId, pid), 0);
  }
  function getPersonCountryTotal(personId: number, projs: Project[]): number {
    return projs.reduce((s, p) => s + getCellValue(personId, p.id), 0);
  }
  function getGroupProjectTotal(ppl: Person[], projectId: number): number {
    return ppl.reduce((s, p) => s + getCellValue(p.id, projectId), 0);
  }
  function getGroupCountryTotal(ppl: Person[], projs: Project[]): number {
    return ppl.reduce((s, p) => s + getPersonCountryTotal(p.id, projs), 0);
  }
  function getGroupGrandTotal(ppl: Person[]): number {
    return ppl.reduce((s, p) => s + getPersonTotal(p.id), 0);
  }

  // Gearing calculation for a country's project set
  function getCountryGearing(projs: Project[]) {
    // Project counts by type
    const typeCounts: Record<string, number> = {};
    for (const p of projs) typeCounts[p.type] = (typeCounts[p.type] ?? 0) + 1;

    // Sum gearing across all disciplines that have constants
    let gearMin = 0, gearMax = 0;
    for (const typeMap of Object.values(gearingMap)) {
      for (const [pType, { min: minDiv, max: maxDiv }] of Object.entries(typeMap)) {
        const cnt = typeCounts[pType] ?? 0;
        if (cnt > 0 && minDiv > 0 && maxDiv > 0) {
          gearMin += cnt / minDiv;
          gearMax += cnt / maxDiv;
        }
      }
    }

    // Total FTE allocated by all people for these projects
    const allocated = people.reduce((sum, person) =>
      sum + projs.reduce((s, proj) => s + getCellValue(person.id, proj.id), 0), 0);

    return { gearMin, gearMax, allocated };
  }

  function gearingStatusColor(allocated: number, gearMin: number, gearMax: number): string {
    if (gearMin === 0 && gearMax === 0) return '#777777';
    if (allocated < gearMin - 0.05) return '#C0392B'; // understaffed
    if (allocated > gearMax + 0.05)  return '#B5600A'; // overstaffed
    return '#1E8A4A'; // within range
  }

  // ── Cell change + save ────────────────────────────────────────────────────

  function handleCellChange(personId: number, projectId: number, rawValue: string) {
    const fteValue = parseFloat(rawValue) || 0;
    const key = `${personId}_${projectId}`;
    const month = `${selectedYear}-01-01`;
    if (fteValue === 0 && !allocMap[personId]?.[projectId]) {
      const next = { ...pendingChanges }; delete next[key]; setPendingChanges(next);
    } else {
      setPendingChanges(prev => ({ ...prev, [key]: { personId, projectId, fteValue, month } }));
    }
  }

  async function handleSaveAll() {
    if (!pendingCount) return;
    setSaving(true);
    try {
      await Promise.all(Object.values(pendingChanges).map(ch =>
        allocationsApi.upsert({
          person_id: ch.personId, project_id: ch.projectId,
          month: ch.month, fte_value: ch.fteValue, is_billable: true,
        })
      ));
      toast.success(`Saved ${pendingCount} allocation${pendingCount !== 1 ? 's' : ''}`);
      setPendingChanges({});
      await loadData();
    } catch { toast.error('Failed to save — check backend connection'); }
    finally   { setSaving(false); }
  }

  // ── Headcount request ────────────────────────────────────────────────────

  async function handleCreateRequest() {
    if (!requestForm.name.trim()) { toast.error('Name is required'); return; }
    setRequestSaving(true);
    try {
      const body: CreateHeadcountBody = {
        name: requestForm.name.trim(),
        contract_type_code: requestForm.contract_type_code,
        discipline_id: requestModal?.disciplineId ?? undefined,
        level_id: requestForm.level_id ? Number(requestForm.level_id) : undefined,
        country_id: requestForm.country_id ? Number(requestForm.country_id) : undefined,
        region_id: selectedRegionId ?? undefined,
        notes: requestForm.notes.trim() || undefined,
      };
      await headcountApi.create(body);
      toast.success('Headcount request created');
      setRequestModal(null);
      setRequestForm({ name: '', contract_type_code: 'R FTE', level_id: '', country_id: '', notes: '' });
      await loadData();
    } catch { toast.error('Failed to create request'); }
    finally   { setRequestSaving(false); }
  }

  // ── Column count ──────────────────────────────────────────────────────────

  const totalColCount = 2 + displayedCountryGroups.reduce((s, g) =>
    s + (collapsedCountries.has(g.country) ? 1 : g.projects.length + 1), 0);

  const selectedRegionName = regions.find(r => r.id === selectedRegionId)?.name ?? '';
  const hasGearing = Object.keys(gearingMap).length > 0;

  // ── Subtotal row ──────────────────────────────────────────────────────────

  function SubtotalRow({ label, labelColor, bg, ppl }: {
    label: string; labelColor: string; bg: string; ppl: Person[];
  }) {
    const grandTotal = getGroupGrandTotal(ppl);
    return (
      <tr style={{ background: bg }}>
        <td style={{
          position: 'sticky', left: 0, zIndex: 2, background: bg,
          padding: '5px 14px', fontSize: 11, color: labelColor, fontWeight: 700,
          borderRight: '2px solid #D0D0D0', borderTop: `1px solid ${labelColor}33`,
          whiteSpace: 'nowrap',
        }}>
          {label}
        </td>
        {displayedCountryGroups.map(g => {
          const col = countryColor(g.country);
          const ct  = getGroupCountryTotal(ppl, g.projects);
          if (collapsedCountries.has(g.country)) {
            return (
              <td key={g.country} style={{
                padding: '5px 6px', textAlign: 'center', fontSize: 11, fontWeight: 700,
                color: ct > 0 ? col : '#CCCCCC',
                borderLeft: `2px solid ${col}33`, borderRight: '1px solid #D8DFE8',
                borderTop: `1px solid ${labelColor}33`,
              }}>
                {ct > 0 ? ct.toFixed(1) : '—'}
              </td>
            );
          }
          return (
            <React.Fragment key={g.country}>
              {g.projects.map(proj => {
                const pt = getGroupProjectTotal(ppl, proj.id);
                return (
                  <td key={proj.id} style={{
                    padding: '5px 4px', textAlign: 'center', fontSize: 11,
                    color: pt > 0 ? '#1E8A4A' : '#CCCCCC',
                    borderLeft: '1px solid #D8DFE8', borderTop: `1px solid ${labelColor}33`,
                  }}>
                    {pt > 0 ? pt.toFixed(1) : ''}
                  </td>
                );
              })}
              <td style={{
                padding: '5px 6px', textAlign: 'center', fontSize: 11, fontWeight: 700,
                color: ct > 0 ? col : '#CCCCCC',
                background: ct > 0 ? `${col}0A` : 'transparent',
                borderLeft: '1px solid #C0C8E0', borderRight: '1px solid #C0C8E0',
                borderTop: `1px solid ${labelColor}33`,
              }}>
                {ct > 0 ? ct.toFixed(1) : '—'}
              </td>
            </React.Fragment>
          );
        })}
        <td style={{
          position: 'sticky', right: 0, zIndex: 2, background: bg,
          borderLeft: '2px solid #D5D5D5', padding: '5px 8px', textAlign: 'center',
          fontSize: 11, color: labelColor, fontWeight: 700,
          borderTop: `1px solid ${labelColor}33`,
        }}>
          {grandTotal > 0 ? grandTotal.toFixed(1) : '—'}
        </td>
      </tr>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ color: '#111111', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ── */}
      <div style={{
        padding: '14px 20px', background: '#FFFFFF',
        borderBottom: '1px solid #E5E5E5', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Allocations Planning</h1>
            <div style={{ width: 36, height: 3, background: '#E31837', borderRadius: 2, marginTop: 4 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {pendingCount > 0 && (
              <span style={{ fontSize: 11, color: '#D4870A', background: '#FFF8E1', padding: '3px 9px', borderRadius: 12, border: '1px solid #F9A825' }}>
                {pendingCount} unsaved
              </span>
            )}
            <button onClick={handleSaveAll} disabled={saving || pendingCount === 0} style={{
              padding: '7px 18px', background: pendingCount > 0 ? '#E31837' : '#CCCCCC',
              color: '#FFF', border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 600,
              cursor: pendingCount > 0 ? 'pointer' : 'default',
            }}>
              {saving ? 'Saving…' : `Save${pendingCount > 0 ? ` (${pendingCount})` : ''}`}
            </button>
          </div>
        </div>

        {/* ── Compact controls ── */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <label style={LBL}>Region</label>
            <select value={selectedRegionId ?? ''} onChange={e => setSelectedRegionId(Number(e.target.value))} style={SEL}>
              {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <label style={LBL}>Year</label>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} style={SEL}>
              <option value={2026}>2026</option>
              <option value={2027}>2027</option>
              <option value={2028}>2028</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <label style={LBL}>Status</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={SEL}>
              <option>All</option><option>Approved</option>
              <option>Seeded</option><option>Proposed</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <label style={LBL}>Country</label>
            <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)} style={SEL}>
              <option value="">All</option>
              {countryGroups.map(g => <option key={g.country} value={g.country}>{g.country}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <label style={LBL}>Discipline</label>
            <select value={disciplineFilter} onChange={e => setDisciplineFilter(e.target.value)} style={SEL}>
              <option value="">All</option>
              {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          {displayedCountryGroups.length > 0 && (
            <button onClick={allCollapsed ? expandAllCountries : collapseAllCountries} style={{
              padding: '5px 10px', background: 'transparent',
              border: '1px solid #D5D5D5', borderRadius: 4,
              fontSize: 11, color: '#555555', cursor: 'pointer',
            }}>
              {allCollapsed ? 'Expand countries' : 'Collapse countries'}
            </button>
          )}

          <span style={{ fontSize: 11, color: '#999999' }}>
            {visibleProjects.length} project{visibleProjects.length !== 1 ? 's' : ''} · {people.length} people
          </span>
        </div>
      </div>

      {backendError && (
        <div style={{ padding: '10px 20px', background: '#FFFBEB', borderBottom: '1px solid #F5DFA0', color: '#996600', fontSize: 13, flexShrink: 0 }}>
          ⚠ Cannot reach backend.
          <button onClick={loadData} style={{ marginLeft: 12, padding: '3px 10px', background: 'transparent', border: '1px solid #D4870A', color: '#996600', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Retry</button>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div className="spinner" />
        </div>
      )}

      {!loading && !backendError && visibleProjects.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 8, color: '#666666' }}>
          <div style={{ fontSize: 16 }}>No projects found for {selectedRegionName} {selectedYear}</div>
          <div style={{ fontSize: 13 }}>Add projects in the Projects screen first, then assign them to this region and year.</div>
        </div>
      )}

      {!loading && visibleProjects.length > 0 && (
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed', minWidth: '100%' }}>

            <colgroup>
              <col style={{ width: 220 }} />
              {displayedCountryGroups.map(g =>
                collapsedCountries.has(g.country)
                  ? <col key={`cg-${g.country}`} style={{ width: 65 }} />
                  : <React.Fragment key={`cg-${g.country}`}>
                      {g.projects.map(p => <col key={p.id} style={{ width: 72 }} />)}
                      <col style={{ width: 65 }} />
                    </React.Fragment>
              )}
              <col style={{ width: 65 }} />
            </colgroup>

            {/* ── Two-row sticky header ── */}
            <thead>
              <tr style={{ background: '#F8F9FA' }}>
                <th rowSpan={2} style={{
                  position: 'sticky', top: 0, left: 0, zIndex: 5,
                  background: '#F8F9FA', borderRight: '2px solid #E0E0E0',
                  borderBottom: '2px solid #D0D0D0', padding: '10px 14px',
                  textAlign: 'left', fontSize: 11, color: '#666666',
                  textTransform: 'uppercase', letterSpacing: '0.08em', verticalAlign: 'middle',
                }}>
                  Person
                </th>
                {displayedCountryGroups.map(g => {
                  const isCollapsed = collapsedCountries.has(g.country);
                  const color = countryColor(g.country);
                  if (isCollapsed) {
                    return (
                      <th key={g.country} rowSpan={2} onClick={() => toggleCountry(g.country)}
                        title={`Expand ${g.country}`}
                        style={{
                          position: 'sticky', top: 0, zIndex: 3,
                          background: '#F8F9FA', borderLeft: `3px solid ${color}`,
                          borderBottom: '2px solid #D0D0D0', borderRight: '1px solid #E0E0E0',
                          padding: '5px 6px', textAlign: 'center', cursor: 'pointer',
                          whiteSpace: 'nowrap', verticalAlign: 'middle',
                        }}>
                        <div style={{ fontWeight: 700, color, fontSize: 11 }}>{g.country}</div>
                        <div style={{ fontSize: 9, color: '#999999', marginTop: 2 }}>{g.projects.length}p ▶</div>
                      </th>
                    );
                  }
                  return (
                    <th key={g.country} colSpan={g.projects.length + 1}
                      onClick={() => toggleCountry(g.country)} title={`Collapse ${g.country}`}
                      style={{
                        position: 'sticky', top: 0, zIndex: 3,
                        background: '#F8F9FA', borderLeft: `3px solid ${color}`,
                        borderBottom: '1px solid #D0D0D0', borderRight: '1px solid #DDDDDD',
                        padding: '6px 10px', textAlign: 'center', cursor: 'pointer',
                        fontWeight: 700, color, fontSize: 12, whiteSpace: 'nowrap',
                      }}>
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

              <tr style={{ background: '#F8F9FA' }}>
                {displayedCountryGroups.map(g => {
                  if (collapsedCountries.has(g.country)) return null;
                  const color = countryColor(g.country);
                  return (
                    <React.Fragment key={g.country}>
                      {g.projects.map(p => (
                        <th key={p.id} style={{
                          position: 'sticky', top: ROW1_H, zIndex: 3,
                          background: '#F8F9FA', borderLeft: '1px solid #EEEEEE',
                          borderBottom: '1px solid #D0D0D0', padding: '5px 4px', textAlign: 'center',
                        }}>
                          <div style={{
                            fontSize: 10, fontWeight: 600, color: STATUS_COLOURS[p.status] ?? '#333333',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            maxWidth: 64, margin: '0 auto',
                          }} title={p.name}>{p.name}</div>
                          <span style={{
                            fontSize: 9, padding: '1px 3px', borderRadius: 3,
                            background: '#FFFFFF', color: STATUS_COLOURS[p.status] ?? '#666666',
                            border: `1px solid ${STATUS_COLOURS[p.status] ?? '#CCCCCC'}`,
                            display: 'inline-block', marginTop: 2,
                          }}>{p.status}</span>
                        </th>
                      ))}
                      <th style={{
                        position: 'sticky', top: ROW1_H, zIndex: 3, background: '#EEF4FF',
                        borderLeft: '1px solid #C0C8E0', borderRight: '1px solid #C0C8E0',
                        borderBottom: '1px solid #D0D0D0', padding: '5px 4px', textAlign: 'center',
                        fontSize: 10, color, fontWeight: 700, whiteSpace: 'nowrap',
                      }}>
                        Σ {g.country.slice(0, 3)}
                      </th>
                    </React.Fragment>
                  );
                })}
              </tr>
            </thead>

            {/* ── Body ── */}
            <tbody>
              {displayedHierarchy.map(({ discipline, disciplineId, levels, allPeople }) => {
                const isDiscCollapsed = collapsedDisciplines.has(discipline);
                const discColor       = DISCIPLINE_COLOURS[discipline] ?? '#888888';
                const discTotal       = getGroupGrandTotal(allPeople);

                return (
                  <React.Fragment key={discipline}>

                    {/* Discipline header */}
                    <tr onClick={() => toggleDiscipline(discipline)} style={{ cursor: 'pointer' }}>
                      <td colSpan={totalColCount - 1} style={{
                        position: 'sticky', left: 0, zIndex: 2,
                        background: '#F2F4F8',
                        borderLeft: `4px solid ${discColor}`,
                        borderTop: '2px solid #D8DDE8', borderBottom: '1px solid #D8DDE8',
                        padding: '8px 14px', fontWeight: 700, fontSize: 13, color: discColor,
                        whiteSpace: 'nowrap',
                      }}>
                        <span style={{ marginRight: 8, fontSize: 11, opacity: 0.7 }}>
                          {isDiscCollapsed ? '▶' : '▼'}
                        </span>
                        {discipline}
                        <span style={{ marginLeft: 10, color: '#888888', fontWeight: 400, fontSize: 11 }}>
                          {allPeople.length} {allPeople.length === 1 ? 'person' : 'people'}
                        </span>
                      </td>
                      <td style={{
                        position: 'sticky', right: 0, zIndex: 2,
                        background: '#F2F4F8', borderLeft: '2px solid #D5D5D5',
                        borderTop: '2px solid #D8DDE8', borderBottom: '1px solid #D8DDE8',
                        padding: '8px', textAlign: 'center', fontSize: 12, fontWeight: 700,
                        color: discTotal > 0 ? discColor : '#CCCCCC',
                      }}>
                        {discTotal > 0 ? discTotal.toFixed(1) : '—'}
                      </td>
                    </tr>

                    {/* Level groups */}
                    {!isDiscCollapsed && levels.map(({ code, levelName, people: levelPeople }) => {
                      const levelKey       = `${discipline}::${code}`;
                      const isLvlCollapsed = collapsedLevels.has(levelKey);
                      const levelTotal     = getGroupGrandTotal(levelPeople);

                      return (
                        <React.Fragment key={levelKey}>

                          {/* Level header */}
                          <tr onClick={() => toggleLevel(levelKey)} style={{ cursor: 'pointer' }}>
                            <td colSpan={totalColCount - 1} style={{
                              position: 'sticky', left: 0, zIndex: 2,
                              background: '#EBF0FB',
                              borderLeft: '3px solid #1565C0',
                              borderTop: '1px solid #D0D8F0', borderBottom: '1px solid #D0D8F0',
                              padding: '6px 14px 6px 28px', fontWeight: 600, fontSize: 12, color: '#1565C0',
                              whiteSpace: 'nowrap',
                            }}>
                              <span style={{ marginRight: 8, fontSize: 10, opacity: 0.7 }}>
                                {isLvlCollapsed ? '▶' : '▼'}
                              </span>
                              {levelName}
                              <span style={{ marginLeft: 10, color: '#888888', fontWeight: 400, fontSize: 11 }}>
                                {levelPeople.length} {levelPeople.length === 1 ? 'person' : 'people'}
                              </span>
                            </td>
                            <td style={{
                              position: 'sticky', right: 0, zIndex: 2,
                              background: '#EBF0FB', borderLeft: '2px solid #D5D5D5',
                              borderTop: '1px solid #D0D8F0', borderBottom: '1px solid #D0D8F0',
                              padding: '6px 8px', textAlign: 'center',
                              fontSize: 11, fontWeight: 700,
                              color: levelTotal > 0 ? '#1565C0' : '#CCCCCC',
                            }}>
                              {levelTotal > 0 ? levelTotal.toFixed(1) : '—'}
                            </td>
                          </tr>

                          {/* Person rows */}
                          {!isLvlCollapsed && levelPeople.map(person => {
                            const total      = getPersonTotal(person.id);
                            const contracted = parseFloat(String(person.contracted_fte ?? 1)) || 1;
                            const cc         = contractColour(person.contract_type_code);

                            return (
                              <tr key={person.id} style={{ borderBottom: '1px solid #F0F0F0' }}>
                                <td style={{
                                  position: 'sticky', left: 0, zIndex: 2,
                                  background: STICKY_BG, borderRight: '2px solid #E0E0E0',
                                  padding: '5px 14px 5px 28px', maxWidth: 220, overflow: 'hidden',
                                }}>
                                  <div
                                    onClick={() => setEditPerson(person)}
                                    title="Click to edit"
                                    style={{
                                      fontSize: 13, color: '#111111', fontWeight: 500,
                                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                      cursor: 'pointer', textDecoration: 'underline',
                                      textDecorationColor: '#CCCCCC', textDecorationStyle: 'dotted',
                                    }}>
                                    {person.name}
                                  </div>
                                  <div style={{ display: 'flex', gap: 4, marginTop: 2, alignItems: 'center' }}>
                                    <span style={{
                                      fontSize: 9, padding: '1px 5px', borderRadius: 3,
                                      background: cc.bg, color: cc.color, border: `1px solid ${cc.border}`,
                                      whiteSpace: 'nowrap',
                                    }}>
                                      {person.contract_type_code ?? 'FTE'}
                                    </span>
                                    <span style={{ fontSize: 9, color: '#777777' }}>
                                      {contracted.toFixed(1)} FTE
                                    </span>
                                  </div>
                                </td>

                                {displayedCountryGroups.map(g => {
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
                                        const val   = getCellValue(person.id, proj.id);
                                        const dirty = isCellDirty(person.id, proj.id);
                                        return (
                                          <td key={proj.id} style={{
                                            padding: '3px 4px', textAlign: 'center',
                                            borderLeft: '1px solid #EEEEEE',
                                            background: dirty ? '#FFFBEB' : 'transparent',
                                            verticalAlign: 'middle',
                                          }}>
                                            <input
                                              type="number" min="0" max="2" step="0.1"
                                              defaultValue={val > 0 ? val.toString() : ''}
                                              key={`${person.id}_${proj.id}_${allocations.length}`}
                                              onBlur={e => handleCellChange(person.id, proj.id, e.target.value)}
                                              style={{
                                                width: 52, padding: '3px 2px', background: '#FFFFFF',
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
                                        padding: '4px 6px', textAlign: 'center',
                                        fontSize: 12, fontWeight: 600,
                                        color: countryTotal > 0 ? color : '#CCCCCC',
                                        background: countryTotal > 0 ? `${color}0A` : '#F8F9FA',
                                        borderLeft: '1px solid #C0C8E0', borderRight: '1px solid #C0C8E0',
                                        verticalAlign: 'middle',
                                      }}>
                                        {countryTotal > 0 ? countryTotal.toFixed(1) : '—'}
                                      </td>
                                    </React.Fragment>
                                  );
                                })}

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

                          <SubtotalRow label={`${levelName} · Subtotal`} labelColor="#1565C0" bg="#EEF2F8" ppl={levelPeople} />

                        </React.Fragment>
                      );
                    })}

                    {!isDiscCollapsed && (
                      <SubtotalRow label={`${discipline} · Total`} labelColor={discColor} bg={`${discColor}0D`} ppl={allPeople} />
                    )}

                    {/* + Request headcount button for this discipline */}
                    <tr>
                      <td colSpan={totalColCount} style={{
                        padding: '4px 14px 4px 18px',
                        background: '#FAFAFA',
                        borderBottom: '1px solid #EEEEEE',
                      }}>
                        <button
                          onClick={() => {
                            setRequestModal({ discipline, disciplineId: disciplineId });
                            setRequestForm({ name: `TBH – ${discipline} `, contract_type_code: 'R FTE', level_id: '', country_id: '', notes: '' });
                          }}
                          style={{
                            fontSize: 11, color: discColor, background: 'transparent',
                            border: `1px dashed ${discColor}55`, borderRadius: 4,
                            padding: '3px 10px', cursor: 'pointer',
                          }}
                        >
                          + Request headcount ({discipline})
                        </button>
                      </td>
                    </tr>

                  </React.Fragment>
                );
              })}
            </tbody>

            {/* ── Gearing footer ── */}
            {hasGearing && (
              <tfoot>
                {/* Separator */}
                <tr>
                  <td colSpan={totalColCount} style={{ padding: 0, height: 2, background: FOOT_BORDER }} />
                </tr>

                {/* Total Allocated */}
                <tr style={{ background: FOOT_BG }}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 2, background: FOOT_BG,
                    padding: '7px 14px', fontSize: 11, fontWeight: 700, color: '#333333',
                    borderRight: `2px solid ${FOOT_BORDER}`, whiteSpace: 'nowrap',
                  }}>
                    Total Allocated
                  </td>
                  {displayedCountryGroups.map(g => {
                    const { allocated, gearMin, gearMax } = getCountryGearing(g.projects);
                    const gc = gearingStatusColor(allocated, gearMin, gearMax);
                    const isCollapsed = collapsedCountries.has(g.country);

                    if (isCollapsed) {
                      return (
                        <td key={g.country} style={{
                          textAlign: 'center', fontSize: 13, fontWeight: 700, color: gc,
                          background: FOOT_BG, padding: '7px 6px',
                          borderLeft: `2px solid ${FOOT_BORDER}`,
                        }}>
                          {allocated > 0 ? allocated.toFixed(1) : '—'}
                        </td>
                      );
                    }
                    return (
                      <React.Fragment key={g.country}>
                        {g.projects.map(proj => {
                          const pt = people.reduce((s, p) => s + getCellValue(p.id, proj.id), 0);
                          return (
                            <td key={proj.id} style={{
                              textAlign: 'center', fontSize: 11, color: '#555555',
                              background: FOOT_BG, padding: '7px 4px', borderLeft: `1px solid ${FOOT_BORDER}`,
                            }}>
                              {pt > 0 ? pt.toFixed(1) : ''}
                            </td>
                          );
                        })}
                        <td style={{
                          textAlign: 'center', fontSize: 13, fontWeight: 700, color: gc,
                          background: FOOT_BG, padding: '7px 6px',
                          borderLeft: `1px solid ${FOOT_BORDER}`, borderRight: `1px solid ${FOOT_BORDER}`,
                        }}>
                          {allocated > 0 ? allocated.toFixed(1) : '—'}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td style={{
                    position: 'sticky', right: 0, zIndex: 2, background: FOOT_BG,
                    borderLeft: `2px solid ${FOOT_BORDER}`, padding: '7px 8px',
                    textAlign: 'center', fontSize: 12, fontWeight: 700, color: '#333333',
                  }}>
                    {people.reduce((s, p) => s + displayedProjectIds.reduce((ss, pid) => ss + getCellValue(p.id, pid), 0), 0).toFixed(1)}
                  </td>
                </tr>

                {/* Gearing Min */}
                <tr style={{ background: FOOT_BG2 }}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 2, background: FOOT_BG2,
                    padding: '5px 14px', fontSize: 10, color: '#1E8A4A',
                    borderRight: `2px solid ${FOOT_BORDER}`, whiteSpace: 'nowrap', fontWeight: 600,
                  }}>
                    Gearing Min
                  </td>
                  {displayedCountryGroups.map(g => {
                    const { gearMin } = getCountryGearing(g.projects);
                    const isCollapsed = collapsedCountries.has(g.country);
                    if (isCollapsed) {
                      return (
                        <td key={g.country} style={{
                          textAlign: 'center', fontSize: 11, color: '#1E8A4A',
                          background: FOOT_BG2, padding: '5px 6px', borderLeft: `2px solid ${FOOT_BORDER}`,
                        }}>
                          {gearMin > 0 ? gearMin.toFixed(1) : '—'}
                        </td>
                      );
                    }
                    return (
                      <React.Fragment key={g.country}>
                        {g.projects.map(proj => (
                          <td key={proj.id} style={{ background: FOOT_BG2, borderLeft: `1px solid ${FOOT_BORDER}` }} />
                        ))}
                        <td style={{
                          textAlign: 'center', fontSize: 11, color: '#1E8A4A',
                          background: FOOT_BG2, padding: '5px 6px',
                          borderLeft: `1px solid ${FOOT_BORDER}`, borderRight: `1px solid ${FOOT_BORDER}`,
                        }}>
                          {gearMin > 0 ? gearMin.toFixed(1) : '—'}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td style={{
                    position: 'sticky', right: 0, zIndex: 2, background: FOOT_BG2,
                    borderLeft: `2px solid ${FOOT_BORDER}`, padding: '5px 8px',
                    textAlign: 'center', fontSize: 10, color: '#888888',
                  }}>—</td>
                </tr>

                {/* Gearing Max */}
                <tr style={{ background: FOOT_BG2 }}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 2, background: FOOT_BG2,
                    padding: '5px 14px', fontSize: 10, color: '#B5600A',
                    borderRight: `2px solid ${FOOT_BORDER}`, whiteSpace: 'nowrap', fontWeight: 600,
                  }}>
                    Gearing Max
                  </td>
                  {displayedCountryGroups.map(g => {
                    const { gearMax } = getCountryGearing(g.projects);
                    const isCollapsed = collapsedCountries.has(g.country);
                    if (isCollapsed) {
                      return (
                        <td key={g.country} style={{
                          textAlign: 'center', fontSize: 11, color: '#B5600A',
                          background: FOOT_BG2, padding: '5px 6px', borderLeft: `2px solid ${FOOT_BORDER}`,
                        }}>
                          {gearMax > 0 ? gearMax.toFixed(1) : '—'}
                        </td>
                      );
                    }
                    return (
                      <React.Fragment key={g.country}>
                        {g.projects.map(proj => (
                          <td key={proj.id} style={{ background: FOOT_BG2, borderLeft: `1px solid ${FOOT_BORDER}` }} />
                        ))}
                        <td style={{
                          textAlign: 'center', fontSize: 11, color: '#B5600A',
                          background: FOOT_BG2, padding: '5px 6px',
                          borderLeft: `1px solid ${FOOT_BORDER}`, borderRight: `1px solid ${FOOT_BORDER}`,
                        }}>
                          {gearMax > 0 ? gearMax.toFixed(1) : '—'}
                        </td>
                      </React.Fragment>
                    );
                  })}
                  <td style={{
                    position: 'sticky', right: 0, zIndex: 2, background: FOOT_BG2,
                    borderLeft: `2px solid ${FOOT_BORDER}`, padding: '5px 8px',
                    textAlign: 'center', fontSize: 10, color: '#888888',
                  }}>—</td>
                </tr>

                {/* Variance vs Min */}
                <tr style={{ background: FOOT_BG2 }}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 2, background: FOOT_BG2,
                    padding: '5px 14px', fontSize: 10, color: '#555555',
                    borderRight: `2px solid ${FOOT_BORDER}`, whiteSpace: 'nowrap', fontWeight: 600,
                    borderTop: `1px solid ${FOOT_BORDER}`,
                  }}>
                    Variance vs Min
                  </td>
                  {displayedCountryGroups.map(g => {
                    const { allocated, gearMin, gearMax } = getCountryGearing(g.projects);
                    const variance = allocated - gearMin;
                    const gc       = gearingStatusColor(allocated, gearMin, gearMax);
                    const isCollapsed = collapsedCountries.has(g.country);

                    const varCell = (key?: number | string) => (
                      <td key={key} style={{
                        textAlign: 'center', fontSize: 11, fontWeight: 700, color: gc,
                        background: FOOT_BG2, padding: '5px 6px',
                        borderLeft: isCollapsed ? `2px solid ${FOOT_BORDER}` : `1px solid ${FOOT_BORDER}`,
                        borderRight: `1px solid ${FOOT_BORDER}`, borderTop: `1px solid ${FOOT_BORDER}`,
                      }}>
                        {gearMin > 0 ? (variance >= 0 ? `+${variance.toFixed(1)}` : variance.toFixed(1)) : '—'}
                      </td>
                    );

                    if (isCollapsed) return varCell(g.country);
                    return (
                      <React.Fragment key={g.country}>
                        {g.projects.map(proj => (
                          <td key={proj.id} style={{ background: FOOT_BG2, borderLeft: `1px solid ${FOOT_BORDER}`, borderTop: `1px solid ${FOOT_BORDER}` }} />
                        ))}
                        {varCell()}
                      </React.Fragment>
                    );
                  })}
                  <td style={{
                    position: 'sticky', right: 0, zIndex: 2, background: FOOT_BG2,
                    borderLeft: `2px solid ${FOOT_BORDER}`, padding: '5px 8px',
                    textAlign: 'center', fontSize: 10, color: '#888888',
                    borderTop: `1px solid ${FOOT_BORDER}`,
                  }}>—</td>
                </tr>

                {/* Variance vs Max */}
                <tr style={{ background: FOOT_BG2 }}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 2, background: FOOT_BG2,
                    padding: '5px 14px', fontSize: 10, color: '#555555',
                    borderRight: `2px solid ${FOOT_BORDER}`, whiteSpace: 'nowrap', fontWeight: 600,
                  }}>
                    Variance vs Max
                  </td>
                  {displayedCountryGroups.map(g => {
                    const { allocated, gearMin, gearMax } = getCountryGearing(g.projects);
                    const varianceMax = allocated - gearMax;
                    const gc          = gearingStatusColor(allocated, gearMin, gearMax);
                    const isCollapsed = collapsedCountries.has(g.country);

                    const varMaxCell = (key?: number | string) => (
                      <td key={key} style={{
                        textAlign: 'center', fontSize: 11, fontWeight: 700, color: gc,
                        background: FOOT_BG2, padding: '5px 6px',
                        borderLeft: isCollapsed ? `2px solid ${FOOT_BORDER}` : `1px solid ${FOOT_BORDER}`,
                        borderRight: `1px solid ${FOOT_BORDER}`,
                      }}>
                        {gearMax > 0 ? (varianceMax >= 0 ? `+${varianceMax.toFixed(1)}` : varianceMax.toFixed(1)) : '—'}
                      </td>
                    );

                    if (isCollapsed) return varMaxCell(g.country);
                    return (
                      <React.Fragment key={g.country}>
                        {g.projects.map(proj => (
                          <td key={proj.id} style={{ background: FOOT_BG2, borderLeft: `1px solid ${FOOT_BORDER}` }} />
                        ))}
                        {varMaxCell()}
                      </React.Fragment>
                    );
                  })}
                  <td style={{
                    position: 'sticky', right: 0, zIndex: 2, background: FOOT_BG2,
                    borderLeft: `2px solid ${FOOT_BORDER}`, padding: '5px 8px',
                    textAlign: 'center', fontSize: 10, color: '#888888',
                  }}>—</td>
                </tr>
              </tfoot>
            )}

          </table>
        </div>
      )}

      {/* ── Person edit panel ── */}
      <PersonEditPanel
        person={editPerson}
        onClose={() => setEditPerson(null)}
        onSaved={updated => {
          setPeople(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p));
          setEditPerson(null);
        }}
      />

      {/* ── New headcount request modal ── */}
      {requestModal && (
        <>
          <div onClick={() => setRequestModal(null)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 400,
          }} />
          <div style={{
            position: 'fixed', top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 420, background: '#FFFFFF', borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)', zIndex: 401,
            padding: 24, display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#111111' }}>
              Request Headcount — {requestModal.discipline}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>
                Placeholder name
              </label>
              <input
                style={{ padding: '8px 10px', border: '1px solid #D5D5D5', borderRadius: 4, fontSize: 13 }}
                value={requestForm.name}
                onChange={e => setRequestForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. TBH – Construction VP"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Type</label>
                <select
                  style={{ padding: '8px 10px', border: '1px solid #D5D5D5', borderRadius: 4, fontSize: 13 }}
                  value={requestForm.contract_type_code}
                  onChange={e => setRequestForm(prev => ({ ...prev, contract_type_code: e.target.value as 'R FTE' | 'R CON' }))}
                >
                  <option value="R FTE">R FTE — Request Employee</option>
                  <option value="R CON">R CON — Request Contractor</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Level</label>
                <select
                  style={{ padding: '8px 10px', border: '1px solid #D5D5D5', borderRadius: 4, fontSize: 13 }}
                  value={requestForm.level_id}
                  onChange={e => setRequestForm(prev => ({ ...prev, level_id: e.target.value }))}
                >
                  <option value="">— Any level —</option>
                  {refLevels.map(l => <option key={l.id} value={l.id}>{l.level_name} ({l.short_code})</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Country</label>
              <select
                style={{ padding: '8px 10px', border: '1px solid #D5D5D5', borderRadius: 4, fontSize: 13 }}
                value={requestForm.country_id}
                onChange={e => setRequestForm(prev => ({ ...prev, country_id: e.target.value }))}
              >
                <option value="">— Not specified —</option>
                {refCountries
                  .filter(c => !selectedRegionId || c.region_id === selectedRegionId)
                  .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>Notes / Justification</label>
              <textarea
                rows={3}
                style={{ padding: '8px 10px', border: '1px solid #D5D5D5', borderRadius: 4, fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
                value={requestForm.notes}
                onChange={e => setRequestForm(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Why is this role needed?"
              />
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setRequestModal(null)} style={{
                flex: 1, padding: '9px 0', background: '#FFFFFF',
                border: '1px solid #D5D5D5', borderRadius: 5, fontSize: 13, cursor: 'pointer',
              }}>
                Cancel
              </button>
              <button onClick={handleCreateRequest} disabled={requestSaving} style={{
                flex: 2, padding: '9px 0',
                background: requestSaving ? '#CCCCCC' : '#E31837',
                border: 'none', borderRadius: 5, fontSize: 13, fontWeight: 600,
                color: '#FFFFFF', cursor: requestSaving ? 'default' : 'pointer',
              }}>
                {requestSaving ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
