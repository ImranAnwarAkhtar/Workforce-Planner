import { useEffect, useState, useMemo } from 'react';
import {
  dashboardApi, peopleApi, hireRequestsApi, changeRequestsApi,
  projectsApi, tbhCodesApi, refDataApi,
  type DashboardSummary, type CapacityItem, type Person, type HireRequest,
  type ChangeRequest, type Project, type TbhCode, type Region,
} from '../services/api';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function currentMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 60)    return `${diff}m ago`;
  if (diff < 1440)  return `${Math.floor(diff / 60)}h ago`;
  if (diff < 10080) return `${Math.floor(diff / 1440)}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

const CONTINGENT_CODES = new Set(['CON', 'A CON', 'R CON', 'A FTE', 'R FTE']);
const VP_CODES          = new Set(['VP', 'Dr']);
const VP_LEVEL_RE       = /\b(vp|svp|evp|director)\b/i;

function classifyPerson(p: Person): 'vpDir' | 'fte' | 'contingent' {
  const code = p.contract_type_code ?? '';
  if (VP_CODES.has(code))                                    return 'vpDir';
  if (CONTINGENT_CODES.has(code))                            return 'contingent';
  if (VP_LEVEL_RE.test(p.level_name ?? ''))                  return 'vpDir';
  return 'fte';
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActivityItem =
  | { kind: 'hire';   id: number; title: string; status: string; date: string; by: string | null }
  | { kind: 'change'; id: number; title: string; status: string; date: string; by: string | null };

interface DeptCount   { name: string; count: number }
interface AllocationBands { fullyAllocated: number; partial: number; unallocated: number }

interface PipelineRow {
  regionName: string;
  retail:  { Approved: number; Seeded: number; Proposed: number };
  xScale:  { Approved: number; Seeded: number; Proposed: number };
  totalWeight: number;
  total: number;
}

interface HcRow {
  regionName: string;
  vpDir: number;
  fte: number;
  contingent: number;
  approvedTBH: number;
  requestedTBH: number;
  total: number;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const C = { accent: '#E31837', bg2: '#FFFFFF', border: '#E8E8E8', muted: '#666666' };

const card: React.CSSProperties = {
  background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '18px 20px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
};

const sectionTitle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: C.muted, textTransform: 'uppercase',
  letterSpacing: '0.09em', marginBottom: 14,
};

const th: React.CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700,
  letterSpacing: '0.07em', textTransform: 'uppercase', color: C.muted,
  background: '#F8F9FA', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
};
const thR: React.CSSProperties = { ...th, textAlign: 'right' };
const td0: React.CSSProperties = { padding: '8px 12px', fontSize: 13, borderBottom: '1px solid #F0F0F0', color: '#333333', fontWeight: 500 };
const tdN: React.CSSProperties = { ...td0, textAlign: 'right', fontWeight: 700, color: '#111111' };
const tdM: React.CSSProperties = { ...td0, textAlign: 'right', color: '#666666' };

// ---------------------------------------------------------------------------
// SVG icons
// ---------------------------------------------------------------------------

const IconPeople  = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>;
const IconProject = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v2H3zm0 4h18v2H3zm0 4h12v2H3zm0 4h12v2H3z"/></svg>;
const IconHire    = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>;
const IconPct     = () => <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 7c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm6 10H9l6-10h1.8L9.8 17H15zm0-6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>;

// ---------------------------------------------------------------------------
// KPI card (generic)
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub, accent, icon, loading: ld }: {
  label: string; value: string | number; sub?: string; accent: string;
  icon: React.ReactNode; loading?: boolean;
}) {
  return (
    <div style={{ ...card, borderTop: `3px solid ${accent}`, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: ld ? '#BBBBBB' : '#111111', lineHeight: 1 }}>
          {ld ? '—' : value}
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 7, background: `${accent}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, flexShrink: 0 }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#888888', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dept bar chart
// ---------------------------------------------------------------------------

function DeptChart({ data, loading }: { data: DeptCount[]; loading: boolean }) {
  const max = data[0]?.count || 1;
  return (
    <div style={card}>
      <div style={sectionTitle}>Headcount by Discipline</div>
      {loading ? <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>Loading…</div>
       : data.length === 0 ? <p style={{ color: '#444', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No data</p>
       : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {data.map(({ name, count }) => (
            <div key={name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 12, color: '#555555' }}>{name}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#111111' }}>{count}</span>
              </div>
              <div style={{ height: 5, background: '#EEEEEE', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round((count / max) * 100)}%`, background: 'linear-gradient(90deg,#E31837,#ff4d6a)', borderRadius: 3, transition: 'width .4s' }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Allocation summary
// ---------------------------------------------------------------------------

function AllocationSummary({ bands, total, loading }: { bands: AllocationBands; total: number; loading: boolean }) {
  const items = [
    { label: 'Fully Allocated',    count: bands.fullyAllocated, color: '#33CC77' },
    { label: 'Partially Allocated', count: bands.partial,       color: '#FFAA33' },
    { label: 'Available',           count: bands.unallocated,   color: '#5599FF' },
  ];
  const pcts = items.map(i => total ? Math.round((i.count / total) * 100) : 0);
  return (
    <div style={card}>
      <div style={sectionTitle}>Allocation Status — This Month</div>
      {loading ? <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>Loading…</div>
       : total === 0 ? <p style={{ color: '#444', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>No capacity data</p>
       : (
        <>
          <div style={{ height: 7, borderRadius: 3, overflow: 'hidden', display: 'flex', marginBottom: 18 }}>
            {items.map((it, i) => (
              <div key={it.label} style={{ width: `${pcts[i]}%`, background: it.color, transition: 'width .4s' }} />
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((it, i) => (
              <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: it.color, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 12, color: '#555555' }}>{it.label}</div>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#111111', minWidth: 28, textAlign: 'right' }}>{it.count}</div>
                <div style={{ fontSize: 10, color: '#888888', minWidth: 30, textAlign: 'right' }}>{pcts[i]}%</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #EEEEEE', fontSize: 11, color: '#888888' }}>
            {total} active employees tracked
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipeline summary table
// ---------------------------------------------------------------------------

function PipelineTable({ rows, loading }: { rows: PipelineRow[]; loading: boolean }) {
  const STATUS_COLS = ['Approved', 'Seeded', 'Proposed'] as const;
  const STATUS_COLOR: Record<string, string> = { Approved: '#33CC77', Seeded: '#FFAA33', Proposed: '#4499FF' };

  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px 10px', borderBottom: `1px solid ${C.border}` }}>
        <div style={sectionTitle}>Project Pipeline by Region</div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...th, minWidth: 120 }}>Region</th>
              {STATUS_COLS.map(s => (
                <th key={`r-${s}`} style={{ ...thR, color: STATUS_COLOR[s] }}>Retail {s.slice(0,4)}</th>
              ))}
              {STATUS_COLS.map(s => (
                <th key={`x-${s}`} style={{ ...thR, color: STATUS_COLOR[s] }}>xScale {s.slice(0,4)}</th>
              ))}
              <th style={{ ...thR }}>Total</th>
              <th style={{ ...thR }}>Weight</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} style={{ ...td0, textAlign: 'center', color: '#333', padding: '28px 0' }}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} style={{ ...td0, textAlign: 'center', color: '#444', padding: '28px 0' }}>No projects found</td></tr>
            ) : rows.map((row, i) => (
              <tr key={row.regionName} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                <td style={td0}>{row.regionName}</td>
                {STATUS_COLS.map(s => (
                  <td key={`r-${s}`} style={{ ...tdM, color: row.retail[s] > 0 ? STATUS_COLOR[s] : '#CCCCCC' }}>
                    {row.retail[s] || '—'}
                  </td>
                ))}
                {STATUS_COLS.map(s => (
                  <td key={`x-${s}`} style={{ ...tdM, color: row.xScale[s] > 0 ? STATUS_COLOR[s] : '#CCCCCC' }}>
                    {row.xScale[s] || '—'}
                  </td>
                ))}
                <td style={{ ...tdN, color: '#FFF' }}>{row.total}</td>
                <td style={{ ...tdM }}>{row.totalWeight > 0 ? Number(row.totalWeight).toFixed(1) : '—'}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (() => {
            const totals = rows.reduce((acc, r) => ({
              rA: acc.rA + r.retail.Approved,
              rS: acc.rS + r.retail.Seeded,
              rP: acc.rP + r.retail.Proposed,
              xA: acc.xA + r.xScale.Approved,
              xS: acc.xS + r.xScale.Seeded,
              xP: acc.xP + r.xScale.Proposed,
              total: acc.total + r.total,
              weight: acc.weight + r.totalWeight,
            }), { rA: 0, rS: 0, rP: 0, xA: 0, xS: 0, xP: 0, total: 0, weight: 0 });
            return (
              <tfoot>
                <tr style={{ background: '#F5F5F5', borderTop: '2px solid #E0E0E0' }}>
                  <td style={{ ...td0, color: '#888888', fontSize: 11, fontStyle: 'italic' }}>Total</td>
                  {[totals.rA, totals.rS, totals.rP, totals.xA, totals.xS, totals.xP].map((v, i) => (
                    <td key={i} style={{ ...tdN, fontSize: 12 }}>{v || '—'}</td>
                  ))}
                  <td style={{ ...tdN }}>{totals.total}</td>
                  <td style={{ ...tdM }}>{totals.weight > 0 ? Number(totals.weight).toFixed(1) : '—'}</td>
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Headcount table by region
// ---------------------------------------------------------------------------

function HeadcountTable({ rows, loading }: { rows: HcRow[]; loading: boolean }) {
  return (
    <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 18px 10px', borderBottom: `1px solid ${C.border}` }}>
        <div style={sectionTitle}>Headcount by Region</div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...th, minWidth: 120 }}>Region</th>
              <th style={thR}>VP / Dir</th>
              <th style={thR}>Perm FTE</th>
              <th style={thR}>Contingent</th>
              <th style={{ ...thR, color: '#33CC77' }}>Appr TBH</th>
              <th style={{ ...thR, color: '#FFAA33' }}>Req TBH</th>
              <th style={thR}>Total HC</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ ...td0, textAlign: 'center', color: '#333', padding: '28px 0' }}>Loading region data…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} style={{ ...td0, textAlign: 'center', color: '#444', padding: '28px 0' }}>No data</td></tr>
            ) : rows.map((row, i) => (
              <tr key={row.regionName} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FAFAFA' }}>
                <td style={td0}>{row.regionName}</td>
                <td style={{ ...tdM, color: row.vpDir > 0 ? '#CC88FF' : '#2A2A2A' }}>{row.vpDir || '—'}</td>
                <td style={{ ...tdM, color: row.fte > 0 ? '#AAA' : '#2A2A2A' }}>{row.fte || '—'}</td>
                <td style={{ ...tdM, color: row.contingent > 0 ? '#FFAA33' : '#2A2A2A' }}>{row.contingent || '—'}</td>
                <td style={{ ...tdM, color: row.approvedTBH > 0 ? '#33CC77' : '#2A2A2A' }}>{row.approvedTBH || '—'}</td>
                <td style={{ ...tdM, color: row.requestedTBH > 0 ? '#FFAA33' : '#2A2A2A' }}>{row.requestedTBH || '—'}</td>
                <td style={{ ...tdN }}>{row.total}</td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (() => {
            const t = rows.reduce((a, r) => ({
              vpDir: a.vpDir + r.vpDir, fte: a.fte + r.fte,
              contingent: a.contingent + r.contingent,
              approvedTBH: a.approvedTBH + r.approvedTBH,
              requestedTBH: a.requestedTBH + r.requestedTBH,
              total: a.total + r.total,
            }), { vpDir: 0, fte: 0, contingent: 0, approvedTBH: 0, requestedTBH: 0, total: 0 });
            return (
              <tfoot>
                <tr style={{ background: '#F5F5F5', borderTop: '2px solid #E0E0E0' }}>
                  <td style={{ ...td0, color: '#888888', fontSize: 11, fontStyle: 'italic' }}>Total</td>
                  <td style={{ ...tdN, fontSize: 12 }}>{t.vpDir || '—'}</td>
                  <td style={{ ...tdN, fontSize: 12 }}>{t.fte || '—'}</td>
                  <td style={{ ...tdN, fontSize: 12 }}>{t.contingent || '—'}</td>
                  <td style={{ ...tdN, fontSize: 12, color: '#33CC77' }}>{t.approvedTBH || '—'}</td>
                  <td style={{ ...tdN, fontSize: 12, color: '#FFAA33' }}>{t.requestedTBH || '—'}</td>
                  <td style={{ ...tdN }}>{t.total}</td>
                </tr>
              </tfoot>
            );
          })()}
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

const STATUS_COLOR: Record<string, string> = {
  Pending: '#FFAA33', Approved: '#33CC77', Rejected: '#E31837',
  'Auto-Approved': '#5599FF', Default: '#888888',
};

function ActivityFeed({ items, loading }: { items: ActivityItem[]; loading: boolean }) {
  return (
    <div style={card}>
      <div style={sectionTitle}>Recent Activity</div>
      {loading ? <div style={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333' }}>Loading…</div>
       : items.length === 0 ? <p style={{ color: '#444', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No recent activity</p>
       : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {items.map((item, idx) => {
            const isHire = item.kind === 'hire';
            const dot  = isHire ? C.accent : '#5599FF';
            const sc   = STATUS_COLOR[item.status] ?? STATUS_COLOR.Default;
            const last = idx === items.length - 1;
            return (
              <div key={`${item.kind}-${item.id}`} style={{ display: 'flex', gap: 12, paddingBottom: last ? 0 : 14, borderBottom: last ? 'none' : '1px solid #181818', marginBottom: last ? 0 : 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 9, height: 9, borderRadius: '50%', background: dot, marginTop: 3, flexShrink: 0 }} />
                  {!last && <div style={{ width: 1, flex: 1, background: '#1E1E1E', marginTop: 4 }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                    <div>
                      <span style={{ fontSize: 9, fontWeight: 700, color: dot, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 5 }}>
                        {isHire ? 'Hire' : 'Change'}
                      </span>
                      <span style={{ display: 'inline-block', padding: '1px 6px', borderRadius: 9, fontSize: 9, fontWeight: 600, background: `${sc}22`, color: sc, border: `1px solid ${sc}44` }}>
                        {item.status}
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: '#444', whiteSpace: 'nowrap', flexShrink: 0 }}>{formatDate(item.date)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#EEE', marginTop: 3, fontWeight: 500 }}>{item.title}</div>
                  {item.by && <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>by {item.by}</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const [summary,      setSummary]      = useState<DashboardSummary | null>(null);
  const [capacity,     setCapacity]     = useState<CapacityItem[]>([]);
  const [people,       setPeople]       = useState<Person[]>([]);
  const [projects,     setProjects]     = useState<Project[]>([]);
  const [regions,      setRegions]      = useState<Region[]>([]);
  const [tbhCodes,     setTbhCodes]     = useState<TbhCode[]>([]);
  const [hireReqs,     setHireReqs]     = useState<HireRequest[]>([]);
  const [regionPeople, setRegionPeople] = useState<{ regionId: number; people: Person[] }[]>([]);
  const [activity,     setActivity]     = useState<ActivityItem[]>([]);

  const [loading,        setLoading]        = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [regionLoading,  setRegionLoading]  = useState(false);
  const [backendOk,      setBackendOk]      = useState<boolean | null>(null);

  const [month] = useState(currentMonthISO);

  useEffect(() => {
    let alive = true;

    (async () => {
      // Phase 1 — main data
      const [sum, cap, ppl, prj, regs, tbh, hrs, crs] = await Promise.all([
        dashboardApi.summary().then(data => { setBackendOk(true); return data; }).catch(() => { setBackendOk(false); return null; }),
        dashboardApi.capacity(month).catch(() => [] as CapacityItem[]),
        peopleApi.list({ is_active: 'true', limit: 500 }).catch(() => [] as Person[]),
        projectsApi.list({ is_active: 'true', limit: 500 }).catch(() => [] as Project[]),
        refDataApi.regions().catch(() => [] as typeof regions),
        tbhCodesApi.list({ limit: 500 }).catch(() => [] as TbhCode[]),
        hireRequestsApi.list({ limit: 500 }).catch(() => [] as HireRequest[]),
        changeRequestsApi.list({ limit: 500 }).catch(() => [] as ChangeRequest[]),
      ]);

      if (!alive) return;

      setSummary(sum);
      setCapacity(cap);
      setPeople(ppl);
      setProjects(prj);
      setRegions(regs);
      setTbhCodes(tbh);
      setHireReqs(hrs);
      setLoading(false);

      // Build activity feed
      const hireItems: ActivityItem[] = hrs.slice(0, 8).map(h => ({
        kind: 'hire',
        id: h.id,
        title: [h.request_type, h.level_name, h.discipline_name].filter(Boolean).join(' · ') || `Request #${h.id}`,
        status: h.status,
        date: h.created_at,
        by: h.submitted_by_name,
      }));
      const changeItems: ActivityItem[] = crs.slice(0, 8).map(c => ({
        kind: 'change',
        id: c.id,
        title: [c.change_type, c.tbh_id && `TBH ${c.tbh_id}`].filter(Boolean).join(' · ') || `Change #${c.id}`,
        status: c.status,
        date: c.created_at,
        by: c.submitted_by_name,
      }));
      setActivity(
        [...hireItems, ...changeItems]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 10)
      );
      setActivityLoading(false);

      // Phase 2 — per-region headcount (parallel, non-blocking)
      if (regs.length > 0 && alive) {
        setRegionLoading(true);
        const regionData = await Promise.all(
          regs.map(r =>
            peopleApi.list({ region_id: r.id, is_active: 'true', limit: 500 })
              .then(p => ({ regionId: r.id, people: p }))
              .catch(() => ({ regionId: r.id, people: [] as Person[] }))
          )
        );
        if (alive) {
          setRegionPeople(regionData);
          setRegionLoading(false);
        }
      }
    })();

    return () => { alive = false; };
  }, [month]);

  // ── Derived ─────────────────────────────────────────────────────────────────

  const projByStatus = useMemo(() => {
    const c = { Approved: 0, Seeded: 0, Proposed: 0 };
    for (const p of projects) {
      if (p.status === 'Approved')  c.Approved++;
      else if (p.status === 'Seeded')   c.Seeded++;
      else if (p.status === 'Proposed') c.Proposed++;
    }
    return c;
  }, [projects]);

  const projByType = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of projects) c[p.type] = (c[p.type] || 0) + 1;
    return c;
  }, [projects]);

  const hcBreakdown = useMemo(() => {
    let perm = 0, contingent = 0;
    for (const p of people) {
      if (CONTINGENT_CODES.has(p.contract_type_code ?? '')) contingent++;
      else perm++;
    }
    return { perm, contingent };
  }, [people]);

  const deptCounts: DeptCount[] = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of people) { const d = p.discipline_name ?? 'Unknown'; counts[d] = (counts[d] || 0) + 1; }
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [people]);

  const bands: AllocationBands = useMemo(() => {
    let fullyAllocated = 0, partial = 0, unallocated = 0;
    for (const item of capacity) {
      const r = item.utilisation_ratio ?? 0;
      if (r >= 0.99) fullyAllocated++;
      else if (r > 0.01) partial++;
      else unallocated++;
    }
    return { fullyAllocated, partial, unallocated };
  }, [capacity]);

  const pipelineRows: PipelineRow[] = useMemo(() => {
    const byRegion: Record<string, PipelineRow> = {};
    for (const p of projects) {
      const rn = p.region_name ?? 'Other';
      if (!byRegion[rn]) byRegion[rn] = {
        regionName: rn,
        retail:  { Approved: 0, Seeded: 0, Proposed: 0 },
        xScale:  { Approved: 0, Seeded: 0, Proposed: 0 },
        totalWeight: 0, total: 0,
      };
      const row = byRegion[rn];
      const grp = p.type === 'xScale' ? row.xScale : row.retail;
      if (p.status === 'Approved' || p.status === 'Seeded' || p.status === 'Proposed') {
        grp[p.status as 'Approved' | 'Seeded' | 'Proposed']++;
      }
      row.totalWeight += Number(p.weight) || 0;
      row.total++;
    }
    return Object.values(byRegion).sort((a, b) => a.regionName.localeCompare(b.regionName));
  }, [projects]);

  const hcRows: HcRow[] = useMemo(() => {
    if (regionPeople.length === 0) return [];
    return regionPeople.map(({ regionId, people: rp }) => {
      const region = regions.find(r => r.id === regionId);
      let vpDir = 0, fte = 0, contingent = 0;
      for (const p of rp) {
        const cls = classifyPerson(p);
        if (cls === 'vpDir') vpDir++;
        else if (cls === 'contingent') contingent++;
        else fte++;
      }
      const approvedTBH   = tbhCodes.filter(t => t.region_id === regionId).length;
      const requestedTBH  = hireReqs.filter(h => h.region_name === region?.name && h.status === 'Pending').length;
      return { regionName: region?.name ?? `Region ${regionId}`, vpDir, fte, contingent, approvedTBH, requestedTBH, total: rp.length };
    }).filter(r => r.total > 0).sort((a, b) => a.regionName.localeCompare(b.regionName));
  }, [regionPeople, regions, tbhCodes, hireReqs]);

  // ── Render ───────────────────────────────────────────────────────────────────

  const v = (n: number | undefined) => loading ? '—' : (n ?? 0);

  return (
    <div style={{ color: '#FFF' }}>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Dashboard</h1>
        <div style={{ width: 40, height: 3, background: C.accent, borderRadius: 2, marginTop: 6 }} />
        <p style={{ fontSize: 12, color: '#444', marginTop: 6 }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── Backend status banner ── */}
      {backendOk === false && (
        <div style={{
          marginBottom: 16, padding: '12px 16px',
          background: '#2B0D0D', border: '1px solid #5E1A1A',
          borderRadius: 6, color: '#FF6B6B', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span>⚠</span>
          <span>
            Backend not connected — data cannot load.
            Start the server: <code style={{ background: '#1A0000', padding: '2px 6px', borderRadius: 3, fontSize: 12 }}>cd backend && npm start</code>
          </span>
        </div>
      )}
      {backendOk === true && (
        <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#33CC77', display: 'inline-block' }} />
          <span style={{ fontSize: 12, color: '#555' }}>Backend connected</span>
        </div>
      )}

      {/* ── KPI Banner ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 20 }}>

        {/* 1. Total Projects */}
        <KpiCard
          label="Total Projects"
          value={v(summary?.total_projects)}
          sub={loading ? undefined : `${projByStatus.Approved} Appr · ${projByStatus.Seeded} Seed · ${projByStatus.Proposed} Prop`}
          accent="#5599FF"
          icon={<IconProject />}
          loading={loading}
        />

        {/* 2. Retail / xScale (split card) */}
        <div style={{ ...card, borderTop: '3px solid #9966FF' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: loading ? '#333' : '#FFF', lineHeight: 1 }}>
                {loading ? '—' : (projByType['Retail'] ?? 0)}
              </div>
              <div style={{ fontSize: 10, color: '#666', marginTop: 3 }}>Retail</div>
            </div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: loading ? '#333' : '#FFF', lineHeight: 1 }}>
                {loading ? '—' : (projByType['xScale'] ?? 0)}
              </div>
              <div style={{ fontSize: 10, color: '#666', marginTop: 3 }}>xScale</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>Projects by Type</div>
        </div>

        {/* 3. Existing HC */}
        <div style={{ ...card, borderTop: '3px solid #33CC77' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: loading ? '#333' : '#FFF', lineHeight: 1 }}>
              {loading ? '—' : people.length}
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 7, background: '#33CC7720', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#33CC77' }}>
              <IconPeople />
            </div>
          </div>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginTop: 4 }}>Existing Headcount</div>
          {!loading && (
            <div style={{ fontSize: 11, color: '#484848', marginTop: 4 }}>
              {hcBreakdown.perm} Perm · {hcBreakdown.contingent} Contingent
            </div>
          )}
        </div>

        {/* 4. Approved TBH HC */}
        <KpiCard
          label="Approved TBH HC"
          value={v(summary?.open_tbh_codes)}
          sub={loading ? undefined : 'Open positions (budgeted)'}
          accent="#33CC77"
          icon={<IconHire />}
          loading={loading}
        />

        {/* 5. Requested TBH HC */}
        <KpiCard
          label="Requested TBH HC"
          value={v(summary?.pending_hire_requests)}
          sub={loading ? undefined : 'Awaiting approval'}
          accent="#FFAA33"
          icon={<IconHire />}
          loading={loading}
        />

        {/* 6. Gearing Variance */}
        <div style={{ ...card, borderTop: `3px solid ${C.accent}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: '#33CC77', lineHeight: 1 }}>0%</div>
            <div style={{ width: 36, height: 36, borderRadius: 7, background: `${C.accent}1A`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.accent }}>
              <IconPct />
            </div>
          </div>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginTop: 4 }}>Gearing Variance</div>
          <div style={{ fontSize: 11, color: '#484848', marginTop: 4 }}>vs target headcount</div>
        </div>
      </div>

      {/* ── Pipeline Table ── */}
      <div style={{ marginBottom: 16 }}>
        <PipelineTable rows={pipelineRows} loading={loading} />
      </div>

      {/* ── Headcount Table ── */}
      <div style={{ marginBottom: 20 }}>
        <HeadcountTable rows={hcRows} loading={regionLoading || loading} />
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14, marginBottom: 16 }}>
        <DeptChart data={deptCounts} loading={loading} />
        <AllocationSummary bands={bands} total={capacity.length} loading={loading} />
      </div>

      {/* ── Activity Feed ── */}
      <ActivityFeed items={activity} loading={activityLoading} />
    </div>
  );
}
