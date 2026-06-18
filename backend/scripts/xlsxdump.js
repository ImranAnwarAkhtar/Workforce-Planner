const XLSX = require("xlsx");
const wb = XLSX.readFile("C:/Users/iakhtar/OneDrive - EQUINIX/Workforce Planning Solution/GDC HUB Summaries - 26-27 - Anonymised.xlsx");
const ws = wb.Sheets["N TBH"];
const allRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
let headerIdx = -1, colMap = {};
for (let i = 0; i < 8; i++) {
  const row = allRows[i];
  const found = row.findIndex(c => String(c).replace(/\s+/g," ").trim() === "TBH ID");
  if (found >= 0) { headerIdx = i; row.forEach((h,idx) => { const k = String(h).replace(/\s+/g," ").trim(); if(k) colMap[k]=idx; }); break; }
}
for (let i = headerIdx+1; i < Math.min(headerIdx+6, allRows.length); i++) {
  const row = allRows[i];
  const get = (...keys) => { for(const k of keys){ const idx=colMap[k]; if(idx!==undefined){ const v=String(row[idx]||"").replace(/\s+/g," ").trim(); if(v&&v!="0")return v; } } return ""; };
  console.log(JSON.stringify({ tbh_id:get("TBH ID"),old_tbh:get("OLD TBH"),status:get("REQ Status"),hire_type:get("Hire Type"),region:get("Region"),funding:get("FUNDING"),job:get("Job Profile","Job  Profile"),manager:get("Manager Name"),hire_date:get("Hire Date"),candidate:get("Final Candidate"),project_type:get("Project"),location:get("Location"),cost_centre:get("Cost Center") }));
}
