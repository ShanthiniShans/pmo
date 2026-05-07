// ============================================================
// MODALS.JS — All CRUD Forms
// ============================================================
import { APP_STATE, DB, DateHelpers } from './data.js';

// ─── MODAL ENGINE ─────────────────────────────────────────
function show(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)closeModal()">${html}</div>`;
}

export function closeModal() {
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
    case 'assignTrackProject': return modalAssignTrackProject(id, extra);
    case 'assignTrackMember':  return modalAssignTrackMember(id, extra);
    case 'pledge':             return modalPledge(id);
    case 'knowledge':          return modalKnowledge(id);
    case 'importPreview':      return modalImportPreview(id, extra);
    default: console.warn('Unknown modal type:', type);
  }
}

// ─── PROJECT ──────────────────────────────────────────────
async function modalProject(id) {
  const p = id ? APP_STATE.projects.find(x=>x.id===id) : null;
  show(`<div class="modal modal-lg">
    <div class="modal-header">
      <div class="modal-title">${p ? 'Edit Project' : 'New Project'}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group" style="grid-column:1/-1">
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
        <label class="form-label">Team Members</label>
        <div class="checkbox-group">${memberCheckboxes(p?.team)}</div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveProject('${id||''}')">Save Project</button>
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
    team: checkedVals('team')
  };
  if (!data.name) return alert('Project name is required');
  try {
    if (id) await DB.update('projects', id, data);
    else await DB.add('projects', data);
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

// ─── MILESTONE ────────────────────────────────────────────
async function modalMilestone(id, projectId) {
  const m = id ? APP_STATE.milestones.find(x=>x.id===id) : null;
  const statusOpts = ['On Track','At Risk','Overdue','Completed','Yet to Start'];
  show(`<div class="modal">
    <div class="modal-header">
      <div class="modal-title">${m ? 'Edit Milestone' : 'New Milestone'}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
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
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveMilestone('${id||''}')">Save</button>
    </div>
  </div>`);
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
    notes: val('msNotes')
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
  show(`<div class="modal">
    <div class="modal-header">
      <div class="modal-title">${m ? 'Edit Team Member' : 'Add Team Member'}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
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
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveTeamMember('${id||''}')">Save</button>
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
  show(`<div class="modal">
    <div class="modal-header">
      <div class="modal-title">${r ? 'Edit Risk' : 'Add Risk'}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
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
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveRisk('${id||''}')">Save</button>
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
  show(`<div class="modal">
    <div class="modal-header">
      <div class="modal-title">${e ? 'Edit Escalation' : 'Add Escalation'}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
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
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveEscalation('${id||''}')">Save</button>
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
  show(`<div class="modal modal-lg">
    <div class="modal-header">
      <div class="modal-title">${c ? 'Edit Charter' : 'New Charter'}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
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
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveCharter('${id||''}')">Save Charter</button>
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
  show(`<div class="modal">
    <div class="modal-header">
      <div class="modal-title">${i ? 'Edit Impact' : 'Add Impact'}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
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
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveImpact('${id||''}')">Save</button>
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
  show(`<div class="modal modal-lg">
    <div class="modal-header">
      <div class="modal-title">${w ? 'Edit Workflow' : 'New Workflow'}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Workflow Name *</label>
        <input class="form-control" id="wfName" value="${w?.name||''}"/>
      </div>
      <div style="margin-top:8px">
        <div class="flex-center gap-8 mb-8">
          <div class="form-label flex-1">Steps</div>
          <button class="btn btn-ghost btn-sm" onclick="addWfStep()">+ Add Step</button>
        </div>
        <div id="wfSteps">
          ${steps.map((s,i)=>wfStepRow(s,i)).join('')}
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveWorkflow('${id||''}')">Save</button>
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
  show(`<div class="modal">
    <div class="modal-header">
      <div class="modal-title">Log Hours</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
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
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveResource('${existing?.id||''}')">Save</button>
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
  show(`<div class="modal">
    <div class="modal-header">
      <div class="modal-title">Notes & Comments</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="notes-feed mb-16">
        ${existing.length ? existing.map(n=>`
          <div class="note-item">
            <div><span class="note-author">${n.author||'PM'}</span><span class="note-date">${DateHelpers.fmt(n.date)}</span></div>
            <div class="note-text">${n.text}</div>
          </div>`).join('') : '<div class="small text-lt">No notes yet</div>'}
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
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="saveNote('${entityId}','${entityType}')">Add Note</button>
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
  show(`<div class="modal modal-lg">
    <div class="modal-header">
      <div class="modal-title">${p ? 'Edit Onboarding Project' : 'New Onboarding Project'}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Customer Name *</label>
          <input class="form-control" id="obCustomer" value="${p?.customerName||''}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Project Name *</label>
          <input class="form-control" id="obName" value="${p?.name||''}"/>
        </div>
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
        <label class="form-label">Team Members</label>
        <div class="checkbox-group">${memberCheckboxes(p?.team)}</div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-control" id="obNotes">${p?.notes||''}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveOnboarding('${id||''}')">Save</button>
    </div>
  </div>`);
}

window.saveOnboarding = async function(id) {
  const data = { customerName: val('obCustomer'), name: val('obName'), track: val('obTrack'), phase: val('obPhase'), status: val('obStatus'), devLead: val('obLead'), jiraKey: val('obJira'), startDate: val('obStart'), endDate: val('obEnd'), progress: num('obProgress'), team: checkedVals('team'), notes: val('obNotes') };
  if (!data.name || !data.customerName) return alert('Customer and project name required');
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
  show(`<div class="modal modal-lg">
    <div class="modal-header">
      <div class="modal-title">Edit Capacity Allocations</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="small text-lt mb-16">Set allocation % per team member per project. Total should not exceed member availability.</div>
      ${members.map(m=>`
      <div class="card" style="margin-bottom:12px;padding:14px">
        <div style="font-weight:700;color:var(--navy);margin-bottom:10px">${m.name} <span class="small text-lt">(Available: ${m.availability||100}%)</span></div>
        ${projects.map(p=>`
        <div class="alloc-row">
          <label style="flex:1;font-size:13px">${p.name}</label>
          <input type="number" class="form-control" style="width:80px" min="0" max="100" value="${(m.allocations||{})[p.id]||0}" id="alloc-${m.id}-${p.id}"/>
          <span class="small text-lt">%</span>
        </div>`).join('')}
      </div>`).join('')}
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveCapacity()">Save Allocations</button>
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
  show(`<div class="modal">
    <div class="modal-header">
      <div class="modal-title">${t ? 'Edit Track' : 'Add Track'}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Track Name *</label>
        <input class="form-control" id="tName" value="${t?.name||''}"/>
      </div>
      <div class="form-group">
        <label class="form-label">Description</label>
        <input class="form-control" id="tDesc" value="${t?.description||''}"/>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveTrack('${id||''}')">Save</button>
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
  show(`<div class="modal">
    <div class="modal-header"><div class="modal-title">Assign Project to ${trackName}</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Project</label>
        <select class="form-control" id="assignProjId">
          <option value="">—</option>
          ${projects.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="doAssignProject('${trackName}')">Assign</button>
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
  show(`<div class="modal">
    <div class="modal-header"><div class="modal-title">Assign Member to ${trackName}</div><button class="modal-close" onclick="closeModal()">×</button></div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Team Member</label>
        <select class="form-control" id="assignMemberId">
          <option value="">—</option>
          ${members.map(m=>`<option value="${m.id}">${m.name}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="doAssignMember('${trackName}')">Assign</button>
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

  show(`<div class="modal">
    <div class="modal-header">
      <div class="modal-title">Log Hours — ${member ? member.name : 'Member'}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div style="font-size:13px;color:var(--text-lt);margin-bottom:16px">
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
            ${log.activity ? `<span style="font-size:11px;color:var(--text-lt)">${log.activity}</span>` : ''}
            <button class="btn btn-icon danger btn-xs" onclick="deleteResourceLog('${log.id}','${memberId}','${date}')">🗑</button>
          </div>`).join('')}
        </div>
        <div style="font-size:12px;color:var(--text-lt);margin-top:6px">
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
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="saveResourceDay('${memberId}','${date}')">+ Add Entry</button>
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

// ─── PLEDGE ───────────────────────────────────────────────
async function modalPledge(id) {
  const pl = id ? (APP_STATE.pledges||[]).find(x=>x.id===id) : null;
  show(`<div class="modal modal-lg">
    <div class="modal-header">
      <div class="modal-title">${pl ? 'Edit Commitment' : 'New Commitment'}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Customer *</label>
          <input class="form-control" id="plCustomer" value="${pl?.customer||''}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Commitment Title *</label>
          <input class="form-control" id="plTitle" value="${pl?.title||''}"/>
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Due Date</label>
          <input type="date" class="form-control" id="plDue" value="${pl?.dueDate||''}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Owner</label>
          <input class="form-control" id="plOwner" value="${pl?.owner||''}"/>
        </div>
        <div class="form-group">
          <label class="form-label">Linked Project</label>
          <select class="form-control" id="plProject">
            <option value="">—</option>
            ${APP_STATE.projects.map(p=>`<option value="${p.id}" ${pl?.linkedProjectId===p.id?'selected':''}>${p.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Status</label>
          <select class="form-control" id="plStatus">
            ${['On Track','At Risk','Breached'].map(s=>`<option value="${s}" ${(pl?.status||'On Track')===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Priority</label>
          <select class="form-control" id="plPriority">
            ${['High','Medium','Low'].map(p=>`<option value="${p}" ${(pl?.priority||'Medium')===p?'selected':''}>${p}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notes</label>
        <textarea class="form-control" id="plNotes">${pl?.notes||''}</textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePledge('${id||''}')">Save Commitment</button>
    </div>
  </div>`);
}

window.savePledge = async function(id) {
  const data = {
    customer: val('plCustomer'), title: val('plTitle'),
    dueDate: val('plDue'), owner: val('plOwner'),
    linkedProjectId: val('plProject'),
    status: val('plStatus'), priority: val('plPriority'),
    notes: val('plNotes')
  };
  if (!data.customer || !data.title) return alert('Customer and title required');
  try {
    if (id) await DB.update('pledges', id, data);
    else await DB.add('pledges', data);
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

// ─── KNOWLEDGE ────────────────────────────────────────────
async function modalKnowledge(id) {
  const d = id ? (APP_STATE.documents||[]).find(x=>x.id===id) : null;
  show(`<div class="modal modal-lg">
    <div class="modal-header">
      <div class="modal-title">${d ? 'Edit Document' : 'New Document'}</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input class="form-control" id="kbTitle" value="${d?.title||''}"/>
      </div>
      <div class="form-group">
        <label class="form-label">Content</label>
        <textarea class="form-control" id="kbContent" style="min-height:160px">${d?.content||''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Tags (comma-separated)</label>
          <input class="form-control" id="kbTags" value="${d?.tags||''}" placeholder="e.g. onboarding, api, process"/>
        </div>
        <div class="form-group">
          <label class="form-label">Linked Project</label>
          <select class="form-control" id="kbProject">
            <option value="">—</option>
            ${APP_STATE.projects.map(p=>`<option value="${p.id}" ${d?.linkedProjectId===p.id?'selected':''}>${p.name}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="saveKnowledge('${id||''}')">Save Document</button>
    </div>
  </div>`);
}

window.saveKnowledge = async function(id) {
  const data = {
    title: val('kbTitle'), content: val('kbContent'),
    tags: val('kbTags'), linkedProjectId: val('kbProject'),
    updatedAt: new Date().toISOString().split('T')[0]
  };
  if (!data.title) return alert('Title required');
  try {
    if (id) await DB.update('documents', id, data);
    else await DB.add('documents', data);
    closeModal();
  } catch(e) { alert('Error: '+e.message); }
};

// ─── IMPORT PREVIEW ───────────────────────────────────────
async function modalImportPreview(key, rawRows) {
  const rows = Array.isArray(rawRows) ? rawRows : [];
  const preview = rows.slice(0, 20);
  const headers = preview.length > 0 ? Object.keys(preview[0]) : [];

  show(`<div class="modal modal-lg">
    <div class="modal-header">
      <div class="modal-title">Import Preview — ${rows.length} row${rows.length!==1?'s':''} found</div>
      <button class="modal-close" onclick="closeModal()">×</button>
    </div>
    <div class="modal-body">
      <div class="small text-lt" style="margin-bottom:12px">
        Showing ${Math.min(preview.length,20)} of ${rows.length} rows.
        ${rows.length>20?'All rows will be imported.':''}
      </div>
      <div style="overflow:auto;max-height:340px;border:1px solid var(--border);border-radius:var(--rs)">
        <table class="import-preview-table">
          <thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>
          <tbody>
            ${preview.map(row=>`<tr>${headers.map(h=>`<td title="${(row[h]||'').toString().replace(/"/g,'&quot;')}">${(row[h]||'').toString().slice(0,40)}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" onclick="doImport('${key}')">Import ${rows.length} item${rows.length!==1?'s':''}</button>
    </div>
  </div>`);
}

window.doImport = async function(key) {
  const rows = window._importRows || [];
  const collection = window._importCollection || key;
  if (!rows.length) { closeModal(); return; }
  try {
    for (const row of rows) {
      await DB.add(collection, row);
    }
    closeModal();
    window._showToast && window._showToast(`${rows.length} item${rows.length!==1?'s':''} imported successfully`);
  } catch(e) { alert('Import error: ' + e.message); }
};