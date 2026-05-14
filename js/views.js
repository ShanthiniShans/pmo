// ============================================================
// VIEWS.JS — All View Renderers (Klarion Design System)
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
    'Completed':'badge-green','Yet to Start':'badge-grey','On Hold':'badge-grey',
    'In Progress':'badge-teal','Open':'badge-red','Resolved':'badge-green',
    'Mitigated':'badge-amber','High':'badge-red','Medium':'badge-amber',
    'Low':'badge-green','Critical':'badge-red'
  };
  return `<span class="badge ${map[status]||'badge-grey'}">${status||'—'}</span>`;
}

function progressBar(pct) {
  const c = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#ef4444';
  return `<div class="pb"><div class="pb-fill" style="width:${Math.min(pct||0,100)}%;background:${c}"></div></div>`;
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

function resolveTrackName(trackIdOrName) {
  if (!trackIdOrName) return '—';
  const byId = APP_STATE.tracks.find(t => t.id === trackIdOrName);
  if (byId) return byId.name || byId.title || trackIdOrName;
  const byName = APP_STATE.tracks.find(t =>
    (t.name || t.title || '').toLowerCase() === trackIdOrName.toLowerCase()
  );
  if (byName) return byName.name || byName.title || trackIdOrName;
  return trackIdOrName;
}

function calcProjectProgress(projectId, projectName) {
  const ms = APP_STATE.milestones.filter(m =>
    (projectId && m.projectId === projectId) ||
    (projectName && (m.projectName === projectName || m.project === projectName))
  );
  if (!ms.length) return null;
  const completed = ms.filter(m => (m.status||'').toLowerCase().includes('complet')).length;
  let totalTasks = 0, completedTasks = 0;
  ms.forEach(m => {
    const tasks = m.tasks || [];
    totalTasks += tasks.length;
    completedTasks += tasks.filter(t => t.done || t.completed ||
      (t.status||'').toLowerCase().includes('complet')).length;
  });
  if (totalTasks > 0) {
    const msProgress = completed / ms.length;
    const taskProgress = completedTasks / totalTasks;
    return Math.round((msProgress * 0.6 + taskProgress * 0.4) * 100);
  }
  return Math.round((completed / ms.length) * 100);
}

function projProgress(p) {
  return calcProjectProgress(p.id, p.name) ?? p.progress ?? 0;
}

function filterProjects(projects) {
  const f = APP_STATE.filters;
  return projects.filter(p => {
    // Year filter
    if (f.year) {
      const sy = p.startDate ? new Date(p.startDate).getFullYear() : 0;
      const ey = p.endDate   ? new Date(p.endDate).getFullYear()   : 0;
      if (sy !== f.year && ey !== f.year) return false;
    }
    // Quarter filter
    if (f.quarter) {
      const qMap = { Q1:[1,3], Q2:[4,6], Q3:[7,9], Q4:[10,12] };
      const [qs, qe] = qMap[f.quarter] || [1,12];
      const sm = p.startDate ? new Date(p.startDate).getMonth()+1 : 0;
      const em = p.endDate   ? new Date(p.endDate).getMonth()+1   : 0;
      if (!((sm>=qs&&sm<=qe)||(em>=qs&&em<=qe))) return false;
    }
    // Track filter
    if (f.track && f.track !== 'all') {
      const pTrack = p.track||p.trackId||'';
      if (pTrack !== f.track && resolveTrackName(pTrack) !== f.track) return false;
    }
    // Date range filter
    if (f.startDate && p.endDate) {
      if (new Date(p.endDate) < new Date(f.startDate)) return false;
    }
    if (f.endDate && p.startDate) {
      if (new Date(p.startDate) > new Date(f.endDate)) return false;
    }
    return true;
  });
}

function filterBar() {
  const f = APP_STATE.filters;
  const tracks = APP_STATE.settings.trackNames || ['Track 1','Track 2','Track 3'];
  const hasActive = f.quarter || f.track || f.startDate || f.endDate;

  function pill(label, key, val, active) {
    return `<button onclick="window._filterChange('${key}','${active?'':val}')"
      style="padding:3px 11px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1.5px solid ${active?'#1B2B5E':'#DDE3EE'};background:${active?'#1B2B5E':'#fff'};color:${active?'#fff':'#64748B'};font-family:'DM Sans',sans-serif;transition:all .15s;white-space:nowrap;line-height:1.6">${label}</button>`;
  }

  function sep() {
    return `<div style="width:1px;height:20px;background:#E2E8F0;flex-shrink:0"></div>`;
  }

  return `<div class="no-print" style="display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:10px 16px;background:#F8FAFC;border:1px solid #EEF2F8;border-radius:10px;margin-bottom:20px">
    <div style="display:flex;align-items:center;gap:6px">
      <span style="font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.07em">Year</span>
      <div style="display:flex;gap:3px">
        ${[2026,2027].map(y=>pill(y,'year',y,f.year==y)).join('')}
      </div>
    </div>
    ${sep()}
    <div style="display:flex;align-items:center;gap:6px">
      <span style="font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.07em">Quarter</span>
      <div style="display:flex;gap:3px">
        ${['Q1','Q2','Q3','Q4'].map(q=>pill(q,'quarter',q,f.quarter===q)).join('')}
      </div>
    </div>
    ${sep()}
    <div style="display:flex;align-items:center;gap:6px">
      <span style="font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.07em">Track</span>
      <select onchange="window._filterChange('track',this.value)"
        style="font-size:11px;font-weight:600;padding:3px 24px 3px 10px;border-radius:20px;border:1.5px solid ${f.track?'#1B2B5E':'#DDE3EE'};background:${f.track?'#1B2B5E':'#fff'};color:${f.track?'#fff':'#64748B'};cursor:pointer;font-family:'DM Sans',sans-serif;appearance:none;-webkit-appearance:none;outline:none">
        <option value="">All Tracks</option>
        ${tracks.map(t=>`<option value="${t}" ${f.track===t?'selected':''}>${t}</option>`).join('')}
      </select>
    </div>
    ${sep()}
    <div style="display:flex;align-items:center;gap:6px">
      <span style="font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.07em">From</span>
      <input type="date" value="${f.startDate||''}" onchange="window._filterChange('startDate',this.value)"
        style="font-size:11px;padding:3px 10px;border-radius:20px;border:1.5px solid ${f.startDate?'#1B2B5E':'#DDE3EE'};color:${f.startDate?'#1B2B5E':'#94A3B8'};font-family:'DM Sans',sans-serif;background:#fff;outline:none"/>
      <span style="font-size:10px;font-weight:700;color:#94A3B8;text-transform:uppercase;letter-spacing:.07em">To</span>
      <input type="date" value="${f.endDate||''}" onchange="window._filterChange('endDate',this.value)"
        style="font-size:11px;padding:3px 10px;border-radius:20px;border:1.5px solid ${f.endDate?'#1B2B5E':'#DDE3EE'};color:${f.endDate?'#1B2B5E':'#94A3B8'};font-family:'DM Sans',sans-serif;background:#fff;outline:none"/>
    </div>
    ${hasActive ? `${sep()}<button onclick="window._filterReset()"
      style="padding:3px 12px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:1.5px solid #FCA5A5;background:#FEF2F2;color:#EF4444;font-family:'DM Sans',sans-serif;transition:all .15s">× Reset</button>` : ''}
  </div>`;
}

const TRACK_COLORS = {'Track 1':'#1B2B5E','Track 2':'#00A896','Track 3':'#E8452C'};

function recentMilestoneNotesSection() {
  const allNotes = [];
  (APP_STATE.milestones||[]).forEach(m => {
    if (m.notes || m.description) {
      allNotes.push({ type:'milestone', milestoneTitle:m.title||m.name, projectName:m.projectName||m.project||'', projectId:m.projectId, note:m.notes||m.description, date:m.updatedAt||m.createdAt||m.dueDate||'', status:m.status });
    }
    (m.tasks||[]).forEach(t => {
      if (t.notes && t.notes.trim()) {
        allNotes.push({ type:'task', milestoneTitle:m.title||m.name, taskName:t.name, projectName:m.projectName||m.project||'', projectId:m.projectId, note:t.notes, date:m.updatedAt||m.dueDate||'', done:t.done, owner:t.owner });
      }
    });
  });
  const latestNotes = allNotes
    .sort((a,b) => new Date(b.date) - new Date(a.date))
    .slice(0, 9);
  return `<div style="margin-top:24px">
    <div style="font-size:14px;font-weight:800;color:var(--navy);margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--border)">
      📝 Recent Milestone Notes
      <span style="font-size:11px;font-weight:400;color:var(--lt);margin-left:8px">Latest updates across all projects</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
      ${latestNotes.length ? latestNotes.map(item=>`
      <div style="background:var(--white);border:1px solid var(--border);border-radius:var(--r);padding:14px;box-shadow:var(--sh);border-left:3px solid ${item.done?'#22c55e':item.type==='milestone'?'var(--teal)':'var(--navy)'}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
          <span style="font-size:10px;font-weight:700;color:var(--lt);text-transform:uppercase;letter-spacing:.5px">${item.type==='task'?'TASK NOTE':'MILESTONE'}</span>
          ${item.date?`<span style="font-size:10px;color:var(--lt)">${item.date.toString().slice(0,10)}</span>`:''}
        </div>
        <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:3px;cursor:pointer" onclick="nav('project-detail',{id:'${item.projectId||''}'})">
          ${item.projectName||'—'}
        </div>
        <div style="font-size:11px;color:var(--mid);margin-bottom:6px">🎯 ${item.milestoneTitle}${item.taskName?' › '+item.taskName:''}</div>
        <div style="font-size:12px;color:var(--text);font-style:italic;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">"${item.note}"</div>
        ${item.owner?`<div style="font-size:10px;color:var(--lt);margin-top:6px">👤 ${item.owner}</div>`:''}
      </div>`).join('') : `<div style="grid-column:1/-1" class="empty"><div class="empty-icon">📝</div>No milestone notes yet. Add notes to tasks inside milestones to see them here.</div>`}
    </div>
  </div>`;
}

// ─── SHARED STAT BLOCK (used across all tabs) ─────────────
function statBlock(n, lbl, sub, col) {
  const on = n > 0;
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:18px 12px;gap:3px;border-right:1px solid var(--border);flex:1;min-width:0">
    <span style="font-size:30px;font-weight:800;color:${on?col:'#D1C9E0'};line-height:1">${n}</span>
    <span style="font-size:11px;font-weight:700;color:${on?col:'#D1C9E0'};margin-top:2px">${lbl}</span>
    ${sub?`<span style="font-size:10px;color:var(--lt);text-align:center;line-height:1.3;margin-top:1px">${sub}</span>`:''}
  </div>`;
}
function statRow(blocks) {
  return `<div class="card" style="overflow:hidden;padding:0;margin-bottom:20px">
    <div style="display:flex">${blocks}</div>
  </div>`;
}

// ─── STAGE HELPER (shared by Clarity + Pulse) ─────────────
const STATUS_TO_STAGE = {
  'Yet to Start':'Idea','On Hold':'Brief Draft','At Risk':'3-Way Scope',
  'On Track':'Ready to Build','In Progress':'In Progress',
  'Completed':'Released','Overdue':'In Progress',
};
function stageOf(p) {
  if (p.stage) return p.stage;
  return STATUS_TO_STAGE[normaliseStatus(p.status||'')] || 'Idea';
}

// ─── MILESTONE DETAIL POPOVER ─────────────────────────────
window._showMsDetail = function(msId, event) {
  event.stopPropagation();
  document.querySelectorAll('.ms-popover').forEach(el=>el.remove());
  const ms = APP_STATE.milestones.find(m=>m.id===msId);
  if (!ms) return;
  const STATUS_COLOR = {'Completed':'#059669','Overdue':'#DC2626','At Risk':'#D97706','On Track':'#2563EB','Yet to Start':'#94A3B8','On Hold':'#6B7280'};
  const sc = STATUS_COLOR[ms.status]||'#94A3B8';
  const tasks = ms.tasks||[];
  const pop = document.createElement('div');
  pop.className = 'ms-popover';
  pop.style.cssText = 'position:fixed;z-index:9999;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.15);padding:16px;min-width:240px;max-width:300px;font-family:"DM Sans",sans-serif';
  const taskList = (tasks).filter(t => t && t.name);
  pop.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <div style="width:10px;height:10px;background:${sc};border-radius:50%;flex-shrink:0"></div>
      <div style="font-size:13px;font-weight:700;color:#1B2B5E;flex:1">${ms.title}</div>
      <button onclick="this.closest('.ms-popover').remove()" style="border:none;background:none;cursor:pointer;color:#94a3b8;font-size:16px;line-height:1;padding:0">×</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
      <span style="font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;background:${sc}18;color:${sc}">${ms.status||'—'}</span>
      ${ms.dueDate?`<span style="font-size:10px;color:#64748b;padding:2px 6px;background:#f1f5f9;border-radius:20px">📅 ${ms.dueDate}</span>`:''}
    </div>
    ${taskList.length>0?`
    <div style="border-top:1px solid #f1f5f9;padding-top:10px">
      <div style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Tasks (${taskList.filter(t=>t.done).length}/${taskList.length} complete)</div>
      ${taskList.map(t=>`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
        <span style="width:14px;height:14px;border-radius:50%;background:${t.done?'#22c55e':'var(--border-dk)'};display:inline-flex;align-items:center;justify-content:center;font-size:8px;color:white;flex-shrink:0">${t.done?'✓':''}</span>
        <span style="font-size:12px;${t.done?'text-decoration:line-through;color:var(--lt)':''}">${t.name||''}</span>
      </div>`).join('')}
    </div>`:''}
    ${ms.notes?`<div style="margin-top:10px;font-size:11px;color:#64748b;border-top:1px solid #f1f5f9;padding-top:8px">${ms.notes}</div>`:''}
    <div style="margin-top:10px;display:flex;gap:6px">
      <button onclick="openModal('milestone','${ms.id}');this.closest('.ms-popover').remove()" style="font-size:11px;padding:4px 10px;border-radius:5px;border:1px solid #e2e8f0;background:#fff;cursor:pointer;color:#1B2B5E;font-family:inherit">Edit</button>
    </div>`;
  const rect = event.target.getBoundingClientRect();
  pop.style.left = Math.min(rect.left, window.innerWidth - 320) + 'px';
  pop.style.top = (rect.bottom + 8) + 'px';
  document.body.appendChild(pop);
  setTimeout(()=>{ document.addEventListener('click', function h(e){ if(!pop.contains(e.target)){pop.remove();document.removeEventListener('click',h);} }); }, 100);
};

// ─── EXEC BANNER ──────────────────────────────────────────
function execBanner(active) {
  const steps = [
    { view:'team',     label:'Team',                 desc:'Members & roles',             num:1 },
    { view:'capacity', label:'Capacity & Resources', desc:'Allocation + hour tracking',  num:2 }
  ];
  // Internal sub-tabs shown inside Capacity & Resources
  const capTab = APP_STATE._capTab || 'allocation';
  const subLinks = active==='capacity'
    ? `<div style="display:flex;gap:4px;margin-left:8px">
        <span onclick="switchTab('_capTab','allocation')" style="font-size:10px;padding:2px 8px;border-radius:10px;cursor:pointer;background:${capTab==='allocation'?'rgba(0,168,150,.35)':'rgba(255,255,255,.08)'};color:#fff;font-weight:600">Allocation</span>
        <span onclick="switchTab('_capTab','timelog')" style="font-size:10px;padding:2px 8px;border-radius:10px;cursor:pointer;background:${capTab==='timelog'?'rgba(0,168,150,.35)':'rgba(255,255,255,.08)'};color:#fff;font-weight:600">Time Log</span>
      </div>`
    : '';
  return `<div class="exec-banner">
    ${steps.map((s,i)=>`
      ${i>0?`<div class="exec-arrow">›</div>`:''}
      <div class="exec-step-card ${active===s.view||active==='resources'&&s.view==='capacity'?'active':''}" onclick="nav('${s.view}')">
        <div class="exec-step-num">${s.num}</div>
        <div class="exec-step-info">
          <div class="exec-step-title" style="display:flex;align-items:center;gap:4px">${s.label}${s.view==='capacity'?subLinks:''}</div>
          <div class="exec-step-desc">${s.desc}</div>
        </div>
      </div>`).join('')}
  </div>`;
}

// ─── DASHBOARD ────────────────────────────────────────────
export function renderDashboard() {
  try {
  const today     = DateHelpers.today();
  const projects  = APP_STATE.projects.map(p=>({...p, name:p.name||p.title||'Unnamed', status:normaliseStatus(p.status||p.rag||'')}));
  const milestones= APP_STATE.milestones.map(m=>({...m, title:m.title||m.name||'Unnamed', status:normaliseStatus(m.status||m.rag||'')}));
  const risks     = APP_STATE.risks;
  const escs      = APP_STATE.escalations || [];
  const pledges   = APP_STATE.pledges || [];
  const total     = projects.length;
  const inProg    = projects.filter(p=>p.status==='In Progress').length;
  const completed = projects.filter(p=>p.status==='Completed').length;
  const atRiskProj= projects.filter(p=>['At Risk','Overdue'].includes(p.status)).length;
  const overdueMilestones = milestones.filter(m=>m.dueDate<today&&m.status!=='Completed');
  const openRisks  = risks.filter(r=>normaliseStatus(r.status)==='Open');
  const openEsc    = escs.filter(e=>normaliseStatus(e.status||'Open')==='Open');
  const highRisks  = openRisks.filter(r=>(r.likelihood||1)*(r.impact||1)>=7);
  const openEscL34 = escs.filter(e=>['L3','L4'].includes(e.level||'')&&normaliseStatus(e.status||'Open')!=='Resolved');
  const activeTab = APP_STATE._pulseTab || 'flags';

  // ── Auto-surfaced flags ─────────────────────────────────
  const flagsA = overdueMilestones.map(m=>({ type:'high', label:'OVERDUE MILESTONE', title:m.title, sub:`${m.projectName||'—'} · ${teamName(m.ownerId)||'—'}`, detail:`${DateHelpers.daysBetween(m.dueDate,today)}d overdue`, action:`nav('milestones')` }));
  const flagsB = pledges.filter(p=>p.status==='Breached'||(p.dueDate&&p.dueDate<today&&p.status!=='Honored')).map(p=>({ type:'high', label:'BREACHED PLEDGE', title:p.title||'—', sub:p.customer||'—', detail:p.dueDate&&p.dueDate<today?`${DateHelpers.daysBetween(p.dueDate,today)}d overdue`:'Breached', action:`nav('pledges')` }));
  const flagsC = openRisks.filter(r=>(r.likelihood||1)*(r.impact||1)>=7).map(r=>({ type:'high', label:'HIGH RISK', title:r.title, sub:`${r.project||'—'} · Score ${(r.likelihood||1)*(r.impact||1)}`, detail:r.owner||'—', action:`nav('risks')` }));
  const flagsD = openEsc.filter(e=>['L3','L4'].includes(e.level||'')).map(e=>({ type:'high', label:'ESCALATION '+e.level, title:e.project||'—', sub:e.title||e.issue||'—', detail:e.date?`${DateHelpers.daysBetween(e.date,today)}d open`:'Open', action:`nav('escalations')` }));
  const flagsE = milestones.filter(m=>m.status==='At Risk'&&(!m.dueDate||m.dueDate>=today)).map(m=>({ type:'med', label:'AT RISK', title:m.title, sub:m.projectName||'—', detail:DateHelpers.fmt(m.dueDate), action:`nav('milestones')` }));
  const flagsF = openRisks.filter(r=>{ const s=(r.likelihood||1)*(r.impact||1); return s>=4&&s<7; }).map(r=>({ type:'med', label:'MEDIUM RISK', title:r.title, sub:r.project||'—', detail:'Score '+(r.likelihood||1)*(r.impact||1), action:`nav('risks')` }));
  const allFlags = [...flagsA,...flagsB,...flagsC,...flagsD,...flagsE,...flagsF];
  const openFlagsCount = allFlags.length;

  function flagCard(f) {
    const labelCol = f.type==='high' ? '#dc2626' : '#d97706';
    return `<div class="flag-card ${f.type}" onclick="${f.action}" style="cursor:pointer">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
        <span class="flag-type" style="background:${labelCol}18;color:${labelCol}">${f.label}</span>
        <span style="font-size:13px;font-weight:700;color:var(--navy);flex:1">${f.title}</span>
        ${f.detail?`<span style="font-size:11px;font-weight:700;color:${f.type==='high'?'#dc2626':'#d97706'};white-space:nowrap">${f.detail}</span>`:''}
      </div>
      ${f.sub?`<div style="font-size:11px;color:var(--lt)">${f.sub}</div>`:''}
    </div>`;
  }

  // ── Stat row (always visible) ────────────────────────────
  function statItem(n, lbl, col, clickable) {
    const style = `display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 10px;gap:3px;border-right:1px solid var(--border);flex:1;min-width:0${clickable?';cursor:pointer':''}`;
    const click = clickable ? `onclick="switchTab('_pulseTab','flags')"` : '';
    return `<div style="${style}" ${click}>
      <span style="font-size:26px;font-weight:800;color:${n>0?col:'#D1C9E0'};line-height:1">${n}</span>
      <span style="font-size:10px;font-weight:700;color:${n>0?col:'#D1C9E0'};text-align:center;line-height:1.3">${lbl}</span>
    </div>`;
  }

  const statRowHtml = `<div class="card" style="overflow:hidden;padding:0;margin-bottom:16px">
    <div style="display:flex;overflow-x:auto">
      ${statItem(total,'Total Projects','var(--navy)',false)}
      ${statItem(inProg,'In Progress','#1282a0',false)}
      ${statItem(completed,'Completed','#059669',false)}
      ${statItem(atRiskProj,'At Risk','#d97706',false)}
      ${statItem(overdueMilestones.length,'Overdue Milestones','#dc2626',true)}
      ${statItem(openFlagsCount,'Open Flags','#dc2626',true)}
    </div>
  </div>`;

  // ── Health tab ───────────────────────────────────────────
  function healthTab() {
    const tracks = APP_STATE.settings.trackNames || ['Track 1','Track 2','Track 3'];
    const TC = { 'Track 1':'#1B2B5E','Track 2':'#00A896','Track 3':'#E8452C' };
    const onTrackMs = milestones.filter(m=>['On Track','Yet to Start'].includes(m.status)).length;
    const atRiskMs  = milestones.filter(m=>m.status==='At Risk').length;
    const overdueMs = overdueMilestones.length;
    const msTotal   = onTrackMs + atRiskMs + overdueMs;
    const msBar = msTotal > 0 ? `
      <div class="card" style="margin-bottom:14px">
        <div class="card-title">Milestone Health</div>
        <div style="display:flex;height:14px;border-radius:6px;overflow:hidden;margin-bottom:8px">
          ${onTrackMs>0?`<div style="flex:${onTrackMs};background:#22c55e;transition:flex .3s"></div>`:''}
          ${atRiskMs>0?`<div style="flex:${atRiskMs};background:#f59e0b"></div>`:''}
          ${overdueMs>0?`<div style="flex:${overdueMs};background:#ef4444"></div>`:''}
        </div>
        <div style="display:flex;gap:14px;font-size:11px">
          <span style="color:#16a34a;font-weight:600">✅ ${onTrackMs} on track</span>
          <span style="color:#d97706;font-weight:600">⚠️ ${atRiskMs} at risk</span>
          <span style="color:#dc2626;font-weight:600">🔴 ${overdueMs} overdue</span>
        </div>
      </div>` : '';
    const trackTable = tracks.length ? `
      <div class="card" style="margin-bottom:14px">
        <div class="card-title">Track Utilisation</div>
        <div class="tbl-wrap">
          <table class="dt">
            <thead><tr><th>Track</th><th>Members</th><th>Projects</th><th>Avg Allocation</th><th>Signal</th></tr></thead>
            <tbody>
              ${tracks.map(track=>{
                const tm  = APP_STATE.teamMembers.filter(m=>m.track===track);
                const tp  = projects.filter(p=>p.track===track);
                const avgAlloc = tm.length ? Math.round(tm.reduce((s,m)=>s+(m.availability||100),0)/tm.length) : 0;
                const signal = avgAlloc>85?`<span style="color:#dc2626;font-weight:700">⚠️ Overloaded</span>`:overdueMs>0?`<span style="color:#d97706;font-weight:700">⚠️ Delays</span>`:`<span style="color:#16a34a;font-weight:700">✅ Healthy</span>`;
                return `<tr>
                  <td style="font-weight:700;color:${TC[track]||'var(--navy)'}">● ${track}</td>
                  <td>${tm.length}</td>
                  <td>${tp.length}</td>
                  <td>${avgAlloc}%</td>
                  <td>${signal}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>` : `<div class="empty"><div class="empty-icon">🏷️</div>No tracks configured</div>`;
    const ragGrid = `<div class="card">
      <div class="card-title">Project RAG Status</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
        ${projects.length ? projects.map(p=>`
          <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;cursor:pointer" onclick="nav('project-detail',{id:'${p.id}'})">
            <span class="proj-link" style="font-size:13px;display:block;margin-bottom:4px">${p.name}</span>
            <div style="font-size:11px;color:var(--lt);margin-bottom:6px">${resolveTrackName(p.track||p.trackId)||'—'} · ${p.phase||'—'}</div>
            ${progressBar(projProgress(p))}
            <div style="display:flex;align-items:center;gap:6px;margin-top:4px">${ragBadge(p.status)}<span style="font-size:11px;color:var(--lt)">${DateHelpers.fmt(p.endDate)}</span></div>
          </div>`).join('') : `<div class="empty"><div class="empty-icon">📋</div>No projects</div>`}
      </div>
    </div>`;
    return msBar + trackTable + ragGrid;
  }

  // ── Activity & Insights tab ──────────────────────────────
  function timeAgo(dateStr) {
    if (!dateStr) return '';
    const d = typeof dateStr.toMillis === 'function' ? new Date(dateStr.toMillis()) : new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const diff = (new Date() - d) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff/60)+'m ago';
    if (diff < 86400) return Math.floor(diff/3600)+'h ago';
    if (diff < 604800) return Math.floor(diff/86400)+'d ago';
    return d.toLocaleDateString('en-GB',{day:'numeric',month:'short'});
  }

  function activityTab() {
    const toMs = d => d && typeof d.toMillis==='function' ? d.toMillis() : new Date(d).getTime()||0;
    const items = [
      ...milestones.map(m=>({ icon:'🎯', label:m.title, proj:m.projectName||'—', date:m.updatedAt||m.createdAt||m.dueDate||'', status:m.status, projId:m.projectId })),
      ...(risks).map(r=>({ icon:'⚠️', label:r.title, proj:r.project||'—', date:r.updatedAt||r.createdAt||'', status:r.status, projId:null })),
      ...(escs).map(e=>({ icon:'🚨', label:e.title||'Escalation', proj:e.project||'—', date:e.date||e.createdAt||'', status:e.status, projId:null })),
      ...(pledges).map(p=>({ icon:'🤝', label:p.title||'Pledge', proj:p.customer||'—', date:p.updatedAt||p.createdAt||p.dueDate||'', status:p.status, projId:null }))
    ].filter(x=>x.date).sort((a,b)=>toMs(b.date)-toMs(a.date)).slice(0,20);

    // ── Insights ──
    const now2 = new Date();
    const weekAgo2 = new Date(now2); weekAgo2.setDate(weekAgo2.getDate()-7);
    const twoWeeksAgo = new Date(now2); twoWeeksAgo.setDate(twoWeeksAgo.getDate()-14);
    const wsStr2 = weekAgo2.toISOString().split('T')[0];
    const twStr  = twoWeeksAgo.toISOString().split('T')[0];

    const msCompThisWeek = milestones.filter(m=>m.status==='Completed'&&(m.completedDate||'')>=wsStr2).length;
    const msCompLastWeek = milestones.filter(m=>m.status==='Completed'&&(m.completedDate||'')>=twStr&&(m.completedDate||'')<wsStr2).length;
    const velocityDelta  = msCompLastWeek>0 ? Math.round((msCompThisWeek-msCompLastWeek)/msCompLastWeek*100) : 0;
    const velocityUp     = msCompThisWeek >= msCompLastWeek;

    const newRisksWk   = risks.filter(r=>(r.createdAt||r.date||'')>=wsStr2).length;
    const highRisksOpen = openRisks.filter(r=>(r.likelihood||1)*(r.impact||1)>=7).length;
    const closedRisksWk = risks.filter(r=>(r.closedAt||'')>=wsStr2&&r.status!=='Open').length;
    const monthStart2    = new Date(now2.getFullYear(),now2.getMonth(),1).toISOString().split('T')[0];
    const msTotal2 = milestones.length||1;
    const onTrackMs2 = milestones.filter(m=>!(m.dueDate<today&&m.status!=='Completed')&&m.status!=='Completed').length;
    const onTrackPct = Math.round((msTotal2-overdueMilestones.length)/msTotal2*100);
    const overloaded2  = (APP_STATE.teamMembers||[]).filter(m=>(m.capacity||m.availability||80)>100).length;
    const atCap2       = (APP_STATE.teamMembers||[]).filter(m=>{const c=m.capacity||m.availability||80;return c>=80&&c<=100;}).length;
    const avgUtil2     = members2 => members2.length ? Math.round(members2.reduce((s,m)=>s+(m.capacity||m.availability||80),0)/members2.length) : 0;
    const avgU = avgUtil2(APP_STATE.teamMembers||[]);

    const in7d = new Date(now2); in7d.setDate(in7d.getDate()+7);
    const in7dStr = in7d.toISOString().split('T')[0];
    const msNext7 = milestones.filter(m=>m.dueDate>=today&&m.dueDate<=in7dStr&&m.status!=='Completed');
    const pledgesNext7 = pledges.filter(p=>p.dueDate>=today&&p.dueDate<=in7dStr&&p.status!=='Honored');
    const nearestDeadline = [...msNext7,...pledgesNext7].sort((a,b)=>(a.dueDate||'')>(b.dueDate||'')?1:-1)[0];

    const topBlocker = openEscL34.sort((a,b)=>{
      const la = parseInt((a.level||'L0').slice(1)||0);
      const lb = parseInt((b.level||'L0').slice(1)||0);
      return lb-la;
    })[0] || highRisks.sort((a,b)=>(b.likelihood||1)*(b.impact||1)-(a.likelihood||1)*(a.impact||1))[0];

    const projectsBehind = projects.filter(p=>p.endDate<today&&normaliseStatus(p.status)!=='Completed').length;

    const insights = [
      {
        title:'🚀 Sprint Velocity',
        cls: velocityUp?'good':'danger',
        metric: msCompThisWeek,
        body:`${msCompThisWeek} milestones completed this week vs ${msCompLastWeek} last week${msCompLastWeek>0?` — <strong style="color:${velocityUp?'#22c55e':'#ef4444'}">${velocityUp?'↑':'↓'} ${Math.abs(velocityDelta)}%</strong>`:''}.`
      },
      {
        title:'⚠️ Risk Trend',
        cls: highRisksOpen>3?'danger':'warn',
        metric: highRisksOpen,
        body:`${newRisksWk} new risks this week. ${highRisksOpen} high-priority risks open. ${closedRisksWk} risks closed this month.`
      },
      {
        title:'📊 Delivery Health',
        cls: onTrackPct>=80?'good':onTrackPct>=60?'warn':'danger',
        metric: onTrackPct+'%',
        body:`${onTrackPct}% milestones on track. ${projectsBehind} projects behind schedule.`
      },
      {
        title:'👥 Capacity',
        cls: overloaded2>0?'warn':'good',
        metric: avgU+'%',
        body:`${overloaded2} team members overallocated. ${atCap2} at capacity. ${avgU}% avg team utilisation.`
      },
      {
        title:'🔴 Top Blocker',
        cls:'danger',
        metric: topBlocker ? (topBlocker.level||'Risk') : '—',
        body: topBlocker ? `<strong>${topBlocker.title||topBlocker.project||'—'}</strong> · ${topBlocker.project||topBlocker.projectName||'—'}` : 'No critical blockers.'
      },
      {
        title:'📅 Next 7 Days',
        cls: msNext7.length>5?'warn':'good',
        metric: msNext7.length,
        body:`${msNext7.length} milestones due. ${pledgesNext7.length} pledges due.${nearestDeadline?` Critical: <strong>${nearestDeadline.title||nearestDeadline.name||'—'}</strong> on ${DateHelpers.fmt(nearestDeadline.dueDate)}.`:''}`
      }
    ];

    return `
    <div style="font-size:15px;font-weight:800;color:var(--navy);margin-bottom:12px">Programme Insights</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      ${insights.map(ins=>`<div class="insight-card ${ins.cls}">
        <div class="insight-title">${ins.title}</div>
        <div class="insight-metric">${ins.metric}</div>
        <div class="insight-body">${ins.body}</div>
      </div>`).join('')}
    </div>
    <div style="font-size:15px;font-weight:800;color:var(--navy);margin-bottom:12px">Recent Activity</div>
    <div class="card">
      ${items.length ? items.map(a=>`
        <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:16px;flex-shrink:0">${a.icon}</span>
          <div style="flex:1;min-width:0">
            <span style="font-size:13px;font-weight:600;color:var(--navy)">${a.label}</span>
            <span style="font-size:11px;color:var(--lt)"> · ${a.proj}</span>
          </div>
          ${a.status?ragBadge(a.status):''}
          <span style="font-size:11px;color:var(--lt);flex-shrink:0;margin-left:6px">${timeAgo(a.date)}</span>
        </div>`).join('') : `<div class="empty"><div class="empty-icon">📝</div>No recent activity</div>`}
    </div>`;
  }

  return `
  <div class="vh">
    <div class="vh-left">
      <h1>Pulse</h1>
      <div class="sub">Programme health at a glance</div>
    </div>
  </div>
  ${statRowHtml}
  <div class="card" style="padding:0">
    <div class="pulse-tabs" style="padding:0 16px">
      <button class="pt ${activeTab==='flags'?'active':''}"  onclick="switchTab('_pulseTab','flags')">🚩 Flags${openFlagsCount>0?` (${openFlagsCount})`:''}</button>
      <button class="pt ${activeTab==='health'?'active':''}" onclick="switchTab('_pulseTab','health')">❤️ Health</button>
      <button class="pt ${activeTab==='activity'?'active':''}" onclick="switchTab('_pulseTab','activity')">⚡ Activity &amp; Insights</button>
    </div>
    <div style="padding:14px 16px">
      ${activeTab==='flags' ? (allFlags.length
          ? allFlags.map(flagCard).join('')
          : `<div class="card" style="border:2px solid #22c55e;background:#f0fdf4;text-align:center;padding:24px"><div style="font-size:22px;margin-bottom:6px">✅</div><div style="font-size:14px;font-weight:700;color:#15803d">All clear — no open flags</div></div>`)
        : activeTab==='health' ? healthTab()
        : activityTab()}
    </div>
  </div>`;
  } catch(e) {
    console.error('renderDashboard error:', e);
    return `<div class="empty"><div class="empty-icon">⚠️</div><div style="color:#ef4444;font-weight:600">Error: ${e.message}</div><div style="font-size:11px;color:var(--lt);margin-top:6px">Check console for details</div></div>`;
  }
}

// ─── TRACKS / CLARITY ────────────────────────────────────
export function renderTracks() {
  const projects    = APP_STATE.projects;
  const tracks      = APP_STATE.settings.trackNames || ['Track 1','Track 2','Track 3'];
  const f           = APP_STATE.filters;
  const activeTrack = f.track || 'All';
  const filtered    = activeTrack === 'All' ? projects : projects.filter(p => resolveTrackName(p.track||p.trackId) === activeTrack);

  const STAGES = [
    { label:'Idea',           color:'#94A3B8', desc:'Capture the problem and a PM owner.' },
    { label:'Brief Draft',    color:'#1282a0', desc:'Write the brief. Link it and assign an SME.' },
    { label:'3-Way Scope',    color:'#D97706', desc:'PM + SME + Eng align. Resolve all questions.' },
    { label:'Ready to Build', color:'#1e8a4a', desc:'Gate cleared. Waiting to be picked up.' },
    { label:'In Progress',    color:'#7C3AED', desc:'In active development. Log updates regularly.' },
    { label:'Released',       color:'#059669', desc:'Shipped. SME should sign off within 30 days.' },
    { label:'Observation',    color:'#2563EB', desc:'Post-release watch. Done when SME signs off.' },
  ];

  return `
  <div class="vh">
    <div class="vh-left">
      <h1>Clarity</h1>
      <div class="sub">Feature pipeline · ${filtered.length} project${filtered.length!==1?'s':''}</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="openModal('project')">+ New Project</button>
    </div>
  </div>

  <div style="width:100%">
  <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none;margin-bottom:14px;-webkit-overflow-scrolling:touch">
    ${['All',...tracks].map(t => {
      const isActive = activeTrack === t;
      const cnt = t==='All' ? projects.length : projects.filter(p=>p.track===t).length;
      const col = t==='All' ? '#1B2B5E' : (TRACK_COLORS[t]||'#1B2B5E');
      return `<button onclick="window._filterChange('track','${t==='All'?'':t}')"
        style="padding:5px 14px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:2px solid ${isActive?col:'var(--border)'};background:${isActive?col:'#fff'};color:${isActive?'#fff':col};font-family:'DM Sans',sans-serif;transition:all .15s;flex-shrink:0">
        ${t} (${cnt})
      </button>`;
    }).join('')}
  </div>
  <style>.clarity-track-tabs::-webkit-scrollbar{display:none}</style>

  <div style="overflow-x:auto;overflow-y:visible;width:100%;padding-bottom:24px;-webkit-overflow-scrolling:touch">
    <div style="display:flex;gap:14px;min-width:fit-content;align-items:flex-start">
    ${STAGES.map(stage => {
      const colProjects = filtered.filter(p => stageOf(p) === stage.label);
      return `
      <div style="width:272px;flex-shrink:0;background:var(--bg);border-radius:var(--r)">
        <div style="padding:10px 12px;background:var(--bg);border-radius:var(--r) var(--r) 0 0;border-bottom:1px solid var(--border);border-top:3px solid ${stage.color}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-weight:700;font-size:12px;color:var(--navy)">${stage.label}</span>
            <span style="font-size:11px;font-weight:700;color:${stage.color};background:${stage.color}18;border-radius:980px;padding:1px 8px">${colProjects.length}</span>
          </div>
          <div style="font-size:11px;color:var(--lt);line-height:1.4">${stage.desc}</div>
        </div>
        <div style="padding:8px;display:flex;flex-direction:column;gap:8px;min-height:100px">
        ${colProjects.length === 0
          ? `<div style="padding:16px 12px;border-radius:10px;background:rgba(0,0,0,.02);border:1px dashed var(--border);text-align:center"><span style="font-size:12px;color:var(--lt)">Empty</span></div>`
          : colProjects.map(p => {
              const devM = APP_STATE.teamMembers.find(m => m.id === p.devLead);
              const daysInStage = p.stageChangedAt
                ? Math.floor((Date.now() - new Date(p.stageChangedAt).getTime()) / 86400000)
                : p.statusChangedAt
                  ? Math.floor((Date.now() - new Date(p.statusChangedAt).getTime()) / 86400000)
                  : null;
              const stale = daysInStage !== null && daysInStage >= 14 && stage.label !== 'Released' && stage.label !== 'Observation';
              return `<div class="card" style="padding:12px 14px;cursor:pointer;border-radius:10px;transition:box-shadow .15s" onclick="nav('project-detail',{id:'${p.id}'})" onmouseover="this.style.boxShadow='0 4px 16px rgba(27,43,94,.13)'" onmouseout="this.style.boxShadow=''">
                <span class="proj-link" style="font-size:13px;display:block;margin-bottom:6px;line-height:1.3">${p.name||p.title||'Unnamed'}</span>
                <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
                  ${p.track||p.trackId?`<span class="badge badge-navy" style="font-size:10px">${resolveTrackName(p.track||p.trackId)}</span>`:''}
                  ${p.phase?`<span class="badge badge-grey" style="font-size:10px">${p.phase}</span>`:''}
                  ${p.priority?ragBadge(p.priority):''}
                  ${stale?`<span class="badge badge-amber" style="font-size:10px" title="Days in this stage">${daysInStage}d</span>`:''}
                </div>
                ${progressBar(projProgress(p))}
                <div style="display:flex;align-items:center;margin-top:6px;gap:6px">
                  ${devM?`<div class="av av-sm" style="background:${TRACK_COLORS[devM.track]||'var(--navy)'}">${avatar(devM.name)}</div><span style="font-size:11px;color:var(--lt);flex:1">${devM.name}</span>`:'<span style="flex:1"></span>'}
                  ${p.endDate?`<span style="font-size:10px;color:${DateHelpers.isOverdue(p.endDate)&&stage.label!=='Released'&&stage.label!=='Observation'?'#ef4444':'var(--lt)'}">${DateHelpers.fmt(p.endDate)}</span>`:''}
                </div>
              </div>`;
            }).join('')
        }
        </div>
      </div>`;
    }).join('')}
    </div>
  </div>
  </div>`;
}

// ─── ROADMAP ──────────────────────────────────────────────
export function renderRoadmap() {
  const f = APP_STATE.filters;
  const year = parseInt(f.year) || 2026;
  const projects = filterProjects(APP_STATE.projects).sort((a,b)=>{ const da=a.startDate||''; const db=b.startDate||''; return da<db?-1:da>db?1:0; });
  const milestones = [...APP_STATE.milestones].sort((a,b)=>{ const da=a.dueDate||''; const db=b.dueDate||''; return da<db?-1:da>db?1:0; });

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

  const STATUS_COLOR = {
    'In Progress':'#1B2B5E','On Track':'#2563EB','At Risk':'#D97706',
    'Overdue':'#DC2626','Completed':'#059669','Yet to Start':'#94A3B8','On Hold':'#6B7280'
  };
  const MS_COLOR = {'Completed':'#059669','Overdue':'#DC2626','At Risk':'#D97706','On Track':'#2563EB'};
  const TC = ['#1B2B5E','#00A896','#E8452C','#7C3AED'];
  const BAR_COLORS = [
    '#1B2B5E','#00A896','#7c3aed','#E8452C','#059669',
    '#F59E0B','#3b82f6','#ec4899','#14b8a6','#f97316'
  ];

  // Build track→color map once before rendering
  const trackColorMap = {};
  (APP_STATE.tracks||[]).forEach((t, i) => {
    trackColorMap[t.id] = BAR_COLORS[i % BAR_COLORS.length];
    trackColorMap[t.name||t.title] = BAR_COLORS[i % BAR_COLORS.length];
  });
  trackColorMap['onboarding'] = '#7c3aed';

  function getProjectBarColor(p) {
    const key = p.trackId || p.track || '';
    return trackColorMap[key] ||
      trackColorMap[resolveTrackName(key)] ||
      '#1B2B5E';
  }

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
    const left  = +((cs - rangeStart.getTime()) / 86400000 / totalDays * 100).toFixed(2);
    const width = Math.max(0.5, +((ce - cs) / 86400000 / totalDays * 100).toFixed(2));
    return { left, width };
  }

  const todayPct    = Math.max(0, Math.min(100, (new Date() - rangeStart) / (rangeEnd - rangeStart) * 100));
  const uniqueTracks = [...new Set(projects.map(p => resolveTrackName(p.track||p.trackId) || 'Unassigned'))];
  const gridLines   = months.map((_,i) => i===0 ? '' :
    `<div style="position:absolute;top:0;bottom:0;left:${(i/months.length*100).toFixed(2)}%;width:1px;background:#EEF2F8;pointer-events:none;z-index:1"></div>`
  ).join('');
  const todayLine   = `<div class="today-line" style="left:${todayPct.toFixed(2)}%"></div>`;

  return `
  ${filterBar()}
  <div class="vh">
    <div class="vh-left">
      <h1>Product Roadmap</h1>
      <div class="sub">${year}${f.quarter?' · '+f.quarter:' · Full Year'}</div>
    </div>
  </div>

  <div class="gantt-wrap" style="overflow-x:auto">
    <div class="gantt-hdr">
      <div class="gantt-hdr-lbl">Project</div>
      <div class="gantt-timeline" style="display:flex">
        ${months.map(m=>`<div style="flex:1;padding:9px 0;text-align:center;font-size:9px;font-weight:700;color:var(--lt);text-transform:uppercase;border-left:1px solid #EEF2F8">${DateHelpers.monthName(m)}</div>`).join('')}
      </div>
    </div>
    ${uniqueTracks.length === 0 ? `<div class="empty"><div class="empty-icon">📋</div>No projects match current filters.</div>` :
      uniqueTracks.map((track,ti) => {
        const tc    = TC[ti % TC.length];
        const tProj = projects.filter(p=>(resolveTrackName(p.track||p.trackId)||'Unassigned')===track);
        return `<div class="gantt-seg-hdr" style="background:${tc}0D;border-left:4px solid ${tc};border-top:2px solid #F0EEF4;border-bottom:1px solid ${tc}28;min-width:900px">
          <div class="gantt-seg-name" style="color:${tc};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em">${track} <span style="font-weight:400;color:${tc}88;text-transform:none;letter-spacing:0">— ${tProj.length} project${tProj.length!==1?'s':''}</span></div>
          <div style="border-left:1px solid var(--border);position:relative;min-height:32px">${gridLines}${todayLine}</div>
        </div>
        ${tProj.map((p,pi) => {
          if (!p.startDate || !p.endDate) return '';
          const bar   = barRange(p.startDate, p.endDate);
          const pMs   = milestones.filter(m=>m.projectId===p.id);
          const color = getProjectBarColor(p);
          return `<div class="gantt-row">
            <div class="gantt-lbl" onclick="nav('project-detail',{id:'${p.id}'})">
              <span class="proj-link gantt-feat-name">${p.name}</span>
              <div class="gantt-feat-sub" style="display:flex;align-items:center;gap:6px">
                ${ragBadge(p.status)}
                <span>${projProgress(p)}%</span>
                ${p.devLead?`<span>· ${teamName(p.devLead)}</span>`:''}
              </div>
            </div>
            <div class="gantt-bar-area" style="position:relative;border-left:1px solid var(--border)">
              ${gridLines}${todayLine}
              ${bar?`<div class="g-bar" title="${p.name}" style="left:${bar.left}%;width:${bar.width}%;background:${color}">
                <div style="position:absolute;top:0;left:0;height:100%;width:${projProgress(p)}%;background:rgba(255,255,255,.22);border-radius:4px 0 0 4px"></div>
                ${bar.width>5?`<div class="g-bar-lbl">${projProgress(p)}%</div>`:''}
              </div>`:''}
              ${pMs.map(ms=>{
                const mp = datePct(ms.dueDate);
                if (mp===null) return '';
                const mc = MS_COLOR[normaliseStatus(ms.status)]||'#94A3B8';
                return `<div title="${ms.title} · ${ms.status}" style="position:absolute;top:50%;left:${mp}%;transform:translate(-50%,-50%);z-index:6;cursor:pointer" onclick="window._showMsDetail('${ms.id}',event)">
                  <div style="width:12px;height:12px;background:${mc};border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25);transition:transform .15s" onmouseover="this.style.transform='scale(1.4)'" onmouseout="this.style.transform=''"></div>
                  <div style="position:absolute;top:15px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:9px;font-weight:700;color:${mc};background:#fff;padding:2px 5px;border-radius:3px;border:1px solid ${mc}50;max-width:90px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 3px rgba(0,0,0,.1);pointer-events:none">${ms.title}</div>
                </div>`;
              }).join('')}
            </div>
          </div>`;
        }).join('')}`;
      }).join('')}
    ${(() => {
      const onb = (APP_STATE.onboardingProjects||[]).filter(p=>p.startDate||p.endDate).sort((a,b)=>{ const da=a.startDate||''; const db=b.startDate||''; return da<db?-1:da>db?1:0; });
      if (!onb.length) return '';
      return `<div class="gantt-seg-hdr" style="background:#7c3aed0D;border-left:4px solid #7c3aed;border-top:2px solid #F0EEF4;border-bottom:1px solid #7c3aed28">
        <div class="gantt-seg-name" style="color:#7c3aed;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em">── ONBOARDING PROJECTS ── <span style="font-weight:400;color:#7c3aed88;text-transform:none;letter-spacing:0">— ${onb.length} project${onb.length!==1?'s':''}</span></div>
        <div style="border-left:1px solid var(--border);position:relative;min-height:32px">${gridLines}${todayLine}</div>
      </div>
      ${onb.map(p => {
        const bar = barRange(p.startDate, p.endDate);
        return `<div class="gantt-row">
          <div class="gantt-lbl" onclick="nav('onboarding-detail',{id:'${p.id}'})">
            <span class="proj-link gantt-feat-name" style="color:#7c3aed">${p.name||p.customerName}</span>
            <div class="gantt-feat-sub" style="display:flex;align-items:center;gap:6px">
              ${ragBadge(p.status)}
              <span>${projProgress(p)}%</span>
            </div>
          </div>
          <div class="gantt-bar-area" style="position:relative;border-left:1px solid var(--border)">
            ${gridLines}${todayLine}
            ${bar?`<div class="g-bar" title="${p.name||p.customerName}" style="left:${bar.left}%;width:${bar.width}%;background:#7c3aed">
              <div style="position:absolute;top:0;left:0;height:100%;width:${projProgress(p)}%;background:rgba(255,255,255,.22);border-radius:4px 0 0 4px"></div>
              ${bar.width>5?`<div class="g-bar-lbl">${projProgress(p)}%</div>`:''}
            </div>`:''}
          </div>
        </div>`;
      }).join('')}`;
    })()}
  </div>

`;
}

// ─── MILESTONES ───────────────────────────────────────────
export function renderMilestones() {
  const fp   = APP_STATE._msFilterProject || '';
  const ft   = APP_STATE._msFilterTrack   || '';
  const fo   = APP_STATE._msFilterOwner   || '';
  const fs   = (APP_STATE._msFilterSearch || '').toLowerCase().trim();
  const today = DateHelpers.today();

  function applyMilestoneFilters(milestones) {
    let filtered = [...milestones];
    if (fp) {
      filtered = filtered.filter(m => m.projectId === fp || m.projectName === fp || m.project === fp);
    }
    if (ft) {
      const trackProjects = [...(APP_STATE.projects||[]),...(APP_STATE.onboardingProjects||[])]
        .filter(p => p.track === ft || p.trackId === ft || resolveTrackName(p.track||p.trackId) === ft)
        .map(p => p.id);
      filtered = filtered.filter(m => trackProjects.includes(m.projectId) || trackProjects.includes(m.project));
    }
    if (fo) {
      filtered = filtered.filter(m => (m.owner||'').toLowerCase() === fo.toLowerCase() || m.ownerId === fo);
    }
    if (fs) {
      filtered = filtered.filter(m =>
        (m.title||m.name||'').toLowerCase().includes(fs) ||
        (m.projectName||m.project||'').toLowerCase().includes(fs)
      );
    }
    return filtered;
  }

  const ms = applyMilestoneFilters(APP_STATE.milestones || [])
    .sort((a,b) => { if(!a.dueDate) return 1; if(!b.dueDate) return -1; return a.dueDate > b.dueDate ? 1 : -1; });

  function isOverdueNow(m) {
    return m.dueDate && m.dueDate < today && normaliseStatus(m.status) !== 'Completed';
  }
  function isCompleted(m) {
    return (m.status||'').toLowerCase().includes('complet');
  }
  function laneFor(m) {
    const s = normaliseStatus(m.status);
    if (isCompleted(m)) return 'done';
    if (isOverdueNow(m)) return 'overdue';
    if (s === 'At Risk') return 'atrisk';
    if (s === 'In Progress' || s === 'On Track') return 'inprog';
    return 'yts';
  }
  function taskProgress(m) {
    const tasks = m.tasks || [];
    if (!tasks.length) return null;
    const done = tasks.filter(t => t.done).length;
    return { done, total: tasks.length, pct: Math.round(done / tasks.length * 100) };
  }
  function msCard(m) {
    const lane = laneFor(m);
    const tp   = taskProgress(m);
    const trackName = resolveTrackName(m.track) || m.track || '';
    return `<div class="ms-card ${lane}" data-ms-id="${m.id}" onclick="openMilestoneDrawer('${m.id}')">
      <div class="ms-card-title">${m.title}</div>
      <div class="ms-card-meta">
        ${m.projectName ? `<span>📁 ${m.projectName}</span>` : ''}
        ${trackName ? `<span class="badge badge-navy" style="font-size:9px">${trackName}</span>` : ''}
      </div>
      <div class="ms-card-meta" style="margin-top:4px">
        <span>📅 ${DateHelpers.fmt(m.dueDate)}</span>
        ${m.owner ? `<span>👤 ${m.owner}</span>` : ''}
      </div>
      ${tp ? `<div class="ms-task-bar">
        <div class="ms-task-progress"><div class="ms-task-progress-fill" style="width:${tp.pct}%"></div></div>
        <span class="ms-task-count">${tp.done}/${tp.total} tasks</span>
      </div>` : ''}
      <div style="display:flex;gap:4px;margin-top:8px" onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-xs" onclick="openModal('milestone','${m.id}')">Edit</button>
        <button class="btn btn-danger btn-xs" onclick="deleteItem('milestones','${m.id}')">🗑</button>
      </div>
    </div>`;
  }

  const lanes = [
    { key:'yts',     title:'Yet to Start', borderColor:'', headerColor:'', items: ms.filter(m=>laneFor(m)==='yts') },
    { key:'inprog',  title:'In Progress',  borderColor:'', headerColor:'', items: ms.filter(m=>laneFor(m)==='inprog') },
    { key:'atrisk',  title:'At Risk',      borderColor:'#f59e0b', headerColor:'#d97706', items: ms.filter(m=>laneFor(m)==='atrisk') },
    { key:'overdue', title:'Overdue',      borderColor:'#ef4444', headerColor:'#dc2626', items: ms.filter(m=>laneFor(m)==='overdue') },
    { key:'done',    title:'Completed',    borderColor:'#22c55e', headerColor:'#15803d', items: ms.filter(m=>laneFor(m)==='done') },
  ];

  const allProjects = [...(APP_STATE.projects||[]), ...(APP_STATE.onboardingProjects||[])];
  const owners = [...new Set((APP_STATE.milestones||[]).map(m=>m.owner).filter(Boolean))].sort();
  const activeFilterCount = [fp,ft,fo,fs].filter(Boolean).length;

  const filterSection = `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px">
    <select class="form-control" style="width:160px;font-size:12px" onchange="setMsFilter('_msFilterProject',this.value)">
      <option value="">All Projects</option>
      ${allProjects.map(p=>`<option value="${p.id}" ${fp===p.id?'selected':''}>${p.name||p.customerName}</option>`).join('')}
    </select>
    <select class="form-control" style="width:130px;font-size:12px" onchange="setMsFilter('_msFilterTrack',this.value)">
      <option value="">All Tracks</option>
      ${(APP_STATE.tracks||[]).map(t=>`<option value="${t.name||t.id}" ${(ft===t.name||ft===t.id)?'selected':''}>${t.name||t.title}</option>`).join('')}
    </select>
    <select class="form-control" style="width:130px;font-size:12px" onchange="setMsFilter('_msFilterOwner',this.value)">
      <option value="">All Owners</option>
      ${owners.map(o=>`<option value="${o}" ${fo===o?'selected':''}>${o}</option>`).join('')}
    </select>
    <input class="form-control" style="width:160px;font-size:12px" placeholder="Search…" value="${APP_STATE._msFilterSearch||''}" oninput="setMsFilter('_msFilterSearch',this.value)"/>
    ${activeFilterCount>0?`<span class="badge badge-teal" style="font-size:11px">${activeFilterCount} active</span><button class="btn btn-ghost btn-sm" onclick="APP_STATE._msFilterProject='';APP_STATE._msFilterTrack='';APP_STATE._msFilterOwner='';APP_STATE._msFilterSearch='';navigateTo(APP_STATE.currentView,APP_STATE.currentParams)">Reset</button>`:''}
  </div>`;

  const kanbanView = `<div style="overflow-x:auto;overflow-y:visible;width:100%;padding-bottom:20px">
    <div style="display:grid;grid-template-columns:repeat(5,minmax(220px,1fr));gap:12px;min-width:1100px;overflow:visible">
    ${lanes.map(l => `<div style="background:var(--bg);border-radius:var(--r);border:1px solid var(--border);${l.borderColor?`border-color:${l.borderColor}`:''}">
      <div class="kanban-lane-hdr" style="${l.headerColor?`color:${l.headerColor}`:''}">
        <span class="kanban-lane-title">${l.title}</span>
        <span class="kanban-lane-count">${l.items.length}</span>
      </div>
      <div style="padding:8px;display:flex;flex-direction:column;gap:8px">
      ${l.items.map(msCard).join('') || `<div style="font-size:11px;color:var(--lt);padding:12px 0;text-align:center">Empty</div>`}
      </div>
    </div>`).join('')}
    </div>
  </div>`;


  return `
  <div class="vh">
    <div class="vh-left">
      <h1>Milestones</h1>
      <div class="sub">${ms.length} milestone${ms.length!==1?'s':''} shown${activeFilterCount>0?' (filtered)':''}</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="openModal('milestone')">+ Add Milestone</button>
    </div>
  </div>
  ${filterSection}
  ${kanbanView}`;
}

// ─── PROJECTS ─────────────────────────────────────────────
export function renderProjects() {
  const projects = filterProjects(APP_STATE.projects)
    .sort((a,b)=>{ const da=a.endDate||a.startDate||''; const db=b.endDate||b.startDate||''; return da<db?-1:da>db?1:0; });
  const total     = projects.length;
  const inProg    = projects.filter(p=>normaliseStatus(p.status)==='In Progress').length;
  const completed = projects.filter(p=>normaliseStatus(p.status)==='Completed').length;
  const atRisk    = projects.filter(p=>['At Risk','Overdue'].includes(normaliseStatus(p.status))).length;

  return `
  ${filterBar()}
  <div class="vh">
    <div class="vh-left">
      <h1>All Projects</h1>
      <div class="sub">${total} projects</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="openModal('project')">+ New Project</button>
    </div>
  </div>

  ${statRow(
    statBlock(total,'Total','all projects','var(--navy)') +
    statBlock(inProg,'In Progress','currently active','#7C3AED') +
    statBlock(completed,'Completed','signed off','#059669') +
    statBlock(atRisk,'At Risk / Overdue','needs attention','#DC2626')
  )}

  <div class="card" style="padding:0">
    <div class="tbl-wrap">
      <table class="dt">
        <thead><tr><th>Project</th><th>Track</th><th>Priority</th><th>Phase</th><th>Progress</th><th>Status</th><th>Start</th><th>End</th><th>Actions</th></tr></thead>
        <tbody>
          ${projects.length ? projects.map(p=>`
          <tr class="clk ${normaliseStatus(p.status)==='Completed'?'done':''}" onclick="nav('project-detail',{id:'${p.id}'})">
            <td>
              <span class="proj-link">${p.name||p.title||'Unnamed'}</span>
              <div style="font-size:11px;color:var(--lt)">${p.description||''}</div>
            </td>
            <td>${p.track||p.trackId?`<span class="badge badge-navy">${resolveTrackName(p.track||p.trackId)}</span>`:'—'}</td>
            <td>${ragBadge(p.priority)}</td>
            <td style="font-size:12px">${p.phase||'—'}</td>
            <td style="min-width:110px">
              ${progressBar(projProgress(p))}
              <div style="font-size:11px;color:var(--lt);margin-top:3px">${projProgress(p)}%</div>
            </td>
            <td>${ragBadge(p.status)}</td>
            <td style="font-size:12px;color:var(--lt)">${DateHelpers.fmt(p.startDate)}</td>
            <td style="font-size:12px;color:${DateHelpers.isOverdue(p.endDate)&&normaliseStatus(p.status)!=='Completed'?'#ef4444':'var(--lt)'}">${DateHelpers.fmt(p.endDate)}</td>
            <td onclick="event.stopPropagation()">
              <button class="btn-icon" onclick="openModal('project','${p.id}')">✏️</button>
              <button class="btn-icon" onclick="deleteItem('projects','${p.id}')">🗑</button>
            </td>
          </tr>`).join(''):`<tr><td colspan="9"><div class="empty"><div class="empty-icon">📋</div>No projects found</div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── PROJECT DETAIL ───────────────────────────────────────
export async function renderProjectDetail(params) {
  const id = params && params.id;
  const p  = APP_STATE.projects.find(x=>x.id===id);
  if (!p) return `<div class="empty"><div class="empty-icon">❌</div>Project not found.</div>`;

  const today    = DateHelpers.today();
  const pMs      = APP_STATE.milestones.filter(m=>m.projectId===id||m.projectName===p.name);
  const charter  = APP_STATE.charters.find(c=>c.projectId===id||c.projectName===p.name);
  const pRisks   = APP_STATE.risks.filter(r=>r.projectId===id||r.project===p.name);
  const pEscs    = APP_STATE.escalations.filter(e=>e.projectId===id||e.project===p.name);
  const trackMembers = APP_STATE.teamMembers.filter(m=>m.track===p.track||teamArr(p.team).includes(m.id));
  const jira     = await JiraService.fetch(p.jiraKey);
  const tArr     = teamArr(p.team);
  const activeTab = APP_STATE._detailTab || 'overview';

  function tabBtn(key, label) {
    return `<button class="pt ${activeTab===key?'active':''}" onclick="switchTab('_detailTab','${key}')">${label}</button>`;
  }

  // ── TAB 1: Overview ──
  function tabOverview() {
    const metrics = charter?.metrics || [];
    const charterBlock = charter
      ? `<div style="background:#f8faff;border:1px solid var(--border);border-radius:var(--rs);padding:14px;margin-top:12px">
           <div style="font-size:11px;font-weight:700;color:var(--lt);text-transform:uppercase;margin-bottom:8px">Charter Metrics</div>
           ${metrics.length ? `<div class="chip-row">${metrics.map(m=>`
             <div class="tag" style="font-size:11px">${m.label||m.name||'—'}: <span style="color:var(--lt);margin:0 4px">${m.baseline||'—'}</span>→<span style="color:var(--teal);margin-left:4px;font-weight:700">${m.target||'—'}</span></div>`).join('')}</div>` :
             `<div style="font-size:12px;color:var(--mid)">${charter.objectives||'No metrics defined'}</div>`}
           <div style="margin-top:8px;display:flex;gap:6px">
             <button class="btn btn-ghost btn-xs" onclick="openModal('charter','${charter.id}')">Edit Charter</button>
           </div>
         </div>`
      : `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:var(--rs);padding:12px;margin-top:12px;display:flex;align-items:center;gap:10px">
           <span style="font-size:18px">📋</span>
           <div style="flex:1"><div style="font-size:12px;font-weight:700;color:#92400e">No charter yet</div><div style="font-size:11px;color:#a16207">Define objectives and success metrics</div></div>
           <button class="btn btn-ghost btn-xs" onclick="openModal('charter',null,'${id}')">Create Charter</button>
         </div>`;
    const msNotesCards = pMs.map(m => {
      const tasksWithNotes = (m.tasks||[]).filter(t => t.notes && t.notes.trim());
      const msNote = m.notes || m.description || '';
      if (!tasksWithNotes.length && !msNote) return '';
      return `<div style="border:1px solid var(--border);border-left:3px solid var(--teal);border-radius:var(--rs);padding:12px 14px;margin-bottom:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:13px;font-weight:700;color:var(--navy)">${m.title||m.name}</span>
          <span class="badge ${(m.status||'').toLowerCase().includes('complet')?'badge-teal':'badge-amber'}">${m.status||''}</span>
        </div>
        ${msNote?`<div style="font-size:12px;color:var(--mid);font-style:italic;margin-bottom:6px;padding:6px 10px;background:var(--bg);border-radius:var(--rs)">${msNote}</div>`:''}
        ${tasksWithNotes.map(t=>`<div style="display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-top:1px solid var(--border)">
          <span style="width:14px;height:14px;border-radius:50%;flex-shrink:0;margin-top:2px;background:${t.done?'#22c55e':'var(--border-dk)'};display:inline-flex;align-items:center;justify-content:center;font-size:8px;color:white">${t.done?'✓':''}</span>
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--text);${t.done?'text-decoration:line-through;':''}">${t.name||''}</div>
            <div style="font-size:11px;color:var(--lt);font-style:italic;margin-top:2px">${t.notes}</div>
          </div>
        </div>`).join('')}
      </div>`;
    }).join('');

    const msNotesSection = msNotesCards.replace(/\s/g,'')
      ? `<div class="card" style="margin-top:0">
          <div style="font-size:11px;font-weight:800;color:var(--lt);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">Milestone Notes &amp; Updates</div>
          ${msNotesCards}
        </div>`
      : '';

    return `
      <div class="card">
        <div class="card-title">Description</div>
        <div style="font-size:13px;color:var(--text)">${p.description||'<span style="color:var(--lt)">No description provided.</span>'}</div>
        ${p.objectives?`<div style="font-size:10px;font-weight:700;color:var(--lt);text-transform:uppercase;margin-top:12px;margin-bottom:4px">Objectives</div><div style="font-size:13px">${p.objectives}</div>`:''}
        ${p.stakeholders?`<div style="font-size:10px;font-weight:700;color:var(--lt);text-transform:uppercase;margin-top:12px;margin-bottom:4px">Stakeholders</div><div style="font-size:13px">${p.stakeholders}</div>`:''}
        ${charterBlock}
      </div>
      ${msNotesSection}`;
  }

  // ── TAB 2: Milestones ──
  function tabMilestones() {
    const sorted = [...pMs].sort((a,b)=>{ if(!a.dueDate) return 1; if(!b.dueDate) return -1; return a.dueDate>b.dueDate?1:-1; });
    const onTrack = sorted.filter(m=>['On Track','Yet to Start'].includes(normaliseStatus(m.status))).length;
    const atRisk  = sorted.filter(m=>normaliseStatus(m.status)==='At Risk').length;
    const overdue = sorted.filter(m=>normaliseStatus(m.status)==='Overdue').length;
    return `
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="card-title" style="margin-bottom:0">Milestones (${sorted.length})</div>
          <button class="btn btn-ghost btn-sm" onclick="openModal('milestone',null,'${id}')">+ Add Milestone</button>
        </div>
        ${sorted.length ? `
        <div style="display:flex;gap:12px;margin-bottom:12px;font-size:11px">
          <span style="color:#16a34a;font-weight:700">✅ ${onTrack} on track</span>
          <span style="color:#d97706;font-weight:700">⚠️ ${atRisk} at risk</span>
          <span style="color:#dc2626;font-weight:700">🔴 ${overdue} overdue</span>
        </div>
        <div class="tbl-wrap">
          <table class="dt">
            <thead><tr><th>Milestone</th><th>Due Date</th><th>Status</th><th>Owner</th><th>Timing</th><th>Tasks</th><th>Actions</th></tr></thead>
            <tbody>
              ${sorted.map(m=>{
                const daysLeft = m.dueDate ? DateHelpers.daysBetween(today, m.dueDate) : null;
                const isOverdue = daysLeft !== null && daysLeft < 0 && normaliseStatus(m.status)!=='Completed';
                const timing = daysLeft===null ? '—' : normaliseStatus(m.status)==='Completed' ? `<span style="color:#16a34a">✓ Done</span>` :
                  isOverdue ? `<span style="color:#dc2626;font-weight:700">${Math.abs(daysLeft)}d overdue</span>` :
                  daysLeft <= 3 ? `<span style="color:#d97706;font-weight:700">${daysLeft}d left</span>` :
                  `<span style="color:var(--lt)">${daysLeft}d left</span>`;
                const mTasks = m.tasks || [];
                const mDone  = mTasks.filter(t=>t.done).length;
                return `<tr>
                  <td style="font-weight:600;color:var(--navy)">${m.title}</td>
                  <td style="font-size:12px;${isOverdue?'color:#dc2626':''}">${DateHelpers.fmt(m.dueDate)}</td>
                  <td>${ragBadge(m.status)}</td>
                  <td style="font-size:12px">${m.owner||teamName(m.ownerId)||'—'}</td>
                  <td>${timing}</td>
                  <td style="font-size:12px">${mTasks.length ? `● ${mDone}/${mTasks.length} complete` : '—'}</td>
                  <td onclick="event.stopPropagation()">
                    <button class="btn btn-ghost btn-xs" onclick="openMilestoneDrawer('${m.id}')">Tasks (${mTasks.length})</button>
                    ${normaliseStatus(m.status)!=='Completed'?`<button class="btn-icon" onclick="markMilestoneComplete('${m.id}')">✓</button>`:''}
                    <button class="btn-icon" onclick="openModal('milestone','${m.id}','${id}')">✏️</button>
                    <button class="btn-icon" onclick="deleteItem('milestones','${m.id}')">🗑</button>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>` : `<div class="empty"><div class="empty-icon">🎯</div>No milestones yet</div>`}
      </div>`;
  }

  // ── TAB 3: Risks & Escalations ──
  function tabRisks() {
    return `
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="card-title" style="margin-bottom:0">Risks (${pRisks.length})</div>
          <button class="btn btn-ghost btn-sm" onclick="openModal('risk')">+ Add Risk</button>
        </div>
        ${pRisks.length ? pRisks.map(r=>{
          const score = (r.likelihood||1)*(r.impact||1);
          const cls = score>=12?'score-h':score>=6?'score-m':'score-l';
          return `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg);border-radius:var(--rs);margin-bottom:8px">
            <span class="risk-score ${cls}">${score}</span>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700;color:var(--navy)">${r.title}</div>
              <div style="font-size:11px;color:var(--lt)">P:${r.likelihood||1} × I:${r.impact||1} · ${r.owner||'—'}</div>
              ${r.mitigation?`<div style="font-size:11px;color:var(--mid);margin-top:2px">${r.mitigation}</div>`:''}
            </div>
            ${ragBadge(r.status)}
            <button class="btn-icon" onclick="openModal('risk','${r.id}')">✏️</button>
          </div>`;
        }).join('') : `<div style="font-size:12px;color:var(--lt)">No risks logged for this project</div>`}
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="card-title" style="margin-bottom:0">Escalations (${pEscs.length})</div>
          <button class="btn btn-ghost btn-sm" onclick="openModal('escalation')">+ Add Escalation</button>
        </div>
        ${pEscs.length ? pEscs.map(e=>`
          <div style="border-left:3px solid ${['High','Critical'].includes(normaliseStatus(e.priority))?'#ef4444':'#f59e0b'};padding:8px 10px;margin-bottom:8px;border-radius:0 4px 4px 0;background:var(--bg)">
            <div style="font-size:13px;font-weight:700;color:var(--navy)">${e.title||'Unnamed'}</div>
            <div style="font-size:11px;color:var(--lt)">${DateHelpers.fmt(e.date)} · ${ragBadge(e.priority)} ${ragBadge(e.status)}</div>
          </div>`).join('') : `<div style="font-size:12px;color:var(--lt)">No escalations</div>`}
      </div>`;
  }

  // ── TAB 4: Team & Activity ──
  function tabTeam() {
    const pResources = APP_STATE.resources.filter(r => trackMembers.some(m=>m.id===r.memberId));
    const totalHours = pResources.reduce((s,r)=>s+(parseFloat(r.hours)||0), 0);
    const recentActivity = [
      ...pMs.map(m=>({ icon:'🎯', label:m.title, date:m.updatedAt||m.createdAt||m.dueDate, type:'milestone' })),
      ...pRisks.map(r=>({ icon:'⚠️', label:r.title, date:r.updatedAt||r.createdAt, type:'risk' })),
      ...pEscs.map(e=>({ icon:'🚨', label:e.title||'Escalation', date:e.date||e.createdAt, type:'escalation' }))
    ].filter(x=>x.date).sort((a,b)=>b.date>a.date?1:-1).slice(0,5);
    return `
      <div class="card" style="margin-bottom:12px">
        <div class="card-title">Recent Activity</div>
        ${recentActivity.length ? recentActivity.map(a=>`
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
            <span style="font-size:16px">${a.icon}</span>
            <div style="flex:1;font-size:13px;color:var(--navy);font-weight:500">${a.label}</div>
            <span style="font-size:11px;color:var(--lt)">${DateHelpers.fmt(a.date)}</span>
          </div>`).join('') : `<div class="empty"><div class="empty-icon">📝</div>No recent activity</div>`}
        <div style="margin-top:12px;font-size:12px;color:var(--mid)">Total hours logged: <strong>${totalHours}h</strong></div>
      </div>`;
  }

  // ── TAB 5: Assign Team ──
  function tabTeamAssign() {
    const assigned = (p.teamMembers||[]).map(mid=>{
      const m = APP_STATE.teamMembers.find(x=>x.id===mid);
      if (!m) return '';
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--rs);margin-bottom:8px">
        <div class="av" style="background:${TRACK_COLORS[m.track]||'var(--navy)'}">${avatar(m.name)}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--navy)">${m.name}</div>
          <div style="font-size:11px;color:var(--lt)">${m.role||'—'} · ${m.track||'—'} · ${m.availability||100}% avail</div>
        </div>
        <button class="btn btn-danger btn-xs" onclick="removeMemberFromProject('projects','${id}','${mid}')">Remove</button>
      </div>`;
    }).join('');
    const unassigned = (APP_STATE.teamMembers||[])
      .filter(m=>!(p.teamMembers||[]).includes(m.id))
      .sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    return `<div class="card">
      <div class="card-title">Assigned Team Members</div>
      ${assigned || `<div style="font-size:12px;color:var(--lt);margin-bottom:12px">No members assigned yet</div>`}
      <div style="display:flex;gap:8px;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
        <select id="assign-member-select" class="form-control" style="flex:1">
          <option value="">Select team member…</option>
          ${unassigned.map(m=>`<option value="${m.id}">${m.name}</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm" onclick="assignMemberToProject('projects','${id}')">+ Assign</button>
      </div>
    </div>`;
  }

  const tabContent = activeTab==='overview'    ? tabOverview()
                   : activeTab==='milestones'  ? tabMilestones()
                   : activeTab==='risks'        ? tabRisks()
                   : activeTab==='activity'     ? tabTeam()
                   : activeTab==='team'         ? tabTeamAssign()
                   : tabOverview();

  const priorityColor = { Critical:'#dc2626', High:'#d97706', Medium:'var(--navy)', Low:'#16a34a' };
  const pCol = priorityColor[normaliseStatus(p.priority)] || 'var(--navy)';

  return `
  <div class="vh">
    <div class="vh-left">
      <button class="btn btn-ghost btn-sm no-print" onclick="nav('projects')" style="margin-bottom:6px">← Back to Projects</button>
    </div>
    <div class="vh-right no-print">
      <button class="btn btn-ghost btn-sm" onclick="openModal('project','${p.id}')">✏️ Edit</button>
    </div>
  </div>

  <div class="card" style="margin-bottom:16px;border-top:4px solid ${pCol}">
    <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px">
      <div style="flex:1;min-width:0">
        <h1 style="font-size:22px;font-weight:800;color:var(--navy);line-height:1.2;margin-bottom:8px">${p.name}</h1>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
          ${p.track||p.trackId?`<span class="badge badge-navy">${resolveTrackName(p.track||p.trackId)}</span>`:''}
          ${ragBadge(p.priority)}
          ${ragBadge(p.status)}
          ${p.phase?`<span class="badge badge-grey">${p.phase}</span>`:''}
        </div>
      </div>
    </div>
    <div style="height:10px;background:#e8eaf0;border-radius:6px;overflow:hidden;margin-bottom:12px">
      <div style="height:100%;width:${Math.min(projProgress(p),100)}%;background:${projProgress(p)>=70?'#22c55e':projProgress(p)>=40?'#f59e0b':'#ef4444'};border-radius:6px;transition:width .3s"></div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:16px;font-size:12px;color:var(--mid)">
      <span>📅 <strong>${DateHelpers.fmt(p.startDate)}</strong> → <strong style="${DateHelpers.isOverdue(p.endDate)&&normaliseStatus(p.status)!=='Completed'?'color:#dc2626':''}">${DateHelpers.fmt(p.endDate)}</strong></span>
      ${p.devLead?`<span>👤 Dev Lead: <strong>${teamName(p.devLead)}</strong></span>`:''}
      ${p.sprint?`<span>🏃 Sprint: <strong>${p.sprint}</strong></span>`:''}
      <span>📊 <strong>${projProgress(p)}%</strong> complete</span>
      ${p.jiraKey?`<span>🔗 Jira: <strong>${p.jiraKey}</strong></span>`:''}
    </div>
    ${(p.teamMembers||[]).length||true?`<div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap">
      <span style="font-size:11px;color:var(--lt)">Team:</span>
      ${(p.teamMembers||[]).map(mid=>{const m=APP_STATE.teamMembers.find(x=>x.id===mid);if(!m)return '';const ini=(m.name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);return `<div class="av av-sm" title="${m.name} — ${m.role||''}" style="background:var(--navy);cursor:default">${ini}</div>`;}).join('')}
      <button class="btn btn-ghost btn-xs" onclick="APP_STATE._detailTab='team';navigateTo(APP_STATE.currentView,APP_STATE.currentParams)">+ Add</button>
    </div>`:``}
  </div>

  <div class="pulse-tabs">
    ${tabBtn('overview',   '📋 Overview')}
    ${tabBtn('milestones', '🎯 Milestones')}
    ${tabBtn('risks',      '⚠️ Risks & Escalations')}
    ${tabBtn('activity',   '📝 Activity')}
    ${tabBtn('team',       '👥 Team')}
  </div>
  ${tabContent}`;
}

// ─── ONBOARDING ───────────────────────────────────────────
export function renderOnboarding() {
  const projects = filterProjects(APP_STATE.onboardingProjects || [])
    .sort((a,b) => { const da=a.endDate||a.startDate||''; const db=b.endDate||b.startDate||''; return da<db?-1:da>db?1:0; });
  const total     = projects.length;
  const inProg    = projects.filter(p=>normaliseStatus(p.status)==='In Progress').length;
  const completed = projects.filter(p=>normaliseStatus(p.status)==='Completed').length;
  const atRisk    = projects.filter(p=>['At Risk','Overdue'].includes(normaliseStatus(p.status))).length;

  return `
  ${filterBar()}
  <div class="vh">
    <div class="vh-left">
      <h1>Onboarding Projects</h1>
      <div class="sub">${total} onboarding project${total!==1?'s':''}</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="modalProject(null,'onboardingProjects')">+ New Onboarding</button>
    </div>
  </div>
  ${statRow(
    statBlock(total,'Total','onboarding projects','#7c3aed') +
    statBlock(inProg,'In Progress','currently active','#2563EB') +
    statBlock(completed,'Completed','done','#059669') +
    statBlock(atRisk,'At Risk / Overdue','needs attention','#DC2626')
  )}
  <div class="card" style="padding:0">
    <div class="tbl-wrap">
      <table class="dt">
        <thead><tr><th>Project</th><th>Track</th><th>Priority</th><th>Phase</th><th>Progress</th><th>Status</th><th>Start</th><th>End</th><th>Actions</th></tr></thead>
        <tbody>
          ${projects.length ? projects.map(p=>`
          <tr class="clk ${normaliseStatus(p.status)==='Completed'?'done':''}" onclick="nav('onboarding-detail',{id:'${p.id}'})">
            <td>
              <span class="proj-link" style="color:#7c3aed">${p.name||p.customerName||'Unnamed'}</span>
              <div style="font-size:11px;color:var(--lt)">${p.description||''}</div>
            </td>
            <td>${p.track||p.trackId?`<span class="badge badge-navy">${resolveTrackName(p.track||p.trackId)}</span>`:'—'}</td>
            <td>${ragBadge(p.priority)}</td>
            <td style="font-size:12px">${p.phase||'—'}</td>
            <td style="min-width:110px">
              ${progressBar(projProgress(p))}
              <div style="font-size:11px;color:var(--lt);margin-top:3px">${projProgress(p)}%</div>
            </td>
            <td>${ragBadge(p.status)}</td>
            <td style="font-size:12px;color:var(--lt)">${DateHelpers.fmt(p.startDate)}</td>
            <td style="font-size:12px;color:${DateHelpers.isOverdue(p.endDate)&&normaliseStatus(p.status)!=='Completed'?'#ef4444':'var(--lt)'}">${DateHelpers.fmt(p.endDate)}</td>
            <td onclick="event.stopPropagation()">
              <button class="btn-icon" onclick="modalProject('${p.id}','onboardingProjects')">✏️</button>
              <button class="btn-icon" onclick="deleteItem('onboardingProjects','${p.id}')">🗑</button>
            </td>
          </tr>`).join(''):`<tr><td colspan="9"><div class="empty"><div class="empty-icon">🏗️</div>No onboarding projects found</div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

export async function renderOnboardingDetail(params) {
  const id = params && params.id;
  const p  = (APP_STATE.onboardingProjects||[]).find(x=>x.id===id);
  if (!p) return `<div class="empty"><div class="empty-icon">❌</div>Onboarding project not found.</div>`;

  const today   = DateHelpers.today();
  const pMs     = APP_STATE.milestones.filter(m=>m.projectId===id||m.projectName===(p.name||p.customerName));
  const pRisks  = APP_STATE.risks.filter(r=>r.projectId===id||r.project===(p.name||p.customerName));
  const pEscs   = APP_STATE.escalations.filter(e=>e.projectId===id||e.project===(p.name||p.customerName));
  const activeTab = APP_STATE._detailTab || 'overview';

  function tabBtn(key, label) {
    return `<button class="pt ${activeTab===key?'active':''}" onclick="switchTab('_detailTab','${key}')">${label}</button>`;
  }

  function tabOverview() {
    const onbNotesCards = pMs.map(m => {
      const tasksWithNotes = (m.tasks||[]).filter(t => t.notes && t.notes.trim());
      const msNote = m.notes || m.description || '';
      if (!tasksWithNotes.length && !msNote) return '';
      return `<div style="border:1px solid var(--border);border-left:3px solid var(--teal);border-radius:var(--rs);padding:12px 14px;margin-bottom:8px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <span style="font-size:13px;font-weight:700;color:var(--navy)">${m.title||m.name}</span>
          <span class="badge ${(m.status||'').toLowerCase().includes('complet')?'badge-teal':'badge-amber'}">${m.status||''}</span>
        </div>
        ${msNote?`<div style="font-size:12px;color:var(--mid);font-style:italic;margin-bottom:6px;padding:6px 10px;background:var(--bg);border-radius:var(--rs)">${msNote}</div>`:''}
        ${tasksWithNotes.map(t=>`<div style="display:flex;gap:8px;align-items:flex-start;padding:5px 0;border-top:1px solid var(--border)">
          <span style="width:14px;height:14px;border-radius:50%;flex-shrink:0;margin-top:2px;background:${t.done?'#22c55e':'var(--border-dk)'};display:inline-flex;align-items:center;justify-content:center;font-size:8px;color:white">${t.done?'✓':''}</span>
          <div>
            <div style="font-size:12px;font-weight:600;color:var(--text);${t.done?'text-decoration:line-through;':''}">${t.name||''}</div>
            <div style="font-size:11px;color:var(--lt);font-style:italic;margin-top:2px">${t.notes}</div>
          </div>
        </div>`).join('')}
      </div>`;
    }).join('');

    const onbNotesSection = onbNotesCards.replace(/\s/g,'')
      ? `<div class="card" style="margin-top:0">
          <div style="font-size:11px;font-weight:800;color:var(--lt);text-transform:uppercase;letter-spacing:.6px;margin-bottom:12px">Milestone Notes &amp; Updates</div>
          ${onbNotesCards}
        </div>`
      : '';

    return `<div class="card">
      <div class="card-title">Description</div>
      <div style="font-size:13px;color:var(--text)">${p.description||'<span style="color:var(--lt)">No description provided.</span>'}</div>
      ${p.objectives?`<div style="font-size:10px;font-weight:700;color:var(--lt);text-transform:uppercase;margin-top:12px;margin-bottom:4px">Objectives</div><div style="font-size:13px">${p.objectives}</div>`:''}
      ${p.stakeholders?`<div style="font-size:10px;font-weight:700;color:var(--lt);text-transform:uppercase;margin-top:12px;margin-bottom:4px">Stakeholders</div><div style="font-size:13px">${p.stakeholders}</div>`:''}
    </div>
    ${onbNotesSection}`;
  }

  function tabMilestones() {
    const sorted = [...pMs].sort((a,b)=>{ if(!a.dueDate) return 1; if(!b.dueDate) return -1; return a.dueDate>b.dueDate?1:-1; });
    return `<div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="card-title" style="margin-bottom:0">Milestones (${sorted.length})</div>
        <button class="btn btn-ghost btn-sm" onclick="openModal('milestone',null,'${id}')">+ Add Milestone</button>
      </div>
      ${sorted.length ? `<div class="tbl-wrap"><table class="dt">
        <thead><tr><th>Milestone</th><th>Due Date</th><th>Status</th><th>Tasks</th><th>Actions</th></tr></thead>
        <tbody>${sorted.map(m=>{
          const mTasks = m.tasks||[]; const mDone = mTasks.filter(t=>t.done).length;
          return `<tr>
            <td style="font-weight:600;color:var(--navy)">${m.title}</td>
            <td style="font-size:12px">${DateHelpers.fmt(m.dueDate)}</td>
            <td>${ragBadge(m.status)}</td>
            <td style="font-size:12px">${mTasks.length ? `● ${mDone}/${mTasks.length} complete` : '—'}</td>
            <td onclick="event.stopPropagation()">
              <button class="btn btn-ghost btn-xs" onclick="openMilestoneDrawer('${m.id}')">Tasks (${mTasks.length})</button>
              <button class="btn-icon" onclick="openModal('milestone','${m.id}','${id}')">✏️</button>
              <button class="btn-icon" onclick="deleteItem('milestones','${m.id}')">🗑</button>
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>` : `<div class="empty"><div class="empty-icon">🎯</div>No milestones yet</div>`}
    </div>`;
  }

  function tabRisks() {
    return `<div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div class="card-title" style="margin-bottom:0">Risks (${pRisks.length})</div>
        <button class="btn btn-ghost btn-sm" onclick="openModal('risk')">+ Add Risk</button>
      </div>
      ${pRisks.length ? `<div class="tbl-wrap"><table class="dt">
        <thead><tr><th>Risk</th><th>Severity</th><th>Status</th></tr></thead>
        <tbody>${pRisks.map(r=>`<tr>
          <td style="font-size:13px">${r.title||r.description||'—'}</td>
          <td>${ragBadge(r.severity||r.impact)}</td>
          <td>${ragBadge(r.status)}</td>
        </tr>`).join('')}</tbody>
      </table></div>` : `<div class="empty"><div class="empty-icon">⚠️</div>No risks logged</div>`}
    </div>`;
  }

  function tabTeamAssignOnb() {
    const assigned = (p.teamMembers||[]).map(mid=>{
      const m = APP_STATE.teamMembers.find(x=>x.id===mid);
      if (!m) return '';
      const ini = (m.name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
      return `<div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--rs);margin-bottom:8px">
        <div class="av" style="background:#7c3aed">${ini}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--navy)">${m.name}</div>
          <div style="font-size:11px;color:var(--lt)">${m.role||'—'} · ${m.track||'—'} · ${m.availability||100}% avail</div>
        </div>
        <button class="btn btn-danger btn-xs" onclick="removeMemberFromProject('onboardingProjects','${id}','${mid}')">Remove</button>
      </div>`;
    }).join('');
    const unassigned = (APP_STATE.teamMembers||[])
      .filter(m=>!(p.teamMembers||[]).includes(m.id))
      .sort((a,b)=>(a.name||'').localeCompare(b.name||''));
    return `<div class="card">
      <div class="card-title">Assigned Team Members</div>
      ${assigned || `<div style="font-size:12px;color:var(--lt);margin-bottom:12px">No members assigned yet</div>`}
      <div style="display:flex;gap:8px;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
        <select id="assign-member-select" class="form-control" style="flex:1">
          <option value="">Select team member…</option>
          ${unassigned.map(m=>`<option value="${m.id}">${m.name}</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm" onclick="assignMemberToProject('onboardingProjects','${id}')">+ Assign</button>
      </div>
    </div>`;
  }

  const tabContent = activeTab==='milestones' ? tabMilestones()
                   : activeTab==='risks'      ? tabRisks()
                   : activeTab==='team'       ? tabTeamAssignOnb()
                   : tabOverview();

  return `
  <div class="vh">
    <div class="vh-left">
      <button class="btn btn-ghost btn-sm no-print" onclick="nav('onboarding')" style="margin-bottom:6px">← Back to Onboarding</button>
    </div>
    <div class="vh-right no-print">
      <button class="btn btn-ghost btn-sm" onclick="modalProject('${p.id}','onboardingProjects')">✏️ Edit</button>
    </div>
  </div>
  <div class="card" style="margin-bottom:16px;border-top:4px solid #7c3aed">
    <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:14px">
      <div style="flex:1;min-width:0">
        <h1 style="font-size:22px;font-weight:800;color:#7c3aed;line-height:1.2;margin-bottom:8px">${p.name||p.customerName}</h1>
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
          ${p.track||p.trackId?`<span class="badge badge-navy">${resolveTrackName(p.track||p.trackId)}</span>`:''}
          ${ragBadge(p.priority)}
          ${ragBadge(p.status)}
          ${p.phase?`<span class="badge badge-grey">${p.phase}</span>`:''}
        </div>
      </div>
    </div>
    <div style="height:10px;background:#e8eaf0;border-radius:6px;overflow:hidden;margin-bottom:12px">
      <div style="height:100%;width:${Math.min(projProgress(p),100)}%;background:#7c3aed;border-radius:6px;transition:width .3s"></div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:16px;font-size:12px;color:var(--mid)">
      <span>📅 <strong>${DateHelpers.fmt(p.startDate)}</strong> → <strong>${DateHelpers.fmt(p.endDate)}</strong></span>
      ${p.devLead?`<span>👤 Dev Lead: <strong>${teamName(p.devLead)}</strong></span>`:''}
      <span>📊 <strong>${projProgress(p)}%</strong> complete</span>
      ${p.jiraKey?`<span>🔗 Jira: <strong>${p.jiraKey}</strong></span>`:''}
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap">
      <span style="font-size:11px;color:var(--lt)">Team:</span>
      ${(p.teamMembers||[]).map(mid=>{const m=APP_STATE.teamMembers.find(x=>x.id===mid);if(!m)return '';const ini=(m.name||'?').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);return `<div class="av av-sm" title="${m.name} — ${m.role||''}" style="background:#7c3aed;cursor:default">${ini}</div>`;}).join('')}
      <button class="btn btn-ghost btn-xs" onclick="APP_STATE._detailTab='team';navigateTo(APP_STATE.currentView,APP_STATE.currentParams)">+ Add</button>
    </div>
  </div>
  <div class="pulse-tabs">
    ${tabBtn('overview',   '📋 Overview')}
    ${tabBtn('milestones', '🎯 Milestones')}
    ${tabBtn('risks',      '⚠️ Risks')}
    ${tabBtn('team',       '👥 Team')}
  </div>
  ${tabContent}`;
}

// ─── WORKFLOWS ────────────────────────────────────────────
export function renderWorkflows() {
  const workflows = APP_STATE.workflows;
  return `
  <div class="vh">
    <div class="vh-left">
      <h1>WoW — Way of Work</h1>
      <div class="sub">Standard operating workflows and process templates</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="openModal('workflow')">+ New Workflow</button>
    </div>
  </div>
  ${workflows.length ? workflows.map(w=>`
  <div class="card" style="margin-bottom:12px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <div style="flex:1;font-size:15px;font-weight:700;color:var(--navy)">${w.name}</div>
      <button class="btn btn-ghost btn-sm" onclick="openModal('workflow','${w.id}')">Edit</button>
      <button class="btn btn-danger btn-sm" onclick="deleteItem('workflows','${w.id}')">🗑</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${(w.steps||[]).map((s,i)=>`
      <div style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg);border-radius:var(--rs);border:1px solid var(--border)">
        <div style="width:22px;height:22px;border-radius:50%;background:var(--navy);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${i+1}</div>
        <div style="flex:1;font-size:13px;font-weight:600;color:var(--navy)">${s.name}</div>
        <div style="font-size:11px;color:var(--lt)">👤 ${s.assignee||'—'} · ⏱ ${s.duration||1}d</div>
      </div>`).join('')}
    </div>
  </div>`).join(''):`<div class="empty"><div class="empty-icon">🔄</div>No workflows yet</div>`}`;
}

// ─── TEAM ─────────────────────────────────────────────────
function getAvatarColor(name) {
  const colors = ['#1B2B5E','#00A896','#E8452C','#7c3aed','#d97706','#059669'];
  const i = (name||'').split('').reduce((s,c)=>s+c.charCodeAt(0),0) % colors.length;
  return colors[i];
}
function initials(name) { return (name||'').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2); }

export function renderTeam() {
  const allMembers  = APP_STATE.teamMembers;
  const tracks      = ['All',...(APP_STATE.settings.trackNames||['Track 1','Track 2','Track 3'])];
  const activeTrack = APP_STATE._teamTrackFilter||'All';
  const teamSearch  = (APP_STATE._teamSearch||'').toLowerCase();

  let members = [...allMembers].sort((a,b)=>(a.name||'').localeCompare(b.name||''));
  if (activeTrack !== 'All') members = members.filter(m=>m.track===activeTrack||resolveTrackName(m.track||m.trackId)===activeTrack);
  if (teamSearch) members = members.filter(m=>(m.name||'').toLowerCase().includes(teamSearch)||(m.role||'').toLowerCase().includes(teamSearch));

  return `
  ${execBanner('team')}
  <div class="vh">
    <div class="vh-left">
      <h1>Team</h1>
      <div class="sub">${members.length} member${members.length!==1?'s':''}</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="openModal('teamMember')">+ Add Member</button>
    </div>
  </div>

  <div style="display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap;align-items:center">
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      ${tracks.map(t=>{
        const isActive = activeTrack===t;
        const count    = t==='All' ? allMembers.length : allMembers.filter(m=>m.track===t||resolveTrackName(m.track||m.trackId)===t).length;
        const color    = t==='All' ? '#1B2B5E' : (TRACK_COLORS[t]||'#1B2B5E');
        return `<button onclick="window._setTeamTrack('${t}')"
          style="padding:5px 14px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:2px solid ${isActive?color:'var(--border)'};background:${isActive?color:'#fff'};color:${isActive?'#fff':color};font-family:'DM Sans',sans-serif;transition:all .15s">
          ${t} (${count})
        </button>`;
      }).join('')}
    </div>
    <input class="form-control" style="width:200px;font-size:12px;margin-left:auto" placeholder="Search team members…"
      value="${APP_STATE._teamSearch||''}"
      oninput="APP_STATE._teamSearch=this.value;navigateTo(APP_STATE.currentView,APP_STATE.currentParams)"/>
  </div>

  <div class="card" style="padding:0">
    <div class="tbl-wrap">
      <table class="dt">
        <thead>
          <tr>
            <th>Member</th>
            <th>Role</th>
            <th>Track</th>
            <th>Projects Assigned</th>
            <th>Milestones</th>
            <th>Allocation</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${members.length ? members.map(m=>{
            const mProj = APP_STATE.projects.filter(p=>p.devLead===m.id||p.devLead===m.name||(Array.isArray(p.team)?p.team.includes(m.id):(p.team||'').includes(m.id)));
            const mOnb  = (APP_STATE.onboardingProjects||[]).filter(p=>p.devLead===m.id||p.devLead===m.name);
            const mMs   = APP_STATE.milestones.filter(ms=>ms.owner===m.name||ms.owner===m.id||ms.ownerId===m.id);
            const openMs = mMs.filter(ms=>normaliseStatus(ms.status)!=='Completed').length;
            const cap = m.capacity||m.availability||80;
            const capCls = cap>100?'badge-red':cap>=80?'badge-amber':'badge-teal';
            return `<tr data-member-id="${m.id}" class="clk" onclick="toggleMemberExpand('${m.id}')">
              <td>
                <div style="display:flex;align-items:center;gap:10px">
                  <div class="av" style="background:${getAvatarColor(m.name)}">${initials(m.name)}</div>
                  <div>
                    <div style="font-weight:700;font-size:13px">${m.name}</div>
                    <div style="font-size:11px;color:var(--lt)">${m.email||''}</div>
                  </div>
                </div>
              </td>
              <td style="font-size:12px">${m.role||'—'}</td>
              <td><span class="badge badge-navy">${resolveTrackName(m.track||m.trackId)||m.track||'—'}</span></td>
              <td>
                <div style="display:flex;flex-wrap:wrap;gap:3px">
                  ${[...mProj,...mOnb].slice(0,3).map(p=>`<span class="badge badge-grey" style="font-size:10px">${p.name||p.customerName}</span>`).join('')}
                  ${mProj.length+mOnb.length>3?`<span class="badge badge-grey" style="font-size:10px">+${mProj.length+mOnb.length-3}</span>`:''}
                  ${!mProj.length&&!mOnb.length?'<span style="font-size:11px;color:var(--lt)">None</span>':''}
                </div>
              </td>
              <td style="font-size:12px">
                ${mMs.length ? `${mMs.length} total · <span style="color:${openMs>0?'#d97706':'#16a34a'};font-weight:600">${openMs} open</span>` : '—'}
              </td>
              <td><span class="badge ${capCls}">${cap}%</span></td>
              <td onclick="event.stopPropagation()">
                <button class="btn btn-ghost btn-xs" onclick="openModal('teamMember','${m.id}')">Edit</button>
                <button class="btn-icon" onclick="deleteItem('teamMembers','${m.id}')">🗑</button>
              </td>
            </tr>
            ${APP_STATE._expandedMember===m.id ? `<tr>
              <td colspan="7" style="padding:0;background:var(--bg)">
                <div class="member-detail-panel">
                  <div class="member-detail-section">
                    <div class="member-detail-title">Assigned Projects</div>
                    ${mProj.length||mOnb.length ? [...mProj.map(p=>`<div style="margin-bottom:6px"><span class="badge badge-navy" style="cursor:pointer;font-size:10px" onclick="nav('project-detail',{id:'${p.id}'})">${p.name||'—'}</span></div>`), ...mOnb.map(p=>`<div style="margin-bottom:6px"><span class="badge badge-purple" style="cursor:pointer;font-size:10px" onclick="nav('onboarding-detail',{id:'${p.id}'})">🎓 ${p.name||p.customerName}</span></div>`)].join('') : '<div style="font-size:11px;color:var(--lt)">No projects assigned</div>'}
                  </div>
                  <div class="member-detail-section">
                    <div class="member-detail-title">Open Milestones</div>
                    ${mMs.filter(ms=>normaliseStatus(ms.status)!=='Completed').slice(0,4).map(ms=>`<div style="font-size:11px;padding:3px 0;border-bottom:1px solid var(--border)">${ms.title} <span style="color:var(--lt)">${DateHelpers.fmt(ms.dueDate)}</span></div>`).join('')||'<div style="font-size:11px;color:var(--lt)">None</div>'}
                  </div>
                </div>
              </td>
            </tr>` : ''}`;
          }).join('') : `<tr><td colspan="7"><div class="empty"><div class="empty-icon">👥</div>No members found</div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── CAPACITY & RESOURCES (merged) ────────────────────────
export function renderCapacityResources() {
  const activeTab = APP_STATE._capTab || 'allocation';
  if (activeTab === 'timelog') return _renderTimeLog();
  return _renderAllocation();
}
// legacy alias — capacity view now redirects to merged view
export { renderCapacityResources as renderCapacity };

function _renderAllocation() {
  const capTab = APP_STATE._capTab || 'allocation';
  const filterTrack = APP_STATE._allocFilterTrack || '';
  const searchStr   = (APP_STATE._allocSearch || '').toLowerCase();

  let members = [...APP_STATE.teamMembers].sort((a,b) => (a.name||'').localeCompare(b.name||''));
  if (filterTrack) members = members.filter(m => {
    const tn = resolveTrackName(m.track||m.trackId);
    return m.track === filterTrack || m.trackId === filterTrack || tn === filterTrack;
  });
  if (searchStr) members = members.filter(m =>
    (m.name||'').toLowerCase().includes(searchStr) ||
    (m.role||'').toLowerCase().includes(searchStr)
  );

  const allProjects = [...APP_STATE.projects, ...(APP_STATE.onboardingProjects||[])];
  const activeProjects = allProjects.filter(p => normaliseStatus(p.status) !== 'Completed');

  const overloaded  = members.filter(m => (m.capacity||m.availability||80) > 100).length;
  const atCap       = members.filter(m => { const c=m.capacity||m.availability||80; return c>=80&&c<=100; }).length;
  const available   = members.filter(m => (m.capacity||m.availability||80) < 80).length;

  const expandedId = APP_STATE._expandedMember || '';

  function memberProjects(m) {
    return allProjects.filter(p =>
      p.devLead === m.id || p.devLead === m.name ||
      (Array.isArray(p.team) ? p.team.includes(m.id) : (p.team||'').includes(m.id))
    );
  }

  function allocBadge(pct) {
    const cls = pct > 100 ? 'badge-red' : pct >= 80 ? 'badge-amber' : 'badge-teal';
    const lbl = pct > 100 ? 'Overloaded' : pct >= 80 ? 'At Capacity' : 'Available';
    return `<span class="badge ${cls} alloc-status">${lbl}</span>`;
  }

  function memberDetail(m) {
    const mProj    = memberProjects(m);
    const mMs      = APP_STATE.milestones.filter(ms => ms.owner === m.name || ms.owner === m.id || ms.ownerId === m.id);
    const openMs   = mMs.filter(ms => normaliseStatus(ms.status) !== 'Completed').length;
    const today    = DateHelpers.today();
    const weekAgo  = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const weekHrs  = (APP_STATE.resources||[]).filter(r=>r.memberId===m.id&&r.date>=weekAgoStr).reduce((s,r)=>s+(parseFloat(r.hours)||0),0);
    const monthStart = new Date(); monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];
    const leaveCount = (APP_STATE.resources||[]).filter(r=>r.memberId===m.id&&r.isLeave&&r.date>=monthStartStr).length;

    return `<tr>
      <td colspan="8" style="padding:0;background:var(--bg)">
        <div class="member-detail-panel">
          <div class="member-detail-section">
            <div class="member-detail-title">Assigned Projects</div>
            ${mProj.length ? mProj.map(p=>{
              const isOnb = (APP_STATE.onboardingProjects||[]).some(o=>o.id===p.id);
              return `<div style="margin-bottom:6px">
                <span class="badge ${isOnb?'badge-purple':'badge-navy'}" style="cursor:pointer;font-size:10px" onclick="nav('${isOnb?'onboarding-detail':'project-detail'}',{id:'${p.id}'})">${isOnb?'🎓 ':''}${p.name||p.customerName}</span>
                <span style="font-size:10px;color:var(--lt);margin-left:4px">${ragBadge(p.status)}</span>
              </div>`;
            }).join('') : '<div style="font-size:11px;color:var(--lt)">No projects assigned</div>'}
          </div>
          <div class="member-detail-section">
            <div class="member-detail-title">Milestones</div>
            <div style="font-size:12px;color:var(--mid)">Total: <strong>${mMs.length}</strong> · Open: <strong style="color:${openMs>0?'#d97706':'#16a34a'}">${openMs}</strong></div>
            ${mMs.filter(ms=>normaliseStatus(ms.status)!=='Completed').slice(0,3).map(ms=>`<div style="font-size:11px;padding:3px 0;border-bottom:1px solid var(--border)">${ms.title} <span style="color:var(--lt)">${DateHelpers.fmt(ms.dueDate)}</span></div>`).join('')}
          </div>
          <div class="member-detail-section">
            <div class="member-detail-title">Time & Availability</div>
            <div style="font-size:12px;color:var(--mid)">Hours this week: <strong>${weekHrs}h</strong></div>
            <div style="font-size:12px;color:var(--mid)">Leave days this month: <strong>${leaveCount}</strong></div>
            <div style="font-size:12px;color:var(--mid)">Allocation: <strong>${m.capacity||m.availability||80}%</strong></div>
          </div>
        </div>
      </td>
    </tr>`;
  }

  function capTabBar() {
    return `<div class="pulse-tabs no-print" style="margin-bottom:14px">
      <button class="pt ${capTab==='allocation'?'active':''}" onclick="switchTab('_capTab','allocation')">Allocation</button>
      <button class="pt ${capTab==='timelog'?'active':''}" onclick="switchTab('_capTab','timelog')">Time Log</button>
    </div>`;
  }

  return `
  ${execBanner('capacity')}
  <div class="vh">
    <div class="vh-left">
      <h1>Capacity &amp; Resources</h1>
      <div class="sub">Team allocation and hour tracking</div>
    </div>
  </div>
  ${capTabBar()}
  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px">
    <select class="form-control" style="width:160px;font-size:12px" onchange="setAllocFilter('_allocFilterTrack',this.value)">
      <option value="">All Tracks</option>
      ${APP_STATE.tracks.map(t=>`<option value="${t.id||t.name||t.title}" ${(filterTrack===(t.id||t.name||t.title)||filterTrack===(t.name||t.title))?'selected':''}>${resolveTrackName(t.id)||t.name||t.title}</option>`).join('')}
    </select>
    <input class="form-control" style="width:160px;font-size:12px" placeholder="Search member…" value="${APP_STATE._allocSearch||''}" oninput="setAllocFilter('_allocSearch',this.value)"/>
    ${(filterTrack||searchStr)?`<button class="btn btn-ghost btn-sm" onclick="setAllocFilter('_allocFilterTrack','');setAllocFilter('_allocSearch','')">Reset</button>`:''}
  </div>
  ${statRow(
    statBlock(members.length,'Total Members','on team','var(--navy)') +
    statBlock(overloaded,'Overloaded','>100%','#dc2626') +
    statBlock(atCap,'At Capacity','80-100%','#d97706') +
    statBlock(available,'Available','<80%','#059669') +
    statBlock(activeProjects.length,'Active Projects','regular + onboarding','#7c3aed')
  )}
  <div class="card" style="padding:0">
    <div class="tbl-wrap">
      <table class="dt">
        <thead>
          <tr>
            <th>Member</th>
            <th>Role</th>
            <th>Track</th>
            <th>Projects Assigned</th>
            <th>Allocation %</th>
            <th>Available %</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${members.map(m => {
            const cap  = m.capacity || m.availability || 80;
            const avail = Math.max(0, 100 - cap);
            const mProj = memberProjects(m);
            const tcol = TRACK_COLORS[m.track] || '#1B2B5E';
            const isExpanded = expandedId === m.id;
            return `<tr data-member-id="${m.id}" style="cursor:pointer" onclick="toggleMemberExpand('${m.id}')">
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="av" style="background:${tcol}">${avatar(m.name)}</div>
                  <div>
                    <div style="font-size:13px;font-weight:700;color:var(--navy)">${m.name}</div>
                    ${m.email?`<div style="font-size:10px;color:var(--lt)">${m.email}</div>`:''}
                  </div>
                </div>
              </td>
              <td style="font-size:12px">${m.role||'—'}</td>
              <td><span class="badge" style="background:${tcol}20;color:${tcol}">${m.track||'—'}</span></td>
              <td>
                <div style="display:flex;flex-wrap:wrap;gap:3px">
                  ${mProj.slice(0,3).map(p=>`<span class="badge badge-grey" style="font-size:10px">${p.name||p.customerName}</span>`).join('')}
                  ${mProj.length>3?`<span class="badge badge-grey" style="font-size:10px">+${mProj.length-3} more</span>`:''}
                  ${!mProj.length?'<span style="font-size:11px;color:var(--lt)">None</span>':''}
                </div>
              </td>
              <td onclick="event.stopPropagation()">
                <div style="display:flex;align-items:center;gap:4px">
                  <input type="number" min="0" max="200" class="alloc-input" value="${cap}"
                    onchange="updateAllocation('${m.id}',this.value)"
                    style="width:60px;padding:4px 8px;border:1px solid var(--border-dk);border-radius:var(--rs);font-size:12px;font-weight:700;text-align:center"/>
                  <span style="font-size:12px;color:var(--mid)">%</span>
                </div>
              </td>
              <td style="font-size:12px;font-weight:700;color:${avail<20?'#dc2626':avail<50?'#d97706':'#059669'}">${avail}%</td>
              <td>${allocBadge(cap)}</td>
              <td>
                <button class="btn btn-icon btn-xs" onclick="event.stopPropagation();toggleMemberExpand('${m.id}')"
                  style="transform:rotate(${isExpanded?'180':'0'}deg);transition:transform .2s">▼</button>
              </td>
            </tr>
            ${isExpanded ? memberDetail(m) : ''}`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── TIMELOG CELL BUILDER ─────────────────────────────────
function buildTimeLogCell(memberId, dateStr, existing, projects) {
  const isLeave = existing?.isLeave;
  const hours = existing?.hours || 0;
  const note = existing?.note || '';
  const proj = existing?.project || '';
  const leaveType = existing?.leaveType || '';

  if (isLeave) {
    return `<div style="text-align:center;padding:8px 4px">
      <span class="badge badge-purple" style="font-size:10px">🏖 ${leaveType||'Leave'}</span>
      <div style="margin-top:4px">
        <button class="btn btn-ghost btn-xs" onclick="clearTimeLog('${memberId}','${dateStr}')">Clear</button>
      </div>
    </div>`;
  }

  const projOptions = projects.map(p =>
    `<option value="${p.id||p.name||p.customerName||''}" ${proj===(p.id||p.name||p.customerName||'')?'selected':''}>
      ${p.name||p.customerName}
    </option>`
  ).join('');

  return `<div style="padding:4px">
    <div style="font-size:11px;font-weight:700;color:var(--lt);text-align:center;margin-bottom:4px">
      ${hours > 0 ? hours+'h'+(note?'  📝':'') : '—'}
    </div>
    <input type="number" min="0" max="24" step="0.5"
      id="tl-h-${memberId}-${dateStr}"
      value="${hours||''}"
      placeholder="hrs"
      style="width:100%;padding:4px 6px;border:1px solid var(--border-dk);border-radius:var(--rs);font-size:12px;text-align:center;margin-bottom:3px"/>
    <select id="tl-p-${memberId}-${dateStr}"
      style="width:100%;padding:4px 6px;border:1px solid var(--border-dk);border-radius:var(--rs);font-size:11px;margin-bottom:3px">
      <option value="">Project...</option>
      ${projOptions}
    </select>
    <input type="text"
      id="tl-n-${memberId}-${dateStr}"
      value="${note}"
      placeholder="Note..."
      style="width:100%;padding:4px 6px;border:1px solid var(--border-dk);border-radius:var(--rs);font-size:11px;margin-bottom:4px"/>
    <div style="display:flex;gap:3px">
      <button class="btn btn-primary btn-xs" style="flex:1;font-size:10px"
        onclick="saveTimeLog('${memberId}','${dateStr}')">Save</button>
      <button class="btn btn-ghost btn-xs" style="font-size:10px"
        onclick="markLeavePrompt('${memberId}','${dateStr}')">🏖</button>
    </div>
  </div>`;
}

// ─── TIME LOG (internal tab of Capacity & Resources) ──────
export function renderResources() { return renderCapacityResources(); }

function _renderTimeLog() {
  const capTab     = APP_STATE._capTab || 'timelog';
  const weekOffset = APP_STATE._timeLogWeekOffset !== undefined ? APP_STATE._timeLogWeekOffset : 0;
  const selMember  = APP_STATE._timeLogMember || '';
  const resources  = APP_STATE.resources || [];
  const members    = APP_STATE.teamMembers;

  function getWeekDates(offset) {
    const off = parseInt(offset) || 0;
    const now = new Date();
    const day = now.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon + (off * 7));
    monday.setHours(0,0,0,0);
    const days = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }

  const weekDays = getWeekDates(weekOffset);
  const dayStrs  = weekDays.map(d => d.toISOString().split('T')[0]);
  const today    = DateHelpers.today();

  const dayNames = ['MON','TUE','WED','THU','FRI'];
  const fmtD = d => { const dt = new Date(d+'T00:00:00'); return dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}); };

  const monStr = weekDays[0].toLocaleDateString('en-GB',{day:'2-digit',month:'short'});
  const friStr = weekDays[4].toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});

  function getLog(memberId, dateStr) {
    const docId = memberId+'_'+dateStr;
    return resources.find(r => r.id === docId || (r.memberId===memberId&&r.date===dateStr));
  }
  function cellDisplay(memberId, dateStr) {
    const log = getLog(memberId, dateStr);
    if (!log) return `<div style="font-size:11px;color:var(--lt);text-align:center">—</div>`;
    if (log.isLeave) {
      const abbr = (log.leaveType||'Leave').slice(0,3).toUpperCase();
      return `<span class="badge badge-purple" style="font-size:9px">🏖 ${abbr}</span>`;
    }
    return `<div style="font-size:12px;font-weight:700;color:var(--navy);text-align:center">${log.hours||0}h${log.note?` <span style="font-size:9px" title="${log.note}">📝</span>`:''}</div>`;
  }

  const allProjects = [...APP_STATE.projects, ...(APP_STATE.onboardingProjects||[])];

  function memberSummaryCard(m) {
    const weekHrs = dayStrs.reduce((s,d)=>{ const l=getLog(m.id,d); return s+(l&&!l.isLeave?parseFloat(l.hours)||0:0); }, 0);
    const mProj   = allProjects.filter(p=>p.devLead===m.id||p.devLead===m.name);
    const cap     = m.capacity||m.availability||80;
    const tcol    = TRACK_COLORS[m.track]||'#1B2B5E';
    return `<div class="card" style="margin-bottom:16px;border-left:4px solid ${tcol}">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
        <div class="av av-lg" style="background:${tcol}">${avatar(m.name)}</div>
        <div style="flex:1">
          <div style="font-size:16px;font-weight:800;color:var(--navy)">${m.name}</div>
          <div style="font-size:12px;color:var(--mid)">${m.role||'—'} · ${m.track||'—'}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:20px;font-weight:800;color:var(--navy)">${weekHrs}h</div>
          <div style="font-size:10px;color:var(--lt)">this week</div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:12px">
        <span style="color:var(--mid)">Allocation: <strong>${cap}%</strong></span>
        ${mProj.map(p=>`<span class="badge badge-navy" style="font-size:10px">${p.name||p.customerName}</span>`).join('')}
      </div>
    </div>`;
  }

  const selectedMember = selMember ? members.find(m=>m.id===selMember) : null;

  function cellForm(memberId, dateStr) {
    const log = getLog(memberId, dateStr);
    const inner = buildTimeLogCell(memberId, dateStr, log, allProjects);
    return `<div style="background:#f8faff;border:1px solid var(--border);border-radius:var(--rs);padding:8px;min-width:200px;position:absolute;z-index:20;top:100%;left:0;box-shadow:var(--shm)" id="cell-form-${memberId}-${dateStr}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <div style="font-size:10px;font-weight:700;color:var(--lt)">${fmtD(dateStr)}</div>
        <button class="btn btn-ghost btn-xs" onclick="document.getElementById('cell-form-${memberId}-${dateStr}')?.remove();event.stopPropagation()">×</button>
      </div>
      ${inner}
    </div>`;
  }

  // Pre-compute cell forms into a global dict to avoid JSON.stringify/attribute escaping issues
  window._tlForms = {};
  (selectedMember ? [selectedMember] : members).forEach(m => {
    dayStrs.forEach(d => { window._tlForms[m.id+'___'+d] = cellForm(m.id, d); });
  });

  const memberRows = (selectedMember ? [selectedMember] : members).map(m => {
    const weekTotal = dayStrs.reduce((s,d)=>{const l=getLog(m.id,d);return s+(l&&!l.isLeave?parseFloat(l.hours)||0:0);}, 0);
    return `<tr>
      <td class="mc">
        <div style="display:flex;align-items:center;gap:6px">
          <div class="av" style="background:${TRACK_COLORS[m.track]||'var(--navy)'}">${avatar(m.name)}</div>
          <div>
            <div style="font-weight:600;font-size:12px;color:var(--navy)">${m.name}</div>
            <div style="font-size:10px;color:var(--lt)">${m.track||'—'}</div>
          </div>
        </div>
      </td>
      ${dayStrs.map(d => {
        const log = getLog(m.id, d);
        const isToday = d === today;
        const fkey = m.id+'___'+d;
        const cellId = 'cell-form-'+m.id+'-'+d;
        return `<td style="cursor:pointer;position:relative;${isToday?'background:#f8faff;':''}" onclick="(function(e){if(!document.getElementById('${cellId}')){document.querySelectorAll('[id^=cell-form-]').forEach(el=>el.remove());const td=e.currentTarget;td.style.position='relative';td.insertAdjacentHTML('beforeend',window._tlForms['${fkey}']);}e.stopPropagation();})(event)">
          ${cellDisplay(m.id, d)}
        </td>`;
      }).join('')}
      <td style="text-align:center;font-weight:700;color:${weekTotal>40?'#ef4444':weekTotal>0?'var(--navy)':'var(--lt)'}">
        ${weekTotal>0?weekTotal+'h':'—'}
      </td>
    </tr>`;
  });

  return `
  ${execBanner('capacity')}
  <div class="vh">
    <div class="vh-left">
      <h1>Capacity &amp; Resources</h1>
      <div class="sub">Weekly time log — Mon to Fri</div>
    </div>
  </div>
  <div class="pulse-tabs no-print" style="margin-bottom:14px">
    <button class="pt" onclick="switchTab('_capTab','allocation')">Allocation</button>
    <button class="pt active" onclick="switchTab('_capTab','timelog')">Time Log</button>
  </div>
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
    <button class="btn btn-ghost btn-sm" onclick="changeWeek(-1)">← Prev Week</button>
    <span style="font-size:13px;font-weight:700;color:var(--navy)">${monStr} – ${friStr}</span>
    <button class="btn btn-ghost btn-sm" onclick="changeWeek(1)" ${weekOffset>=0?'disabled style="opacity:.4"':''}>Next Week →</button>
    ${weekOffset!==0?`<button class="btn btn-ghost btn-sm" onclick="changeWeek(null)">This Week</button>`:''}
    <span class="badge badge-teal" style="margin-left:auto">${weekOffset===0?'Current Week':`${Math.abs(weekOffset)} week${Math.abs(weekOffset)!==1?'s':''} ago`}</span>
  </div>
  <div style="display:flex;gap:8px;align-items:center;margin-bottom:14px">
    <select class="form-control" style="width:180px;font-size:12px" onchange="setTimeLogMember(this.value)">
      <option value="">All Members</option>
      ${members.map(m=>`<option value="${m.id}" ${selMember===m.id?'selected':''}>${m.name}</option>`).join('')}
    </select>
    ${selMember?`<button class="btn btn-ghost btn-sm" onclick="setTimeLogMember('')">Show All</button>`:''}
  </div>
  ${selectedMember ? memberSummaryCard(selectedMember) : ''}
  <div class="card" style="padding:0" onclick="document.querySelectorAll('[id^=cell-form-]').forEach(el=>el.remove())">
    <div style="overflow-x:auto">
      <table class="cap-table">
        <thead>
          <tr>
            <th class="mc">Member</th>
            ${dayStrs.map((d,i)=>{
              const isToday=d===today;
              return `<th style="${isToday?'background:var(--navy);color:#fff;':''}">${dayNames[i]}<div style="font-weight:400;font-size:9px">${fmtD(d)}</div></th>`;
            }).join('')}
            <th>Total</th>
          </tr>
        </thead>
        <tbody>${memberRows.join('')}</tbody>
      </table>
    </div>
  </div>
  <div style="font-size:11px;color:var(--lt);margin-top:10px">💡 Click any cell to log hours · 🏖 Mark leave from the cell form · 📝 = has note</div>`;
}

// ─── RISKS ────────────────────────────────────────────────
export function renderRisks() {
  const f     = APP_STATE.filters;
  const risks = f.track ? APP_STATE.risks.filter(r=>r.track===f.track) : APP_STATE.risks;
  const openRisks = risks.filter(r=>normaliseStatus(r.status)==='Open');
  const high  = openRisks.filter(r=>(r.likelihood||1)*(r.impact||1)>=12).length;
  const med   = openRisks.filter(r=>{ const s=(r.likelihood||1)*(r.impact||1); return s>=6&&s<12; }).length;
  const low   = openRisks.filter(r=>(r.likelihood||1)*(r.impact||1)<6).length;

  return `
  ${filterBar()}
  <div class="vh">
    <div class="vh-left">
      <h1>Risk Register</h1>
      <div class="sub">${risks.length} risks tracked</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="openModal('risk')">+ Add Risk</button>
    </div>
  </div>

  ${statRow(
    statBlock(high,'High','score ≥ 12','#DC2626') +
    statBlock(med,'Medium','score 6–11','#D97706') +
    statBlock(low,'Low','score < 6','#059669') +
    statBlock(openRisks.length,'Open Total','all open risks','var(--navy)')
  )}

  <div class="card" style="padding:0">
    <div class="tbl-wrap">
      <table class="dt">
        <thead><tr><th>Risk</th><th>Project</th><th>Track</th><th>L</th><th>I</th><th>Score</th><th>Owner</th><th>Mitigation</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${risks.length ? risks.map(r=>{
            const score = (r.likelihood||1)*(r.impact||1);
            const cls   = score>=12?'score-h':score>=6?'score-m':'score-l';
            return `<tr>
              <td style="font-weight:600">${r.title}</td>
              <td style="font-size:12px">${r.project||'—'}</td>
              <td>${r.track?`<span class="badge badge-navy">${r.track}</span>`:'—'}</td>
              <td style="text-align:center">${r.likelihood||1}</td>
              <td style="text-align:center">${r.impact||1}</td>
              <td style="text-align:center"><span class="risk-score ${cls}">${score}</span></td>
              <td style="font-size:12px">${r.owner||'—'}</td>
              <td style="font-size:12px;max-width:200px">${r.mitigation||'—'}</td>
              <td>${ragBadge(r.status)}</td>
              <td>
                <button class="btn-icon" onclick="openModal('risk','${r.id}')">✏️</button>
                <button class="btn-icon" onclick="deleteItem('risks','${r.id}')">🗑</button>
              </td>
            </tr>`;
          }).join(''):`<tr><td colspan="10"><div class="empty"><div class="empty-icon">✅</div>No risks logged</div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── ESCALATIONS ──────────────────────────────────────────
export function renderEscalations() {
  const escs = [...(APP_STATE.escalations||[])].sort((a,b)=>{ const da=a.date||''; const db=b.date||''; return da>db?-1:da<db?1:0; });
  return `
  <div class="vh">
    <div class="vh-left">
      <h1>Escalations</h1>
      <div class="sub">${escs.length} escalations</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="openModal('escalation')">+ Add Escalation</button>
    </div>
  </div>
  ${escs.length ? escs.map(e=>`
  <div class="flag-card ${normaliseStatus(e.status)==='Resolved'?'':['High','Critical'].includes(normaliseStatus(e.priority))?'high':'med'}" style="margin-bottom:8px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <div style="flex:1;font-size:14px;font-weight:700;color:var(--navy)">${e.title}</div>
      ${ragBadge(e.priority)} ${ragBadge(e.status)}
    </div>
    <div style="font-size:11px;color:var(--lt);margin-bottom:6px">📁 ${e.project||'—'} · 👤 ${e.raisedBy||'—'} · 📅 ${DateHelpers.fmt(e.date)}</div>
    ${e.notes?`<div style="font-size:12px;color:var(--mid)">${e.notes}</div>`:''}
    ${e.resolution?`<div style="font-size:12px;color:#16a34a;margin-top:4px">✅ ${e.resolution}</div>`:''}
    <div style="display:flex;gap:8px;margin-top:8px">
      <button class="btn btn-ghost btn-sm" onclick="openModal('escalation','${e.id}')">Edit</button>
      <button class="btn btn-danger btn-sm" onclick="deleteItem('escalations','${e.id}')">🗑</button>
    </div>
  </div>`).join(''):`<div class="empty"><div class="empty-icon">🚨</div>No escalations</div>`}`;
}

// ─── LEADERSHIP REPORT ────────────────────────────────────
export function renderLeadership() {
  const today     = DateHelpers.today();
  const now       = new Date();
  const projects  = [...APP_STATE.projects].sort((a,b)=>{ const da=a.endDate||a.startDate||''; const db=b.endDate||b.startDate||''; return da<db?-1:da>db?1:0; });
  const milestones= [...APP_STATE.milestones].sort((a,b)=>{ const da=a.dueDate||''; const db=b.dueDate||''; return da<db?-1:da>db?1:0; });
  const risks     = APP_STATE.risks || [];
  const escs      = APP_STATE.escalations || [];
  const pledges   = APP_STATE.pledges || [];
  const resources = APP_STATE.resources || [];
  const members   = APP_STATE.teamMembers || [];
  const tracks    = APP_STATE.settings.trackNames || [];
  const impacts   = APP_STATE.impacts || [];

  const openRisks = risks.filter(r=>normaliseStatus(r.status)==='Open');
  const highRisks = openRisks.filter(r=>(r.likelihood||1)*(r.impact||1)>=7);
  const overdueMilestones = milestones.filter(m=>m.dueDate<today&&m.status!=='Completed');
  const openEscL34 = escs.filter(e=>['L3','L4'].includes(e.level||'')&&normaliseStatus(e.status||'Open')!=='Resolved');

  const activeTab = APP_STATE._leadershipTab || 'weekly';

  function tabBtn(key, lbl) {
    return `<button class="pt ${activeTab===key?'active':''}" onclick="switchTab('_leadershipTab','${key}')">${lbl}</button>`;
  }

  function trackStats(track) {
    const tm  = members.filter(m=>m.track===track);
    const tp  = projects.filter(p=>p.track===track);
    const avgAlloc = tm.length ? Math.round(tm.reduce((s,m)=>s+(m.availability||100),0)/tm.length) : 0;
    const weekAgo  = new Date(now); weekAgo.setDate(weekAgo.getDate()-7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    const hrsLogged = resources.filter(r=>tm.some(m=>m.id===r.memberId)&&r.date>=weekAgoStr).reduce((s,r)=>s+(parseFloat(r.hours)||0),0);
    const tMs   = milestones.filter(m=>tm.some(mb=>mb.id===m.ownerId)||tp.some(p=>p.name===m.projectName||p.id===m.projectId));
    const compMs = tMs.filter(m=>m.status==='Completed').length;
    const ovdMs  = tMs.filter(m=>m.dueDate<today&&m.status!=='Completed').length;
    const signal = avgAlloc>85?'⚠️ Overloaded':ovdMs>0?'⚠️ Delays':'✅ Healthy';
    return { tm, tp, avgAlloc, hrsLogged, tMs, compMs, ovdMs, signal };
  }

  // ── DAILY REPORT ─────────────────────────────────────────
  function dailyTab() {
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate()-1);
    const yStr = yesterday.toISOString().split('T')[0];
    const in3d  = new Date(now); in3d.setDate(in3d.getDate()+3);
    const in3dStr = in3d.toISOString().split('T')[0];

    const toDateStr = v => typeof v === 'string' ? v : (v?.toDate?.()?.toISOString?.()?.split('T')[0] || '');
    const completedYesterday = milestones.filter(m=>m.status==='Completed'&&(m.completedDate===yStr||toDateStr(m.updatedAt).startsWith(yStr)));
    const inProgressProj = projects.filter(p=>normaliseStatus(p.status)==='In Progress');
    const blockers = [
      ...projects.filter(p=>p.status==='On Hold'),
      ...openEscL34.map(e=>({name:e.title||'Escalation',track:'—',phase:'—',description:e.project})),
      ...highRisks.map(r=>({name:r.title,track:'—',phase:'—',description:r.mitigation}))
    ];
    const upcoming3d = milestones.filter(m=>m.dueDate>=today&&m.dueDate<=in3dStr&&m.status!=='Completed').sort((a,b)=>a.dueDate>b.dueDate?1:-1);

    const trackRows = tracks.length ? tracks.map(track=>{
      const s = trackStats(track);
      const msToday = s.tMs.filter(m=>m.dueDate===today).length;
      return `<tr>
        <td style="font-weight:700">${track}</td>
        <td>${s.tm.length}</td>
        <td>${s.tp.length}</td>
        <td>${s.avgAlloc}%</td>
        <td>${s.hrsLogged}h</td>
        <td>${msToday}</td>
        <td>${s.signal}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="7" class="empty">No tracks configured</td></tr>`;

    return `
    <div class="report-section">
      <h2>📊 Programme Snapshot</h2>
      ${statRow(statBlock(projects.length,'Total','all projects','var(--navy)')+statBlock(inProgressProj.length,'In Progress','active','#7c3aed')+statBlock(projects.filter(p=>p.status==='On Hold').length,'Blocked','on hold','#dc2626')+statBlock(overdueMilestones.length,'Overdue Milestones','past due','#dc2626')+statBlock(openRisks.length,'Open Flags','risks+esc','#d97706'))}
    </div>
    <div class="report-section">
      <h2>✅ Completed Yesterday</h2>
      ${completedYesterday.length ? `<div class="tbl-wrap"><table class="dt"><thead><tr><th>Milestone</th><th>Project</th><th>Completed by</th><th>Track</th></tr></thead><tbody>${completedYesterday.map(m=>`<tr><td style="font-weight:600">${m.title}</td><td>${m.projectName||'—'}</td><td>${teamName(m.ownerId)||'—'}</td><td>${m.track||'—'}</td></tr>`).join('')}</tbody></table></div>` : `<div style="font-size:12px;color:var(--lt);padding:8px 0">No milestones completed yesterday</div>`}
    </div>
    <div class="report-section">
      <h2>🚀 In Progress Today</h2>
      ${inProgressProj.length ? `<div class="tbl-wrap"><table class="dt"><thead><tr><th>Project</th><th>Track</th><th>Phase</th><th>Progress</th><th>Dev Lead</th><th>Sprint</th><th>Next Milestone</th></tr></thead><tbody>${inProgressProj.map(p=>{
        const nextMs = milestones.filter(m=>(m.projectId===p.id||m.projectName===p.name)&&m.status!=='Completed').sort((a,b)=>a.dueDate>b.dueDate?1:-1)[0];
        return `<tr><td style="font-weight:600">${p.name}</td><td>${resolveTrackName(p.track||p.trackId)||'—'}</td><td>${p.phase||'—'}</td><td>${progressBar(projProgress(p))}<span style="font-size:11px">${projProgress(p)}%</span></td><td>${teamName(p.devLead)}</td><td>${p.sprint||'—'}</td><td>${nextMs?`${nextMs.title} · ${DateHelpers.fmt(nextMs.dueDate)}`:'—'}</td></tr>`;
      }).join('')}</tbody></table></div>` : `<div style="font-size:12px;color:var(--lt);padding:8px 0">No projects in progress</div>`}
    </div>
    <div class="report-section">
      <h2>🚨 Blockers &amp; Alerts</h2>
      ${blockers.length ? blockers.map(b=>`<div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:0 var(--rs) var(--rs) 0;padding:10px 14px;margin-bottom:8px"><div style="font-size:13px;font-weight:700;color:#dc2626">${b.name||b.title||'—'}</div><div style="font-size:12px;color:var(--mid)">${b.description||b.phase||'—'}</div></div>`).join('') : `<div style="font-size:12px;color:#16a34a;padding:8px 0">✅ No blockers today</div>`}
    </div>
    <div class="report-section">
      <h2>📅 Upcoming (Next 3 Days)</h2>
      ${upcoming3d.length ? `<div class="tbl-wrap"><table class="dt"><thead><tr><th>Milestone</th><th>Project</th><th>Due Date</th><th>Owner</th><th>Status</th></tr></thead><tbody>${upcoming3d.map(m=>`<tr><td style="font-weight:600">${m.title}</td><td>${m.projectName||'—'}</td><td>${DateHelpers.fmt(m.dueDate)}</td><td>${teamName(m.ownerId)||'—'}</td><td>${ragBadge(m.status)}</td></tr>`).join('')}</tbody></table></div>` : `<div style="font-size:12px;color:var(--lt);padding:8px 0">No milestones in the next 3 days</div>`}
    </div>
    <div class="report-section">
      <h2>🏗️ Track-wise Resource Status</h2>
      <div class="tbl-wrap"><table class="dt"><thead><tr><th>Track</th><th>Members</th><th>Active Projects</th><th>Avg Allocation %</th><th>Hours This Week</th><th>Milestones Due Today</th><th>Signal</th></tr></thead><tbody>${trackRows}</tbody></table></div>
    </div>
    <div class="report-section">
      <h2>👥 Resource Snapshot</h2>
      <div class="tbl-wrap"><table class="dt"><thead><tr><th>Member</th><th>Track</th><th>Allocation %</th><th>Status</th><th>Projects</th><th>Hours Today</th></tr></thead><tbody>
        ${members.map(m => {
          const cap = m.capacity||m.availability||80;
          const cls = cap>100?'badge-red':cap>=80?'badge-amber':'badge-teal';
          const lbl = cap>100?'Overloaded':cap>=80?'At Capacity':'Available';
          const hoursToday = (resources||[]).filter(r=>r.memberId===m.id&&r.date===today).reduce((s,r)=>s+(parseFloat(r.hours)||0),0);
          const mProj = [...APP_STATE.projects,...(APP_STATE.onboardingProjects||[])].filter(p=>p.devLead===m.id||p.devLead===m.name);
          return `<tr>
            <td style="font-weight:600">${m.name}</td>
            <td>${m.track||'—'}</td>
            <td><strong>${cap}%</strong></td>
            <td><span class="badge ${cls}">${lbl}</span></td>
            <td style="font-size:11px">${mProj.slice(0,2).map(p=>p.name||p.customerName).join(', ')||'—'}</td>
            <td>${hoursToday>0?hoursToday+'h':'—'}</td>
          </tr>`;
        }).join('')||`<tr><td colspan="6" class="empty">No members</td></tr>`}
      </tbody></table></div>
    </div>`;
  }

  // ── WEEKLY REPORT ────────────────────────────────────────
  function weeklyTab() {
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate()-3);
    const weekEnd   = new Date(now); weekEnd.setDate(weekEnd.getDate()+3);
    const wsStr = weekStart.toISOString().split('T')[0];
    const weStr = weekEnd.toISOString().split('T')[0];
    const weekMs  = milestones.filter(m=>m.dueDate>=wsStr&&m.dueDate<=weStr);
    const weekMsComplete = weekMs.filter(m=>m.status==='Completed').length;
    const weekMsMissed   = weekMs.filter(m=>m.dueDate<today&&m.status!=='Completed').length;
    const weekMsOnTrack  = weekMs.length - weekMsComplete - weekMsMissed;
    const ontimeRate = weekMs.length > 0 ? Math.round(weekMsComplete/weekMs.length*100) : 100;
    const newRisks   = risks.filter(r=>{ const d=r.createdAt||(r.date||''); return d>=wsStr; });
    const nonHonored = pledges.filter(p=>p.status!=='Honored').sort((a,b)=>a.dueDate>b.dueDate?1:-1);

    const trackDetailRows = tracks.length ? tracks.map(track=>{
      const s = trackStats(track);
      return `<tr>
        <td style="font-weight:700">${track}</td>
        <td>${s.tm.length}</td>
        <td>${s.tp.length}</td>
        <td>${s.avgAlloc}%</td>
        <td>${s.hrsLogged}h</td>
        <td>${s.compMs}</td>
        <td>${s.ovdMs}</td>
        <td>${s.signal}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="8" class="empty">No tracks configured</td></tr>`;

    const mostLoaded = tracks.length ? tracks.reduce((a,t)=>{ const s=trackStats(t); return s.avgAlloc>trackStats(a).avgAlloc?t:a; }, tracks[0]) : '—';
    const leastLoaded = tracks.length ? tracks.reduce((a,t)=>{ const s=trackStats(t); return s.avgAlloc<trackStats(a).avgAlloc?t:a; }, tracks[0]) : '—';

    return `
    <div class="report-section">
      <h2>📋 Executive Summary — Week of ${DateHelpers.fmt(today)}</h2>
      <div class="card" style="background:#f8faff;border-left:4px solid var(--navy)">
        <p style="font-size:13px;color:var(--text);line-height:1.7">
          This week, <strong>${projects.filter(p=>p.status==='In Progress').length}</strong> projects are active across <strong>${tracks.length||'—'}</strong> tracks.
          <strong>${weekMs.length}</strong> milestones are due this week — <strong>${weekMsOnTrack}</strong> on track, <strong>${weekMsComplete}</strong> completed, <strong>${weekMsMissed}</strong> at risk.
          <strong>${highRisks.length}</strong> high-priority risks remain open.
          <strong>${openEscL34.length}</strong> escalations require leadership attention.
        </p>
      </div>
    </div>
    <div class="report-section">
      <h2>🟢🟡🔴 Project Health (RAG)</h2>
      <div class="tbl-wrap"><table class="dt"><thead><tr><th>Project</th><th>Track</th><th>Priority</th><th>Phase</th><th>Progress</th><th>Status</th><th>End Date</th><th>Dev Lead</th></tr></thead><tbody>${projects.map(p=>`<tr><td style="font-weight:600">${p.name||'Unnamed'}</td><td>${resolveTrackName(p.track||p.trackId)||'—'}</td><td>${ragBadge(p.priority)}</td><td>${p.phase||'—'}</td><td>${progressBar(projProgress(p))}<span style="font-size:11px">${projProgress(p)}%</span></td><td>${ragBadge(p.status)}</td><td style="${p.endDate<today&&p.status!=='Completed'?'color:#dc2626':''}">${DateHelpers.fmt(p.endDate)}</td><td>${teamName(p.devLead)}</td></tr>`).join('')||`<tr><td colspan="8" class="empty">No projects</td></tr>`}</tbody></table></div>
    </div>
    <div class="report-section">
      <h2>🎯 Milestone Status This Week</h2>
      ${weekMs.length ? `<div class="tbl-wrap"><table class="dt"><thead><tr><th>Milestone</th><th>Project</th><th>Due</th><th>Owner</th><th>Status</th><th>Days</th></tr></thead><tbody>${weekMs.map(m=>{
        const daysLeft = DateHelpers.daysBetween(today, m.dueDate);
        const timing = m.status==='Completed' ? '<span style="color:#16a34a">✓</span>' : daysLeft<0 ? `<span style="color:#dc2626">${Math.abs(daysLeft)}d late</span>` : `${daysLeft}d`;
        return `<tr><td style="font-weight:600">${m.title}</td><td>${m.projectName||'—'}</td><td>${DateHelpers.fmt(m.dueDate)}</td><td>${teamName(m.ownerId)||'—'}</td><td>${ragBadge(m.status)}</td><td>${timing}</td></tr>`;
      }).join('')}</tbody></table></div>
      <div style="padding:10px 0;font-size:12px;color:var(--mid);display:flex;gap:16px;flex-wrap:wrap">
        <span>Planned: <strong>${weekMs.length}</strong></span>
        <span>Completed: <strong>${weekMsComplete}</strong></span>
        <span>Missed: <strong>${weekMsMissed}</strong></span>
        <span>On-time rate: <strong style="color:${ontimeRate>=85?'#16a34a':ontimeRate>=70?'#d97706':'#dc2626'}">${ontimeRate}%</strong></span>
      </div>` : `<div style="font-size:12px;color:var(--lt);padding:8px 0">No milestones due this week</div>`}
    </div>
    <div class="report-section">
      <h2>⚠️ Risks &amp; Escalations</h2>
      ${newRisks.length?`<div style="font-size:12px;font-weight:700;color:var(--mid);margin-bottom:6px">New this week (${newRisks.length})</div><div class="tbl-wrap"><table class="dt"><thead><tr><th>Risk</th><th>Project</th><th>Score</th><th>Owner</th></tr></thead><tbody>${newRisks.map(r=>`<tr><td>${r.title}</td><td>${r.project||'—'}</td><td>${(r.likelihood||1)*(r.impact||1)}</td><td>${r.owner||'—'}</td></tr>`).join('')}</tbody></table></div>`:''}
      ${highRisks.length?`<div style="font-size:12px;font-weight:700;color:#dc2626;margin:10px 0 6px">High risks open (${highRisks.length})</div><div class="tbl-wrap"><table class="dt"><thead><tr><th>Risk</th><th>Project</th><th>Score</th><th>Mitigation</th></tr></thead><tbody>${highRisks.map(r=>`<tr><td style="font-weight:600">${r.title}</td><td>${r.project||'—'}</td><td><span class="risk-score score-h">${(r.likelihood||1)*(r.impact||1)}</span></td><td>${r.mitigation||'—'}</td></tr>`).join('')}</tbody></table></div>`:''}
      ${openEscL34.length?`<div style="font-size:12px;font-weight:700;color:#d97706;margin:10px 0 6px">Escalations L3/L4 (${openEscL34.length})</div><div class="tbl-wrap"><table class="dt"><thead><tr><th>Project</th><th>Level</th><th>Issue</th><th>Days Open</th></tr></thead><tbody>${openEscL34.map(e=>`<tr><td>${e.project||'—'}</td><td>${e.level||'—'}</td><td>${e.title||e.issue||'—'}</td><td>${e.date?DateHelpers.daysBetween(e.date,today):'—'}</td></tr>`).join('')}</tbody></table></div>`:''}
      ${!newRisks.length&&!highRisks.length&&!openEscL34.length?`<div style="font-size:12px;color:#16a34a;padding:8px 0">✅ No critical risks or escalations</div>`:''}
    </div>
    <div class="report-section">
      <h2>🤝 Pledges / Customer Commitments</h2>
      ${nonHonored.length?`<div class="tbl-wrap"><table class="dt"><thead><tr><th>Customer</th><th>Commitment</th><th>Due</th><th>Owner</th><th>Status</th><th>Days</th></tr></thead><tbody>${nonHonored.map(p=>{
        const dl = p.dueDate?DateHelpers.daysBetween(today,p.dueDate):null;
        const days = dl===null?'—':dl<0?`<span style="color:#dc2626">${Math.abs(dl)}d late</span>`:`${dl}d`;
        return `<tr><td>${p.customer||'—'}</td><td style="font-weight:600">${p.title||'—'}</td><td>${DateHelpers.fmt(p.dueDate)}</td><td>${p.owner||'—'}</td><td>${ragBadge(p.status)}</td><td>${days}</td></tr>`;
      }).join('')}</tbody></table></div>` : `<div style="font-size:12px;color:#16a34a;padding:8px 0">✅ All pledges honored</div>`}
    </div>
    <div class="report-section">
      <h2>🏗️ Track-wise Resource Utilisation</h2>
      ${tracks.length?`<div class="tbl-wrap"><table class="dt"><thead><tr><th>Track</th><th>Members</th><th>Projects</th><th>Avg Alloc</th><th>Hours Logged</th><th>✅ Ms Done</th><th>🔴 Ms Overdue</th><th>Signal</th></tr></thead><tbody>${trackDetailRows}</tbody></table></div>
      <div style="margin-top:12px;padding:12px;background:#f8faff;border-radius:var(--rs);font-size:12px;color:var(--mid);display:flex;flex-direction:column;gap:4px">
        ${tracks.length?`<div>Most loaded: <strong>${mostLoaded}</strong> at <strong>${trackStats(mostLoaded).avgAlloc}%</strong></div><div>Available bandwidth: <strong>${leastLoaded}</strong> has <strong>${100-trackStats(leastLoaded).avgAlloc}%</strong> free</div><div>Delivery risk: tracks with overdue milestones need attention</div>`:''}
      </div>` : `<div class="empty">No tracks configured</div>`}
    </div>
    <div class="report-section">
      <h2>📊 Team Allocation &amp; Time Log — Week of ${DateHelpers.fmt(today)}</h2>
      ${(() => {
        const day = new Date().getDay();
        const monday = new Date(); monday.setDate(monday.getDate()-(day===0?6:day-1)); monday.setHours(0,0,0,0);
        const weekDayStrs = Array.from({length:5},(_,i)=>{ const d=new Date(monday); d.setDate(monday.getDate()+i); return d.toISOString().split('T')[0]; });
        const allProj2 = [...APP_STATE.projects,...(APP_STATE.onboardingProjects||[])];
        const overRows = tracks.length ? tracks.map(track=>{
          const tm2 = members.filter(m=>m.track===track);
          const avgCap = tm2.length?Math.round(tm2.reduce((s,m)=>s+(m.capacity||m.availability||80),0)/tm2.length):0;
          const overCnt = tm2.filter(m=>(m.capacity||m.availability||80)>100).length;
          const availCnt = tm2.filter(m=>(m.capacity||m.availability||80)<80).length;
          return `<tr><td style="font-weight:700">${track}</td><td>${tm2.length}</td><td>${avgCap}%</td><td style="color:${overCnt>0?'#dc2626':'inherit'}">${overCnt}</td><td>${availCnt}</td></tr>`;
        }).join('') : '<tr><td colspan="5" class="empty">No tracks</td></tr>';
        const memberHrRows = members.map(m=>{
          const dayHrs = weekDayStrs.map(d=>{ const l=(resources||[]).find(r=>r.memberId===m.id&&r.date===d); return l?.isLeave?'🏖':(l?.hours||0)+''; });
          const total = weekDayStrs.reduce((s,d)=>{ const l=(resources||[]).find(r=>r.memberId===m.id&&r.date===d); return s+(l&&!l.isLeave?parseFloat(l.hours)||0:0); },0);
          const leaveCnt = weekDayStrs.filter(d=>{ const l=(resources||[]).find(r=>r.memberId===m.id&&r.date===d); return l?.isLeave; }).length;
          return `<tr><td style="font-weight:600">${m.name}</td><td>${m.track||'—'}</td>${dayHrs.map(h=>`<td style="text-align:center;font-size:11px">${h}</td>`).join('')}<td style="font-weight:700">${total>0?total+'h':'—'}</td><td>${leaveCnt>0?leaveCnt+'d':'—'}</td></tr>`;
        }).join('');
        return `<div style="margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:var(--mid);margin-bottom:6px">Allocation by Track</div>
          <div class="tbl-wrap"><table class="dt"><thead><tr><th>Track</th><th>Members</th><th>Avg Allocation</th><th>Overloaded</th><th>Available</th></tr></thead><tbody>${overRows}</tbody></table></div>
        </div>
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--mid);margin-bottom:6px">Weekly Hours by Member</div>
          <div class="tbl-wrap"><table class="dt"><thead><tr><th>Member</th><th>Track</th><th>Mon</th><th>Tue</th><th>Wed</th><th>Thu</th><th>Fri</th><th>Total</th><th>Leave</th></tr></thead><tbody>${memberHrRows}</tbody></table></div>
        </div>`;
      })()}
    </div>
    <div class="report-section">
      <h2>🔷 Decisions Required</h2>
      ${openEscL34.length+highRisks.length>0?[...openEscL34.map(e=>`<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:var(--rs);padding:12px;margin-bottom:8px"><div style="font-size:11px;font-weight:700;color:#92400e;text-transform:uppercase;margin-bottom:4px">ESCALATION ${e.level||''}</div><div style="font-size:13px;font-weight:700;color:var(--navy)">${e.project||'—'}</div><div style="font-size:12px;color:var(--mid)">${e.title||e.issue||'—'}</div></div>`), ...highRisks.map(r=>`<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:var(--rs);padding:12px;margin-bottom:8px"><div style="font-size:11px;font-weight:700;color:#991b1b;text-transform:uppercase;margin-bottom:4px">HIGH RISK · SCORE ${(r.likelihood||1)*(r.impact||1)}</div><div style="font-size:13px;font-weight:700;color:var(--navy)">${r.title}</div><div style="font-size:12px;color:var(--mid)">${r.mitigation||'—'}</div></div>`)].join(''):`<div style="font-size:12px;color:#16a34a;padding:8px 0">✅ No decisions required this week</div>`}
    </div>`;
  }

  // ── MONTHLY REPORT ───────────────────────────────────────
  function monthlyTab() {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth()+1, 1).toISOString().split('T')[0];
    const nextMonthEnd   = new Date(now.getFullYear(), now.getMonth()+2, 0).toISOString().split('T')[0];
    const monthName = now.toLocaleString('en-GB', { month:'long', year:'numeric' });

    const completedThisMonth = projects.filter(p=>p.status==='Completed'&&(p.endDate||'')>=monthStart&&(p.endDate||'')<nextMonthStart);
    const msThisMonth = milestones.filter(m=>m.dueDate>=monthStart&&m.dueDate<nextMonthStart);
    const msCompleted = msThisMonth.filter(m=>m.status==='Completed').length;
    const msPlanned   = msThisMonth.length;
    const msMissed    = msThisMonth.filter(m=>m.dueDate<today&&m.status!=='Completed').length;
    const otRate      = msPlanned > 0 ? Math.round(msCompleted/msPlanned*100) : 100;
    const newRisksMonth = risks.filter(r=>(r.createdAt||r.date||'')>=monthStart);
    const closedRisksMonth = risks.filter(r=>(r.closedAt||'')>=monthStart&&r.status!=='Open');
    const nextMsMs = milestones.filter(m=>m.dueDate>=nextMonthStart&&m.dueDate<=nextMonthEnd).sort((a,b)=>a.dueDate>b.dueDate?1:-1).slice(0,5);

    const trackDetailRows = tracks.length ? tracks.map(track=>{
      const s = trackStats(track);
      const msRate = s.tMs.length>0?Math.round(s.compMs/s.tMs.length*100):100;
      return `<tr>
        <td style="font-weight:700">${track}</td>
        <td>${s.tm.length}</td>
        <td>${s.tp.length}</td>
        <td>${s.hrsLogged}h</td>
        <td>${s.avgAlloc}%</td>
        <td>${s.compMs}</td>
        <td>${s.ovdMs}</td>
        <td>${msRate}%</td>
        <td>${s.signal}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="9" class="empty">No tracks configured</td></tr>`;

    const honoredPledges  = pledges.filter(p=>p.status==='Honored').length;
    const breachedPledges = pledges.filter(p=>p.status==='Breached');
    const inProgPledges   = pledges.filter(p=>!['Honored','Breached'].includes(p.status)).length;
    const ragOverall = otRate>=85?'🟢 Green':otRate>=70?'🟡 Amber':'🔴 Red';

    return `
    <div class="report-section">
      <h2>📋 Monthly Program Review — ${monthName}</h2>
      <div class="card" style="background:#f8faff;border-left:4px solid var(--navy)">
        <p style="font-size:13px;color:var(--text);line-height:1.7">
          ${monthName}: <strong>${projects.filter(p=>p.status==='In Progress').length}</strong> projects active, <strong>${msPlanned}</strong> milestones planned.
          <strong>${completedThisMonth.length}</strong> projects delivered. Business impact measured on <strong>${impacts.length}</strong> shipped features.
          Overall programme health: <strong>${ragOverall}</strong>.
        </p>
      </div>
    </div>
    <div class="report-section">
      <h2>🚀 What Shipped This Month</h2>
      ${completedThisMonth.length ? `<div class="tbl-wrap"><table class="dt"><thead><tr><th>Project</th><th>Go-Live Date</th><th>Impact</th></tr></thead><tbody>${completedThisMonth.map(p=>{
        const imp = impacts.filter(i=>i.project===p.name||i.projectId===p.id);
        return `<tr><td style="font-weight:600">${p.name}</td><td>${DateHelpers.fmt(p.endDate)}</td><td>${imp.length?imp.map(i=>`${i.metric}: ${i.baseline}→<strong>${i.current}</strong>`).join(', '):'—'}</td></tr>`;
      }).join('')}</tbody></table></div>` : `<div style="font-size:12px;color:var(--lt);padding:8px 0">No projects completed this month</div>`}
    </div>
    <div class="report-section">
      <h2>🔄 Projects In Flight</h2>
      <div class="tbl-wrap"><table class="dt"><thead><tr><th>Project</th><th>Track</th><th>Priority</th><th>Phase</th><th>Progress</th><th>Status</th><th>End Date</th></tr></thead><tbody>${projects.filter(p=>p.status!=='Completed').map(p=>`<tr><td style="font-weight:600">${p.name}</td><td>${resolveTrackName(p.track||p.trackId)||'—'}</td><td>${ragBadge(p.priority)}</td><td>${p.phase||'—'}</td><td>${progressBar(projProgress(p))}<span style="font-size:11px">${projProgress(p)}%</span></td><td>${ragBadge(p.status)}</td><td>${DateHelpers.fmt(p.endDate)}</td></tr>`).join('')||`<tr><td colspan="7" class="empty">No active projects</td></tr>`}</tbody></table></div>
    </div>
    <div class="report-section">
      <h2>📈 Monthly Resource Utilisation</h2>
      ${(() => {
        const allProj3 = [...APP_STATE.projects,...(APP_STATE.onboardingProjects||[])];
        const totalHrs = (resources||[]).filter(r=>r.date>=monthStart&&r.date<nextMonthStart&&!r.isLeave).reduce((s,r)=>s+(parseFloat(r.hours)||0),0);
        const totalLeave = (resources||[]).filter(r=>r.date>=monthStart&&r.date<nextMonthStart&&r.isLeave).length;
        const avgUtil = members.length?Math.round(members.reduce((s,m)=>s+(m.capacity||m.availability||80),0)/members.length):0;
        const annualLeave = (resources||[]).filter(r=>r.date>=monthStart&&r.date<nextMonthStart&&r.leaveType==='Annual').length;
        const sickLeave   = (resources||[]).filter(r=>r.date>=monthStart&&r.date<nextMonthStart&&r.leaveType==='Sick').length;
        const phLeave     = (resources||[]).filter(r=>r.date>=monthStart&&r.date<nextMonthStart&&r.leaveType==='Public Holiday').length;
        const otherLeave  = totalLeave - annualLeave - sickLeave - phLeave;
        const overAllocated = members.filter(m=>(m.capacity||m.availability||80)>100);
        const zeroHrs      = members.filter(m=>!(resources||[]).some(r=>r.memberId===m.id&&r.date>=monthStart&&r.date<nextMonthStart&&(parseFloat(r.hours)||0)>0));
        return `
        ${statRow(
          statBlock(members.length,'Headcount','team members','var(--navy)')+
          statBlock(avgUtil,'Avg Util %','team average','#7c3aed')+
          statBlock(Math.round(totalHrs),'Hours Logged','this month','#059669')+
          statBlock(totalLeave,'Leave Days','total','#d97706')
        )}
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;font-size:12px">
          <span>Annual: <strong>${annualLeave}d</strong></span>
          <span>Sick: <strong>${sickLeave}d</strong></span>
          <span>Public Holiday: <strong>${phLeave}d</strong></span>
          <span>Other: <strong>${otherLeave}d</strong></span>
        </div>
        ${overAllocated.length?`<div style="background:#fef2f2;border-left:3px solid #dc2626;border-radius:0 var(--rs) var(--rs) 0;padding:10px;margin-bottom:8px"><div style="font-size:11px;font-weight:700;color:#dc2626;margin-bottom:4px">⚠️ OVERALLOCATED MEMBERS</div>${overAllocated.map(m=>`<div style="font-size:12px;color:var(--text)">${m.name} — ${m.capacity||m.availability||80}% across ${allProj3.filter(p=>p.devLead===m.id||p.devLead===m.name).length} projects</div>`).join('')}</div>`:''}
        ${zeroHrs.length?`<div style="background:#fffbeb;border-left:3px solid #d97706;border-radius:0 var(--rs) var(--rs) 0;padding:10px"><div style="font-size:11px;font-weight:700;color:#d97706;margin-bottom:4px">⚠️ NO HOURS LOGGED THIS MONTH</div>${zeroHrs.map(m=>`<div style="font-size:12px;color:var(--text)">${m.name} — ${m.track||'—'}</div>`).join('')}</div>`:''}`;
      })()}
    </div>
    <div class="report-section">
      <h2>📊 Milestone Adherence</h2>
      <div style="display:flex;align-items:center;gap:20px;margin-bottom:12px">
        <div style="font-size:48px;font-weight:800;color:${otRate>=85?'#16a34a':otRate>=70?'#d97706':'#dc2626'}">${otRate}%</div>
        <div style="font-size:12px;color:var(--mid)"><div>On-time delivery rate</div><div>Planned: ${msPlanned} · Completed: ${msCompleted} · Missed: ${msMissed}</div></div>
      </div>
      ${msMissed>0?`<div style="font-size:12px;font-weight:700;color:#dc2626;margin-bottom:6px">Missed milestones</div><div class="tbl-wrap"><table class="dt"><thead><tr><th>Milestone</th><th>Project</th><th>Due Date</th><th>Status</th></tr></thead><tbody>${msThisMonth.filter(m=>m.dueDate<today&&m.status!=='Completed').map(m=>`<tr><td>${m.title}</td><td>${m.projectName||'—'}</td><td>${DateHelpers.fmt(m.dueDate)}</td><td>${ragBadge(m.status)}</td></tr>`).join('')}</tbody></table></div>`:''}
    </div>
    <div class="report-section">
      <h2>🏗️ Track-wise Resource &amp; Productivity</h2>
      ${tracks.length?`<div class="tbl-wrap"><table class="dt"><thead><tr><th>Track</th><th>Members</th><th>Projects</th><th>Total Hours</th><th>Avg Util</th><th>Ms Done</th><th>Ms Missed</th><th>On-time Rate</th><th>Signal</th></tr></thead><tbody>${trackDetailRows}</tbody></table></div>
      ${tracks.map(track=>{
        const s = trackStats(track);
        return s.tm.length?`
        <div style="margin-top:14px">
          <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:6px">${track} — Member Breakdown</div>
          <div class="tbl-wrap"><table class="dt"><thead><tr><th>Member</th><th>Role</th><th>Hours Logged</th><th>Projects</th><th>Avail %</th></tr></thead><tbody>${s.tm.map(m=>{
            const hrs = resources.filter(r=>r.memberId===m.id).reduce((sum,r)=>sum+(parseFloat(r.hours)||0),0);
            const mProj = projects.filter(p=>teamArr(p.team).includes(m.id)||p.devLead===m.id);
            return `<tr><td style="font-weight:600">${m.name}</td><td>${m.role||'—'}</td><td>${hrs}h</td><td>${mProj.length}</td><td>${m.availability||100}%</td></tr>`;
          }).join('')}</tbody></table></div>
        </div>`:''}).join('')}` : `<div class="empty">No tracks configured</div>`}
    </div>
    <div class="report-section">
      <h2>📈 Risk Trend</h2>
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:12px">
        <div style="font-size:13px;color:var(--mid)">Opened this month: <strong>${newRisksMonth.length}</strong></div>
        <div style="font-size:13px;color:var(--mid)">Closed this month: <strong>${closedRisksMonth.length}</strong></div>
        <div style="font-size:13px;font-weight:700;color:${newRisksMonth.length<=closedRisksMonth.length?'#16a34a':'#dc2626'}">Net: ${newRisksMonth.length-closedRisksMonth.length>=0?'+':''}${newRisksMonth.length-closedRisksMonth.length} ${newRisksMonth.length<=closedRisksMonth.length?'(improving)':'(watch closely)'}</div>
      </div>
      <div class="tbl-wrap"><table class="dt"><thead><tr><th>Risk</th><th>Project</th><th>Score</th><th>Status</th></tr></thead><tbody>${risks.slice(0,10).map(r=>`<tr><td>${r.title}</td><td>${r.project||'—'}</td><td>${(r.likelihood||1)*(r.impact||1)}</td><td>${ragBadge(r.status)}</td></tr>`).join('')||`<tr><td colspan="4" class="empty">No risks logged</td></tr>`}</tbody></table></div>
    </div>
    <div class="report-section">
      <h2>🤝 Pledges / Customer Commitments</h2>
      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;font-size:13px">
        <span>Total: <strong>${pledges.length}</strong></span>
        <span style="color:#16a34a">Honored: <strong>${honoredPledges}</strong></span>
        <span style="color:#dc2626">Breached: <strong>${breachedPledges.length}</strong></span>
        <span style="color:#d97706">In progress: <strong>${inProgPledges}</strong></span>
      </div>
      ${breachedPledges.length?`<div style="font-size:12px;font-weight:700;color:#dc2626;margin-bottom:6px">Breached pledges</div><div class="tbl-wrap"><table class="dt"><thead><tr><th>Customer</th><th>Commitment</th><th>Due</th><th>Owner</th></tr></thead><tbody>${breachedPledges.map(p=>`<tr><td>${p.customer||'—'}</td><td style="font-weight:600">${p.title||'—'}</td><td>${DateHelpers.fmt(p.dueDate)}</td><td>${p.owner||'—'}</td></tr>`).join('')}</tbody></table></div>`:''}
    </div>
    <div class="report-section">
      <h2>🔭 Next Month Focus</h2>
      <div style="font-size:12px;font-weight:700;color:var(--navy);margin-bottom:6px">Top milestones due next month</div>
      ${nextMsMs.length?nextMsMs.map(m=>`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border)"><span class="badge badge-navy">🎯</span><span style="flex:1;font-size:13px;font-weight:600">${m.title}</span><span style="font-size:11px;color:var(--lt)">${m.projectName||'—'}</span><span style="font-size:11px;color:var(--lt)">${DateHelpers.fmt(m.dueDate)}</span></div>`).join(''):` <div style="font-size:12px;color:var(--lt)">No milestones scheduled next month</div>`}
      ${highRisks.length?`<div style="font-size:12px;font-weight:700;color:#dc2626;margin:12px 0 6px">Key risks to watch</div>${highRisks.slice(0,3).map(r=>`<div style="font-size:12px;padding:4px 0;color:var(--mid)">⚠️ ${r.title} (Score ${(r.likelihood||1)*(r.impact||1)})</div>`).join('')}`:''}
    </div>`;
  }

  // ── Build plain text for copy/email ─────────────────────
  function buildPlainText() {
    const tab = APP_STATE._leadershipTab || 'weekly';
    const lines = [];
    lines.push(`KLARION PROGRAMME REPORT — ${tab.toUpperCase()}`);
    lines.push(`Generated: ${DateHelpers.fmt(today)}`);
    lines.push('');
    lines.push(`Projects: ${projects.length} total · ${projects.filter(p=>p.status==='In Progress').length} in progress · ${projects.filter(p=>p.status==='Completed').length} completed`);
    lines.push(`Milestones: ${milestones.length} total · ${overdueMilestones.length} overdue`);
    lines.push(`Open Risks: ${openRisks.length} · High Priority: ${highRisks.length}`);
    lines.push(`Open Escalations (L3/L4): ${openEscL34.length}`);
    lines.push('');
    lines.push('── PROJECT STATUS ──────────────────────────');
    projects.forEach(p=>{
      lines.push(`• ${p.name} [${p.status}] ${projProgress(p)}% — ${resolveTrackName(p.track||p.trackId)||'—'} · ${teamName(p.devLead)}`);
    });
    if (!projects.length) lines.push('  No projects');
    lines.push('');
    if (overdueMilestones.length) {
      lines.push('── OVERDUE MILESTONES ──────────────────────');
      overdueMilestones.forEach(m=>{ lines.push(`🔴 ${m.title} (${m.projectName||'—'}) — due ${DateHelpers.fmt(m.dueDate)}`); });
      lines.push('');
    }
    if (highRisks.length) {
      lines.push('── HIGH RISKS ──────────────────────────────');
      highRisks.forEach(r=>{ lines.push(`⚠️ Score ${(r.likelihood||1)*(r.impact||1)} — ${r.title} (${r.project||'—'})`); });
      lines.push('');
    }
    if (openEscL34.length) {
      lines.push('── ESCALATIONS L3/L4 ───────────────────────');
      openEscL34.forEach(e=>{ lines.push(`🚨 ${e.level||'—'} — ${e.project||'—'}: ${e.title||'—'}`); });
      lines.push('');
    }
    lines.push('── TRACK RESOURCE STATUS ───────────────────');
    tracks.forEach(track=>{
      const s = trackStats(track);
      lines.push(`${track}: ${s.tm.length} members · ${s.tp.length} projects · ${s.avgAlloc}% alloc · ${s.hrsLogged}h logged · ${s.signal}`);
    });
    if (!tracks.length) lines.push('  No tracks configured');
    return lines.join('\n');
  }

  // ── SUMMARY BANNER ───────────────────────────────────────
  function summaryBanner() {
    const inProgCount = projects.filter(p=>normaliseStatus(p.status)==='In Progress').length;
    const avgUtil = members.length ? Math.round(members.reduce((s,m)=>s+(m.capacity||m.availability||80),0)/members.length) : 0;
    const completedProj = projects.filter(p=>normaliseStatus(p.status)==='Completed').length;
    const weekStart = new Date(now); weekStart.setDate(weekStart.getDate()-3);
    const weekEnd   = new Date(now); weekEnd.setDate(weekEnd.getDate()+3);
    const wsStr = weekStart.toISOString().split('T')[0];
    const weStr = weekEnd.toISOString().split('T')[0];
    const weekMs = milestones.filter(m=>m.dueDate>=wsStr&&m.dueDate<=weStr);
    const weekMsOnTrack = weekMs.filter(m=>m.status!=='Completed'&&!(m.dueDate<today&&m.status!=='Completed')).length;
    const weekMsAtRisk  = weekMs.filter(m=>m.dueDate<today&&m.status!=='Completed').length;
    const monthStart = new Date(now.getFullYear(),now.getMonth(),1).toISOString().split('T')[0];
    const msThisMonth = milestones.filter(m=>m.dueDate>=monthStart);
    const msCompMonth = msThisMonth.filter(m=>m.status==='Completed').length;
    const otRate = msThisMonth.length>0 ? Math.round(msCompMonth/msThisMonth.length*100) : 100;
    const monthName = now.toLocaleString('en-GB',{month:'long'});

    let summaryText = '';
    let pills = [];
    if (activeTab === 'daily') {
      const in3d = new Date(now); in3d.setDate(in3d.getDate()+3);
      const in3dStr = in3d.toISOString().split('T')[0];
      const upcoming3d = milestones.filter(m=>m.dueDate>=today&&m.dueDate<=in3dStr&&m.status!=='Completed').length;
      const blockerCount = projects.filter(p=>p.status==='On Hold').length + openEscL34.length + highRisks.length;
      summaryText = `Today ${DateHelpers.fmt(today)}: <strong>${inProgCount}</strong> projects active, <strong>${upcoming3d}</strong> milestones due in next 3 days, <strong>${blockerCount}</strong> blockers. Team utilisation: <strong>${avgUtil}%</strong> avg.`;
      pills = [`${inProgCount} Active`,`${upcoming3d} Due Soon`,`${blockerCount} Blockers`,`${avgUtil}% Util`];
    } else if (activeTab === 'weekly') {
      summaryText = `<strong>${inProgCount}</strong> projects in flight across <strong>${tracks.length||'—'}</strong> tracks. <strong>${weekMs.length}</strong> milestones due this week — <strong>${weekMsOnTrack}</strong> on track, <strong>${weekMsAtRisk}</strong> at risk. <strong>${openRisks.length}</strong> open risks. <strong>${openEscL34.length}</strong> escalations pending.`;
      pills = [`${weekMs.length} This Week`,`${weekMsOnTrack} On Track`,`${openRisks.length} Risks`,`${openEscL34.length} Escalations`];
    } else {
      summaryText = `${monthName}: <strong>${completedProj}</strong> delivered, <strong>${inProgCount}</strong> in progress. On-time delivery: <strong>${otRate}%</strong>. Team avg utilisation: <strong>${avgUtil}%</strong>.`;
      pills = [`${completedProj} Delivered`,`${inProgCount} In Progress`,`${otRate}% On-time`,`${avgUtil}% Util`];
    }

    return `<div style="background:linear-gradient(135deg,#0a1740,var(--navy));border-radius:var(--r);padding:20px 24px;margin-bottom:20px;color:#fff">
      <div style="font-size:13px;font-weight:600;opacity:.6;margin-bottom:8px;text-transform:uppercase;letter-spacing:.8px">Executive Summary</div>
      <div style="font-size:15px;line-height:1.8;opacity:.92">${summaryText}</div>
      <div style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap">
        ${pills.map(p=>`<div style="background:rgba(255,255,255,.12);border-radius:20px;padding:4px 14px;font-size:12px;font-weight:700;color:#fff">${p}</div>`).join('')}
      </div>
    </div>`;
  }

  // ── CSS CHARTS ───────────────────────────────────────────
  function projectStatusBar() {
    const total = projects.length || 1;
    const completedProj = projects.filter(p=>normaliseStatus(p.status)==='Completed').length;
    const inProgProj    = projects.filter(p=>normaliseStatus(p.status)==='In Progress').length;
    const atRiskProj    = projects.filter(p=>['At Risk','Overdue'].includes(normaliseStatus(p.status))).length;
    const blockedProj   = projects.filter(p=>p.status==='On Hold').length;
    const completedPct  = Math.round(completedProj/total*100);
    const inProgPct     = Math.round(inProgProj/total*100);
    const atRiskPct     = Math.round(atRiskProj/total*100);
    const blockedPct    = Math.round(blockedProj/total*100);
    return `<div class="card" style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:12px">Project Status Distribution</div>
      <div style="height:28px;border-radius:14px;overflow:hidden;display:flex;margin:12px 0">
        ${completedPct>0?`<div style="width:${completedPct}%;background:#22c55e;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;transition:width .4s">${completedPct>8?completedProj+' Done':''}</div>`:''}
        ${inProgPct>0?`<div style="width:${inProgPct}%;background:var(--navy);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;transition:width .4s">${inProgPct>8?inProgProj+' Active':''}</div>`:''}
        ${atRiskPct>0?`<div style="width:${atRiskPct}%;background:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;transition:width .4s">${atRiskPct>8?atRiskProj+' At Risk':''}</div>`:''}
        ${blockedPct>0?`<div style="width:${blockedPct}%;background:#ef4444;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;transition:width .4s">${blockedPct>8?blockedProj+' Blocked':''}</div>`:''}
        ${100-completedPct-inProgPct-atRiskPct-blockedPct>0?`<div style="flex:1;background:#e2e8f0"></div>`:''}
      </div>
      <div style="display:flex;gap:14px;font-size:11px;flex-wrap:wrap">
        <span style="color:#22c55e;font-weight:600">■ Completed (${completedProj})</span>
        <span style="color:var(--navy);font-weight:600">■ In Progress (${inProgProj})</span>
        <span style="color:#f59e0b;font-weight:600">■ At Risk (${atRiskProj})</span>
        <span style="color:#ef4444;font-weight:600">■ Blocked (${blockedProj})</span>
      </div>
    </div>`;
  }

  function trackUtilChart() {
    if (!tracks.length) return '';
    const trackData = tracks.map(track=>{
      const s = trackStats(track);
      const pct = Math.min(200, s.avgAlloc);
      const capColor = pct>100?'#ef4444':pct>=80?'#f59e0b':'#22c55e';
      return { name:track, pct, capColor };
    });
    return `<div class="card" style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:14px">Track Utilisation</div>
      ${trackData.map(t=>`<div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <span style="font-size:12px;font-weight:600">${t.name}</span>
          <span style="font-size:12px;font-weight:700;color:${t.capColor}">${t.pct}%</span>
        </div>
        <div style="height:8px;background:var(--bg);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${Math.min(100,t.pct)}%;background:${t.capColor};border-radius:4px;transition:width .4s"></div>
        </div>
      </div>`).join('')}
    </div>`;
  }

  function getMilestoneDataForPeriod(period) {
    const now2 = new Date(now);
    let start, end;
    if (period === 'daily') {
      start = today; end = today;
    } else if (period === 'weekly') {
      const day = now2.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      const mon = new Date(now2); mon.setDate(now2.getDate() + diffToMon); mon.setHours(0,0,0,0);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      start = mon.toISOString().split('T')[0];
      end   = sun.toISOString().split('T')[0];
    } else {
      start = new Date(now2.getFullYear(), now2.getMonth(), 1).toISOString().split('T')[0];
      end   = new Date(now2.getFullYear(), now2.getMonth()+1, 0).toISOString().split('T')[0];
    }
    const ms       = milestones.filter(m => m.dueDate >= start && m.dueDate <= end);
    const total    = ms.length;
    const completed = ms.filter(m => m.status === 'Completed').length;
    const atRisk    = ms.filter(m => normaliseStatus(m.status) === 'At Risk').length;
    const overdue   = ms.filter(m => m.dueDate < today && m.status !== 'Completed').length;
    const onTime    = Math.max(0, total - atRisk - overdue);
    const denom     = total || 1;
    const onTimePct = Math.round(onTime / denom * 100);
    const atRiskPct = Math.round(atRisk / denom * 100);
    const periodLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'This Week' : 'This Month';
    return { ms, total, completed, atRisk, overdue, onTime, onTimePct, atRiskPct, periodLabel };
  }

  function getHoursDataForPeriod(period) {
    const now2 = new Date(now);
    let start;
    if (period === 'daily') {
      start = today;
    } else if (period === 'weekly') {
      const day = now2.getDay();
      const diffToMon = day === 0 ? -6 : 1 - day;
      const mon = new Date(now2); mon.setDate(now2.getDate() + diffToMon);
      start = mon.toISOString().split('T')[0];
    } else {
      start = new Date(now2.getFullYear(), now2.getMonth(), 1).toISOString().split('T')[0];
    }
    return tracks.map(track => {
      const tm = members.filter(m => m.track === track);
      const hrs = resources.filter(r => tm.some(m => m.id === r.memberId) && r.date >= start && !r.isLeave)
                           .reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
      return { name: track, hrs };
    });
  }

  function milestoneHealthDonut() {
    const d = getMilestoneDataForPeriod(activeTab);
    return `<div class="card" style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:4px">Milestone Health</div>
      <div style="font-size:11px;color:var(--lt);margin-bottom:14px">${d.periodLabel} · ${d.total} milestone${d.total!==1?'s':''}</div>
      <div style="display:flex;gap:20px;align-items:center">
        <div style="width:120px;height:120px;border-radius:50%;background:conic-gradient(#22c55e 0% ${d.onTimePct}%,#f59e0b ${d.onTimePct}% ${Math.min(100,d.onTimePct+d.atRiskPct)}%,#ef4444 ${Math.min(100,d.onTimePct+d.atRiskPct)}% 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <div style="width:84px;height:84px;background:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:800;color:var(--navy)">${d.onTimePct}%</div>
        </div>
        <div style="font-size:12px;line-height:1.9">
          <div>✅ On time: <strong>${d.onTime}</strong></div>
          <div>⚠️ At risk: <strong>${d.atRisk}</strong></div>
          <div>❌ Overdue: <strong>${d.overdue}</strong></div>
          <div style="color:var(--lt)">✓ Completed: <strong>${d.completed}</strong></div>
        </div>
      </div>
    </div>`;
  }

  function hoursSparkline() {
    if (!tracks.length) return '';
    const data = getHoursDataForPeriod(activeTab);
    const maxH = Math.max(1, ...data.map(t => t.hrs));
    const periodLabel = activeTab === 'daily' ? 'Today' : activeTab === 'weekly' ? 'This Week' : 'This Month';
    return `<div class="card" style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:4px">Hours Logged by Track</div>
      <div style="font-size:11px;color:var(--lt);margin-bottom:14px">${periodLabel}</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${data.map(t => {
          const pct = Math.round((t.hrs / maxH) * 100);
          return `<div>
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <span style="font-size:11px;font-weight:600;color:var(--text)">${t.name}</span>
              <span style="font-size:11px;font-weight:700;color:var(--navy)">${t.hrs}h</span>
            </div>
            <div style="height:12px;background:var(--bg);border-radius:6px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:var(--teal);border-radius:6px;transition:width .4s;${t.hrs>0?'min-width:4px':''}"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  // ── KPI CARDS ─────────────────────────────────────────────
  function kpiCards() {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth()+1, 1).toISOString().split('T')[0];
    const day = now.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now); monday.setDate(now.getDate() + diffToMon); monday.setHours(0,0,0,0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate()+6);
    const weekStartStr = monday.toISOString().split('T')[0];
    const weekEndStr   = sunday.toISOString().split('T')[0];

    function card(label, value, sub, color) {
      return `<div style="background:var(--white);border:1px solid var(--border);border-radius:var(--r);padding:14px 16px;border-top:3px solid ${color}">
        <div style="font-size:10px;font-weight:700;color:var(--lt);text-transform:uppercase;letter-spacing:.6px;margin-bottom:6px">${label}</div>
        <div style="font-size:28px;font-weight:800;color:var(--navy);line-height:1">${value}</div>
        <div style="font-size:11px;color:var(--lt);margin-top:4px">${sub}</div>
      </div>`;
    }

    let cards = [];
    if (activeTab === 'daily') {
      const activeProjCount = projects.filter(p=>normaliseStatus(p.status)==='In Progress').length;
      const dueTodayMs = milestones.filter(m=>m.dueDate===today&&m.status!=='Completed').length;
      const blockerCount = projects.filter(p=>p.status==='On Hold').length + openEscL34.length + highRisks.length;
      const hoursToday = resources.filter(r=>r.date===today&&!r.isLeave).reduce((s,r)=>s+(parseFloat(r.hours)||0),0);
      const activeMembers = new Set(resources.filter(r=>r.date===today&&!r.isLeave&&(parseFloat(r.hours)||0)>0).map(r=>r.memberId)).size;
      const overdueCount = projects.filter(p=>p.endDate<today&&normaliseStatus(p.status)!=='Completed').length;
      cards = [
        card('Active Projects', activeProjCount, 'in progress today', '#2563eb'),
        card('Due Today', dueTodayMs, 'milestones', '#d97706'),
        card('Blockers', blockerCount, 'need action', '#dc2626'),
        card('Hours Today', hoursToday, 'hrs logged', '#059669'),
        card('Team On Duty', activeMembers, 'active', '#7c3aed'),
        card('Overdue', overdueCount, 'past deadline', '#ef4444'),
      ];
    } else if (activeTab === 'weekly') {
      const avgProgress = projects.length ? Math.round(projects.reduce((s,p)=>s+(projProgress(p)||0),0)/projects.length) : 0;
      const msDueWeek = milestones.filter(m=>m.dueDate>=weekStartStr&&m.dueDate<=weekEndStr&&m.status!=='Completed').length;
      const msCompWeek = milestones.filter(m=>m.dueDate>=weekStartStr&&m.dueDate<=weekEndStr&&m.status==='Completed').length;
      const msTotalWeek = milestones.filter(m=>m.dueDate>=weekStartStr&&m.dueDate<=weekEndStr).length;
      const ontimeRate = msTotalWeek>0 ? Math.round(msCompWeek/msTotalWeek*100) : 100;
      const hoursWeek = resources.filter(r=>r.date>=weekStartStr&&r.date<=weekEndStr&&!r.isLeave).reduce((s,r)=>s+(parseFloat(r.hours)||0),0);
      const risksOpen = openRisks.filter(r=>{ const s=(r.likelihood||1)*(r.impact||1); return s>=4; }).length;
      const pledgesDueWeek = pledges.filter(p=>p.dueDate>=weekStartStr&&p.dueDate<=weekEndStr&&p.status!=='Honored').length;
      cards = [
        card('Sprint Progress', avgProgress+'%', 'across projects', '#2563eb'),
        card('Milestones Due', msDueWeek, 'this week', '#d97706'),
        card('On-Time Rate', ontimeRate+'%', 'this week', '#059669'),
        card('Hours This Week', Math.round(hoursWeek), 'team total', '#7c3aed'),
        card('Risks Open', risksOpen, 'active risks', '#dc2626'),
        card('Pledges Due', pledgesDueWeek, 'commitments', '#f59e0b'),
      ];
    } else {
      const deliveredMonth = projects.filter(p=>p.status==='Completed'&&(p.endDate||'')>=monthStart&&(p.endDate||'')<nextMonthStart).length;
      const msTotalMonth = milestones.filter(m=>m.dueDate>=monthStart&&m.dueDate<nextMonthStart).length;
      const msCompMonth = milestones.filter(m=>m.dueDate>=monthStart&&m.dueDate<nextMonthStart&&m.status==='Completed').length;
      const otRateMonth = msTotalMonth>0 ? Math.round(msCompMonth/msTotalMonth*100) : 100;
      const hoursMonth = resources.filter(r=>r.date>=monthStart&&r.date<nextMonthStart&&!r.isLeave).reduce((s,r)=>s+(parseFloat(r.hours)||0),0);
      const avgUtil = members.length ? Math.round(members.reduce((s,m)=>s+(m.capacity||m.availability||80),0)/members.length) : 0;
      const risksClosedMonth = risks.filter(r=>(r.closedAt||'')>=monthStart&&r.status!=='Open').length;
      const pledgesHonoredMonth = pledges.filter(p=>p.status==='Honored').length;
      cards = [
        card('Delivered', deliveredMonth, 'projects', '#059669'),
        card('On-Time Rate', otRateMonth+'%', '%', '#2563eb'),
        card('Total Hours', Math.round(hoursMonth), 'hrs', '#7c3aed'),
        card('Team Utilisation', avgUtil+'%', 'avg', '#d97706'),
        card('Risks Closed', risksClosedMonth, 'resolved', '#14b8a6'),
        card('Pledges Honoured', pledgesHonoredMonth, 'commitments', '#059669'),
      ];
    }
    return `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin-bottom:16px">
      ${cards.join('')}
    </div>`;
  }

  // ── PLEDGE GAUGE ──────────────────────────────────────────
  function pledgeGauge() {
    const onTrack  = pledges.filter(p=>p.status==='On Track').length;
    const atRisk   = pledges.filter(p=>p.status==='At Risk').length;
    const breached = pledges.filter(p=>p.status==='Breached').length;
    const honored  = pledges.filter(p=>p.status==='Honored').length;
    const total    = pledges.length || 1;
    function row(label, count, color) {
      const pct = Math.round(count/total*100);
      return `<div style="display:flex;align-items:center;gap:10px">
        <span style="width:80px;font-size:12px;font-weight:600;color:var(--mid)">${label}</span>
        <div style="flex:1;height:10px;background:var(--bg);border-radius:5px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${color};border-radius:5px;${count>0?'min-width:4px':''}"></div>
        </div>
        <span style="font-size:14px;font-weight:800;color:var(--navy);min-width:24px;text-align:right">${count}</span>
      </div>`;
    }
    const periodLabel = activeTab === 'daily' ? 'Today' : activeTab === 'weekly' ? 'This Week' : 'This Month';
    return `<div class="card" style="margin-bottom:0">
      <div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:4px">Customer Commitments</div>
      <div style="font-size:11px;color:var(--lt);margin-bottom:14px">${periodLabel} · ${pledges.length} pledges total</div>
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:8px">
        ${row('On Track', onTrack, '#22c55e')}
        ${row('At Risk', atRisk, '#f59e0b')}
        ${row('Breached', breached, '#ef4444')}
        ${row('Honored', honored, '#14b8a6')}
      </div>
      <div style="margin-top:12px;font-size:11px;color:var(--lt)">Total: <strong>${pledges.length}</strong> pledges</div>
    </div>`;
  }

  // ── TRACK PERFORMANCE TABLE ───────────────────────────────
  function trackPerfTable() {
    if (!tracks.length) return `<div class="card"><div class="empty">No tracks configured</div></div>`;
    return `<div class="card" style="margin-bottom:0">
      <div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:12px">Track Performance</div>
      <div class="tbl-wrap">
        <table class="dt">
          <thead><tr><th>Track</th><th>Projects</th><th>Avg Progress</th><th>On-Time %</th><th>Util%</th><th>Signal</th></tr></thead>
          <tbody>
            ${tracks.map(track=>{
              const tm2 = members.filter(m=>m.track===track);
              const tp2 = projects.filter(p=>p.track===track||resolveTrackName(p.track||p.trackId)===track);
              const avgProg = tp2.length ? Math.round(tp2.reduce((s,p)=>s+(projProgress(p)||0),0)/tp2.length) : 0;
              const tMs2 = milestones.filter(m=>tp2.some(p=>p.id===m.projectId||p.name===m.projectName));
              const onTimePct2 = tMs2.length>0 ? Math.round(tMs2.filter(m=>m.status==='Completed').length/tMs2.length*100) : 100;
              const avgUtil2 = tm2.length ? Math.round(tm2.reduce((s,m)=>s+(m.capacity||m.availability||80),0)/tm2.length) : 0;
              const signal = avgUtil2>100?'🔴':onTimePct2<70?'⚠️':'✅';
              return `<tr>
                <td style="font-weight:700">${track}</td>
                <td>${tp2.length}</td>
                <td>${avgProg}%</td>
                <td>${onTimePct2}%</td>
                <td>${avgUtil2}%</td>
                <td>${signal}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>`;
  }

  // ── ENLARGED MILESTONE DONUT ──────────────────────────────
  function milestoneHealthDonutLarge() {
    const d = getMilestoneDataForPeriod(activeTab);
    return `<div class="card" style="margin-bottom:0">
      <div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:4px">Milestone Health</div>
      <div style="font-size:11px;color:var(--lt);margin-bottom:14px">${d.periodLabel} · ${d.total} milestone${d.total!==1?'s':''}</div>
      <div style="display:flex;gap:20px;align-items:center">
        <div style="width:160px;height:160px;border-radius:50%;background:conic-gradient(#22c55e 0% ${d.onTimePct}%,#f59e0b ${d.onTimePct}% ${Math.min(100,d.onTimePct+d.atRiskPct)}%,#ef4444 ${Math.min(100,d.onTimePct+d.atRiskPct)}% 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <div style="width:112px;height:112px;background:white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:800;color:var(--navy)">${d.onTimePct}%</div>
        </div>
        <div style="font-size:12px;line-height:2">
          <div>✅ On time: <strong>${d.onTime}</strong></div>
          <div>⚠️ At risk: <strong>${d.atRisk}</strong></div>
          <div>❌ Overdue: <strong>${d.overdue}</strong></div>
          <div style="color:var(--lt)">✓ Completed: <strong>${d.completed}</strong></div>
        </div>
      </div>
    </div>`;
  }

  // ── ENLARGED HOURS SPARKLINE ──────────────────────────────
  function hoursSparklineLarge() {
    if (!tracks.length) return '';
    const data = getHoursDataForPeriod(activeTab);
    const maxH = Math.max(1, ...data.map(t => t.hrs));
    const totalHrs = data.reduce((s,t)=>s+t.hrs,0);
    const periodLabel = activeTab === 'daily' ? 'Today' : activeTab === 'weekly' ? 'This Week' : 'This Month';
    return `<div class="card" style="margin-bottom:0">
      <div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:4px">Hours Logged by Track</div>
      <div style="font-size:11px;color:var(--lt);margin-bottom:14px">${periodLabel}</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        ${data.map(t => {
          const pct = Math.round((t.hrs / maxH) * 100);
          return `<div>
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <span style="font-size:12px;font-weight:600;color:var(--text)">${t.name}</span>
              <span style="font-size:12px;font-weight:700;color:var(--navy)">${t.hrs}h</span>
            </div>
            <div style="height:14px;background:var(--bg);border-radius:6px;overflow:hidden">
              <div style="height:100%;width:${pct}%;background:var(--teal);border-radius:6px;transition:width .4s;${t.hrs>0?'min-width:4px':''}"></div>
            </div>
          </div>`;
        }).join('')}
        <div style="border-top:2px solid var(--border);padding-top:8px">
          <div style="display:flex;justify-content:space-between">
            <span style="font-size:12px;font-weight:800;color:var(--navy)">TOTAL</span>
            <span style="font-size:12px;font-weight:800;color:var(--navy)">${Math.round(totalHrs)}h</span>
          </div>
        </div>
      </div>
    </div>`;
  }

  // ── PROJECT STATUS BAR LARGE ──────────────────────────────
  function projectStatusBarLarge() {
    const total = projects.length || 1;
    const completedProj = projects.filter(p=>normaliseStatus(p.status)==='Completed').length;
    const inProgProj    = projects.filter(p=>normaliseStatus(p.status)==='In Progress').length;
    const atRiskProj    = projects.filter(p=>['At Risk','Overdue'].includes(normaliseStatus(p.status))).length;
    const blockedProj   = projects.filter(p=>p.status==='On Hold').length;
    const completedPct  = Math.round(completedProj/total*100);
    const inProgPct     = Math.round(inProgProj/total*100);
    const atRiskPct     = Math.round(atRiskProj/total*100);
    const blockedPct    = Math.round(blockedProj/total*100);
    return `<div class="card" style="margin-bottom:0">
      <div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:12px">Project Status Distribution</div>
      <div style="height:48px;border-radius:8px;overflow:hidden;display:flex;margin:12px 0">
        ${completedPct>0?`<div style="width:${completedPct}%;background:#22c55e;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">${completedPct}%</div>`:''}
        ${inProgPct>0?`<div style="width:${inProgPct}%;background:var(--navy);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">${inProgPct}%</div>`:''}
        ${atRiskPct>0?`<div style="width:${atRiskPct}%;background:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">${atRiskPct}%</div>`:''}
        ${blockedPct>0?`<div style="width:${blockedPct}%;background:#ef4444;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff">${blockedPct}%</div>`:''}
        ${100-completedPct-inProgPct-atRiskPct-blockedPct>0?`<div style="flex:1;background:#e2e8f0"></div>`:''}
      </div>
      <div style="display:flex;gap:14px;font-size:11px;flex-wrap:wrap">
        <span style="color:#22c55e;font-weight:600">■ Completed (${completedProj})</span>
        <span style="color:var(--navy);font-weight:600">■ In Progress (${inProgProj})</span>
        <span style="color:#f59e0b;font-weight:600">■ At Risk (${atRiskProj})</span>
        <span style="color:#ef4444;font-weight:600">■ Blocked (${blockedProj})</span>
      </div>
    </div>`;
  }

  // ── TOP RISKS ────────────────────────────────────────────
  function topRisksSection() {
    const topRisks = openRisks
      .sort((a,b)=>((b.likelihood||1)*(b.impact||1))-((a.likelihood||1)*(a.impact||1)))
      .slice(0,3);
    if (!topRisks.length) return '';
    return `<div style="margin-top:16px">
      <div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:12px">Top Risks This Period</div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">
        ${topRisks.map(r=>{
          const score = (r.likelihood||1)*(r.impact||1);
          const cls = score>=12?'#dc2626':score>=6?'#d97706':'#d97706';
          return `<div style="background:var(--white);border:1px solid var(--border);border-radius:var(--r);padding:14px;box-shadow:var(--sh)">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <div style="width:36px;height:36px;border-radius:50%;background:${cls};color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;flex-shrink:0">${score}</div>
              <div style="font-size:13px;font-weight:700;color:var(--navy);flex:1;line-height:1.3">${r.title}</div>
            </div>
            <div style="font-size:11px;color:var(--lt);margin-bottom:4px">${r.project||'—'}</div>
            ${r.mitigation?`<div style="font-size:11px;color:var(--mid);font-style:italic;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${r.mitigation}</div>`:''}
            ${r.owner?`<div style="font-size:10px;color:var(--lt);margin-top:6px">👤 ${r.owner}</div>`:''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  // ── PERIOD-AWARE PROJECT TABLE ────────────────────────────
  function periodProjectTable() {
    const _day = now.getDay();
    const _diff = _day === 0 ? -6 : 1 - _day;
    const _mon = new Date(now); _mon.setDate(now.getDate() + _diff); _mon.setHours(0,0,0,0);
    const _ptWeekStart = _mon.toISOString().split('T')[0];

    let tableProjects = [];
    let title = '';
    if (activeTab === 'daily') {
      const todayMsIds = new Set(milestones.filter(m=>m.dueDate===today).map(m=>m.projectId));
      const blockerProjects = new Set([...openEscL34.map(e=>e.projectId),...highRisks.map(r=>r.projectId)].filter(Boolean));
      tableProjects = projects.filter(p=>todayMsIds.has(p.id)||blockerProjects.has(p.id)||normaliseStatus(p.status)==='In Progress');
      title = 'Projects with Activity Today';
    } else if (activeTab === 'weekly') {
      tableProjects = projects.filter(p=>normaliseStatus(p.status)!=='Completed'||p.endDate>=_ptWeekStart);
      title = 'Active Projects — This Week';
    } else {
      const monthStart2 = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const nextMonthStart2 = new Date(now.getFullYear(), now.getMonth()+1, 1).toISOString().split('T')[0];
      tableProjects = projects;
      title = 'All Projects — This Month';
    }
    if (!tableProjects.length) return `<div class="empty"><div class="empty-icon">📋</div>No projects to show</div>`;
    return `<div style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:800;color:var(--navy);margin-bottom:10px">${title}</div>
      <div class="tbl-wrap">
        <table class="dt">
          <thead><tr><th>Project</th><th>Track</th><th>Progress</th><th>Status</th><th>End Date</th><th>Dev Lead</th></tr></thead>
          <tbody>
            ${tableProjects.map(p=>`<tr style="cursor:pointer" onclick="nav('project-detail',{id:'${p.id}'})">
              <td style="font-weight:700">${p.name}</td>
              <td>${resolveTrackName(p.track||p.trackId)||'—'}</td>
              <td style="min-width:110px">${progressBar(projProgress(p))}<span style="font-size:11px">${projProgress(p)}%</span></td>
              <td>${ragBadge(p.status)}</td>
              <td style="font-size:12px;${p.endDate<today&&normaliseStatus(p.status)!=='Completed'?'color:#dc2626':''}">${DateHelpers.fmt(p.endDate)}</td>
              <td style="font-size:12px">${teamName(p.devLead)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${topRisksSection()}
    </div>`;
  }

  const tabContent = activeTab==='daily'   ? dailyTab()
                   : activeTab==='monthly' ? monthlyTab()
                   : weeklyTab();

  return `
  <div class="vh">
    <div class="vh-left">
      <h1>Leadership Report</h1>
      <div class="sub">Auto-generated · ${now.toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</div>
    </div>
    <div class="vh-right no-print">
      <div class="pulse-tabs" style="margin-bottom:0;border-bottom:none">
        ${tabBtn('daily',   'Daily')}
        ${tabBtn('weekly',  'Weekly')}
        ${tabBtn('monthly', 'Monthly')}
      </div>
    </div>
  </div>
  ${summaryBanner()}
  ${kpiCards()}
  <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:16px">
    ${milestoneHealthDonutLarge()}
    ${hoursSparklineLarge()}
    ${pledgeGauge()}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px">
    ${projectStatusBarLarge()}
    ${trackPerfTable()}
  </div>
  <div class="card" style="margin-bottom:16px">
    ${periodProjectTable()}
  </div>
  ${tabContent}
  <button class="btn btn-ghost btn-sm no-print" onclick="window.print()"
    style="position:fixed;bottom:24px;right:24px;z-index:100;background:var(--white);box-shadow:var(--shm)">
    🖨 Print / Export PDF
  </button>`;
}

// ─── IMPACTS ──────────────────────────────────────────────
export function renderImpacts() {
  const impacts = [...(APP_STATE.impacts||[])].sort((a,b)=>{ const da=a.date||a.startDate||''; const db=b.date||b.startDate||''; return da>db?-1:da<db?1:0; });
  return `
  <div class="vh">
    <div class="vh-left">
      <h1>Impact Tracker</h1>
      <div class="sub">Measure outcomes against targets</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="openModal('impact')">+ Add Impact</button>
    </div>
  </div>
  <div class="card" style="padding:0">
    <div class="tbl-wrap">
      <table class="dt">
        <thead><tr><th>Project</th><th>Metric</th><th>Baseline</th><th>Current</th><th>Target</th><th>Improvement</th><th>Notes</th><th>Actions</th></tr></thead>
        <tbody>
          ${impacts.length ? impacts.map(i=>`
          <tr>
            <td style="font-weight:600">${i.project}</td>
            <td>${i.metric}</td>
            <td style="font-size:12px;color:var(--lt)">${i.baseline}</td>
            <td style="font-weight:700;color:var(--navy)">${i.current}</td>
            <td style="font-size:12px">${i.target}</td>
            <td><span class="badge badge-green">${i.improvement}</span></td>
            <td style="font-size:12px;color:var(--lt)">${i.notes||'—'}</td>
            <td>
              <button class="btn-icon" onclick="openModal('impact','${i.id}')">✏️</button>
              <button class="btn-icon" onclick="deleteItem('impacts','${i.id}')">🗑</button>
            </td>
          </tr>`).join(''):`<tr><td colspan="8"><div class="empty"><div class="empty-icon">📊</div>No impact data</div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── CHARTERS ─────────────────────────────────────────────
export function renderCharters() {
  const charters = [...(APP_STATE.charters||[])].sort((a,b)=>{ const da=a.startDate||a.createdAt||''; const db=b.startDate||b.createdAt||''; return da<db?-1:da>db?1:0; });
  return `
  <div class="vh">
    <div class="vh-left">
      <h1>Project Charters</h1>
      <div class="sub">Scope, objectives and success criteria</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="openModal('charter')">+ Add Charter</button>
    </div>
  </div>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">
    ${charters.length ? charters.map(c=>`
    <div class="card" style="border-left:4px solid var(--navy)">
      <div style="font-size:16px;font-weight:800;color:var(--navy);margin-bottom:10px">${c.projectName||'—'}</div>
      <div class="section-lbl">Sponsor</div><div style="font-size:12px;margin-bottom:8px">${c.sponsor||'—'}</div>
      <div class="section-lbl">Objectives</div><div style="font-size:13px;margin-bottom:8px">${c.objectives||'—'}</div>
      <div class="section-lbl">Scope</div><div style="font-size:12px;margin-bottom:8px">${c.scope||'—'}</div>
      <div class="section-lbl">Success Criteria</div><div style="font-size:12px;margin-bottom:8px">${c.successCriteria||'—'}</div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-ghost btn-sm" onclick="openModal('charter','${c.id}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteItem('charters','${c.id}')">🗑</button>
      </div>
    </div>`).join(''):`<div class="empty" style="grid-column:1/-1"><div class="empty-icon">📄</div>No charters yet</div>`}
  </div>`;
}

// ─── SETTINGS ─────────────────────────────────────────────
export function renderSettings() {
  const s               = APP_STATE.settings;
  const jira            = JiraService.getConfig();
  const members         = APP_STATE.teamMembers;
  const isJiraConfigured = !!(jira.baseUrl && jira.token);

  return `
  <div class="vh">
    <div class="vh-left">
      <h1>Admin Settings</h1>
      <div class="sub">Configure dropdowns, integrations and workflows</div>
    </div>
  </div>

  <div class="admin-layout">
    <div class="admin-nav">
      <button class="admin-tab active" id="atb-dropdowns" onclick="switchSettingsTab('dropdowns',this)">Dropdowns</button>
      <button class="admin-tab" id="atb-jira" onclick="switchSettingsTab('jira',this)">Jira ${isJiraConfigured?'✅':''}</button>
      <button class="admin-tab" id="atb-wf-cfg" onclick="switchSettingsTab('wf-cfg',this)">Workflows</button>
    </div>

    <div class="admin-panel">
      <div id="settingsTab-dropdowns">
        <div class="admin-sec-title">Dropdown Options</div>
        <div class="admin-sec-desc">Manage the options available in project status, phase, priority and track dropdowns.</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px">
          ${[
            {key:'statusOptions',label:'Project Status'},
            {key:'phaseOptions',label:'Phase Options'},
            {key:'priorityOptions',label:'Priority'},
            {key:'trackNames',label:'Track Names'}
          ].map(cfg=>`
          <div class="card" style="padding:14px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
              <div class="card-title" style="margin-bottom:0">${cfg.label}</div>
              <button class="admin-add" onclick="addDropdownItem('${cfg.key}')">+ Add</button>
            </div>
            ${(s[cfg.key]||[]).map((v,i)=>`
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
              <input class="a-input" style="flex:1" value="${v}" onchange="updateDropdownItem('${cfg.key}',${i},this.value)"/>
              <button class="admin-remove" onclick="removeDropdownItem('${cfg.key}',${i})">🗑</button>
            </div>`).join('')}
          </div>`).join('')}
        </div>
        <button class="admin-save" style="margin-top:16px" onclick="saveSettings()">💾 Save Settings</button>
      </div>

      <div id="settingsTab-jira" style="display:none">
        <div class="admin-sec-title">Jira Configuration</div>
        <div class="admin-sec-desc">Connect to your Atlassian Jira instance to display real ticket data on project pages.</div>

        <div class="note-block" style="margin-bottom:16px">
          <strong>How to connect:</strong> Enter your Jira site URL, email, and an API token from
          <a href="https://id.atlassian.com/manage-profile/security/api-tokens" target="_blank" style="color:var(--navy)">id.atlassian.com → API tokens</a>.
          Each project needs a Jira Project Key (e.g. RSE) set in its edit form.
        </div>

        <div class="form-group">
          <label class="form-label">Jira Site URL *</label>
          <input class="form-control" id="jira-baseUrl" value="${jira.baseUrl}" placeholder="https://yourorg.atlassian.net"/>
        </div>
        <div class="form-group">
          <label class="form-label">Atlassian Email *</label>
          <input class="form-control" id="jira-email" value="${jira.email}" placeholder="you@kriyadocs.com"/>
        </div>
        <div class="form-group">
          <label class="form-label">API Token *</label>
          <input class="form-control" type="password" id="jira-token" value="${jira.token}" placeholder="Paste your API token here"/>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="admin-save" onclick="saveJiraConfig()">💾 Save Jira Config</button>
          ${isJiraConfigured?`<button class="btn btn-ghost btn-sm" onclick="testJiraConfig()">🔍 Test Connection</button>`:''}
          ${isJiraConfigured?`<span class="badge badge-green">Connected</span>`:`<span class="badge badge-grey">Not configured</span>`}
        </div>
        <div id="jira-test-result" style="margin-top:10px"></div>

        <hr class="divider"/>
        <div class="admin-sec-title" style="font-size:13px;margin-bottom:4px">Team → Jira User Mapping</div>
        <div class="tbl-wrap">
          <table class="dt">
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
        <div class="admin-sec-title">Workflow Config</div>
        <div class="admin-sec-desc">Manage workflow templates from the <a href="#" onclick="nav('workflows');return false" style="color:var(--navy)">Workflows tab</a>.</div>
      </div>
    </div>
  </div>`;
}

// ============================================================
// PLEDGES VIEW
// ============================================================
export function renderPledges() {
  const pledges = [...(APP_STATE.pledges||[])].sort((a,b)=>{ const da=a.dueDate||''; const db=b.dueDate||''; if(!da) return 1; if(!db) return -1; return da<db?-1:da>db?1:0; });

  function countdown(dueDate, status) {
    if (status === 'Honored') return `<span class="countdown honored">✓ Honored</span>`;
    const due  = new Date(dueDate);
    const now  = new Date();
    const days = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
    if (days < 0)  return `<span class="countdown urgent">⚠ ${Math.abs(days)}d overdue</span>`;
    if (days <= 7) return `<span class="countdown urgent">🔴 ${days}d left</span>`;
    if (days <= 14) return `<span class="countdown soon">🟡 ${days}d left</span>`;
    return `<span class="countdown fine">🟢 ${days}d left</span>`;
  }

  function cardClass(status) {
    if (status === 'Breached') return 'broken';
    if (status === 'At Risk')  return 'atrisk';
    if (status === 'Honored')  return 'honored';
    return '';
  }

  const statusBadgeMap = {
    'On Track':'badge-teal','At Risk':'badge-amber','Breached':'badge-red','Honored':'badge-green'
  };

  return `
  <div class="vh">
    <div class="vh-left">
      <h1>Pledges</h1>
      <div class="sub">Customer commitments with deadlines and accountability</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="openModal('pledge')">+ New Pledge</button>
    </div>
  </div>

  ${statRow(
    statBlock(pledges.filter(p=>p.status==='On Track').length,'On Track','commitments on schedule','#1e8a4a') +
    statBlock(pledges.filter(p=>p.status==='At Risk').length,'At Risk','need attention','#D97706') +
    statBlock(pledges.filter(p=>p.status==='Breached').length,'Breached','overdue commitments','#DC2626') +
    statBlock(pledges.filter(p=>p.status==='Honored').length,'Honored','delivered and signed off','#059669')
  )}

  <div class="filter-row">
    <div class="fg"><label>Status</label>
      <select onchange="switchTab('_pledgeFilter',this.value)">
        <option value="">All</option>
        <option value="On Track">On Track</option>
        <option value="At Risk">At Risk</option>
        <option value="Breached">Breached</option>
        <option value="Honored">Honored</option>
      </select>
    </div>
    <div class="fg"><label>Priority</label>
      <select onchange="switchTab('_pledgePriFilter',this.value)">
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
  const docs   = [...(APP_STATE.knowledge||[])].sort((a,b)=>{ const da=a.date||a.createdAt||''; const db=b.date||b.createdAt||''; return da>db?-1:da<db?1:0; });
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

  <div class="filter-row" style="margin-bottom:16px">
    <div class="fg" style="flex:1;max-width:400px">
      <label>Search</label>
      <input type="text" placeholder="Search title, tags, content…" value="${search}"
        oninput="switchTab('_knowledgeSearch',this.value)"
        style="min-width:250px"/>
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
