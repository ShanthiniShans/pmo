// ============================================================
// VIEWS.JS — All View Renderers
// ============================================================
import { APP_STATE, DateHelpers, JiraService, DB } from './data.js';
import { openModal } from './modals.js';

// ─── HELPERS ──────────────────────────────────────────────
function normaliseStatus(raw) {
  if (!raw) return '';
  const map = {
    'on-track':'On Track','on_track':'On Track','ontrack':'On Track',
    'at-risk':'At Risk','at_risk':'At Risk','atrisk':'At Risk',
    'overdue':'Overdue','completed':'Completed','in-progress':'In Progress',
    'in_progress':'In Progress','yet-to-start':'Yet to Start','on-hold':'On Hold',
    'open':'Open','resolved':'Resolved','mitigated':'Mitigated',
    'high':'High','medium':'Medium','low':'Low','critical':'Critical',
    'green':'On Track','amber':'At Risk','red':'Overdue','gray':'Yet to Start'
  };
  return map[raw.toLowerCase()] || raw;
}

function ragBadge(rawStatus) {
  const status = normaliseStatus(rawStatus);
  const map = {
    'On Track':'badge-blue','At Risk':'badge-amber','Overdue':'badge-red',
    'Completed':'badge-green','Yet to Start':'badge-gray','On Hold':'badge-gray',
    'In Progress':'badge-teal','Open':'badge-red','Resolved':'badge-green',
    'Mitigated':'badge-amber','High':'badge-red','Medium':'badge-amber',
    'Low':'badge-green','Critical':'badge-red'
  };
  return `<span class="badge ${map[status]||'badge-gray'}">${status||'—'}</span>`;
}

function progressBar(pct) {
  const c = pct >= 70 ? 'green' : pct >= 40 ? 'amber' : 'red';
  return `<div class="progress-bar"><div class="progress-fill ${c}" style="width:${Math.min(pct||0,100)}%"></div></div>`;
}

function avatar(name) {
  return (name||'').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
}

function teamName(id) {
  const m = APP_STATE.teamMembers.find(t => t.id === id);
  return m ? m.name : id ? id : '—';
}

function teamArr(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return val.split(',').map(s=>s.trim()).filter(Boolean);
}

function filterProjects(projects) {
  const f = APP_STATE.filters;
  return projects.filter(p => {
    if (f.track && p.track !== f.track) return false;
    if (f.startDate && p.endDate && p.endDate < f.startDate) return false;
    if (f.endDate && p.startDate && p.startDate > f.endDate) return false;
    return true;
  });
}

function filterBar() {
  const f = APP_STATE.filters;
  const tracks = APP_STATE.settings.trackNames || ['Track 1','Track 2','Track 3'];
  return `<div class="filter-bar no-print">
    <div class="filter-group">
      <label>Year</label>
      <select onchange="window._filterChange('year',this.value)">
        ${[2025,2026,2027].map(y=>`<option value="${y}" ${f.year==y?'selected':''}>${y}</option>`).join('')}
      </select>
    </div>
    <div class="filter-group">
      <label>Quarter</label>
      <select onchange="window._filterChange('quarter',this.value)">
        <option value="">All</option>
        ${['Q1','Q2','Q3','Q4'].map(q=>`<option value="${q}" ${f.quarter===q?'selected':''}>${q}</option>`).join('')}
      </select>
    </div>
    <div class="filter-group">
      <label>Track</label>
      <select onchange="window._filterChange('track',this.value)">
        <option value="">All Tracks</option>
        ${tracks.map(t=>`<option value="${t}" ${f.track===t?'selected':''}>${t}</option>`).join('')}
      </select>
    </div>
    <div class="filter-group">
      <label>From</label>
      <input type="date" value="${f.startDate||''}" onchange="window._filterChange('startDate',this.value)"/>
    </div>
    <div class="filter-group">
      <label>To</label>
      <input type="date" value="${f.endDate||''}" onchange="window._filterChange('endDate',this.value)"/>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="window._filterReset()">Reset</button>
  </div>`;
}

const TRACK_COLORS = {'Track 1':'#1B2B5E','Track 2':'#00A896','Track 3':'#E8452C'};

// ─── DASHBOARD ────────────────────────────────────────────
export function renderDashboard() {
  const projects = APP_STATE.projects.map(p=>({...p, name:p.name||p.title||'Unnamed', status:normaliseStatus(p.status||p.rag||'')}));
  const milestones = APP_STATE.milestones.map(m=>({...m, title:m.title||m.name||'Unnamed', status:normaliseStatus(m.status||m.rag||'')}));
  const total = projects.length;
  const inProg = projects.filter(p=>p.status==='In Progress').length;
  const atRisk = milestones.filter(m=>m.status==='At Risk').length;
  const overdue = milestones.filter(m=>m.status==='Overdue').length;
  const completed = projects.filter(p=>p.status==='Completed').length;
  const upcoming = milestones.filter(m=>m.status!=='Completed').sort((a,b)=>a.dueDate>b.dueDate?1:-1).slice(0,5);
  const openRisks = APP_STATE.risks.filter(r=>normaliseStatus(r.status)==='Open');
  const openEsc = APP_STATE.escalations.filter(e=>normaliseStatus(e.status||'Open')==='Open');

  return `
  <div class="view-header">
    <h1 class="view-title">Dashboard <span class="view-subtitle">Engineering PMO Overview</span></h1>
    <span class="top-timestamp">${DateHelpers.fmt(DateHelpers.today())}</span>
  </div>
  <div class="stat-row">
    <div class="stat-card navy"><div class="stat-num">${total}</div><div class="stat-label">Total Projects</div></div>
    <div class="stat-card blue"><div class="stat-num">${inProg}</div><div class="stat-label">In Progress</div></div>
    <div class="stat-card green"><div class="stat-num">${completed}</div><div class="stat-label">Completed</div></div>
    <div class="stat-card amber"><div class="stat-num">${atRisk}</div><div class="stat-label">At Risk</div></div>
    <div class="stat-card red"><div class="stat-num">${overdue}</div><div class="stat-label">Overdue</div></div>
    <div class="stat-card red"><div class="stat-num">${openRisks.length}</div><div class="stat-label">Open Risks</div></div>
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><div class="card-title">Project RAG Status</div></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
        ${projects.map(p=>`
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;cursor:pointer" onclick="nav('project-detail',{id:'${p.id}'})" onmouseover="this.style.boxShadow='0 2px 8px rgba(27,43,94,.1)'" onmouseout="this.style.boxShadow=''">
          <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:4px">${p.name}</div>
          <div style="font-size:11px;color:var(--text-lt);margin-bottom:8px">${p.track||'—'} · ${p.phase||'—'}</div>
          ${progressBar(p.progress||0)}
          <div class="flex-center gap-8 mt-4">${ragBadge(p.status)}<span class="small text-lt">${p.progress||0}%</span></div>
        </div>`).join('')}
      </div>
    </div>
    <div>
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">Upcoming Milestones</div></div>
        ${upcoming.length ? upcoming.map(m=>`
        <div class="flex-center gap-8" style="padding:8px 0;border-bottom:1px solid var(--border)">
          <div class="flex-1">
            <div style="font-size:13px;font-weight:600;color:var(--navy)">${m.title}</div>
            <div class="small text-lt">${m.projectName||'—'}</div>
          </div>
          <div style="text-align:right">${ragBadge(m.status)}<div class="small text-lt mt-4">${DateHelpers.fmt(m.dueDate)}</div></div>
        </div>`).join('') : '<div class="empty-state"><div class="empty-state-text">No upcoming milestones</div></div>'}
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Open Escalations</div></div>
        ${openEsc.length ? openEsc.map(e=>`
        <div class="esc-card">
          <div class="esc-title">${e.title||'Unnamed'}</div>
          <div class="esc-meta">${e.project||'—'} · ${DateHelpers.fmt(e.date)} · ${ragBadge(e.priority)}</div>
        </div>`).join('') : '<div class="empty-state"><div class="empty-state-text">No open escalations</div></div>'}
      </div>
    </div>
  </div>
  <div class="card">
    <div class="card-header"><div class="card-title">Track Health Overview</div></div>
    <div class="grid-3">
      ${['Track 1','Track 2','Track 3'].map((track,i)=>{
        const tProj = projects.filter(p=>p.track===track);
        const tMs = milestones.filter(m=>m.track===track);
        const colors = ['#1B2B5E','#00A896','#E8452C'];
        return `<div class="card" style="border-top:3px solid ${colors[i]};margin-bottom:0">
          <div style="font-size:15px;font-weight:800;color:var(--navy);margin-bottom:4px">${track}</div>
          <div class="small text-lt mb-8">${tProj.length} projects · ${tMs.length} milestones</div>
          ${tProj.map(p=>`<div class="small flex-center gap-8" style="padding:3px 0">${ragBadge(p.status)}<span>${p.name}</span></div>`).join('')}
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ─── TRACKS ───────────────────────────────────────────────
export function renderTracks() {
  const tracks = APP_STATE.tracks;
  const projects = APP_STATE.projects;
  const members = APP_STATE.teamMembers;
  return `
  <div class="view-header">
    <h1 class="view-title">Tracks</h1>
    <button class="btn btn-primary" onclick="openModal('track')">+ Add Track</button>
  </div>
  <div class="track-cards">
    ${tracks.map((t,i)=>{
      const tProj = projects.filter(p=>p.track===t.name);
      const tMem = members.filter(m=>m.track===t.name);
      const clsMap = {'Track 1':'track-1','Track 2':'track-2','Track 3':'track-3'}; const cls = clsMap[t.name] || ['track-1','track-2','track-3'][i] || 'track-1';
      return `<div class="track-card ${cls}">
        <div class="track-header">
          <div>
            <div class="track-name">${t.name}</div>
            <div style="font-size:12px;opacity:.8;margin-top:2px">${t.description||''}</div>
          </div>
          <button class="btn btn-ghost btn-sm" style="color:#fff;border-color:rgba(255,255,255,.4)" onclick="openModal('track','${t.id}')">Edit</button>
        </div>
        <div class="track-body">
          <div class="track-section-label">Projects (${tProj.length})</div>
          <div class="track-projects">
            ${tProj.length ? tProj.map(p=>`
            <div class="track-project-item">
              <span style="flex:1">${p.name}</span>${ragBadge(p.status)}
              <span class="small text-lt">${p.progress||0}%</span>
            </div>`).join('') : '<div class="small text-lt">No projects assigned</div>'}
          </div>
          <hr class="divider"/>
          <div class="track-section-label">Team Members (${tMem.length})</div>
          <div class="team-chips">
            ${tMem.length ? tMem.map(m=>`
            <div class="team-chip">
              <div class="chip-avatar">${avatar(m.name)}</div>
              <div><div style="font-size:12px;font-weight:600">${m.name}</div><div class="chip-role">${m.role}</div></div>
            </div>`).join('') : '<div class="small text-lt">No members assigned</div>'}
          </div>
          <div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="openModal('assignTrackProject','${t.id}','${t.name}')">+ Assign Project</button>
            <button class="btn btn-ghost btn-sm" onclick="openModal('assignTrackMember','${t.id}','${t.name}')">+ Assign Member</button>
          </div>
        </div>
      </div>`;
    }).join('')}
  </div>`;
}

// ─── ROADMAP ──────────────────────────────────────────────
export function renderRoadmap() {
  const f = APP_STATE.filters;
  const year = parseInt(f.year) || 2025;
  const projects = filterProjects(APP_STATE.projects);
  const milestones = APP_STATE.milestones;

  let startMonth = 0, endMonth = 11;
  if (f.quarter === 'Q1') { startMonth = 0; endMonth = 2; }
  else if (f.quarter === 'Q2') { startMonth = 3; endMonth = 5; }
  else if (f.quarter === 'Q3') { startMonth = 6; endMonth = 8; }
  else if (f.quarter === 'Q4') { startMonth = 9; endMonth = 11; }

  const months = [];
  for (let m = startMonth; m <= endMonth; m++) months.push(m);

  const rangeStart = new Date(year, startMonth, 1);
  const rangeEnd = new Date(year, endMonth + 1, 0);
  const totalDays = Math.max(1, (rangeEnd.getTime() - rangeStart.getTime()) / 86400000);

  const STATUS_COLOR = {
    'In Progress':'#1B2B5E','On Track':'#2563EB','At Risk':'#D97706',
    'Overdue':'#DC2626','Completed':'#059669','Yet to Start':'#94A3B8','On Hold':'#6B7280'
  };
  const MS_COLOR = {'Completed':'#059669','Overdue':'#DC2626','At Risk':'#D97706','On Track':'#2563EB'};
  const TC = ['#1B2B5E','#00A896','#E8452C','#7C3AED'];

  function datePct(ds) {
    if (!ds) return null;
    const d = new Date(ds);
    if (isNaN(d.getTime())) return null;
    const c = Math.max(rangeStart.getTime(), Math.min(rangeEnd.getTime(), d.getTime()));
    return +((c - rangeStart.getTime()) / 86400000 / totalDays * 100).toFixed(2);
  }

  function barRange(s, e) {
    if (!s || !e) return null;
    const sd = new Date(s), ed = new Date(e);
    if (isNaN(sd.getTime())||isNaN(ed.getTime())) return null;
    if (ed.getTime() < rangeStart.getTime() || sd.getTime() > rangeEnd.getTime()) return null;
    const cs = Math.max(rangeStart.getTime(), sd.getTime());
    const ce = Math.min(rangeEnd.getTime(), ed.getTime());
    const left = +((cs - rangeStart.getTime()) / 86400000 / totalDays * 100).toFixed(2);
    const width = Math.max(0.5, +((ce - cs) / 86400000 / totalDays * 100).toFixed(2));
    return { left, width };
  }

  const todayPct = datePct(DateHelpers.today());
  const uniqueTracks = [...new Set(projects.map(p => p.track || 'Unassigned'))];
  const gridLines = months.map((_,i) => i===0 ? '' :
    `<div style="position:absolute;top:0;bottom:0;left:${(i/months.length*100).toFixed(2)}%;width:1px;background:#EEF2F8;pointer-events:none;z-index:1"></div>`
  ).join('');
  const todayLine = todayPct !== null
    ? `<div style="position:absolute;top:0;bottom:0;left:${todayPct}%;width:2px;background:#E8452C;opacity:.22;z-index:3;pointer-events:none"></div>`
    : '';

  return `
  ${filterBar()}
  <div class="view-header">
    <h1 class="view-title">Roadmap <span class="view-subtitle">${year}${f.quarter?' · '+f.quarter:' · Full Year'}</span></h1>
  </div>
  <div style="background:#fff;border:1px solid var(--border);border-radius:8px;padding:10px 16px;margin-bottom:16px;display:flex;flex-wrap:wrap;gap:14px;align-items:center;font-size:12px;color:#4A5578">
    ${Object.entries(STATUS_COLOR).map(([s,c])=>`<div style="display:flex;align-items:center;gap:5px"><div style="width:22px;height:9px;border-radius:3px;background:${c}"></div>${s}</div>`).join('')}
    <div style="display:flex;align-items:center;gap:5px"><div style="width:2px;height:14px;background:#E8452C;border-radius:1px"></div>Today</div>
    <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;background:#1B2B5E;transform:rotate(45deg)"></div>Milestone</div>
  </div>
  <div style="background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(27,43,94,.07)">
    <div style="display:grid;grid-template-columns:230px 1fr;background:#F5F6FA;border-bottom:2px solid var(--border)">
      <div style="padding:11px 18px;font-size:11px;font-weight:700;color:#8896B0;text-transform:uppercase;letter-spacing:.6px">Project</div>
      <div style="display:flex;border-left:1px solid var(--border)">
        ${months.map(m=>`<div style="flex:1;padding:11px 0;text-align:center;font-size:11px;font-weight:700;color:#8896B0;text-transform:uppercase;border-left:1px solid #EEF2F8">${DateHelpers.monthName(m)}</div>`).join('')}
      </div>
    </div>
    ${uniqueTracks.length === 0 ? `<div style="padding:48px;text-align:center;color:#8896B0">No projects match current filters.</div>` :
      uniqueTracks.map((track,ti) => {
        const tc = TC[ti % TC.length];
        const tProj = projects.filter(p=>(p.track||'Unassigned')===track);
        return `<div style="display:grid;grid-template-columns:230px 1fr;background:${tc}07;border-bottom:1.5px solid ${tc}22">
          <div style="padding:8px 18px;display:flex;align-items:center;gap:8px">
            <div style="width:3px;height:18px;background:${tc};border-radius:2px;flex-shrink:0"></div>
            <span style="font-size:11px;font-weight:800;color:${tc};text-transform:uppercase;letter-spacing:.8px">${track}</span>
            <span style="font-size:11px;color:${tc}88">(${tProj.length})</span>
          </div>
          <div style="border-left:1px solid var(--border);position:relative;min-height:32px">${gridLines}${todayLine}</div>
        </div>
        ${tProj.map((p,pi) => {
          const bar = barRange(p.startDate, p.endDate);
          const pMs = milestones.filter(m=>m.projectId===p.id);
          const color = STATUS_COLOR[normaliseStatus(p.status)]||'#94A3B8';
          return `<div style="display:grid;grid-template-columns:230px 1fr;border-bottom:1px solid ${pi===tProj.length-1?'var(--border)':'#F4F6FB'};min-height:64px">
            <div style="padding:12px 18px;cursor:pointer;transition:background .12s" onclick="nav('project-detail',{id:'${p.id}'})" onmouseover="this.style.background='#F8FAFF'" onmouseout="this.style.background=''">
              <div style="font-size:13px;font-weight:600;color:#1B2B5E;line-height:1.3;margin-bottom:5px">${p.name}</div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                ${ragBadge(p.status)}
                <span style="font-size:11px;color:#8896B0">${p.progress||0}%</span>
                ${p.devLead?`<span style="font-size:11px;color:#8896B0">· ${teamName(p.devLead)}</span>`:''}
              </div>
            </div>
            <div style="position:relative;border-left:1px solid var(--border);min-height:64px;overflow:visible">
              ${gridLines}${todayLine}
              ${bar?`<div title="${p.name}" style="position:absolute;top:50%;transform:translateY(-50%);left:${bar.left}%;width:${bar.width}%;height:28px;border-radius:5px;background:${color};z-index:4;overflow:hidden;min-width:6px;box-shadow:0 1px 4px rgba(0,0,0,.15)">
                <div style="position:absolute;top:0;left:0;height:100%;width:${p.progress||0}%;background:rgba(255,255,255,.22);border-radius:5px 0 0 5px"></div>
                ${bar.width>5?`<div style="position:absolute;inset:0;display:flex;align-items:center;padding:0 9px;font-size:10px;font-weight:700;color:rgba(255,255,255,.92);white-space:nowrap;overflow:hidden">${p.progress||0}%</div>`:''}
              </div>`:''}
              ${pMs.map(ms=>{
                const mp = datePct(ms.dueDate);
                if (mp===null) return '';
                const mc = MS_COLOR[normaliseStatus(ms.status)]||'#94A3B8';
                return `<div title="${ms.title} · ${ms.status}" style="position:absolute;top:50%;left:${mp}%;transform:translate(-50%,-50%);z-index:6;cursor:default">
                  <div style="width:11px;height:11px;background:${mc};transform:rotate(45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.2)"></div>
                  <div style="position:absolute;top:14px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:9px;font-weight:700;color:${mc};background:#fff;padding:2px 5px;border-radius:3px;border:1px solid ${mc}50;max-width:90px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 3px rgba(0,0,0,.1)">${ms.title}</div>
                </div>`;
              }).join('')}
            </div>
          </div>`;
        }).join('')}`;
      }).join('')}
  </div>
  <div class="card" style="margin-top:16px;padding:0">
    <div style="padding:14px 20px;border-bottom:1px solid var(--border);font-size:14px;font-weight:700;color:#1B2B5E">Timeline Summary</div>
    <div style="overflow-x:auto">
      <table class="data-table">
        <thead><tr><th>Project</th><th>Track</th><th>Status</th><th>Start</th><th>End</th><th>Progress</th><th>Dev Lead</th><th>Milestones</th></tr></thead>
        <tbody>
          ${projects.map(p=>{
            const pMs = milestones.filter(m=>m.projectId===p.id);
            const ov = pMs.filter(m=>normaliseStatus(m.status)==='Overdue').length;
            return `<tr class="clickable" onclick="nav('project-detail',{id:'${p.id}'})">
              <td style="font-weight:600">${p.name}</td>
              <td>${p.track?`<span class="badge badge-navy" style="font-size:10px">${p.track}</span>`:'—'}</td>
              <td>${ragBadge(p.status)}</td>
              <td style="font-size:12px;color:#8896B0">${DateHelpers.fmt(p.startDate)}</td>
              <td style="font-size:12px;color:${DateHelpers.isOverdue(p.endDate)&&normaliseStatus(p.status)!=='Completed'?'#DC2626':'#8896B0'}">${DateHelpers.fmt(p.endDate)}</td>
              <td style="min-width:130px"><div style="display:flex;align-items:center;gap:8px">${progressBar(p.progress||0)}<span style="font-size:11px;color:#8896B0">${p.progress||0}%</span></div></td>
              <td style="font-size:12px">${teamName(p.devLead)}</td>
              <td><span style="font-size:12px">${pMs.length}</span>${ov>0?`<span class="badge badge-red" style="font-size:10px;margin-left:4px">${ov} overdue</span>`:''}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── MILESTONES ───────────────────────────────────────────
export function renderMilestones() {
  const all = APP_STATE.milestones;
  const f = APP_STATE.filters;
  const ms = f.track ? all.filter(m=>m.track===f.track) : all;
  ms.sort((a,b)=>{ if(!a.dueDate) return 1; if(!b.dueDate) return -1; return a.dueDate > b.dueDate ? 1 : -1; }); const overdue = ms.filter(m=>normaliseStatus(m.status)==='Overdue');
  const atRisk    = ms.filter(m=>normaliseStatus(m.status)==='At Risk');
  const onTrack   = ms.filter(m=>['On Track','Yet to Start'].includes(normaliseStatus(m.status)));
  const completed = ms.filter(m=>normaliseStatus(m.status)==='Completed');

  function msCard(m) {
    const status = normaliseStatus(m.status);
    const isComplete = status==='Completed';
    return `<div class="ms-card ${status.toLowerCase().replace(/\s+/g,'-')}">
      <div class="flex-center gap-8" style="margin-bottom:6px">
        <div class="ms-card-title flex-1 ${isComplete?'strikethrough':''}">${m.title}</div>
        ${ragBadge(m.status)}
      </div>
      <div class="ms-card-meta">
        <span>📁 ${m.projectName||'—'}</span>
        <span>📅 ${DateHelpers.fmt(m.dueDate)}</span>
        ${m.track?`<span>🗂 ${m.track}</span>`:''}
      </div>
      ${m.revisedETA?`<div class="small text-amber" style="margin-bottom:6px">⚠️ Revised: ${DateHelpers.fmt(m.revisedETA)}</div>`:''}
      ${m.delayReason?`<div class="small text-lt" style="margin-bottom:6px;font-style:italic">${m.delayReason}</div>`:''}
      ${m.completedDate?`<div class="small text-green" style="margin-bottom:6px">✅ Done: ${DateHelpers.fmt(m.completedDate)}</div>`:''}
      <div class="ms-card-actions">
        ${!isComplete?`<button class="btn btn-teal btn-xs" onclick="markMilestoneComplete('${m.id}')">✓ Complete</button>`:''}
        <button class="btn btn-ghost btn-xs" onclick="openModal('notes','${m.id}','milestone')">📝</button>
        <button class="btn btn-ghost btn-xs" onclick="openModal('milestone','${m.id}')">Edit</button>
        <button class="btn btn-icon danger" onclick="deleteItem('milestones','${m.id}')">🗑</button>
      </div>
    </div>`;
  }

  function section(title, items, color) {
    if (!items.length) return '';
    return `<div class="mb-16">
      <div style="font-size:14px;font-weight:700;color:${color};margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid var(--border)">${title} (${items.length})</div>
      <div class="ms-grid">${items.map(msCard).join('')}</div>
    </div>`;
  }

  return `
  ${filterBar()}
  <div class="view-header">
    <h1 class="view-title">Milestones</h1>
    <button class="btn btn-primary" onclick="openModal('milestone')">+ Add Milestone</button>
  </div>
  ${!ms.length?'<div class="empty-state"><div class="empty-state-icon">🎯</div><div class="empty-state-text">No milestones found</div></div>':''}
  ${section('🔴 Overdue', overdue, 'var(--red)')}
  ${section('🟡 At Risk', atRisk, 'var(--amber)')}
  ${section('🔵 On Track / Yet to Start', onTrack, 'var(--blue)')}
  ${section('✅ Completed', completed, 'var(--green)')}`;
}

// ─── PROJECTS ─────────────────────────────────────────────
export function renderProjects() {
  const projects = filterProjects(APP_STATE.projects);
  return `
  ${filterBar()}
  <div class="view-header">
    <h1 class="view-title">All Projects</h1>
    <button class="btn btn-primary" onclick="openModal('project')">+ New Project</button>
  </div>
  <div class="card" style="padding:0">
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Project</th><th>Track</th><th>Phase</th><th>Status</th><th>Dev Lead</th><th>Start</th><th>End</th><th>Progress</th><th>Jira</th><th>Actions</th></tr></thead>
        <tbody>
          ${projects.length ? projects.map(p=>`
          <tr class="clickable ${normaliseStatus(p.status)==='Completed'?'completed':''}" onclick="nav('project-detail',{id:'${p.id}'})">
            <td><div style="font-weight:700;color:var(--navy)">${p.name||p.title||'Unnamed'}</div><div class="small text-lt">${p.description||''}</div></td>
            <td>${p.track?`<span class="badge badge-navy">${p.track}</span>`:'—'}</td>
            <td>${p.phase||'—'}</td>
            <td>${ragBadge(p.status)}</td>
            <td>${teamName(p.devLead)}</td>
            <td class="small">${DateHelpers.fmt(p.startDate)}</td>
            <td class="small ${DateHelpers.isOverdue(p.endDate)&&normaliseStatus(p.status)!=='Completed'?'text-red':''}">${DateHelpers.fmt(p.endDate)}</td>
            <td style="min-width:110px">${progressBar(p.progress||0)}<div class="small text-lt mt-4">${p.progress||0}%</div></td>
            <td>${p.jiraKey?`<span class="badge badge-blue">${p.jiraKey}</span>`:'—'}</td>
            <td onclick="event.stopPropagation()">
              <button class="btn-icon" onclick="openModal('project','${p.id}')">✏️</button>
              <button class="btn-icon danger" onclick="deleteItem('projects','${p.id}')">🗑</button>
            </td>
          </tr>`).join(''):`<tr><td colspan="10" class="empty-state">No projects found</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── PROJECT DETAIL ───────────────────────────────────────
export async function renderProjectDetail(params) {
  const id = params && params.id;
  const p = APP_STATE.projects.find(x=>x.id===id);
  if (!p) return '<div class="empty-state"><div class="empty-state-text">Project not found.</div></div>';

  const pMs = APP_STATE.milestones.filter(m=>m.projectId===id);
  const pNotes = APP_STATE.notes.filter(n=>n.entityId===id);
  const charter = APP_STATE.charters.find(c=>c.projectId===id);
  const jira = await JiraService.fetch(p.jiraKey);
  const tArr = teamArr(p.team);

  return `
  <div class="view-header">
    <button class="btn btn-ghost btn-sm" onclick="nav('projects')">← Back</button>
    <h1 class="view-title">${p.name}</h1>
    ${ragBadge(p.status)}
    <button class="btn btn-ghost btn-sm" onclick="openModal('project','${p.id}')">Edit</button>
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="card-header"><div class="card-title">Project Overview</div></div>
      <div class="detail-grid">
        <div class="detail-item"><span class="detail-label">Track</span><span class="detail-val">${p.track||'—'}</span></div>
        <div class="detail-item"><span class="detail-label">Phase</span><span class="detail-val">${p.phase||'—'}</span></div>
        <div class="detail-item"><span class="detail-label">Priority</span>${ragBadge(p.priority)}</div>
        <div class="detail-item"><span class="detail-label">Dev Lead</span><span class="detail-val">${teamName(p.devLead)}</span></div>
        <div class="detail-item"><span class="detail-label">Start</span><span class="detail-val">${DateHelpers.fmt(p.startDate)}</span></div>
        <div class="detail-item"><span class="detail-label">End</span><span class="detail-val ${DateHelpers.isOverdue(p.endDate)&&normaliseStatus(p.status)!=='Completed'?'text-red':''}">${DateHelpers.fmt(p.endDate)}</span></div>
      </div>
      ${progressBar(p.progress||0)}<div class="small text-lt mt-4">${p.progress||0}% complete</div>
      ${p.description?`<hr class="divider"/><div class="detail-label">Description</div><div style="font-size:13px">${p.description}</div>`:''}
      ${p.objectives?`<div class="detail-label mt-8">Objectives</div><div style="font-size:13px">${p.objectives}</div>`:''}
      ${p.stakeholders?`<div class="detail-label mt-8">Stakeholders</div><div style="font-size:13px">${p.stakeholders}</div>`:''}
    </div>
    <div>
      <div class="card" style="margin-bottom:16px">
        <div class="card-header">
          <div class="card-title">Jira ${p.jiraKey?`<span class="badge badge-blue" style="font-size:10px">${p.jiraKey}</span>`:''} ${jira.isMock?'<span class="jira-mock">mock data</span>':''}</div>
          ${!p.jiraKey?`<button class="btn btn-ghost btn-sm" onclick="openModal('project','${p.id}')">+ Add Jira Key</button>`:''}
        </div>
        ${!p.jiraKey?`<div class="small text-lt">No Jira project key set. Edit project to add one.</div>`:`
        <div class="jira-stats">
          <div class="jira-stat todo"><div class="jstat-num">${jira.todo}</div><div class="jstat-label">To Do</div></div>
          <div class="jira-stat inprogress"><div class="jstat-num">${jira.inProgress}</div><div class="jstat-label">In Progress</div></div>
          <div class="jira-stat done"><div class="jstat-num">${jira.done}</div><div class="jstat-label">Done</div></div>
          <div class="jira-stat total"><div class="jstat-num">${jira.total}</div><div class="jstat-label">Total</div></div>
        </div>
        ${jira.total>0?progressBar(Math.round(jira.done/jira.total*100)):''}
        ${jira.isMock?`<div class="small text-amber mt-8">⚠️ Showing mock data. Configure Jira in Admin Settings → Jira Integration to see real tickets.</div>`:''}`}
      </div>
      <div class="card">
        <div class="card-header"><div class="card-title">Team</div></div>
        <div class="team-chips">
          ${tArr.map(tid=>{
            const m=APP_STATE.teamMembers.find(t=>t.id===tid);
            if(!m)return '';
            return `<div class="team-chip"><div class="chip-avatar">${avatar(m.name)}</div><div><div style="font-size:12px;font-weight:600">${m.name}</div><div class="chip-role">${m.role}</div></div></div>`;
          }).join('')||'<div class="small text-lt">No team assigned</div>'}
        </div>
      </div>
    </div>
  </div>
  <div class="grid-2">
    <div class="card">
      <div class="card-header">
        <div class="card-title">Milestones</div>
        <button class="btn btn-ghost btn-sm" onclick="openModal('milestone',null,'${id}')">+ Add</button>
      </div>
      ${pMs.length ? pMs.map(m=>`
      <div class="flex-center gap-8" style="padding:8px 0;border-bottom:1px solid var(--border)">
        <div class="flex-1">
          <div style="font-size:13px;font-weight:600;color:var(--navy)">${m.title}</div>
          <div class="small text-lt">${DateHelpers.fmt(m.dueDate)}${m.revisedETA?' → '+DateHelpers.fmt(m.revisedETA):''}</div>
        </div>
        ${ragBadge(m.status)}
        ${normaliseStatus(m.status)!=='Completed'?`<button class="btn btn-teal btn-xs" onclick="markMilestoneComplete('${m.id}')">✓</button>`:''}
      </div>`).join(''):'<div class="small text-lt">No milestones</div>'}
    </div>
    ${charter?`
    <div class="card">
      <div class="card-header"><div class="card-title">Charter</div><button class="btn btn-ghost btn-sm" onclick="openModal('charter','${charter.id}')">Edit</button></div>
      <div class="detail-label">Sponsor</div><div class="small mb-8">${charter.sponsor||'—'}</div>
      <div class="detail-label">Objectives</div><div style="font-size:13px;margin-bottom:8px">${charter.objectives||'—'}</div>
      <div class="detail-label">Success Criteria</div><div class="small">${charter.successCriteria||'—'}</div>
    </div>`:`
    <div class="card">
      <div class="card-header"><div class="card-title">Charter</div><button class="btn btn-ghost btn-sm" onclick="openModal('charter',null,'${id}')">+ Create</button></div>
      <div class="empty-state"><div class="empty-state-text">No charter yet</div></div>
    </div>`}
  </div>
  <div class="card">
    <div class="card-header">
      <div class="card-title">Notes & Comments</div>
      <button class="btn btn-ghost btn-sm" onclick="openModal('notes','${id}','project')">+ Add Note</button>
    </div>
    <div class="notes-feed">
      ${pNotes.length ? pNotes.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).map(n=>`
      <div class="note-item">
        <div><span class="note-author">${n.author||'PM'}</span><span class="note-date">${DateHelpers.fmt(n.date)}</span></div>
        <div class="note-text">${n.text}</div>
      </div>`).join(''):'<div class="small text-lt">No notes yet.</div>'}
    </div>
  </div>`;
}

// ─── ONBOARDING ───────────────────────────────────────────
export function renderOnboarding() {
  const projects = APP_STATE.onboardingProjects;
  return `
  ${filterBar()}
  <div class="view-header">
    <h1 class="view-title">Onboarding Projects</h1>
    <button class="btn btn-primary" onclick="openModal('onboarding')">+ New Onboarding</button>
  </div>
  <div class="card" style="padding:0">
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Customer</th><th>Project</th><th>Track</th><th>Phase</th><th>Status</th><th>Dev Lead</th><th>Start</th><th>End</th><th>Progress</th><th>Jira</th><th>Actions</th></tr></thead>
        <tbody>
          ${projects.length ? projects.map(p=>`
          <tr class="clickable">
            <td><span class="customer-tag">👤 ${p.customerName||'—'}</span></td>
            <td style="font-weight:700;color:var(--navy)">${p.name}</td>
            <td>${p.track?`<span class="badge badge-navy">${p.track}</span>`:'—'}</td>
            <td>${p.phase||'—'}</td>
            <td>${ragBadge(p.status)}</td>
            <td>${teamName(p.devLead)}</td>
            <td class="small">${DateHelpers.fmt(p.startDate)}</td>
            <td class="small">${DateHelpers.fmt(p.endDate)}</td>
            <td>${progressBar(p.progress||0)}<div class="small text-lt mt-4">${p.progress||0}%</div></td>
            <td>${p.jiraKey?`<span class="badge badge-blue">${p.jiraKey}</span>`:'—'}</td>
            <td>
              <button class="btn-icon" onclick="openModal('onboarding','${p.id}')">✏️</button>
              <button class="btn-icon danger" onclick="deleteItem('onboardingProjects','${p.id}')">🗑</button>
            </td>
          </tr>`).join(''):'<tr><td colspan="11" class="empty-state">No onboarding projects</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── WORKFLOWS ────────────────────────────────────────────
export function renderWorkflows() {
  const workflows = APP_STATE.workflows;
  return `
  <div class="view-header">
    <h1 class="view-title">Workflows</h1>
    <button class="btn btn-primary" onclick="openModal('workflow')">+ New Workflow</button>
  </div>
  ${workflows.length ? workflows.map(w=>`
  <div class="workflow-card">
    <div class="flex-center gap-8" style="margin-bottom:12px">
      <div class="workflow-name flex-1">${w.name}</div>
      <button class="btn btn-ghost btn-sm" onclick="openModal('workflow','${w.id}')">Edit</button>
      <button class="btn btn-icon danger" onclick="deleteItem('workflows','${w.id}')">🗑</button>
    </div>
    <div class="step-list">
      ${(w.steps||[]).map((s,i)=>`
      <div class="step-item">
        <div class="step-num">${i+1}</div>
        <div class="step-name">${s.name}</div>
        <div class="step-meta">👤 ${s.assignee||'—'} · ⏱ ${s.duration||1}d</div>
      </div>`).join('')}
    </div>
  </div>`).join(''):'<div class="empty-state"><div class="empty-state-icon">🔄</div><div class="empty-state-text">No workflows yet</div></div>'}`;
}

// ─── TEAM ─────────────────────────────────────────────────
export function renderTeam() {
  const allMembers = APP_STATE.teamMembers;
  const tracks = ['All',...(APP_STATE.settings.trackNames||['Track 1','Track 2','Track 3'])];
  const activeTrack = APP_STATE._teamTrackFilter||'All';
  const unsorted = activeTrack==='All' ? allMembers : allMembers.filter(m=>m.track===activeTrack); const members = [...unsorted].sort((a,b)=>(b.availability||100)-(a.availability||100));

  return `
  <div class="view-header">
    <h1 class="view-title">Team <span class="view-subtitle">${members.length} member${members.length!==1?'s':''}</span></h1>
    <button class="btn btn-primary" onclick="openModal('teamMember')">+ Add Member</button>
  </div>
  <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">
    ${tracks.map(t=>{
      const isActive = activeTrack===t;
      const count = t==='All' ? allMembers.length : allMembers.filter(m=>m.track===t).length;
      const color = t==='All' ? '#1B2B5E' : (TRACK_COLORS[t]||'#1B2B5E');
      return `<button onclick="window._setTeamTrack('${t}')"
        style="padding:6px 16px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;border:2px solid ${isActive?color:'var(--border)'};background:${isActive?color:'#fff'};color:${isActive?'#fff':color};font-family:'DM Sans',sans-serif;transition:all .15s">
        ${t} (${count})
      </button>`;
    }).join('')}
  </div>
  <div class="card" style="padding:0">
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Role</th><th>Track</th><th>Jira ID</th><th>Availability</th><th>Actions</th></tr></thead>
        <tbody>
          ${members.length ? members.map(m=>`
          <tr>
            <td><div class="flex-center gap-8">
              <div class="chip-avatar" style="background:${TRACK_COLORS[m.track]||'#1B2B5E'}">${avatar(m.name)}</div>
              <div style="font-weight:700;color:var(--navy)">${m.name}</div>
            </div></td>
            <td>${m.role||'—'}</td>
            <td>${m.track?`<span style="display:inline-flex;align-items:center;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${TRACK_COLORS[m.track]||'#1B2B5E'};color:#fff">${m.track}</span>`:'—'}</td>
            <td><code style="font-size:12px;color:var(--text-mid)">${m.jiraId||'—'}</code></td>
            <td><div class="flex-center gap-8" style="min-width:120px">${progressBar(m.availability||100)}<span class="small">${m.availability||100}%</span></div></td>
            <td>
              <button class="btn-icon" onclick="openModal('teamMember','${m.id}')">✏️</button>
              <button class="btn-icon danger" onclick="deleteItem('teamMembers','${m.id}')">🗑</button>
            </td>
          </tr>`).join(''):`<tr><td colspan="6" class="empty-state">No members in ${activeTrack}</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── CAPACITY ─────────────────────────────────────────────

// ─── CAPACITY ─────────────────────────────────────────────
export function renderCapacity() {
  const members = [...APP_STATE.teamMembers].sort((a,b)=>(b.availability||100)-(a.availability||100));
  const f = APP_STATE.filters;
  const projects = f.track ? APP_STATE.projects.filter(p=>p.track===f.track) : APP_STATE.projects;
  const milestones = APP_STATE.milestones;

  // Auto-calculate project completion % from milestones
  function projectCompletion(p) {
    const pMs = milestones.filter(m => m.projectId === p.id);
    if (pMs.length === 0) return p.progress || 0;
    const done = pMs.filter(m => normaliseStatus(m.status) === 'Completed').length;
    return Math.round(done / pMs.length * 100);
  }

  // Total allocation per project across all members
  const projectTotals = projects.map(p => ({
    allocated: members.reduce((s,m)=>s+((m.allocations||{})[p.id]||0), 0),
    completion: projectCompletion(p)
  }));

  return `
  ${filterBar()}
  <div class="view-header">
    <h1 class="view-title">Capacity Planning</h1>
    <button class="btn btn-primary" onclick="openModal('capacity')">Edit Allocations</button>
  </div>
  <div style="background:#fff8f0;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#92400e">
    💡 <strong>Completion %</strong> is auto-calculated from milestones. <strong>Availability</strong> is set per member. Allocation is entered manually via Edit Allocations.
  </div>
  <div class="card" style="padding:0">
    <div class="capacity-scroll">
      <table class="capacity-table">
        <thead>
          <tr>
            <th class="member-col">Team Member</th>
            <th>Availability</th>
            ${projects.map(p => {
              const completion = projectCompletion(p);
              const cc = completion>=70?'#059669':completion>=40?'#D97706':'#DC2626';
              return `<th title="${p.name}">
                <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px">${p.name.length>13?p.name.slice(0,13)+'…':p.name}</div>
                <div style="font-size:9px;font-weight:700;color:${cc};margin-top:2px">${completion}% complete</div>
              </th>`;
            }).join('')}
            <th>Total Alloc</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${members.map(m => {
            const allocs = projects.map(p=>(m.allocations||{})[p.id]||0);
            const total  = allocs.reduce((s,a)=>s+a, 0);
            const avail  = m.availability || 100;
            const cls    = total > avail ? 'over' : total > 0 && total <= avail ? 'ok' : 'under';
            const tcol   = TRACK_COLORS[m.track] || '#1B2B5E';
            return `<tr>
              <td class="member-cell">
                <div class="flex-center gap-8">
                  <div class="chip-avatar" style="background:${tcol}">${avatar(m.name)}</div>
                  <div>
                    <div class="member-name">${m.name}</div>
                    <div class="member-role">${m.role||''}</div>
                    <div style="font-size:10px;color:${tcol};font-weight:700">${m.track||''}</div>
                  </div>
                </div>
              </td>
              <td style="text-align:center;min-width:80px">
                <div style="font-size:15px;font-weight:800;color:var(--navy)">${avail}%</div>
                <div class="cap-bar" style="margin:4px auto 0;width:60px">
                  <div style="width:${avail}%;background:var(--teal)"></div>
                </div>
              </td>
              ${projects.map((p,i) => {
                const v = allocs[i];
                const pct = avail > 0 ? Math.min((v/avail*100), 100).toFixed(0) : 0;
                return `<td class="${v>0?'alloc-active':''}">
                  ${v > 0 ? `
                  <div class="alloc-val ${v>avail?'over':''}" style="font-size:14px">${v}%</div>
                  <div class="cap-bar" style="width:60px;margin:3px auto 0">
                    <div style="width:${pct}%;background:${v>avail?'var(--coral)':'var(--teal)'}"></div>
                  </div>` : `<div style="color:var(--text-lt);font-size:12px;text-align:center">—</div>`}
                </td>`;
              }).join('')}
              <td style="text-align:center">
                <div style="font-size:16px;font-weight:800;color:${total>avail?'var(--red)':total===0?'var(--text-lt)':'var(--teal)'}">
                  ${total}%
                </div>
                <div style="font-size:10px;color:var(--text-lt)">${avail > 0 ? Math.round(total/avail*100) : 0}% of capacity</div>
              </td>
              <td>
                <span class="util-badge ${cls}">
                  ${cls==='over'?'Over-allocated':cls==='under'?'Under-allocated':'Optimal'}
                </span>
              </td>
            </tr>`;
          }).join('')}
          <!-- Summary row -->
          <tr style="background:#F5F6FA;border-top:2px solid var(--border)">
            <td class="member-cell" style="font-size:12px;font-weight:700;color:var(--text-lt)">PROJECT TOTALS</td>
            <td></td>
            ${projectTotals.map(pt => `
            <td style="text-align:center">
              <div style="font-size:13px;font-weight:700;color:var(--navy)">${pt.allocated}% alloc</div>
              <div style="font-size:10px;color:var(--text-lt)">${pt.completion}% done</div>
            </td>`).join('')}
            <td></td><td></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>`;
}

export function renderResources() {
  const members = APP_STATE.teamMembers;
  const resources = APP_STATE.resources;
  const f = APP_STATE.filters;
  const weekOffset = APP_STATE._resourceWeekOffset || 0;
  const today = DateHelpers.today();

  const days = [];
  for (let i=0; i<7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + weekOffset*7 + i - 6);
    days.push(d.toISOString().split('T')[0]);
  }
  const weekStart = DateHelpers.fmtShort(days[0]);
  const weekEnd = DateHelpers.fmtShort(days[6]);

  function getLogs(mid, date) { return resources.filter(r=>r.memberId===mid&&r.date===date); }
  function isCrossTrack(mid, date) {
    return [...new Set(getLogs(mid,date).map(r=>r.track).filter(Boolean))].length > 1;
  }
  function totalHours(mid, date) { return getLogs(mid,date).reduce((s,r)=>s+(parseFloat(r.hours)||0),0); }

  const filtMembers = f.track ? members.filter(m=>m.track===f.track) : members;

  return `
  ${filterBar()}
  <div class="view-header">
    <h1 class="view-title">Resource Tracking</h1>
    <button class="btn btn-primary" onclick="openModal('resource')">+ Log Hours</button>
  </div>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;background:#fff;border:1px solid var(--border);border-radius:8px;padding:10px 16px">
    <button class="btn btn-ghost btn-sm" onclick="window._resourceWeek(-1)">← Prev Week</button>
    <div style="flex:1;text-align:center;font-size:14px;font-weight:600;color:var(--navy)">
      ${weekStart} — ${weekEnd}
      ${weekOffset===0?'<span style="font-size:11px;background:var(--teal);color:#fff;padding:2px 8px;border-radius:10px;margin-left:8px">This Week</span>':''}
    </div>
    <button class="btn btn-ghost btn-sm" onclick="window._resourceWeek(1)" ${weekOffset>=0?'disabled style="opacity:.4"':''}>Next Week →</button>
    ${weekOffset!==0?`<button class="btn btn-ghost btn-sm" onclick="window._resourceWeek(0,'reset')">Today</button>`:''}
  </div>
  <div class="card" style="padding:0">
    <div class="resource-grid">
      <table class="resource-table">
        <thead>
          <tr>
            <th class="member-col">Member</th>
            ${days.map(d=>{
              const isToday = d===today;
              return `<th style="${isToday?'background:#1B2B5E;color:#fff;':''}">${DateHelpers.fmtShort(d)}${isToday?'<div style="font-size:9px;opacity:.7">TODAY</div>':''}</th>`;
            }).join('')}
            <th>Week Total</th>
          </tr>
        </thead>
        <tbody>
          ${filtMembers.map(m=>{
            const weekTotal = days.reduce((s,d)=>s+totalHours(m.id,d),0);
            return `<tr>
              <td class="member-cell">
                <div style="font-weight:600;font-size:13px;color:var(--navy)">${m.name}</div>
                <div style="font-size:11px;color:${TRACK_COLORS[m.track]||'var(--text-lt)'};font-weight:600">${m.track||'—'}</div>
              </td>
              ${days.map(d=>{
                const logs = getLogs(m.id,d);
                const cross = isCrossTrack(m.id,d);
                const tot = totalHours(m.id,d);
                const isToday = d===today;
                return `<td class="resource-cell ${cross?'cross-track':''}"
                  style="${isToday?'background:#f8faff;':''}"
                  onclick="openModal('resourceDay','${m.id}','${d}')"
                  title="Click to log for ${m.name}">
                  ${logs.length>0?`
                  <div style="display:flex;flex-direction:column;gap:2px">
                    ${logs.map(log=>`
                    <div style="display:flex;align-items:center;gap:3px;background:${TRACK_COLORS[log.track]||'#1B2B5E'}18;border-left:2px solid ${TRACK_COLORS[log.track]||'#1B2B5E'};padding:2px 4px;border-radius:0 3px 3px 0">
                      <span style="font-size:11px;font-weight:700;color:${TRACK_COLORS[log.track]||'#1B2B5E'}">${log.hours}h</span>
                      <span style="font-size:9px;color:var(--text-lt);white-space:nowrap;overflow:hidden;max-width:50px;text-overflow:ellipsis">${log.track||''}</span>
                    </div>`).join('')}
                    ${cross?`<div style="font-size:9px;color:var(--amber);font-weight:700">⚠️ ${tot}h</div>`:''}
                  </div>`:`<div style="font-size:11px;color:var(--text-lt);text-align:center">—</div>`}
                </td>`;
              }).join('')}
              <td style="text-align:center;font-weight:700;color:${weekTotal>40?'var(--red)':weekTotal>0?'var(--navy)':'var(--text-lt)'}">
                ${weekTotal>0?weekTotal+'h':'—'}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>
  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:12px;font-size:12px;color:var(--text-lt)">
    <span>💡 Click any cell to log or edit hours</span>
    <span>⚠️ Amber = member logged across multiple tracks same day</span>
    <span>🔴 Week total over 40h flagged red</span>
  </div>`;
}

// ─── RISKS ────────────────────────────────────────────────
export function renderRisks() {
  const f = APP_STATE.filters;
  const risks = f.track ? APP_STATE.risks.filter(r=>r.track===f.track) : APP_STATE.risks;
  return `
  ${filterBar()}
  <div class="view-header">
    <h1 class="view-title">Risk Register</h1>
    <button class="btn btn-primary" onclick="openModal('risk')">+ Add Risk</button>
  </div>
  <div class="card" style="padding:0">
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Risk</th><th>Project</th><th>Track</th><th>L</th><th>I</th><th>Score</th><th>Owner</th><th>Mitigation</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${risks.length ? risks.map(r=>{
            const score=(r.likelihood||1)*(r.impact||1);
            const cls=score>=12?'score-high':score>=6?'score-med':'score-low';
            return `<tr>
              <td style="font-weight:600">${r.title}</td>
              <td class="small">${r.project||'—'}</td>
              <td>${r.track?`<span class="badge badge-navy" style="font-size:10px">${r.track}</span>`:'—'}</td>
              <td style="text-align:center">${r.likelihood||1}</td>
              <td style="text-align:center">${r.impact||1}</td>
              <td style="text-align:center"><span class="risk-score ${cls}">${score}</span></td>
              <td class="small">${r.owner||'—'}</td>
              <td class="small" style="max-width:200px">${r.mitigation||'—'}</td>
              <td>${ragBadge(r.status)}</td>
              <td>
                <button class="btn-icon" onclick="openModal('risk','${r.id}')">✏️</button>
                <button class="btn-icon danger" onclick="deleteItem('risks','${r.id}')">🗑</button>
              </td>
            </tr>`;
          }).join(''):'<tr><td colspan="10" class="empty-state">No risks logged</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── ESCALATIONS ──────────────────────────────────────────
export function renderEscalations() {
  const escs = APP_STATE.escalations;
  return `
  <div class="view-header">
    <h1 class="view-title">Escalations</h1>
    <button class="btn btn-primary" onclick="openModal('escalation')">+ Add Escalation</button>
  </div>
  ${escs.length ? escs.map(e=>`
  <div class="esc-card ${normaliseStatus(e.status)==='Resolved'?'esc-resolved':''}">
    <div class="flex-center gap-8 mb-8">
      <div class="esc-title flex-1">${e.title}</div>
      ${ragBadge(e.priority)} ${ragBadge(e.status)}
    </div>
    <div class="esc-meta">📁 ${e.project||'—'} · 👤 ${e.raisedBy||'—'} · 📅 ${DateHelpers.fmt(e.date)}</div>
    ${e.notes?`<div class="small mt-4">${e.notes}</div>`:''}
    ${e.resolution?`<div class="small text-green mt-4">✅ ${e.resolution}</div>`:''}
    <div class="flex gap-8 mt-8">
      <button class="btn btn-ghost btn-sm" onclick="openModal('escalation','${e.id}')">Edit</button>
      <button class="btn btn-icon danger" onclick="deleteItem('escalations','${e.id}')">🗑</button>
    </div>
  </div>`).join(''):'<div class="empty-state"><div class="empty-state-icon">🚨</div><div class="empty-state-text">No escalations</div></div>'}`;
}

// ─── LEADERSHIP REPORT ────────────────────────────────────
export function renderLeadership() {
  const projects = APP_STATE.projects;
  const milestones = APP_STATE.milestones;
  const risks = APP_STATE.risks;
  const overdue = milestones.filter(m=>normaliseStatus(m.status)==='Overdue');
  const atRisk = milestones.filter(m=>normaliseStatus(m.status)==='At Risk');
  const openRisks = risks.filter(r=>normaliseStatus(r.status)==='Open').sort((a,b)=>b.likelihood*b.impact-a.likelihood*a.impact);
  return `
  <div class="view-header">
    <h1 class="view-title">Leadership Report</h1>
    <button class="btn btn-ghost btn-sm no-print" onclick="window.print()">🖨 Print</button>
  </div>
  <div class="leadership-report">
    <div class="small text-lt mb-16">Generated: ${DateHelpers.fmt(DateHelpers.today())}</div>
    <div class="report-section">
      <h2>Executive Summary</h2>
      <div class="stat-row">
        <div class="stat-card navy"><div class="stat-num">${projects.length}</div><div class="stat-label">Total Projects</div></div>
        <div class="stat-card green"><div class="stat-num">${projects.filter(p=>normaliseStatus(p.status)==='Completed').length}</div><div class="stat-label">Completed</div></div>
        <div class="stat-card amber"><div class="stat-num">${atRisk.length}</div><div class="stat-label">At Risk</div></div>
        <div class="stat-card red"><div class="stat-num">${overdue.length}</div><div class="stat-label">Overdue</div></div>
      </div>
    </div>
    <div class="report-section">
      <h2>Project Status</h2>
      <div class="card" style="padding:0">
        <table class="data-table">
          <thead><tr><th>Project</th><th>Track</th><th>Phase</th><th>Status</th><th>Progress</th><th>Dev Lead</th></tr></thead>
          <tbody>${projects.map(p=>`
          <tr>
            <td style="font-weight:600">${p.name||p.title||'Unnamed'}</td>
            <td>${p.track||'—'}</td><td>${p.phase||'—'}</td>
            <td>${ragBadge(p.status)}</td>
            <td>${progressBar(p.progress||0)}<span class="small">${p.progress||0}%</span></td>
            <td class="small">${teamName(p.devLead)}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="report-section">
      <h2>Milestone Health</h2>
      <div class="card" style="padding:0">
        <table class="data-table">
          <thead><tr><th>Milestone</th><th>Project</th><th>Due Date</th><th>Revised ETA</th><th>Status</th></tr></thead>
          <tbody>${milestones.map(m=>`
          <tr class="${normaliseStatus(m.status)==='Overdue'?'overdue':normaliseStatus(m.status)==='Completed'?'completed':''}">
            <td style="font-weight:600">${m.title}</td>
            <td class="small">${m.projectName||'—'}</td>
            <td class="small">${DateHelpers.fmt(m.dueDate)}</td>
            <td class="small ${m.revisedETA?'text-amber':''}">${DateHelpers.fmt(m.revisedETA)}</td>
            <td>${ragBadge(m.status)}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="report-section">
      <h2>Top Risks</h2>
      ${openRisks.slice(0,5).map(r=>{
        const score=r.likelihood*r.impact;
        return `<div class="flex-center gap-8" style="padding:8px 0;border-bottom:1px solid var(--border)">
          <span class="risk-score ${score>=12?'score-high':score>=6?'score-med':'score-low'}">${score}</span>
          <div class="flex-1"><div style="font-weight:600;font-size:13px">${r.title}</div><div class="small text-lt">${r.mitigation||''}</div></div>
          <span class="small">${r.owner||'—'}</span>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

// ─── IMPACTS ──────────────────────────────────────────────
export function renderImpacts() {
  const impacts = APP_STATE.impacts;
  return `
  <div class="view-header">
    <h1 class="view-title">Impact Tracker</h1>
    <button class="btn btn-primary" onclick="openModal('impact')">+ Add Impact</button>
  </div>
  <div class="card" style="padding:0">
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Project</th><th>Metric</th><th>Baseline</th><th>Current</th><th>Target</th><th>Improvement</th><th>Notes</th><th>Actions</th></tr></thead>
        <tbody>
          ${impacts.length ? impacts.map(i=>`
          <tr>
            <td style="font-weight:600">${i.project}</td><td>${i.metric}</td>
            <td class="small text-lt">${i.baseline}</td>
            <td style="font-weight:700;color:var(--navy)">${i.current}</td>
            <td class="small">${i.target}</td>
            <td><span class="badge badge-green">${i.improvement}</span></td>
            <td class="small text-lt">${i.notes||'—'}</td>
            <td>
              <button class="btn-icon" onclick="openModal('impact','${i.id}')">✏️</button>
              <button class="btn-icon danger" onclick="deleteItem('impacts','${i.id}')">🗑</button>
            </td>
          </tr>`).join(''):'<tr><td colspan="8" class="empty-state">No impact data</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── CHARTERS ─────────────────────────────────────────────
export function renderCharters() {
  const charters = APP_STATE.charters;
  return `
  <div class="view-header">
    <h1 class="view-title">Project Charters</h1>
    <button class="btn btn-primary" onclick="openModal('charter')">+ Add Charter</button>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">
    ${charters.length ? charters.map(c=>`
    <div class="card" style="border-left:4px solid var(--navy)">
      <div style="font-size:16px;font-weight:800;color:var(--navy);margin-bottom:10px">${c.projectName||'—'}</div>
      <div class="detail-label">Sponsor</div><div class="small mb-8">${c.sponsor||'—'}</div>
      <div class="detail-label">Objectives</div><div style="font-size:13px;margin-bottom:8px">${c.objectives||'—'}</div>
      <div class="detail-label">Scope</div><div class="small mb-8">${c.scope||'—'}</div>
      <div class="detail-label">Success Criteria</div><div class="small mb-8">${c.successCriteria||'—'}</div>
      <div class="flex gap-8 mt-8">
        <button class="btn btn-ghost btn-sm" onclick="openModal('charter','${c.id}')">Edit</button>
        <button class="btn btn-icon danger" onclick="deleteItem('charters','${c.id}')">🗑</button>
      </div>
    </div>`).join(''):'<div class="empty-state"><div class="empty-state-icon">📄</div><div class="empty-state-text">No charters yet</div></div>'}
  </div>`;
}

// ─── SETTINGS ─────────────────────────────────────────────
export function renderSettings() {
  const s = APP_STATE.settings;
  const jira = JiraService.getConfig();
  const members = APP_STATE.teamMembers;
  const isJiraConfigured = !!(jira.baseUrl && jira.token);

  return `
  <div class="view-header">
    <h1 class="view-title">Admin Settings</h1>
  </div>
  <div class="settings-tabs">
    <div class="settings-tab active" onclick="switchSettingsTab('dropdowns',this)">Dropdowns</div>
    <div class="settings-tab" onclick="switchSettingsTab('jira',this)">Jira Integration ${isJiraConfigured?'✅':''}</div>
    <div class="settings-tab" onclick="switchSettingsTab('wf-cfg',this)">Workflow Config</div>
  </div>

  <div id="settingsTab-dropdowns">
    <div class="grid-2">
      ${[
        {key:'statusOptions',label:'Project Status'},
        {key:'phaseOptions',label:'Phase Options'},
        {key:'priorityOptions',label:'Priority'},
        {key:'trackNames',label:'Track Names'}
      ].map(cfg=>`
      <div class="card">
        <div class="card-header">
          <div class="card-title">${cfg.label}</div>
          <button class="btn btn-ghost btn-sm" onclick="addDropdownItem('${cfg.key}')">+ Add</button>
        </div>
        ${(s[cfg.key]||[]).map((v,i)=>`
        <div class="dropdown-item">
          <input class="form-control" style="flex:1" value="${v}" onchange="updateDropdownItem('${cfg.key}',${i},this.value)"/>
          <button class="btn-icon danger" onclick="removeDropdownItem('${cfg.key}',${i})">🗑</button>
        </div>`).join('')}
      </div>`).join('')}
    </div>
    <button class="btn btn-primary mt-16" onclick="saveSettings()">💾 Save Settings</button>
  </div>

  <div id="settingsTab-jira" style="display:none">
    <div class="card">
      <div class="card-header">
        <div class="card-title">Jira Configuration</div>
        ${isJiraConfigured?'<span class="badge badge-green">Connected</span>':'<span class="badge badge-gray">Not configured</span>'}
      </div>

      <!-- Step by step guide -->
      <div style="background:#f8faff;border:1px solid var(--border);border-radius:8px;padding:14px 16px;margin-bottom:16px;font-size:13px">
        <div style="font-weight:700;color:var(--navy);margin-bottom:8px">How to connect Jira:</div>
        <div style="display:flex;flex-direction:column;gap:6px;color:var(--text-mid)">
          <div>1. Enter your Atlassian site URL below (e.g. <code>https://kriyadocs.atlassian.net</code>)</div>
          <div>2. Enter the email you use to log into Jira</div>
          <div>3. Generate an API token at <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" style="color:var(--navy)">id.atlassian.com → API tokens</a> and paste it below</div>
          <div>4. Click Save, then go to any project detail page — Jira stats will show real data</div>
          <div>5. Each project must have a <strong>Jira Project Key</strong> set (e.g. RSE, MPV2) — edit the project to add it</div>
        </div>
      </div>

      <div class="form-group">
        <label class="form-label">Jira Site URL *</label>
        <input class="form-control" id="jira-baseUrl" value="${jira.baseUrl}" placeholder="https://yourorg.atlassian.net"/>
        <div class="small text-lt mt-4">No trailing slash. Must start with https://</div>
      </div>
      <div class="form-group">
        <label class="form-label">Atlassian Email *</label>
        <input class="form-control" id="jira-email" value="${jira.email}" placeholder="you@kriyadocs.com"/>
      </div>
      <div class="form-group">
        <label class="form-label">API Token *</label>
        <input class="form-control" type="password" id="jira-token" value="${jira.token}" placeholder="Paste your API token here"/>
        <div class="small text-lt mt-4">Token is stored locally in your browser — never sent to any server except Jira.</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-primary" onclick="saveJiraConfig()">💾 Save Jira Config</button>
        ${isJiraConfigured?`<button class="btn btn-ghost" onclick="testJiraConfig()">🔍 Test Connection</button>`:''}
      </div>
      <div id="jira-test-result" style="margin-top:10px"></div>
    </div>

    <div class="card mt-16">
      <div class="card-header">
        <div class="card-title">Team → Jira User Mapping</div>
        <div class="small text-lt">Map each member to their Jira account ID for workload reporting</div>
      </div>
      <table class="data-table">
        <thead><tr><th>Team Member</th><th>Jira User ID / Email</th></tr></thead>
        <tbody>
          ${members.map(m=>`
          <tr>
            <td>${m.name}</td>
            <td><input class="form-control" value="${m.jiraId||''}" onchange="updateJiraMapping('${m.id}',this.value)" placeholder="e.g. firstname.last@kriyadocs.com"/></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>

  <div id="settingsTab-wf-cfg" style="display:none">
    <div class="card">
      <div class="small text-lt">Manage workflow templates from the <a href="#" onclick="nav('workflows');return false" style="color:var(--navy)">Workflows tab</a>.</div>
    </div>
  </div>`;
}
// ============================================================
// PLEDGES VIEW
// ============================================================
export function renderPledges() {
  const pledges = APP_STATE.pledges || [];

  function countdown(dueDate, status) {
    if (status === 'Honored') return `<span class="countdown honored">✓ Honored</span>`;
    const due = new Date(dueDate);
    const now = new Date();
    const days = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    if (days < 0) return `<span class="countdown urgent">⚠ ${Math.abs(days)}d overdue</span>`;
    if (days <= 7) return `<span class="countdown urgent">🔴 ${days}d left</span>`;
    if (days <= 14) return `<span class="countdown soon">🟡 ${days}d left</span>`;
    return `<span class="countdown fine">🟢 ${days}d left</span>`;
  }

  function cardClass(status) {
    if (status === 'Breached') return 'broken';
    if (status === 'At Risk') return 'atrisk';
    if (status === 'Honored') return 'honored';
    return '';
  }

  const statusBadgeMap = {
    'On Track': 'badge-teal',
    'At Risk': 'badge-amber',
    'Breached': 'badge-red',
    'Honored': 'badge-green'
  };

  return `
  <div class="vh">
    <div class="vh-left">
      <h1>Pledges</h1>
      <div class="sub">Customer commitments with deadlines and accountability</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-ghost btn-sm" onclick="downloadTemplate('pledges')">⬇ Template</button>
      <button class="btn btn-ghost btn-sm" onclick="triggerImport('pledges')">⬆ Import</button>
      <button class="btn btn-primary" onclick="openModal('pledge')">+ New Pledge</button>
    </div>
  </div>

  <div class="tab-note">
    <div class="tab-note-icon">i</div>
    <div><strong>Pledges</strong> are commitments made to customers or stakeholders with a deadline. Track status, ownership and countdown to due date.</div>
  </div>

  <div class="filter-row">
    <div class="fg"><label>Status</label>
      <select onchange="APP_STATE._pledgeFilter=this.value;nav('pledges')">
        <option value="">All</option>
        <option value="On Track">On Track</option>
        <option value="At Risk">At Risk</option>
        <option value="Breached">Breached</option>
        <option value="Honored">Honored</option>
      </select>
    </div>
    <div class="fg"><label>Priority</label>
      <select onchange="APP_STATE._pledgePriFilter=this.value;nav('pledges')">
        <option value="">All</option>
        <option value="Critical">Critical</option>
        <option value="High">High</option>
        <option value="Medium">Medium</option>
        <option value="Low">Low</option>
      </select>
    </div>
  </div>

  ${(() => {
    let filtered = pledges;
    const sf = APP_STATE._pledgeFilter;
    const pf = APP_STATE._pledgePriFilter;
    if (sf) filtered = filtered.filter(p => p.status === sf);
    if (pf) filtered = filtered.filter(p => p.priority === pf);

    if (!filtered.length) return `<div class="empty"><div class="empty-icon">🤝</div>No pledges found. Add your first customer commitment.</div>`;

    return filtered.map(p => {
      const proj = APP_STATE.projects.find(pr => pr.id === p.linkedProjectId);
      return `
      <div class="pledge-card ${cardClass(p.status)}">
        <div>
          <div class="pledge-title">${p.title || 'Untitled Pledge'}</div>
          <div class="pledge-meta">
            <span>👤 ${p.owner || '—'}</span>
            <span>🏢 ${p.customer || '—'}</span>
            ${proj ? `<span>🔗 ${proj.name}</span>` : ''}
            <span class="badge ${statusBadgeMap[p.status] || 'badge-grey'}">${p.status || 'On Track'}</span>
            <span class="badge ${p.priority === 'Critical' ? 'badge-coral' : p.priority === 'High' ? 'badge-amber' : 'badge-navy'}">${p.priority || 'Medium'}</span>
          </div>
          ${p.notes ? `<div class="pledge-quote">${p.notes}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          ${p.dueDate ? countdown(p.dueDate, p.status) : ''}
          <div style="font-size:11px;color:var(--lt)">${p.dueDate || ''}</div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-xs" onclick="openModal('pledge','${p.id}')">Edit</button>
            <button class="btn btn-danger btn-xs" onclick="deleteItem('pledges','${p.id}')">Del</button>
          </div>
        </div>
      </div>`;
    }).join('');
  })()}`;
}

// ============================================================
// KNOWLEDGE VIEW
// ============================================================
export function renderKnowledge() {
  const docs = APP_STATE.knowledge || [];
  const search = APP_STATE._knowledgeSearch || '';

  let filtered = docs;
  if (search) {
    const q = search.toLowerCase();
    filtered = docs.filter(d =>
      (d.title || '').toLowerCase().includes(q) ||
      (d.tags || '').toLowerCase().includes(q) ||
      (d.content || '').toLowerCase().includes(q)
    );
  }

  return `
  <div class="vh">
    <div class="vh-left">
      <h1>Knowledge Base</h1>
      <div class="sub">Team documentation, SOPs, and reference material</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="openModal('knowledge')">+ New Document</button>
    </div>
  </div>

  <div class="tab-note">
    <div class="tab-note-icon">i</div>
    <div><strong>Knowledge Base</strong> stores team documents, SOPs, meeting notes and reference material. Search by title or tag.</div>
  </div>

  <div class="filter-row" style="margin-bottom:16px">
    <div class="fg" style="flex:1;max-width:400px">
      <label>Search</label>
      <input type="text" placeholder="Search title, tags, content…" value="${search}"
        oninput="APP_STATE._knowledgeSearch=this.value;nav('knowledge')"
        style="min-width:300px"/>
    </div>
  </div>

  ${!filtered.length ? `<div class="empty"><div class="empty-icon">📚</div>No documents found. Add your first knowledge article.</div>` : `
  <div class="doc-grid">
    ${filtered.map(d => {
      const tags = (d.tags || '').split(',').map(t => t.trim()).filter(Boolean);
      const proj = APP_STATE.projects.find(p => p.id === d.linkedProjectId);
      return `
      <div class="doc-card" onclick="openModal('knowledge-view','${d.id}')">
        <div class="doc-title">${d.title || 'Untitled'}</div>
        ${d.content ? `<div class="doc-desc">${d.content.slice(0, 120)}${d.content.length > 120 ? '…' : ''}</div>` : ''}
        <div class="chip-row">
          ${tags.map(t => `<span class="doc-tag">${t}</span>`).join('')}
        </div>
        <div class="doc-meta">
          ${proj ? `<span>🔗 ${proj.name}</span>` : ''}
          ${d.updatedAt ? `<span>Updated ${d.updatedAt}</span>` : d.createdAt ? `<span>Added ${d.createdAt}</span>` : ''}
        </div>
        <div style="display:flex;gap:6px;margin-top:4px">
          <button class="btn btn-ghost btn-xs" onclick="event.stopPropagation();openModal('knowledge','${d.id}')">Edit</button>
          <button class="btn btn-danger btn-xs" onclick="event.stopPropagation();deleteItem('knowledge','${d.id}')">Delete</button>
        </div>
      </div>`;
    }).join('')}
  </div>`}`;
}
