const xlsx = require('xlsx');
const axios = require('axios');
const https = require('https');

const FILE = "C:\\Users\\iakhtar\\OneDrive - EQUINIX\\Workforce Planning Solution\\GDC HUB Summaries - 26-27 - Anonymised.xlsx";
const API  = process.argv[2] || 'https://workforce-planner-production.up.railway.app';

const http = axios.create({
  baseURL: API,
  timeout: 30000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
});

async function post(endpoint, body) {
  try {
    const { data } = await http.post(`/api${endpoint}`, body);
    return data;
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`POST ${endpoint} failed: ${detail}`);
  }
}

async function get(endpoint) {
  const { data } = await http.get(`/api${endpoint}`);
  return data;
}

function cell(row, col) { return String(row[col] ?? '').trim(); }

function cleanType(raw) {
  const t = raw.trim().toLowerCase();
  if (t === 'xscale' || t === 'xscale') return 'xScale';
  if (t === 'matrix') return 'Matrix';
  return 'Retail';
}

async function main() {
  console.log('Reading:', FILE);
  const wb = xlsx.readFile(FILE);
  const ws = wb.Sheets['APAC 26'];
  if (!ws) throw new Error('APAC 26 sheet not found');

  const data = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

  // ── Projects ──────────────────────────────────────────────────────────────
  // Header row = index 2 (row 3). Find country groups.
  const headerRow = data[2] ?? [];
  const countryGroups = [];
  const knownSuffixes = [' Type', ' Weight', ' Metro', ' Phase', ' FTE', ' Level', ' TBH'];
  for (let c = 2; c < headerRow.length; c++) {
    const h = String(headerRow[c] ?? '').trim();
    if (!h || h === 'Notes' || h === 'Column1') continue;
    const isSuffix = knownSuffixes.some(s => h.endsWith(s));
    if (!isSuffix && h.length >= 2 && h.length <= 10) {
      countryGroups.push({ code: h, col: c });
    }
  }
  console.log('Country groups found:', countryGroups.map(g => g.code).join(', '));

  const STOP = ['value', 'total projects', 'adj total', 'adj xscale', 'metros', 'people allocations'];
  const projectRecords = [];
  const seen = new Set();

  for (let i = 4; i < data.length; i++) {
    const r = data[i];
    const statusCell = cell(r, 0);
    if (!statusCell) continue;
    if (STOP.some(k => statusCell.toLowerCase().includes(k))) break;
    const status = ['Approved', 'Seeded', 'Proposed'].includes(statusCell) ? statusCell : null;
    if (!status) continue;

    for (const { code, col } of countryGroups) {
      const name = cell(r, col);
      if (!name || name === '#N/A') continue;
      const typeRaw = cell(r, col + 1);
      const weight  = parseFloat(cell(r, col + 2)) || 1.0;
      const metro   = cell(r, col + 3) || null;
      const phase   = cell(r, col + 4) || null;
      const key = `${name}|APAC|${code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      projectRecords.push({
        name, status,
        type: cleanType(typeRaw),
        weight,
        region_code: 'APAC',
        country_code: code,
        metro,
        phase_code: phase,
        year: 2026,
      });
    }
  }
  console.log(`Projects parsed: ${projectRecords.length}`);

  // ── People ────────────────────────────────────────────────────────────────
  // Find "People Allocations" section
  let peopleStartRow = -1;
  let peopleHeaderRow = [];
  for (let i = 0; i < data.length; i++) {
    if (String(data[i][0] ?? '').includes('People Allocations')) {
      peopleStartRow = i + 2; // skip header + blank
      peopleHeaderRow = data[i];
      break;
    }
  }

  const peopleRecords = [];
  const peopleSeen = new Set();
  let currentDiscipline = 'Other';

  if (peopleStartRow < 0) {
    console.warn('People Allocations section not found');
  } else {
    // Build people header country groups (Name | Type | FTE | Level | TBH per country)
    const peopleCountryGroups = [];
    for (let c = 2; c < peopleHeaderRow.length; c++) {
      const h = String(peopleHeaderRow[c] ?? '').trim();
      if (!h) continue;
      const isSuffix = [' Type', ' FTE', ' Level', ' TBH'].some(s => h.endsWith(s));
      if (!isSuffix && h.length >= 2 && h.length <= 10) {
        peopleCountryGroups.push({ code: h, col: c });
      }
    }

    const DISCIPLINES = ['Construction', 'Design', 'Commercial', 'Commissioning', 'Other'];
    const DISC_STOP = ['_proposed', '_min target', '_max target'];

    for (let i = peopleStartRow; i < data.length; i++) {
      const r = data[i];
      const colA = String(r[0] ?? '').trim();

      // Check for discipline header
      const discMatch = DISCIPLINES.find(d => colA.toLowerCase().startsWith(d.toLowerCase()));
      if (discMatch) { currentDiscipline = discMatch; continue; }

      // Skip summary rows
      if (DISC_STOP.some(s => colA.toLowerCase().includes(s))) continue;
      if (colA && !discMatch) continue; // non-empty col A that isn't a discipline = section end

      // For each country group, check if there's a person name
      for (const { code, col } of peopleCountryGroups) {
        const name = cell(r, col);
        if (!name || name === '#N/A' || name.startsWith('N P') || name.startsWith('REQ TBH') || name.startsWith('TBH ') || name.startsWith('Replace')) continue;
        const contractCode = cell(r, col + 1) || 'FTE';
        const personKey = `${name}|${contractCode}`;
        if (peopleSeen.has(personKey)) continue;
        peopleSeen.add(personKey);

        const levelCode = cell(r, col + 3) || null;

        // Map contract type to DB code
        let dbContract = 'FTE';
        const cu = contractCode.toUpperCase();
        if (cu === 'CON') dbContract = 'CON';
        else if (cu === 'SNR' || cu === 'VP') dbContract = 'VP';
        else if (cu === 'A FTE') dbContract = 'A FTE';
        else if (cu === 'R FTE') dbContract = 'R FTE';
        else if (cu === 'DR' || cu === 'DR.') dbContract = 'Dr';
        else if (cu === 'FTE') dbContract = 'FTE';

        // Map level short_code
        const levelMap = { 'VP':'VP','S DR':'S Dr','DR':'Dr','S M':'S M','M':'M','ST':'St','SC':'Sc','EX':'Ex','SP':'Sp','IN':'In','EN':'En','CA':'Ca','TE':'Te','CONS':'Cons','AN':'En','-':null };
        const levelKey = levelCode ? levelCode.toUpperCase() : null;
        const mappedLevel = levelKey ? (levelMap[levelKey] ?? null) : null;

        peopleRecords.push({
          name,
          contractCode: dbContract,
          levelCode: mappedLevel,
          discipline: currentDiscipline,
          regionCode: 'APAC',
        });
      }
    }
  }

  // Deduplicate by name+contract
  const uniquePeople = [];
  const finalSeen = new Set();
  for (const p of peopleRecords) {
    const key = `${p.name}|${p.contractCode}`;
    if (!finalSeen.has(key)) { finalSeen.add(key); uniquePeople.push(p); }
  }
  console.log(`People parsed: ${uniquePeople.length}`);

  // ── Post to API ───────────────────────────────────────────────────────────
  console.log('\nImporting projects...');
  const projResult = await post('/imports/projects', { records: projectRecords });
  console.log(`✓ Projects imported: ${projResult.data.imported}`);

  console.log('\nImporting people... (API will resolve IDs server-side)');
  // Send with name lookups — backend resolves contract/level/discipline/region by name
  const peoplePayload = uniquePeople.map(p => ({
    name: p.name,
    contract_type_code: p.contractCode,
    level_code: p.levelCode,
    discipline_name: p.discipline,
    contracted_fte: 1.0,
    region_code: p.regionCode,
  }));
  // People import endpoint expects contract_type_id etc — resolve here via a lookup call
  const adminRes  = await get('/admin/disciplines');
  const levelsRes = await get('/admin/levels');
  const ctRes     = await get('/admin/contract-types');
  const regRes    = await get('/admin/regions');

  const disciplineMap = Object.fromEntries(adminRes.data.map(d => [d.name, d.id]));
  const levelMap2 = Object.fromEntries(levelsRes.data.map(l => [l.short_code, l.id]));
  const ctMap = Object.fromEntries(ctRes.data.map(c => [c.code, c.id]));
  const regMap = Object.fromEntries(regRes.data.map(r => [r.code, r.id]));

  const resolvedPeople = uniquePeople.map(p => ({
    name: p.name,
    contract_type_id: ctMap[p.contractCode] ?? null,
    level_id: p.levelCode ? levelMap2[p.levelCode] ?? null : null,
    discipline_id: disciplineMap[p.discipline] ?? null,
    contracted_fte: 1.0,
    region_ids: p.regionCode && regMap[p.regionCode] ? [regMap[p.regionCode]] : [],
    country_ids: [],
  }));

  const peopleResult = await post('/imports/people', { records: resolvedPeople });
  console.log(`✓ People imported: ${peopleResult.data.imported}`);
  console.log('\nDone! Refresh the app to see the data.');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
