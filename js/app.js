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
  function taskHtml(t, i) {
    return `<div class="task-row" id="task-row-${i}">
      <input type="checkbox" class="task-cb" ${t.done?'checked':''} onchange="toggleTask('${msId}',${i},this.checked)"/>
      <div class="task-info">
        <div class="task-name-text ${t.done?'done':''}">${t.name||t.text||''}</div>
        ${t.dueDate?`<div class="task-due ${t.dueDate<DateHelpers.today()?'overdue':''}">📅 ${DateHelpers.fmt(t.dueDate)}</div>`:''}
        ${t.owner?`<div class="task-due">👤 ${t.owner}</div>`:''}
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
      <div id="drawer-task-list">${tasks.length ? tasks.map((t,i)=>taskHtml(t,i)).join('') : '<div style="font-size:12px;color:var(--lt);padding:8px 0">No tasks yet</div>'}</div>
      <div class="add-task-form">
        <div style="font-size:11px;font-weight:700;color:var(--lt);text-transform:uppercase;margin-bottom:8px">Add Task</div>
        <input class="form-control" id="drawer-task-name" placeholder="Task name…" style="margin-bottom:6px;font-size:12px"/>
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <input type="date" class="form-control" id="drawer-task-due" style="font-size:12px;flex:1"/>
          <input class="form-control" id="drawer-task-owner" placeholder="Owner…" style="font-size:12px;flex:1"/>
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
export async function initApp() {
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

// ─── BOOT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => { initApp(); });
