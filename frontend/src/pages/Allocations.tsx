import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  peopleApi, projectsApi, refDataApi, gearingApi, countryAllocationsApi, personCommentsApi,
  type Person, type Project, type Region, type GearingConstant,
  type CountryAllocation, type PersonComment,
} from '../services/api';
import { usePlanningCycle } from '../context/PlanningCycleContext';
import { useTabDirty } from '../context/TabContext';
import PersonEditPanel from '../components/PersonEditPanel';

const CURRENT_USER_ROLE = 'Workforce Planning';
const DISCIPLINES = ['Construction', 'Design', 'Commercial', 'Commissioning', 'Other'];

const DISCIPLINE_COLOURS: Record<string, { bg: string; text: string; light: string }> = {
  'Construction': { bg: '#086AE3', text: '#FFFFFF', light: '#EEF4FD' },
  'Design':       { bg: '#33A85C', text: '#FFFFFF', light: '#EEF8F2' },
  'Commercial':   { bg: '#C59000', text: '#FFFFFF', light: '#FFF9E6' },
  'Commissioning':{ bg: '#00737A', text: '#FFFFFF', light: '#E6F5F6' },
  'Other':        { bg: '#5A657B', text: '#FFFFFF', light: '#F0F2F5' },
};

const CONTRACT_PILL: Record<string, { bg: string; color: string; border: string }> = {
  'FTE':      { bg: '#F0F0F0', color: '#333333', border: '#C8C8C8' },
  'SNR':      { bg: '#F0F0F0', color: '#333333', border: '#C8C8C8' },
  'VP':       { bg: '#E8EAF6', color: '#3949AB', border: '#9FA8DA' },
  'Dr':       { bg: '#EDE7F6', color: '#512DA8', border: '#B39DDB' },
  'CON':      { bg: '#FFF8E1', color: '#E65100', border: '#FDB90D' },
  'A FTE':    { bg: '#FFF0F0', color: '#AD050C', border: '#E91C24' },
  'A CON':    { bg: '#FFF8E1', color: '#E65100', border: '#FDB90D' },
  'R FTE':    { bg: '#FDE8F6', color: '#AD1457', border: '#E91E8C' },
  'R CON':    { bg: '#FDE8F6', color: '#AD1457', border: '#E91E8C' },
  'R FTE 26': { bg: '#FDE8F6', color: '#AD1457', border: '#E91E8C' },
};

const LEVEL_ORDER: Record<string, number> = {
  'VP': 1, 'S Dr': 2, 'Dr': 3, 'S M': 4, 'M': 5,
  'St': 6, 'Sc': 7, 'Ex': 8, 'Sp': 9, 'In': 10,
  'En': 11, 'Ca': 12, 'Te': 13, 'Cons': 14,
};

const STATUS_COLOURS: Record<string, string> = {
  'Approved': '#E91C24', 'Seeded': '#7739D9', 'Proposed': '#086AE3',
};

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

type ContractGroup = 'employee' | 'contingent' | 'approved' | 'request';

function contractGroup(p: Person): ContractGroup {
  const code = p.contract_type_code ?? '';
  const cat  = p.contract_category  ?? '';
  if (cat === 'requested' || code.startsWith('R ')) return 'request';
  if (cat === 'approved'  || code.startsWith('A ')) return 'approved';
  if (code === 'CON')                                return 'contingent';
  return 'employee';
}

const GROUP_LABEL: Record<ContractGroup, string> = {
  employee: 'Staff', contingent: 'Contingent',
  approved: 'Approved Requests', request: 'Requests',
};
const GROUP_ORDER: Record<ContractGroup, number> = {
  employee: 0, contingent: 1, approved: 2, request: 3,
};

function pillStyle(p: Person): React.CSSProperties {
  const s = CONTRACT_PILL[p.contract_type_code ?? ''] ?? CONTRACT_PILL['FTE'];
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '2px 8px', borderRadius: 10,
    background: s.bg, color: s.color,
    border: `1px solid ${s.border}`,
    fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' as const,
    maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis',
  };
}

function ftePillStyle(val: number, code: string): React.CSSProperties {
  const s = CONTRACT_PILL[code] ?? CONTRACT_PILL['FTE'];
  return {
    display: 'inline-block',
    padding: '2px 8px', borderRadius: 10,
    background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    fontSize: 11, fontWeight: 700,
  };
}

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

const COL_W = 150;
const NAME_W = 230;
const TOTAL_W = 70;

export default function Allocations({ tabId }: { tabId?: string } = {}) {
  const { cycles, selectedCycleId, setSelectedCycleId, selectedCycle, selectedRegionId, setSelectedRegionId } = usePlanningCycle();
  const canEdit = !selectedCycle || (['active', 'under_review'].includes(selectedCycle.status));

  // ── Data ──────────────────────────────────────────────────────────────────
  const [regions, setRegions]           = useState<Region[]>([]);
  const [allPeople, setAllPeople]       = useState<Person[]>([]);
  const [projects, setProjects]         = useState<Project[]>([]);
  const [countryAllocs, setCountryAllocs] = useState<CountryAllocation[]>([]);
  const [gearingConstants, setGearingConstants] = useState<GearingConstant[]>([]);
  const [loading, setLoading]           = useState(false);
  const [backendError, setBackendError] = useState(false);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter]         = useState('');
  const [countryFilter, setCountryFilter]       = useState('');
  const [disciplineFilter, setDisciplineFilter] = useState('');

  // ── Collapse ──────────────────────────────────────────────────────────────
  const [collapsedDisciplines, setCollapsedDisciplines] = useState<Set<string>>(new Set());
  const [collapsedLevelGroups, setCollapsedLevelGroups] = useState<Set<string>>(new Set());
  const [collapsedCountries, setCollapsedCountries]     = useState<Set<string>>(new Set());

  // ── UI state ──────────────────────────────────────────────────────────────
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [addModal, setAddModal]     = useState<{ preDisciplineId?: number } | null>(null);
  const [hoveredCountry, setHoveredCountry] = useState<{ name: string; x: number; y: number } | null>(null);

  // Add allocation modal state
  const [modalPersonId, setModalPersonId]   = useState<number | ''>('');
  const [modalAllocs, setModalAllocs]       = useState<Record<number, string>>({});
  const [modalSaving, setModalSaving]       = useState(false);

  // Dirty tracking (allocation saves happen through modal, but track unsaved state)
  const [dirtyPersonIds, setDirtyPersonIds] = useState<Set<number>>(new Set());
  useTabDirty(tabId, dirtyPersonIds.size > 0);

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    refDataApi.regions().then(setRegions).catch(() => setBackendError(true));
  }, []);

  useEffect(() => { setCollapsedCountries(new Set()); setCountryFilter(''); }, [selectedRegionId]);

  const loadData = useCallback(async () => {
    setLoading(true); setBackendError(false);
    try {
      const [ppl, projs, allocs, gc] = await Promise.all([
        peopleApi.list({ is_active: 'true', limit: 500,
          ...(selectedRegionId ? { region_id: selectedRegionId } : {}) }).catch(() => [] as Person[]),
        projectsApi.list({ is_active: 'true', limit: 500,
          ...(selectedCycleId ? { planning_cycle_id: selectedCycleId } : {}) }).catch(() => [] as Project[]),
        countryAllocationsApi.list({
          ...(selectedCycleId  ? { planning_cycle_id: selectedCycleId }  : {}),
          ...(selectedRegionId ? { region_id: selectedRegionId } : {}),
        }).catch(() => [] as CountryAllocation[]),
        gearingApi.list().catch(() => [] as GearingConstant[]),
      ]);
      setAllPeople(ppl);
      setProjects(projs);
      setCountryAllocs(allocs);
      setGearingConstants(gc);
    } catch { setBackendError(true); }
    finally   { setLoading(false); }
  }, [selectedCycleId, selectedRegionId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived: countries from projects ──────────────────────────────────────
  const countryGroups = useMemo(() => {
    let filtered = projects.filter(p => p.region_id === selectedRegionId);
    if (statusFilter) filtered = filtered.filter(p => p.status === statusFilter);
    const map: Record<string, { id: number; projects: Project[] }> = {};
    for (const p of filtered) {
      const c = p.country_name ?? 'Unassigned';
      if (!map[c]) map[c] = { id: p.country_id ?? 0, projects: [] };
      map[c].projects.push(p);
    }
    // Also include countries from allocations that might not have projects
    for (const a of countryAllocs) {
      if (!map[a.country_name]) map[a.country_name] = { id: a.country_id, projects: [] };
    }
    const groups = Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([country, { id, projects: projs }]) => ({
        country,
        countryId: id,
        projects: projs,
        totalWeight: projs.reduce((s, p) => s + (Number(p.weight) || 1), 0),
      }));
    return countryFilter ? groups.filter(g => g.country === countryFilter) : groups;
  }, [projects, countryAllocs, selectedRegionId, statusFilter, countryFilter]);

  // ── Derived: alloc map ────────────────────────────────────────────────────
  const allocMap = useMemo(() => {
    const m: Record<number, Record<number, number>> = {};
    for (const a of countryAllocs) {
      if (!m[a.person_id]) m[a.person_id] = {};
      m[a.person_id][a.country_id] = Number(a.fte_value);
    }
    return m;
  }, [countryAllocs]);

  // ── Derived: people in grid (those with allocations) ──────────────────────
  const allocatedPersonIds = useMemo(
    () => new Set(countryAllocs.map(a => a.person_id)),
    [countryAllocs]
  );

  const allocatedPeople = useMemo(
    () => allPeople.filter(p => allocatedPersonIds.has(p.id)),
    [allPeople, allocatedPersonIds]
  );

  // ── Derived: hierarchy ────────────────────────────────────────────────────
  type HierarchyEntry = {
    discipline: string;
    disciplineId?: number | null;
    groups: { group: ContractGroup; levels: { code: string; name: string; people: Person[] }[] }[];
    allPeople: Person[];
  };

  const hierarchy = useMemo((): HierarchyEntry[] => {
    const discMap: Record<string, Person[]> = {};
    for (const d of DISCIPLINES) discMap[d] = [];
    for (const p of allocatedPeople) {
      const disc = p.discipline_name ?? 'Other';
      (discMap[DISCIPLINES.includes(disc) ? disc : 'Other'] ??= []).push(p);
    }
    return DISCIPLINES.filter(d => discMap[d].length > 0).map(disc => {
      const ppl = discMap[disc];
      const discId = ppl[0]?.discipline_id;

      const byGroup: Record<ContractGroup, Person[]> = {
        employee: [], contingent: [], approved: [], request: [],
      };
      for (const p of ppl) byGroup[contractGroup(p)].push(p);

      const groups = (['employee', 'contingent', 'approved', 'request'] as ContractGroup[])
        .filter(g => byGroup[g].length > 0)
        .map(g => {
          const lvlMap: Record<string, { name: string; people: Person[] }> = {};
          for (const p of byGroup[g]) {
            const code = p.level_code ?? 'Unknown';
            if (!lvlMap[code]) lvlMap[code] = { name: p.level_name ?? code, people: [] };
            lvlMap[code].people.push(p);
          }
          Object.values(lvlMap).forEach(l => l.people.sort((a, b) => a.name.localeCompare(b.name)));
          const levels = Object.entries(lvlMap)
            .sort(([a], [b]) => (LEVEL_ORDER[a] ?? 99) - (LEVEL_ORDER[b] ?? 99))
            .map(([code, { name, people: pp }]) => ({ code, name, people: pp }));
          return { group: g, levels };
        });

      return { discipline: disc, disciplineId: discId, groups, allPeople: ppl };
    });
  }, [allocatedPeople]);

  const displayedHierarchy = useMemo(
    () => disciplineFilter ? hierarchy.filter(h => h.discipline === disciplineFilter) : hierarchy,
    [hierarchy, disciplineFilter]
  );

  // ── Collapse toggles ──────────────────────────────────────────────────────
  const allDeptsCollapsed = displayedHierarchy.length > 0 &&
    displayedHierarchy.every(h => collapsedDisciplines.has(h.discipline));
  const allLevelsCollapsed = displayedHierarchy.length > 0 &&
    displayedHierarchy.every(h => h.groups.every(g => g.levels.every(l =>
      collapsedLevelGroups.has(`${h.discipline}::${g.group}::${l.code}`)
    )));
  const allCountriesCollapsed = countryGroups.length > 0 &&
    collapsedCountries.size >= countryGroups.length;

  function toggleDisc(d: string) {
    setCollapsedDisciplines(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n; });
  }
  function toggleLevelGroup(key: string) {
    setCollapsedLevelGroups(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  }
  function toggleCountryCol(c: string) {
    setCollapsedCountries(prev => { const n = new Set(prev); n.has(c) ? n.delete(c) : n.add(c); return n; });
  }

  // ── Banner metrics ────────────────────────────────────────────────────────
  const bannerMetrics = useMemo(() => {
    const totalAvailable = allPeople.reduce((s, p) => s + (parseFloat(String(p.contracted_fte ?? 1)) || 1), 0);
    const totalAllocated = countryAllocs.reduce((s, a) => s + Number(a.fte_value), 0);
    const byDisc = DISCIPLINES.map(d => ({
      discipline: d,
      allocated: countryAllocs
        .filter(a => allPeople.find(p => p.id === a.person_id)?.discipline_name === d)
        .reduce((s, a) => s + Number(a.fte_value), 0),
    })).filter(d => d.allocated > 0);
    return { totalAvailable, totalAllocated, byDisc };
  }, [allPeople, countryAllocs]);

  // ── Footer totals (Proposed/Min/Max per country) ──────────────────────────
  const footerTotals = useMemo(() => {
    // Average gearing per project type across all disciplines
    const avgGearing: Record<string, { min: number; max: number; count: number }> = {};
    for (const g of gearingConstants) {
      if (!avgGearing[g.project_type]) avgGearing[g.project_type] = { min: 0, max: 0, count: 0 };
      avgGearing[g.project_type].min += Number(g.min_divisor);
      avgGearing[g.project_type].max += Number(g.max_divisor);
      avgGearing[g.project_type].count += 1;
    }
    return countryGroups.map(g => {
      const proposed = countryAllocs
        .filter(a => a.country_id === g.countryId)
        .reduce((s, a) => s + Number(a.fte_value), 0);
      let minFte = 0, maxFte = 0;
      for (const proj of g.projects) {
        const ptype = proj.type ?? 'Retail';
        const ag = avgGearing[ptype];
        if (ag && ag.count > 0) {
          const avgMin = ag.min / ag.count;
          const avgMax = ag.max / ag.count;
          if (avgMin > 0) minFte += Number(proj.weight) / avgMin;
          if (avgMax > 0) maxFte += Number(proj.weight) / avgMax;
        }
      }
      return { countryId: g.countryId, country: g.country, proposed, min: minFte, max: maxFte };
    });
  }, [countryGroups, countryAllocs, gearingConstants]);

  // ── Add allocation modal helpers ──────────────────────────────────────────
  function openAddModal(preDisciplineId?: number) {
    setModalPersonId('');
    setModalAllocs({});
    setAddModal({ preDisciplineId });
  }

  function openEditAllocModal(person: Person) {
    setModalPersonId(person.id);
    const existing: Record<number, string> = {};
    for (const a of countryAllocs.filter(a => a.person_id === person.id)) {
      existing[a.country_id] = String(a.fte_value);
    }
    setModalAllocs(existing);
    setAddModal({});
  }

  async function saveModalAllocs() {
    if (!modalPersonId) return;
    const allocs = countryGroups.map(g => ({
      country_id: g.countryId,
      fte_value: parseFloat(modalAllocs[g.countryId] ?? '0') || 0,
    })).filter(a => a.fte_value > 0);
    const total = allocs.reduce((s, a) => s + a.fte_value, 0);
    if (total > 1.001) { toast.error(`Total FTE ${total.toFixed(2)} exceeds 1.0`); return; }
    setModalSaving(true);
    try {
      await countryAllocationsApi.save(Number(modalPersonId), selectedCycleId ?? null, allocs);
      toast.success('Allocations saved');
      setAddModal(null);
      await loadData();
    } catch { toast.error('Failed to save'); }
    finally { setModalSaving(false); }
  }

  const modalTotal = countryGroups.reduce((s, g) => s + (parseFloat(modalAllocs[g.countryId] ?? '0') || 0), 0);

  // People available in the add modal (filtered by region, optionally by discipline)
  const modalPeople = useMemo(() => {
    let ppl = allPeople;
    if (addModal?.preDisciplineId) ppl = ppl.filter(p => p.discipline_id === addModal.preDisciplineId);
    return ppl.sort((a, b) => a.name.localeCompare(b.name));
  }, [allPeople, addModal]);

  const selectedRegionName = regions.find(r => r.id === selectedRegionId)?.name ?? '';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ color: '#111111', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* ── Banner (single row like Projects page) ── */}
      <div style={{ flexShrink: 0, background: '#FFFFFF', borderBottom: '3px solid #E91C24' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', gap: 0, flexWrap: 'wrap' as const }}>
          {/* Title */}
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', lineHeight: 1, paddingRight: 16, marginRight: 16, borderRight: '1px solid #E0E3E8', whiteSpace: 'nowrap', flexShrink: 0 }}>
            Allocations Planning
          </div>
          {/* Metrics */}
          {!loading && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingRight: 14, marginRight: 14, borderRight: '1px solid #E0E3E8' }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#111827', lineHeight: 1 }}>{bannerMetrics.totalAvailable.toFixed(1)}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: '#5A657B', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginTop: 2 }}>Available</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingRight: 14, marginRight: 14, borderRight: '1px solid #E0E3E8' }}>
                <span style={{ fontSize: 20, fontWeight: 700, color: '#33A85C', lineHeight: 1 }}>{bannerMetrics.totalAllocated.toFixed(1)}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: '#5A657B', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginTop: 2 }}>Allocated</span>
              </div>
              {bannerMetrics.totalAvailable > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingRight: 20, marginRight: 20, borderRight: '1px solid #E0E3E8' }}>
                  {(() => {
                    const u = bannerMetrics.totalAllocated / bannerMetrics.totalAvailable;
                    const c = u > 1.05 ? '#E91C24' : u >= 0.85 ? '#33A85C' : '#FDB90D';
                    return <>
                      <span style={{ fontSize: 20, fontWeight: 700, color: c, lineHeight: 1 }}>{Math.round(u * 100)}%</span>
                      <span style={{ fontSize: 9, fontWeight: 600, color: '#5A657B', textTransform: 'uppercase' as const, letterSpacing: '0.1em', marginTop: 2 }}>Utilisation</span>
                    </>;
                  })()}
                </div>
              )}
              {bannerMetrics.byDisc.map(d => {
                const dc = DISCIPLINE_COLOURS[d.discipline] ?? DISCIPLINE_COLOURS['Other'];
                return (
                  <div key={d.discipline} style={{ display: 'flex', alignItems: 'center', gap: 5, marginRight: 18 }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: dc.bg, lineHeight: 1 }}>{d.allocated.toFixed(1)}</span>
                    <span style={{ fontSize: 9, fontWeight: 600, color: '#5A657B', textTransform: 'uppercase' as const, letterSpacing: '0.07em' }}>{d.discipline}</span>
                  </div>
                );
              })}
            </>
          )}
          {/* Region + Cycle selectors on the right */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: '#5A657B', fontWeight: 500 }}>Region</span>
            <select value={selectedRegionId ?? ''} onChange={e => setSelectedRegionId(e.target.value ? Number(e.target.value) : null)}
              style={{ background: '#F2F3F5', border: '1px solid #E0E3E8', color: '#111827', fontSize: 12, fontWeight: 500, borderRadius: 4, padding: '3px 6px', cursor: 'pointer', outline: 'none', width: 90 }}>
              <option value="">All</option>
              {regions.map(r => <option key={r.id} value={r.id}>{r.code}</option>)}
            </select>
            <span style={{ fontSize: 11, color: '#5A657B', fontWeight: 500 }}>Cycle</span>
            <select value={selectedCycleId ?? ''} onChange={e => setSelectedCycleId(e.target.value ? Number(e.target.value) : null)}
              style={{ background: '#F2F3F5', border: '1px solid #E0E3E8', color: '#111827', fontSize: 12, fontWeight: 500, borderRadius: 4, padding: '3px 6px', cursor: 'pointer', outline: 'none' }}>
              <option value="">All Cycles</option>
              {cycles.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── Filter / action row ── */}
      <div style={{ flexShrink: 0, padding: '8px 16px', background: '#FFFFFF', borderBottom: '1px solid #E5E5E5', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' as const }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '5px 8px', background: '#FFFFFF', border: '1px solid #D5D5D5', borderRadius: 4, color: '#111111', fontSize: 12 }}>
          <option value="">All statuses</option>
          <option>Approved</option><option>Seeded</option><option>Proposed</option>
        </select>
        <select value={countryFilter} onChange={e => setCountryFilter(e.target.value)}
          style={{ padding: '5px 8px', background: '#FFFFFF', border: '1px solid #D5D5D5', borderRadius: 4, color: '#111111', fontSize: 12 }}>
          <option value="">All countries</option>
          {countryGroups.map(g => <option key={g.country} value={g.country}>{g.country}</option>)}
        </select>
        <select value={disciplineFilter} onChange={e => setDisciplineFilter(e.target.value)}
          style={{ padding: '5px 8px', background: '#FFFFFF', border: '1px solid #D5D5D5', borderRadius: 4, color: '#111111', fontSize: 12 }}>
          <option value="">All disciplines</option>
          {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <span style={{ fontSize: 11, color: '#999999' }}>
          {countryGroups.length} countr{countryGroups.length !== 1 ? 'ies' : 'y'} · {allocatedPeople.length} people
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {!canEdit && selectedCycle && (
            <span style={{ fontSize: 11, color: '#D97706', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 6, padding: '3px 9px', fontWeight: 600 }}>
              🔒 Read only
            </span>
          )}
          <button onClick={() => allCountriesCollapsed ? setCollapsedCountries(new Set()) : setCollapsedCountries(new Set(countryGroups.map(g => g.country)))}
            style={{ padding: '4px 10px', background: '#E91C24', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">{allCountriesCollapsed ? <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/> : <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>}</svg>
            Countries
          </button>
          <button onClick={() => allDeptsCollapsed ? setCollapsedDisciplines(new Set()) : setCollapsedDisciplines(new Set(hierarchy.map(h => h.discipline)))}
            style={{ padding: '4px 10px', background: '#E91C24', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">{allDeptsCollapsed ? <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/> : <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>}</svg>
            Dept
          </button>
          <button onClick={() => {
            if (allLevelsCollapsed) { setCollapsedLevelGroups(new Set()); }
            else {
              const keys = hierarchy.flatMap(h => h.groups.flatMap(g => g.levels.map(l => `${h.discipline}::${g.group}::${l.code}`)));
              setCollapsedLevelGroups(new Set(keys));
            }
          }} style={{ padding: '4px 10px', background: '#E91C24', border: 'none', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#FFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">{allLevelsCollapsed ? <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/> : <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>}</svg>
            Levels
          </button>
          {canEdit && (
            <button onClick={() => openAddModal()}
              style={{ padding: '4px 12px', background: '#FFFFFF', border: '1px solid #E91C24', borderRadius: 4, fontSize: 11, fontWeight: 600, color: '#E91C24', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              + Person
            </button>
          )}
        </div>
      </div>

      {/* ── Error / loading ── */}
      {backendError && (
        <div style={{ padding: '8px 16px', background: '#FFFBEB', borderBottom: '1px solid #F5DFA0', color: '#996600', fontSize: 13, flexShrink: 0 }}>
          ⚠ Cannot reach backend.
          <button onClick={loadData} style={{ marginLeft: 10, padding: '2px 10px', background: 'transparent', border: '1px solid #D4870A', color: '#996600', borderRadius: 4, cursor: 'pointer', fontSize: 12 }}>Retry</button>
        </div>
      )}
      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div className="spinner" />
        </div>
      )}
      {!loading && countryGroups.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, flexDirection: 'column', gap: 8, color: '#666666' }}>
          <div style={{ fontSize: 16 }}>No projects found for {selectedRegionName || 'this region'}</div>
          <div style={{ fontSize: 13 }}>Add projects in the Projects screen, then assign them to this region and planning cycle.</div>
        </div>
      )}

      {/* ── Main table ── */}
      {!loading && countryGroups.length > 0 && (
        <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, tableLayout: 'fixed', minWidth: '100%' }}>
            <colgroup>
              <col style={{ width: NAME_W }} />
              {countryGroups.map(g =>
                collapsedCountries.has(g.country)
                  ? <col key={g.country} style={{ width: 50 }} />
                  : <col key={g.country} style={{ width: COL_W }} />
              )}
              <col style={{ width: TOTAL_W }} />
            </colgroup>

            {/* ── Country header ── */}
            <thead>
              <tr>
                {/* Name column header */}
                <th style={{
                  position: 'sticky', left: 0, top: 0, zIndex: 4,
                  background: '#1A1A2E', color: '#FFFFFF',
                  padding: '8px 10px', textAlign: 'left', fontWeight: 700, fontSize: 11,
                  borderRight: '2px solid #333355', borderBottom: '2px solid #333355',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  Name
                </th>

                {/* Country columns */}
                {countryGroups.map(g => {
                  const collapsed = collapsedCountries.has(g.country);
                  const flag = flagUrl(g.country);
                  return (
                    <th
                      key={g.country}
                      onMouseEnter={e => !collapsed && setHoveredCountry({ name: g.country, x: e.clientX, y: e.clientY })}
                      onMouseLeave={() => setHoveredCountry(null)}
                      onMouseMove={e => !collapsed && setHoveredCountry(prev => prev && prev.name === g.country ? { ...prev, x: e.clientX, y: e.clientY } : prev)}
                      onClick={() => toggleCountryCol(g.country)}
                      style={{
                        position: 'sticky', top: 0, zIndex: 3,
                        background: '#111111', color: '#FFFFFF',
                        padding: collapsed ? '8px 4px' : '6px 8px',
                        textAlign: 'center', cursor: 'pointer',
                        borderRight: '1px solid #333333', borderBottom: '2px solid #444444',
                        minWidth: collapsed ? 50 : COL_W, maxWidth: collapsed ? 50 : COL_W,
                        whiteSpace: 'nowrap' as const, overflow: 'hidden',
                      }}
                    >
                      {collapsed ? (
                        <span style={{ fontSize: 9, writingMode: 'vertical-rl' as const, transform: 'rotate(180deg)', display: 'inline-block', color: '#AAAAAA', letterSpacing: '0.05em' }}>
                          {g.country}
                        </span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {flag && <img src={flag} alt="" width={16} height={12} style={{ borderRadius: 2, flexShrink: 0, objectFit: 'cover' }} />}
                            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.03em' }}>{g.country}</span>
                          </div>
                          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                            Wt {g.totalWeight.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </th>
                  );
                })}

                {/* Total header */}
                <th style={{
                  position: 'sticky', top: 0, zIndex: 3,
                  background: '#1A1A2E', color: '#FFFFFF',
                  padding: '8px 6px', textAlign: 'center', fontWeight: 700, fontSize: 10,
                  borderBottom: '2px solid #333355',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>
                  Total
                </th>
              </tr>
            </thead>

            <tbody>
              {displayedHierarchy.map(h => {
                const dc = DISCIPLINE_COLOURS[h.discipline] ?? DISCIPLINE_COLOURS['Other'];
                const discCollapsed = collapsedDisciplines.has(h.discipline);
                const discTotal = h.allPeople.reduce((s, p) =>
                  s + countryGroups.reduce((cs, g) => cs + (allocMap[p.id]?.[g.countryId] ?? 0), 0), 0);

                return (
                  <React.Fragment key={h.discipline}>
                    {/* Discipline header row */}
                    <tr>
                      <td colSpan={countryGroups.length + 2} style={{ padding: 0 }}>
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '7px 10px',
                            background: dc.bg, color: dc.text,
                            cursor: 'pointer', userSelect: 'none' as const,
                          }}
                          onClick={() => toggleDisc(h.discipline)}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, transform: discCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.15s' }}>
                            <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
                          </svg>
                          <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', flex: 1 }}>
                            {h.discipline}
                          </span>
                          <span style={{ fontSize: 10, opacity: 0.8 }}>
                            {h.allPeople.length} people · {discTotal.toFixed(1)} FTE
                          </span>
                          {canEdit && (
                            <button
                              onClick={e => { e.stopPropagation(); openAddModal(h.disciplineId ?? undefined); }}
                              style={{ background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 4, color: '#FFFFFF', fontSize: 10, fontWeight: 700, padding: '2px 8px', cursor: 'pointer' }}
                            >
                              + Person
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Person rows (within discipline) */}
                    {!discCollapsed && h.groups.map(grp => (
                      <React.Fragment key={grp.group}>
                        {/* Contract group sub-header (only if there are multiple groups in this discipline) */}
                        {h.groups.length > 1 && (
                          <tr>
                            <td colSpan={countryGroups.length + 2} style={{
                              padding: '3px 10px 3px 24px',
                              background: dc.light,
                              color: dc.bg,
                              fontSize: 10, fontWeight: 700,
                              textTransform: 'uppercase' as const, letterSpacing: '0.07em',
                              borderBottom: `1px solid ${dc.bg}22`,
                            }}>
                              {GROUP_LABEL[grp.group]}
                            </td>
                          </tr>
                        )}

                        {grp.levels.map(lvl => {
                          const lvlKey = `${h.discipline}::${grp.group}::${lvl.code}`;
                          const lvlCollapsed = collapsedLevelGroups.has(lvlKey);
                          return (
                            <React.Fragment key={lvlKey}>
                              {/* Level sub-header */}
                              <tr>
                                <td colSpan={countryGroups.length + 2}
                                  onClick={() => toggleLevelGroup(lvlKey)}
                                  style={{
                                    padding: '3px 10px 3px 20px',
                                    background: '#F5F6F8', cursor: 'pointer',
                                    borderBottom: '1px solid #E8EAED', borderTop: '1px solid #E8EAED',
                                  }}>
                                  <span style={{ fontSize: 10, fontWeight: 600, color: '#5A657B', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                                    {lvl.name} ({lvl.code}) · {lvl.people.length}
                                  </span>
                                </td>
                              </tr>

                              {/* Person rows */}
                              {!lvlCollapsed && lvl.people.map((p, pi) => {
                                const personTotal = countryGroups.reduce((s, g) => s + (allocMap[p.id]?.[g.countryId] ?? 0), 0);
                                const rowBg = pi % 2 === 0 ? '#FFFFFF' : '#FAFBFC';
                                return (
                                  <tr key={p.id} style={{ background: rowBg }}>
                                    {/* Name cell (sticky) */}
                                    <td style={{
                                      position: 'sticky', left: 0, zIndex: 2,
                                      background: rowBg,
                                      padding: '5px 8px',
                                      borderRight: '1px solid #E0E3E8',
                                      borderBottom: '1px solid #EEF0F3',
                                    }}>
                                      <div
                                        onClick={() => canEdit && setEditPerson(p)}
                                        style={{ ...pillStyle(p), cursor: canEdit ? 'pointer' : 'default' }}
                                        title={p.name}
                                      >
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                                        {p.contract_type_code && (
                                          <span style={{ fontSize: 9, opacity: 0.7, flexShrink: 0 }}>{p.level_code}</span>
                                        )}
                                      </div>
                                    </td>

                                    {/* Country cells */}
                                    {countryGroups.map(g => {
                                      const val = allocMap[p.id]?.[g.countryId] ?? 0;
                                      const collapsed = collapsedCountries.has(g.country);
                                      return (
                                        <td key={g.country} style={{
                                          padding: collapsed ? '5px 2px' : '5px 8px',
                                          textAlign: 'center',
                                          borderRight: '1px solid #E0E3E8',
                                          borderBottom: '1px solid #EEF0F3',
                                          background: val > 0 ? (pi % 2 === 0 ? '#FAFFFE' : '#F5FDFC') : rowBg,
                                        }}>
                                          {val > 0 && !collapsed && (
                                            <span
                                              onClick={canEdit ? () => openEditAllocModal(p) : undefined}
                                              style={{ ...ftePillStyle(val, p.contract_type_code ?? ''), cursor: canEdit ? 'pointer' : 'default' }}
                                            >
                                              {val % 1 === 0 ? val.toFixed(0) : val.toFixed(2)}
                                            </span>
                                          )}
                                          {val > 0 && collapsed && (
                                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: dc.bg, display: 'inline-block' }} />
                                          )}
                                        </td>
                                      );
                                    })}

                                    {/* Total cell */}
                                    <td style={{
                                      padding: '5px 6px', textAlign: 'center', fontWeight: 700,
                                      fontSize: 12, borderBottom: '1px solid #EEF0F3',
                                      color: personTotal > 0 ? '#33A85C' : '#CCCCCC',
                                    }}>
                                      {personTotal > 0 ? personTotal.toFixed(personTotal % 1 === 0 ? 0 : 2) : '—'}
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>

            {/* ── Footer totals: Proposed / Min / Max ── */}
            <tfoot>
              {[
                { label: 'Proposed', key: 'proposed' as const, color: '#086AE3', title: 'Total FTE currently allocated to this country' },
                { label: 'Min',      key: 'min'      as const, color: '#33A85C', title: 'Minimum required headcount from gearing model' },
                { label: 'Max',      key: 'max'      as const, color: '#C59000', title: 'Maximum required headcount from gearing model' },
              ].map(({ label, key, color, title }) => (
                <tr key={label}>
                  <td title={title} style={{
                    position: 'sticky', left: 0, zIndex: 2,
                    padding: '6px 10px', fontWeight: 700, fontSize: 11,
                    background: '#1A1A2E', color: '#FFFFFF',
                    borderTop: label === 'Proposed' ? '2px solid #333355' : '1px solid #2E2E4E',
                    borderRight: '2px solid #333355',
                    textTransform: 'uppercase' as const, letterSpacing: '0.07em',
                  }}>
                    {label}
                  </td>
                  {countryGroups.map(g => {
                    const ft = footerTotals.find(f => f.countryId === g.countryId);
                    const val = ft ? ft[key] : 0;
                    const collapsed = collapsedCountries.has(g.country);
                    return (
                      <td key={g.country} style={{
                        padding: collapsed ? '6px 2px' : '6px 8px',
                        textAlign: 'center',
                        background: '#1A1A2E',
                        borderTop: label === 'Proposed' ? '2px solid #333355' : '1px solid #2E2E4E',
                        borderRight: '1px solid #2E2E4E',
                      }}>
                        {!collapsed && val > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 700, color }}>{val.toFixed(1)}</span>
                        )}
                        {!collapsed && val === 0 && (
                          <span style={{ fontSize: 11, color: '#555577' }}>—</span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{
                    padding: '6px 6px', textAlign: 'center',
                    background: '#1A1A2E',
                    borderTop: label === 'Proposed' ? '2px solid #333355' : '1px solid #2E2E4E',
                  }}>
                    {(() => {
                      const total = footerTotals.reduce((s, f) => s + f[key], 0);
                      return total > 0
                        ? <span style={{ fontSize: 12, fontWeight: 700, color }}>{total.toFixed(1)}</span>
                        : <span style={{ fontSize: 11, color: '#555577' }}>—</span>;
                    })()}
                  </td>
                </tr>
              ))}
            </tfoot>
          </table>

          {allocatedPeople.length === 0 && !loading && (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: '#888888', fontSize: 13 }}>
              No people allocated yet — use <strong>+ Person</strong> to add allocations.
            </div>
          )}
        </div>
      )}

      {/* ── Country hover tooltip ── */}
      {hoveredCountry && (() => {
        const group = countryGroups.find(g => g.country === hoveredCountry.name);
        if (!group || group.projects.length === 0) return null;
        return (
          <div style={{
            position: 'fixed', zIndex: 999,
            left: Math.min(hoveredCountry.x + 12, window.innerWidth - 260),
            top: hoveredCountry.y + 12,
            background: '#1A1A2E', color: '#FFFFFF',
            border: '1px solid #333355', borderRadius: 8,
            padding: '10px 12px', minWidth: 220, maxWidth: 280,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            pointerEvents: 'none' as const,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase' as const, letterSpacing: '0.08em', marginBottom: 8 }}>
              {group.country} — {group.projects.length} project{group.projects.length !== 1 ? 's' : ''}
            </div>
            {[...group.projects].sort((a, b) => {
              const order = ['Approved', 'Seeded', 'Proposed'];
              return (order.indexOf(a.status) === -1 ? 99 : order.indexOf(a.status)) -
                     (order.indexOf(b.status) === -1 ? 99 : order.indexOf(b.status));
            }).map(proj => (
              <div key={proj.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: STATUS_COLOURS[proj.status] ?? '#888',
                }} />
                <span style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{proj.name}</span>
                <span style={{
                  fontSize: 9, padding: '1px 5px', borderRadius: 3,
                  background: STATUS_COLOURS[proj.status] ?? '#888', color: '#FFF',
                  fontWeight: 700, flexShrink: 0,
                }}>{proj.status}</span>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', flexShrink: 0 }}>Wt {proj.weight}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Add / Edit Allocation Modal ── */}
      {addModal !== null && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
          zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={e => { if (e.target === e.currentTarget) setAddModal(null); }}>
          <div style={{
            background: '#FFFFFF', borderRadius: 10, width: '100%', maxWidth: 500,
            maxHeight: '85vh', overflowY: 'auto',
            padding: '24px 28px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            border: '1px solid #E0E0E0',
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#111111' }}>
              {modalPersonId ? 'Edit Allocations' : 'Add Person Allocation'}
            </h2>

            {/* Person select */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 10, color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.07em', fontWeight: 600, display: 'block', marginBottom: 4 }}>
                Person {addModal.preDisciplineId ? `(${DISCIPLINES.find(d => hierarchy.find(h => h.disciplineId === addModal.preDisciplineId)?.discipline === d) ?? 'filtered'})` : ''}
              </label>
              <select
                value={modalPersonId}
                onChange={e => {
                  const pid = Number(e.target.value);
                  setModalPersonId(pid || '');
                  if (pid) {
                    const existing: Record<number, string> = {};
                    for (const a of countryAllocs.filter(a => a.person_id === pid)) {
                      existing[a.country_id] = String(a.fte_value);
                    }
                    setModalAllocs(existing);
                  } else {
                    setModalAllocs({});
                  }
                }}
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #D5D5D5', borderRadius: 4, fontSize: 13, color: '#111111', background: '#FFFFFF', outline: 'none' }}
              >
                <option value="">— Select a person —</option>
                {modalPeople.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.level_code ? `(${p.level_code})` : ''} {p.discipline_name ? `· ${p.discipline_name}` : ''}
                  </option>
                ))}
              </select>
              {/* Quick-access to full person details */}
              {modalPersonId && (() => {
                const selPerson = allPeople.find(p => p.id === Number(modalPersonId));
                return selPerson ? (
                  <button
                    type="button"
                    onClick={() => { setAddModal(null); setEditPerson(selPerson); }}
                    style={{ marginTop: 6, width: '100%', padding: '6px 0', background: '#F0F4FF', border: '1px solid #BFD0FF', borderRadius: 4, fontSize: 12, fontWeight: 600, color: '#086AE3', cursor: 'pointer', textAlign: 'center' }}
                  >
                    ✏ Edit {selPerson.name}'s Full Details (Type, TBH Code, etc.)
                  </button>
                ) : null;
              })()}
            </div>

            {/* Country FTE inputs */}
            {countryGroups.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase' as const, letterSpacing: '0.07em', fontWeight: 600, marginBottom: 8 }}>
                  Country Allocations (total must be ≤ 1.0)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {countryGroups.map(g => {
                    const flag = flagUrl(g.country);
                    const val = modalAllocs[g.countryId] ?? '';
                    return (
                      <div key={g.country} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: 1, minWidth: 0 }}>
                          {flag && <img src={flag} alt="" width={16} height={12} style={{ borderRadius: 2, objectFit: 'cover', flexShrink: 0 }} />}
                          <span style={{ fontSize: 13, color: '#111111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{g.country}</span>
                          <span style={{ fontSize: 10, color: '#888', marginLeft: 4, flexShrink: 0 }}>Wt {g.totalWeight.toFixed(1)}</span>
                        </div>
                        <input
                          type="number" min="0" max="1" step="0.1"
                          value={val}
                          onChange={e => setModalAllocs(prev => ({ ...prev, [g.countryId]: e.target.value }))}
                          placeholder="0.0"
                          style={{ width: 70, padding: '5px 8px', border: '1px solid #D5D5D5', borderRadius: 4, fontSize: 13, textAlign: 'center', outline: 'none' }}
                        />
                      </div>
                    );
                  })}
                </div>
                <div style={{
                  marginTop: 10, padding: '6px 10px', borderRadius: 5,
                  background: modalTotal > 1.001 ? '#FFF0F0' : modalTotal > 0 ? '#F0FFF4' : '#F5F5F5',
                  border: `1px solid ${modalTotal > 1.001 ? '#E91C24' : modalTotal > 0 ? '#33A85C' : '#E0E0E0'}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#444444' }}>Total FTE</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: modalTotal > 1.001 ? '#AD050C' : modalTotal > 0 ? '#1A7A40' : '#888888' }}>
                    {modalTotal.toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => setAddModal(null)} style={{ flex: 1, padding: '9px 0', background: '#FFFFFF', border: '1px solid #D5D5D5', borderRadius: 5, fontSize: 13, color: '#555555', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={saveModalAllocs}
                disabled={!modalPersonId || modalSaving || modalTotal > 1.001}
                style={{
                  flex: 2, padding: '9px 0', background: '#E91C24', border: 'none', borderRadius: 5,
                  fontSize: 13, fontWeight: 600, color: '#FFFFFF',
                  cursor: (!modalPersonId || modalSaving || modalTotal > 1.001) ? 'default' : 'pointer',
                  opacity: (!modalPersonId || modalTotal > 1.001) ? 0.5 : 1,
                }}
              >
                {modalSaving ? 'Saving…' : 'Save Allocations'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Person edit panel (with country allocs + comments) ── */}
      {editPerson && (
        <PersonEditPanel
          person={editPerson}
          onClose={() => setEditPerson(null)}
          onSaved={updated => {
            setAllPeople(prev => prev.map(p => p.id === updated.id ? updated : p));
            setEditPerson(null);
          }}
          countryAllocs={countryAllocs.filter(a => a.person_id === editPerson.id)}
          countryGroups={countryGroups.map(g => ({ countryId: g.countryId, countryName: g.country }))}
          selectedCycleId={selectedCycleId ?? null}
          onAllocsSaved={loadData}
        />
      )}
    </div>
  );
}
