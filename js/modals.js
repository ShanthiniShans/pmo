// ============================================================
// MODALS.JS — All CRUD Forms
// ============================================================
import { APP_STATE, DB, DateHelpers } from './data.js';

// ─── MODAL ENGINE ─────────────────────────────────────────
function show(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = html;
}

export function closeModal(id) {
  if (id) {
    const el = document.getElementById(id);
    if (el) { el.remove(); return; }
  }
  // Also remove any body-inserted modals
  document.querySelectorAll('.mo').forEach(m => m.remove());
  document.getElementById('modal-root').innerHTML = '';
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function num(id) {
  const v = parseInt(val(id));
  return isNaN(v) ? 0 : v;
}

function checkedVals(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(el=>el.value);
}

function memberOptions(selected) {
  return APP_STATE.teamMembers.map(m=>
    `<option value="${m.id}" ${selected===m.id?'selected':''}>${m.name} (${m.role})</option>`
  ).join('');
}

function projectOptions(selected) {
  return APP_STATE.projects.map(p=>
    `<option value="${p.id}" ${selected===p.id?'selected':''}>${p.name}</option>`
  ).join('');
}

function trackOptions(selected) {
  const tracks = APP_STATE.settings.trackNames || ['Track 1','Track 2','Track 3'];
  return tracks.map(t=>`<option value="${t}" ${selected===t?'selected':''}>${t}</option>`).join('');
}

function statusOptions(selected) {
  const opts = APP_STATE.settings.statusOptions || ['Yet to Start','In Progress','On Hold','Completed'];
  return opts.map(o=>`<option value="${o}" ${selected===o?'selected':''}>${o}</option>`).join('');
}

function phaseOptions(selected) {
  const opts = APP_STATE.settings.phaseOptions || ['Requirements','Design','Configuration','Development','UAT','Monitoring','Go-Live'];
  return opts.map(o=>`<option value="${o}" ${selected===o?'selected':''}>${o}</option>`).join('');
}

function priorityOptions(selected) {
  const opts = APP_STATE.settings.priorityOptions || ['Low','Medium','High','Critical'];
  return opts.map(o=>`<option value="${o}" ${selected===o?'selected':''}>${o}</option>`).join('');
}

function memberCheckboxes(selected) {
  const sel = Array.isArray(selected) ? selected : (selected||'').split(',').map(s=>s.trim()).filter(Boolean);
  return APP_STATE.teamMembers.map(m=>
    `<label class="checkbox-label">
      <input type="checkbox" name="team" value="${m.id}" ${sel.includes(m.id)?'checked':''}/>
      ${m.name} — ${m.role}
    </label>`
  ).join('');
}

// ─── OPEN MODAL ROUTER ────────────────────────────────────
export function openModal(type, id, extra) {
  switch(type) {
    case 'project':       return modalProject(id);
    case 'milestone':     return modalMilestone(id, extra);
    case 'teamMember':    return modalTeamMember(id);
    case 'risk':          return modalRisk(id);
    case 'escalation':    return modalEscalation(id);
    case 'charter':       return modalCharter(id, extra);
    case 'impact':        return modalImpact(id);
    case 'workflow':      return modalWorkflow(id);
    case 'resource':      return modalResource(id, extra);
    case 'resourceDay':   return modalResourceDay(id, extra);
    case 'notes':         return modalNotes(id, extra);
    case 'onboarding':    return modalOnboarding(id);
    case 'capacity':      return modalCapacity();
    case 'track':         return modalTrack(id);
    case 'pledge':        return openPledgeModal(id);
    case 'knowledge':     return openKnowledgeModal(id);
    case 'knowledge-view': return openKnowledgeViewModal(id);
    case 'assignTrackProject': return modalAssignTrackProject(id, extra);
    case 'assignTrackMember':  return modalAssignTrackMember(id, extra);
    default: console.warn('Unknown modal type:', type);
  }
}

// ─── PROJECT ──────────────────────────────────────────────
window._filterTeamOptions = function(q) {
  const sel = document.getElementById('pTeam');
  if (!sel) return;
  [...sel.options].forEach(o => {
    o.style.display = o.text.toLowerCase().includes(q.toLowerCase()) ? '' : 'none';
  });
};

async function modalProject(id) {
  const p = id ? APP_STATE.projects.find(x=>x.id===id) : null;
  const sel = Array.isArray(p?.team) ? p.team : (p?.team||'').split(',').map(s=>s.trim()).filter(Boolean);
  show(`<div class="mo" onclick="if(event.target===this)closeModal()">
    <div class="mo-box lg">
      <div class="mo-hdr">
        <span class="mo-title">${p ? 'Edit Project' : 'New Project'}</span>
        <button class="mo-close" onclick="closeModal()">×</button>
      </div>
      <div class="mo-body">
        <div class="form-row">
          <div class="form-group form-row-full">
            <label class="form-label">Project Name *</label>
            <input class="form-control" id="pName" value="${p?.name||''}"/>
          </div>
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Track</label>
            <select class="form-control" id="pTrack"><option value="">—</option>${trackOptions(p?.track)}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Phase</label>
            <select class="form-control" id="pPhase">${phaseOptions(p?.phase)}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="pStatus">${statusOptions(p?.status)}</select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Clarity Stage <span style="font-size:10px;font-weight:400;color:var(--lt)">(controls which column this appears in on the Clarity board)</span></label>
          <select class="form-control" id="pStage">
            <option value="">— Auto-detect from Status —</option>
            ${['Idea','Brief Draft','3-Way Scope','Ready to Build','In Progress','Released','Observation'].map(s=>`<option value="${s}" ${p?.stage===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select class="form-control" id="pPriority">${priorityOptions(p?.priority)}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input type="date" class="form-control" id="pStart" value="${p?.startDate||''}"/>
          </div>
          <div class="form-group">
            <label class="form-label">End Date</label>
            <input type="date" class="form-control" id="pEnd" value="${p?.endDate||''}"/>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Dev Lead</label>
            <select class="form-control" id="pDevLead"><option value="">—</option>${memberOptions(p?.devLead)}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Jira Project Key</label>
            <input class="form-control" id="pJira" value="${p?.jiraKey||''}" placeholder="e.g. RSE"/>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Progress (%)</label>
          <input type="number" class="form-control" id="pProgress" min="0" max="100" value="${p?.progress||0}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea class="form-control" id="pDesc">${p?.description||''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Objectives</label>
          <textarea class="form-control" id="pObj">${p?.objectives||''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Stakeholders</label>
          <input class="form-control" id="pStake" value="${p?.stakeholders||''}"/>
        </div>
        <div class="form-group">
          <label class="form-label" style="cursor:pointer;user-select:none;display:flex;align-items:center;gap:6px" onclick="(function(){var p=document.getElementById('pTeamPanel');var a=document.getElementById('pTeamArrow');p.style.display=p.style.display==='none'?'':'none';a.textContent=p.style.display===''?'▲':'▼';})()">
            Team Members
            <span style="font-size:10px;color:var(--lt);font-weight:400">${sel.length ? sel.length+' selected' : 'none selected'}</span>
            <span id="pTeamArrow" style="margin-left:auto;font-size:10px;color:var(--lt)">▼</span>
          </label>
          <div id="pTeamPanel" style="display:none">
            <input class="form-control" id="teamSearchInput" placeholder="Search members…" oninput="window._filterTeamOptions(this.value)" style="margin-bottom:6px;font-size:12px"/>
            <select class="form-control" id="pTeam" multiple size="5" style="font-size:12px">
              ${APP_STATE.teamMembers.map(m=>`<option value="${m.id}" ${sel.includes(m.id)?'selected':''}>${m.name} — ${m.role}</option>`).join('')}
            </select>
            <div style="font-size:11px;color:var(--lt);margin-top:4px">Hold Ctrl / Cmd to select multiple members</div>
          </div>
        </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveProject('${id||''}')">Save Project</button>
      </div>
    </div>
  </div>`);
}

window.saveProject = async function(id) {
  const data = {
    name: val('pName'), track: val('pTrack'), phase: val('pPhase'),
    status: val('pStatus'), priority: val('pPriority'),
    startDate: val('pStart'), endDate: val('pEnd'),
    devLead: val('pDevLead'), jiraKey: val('pJira'),
    progress: num('pProgress'), description: val('pDesc'),
    objectives: val('pObj'), stakeholders: val('pStake'),
    team: [...(document.getElementById('pTeam')?.selectedOptions||[])].map(o=>o.value),
    stage: val('pStage'),
    stageChangedAt: val('pStage') ? new Date().toISOString() : ''
  };
  if (!data.name) return alert('Project name is required');
  try {
    if (id) await DB.update('projects', id, data);
    else await DB.add('projects', data);
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

// ─── MILESTONE ────────────────────────────────────────────
window._msTasks = [];
window._renderMsTasks = function() {
  const list = document.getElementById('msTaskList');
  if (!list) return;
  list.innerHTML = window._msTasks.length === 0
    ? `<div style="font-size:11px;color:var(--lt);padding:6px 0">No tasks yet. Add one below.</div>`
    : window._msTasks.map((t,i)=>`
      <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:${t.done?'#f0fdf4':'#f8fafc'};border-radius:6px;border:1px solid ${t.done?'#bbf7d0':'#e2e8f0'}">
        <input type="checkbox" ${t.done?'checked':''} onchange="window._msTasks[${i}].done=this.checked;window._renderMsTasks()"/>
        <span style="flex:1;font-size:12px;${t.done?'text-decoration:line-through;color:var(--lt)':'color:var(--navy)'}">${t.text}</span>
        <button style="border:none;background:none;cursor:pointer;color:#ef4444;font-size:16px;line-height:1;padding:0 2px" onclick="window._msTasks.splice(${i},1);window._renderMsTasks()">×</button>
      </div>`).join('');
};
window._addMsTask = function() {
  const inp = document.getElementById('msNewTask');
  if (!inp || !inp.value.trim()) return;
  window._msTasks.push({ text: inp.value.trim(), done: false });
  inp.value = '';
  window._renderMsTasks();
};

async function modalMilestone(id, projectId) {
  const m = id ? APP_STATE.milestones.find(x=>x.id===id) : null;
  window._msTasks = (m?.tasks||[]).map(t=>({...t}));
  const statusOpts = ['On Track','At Risk','Overdue','Completed','Yet to Start'];
  show(`<div class="mo" onclick="if(event.target===this)closeModal()">
    <div class="mo-box">
      <div class="mo-hdr">
        <span class="mo-title">${m ? 'Edit Milestone' : 'New Milestone'}</span>
        <button class="mo-close" onclick="closeModal()">×</button>
      </div>
      <div class="mo-body">
        <div class="form-group">
          <label class="form-label">Title *</label>
          <input class="form-control" id="msTitle" value="${m?.title||''}"/>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Project</label>
            <select class="form-control" id="msProject">
              <option value="">—</option>
              ${APP_STATE.projects.map(p=>`<option value="${p.id}" data-name="${p.name}" ${(m?.projectId===p.id||projectId===p.id)?'selected':''}>${p.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Track</label>
            <select class="form-control" id="msTrack"><option value="">—</option>${trackOptions(m?.track)}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Due Date</label>
            <input type="date" class="form-control" id="msDue" value="${m?.dueDate||''}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="msStatus" onchange="toggleMsCompleted(this.value)">
              ${statusOpts.map(s=>`<option value="${s}" ${m?.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group" id="msCompletedGroup" style="${m?.status==='Completed'?'':'display:none'}">
          <label class="form-label">Completion Date</label>
          <input type="date" class="form-control" id="msCompleted" value="${m?.completedDate||''}"/>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Revised ETA (if delayed)</label>
            <input type="date" class="form-control" id="msRevised" value="${m?.revisedETA||''}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Delay Reason</label>
            <input class="form-control" id="msDelay" value="${m?.delayReason||''}" placeholder="Brief reason for delay"/>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-control" id="msNotes">${m?.notes||''}</textarea>
        </div>
        <div class="form-group" style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px">
          <label class="form-label" style="margin-bottom:8px">Tasks <span style="font-size:10px;font-weight:400;color:var(--lt)">(checklist for this milestone)</span></label>
          <div id="msTaskList" style="display:flex;flex-direction:column;gap:4px;margin-bottom:8px">
            <div style="font-size:11px;color:var(--lt);padding:6px 0">No tasks yet. Add one below.</div>
          </div>
          <div style="display:flex;gap:8px">
            <input class="form-control" id="msNewTask" placeholder="Add a task…" style="flex:1;font-size:12px" onkeydown="if(event.key==='Enter'){event.preventDefault();window._addMsTask()}"/>
            <button class="btn btn-ghost btn-sm" type="button" onclick="window._addMsTask()">+ Add</button>
          </div>
        </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveMilestone('${id||''}')">Save</button>
      </div>
    </div>
  </div>`);
  window._renderMsTasks();
}

window.toggleMsCompleted = function(status) {
  const el = document.getElementById('msCompletedGroup');
  if (el) el.style.display = status === 'Completed' ? '' : 'none';
};

window.saveMilestone = async function(id) {
  const selEl = document.getElementById('msProject');
  const projectId = selEl.value;
  const projectName = selEl.options[selEl.selectedIndex]?.dataset?.name || '';
  const data = {
    title: val('msTitle'), projectId, projectName,
    track: val('msTrack'), dueDate: val('msDue'),
    status: val('msStatus'), completedDate: val('msCompleted'),
    revisedETA: val('msRevised'), delayReason: val('msDelay'),
    notes: val('msNotes'),
    tasks: window._msTasks || []
  };
  if (!data.title) return alert('Title required');
  try {
    if (id) await DB.update('milestones', id, data);
    else await DB.add('milestones', data);
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

// ─── TEAM MEMBER ──────────────────────────────────────────
async function modalTeamMember(id) {
  const m = id ? APP_STATE.teamMembers.find(x=>x.id===id) : null;
  show(`<div class="mo" onclick="if(event.target===this)closeModal()">
    <div class="mo-box">
      <div class="mo-hdr">
        <span class="mo-title">${m ? 'Edit Team Member' : 'Add Team Member'}</span>
        <button class="mo-close" onclick="closeModal()">×</button>
      </div>
      <div class="mo-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Full Name *</label>
            <input class="form-control" id="tmName" value="${m?.name||''}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Role</label>
            <input class="form-control" id="tmRole" value="${m?.role||''}"/>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Track Assignment</label>
            <select class="form-control" id="tmTrack"><option value="">—</option>${trackOptions(m?.track)}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Jira User ID</label>
            <input class="form-control" id="tmJira" value="${m?.jiraId||''}" placeholder="e.g. firstname.last"/>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Availability (%)</label>
          <input type="number" class="form-control" id="tmAvail" min="0" max="100" value="${m?.availability||100}"/>
        </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveTeamMember('${id||''}')">Save</button>
      </div>
    </div>
  </div>`);
}

window.saveTeamMember = async function(id) {
  const data = { name: val('tmName'), role: val('tmRole'), track: val('tmTrack'), jiraId: val('tmJira'), availability: num('tmAvail') };
  if (!data.name) return alert('Name required');
  try {
    if (id) await DB.update('teamMembers', id, data);
    else await DB.add('teamMembers', data);
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

// ─── RISK ─────────────────────────────────────────────────
async function modalRisk(id) {
  const r = id ? APP_STATE.risks.find(x=>x.id===id) : null;
  show(`<div class="mo" onclick="if(event.target===this)closeModal()">
    <div class="mo-box">
      <div class="mo-hdr">
        <span class="mo-title">${r ? 'Edit Risk' : 'Add Risk'}</span>
        <button class="mo-close" onclick="closeModal()">×</button>
      </div>
      <div class="mo-body">
        <div class="form-group">
          <label class="form-label">Risk Title *</label>
          <input class="form-control" id="rTitle" value="${r?.title||''}"/>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Project</label>
            <input class="form-control" id="rProject" value="${r?.project||''}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Track</label>
            <select class="form-control" id="rTrack"><option value="">—</option>${trackOptions(r?.track)}</select>
          </div>
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Likelihood (1–5)</label>
            <input type="number" class="form-control" id="rL" min="1" max="5" value="${r?.likelihood||3}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Impact (1–5)</label>
            <input type="number" class="form-control" id="rI" min="1" max="5" value="${r?.impact||3}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="rStatus">
              ${['Open','Mitigated','Closed'].map(s=>`<option value="${s}" ${r?.status===s?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Owner</label>
          <input class="form-control" id="rOwner" value="${r?.owner||''}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Mitigation Plan</label>
          <textarea class="form-control" id="rMit">${r?.mitigation||''}</textarea>
        </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveRisk('${id||''}')">Save</button>
      </div>
    </div>
  </div>`);
}

window.saveRisk = async function(id) {
  const data = { title: val('rTitle'), project: val('rProject'), track: val('rTrack'), likelihood: num('rL'), impact: num('rI'), status: val('rStatus'), owner: val('rOwner'), mitigation: val('rMit') };
  if (!data.title) return alert('Title required');
  try {
    if (id) await DB.update('risks', id, data);
    else await DB.add('risks', data);
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

// ─── ESCALATION ───────────────────────────────────────────
async function modalEscalation(id) {
  const e = id ? APP_STATE.escalations.find(x=>x.id===id) : null;
  show(`<div class="mo" onclick="if(event.target===this)closeModal()">
    <div class="mo-box">
      <div class="mo-hdr">
        <span class="mo-title">${e ? 'Edit Escalation' : 'Add Escalation'}</span>
        <button class="mo-close" onclick="closeModal()">×</button>
      </div>
      <div class="mo-body">
        <div class="form-group">
          <label class="form-label">Title *</label>
          <input class="form-control" id="escTitle" value="${e?.title||''}"/>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Project</label>
            <input class="form-control" id="escProject" value="${e?.project||''}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Track</label>
            <select class="form-control" id="escTrack"><option value="">—</option>${trackOptions(e?.track)}</select>
          </div>
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Raised By</label>
            <input class="form-control" id="escBy" value="${e?.raisedBy||''}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" class="form-control" id="escDate" value="${e?.date||DateHelpers.today()}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select class="form-control" id="escPriority">
              ${['Low','Medium','High','Critical'].map(p=>`<option value="${p}" ${e?.priority===p?'selected':''}>${p}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="escStatus">
            ${['Open','In Progress','Resolved'].map(s=>`<option value="${s}" ${e?.status===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-control" id="escNotes">${e?.notes||''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Resolution</label>
          <textarea class="form-control" id="escRes">${e?.resolution||''}</textarea>
        </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveEscalation('${id||''}')">Save</button>
      </div>
    </div>
  </div>`);
}

window.saveEscalation = async function(id) {
  const data = { title: val('escTitle'), project: val('escProject'), track: val('escTrack'), raisedBy: val('escBy'), date: val('escDate'), priority: val('escPriority'), status: val('escStatus'), notes: val('escNotes'), resolution: val('escRes') };
  if (!data.title) return alert('Title required');
  try {
    if (id) await DB.update('escalations', id, data);
    else await DB.add('escalations', data);
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

// ─── CHARTER ──────────────────────────────────────────────
async function modalCharter(id, projectId) {
  const c = id ? APP_STATE.charters.find(x=>x.id===id) : null;
  show(`<div class="mo" onclick="if(event.target===this)closeModal()">
    <div class="mo-box lg">
      <div class="mo-hdr">
        <span class="mo-title">${c ? 'Edit Charter' : 'New Charter'}</span>
        <button class="mo-close" onclick="closeModal()">×</button>
      </div>
      <div class="mo-body">
        <div class="form-group">
          <label class="form-label">Project *</label>
          <select class="form-control" id="chProject">
            <option value="">—</option>
            ${APP_STATE.projects.map(p=>`<option value="${p.id}" data-name="${p.name}" ${(c?.projectId===p.id||projectId===p.id)?'selected':''}>${p.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Sponsor</label>
            <input class="form-control" id="chSponsor" value="${c?.sponsor||''}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Budget</label>
            <input class="form-control" id="chBudget" value="${c?.budget||''}"/>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input type="date" class="form-control" id="chStart" value="${c?.startDate||''}"/>
          </div>
          <div class="form-group">
            <label class="form-label">End Date</label>
            <input type="date" class="form-control" id="chEnd" value="${c?.endDate||''}"/>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Objectives</label>
          <textarea class="form-control" id="chObj">${c?.objectives||''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Scope (In)</label>
          <textarea class="form-control" id="chScope">${c?.scope||''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Out of Scope</label>
          <textarea class="form-control" id="chOos">${c?.outOfScope||''}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Success Criteria</label>
          <textarea class="form-control" id="chSuccess">${c?.successCriteria||''}</textarea>
        </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveCharter('${id||''}')">Save Charter</button>
      </div>
    </div>
  </div>`);
}

window.saveCharter = async function(id) {
  const selEl = document.getElementById('chProject');
  const projectId = selEl.value;
  const projectName = selEl.options[selEl.selectedIndex]?.dataset?.name || '';
  const data = { projectId, projectName, sponsor: val('chSponsor'), budget: val('chBudget'), startDate: val('chStart'), endDate: val('chEnd'), objectives: val('chObj'), scope: val('chScope'), outOfScope: val('chOos'), successCriteria: val('chSuccess') };
  if (!data.projectId) return alert('Select a project');
  try {
    if (id) await DB.update('charters', id, data);
    else await DB.add('charters', data);
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

// ─── IMPACT ───────────────────────────────────────────────
async function modalImpact(id) {
  const i = id ? APP_STATE.impacts.find(x=>x.id===id) : null;
  show(`<div class="mo" onclick="if(event.target===this)closeModal()">
    <div class="mo-box">
      <div class="mo-hdr">
        <span class="mo-title">${i ? 'Edit Impact' : 'Add Impact'}</span>
        <button class="mo-close" onclick="closeModal()">×</button>
      </div>
      <div class="mo-body">
        <div class="form-group">
          <label class="form-label">Project *</label>
          <input class="form-control" id="impProject" value="${i?.project||''}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Metric *</label>
          <input class="form-control" id="impMetric" value="${i?.metric||''}"/>
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Baseline</label>
            <input class="form-control" id="impBaseline" value="${i?.baseline||''}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Current</label>
            <input class="form-control" id="impCurrent" value="${i?.current||''}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Target</label>
            <input class="form-control" id="impTarget" value="${i?.target||''}"/>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Improvement %</label>
          <input class="form-control" id="impImprove" value="${i?.improvement||''}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-control" id="impNotes">${i?.notes||''}</textarea>
        </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveImpact('${id||''}')">Save</button>
      </div>
    </div>
  </div>`);
}

window.saveImpact = async function(id) {
  const data = { project: val('impProject'), metric: val('impMetric'), baseline: val('impBaseline'), current: val('impCurrent'), target: val('impTarget'), improvement: val('impImprove'), notes: val('impNotes') };
  if (!data.project || !data.metric) return alert('Project and metric required');
  try {
    if (id) await DB.update('impacts', id, data);
    else await DB.add('impacts', data);
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

// ─── WORKFLOW ─────────────────────────────────────────────
async function modalWorkflow(id) {
  const w = id ? APP_STATE.workflows.find(x=>x.id===id) : null;
  const steps = w?.steps || [{ name:'', assignee:'', duration:1 }];
  show(`<div class="mo" onclick="if(event.target===this)closeModal()">
    <div class="mo-box lg">
      <div class="mo-hdr">
        <span class="mo-title">${w ? 'Edit Workflow' : 'New Workflow'}</span>
        <button class="mo-close" onclick="closeModal()">×</button>
      </div>
      <div class="mo-body">
        <div class="form-group">
          <label class="form-label">Workflow Name *</label>
          <input class="form-control" id="wfName" value="${w?.name||''}"/>
        </div>
        <div style="margin-top:8px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div class="form-label" style="flex:1;margin-bottom:0">Steps</div>
            <button class="btn btn-ghost btn-sm" onclick="addWfStep()">+ Add Step</button>
          </div>
          <div id="wfSteps">
            ${steps.map((s,i)=>wfStepRow(s,i)).join('')}
          </div>
        </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveWorkflow('${id||''}')">Save</button>
      </div>
    </div>
  </div>`);
}

function wfStepRow(s, i) {
  return `<div class="step-item" id="wfStep-${i}" style="margin-bottom:6px">
    <div class="step-num">${i+1}</div>
    <input class="form-control" style="flex:2" placeholder="Step name" value="${s.name||''}" id="wfStep-name-${i}"/>
    <input class="form-control" style="flex:1" placeholder="Assignee" value="${s.assignee||''}" id="wfStep-assignee-${i}"/>
    <input type="number" class="form-control" style="width:60px" placeholder="Days" value="${s.duration||1}" id="wfStep-dur-${i}" min="1"/>
    <button class="btn-icon danger" onclick="removeWfStep(${i})">🗑</button>
  </div>`;
}

let wfStepCount = 0;
window.addWfStep = function() {
  const container = document.getElementById('wfSteps');
  const idx = container.children.length;
  const div = document.createElement('div');
  div.innerHTML = wfStepRow({name:'',assignee:'',duration:1}, idx);
  container.appendChild(div.firstChild);
};
window.removeWfStep = function(i) {
  const el = document.getElementById(`wfStep-${i}`);
  if (el) el.remove();
};

window.saveWorkflow = async function(id) {
  const name = val('wfName');
  if (!name) return alert('Workflow name required');
  const container = document.getElementById('wfSteps');
  const steps = [];
  for (let i = 0; i < container.children.length; i++) {
    const n = document.getElementById(`wfStep-name-${i}`)?.value||'';
    const a = document.getElementById(`wfStep-assignee-${i}`)?.value||'';
    const d = parseInt(document.getElementById(`wfStep-dur-${i}`)?.value)||1;
    if (n) steps.push({ name: n, assignee: a, duration: d });
  }
  try {
    if (id) await DB.update('workflows', id, { name, steps });
    else await DB.add('workflows', { name, steps });
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

// ─── RESOURCE LOG ─────────────────────────────────────────
async function modalResource(memberId, date) {
  const existing = memberId && date ? APP_STATE.resources.find(r=>r.memberId===memberId&&r.date===date) : null;
  const members = APP_STATE.teamMembers;
  show(`<div class="mo" onclick="if(event.target===this)closeModal()">
    <div class="mo-box">
      <div class="mo-hdr">
        <span class="mo-title">Log Hours</span>
        <button class="mo-close" onclick="closeModal()">×</button>
      </div>
      <div class="mo-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Team Member *</label>
            <select class="form-control" id="resMember">
              <option value="">—</option>
              ${members.map(m=>`<option value="${m.id}" ${memberId===m.id?'selected':''}>${m.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Date *</label>
            <input type="date" class="form-control" id="resDate" value="${date||DateHelpers.today()}"/>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Hours</label>
            <input type="number" class="form-control" id="resHours" min="0" max="24" step="0.5" value="${existing?.hours||8}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Track</label>
            <select class="form-control" id="resTrack"><option value="">—</option>${trackOptions(existing?.track)}</select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Project / Activity</label>
          <input class="form-control" id="resActivity" value="${existing?.activity||''}" placeholder="What did they work on?"/>
        </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveResource('${existing?.id||''}')">Save</button>
      </div>
    </div>
  </div>`);
}

window.saveResource = async function(id) {
  const data = { memberId: val('resMember'), date: val('resDate'), hours: parseFloat(document.getElementById('resHours')?.value)||0, track: val('resTrack'), activity: val('resActivity') };
  if (!data.memberId || !data.date) return alert('Member and date required');
  try {
    if (id) await DB.update('resources', id, data);
    else await DB.add('resources', data);
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

// ─── NOTES ────────────────────────────────────────────────
async function modalNotes(entityId, entityType) {
  const existing = APP_STATE.notes.filter(n=>n.entityId===entityId);
  show(`<div class="mo" onclick="if(event.target===this)closeModal()">
    <div class="mo-box">
      <div class="mo-hdr">
        <span class="mo-title">Notes & Comments</span>
        <button class="mo-close" onclick="closeModal()">×</button>
      </div>
      <div class="mo-body">
        <div style="margin-bottom:14px">
          ${existing.length ? existing.map(n=>`
          <div style="padding:10px;background:var(--bg);border-radius:var(--rs);margin-bottom:8px">
            <div style="display:flex;gap:8px;margin-bottom:4px">
              <span style="font-size:12px;font-weight:700;color:var(--navy)">${n.author||'PM'}</span>
              <span style="font-size:11px;color:var(--lt)">${DateHelpers.fmt(n.date)}</span>
            </div>
            <div style="font-size:13px;color:var(--text)">${n.text}</div>
          </div>`).join('') : '<div style="font-size:12px;color:var(--lt)">No notes yet</div>'}
        </div>
        <hr class="divider"/>
        <div class="form-group">
          <label class="form-label">Add Note</label>
          <textarea class="form-control" id="noteText" placeholder="Type your comment…" style="min-height:80px"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Author</label>
            <input class="form-control" id="noteAuthor" value="PM"/>
          </div>
          <div class="form-group">
            <label class="form-label">Date</label>
            <input type="date" class="form-control" id="noteDate" value="${DateHelpers.today()}"/>
          </div>
        </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Close</button>
        <button class="btn btn-primary" onclick="saveNote('${entityId}','${entityType}')">Add Note</button>
      </div>
    </div>
  </div>`);
}

window.saveNote = async function(entityId, entityType) {
  const text = val('noteText');
  if (!text) return alert('Note text required');
  try {
    await DB.add('notes', { entityId, entityType, text, author: val('noteAuthor'), date: val('noteDate') });
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

// ─── ONBOARDING ───────────────────────────────────────────
async function modalOnboarding(id) {
  const p = id ? APP_STATE.onboardingProjects.find(x=>x.id===id) : null;
  const sel = Array.isArray(p?.team) ? p.team : (p?.team||'').split(',').map(s=>s.trim()).filter(Boolean);
  show(`<div class="mo" onclick="if(event.target===this)closeModal()">
    <div class="mo-box lg">
      <div class="mo-hdr">
        <span class="mo-title">${p ? 'Edit Onboarding Project' : 'New Onboarding Project'}</span>
        <button class="mo-close" onclick="closeModal()">×</button>
      </div>
      <div class="mo-body">
        <div class="form-group">
          <label class="form-label">Customer Name *</label>
          <input class="form-control" id="obCustomer" value="${p?.customerName||''}"/>
        </div>
        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Track</label>
            <select class="form-control" id="obTrack"><option value="">—</option>${trackOptions(p?.track)}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Phase</label>
            <select class="form-control" id="obPhase">${phaseOptions(p?.phase)}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-control" id="obStatus">${statusOptions(p?.status)}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Dev Lead</label>
            <select class="form-control" id="obLead"><option value="">—</option>${memberOptions(p?.devLead)}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Jira Key</label>
            <input class="form-control" id="obJira" value="${p?.jiraKey||''}"/>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input type="date" class="form-control" id="obStart" value="${p?.startDate||''}"/>
          </div>
          <div class="form-group">
            <label class="form-label">End Date</label>
            <input type="date" class="form-control" id="obEnd" value="${p?.endDate||''}"/>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Progress (%)</label>
          <input type="number" class="form-control" id="obProgress" min="0" max="100" value="${p?.progress||0}"/>
        </div>
        <div class="form-group">
          <label class="form-label" style="cursor:pointer;user-select:none;display:flex;align-items:center;gap:6px" onclick="(function(){var p=document.getElementById('obTeamPanel');var a=document.getElementById('obTeamArrow');p.style.display=p.style.display==='none'?'':'none';a.textContent=p.style.display===''?'▲':'▼';})()">
            Team Members
            <span style="font-size:10px;color:var(--lt);font-weight:400">${sel.length ? sel.length+' selected' : 'none selected'}</span>
            <span id="obTeamArrow" style="margin-left:auto;font-size:10px;color:var(--lt)">▼</span>
          </label>
          <div id="obTeamPanel" style="display:none">
            <input class="form-control" id="obTeamSearch" placeholder="Search members…" oninput="window._filterObTeamOptions(this.value)" style="margin-bottom:6px;font-size:12px"/>
            <select class="form-control" id="obTeam" multiple size="5" style="font-size:12px">
              ${APP_STATE.teamMembers.map(m=>`<option value="${m.id}" ${sel.includes(m.id)?'selected':''}>${m.name} — ${m.role}</option>`).join('')}
            </select>
            <div style="font-size:11px;color:var(--lt);margin-top:4px">Hold Ctrl / Cmd to select multiple members</div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea class="form-control" id="obNotes">${p?.notes||''}</textarea>
        </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveOnboarding('${id||''}')">Save</button>
      </div>
    </div>
  </div>`);
}

window._filterObTeamOptions = function(q) {
  const sel = document.getElementById('obTeam');
  if (!sel) return;
  [...sel.options].forEach(o => { o.style.display = o.text.toLowerCase().includes(q.toLowerCase()) ? '' : 'none'; });
};

window.saveOnboarding = async function(id) {
  const data = { customerName: val('obCustomer'), track: val('obTrack'), phase: val('obPhase'), status: val('obStatus'), devLead: val('obLead'), jiraKey: val('obJira'), startDate: val('obStart'), endDate: val('obEnd'), progress: num('obProgress'), team: [...(document.getElementById('obTeam')?.selectedOptions||[])].map(o=>o.value), notes: val('obNotes') };
  if (!data.customerName) return alert('Customer name required');
  try {
    if (id) await DB.update('onboardingProjects', id, data);
    else await DB.add('onboardingProjects', data);
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

// ─── CAPACITY ─────────────────────────────────────────────
async function modalCapacity() {
  const members = APP_STATE.teamMembers;
  const projects = APP_STATE.projects;
  show(`<div class="mo" onclick="if(event.target===this)closeModal()">
    <div class="mo-box lg">
      <div class="mo-hdr">
        <span class="mo-title">Edit Capacity Allocations</span>
        <button class="mo-close" onclick="closeModal()">×</button>
      </div>
      <div class="mo-body">
        <div style="font-size:12px;color:var(--lt);margin-bottom:14px">Set allocation % per team member per project. Total should not exceed member availability.</div>
        ${members.map(m=>`
        <div class="card" style="margin-bottom:12px;padding:14px">
          <div style="font-weight:700;color:var(--navy);margin-bottom:10px">${m.name} <span style="font-size:11px;color:var(--lt)">(Available: ${m.availability||100}%)</span></div>
          ${projects.map(p=>`
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <label style="flex:1;font-size:13px;color:var(--text)">${p.name}</label>
            <input type="number" class="form-control" style="width:80px" min="0" max="100" value="${(m.allocations||{})[p.id]||0}" id="alloc-${m.id}-${p.id}"/>
            <span style="font-size:11px;color:var(--lt)">%</span>
          </div>`).join('')}
        </div>`).join('')}
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveCapacity()">Save Allocations</button>
      </div>
    </div>
  </div>`);
}

window.saveCapacity = async function() {
  const members = APP_STATE.teamMembers;
  const projects = APP_STATE.projects;
  try {
    for (const m of members) {
      const allocations = {};
      for (const p of projects) {
        const el = document.getElementById(`alloc-${m.id}-${p.id}`);
        allocations[p.id] = parseInt(el?.value||0);
      }
      await DB.update('teamMembers', m.id, { allocations });
    }
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

// ─── TRACK MODALS ─────────────────────────────────────────
async function modalTrack(id) {
  const t = id ? APP_STATE.tracks.find(x=>x.id===id) : null;
  show(`<div class="mo" onclick="if(event.target===this)closeModal()">
    <div class="mo-box">
      <div class="mo-hdr">
        <span class="mo-title">${t ? 'Edit Track' : 'Add Track'}</span>
        <button class="mo-close" onclick="closeModal()">×</button>
      </div>
      <div class="mo-body">
        <div class="form-group">
          <label class="form-label">Track Name *</label>
          <input class="form-control" id="tName" value="${t?.name||''}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <input class="form-control" id="tDesc" value="${t?.description||''}"/>
        </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="saveTrack('${id||''}')">Save</button>
      </div>
    </div>
  </div>`);
}

window.saveTrack = async function(id) {
  const data = { name: val('tName'), description: val('tDesc') };
  if (!data.name) return alert('Name required');
  try {
    if (id) await DB.update('tracks', id, data);
    else await DB.add('tracks', data);
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

async function modalAssignTrackProject(trackId, trackName) {
  const projects = APP_STATE.projects.filter(p=>p.track!==trackName);
  show(`<div class="mo" onclick="if(event.target===this)closeModal()">
    <div class="mo-box">
      <div class="mo-hdr"><span class="mo-title">Assign Project to ${trackName}</span><button class="mo-close" onclick="closeModal()">×</button></div>
      <div class="mo-body">
        <div class="form-group">
          <label class="form-label">Project</label>
          <select class="form-control" id="assignProjId">
            <option value="">—</option>
            ${projects.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="doAssignProject('${trackName}')">Assign</button>
      </div>
    </div>
  </div>`);
}

window.doAssignProject = async function(trackName) {
  const projId = val('assignProjId');
  if (!projId) return alert('Select a project');
  try {
    await DB.update('projects', projId, { track: trackName });
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

async function modalAssignTrackMember(trackId, trackName) {
  const members = APP_STATE.teamMembers.filter(m=>m.track!==trackName);
  show(`<div class="mo" onclick="if(event.target===this)closeModal()">
    <div class="mo-box">
      <div class="mo-hdr"><span class="mo-title">Assign Member to ${trackName}</span><button class="mo-close" onclick="closeModal()">×</button></div>
      <div class="mo-body">
        <div class="form-group">
          <label class="form-label">Team Member</label>
          <select class="form-control" id="assignMemberId">
            <option value="">—</option>
            ${members.map(m=>`<option value="${m.id}">${m.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" onclick="doAssignMember('${trackName}')">Assign</button>
      </div>
    </div>
  </div>`);
}

window.doAssignMember = async function(trackName) {
  const memId = val('assignMemberId');
  if (!memId) return alert('Select a member');
  try {
    await DB.update('teamMembers', memId, { track: trackName });
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

// ─── RESOURCE DAY MODAL (multi-track per day) ─────────────
async function modalResourceDay(memberId, date) {
  const member = APP_STATE.teamMembers.find(m => m.id === memberId);
  const existing = APP_STATE.resources.filter(r => r.memberId === memberId && r.date === date);
  const tracks = APP_STATE.settings.trackNames || ['Track 1','Track 2','Track 3'];
  const trackColors = {'Track 1':'#1B2B5E','Track 2':'#00A896','Track 3':'#E8452C'};

  show(`<div class="mo" onclick="if(event.target===this)closeModal()">
    <div class="mo-box">
      <div class="mo-hdr">
        <span class="mo-title">Log Hours — ${member ? member.name : 'Member'}</span>
        <button class="mo-close" onclick="closeModal()">×</button>
      </div>
      <div class="mo-body">
      <div style="font-size:13px;color:var(--lt);margin-bottom:16px">
        📅 ${new Date(date).toLocaleDateString('en-GB', {weekday:'long', day:'2-digit', month:'long', year:'numeric'})}
      </div>

      ${existing.length > 0 ? `
      <div style="margin-bottom:16px">
        <div class="form-label">Existing Logs</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${existing.map(log => `
          <div style="display:flex;align-items:center;gap:8px;background:${trackColors[log.track]||'#1B2B5E'}10;border:1px solid ${trackColors[log.track]||'#1B2B5E'}30;border-radius:7px;padding:8px 12px">
            <div style="width:8px;height:8px;border-radius:50%;background:${trackColors[log.track]||'#1B2B5E'};flex-shrink:0"></div>
            <span style="font-size:13px;font-weight:700;color:${trackColors[log.track]||'#1B2B5E'}">${log.hours}h</span>
            <span style="font-size:13px;flex:1">${log.track||'—'}</span>
            ${log.activity ? `<span style="font-size:11px;color:var(--lt)">${log.activity}</span>` : ''}
            <button class="btn btn-danger btn-xs" onclick="deleteResourceLog('${log.id}','${memberId}','${date}')">🗑</button>
          </div>`).join('')}
        </div>
        <div style="font-size:12px;color:var(--lt);margin-top:6px">
          Total: <strong>${existing.reduce((s,r)=>s+(parseFloat(r.hours)||0),0)}h</strong> logged today
        </div>
      </div>
      <hr class="divider"/>` : ''}

      <div class="form-label">Add New Entry</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Track *</label>
          <select class="form-control" id="rdTrack">
            <option value="">Select track…</option>
            ${tracks.map(t => `<option value="${t}" ${member?.track===t?'selected':''}>${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Hours *</label>
          <input type="number" class="form-control" id="rdHours" min="0.5" max="16" step="0.5" value="8" placeholder="e.g. 4"/>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Activity / Project</label>
        <input class="form-control" id="rdActivity" placeholder="e.g. API development, Sprint planning…"/>
      </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal()">Close</button>
        <button class="btn btn-primary" onclick="saveResourceDay('${memberId}','${date}')">+ Add Entry</button>
      </div>
    </div>
  </div>`);
}

window.saveResourceDay = async function(memberId, date) {
  const track    = document.getElementById('rdTrack')?.value;
  const hours    = parseFloat(document.getElementById('rdHours')?.value);
  const activity = document.getElementById('rdActivity')?.value?.trim() || '';

  if (!track)         return alert('Please select a track');
  if (!hours || hours <= 0) return alert('Please enter valid hours');

  try {
    await DB.add('resources', { memberId, date, track, hours, activity });
    // Re-open modal to show updated list
    openModal('resourceDay', memberId, date);
  } catch(e) { alert('Error: ' + e.message); }
};

window.deleteResourceLog = async function(logId, memberId, date) {
  if (!confirm('Delete this log entry?')) return;
  try {
    await DB.remove('resources', logId);
    openModal('resourceDay', memberId, date);
  } catch(e) { alert('Error: ' + e.message); }
};
// ============================================================
// PLEDGE MODAL
// ============================================================
async function openPledgeModal(id) {
  const pledge = id ? APP_STATE.pledges.find(p => p.id === id) : null;
  const projects = APP_STATE.projects || [];
  const isEdit = !!pledge;

  const html = `<div class="mo" id="pledgeMo">
    <div class="mo-box">
      <div class="mo-hdr">
        <span class="mo-title">${isEdit ? 'Edit Pledge' : 'New Pledge'}</span>
        <button class="mo-close" onclick="closeModal('pledgeMo')">×</button>
      </div>
      <div class="mo-body">
        <div class="form-row">
          <div class="form-group form-row-full">
            <label class="form-label">Commitment Title *</label>
            <input id="pl-title" class="form-control" placeholder="What was committed?" value="${pledge?.title||''}"/>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Customer / Stakeholder *</label>
            <input id="pl-customer" class="form-control" placeholder="Customer or org name" value="${pledge?.customer||''}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Owner</label>
            <input id="pl-owner" class="form-control" placeholder="Who is accountable?" value="${pledge?.owner||''}"/>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Due Date *</label>
            <input id="pl-due" type="date" class="form-control" value="${pledge?.dueDate||''}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Linked Project</label>
            <select id="pl-project" class="form-control">
              <option value="">— None —</option>
              ${projects.map(p => `<option value="${p.id}" ${pledge?.linkedProjectId===p.id?'selected':''}>${p.name}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Priority</label>
            <select id="pl-priority" class="form-control">
              ${['Critical','High','Medium','Low'].map(o => `<option ${pledge?.priority===o?'selected':''}>${o}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select id="pl-status" class="form-control">
              ${['On Track','At Risk','Breached','Honored'].map(o => `<option ${pledge?.status===o?'selected':''}>${o}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Notes / Context</label>
          <textarea id="pl-notes" class="form-control" placeholder="Any additional context or context quote…">${pledge?.notes||''}</textarea>
        </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal('pledgeMo')">Cancel</button>
        <button class="btn btn-primary" onclick="savePledge('${id||''}')">
          ${isEdit ? 'Save Changes' : 'Add Pledge'}
        </button>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

async function savePledge(id) {
  const data = {
    title:           document.getElementById('pl-title')?.value?.trim() || '',
    customer:        document.getElementById('pl-customer')?.value?.trim() || '',
    owner:           document.getElementById('pl-owner')?.value?.trim() || '',
    dueDate:         document.getElementById('pl-due')?.value || '',
    linkedProjectId: document.getElementById('pl-project')?.value || '',
    priority:        document.getElementById('pl-priority')?.value || 'Medium',
    status:          document.getElementById('pl-status')?.value || 'On Track',
    notes:           document.getElementById('pl-notes')?.value?.trim() || '',
    updatedAt:       new Date().toISOString().split('T')[0]
  };

  if (!data.title) { alert('Please enter a commitment title.'); return; }
  if (!data.dueDate) { alert('Please set a due date.'); return; }

  try {
    if (id) {
      await DB.update('pledges', id, data);
    } else {
      data.createdAt = new Date().toISOString().split('T')[0];
      await DB.add('pledges', data);
    }
    closeModal('pledgeMo');
    if (typeof showToast !== 'undefined') showToast(id ? 'Pledge updated' : 'Pledge added');
  } catch(e) {
    alert('Error saving pledge: ' + e.message);
  }
}

// Make available globally
window.savePledge = savePledge;

// ============================================================
// KNOWLEDGE MODAL
// ============================================================
async function openKnowledgeModal(id) {
  const doc = id ? APP_STATE.knowledge?.find(d => d.id === id) : null;
  const projects = APP_STATE.projects || [];

  const html = `<div class="mo" id="knowledgeMo">
    <div class="mo-box">
      <div class="mo-hdr">
        <span class="mo-title">${doc ? 'Edit Document' : 'New Document'}</span>
        <button class="mo-close" onclick="closeModal('knowledgeMo')">×</button>
      </div>
      <div class="mo-body">
        <div class="form-group">
          <label class="form-label">Title *</label>
          <input id="kn-title" class="form-control" placeholder="Document title" value="${doc?.title||''}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Content</label>
          <textarea id="kn-content" class="form-control" style="min-height:120px" placeholder="Document content, notes, or reference material…">${doc?.content||''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tags (comma separated)</label>
            <input id="kn-tags" class="form-control" placeholder="e.g. SOP, QA, Process" value="${doc?.tags||''}"/>
          </div>
          <div class="form-group">
            <label class="form-label">Linked Project</label>
            <select id="kn-project" class="form-control">
              <option value="">— None —</option>
              ${projects.map(p => `<option value="${p.id}" ${doc?.linkedProjectId===p.id?'selected':''}>${p.name}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal('knowledgeMo')">Cancel</button>
        <button class="btn btn-primary" onclick="saveKnowledge('${id||''}')">
          ${doc ? 'Save Changes' : 'Add Document'}
        </button>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

async function openKnowledgeViewModal(id) {
  const doc = APP_STATE.knowledge?.find(d => d.id === id);
  if (!doc) return;
  const tags = (doc.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  const proj = APP_STATE.projects?.find(p => p.id === doc.linkedProjectId);

  const html = `<div class="mo" id="knowledgeViewMo">
    <div class="mo-box lg">
      <div class="mo-hdr">
        <span class="mo-title">${doc.title}</span>
        <button class="mo-close" onclick="closeModal('knowledgeViewMo')">×</button>
      </div>
      <div class="mo-body">
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
          ${tags.map(t => `<span class="doc-tag">${t}</span>`).join('')}
          ${proj ? `<span class="badge badge-navy">${proj.name}</span>` : ''}
        </div>
        <div style="font-size:13px;color:var(--text);line-height:1.8;white-space:pre-wrap">${doc.content || '—'}</div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="closeModal('knowledgeViewMo')">Close</button>
        <button class="btn btn-primary" onclick="closeModal('knowledgeViewMo');openModal('knowledge','${id}')">Edit</button>
      </div>
    </div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);
}

async function saveKnowledge(id) {
  const data = {
    title:           document.getElementById('kn-title')?.value?.trim() || '',
    content:         document.getElementById('kn-content')?.value?.trim() || '',
    tags:            document.getElementById('kn-tags')?.value?.trim() || '',
    linkedProjectId: document.getElementById('kn-project')?.value || '',
    updatedAt:       new Date().toISOString().split('T')[0]
  };

  if (!data.title) { alert('Please enter a title.'); return; }

  try {
    if (id) {
      await DB.update('knowledge', id, data);
    } else {
      data.createdAt = new Date().toISOString().split('T')[0];
      await DB.add('knowledge', data);
    }
    closeModal('knowledgeMo');
    if (typeof showToast !== 'undefined') showToast(id ? 'Document updated' : 'Document added');
  } catch(e) {
    alert('Error saving document: ' + e.message);
  }
}

window.saveKnowledge = saveKnowledge;
