// ============================================================
// VIEWS.JS — All View Renderers
// ============================================================
import { APP_STATE, DateHelpers, JiraService, DB } from './data.js';
import { openModal } from './modals.js';

// ─── HELPERS ─────────────────────────────────────────────
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
  const m = APP_STATE.teamMembers.find(t=>t.id===id);
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

// ─── DASHBOARD ─────────────────────────────────────────────
export function renderDashboard() {
  const projects = APP_STATE.projects.map(p=>({...p,
    name: p.name||p.title||'Unnamed',
    status: normaliseStatus(p.status||p.rag||'')
  }));
  const milestones = APP_STATE.milestones.map(m=>({...m,
    title: m.title||m.name||'Unnamed',
    status: normaliseStatus(m.status||m.rag||'')
  }));
  const risks = APP_STATE.risks;
  const total = projects.length;
  const inProg = projects.filter(p=>p.status==='In Progress').length;
  const atRisk = milestones.filter(m=>m.status==='At Risk').length;
  const overdue = milestones.filter(m=>m.status==='Overdue').length;
  const completed = projects.filter(p=>p.status==='Completed').length;
  const upcoming = milestones.filter(m=>m.status!=='Completed').sort((a,b)=>a.dueDate>b.dueDate?1:-1).slice(0,5);
  const openRisks = risks.filter(r=>normaliseStatus(r.status)==='Open');
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
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;cursor:pointer" onclick="nav('project-detail',{id:'${p.id}'})">
          <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:4px">${p.name}</div>
          <div style="font-size:11px;color:var(--text-lt);margin-bottom:8px">${p.track||'—'} · ${p.phase||'—'}</div>
          ${progressBar(p.progress||0)}
          <div class="flex-center gap-8 mt-4">${ragBadge(p.status)}<span class="small text-lt">${p.progress||0}%</span></div>
        </div>`).join('')}
      </div>
    </div>
    <div>
      <div class="card" style="margin-bottom:16px">
        <div class="card-header"><div class="card-title">⚠️ Upcoming Milestones</div></div>
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
        <div class="card-header"><div class="card-title">🚨 Open Escalations</div></div>
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

// ─── TRACKS ────────────────────────────────────────────────
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
      const cls = ['track-1','track-2','track-3'][i]||'track-1';
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
                <span style="flex:1">${p.name}</span>
                ${ragBadge(p.status)}
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

// ─── ROADMAP ───────────────────────────────────────────────
export function renderRoadmap() {
  const f = APP_STATE.filters;
  const year = parseInt(f.year) || new Date().getFullYear();
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
  const rangeEnd   = new Date(year, endMonth + 1, 0);
  const totalDays  = Math.max(1, (rangeEnd.getTime() - rangeStart.getTime()) / 86400000);

  const statusColor = {
    'In Progress':'#1B2B5E','On Track':'#2563EB','At Risk':'#D97706',
    'Overdue':'#DC2626','Completed':'#059669','Yet to Start':'#94A3B8','On Hold':'#6B7280'
  };
  const msColorMap = {'Completed':'#059669','Overdue':'#DC2626','At Risk':'#D97706','On Track':'#2563EB'};
  const trackColors = ['#1B2B5E','#00A896','#E8452C','#7C3AED'];

  function datePct(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    const clamped = Math.max(rangeStart.getTime(), Math.min(rangeEnd.getTime(), d.getTime()));
    return +((clamped - rangeStart.getTime()) / 86400000 / totalDays * 100).toFixed(2);
  }

  function barRange(start, end) {
    if (!start || !end) return null;
    const s = new Date(start), e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
    if (e.getTime() < rangeStart.getTime() || s.getTime() > rangeEnd.getTime()) return null;
    const cs = Math.max(rangeStart.getTime(), s.getTime());
    const ce = Math.min(rangeEnd.getTime(), e.getTime());
    const left  = +((cs - rangeStart.getTime()) / 86400000 / totalDays * 100).toFixed(2);
    const width = Math.max(0.5, +((ce - cs) / 86400000 / totalDays * 100).toFixed(2));
    return { left, width };
  }

  const todayPct = datePct(DateHelpers.today());
  const uniqueTracks = [...new Set(projects.map(p => p.track || 'Unassigned'))];

  const gridLines = months.map((_, i) => {
    if (i === 0) return '';
    return `<div style="position:absolute;top:0;bottom:0;left:${(i/months.length*100).toFixed(2)}%;width:1px;background:#EEF2F8;pointer-events:none"></div>`;
  }).join('');

  const todayLine = todayPct !== null
    ? `<div style="position:absolute;top:0;bottom:0;left:${todayPct}%;width:2px;background:#E8452C;opacity:.3;z-index:3;pointer-events:none"></div>`
    : '';

  return `
  ${filterBar()}
  <div class="view-header">
    <h1 class="view-title">Roadmap <span class="view-subtitle">${year}${f.quarter ? ' · '+f.quarter : ' · Full Year'}</span></h1>
  </div>

  <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:16px;background:#fff;border:1px solid var(--border);border-radius:8px;padding:10px 16px;font-size:12px;color:#4A5578">
    ${Object.entries(statusColor).map(([s,c]) =>
      `<div style="display:flex;align-items:center;gap:5px"><div style="width:20px;height:9px;border-radius:3px;background:${c}"></div>${s}</div>`
    ).join('')}
    <div style="display:flex;align-items:center;gap:5px"><div style="width:2px;height:14px;background:#E8452C;border-radius:1px"></div>Today</div>
    <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;background:#333;transform:rotate(45deg)"></div>Milestone</div>
  </div>

  <div style="background:#fff;border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(27,43,94,.07)">

    <div style="display:grid;grid-template-columns:230px 1fr;background:#F5F6FA;border-bottom:2px solid var(--border)">
      <div style="padding:11px 18px;font-size:11px;font-weight:700;color:#8896B0;text-transform:uppercase;letter-spacing:.6px">Project</div>
      <div style="display:flex;border-left:1px solid var(--border)">
        ${months.map(m =>
          `<div style="flex:1;padding:11px 0;text-align:center;font-size:11px;font-weight:700;color:#8896B0;text-transform:uppercase;border-left:1px solid #EEF2F8">
            ${DateHelpers.monthName(m)}
          </div>`
        ).join('')}
      </div>
    </div>

    ${uniqueTracks.length === 0
      ? `<div style="padding:48px;text-align:center;color:#8896B0"><div style="font-size:36px;margin-bottom:10px">🗺</div>No projects match current filters.</div>`
      : uniqueTracks.map((track, ti) => {
          const tc = trackColors[ti % trackColors.length];
          const tProj = projects.filter(p => (p.track || 'Unassigned') === track);
          return `<div style="display:grid;grid-template-columns:230px 1fr;background:${tc}08;border-bottom:1.5px solid ${tc}25">
            <div style="padding:8px 18px;display:flex;align-items:center;gap:8px">
              <div style="width:3px;height:18px;background:${tc};border-radius:2px;flex-shrink:0"></div>
              <span style="font-size:11px;font-weight:800;color:${tc};text-transform:uppercase;letter-spacing:.8px">${track} (${tProj.length})</span>
            </div>
            <div style="border-left:1px solid var(--border);position:relative;min-height:34px">${gridLines}${todayLine}</div>
          </div>
          ${tProj.map((p, pi) => {
            const bar = barRange(p.startDate, p.endDate);
            const pMs = milestones.filter(m => m.projectId === p.id);
            const color = statusColor[normaliseStatus(p.status)] || '#94A3B8';
            return `<div style="display:grid;grid-template-columns:230px 1fr;border-bottom:1px solid ${pi===tProj.length-1?'var(--border)':'#F4F6FB'};min-height:64px">
              <div style="padding:12px 18px;cursor:pointer;transition:background .12s"
                   onclick="nav('project-detail',{id:'${p.id}'})"
                   onmouseover="this.style.background='#F8FAFF'"
                   onmouseout="this.style.background=''">
                <div style="font-size:13px;font-weight:600;color:#1B2B5E;margin-bottom:5px">${p.name}</div>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                  ${ragBadge(p.status)}
                  <span style="font-size:11px;color:#8896B0">${p.progress||0}%</span>
                  ${p.devLead ? `<span style="font-size:11px;color:#8896B0">· ${teamName(p.devLead)}</span>` : ''}
                </div>
              </div>
              <div style="position:relative;border-left:1px solid var(--border);min-height:64px;overflow:visible">
                ${gridLines}${todayLine}
                ${bar ? `<div title="${p.name} · ${DateHelpers.fmt(p.startDate)} → ${DateHelpers.fmt(p.endDate)}"
                     style="position:absolute;top:50%;transform:translateY(-50%);left:${bar.left}%;width:${bar.width}%;height:28px;border-radius:5px;background:${color};z-index:4;overflow:hidden;min-width:6px;box-shadow:0 1px 4px rgba(0,0,0,.15)">
                  <div style="position:absolute;top:0;left:0;height:100%;width:${p.progress||0}%;background:rgba(255,255,255,.22)"></div>
                  ${bar.width > 5 ? `<div style="position:absolute;inset:0;display:flex;align-items:center;padding:0 8px;font-size:10px;font-weight:700;color:rgba(255,255,255,.92);white-space:nowrap;overflow:hidden">${p.progress||0}%</div>` : ''}
                </div>` : ''}
                ${pMs.map(ms => {
                  const mp = datePct(ms.dueDate);
                  if (mp === null) return '';
                  const mc = msColorMap[normaliseStatus(ms.status)] || '#94A3B8';
                  return `<div title="${ms.title} · ${ms.status} · Due: ${DateHelpers.fmt(ms.dueDate)}"
                       style="position:absolute;top:50%;left:${mp}%;transform:translate(-50%,-50%);z-index:6;cursor:default">
                    <div style="width:11px;height:11px;background:${mc};transform:rotate(45deg);border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.2)"></div>
                    <div style="position:absolute;top:14px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:9px;font-weight:700;color:${mc};background:#fff;padding:2px 5px;border-radius:3px;border:1px solid ${mc}50;max-width:88px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 3px rgba(0,0,0,.1)">${ms.title}</div>
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
          ${projects.map(p => {
            const pMs = milestones.filter(m => m.projectId === p.id);
            const ov = pMs.filter(m => normaliseStatus(m.status) === 'Overdue').length;
            return `<tr class="clickable" onclick="nav('project-detail',{id:'${p.id}'})">
              <td style="font-weight:600">${p.name}</td>
              <td>${p.track ? `<span class="badge badge-navy" style="font-size:10px">${p.track}</span>` : '—'}</td>
              <td>${ragBadge(p.status)}</td>
              <td style="font-size:12px;color:#8896B0">${DateHelpers.fmt(p.startDate)}</td>
              <td style="font-size:12px;color:${DateHelpers.isOverdue(p.endDate)&&normaliseStatus(p.status)!=='Completed'?'#DC2626':'#8896B0'}">${DateHelpers.fmt(p.endDate)}</td>
              <td style="min-width:130px">
                <div style="display:flex;align-items:center;gap:8px">
                  ${progressBar(p.progress||0)}
                  <span style="font-size:11px;color:#8896B0">${p.progress||0}%</span>
                </div>
              </td>
              <td style="font-size:12px">${teamName(p.devLead)}</td>
              <td>
                <span style="font-size:12px">${pMs.length}</span>
                ${ov > 0 ? `<span class="badge badge-red" style="font-size:10px;margin-left:4px">${ov} overdue</span>` : ''}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── MILESTONES ────────────────────────────────────────────
export function renderMilestones() {
  const all = APP_STATE.milestones;
  const f = APP_STATE.filters;
  const ms = f.track ? all.filter(m => m.track === f.track) : all;

  const overdue   = ms.filter(m => normaliseStatus(m.status) === 'Overdue');
  const atRisk    = ms.filter(m => normaliseStatus(m.status) === 'At Risk');
  const onTrack   = ms.filter(m => ['On Track','Yet to Start'].includes(normaliseStatus(m.status)));
  const completed = ms.filter(m => normaliseStatus(m.status) === 'Completed');

  function msCard(m) {
    const status = normaliseStatus(m.status);
    const isComplete = status === 'Completed';
    const statusClass = status.toLowerCase().replace(/\s+/g,'-');
    return `<div class="ms-card ${statusClass}">
      <div class="flex-center gap-8" style="margin-bottom:6px">
        <div class="ms-card-title flex-1 ${isComplete?'strikethrough':''}">${m.title}</div>
        ${ragBadge(m.status)}
      </div>
      <div class="ms-card-meta">
        <span>📁 ${m.projectName||'—'}</span>
        <span>📅 ${DateHelpers.fmt(m.dueDate)}</span>
        ${m.track ? `<span>🗂 ${m.track}</span>` : ''}
      </div>
      ${m.revisedETA ? `<div class="small text-amber" style="margin-bottom:6px">⚠️ Revised: ${DateHelpers.fmt(m.revisedETA)}</div>` : ''}
      ${m.delayReason ? `<div class="small text-lt" style="margin-bottom:6px;font-style:italic">${m.delayReason}</div>` : ''}
      ${m.completedDate ? `<div class="small text-green" style="margin-bottom:6px">✅ Done: ${DateHelpers.fmt(m.completedDate)}</div>` : ''}
      <div class="ms-card-actions">
        ${!isComplete ? `<button class="btn btn-teal btn-xs" onclick="markMilestoneComplete('${m.id}')">✓ Complete</button>` : ''}
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
  ${!ms.length ? '<div class="empty-state"><div class="empty-state-icon">🎯</div><div class="empty-state-text">No milestones found</div></div>' : ''}
  ${section('🔴 Overdue', overdue, 'var(--red)')}
  ${section('🟡 At Risk', atRisk, 'var(--amber)')}
  ${section('🔵 On Track / Yet to Start', onTrack, 'var(--blue)')}
  ${section('✅ Completed', completed, 'var(--green)')}`;
}

// ─── PROJECTS ──────────────────────────────────────────────
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
            <td><div style="font-weight:700;color:var(--navy)">${p.name}</div><div class="small text-lt">${p.description||''}</div></td>
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
          </tr>`).join('') : `<tr><td colspan="10" class="empty-state">No projects found</td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── PROJECT DETAIL ────────────────────────────────────────
export async function renderProjectDetail(params) {
  const id = params && params.id;
  const p = APP_STATE.projects.find(x => x.id === id);
  if (!p) return '<div class="empty-state"><div class="empty-state-text">Project not found.</div></div>';

  const pMs     = APP_STATE.milestones.filter(m => m.projectId === id);
  const pRisks  = APP_STATE.risks.filter(r => r.project === p.name);
  const pNotes  = APP_STATE.notes.filter(n => n.entityId === id);
  const pImpact = APP_STATE.impacts.filter(i => i.project === p.name);
  const charter = APP_STATE.charters.find(c => c.projectId === id);
  const jira    = await JiraService.fetch(p.jiraKey);
  const tArr    = teamArr(p.team);

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
        <div class="detail-item"><span class="detail-label">Priority</span><span class="detail-val">${ragBadge(p.priority)}</span></div>
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
        <div class="card-header"><div class="card-title">Jira ${jira.isMock?'<span class="jira-mock">mock</span>':''}</div></div>
        <div class="jira-stats">
          <div class="jira-stat todo"><div class="jstat-num">${jira.todo}</div><div class="jstat-label">To Do</div></div>
          <div class="jira-stat inprogress"><div class="jstat-num">${jira.inProgress}</div><div class="jstat-label">In Progress</div></div>
          <div class="jira-stat done"><div class="jstat-num">${jira.done}</div><div class="jstat-label">Done</div></div>
          <div class="jira-stat total"><div class="jstat-num">${jira.total}</div><div class="jstat-label">Total</div></div>
        </div>
        ${jira.total>0?progressBar(Math.round(jira.done/jira.total*100)):''}
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
        </div>`).join('') : '<div class="small text-lt">No milestones</div>'}
    </div>
    ${charter ? `
    <div class="card">
      <div class="card-header"><div class="card-title">Charter</div><button class="btn btn-ghost btn-sm" onclick="openModal('charter','${charter.id}')">Edit</button></div>
      <div class="detail-label">Sponsor</div><div class="small mb-8">${charter.sponsor||'—'}</div>
      <div class="detail-label">Objectives</div><div style="font-size:13px;margin-bottom:8px">${charter.objectives||'—'}</div>
      <div class="detail-label">Success Criteria</div><div class="small">${charter.successCriteria||'—'}</div>
    </div>` : `
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
        </div>`).join('') : '<div class="small text-lt">No notes yet.</div>'}
    </div>
  </div>`;
}

// ─── ONBOARDING ────────────────────────────────────────────
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
          <tr>
            <td><span class="customer-tag">👤 ${p.customerName||'—'}</span></td>
            <td style="font-weight:700;color:var(--navy)">${p.name}</td>
            <td>${p.track?`<span class="badge badge-navy">${p.track}</span>`:'—'}</td>
            <td>${p.phase||'—'}</td>
            <td>${ragBadge(p.status)}</td>
            <td>${teamName(p.devLead)}</td>
            <td class="small">${DateHelpers.fmt(p.startDate)}</td>
            <td class="small">${DateHelpers.fmt(p.endDate)}</td>
            <td style="min-width:100px">${progressBar(p.progress||0)}<div class="small text-lt mt-4">${p.progress||0}%</div></td>
            <td>${p.jiraKey?`<span class="badge badge-blue">${p.jiraKey}</span>`:'—'}</td>
            <td>
              <button class="btn-icon" onclick="openModal('onboarding','${p.id}')">✏️</button>
              <button class="btn-icon danger" onclick="deleteItem('onboardingProjects','${p.id}')">🗑</button>
            </td>
          </tr>`).join('') : '<tr><td colspan="11" class="empty-state">No onboarding projects</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── WORKFLOWS ─────────────────────────────────────────────
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
  </div>`).join('') : '<div class="empty-state"><div class="empty-state-icon">🔄</div><div class="empty-state-text">No workflows yet</div></div>'}`;
}

// ─── TEAM ──────────────────────────────────────────────────
export function renderTeam() {
  const members = APP_STATE.teamMembers;
  return `
  <div class="view-header">
    <h1 class="view-title">Team</h1>
    <button class="btn btn-primary" onclick="openModal('teamMember')">+ Add Member</button>
  </div>
  <div class="card" style="padding:0">
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Name</th><th>Role</th><th>Track</th><th>Jira ID</th><th>Availability</th><th>Actions</th></tr></thead>
        <tbody>
          ${members.length ? members.map(m=>`
          <tr>
            <td><div class="flex-center gap-8"><div class="chip-avatar">${avatar(m.name)}</div><div style="font-weight:700;color:var(--navy)">${m.name}</div></div></td>
            <td>${m.role||'—'}</td>
            <td>${m.track?`<span class="badge badge-navy">${m.track}</span>`:'—'}</td>
            <td><code style="font-size:12px">${m.jiraId||'—'}</code></td>
            <td><div class="flex-center gap-8">${progressBar(m.availability||100)}<span class="small">${m.availability||100}%</span></div></td>
            <td>
              <button class="btn-icon" onclick="openModal('teamMember','${m.id}')">✏️</button>
              <button class="btn-icon danger" onclick="deleteItem('teamMembers','${m.id}')">🗑</button>
            </td>
          </tr>`).join('') : '<tr><td colspan="6" class="empty-state">No team members</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── CAPACITY ──────────────────────────────────────────────
export function renderCapacity() {
  const members = APP_STATE.teamMembers;
  const f = APP_STATE.filters;
  const projects = f.track ? APP_STATE.projects.filter(p=>p.track===f.track) : APP_STATE.projects;
  return `
  ${filterBar()}
  <div class="view-header">
    <h1 class="view-title">Capacity Planning</h1>
    <button class="btn btn-primary" onclick="openModal('capacity')">Edit Allocations</button>
  </div>
  <div class="card" style="padding:0">
    <div class="capacity-scroll">
      <table class="capacity-table">
        <thead>
          <tr>
            <th class="member-col">Team Member</th>
            <th>Avail.</th>
            ${projects.map(p=>`<th title="${p.name}">${p.name.length>13?p.name.slice(0,13)+'…':p.name}</th>`).join('')}
            <th>Total</th><th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${members.map(m=>{
            const allocs = projects.map(p=>(m.allocations||{})[p.id]||0);
            const total = allocs.reduce((s,a)=>s+a,0);
            const avail = m.availability||100;
            const cls = total>avail?'over':total<60?'under':'ok';
            return `<tr>
              <td class="member-cell">
                <div class="flex-center gap-8">
                  <div class="chip-avatar">${avatar(m.name)}</div>
                  <div><div class="member-name">${m.name}</div><div class="member-role">${m.role||''}</div></div>
                </div>
              </td>
              <td style="text-align:center;font-size:12px">${avail}%</td>
              ${projects.map((p,i)=>{
                const v=allocs[i];
                return `<td class="${v>0?'alloc-active':''}">
                  <div class="alloc-val ${total>avail?'over':''}">${v||0}%</div>
                  ${v>0?`<div class="cap-bar"><div style="width:${Math.min(v,100)}%;background:${total>avail?'var(--coral)':'var(--teal)'}"></div></div>`:''}
                </td>`;
              }).join('')}
              <td style="text-align:center;font-weight:700;color:${total>avail?'var(--red)':total<60?'var(--amber)':'var(--teal)'}">${total}%</td>
              <td><span class="util-badge ${cls}">${cls==='over'?'Over':cls==='under'?'Under':'OK'}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── RESOURCE TRACKING ─────────────────────────────────────
export function renderResources() {
  const members = APP_STATE.teamMembers;
  const resources = APP_STATE.resources;
  const f = APP_STATE.filters;
  const today = DateHelpers.today();
  const days = [];
  for (let i=6; i>=0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate()-i);
    days.push(d.toISOString().split('T')[0]);
  }
  function getLog(memberId,date){ return resources.find(r=>r.memberId===memberId&&r.date===date); }
  function isCrossTrack(memberId,date){
    const logs=resources.filter(r=>r.memberId===memberId&&r.date===date);
    return [...new Set(logs.map(r=>r.track).filter(Boolean))].length>1;
  }
  const filtMembers = f.track ? members.filter(m=>m.track===f.track) : members;
  return `
  ${filterBar()}
  <div class="view-header">
    <h1 class="view-title">Resource Tracking <span class="view-subtitle">Last 7 days · Click cell to log</span></h1>
    <button class="btn btn-primary" onclick="openModal('resource')">+ Log Hours</button>
  </div>
  <div class="card" style="padding:0">
    <div class="resource-grid">
      <table class="resource-table">
        <thead>
          <tr>
            <th class="member-col">Member</th>
            ${days.map(d=>`<th>${DateHelpers.fmtShort(d)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${filtMembers.map(m=>`
          <tr>
            <td class="member-cell"><div>${m.name}</div><div class="small text-lt">${m.track||'—'}</div></td>
            ${days.map(d=>{
              const log=getLog(m.id,d);
              const cross=isCrossTrack(m.id,d);
              return `<td class="resource-cell ${cross?'cross-track':''}" onclick="openModal('resource','${m.id}','${d}')">
                ${log?`<div class="resource-hours">${log.hours}h</div><div class="resource-track">${log.track||''}</div>`:'<div style="font-size:11px;color:var(--text-lt)">—</div>'}
              </td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── RISKS ─────────────────────────────────────────────────
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
          }).join('') : '<tr><td colspan="10" class="empty-state">No risks logged</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── ESCALATIONS ───────────────────────────────────────────
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
  </div>`).join('') : '<div class="empty-state"><div class="empty-state-icon">🚨</div><div class="empty-state-text">No escalations</div></div>'}`;
}

// ─── LEADERSHIP REPORT ─────────────────────────────────────
export function renderLeadership() {
  const projects = APP_STATE.projects;
  const milestones = APP_STATE.milestones;
  const risks = APP_STATE.risks;
  const overdue = milestones.filter(m=>normaliseStatus(m.status)==='Overdue');
  const atRisk  = milestones.filter(m=>normaliseStatus(m.status)==='At Risk');
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
              <td style="font-weight:600">${p.name}</td><td>${p.track||'—'}</td><td>${p.phase||'—'}</td>
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
              <td style="font-weight:600">${m.title}</td><td class="small">${m.projectName||'—'}</td>
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

// ─── IMPACTS ───────────────────────────────────────────────
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
            <td style="font-weight:600">${i.project}</td>
            <td>${i.metric}</td>
            <td class="small text-lt">${i.baseline}</td>
            <td style="font-weight:700;color:var(--navy)">${i.current}</td>
            <td class="small">${i.target}</td>
            <td><span class="badge badge-green">${i.improvement}</span></td>
            <td class="small text-lt">${i.notes||'—'}</td>
            <td>
              <button class="btn-icon" onclick="openModal('impact','${i.id}')">✏️</button>
              <button class="btn-icon danger" onclick="deleteItem('impacts','${i.id}')">🗑</button>
            </td>
          </tr>`).join('') : '<tr><td colspan="8" class="empty-state">No impact data</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── CHARTERS ──────────────────────────────────────────────
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
    </div>`).join('') : '<div class="empty-state"><div class="empty-state-icon">📄</div><div class="empty-state-text">No charters yet</div></div>'}
  </div>`;
}

// ─── SETTINGS ──────────────────────────────────────────────
export function renderSettings() {
  const s = APP_STATE.settings;
  const jira = JiraService.getConfig();
  const members = APP_STATE.teamMembers;
  return `
  <div class="view-header">
    <h1 class="view-title">Admin Settings</h1>
  </div>
  <div class="settings-tabs">
    <div class="settings-tab active" onclick="switchSettingsTab('dropdowns',this)">Dropdowns</div>
    <div class="settings-tab" onclick="switchSettingsTab('jira',this)">Jira Integration</div>
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
      <div class="card-title mb-16">Jira Configuration</div>
      <div class="form-group"><label class="form-label">Base URL</label><input class="form-control" id="jira-baseUrl" value="${jira.baseUrl}" placeholder="https://yourorg.atlassian.net"/></div>
      <div class="form-group"><label class="form-label">Email</label><input class="form-control" id="jira-email" value="${jira.email}"/></div>
      <div class="form-group"><label class="form-label">API Token</label><input class="form-control" type="password" id="jira-token" value="${jira.token}"/></div>
      <button class="btn btn-primary" onclick="saveJiraConfig()">Save Jira Config</button>
    </div>
    <div class="card mt-16">
      <div class="card-title mb-16">Team → Jira User Mapping</div>
      <table class="data-table">
        <thead><tr><th>Team Member</th><th>Jira User ID</th></tr></thead>
        <tbody>${members.map(m=>`
          <tr><td>${m.name}</td><td><input class="form-control" value="${m.jiraId||''}" onchange="updateJiraMapping('${m.id}',this.value)" placeholder="jira.user.id"/></td></tr>`).join('')}
        </tbody>
      </table>
    </div>
  </div>
  <div id="settingsTab-wf-cfg" style="display:none">
    <div class="card"><div class="small text-lt">Manage workflow templates from the <a href="#" onclick="nav('workflows');return false" style="color:var(--navy)">Workflows tab</a>.</div></div>
  </div>`;
}