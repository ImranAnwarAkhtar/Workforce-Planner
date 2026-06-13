import { useEffect, useState } from 'react';
import {
  dashboardApi, peopleApi, hireRequestsApi, changeRequestsApi,
  type DashboardSummary, type CapacityItem, type Person, type HireRequest, type ChangeRequest,
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
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60)  return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeptCount { name: string; count: number }

interface AllocationBands { fullyAllocated: number; partial: number; unallocated: number }

type ActivityItem =
  | { kind: 'hire';   id: number; title: string; status: string; date: string; by: string | null }
  | { kind: 'change'; id: number; title: string; status: string; date: string; by: string | null };

// ---------------------------------------------------------------------------
// Shared style tokens
// ---------------------------------------------------------------------------

const C = { accent: '#E31837', bg2: '#111111', border: '#222222', muted: '#888888' };

const card: React.CSSProperties = {
  background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 8, padding: '20px 24px',
};

const sectionTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: C.muted, textTransform: 'uppercase',
  letterSpacing: '0.08em', marginBottom: 16,
};

// ---------------------------------------------------------------------------
// KPI card
// ---------------------------------------------------------------------------

interface KpiProps {
  label: string; value: number | '—'; sub?: string;
  accent: string; icon: React.ReactNode;
}

function KpiCard({ label, value, sub, accent, icon }: KpiProps) {
  return (
    <div style={{ ...card, borderTop: `3px solid ${accent}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#FFFFFF', lineHeight: 1 }}>
            {value}
          </div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 6, fontWeight: 500 }}>{label}</div>
          {sub && <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{
          width: 42, height: 42, borderRadius: 8,
          background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: accent, flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SVG icons
// ---------------------------------------------------------------------------

const IconPeople = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
  </svg>
);
const IconProject = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 3h18v2H3zm0 4h18v2H3zm0 4h12v2H3zm0 4h12v2H3z"/>
  </svg>
);
const IconHire = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
  </svg>
);
const IconChange = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z"/>
  </svg>
);

// ---------------------------------------------------------------------------
// Dept bar chart
// ---------------------------------------------------------------------------

function DeptChart({ data, loading }: { data: DeptCount[]; loading: boolean }) {
  const max = data[0]?.count || 1;
  return (
    <div style={card}>
      <div style={sectionTitle}>Headcount by Discipline</div>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <div className="spinner" />
        </div>
      ) : data.length === 0 ? (
        <p style={{ color: '#555', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No data available</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {data.map(({ name, count }) => {
            const pct = Math.round((count / max) * 100);
            return (
              <div key={name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#CCCCCC' }}>{name}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF' }}>{count}</span>
                </div>
                <div style={{ height: 6, background: '#1E1E1E', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: `linear-gradient(90deg, #E31837 0%, #ff4d6a 100%)`,
                    borderRadius: 3, transition: 'width 0.4s ease',
                  }} />
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
// Allocation summary
// ---------------------------------------------------------------------------

function AllocationSummary({ bands, total, loading }: { bands: AllocationBands; total: number; loading: boolean }) {
  const { fullyAllocated, partial, unallocated } = bands;
  const fullyPct  = total ? Math.round((fullyAllocated / total) * 100) : 0;
  const partialPct = total ? Math.round((partial / total) * 100) : 0;
  const freePct   = total ? Math.round((unallocated / total) * 100) : 0;

  const items = [
    { label: 'Fully Allocated', count: fullyAllocated,  pct: fullyPct,  color: '#33CC77' },
    { label: 'Partially Allocated', count: partial,     pct: partialPct, color: '#FFAA33' },
    { label: 'Available',       count: unallocated,     pct: freePct,   color: '#5599FF' },
  ];

  return (
    <div style={card}>
      <div style={sectionTitle}>Allocation Status — This Month</div>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
          <div className="spinner" />
        </div>
      ) : total === 0 ? (
        <p style={{ color: '#555', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>No capacity data</p>
      ) : (
        <>
          {/* Stacked bar */}
          <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 20 }}>
            <div style={{ width: `${fullyPct}%`, background: '#33CC77', transition: 'width 0.4s' }} />
            <div style={{ width: `${partialPct}%`, background: '#FFAA33', transition: 'width 0.4s' }} />
            <div style={{ width: `${freePct}%`, background: '#5599FF', transition: 'width 0.4s' }} />
          </div>

          {/* Legend rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.map(({ label, count, pct, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 13, color: '#CCCCCC' }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF', minWidth: 32, textAlign: 'right' }}>{count}</div>
                <div style={{ fontSize: 11, color: '#555', minWidth: 34, textAlign: 'right' }}>{pct}%</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #1E1E1E' }}>
            <span style={{ fontSize: 12, color: '#555' }}>{total} active employees tracked</span>
          </div>
        </>
      )}
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
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
          <div className="spinner" />
        </div>
      ) : items.length === 0 ? (
        <p style={{ color: '#555', fontSize: 13, textAlign: 'center', padding: '16px 0' }}>No recent activity</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {items.map((item, idx) => {
            const isHire = item.kind === 'hire';
            const dotColor = isHire ? '#E31837' : '#5599FF';
            const statusColor = STATUS_COLOR[item.status] ?? STATUS_COLOR.Default;
            const isLast = idx === items.length - 1;

            return (
              <div key={`${item.kind}-${item.id}`} style={{
                display: 'flex', gap: 14, paddingBottom: isLast ? 0 : 16,
                borderBottom: isLast ? 'none' : '1px solid #1A1A1A',
                marginBottom: isLast ? 0 : 16,
              }}>
                {/* Timeline dot */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, marginTop: 3, flexShrink: 0 }} />
                  {!isLast && <div style={{ width: 1, flex: 1, background: '#1E1E1E', marginTop: 5 }} />}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
                        color: dotColor, textTransform: 'uppercase', marginRight: 6,
                      }}>
                        {isHire ? 'Hire Request' : 'Change Request'}
                      </span>
                      <span style={{
                        display: 'inline-block', padding: '1px 7px', borderRadius: 10,
                        fontSize: 10, fontWeight: 600, background: `${statusColor}22`,
                        color: statusColor, border: `1px solid ${statusColor}44`,
                      }}>
                        {item.status}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: '#555', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {formatDate(item.date)}
                    </span>
                  </div>
                  <div style={{ fontSize: 14, color: '#FFFFFF', marginTop: 3, fontWeight: 500 }}>{item.title}</div>
                  {item.by && (
                    <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>by {item.by}</div>
                  )}
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
// Dashboard page
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [capacity, setCapacity] = useState<CapacityItem[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  const [summaryLoading, setSummaryLoading] = useState(true);
  const [capacityLoading, setCapacityLoading] = useState(true);
  const [peopleLoading, setPeopleLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);

  const month = currentMonthISO();

  useEffect(() => {
    // Fetch all sections in parallel, each failing independently
    dashboardApi.summary()
      .then(setSummary)
      .catch(() => {})
      .finally(() => setSummaryLoading(false));

    dashboardApi.capacity(month)
      .then(setCapacity)
      .catch(() => {})
      .finally(() => setCapacityLoading(false));

    peopleApi.list({ is_active: 'true', limit: 500 })
      .then(setPeople)
      .catch(() => {})
      .finally(() => setPeopleLoading(false));

    Promise.all([
      hireRequestsApi.list({ limit: 8 }).catch(() => [] as HireRequest[]),
      changeRequestsApi.list({ limit: 8 }).catch(() => [] as ChangeRequest[]),
    ]).then(([hires, changes]) => {
      const hireItems: ActivityItem[] = hires.map(h => ({
        kind: 'hire',
        id: h.id,
        title: [h.request_type, h.level_name, h.discipline_name].filter(Boolean).join(' · ') || `Request #${h.id}`,
        status: h.status,
        date: h.created_at,
        by: h.submitted_by_name,
      }));
      const changeItems: ActivityItem[] = changes.map(c => ({
        kind: 'change',
        id: c.id,
        title: [c.change_type, c.tbh_id && `TBH ${c.tbh_id}`].filter(Boolean).join(' · ') || `Change #${c.id}`,
        status: c.status,
        date: c.created_at,
        by: c.submitted_by_name,
      }));
      const combined = [...hireItems, ...changeItems]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 10);
      setActivity(combined);
    }).finally(() => setActivityLoading(false));
  }, [month]);

  // ── Derived data ──────────────────────────────────────────────────────────

  // Dept breakdown from people list
  const deptCounts: DeptCount[] = (() => {
    const counts: Record<string, number> = {};
    for (const p of people) {
      const dept = p.discipline_name ?? 'Unknown';
      counts[dept] = (counts[dept] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  })();

  // Allocation bands from capacity endpoint
  const bands: AllocationBands = (() => {
    let fullyAllocated = 0, partial = 0, unallocated = 0;
    for (const item of capacity) {
      const ratio = item.utilisation_ratio ?? 0;
      if (ratio >= 0.99)      fullyAllocated++;
      else if (ratio > 0.01)  partial++;
      else                    unallocated++;
    }
    return { fullyAllocated, partial, unallocated };
  })();

  // ── Render ────────────────────────────────────────────────────────────────

  const kpiValue = (v: number | undefined) => (summaryLoading ? '—' : (v ?? 0));

  return (
    <div style={{ color: '#FFFFFF' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Dashboard</h1>
        <div style={{ width: 40, height: 3, background: C.accent, borderRadius: 2, marginTop: 6 }} />
        <p style={{ fontSize: 13, color: C.muted, marginTop: 8 }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <KpiCard
          label="Active Headcount"
          value={kpiValue(summary?.total_people)}
          sub={`${summary?.total_allocations ?? 0} allocations this period`}
          accent="#33CC77"
          icon={<IconPeople />}
        />
        <KpiCard
          label="Active Projects"
          value={kpiValue(summary?.total_projects)}
          accent="#5599FF"
          icon={<IconProject />}
        />
        <KpiCard
          label="Open Hire Requests"
          value={kpiValue(summary?.pending_hire_requests)}
          sub={`${summary?.open_tbh_codes ?? 0} open TBH codes`}
          accent="#FFAA33"
          icon={<IconHire />}
        />
        <KpiCard
          label="Pending Change Requests"
          value={kpiValue(summary?.pending_change_requests)}
          accent={C.accent}
          icon={<IconChange />}
        />
      </div>

      {/* Middle row: Dept chart + Allocation summary */}
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14, marginBottom: 20 }}>
        <DeptChart data={deptCounts} loading={peopleLoading} />
        <AllocationSummary bands={bands} total={capacity.length} loading={capacityLoading} />
      </div>

      {/* Activity feed */}
      <ActivityFeed items={activity} loading={activityLoading} />
    </div>
  );
}
