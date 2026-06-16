import { useEffect, useState, useCallback } from 'react';
import {
  dashboardApi,
  type HubIqResponse, type HubIqYearData, type HubIqGearingDisc, type HubIqGearingRegion,
} from '../services/api';

// ---------------------------------------------------------------------------
// Styles / constants
// ---------------------------------------------------------------------------

const DISC_COLORS: Record<string, string> = {
  Construction: '#1565C0', Design: '#1E8A4A', Commercial: '#B5600A', Commissioning: '#7B1FA2',
};
const ACCENT  = '#E31837';
const BORDER  = '#E5E5E5';
const MUTED   = '#777777';
const BG_CARD: React.CSSProperties = {
  background: '#FFFFFF', border: `1px solid ${BORDER}`, borderRadius: 8,
  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
};
const TH: React.CSSProperties = {
  padding: '7px 10px', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
  textTransform: 'uppercase', color: MUTED, background: '#F8F9FA',
  borderBottom: `1px solid ${BORDER}`, whiteSpace: 'nowrap',
};
const THR: React.CSSProperties = { ...TH, textAlign: 'right' };
const TD: React.CSSProperties  = { padding: '7px 10px', fontSize: 12, color: '#333333', borderBottom: `1px solid #F3F3F3` };
const TDR: React.CSSProperties = { ...TD, textAlign: 'right', fontWeight: 600, color: '#111111' };
const TDM: React.CSSProperties = { ...TD, textAlign: 'right', color: MUTED };

function secTitle(label: string, color = ACCENT): React.CSSProperties {
  return { fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.09em' };
}

// ---------------------------------------------------------------------------
// Delta helper
// ---------------------------------------------------------------------------

function Delta({ a, b, invert = false }: { a: number; b: number; invert?: boolean }) {
  const diff = b - a;
  if (diff === 0) return <span style={{ fontSize: 11, color: '#AAAAAA' }}>●</span>;
  const up   = diff > 0;
  const good = invert ? !up : up;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: good ? '#1E8A4A' : '#C0392B' }}>
      {up ? '▲' : '▼'} {Math.abs(diff)}
    </span>
  );
}

function DeltaPct({ pct }: { pct: number }) {
  if (pct === 0) return <span style={{ fontSize: 11, color: '#AAAAAA' }}>●</span>;
  const color = pct > 0 ? '#1E8A4A' : '#C0392B';
  return <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct > 0 ? '+' : ''}{pct}%</span>;
}

// ---------------------------------------------------------------------------
// Year tab buttons
// ---------------------------------------------------------------------------

function YearTabs({ yearA, yearB, active, onChange }: {
  yearA: number; yearB: number; active: number; onChange: (y: number) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[yearA, yearB].map(y => (
        <button key={y} onClick={() => onChange(y)} style={{
          padding: '4px 12px', borderRadius: 4, fontSize: 12, fontWeight: 600,
          border: `1px solid ${active === y ? ACCENT : BORDER}`,
          background: active === y ? ACCENT : '#FFFFFF',
          color: active === y ? '#FFFFFF' : '#555555',
          cursor: 'pointer',
        }}>{y}</button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 1: KPI Banner
// ---------------------------------------------------------------------------

function KpiBanner({ yearA, yearB, dataA, dataB }: {
  yearA: number; yearB: number; dataA: HubIqYearData; dataB: HubIqYearData;
}) {
  const rows: { label: string; a: number; b: number; sub?: string }[] = [
    { label: 'Total Projects',  a: dataA.summary.projects.total,        b: dataB.summary.projects.total },
    { label: 'Retail Projects', a: dataA.summary.projects.retail,       b: dataB.summary.projects.retail },
    { label: 'xScale Projects', a: dataA.summary.projects.xscale,       b: dataB.summary.projects.xscale },
    { label: 'Exist HC Total',  a: dataA.summary.exist_hc.total,        b: dataB.summary.exist_hc.total },
    { label: 'Perm FTE',        a: dataA.summary.exist_hc.perm,         b: dataB.summary.exist_hc.perm },
    { label: 'Contingent',      a: dataA.summary.exist_hc.contingent,   b: dataB.summary.exist_hc.contingent },
    { label: 'Approved TBH',    a: dataA.summary.appr_hc.total,         b: dataB.summary.appr_hc.total },
    { label: 'Requested TBH',   a: dataA.summary.req_hc.total,          b: dataB.summary.req_hc.total },
  ];

  return (
    <div style={{ ...BG_CARD, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '12px 16px 8px', borderBottom: `1px solid ${BORDER}` }}>
        <span style={secTitle('')}>Summary Comparison</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ ...TH, minWidth: 130 }}>Metric</th>
              <th style={{ ...THR, color: ACCENT }}>{yearA}</th>
              <th style={{ ...THR, color: '#1565C0' }}>{yearB}</th>
              <th style={{ ...THR }}>Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const isGroup = ['Total Projects', 'Exist HC Total', 'Approved TBH', 'Requested TBH'].includes(row.label);
              return (
                <tr key={row.label} style={{ background: isGroup ? '#FAFAFA' : '#FFFFFF' }}>
                  <td style={{ ...TD, fontWeight: isGroup ? 700 : 400, paddingLeft: isGroup ? 10 : 22, color: isGroup ? '#111111' : '#444444' }}>
                    {row.label}
                  </td>
                  <td style={{ ...TDR, color: ACCENT }}>{row.a}</td>
                  <td style={{ ...TDR, color: '#1565C0' }}>{row.b}</td>
                  <td style={{ ...TDM }}><Delta a={row.a} b={row.b} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Pipeline
// ---------------------------------------------------------------------------

function PipelineSection({ yearA, yearB, dataA, dataB }: {
  yearA: number; yearB: number; dataA: HubIqYearData; dataB: HubIqYearData;
}) {
  const [activeYear, setActiveYear] = useState(yearA);
  const data = activeYear === yearA ? dataA : dataB;
  const S = ['Approved', 'Seeded', 'Proposed'] as const;
  const SC: Record<string, string> = { Approved: '#1E8A4A', Seeded: '#B5600A', Proposed: '#1565C0' };

  const totalRow = data.pipeline.reduce(
    (a, r) => ({
      rAppr: a.rAppr + r.retail.Approved, rSeed: a.rSeed + r.retail.Seeded, rProp: a.rProp + r.retail.Proposed, rW: a.rW + r.retail.weight,
      xAppr: a.xAppr + r.xscale.Approved, xSeed: a.xSeed + r.xscale.Seeded, xProp: a.xProp + r.xscale.Proposed, xW: a.xW + r.xscale.weight,
      tw: a.tw + r.total_weight,
    }),
    { rAppr: 0, rSeed: 0, rProp: 0, rW: 0, xAppr: 0, xSeed: 0, xProp: 0, xW: 0, tw: 0 }
  );

  return (
    <div style={{ ...BG_CARD, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '12px 16px 8px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={secTitle('')}>Project Pipeline by Region (Weight)</span>
        <YearTabs yearA={yearA} yearB={yearB} active={activeYear} onChange={setActiveYear} />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...TH, minWidth: 120 }}>Region</th>
              {S.map(s => <th key={`r-${s}`} style={{ ...THR, color: SC[s] }}>Retail {s.slice(0,4)}</th>)}
              <th style={{ ...THR }}>Retail Wt</th>
              {S.map(s => <th key={`x-${s}`} style={{ ...THR, color: SC[s] }}>xScale {s.slice(0,4)}</th>)}
              <th style={{ ...THR }}>xScale Wt</th>
              <th style={{ ...THR, fontWeight: 800 }}>Total Wt</th>
            </tr>
          </thead>
          <tbody>
            {data.pipeline.length === 0 ? (
              <tr><td colSpan={9} style={{ ...TD, textAlign: 'center', color: MUTED, padding: '20px 0' }}>No project data for {activeYear}</td></tr>
            ) : data.pipeline.map((row, i) => (
              <tr key={row.region_name} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                <td style={TD}>{row.region_name}</td>
                {S.map(s => <td key={`r-${s}`} style={{ ...TDM, color: row.retail[s] > 0 ? SC[s] : '#DDDDDD' }}>{row.retail[s] || '—'}</td>)}
                <td style={TDM}>{row.retail.weight > 0 ? row.retail.weight.toFixed(1) : '—'}</td>
                {S.map(s => <td key={`x-${s}`} style={{ ...TDM, color: row.xscale[s] > 0 ? SC[s] : '#DDDDDD' }}>{row.xscale[s] || '—'}</td>)}
                <td style={TDM}>{row.xscale.weight > 0 ? row.xscale.weight.toFixed(1) : '—'}</td>
                <td style={{ ...TDR }}>{row.total_weight > 0 ? row.total_weight.toFixed(1) : '—'}</td>
              </tr>
            ))}
          </tbody>
          {data.pipeline.length > 0 && (
            <tfoot>
              <tr style={{ background: '#F5F5F5', borderTop: `2px solid ${BORDER}` }}>
                <td style={{ ...TD, fontWeight: 700, fontSize: 11, color: MUTED, fontStyle: 'italic' }}>Total</td>
                {[totalRow.rAppr, totalRow.rSeed, totalRow.rProp].map((v, i) => (
                  <td key={i} style={{ ...TDR, fontSize: 11 }}>{v || '—'}</td>
                ))}
                <td style={{ ...TDR, fontSize: 11 }}>{totalRow.rW.toFixed(1)}</td>
                {[totalRow.xAppr, totalRow.xSeed, totalRow.xProp].map((v, i) => (
                  <td key={i} style={{ ...TDR, fontSize: 11 }}>{v || '—'}</td>
                ))}
                <td style={{ ...TDR, fontSize: 11 }}>{totalRow.xW.toFixed(1)}</td>
                <td style={{ ...TDR }}>{totalRow.tw.toFixed(1)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Headcount Matrix
// ---------------------------------------------------------------------------

function HeadcountSection({ yearA, yearB, dataA, dataB }: {
  yearA: number; yearB: number; dataA: HubIqYearData; dataB: HubIqYearData;
}) {
  const [activeYear, setActiveYear] = useState(yearA);
  const data = activeYear === yearA ? dataA : dataB;

  const tot = data.headcount.reduce((a, r) => ({
    vp: a.vp + r.exist_vp_dir, fte: a.fte + r.exist_fte, con: a.con + r.exist_con,
    aft: a.aft + r.appr_fte, acf: a.acf + r.appr_con_fte, eh: a.eh + r.existing_heads,
    rft: a.rft + r.req_fte, rcf: a.rcf + r.req_con_fte, rc: a.rc + r.req_con, th: a.th + r.total_heads,
  }), { vp: 0, fte: 0, con: 0, aft: 0, acf: 0, eh: 0, rft: 0, rcf: 0, rc: 0, th: 0 });

  return (
    <div style={{ ...BG_CARD, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '12px 16px 8px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={secTitle('')}>Headcount by Region</span>
        <YearTabs yearA={yearA} yearB={yearB} active={activeYear} onChange={setActiveYear} />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...TH, minWidth: 120 }}>Region</th>
              <th style={THR}>VP/Dir</th>
              <th style={THR}>Perm FTE</th>
              <th style={THR}>Contingent</th>
              <th style={{ ...THR, color: '#1E8A4A' }}>Appr FTE</th>
              <th style={{ ...THR, color: '#1E8A4A' }}>Appr CON→FTE</th>
              <th style={{ ...THR, background: '#EBF7EF', color: '#1E8A4A' }}>Exist Heads</th>
              <th style={{ ...THR, color: '#B5600A' }}>Req FTE</th>
              <th style={{ ...THR, color: '#B5600A' }}>Req CON→FTE</th>
              <th style={{ ...THR, color: '#B5600A' }}>Req CON</th>
              <th style={{ ...THR, background: '#FFF8E1' }}>Total Heads</th>
            </tr>
          </thead>
          <tbody>
            {data.headcount.length === 0 ? (
              <tr><td colSpan={11} style={{ ...TD, textAlign: 'center', color: MUTED, padding: '20px 0' }}>No headcount data</td></tr>
            ) : data.headcount.map((row, i) => (
              <tr key={row.region_name} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                <td style={TD}>{row.region_name}</td>
                <td style={TDM}>{row.exist_vp_dir   || '—'}</td>
                <td style={TDM}>{row.exist_fte       || '—'}</td>
                <td style={TDM}>{row.exist_con       || '—'}</td>
                <td style={{ ...TDM, color: row.appr_fte > 0 ? '#1E8A4A' : '#DDDDDD' }}>{row.appr_fte     || '—'}</td>
                <td style={{ ...TDM, color: row.appr_con_fte > 0 ? '#1E8A4A' : '#DDDDDD' }}>{row.appr_con_fte || '—'}</td>
                <td style={{ ...TDR, background: '#EBF7EF', color: '#1E8A4A' }}>{row.existing_heads || '—'}</td>
                <td style={{ ...TDM, color: row.req_fte > 0 ? '#B5600A' : '#DDDDDD' }}>{row.req_fte     || '—'}</td>
                <td style={{ ...TDM, color: row.req_con_fte > 0 ? '#B5600A' : '#DDDDDD' }}>{row.req_con_fte || '—'}</td>
                <td style={{ ...TDM, color: row.req_con > 0 ? '#B5600A' : '#DDDDDD' }}>{row.req_con     || '—'}</td>
                <td style={{ ...TDR, background: '#FFF8E1' }}>{row.total_heads || '—'}</td>
              </tr>
            ))}
          </tbody>
          {data.headcount.length > 0 && (
            <tfoot>
              <tr style={{ background: '#F5F5F5', borderTop: `2px solid ${BORDER}` }}>
                <td style={{ ...TD, fontWeight: 700, fontSize: 11, color: MUTED, fontStyle: 'italic' }}>Total</td>
                {[tot.vp, tot.fte, tot.con].map((v, i) => <td key={i} style={{ ...TDR, fontSize: 11 }}>{v || '—'}</td>)}
                <td style={{ ...TDR, fontSize: 11, color: '#1E8A4A' }}>{tot.aft || '—'}</td>
                <td style={{ ...TDR, fontSize: 11, color: '#1E8A4A' }}>{tot.acf || '—'}</td>
                <td style={{ ...TDR, background: '#EBF7EF', color: '#1E8A4A' }}>{tot.eh || '—'}</td>
                {[tot.rft, tot.rcf, tot.rc].map((v, i) => <td key={i} style={{ ...TDR, fontSize: 11, color: '#B5600A' }}>{v || '—'}</td>)}
                <td style={{ ...TDR, background: '#FFF8E1' }}>{tot.th || '—'}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 4: Gearing
// ---------------------------------------------------------------------------

function gearingColor(pct: number): string {
  if (pct === 0) return '#777777';
  if (pct > 20)  return '#C0392B';
  if (pct > 5)   return '#B5600A';
  if (pct < -20) return '#1565C0';
  if (pct < -5)  return '#1565C090';
  return '#1E8A4A';
}

function GearingTable({ disc, data }: { disc: HubIqGearingDisc; data: HubIqYearData }) {
  const color = DISC_COLORS[disc.discipline] ?? ACCENT;
  const allRows: (HubIqGearingRegion & { isTotal?: boolean })[] = [
    ...disc.regions,
    { ...disc.totals, region_name: 'Grand Total', isTotal: true },
  ];

  return (
    <div style={{ ...BG_CARD, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px 7px', borderBottom: `1px solid ${BORDER}`, borderTop: `3px solid ${color}` }}>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{disc.discipline}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={{ ...TH, minWidth: 100, fontSize: 9 }}>Region</th>
              <th style={{ ...THR, fontSize: 9 }}>Min</th>
              <th style={{ ...THR, fontSize: 9 }}>Max</th>
              <th style={{ ...THR, fontSize: 9, color }}>Proposed</th>
              <th style={{ ...THR, fontSize: 9 }}>Optimal</th>
              <th style={{ ...THR, fontSize: 9 }}>Var</th>
              <th style={{ ...THR, fontSize: 9 }}>Var %</th>
            </tr>
          </thead>
          <tbody>
            {allRows.length === 1 ? (
              <tr><td colSpan={7} style={{ ...TD, textAlign: 'center', color: MUTED, padding: '12px 0', fontSize: 11 }}>No project data</td></tr>
            ) : allRows.map((row, i) => {
              const isTotal = (row as any).isTotal;
              const gc = gearingColor(row.variance_pct);
              return (
                <tr key={row.region_name} style={{ background: isTotal ? '#F5F5F5' : i % 2 === 0 ? '#FFF' : '#FAFAFA', borderTop: isTotal ? `2px solid ${BORDER}` : 'none' }}>
                  <td style={{ ...TD, fontSize: 11, fontWeight: isTotal ? 700 : 400, color: isTotal ? '#555' : '#333' }}>{row.region_name}</td>
                  <td style={TDM}>{row.min || '—'}</td>
                  <td style={TDM}>{row.max || '—'}</td>
                  <td style={{ ...TDR, color }}>{row.proposed || '—'}</td>
                  <td style={TDM}>{row.optimal || '—'}</td>
                  <td style={{ ...TDM, color: row.variance !== 0 ? gc : MUTED }}>{row.variance > 0 ? `+${row.variance}` : row.variance || '—'}</td>
                  <td style={{ ...TDM, fontWeight: 700 }}><DeltaPct pct={row.variance_pct} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GearingSection({ yearA, yearB, dataA, dataB }: {
  yearA: number; yearB: number; dataA: HubIqYearData; dataB: HubIqYearData;
}) {
  const [activeYear, setActiveYear] = useState(yearA);
  const data = activeYear === yearA ? dataA : dataB;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.09em' }}>
          Gearing Ratios by Discipline & Region
        </span>
        <YearTabs yearA={yearA} yearB={yearB} active={activeYear} onChange={setActiveYear} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {data.gearing.map(disc => (
          <GearingTable key={disc.discipline} disc={disc} data={data} />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 5: Request Detail
// ---------------------------------------------------------------------------

function RequestsSection({ yearA, yearB, dataA, dataB }: {
  yearA: number; yearB: number; dataA: HubIqYearData; dataB: HubIqYearData;
}) {
  const [activeYear, setActiveYear] = useState(yearA);
  const data = activeYear === yearA ? dataA : dataB;

  const TYPE_COLOR: Record<string, { bg: string; color: string }> = {
    'R FTE':     { bg: '#FFF8E1', color: '#B5600A' },
    'R CON':     { bg: '#FEF3F2', color: '#C0392B' },
    'R CON>FTE': { bg: '#EBF2FB', color: '#1565C0' },
  };

  return (
    <div style={{ ...BG_CARD, overflow: 'hidden', marginBottom: 16 }}>
      <div style={{ padding: '12px 16px 8px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={secTitle('')}>Request Detail (R FTE / R CON)</span>
        <YearTabs yearA={yearA} yearB={yearB} active={activeYear} onChange={setActiveYear} />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
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
              <tr><td colSpan={7} style={{ ...TD, textAlign: 'center', color: MUTED, padding: '20px 0' }}>No requests for {activeYear}</td></tr>
            ) : data.requests.map((r, i) => {
              const tc = TYPE_COLOR[r.contract_code] ?? { bg: '#F5F5F5', color: '#555' };
              return (
                <tr key={i} style={{ background: i % 2 === 0 ? '#FFF' : '#FAFAFA' }}>
                  <td style={{ ...TD, color: DISC_COLORS[r.discipline_name] ?? '#333', fontWeight: 600 }}>{r.discipline_name}</td>
                  <td style={TD}>{r.region_name}</td>
                  <td style={TD}>{r.country_name ?? '—'}</td>
                  <td style={TD}>{r.level_code ?? '—'}</td>
                  <td style={TD}>
                    <span style={{ padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 700, background: tc.bg, color: tc.color }}>
                      {r.contract_code}
                    </span>
                  </td>
                  <td style={TDR}>{r.contracted_fte}</td>
                  <td style={{ ...TD, color: MUTED }}>{r.person_name}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
  const [hubData, setHubData] = useState<HubIqResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  // Load available years once
  useEffect(() => {
    dashboardApi.planningYears()
      .then(rows => {
        const years = rows.map(r => r.year);
        setAvailableYears(years);
        if (years.length >= 2) {
          setYearA(years[0]);
          setYearB(years[1]);
        } else if (years.length === 1) {
          setYearA(years[0]);
          setYearB(years[0]);
        } else {
          setYearA(2026);
          setYearB(2027);
        }
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
  const ready = !loading && !!dataA && !!dataB;

  return (
    <div style={{ color: '#111111', height: '100%', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ padding: '14px 20px 12px', background: '#FFFFFF', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>HUB IQ Dashboard</h1>
            <div style={{ width: 36, height: 3, background: ACCENT, borderRadius: 2, marginTop: 4 }} />
            <p style={{ fontSize: 11, color: MUTED, marginTop: 4, marginBottom: 0 }}>
              {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Year selectors */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT }}>Year A</span>
              <select
                value={yearA ?? ''}
                onChange={e => setYearA(Number(e.target.value))}
                style={{ padding: '5px 10px', border: `1px solid ${ACCENT}`, borderRadius: 5, fontSize: 13, color: ACCENT, fontWeight: 700, background: '#FFF8F8', cursor: 'pointer' }}
              >
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <span style={{ fontSize: 16, color: MUTED }}>vs</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#1565C0' }}>Year B</span>
              <select
                value={yearB ?? ''}
                onChange={e => setYearB(Number(e.target.value))}
                style={{ padding: '5px 10px', border: '1px solid #1565C0', borderRadius: 5, fontSize: 13, color: '#1565C0', fontWeight: 700, background: '#F0F5FF', cursor: 'pointer' }}
              >
                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <button onClick={loadData} disabled={loading} style={{
              padding: '5px 14px', border: `1px solid ${BORDER}`, borderRadius: 5,
              fontSize: 12, cursor: 'pointer', background: '#FFFFFF', color: '#555',
            }}>
              {loading ? 'Loading…' : '↻ Refresh'}
            </button>
          </div>
        </div>

        {/* Backend status */}
        {backendOk === false && (
          <div style={{ marginTop: 10, padding: '8px 12px', background: '#FEF3F2', border: `1px solid #FBBDBA`, borderRadius: 5, fontSize: 12, color: '#C0392B' }}>
            ⚠ Backend not connected — data cannot load.
          </div>
        )}
        {backendOk === true && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#1E8A4A', display: 'inline-block' }} />
            <span style={{ fontSize: 11, color: MUTED }}>Connected</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div style={{ fontSize: 14, color: MUTED }}>Loading dashboard data…</div>
          </div>
        )}

        {error && !loading && (
          <div style={{ padding: '20px 24px', background: '#FEF3F2', border: `1px solid #FBBDBA`, borderRadius: 8, color: '#C0392B', fontSize: 13 }}>
            Failed to load: {error}
            <button onClick={loadData} style={{ marginLeft: 12, fontSize: 12, cursor: 'pointer', padding: '3px 10px', border: `1px solid #FBBDBA`, borderRadius: 4, background: '#FFF', color: '#C0392B' }}>Retry</button>
          </div>
        )}

        {ready && yearA !== null && yearB !== null && dataA && dataB && (
          <>
            <KpiBanner    yearA={yearA} yearB={yearB} dataA={dataA} dataB={dataB} />
            <PipelineSection yearA={yearA} yearB={yearB} dataA={dataA} dataB={dataB} />
            <HeadcountSection yearA={yearA} yearB={yearB} dataA={dataA} dataB={dataB} />
            <GearingSection yearA={yearA} yearB={yearB} dataA={dataA} dataB={dataB} />
            <RequestsSection yearA={yearA} yearB={yearB} dataA={dataA} dataB={dataB} />
          </>
        )}
      </div>
    </div>
  );
}
