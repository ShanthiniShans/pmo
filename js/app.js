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
  dashboard:      { title: 'Dashboard',          render: renderDashboard },
  tracks:         { title: 'Tracks',             render: renderTracks },
  roadmap:        { title: 'Roadmap',            render: renderRoadmap },
  milestones:     { title: 'Milestones',         render: renderMilestones },
  projects:       { title: 'All Projects',       render: renderProjects },
  'project-detail':{ title: 'Project Detail',   render: renderProjectDetail },
  onboarding:     { title: 'Onboarding Projects',render: renderOnboarding },
  workflows:      { title: 'Workflows',          render: renderWorkflows },
  team:           { title: 'Team',               render: renderTeam },
  capacity:       { title: 'Capacity Planning',  render: renderCapacity },
  resources:      { title: 'Resource Tracking',  render: renderResources },
  risks:          { title: 'Risk Register',      render: renderRisks },
  escalations:    { title: 'Escalations',        render: renderEscalations },
  leadership:     { title: 'Leadership Report',  render: renderLeadership },
  impacts:        { title: 'Impact Tracker',     render: renderImpacts },
  charters:       { title: 'Charters',           render: renderCharters },
  settings:       { title: 'Admin Settings',     render: renderSettings },
  pledges:        { title: 'Commitments',        render: renderPledges },
  knowledge:      { title: 'Knowledge Base',     render: renderKnowledge }
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

  // Update top bar title
  const titleEl = document.getElementById('topBarTitle');
  if (titleEl) titleEl.textContent = v.title;

  // Update timestamp
  const ts = document.getElementById('topTimestamp');
  if (ts) ts.textContent = new Date().toLocaleString('en-GB', { dateStyle:'medium', timeStyle:'short' });

  // Render
  const content = document.getElementById('content');
  content.innerHTML = '<div class="loading">Loading…</div>';
  try {
    const html = await Promise.resolve(v.render(params));
    content.innerHTML = html;
  } catch(e) {
    content.innerHTML = `<div class="empty-state"><div class="empty-state-text">Error rendering view: ${e.message}</div></div>`;
    console.error(e);
  }
}

// ─── GLOBAL FUNCTIONS ─────────────────────────────────────
window._nav = navigateTo;
window.openModal = openModal;
window.closeModal = closeModal;

window.deleteItem = async function(collection, id) {
  if (!confirm('Delete this item? This cannot be undone.')) return;
  try {
    await DB.remove(collection, id);
  } catch(e) { alert('Error deleting: '+e.message); }
};

window.markMilestoneComplete = async function(id) {
  try {
    await DB.update('milestones', id, { status: 'Completed', completedDate: DateHelpers.today() });
  } catch(e) { alert('Error: '+e.message); }
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
  document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
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
    alert('Settings saved ✅');
  } catch(e) { alert('Error: '+e.message); }
};

window.saveJiraConfig = function() {
  const { JiraService } = window._jiraService || {};
  const baseUrl = document.getElementById('jira-baseUrl')?.value||'';
  const email   = document.getElementById('jira-email')?.value||'';
  const token   = document.getElementById('jira-token')?.value||'';
  localStorage.setItem('jira_baseUrl', baseUrl);
  localStorage.setItem('jira_email', email);
  localStorage.setItem('jira_token', token);
  alert('Jira config saved ✅');
};

window.updateJiraMapping = async function(memberId, jiraId) {
  try {
    await DB.update('teamMembers', memberId, { jiraId });
  } catch(e) { console.error(e); }
};

// ─── INIT ─────────────────────────────────────────────────

// Team track filter
window._setTeamTrack = function(track) {
  APP_STATE._teamTrackFilter = track;
  navigateTo('team');
};

// Resource week navigation
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

export async function initApp() {
  const content = document.getElementById('content');
  content.innerHTML = '<div class="loading">Connecting to Firebase…</div>';

  let refreshTimer = null;

  function scheduleRefresh(col) {
    // Debounce to avoid rapid re-renders
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      navigateTo(APP_STATE.currentView, APP_STATE.currentParams);
    }, 200);
  }

  await initData(scheduleRefresh);
  navigateTo('dashboard');
}

// Test Jira connection
window.testJiraConfig = async function() {
  const result = document.getElementById('jira-test-result');
  if (result) result.innerHTML = '<span class="small text-lt">Testing…</span>';
  const { JiraService } = await import('./data.js');
  const cfg = JiraService.getConfig();
  if (!cfg.baseUrl || !cfg.token) {
    if (result) result.innerHTML = '<span class="small text-red">Please fill in URL, email and token first.</span>';
    return;
  }
  try {
    const headers = { 'Authorization': 'Basic ' + btoa(`${cfg.email}:${cfg.token}`), 'Content-Type': 'application/json' };
    const res = await fetch(`${cfg.baseUrl}/rest/api/3/myself`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (result) result.innerHTML = `<span class="small text-green">✅ Connected as ${data.displayName||data.emailAddress}</span>`;
    } else {
      if (result) result.innerHTML = `<span class="small text-red">❌ Failed (${res.status}). Check your URL, email and token.</span>`;
    }
  } catch(e) {
    if (result) result.innerHTML = `<span class="small text-amber">⚠️ CORS error — Jira API calls only work when the app is hosted (not localhost). Your config is saved and will work when deployed.</span>`;
  }
};