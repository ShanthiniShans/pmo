// ============================================================
// APP.JS — Router, Global Handlers, Init
// ============================================================
import { initData, APP_STATE, DB, DateHelpers } from './data.js';
import { openModal, closeModal } from './modals.js';
import {
  renderDashboard, renderTracks, renderRoadmap, renderMilestones,
  renderProjects, renderProjectDetail, renderOnboarding, renderOnboardingDetail, renderWorkflows,
  renderTeam, renderCapacityResources, renderCapacity, renderResources,
  renderRisks, renderEscalations,
  renderLeadership, renderImpacts, renderCharters, renderSettings,
  renderPledges, renderKnowledge
} from './views.js';

// ─── VIEW MAP ─────────────────────────────────────────────
const VIEWS = {
  dashboard:        { title: '', render: renderDashboard },
  roadmap:          { title: '', render: renderRoadmap },
  tracks:           { title: '', render: renderTracks },
  pledges:          { title: '', render: renderPledges },
  projects:         { title: '', render: renderProjects },
  'project-detail': { title: '', render: renderProjectDetail },
  milestones:       { title: '', render: renderMilestones },
  onboarding:          { title: '', render: renderOnboarding },
  'onboarding-detail': { title: '', render: (params) => renderOnboardingDetail(params) },
  workflows:        { title: '', render: renderWorkflows },
  team:             { title: '', render: renderTeam },
  capacity:         { title: '', render: renderCapacityResources },
  resources:        { title: '', render: renderCapacityResources },
  risks:            { title: '', render: renderRisks },
  escalations:      { title: '', render: renderEscalations },
  leadership:       { title: '', render: renderLeadership },
  impacts:          { title: '', render: renderImpacts },
  charters:         { title: '', render: renderCharters },
  knowledge:        { title: '', render: renderKnowledge },
  settings:         { title: '', render: renderSettings },
};

// ─── NAV ──────────────────────────────────────────────────
async function navigateTo(view, params) {
  const v = VIEWS[view];
  if (!v) return;

  // Reset filters when switching to a different view (not same-view tab switching)
  if (view !== APP_STATE.currentView) {
    APP_STATE.filters = { year: new Date().getFullYear(), quarter: '', month: '', track: '', startDate: '', endDate: '' };
  }

  APP_STATE.currentView = view;
  APP_STATE.currentParams = params || {};
  localStorage.setItem('klarion_view', view);
  localStorage.setItem('klarion_params', JSON.stringify(params || {}));

  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(el => {
    const onclick = el.getAttribute('onclick') || '';
    el.classList.toggle('active', onclick.includes(`'${view}'`));
  });

  // Update topbar title
  const titleEl = document.getElementById('topBarTitle');
  if (titleEl) titleEl.textContent = v.title;

  // Update timestamp
  const ts = document.getElementById('topTimestamp');
  if (ts) ts.textContent = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  // Render
  const content = document.getElementById('content');
  content.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const html = await Promise.resolve(v.render(params));
    content.innerHTML = html;
  } catch(e) {
    content.innerHTML = `<div class="empty" style="padding:60px"><div class="empty-icon">⚠️</div><div style="font-size:13px;color:#ef4444;font-weight:600">Error: ${e.message}</div></div>`;
    console.error(e);
  }
}

// ─── GLOBAL FUNCTIONS ─────────────────────────────────────
window.nav = navigateTo;
window._nav = navigateTo;
window.openModal = openModal;
window.closeModal = closeModal;

window.deleteItem = async function(collection, id) {
  if (!confirm('Delete this item? This cannot be undone.')) return;
  try {
    await DB.remove(collection, id);
  } catch(e) { alert('Error deleting: ' + e.message); }
};

window.markMilestoneComplete = async function(id) {
  try {
    await DB.update('milestones', id, { status: 'Completed', completedDate: DateHelpers.today() });
  } catch(e) { alert('Error: ' + e.message); }
};

// ─── ALLOC FILTER ─────────────────────────────────────────
window.setAllocFilter = function(key, value) {
  APP_STATE[key] = value;
  navigateTo(APP_STATE.currentView, APP_STATE.currentParams);
};

window.toggleMemberExpand = function(memberId) {
  APP_STATE._expandedMember = APP_STATE._expandedMember === memberId ? null : memberId;
  navigateTo(APP_STATE.currentView, APP_STATE.currentParams);
};

// ─── MILESTONE FILTER ────────────────────────────────────
window.setMsFilter = function(key, value) {
  APP_STATE[key] = value;
  navigateTo(APP_STATE.currentView, APP_STATE.currentParams);
};

// ─── FILTER HANDLERS ──────────────────────────────────────
window._filterChange = function(key, value) {
  APP_STATE.filters[key] = value === '' ? '' : (key === 'year' ? parseInt(value) : value);
  navigateTo(APP_STATE.currentView, APP_STATE.currentParams);
};

window._filterReset = function() {
  APP_STATE.filters = { year: 2026, quarter: '', month: '', track: '', startDate: '', endDate: '' };
  navigateTo(APP_STATE.currentView, APP_STATE.currentParams);
};

// ─── SETTINGS HANDLERS ────────────────────────────────────
window.switchSettingsTab = function(tab, el) {
  document.querySelectorAll('[id^="settingsTab-"]').forEach(d => d.style.display = 'none');
  document.querySelectorAll('.settings-tab, .admin-tab').forEach(t => t.classList.remove('active'));
  const panel = document.getElementById(`settingsTab-${tab}`);
  if (panel) panel.style.display = '';
  if (el) el.classList.add('active');
};

window.addDropdownItem = function(key) {
  if (!APP_STATE.settings[key]) APP_STATE.settings[key] = [];
  APP_STATE.settings[key].push('New Option');
  navigateTo('settings');
};

window.updateDropdownItem = function(key, idx, value) {
  if (!APP_STATE.settings[key]) return;
  APP_STATE.settings[key][idx] = value;
};

window.removeDropdownItem = function(key, idx) {
  if (!APP_STATE.settings[key]) return;
  APP_STATE.settings[key].splice(idx, 1);
  navigateTo('settings');
};

window.saveSettings = async function() {
  try {
    await DB.set('settings', 'config', {
      statusOptions: APP_STATE.settings.statusOptions,
      phaseOptions: APP_STATE.settings.phaseOptions,
      priorityOptions: APP_STATE.settings.priorityOptions,
      trackNames: APP_STATE.settings.trackNames,
      jiraMappings: APP_STATE.settings.jiraMappings || []
    });
    showToast('Settings saved ✅');
  } catch(e) { alert('Error: ' + e.message); }
};

window.saveJiraConfig = function() {
  const baseUrl = document.getElementById('jira-baseUrl')?.value || '';
  const email   = document.getElementById('jira-email')?.value || '';
  const token   = document.getElementById('jira-token')?.value || '';
  localStorage.setItem('jira_baseUrl', baseUrl);
  localStorage.setItem('jira_email', email);
  localStorage.setItem('jira_token', token);
  showToast('Jira config saved ✅');
};

window.updateJiraMapping = async function(memberId, jiraId) {
  try {
    await DB.update('teamMembers', memberId, { jiraId });
  } catch(e) { console.error(e); }
};

window._setTeamTrack = function(track) {
  APP_STATE._teamTrackFilter = track;
  navigateTo('team');
};

window.changeWeek = function(direction) {
  if (direction === null) {
    APP_STATE._timeLogWeekOffset = 0;
  } else {
    const current = parseInt(APP_STATE._timeLogWeekOffset) || 0;
    const next = current + direction;
    if (next > 0) return;
    APP_STATE._timeLogWeekOffset = next;
  }
  navigateTo(APP_STATE.currentView, APP_STATE.currentParams);
};

window._resourceWeek = function(direction, mode) {
  if (mode === 'reset') {
    APP_STATE._resourceWeekOffset = 0;
  } else {
    const current = APP_STATE._resourceWeekOffset || 0;
    const next = current + direction;
    if (next > 0) return;
    APP_STATE._resourceWeekOffset = next;
  }
  navigateTo('capacity');
};

window.switchTab = function(stateKey, value) {
  APP_STATE[stateKey] = value;
  navigateTo(APP_STATE.currentView, APP_STATE.currentParams);
};

// ─── MILESTONE DRAWER ─────────────────────────────────────
window.openMilestoneDrawer = function(msId) {
  const m = APP_STATE.milestones.find(x => x.id === msId);
  if (!m) return;

  document.getElementById('ms-drawer-overlay')?.remove();
  document.getElementById('ms-drawer')?.remove();

  const tasks = m.tasks || [];
  const milestoneId = msId;
  function taskHtml(t, i) {
    const today = DateHelpers.today();
    const isOverdue = t.dueDate && t.dueDate < today && !t.done;
    const notePreview = t.notes ? (t.notes.length > 80 ? t.notes.slice(0,80)+'…' : t.notes) : '';
    return `<div class="task-row" id="task-row-${i}">
      <input type="checkbox" class="task-cb" ${t.done?'checked':''} onchange="toggleTask('${msId}',${i},this.checked)"/>
      <div class="task-info">
        <div class="task-name-text ${t.done?'done':''}">${t.name||t.text||''}</div>
        ${notePreview?`<div class="task-note-preview">${notePreview}</div>`:''}
        ${t.dueDate?`<div class="task-due ${isOverdue?'overdue':''}">📅 ${t.dueDate}</div>`:''}
        ${t.owner?`<div class="task-due">👤 ${t.owner}</div>`:''}
      </div>
      <div style="flex-shrink:0">
        <button class="btn-icon" style="font-size:11px" onclick="event.stopPropagation();window._editingTask='${t.id||i}';window.openMilestoneDrawer('${msId}')" title="Edit task">✏️</button>
      </div>
    </div>`;
  }
  function taskEditHtml(t, i) {
    const tid = t.id || ('ti'+i);
    const memberOpts = (APP_STATE.teamMembers||[]).map(m=>`<option value="${m.name||m.id}" ${t.owner===m.name||t.owner===m.id?'selected':''}>${m.name}</option>`).join('');
    return `<div class="task-row" id="task-row-${i}" style="flex-direction:column;align-items:stretch">
      <input class="form-control" id="te-name-${tid}" value="${(t.name||t.text||'').replace(/"/g,'&quot;')}" style="margin-bottom:5px;font-size:12px"/>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-bottom:5px">
        <input type="date" class="form-control" id="te-due-${tid}" value="${t.dueDate||''}"/>
        <select class="form-control" id="te-owner-${tid}"><option value="">Owner…</option>${memberOpts}</select>
      </div>
      <textarea class="form-control" id="te-notes-${tid}" placeholder="Notes…" style="min-height:50px;margin-bottom:6px;font-size:12px">${t.notes||''}</textarea>
      <div style="display:flex;gap:6px">
        <button class="btn btn-primary btn-xs" onclick="saveTaskEdit('${milestoneId}','${tid}',${i});event.stopPropagation()">Save</button>
        <button class="btn btn-ghost btn-xs" onclick="window._editingTask=null;window.openMilestoneDrawer('${milestoneId}');event.stopPropagation()">Cancel</button>
      </div>
    </div>`;
  }

  const overlay = document.createElement('div');
  overlay.className = 'drawer-overlay';
  overlay.id = 'ms-drawer-overlay';
  overlay.onclick = closeDrawer;
  document.body.appendChild(overlay);

  const drawer = document.createElement('div');
  drawer.className = 'ms-drawer';
  drawer.id = 'ms-drawer';
  drawer.innerHTML = `
    <div class="ms-drawer-hdr">
      <div>
        <div class="ms-drawer-title">${m.title}</div>
        <div class="ms-drawer-meta">${m.projectName||''} ${m.dueDate?'· 📅 '+DateHelpers.fmt(m.dueDate):''}</div>
      </div>
      <button style="border:none;background:none;font-size:20px;cursor:pointer;color:var(--mid);line-height:1" onclick="closeDrawer()">×</button>
    </div>
    <div class="ms-drawer-body">
      <div id="drawer-task-list">${tasks.length ? tasks.map((t,i)=>{
        const tid = t.id || ('ti'+i);
        return (window._editingTask === tid || window._editingTask === String(i)) ? taskEditHtml(t,i) : taskHtml(t,i);
      }).join('') : '<div style="font-size:12px;color:var(--lt);padding:8px 0">No tasks yet</div>'}</div>
      <div class="add-task-form">
        <div style="font-size:11px;font-weight:700;color:var(--lt);text-transform:uppercase;margin-bottom:8px">Add Task</div>
        <input class="form-control" id="drawer-task-name" placeholder="Task name…" style="margin-bottom:6px;font-size:12px"/>
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <input type="date" class="form-control" id="drawer-task-due" style="font-size:12px;flex:1"/>
          <select class="form-control" id="drawer-task-owner" style="font-size:12px;flex:1">
            <option value="">Owner (optional)</option>
            ${(APP_STATE.teamMembers||[]).sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(m=>'<option value="'+(m.name||m.id)+'">'+(m.name||'Unknown')+'</option>').join('')}
          </select>
        </div>
        <input class="form-control" id="drawer-task-notes" placeholder="Notes (optional)…" style="margin-bottom:8px;font-size:12px"/>
        <button class="btn btn-primary btn-sm" style="width:100%" onclick="addTaskToMilestone('${msId}')">+ Add Task</button>
      </div>
    </div>`;
  document.body.appendChild(drawer);

  requestAnimationFrame(() => {
    overlay.classList.add('show');
    drawer.classList.add('open');
  });
};

window.closeDrawer = function() {
  const drawer  = document.getElementById('ms-drawer');
  const overlay = document.getElementById('ms-drawer-overlay');
  if (drawer)  { drawer.classList.remove('open'); }
  if (overlay) { overlay.classList.remove('show'); }
  setTimeout(() => {
    drawer?.remove();
    overlay?.remove();
  }, 260);
};

window.addTaskToMilestone = async function(msId) {
  const name  = document.getElementById('drawer-task-name')?.value.trim();
  if (!name) return;
  const due   = document.getElementById('drawer-task-due')?.value || '';
  const owner = document.getElementById('drawer-task-owner')?.value.trim() || '';
  const notes = document.getElementById('drawer-task-notes')?.value.trim() || '';

  const m = APP_STATE.milestones.find(x => x.id === msId);
  if (!m) return;
  const newTask = { id: 't'+Date.now(), name, done: false, dueDate: due, owner, notes };
  const tasks = [...(m.tasks||[]), newTask];
  m.tasks = tasks;

  const card = document.querySelector(`.ms-card[data-ms-id="${msId}"] .ms-task-progress-fill`);
  if (card) {
    const done = tasks.filter(t=>t.done).length;
    card.style.width = Math.round(done/tasks.length*100)+'%';
  }

  try {
    await DB.update('milestones', msId, { tasks });
    window.openMilestoneDrawer(msId);
  } catch(e) { alert('Error: '+e.message); }
};

window.toggleTask = async function(msId, idx, done) {
  const m = APP_STATE.milestones.find(x => x.id === msId);
  if (!m || !m.tasks) return;
  m.tasks[idx] = { ...m.tasks[idx], done };

  const nameEl = document.querySelector(`#task-row-${idx} .task-name-text`);
  if (nameEl) nameEl.classList.toggle('done', done);

  try {
    await DB.update('milestones', msId, { tasks: m.tasks });
  } catch(e) { console.error(e); }
};

window.saveTaskEdit = async function(milestoneId, taskId, idx) {
  const m = APP_STATE.milestones.find(x => x.id === milestoneId);
  if (!m) return;
  const tasks = (m.tasks||[]).map((t,i) => {
    const tid = t.id || ('ti'+i);
    if (tid !== taskId) return t;
    return {
      ...t,
      name:    document.getElementById('te-name-'+taskId)?.value?.trim() || t.name || t.text,
      dueDate: document.getElementById('te-due-'+taskId)?.value || t.dueDate || '',
      owner:   document.getElementById('te-owner-'+taskId)?.value || t.owner || '',
      notes:   document.getElementById('te-notes-'+taskId)?.value?.trim() || t.notes || ''
    };
  });
  m.tasks = tasks;
  try {
    await DB.update('milestones', milestoneId, { tasks });
    window._editingTask = null;
    showToast('Task updated ✅');
    window.openMilestoneDrawer(milestoneId);
  } catch(e) { alert('Error: '+e.message); }
};

window.updateAllocation = async function(memberId, val) {
  const pct = Math.min(200, Math.max(0, parseInt(val)||0));
  const m = APP_STATE.teamMembers.find(x => x.id === memberId);
  if (m) { m.capacity = pct; m.availability = pct; }
  try {
    await DB.update('teamMembers', memberId, { capacity: pct, availability: pct });
    showToast(`Allocation updated to ${pct}%`);
    const statusEl = document.querySelector(`[data-member-id="${memberId}"] .alloc-status`);
    if (statusEl) {
      const cls = pct>100?'badge-red':pct>=80?'badge-amber':'badge-teal';
      const lbl = pct>100?'Overloaded':pct>=80?'At Capacity':'Available';
      statusEl.className = `badge ${cls} alloc-status`;
      statusEl.textContent = lbl;
    }
  } catch(e) { alert('Error: '+e.message); }
};

window.saveTimeLog = async function(memberId, dateStr) {
  const h = document.getElementById('tl-h-'+memberId+'-'+dateStr) || document.getElementById('tl-hours-'+dateStr);
  const p = document.getElementById('tl-p-'+memberId+'-'+dateStr) || document.getElementById('tl-proj-'+dateStr);
  const n = document.getElementById('tl-n-'+memberId+'-'+dateStr) || document.getElementById('tl-note-'+dateStr);
  const hours   = parseFloat(h?.value || 0);
  const project = p?.value || '';
  const note    = n?.value?.trim() || '';
  const docId   = memberId+'_'+dateStr;
  try {
    await DB.set('resources', docId, { memberId, date: dateStr, hours, project, note, isLeave: false, leaveType: '' });
    showToast('Time saved ✅');
    document.querySelectorAll('[id^=cell-form-]').forEach(el=>el.remove());
    navigateTo(APP_STATE.currentView, APP_STATE.currentParams);
  } catch(e) { alert('Error: '+e.message); }
};

window.markLeave = async function(memberId, dateStr, leaveType) {
  const docId = memberId+'_'+dateStr;
  try {
    await DB.set('resources', docId, { memberId, date: dateStr, hours: 0, note: '', project: '', isLeave: true, leaveType });
    showToast('Leave marked ✅');
    document.querySelectorAll('[id^=cell-form-]').forEach(el=>el.remove());
    navigateTo(APP_STATE.currentView, APP_STATE.currentParams);
  } catch(e) { alert('Error: '+e.message); }
};

window.markLeavePrompt = function(memberId, dateStr) {
  const type = prompt('Leave type:\n1. Annual\n2. Sick\n3. Public Holiday\n4. Other\n\nEnter number:');
  const types = { '1':'Annual','2':'Sick','3':'Public Holiday','4':'Other' };
  const leaveType = types[type] || 'Annual';
  window.markLeave(memberId, dateStr, leaveType);
};

window.clearTimeLog = async function(memberId, dateStr) {
  const docId = memberId+'_'+dateStr;
  try {
    await DB.remove('resources', docId);
    showToast('Entry cleared');
    navigateTo(APP_STATE.currentView, APP_STATE.currentParams);
  } catch(e) { alert('Error: '+e.message); }
};

window.setTimeLogMember = function(memberId) {
  APP_STATE._timeLogMember = memberId;
  navigateTo(APP_STATE.currentView, APP_STATE.currentParams);
};

window.assignMemberToProject = async function(collection, projectId) {
  const sel = document.getElementById('assign-member-select');
  const memberId = sel?.value;
  if (!memberId) return;
  const col = collection === 'onboardingProjects' ? APP_STATE.onboardingProjects : APP_STATE.projects;
  const p = (col||[]).find(x => x.id === projectId);
  if (!p) return;
  const current = p.teamMembers || [];
  if (current.includes(memberId)) return;
  try {
    await DB.update(collection, projectId, { teamMembers: [...current, memberId] });
    showToast('Team member assigned ✅');
  } catch(e) { alert('Error: ' + e.message); }
};

window.removeMemberFromProject = async function(collection, projectId, memberId) {
  const col = collection === 'onboardingProjects' ? APP_STATE.onboardingProjects : APP_STATE.projects;
  const p = (col||[]).find(x => x.id === projectId);
  if (!p) return;
  const updated = (p.teamMembers||[]).filter(id => id !== memberId);
  try {
    await DB.update(collection, projectId, { teamMembers: updated });
    showToast('Member removed');
  } catch(e) { alert('Error: ' + e.message); }
};

window.showLeaveForm = function(memberId, dateStr) {
  document.getElementById('cell-form-'+memberId+'-'+dateStr)?.remove();
  const cell = document.querySelector(`td[onclick*="${memberId}-${dateStr}"]`) || document.body;
  const form = document.createElement('div');
  form.style.cssText = 'position:fixed;z-index:50;background:#fff;border:1px solid var(--border);border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.15);padding:12px;min-width:160px';
  form.id = 'leave-form-'+memberId+'-'+dateStr;
  form.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:var(--lt);margin-bottom:8px">LEAVE TYPE</div>
    ${['Annual','Sick','Public Holiday','Other'].map(lt=>`
      <button class="btn btn-ghost btn-sm" style="width:100%;text-align:left;margin-bottom:4px" onclick="markLeave('${memberId}','${dateStr}','${lt}');document.getElementById('leave-form-${memberId}-${dateStr}')?.remove()">
        🏖 ${lt}
      </button>`).join('')}
    <button class="btn btn-ghost btn-xs" style="width:100%;margin-top:4px" onclick="this.closest('#leave-form-${memberId}-${dateStr}')?.remove()">Cancel</button>`;
  const rect = event?.target?.getBoundingClientRect?.() || { left: 200, bottom: 200 };
  form.style.left = Math.min(rect.left, window.innerWidth - 200)+'px';
  form.style.top  = (rect.bottom + 4)+'px';
  document.body.appendChild(form);
  setTimeout(()=>document.addEventListener('click', function h(e){ if(!form.contains(e.target)){form.remove();document.removeEventListener('click',h);} }), 100);
};

// ─── TOAST ────────────────────────────────────────────────
window.showToast = function(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
};

// ─── EXCEL IMPORT ─────────────────────────────────────────
window.downloadTemplate = function(type) {
  if (typeof XLSX === 'undefined') { alert('SheetJS not loaded'); return; }
  const templates = {
    projects:   [['Name','Track','Priority','Phase','Start Date','End Date','Progress%','Status','Description']],
    onboarding: [['Name','Track','Priority','Phase','Start Date','End Date','Progress%','Status','Description']],
    pledges:    [['Customer','Commitment Title','Due Date','Owner','Priority','Status','Notes']],
    risks:      [['Title','Project','Probability','Impact','Status','Owner','Mitigation']],
    team:       [['Name','Role','Track','Email','Availability%']]
  };
  const rows = templates[type];
  if (!rows) return;
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template');
  XLSX.writeFile(wb, `${type}_template.xlsx`);
};

window.triggerImport = function(type) {
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.xlsx,.xls,.csv';
  inp.onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const data = new Uint8Array(ev.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      window._showImportPreview(type, rows);
    };
    reader.readAsArrayBuffer(file);
  };
  inp.click();
};

window._showImportPreview = function(type, rows) {
  if (!rows.length) { alert('No data found in file.'); return; }
  const cols = Object.keys(rows[0]);
  const preview = rows.slice(0, 20);
  const html = `<div class="mo" id="importMo">
    <div class="mo-box lg">
      <div class="mo-hdr">
        <span class="mo-title">Import Preview — ${rows.length} rows</span>
        <button class="mo-close" onclick="document.getElementById('importMo').remove()">×</button>
      </div>
      <div class="mo-body">
        <div style="font-size:12px;color:var(--mid);margin-bottom:12px">Showing first 20 rows. All ${rows.length} rows will be imported.</div>
        <div style="overflow-x:auto;max-height:320px;overflow-y:auto">
          <table class="dt">
            <thead><tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr></thead>
            <tbody>${preview.map(r => `<tr>${cols.map(c => `<td>${r[c]??''}</td>`).join('')}</tr>`).join('')}</tbody>
          </table>
        </div>
      </div>
      <div class="mo-foot">
        <button class="btn btn-ghost" onclick="document.getElementById('importMo').remove()">Cancel</button>
        <button class="btn btn-primary" onclick="window._confirmImport('${type}',window._importRows)">Confirm Import</button>
      </div>
    </div>
  </div>`;
  window._importRows = rows;
  document.body.insertAdjacentHTML('beforeend', html);
};

window._confirmImport = async function(type, rows) {
  document.getElementById('importMo')?.remove();
  const projMapper = r => ({ name: r.Name||r.name||'', track: r.Track||r.track||'', priority: r.Priority||r.priority||'Medium', phase: r.Phase||r.phase||'', startDate: r['Start Date']||'', endDate: r['End Date']||'', progress: parseInt(r['Progress%']||0), status: r.Status||r.status||'Yet to Start', description: r.Description||r.description||'' });
  const colMap = {
    projects:   projMapper,
    onboarding: projMapper,
    pledges:    r => ({ customer: r.Customer||r.customer||'', title: r['Commitment Title']||r.title||'', dueDate: r['Due Date']||r.dueDate||'', owner: r.Owner||r.owner||'', priority: r.Priority||r.priority||'Medium', status: r.Status||r.status||'On Track', notes: r.Notes||r.notes||'' }),
    risks:      r => ({ title: r.Title||r.title||'', project: r.Project||r.project||'', probability: r.Probability||r.probability||'Medium', impact: r.Impact||r.impact||'Medium', status: r.Status||r.status||'Open', owner: r.Owner||r.owner||'', mitigation: r.Mitigation||r.mitigation||'' }),
    team:       r => ({ name: r.Name||r.name||'', role: r.Role||r.role||'', track: r.Track||r.track||'', email: r.Email||r.email||'', availability: parseInt(r['Availability%']||100) })
  };
  const mapper = colMap[type];
  if (!mapper) return;
  const collectionMap = { projects: 'projects', onboarding: 'onboardingProjects', pledges: 'pledges', risks: 'risks', team: 'teamMembers' };
  const col = collectionMap[type];
  let count = 0;
  for (const r of rows) {
    try {
      await DB.add(col, mapper(r));
      count++;
    } catch(e) { console.error('Import error:', e); }
  }
  showToast(`✅ ${count} ${type} imported successfully`);
  navigateTo(APP_STATE.currentView);
};

// ─── INIT ─────────────────────────────────────────────────
let _initialized = false;

export async function initApp() {
  if (_initialized) {
    // Already running — just re-navigate (e.g. after PIN change)
    const savedView = localStorage.getItem('klarion_view') || 'dashboard';
    navigateTo(VIEWS[savedView] ? savedView : 'dashboard',
      (() => { try { return JSON.parse(localStorage.getItem('klarion_params') || '{}'); } catch { return {}; } })());
    return;
  }
  _initialized = true;

  const content = document.getElementById('content');
  content.innerHTML = '<div class="loading">Connecting to Kriyadocs PMO…</div>';

  let refreshTimer = null;
  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      navigateTo(APP_STATE.currentView, APP_STATE.currentParams);
    }, 200);
  }

  // NOTE: seedIfEmpty() call intentionally removed — live data must not be overwritten
  await initData(scheduleRefresh);
  const savedView = localStorage.getItem('klarion_view');
  const savedParams = (() => { try { return JSON.parse(localStorage.getItem('klarion_params')||'{}'); } catch(e) { return {}; } })();
  navigateTo(savedView && VIEWS[savedView] ? savedView : 'dashboard', savedParams);
}

window.testJiraConfig = async function() {
  const result = document.getElementById('jira-test-result');
  if (result) result.innerHTML = '<span style="font-size:11px;color:var(--lt)">Testing…</span>';
  const { JiraService } = await import('./data.js');
  const cfg = JiraService.getConfig();
  if (!cfg.baseUrl || !cfg.token) {
    if (result) result.innerHTML = '<span style="font-size:11px;color:var(--red)">Fill in URL, email and token first.</span>';
    return;
  }
  try {
    const headers = { 'Authorization': 'Basic ' + btoa(`${cfg.email}:${cfg.token}`), 'Content-Type': 'application/json' };
    const res = await fetch(`${cfg.baseUrl}/rest/api/3/myself`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (result) result.innerHTML = `<span style="font-size:11px;color:var(--green)">✅ Connected as ${data.displayName||data.emailAddress}</span>`;
    } else {
      if (result) result.innerHTML = `<span style="font-size:11px;color:var(--red)">❌ Failed (${res.status})</span>`;
    }
  } catch(e) {
    if (result) result.innerHTML = `<span style="font-size:11px;color:var(--amber)">⚠️ CORS — works when hosted, not on localhost</span>`;
  }
};

// ─── ACCESS CONTROL ───────────────────────────────────────
window.addNewUser = async function() {
  const email = document.getElementById('new-user-email')?.value?.trim()?.toLowerCase();
  const name  = document.getElementById('new-user-name')?.value?.trim();
  const role  = document.getElementById('new-user-role')?.value;

  if (!email || !email.includes('@')) {
    showToast('Enter a valid email', 'error');
    return;
  }
  const existing = (APP_STATE.users || []).find(u => u.email === email);
  if (existing) {
    showToast('User already exists', 'error');
    return;
  }
  await DB.add('users', {
    email,
    name: name || email.split('@')[0],
    role: role || 'view',
    pinHash: '',
    active: true,
    status: 'pending'
  });
  document.getElementById('new-user-email').value = '';
  document.getElementById('new-user-name').value  = '';
  showToast('User added. They can now register their PIN on first login. ✅');
};

window.updateUserRole = async function(userId, role) {
  await DB.update('users', userId, { role });
  showToast('Role updated ✅');
};

window.resetUserPin = async function(userId, userName) {
  const { generateTempPin, hashPin } = await import('./auth.js');
  const tempPin  = generateTempPin();
  const tempHash = await hashPin(tempPin);
  await DB.update('users', userId, { tempPin: tempHash, status: 'pending' });

  const html = `
    <div class="mo" id="tempPinMo">
      <div class="mo-box" style="max-width:360px">
        <div class="mo-hdr">
          <span class="mo-title">Temporary PIN for ${userName}</span>
          <button class="mo-close" onclick="closeModal('tempPinMo')">×</button>
        </div>
        <div class="mo-body" style="text-align:center">
          <div style="font-size:11px;color:var(--lt);margin-bottom:12px">
            Share this PIN privately with ${userName}. It expires after first use.
          </div>
          <div style="font-size:48px;font-weight:800;color:var(--navy);
            letter-spacing:12px;font-variant-numeric:tabular-nums;margin:16px 0">
            ${tempPin}
          </div>
          <div style="font-size:11px;color:var(--lt)">
            The user will be prompted to set a new PIN after using this.
          </div>
        </div>
        <div class="mo-foot">
          <button class="btn btn-primary" onclick="closeModal('tempPinMo')">
            Done — I've noted it
          </button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
};

window.toggleUserActive = async function(userId, currentlyActive) {
  await DB.update('users', userId, { active: !currentlyActive });
  showToast(currentlyActive ? 'User deactivated' : 'User activated ✅');
};

window.deleteUser = async function(userId, email) {
  if (!confirm(`Remove ${email} from Klarion? They will immediately lose access.`)) return;
  await DB.remove('users', userId);
  showToast('User removed');
};

// ─── BOOT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const { initAuth } = await import('./auth.js');
  await initAuth();
  // initApp() is called by auth after successful login — NOT here directly
});
