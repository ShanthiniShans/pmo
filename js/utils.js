// ─── UTILS / COMPONENT HELPERS ────────────────────────────────

function ragBadge(status) {
  return `<span class="rag ${ragClass(status)}">${ragLabel(status)}</span>`;
}

function progressBar(pct, color) {
  const c = color || progressColor(pct);
  return `<div class="progress-wrap">
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${c}"></div></div>
    <span class="progress-label">${pct}%</span>
  </div>`;
}

function metricCard(label, value, sub, accentColor, extraClass) {
  return `<div class="metric-card ${extraClass || ''}">
    <div class="metric-card-accent" style="background:${accentColor || '#1B2B5E'}"></div>
    <div class="metric-label">${label}</div>
    <div class="metric-val">${value}</div>
    ${sub ? `<div class="metric-sub">${sub}</div>` : ''}
  </div>`;
}

function topbar(title, sub, actions) {
  return `<div class="topbar">
    <div class="topbar-left">
      <h1>${title}</h1>
      ${sub ? `<p>${sub}</p>` : ''}
    </div>
    <div class="topbar-right">${actions || ''}</div>
  </div>`;
}

function card(content, extraClass) {
  return `<div class="card ${extraClass || ''}">${content}</div>`;
}

function cardWithHeader(title, body, actions, sub) {
  return `<div class="card mb-20">
    <div class="card-header">
      <div><div class="card-title">${title}</div>${sub ? `<div class="card-subtitle">${sub}</div>` : ''}</div>
      ${actions ? `<div>${actions}</div>` : ''}
    </div>
    <div class="card-body">${body}</div>
  </div>`;
}

function tableWrap(content) {
  return `<div class="table-wrap">${content}</div>`;
}

function emptyState(icon, text, sub) {
  return `<div class="empty-state">
    <div class="empty-state-icon">${icon}</div>
    <div class="empty-state-text">${text}</div>
    ${sub ? `<div class="empty-state-sub">${sub}</div>` : ''}
  </div>`;
}

function projectSelectOptions() {
  return APP_STATE.projects.map(p =>
    `<option value="${p.id}|${p.name}">${p.name}</option>`
  ).join('');
}

function selectWithValue(id, options, value, cls) {
  return `<select id="${id}" class="${cls || 'form-control'}">
    ${options.map(([v, l]) => `<option value="${v}" ${value === v ? 'selected' : ''}>${l}</option>`).join('')}
  </select>`;
}
