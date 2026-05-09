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
  return `<div class="filter-row no-print">
    <div class="fg">
      <label>Year</label>
      <select onchange="window._filterChange('year',this.value)">
        ${[2025,2026,2027].map(y=>`<option value="${y}" ${f.year==y?'selected':''}>${y}</option>`).join('')}
      </select>
    </div>
    <div class="fg">
      <label>Quarter</label>
      <select onchange="window._filterChange('quarter',this.value)">
        <option value="">All</option>
        ${['Q1','Q2','Q3','Q4'].map(q=>`<option value="${q}" ${f.quarter===q?'selected':''}>${q}</option>`).join('')}
      </select>
    </div>
    <div class="fg">
      <label>Track</label>
      <select onchange="window._filterChange('track',this.value)">
        <option value="">All Tracks</option>
        ${tracks.map(t=>`<option value="${t}" ${f.track===t?'selected':''}>${t}</option>`).join('')}
      </select>
    </div>
    <div class="fg">
      <label>From</label>
      <input type="date" value="${f.startDate||''}" onchange="window._filterChange('startDate',this.value)"/>
    </div>
    <div class="fg">
      <label>To</label>
      <input type="date" value="${f.endDate||''}" onchange="window._filterChange('endDate',this.value)"/>
    </div>
    <button class="btn btn-ghost btn-sm" onclick="window._filterReset()">Reset</button>
  </div>`;
}

const TRACK_COLORS = {'Track 1':'#1B2B5E','Track 2':'#00A896','Track 3':'#E8452C'};

// ─── EXEC BANNER ──────────────────────────────────────────
function execBanner(active) {
  const steps = [
    { view:'team',     label:'Team',      desc:'Members & roles',        num:1 },
    { view:'capacity', label:'Capacity',  desc:'Allocation planning',    num:2 },
    { view:'resources',label:'Resources', desc:'Weekly hour tracking',   num:3 }
  ];
  return `<div class="exec-banner">
    ${steps.map((s,i)=>`
      ${i>0?`<div class="exec-arrow">›</div>`:''}
      <div class="exec-step-card ${active===s.view?'active':''}" onclick="nav('${s.view}')">
        <div class="exec-step-num">${s.num}</div>
        <div class="exec-step-info">
          <div class="exec-step-title">${s.label}</div>
          <div class="exec-step-desc">${s.desc}</div>
        </div>
      </div>`).join('')}
  </div>`;
}

// ─── DASHBOARD ────────────────────────────────────────────
export function renderDashboard() {
  const projects = APP_STATE.projects.map(p=>({...p, name:p.name||p.title||'Unnamed', status:normaliseStatus(p.status||p.rag||'')}));
  const milestones = APP_STATE.milestones.map(m=>({...m, title:m.title||m.name||'Unnamed', status:normaliseStatus(m.status||m.rag||'')}));
  const total     = projects.length;
  const inProg    = projects.filter(p=>p.status==='In Progress').length;
  const atRisk    = milestones.filter(m=>m.status==='At Risk').length;
  const overdue   = milestones.filter(m=>m.status==='Overdue').length;
  const completed = projects.filter(p=>p.status==='Completed').length;
  const upcoming  = milestones.filter(m=>m.status!=='Completed').sort((a,b)=>a.dueDate>b.dueDate?1:-1).slice(0,5);
  const openRisks = APP_STATE.risks.filter(r=>normaliseStatus(r.status)==='Open');
  const openEsc   = APP_STATE.escalations.filter(e=>normaliseStatus(e.status||'Open')==='Open');
  const highRisks = openRisks.filter(r=>(r.likelihood||1)*(r.impact||1)>=12);
  const medRisks  = openRisks.filter(r=>{ const s=(r.likelihood||1)*(r.impact||1); return s>=6&&s<12; });
  const activeTab = APP_STATE._dashTab || 'flags';
  const overdueMilestones = milestones.filter(m=>m.status==='Overdue');

  const PIPELINE = [
    {label:'Yet to Start',color:'#94A3B8'},{label:'In Progress',color:'#1282a0'},
    {label:'On Track',color:'#1e8a4a'},{label:'At Risk',color:'#D97706'},
    {label:'On Hold',color:'#6B7280'},{label:'Completed',color:'#065F46'},
  ];

  function sumBlock(n, lbl, sub, col) {
    const on = n > 0;
    return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px 8px;gap:3px;border-right:1px solid var(--border)">
      <span style="font-size:28px;font-weight:800;color:${on?col:'#D1C9E0'};line-height:1">${n}</span>
      <span style="font-size:11px;font-weight:700;color:${on?col:'#D1C9E0'}">${lbl}</span>
      <span style="font-size:9px;color:var(--lt);text-align:center;line-height:1.3">${sub}</span>
    </div>`;
  }

  function fSection(title, subtitle, accent, items, renderItem) {
    return `<div class="card" style="overflow:hidden;padding:0">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 18px;border-bottom:1px solid var(--border);background:#FAFAFA;border-left:4px solid ${accent}">
        <div>
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:13px;font-weight:700;color:var(--navy)">${title}</span>
            <span style="font-size:11px;font-weight:700;padding:1px 8px;border-radius:980px;background:${items.length>0?accent+'20':'rgba(0,0,0,.05)'};color:${items.length>0?accent:'var(--lt)'}">${items.length}</span>
          </div>
          <div style="font-size:11px;color:var(--lt);margin-top:2px">${subtitle}</div>
        </div>
      </div>
      <div style="padding:8px 18px">
        ${items.length===0?`<p style="font-size:12px;color:var(--lt);padding:6px 0">All clear</p>`:`<div style="display:flex;flex-direction:column;gap:1px">${items.map(renderItem).join('')}</div>`}
      </div>
    </div>`;
  }

  function fRow(title, sub, detail, detailColor, action) {
    return `<div onclick="${action}" style="display:flex;align-items:center;gap:12px;padding:8px 8px;border-radius:6px;cursor:pointer;transition:background .1s" onmouseover="this.style.background='#F8F6FC'" onmouseout="this.style.background=''">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--navy);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${title}</div>
        ${sub?`<div style="font-size:11px;color:var(--lt);margin-top:1px">${sub}</div>`:''}
      </div>
      ${detail?`<span style="font-size:11px;font-weight:600;color:${detailColor};white-space:nowrap;background:${detailColor}12;padding:2px 8px;border-radius:4px">${detail}</span>`:''}
      <span style="font-size:11px;color:var(--lt);flex-shrink:0">→</span>
    </div>`;
  }

  function fGroup(label, accent, count, children) {
    if (count === 0) return '';
    return `<div style="margin-bottom:20px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <div style="width:10px;height:10px;border-radius:50%;background:${accent}"></div>
        <span style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${accent}">${label}</span>
        <span style="font-size:10px;padding:1px 8px;border-radius:980px;background:${accent}15;color:${accent};font-weight:600">${count} item${count!==1?'s':''}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;padding-left:18px;border-left:2px solid ${accent}20">
        ${children}
      </div>
    </div>`;
  }

  const activeCnt   = projects.filter(p=>['In Progress','On Track'].includes(normaliseStatus(p.status||''))).length;
  const attentionCnt= projects.filter(p=>['At Risk','On Hold'].includes(normaliseStatus(p.status||''))).length;
  const pipelineBoxes = PIPELINE.map(s=>{
    const cnt = projects.filter(p=>normaliseStatus(p.status||'')===s.label).length;
    return `<div style="flex:1;display:flex;flex-direction:column;gap:4px;align-items:center">
      <div onclick="nav('projects')" style="width:100%;height:36px;border-radius:4px;background:${cnt>0?s.color+'18':'#F7F5FC'};border:1px solid ${cnt>0?s.color+'30':'#EDE6F7'};display:flex;align-items:center;justify-content:center;cursor:pointer">
        <span style="font-size:${cnt>9?14:18}px;font-weight:700;color:${cnt>0?s.color:'#D1C9E0'}">${cnt}</span>
      </div>
      <span style="font-size:9px;text-align:center;line-height:1.25;color:${cnt>0?s.color:'var(--lt)'};font-weight:${cnt>0?600:400}">${s.label}</span>
    </div>`;
  }).join('');

  return `
  <div class="vh">
    <div class="vh-left">
      <h1>Dashboard</h1>
      <div class="sub">Engineering PMO Overview · ${DateHelpers.fmt(DateHelpers.today())}</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="openModal('project')">+ New Project</button>
    </div>
  </div>

  <div class="card" style="margin-bottom:20px;overflow:hidden;padding:0">
    <div style="padding:8px 20px 0;display:flex;align-items:center;gap:6px">
      <span style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--lt)">Portfolio snapshot</span>
      <span style="font-size:10px;color:var(--lt)">· ${DateHelpers.fmt(DateHelpers.today())}</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--border)">
      ${sumBlock(total,'Total','all projects','var(--navy)')}
      ${sumBlock(activeCnt,'Active','in progress or on track','#1282a0')}
      ${sumBlock(attentionCnt,'Attention','at risk or on hold','#D97706')}
      ${sumBlock(completed,'Completed','done and delivered','#065F46')}
    </div>
    <div style="padding:10px 20px 0;display:flex;align-items:center;gap:6px">
      <span style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--lt)">Status breakdown</span>
      <span style="font-size:10px;color:var(--lt)">· click to filter projects</span>
    </div>
    <div style="padding:10px 20px 14px">
      <div style="display:flex;gap:4px;align-items:stretch">${pipelineBoxes}</div>
      <div style="display:flex;gap:4px;margin-top:3px">
        <div style="flex:1;display:flex;justify-content:flex-end"><span style="font-size:9px;color:#D1C9E0">→</span></div>
        <div style="flex:1;display:flex;justify-content:flex-end"><span style="font-size:9px;color:#D1C9E0">→</span></div>
        <div style="flex:1;display:flex;justify-content:flex-end"><span style="font-size:9px;color:#D1C9E0">→</span></div>
        <div style="flex:1;display:flex;justify-content:flex-end"><span style="font-size:9px;color:#D1C9E0">→</span></div>
        <div style="flex:1;display:flex;justify-content:flex-end"><span style="font-size:9px;color:#D1C9E0">→</span></div>
        <div style="flex:1"></div>
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 320px;gap:16px;margin-bottom:16px;align-items:start">
    <div class="card">
      <div class="card-title">Project RAG Status</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px">
        ${projects.length ? projects.map(p=>`
        <div style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;cursor:pointer;transition:box-shadow .12s" onclick="nav('project-detail',{id:'${p.id}'})" onmouseover="this.style.boxShadow='0 2px 8px rgba(27,43,94,.1)'" onmouseout="this.style.boxShadow=''">
          <div style="font-size:13px;font-weight:700;color:var(--navy);margin-bottom:4px">${p.name}</div>
          <div style="font-size:11px;color:var(--lt);margin-bottom:8px">${p.track||'—'} · ${p.phase||'—'}</div>
          ${progressBar(p.progress||0)}
          <div style="display:flex;align-items:center;gap:8px;margin-top:4px">${ragBadge(p.status)}<span style="font-size:11px;color:var(--lt)">${p.progress||0}%</span></div>
        </div>`).join('') : `<div class="empty"><div class="empty-icon">📋</div>No projects yet</div>`}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px">
      <div class="card">
        <div class="card-title">Upcoming Milestones</div>
        ${upcoming.length ? upcoming.map(m=>`
        <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1">
            <div style="font-size:12px;font-weight:600;color:var(--navy)">${m.title}</div>
            <div style="font-size:11px;color:var(--lt)">${m.projectName||'—'}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">${ragBadge(m.status)}<div style="font-size:11px;color:var(--lt);margin-top:3px">${DateHelpers.fmt(m.dueDate)}</div></div>
        </div>`).join('') : `<div class="empty"><div class="empty-icon">🎯</div>No upcoming milestones</div>`}
      </div>
      <div class="card">
        <div class="card-title">Open Escalations</div>
        ${openEsc.length ? openEsc.map(e=>`
        <div style="border-left:3px solid ${['High','Critical'].includes(normaliseStatus(e.priority))?'#ef4444':'#f59e0b'};padding:8px 10px;margin-bottom:6px;border-radius:0 4px 4px 0;background:var(--bg)">
          <div style="font-size:12px;font-weight:600;color:var(--navy)">${e.title||'Unnamed'}</div>
          <div style="font-size:11px;color:var(--lt);margin-top:2px">${e.project||'—'} · ${DateHelpers.fmt(e.date)} · ${ragBadge(e.priority)}</div>
        </div>`).join('') : `<div class="empty"><div class="empty-icon">✅</div>No open escalations</div>`}
      </div>
    </div>
  </div>

  <div class="card">
    <div class="pulse-tabs">
      <button class="pt ${activeTab==='flags'?'active':''}" onclick="APP_STATE._dashTab='flags';nav('dashboard')">🚩 Flags</button>
      <button class="pt ${activeTab==='health'?'active':''}" onclick="APP_STATE._dashTab='health';nav('dashboard')">❤️ Health</button>
      <button class="pt ${activeTab==='activity'?'active':''}" onclick="APP_STATE._dashTab='activity';nav('dashboard')">⚡ Activity</button>
    </div>
    <div style="padding:10px 16px;background:rgba(27,43,94,.03);border-bottom:1px solid rgba(27,43,94,.06);font-size:12px;color:var(--lt);line-height:1.6">
      ${activeTab==='flags'?'Ordered by urgency — address critical and overdue items first. Each flag links directly to the relevant view.':activeTab==='health'?'Project health by track — RAG status at a glance across all delivery streams.':'Recent completions and milestone activity across the programme.'}
    </div>

    ${activeTab==='flags' ? `
    <div>
      ${!overdueMilestones.length && !highRisks.length && !medRisks.length && !openEsc.length ? `<div class="empty"><div class="empty-icon">✅</div>No flags — everything is moving.</div>` : ''}
      ${fGroup('Critical — act now','#DC2626', overdueMilestones.length + highRisks.length,
        (overdueMilestones.length ? fSection('Overdue Milestones','Past their due date — needs immediate attention','#DC2626',overdueMilestones,m=>fRow(m.title,m.projectName||'—',DateHelpers.fmt(m.dueDate),'#DC2626',`nav('milestones')`)) : '') +
        (highRisks.length ? fSection('High Risks','Score ≥12 — escalation required','#DC2626',highRisks,r=>fRow(r.title,r.mitigation||'','Score '+(r.likelihood||1)*(r.impact||1),'#DC2626',`nav('risks')`)) : '')
      )}
      ${fGroup('At risk','#D97706', medRisks.length,
        fSection('Medium Risks','Score 6–11 — monitor and plan mitigation','#D97706',medRisks,r=>fRow(r.title,r.mitigation||'','Score '+(r.likelihood||1)*(r.impact||1),'#D97706',`nav('risks')`))
      )}
      ${fGroup('Escalations','#1B2B5E', openEsc.length,
        fSection('Open Escalations','Issues raised that need resolution','#1B2B5E',openEsc,e=>fRow(e.title||'Unnamed',`${e.project||'—'} · ${DateHelpers.fmt(e.date)}`,normaliseStatus(e.priority),['High','Critical'].includes(normaliseStatus(e.priority))?'#DC2626':'#D97706',`nav('escalations')`))
      )}
    </div>` : ''}

    ${activeTab==='health' ? `
    <div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
        ${['Track 1','Track 2','Track 3'].map((track,i)=>{
          const tProj = projects.filter(p=>p.track===track);
          const tMs   = milestones.filter(m=>m.track===track);
          const colors = ['#1B2B5E','#00A896','#E8452C'];
          return `<div class="card" style="border-top:3px solid ${colors[i]};margin-bottom:0">
            <div style="font-size:14px;font-weight:800;color:var(--navy);margin-bottom:4px">${track}</div>
            <div style="font-size:11px;color:var(--lt);margin-bottom:8px">${tProj.length} projects · ${tMs.length} milestones</div>
            ${tProj.map(p=>`<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:12px">${ragBadge(p.status)}<span style="color:var(--text)">${p.name}</span></div>`).join('')}
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    ${activeTab==='activity' ? `
    <div>
      ${milestones.filter(m=>m.status==='Completed').slice(0,8).map(m=>`
      <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
        <span class="badge badge-green">✓</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:var(--navy)">${m.title}</div>
          <div style="font-size:11px;color:var(--lt)">${m.projectName||'—'} · ${DateHelpers.fmt(m.completedDate||m.dueDate)}</div>
        </div>
      </div>`).join('') || `<div class="empty"><div class="empty-icon">📝</div>No completed milestones yet</div>`}
    </div>` : ''}
  </div>`;
}

// ─── TRACKS ───────────────────────────────────────────────
export function renderTracks() {
  const projects    = APP_STATE.projects;
  const tracks      = APP_STATE.settings.trackNames || ['Track 1','Track 2','Track 3'];
  const f           = APP_STATE.filters;
  const activeTrack = f.track || 'All';
  const filtered    = activeTrack === 'All' ? projects : projects.filter(p => p.track === activeTrack);

  const COLS = [
    { label:'Yet to Start', color:'#94A3B8' },
    { label:'In Progress',  color:'#1282a0' },
    { label:'On Track',     color:'#1e8a4a' },
    { label:'At Risk',      color:'#D97706' },
    { label:'On Hold',      color:'#6B7280' },
    { label:'Completed',    color:'#065F46' },
  ];

  return `
  <div class="vh">
    <div class="vh-left">
      <h1>Clarity</h1>
      <div class="sub">Project pipeline · ${filtered.length} project${filtered.length!==1?'s':''}</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="openModal('project')">+ New Project</button>
    </div>
  </div>

  <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">
    ${['All',...tracks].map(t => {
      const isActive = activeTrack === t;
      const cnt = t==='All' ? projects.length : projects.filter(p=>p.track===t).length;
      const col = t==='All' ? '#1B2B5E' : (TRACK_COLORS[t]||'#1B2B5E');
      return `<button onclick="window._filterChange('track','${t==='All'?'':t}')"
        style="padding:5px 14px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:2px solid ${isActive?col:'var(--border)'};background:${isActive?col:'#fff'};color:${isActive?'#fff':col};font-family:'DM Sans',sans-serif;transition:all .15s">
        ${t} (${cnt})
      </button>`;
    }).join('')}
  </div>

  <div style="display:flex;gap:12px;overflow-x:auto;padding-bottom:16px;align-items:flex-start">
    ${COLS.map(col => {
      const colProjects = filtered.filter(p => normaliseStatus(p.status||'') === col.label);
      return `
      <div style="min-width:220px;flex:0 0 220px;display:flex;flex-direction:column;gap:8px">
        <div style="padding:10px 12px;border-radius:10px;background:#fff;border:1px solid var(--border);border-top:3px solid ${col.color};display:flex;justify-content:space-between;align-items:center">
          <span style="font-weight:600;font-size:12px;color:var(--navy)">${col.label}</span>
          <span style="font-size:11px;font-weight:700;color:${col.color};background:${col.color}18;border-radius:980px;padding:1px 8px">${colProjects.length}</span>
        </div>
        ${colProjects.length === 0
          ? `<div style="padding:16px 12px;border-radius:10px;background:rgba(0,0,0,.02);border:1px dashed var(--border);text-align:center"><span style="font-size:12px;color:var(--lt)">Empty</span></div>`
          : colProjects.map(p => {
              const devM = APP_STATE.teamMembers.find(m => m.id === p.devLead);
              const daysInStatus = p.statusChangedAt
                ? Math.floor((Date.now() - new Date(p.statusChangedAt).getTime()) / 86400000)
                : null;
              const stale = daysInStatus !== null && daysInStatus >= 14 && normaliseStatus(p.status||'') !== 'Completed';
              return `<div class="card" style="padding:12px 14px;cursor:pointer;border-radius:10px;transition:box-shadow .15s" onclick="nav('project-detail',{id:'${p.id}'})" onmouseover="this.style.boxShadow='0 4px 16px rgba(27,43,94,.13)'" onmouseout="this.style.boxShadow=''">
                <div style="font-weight:600;font-size:13px;color:var(--navy);margin-bottom:6px;line-height:1.3">${p.name||p.title||'Unnamed'}</div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">
                  ${p.track?`<span class="badge badge-navy" style="font-size:10px">${p.track}</span>`:''}
                  ${p.phase?`<span class="badge badge-grey" style="font-size:10px">${p.phase}</span>`:''}
                  ${stale?`<span class="badge badge-amber" style="font-size:10px" title="Days in current status">${daysInStatus}d</span>`:''}
                </div>
                ${progressBar(p.progress||0)}
                <div style="display:flex;align-items:center;margin-top:6px;gap:6px">
                  ${devM?`<div class="av av-sm" style="background:${TRACK_COLORS[devM.track]||'var(--navy)'}">${avatar(devM.name)}</div><span style="font-size:11px;color:var(--lt);flex:1">${devM.name}</span>`:'<span style="flex:1"></span>'}
                  ${p.endDate?`<span style="font-size:10px;color:${DateHelpers.isOverdue(p.endDate)&&normaliseStatus(p.status||'')!=='Completed'?'#ef4444':'var(--lt)'}">${DateHelpers.fmt(p.endDate)}</span>`:''}
                </div>
              </div>`;
            }).join('')
        }
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
  const rangeEnd   = new Date(year, endMonth + 1, 0);
  const totalDays  = Math.max(1, (rangeEnd.getTime() - rangeStart.getTime()) / 86400000);

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
    const left  = +((cs - rangeStart.getTime()) / 86400000 / totalDays * 100).toFixed(2);
    const width = Math.max(0.5, +((ce - cs) / 86400000 / totalDays * 100).toFixed(2));
    return { left, width };
  }

  const todayPct    = datePct(DateHelpers.today());
  const uniqueTracks = [...new Set(projects.map(p => p.track || 'Unassigned'))];
  const gridLines   = months.map((_,i) => i===0 ? '' :
    `<div style="position:absolute;top:0;bottom:0;left:${(i/months.length*100).toFixed(2)}%;width:1px;background:#EEF2F8;pointer-events:none;z-index:1"></div>`
  ).join('');
  const todayLine   = todayPct !== null
    ? `<div class="today-line" style="left:${todayPct}%"></div>`
    : '';

  return `
  ${filterBar()}
  <div class="vh">
    <div class="vh-left">
      <h1>Product Roadmap</h1>
      <div class="sub">${year}${f.quarter?' · '+f.quarter:' · Full Year'}</div>
    </div>
  </div>

  <div class="legend-bar">
    ${Object.entries(STATUS_COLOR).map(([s,c])=>`<div style="display:flex;align-items:center;gap:5px"><div style="width:22px;height:9px;border-radius:3px;background:${c}"></div><span>${s}</span></div>`).join('')}
    <div style="display:flex;align-items:center;gap:5px"><div style="width:2px;height:14px;background:#E8452C;border-radius:1px"></div>Today</div>
    <div style="display:flex;align-items:center;gap:5px"><div style="width:10px;height:10px;background:#1B2B5E;transform:rotate(45deg)"></div>Milestone</div>
  </div>

  <div class="gantt-wrap">
    ${(() => {
      const now = new Date();
      const todayQ = Math.floor(now.getMonth() / 3) + 1;
      const isCurrentYear = year === now.getFullYear();
      if (f.quarter) {
        const qNum = parseInt(f.quarter.slice(1));
        const isCurrent = isCurrentYear && qNum === todayQ;
        return `<div class="gantt-hdr">
          <div class="gantt-hdr-lbl"></div>
          <div class="gantt-timeline" style="display:flex">
            <div style="flex:1;text-align:center;font-size:11px;font-weight:800;color:${isCurrent?'#5F259F':'#555'};background:${isCurrent?'#F0EEF8':'#FAFAFA'};padding:6px 0;border-left:1px solid #EEF2F8">
              ${f.quarter}${isCurrent?` <span style="font-size:9px;font-weight:700;color:#fff;background:#5F259F;padding:1px 5px;border-radius:4px;margin-left:4px">NOW</span>`:''}
            </div>
          </div>
        </div>`;
      }
      return `<div class="gantt-hdr">
        <div class="gantt-hdr-lbl"></div>
        <div class="gantt-timeline" style="display:flex">
          ${[1,2,3,4].map(q=>{
            const isCurrent = isCurrentYear && q === todayQ;
            return `<div style="flex:3;text-align:center;font-size:11px;font-weight:${isCurrent?800:700};color:${isCurrent?'#5F259F':'#555'};background:${isCurrent?'#F0EEF8':'#FAFAFA'};padding:6px 0;border-left:1px solid #EEF2F8">
              Q${q}${isCurrent?` <span style="font-size:9px;font-weight:700;color:#fff;background:#5F259F;padding:1px 5px;border-radius:4px;margin-left:4px">NOW</span>`:''}
            </div>`;
          }).join('')}
        </div>
      </div>`;
    })()}
    <div class="gantt-hdr">
      <div class="gantt-hdr-lbl">Project</div>
      <div class="gantt-timeline" style="display:flex">
        ${months.map(m=>`<div style="flex:1;padding:9px 0;text-align:center;font-size:9px;font-weight:700;color:var(--lt);text-transform:uppercase;border-left:1px solid #EEF2F8">${DateHelpers.monthName(m)}</div>`).join('')}
      </div>
    </div>
    ${uniqueTracks.length === 0 ? `<div class="empty"><div class="empty-icon">📋</div>No projects match current filters.</div>` :
      uniqueTracks.map((track,ti) => {
        const tc    = TC[ti % TC.length];
        const tProj = projects.filter(p=>(p.track||'Unassigned')===track);
        return `<div class="gantt-seg-hdr" style="background:${tc}0D;border-left:4px solid ${tc};border-top:2px solid #F0EEF4;border-bottom:1px solid ${tc}28">
          <div class="gantt-seg-name" style="color:${tc};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.07em">${track} <span style="font-weight:400;color:${tc}88;text-transform:none;letter-spacing:0">— ${tProj.length} project${tProj.length!==1?'s':''}</span></div>
          <div style="border-left:1px solid var(--border);position:relative;min-height:32px">${gridLines}${todayLine}</div>
        </div>
        ${tProj.map((p,pi) => {
          const bar   = barRange(p.startDate, p.endDate);
          const pMs   = milestones.filter(m=>m.projectId===p.id);
          const color = STATUS_COLOR[normaliseStatus(p.status)]||'#94A3B8';
          return `<div class="gantt-row">
            <div class="gantt-lbl" onclick="nav('project-detail',{id:'${p.id}'})">
              <div class="gantt-feat-name">${p.name}</div>
              <div class="gantt-feat-sub" style="display:flex;align-items:center;gap:6px">
                ${ragBadge(p.status)}
                <span>${p.progress||0}%</span>
                ${p.devLead?`<span>· ${teamName(p.devLead)}</span>`:''}
              </div>
            </div>
            <div class="gantt-bar-area" style="position:relative;border-left:1px solid var(--border)">
              ${gridLines}${todayLine}
              ${bar?`<div class="g-bar" title="${p.name}" style="left:${bar.left}%;width:${bar.width}%;background:${color}">
                <div style="position:absolute;top:0;left:0;height:100%;width:${p.progress||0}%;background:rgba(255,255,255,.22);border-radius:4px 0 0 4px"></div>
                ${bar.width>5?`<div class="g-bar-lbl">${p.progress||0}%</div>`:''}
              </div>`:''}
              ${pMs.map(ms=>{
                const mp = datePct(ms.dueDate);
                if (mp===null) return '';
                const mc = MS_COLOR[normaliseStatus(ms.status)]||'#94A3B8';
                return `<div title="${ms.title} · ${ms.status}" style="position:absolute;top:50%;left:${mp}%;transform:translate(-50%,-50%);z-index:6;cursor:default">
                  <div style="width:11px;height:11px;background:${mc};border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.25)"></div>
                  <div style="position:absolute;top:14px;left:50%;transform:translateX(-50%);white-space:nowrap;font-size:9px;font-weight:700;color:${mc};background:#fff;padding:2px 5px;border-radius:3px;border:1px solid ${mc}50;max-width:90px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 3px rgba(0,0,0,.1)">${ms.title}</div>
                </div>`;
              }).join('')}
            </div>
          </div>`;
        }).join('')}`;
      }).join('')}
  </div>

`;
}

// ─── MILESTONES ───────────────────────────────────────────
export function renderMilestones() {
  const all = APP_STATE.milestones;
  const f   = APP_STATE.filters;
  const ms  = f.track ? all.filter(m=>m.track===f.track) : all;
  ms.sort((a,b)=>{ if(!a.dueDate) return 1; if(!b.dueDate) return -1; return a.dueDate > b.dueDate ? 1 : -1; });
  const overdue   = ms.filter(m=>normaliseStatus(m.status)==='Overdue');
  const atRisk    = ms.filter(m=>normaliseStatus(m.status)==='At Risk');
  const onTrack   = ms.filter(m=>['On Track','Yet to Start'].includes(normaliseStatus(m.status)));
  const completed = ms.filter(m=>normaliseStatus(m.status)==='Completed');

  function msCard(m) {
    const status     = normaliseStatus(m.status);
    const isComplete = status==='Completed';
    const borderCol  = status==='Overdue'?'#ef4444':status==='At Risk'?'#f59e0b':status==='Completed'?'#22c55e':'#3b82f6';
    return `<div class="flag-card ${status==='Overdue'?'high':status==='At Risk'?'med':''}" style="border-left-color:${borderCol}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="flex:1;font-size:13px;font-weight:700;color:var(--navy);${isComplete?'text-decoration:line-through;opacity:.6':''}">${m.title}</div>
        ${ragBadge(m.status)}
      </div>
      <div style="font-size:11px;color:var(--lt);display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px">
        <span>📁 ${m.projectName||'—'}</span>
        <span>📅 ${DateHelpers.fmt(m.dueDate)}</span>
        ${m.track?`<span>🗂 ${m.track}</span>`:''}
      </div>
      ${m.revisedETA?`<div style="font-size:11px;color:#d97706;margin-bottom:4px">⚠️ Revised: ${DateHelpers.fmt(m.revisedETA)}</div>`:''}
      ${m.delayReason?`<div style="font-size:11px;color:var(--mid);font-style:italic;margin-bottom:4px">${m.delayReason}</div>`:''}
      ${m.completedDate?`<div style="font-size:11px;color:#16a34a;margin-bottom:4px">✅ Done: ${DateHelpers.fmt(m.completedDate)}</div>`:''}
      <div style="display:flex;gap:6px;margin-top:4px">
        ${!isComplete?`<button class="btn btn-primary btn-xs" onclick="markMilestoneComplete('${m.id}')">✓ Complete</button>`:''}
        <button class="btn btn-ghost btn-xs" onclick="openModal('notes','${m.id}','milestone')">📝</button>
        <button class="btn btn-ghost btn-xs" onclick="openModal('milestone','${m.id}')">Edit</button>
        <button class="btn btn-danger btn-xs" onclick="deleteItem('milestones','${m.id}')">🗑</button>
      </div>
    </div>`;
  }

  function section(title, items, col) {
    if (!items.length) return '';
    return `<div style="margin-bottom:16px">
      <div style="font-size:13px;font-weight:700;color:${col};margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid var(--border)">${title} (${items.length})</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px">${items.map(msCard).join('')}</div>
    </div>`;
  }

  return `
  ${filterBar()}
  <div class="vh">
    <div class="vh-left">
      <h1>Milestones</h1>
      <div class="sub">${ms.length} milestones tracked</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="openModal('milestone')">+ Add Milestone</button>
    </div>
  </div>
  ${!ms.length?`<div class="empty"><div class="empty-icon">🎯</div>No milestones found</div>`:''}
  ${section('🔴 Overdue', overdue, 'var(--red)')}
  ${section('🟡 At Risk', atRisk, 'var(--amber)')}
  ${section('🔵 On Track / Yet to Start', onTrack, 'var(--blue)')}
  ${section('✅ Completed', completed, 'var(--green)')}`;
}

// ─── PROJECTS ─────────────────────────────────────────────
export function renderProjects() {
  const projects = filterProjects(APP_STATE.projects);
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
      <button class="btn btn-ghost btn-sm" onclick="downloadTemplate('projects')">⬇ Template</button>
      <button class="btn btn-ghost btn-sm" onclick="triggerImport('projects')">⬆ Import</button>
      <button class="btn btn-primary" onclick="openModal('project')">+ New Project</button>
    </div>
  </div>

  <div class="stat-row">
    <div class="stat-card n"><div class="stat-num">${total}</div><div class="stat-lbl">Total</div></div>
    <div class="stat-card b"><div class="stat-num">${inProg}</div><div class="stat-lbl">In Progress</div></div>
    <div class="stat-card g"><div class="stat-num">${completed}</div><div class="stat-num" style="font-size:30px"></div><div class="stat-lbl">Completed</div></div>
    <div class="stat-card a"><div class="stat-num">${atRisk}</div><div class="stat-lbl">At Risk / Overdue</div></div>
  </div>

  <div class="card" style="padding:0">
    <div class="tbl-wrap">
      <table class="dt">
        <thead><tr><th>Project</th><th>Track</th><th>Priority</th><th>Phase</th><th>Progress</th><th>Status</th><th>Start</th><th>End</th><th>Actions</th></tr></thead>
        <tbody>
          ${projects.length ? projects.map(p=>`
          <tr class="clk ${normaliseStatus(p.status)==='Completed'?'done':''}" onclick="nav('project-detail',{id:'${p.id}'})">
            <td>
              <div style="font-weight:700;color:var(--navy)">${p.name||p.title||'Unnamed'}</div>
              <div style="font-size:11px;color:var(--lt)">${p.description||''}</div>
            </td>
            <td>${p.track?`<span class="badge badge-navy">${p.track}</span>`:'—'}</td>
            <td>${ragBadge(p.priority)}</td>
            <td style="font-size:12px">${p.phase||'—'}</td>
            <td style="min-width:110px">
              ${progressBar(p.progress||0)}
              <div style="font-size:11px;color:var(--lt);margin-top:3px">${p.progress||0}%</div>
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

  const pMs    = APP_STATE.milestones.filter(m=>m.projectId===id);
  const pNotes = APP_STATE.notes.filter(n=>n.entityId===id);
  const charter = APP_STATE.charters.find(c=>c.projectId===id);
  const jira   = await JiraService.fetch(p.jiraKey);
  const tArr   = teamArr(p.team);

  return `
  <div class="vh">
    <div class="vh-left">
      <button class="btn btn-ghost btn-sm" onclick="nav('projects')" style="margin-bottom:6px">← Back</button>
      <h1>${p.name}</h1>
      <div class="sub">${p.track||'—'} · ${p.phase||'—'}</div>
    </div>
    <div class="vh-right">
      ${ragBadge(p.status)}
      <button class="btn btn-ghost btn-sm" onclick="openModal('project','${p.id}')">Edit</button>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:1fr 280px;gap:16px;align-items:start">
    <div>
      <div class="card" style="margin-bottom:12px">
        <div class="card-title">Project Overview</div>
        <div class="det-meta-grid">
          <div class="det-meta-item"><span class="lbl">Track</span><span class="val">${p.track||'—'}</span></div>
          <div class="det-meta-item"><span class="lbl">Phase</span><span class="val">${p.phase||'—'}</span></div>
          <div class="det-meta-item"><span class="lbl">Priority</span><span class="val">${ragBadge(p.priority)}</span></div>
          <div class="det-meta-item"><span class="lbl">Dev Lead</span><span class="val">${teamName(p.devLead)}</span></div>
          <div class="det-meta-item"><span class="lbl">Start</span><span class="val">${DateHelpers.fmt(p.startDate)}</span></div>
          <div class="det-meta-item"><span class="lbl">End</span><span class="val" style="${DateHelpers.isOverdue(p.endDate)&&normaliseStatus(p.status)!=='Completed'?'color:#ef4444':''}">${DateHelpers.fmt(p.endDate)}</span></div>
        </div>
        ${progressBar(p.progress||0)}
        <div style="font-size:11px;color:var(--lt);margin-top:4px">${p.progress||0}% complete</div>
        ${p.description?`<hr class="divider"/><div style="font-size:10px;font-weight:700;color:var(--lt);text-transform:uppercase;margin-bottom:4px">Description</div><div style="font-size:13px">${p.description}</div>`:''}
        ${p.objectives?`<div style="font-size:10px;font-weight:700;color:var(--lt);text-transform:uppercase;margin-top:10px;margin-bottom:4px">Objectives</div><div style="font-size:13px">${p.objectives}</div>`:''}
        ${p.stakeholders?`<div style="font-size:10px;font-weight:700;color:var(--lt);text-transform:uppercase;margin-top:10px;margin-bottom:4px">Stakeholders</div><div style="font-size:13px">${p.stakeholders}</div>`:''}
      </div>

      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="card-title" style="margin-bottom:0">Milestones</div>
          <button class="btn btn-ghost btn-sm" onclick="openModal('milestone',null,'${id}')">+ Add</button>
        </div>
        ${pMs.length ? pMs.map(m=>`
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;color:var(--navy)">${m.title}</div>
            <div style="font-size:11px;color:var(--lt)">${DateHelpers.fmt(m.dueDate)}${m.revisedETA?' → '+DateHelpers.fmt(m.revisedETA):''}</div>
          </div>
          ${ragBadge(m.status)}
          ${normaliseStatus(m.status)!=='Completed'?`<button class="btn btn-primary btn-xs" onclick="markMilestoneComplete('${m.id}')">✓</button>`:''}
        </div>`).join(''):'<div style="font-size:12px;color:var(--lt)">No milestones</div>'}
      </div>

      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div class="card-title" style="margin-bottom:0">Notes & Comments</div>
          <button class="btn btn-ghost btn-sm" onclick="openModal('notes','${id}','project')">+ Add Note</button>
        </div>
        ${pNotes.length ? pNotes.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).map(n=>`
        <div style="padding:10px;background:var(--bg);border-radius:var(--rs);margin-bottom:8px">
          <div style="display:flex;gap:8px;margin-bottom:4px">
            <div class="av av-sm" style="background:var(--navy)">${avatar(n.author||'PM')}</div>
            <div>
              <span style="font-size:12px;font-weight:700;color:var(--navy)">${n.author||'PM'}</span>
              <span style="font-size:11px;color:var(--lt);margin-left:6px">${DateHelpers.fmt(n.date)}</span>
            </div>
          </div>
          <div style="font-size:13px;color:var(--text)">${n.text}</div>
        </div>`).join(''):'<div style="font-size:12px;color:var(--lt)">No notes yet.</div>'}
      </div>
    </div>

    <div>
      <div class="card" style="margin-bottom:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div class="card-title" style="margin-bottom:0">Jira ${p.jiraKey?`<span class="badge badge-blue" style="font-size:10px;margin-left:4px">${p.jiraKey}</span>`:''} ${jira.isMock?'<span class="badge badge-amber" style="font-size:9px">mock</span>':''}</div>
          ${!p.jiraKey?`<button class="btn btn-ghost btn-xs" onclick="openModal('project','${p.id}')">+ Add Key</button>`:''}
        </div>
        ${!p.jiraKey?`<div style="font-size:12px;color:var(--lt)">No Jira project key set.</div>`:`
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px">
          <div style="background:var(--bg);border-radius:var(--rs);padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--navy)">${jira.todo}</div><div style="font-size:10px;color:var(--lt)">To Do</div></div>
          <div style="background:var(--bg);border-radius:var(--rs);padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--teal)">${jira.inProgress}</div><div style="font-size:10px;color:var(--lt)">In Progress</div></div>
          <div style="background:var(--bg);border-radius:var(--rs);padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--green)">${jira.done}</div><div style="font-size:10px;color:var(--lt)">Done</div></div>
          <div style="background:var(--bg);border-radius:var(--rs);padding:10px;text-align:center"><div style="font-size:20px;font-weight:800;color:var(--navy)">${jira.total}</div><div style="font-size:10px;color:var(--lt)">Total</div></div>
        </div>
        ${jira.total>0?progressBar(Math.round(jira.done/jira.total*100)):''}
        ${jira.isMock?`<div style="font-size:11px;color:var(--amber);margin-top:8px">⚠️ Showing mock data. Configure Jira in Admin Settings.</div>`:''}`}
      </div>

      <div class="card" style="margin-bottom:12px">
        <div class="card-title">Team</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px">
          ${tArr.map(tid=>{
            const m=APP_STATE.teamMembers.find(t=>t.id===tid);
            if(!m) return '';
            return `<div style="display:flex;align-items:center;gap:6px;background:var(--bg);border:1px solid var(--border);border-radius:var(--r);padding:5px 8px">
              <div class="av av-sm" style="background:${TRACK_COLORS[m.track]||'var(--navy)'}">${avatar(m.name)}</div>
              <div>
                <div style="font-size:12px;font-weight:600;color:var(--navy)">${m.name}</div>
                <div style="font-size:10px;color:var(--lt)">${m.role||''}</div>
              </div>
            </div>`;
          }).join('')||'<div style="font-size:12px;color:var(--lt)">No team assigned</div>'}
        </div>
      </div>

      ${charter?`
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div class="card-title" style="margin-bottom:0">Charter</div>
          <button class="btn btn-ghost btn-xs" onclick="openModal('charter','${charter.id}')">Edit</button>
        </div>
        <div style="font-size:10px;font-weight:700;color:var(--lt);text-transform:uppercase;margin-bottom:2px">Sponsor</div>
        <div style="font-size:12px;margin-bottom:8px">${charter.sponsor||'—'}</div>
        <div style="font-size:10px;font-weight:700;color:var(--lt);text-transform:uppercase;margin-bottom:2px">Objectives</div>
        <div style="font-size:13px;margin-bottom:8px">${charter.objectives||'—'}</div>
        <div style="font-size:10px;font-weight:700;color:var(--lt);text-transform:uppercase;margin-bottom:2px">Success Criteria</div>
        <div style="font-size:12px">${charter.successCriteria||'—'}</div>
      </div>`:`
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div class="card-title" style="margin-bottom:0">Charter</div>
          <button class="btn btn-ghost btn-xs" onclick="openModal('charter',null,'${id}')">+ Create</button>
        </div>
        <div class="empty" style="padding:20px 10px"><div class="empty-icon">📄</div>No charter yet</div>
      </div>`}
    </div>
  </div>`;
}

// ─── ONBOARDING ───────────────────────────────────────────
export function renderOnboarding() {
  const projects = APP_STATE.onboardingProjects;
  return `
  ${filterBar()}
  <div class="vh">
    <div class="vh-left">
      <h1>Onboarding Projects</h1>
      <div class="sub">${projects.length} customer onboardings</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="openModal('onboarding')">+ New Onboarding</button>
    </div>
  </div>
  <div class="card" style="padding:0">
    <div class="tbl-wrap">
      <table class="dt">
        <thead><tr><th>Customer</th><th>Project</th><th>Track</th><th>Phase</th><th>Status</th><th>Dev Lead</th><th>Start</th><th>End</th><th>Progress</th><th>Jira</th><th>Actions</th></tr></thead>
        <tbody>
          ${projects.length ? projects.map(p=>`
          <tr class="clk">
            <td><span style="font-size:12px;font-weight:600;color:var(--navy)">👤 ${p.customerName||'—'}</span></td>
            <td style="font-weight:700;color:var(--navy)">${p.name}</td>
            <td>${p.track?`<span class="badge badge-navy">${p.track}</span>`:'—'}</td>
            <td style="font-size:12px">${p.phase||'—'}</td>
            <td>${ragBadge(p.status)}</td>
            <td style="font-size:12px">${teamName(p.devLead)}</td>
            <td style="font-size:12px;color:var(--lt)">${DateHelpers.fmt(p.startDate)}</td>
            <td style="font-size:12px;color:var(--lt)">${DateHelpers.fmt(p.endDate)}</td>
            <td style="min-width:100px">${progressBar(p.progress||0)}<div style="font-size:11px;color:var(--lt);margin-top:3px">${p.progress||0}%</div></td>
            <td>${p.jiraKey?`<span class="badge badge-blue">${p.jiraKey}</span>`:'—'}</td>
            <td>
              <button class="btn-icon" onclick="openModal('onboarding','${p.id}')">✏️</button>
              <button class="btn-icon" onclick="deleteItem('onboardingProjects','${p.id}')">🗑</button>
            </td>
          </tr>`).join(''):`<tr><td colspan="11"><div class="empty"><div class="empty-icon">🏗️</div>No onboarding projects</div></td></tr>`}
        </tbody>
      </table>
    </div>
  </div>`;
}

// ─── WORKFLOWS ────────────────────────────────────────────
export function renderWorkflows() {
  const workflows = APP_STATE.workflows;
  return `
  <div class="vh">
    <div class="vh-left">
      <h1>Workflows</h1>
      <div class="sub">Reusable process templates</div>
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
export function renderTeam() {
  const allMembers  = APP_STATE.teamMembers;
  const tracks      = ['All',...(APP_STATE.settings.trackNames||['Track 1','Track 2','Track 3'])];
  const activeTrack = APP_STATE._teamTrackFilter||'All';
  const unsorted    = activeTrack==='All' ? allMembers : allMembers.filter(m=>m.track===activeTrack);
  const members     = [...unsorted].sort((a,b)=>(b.availability||100)-(a.availability||100));

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

  <div style="display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap">
    ${tracks.map(t=>{
      const isActive = activeTrack===t;
      const count    = t==='All' ? allMembers.length : allMembers.filter(m=>m.track===t).length;
      const color    = t==='All' ? '#1B2B5E' : (TRACK_COLORS[t]||'#1B2B5E');
      return `<button onclick="window._setTeamTrack('${t}')"
        style="padding:5px 14px;border-radius:20px;font-size:11px;font-weight:600;cursor:pointer;border:2px solid ${isActive?color:'var(--border)'};background:${isActive?color:'#fff'};color:${isActive?'#fff':color};font-family:'DM Sans',sans-serif;transition:all .15s">
        ${t} (${count})
      </button>`;
    }).join('')}
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px">
    ${members.length ? members.map(m=>`
    <div class="card" style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="av av-lg" style="background:${TRACK_COLORS[m.track]||'var(--navy)'}">${avatar(m.name)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:700;color:var(--navy)">${m.name}</div>
          <div style="font-size:12px;color:var(--mid)">${m.role||'—'}</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn-icon" onclick="openModal('teamMember','${m.id}')">✏️</button>
          <button class="btn-icon" onclick="deleteItem('teamMembers','${m.id}')">🗑</button>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        ${m.track?`<span class="badge" style="background:${TRACK_COLORS[m.track]||'#1B2B5E'}20;color:${TRACK_COLORS[m.track]||'#1B2B5E'};font-weight:700">${m.track}</span>`:''}
        ${m.jiraId?`<span class="badge badge-grey" style="font-family:monospace">${m.jiraId}</span>`:''}
      </div>
      <div>
        <div style="font-size:10px;font-weight:700;color:var(--lt);text-transform:uppercase;margin-bottom:4px">Availability</div>
        <div style="display:flex;align-items:center;gap:8px">
          ${progressBar(m.availability||100)}
          <span style="font-size:12px;font-weight:700;color:var(--navy)">${m.availability||100}%</span>
        </div>
      </div>
    </div>`).join('') : `<div class="empty" style="grid-column:1/-1"><div class="empty-icon">👥</div>No members in ${activeTrack}</div>`}
  </div>`;
}

// ─── CAPACITY ─────────────────────────────────────────────
export function renderCapacity() {
  const members   = [...APP_STATE.teamMembers].sort((a,b)=>(b.availability||100)-(a.availability||100));
  const f         = APP_STATE.filters;
  const projects  = f.track ? APP_STATE.projects.filter(p=>p.track===f.track) : APP_STATE.projects;
  const milestones = APP_STATE.milestones;

  function projectCompletion(p) {
    const pMs = milestones.filter(m => m.projectId === p.id);
    if (pMs.length === 0) return p.progress || 0;
    const done = pMs.filter(m => normaliseStatus(m.status) === 'Completed').length;
    return Math.round(done / pMs.length * 100);
  }

  const projectTotals = projects.map(p => ({
    allocated:  members.reduce((s,m)=>s+((m.allocations||{})[p.id]||0), 0),
    completion: projectCompletion(p)
  }));

  return `
  ${execBanner('capacity')}
  ${filterBar()}
  <div class="vh">
    <div class="vh-left">
      <h1>Capacity Planning</h1>
      <div class="sub">Allocation across projects</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="openModal('capacity')">Edit Allocations</button>
    </div>
  </div>

  <div class="card" style="padding:0">
    <div style="overflow-x:auto">
      <table class="cap-table">
        <thead>
          <tr>
            <th class="mc">Team Member</th>
            <th>Availability</th>
            ${projects.map(p => {
              const completion = projectCompletion(p);
              const cc = completion>=70?'#059669':completion>=40?'#D97706':'#DC2626';
              return `<th title="${p.name}">
                <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100px">${p.name.length>13?p.name.slice(0,13)+'…':p.name}</div>
                <div style="font-size:9px;font-weight:700;color:${cc};margin-top:2px">${completion}% done</div>
              </th>`;
            }).join('')}
            <th>Total</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${members.map(m => {
            const allocs = projects.map(p=>(m.allocations||{})[p.id]||0);
            const total  = allocs.reduce((s,a)=>s+a, 0);
            const avail  = m.availability || 100;
            const tcol   = TRACK_COLORS[m.track] || '#1B2B5E';
            const cls    = total > avail ? 'util-over' : total > 0 ? 'util-ok' : 'util-under';
            return `<tr>
              <td class="mc">
                <div style="display:flex;align-items:center;gap:8px">
                  <div class="av" style="background:${tcol}">${avatar(m.name)}</div>
                  <div>
                    <div style="font-size:12px;font-weight:700;color:var(--navy)">${m.name}</div>
                    <div style="font-size:11px;color:var(--mid)">${m.role||''}</div>
                    <div style="font-size:10px;color:${tcol};font-weight:700">${m.track||''}</div>
                  </div>
                </div>
              </td>
              <td>
                <div style="text-align:center">
                  <div style="font-size:15px;font-weight:800;color:var(--navy)">${avail}%</div>
                  <div style="width:60px;margin:4px auto 0">${progressBar(avail)}</div>
                </div>
              </td>
              ${projects.map((p,i) => {
                const v   = allocs[i];
                const pct = avail > 0 ? Math.min((v/avail*100), 100).toFixed(0) : 0;
                return `<td>
                  ${v > 0 ? `
                  <div style="text-align:center;font-size:14px;font-weight:700;color:${v>avail?'#ef4444':'var(--navy)'}">${v}%</div>
                  <div style="width:60px;margin:3px auto 0"><div class="pb"><div class="pb-fill" style="width:${pct}%;background:${v>avail?'#ef4444':'var(--teal)'}"></div></div></div>` :
                  `<div style="color:var(--lt);font-size:12px;text-align:center">—</div>`}
                </td>`;
              }).join('')}
              <td>
                <div style="text-align:center;font-size:16px;font-weight:800;color:${total>avail?'#ef4444':total===0?'var(--lt)':'var(--teal)'}">
                  ${total}%
                </div>
                <div style="font-size:10px;color:var(--lt);text-align:center">${avail > 0 ? Math.round(total/avail*100) : 0}% of cap</div>
              </td>
              <td><span class="util-badge ${cls}">${cls==='util-over'?'Over-allocated':cls==='util-under'?'Under-allocated':'Optimal'}</span></td>
            </tr>`;
          }).join('')}
          <tr style="background:#F5F6FA;border-top:2px solid var(--border)">
            <td class="mc" style="font-size:11px;font-weight:700;color:var(--lt)">PROJECT TOTALS</td>
            <td></td>
            ${projectTotals.map(pt => `
            <td>
              <div style="text-align:center;font-size:13px;font-weight:700;color:var(--navy)">${pt.allocated}%</div>
              <div style="text-align:center;font-size:10px;color:var(--lt)">${pt.completion}% done</div>
            </td>`).join('')}
            <td></td><td></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:var(--lt)">
    <span>💡 Completion % is calculated from milestones</span>
    <span>📊 Availability is set per member in Team</span>
    <span>✏️ Allocations are entered via Edit Allocations</span>
  </div>`;
}

// ─── RESOURCES ────────────────────────────────────────────
export function renderResources() {
  const members     = APP_STATE.teamMembers;
  const resources   = APP_STATE.resources;
  const f           = APP_STATE.filters;
  const weekOffset  = APP_STATE._resourceWeekOffset || 0;
  const today       = DateHelpers.today();

  const days = [];
  for (let i=0; i<7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + weekOffset*7 + i - 6);
    days.push(d.toISOString().split('T')[0]);
  }
  const weekStart = DateHelpers.fmtShort(days[0]);
  const weekEnd   = DateHelpers.fmtShort(days[6]);

  function getLogs(mid, date)  { return resources.filter(r=>r.memberId===mid&&r.date===date); }
  function isCrossTrack(mid, date) {
    return [...new Set(getLogs(mid,date).map(r=>r.track).filter(Boolean))].length > 1;
  }
  function totalHours(mid, date) { return getLogs(mid,date).reduce((s,r)=>s+(parseFloat(r.hours)||0),0); }

  const filtMembers = f.track ? members.filter(m=>m.track===f.track) : members;

  return `
  ${execBanner('resources')}
  ${filterBar()}
  <div class="vh">
    <div class="vh-left">
      <h1>Resource Tracking</h1>
      <div class="sub">Weekly hour logs per team member</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-primary" onclick="openModal('resource')">+ Log Hours</button>
    </div>
  </div>

  <div class="card" style="margin-bottom:14px;display:flex;align-items:center;gap:12px">
    <button class="btn btn-ghost btn-sm" onclick="window._resourceWeek(-1)">← Prev Week</button>
    <div style="flex:1;text-align:center;font-size:14px;font-weight:600;color:var(--navy)">
      ${weekStart} — ${weekEnd}
      ${weekOffset===0?`<span class="badge badge-teal" style="margin-left:8px">This Week</span>`:''}
    </div>
    <button class="btn btn-ghost btn-sm" onclick="window._resourceWeek(1)" ${weekOffset>=0?'disabled style="opacity:.4"':''}>Next Week →</button>
    ${weekOffset!==0?`<button class="btn btn-ghost btn-sm" onclick="window._resourceWeek(0,'reset')">Today</button>`:''}
  </div>

  <div class="card" style="padding:0">
    <div style="overflow-x:auto">
      <table class="cap-table">
        <thead>
          <tr>
            <th class="mc">Member</th>
            ${days.map(d=>{
              const isToday = d===today;
              return `<th style="${isToday?'background:var(--navy);color:#fff;':''}">${DateHelpers.fmtShort(d)}${isToday?'<div style="font-size:9px;opacity:.7">TODAY</div>':''}</th>`;
            }).join('')}
            <th>Week Total</th>
          </tr>
        </thead>
        <tbody>
          ${filtMembers.map(m=>{
            const weekTotal = days.reduce((s,d)=>s+totalHours(m.id,d),0);
            return `<tr>
              <td class="mc">
                <div style="display:flex;align-items:center;gap:6px">
                  <div class="av" style="background:${TRACK_COLORS[m.track]||'var(--navy)'}">${avatar(m.name)}</div>
                  <div>
                    <div style="font-weight:600;font-size:12px;color:var(--navy)">${m.name}</div>
                    <div style="font-size:10px;color:${TRACK_COLORS[m.track]||'var(--lt)'};font-weight:600">${m.track||'—'}</div>
                  </div>
                </div>
              </td>
              ${days.map(d=>{
                const logs  = getLogs(m.id,d);
                const cross = isCrossTrack(m.id,d);
                const tot   = totalHours(m.id,d);
                const isToday = d===today;
                return `<td style="cursor:pointer;${isToday?'background:#f8faff;':''}" onclick="openModal('resourceDay','${m.id}','${d}')" title="Click to log for ${m.name}">
                  ${logs.length>0?`
                  <div style="display:flex;flex-direction:column;gap:2px">
                    ${logs.map(log=>`
                    <div style="display:flex;align-items:center;gap:3px;background:${TRACK_COLORS[log.track]||'#1B2B5E'}18;border-left:2px solid ${TRACK_COLORS[log.track]||'#1B2B5E'};padding:2px 4px;border-radius:0 3px 3px 0">
                      <span style="font-size:11px;font-weight:700;color:${TRACK_COLORS[log.track]||'#1B2B5E'}">${log.hours}h</span>
                      <span style="font-size:9px;color:var(--lt);white-space:nowrap;overflow:hidden;max-width:50px;text-overflow:ellipsis">${log.track||''}</span>
                    </div>`).join('')}
                    ${cross?`<div style="font-size:9px;color:var(--amber);font-weight:700">⚠️ ${tot}h</div>`:''}
                  </div>` : `<div style="font-size:11px;color:var(--lt);text-align:center">—</div>`}
                </td>`;
              }).join('')}
              <td style="text-align:center;font-weight:700;color:${weekTotal>40?'#ef4444':weekTotal>0?'var(--navy)':'var(--lt)'}">
                ${weekTotal>0?weekTotal+'h':'—'}
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>
  <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px;font-size:12px;color:var(--lt)">
    <span>💡 Click any cell to log or edit hours</span>
    <span>⚠️ Amber = member logged across multiple tracks same day</span>
    <span>🔴 Week total over 40h flagged red</span>
  </div>`;
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
      <button class="btn btn-ghost btn-sm" onclick="downloadTemplate('risks')">⬇ Template</button>
      <button class="btn btn-ghost btn-sm" onclick="triggerImport('risks')">⬆ Import</button>
      <button class="btn btn-primary" onclick="openModal('risk')">+ Add Risk</button>
    </div>
  </div>

  <div class="stat-row">
    <div class="stat-card r"><div class="stat-num">${high}</div><div class="stat-lbl">High (Score ≥12)</div></div>
    <div class="stat-card a"><div class="stat-num">${med}</div><div class="stat-lbl">Medium (6–11)</div></div>
    <div class="stat-card g"><div class="stat-num">${low}</div><div class="stat-lbl">Low (&lt;6)</div></div>
    <div class="stat-card n"><div class="stat-num">${openRisks.length}</div><div class="stat-lbl">Open Total</div></div>
  </div>

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
  const escs = APP_STATE.escalations;
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
  const projects  = APP_STATE.projects;
  const milestones = APP_STATE.milestones;
  const risks     = APP_STATE.risks;
  const overdue   = milestones.filter(m=>normaliseStatus(m.status)==='Overdue');
  const atRisk    = milestones.filter(m=>normaliseStatus(m.status)==='At Risk');
  const openRisks = risks.filter(r=>normaliseStatus(r.status)==='Open').sort((a,b)=>b.likelihood*b.impact-a.likelihood*a.impact);

  return `
  <div class="vh">
    <div class="vh-left">
      <h1>Leadership Report</h1>
      <div class="sub">Generated: ${DateHelpers.fmt(DateHelpers.today())}</div>
    </div>
    <div class="vh-right">
      <button class="btn btn-ghost btn-sm no-print" onclick="window.print()">🖨 Print</button>
    </div>
  </div>

  <div class="report-section">
    <h2>Executive Summary</h2>
    <div class="stat-row">
      <div class="stat-card n"><div class="stat-num">${projects.length}</div><div class="stat-lbl">Total Projects</div></div>
      <div class="stat-card g"><div class="stat-num">${projects.filter(p=>normaliseStatus(p.status)==='Completed').length}</div><div class="stat-lbl">Completed</div></div>
      <div class="stat-card a"><div class="stat-num">${atRisk.length}</div><div class="stat-lbl">At Risk</div></div>
      <div class="stat-card r"><div class="stat-num">${overdue.length}</div><div class="stat-lbl">Overdue</div></div>
    </div>
  </div>

  <div class="report-section">
    <h2>Project Status</h2>
    <div class="card" style="padding:0">
      <div class="tbl-wrap">
        <table class="dt">
          <thead><tr><th>Project</th><th>Track</th><th>Phase</th><th>Status</th><th>Progress</th><th>Dev Lead</th></tr></thead>
          <tbody>${projects.map(p=>`
          <tr>
            <td style="font-weight:600">${p.name||p.title||'Unnamed'}</td>
            <td>${p.track||'—'}</td><td>${p.phase||'—'}</td>
            <td>${ragBadge(p.status)}</td>
            <td style="min-width:120px">${progressBar(p.progress||0)}<span style="font-size:11px;color:var(--lt)">${p.progress||0}%</span></td>
            <td style="font-size:12px">${teamName(p.devLead)}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="report-section">
    <h2>Milestone Health</h2>
    <div class="card" style="padding:0">
      <div class="tbl-wrap">
        <table class="dt">
          <thead><tr><th>Milestone</th><th>Project</th><th>Due Date</th><th>Revised ETA</th><th>Status</th></tr></thead>
          <tbody>${milestones.map(m=>`
          <tr class="${normaliseStatus(m.status)==='Overdue'?'':normaliseStatus(m.status)==='Completed'?'done':''}">
            <td style="font-weight:600">${m.title}</td>
            <td style="font-size:12px">${m.projectName||'—'}</td>
            <td style="font-size:12px">${DateHelpers.fmt(m.dueDate)}</td>
            <td style="font-size:12px;color:${m.revisedETA?'#d97706':''}">${DateHelpers.fmt(m.revisedETA)}</td>
            <td>${ragBadge(m.status)}</td>
          </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="report-section">
    <h2>Top Risks</h2>
    ${openRisks.slice(0,5).map(r=>{
      const score = r.likelihood*r.impact;
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
        <span class="risk-score ${score>=12?'score-h':score>=6?'score-m':'score-l'}">${score}</span>
        <div style="flex:1"><div style="font-weight:600;font-size:13px">${r.title}</div><div style="font-size:11px;color:var(--lt)">${r.mitigation||''}</div></div>
        <span style="font-size:12px;color:var(--mid)">${r.owner||'—'}</span>
      </div>`;
    }).join('')}
  </div>`;
}

// ─── IMPACTS ──────────────────────────────────────────────
export function renderImpacts() {
  const impacts = APP_STATE.impacts;
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
  const charters = APP_STATE.charters;
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
  const pledges = APP_STATE.pledges || [];

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
      <button class="btn btn-ghost btn-sm" onclick="downloadTemplate('pledges')">⬇ Template</button>
      <button class="btn btn-ghost btn-sm" onclick="triggerImport('pledges')">⬆ Import</button>
      <button class="btn btn-primary" onclick="openModal('pledge')">+ New Pledge</button>
    </div>
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
  const docs   = APP_STATE.knowledge || [];
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
        oninput="APP_STATE._knowledgeSearch=this.value;nav('knowledge')"
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
