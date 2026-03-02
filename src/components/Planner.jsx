import { useState, useRef, useMemo, useCallback } from "react";

const COLORS = ["#FFB3B3","#B3E5D1","#B3D4F5","#C8E6C9","#FFF9C4","#E1BEE7","#B2EBF2","#FFF3B0","#D7B8F3","#FFD9B3"];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const HOURS = Array.from({length:24},(_,i)=>i);
const RECUR_OPTIONS = [
  { value:"none",    label:"Does not repeat" },
  { value:"daily",   label:"Every day" },
  { value:"weekly",  label:"Every week (same day)" },
  { value:"mwf",     label:"Mon / Wed / Fri" },
  { value:"tth",     label:"Tue / Thu" },
  { value:"weekdays",label:"Weekdays (Mon–Fri)" },
  { value:"weekend", label:"Weekends (Sat–Sun)" },
];
const RECUR_DAYS = { daily:[0,1,2,3,4,5,6], mwf:[0,2,4], tth:[1,3], weekdays:[0,1,2,3,4], weekend:[5,6] };
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({length:11},(_,i)=>CURRENT_YEAR-5+i);
const CATEGORIES = ["Appletree","Contract","Other"];
const CATEGORY_STYLES = {
  "Appletree": { bg:"rgba(74,222,128,0.12)", color:"#4ade80", border:"rgba(74,222,128,0.3)" },
  "Contract":  { bg:"rgba(251,146,60,0.12)",  color:"#fb923c", border:"rgba(251,146,60,0.3)" },
  "Other":     { bg:"rgba(148,163,184,0.12)", color:"#94a3b8", border:"rgba(148,163,184,0.3)" },
};

const defaultClients = [
  { id:1, name:"Acme Corp",      color:"#FF6B6B", rate:150, contact:"jane@acme.com",   notes:"Q2 website redesign",    year:CURRENT_YEAR, category:"Appletree" },
  { id:2, name:"BlueSky Studio", color:"#45B7D1", rate:200, contact:"mark@bluesky.io", notes:"Brand identity project", year:CURRENT_YEAR, category:"Contract" },
];

function fmt(h){ return h===0?"12 AM":h<12?`${h} AM`:h===12?"12 PM":`${h-12} PM`; }
function recurShort(r){
  const map={daily:"Daily",weekly:"Weekly",mwf:"MWF",tth:"T/Th",weekdays:"Wkdays",weekend:"Wkend"};
  return map[r]||"";
}
function expandBlocks(blocks){
  const out=[];
  for(const b of blocks){
    if(!b.recur||b.recur==="none"||b.recur==="weekly") out.push({...b,_day:b.day});
    else { const days=RECUR_DAYS[b.recur]||[b.day]; for(const d of days) out.push({...b,_day:d}); }
  }
  return out;
}

// ── CSV Parser ──
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };
  const parseRow = line => {
    const cols = []; let cur = ""; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    cols.push(cur.trim());
    return cols;
  };
  const headers = parseRow(lines[0]).map(h => h.toLowerCase().replace(/[^a-z0-9]/g,""));
  const rows = lines.slice(1).filter(l=>l.trim()).map(l => {
    const vals = parseRow(l);
    const obj = {};
    headers.forEach((h,i) => obj[h] = vals[i] || "");
    return obj;
  });
  return { headers, rows };
}

// Try to map CSV columns to our client fields
function mapRow(row, idx, nextId) {
  const get = (...keys) => {
    for (const k of keys) {
      for (const rk of Object.keys(row)) {
        if (rk.includes(k)) return row[rk] || "";
      }
    }
    return "";
  };
  const name = get("name","client","company","business","firm") || `Imported Client ${idx+1}`;
  const contact = get("email","contact","mail");
  const rateRaw = get("rate","hourly","price","fee","cost");
  const rate = parseFloat(rateRaw.replace(/[^0-9.]/g,"")) || 0;
  const notes = get("note","description","project","detail","memo");
  const color = COLORS[idx % COLORS.length];
  return { id: nextId++, name, contact, rate, notes, color, year: CURRENT_YEAR };
}

const emptyBlock={clientId:"",day:0,start:9,end:10,task:"",recur:"none"};
const emptyClient={name:"",color:COLORS[0],rate:"",contact:"",notes:"",year:CURRENT_YEAR,category:"Appletree",estHours:""};

// Get week dates for a given offset from current week (0=this week)
function getWeekDates(offset=0){
  const now=new Date();
  const monday=new Date(now);
  const day=now.getDay();
  const diff=day===0?-6:1-day;
  monday.setDate(now.getDate()+diff+(offset*7));
  return Array.from({length:7},(_,i)=>{
    const d=new Date(monday);
    d.setDate(monday.getDate()+i);
    return d;
  });
}

function getMonthDates(year,month){
  const firstDay=new Date(year,month,1);
  const lastDay=new Date(year,month+1,0);
  const start=new Date(firstDay);
  const startDow=firstDay.getDay();
  start.setDate(firstDay.getDate()-(startDow===0?6:startDow-1));
  const end=new Date(lastDay);
  const endDow=lastDay.getDay();
  if(endDow!==0) end.setDate(lastDay.getDate()+(7-endDow));
  const dates=[];
  const cur=new Date(start);
  while(cur<=end){dates.push(new Date(cur));cur.setDate(cur.getDate()+1);}
  return dates;
}

const MONTH_NAMES=["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function App(){
  const [view,setView]=useState("planner");
  const [plannerView,setPlannerView]=useState("week"); // week | workweek | month
  const [weekOffset,setWeekOffset]=useState(0);
  const [monthOffset,setMonthOffset]=useState(0);
  const [selectedYear,setSelectedYear]=useState(CURRENT_YEAR);
  const [clients,setClients]=useState(defaultClients);
  const [blocks,setBlocks]=useState([
    {id:1,clientId:1,day:0,start:9, end:11,task:"Homepage mockups",   recur:"weekly"},
    {id:2,clientId:2,day:1,start:10,end:13,task:"Logo concepts",       recur:"none"},
    {id:3,clientId:1,day:3,start:14,end:16,task:"Client call",         recur:"weekly"},
    {id:4,clientId:2,day:2,start:9, end:10,task:"Brand strategy sync", recur:"mwf"},
    {id:5,clientId:1,day:4,start:11,end:12,task:"Feedback review",     recur:"none"},
    {id:6,clientId:2,day:0,start:15,end:16,task:"Check-in standup",    recur:"weekdays"},
  ]);
  const [showClientForm,setShowClientForm]=useState(false);
  const [showBlockForm,setShowBlockForm]=useState(false);
  const [showImport,setShowImport]=useState(false);
  const [editClient,setEditClient]=useState(null);
  const [editBlock,setEditBlock]=useState(null);
  const [newClient,setNewClient]=useState(emptyClient);
  const [newBlock,setNewBlock]=useState(emptyBlock);

  // Import state
  const [importStep,setImportStep]=useState("upload"); // upload | map | preview | done
  const [importRaw,setImportRaw]=useState(null);      // {headers, rows}
  const [importMapping,setImportMapping]=useState({name:"",contact:"",rate:"",notes:""});
  const [importPreview,setImportPreview]=useState([]);
  const [importYear,setImportYear]=useState(CURRENT_YEAR);
  const [importDupMode,setImportDupMode]=useState("skip"); // skip | replace | add
  const [importResult,setImportResult]=useState(null);
  const [dragOverDrop,setDragOverDrop]=useState(false);
  const fileInputRef=useRef(null);

  // Bulk edit state
  const [showBulkEdit,setShowBulkEdit]=useState(false);
  const [selectedIds,setSelectedIds]=useState(new Set());
  const [bulkChanges,setBulkChanges]=useState({color:"",year:"",rate:"",category:""});
  const [selectAll,setSelectAll]=useState(false);

  // Drag state (calendar)
  const [categoryFilter,setCategoryFilter]=useState("");
  const [clientNotes,setClientNotes]=useState({});
  const [newNoteText,setNewNoteText]=useState({});
  const [expandedNotes,setExpandedNotes]=useState(new Set());
  const noteNextId=useRef(5000);
  const [clientNotes,setClientNotes]=useState({}); // {clientId: [{id, text, date, year}]}
  const [newNoteText,setNewNoteText]=useState({}); // {clientId: string}
  const [expandedNotes,setExpandedNotes]=useState(new Set()); // set of clientIds with notes open
  const noteNextId=useRef(5000);
  const [dragging,setDragging]=useState(null);
  const [dragOver,setDragOver]=useState(null);
  const [ghostPos,setGhostPos]=useState({x:0,y:0});

  const nextId=useRef(200);

  const getClient=id=>clients.find(c=>c.id===id);
  const filteredClients=useMemo(()=>clients.filter(c=>c.year===selectedYear&&(!categoryFilter||c.category===categoryFilter)),[clients,selectedYear,categoryFilter]);
  const filteredClientIds=useMemo(()=>new Set(filteredClients.map(c=>c.id)),[filteredClients]);
  const expanded=useMemo(()=>expandBlocks(blocks),[blocks]);
  const filteredExpanded=useMemo(()=>expanded.filter(b=>filteredClientIds.has(b.clientId)),[expanded,filteredClientIds]);
  const totalHours=useMemo(()=>filteredExpanded.reduce((s,b)=>s+(b.end-b.start),0),[filteredExpanded]);
  const totalRevenue=useMemo(()=>filteredExpanded.reduce((s,b)=>{
    const c=getClient(b.clientId);return s+(c?(b.end-b.start)*c.rate:0);
  },0),[filteredExpanded,clients]);
  const clientHours=id=>filteredExpanded.filter(b=>b.clientId===id).reduce((s,b)=>s+(b.end-b.start),0);

  function saveClient(){
    if(!newClient.name.trim()) return;
    const data={...newClient,rate:Number(newClient.rate)||0,year:Number(newClient.year)||CURRENT_YEAR,estHours:newClient.estHours?Number(newClient.estHours):""};
    if(editClient) setClients(cs=>cs.map(c=>c.id===editClient?{...c,...data}:c));
    else setClients(cs=>[...cs,{...data,id:nextId.current++}]);
    setShowClientForm(false);setEditClient(null);
    setNewClient({...emptyClient,year:selectedYear});
  }
  function deleteClient(id){ setClients(cs=>cs.filter(c=>c.id!==id)); setBlocks(bs=>bs.filter(b=>b.clientId!==id)); }
  function saveBlock(){
    if(!newBlock.clientId||!newBlock.task.trim()) return;
    const b={...newBlock,clientId:Number(newBlock.clientId),start:Number(newBlock.start),end:Number(newBlock.end),day:Number(newBlock.day)};
    if(b.end<=b.start) return;
    if(editBlock) setBlocks(bs=>bs.map(bl=>bl.id===editBlock?{...bl,...b}:bl));
    else setBlocks(bs=>[...bs,{...b,id:nextId.current++}]);
    setShowBlockForm(false);setEditBlock(null);setNewBlock(emptyBlock);
  }
  function openEditBlock(block){
    setNewBlock({clientId:block.clientId,day:block.day,start:block.start,end:block.end,task:block.task,recur:block.recur||"none"});
    setEditBlock(block.id);setShowBlockForm(true);
  }
  function openEditClient(client){
    setNewClient({name:client.name,color:client.color,rate:client.rate,contact:client.contact,notes:client.notes,year:client.year||CURRENT_YEAR,category:client.category||"Appletree",estHours:client.estHours||""});
    setEditClient(client.id);setShowClientForm(true);
  }

  // ── CSV Import Logic ──
  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      const parsed = parseCSV(text);
      if (parsed.rows.length === 0) return;
      setImportRaw(parsed);
      // Auto-detect column mapping
      const autoMap = (keys) => {
        for (const k of keys) {
          const match = parsed.headers.find(h => h.includes(k));
          if (match) return parsed.headers.indexOf(match).toString();
        }
        return "";
      };
      const headerNames = parsed.headers;
      const findHeader = (...keys) => {
        for (const k of keys) {
          const i = headerNames.findIndex(h => h.includes(k));
          if (i >= 0) return String(i);
        }
        return "";
      };
      setImportMapping({
        name:    findHeader("name","client","company","business","firm"),
        contact: findHeader("email","contact","mail","phone"),
        rate:    findHeader("rate","hourly","price","fee","cost"),
        notes:   findHeader("note","description","project","detail","memo"),
      });
      setImportStep("map");
    };
    reader.readAsText(file);
  }

  function buildPreview() {
    if (!importRaw) return;
    const preview = importRaw.rows.slice(0,10).map((row, i) => {
      const get = idx => idx !== "" ? (importRaw.rows[i][importRaw.headers[Number(idx)]] || "") : "";
      const rateRaw = get(importMapping.rate);
      return {
        name: get(importMapping.name) || `Client ${i+1}`,
        contact: get(importMapping.contact),
        rate: parseFloat(rateRaw.replace(/[^0-9.]/g,"")) || 0,
        notes: get(importMapping.notes),
        color: COLORS[i % COLORS.length],
        year: importYear,
      };
    });
    setImportPreview(preview);
    setImportStep("preview");
  }

  function confirmImport() {
    const allRows = importRaw.rows.map((row, i) => {
      const get = idx => idx !== "" ? (row[importRaw.headers[Number(idx)]] || "") : "";
      const rateRaw = get(importMapping.rate);
      return {
        name: get(importMapping.name) || `Client ${i+1}`,
        contact: get(importMapping.contact),
        rate: parseFloat(rateRaw.replace(/[^0-9.]/g,"")) || 0,
        notes: get(importMapping.notes),
        color: COLORS[i % COLORS.length],
        year: importYear,
      };
    });

    let added = 0, skipped = 0, replaced = 0;
    setClients(prev => {
      let updated = [...prev];
      for (const incoming of allRows) {
        if (!incoming.name.trim()) continue;
        const existing = updated.findIndex(c => c.name.toLowerCase() === incoming.name.toLowerCase() && c.year === importYear);
        if (existing >= 0) {
          if (importDupMode === "skip") { skipped++; continue; }
          if (importDupMode === "replace") { updated[existing] = {...updated[existing], ...incoming}; replaced++; continue; }
        }
        updated.push({...incoming, id: nextId.current++});
        added++;
      }
      return updated;
    });
    setImportResult({ added, skipped, replaced, total: allRows.length });
    setImportStep("done");
  }

  function resetImport() {
    setImportStep("upload");
    setImportRaw(null);
    setImportMapping({name:"",contact:"",rate:"",notes:""});
    setImportPreview([]);
    setImportResult(null);
    setDragOverDrop(false);
  }

  function closeImport() { resetImport(); setShowImport(false); }

  // ── Calendar drag handlers ──
  const handleDragStart = useCallback((e, client) => {
    setDragging({clientId:client.id, name:client.name, color:client.color});
    e.dataTransfer.effectAllowed = "copy";
    const ghost = document.createElement("div");
    ghost.style.cssText = "position:fixed;top:-9999px;";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(()=>document.body.removeChild(ghost), 0);
  }, []);
  const handleDragEnd = useCallback(() => { setDragging(null); setDragOver(null); }, []);

  const CELL_H = 52;

  // ── Bulk Edit ──
  function toggleSelect(id){
    setSelectedIds(prev=>{
      const next=new Set(prev);
      if(next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll(){
    if(selectAll){ setSelectedIds(new Set()); setSelectAll(false); }
    else { setSelectedIds(new Set(filteredClients.map(c=>c.id))); setSelectAll(true); }
  }
  function applyBulkEdit(){
    setClients(cs=>cs.map(c=>{
      if(!selectedIds.has(c.id)) return c;
      return {
        ...c,
        ...(bulkChanges.color?{color:bulkChanges.color}:{}),
        ...(bulkChanges.year!==''?{year:Number(bulkChanges.year)}:{}),
        ...(bulkChanges.rate!==''?{rate:Number(bulkChanges.rate)}:{}),
        ...(bulkChanges.category?{category:bulkChanges.category}:{}),
      };
    }));
    setShowBulkEdit(false);
    setSelectedIds(new Set());
    setBulkChanges({color:"",year:"",rate:"",category:""});
  }

  // ── Client Notes ──
  function toggleNotes(clientId){
    setExpandedNotes(prev=>{
      const next=new Set(prev);
      next.has(clientId)?next.delete(clientId):next.add(clientId);
      return next;
    });
  }
  function addNote(clientId){
    const text=(newNoteText[clientId]||"").trim();
    if(!text) return;
    const now=new Date();
    const dateStr=now.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
    const note={id:noteNextId.current++,text,date:dateStr,year:selectedYear,clientId};
    setClientNotes(prev=>({...prev,[clientId]:[note,...(prev[clientId]||[])]}));
    setNewNoteText(prev=>({...prev,[clientId]:""}));
  }
  function deleteNote(clientId,noteId){
    setClientNotes(prev=>({...prev,[clientId]:(prev[clientId]||[]).filter(n=>n.id!==noteId)}));
  }
  function getClientNotes(clientId){
    return (clientNotes[clientId]||[]).filter(n=>n.year===selectedYear);
  }

  // ── Client Notes ──
  function toggleNotes(clientId){
    setExpandedNotes(prev=>{const n=new Set(prev);n.has(clientId)?n.delete(clientId):n.add(clientId);return n;});
  }
  function addNote(clientId){
    const text=(newNoteText[clientId]||"").trim();
    if(!text) return;
    const now=new Date();
    const dateStr=now.toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
    const note={id:noteNextId.current++,text,date:dateStr,year:selectedYear,clientId};
    setClientNotes(prev=>({...prev,[clientId]:[note,...(prev[clientId]||[])]}));
    setNewNoteText(prev=>({...prev,[clientId]:""}));
  }
  function deleteNote(clientId,noteId){
    setClientNotes(prev=>({...prev,[clientId]:(prev[clientId]||[]).filter(n=>n.id!==noteId)}));
  }
  function getClientNotes(clientId){
    return(clientNotes[clientId]||[]).filter(n=>n.year===selectedYear);
  }

  // ── Download sample CSV ──
  function downloadSample() {
    const csv = `name,email,rate,notes\nJohn Smith,john@example.com,125,Website project\nSarah Lee,sarah@co.com,175,Marketing campaign\nTech Solutions,admin@tech.com,200,App development`;
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = "sample-clients.csv";
    a.click();
  }

  return(
    <div style={{fontFamily:"'DM Sans','Segoe UI',sans-serif",background:"#f7f7fc",height:"100vh",color:"#1a1a2e",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:#f0f0f8}
        ::-webkit-scrollbar-thumb{background:#c0c0d8;border-radius:3px}
        .btn{cursor:pointer;border:none;transition:all .15s;font-family:inherit}
        .btn:hover{filter:brightness(1.12)}
        .block-card:hover .del-btn{opacity:1!important}
        input,select,textarea{font-family:inherit;background:#f8f8ff;border:1px solid #d8d8ee;color:#1a1a2e;padding:8px 12px;border-radius:8px;width:100%;outline:none;font-size:14px}
        input:focus,select:focus,textarea:focus{border-color:#7c6af7}
        select option{background:#ffffff}
        .tab{cursor:pointer;padding:7px 18px;border-radius:8px;font-weight:500;font-size:13px;transition:all .15s;border:none;font-family:inherit}
        .hour-row:hover{background:rgba(124,106,247,0.04)}
        .recur-chip{display:inline-flex;align-items:center;gap:3px;padding:1px 6px;border-radius:20px;font-size:9px;font-weight:700;letter-spacing:.05em;background:rgba(167,139,250,0.15);color:#a78bfa;border:1px solid rgba(167,139,250,0.2)}
        .year-btn{cursor:pointer;border:none;font-family:inherit;padding:4px 11px;border-radius:6px;font-size:12px;font-weight:600;transition:all .15s}
        .year-btn:hover{filter:brightness(1.15)}
        .client-drag{cursor:grab;transition:all .15s;user-select:none}
        .client-drag:active{cursor:grabbing}
        .client-drag:hover{transform:translateX(3px)}
        .ghost-block{position:fixed;pointer-events:none;z-index:9999;border-radius:8px;padding:6px 10px;font-size:12px;font-weight:600;backdrop-filter:blur(4px);border:1.5px solid rgba(255,255,255,0.2);box-shadow:0 8px 32px rgba(0,0,0,0.5)}
        .drop-zone{border:2px dashed #c8c8e8;border-radius:12px;padding:32px 20px;text-align:center;cursor:pointer;transition:all .2s}
        .drop-zone:hover,.drop-zone.over{border-color:#7c6af7;background:rgba(124,106,247,0.06)}
        .col-select{background:#f8f8ff;border:1px solid #d8d8ee;color:#1a1a2e;padding:6px 10px;border-radius:7px;font-family:inherit;font-size:13px;cursor:pointer;outline:none}
        .col-select:focus{border-color:#7c6af7}
        .step-dot{width:8px;height:8px;border-radius:50%;transition:all .2s}
        .import-table{width:100%;border-collapse:collapse;font-size:12px}
        .import-table th{color:#555;font-weight:600;text-align:left;padding:6px 8px;border-bottom:1px solid #1e1e2e;font-size:10px;text-transform:uppercase;letter-spacing:.05em}
        .import-table td{padding:6px 8px;border-bottom:1px solid #141420;color:#ccc;white-space:nowrap;overflow:hidden;max-width:120px;text-overflow:ellipsis}
        .import-table tr:last-child td{border-bottom:none}
      `}</style>

      {/* Ghost */}
      {dragging && <>
        <div className="ghost-block" style={{left:ghostPos.x+14,top:ghostPos.y-14,background:`${dragging.color}dd`,color:"#fff",opacity:.95}}>
          ✦ {dragging.name}
        </div>
        <div style={{position:"fixed",inset:0,zIndex:9998,cursor:"grabbing"}}
          onMouseMove={e=>setGhostPos({x:e.clientX,y:e.clientY})}
          onMouseUp={()=>{setDragging(null);setDragOver(null);}}/>
      </>}

      {/* Top Bar */}
      <div style={{background:"#ffffff",borderBottom:"1px solid #e0e0ee",padding:"0 20px",display:"flex",alignItems:"center",gap:14,height:56,flexShrink:0}}>
        <span style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:900,background:"linear-gradient(135deg,#a78bfa,#f472b6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",letterSpacing:"-0.5px"}}>
          Chronos
        </span>
        <span style={{color:"#2e2e42",fontSize:18}}>|</span>
        <div style={{display:"flex",gap:3}}>
          {[["planner","📅 Planner"],["clients","👥 Clients"]].map(([v,l])=>(
            <button key={v} className="tab btn" onClick={()=>setView(v)}
              style={{background:view===v?"#1e1e30":"transparent",color:view===v?"#a78bfa":"#666"}}>{l}</button>
          ))}
        </div>
        {view==="planner"&&(
          <div style={{display:"flex",gap:2,background:"#f0f0f8",borderRadius:8,padding:3,border:"1px solid #e0e0ee"}}>
            {[["week","Week"],["workweek","Work Wk"],["month","Month"]].map(([pv,pl])=>(
              <button key={pv} className="btn" onClick={()=>setPlannerView(pv)}
                style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:600,
                  background:plannerView===pv?"#7c6af7":"transparent",
                  color:plannerView===pv?"#fff":"#555",border:"none"}}>
                {pl}
              </button>
            ))}
          </div>
        )}
        {view==="planner"&&plannerView!=="month"&&(
          <div style={{display:"flex",alignItems:"center",gap:4,background:"#f0f0f8",borderRadius:8,padding:"3px 6px",border:"1px solid #e0e0ee"}}>
            <button className="btn" onClick={()=>setWeekOffset(w=>w-1)} style={{background:"transparent",color:"#777",padding:"2px 7px",fontSize:14}}>‹</button>
            <span style={{fontSize:11,fontWeight:600,color:"#888",minWidth:90,textAlign:"center"}}>{(()=>{const d=getWeekDates(weekOffset);return d[0].toLocaleDateString("en-US",{month:"short",day:"numeric"})+" – "+d[6].toLocaleDateString("en-US",{month:"short",day:"numeric"});})()}</span>
            <button className="btn" onClick={()=>setWeekOffset(w=>w+1)} style={{background:"transparent",color:"#777",padding:"2px 7px",fontSize:14}}>›</button>
            {weekOffset!==0&&<button className="btn" onClick={()=>setWeekOffset(0)} style={{background:"transparent",color:"#7c6af7",fontSize:10,fontWeight:700,padding:"2px 6px"}}>Today</button>}
          </div>
        )}
        {view==="planner"&&plannerView==="month"&&(
          <div style={{display:"flex",alignItems:"center",gap:4,background:"#f0f0f8",borderRadius:8,padding:"3px 6px",border:"1px solid #e0e0ee"}}>
            <button className="btn" onClick={()=>setMonthOffset(m=>m-1)} style={{background:"transparent",color:"#777",padding:"2px 7px",fontSize:14}}>‹</button>
            <span style={{fontSize:11,fontWeight:600,color:"#888",minWidth:100,textAlign:"center"}}>{(()=>{const d=new Date();d.setMonth(d.getMonth()+monthOffset);return MONTH_NAMES[d.getMonth()]+" "+d.getFullYear();})()}</span>
            <button className="btn" onClick={()=>setMonthOffset(m=>m+1)} style={{background:"transparent",color:"#777",padding:"2px 7px",fontSize:14}}>›</button>
            {monthOffset!==0&&<button className="btn" onClick={()=>setMonthOffset(0)} style={{background:"transparent",color:"#7c6af7",fontSize:10,fontWeight:700,padding:"2px 6px"}}>Today</button>}
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:4,background:"#f0f0f8",borderRadius:8,padding:"4px 6px",border:"1px solid #e0e0ee"}}>
          <button className="year-btn btn" onClick={()=>setSelectedYear(y=>y-1)} style={{background:"transparent",color:"#777",padding:"2px 7px"}}>‹</button>
          <span style={{fontSize:13,fontWeight:700,color:"#7c6af7",minWidth:36,textAlign:"center"}}>{selectedYear}</span>
          <button className="year-btn btn" onClick={()=>setSelectedYear(y=>y+1)} style={{background:"transparent",color:"#777",padding:"2px 7px"}}>›</button>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:10,alignItems:"center"}}>
          <div style={{display:"flex",gap:12,padding:"5px 14px",background:"#f0f0f8",borderRadius:10,fontSize:12,border:"1px solid #e0e0ee"}}>
            <span><span style={{color:"#777"}}>Hrs/wk </span><strong style={{color:"#a78bfa"}}>{totalHours}h</strong></span>
            <span style={{color:"#2a2a3a"}}>|</span>
            <span><span style={{color:"#777"}}>Revenue </span><strong style={{color:"#4ade80"}}>${totalRevenue.toLocaleString()}</strong></span>
          </div>
          <button className="btn" onClick={()=>{setShowImport(true);resetImport();}}
            style={{background:"#f0f0f8",color:"#a78bfa",padding:"7px 14px",borderRadius:8,fontWeight:600,fontSize:12,border:"1px solid #d8d8ee"}}>
            ⬆ Import
          </button>
          <button className="btn" onClick={()=>{setShowBlockForm(true);setEditBlock(null);setNewBlock({...emptyBlock,clientId:filteredClients[0]?.id||clients[0]?.id||""});}}
            style={{background:"linear-gradient(135deg,#7c6af7,#a78bfa)",color:"#fff",padding:"7px 14px",borderRadius:8,fontWeight:600,fontSize:12}}>
            + Block
          </button>
        </div>
      </div>

      <div style={{flex:1,overflow:"hidden",display:"flex"}}>

        {/* ── PLANNER ── */}
        {view==="planner"&&(<>
          <div style={{width:150,flexShrink:0,background:"#f4f4fb",borderRight:"1px solid #1a1a26",display:"flex",flexDirection:"column",overflow:"hidden"}}>
            <div style={{padding:"12px 12px 8px",fontSize:10,fontWeight:700,color:"#888",textTransform:"uppercase",letterSpacing:".08em",borderBottom:"1px solid #1a1a26"}}>
              Drag to Calendar
            </div>
            <div style={{flex:1,overflowY:"auto",padding:"8px"}}>
              {filteredClients.length===0&&<div style={{fontSize:11,color:"#555",textAlign:"center",padding:"20px 8px",lineHeight:1.5}}>No clients for {selectedYear}</div>}
              {filteredClients.map(c=>(
                <div key={c.id} className="client-drag" draggable
                  onDragStart={e=>handleDragStart(e,c)} onDragEnd={handleDragEnd}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:8,marginBottom:6,
                    background:`${c.color}14`,border:`1px solid ${c.color}30`,opacity:dragging?.clientId===c.id?.4:1}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:600,color:c.color,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</div>
                    <div style={{fontSize:10,color:"#888"}}>${c.rate}/h{c.estHours?` · ${c.estHours}h est`:""}</div>
                  </div>
                  <span style={{fontSize:14,color:"#555",flexShrink:0}}>⠿</span>
                </div>
              ))}
              {filteredClients.length>0&&<div style={{fontSize:10,color:"#555",textAlign:"center",padding:"8px 4px"}}>Drag onto any time slot</div>}
            </div>
          </div>
          <div style={{flex:1,overflow:"auto",padding:"16px 20px"}}>
            {/* ── MONTH VIEW ── */}
            {plannerView==="month"&&(()=>{
              const now=new Date();now.setMonth(now.getMonth()+monthOffset);
              const yr=now.getFullYear(),mo=now.getMonth();
              const dates=getMonthDates(yr,mo);
              const today=new Date();
              return(
                <div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2,marginBottom:2}}>
                    {DAYS.map(d=>(
                      <div key={d} style={{textAlign:"center",fontSize:11,fontWeight:700,color:"#777",padding:"6px 0",background:"#ffffff",borderRadius:6,letterSpacing:".06em"}}>{d}</div>
                    ))}
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:2}}>
                    {dates.map((date,i)=>{
                      const isToday=date.toDateString()===today.toDateString();
                      const isCurrentMonth=date.getMonth()===mo;
                      const dow=date.getDay();
                      const dayIdx=dow===0?6:dow-1; // 0=Mon
                      const dayBlocks=filteredExpanded.filter(b=>b._day===dayIdx);
                      return(
                        <div key={i} style={{minHeight:90,background:isToday?"rgba(124,106,247,0.08)":"#13131c",borderRadius:8,padding:"6px 5px",
                          border:isToday?"1px solid rgba(124,106,247,0.3)":"1px solid #191926",
                          opacity:isCurrentMonth?1:0.35,cursor:"pointer"}}
                          onClick={()=>{setShowBlockForm(true);setEditBlock(null);setNewBlock({...emptyBlock,clientId:filteredClients[0]?.id||"",day:dayIdx,start:9,end:10});}}>
                          <div style={{fontSize:11,fontWeight:isToday?800:500,color:isToday?"#a78bfa":"#555",marginBottom:4,textAlign:"right"}}>{date.getDate()}</div>
                          {dayBlocks.slice(0,3).map((b,bi)=>{
                            const c=getClient(b.clientId);if(!c)return null;
                            return(
                              <div key={bi} onClick={(e)=>{e.stopPropagation();openEditBlock(b);}}
                                style={{background:`${c.color}22`,borderLeft:`2px solid ${c.color}`,borderRadius:3,padding:"2px 5px",marginBottom:2,fontSize:10,fontWeight:600,color:c.color,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",cursor:"pointer"}}>
                                {fmt(b.start)} {b.task||c.name}
                              </div>
                            );
                          })}
                          {dayBlocks.length>3&&<div style={{fontSize:9,color:"#777",textAlign:"center"}}>+{dayBlocks.length-3} more</div>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* ── WEEK / WORK WEEK VIEW ── */}
            {(plannerView==="week"||plannerView==="workweek")&&(()=>{
              const weekDates=getWeekDates(weekOffset);
              const visibleDays=plannerView==="workweek"?weekDates.slice(0,5):weekDates;
              const visibleDayIndices=visibleDays.map(d=>{const dow=d.getDay();return dow===0?6:dow-1;});
              const today=new Date();
              return(
              <div>
            <div style={{display:"grid",gridTemplateColumns:`52px repeat(${visibleDays.length},1fr)`,gap:2,marginBottom:2,position:"sticky",top:0,zIndex:10,background:"#f7f7fc",paddingBottom:4}}>
              <div/>
              {visibleDays.map((date,i)=>{
                const isToday=date.toDateString()===today.toDateString();
                return(
                  <div key={i} style={{textAlign:"center",fontSize:12,fontWeight:600,padding:"7px 0",borderRadius:6,letterSpacing:".05em",
                    background:isToday?"rgba(124,106,247,0.15)":"#13131c",
                    color:isToday?"#a78bfa":"#555",
                    border:isToday?"1px solid rgba(124,106,247,0.3)":"none"}}>
                    {DAYS[visibleDayIndices[i]]} <span style={{fontSize:10,fontWeight:400,opacity:.7}}>{date.getDate()}</span>
                  </div>
                );
              })}
            </div>
            <div style={{display:"grid",gridTemplateColumns:`52px repeat(${visibleDays.length},1fr)`,gap:2}}>
              <div style={{display:"flex",flexDirection:"column"}}>
                {HOURS.map(h=>(
                  <div key={h} style={{height:CELL_H,display:"flex",alignItems:"flex-start",justifyContent:"flex-end",paddingRight:7,paddingTop:3}}>
                    <span style={{fontSize:10,color:"#aaaacc",whiteSpace:"nowrap"}}>{fmt(h)}</span>
                  </div>
                ))}
              </div>
              {visibleDays.map((date,colIdx)=>{
                const di=visibleDayIndices[colIdx];
                return(
                <div key={colIdx} style={{position:"relative",background:"#ffffff",borderRadius:8,overflow:"hidden",
                  outline:dragOver?.day===di?"2px dashed rgba(167,139,250,0.5)":"none",outlineOffset:"-2px",transition:"outline .1s"}}
                  onDragOver={e=>{if(!dragging)return;e.preventDefault();const r=e.currentTarget.getBoundingClientRect();setDragOver({day:di,hour:Math.max(0,Math.min(23,Math.floor((e.clientY-r.top)/CELL_H)))});}}
                  onDragLeave={e=>{if(!e.currentTarget.contains(e.relatedTarget))setDragOver(null);}}
                  onDrop={e=>{e.preventDefault();if(!dragging)return;const r=e.currentTarget.getBoundingClientRect();const h=Math.max(0,Math.min(22,Math.floor((e.clientY-r.top)/CELL_H)));setNewBlock({clientId:dragging.clientId,day:di,start:h,end:h+1,task:"",recur:"none"});setEditBlock(null);setShowBlockForm(true);setDragging(null);setDragOver(null);}}>
                  {dragOver?.day===di&&dragging&&(
                    <div style={{position:"absolute",top:dragOver.hour*CELL_H,left:0,right:0,height:CELL_H,background:`${dragging.color}20`,borderTop:`2px dashed ${dragging.color}`,zIndex:3,pointerEvents:"none",display:"flex",alignItems:"center",paddingLeft:8}}>
                      <span style={{fontSize:10,color:dragging.color,fontWeight:700}}>{dragging.name} · {fmt(dragOver.hour)}</span>
                    </div>
                  )}
                  {HOURS.map(h=>(
                    <div key={h} className="hour-row" style={{height:CELL_H,borderBottom:"1px solid #191926",cursor:dragging?"copy":"crosshair"}}
                      onClick={()=>{if(dragging)return;setShowBlockForm(true);setEditBlock(null);setNewBlock({...emptyBlock,clientId:filteredClients[0]?.id||"",day:di,start:h,end:Math.min(h+1,23)});}}/>
                  ))}
                  {filteredExpanded.filter(b=>b._day===di).map((b,i)=>{
                    const c=getClient(b.clientId); if(!c)return null;
                    const isRecur=b.recur&&b.recur!=="none";
                    return(
                      <div key={`${b.id}-${di}-${i}`} className="block-card"
                        style={{position:"absolute",top:b.start*CELL_H,left:2,right:2,height:(b.end-b.start)*CELL_H-2,
                          background:isRecur?`${c.color}22`:`${c.color}15`,borderLeft:`3px solid ${c.color}`,
                          borderTop:isRecur?`1px dashed ${c.color}44`:"none",borderRadius:6,padding:"4px 8px",cursor:"pointer",overflow:"hidden",zIndex:2}}
                        onClick={(e)=>{e.stopPropagation();openEditBlock(b);}}>
                        <div style={{fontSize:10,fontWeight:700,color:c.color,marginBottom:1,textTransform:"uppercase",letterSpacing:".04em"}}>{c.name}</div>
                        <div style={{fontSize:12,color:"#888",lineHeight:1.3}}>{b.task}</div>
                        <div style={{display:"flex",alignItems:"center",gap:5,marginTop:3,flexWrap:"wrap"}}>
                          <span style={{fontSize:10,color:"#777"}}>{fmt(b.start)}–{fmt(b.end)}</span>
                          {isRecur&&<span className="recur-chip">🔁 {recurShort(b.recur)}</span>}
                        </div>
                        <button className="btn del-btn" onClick={(e)=>{e.stopPropagation();setBlocks(bs=>bs.filter(bl=>bl.id!==b.id));}}
                          style={{position:"absolute",top:3,right:3,background:"#ff4444cc",color:"#fff",width:15,height:15,borderRadius:3,fontSize:9,opacity:0,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
                      </div>
                    );
                  })}
                </div>
                );
              })}
            </div>
          </div>
          );})()}
          </div>
        </>)}

        {/* ── CLIENTS ── */}
        {view==="clients"&&(
          <div style={{flex:1,overflow:"auto",padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <h2 style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700}}>Clients</h2>
                <span style={{fontSize:12,color:"#777",background:"#f0f0f8",padding:"3px 10px",borderRadius:20,border:"1px solid #2a2a3a"}}>
                  {selectedYear} · {filteredClients.length} client{filteredClients.length!==1?"s":""}
                </span>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button className="btn" onClick={()=>{setShowBulkEdit(true);setSelectedIds(new Set());setBulkChanges({color:"",year:"",rate:""}); }}
                  style={{background:"#f0f0f8",color:"#f472b6",padding:"7px 14px",borderRadius:8,fontWeight:600,fontSize:12,border:"1px solid #d8d8ee"}}>
                  ✦ Bulk Edit
                </button>
                <button className="btn" onClick={()=>{setShowImport(true);resetImport();}}
                  style={{background:"#f0f0f8",color:"#a78bfa",padding:"7px 14px",borderRadius:8,fontWeight:600,fontSize:12,border:"1px solid #d8d8ee"}}>
                  ⬆ Import CSV
                </button>
                <button className="btn" onClick={()=>{setShowClientForm(true);setEditClient(null);setNewClient({...emptyClient,year:selectedYear});}}
                  style={{background:"linear-gradient(135deg,#7c6af7,#a78bfa)",color:"#fff",padding:"7px 16px",borderRadius:8,fontWeight:600,fontSize:12}}>
                  + New Client
                </button>
              </div>
            </div>
            <div style={{display:"flex",gap:6,marginBottom:18,overflowX:"auto",paddingBottom:2}}>
              {YEARS.map(y=>{
                const count=clients.filter(c=>c.year===y).length;
                const active=y===selectedYear;
                return(
                  <button key={y} className="year-btn btn" onClick={()=>setSelectedYear(y)}
                    style={{background:active?"#7c6af7":"#ffffff",color:active?"#ffffff":"#888",border:active?"1px solid #7c6af755":"1px solid #1e1e2e",whiteSpace:"nowrap",padding:"5px 14px"}}>
                    {y}{count>0&&<span style={{marginLeft:5,background:active?"#7c6af755":"#1e1e2e",borderRadius:10,padding:"1px 6px",fontSize:10,color:active?"#c4b5fd":"#555"}}>{count}</span>}
                  </button>
                );
              })}
            </div>
            {/* Category filter */}
            <div style={{display:"flex",gap:8,marginBottom:18,alignItems:"center"}}>
              <span style={{fontSize:11,color:"#777",fontWeight:600,textTransform:"uppercase",letterSpacing:".06em"}}>Filter:</span>
              {["All",...CATEGORIES].map(cat=>{
                const active=cat===(categoryFilter||"All");
                const style=cat!=="All"?CATEGORY_STYLES[cat]:null;
                return(
                  <button key={cat} className="btn" onClick={()=>setCategoryFilter(cat==="All"?"":cat)}
                    style={{padding:"4px 14px",borderRadius:20,fontSize:12,fontWeight:600,
                      background:active?(style?style.bg:"rgba(167,139,250,0.15)"):"transparent",
                      color:active?(style?style.color:"#a78bfa"):"#555",
                      border:active?`1px solid ${style?style.border:"rgba(167,139,250,0.3)"}`:"1px solid #2e2e42",
                      transition:"all .15s"}}>
                    {cat}
                  </button>
                );
              })}
            </div>

            {filteredClients.length===0&&(
              <div style={{textAlign:"center",color:"#555",padding:"48px 20px",background:"#ffffff",borderRadius:12,border:"1px dashed #1e1e2e"}}>
                <div style={{fontSize:28,marginBottom:10}}>📁</div>
                <div style={{fontSize:14,fontWeight:600,color:"#777",marginBottom:4}}>No clients for {selectedYear}</div>
                <div style={{fontSize:12,color:"#555"}}>Add manually or import a CSV.</div>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
              {filteredClients.map(c=>{
                const hrs=clientHours(c.id);const rev=hrs*c.rate;const pct=totalHours>0?Math.round(hrs/totalHours*100):0;
                const recurTasks=blocks.filter(b=>b.clientId===c.id&&b.recur&&b.recur!=="none");
                return(
                  <div key={c.id} onClick={()=>showBulkEdit&&toggleSelect(c.id)}
                    style={{background:"#ffffff",borderRadius:12,padding:18,border:selectedIds.has(c.id)?`2px solid #f472b6`:`1px solid ${c.color}28`,position:"relative",overflow:"hidden",cursor:showBulkEdit?"pointer":"default",transition:"border .15s"}}>
                    {showBulkEdit&&(
                      <div style={{position:"absolute",top:10,right:10,zIndex:5,width:18,height:18,borderRadius:5,
                        background:selectedIds.has(c.id)?"#f472b6":"#1e1e2e",border:selectedIds.has(c.id)?"none":"1px solid #3e3e52",
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:"#fff",fontWeight:800}}>
                        {selectedIds.has(c.id)&&"✓"}
                      </div>
                    )}
                    <div style={{position:"absolute",top:0,right:0,width:70,height:70,background:`radial-gradient(circle at top right,${c.color}18,transparent)`,pointerEvents:"none"}}/>
                    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                      <div style={{width:34,height:34,borderRadius:9,background:c.color,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:15,color:"rgba(0,0,0,0.7)",flexShrink:0}}>{c.name[0]}</div>
                      <div style={{flex:1}}><div style={{fontWeight:600,fontSize:15}}>{c.name}</div><div style={{fontSize:11,color:"#777"}}>{c.contact}</div></div>
                      <div style={{display:"flex",gap:4,flexShrink:0,alignItems:"center"}}>
                        {c.category&&(()=>{const s=CATEGORY_STYLES[c.category]||CATEGORY_STYLES["Other"];return(
                          <span style={{fontSize:10,color:s.color,background:s.bg,padding:"2px 8px",borderRadius:6,border:`1px solid ${s.border}`,fontWeight:700}}>{c.category}</span>
                        );})()}
                        <span style={{fontSize:11,color:"#a78bfa",background:"rgba(167,139,250,0.1)",padding:"2px 8px",borderRadius:6,border:"1px solid rgba(167,139,250,0.2)",fontWeight:600}}>{c.year}</span>
                      </div>
                    </div>
                    <div style={{background:"#f0f0f8",borderRadius:4,height:3,marginBottom:10,overflow:"hidden"}}>
                      <div style={{height:"100%",background:`linear-gradient(90deg,${c.color},${c.color}88)`,width:`${pct}%`,borderRadius:4}}/>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6,marginBottom:12,textAlign:"center"}}>
                      {[["Sched",`${hrs}h`],["Est",c.estHours?`${c.estHours}h`:"—"],["Rate",`$${c.rate}/h`],["Rev",`$${rev.toLocaleString()}`]].map(([l,v])=>{
                        const isOver=l==="Sched"&&c.estHours&&hrs>Number(c.estHours);
                        const isUnder=l==="Sched"&&c.estHours&&hrs<Number(c.estHours);
                        return(
                        <div key={l} style={{background:"#f0f0f8",borderRadius:7,padding:"7px 4px",position:"relative"}}>
                          <div style={{fontSize:10,color:"#888",marginBottom:1,textTransform:"uppercase",letterSpacing:".04em"}}>{l}</div>
                          <div style={{fontSize:13,fontWeight:700,color:isOver?"#f87171":isUnder?"#facc15":c.color}}>{v}</div>
                          {isOver&&<div style={{fontSize:8,color:"#f87171",marginTop:1}}>over</div>}
                          {isUnder&&<div style={{fontSize:8,color:"#facc15",marginTop:1}}>under</div>}
                        </div>
                        );
                      })}
                    </div>
                    {recurTasks.length>0&&(
                      <div style={{marginBottom:12}}>
                        <div style={{fontSize:10,color:"#888",textTransform:"uppercase",letterSpacing:".05em",marginBottom:5,fontWeight:600}}>🔁 Recurring Tasks</div>
                        {recurTasks.map(t=>(
                          <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#f0f0f8",borderRadius:6,padding:"5px 9px",marginBottom:3}}>
                            <span style={{fontSize:12,color:"#777"}}>{t.task}</span>
                            <span className="recur-chip">{recurShort(t.recur)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {c.notes&&<div style={{fontSize:12,color:"#777",fontStyle:"italic",marginBottom:10,lineHeight:1.4}}>"{c.notes}"</div>}

                    {/* Running Notes */}
                    <div style={{marginBottom:10}}>
                      <button className="btn" onClick={()=>toggleNotes(c.id)}
                        style={{width:"100%",background:"#f4f4fb",border:"1px solid #e0e0ee",borderRadius:8,
                          padding:"7px 12px",fontSize:12,fontWeight:600,color:"#7c6af7",
                          display:"flex",alignItems:"center",justifyContent:"space-between",
                          marginBottom:expandedNotes.has(c.id)?8:0}}>
                        <span>
                          📝 Notes {selectedYear}
                          {getClientNotes(c.id).length>0&&(
                            <span style={{marginLeft:6,background:"#7c6af7",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:10}}>
                              {getClientNotes(c.id).length}
                            </span>
                          )}
                        </span>
                        <span style={{fontSize:10,color:"#aaa"}}>{expandedNotes.has(c.id)?"▲":"▼"}</span>
                      </button>
                      {expandedNotes.has(c.id)&&(
                        <div style={{background:"#f8f8ff",borderRadius:8,border:"1px solid #e8e8f2",overflow:"hidden"}}>
                          <div style={{display:"flex",gap:6,padding:"8px 10px",borderBottom:"1px solid #eeeef5"}}>
                            <input
                              value={newNoteText[c.id]||""}
                              onChange={e=>setNewNoteText(prev=>({...prev,[c.id]:e.target.value}))}
                              onKeyDown={e=>e.key==="Enter"&&addNote(c.id)}
                              placeholder="Add a note… press Enter to save"
                              style={{flex:1,fontSize:12,padding:"6px 10px",borderRadius:6,
                                border:"1px solid #e0e0ee",background:"#fff",color:"#333",outline:"none"}}
                            />
                            <button className="btn" onClick={()=>addNote(c.id)}
                              style={{background:"#7c6af7",color:"#fff",borderRadius:6,padding:"6px 14px",fontSize:13,fontWeight:700,flexShrink:0}}>+</button>
                          </div>
                          {getClientNotes(c.id).length===0?(
                            <div style={{padding:"14px",fontSize:12,color:"#bbb",textAlign:"center"}}>No notes for {selectedYear} yet</div>
                          ):(
                            getClientNotes(c.id).map(note=>(
                              <div key={note.id} style={{display:"flex",gap:8,padding:"8px 10px",borderBottom:"1px solid #eeeef5",alignItems:"flex-start"}}>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:10,color:"#bbb",marginBottom:2}}>{note.date}</div>
                                  <div style={{fontSize:12,color:"#444",lineHeight:1.5}}>{note.text}</div>
                                </div>
                                <button className="btn" onClick={()=>deleteNote(c.id,note.id)}
                                  style={{background:"transparent",color:"#ddd",fontSize:16,padding:"0 4px",flexShrink:0,lineHeight:1}}>×</button>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{display:"flex",gap:7}}>
                      <button className="btn" onClick={()=>openEditClient(c)} style={{flex:1,background:"#eeeef8",color:"#a78bfa",padding:"6px 0",borderRadius:6,fontSize:12,fontWeight:500}}>Edit</button>
                      <button className="btn" onClick={()=>deleteClient(c.id)} style={{flex:1,background:"#fff0f0",color:"#f87171",padding:"6px 0",borderRadius:6,fontSize:12,fontWeight:500}}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ══ BULK EDIT MODAL ══ */}
      {showBulkEdit&&(
        <div style={{position:"fixed",inset:0,background:"rgba(100,100,150,.3)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}}
          onClick={()=>setShowBulkEdit(false)}>
          <div style={{background:"#ffffff",border:"1px solid #d8d8ee",borderRadius:18,padding:28,width:"100%",maxWidth:480,boxShadow:"0 32px 100px rgba(0,0,0,.7)"}}
            onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div>
                <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:19,fontWeight:700,marginBottom:2}}>Bulk Edit Clients</h3>
                <p style={{fontSize:12,color:"#777"}}>Select clients below then apply changes to all at once</p>
              </div>
              <button className="btn" onClick={()=>setShowBulkEdit(false)} style={{background:"#e8e8f2",color:"#888",width:28,height:28,borderRadius:7,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            </div>

            {/* Select all bar */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"#f0f0f8",borderRadius:9,padding:"10px 14px",marginBottom:20,marginTop:16}}>
              <span style={{fontSize:13,color:"#888"}}>
                <strong style={{color:"#f472b6"}}>{selectedIds.size}</strong> of {filteredClients.length} selected
              </span>
              <button className="btn" onClick={toggleSelectAll}
                style={{background:"transparent",color:"#a78bfa",fontSize:12,fontWeight:600,padding:"4px 10px",borderRadius:6,border:"1px solid #d8d8ee"}}>
                {selectedIds.size===filteredClients.length?"Deselect All":"Select All"}
              </button>
            </div>

            {/* Client checkboxes */}
            <div style={{maxHeight:180,overflowY:"auto",marginBottom:20,display:"flex",flexDirection:"column",gap:6}}>
              {filteredClients.map(c=>(
                <div key={c.id} onClick={()=>toggleSelect(c.id)}
                  style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",borderRadius:8,cursor:"pointer",
                    background:selectedIds.has(c.id)?"rgba(244,114,182,0.08)":"#1a1a26",
                    border:selectedIds.has(c.id)?"1px solid rgba(244,114,182,0.3)":"1px solid transparent",
                    transition:"all .12s"}}>
                  <div style={{width:16,height:16,borderRadius:4,flexShrink:0,
                    background:selectedIds.has(c.id)?"#f472b6":"#2e2e42",
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#fff",fontWeight:800}}>
                    {selectedIds.has(c.id)&&"✓"}
                  </div>
                  <div style={{width:10,height:10,borderRadius:"50%",background:c.color,flexShrink:0}}/>
                  <span style={{fontSize:13,fontWeight:500,flex:1,color:"#555"}}>{c.name}</span>
                  <span style={{fontSize:11,color:"#777"}}>${c.rate}/h · {c.year}</span>
                </div>
              ))}
            </div>

            {/* Changes to apply */}
            <div style={{background:"#f0f0f8",borderRadius:10,padding:16,marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:700,color:"#777",textTransform:"uppercase",letterSpacing:".06em",marginBottom:14}}>Apply Changes To Selected</div>

              <div style={{marginBottom:12}}>
                <label style={lbl}>New Color</label>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {COLORS.map(col=>(
                    <div key={col} onClick={()=>setBulkChanges(b=>({...b,color:bulkChanges.color===col?"":col}))}
                      style={{width:26,height:26,borderRadius:7,background:col,cursor:"pointer",
                        border:bulkChanges.color===col?"3px solid #fff":"3px solid transparent",transition:"border .1s"}}/>
                  ))}
                  {bulkChanges.color&&<button className="btn" onClick={()=>setBulkChanges(b=>({...b,color:""}))}
                    style={{fontSize:11,color:"#777",background:"transparent",padding:"0 6px"}}>✕ clear</button>}
                </div>
              </div>

              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
                <div>
                  <label style={lbl}>Move to Year</label>
                  <select value={bulkChanges.year} onChange={e=>setBulkChanges(b=>({...b,year:e.target.value}))}
                    style={{background:"#ffffff",border:"1px solid #d8d8ee",color:"#1a1a2e",padding:"8px 12px",borderRadius:8,width:"100%",fontFamily:"inherit",fontSize:13}}>
                    <option value="">— no change —</option>
                    {YEARS.map(y=><option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label style={lbl}>New Hourly Rate ($)</label>
                  <input type="number" placeholder="no change" value={bulkChanges.rate}
                    onChange={e=>setBulkChanges(b=>({...b,rate:e.target.value}))}
                    style={{background:"#ffffff",border:"1px solid #d8d8ee",color:"#1a1a2e",padding:"8px 12px",borderRadius:8,width:"100%",fontFamily:"inherit",fontSize:13}}/>
                </div>
              </div>
              <div>
                <label style={lbl}>Set Category</label>
                <div style={{display:"flex",gap:8}}>
                  <button className="btn" onClick={()=>setBulkChanges(b=>({...b,category:""}))}
                    style={{flex:1,padding:"8px 0",borderRadius:8,fontSize:11,fontWeight:600,
                      background:bulkChanges.category===""?"#e8e8f2":"#f0f0f8",
                      color:bulkChanges.category===""?"#666":"#aaa",
                      border:bulkChanges.category===""?"1px solid #c0c0d8":"1px solid #e8e8f2"}}>
                    No change
                  </button>
                  {CATEGORIES.map(cat=>{
                    const s=CATEGORY_STYLES[cat];
                    const active=bulkChanges.category===cat;
                    return(
                      <button key={cat} className="btn" onClick={()=>setBulkChanges(b=>({...b,category:cat}))}
                        style={{flex:1,padding:"8px 0",borderRadius:8,fontSize:12,fontWeight:600,
                          background:active?s.bg:"#f0f0f8",
                          color:active?s.color:"#aaa",
                          border:active?"1px solid "+s.border:"1px solid #e8e8f2",
                          transition:"all .12s"}}>
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{display:"flex",gap:8}}>
              <button className="btn" onClick={()=>setShowBulkEdit(false)}
                style={{flex:1,background:"#f0f0f8",color:"#888",padding:"11px 0",borderRadius:9,fontWeight:600,border:"1px solid #d8d8ee"}}>
                Cancel
              </button>
              <button className="btn" onClick={applyBulkEdit} disabled={selectedIds.size===0}
                style={{flex:2,background:selectedIds.size>0?"linear-gradient(135deg,#f472b6,#a78bfa)":"#1e1e2e",
                  color:selectedIds.size>0?"#fff":"#444",padding:"11px 0",borderRadius:9,fontWeight:600,transition:"all .2s"}}>
                Apply to {selectedIds.size} Client{selectedIds.size!==1?"s":""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ CSV IMPORT MODAL ══ */}
      {showImport&&(
        <div style={{position:"fixed",inset:0,background:"rgba(100,100,150,.3)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}}
          onClick={closeImport}>
          <div style={{background:"#ffffff",border:"1px solid #d8d8ee",borderRadius:18,padding:28,width:"100%",maxWidth:560,maxHeight:"88vh",overflow:"auto",boxShadow:"0 32px 100px rgba(0,0,0,.7)"}}
            onClick={e=>e.stopPropagation()}>

            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div>
                <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:19,fontWeight:700,marginBottom:2}}>Import Clients</h3>
                <p style={{fontSize:12,color:"#777"}}>Upload a CSV file to bulk-add clients</p>
              </div>
              <button className="btn" onClick={closeImport} style={{background:"#e8e8f2",color:"#888",width:28,height:28,borderRadius:7,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
            </div>

            {/* Step indicators */}
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:24}}>
              {[["upload","Upload"],["map","Map Fields"],["preview","Preview"],["done","Done"]].map(([s,label],i)=>{
                const steps=["upload","map","preview","done"];
                const cur=steps.indexOf(importStep);
                const idx=steps.indexOf(s);
                const active=s===importStep;
                const past=idx<cur;
                return(
                  <div key={s} style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:5}}>
                      <div className="step-dot" style={{background:active?"#a78bfa":past?"#4ade80":"#2e2e42",width:past?8:active?10:8,height:past?8:active?10:8}}/>
                      <span style={{fontSize:11,color:active?"#c4b5fd":past?"#4ade80":"#444",fontWeight:active?700:400}}>{label}</span>
                    </div>
                    {i<3&&<span style={{color:"#2e2e42",fontSize:12}}>›</span>}
                  </div>
                );
              })}
            </div>

            {/* ── STEP: UPLOAD ── */}
            {importStep==="upload"&&(
              <div>
                <div className={`drop-zone${dragOverDrop?" over":""}`}
                  onDragOver={e=>{e.preventDefault();setDragOverDrop(true);}}
                  onDragLeave={()=>setDragOverDrop(false)}
                  onDrop={e=>{e.preventDefault();setDragOverDrop(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);}}
                  onClick={()=>fileInputRef.current?.click()}>
                  <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
                  <div style={{fontSize:32,marginBottom:10}}>📂</div>
                  <div style={{fontWeight:600,fontSize:15,marginBottom:4}}>Drop your CSV here</div>
                  <div style={{fontSize:12,color:"#777",marginBottom:16}}>or click to browse files</div>
                  <div style={{fontSize:11,color:"#888",background:"#f0f0f8",borderRadius:8,padding:"8px 14px",display:"inline-block"}}>
                    Accepts: name, email, rate, notes — any column order
                  </div>
                </div>
                <div style={{marginTop:16,display:"flex",justifyContent:"center"}}>
                  <button className="btn" onClick={downloadSample}
                    style={{background:"transparent",color:"#777",fontSize:12,padding:"6px 14px",borderRadius:6,border:"1px solid #d8d8ee"}}>
                    ⬇ Download sample CSV
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP: MAP ── */}
            {importStep==="map"&&importRaw&&(
              <div>
                <p style={{fontSize:13,color:"#888",marginBottom:16}}>
                  Found <strong style={{color:"#c4b5fd"}}>{importRaw.rows.length} rows</strong> with columns: <em style={{color:"#888"}}>{importRaw.headers.join(", ")}</em>
                </p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:20}}>
                  {[
                    {field:"name",label:"Client Name *",required:true},
                    {field:"contact",label:"Email / Contact"},
                    {field:"rate",label:"Hourly Rate ($)"},
                    {field:"notes",label:"Notes"},
                  ].map(({field,label})=>(
                    <div key={field}>
                      <label style={lbl}>{label}</label>
                      <select className="col-select" style={{width:"100%"}} value={importMapping[field]}
                        onChange={e=>setImportMapping({...importMapping,[field]:e.target.value})}>
                        <option value="">— skip —</option>
                        {importRaw.headers.map((h,i)=>(
                          <option key={i} value={String(i)}>{h} (e.g. "{importRaw.rows[0]?.[h]||""}")</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div style={{marginBottom:20}}>
                  <label style={lbl}>Assign to Year</label>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {YEARS.slice(3,8).map(y=>(
                      <button key={y} className="btn year-btn" onClick={()=>setImportYear(y)}
                        style={{background:importYear===y?"linear-gradient(135deg,#7c6af733,#a78bfa22)":"#1a1a26",
                          color:importYear===y?"#c4b5fd":"#555",border:importYear===y?"1px solid #7c6af766":"1px solid #1e1e2e",fontWeight:importYear===y?700:400}}>
                        {y}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{marginBottom:20}}>
                  <label style={lbl}>If client name already exists</label>
                  <div style={{display:"flex",gap:8}}>
                    {[["skip","Skip"],["replace","Replace"],["add","Add anyway"]].map(([v,l])=>(
                      <button key={v} className="btn" onClick={()=>setImportDupMode(v)}
                        style={{flex:1,padding:"7px 0",borderRadius:8,fontSize:12,fontWeight:500,
                          background:importDupMode===v?"#211d35":"#1a1a26",
                          color:importDupMode===v?"#c4b5fd":"#666",
                          border:importDupMode===v?"1px solid #7c6af755":"1px solid #1e1e2e"}}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{display:"flex",gap:8}}>
                  <button className="btn" onClick={()=>setImportStep("upload")}
                    style={{flex:1,background:"#f0f0f8",color:"#888",padding:"10px 0",borderRadius:8,fontWeight:600,border:"1px solid #d8d8ee"}}>
                    ← Back
                  </button>
                  <button className="btn" onClick={buildPreview} disabled={!importMapping.name}
                    style={{flex:2,background:importMapping.name?"linear-gradient(135deg,#7c6af7,#a78bfa)":"#1e1e2e",color:importMapping.name?"#fff":"#444",padding:"10px 0",borderRadius:8,fontWeight:600}}>
                    Preview Import →
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP: PREVIEW ── */}
            {importStep==="preview"&&(
              <div>
                <p style={{fontSize:13,color:"#888",marginBottom:14}}>
                  Showing first <strong style={{color:"#c4b5fd"}}>{importPreview.length}</strong> of <strong style={{color:"#c4b5fd"}}>{importRaw.rows.length}</strong> clients to be imported into <strong style={{color:"#c4b5fd"}}>{importYear}</strong>:
                </p>
                <div style={{background:"#f0f0f8",borderRadius:10,overflow:"hidden",marginBottom:20}}>
                  <table className="import-table">
                    <thead>
                      <tr>
                        <th>Color</th><th>Name</th><th>Contact</th><th>Rate</th><th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.map((c,i)=>(
                        <tr key={i}>
                          <td><div style={{width:14,height:14,borderRadius:"50%",background:c.color}}/></td>
                          <td style={{fontWeight:600,color:"#1a1a2e"}}>{c.name}</td>
                          <td style={{color:"#888"}}>{c.contact||"—"}</td>
                          <td style={{color:"#4ade80"}}>{c.rate?`$${c.rate}/h`:"—"}</td>
                          <td style={{color:"#888"}}>{c.notes||"—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importRaw.rows.length>10&&<p style={{fontSize:11,color:"#888",marginBottom:16,textAlign:"center"}}>+ {importRaw.rows.length-10} more rows not shown</p>}
                <div style={{display:"flex",gap:8}}>
                  <button className="btn" onClick={()=>setImportStep("map")}
                    style={{flex:1,background:"#f0f0f8",color:"#888",padding:"10px 0",borderRadius:8,fontWeight:600,border:"1px solid #d8d8ee"}}>← Back</button>
                  <button className="btn" onClick={confirmImport}
                    style={{flex:2,background:"linear-gradient(135deg,#7c6af7,#a78bfa)",color:"#fff",padding:"10px 0",borderRadius:8,fontWeight:600}}>
                    ✓ Import {importRaw.rows.length} Clients
                  </button>
                </div>
              </div>
            )}

            {/* ── STEP: DONE ── */}
            {importStep==="done"&&importResult&&(
              <div style={{textAlign:"center",padding:"10px 0 20px"}}>
                <div style={{fontSize:48,marginBottom:16}}>✅</div>
                <h4 style={{fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,marginBottom:8}}>Import Complete</h4>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,margin:"20px 0"}}>
                  {[["Added",importResult.added,"#4ade80"],["Replaced",importResult.replaced,"#a78bfa"],["Skipped",importResult.skipped,"#666"]].map(([l,v,col])=>(
                    <div key={l} style={{background:"#f0f0f8",borderRadius:10,padding:"14px 8px"}}>
                      <div style={{fontSize:24,fontWeight:800,color:col,marginBottom:4}}>{v}</div>
                      <div style={{fontSize:11,color:"#777",textTransform:"uppercase",letterSpacing:".05em"}}>{l}</div>
                    </div>
                  ))}
                </div>
                <p style={{fontSize:13,color:"#888",marginBottom:20}}>
                  {importResult.added} new client{importResult.added!==1?"s":""} added to <strong style={{color:"#c4b5fd"}}>{importYear}</strong>
                </p>
                <div style={{display:"flex",gap:8}}>
                  <button className="btn" onClick={resetImport}
                    style={{flex:1,background:"#f0f0f8",color:"#a78bfa",padding:"10px 0",borderRadius:8,fontWeight:600,border:"1px solid #d8d8ee"}}>
                    Import Another
                  </button>
                  <button className="btn" onClick={()=>{closeImport();setSelectedYear(importYear);setView("clients");}}
                    style={{flex:2,background:"linear-gradient(135deg,#7c6af7,#a78bfa)",color:"#fff",padding:"10px 0",borderRadius:8,fontWeight:600}}>
                    View Clients →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BLOCK MODAL ── */}
      {showBlockForm&&(
        <Modal title={editBlock?"Edit Block":"New Time Block"} onClose={()=>{setShowBlockForm(false);setEditBlock(null);}}>
          <label style={lbl}>Client</label>
          <select value={newBlock.clientId} onChange={e=>setNewBlock({...newBlock,clientId:e.target.value})} style={{marginBottom:12}}>
            <option value="">Select client...</option>
            {filteredClients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            {filteredClients.length===0&&clients.map(c=><option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}
          </select>
          <label style={lbl}>Task</label>
          <input value={newBlock.task} onChange={e=>setNewBlock({...newBlock,task:e.target.value})} placeholder="What are you working on?" style={{marginBottom:12}} autoFocus/>
          <label style={lbl}>Day</label>
          <select value={newBlock.day} onChange={e=>setNewBlock({...newBlock,day:e.target.value})} style={{marginBottom:12}}>
            {DAYS.map((d,i)=><option key={d} value={i}>{d}</option>)}
          </select>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><label style={lbl}>Start</label>
              <select value={newBlock.start} onChange={e=>setNewBlock({...newBlock,start:Number(e.target.value)})}>
                {HOURS.map(h=><option key={h} value={h}>{fmt(h)}</option>)}
              </select></div>
            <div><label style={lbl}>End</label>
              <select value={newBlock.end} onChange={e=>setNewBlock({...newBlock,end:Number(e.target.value)})}>
                {HOURS.filter(h=>h>0).map(h=><option key={h} value={h}>{fmt(h)}</option>)}
              </select></div>
          </div>
          <label style={lbl}>Recurrence</label>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:16}}>
            {RECUR_OPTIONS.map(o=>(
              <button key={o.value} className="btn" onClick={()=>setNewBlock({...newBlock,recur:o.value})}
                style={{padding:"8px 10px",borderRadius:8,fontSize:12,fontWeight:500,textAlign:"left",
                  background:newBlock.recur===o.value?"#211d35":"#1a1a26",color:newBlock.recur===o.value?"#c4b5fd":"#666",
                  border:newBlock.recur===o.value?"1px solid #7c6af755":"1px solid #1e1e2e",transition:"all .12s"}}>
                {o.value!=="none"&&<span style={{marginRight:4}}>🔁</span>}{o.label}
              </button>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            {editBlock&&<button className="btn" onClick={()=>{setBlocks(bs=>bs.filter(b=>b.id!==editBlock));setShowBlockForm(false);setEditBlock(null);}}
              style={{flex:1,background:"#fff0f0",color:"#f87171",padding:"10px 0",borderRadius:8,fontWeight:600}}>Delete</button>}
            <button className="btn" onClick={saveBlock}
              style={{flex:2,background:"linear-gradient(135deg,#7c6af7,#a78bfa)",color:"#fff",padding:"10px 0",borderRadius:8,fontWeight:600}}>
              {editBlock?"Save Changes":"Add Block"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── CLIENT MODAL ── */}
      {showClientForm&&(
        <Modal title={editClient?"Edit Client":"New Client"} onClose={()=>{setShowClientForm(false);setEditClient(null);}}>
          <label style={lbl}>Name</label>
          <input value={newClient.name} onChange={e=>setNewClient({...newClient,name:e.target.value})} placeholder="Client name" style={{marginBottom:12}}/>
          <label style={lbl}>Email / Contact</label>
          <input value={newClient.contact} onChange={e=>setNewClient({...newClient,contact:e.target.value})} placeholder="email@example.com" style={{marginBottom:12}}/>
          <label style={lbl}>Hourly Rate ($)</label>
          <input value={newClient.rate} onChange={e=>setNewClient({...newClient,rate:e.target.value})} placeholder="0" type="number" style={{marginBottom:12}}/>
          <label style={lbl}>Estimated Hours / Week</label>
          <input value={newClient.estHours||""} onChange={e=>setNewClient({...newClient,estHours:e.target.value})} placeholder="e.g. 10" type="number" style={{marginBottom:12}}/>
          <label style={lbl}>Year</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
            {YEARS.map(y=>(
              <button key={y} className="btn year-btn" onClick={()=>setNewClient({...newClient,year:y})}
                style={{background:newClient.year===y?"#7c6af7":"#ffffff",
                  color:newClient.year===y?"#ffffff":"#888",border:newClient.year===y?"1px solid #7c6af766":"1px solid #1e1e2e",fontWeight:newClient.year===y?700:400}}>
                {y}
              </button>
            ))}
          </div>
          <label style={lbl}>Notes</label>
          <textarea value={newClient.notes} onChange={e=>setNewClient({...newClient,notes:e.target.value})} placeholder="Project notes..." rows={2} style={{marginBottom:12,resize:"vertical"}}/>
          <label style={lbl}>Color</label>
          <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
            {COLORS.map(c=>(
              <div key={c} onClick={()=>setNewClient({...newClient,color:c})}
                style={{width:26,height:26,borderRadius:7,background:c,cursor:"pointer",border:newClient.color===c?"3px solid #fff":"3px solid transparent",transition:"border .1s"}}/>
            ))}
          </div>
          <label style={lbl}>Category</label>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            {CATEGORIES.map(cat=>{
              const s=CATEGORY_STYLES[cat];
              const active=newClient.category===cat;
              return(
                <button key={cat} className="btn" onClick={()=>setNewClient({...newClient,category:cat})}
                  style={{flex:1,padding:"8px 0",borderRadius:8,fontSize:12,fontWeight:600,
                    background:active?s.bg:"#1a1a26",
                    color:active?s.color:"#888",
                    border:active?`1px solid ${s.border}`:"1px solid #1e1e2e",
                    transition:"all .12s"}}>
                  {cat}
                </button>
              );
            })}
          </div>
          <button className="btn" onClick={saveClient}
            style={{width:"100%",background:"linear-gradient(135deg,#7c6af7,#a78bfa)",color:"#fff",padding:"10px 0",borderRadius:8,fontWeight:600}}>
            {editClient?"Save Changes":"Add Client"}
          </button>
        </Modal>
      )}
    </div>
  );
}

const lbl={display:"block",fontSize:11,color:"#777",marginBottom:4,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em"};

function Modal({title,children,onClose}){
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(100,100,150,.3)",zIndex:9000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(6px)"}}
      onClick={onClose}>
      <div style={{background:"#ffffff",border:"1px solid #d8d8ee",borderRadius:16,padding:22,width:"100%",maxWidth:420,maxHeight:"90vh",overflow:"auto",boxShadow:"0 24px 80px rgba(0,0,0,.6)"}}
        onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h3 style={{fontFamily:"'Playfair Display',serif",fontSize:17,fontWeight:700}}>{title}</h3>
          <button className="btn" onClick={onClose} style={{background:"#e8e8f2",color:"#888",width:26,height:26,borderRadius:6,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
