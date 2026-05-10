// ============================================================
// APP.JS — Router, Global Handlers, Init
// ============================================================
import { initData, APP_STATE, DB, DateHelpers } from './data.js';
import { openModal, closeModal } from './modals.js';
import {
  renderDashboard, renderTracks, renderRoadmap, renderMilestones,
  renderProjects, renderProjectDetail, renderOnboarding, renderWorkflows,
  renderTeam, renderCapacity, renderResources, renderRisks, renderEscalations,
  renderLeadership, renderImpacts, renderCharters, renderSettings,
  renderPledges, renderKnowledge
} from './views.js';

// ─── VIEW MAP ─────────────────────────────────────────────
const VIEWS = {
  dashboard:        { title: '',                    render: renderDashboard },
  roadmap:          { title: 'Product Roadmap',     render: renderRoadmap },
  tracks:           { title: 'Clarity',             render: renderTracks },
  pledges:          { title: 'Pledges',             render: renderPledges },
  projects:         { title: 'Projects',            render: renderProjects },
  'project-detail': { title: 'Project Detail',      render: renderProjectDetail },
  milestones:       { title: 'Milestones',          render: renderMilestones },
  onboarding:       { title: 'Onboarding',          render: renderOnboarding },
  workflows:        { title: 'Workflows',           render: renderWorkflows },
  team:             { title: 'Team',                render: renderTeam },
  capacity:         { title: 'Capacity',            render: renderCapacity },
  resources:        { title: 'Resources',           render: renderResources },
  risks:            { title: 'Risk Register',       render: renderRisks },
  escalations:      { title: 'Escalations',         render: renderEscalations },
  leadership:       { title: 'Leadership Report',   render: renderLeadership },
  impacts:          { title: 'Impact Tracker',      render: renderImpacts },
  charters:         { title: 'Charters',            render: renderCharters },
  knowledge:        { title: 'Knowledge',           render: renderKnowledge },
  settings:         { title: 'Admin Settings',      render: renderSettings },
};

// ─── NAV ──────────────────────────────────────────────────
async function navigateTo(view, params) {
  const v = VIEWS[view];
  if (!v) return;

  APP_STATE.currentView = view;
  APP_STATE.currentParams = params || {};

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
  APP_STATE.filters = { year: 2025, quarter: '', month: '', track: '', startDate: '', endDate: '' };
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
  navigateTo('resources');
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
    projects: [['Name','Track','Priority','Phase','Start Date','End Date','Progress%','Status','Description']],
    pledges:  [['Customer','Commitment Title','Due Date','Owner','Priority','Status','Notes']],
    risks:    [['Title','Project','Probability','Impact','Status','Owner','Mitigation']],
    team:     [['Name','Role','Track','Email','Availability%']]
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
  const colMap = {
    projects: r => ({ name: r.Name||r.name||'', track: r.Track||r.track||'', priority: r.Priority||r.priority||'Medium', phase: r.Phase||r.phase||'', startDate: r['Start Date']||'', endDate: r['End Date']||'', progress: parseInt(r['Progress%']||0), status: r.Status||r.status||'Yet to Start', description: r.Description||r.description||'' }),
    pledges:  r => ({ customer: r.Customer||r.customer||'', title: r['Commitment Title']||r.title||'', dueDate: r['Due Date']||r.dueDate||'', owner: r.Owner||r.owner||'', priority: r.Priority||r.priority||'Medium', status: r.Status||r.status||'On Track', notes: r.Notes||r.notes||'' }),
    risks:    r => ({ title: r.Title||r.title||'', project: r.Project||r.project||'', probability: r.Probability||r.probability||'Medium', impact: r.Impact||r.impact||'Medium', status: r.Status||r.status||'Open', owner: r.Owner||r.owner||'', mitigation: r.Mitigation||r.mitigation||'' }),
    team:     r => ({ name: r.Name||r.name||'', role: r.Role||r.role||'', track: r.Track||r.track||'', email: r.Email||r.email||'', availability: parseInt(r['Availability%']||100) })
  };
  const mapper = colMap[type];
  if (!mapper) return;
  const collectionMap = { projects: 'projects', pledges: 'pledges', risks: 'risks', team: 'teamMembers' };
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
  navigateTo('dashboard');
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
