// ============================================================
// DATA.JS — Firebase, State, Helpers, Seed Data
// ============================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore, collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, setDoc, serverTimestamp,
  memoryLocalCache, initializeFirestore, CACHE_SIZE_UNLIMITED
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA6VnYroC_kl91NDjhkYcXGUyTDrUw3rDA",
  authDomain: "kriyadocs-pmo.firebaseapp.com",
  projectId: "kriyadocs-pmo",
  storageBucket: "kriyadocs-pmo.firebasestorage.app",
  messagingSenderId: "33901531635",
  appId: "1:33901531635:web:53a00d9e4d7cff93858286"
};

const app = initializeApp(FIREBASE_CONFIG);
export const db = initializeFirestore(app, { localCache: memoryLocalCache() });

// ─── APP STATE ───────────────────────────────────────────
export const APP_STATE = {
  users: [],
  projects: [],
  milestones: [],
  tracks: [],
  teamMembers: [],
  workflows: [],
  resources: [],
  onboardingProjects: [],
  notes: [],
  risks: [],
  escalations: [],
  impacts: [],
  charters: [],
  pledges: [],
  knowledge: [],
  settings: {
    statusOptions: ['Yet to Start','In Progress','On Hold','Completed'],
    phaseOptions: ['Requirements','Design','Configuration','Development','UAT','Monitoring','Go-Live'],
    priorityOptions: ['Low','Medium','High','Critical'],
    trackNames: ['Track 1','Track 2','Track 3'],
    jiraMappings: []
  },
  filters: { year: 2026, quarter: '', month: '', track: '', startDate: '', endDate: '' },
  currentView: 'dashboard',
  currentParams: {}
};

// ─── DATE HELPERS ─────────────────────────────────────────
export const DateHelpers = {
  today() { return new Date().toISOString().split('T')[0]; },
  _toDate(d) {
    if (!d) return null;
    if (d instanceof Date) return d;
    if (typeof d.toDate === 'function') return d.toDate(); // Firestore Timestamp
    const dt = new Date(d);
    return isNaN(dt) ? null : dt;
  },
  fmt(d) {
    const dt = this._toDate(d);
    if (!dt) return '—';
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  },
  fmtShort(d) {
    const dt = this._toDate(d);
    if (!dt) return '—';
    return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  },
  parse(d) { return d ? new Date(d) : null; },
  quarter(d) {
    const dt = typeof d === 'string' ? new Date(d) : d;
    return Math.ceil((dt.getMonth() + 1) / 3);
  },
  monthName(n) { return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][n]; },
  daysBetween(a, b) {
    const da = new Date(a), db = new Date(b);
    return Math.round((db - da) / 86400000);
  },
  isOverdue(d) { return d && new Date(d) < new Date() && new Date(d).toDateString() !== new Date().toDateString(); },
  monthsInRange(start, end) {
    const s = new Date(start), e = new Date(end);
    const months = [];
    let cur = new Date(s.getFullYear(), s.getMonth(), 1);
    while (cur <= e) {
      months.push({ year: cur.getFullYear(), month: cur.getMonth() });
      cur.setMonth(cur.getMonth() + 1);
    }
    return months;
  }
};

// ─── JIRA SERVICE ─────────────────────────────────────────
export const JiraService = {
  getConfig() {
    return {
      baseUrl: localStorage.getItem('jira_baseUrl') || '',
      email:   localStorage.getItem('jira_email') || '',
      token:   localStorage.getItem('jira_token') || ''
    };
  },
  saveConfig(baseUrl, email, token) {
    localStorage.setItem('jira_baseUrl', baseUrl);
    localStorage.setItem('jira_email', email);
    localStorage.setItem('jira_token', token);
  },
  mock(jiraKey) {
    const seed = jiraKey ? jiraKey.charCodeAt(0) : 42;
    const todo = 3 + (seed % 8), inprog = 2 + (seed % 5), done = 5 + (seed % 10);
    return { todo, inProgress: inprog, done, total: todo + inprog + done, isMock: true };
  },
  async fetch(jiraKey) {
    if (!jiraKey) return this.mock(jiraKey);
    const { baseUrl, email, token } = this.getConfig();
    if (!baseUrl || !token) return this.mock(jiraKey);
    try {
      const headers = { 'Authorization': 'Basic ' + btoa(`${email}:${token}`), 'Content-Type': 'application/json' };
      const jql = encodeURIComponent(`project = ${jiraKey} ORDER BY created DESC`);
      const res = await fetch(`${baseUrl}/rest/api/3/search?jql=${jql}&maxResults=200&fields=status`, { headers });
      if (!res.ok) return this.mock(jiraKey);
      const data = await res.json();
      const issues = data.issues || [];
      const todo = issues.filter(i => ['To Do','Open','Backlog'].includes(i.fields.status.name)).length;
      const done = issues.filter(i => ['Done','Closed','Resolved'].includes(i.fields.status.name)).length;
      const inProgress = issues.length - todo - done;
      return { todo, inProgress, done, total: issues.length, isMock: false };
    } catch { return this.mock(jiraKey); }
  }
};

// ─── FIRESTORE HELPERS ────────────────────────────────────
export const DB = {
  async add(col, data) {
    return addDoc(collection(db, col), { ...data, createdAt: serverTimestamp() });
  },
  async update(col, id, data) {
    return updateDoc(doc(db, col, id), { ...data, updatedAt: serverTimestamp() });
  },
  async remove(col, id) {
    return deleteDoc(doc(db, col, id));
  },
  async set(col, id, data) {
    return setDoc(doc(db, col, id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
  }
};

// ─── SEED DATA ────────────────────────────────────────────
async function seedIfEmpty() {
  const snap = await getDocs(collection(db, 'projects'));
  if (!snap.empty) return;

  // Team Members
  const team = [
    { name: 'Aravind Kumar',  role: 'Tech Lead',       track: 'Track 1', jiraId: 'aravind.k', availability: 100 },
    { name: 'Priya Nair',     role: 'Senior Dev',       track: 'Track 1', jiraId: 'priya.n',   availability: 80 },
    { name: 'Rahul Sharma',   role: 'Backend Dev',      track: 'Track 2', jiraId: 'rahul.s',   availability: 100 },
    { name: 'Sneha Iyer',     role: 'Frontend Dev',     track: 'Track 2', jiraId: 'sneha.i',   availability: 60 },
    { name: 'Karthik Menon',  role: 'QA Lead',          track: 'Track 3', jiraId: 'karthik.m', availability: 100 },
    { name: 'Divya Pillai',   role: 'Business Analyst', track: 'Track 1', jiraId: 'divya.p',   availability: 80 },
    { name: 'Sanjay Rajan',   role: 'DevOps',           track: 'Track 2', jiraId: 'sanjay.r',  availability: 100 },
    { name: 'Meera Suresh',   role: 'PM / Scrum Master',track: 'Track 3', jiraId: 'meera.s',   availability: 100 }
  ];
  const teamIds = {};
  for (const t of team) {
    const ref = await DB.add('teamMembers', t);
    teamIds[t.name] = ref.id;
  }

  // Tracks
  const tracks = [
    { name: 'Track 1', description: 'Core Platform & Reference Services', color: '#1B2B5E', projects: [], members: [] },
    { name: 'Track 2', description: 'Integrations & Data Pipeline',        color: '#00A896', projects: [], members: [] },
    { name: 'Track 3', description: 'Customer Onboarding & UAT',           color: '#E8452C', projects: [], members: [] }
  ];
  for (const t of tracks) { await DB.add('tracks', t); }

  // Projects
  const projects = [
    { name: 'Reference Service Enhancement', track: 'Track 1', phase: 'Development', status: 'In Progress',
      devLead: teamIds['Aravind Kumar'] || '', team: [teamIds['Aravind Kumar'], teamIds['Priya Nair']],
      startDate: '2026-01-06', endDate: '2026-04-30', jiraKey: 'RSE', progress: 55,
      description: 'Enhance reference lookup speed and accuracy.', objectives: 'Sub-200ms response; 99.9% uptime.',
      stakeholders: 'Product, Engineering', priority: 'High' },
    { name: 'Metadata Pipeline v2', track: 'Track 2', phase: 'Requirements', status: 'Yet to Start',
      devLead: teamIds['Rahul Sharma'] || '', team: [teamIds['Rahul Sharma'], teamIds['Sneha Iyer']],
      startDate: '2026-03-01', endDate: '2026-06-30', jiraKey: 'MPV2', progress: 10,
      description: 'Rebuild metadata ingestion pipeline.', objectives: 'Handle 10x volume; reduce lag <5s.',
      stakeholders: 'Data team, Product', priority: 'High' },
    { name: 'Publisher Onboarding Portal', track: 'Track 3', phase: 'UAT', status: 'In Progress',
      devLead: teamIds['Karthik Menon'] || '', team: [teamIds['Karthik Menon'], teamIds['Meera Suresh']],
      startDate: '2025-11-01', endDate: '2026-02-28', jiraKey: 'POP', progress: 85,
      description: 'Self-serve portal for publisher onboarding.', objectives: 'Reduce onboarding time by 60%.',
      stakeholders: 'Publishers, Sales', priority: 'Critical' },
    { name: 'Search Relevance Upgrade', track: 'Track 1', phase: 'Design', status: 'In Progress',
      devLead: teamIds['Priya Nair'] || '', team: [teamIds['Priya Nair'], teamIds['Divya Pillai']],
      startDate: '2026-02-01', endDate: '2026-05-31', jiraKey: 'SRU', progress: 30,
      description: 'ML-driven search ranking model.', objectives: 'Improve click-through by 25%.',
      stakeholders: 'Product, Research', priority: 'High' },
    { name: 'API Gateway Consolidation', track: 'Track 2', phase: 'Development', status: 'On Hold',
      devLead: teamIds['Sanjay Rajan'] || '', team: [teamIds['Sanjay Rajan'], teamIds['Rahul Sharma']],
      startDate: '2026-01-15', endDate: '2026-05-15', jiraKey: 'AGC', progress: 20,
      description: 'Consolidate 4 API gateways into one.', objectives: 'Single auth layer, reduced latency.',
      stakeholders: 'Engineering, DevOps', priority: 'Medium' },
    { name: 'Analytics Dashboard v3', track: 'Track 3', phase: 'Monitoring', status: 'Completed',
      devLead: teamIds['Divya Pillai'] || '', team: [teamIds['Divya Pillai'], teamIds['Meera Suresh']],
      startDate: '2025-09-01', endDate: '2026-01-31', jiraKey: 'ADV3', progress: 100,
      description: 'New analytics suite for internal teams.', objectives: 'Real-time KPI visibility.',
      stakeholders: 'Leadership, Product', priority: 'Medium' }
  ];
  const projectIds = {};
  for (const p of projects) {
    const ref = await DB.add('projects', p);
    projectIds[p.name] = ref.id;
  }

  // Milestones
  const pId = (name) => projectIds[name] || '';
  const milestones = [
    { title: 'API Spec Finalised',       projectId: pId('Reference Service Enhancement'), projectName: 'Reference Service Enhancement', dueDate: '2026-01-31', status: 'Completed', completedDate: '2026-01-30', track: 'Track 1' },
    { title: 'Dev Complete',             projectId: pId('Reference Service Enhancement'), projectName: 'Reference Service Enhancement', dueDate: '2026-03-31', status: 'At Risk',   track: 'Track 1' },
    { title: 'UAT Sign-off',            projectId: pId('Reference Service Enhancement'), projectName: 'Reference Service Enhancement', dueDate: '2026-04-20', status: 'On Track',  track: 'Track 1' },
    { title: 'Requirements Approved',    projectId: pId('Metadata Pipeline v2'),          projectName: 'Metadata Pipeline v2',          dueDate: '2026-03-20', status: 'On Track',  track: 'Track 2' },
    { title: 'Pipeline Dev Done',        projectId: pId('Metadata Pipeline v2'),          projectName: 'Metadata Pipeline v2',          dueDate: '2026-05-30', status: 'Yet to Start', track: 'Track 2' },
    { title: 'UAT Completed',           projectId: pId('Publisher Onboarding Portal'),   projectName: 'Publisher Onboarding Portal',   dueDate: '2026-02-15', status: 'Overdue',   revisedETA: '2026-03-01', delayReason: 'Client feedback pending', track: 'Track 3' },
    { title: 'Go-Live',                 projectId: pId('Publisher Onboarding Portal'),   projectName: 'Publisher Onboarding Portal',   dueDate: '2026-02-28', status: 'Overdue',   revisedETA: '2026-03-15', track: 'Track 3' },
    { title: 'Model Training Complete', projectId: pId('Search Relevance Upgrade'),      projectName: 'Search Relevance Upgrade',      dueDate: '2026-04-15', status: 'On Track',  track: 'Track 1' },
    { title: 'Gateway Design Done',     projectId: pId('API Gateway Consolidation'),     projectName: 'API Gateway Consolidation',     dueDate: '2026-03-01', status: 'Overdue',   revisedETA: '2026-04-01', delayReason: 'On hold - resource conflict', track: 'Track 2' },
    { title: 'Dashboard Live',          projectId: pId('Analytics Dashboard v3'),        projectName: 'Analytics Dashboard v3',        dueDate: '2026-01-31', status: 'Completed', completedDate: '2026-01-28', track: 'Track 3' }
  ];
  for (const m of milestones) { await DB.add('milestones', m); }

  // Risks
  const risks = [
    { title: 'Resource contention on Track 2', project: 'Metadata Pipeline v2', likelihood: 4, impact: 4, owner: 'Meera Suresh', mitigation: 'Escalate to track lead; reallocate Sanjay 50% to pipeline.', status: 'Open', track: 'Track 2' },
    { title: 'Client sign-off delay for Publisher Portal', project: 'Publisher Onboarding Portal', likelihood: 3, impact: 5, owner: 'Karthik Menon', mitigation: 'Weekly client sync; escalation path defined.', status: 'Open', track: 'Track 3' },
    { title: 'API Gateway scope creep', project: 'API Gateway Consolidation', likelihood: 3, impact: 3, owner: 'Sanjay Rajan', mitigation: 'Freeze scope at current state; defer new items.', status: 'Mitigated', track: 'Track 2' }
  ];
  for (const r of risks) { await DB.add('risks', r); }

  // Escalations
  const escalations = [
    { title: 'Publisher UAT delayed by 2 weeks', project: 'Publisher Onboarding Portal', raisedBy: 'Karthik Menon', date: '2026-03-10', priority: 'High', status: 'Open', notes: 'Client has not completed internal review. Awaiting sign-off.', track: 'Track 3' },
    { title: 'API Gateway on hold — needs decision', project: 'API Gateway Consolidation', raisedBy: 'Sanjay Rajan', date: '2026-03-05', priority: 'Medium', status: 'Resolved', resolution: 'Resumed after resource allocation fixed.', notes: 'Was blocked on resource conflict with RSE.', track: 'Track 2' }
  ];
  for (const e of escalations) { await DB.add('escalations', e); }

  // Impacts
  const impacts = [
    { project: 'Reference Service Enhancement', metric: 'API Response Time', baseline: '450ms', current: '210ms', target: '<200ms', improvement: '53%', notes: 'Ongoing optimisation in progress.' },
    { project: 'Publisher Onboarding Portal', metric: 'Onboarding Time', baseline: '14 days', current: '8 days', target: '5 days', improvement: '43%', notes: 'Will improve further post go-live.' },
    { project: 'Analytics Dashboard v3', metric: 'Report Generation Time', baseline: '8 min', current: '45 sec', target: '<1 min', improvement: '91%', notes: 'Target achieved.' }
  ];
  for (const i of impacts) { await DB.add('impacts', i); }

  // Charters
  const charters = [
    { projectId: pId('Reference Service Enhancement'), projectName: 'Reference Service Enhancement', sponsor: 'Head of Engineering', startDate: '2026-01-06', endDate: '2026-04-30', budget: '₹12L', objectives: 'Sub-200ms lookup; 99.9% uptime; scalable to 5M req/day.', scope: 'API redesign, caching layer, CDN integration.', outOfScope: 'Frontend UI changes.', successCriteria: 'Response time <200ms in load test; zero downtime deploy.' }
  ];
  for (const c of charters) { await DB.add('charters', c); }

  // Workflows
  const workflows = [
    { name: 'Standard Project Kickoff', steps: [
      { name: 'Charter Sign-off',    assignee: 'PM',           duration: 2 },
      { name: 'Jira Project Setup',  assignee: 'Dev Lead',     duration: 1 },
      { name: 'Team Onboarding',     assignee: 'PM',           duration: 3 },
      { name: 'Sprint 0 Planning',   assignee: 'Scrum Master', duration: 2 },
      { name: 'Kickoff Meeting',     assignee: 'PM',           duration: 1 }
    ]},
    { name: 'UAT Process', steps: [
      { name: 'Test Plan Approval',  assignee: 'QA Lead',      duration: 3 },
      { name: 'Environment Setup',   assignee: 'DevOps',       duration: 2 },
      { name: 'UAT Execution',       assignee: 'QA Lead',      duration: 10 },
      { name: 'Bug Fix Cycle',       assignee: 'Dev Lead',     duration: 5 },
      { name: 'Sign-off',            assignee: 'PM',           duration: 2 }
    ]}
  ];
  for (const w of workflows) { await DB.add('workflows', w); }

  // Onboarding Projects
  const onboarding = [
    { name: 'Elsevier Integration', customerName: 'Elsevier', track: 'Track 3', phase: 'Configuration', status: 'In Progress',
      team: [teamIds['Karthik Menon'], teamIds['Meera Suresh']], jiraKey: 'ELS',
      startDate: '2026-02-01', endDate: '2026-04-30', progress: 40,
      devLead: teamIds['Karthik Menon'] || '', notes: 'Metadata format mapping in progress.' },
    { name: 'Oxford UP Data Feed',  customerName: 'Oxford University Press', track: 'Track 2', phase: 'Requirements', status: 'Yet to Start',
      team: [teamIds['Rahul Sharma']], jiraKey: 'OUP',
      startDate: '2026-04-01', endDate: '2026-07-31', progress: 0,
      devLead: teamIds['Rahul Sharma'] || '', notes: '' }
  ];
  for (const o of onboarding) { await DB.add('onboardingProjects', o); }

  // Settings
  await DB.set('settings', 'config', {
    statusOptions: ['Yet to Start','In Progress','On Hold','Completed'],
    phaseOptions: ['Requirements','Design','Configuration','Development','UAT','Monitoring','Go-Live'],
    priorityOptions: ['Low','Medium','High','Critical'],
    trackNames: ['Track 1','Track 2','Track 3'],
    jiraMappings: []
  });

  console.log('✅ Seed data inserted');
}

// ─── LISTENERS ────────────────────────────────────────────
const COLLECTIONS = ['users','projects','milestones','tracks','teamMembers','workflows',
                     'resources','onboardingProjects','notes','risks','escalations','impacts','charters','pledges','knowledge'];

export function startListeners(onUpdate) {
  const unsubs = [];
  for (const col of COLLECTIONS) {
    const unsub = onSnapshot(collection(db, col), snap => {
      APP_STATE[col] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      onUpdate(col);
    });
    unsubs.push(unsub);
  }

  // Settings listener
  const settingsUnsub = onSnapshot(collection(db, 'settings'), snap => {
    snap.docs.forEach(d => {
      if (d.id === 'config') Object.assign(APP_STATE.settings, d.data());
    });
    onUpdate('settings');
  });
  unsubs.push(settingsUnsub);

  return () => unsubs.forEach(u => u());
}

export async function initData(onUpdate) {

  return startListeners(onUpdate);
}
