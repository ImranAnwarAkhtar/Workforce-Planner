import { useEffect, useState, useCallback } from 'react';
import equinixFortressRed from '../assets/equinix-fortress-red.svg';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts';
import {
  dashboardApi,
  type HubIqResponse, type HubIqYearData,
} from '../services/api';

// ---------------------------------------------------------------------------
// Colour palette (matches Excel)
// ---------------------------------------------------------------------------
const C = {
  accent:   '#E31837',
  retail:   '#1565C0',
  xscale:   '#7B1FA2',
  vpDir:    '#222222',
  fte:      '#888888',
  con:      '#F9A825',
  apprFte:  '#1E8A4A',
  apprCon:  '#26A69A',
  reqFte:   '#E31837',
  reqCon:   '#1565C0',
  approved: '#1E8A4A',
  seeded:   '#B5600A',
  proposed: '#1565C0',
  border:   '#E5E5E5',
  muted:    '#888888',
  bg:       '#FAFAFA',
  discColors: { Construction: '#1565C0', Design: '#1E8A4A', Commercial: '#B5600A', Commissioning: '#7B1FA2', Other: '#555555' } as Record<string,string>,
};

const TABS = ['Projects', 'People', 'Requests', 'Gearing', 'Hire Status'] as const;
type Tab = typeof TABS[number];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function fmt(n: number | undefined | null) { return n ?? 0; }

function DeltaBadge({ a, b, size = 11 }: { a: number; b: number; size?: number }) {
  const d = b - a;
  if (d === 0) return <span style={{ fontSize: size, color: '#AAAAAA' }}>● 0</span>;
  const up = d > 0;
  return <span style={{ fontSize: size, fontWeight: 700, color: up ? '#1E8A4A' : '#E31837' }}>{up ? '▲' : '▼'} {Math.abs(d)}</span>;
}

function PctBadge({ pct }: { pct: number }) {
  if (pct === 0) return <span style={{ fontSize: 11, color: '#AAAAAA' }}>● 0%</span>;
  const color = pct > 0 ? '#1E8A4A' : '#E31837';
  return <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct > 0 ? '▲' : '▼'} {Math.abs(pct)}%</span>;
}

const cardStyle: React.CSSProperties = {
  background: '#FFFFFF', border: `1px solid ${C.border}`, borderRadius: 8,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};
const sectionLabel: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.09em',
};
const TH: React.CSSProperties = { padding: '6px 10px', fontSize: 10, fontWeight: 700, color: C.muted, background: '#F8F9FA', borderBottom: `1px solid ${C.border}`, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' };
const THR: React.CSSProperties = { ...TH, textAlign: 'right' };
const TD: React.CSSProperties  = { padding: '6px 10px', fontSize: 12, color: '#333', borderBottom: `1px solid #F3F3F3` };
const TDR: React.CSSProperties = { ...TD, textAlign: 'right', fontWeight: 600 };
const TDM: React.CSSProperties = { ...TD, textAlign: 'right', color: C.muted };

// ---------------------------------------------------------------------------
// Top dark KPI banner
// ---------------------------------------------------------------------------

function TopBanner({ yearA, yearB, dataA, dataB }: { yearA: number; yearB: number; dataA: HubIqYearData; dataB: HubIqYearData }) {
  const sA = dataA.summary, sB = dataB.summary;

  const groups: { label: string; items: { name: string; dotColor?: string; vA: number; vB: number; isFloat?: boolean }[] }[] = [
    {
      label: 'PROJECTS',
      items: [
        { name: 'TOTAL',   vA: sA.projects.total,  vB: sB.projects.total },
        { name: 'RETAIL',  dotColor: C.retail,  vA: sA.projects.retail,  vB: sB.projects.retail },
        { name: 'XSCALE',  dotColor: C.xscale,  vA: sA.projects.xscale,  vB: sB.projects.xscale },
      ],
    },
    {
      label: 'EXIST HC',
      items: [
        { name: 'TOTAL',       vA: sA.exist_hc.total,       vB: sB.exist_hc.total },
        { name: 'PERM',        dotColor: C.fte,   vA: sA.exist_hc.perm,        vB: sB.exist_hc.perm },
        { name: 'CONTINGENT',  dotColor: C.con,   vA: sA.exist_hc.contingent,  vB: sB.exist_hc.contingent },
      ],
    },
    {
      label: 'APPROVED HC',
      items: [
        { name: 'TOTAL',      vA: sA.appr_hc.total, vB: sB.appr_hc.total },
        { name: 'PERM',       dotColor: C.apprFte, vA: sA.appr_hc.fte, vB: sB.appr_hc.fte },
        { name: 'CONVERSION', dotColor: C.apprCon, vA: sA.appr_hc.con, vB: sB.appr_hc.con },
      ],
    },
    {
      label: 'REQUESTS',
      items: [
        { name: 'TOTAL',      vA: sA.req_hc.total, vB: sB.req_hc.total },
        { name: 'PERM',       dotColor: C.reqFte,  vA: sA.req_hc.fte,   vB: sB.req_hc.fte },
        { name: 'CONVERSION', dotColor: C.reqCon,  vA: sA.req_hc.con,   vB: sB.req_hc.con, isFloat: true },
      ],
    },
  ];

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0D0D0D 0%, #1A1A1A 100%)',
      borderBottom: `3px solid ${C.accent}`,
      padding: '10px 20px',
      display: 'flex', alignItems: 'stretch', gap: 0, overflowX: 'auto', flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: 20, borderRight: '1px solid #333', marginRight: 16, flexShrink: 0 }}>
        <img src={equinixFortressRed} alt="Equinix" style={{ height: 30, width: 'auto', display: 'block' }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, letterSpacing: '0.15em', marginTop: 4 }}>HUB IQ</div>
        <div style={{ fontSize: 9, color: '#666', marginTop: 2 }}>{yearA} vs {yearB}</div>
      </div>

      {/* KPI groups */}
      {groups.map((grp, gi) => (
        <div key={grp.label} style={{
          display: 'flex', alignItems: 'stretch', gap: 0,
          paddingRight: 16, marginRight: 16,
          borderRight: gi < groups.length - 1 ? '1px solid #2A2A2A' : 'none',
        }}>
          {/* Group label — vertical, upright (no rotation), white */}
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', marginRight: 12, flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: '0.12em', writingMode: 'vertical-rl' }}>
              {grp.label}
            </span>
          </div>

          {/* Items */}
          {grp.items.map(item => (
            <div key={item.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', marginRight: 14, minWidth: 52 }}>
              {/* Sub-metric label row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                {item.dotColor && (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.dotColor, flexShrink: 0 }} />
                )}
                <span style={{ fontSize: 8, fontWeight: 700, color: '#CCCCCC', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.name}</span>
              </div>
              {/* Year A value */}
              <div style={{ fontSize: 22, fontWeight: 900, color: '#FFFFFF', lineHeight: 1 }}>
                {item.isFloat ? fmt(item.vA).toFixed(1) : fmt(item.vA)}
              </div>
              {/* Year B + delta row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                <span style={{ fontSize: 10, color: '#4A8CFF' }}>
                  {item.isFloat ? fmt(item.vB).toFixed(1) : fmt(item.vB)}
                </span>
                <DeltaBadge a={item.vA} b={item.vB} size={10} />
              </div>
              {/* Year labels */}
              <div style={{ display: 'flex', gap: 6, marginTop: 1 }}>
                <span style={{ fontSize: 8, color: '#666' }}>{yearA}</span>
                <span style={{ fontSize: 8, color: '#4A8CFF' }}>{yearB}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={{ display: 'flex', background: '#FFFFFF', borderBottom: `1px solid ${C.border}`, padding: '0 20px', flexShrink: 0 }}>
      {TABS.map(tab => (
        <button key={tab} onClick={() => onChange(tab)} style={{
          padding: '10px 18px', background: 'transparent', border: 'none',
          borderBottom: active === tab ? `2px solid ${C.accent}` : '2px solid transparent',
          color: active === tab ? '#111' : C.muted,
          fontSize: 13, fontWeight: active === tab ? 700 : 400,
          cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap',
        }}>{tab}</button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ ...sectionLabel, marginBottom: 12 }}>{children}</div>;
}

// ---------------------------------------------------------------------------
// PROJECTS TAB
// ---------------------------------------------------------------------------

function ProjectsTab({ yearA, yearB, dataA, dataB, projectTrend }: {
  yearA: number; yearB: number; dataA: HubIqYearData; dataB: HubIqYearData;
  projectTrend: { year: number; status: string; count: number }[];
}) {
  const [activeYear, setActiveYear] = useState(yearA);
  const data = activeYear === yearA ? dataA : dataB;

  // Build trend data for area chart
  const allYears = Array.from(new Set(projectTrend.map(r => r.year))).sort();
  const trendChartData = allYears.map(y => {
    const rows = projectTrend.filter(r => r.year === y);
    return {
      year: String(y),
      Approved: rows.find(r => r.status === 'Approved')?.count ?? 0,
      Seeded:   rows.find(r => r.status === 'Seeded')?.count   ?? 0,
      Proposed: rows.find(r => r.status === 'Proposed')?.count ?? 0,
    };
  });

  // Donut chart data
  const donutData = [
    { name: 'Retail',  value: data.summary.projects.retail_weight  || data.summary.projects.retail  },
    { name: 'xScale',  value: data.summary.projects.xscale_weight  || data.summary.projects.xscale  },
  ].filter(d => d.value > 0);

  // Pipeline bar chart by region (weight)
  const pipelineBarData = data.pipeline.map(r => ({
    region: r.region_name.replace(' ', '\n'),
    Retail:  Number(r.retail.weight.toFixed(1)),
    xScale:  Number(r.xscale.weight.toFixed(1)),
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top row: trend + donut + meta */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 14 }}>

        {/* YoY trend */}
        <div style={{ ...cardStyle, padding: '14px 16px' }}>
          <SectionTitle>Project Count YoY by Status</SectionTitle>
          {trendChartData.length === 0 ? (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 12 }}>No multi-year data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={trendChartData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                <XAxis dataKey="year" tick={{ fontSize: 10, fill: C.muted }} />
                <YAxis tick={{ fontSize: 10, fill: C.muted }} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="Proposed" stackId="1" stroke={C.proposed} fill={`${C.proposed}30`} strokeWidth={2} />
                <Area type="monotone" dataKey="Seeded"   stackId="1" stroke={C.seeded}   fill={`${C.seeded}40`}   strokeWidth={2} />
                <Area type="monotone" dataKey="Approved" stackId="1" stroke={C.approved} fill={`${C.approved}50`} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: 'flex', gap: 14, marginTop: 8, justifyContent: 'center' }}>
            {[['Proposed', C.proposed], ['Seeded', C.seeded], ['Approved', C.approved]].map(([l, c]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 1, background: c }} />
                <span style={{ fontSize: 10, color: C.muted }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Donut: project type % */}
        <div style={{ ...cardStyle, padding: '14px 16px' }}>
          <SectionTitle>Project Type %</SectionTitle>
          <div style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
            <div style={{ background: '#F0F5FF', borderRadius: 6, padding: '6px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.retail }}>{data.meta.countries_count}</div>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>COUNTRIES</div>
            </div>
            <div style={{ background: '#F5F5F5', borderRadius: 6, padding: '6px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#333' }}>{data.meta.metros_count}</div>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>METROS</div>
            </div>
          </div>
          {donutData.length > 0 ? (
            <ResponsiveContainer width="100%" height={110}>
              <PieChart>
                <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  innerRadius={28} outerRadius={48} paddingAngle={2}>
                  <Cell fill={C.retail} />
                  <Cell fill={C.xscale} />
                </Pie>
                <Tooltip formatter={(v: unknown) => typeof v === 'number' ? v.toFixed(1) : String(v)} contentStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 12 }}>No data</div>
          )}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 }}>
            {donutData.map((d, i) => {
              const total = donutData.reduce((s, x) => s + x.value, 0);
              return (
                <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: i === 0 ? C.retail : C.xscale }} />
                  <span style={{ fontSize: 10, color: C.muted }}>{d.name} {total > 0 ? Math.round((d.value / total) * 100) : 0}%</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Year selector & summary */}
        <div style={{ ...cardStyle, padding: '14px 16px' }}>
          <SectionTitle>Year Comparison</SectionTitle>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[yearA, yearB].map(y => (
              <button key={y} onClick={() => setActiveYear(y)} style={{
                flex: 1, padding: '6px 0', borderRadius: 4, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${activeYear === y ? C.accent : C.border}`,
                background: activeYear === y ? C.accent : '#FFF',
                color: activeYear === y ? '#FFF' : '#555',
              }}>{y}</button>
            ))}
          </div>
          {[
            { label: 'Total',    val: data.summary.projects.total,        color: '#111' },
            { label: 'Retail',   val: data.summary.projects.retail,       color: C.retail },
            { label: 'xScale',   val: data.summary.projects.xscale,       color: C.xscale },
            { label: 'Approved', val: data.pipeline.reduce((s, r) => s + r.retail.Approved + r.xscale.Approved, 0), color: C.approved },
            { label: 'Seeded',   val: data.pipeline.reduce((s, r) => s + r.retail.Seeded   + r.xscale.Seeded,   0), color: C.seeded },
            { label: 'Proposed', val: data.pipeline.reduce((s, r) => s + r.retail.Proposed + r.xscale.Proposed, 0), color: C.proposed },
          ].map(row => (
            <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, borderBottom: `1px solid #F3F3F3`, marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: '#555' }}>{row.label}</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: row.color }}>{row.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline bar chart */}
      <div style={{ ...cardStyle, padding: '14px 16px' }}>
        <SectionTitle>Project Pipeline by Region — Retail vs xScale (Weight) · {activeYear}</SectionTitle>
        {pipelineBarData.length === 0 ? (
          <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 12 }}>No data for {activeYear}</div>
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={pipelineBarData} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
              <XAxis dataKey="region" tick={{ fontSize: 9, fill: C.muted }} />
              <YAxis tick={{ fontSize: 10, fill: C.muted }} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="Retail"  fill={C.retail}  radius={[2, 2, 0, 0]} />
              <Bar dataKey="xScale"  fill={C.xscale}  radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
        <div style={{ display: 'flex', gap: 14, marginTop: 6, justifyContent: 'center' }}>
          {[['Retail', C.retail], ['xScale', C.xscale]].map(([l, c]) => (
            <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, background: c }} />
              <span style={{ fontSize: 10, color: C.muted }}>{l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline table */}
      <div style={{ ...cardStyle, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px 8px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <SectionTitle>Pipeline Summary by Region (Weight)</SectionTitle>
          <div style={{ display: 'flex', gap: 4 }}>
            {[yearA, yearB].map(y => (
              <button key={y} onClick={() => setActiveYear(y)} style={{
                padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${activeYear === y ? C.accent : C.border}`,
                background: activeYear === y ? C.accent : '#FFF', color: activeYear === y ? '#FFF' : '#555',
              }}>{y}</button>
            ))}
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ ...TH, minWidth: 110 }}>Region</th>
                <th style={{ ...THR, color: C.approved }}>Retail Appr</th>
                <th style={{ ...THR, color: C.seeded }}>Retail Seed</th>
                <th style={{ ...THR, color: C.proposed }}>Retail Prop</th>
                <th style={THR}>Retail Wt</th>
                <th style={{ ...THR, color: C.approved }}>xScale Appr</th>
                <th style={{ ...THR, color: C.seeded }}>xScale Seed</th>
                <th style={{ ...THR, color: C.proposed }}>xScale Prop</th>
                <th style={THR}>xScale Wt</th>
                <th style={{ ...THR, fontWeight: 800 }}>Total Wt</th>
              </tr>
            </thead>
            <tbody>
              {data.pipeline.map((row, i) => (
                <tr key={row.region_name} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                  <td style={TD}>{row.region_name}</td>
                  <td style={{ ...TDM, color: row.retail.Approved > 0 ? C.approved : '#DDD' }}>{row.retail.Approved || '—'}</td>
                  <td style={{ ...TDM, color: row.retail.Seeded   > 0 ? C.seeded   : '#DDD' }}>{row.retail.Seeded   || '—'}</td>
                  <td style={{ ...TDM, color: row.retail.Proposed > 0 ? C.proposed : '#DDD' }}>{row.retail.Proposed || '—'}</td>
                  <td style={TDM}>{row.retail.weight > 0 ? row.retail.weight.toFixed(1) : '—'}</td>
                  <td style={{ ...TDM, color: row.xscale.Approved > 0 ? C.approved : '#DDD' }}>{row.xscale.Approved || '—'}</td>
                  <td style={{ ...TDM, color: row.xscale.Seeded   > 0 ? C.seeded   : '#DDD' }}>{row.xscale.Seeded   || '—'}</td>
                  <td style={{ ...TDM, color: row.xscale.Proposed > 0 ? C.proposed : '#DDD' }}>{row.xscale.Proposed || '—'}</td>
                  <td style={TDM}>{row.xscale.weight > 0 ? row.xscale.weight.toFixed(1) : '—'}</td>
                  <td style={TDR}>{row.total_weight > 0 ? row.total_weight.toFixed(1) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PEOPLE TAB
// ---------------------------------------------------------------------------

function PeopleTab({ yearA, yearB, dataA, dataB }: { yearA: number; yearB: number; dataA: HubIqYearData; dataB: HubIqYearData }) {
  const [activeYear, setActiveYear] = useState(yearA);
  const data = activeYear === yearA ? dataA : dataB;

  // Stacked horizontal bar data
  const hcBarData = data.headcount.map(r => ({
    region: r.region_name,
    'VP/Dir':  r.exist_vp_dir,
    'FTE':     r.exist_fte,
    'Contingent': r.exist_con,
    'Appr FTE':   r.appr_fte,
    'Req FTE':    r.req_fte,
    'Req CON':    r.req_con,
  }));

  // Area chart data — same headcount for both years currently (no year tagging yet)
  const areaData = [
    { year: String(yearA), ...Object.fromEntries(['VP/Dir','FTE','Contingent','Appr FTE','Req FTE'].map(k => [k, dataA.headcount.reduce((s, r) => s + ((r as any)[k.replace('/','_').replace(' ','_').toLowerCase()] ?? 0), 0)])) },
    { year: String(yearB), ...Object.fromEntries(['VP/Dir','FTE','Contingent','Appr FTE','Req FTE'].map(k => [k, dataB.headcount.reduce((s, r) => s + ((r as any)[k.replace('/','_').replace(' ','_').toLowerCase()] ?? 0), 0)])) },
  ];

  const totalA = dataA.headcount.reduce((s, r) => s + r.total_heads, 0);
  const totalB = dataB.headcount.reduce((s, r) => s + r.total_heads, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 14 }}>

        {/* Stacked bar */}
        <div style={{ ...cardStyle, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <SectionTitle>Existing Team / Requests by Region</SectionTitle>
            <div style={{ display: 'flex', gap: 4 }}>
              {[yearA, yearB].map(y => (
                <button key={y} onClick={() => setActiveYear(y)} style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${activeYear === y ? C.accent : C.border}`,
                  background: activeYear === y ? C.accent : '#FFF', color: activeYear === y ? '#FFF' : '#555',
                }}>{y}</button>
              ))}
            </div>
          </div>
          {hcBarData.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 12 }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, hcBarData.length * 38)}>
              <BarChart data={hcBarData} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: C.muted }} />
                <YAxis type="category" dataKey="region" tick={{ fontSize: 10, fill: '#333' }} width={58} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="VP/Dir"     stackId="a" fill={C.vpDir}   />
                <Bar dataKey="FTE"        stackId="a" fill={C.fte}     />
                <Bar dataKey="Contingent" stackId="a" fill={C.con}     />
                <Bar dataKey="Appr FTE"   stackId="a" fill={C.apprFte} />
                <Bar dataKey="Req FTE"    stackId="a" fill={C.reqFte}  />
                <Bar dataKey="Req CON"    stackId="a" fill={C.reqCon}  radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, justifyContent: 'center' }}>
            {[['VP/Dir',C.vpDir],['FTE',C.fte],['Contingent',C.con],['Appr FTE',C.apprFte],['Req FTE',C.reqFte],['Req CON',C.reqCon]].map(([l,c]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: 1, background: c }} />
                <span style={{ fontSize: 9, color: C.muted }}>{l}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Headcount matrix table */}
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px 8px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionTitle>People Existing / Requests by Region</SectionTitle>
            <div style={{ display: 'flex', gap: 4 }}>
              {[yearA, yearB].map(y => (
                <button key={y} onClick={() => setActiveYear(y)} style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${activeYear === y ? C.accent : C.border}`,
                  background: activeYear === y ? C.accent : '#FFF', color: activeYear === y ? '#FFF' : '#555',
                }}>{y}</button>
              ))}
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr>
                  <th style={{ ...TH, minWidth: 100 }}>Role Type</th>
                  {data.headcount.map(r => <th key={r.region_name} style={THR}>{r.region_name.replace('AMER Matrix', 'AMER Mtx')}</th>)}
                  <th style={THR}>Total</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { key: 'exist_vp_dir',   label: 'Exist VP / Director', color: C.vpDir,   bold: false },
                  { key: 'exist_fte',      label: 'Exist FTE',           color: '#444',    bold: false },
                  { key: 'exist_con',      label: 'Exist Contingent',    color: C.con,     bold: false },
                  { key: 'appr_fte',       label: 'Approved TBH FTE',    color: C.apprFte, bold: false },
                  { key: 'appr_con_fte',   label: 'Appr CON → FTE',      color: C.apprCon, bold: false },
                  { key: 'existing_heads', label: 'Existing Heads',      color: '#111',    bold: true  },
                  { key: 'req_fte',        label: 'Requested TBH FTE',   color: C.reqFte,  bold: false },
                  { key: 'req_con_fte',    label: 'Convert to FTE',      color: C.reqCon,  bold: false },
                  { key: 'req_con',        label: 'Req TBH Contingent',  color: C.con,     bold: false },
                  { key: 'total_heads',    label: 'TOTAL HEADS',         color: '#111',    bold: true  },
                ].map(({ key, label, color, bold }) => {
                  const total = data.headcount.reduce((s, r) => s + ((r as any)[key] ?? 0), 0);
                  const isSubtotal = key === 'existing_heads' || key === 'total_heads';
                  return (
                    <tr key={key} style={{ background: isSubtotal ? '#F0F5FF' : 'transparent' }}>
                      <td style={{ ...TD, fontSize: 11, fontWeight: bold ? 700 : 400, color: bold ? '#111' : '#555', paddingLeft: isSubtotal ? 10 : 20 }}>
                        {!isSubtotal && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', marginRight: 5 }} />}
                        {label}
                      </td>
                      {data.headcount.map(r => {
                        const v = (r as any)[key] ?? 0;
                        return <td key={r.region_name} style={{ ...TDM, fontSize: 11, color: v > 0 ? color : '#DDD', fontWeight: bold ? 700 : 400 }}>{v || '—'}</td>;
                      })}
                      <td style={{ ...TDR, fontSize: 11, color: bold ? '#111' : color, background: isSubtotal ? '#E8EEFB' : 'transparent' }}>{total || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Year comparison stacked area */}
      <div style={{ ...cardStyle, padding: '14px 16px' }}>
        <SectionTitle>Total Headcount: {yearA} vs {yearB} Comparison</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
          {[
            { label: 'Exist VP/Dir',  vA: dataA.headcount.reduce((s,r)=>s+r.exist_vp_dir,0),   vB: dataB.headcount.reduce((s,r)=>s+r.exist_vp_dir,0),   color: C.vpDir },
            { label: 'Exist FTE',     vA: dataA.headcount.reduce((s,r)=>s+r.exist_fte,0),       vB: dataB.headcount.reduce((s,r)=>s+r.exist_fte,0),       color: C.fte },
            { label: 'Contingent',    vA: dataA.headcount.reduce((s,r)=>s+r.exist_con,0),       vB: dataB.headcount.reduce((s,r)=>s+r.exist_con,0),       color: C.con },
            { label: 'Total Heads',   vA: totalA,                                               vB: totalB,                                               color: '#111' },
          ].map(row => (
            <div key={row.label} style={{ background: '#F8F9FA', borderRadius: 7, padding: '12px 14px', borderLeft: `3px solid ${row.color}` }}>
              <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, marginBottom: 8 }}>{row.label}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div>
                  <span style={{ fontSize: 8, color: C.muted }}>YR A · {yearA}</span>
                  <div style={{ fontSize: 22, fontWeight: 800, color: row.color, lineHeight: 1 }}>{row.vA}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 8, color: '#4A8CFF' }}>YR B · {yearB}</span>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#4A8CFF', lineHeight: 1 }}>{row.vB}</div>
                </div>
              </div>
              <div style={{ marginTop: 6 }}><DeltaBadge a={row.vA} b={row.vB} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// REQUESTS TAB
// ---------------------------------------------------------------------------

function RequestsTab({ yearA, yearB, dataA, dataB }: { yearA: number; yearB: number; dataA: HubIqYearData; dataB: HubIqYearData }) {
  const [activeYear, setActiveYear] = useState(yearA);
  const data = activeYear === yearA ? dataA : dataB;

  // Aggregate requests by discipline
  const byDisc: Record<string, { rFte: number; rCon: number }> = {};
  for (const r of data.requests) {
    if (!byDisc[r.discipline_name]) byDisc[r.discipline_name] = { rFte: 0, rCon: 0 };
    if (r.contract_code === 'R FTE')     byDisc[r.discipline_name].rFte += r.contracted_fte;
    else if (['R CON', 'R CON>FTE'].includes(r.contract_code)) byDisc[r.discipline_name].rCon += r.contracted_fte;
  }
  const discBarData = Object.entries(byDisc).map(([disc, v]) => ({
    discipline: disc.length > 12 ? disc.slice(0, 10) + '…' : disc,
    fullName: disc,
    'R FTE':     Math.round(v.rFte * 10) / 10,
    'R CON/CON→FTE': Math.round(v.rCon * 10) / 10,
  }));

  const totalRFte = data.requests.filter(r => r.contract_code === 'R FTE').reduce((s, r) => s + r.contracted_fte, 0);
  const totalRCon = data.requests.filter(r => ['R CON','R CON>FTE'].includes(r.contract_code)).reduce((s, r) => s + r.contracted_fte, 0);

  // Donut by discipline
  const donutData = Object.entries(byDisc)
    .map(([disc, v]) => ({ name: disc, value: v.rFte + v.rCon }))
    .filter(d => d.value > 0);

  const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
    'R FTE':     { bg: '#FFF8E1', color: C.seeded },
    'R CON':     { bg: '#FEF3F2', color: C.accent },
    'R CON>FTE': { bg: '#EBF2FB', color: C.retail },
  };
  const DISC_PIE_COLORS = ['#1565C0','#1E8A4A','#B5600A','#7B1FA2','#555'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 14 }}>

        {/* Bar: by discipline */}
        <div style={{ ...cardStyle, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <SectionTitle>Requests by Discipline</SectionTitle>
            <div style={{ display: 'flex', gap: 4 }}>
              {[yearA, yearB].map(y => (
                <button key={y} onClick={() => setActiveYear(y)} style={{
                  padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${activeYear === y ? C.accent : C.border}`,
                  background: activeYear === y ? C.accent : '#FFF', color: activeYear === y ? '#FFF' : '#555',
                }}>{y}</button>
              ))}
            </div>
          </div>
          {/* KPI chips */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1, background: '#FFF8E1', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.seeded }}>{totalRFte.toFixed(1)}</div>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>R FTE</div>
            </div>
            <div style={{ flex: 1, background: '#EBF2FB', borderRadius: 6, padding: '8px 10px', textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.retail }}>{totalRCon.toFixed(1)}</div>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 600 }}>R CON</div>
            </div>
          </div>
          {discBarData.length === 0 ? (
            <div style={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 12 }}>No requests</div>
          ) : (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={discBarData} margin={{ top: 4, right: 6, bottom: 20, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                <XAxis dataKey="discipline" tick={{ fontSize: 9, fill: C.muted }} angle={-20} textAnchor="end" />
                <YAxis tick={{ fontSize: 9, fill: C.muted }} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="R FTE"         fill={C.seeded}  radius={[2, 2, 0, 0]} />
                <Bar dataKey="R CON/CON→FTE" fill={C.retail}  radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Donut: distribution */}
        <div style={{ ...cardStyle, padding: '14px 16px' }}>
          <SectionTitle>Distribution by Discipline</SectionTitle>
          {donutData.length === 0 ? (
            <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 12 }}>No requests</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                    innerRadius={40} outerRadius={70} paddingAngle={2}
                    label={({ name, percent }) => `${Math.round((percent ?? 0) * 100)}%`}
                    labelLine={false}>
                    {donutData.map((_, i) => <Cell key={i} fill={DISC_PIE_COLORS[i % DISC_PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: unknown) => (typeof v === 'number' ? v.toFixed(1) : String(v)) + ' FTE'} contentStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                {donutData.map((d, i) => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: DISC_PIE_COLORS[i % DISC_PIE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: '#444', flex: 1 }}>{d.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#111' }}>{d.value.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Detail table */}
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px 8px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <SectionTitle>Request Details by Discipline / Region / Level / Type</SectionTitle>
            <div style={{ display: 'flex', gap: 4 }}>
              {[yearA, yearB].map(y => (
                <button key={y} onClick={() => setActiveYear(y)} style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: `1px solid ${activeYear === y ? C.accent : C.border}`,
                  background: activeYear === y ? C.accent : '#FFF', color: activeYear === y ? '#FFF' : '#555',
                }}>{y}</button>
              ))}
            </div>
          </div>
          <div style={{ overflowX: 'auto', maxHeight: 320, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                <tr>
                  <th style={TH}>Discipline</th>
                  <th style={TH}>Region</th>
                  <th style={TH}>Country</th>
                  <th style={TH}>Level</th>
                  <th style={TH}>Type</th>
                  <th style={THR}>FTE</th>
                  <th style={TH}>Name / TBH</th>
                </tr>
              </thead>
              <tbody>
                {data.requests.length === 0 ? (
                  <tr><td colSpan={7} style={{ ...TD, textAlign: 'center', color: C.muted, padding: '20px 0' }}>No requests</td></tr>
                ) : data.requests.map((r, i) => {
                  const tc = TYPE_COLOR[r.contract_code] ?? { bg: '#F5F5F5', color: '#555' };
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                      <td style={{ ...TD, fontSize: 11, color: C.discColors[r.discipline_name] ?? '#333', fontWeight: 600 }}>{r.discipline_name}</td>
                      <td style={{ ...TD, fontSize: 11 }}>{r.region_name}</td>
                      <td style={{ ...TD, fontSize: 11 }}>{r.country_name ?? '—'}</td>
                      <td style={{ ...TD, fontSize: 11 }}>{r.level_code ?? '—'}</td>
                      <td style={{ ...TD, fontSize: 11 }}>
                        <span style={{ padding: '1px 6px', borderRadius: 3, fontSize: 9, fontWeight: 700, background: tc.bg, color: tc.color }}>{r.contract_code}</span>
                      </td>
                      <td style={{ ...TDR, fontSize: 11 }}>{r.contracted_fte}</td>
                      <td style={{ ...TD, fontSize: 11, color: C.muted }}>{r.person_name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GEARING TAB
// ---------------------------------------------------------------------------

function GearingTab({ yearA, yearB, dataA, dataB }: { yearA: number; yearB: number; dataA: HubIqYearData; dataB: HubIqYearData }) {
  const [activeYear, setActiveYear] = useState(yearA);
  const data = activeYear === yearA ? dataA : dataB;

  const overallTotals = data.gearing.map(d => d.totals);
  const totalProposed = overallTotals.reduce((s, t) => s + t.proposed, 0);
  const totalOptimal  = overallTotals.reduce((s, t) => s + t.optimal,  0);
  const totalVarOpt   = totalOptimal  > 0 ? Math.round(((totalProposed - totalOptimal)  / totalOptimal)  * 1000) / 10 : 0;
  const totalMin      = overallTotals.reduce((s, t) => s + t.min, 0);
  const totalMax      = overallTotals.reduce((s, t) => s + t.max, 0);
  const totalVarMin   = totalMin > 0 ? Math.round(((totalProposed - totalMin) / totalMin) * 1000) / 10 : 0;
  const totalVarMax   = totalMax > 0 ? Math.round(((totalProposed - totalMax) / totalMax) * 1000) / 10 : 0;

  function gColor(pct: number) {
    if (pct === 0) return C.muted;
    if (pct > 20)  return '#C0392B';
    if (pct > 5)   return '#B5600A';
    if (pct < -20) return '#1565C0';
    if (pct < -5)  return '#4A8CFF';
    return '#1E8A4A';
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary KPI tiles */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 }}>
        <span style={sectionLabel}>Department Headcount vs Gearing (Optimal / Min / Max)</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {[yearA, yearB].map(y => (
            <button key={y} onClick={() => setActiveYear(y)} style={{
              padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${activeYear === y ? C.accent : C.border}`,
              background: activeYear === y ? C.accent : '#FFF', color: activeYear === y ? '#FFF' : '#555',
            }}>{y}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        {[
          { label: 'Total Proposed HC', value: totalProposed, bg: C.accent,    text: '#FFF' },
          { label: 'Total Optimal HC',  value: totalOptimal,  bg: '#1A1A1A',   text: '#FFF' },
          { label: 'Var vs Optimal',    value: `${totalVarOpt > 0 ? '+' : ''}${totalVarOpt}%`, bg: '#F0F5FF', text: gColor(totalVarOpt) },
          { label: 'Var vs Min (HC)',   value: `${totalVarMin > 0 ? '+' : ''}${totalVarMin}%`, bg: '#F5FFF5', text: gColor(totalVarMin) },
          { label: 'Var vs Max (HC)',   value: `${totalVarMax > 0 ? '+' : ''}${totalVarMax}%`, bg: '#FFF8F0', text: gColor(totalVarMax) },
        ].map(kpi => (
          <div key={kpi.label} style={{ background: kpi.bg, borderRadius: 8, padding: '12px 16px', textAlign: 'center', border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: kpi.bg === '#F0F5FF' || kpi.bg === '#F5FFF5' || kpi.bg === '#FFF8F0' ? C.muted : kpi.text, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>{kpi.label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: kpi.text, lineHeight: 1 }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* 4 discipline tables + bar charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {data.gearing.map(disc => {
          const color = C.discColors[disc.discipline] ?? C.accent;
          const barData = disc.regions.map(r => ({
            region: r.region_name.replace('AMER Matrix', 'Mtx'),
            Min: r.min, Max: r.max, Proposed: r.proposed,
          }));
          return (
            <div key={disc.discipline} style={{ ...cardStyle, overflow: 'hidden' }}>
              {/* Discipline header */}
              <div style={{ padding: '10px 14px', borderTop: `3px solid ${color}`, borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color }}>{disc.discipline}</span>
                <span style={{ fontSize: 11, background: `${color}22`, color, padding: '2px 10px', borderRadius: 10, fontWeight: 700 }}>
                  Var–Opt: <PctBadge pct={disc.totals.variance_pct} />
                </span>
              </div>

              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                  <thead>
                    <tr>
                      <th style={{ ...TH, minWidth: 90, fontSize: 9 }}>Region</th>
                      <th style={{ ...THR, fontSize: 9 }}>Min</th>
                      <th style={{ ...THR, fontSize: 9 }}>Max</th>
                      <th style={{ ...THR, fontSize: 9, color }}>Proposed</th>
                      <th style={{ ...THR, fontSize: 9 }}>Optimal</th>
                      <th style={{ ...THR, fontSize: 9 }}>Var</th>
                      <th style={{ ...THR, fontSize: 9 }}>Var %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...disc.regions, { ...disc.totals, region_name: 'Grand Total', _isTotal: true } as any].map((row, i) => {
                      const isTotal = row._isTotal;
                      return (
                        <tr key={row.region_name} style={{ background: isTotal ? '#F5F5F5' : i % 2 === 0 ? '#FFF' : '#FAFAFA', borderTop: isTotal ? `2px solid ${C.border}` : 'none' }}>
                          <td style={{ ...TD, fontSize: 11, fontWeight: isTotal ? 700 : 400, color: isTotal ? '#555' : '#333' }}>{row.region_name}</td>
                          <td style={TDM}>{row.min || '—'}</td>
                          <td style={TDM}>{row.max || '—'}</td>
                          <td style={{ ...TDR, color, fontSize: 11 }}>{row.proposed || '—'}</td>
                          <td style={TDM}>{row.optimal || '—'}</td>
                          <td style={{ ...TDM, fontSize: 11, color: row.variance !== 0 ? gColor(row.variance_pct) : C.muted }}>{row.variance > 0 ? `+${row.variance}` : (row.variance || '—')}</td>
                          <td style={{ ...TDM, fontWeight: 700 }}><PctBadge pct={row.variance_pct} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Bar chart */}
              {barData.length > 0 && (
                <div style={{ padding: '8px 4px 4px' }}>
                  <ResponsiveContainer width="100%" height={100}>
                    <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 12, left: -20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" vertical={false} />
                      <XAxis dataKey="region" tick={{ fontSize: 8, fill: C.muted }} angle={-30} textAnchor="end" />
                      <YAxis tick={{ fontSize: 8, fill: C.muted }} />
                      <Tooltip contentStyle={{ fontSize: 10 }} />
                      <Bar dataKey="Min"      fill={`${color}40`} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Max"      fill={`${color}70`} radius={[2, 2, 0, 0]} />
                      <Bar dataKey="Proposed" fill={C.accent}     radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 2 }}>
                    {[['Min', `${color}40`], ['Max', `${color}70`], ['Proposed', C.accent]].map(([l, c]) => (
                      <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <div style={{ width: 7, height: 7, borderRadius: 1, background: c }} />
                        <span style={{ fontSize: 9, color: C.muted }}>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// HIRE STATUS TAB
// ---------------------------------------------------------------------------

function HireStatusTab({ tbhStatus }: { tbhStatus: { req_status: string; count: number }[] }) {
  const STAGE_ORDER = ['Req not raised', 'Not Raised', 'Screening', 'Screen', 'Interview', 'Offer Accepted', 'Hired', 'Closed'];
  const sorted = [...tbhStatus].sort((a, b) => {
    const ia = STAGE_ORDER.indexOf(a.req_status), ib = STAGE_ORDER.indexOf(b.req_status);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const total = sorted.reduce((s, r) => s + r.count, 0);

  const STAGE_COLORS: Record<string, string> = {
    'Hired': '#1E8A4A', 'Closed': '#888', 'Offer Accepted': '#26A69A',
    'Interview': '#1565C0', 'Screening': '#7B1FA2', 'Screen': '#7B1FA2',
    'Not Raised': '#E31837', 'Req not raised': '#E31837',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>

        {/* Horizontal bar chart */}
        <div style={{ ...cardStyle, padding: '14px 16px' }}>
          <SectionTitle>TBH Roles by Hiring Stage</SectionTitle>
          {sorted.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.muted, fontSize: 12 }}>No TBH data</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(160, sorted.length * 36)}>
              <BarChart data={sorted} layout="vertical" margin={{ top: 0, right: 40, bottom: 0, left: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: C.muted }} />
                <YAxis type="category" dataKey="req_status" tick={{ fontSize: 11, fill: '#333' }} width={98} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 11, fill: '#555' }}>
                  {sorted.map((entry, i) => (
                    <Cell key={i} fill={STAGE_COLORS[entry.req_status] ?? '#AAAAAA'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ ...cardStyle, padding: '14px 16px' }}>
            <SectionTitle>TBH Status Summary</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sorted.map(row => {
                const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
                const color = STAGE_COLORS[row.req_status] ?? '#888';
                return (
                  <div key={row.req_status}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: '#444' }}>{row.req_status}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color }}>{row.count} <span style={{ fontWeight: 400, color: C.muted }}>({pct}%)</span></span>
                    </div>
                    <div style={{ height: 4, background: '#F0F0F0', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width .4s' }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>Total TBH Codes</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#111' }}>{total}</span>
            </div>
          </div>

          <div style={{ ...cardStyle, padding: '14px 16px', background: 'linear-gradient(135deg, #1A1A1A, #2A2A2A)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>Hire Stage Note</div>
            <div style={{ fontSize: 12, color: '#AAA', lineHeight: 1.6 }}>
              Hire stage data comes from TBH code records. Time-to-hire tracking and monthly hire volume charts will be available once <code style={{ background: '#333', padding: '1px 4px', borderRadius: 2, fontSize: 10 }}>hired_at</code> dates are recorded on person records.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [yearA, setYearA] = useState<number | null>(null);
  const [yearB, setYearB] = useState<number | null>(null);
  const [hubData, setHubData]   = useState<HubIqResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('Projects');

  useEffect(() => {
    dashboardApi.planningYears()
      .then(rows => {
        const years = rows.map(r => r.year);
        setAvailableYears(years);
        setYearA(years[0] ?? 2026);
        setYearB(years[1] ?? years[0] ?? 2027);
      })
      .catch(() => { setYearA(2026); setYearB(2027); });
  }, []);

  const loadData = useCallback(async () => {
    if (yearA === null || yearB === null) return;
    setLoading(true); setError(null);
    try {
      const d = await dashboardApi.hubIq(yearA, yearB);
      setHubData(d);
      setBackendOk(true);
    } catch (e: unknown) {
      setError((e as Error).message);
      setBackendOk(false);
    } finally {
      setLoading(false);
    }
  }, [yearA, yearB]);

  useEffect(() => { loadData(); }, [loadData]);

  const dataA = hubData?.years[yearA ?? 0];
  const dataB = hubData?.years[yearB ?? 0];
  const ready = !loading && !!dataA && !!dataB && yearA !== null && yearB !== null;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, color: '#111' }}>

      {/* Dark KPI banner */}
      {ready && <TopBanner yearA={yearA!} yearB={yearB!} dataA={dataA!} dataB={dataB!} />}

      {/* Year selectors + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 20px', background: '#FFFFFF', borderBottom: `1px solid ${C.border}`, flexShrink: 0, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: C.accent }}>YEAR A</span>
            <select value={yearA ?? ''} onChange={e => setYearA(Number(e.target.value))} style={{ padding: '3px 8px', border: `1px solid ${C.accent}`, borderRadius: 4, fontSize: 12, color: C.accent, fontWeight: 700, background: '#FFF8F8', cursor: 'pointer' }}>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <span style={{ fontSize: 13, color: C.muted }}>vs</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#1565C0' }}>YEAR B</span>
            <select value={yearB ?? ''} onChange={e => setYearB(Number(e.target.value))} style={{ padding: '3px 8px', border: '1px solid #1565C0', borderRadius: 4, fontSize: 12, color: '#1565C0', fontWeight: 700, background: '#F0F5FF', cursor: 'pointer' }}>
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <button onClick={loadData} disabled={loading} style={{ padding: '3px 12px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 11, cursor: 'pointer', background: '#FFF', color: '#555' }}>
            {loading ? '…' : '↻'}
          </button>
        </div>
        {backendOk === true && <span style={{ fontSize: 10, color: '#1E8A4A' }}>● Connected</span>}
        {backendOk === false && <span style={{ fontSize: 10, color: C.accent }}>⚠ Not connected</span>}
      </div>

      {/* Tab bar */}
      <TabBar active={activeTab} onChange={setActiveTab} />

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ fontSize: 14, color: C.muted }}>Loading dashboard…</div>
          </div>
        )}
        {error && !loading && (
          <div style={{ padding: '16px 20px', background: '#FEF3F2', border: `1px solid #FBBDBA`, borderRadius: 8, color: C.accent, fontSize: 13 }}>
            Failed to load: {error}
            <button onClick={loadData} style={{ marginLeft: 12, fontSize: 12, cursor: 'pointer', padding: '3px 10px', border: `1px solid #FBBDBA`, borderRadius: 4, background: '#FFF', color: C.accent }}>Retry</button>
          </div>
        )}
        {ready && (
          <>
            {activeTab === 'Projects'    && <ProjectsTab    yearA={yearA!} yearB={yearB!} dataA={dataA!} dataB={dataB!} projectTrend={hubData!.project_trend} />}
            {activeTab === 'People'      && <PeopleTab      yearA={yearA!} yearB={yearB!} dataA={dataA!} dataB={dataB!} />}
            {activeTab === 'Requests'    && <RequestsTab    yearA={yearA!} yearB={yearB!} dataA={dataA!} dataB={dataB!} />}
            {activeTab === 'Gearing'     && <GearingTab     yearA={yearA!} yearB={yearB!} dataA={dataA!} dataB={dataB!} />}
            {activeTab === 'Hire Status' && <HireStatusTab  tbhStatus={hubData!.tbh_status} />}
          </>
        )}
      </div>
    </div>
  );
}
