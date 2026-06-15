import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  peopleApi, refDataApi,
  type Person, type Discipline, type Level, type ContractType,
  type CreatePersonBody,
} from '../services/api';
import { getUser } from '../hooks/useAuth';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const S = {
  page: { color: '#111111' } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 } as React.CSSProperties,
  title: { fontSize: 24, fontWeight: 700, margin: 0, color: '#111111' } as React.CSSProperties,
  accent: { width: 40, height: 3, background: '#E31837', borderRadius: 2, marginTop: 6 } as React.CSSProperties,
  toolbar: { display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' as const, alignItems: 'center' },
  searchWrap: { position: 'relative', flex: '1 1 260px', maxWidth: 340 } as React.CSSProperties,
  searchInput: {
    width: '100%', padding: '9px 12px 9px 36px',
    background: '#FFFFFF', border: '1px solid #D5D5D5', borderRadius: 6,
    color: '#111111', fontSize: 14, outline: 'none',
  } as React.CSSProperties,
  searchIcon: { position: 'absolute' as const, left: 11, top: '50%', transform: 'translateY(-50%)', color: '#999', pointerEvents: 'none' as const },
  select: {
    padding: '9px 12px', background: '#FFFFFF', border: '1px solid #D5D5D5',
    borderRadius: 6, color: '#111111', fontSize: 14, cursor: 'pointer', outline: 'none',
  } as React.CSSProperties,
  btnPrimary: {
    padding: '9px 18px', background: '#E31837', color: '#FFFFFF',
    border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  card: { background: '#FFFFFF', borderRadius: 8, border: '1px solid #E5E5E5', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse' as const, fontSize: 14 },
  th: {
    padding: '11px 16px', textAlign: 'left' as const, fontSize: 11,
    fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' as const,
    color: '#666666', background: '#F8F9FA', borderBottom: '1px solid #E8E8E8',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,
  td: { padding: '12px 16px', borderBottom: '1px solid #F0F0F0', verticalAlign: 'middle' as const },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 60, color: '#999' },
  badge: (colour?: string | null): React.CSSProperties => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 12,
    fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
    background: colour ? `${colour}18` : '#F0F0F0',
    color: colour ?? '#666666',
    border: `1px solid ${colour ? `${colour}44` : '#D5D5D5'}`,
  }),
  activeBadge: (active: boolean): React.CSSProperties => ({
    display: 'inline-block', padding: '2px 8px', borderRadius: 12,
    fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
    background: active ? '#E8F5EE' : '#FEF0F0',
    color: active ? '#1E8A4A' : '#C0392B',
    border: `1px solid ${active ? '#A8D8BF' : '#F5C0BB'}`,
  }),
  actionBtn: (danger?: boolean): React.CSSProperties => ({
    padding: '4px 10px', fontSize: 12, fontWeight: 500,
    background: 'transparent',
    border: `1px solid ${danger ? '#F5C0BB' : '#D5D5D5'}`,
    color: danger ? '#C0392B' : '#555555',
    borderRadius: 4, cursor: 'pointer',
  }),
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: 20,
  } as React.CSSProperties,
  modal: {
    background: '#FFFFFF', border: '1px solid #E0E0E0', borderRadius: 10,
    width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' as const,
    padding: '28px 32px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
  } as React.CSSProperties,
  modalTitle: { fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#111111' } as React.CSSProperties,
  fieldGroup: { marginBottom: 16 } as React.CSSProperties,
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#666666', marginBottom: 5, letterSpacing: '0.06em', textTransform: 'uppercase' as const } as React.CSSProperties,
  input: {
    width: '100%', padding: '9px 12px',
    background: '#FFFFFF', border: '1px solid #D5D5D5', borderRadius: 6,
    color: '#111111', fontSize: 14, outline: 'none', boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  modalSelect: {
    width: '100%', padding: '9px 12px',
    background: '#FFFFFF', border: '1px solid #D5D5D5', borderRadius: 6,
    color: '#111111', fontSize: 14, outline: 'none', cursor: 'pointer',
  } as React.CSSProperties,
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } as React.CSSProperties,
  modalFooter: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 24, paddingTop: 20, borderTop: '1px solid #EEEEEE' } as React.CSSProperties,
  btnSecondary: {
    padding: '9px 18px', background: 'transparent', color: '#555555',
    border: '1px solid #D5D5D5', borderRadius: 6, fontSize: 14, cursor: 'pointer',
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

interface FormState {
  name: string;
  contracted_fte: string;
  workday_jr_id: string;
  level_id: string;
  discipline_id: string;
  contract_type_id: string;
}

const emptyForm: FormState = {
  name: '', contracted_fte: '1', workday_jr_id: '',
  level_id: '', discipline_id: '', contract_type_id: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function People() {
  const [people, setPeople] = useState<Person[]>([]);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [contractTypes, setContractTypes] = useState<ContractType[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'true' | 'false' | 'all'>('true');

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Person | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [permDeleteTarget, setPermDeleteTarget] = useState<Person | null>(null);
  const [permDeleting, setPermDeleting] = useState(false);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const user = getUser();
  const canHardDelete = user?.role === 'Workforce Planning' || user?.role === 'PMO';

  // ── Load reference data once ──────────────────────────────────────────────

  useEffect(() => {
    Promise.all([
      refDataApi.disciplines().catch(() => [] as Discipline[]),
      refDataApi.levels().catch(() => [] as Level[]),
      refDataApi.contractTypes().catch(() => [] as ContractType[]),
    ]).then(([d, l, c]) => {
      setDisciplines(d);
      setLevels(l);
      setContractTypes(c);
    });
  }, []);

  // ── Load people ───────────────────────────────────────────────────────────

  const loadPeople = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await peopleApi.list({ is_active: statusFilter, limit: 500 });
      setPeople(data);
      setSelectedIds(new Set());
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Failed to load people');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { loadPeople(); }, [loadPeople]);

  // Clear selection when search filter changes
  useEffect(() => { setSelectedIds(new Set()); }, [search]);

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!search.trim()) return people;
    const q = search.toLowerCase();
    return people.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.discipline_name ?? '').toLowerCase().includes(q) ||
      (p.level_name ?? '').toLowerCase().includes(q) ||
      (p.contract_type_code ?? '').toLowerCase().includes(q)
    );
  }, [people, search]);

  // ── Selection helpers ─────────────────────────────────────────────────────

  function toggleSelect(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.id)));
    }
  }

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < filtered.length;

  // ── Modal helpers ─────────────────────────────────────────────────────────

  function openAdd() {
    setEditTarget(null);
    setForm(emptyForm);
    setNameError('');
    setModalOpen(true);
  }

  function openEdit(p: Person) {
    setEditTarget(p);
    setForm({
      name: p.name,
      contracted_fte: String(p.contracted_fte),
      workday_jr_id: p.workday_jr_id ?? '',
      level_id: '',
      discipline_id: '',
      contract_type_id: '',
    });
    setNameError('');
    setModalOpen(true);
  }

  function closeModal() { setModalOpen(false); }

  function setField(key: keyof FormState, value: string) {
    setForm(f => ({ ...f, [key]: value }));
    if (key === 'name') setNameError('');
  }

  async function handleSave() {
    if (!form.name.trim()) { setNameError('Name is required'); return; }
    setSaving(true);
    try {
      const body: CreatePersonBody = {
        name: form.name.trim(),
        contracted_fte: Math.min(1, Math.max(0, parseFloat(form.contracted_fte) || 1)),
        workday_jr_id: form.workday_jr_id.trim() || null,
        level_id: form.level_id ? parseInt(form.level_id, 10) : null,
        discipline_id: form.discipline_id ? parseInt(form.discipline_id, 10) : null,
        contract_type_id: form.contract_type_id ? parseInt(form.contract_type_id, 10) : null,
      };
      if (editTarget) {
        await peopleApi.update(editTarget.id, body);
      } else {
        await peopleApi.create(body);
      }
      closeModal();
      loadPeople();
    } finally {
      setSaving(false);
    }
  }

  // ── Delete handlers ───────────────────────────────────────────────────────

  async function handleDeactivate() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await peopleApi.deactivate(deleteTarget.id);
      setDeleteTarget(null);
      loadPeople();
    } finally {
      setDeleting(false);
    }
  }

  async function handlePermanentDelete() {
    if (!permDeleteTarget) return;
    setPermDeleting(true);
    try {
      await peopleApi.deletePermanent(permDeleteTarget.id);
      setPermDeleteTarget(null);
      loadPeople();
    } finally {
      setPermDeleting(false);
    }
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      await peopleApi.bulkDeletePermanent(Array.from(selectedIds));
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      loadPeople();
    } finally {
      setBulkDeleting(false);
    }
  }

  // Names of selected people for the confirmation modal
  const selectedNames = filtered.filter(p => selectedIds.has(p.id)).map(p => p.name);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>

      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>People</h1>
          <div style={S.accent} />
        </div>
        <button style={S.btnPrimary} onClick={openAdd}>
          + Add Person
        </button>
      </div>

      {/* Toolbar */}
      <div style={S.toolbar}>
        <div style={S.searchWrap}>
          <span style={S.searchIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
            </svg>
          </span>
          <input
            style={S.searchInput}
            placeholder="Search by name, discipline, level…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select style={S.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
          <option value="all">All statuses</option>
        </select>
        <span style={{ color: '#666', fontSize: 13, marginLeft: 4 }}>
          {loading ? '…' : `${filtered.length} ${filtered.length === 1 ? 'person' : 'people'}`}
        </span>

        {/* Bulk action bar — only visible when rows are checked */}
        {canHardDelete && selectedIds.size > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '7px 14px', background: '#FEF0F0',
            border: '1px solid #F5C0BB', borderRadius: 6, marginLeft: 'auto',
          }}>
            <span style={{ fontSize: 13, color: '#C0392B' }}>
              {selectedIds.size} selected
            </span>
            <button
              onClick={() => setBulkDeleteOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', background: '#8B0000', border: 'none',
                color: '#FFF', borderRadius: 4, fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
              Delete {selectedIds.size} {selectedIds.size === 1 ? 'record' : 'records'}
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              style={{ padding: '5px 10px', background: 'transparent', border: '1px solid #444', color: '#888', borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Table card */}
      <div style={S.card}>
        {loading ? (
          <div style={S.center}>
            <div className="spinner" />
          </div>
        ) : error ? (
          <div style={{ ...S.center, flexDirection: 'column', gap: 12 }}>
            <span style={{ color: '#E31837' }}>Failed to load people</span>
            <span style={{ fontSize: 12, color: '#666' }}>{error}</span>
            <button style={S.btnSecondary} onClick={loadPeople}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ ...S.center, flexDirection: 'column', gap: 8 }}>
            <span>No people found</span>
            {search && <span style={{ fontSize: 12, color: '#666' }}>Try clearing the search filter</span>}
          </div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                {canHardDelete && (
                  <th style={{ ...S.th, width: 44, paddingRight: 0 }}>
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected; }}
                      onChange={toggleSelectAll}
                      style={{ cursor: 'pointer', accentColor: '#E31837', width: 15, height: 15 }}
                      title="Select all"
                    />
                  </th>
                )}
                {['Name', 'Level / Role', 'Discipline', 'Contract Type', 'FTE', 'Status', ''].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <PersonRow
                  key={p.id}
                  person={p}
                  onEdit={() => openEdit(p)}
                  onDelete={() => setDeleteTarget(p)}
                  onPermDelete={canHardDelete ? () => setPermDeleteTarget(p) : undefined}
                  selected={selectedIds.has(p.id)}
                  onToggle={canHardDelete ? () => toggleSelect(p.id) : undefined}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit modal */}
      {modalOpen && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) closeModal(); }}>
          <div style={S.modal}>
            <h2 style={S.modalTitle}>{editTarget ? 'Edit Person' : 'Add Person'}</h2>

            <div style={S.fieldGroup}>
              <label style={S.label}>Name *</label>
              <input
                style={{ ...S.input, borderColor: nameError ? '#E31837' : '#333333' }}
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="Full name"
                autoFocus
              />
              {nameError && <span style={{ fontSize: 11, color: '#E31837', marginTop: 3, display: 'block' }}>{nameError}</span>}
            </div>

            <div style={S.formRow}>
              <div style={S.fieldGroup}>
                <label style={S.label}>Contracted FTE</label>
                <input
                  type="number" min="0" max="1" step="0.1"
                  style={S.input}
                  value={form.contracted_fte}
                  onChange={e => setField('contracted_fte', e.target.value)}
                />
              </div>
              <div style={S.fieldGroup}>
                <label style={S.label}>Workday JR ID</label>
                <input
                  style={S.input}
                  value={form.workday_jr_id}
                  onChange={e => setField('workday_jr_id', e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div style={S.fieldGroup}>
              <label style={S.label}>Level / Role</label>
              <select style={S.modalSelect} value={form.level_id} onChange={e => setField('level_id', e.target.value)}>
                <option value="">— Select level —</option>
                {levels.map(l => (
                  <option key={l.id} value={l.id}>{l.level_name} ({l.short_code})</option>
                ))}
              </select>
            </div>

            <div style={S.fieldGroup}>
              <label style={S.label}>Discipline</label>
              <select style={S.modalSelect} value={form.discipline_id} onChange={e => setField('discipline_id', e.target.value)}>
                <option value="">— Select discipline —</option>
                {disciplines.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div style={S.fieldGroup}>
              <label style={S.label}>Contract Type</label>
              <select style={S.modalSelect} value={form.contract_type_id} onChange={e => setField('contract_type_id', e.target.value)}>
                <option value="">— Select contract type —</option>
                {contractTypes.map(c => (
                  <option key={c.id} value={c.id}>{c.code} — {c.description}</option>
                ))}
              </select>
            </div>

            <div style={S.modalFooter}>
              <button style={S.btnSecondary} onClick={closeModal} disabled={saving}>Cancel</button>
              <button style={S.btnPrimary} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Add Person'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirmation modal */}
      {deleteTarget && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null); }}>
          <div style={{ ...S.modal, maxWidth: 400 }}>
            <h2 style={{ ...S.modalTitle, marginBottom: 12 }}>Deactivate Person</h2>
            <p style={{ color: '#CCCCCC', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              Are you sure you want to deactivate <strong style={{ color: '#FFFFFF' }}>{deleteTarget.name}</strong>?
              They will be hidden from active views but their data will be preserved.
            </p>
            <div style={S.modalFooter}>
              <button style={S.btnSecondary} onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
              <button style={{ ...S.btnPrimary, background: '#c41530' }} onClick={handleDeactivate} disabled={deleting}>
                {deleting ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single permanent delete confirmation modal */}
      {permDeleteTarget && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setPermDeleteTarget(null); }}>
          <div style={{ ...S.modal, maxWidth: 420 }}>
            <h2 style={{ ...S.modalTitle, marginBottom: 12, color: '#E31837' }}>Permanently Delete Person</h2>
            <p style={{ color: '#CCCCCC', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
              This will permanently remove <strong style={{ color: '#FFFFFF' }}>{permDeleteTarget.name}</strong> and all their allocation records. This action cannot be undone.
            </p>
            <div style={{ background: '#FEF0F0', border: '1px solid #F5C0BB', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#C0392B', marginBottom: 20 }}>
              All FTE allocations for this person will also be deleted.
            </div>
            <div style={S.modalFooter}>
              <button style={S.btnSecondary} onClick={() => setPermDeleteTarget(null)} disabled={permDeleting}>Cancel</button>
              <button style={{ ...S.btnPrimary, background: '#8B0000' }} onClick={handlePermanentDelete} disabled={permDeleting}>
                {permDeleting ? 'Deleting…' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation modal */}
      {bulkDeleteOpen && (
        <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setBulkDeleteOpen(false); }}>
          <div style={{ ...S.modal, maxWidth: 460 }}>
            <h2 style={{ ...S.modalTitle, marginBottom: 12, color: '#E31837' }}>
              Permanently Delete {selectedIds.size} {selectedIds.size === 1 ? 'Person' : 'People'}
            </h2>
            <p style={{ color: '#CCCCCC', fontSize: 14, lineHeight: 1.6, marginBottom: 12 }}>
              The following {selectedIds.size === 1 ? 'person' : 'people'} and all their allocation records will be permanently removed. This cannot be undone.
            </p>

            {/* Scrollable name list */}
            <div style={{
              maxHeight: 160, overflowY: 'auto',
              background: '#F8F9FA', border: '1px solid #E0E0E0',
              borderRadius: 6, padding: '8px 12px', marginBottom: 12,
            }}>
              {selectedNames.map(name => (
                <div key={name} style={{ fontSize: 13, color: '#333333', padding: '3px 0', borderBottom: '1px solid #EEEEEE' }}>
                  {name}
                </div>
              ))}
            </div>

            <div style={{ background: '#FEF0F0', border: '1px solid #F5C0BB', borderRadius: 6, padding: '10px 14px', fontSize: 13, color: '#C0392B', marginBottom: 20 }}>
              All FTE allocations for {selectedIds.size === 1 ? 'this person' : 'these people'} will also be deleted.
            </div>

            <div style={S.modalFooter}>
              <button style={S.btnSecondary} onClick={() => setBulkDeleteOpen(false)} disabled={bulkDeleting}>Cancel</button>
              <button style={{ ...S.btnPrimary, background: '#8B0000' }} onClick={handleBulkDelete} disabled={bulkDeleting}>
                {bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'Record' : 'Records'} Permanently`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row sub-component
// ---------------------------------------------------------------------------

interface PersonRowProps {
  person: Person;
  onEdit: () => void;
  onDelete: () => void;
  onPermDelete?: () => void;
  selected?: boolean;
  onToggle?: () => void;
}

function PersonRow({ person: p, onEdit, onDelete, onPermDelete, selected, onToggle }: PersonRowProps) {
  const [hover, setHover] = useState(false);

  return (
    <tr
      style={{ background: selected ? '#FEF0F0' : hover ? '#FAFAFA' : 'transparent' }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {onToggle && (
        <td style={{ ...S.td, width: 44, paddingRight: 0 }}>
          <input
            type="checkbox"
            checked={!!selected}
            onChange={onToggle}
            style={{ cursor: 'pointer', accentColor: '#E31837', width: 15, height: 15 }}
          />
        </td>
      )}

      <td style={S.td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: selected ? '#FDDDE2' : '#FEF0F2',
            border: `1px solid ${selected ? '#E31837' : '#F5C0C8'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, color: '#E31837',
          }}>
            {p.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 500, color: '#FFFFFF' }}>{p.name}</div>
            {p.workday_jr_id && (
              <div style={{ fontSize: 11, color: '#666', marginTop: 1 }}>{p.workday_jr_id}</div>
            )}
          </div>
        </div>
      </td>

      <td style={S.td}>
        {p.level_name
          ? <span style={{ color: '#CCCCCC' }}>{p.level_name}</span>
          : <span style={{ color: '#444' }}>—</span>}
      </td>

      <td style={S.td}>
        {p.discipline_name
          ? <span style={{ color: '#CCCCCC' }}>{p.discipline_name}</span>
          : <span style={{ color: '#444' }}>—</span>}
      </td>

      <td style={S.td}>
        {p.contract_type_code
          ? <span style={S.badge(p.colour_hex)}>{p.contract_type_code}</span>
          : <span style={{ color: '#444' }}>—</span>}
      </td>

      <td style={S.td}>
        <span style={{ color: Number(p.contracted_fte) >= 1 ? '#CCCCCC' : '#E8A020', fontWeight: 500 }}>
          {Number(p.contracted_fte).toFixed(1)}
        </span>
      </td>

      <td style={S.td}>
        <span style={S.activeBadge(p.is_active)}>
          {p.is_active ? 'Active' : 'Inactive'}
        </span>
      </td>

      <td style={{ ...S.td, borderBottom: S.td.borderBottom }}>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          <button style={S.actionBtn()} onClick={onEdit}>Edit</button>
          {p.is_active && (
            <button style={S.actionBtn(true)} onClick={onDelete}>Deactivate</button>
          )}
          {onPermDelete && (
            <button
              style={{
                ...S.actionBtn(true),
                display: 'flex', alignItems: 'center', gap: 4,
                borderColor: '#F5C0BB', background: '#FEF5F5',
              }}
              onClick={onPermDelete}
              title="Permanently delete this person and all their allocations"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
              </svg>
              Delete
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
