/**
 * Seeds / updates the first N rows from the "N TBH" tab.
 * Uses GET + PUT for existing records (upsert behaviour via HTTP).
 *
 * Usage:
 *   node scripts/seedNTBH.js "path\to\file.xlsx" [rowLimit]
 */

const https = require('https');
const XLSX  = require('xlsx');

const filePath  = process.argv[2];
const ROW_LIMIT = parseInt(process.argv[3] ?? '30', 10);
const API_BASE  = 'https://workforce-planner-production.up.railway.app/api';

if (!filePath) { console.error('Usage: node scripts/seedNTBH.js <path> [limit]'); process.exit(1); }

// ── Region lookup (hard-coded to match the Railway DB seed) ──────────────────
// DB IDs from GET /api/admin/regions: AMER=1, AMER_MATRIX=2, APAC=3, EMEA_N=4,
// EMEA_S=5, EMEA_C=6, MEA=7, GLOBAL=8
const REGION_MAP = {
  'AMER': 1, 'AMER MATRIX': 2, 'AMER_MATRIX': 2,
  'APAC': 3,
  'EMEA': 6,       // flat "EMEA" → EMEA Central (most records are London-based)
  'EMEA_N': 4, 'EMEA NORTH': 4, 'EMEA N': 4,
  'EMEA_S': 5, 'EMEA SOUTH': 5, 'EMEA S': 5,
  'EMEA_C': 6, 'EMEA CENTRAL': 6, 'EMEA C': 6,
  'MEA': 7, 'MIDDLE EAST': 7,
  'GLOBAL': 8,
};

// ── Excel status / hire-type maps ────────────────────────────────────────────
const STATUS_MAP    = { 'Hired': 'Filled', 'Closed': 'Cancelled' };
const HIRE_TYPE_MAP = {
  'New Hire - Budgeted':   'Net New',
  'Contractor Conversion': 'Conversion',
  'Replacement':           'Backfill',
};

// ── helpers ──────────────────────────────────────────────────────────────────
function normalise(s)  { return String(s ?? '').replace(/\s+/g, ' ').trim(); }
function clean(v)      { const s = normalise(v); return (!s || s === '0') ? null : s; }
function extractYear(f){ const m = String(f ?? '').match(/(\d{4})/); return m ? parseInt(m[1], 10) : null; }

function parseExcelDate(val) {
  const raw = normalise(val);
  if (!raw || raw === '0') return null;
  // Excel serial date (e.g. 44652)
  if (/^\d{5}$/.test(raw)) {
    try {
      const d = XLSX.SSF.parse_date_code(parseInt(raw, 10));
      if (d && d.y > 1970) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
    } catch { return null; }
    return null;
  }
  // dd/mm/yyyy
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m.map(Number);
    if (d && mo && y > 1950) return `${y}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
  }
  return null;
}

function mapProjectType(p) {
  const s = normalise(p).toLowerCase();
  if (s.includes('matrix'))                          return 'Matrix';
  if (s.includes('xscale') || s.includes('x scale')) return 'xScale';
  if (s === 'retail')                                return 'Retail';
  return null;
}

function locationStr(loc) {
  const s = normalise(loc);
  return s && s !== '0' ? s.substring(0, 20) : null;
}

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const url = new URL(API_BASE + path);
    const opts = {
      hostname: url.hostname, path: url.pathname + url.search,
      method, headers: { 'Content-Type': 'application/json' },
      rejectUnauthorized: false,
    };
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Reading: ${filePath}`);
  const wb = XLSX.readFile(filePath);
  const sheetName = wb.SheetNames.includes('N TBH') ? 'N TBH' : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  let headerIdx = -1, colMap = {};
  for (let i = 0; i < 8; i++) {
    const row = allRows[i];
    const found = row.findIndex(c => normalise(String(c)) === 'TBH ID');
    if (found >= 0) {
      headerIdx = i;
      row.forEach((h, idx) => { const k = normalise(String(h)); if (k) colMap[k] = idx; });
      break;
    }
  }
  if (headerIdx < 0) { console.error('Cannot find header row'); process.exit(1); }
  console.log(`Header row ${headerIdx + 1}. Sheet: "${sheetName}"`);

  function cell(row, ...keys) {
    for (const k of keys) {
      const idx = colMap[normalise(k)];
      if (idx !== undefined) {
        const v = normalise(String(row[idx] ?? ''));
        if (v && v !== '0') return v;
      }
    }
    return '';
  }

  // Fetch existing records so we can PUT instead of POST
  console.log('Fetching existing records…');
  const existing = await request('GET', '/tbh-codes?limit=500');
  const idMap = {};
  for (const r of (existing.body.data ?? [])) idMap[r.tbh_id] = r.id;
  console.log(`Found ${Object.keys(idMap).length} existing records.`);

  let inserted = 0, updated = 0, skipped = 0, failed = 0;
  const dataRows = allRows.slice(headerIdx + 1);

  for (let i = 0; i < Math.min(ROW_LIMIT, dataRows.length); i++) {
    const row = dataRows[i];
    if (!row.length || row.every(c => !normalise(String(c)))) { skipped++; continue; }

    let tbhId  = cell(row, 'TBH ID');
    const oldTbh = cell(row, 'OLD TBH');
    if (!tbhId || tbhId === 'No new Code') tbhId = oldTbh;
    if (!tbhId) { skipped++; console.log(`Row ${i + headerIdx + 2}: no key — skipped`); continue; }

    const rawStatus   = cell(row, 'REQ Status');
    const reqStatus   = STATUS_MAP[rawStatus] || rawStatus || null;
    const rawHireType = cell(row, 'Hire Type');
    const hireType    = HIRE_TYPE_MAP[rawHireType] || rawHireType || null;
    const regionKey   = cell(row, 'Region').toUpperCase();
    const regionId    = REGION_MAP[regionKey] ?? null;

    let candidateName = clean(cell(row, 'Final Candidate'));
    const taComments  = clean(cell(row, 'TA Status Comments + Location + TA Contact name + Offer Comp Ratio + Current Company'));
    if (!candidateName) candidateName = taComments;

    let jobProfile = clean(cell(row, 'Job Profile', 'Job  Profile'));
    if (jobProfile && jobProfile.length > 100) jobProfile = jobProfile.slice(0, 100);

    const body = {
      tbh_id:              tbhId,
      old_tbh:             clean(oldTbh),
      funding_year:        extractYear(cell(row, 'FUNDING')),
      hire_type:           hireType,
      region_id:           regionId,
      project_type:        mapProjectType(cell(row, 'Project')),
      legal_entity:        clean(cell(row, 'Legal Entity Final')),
      location_code:       locationStr(cell(row, 'Location')),
      cost_centre:         clean(cell(row, 'Cost Center', 'Cost Centre')),
      job_profile:         jobProfile,
      replaced_emp_name:   clean(cell(row, 'Replaced Emp Name')),
      manager_name:        clean(cell(row, 'Manager Name')),
      target_hire_date:    parseExcelDate(cell(row, 'Hire Date')),
      jr_id:               clean(cell(row, 'Job Req ID')),
      req_status:          reqStatus,
      ta_contact:          clean(cell(row, 'TA Contact')),
      candidate_name:      candidateName,
      estimated_hire_date: parseExcelDate(cell(row, 'TA (Estimated) Hire Date')),
      ta_status_comments:  taComments,
      tbh_description:     clean(cell(row, 'TBH Description')),
      fp_and_a_notes:      clean(cell(row, 'Note from FP&A', 'Note from FP&A Approver')),
    };

    try {
      let result;
      if (idMap[tbhId]) {
        result = await request('PUT', `/tbh-codes/${idMap[tbhId]}`, body);
        if (result.status === 200) { updated++; console.log(`[${i+1}/${ROW_LIMIT}] ↺ Updated  ${tbhId} | region:${regionKey}→${regionId} | date:${body.target_hire_date}`); }
        else { failed++; console.log(`[${i+1}/${ROW_LIMIT}] ✗ PUT ${result.status} ${tbhId}: ${JSON.stringify(result.body)}`); }
      } else {
        result = await request('POST', '/tbh-codes', body);
        if (result.status === 201) { inserted++; console.log(`[${i+1}/${ROW_LIMIT}] ✓ Created  ${tbhId}`); }
        else { failed++; console.log(`[${i+1}/${ROW_LIMIT}] ✗ POST ${result.status} ${tbhId}: ${JSON.stringify(result.body)}`); }
      }
    } catch (err) {
      failed++;
      console.log(`[${i+1}/${ROW_LIMIT}] ✗ Network ${tbhId}: ${err.message}`);
    }
  }

  console.log(`\nDone — created:${inserted} updated:${updated} skipped:${skipped} failed:${failed}`);
}

main().catch(err => { console.error(err); process.exit(1); });
