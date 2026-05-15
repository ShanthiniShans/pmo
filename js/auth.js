// ============================================================
// AUTH.JS — Email + 4-digit PIN Authentication
// ============================================================

// ── CONSTANTS ─────────────────────────────────────────────
export const ADMIN_EMAIL = 'shanthini.k@kriyadocs.com';
const SESSION_KEY = 'klarion_session';
const SALT = 'klarion-pmo-2026';

// ── PIN HASHING ───────────────────────────────────────────
export async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── SESSION ───────────────────────────────────────────────
export function getSession() {
  try {
    const s = sessionStorage.getItem(SESSION_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function setSession(user) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  window.CURRENT_USER = user;
  window.CAN_EDIT = ['admin', 'edit'].includes(user.role);
  window.IS_ADMIN = user.role === 'admin';
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  window.CURRENT_USER = null;
  window.CAN_EDIT = false;
  window.IS_ADMIN = false;
}

// ── USER LOOKUP ───────────────────────────────────────────
export async function findUser(email) {
  const { db } = await import('./data.js');
  const { collection, query, where, getDocs } = await import(
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
  );
  const q = query(
    collection(db, 'users'),
    where('email', '==', email.toLowerCase().trim())
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

// ── BOOTSTRAP ADMIN ───────────────────────────────────────
export async function bootstrapAdmin() {
  const { db, DB } = await import('./data.js');
  const { collection, getDocs } = await import(
    'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
  );
  const snap = await getDocs(collection(db, 'users'));
  if (!snap.empty) return;
  await DB.add('users', {
    email: ADMIN_EMAIL,
    name: 'Shanthini K',
    role: 'admin',
    pinHash: '',
    active: true,
    status: 'pending',
    isAdmin: true
  });
}

// ── GENERATE TEMP PIN ─────────────────────────────────────
export function generateTempPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

// ── RENDER LOGIN SCREENS ──────────────────────────────────

const LOGO_SVG = `<svg class="auth-logo-icon" viewBox="0 0 80 80" fill="none">
  <path d="M20 30 A20 20 0 0 1 60 30" stroke="#F5C518" stroke-width="9" stroke-linecap="round" fill="none"/>
  <circle cx="40" cy="30" r="7" fill="#29B6D6"/>
  <path d="M26 44 L40 58 L54 44" stroke="#7B3FA0" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <rect x="24" y="67" width="32" height="7" rx="3.5" fill="#5DB85A"/>
</svg>`;

function logoBlock() {
  return `<div class="auth-logo">
    ${LOGO_SVG}
    <div>
      <div class="auth-logo-text">KLARION</div>
      <span class="auth-logo-sub">Program &amp; Product Management</span>
    </div>
  </div>`;
}

export function renderEmailStep() {
  const card = document.getElementById('auth-card');
  card.innerHTML = `
    ${logoBlock()}
    <div class="auth-heading">Welcome back</div>
    <div class="auth-sub">Enter your work email to continue</div>
    <div id="auth-error" class="auth-error"></div>
    <label class="auth-label">Work Email</label>
    <input type="email" id="auth-email" class="auth-input"
      placeholder="you@kriyadocs.com" autocomplete="email"/>
    <button class="auth-btn teal" onclick="window._authContinue()">Continue →</button>
    <div style="text-align:center;font-size:12px;color:var(--lt)">
      Don't have access? Contact your administrator.
    </div>`;

  const input = document.getElementById('auth-email');
  input.focus();
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') window._authContinue();
  });
}

export function renderSetPinStep(user) {
  const displayName = (user.name || user.email.split('@')[0]).replace(/'/g, '&#39;');
  const card = document.getElementById('auth-card');
  card.innerHTML = `
    ${logoBlock()}
    <div class="auth-heading">Hi ${displayName} 👋</div>
    <div class="auth-sub">First time here. Create your 4-digit PIN to secure your account.</div>
    <div id="auth-error" class="auth-error"></div>
    <label class="auth-label" style="text-align:center;display:block">Create PIN</label>
    <div class="pin-row" id="pin-create-row">
      <input class="pin-box" maxlength="1" type="tel" id="pc0"/>
      <input class="pin-box" maxlength="1" type="tel" id="pc1"/>
      <input class="pin-box" maxlength="1" type="tel" id="pc2"/>
      <input class="pin-box" maxlength="1" type="tel" id="pc3"/>
    </div>
    <label class="auth-label" style="text-align:center;display:block">Confirm PIN</label>
    <div class="pin-row" id="pin-confirm-row">
      <input class="pin-box" maxlength="1" type="tel" id="pcc0"/>
      <input class="pin-box" maxlength="1" type="tel" id="pcc1"/>
      <input class="pin-box" maxlength="1" type="tel" id="pcc2"/>
      <input class="pin-box" maxlength="1" type="tel" id="pcc3"/>
    </div>
    <button class="auth-btn teal"
      onclick="window._authSetPin('${user.id}','${user.email}','${user.role}','${displayName}')">
      Set PIN &amp; Enter →
    </button>
    <div style="text-align:center">
      <button class="auth-link" onclick="window._authBack()">← Use different email</button>
    </div>`;

  setupPinBoxes('pc', 4);
  setupPinBoxes('pcc', 4);
  document.getElementById('pc0').focus();
}

export function renderEnterPinStep(user) {
  const displayName = (user.name || user.email.split('@')[0]).replace(/'/g, '&#39;');
  const card = document.getElementById('auth-card');
  card.innerHTML = `
    ${logoBlock()}
    <div class="auth-heading">Hi ${displayName} 👋</div>
    <div class="auth-sub">Enter your 4-digit PIN to continue</div>
    <div id="auth-error" class="auth-error"></div>
    <div class="pin-row" id="pin-enter-row">
      <input class="pin-box" maxlength="1" type="tel" id="pe0"/>
      <input class="pin-box" maxlength="1" type="tel" id="pe1"/>
      <input class="pin-box" maxlength="1" type="tel" id="pe2"/>
      <input class="pin-box" maxlength="1" type="tel" id="pe3"/>
    </div>
    <button class="auth-btn teal"
      onclick="window._authVerifyPin('${user.id}','${user.email}','${user.role}','${displayName}')">
      Enter →
    </button>
    <div style="display:flex;justify-content:space-between;margin-top:4px">
      <button class="auth-link" onclick="window._authBack()">← Not you?</button>
      <button class="auth-link" onclick="window._authForgotPin('${user.email}')">Forgot PIN?</button>
    </div>`;

  setupPinBoxes('pe', 4);
  document.getElementById('pe0').focus();
}

export function renderAccessDenied(email) {
  const card = document.getElementById('auth-card');
  card.innerHTML = `
    <div class="auth-denied">
      <div class="auth-denied-icon">🔒</div>
      <div class="auth-heading">Access Not Granted</div>
      <div class="auth-sub">
        <strong>${email}</strong><br>
        is not on the approved access list.<br><br>
        Contact <strong>Shanthini K</strong> to request access.
      </div>
      <button class="auth-btn" onclick="window._authBack()" style="margin-top:16px">
        ← Try Different Email
      </button>
    </div>`;
}

export function renderTempPinStep(user) {
  const displayName = (user.name || user.email.split('@')[0]).replace(/'/g, '&#39;');
  const card = document.getElementById('auth-card');
  card.innerHTML = `
    <div class="auth-heading">Reset your PIN</div>
    <div class="auth-sub">Enter the temporary PIN provided by your administrator, then set a new one.</div>
    <div id="auth-error" class="auth-error"></div>
    <label class="auth-label" style="text-align:center;display:block">Temporary PIN</label>
    <div class="pin-row">
      <input class="pin-box" maxlength="1" type="tel" id="pt0"/>
      <input class="pin-box" maxlength="1" type="tel" id="pt1"/>
      <input class="pin-box" maxlength="1" type="tel" id="pt2"/>
      <input class="pin-box" maxlength="1" type="tel" id="pt3"/>
    </div>
    <button class="auth-btn teal"
      onclick="window._authVerifyTemp('${user.id}','${user.email}','${user.role}','${displayName}')">
      Verify →
    </button>
    <div style="text-align:center">
      <button class="auth-link" onclick="window._authBack()">← Back</button>
    </div>`;
  setupPinBoxes('pt', 4);
  document.getElementById('pt0').focus();
}

// ── PIN BOX AUTO-ADVANCE ──────────────────────────────────
function setupPinBoxes(prefix, count) {
  for (let i = 0; i < count; i++) {
    const box = document.getElementById(prefix + i);
    if (!box) continue;
    box.addEventListener('input', () => {
      const v = box.value.replace(/\D/g, '');
      box.value = v ? v[v.length - 1] : '';
      if (box.value && i < count - 1) {
        document.getElementById(prefix + (i + 1))?.focus();
      }
      box.classList.toggle('filled', !!box.value);
    });
    box.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !box.value && i > 0) {
        document.getElementById(prefix + (i - 1))?.focus();
      }
    });
  }
}

function getPinValue(prefix, count) {
  let pin = '';
  for (let i = 0; i < count; i++) {
    pin += document.getElementById(prefix + i)?.value || '';
  }
  return pin;
}

function showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) {
    el.textContent = msg;
    el.classList.add('show');
  }
}

// ── AUTH ACTIONS ──────────────────────────────────────────

export async function initAuth() {
  const session = getSession();
  if (session) {
    setSession(session);
    showApp(session);
    const { initApp } = await import('./app.js');
    await initApp();
    return;
  }

  await bootstrapAdmin();

  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-shell').style.display = 'none';
  renderEmailStep();
}

export function showApp(user) {
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) authScreen.style.display = 'none';

  const appShell = document.getElementById('app-shell');
  if (appShell) appShell.style.display = 'flex';

  if (user.role === 'view') {
    document.body.classList.add('view-mode');
  } else {
    document.body.classList.remove('view-mode');
  }

  // Hide Admin Settings from non-admins
  document.querySelectorAll('[data-view="settings"]').forEach(el => {
    el.style.display = window.IS_ADMIN ? '' : 'none';
  });

  // Add user chip to topbar
  const chip = document.getElementById('user-chip-container');
  if (chip) {
    const initials = (user.name || user.email)
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    chip.innerHTML = `
      <div class="user-chip" onclick="window._authShowUserMenu()">
        <div class="av av-sm" style="background:var(--teal)">${initials}</div>
        <div>
          <div class="user-chip-name">${user.name || user.email.split('@')[0]}</div>
          <div class="user-chip-role">
            ${user.role}
            <span class="view-badge">View Only</span>
          </div>
        </div>
      </div>`;
  }
}

// ── GLOBAL WINDOW AUTH FUNCTIONS ──────────────────────────

window._authContinue = async function() {
  const emailEl = document.getElementById('auth-email');
  const email = emailEl?.value?.trim()?.toLowerCase();
  if (!email || !email.includes('@')) {
    showAuthError('Please enter a valid email.');
    return;
  }

  const user = await findUser(email);
  if (!user || !user.active) {
    renderAccessDenied(email);
    return;
  }

  if (!user.pinHash || user.status === 'pending') {
    renderSetPinStep(user);
  } else if (user.tempPin) {
    renderTempPinStep(user);
  } else {
    renderEnterPinStep(user);
  }
};

window._authSetPin = async function(userId, email, role, name) {
  const pin = getPinValue('pc', 4);
  const confirm = getPinValue('pcc', 4);

  if (pin.length !== 4) {
    showAuthError('Enter all 4 digits for your PIN.');
    return;
  }
  if (pin !== confirm) {
    showAuthError('PINs do not match. Try again.');
    for (let i = 0; i < 4; i++) {
      const b = document.getElementById('pcc' + i);
      if (b) { b.value = ''; b.classList.remove('filled'); }
    }
    document.getElementById('pcc0')?.focus();
    return;
  }

  const { DB } = await import('./data.js');
  const pinHash = await hashPin(pin);
  await DB.update('users', userId, { pinHash, status: 'active', tempPin: null });

  const user = { id: userId, email, role, name };
  setSession(user);
  showApp(user);

  const { initApp } = await import('./app.js');
  await initApp();
};

window._authVerifyPin = async function(userId, email, role, name) {
  const pin = getPinValue('pe', 4);
  if (pin.length !== 4) {
    showAuthError('Enter your 4-digit PIN.');
    return;
  }

  const pinHash = await hashPin(pin);
  const user = await findUser(email);

  if (!user || user.pinHash !== pinHash) {
    showAuthError('Incorrect PIN. Please try again.');
    for (let i = 0; i < 4; i++) {
      const b = document.getElementById('pe' + i);
      if (b) { b.value = ''; b.classList.remove('filled'); }
    }
    document.getElementById('pe0')?.focus();
    return;
  }

  const sessionUser = { id: userId, email, role, name };
  setSession(sessionUser);
  showApp(sessionUser);

  const { initApp } = await import('./app.js');
  await initApp();
};

window._authVerifyTemp = async function(userId, email, role, name) {
  const pin = getPinValue('pt', 4);
  if (pin.length !== 4) {
    showAuthError('Enter the temporary PIN.');
    return;
  }

  const user = await findUser(email);
  const tempHash = await hashPin(pin);

  if (!user || user.tempPin !== tempHash) {
    showAuthError('Incorrect temporary PIN. Ask admin for a new one.');
    return;
  }

  renderSetPinStep({ ...user, status: 'pending' });
};

window._authForgotPin = async function(email) {
  const card = document.getElementById('auth-card');
  card.innerHTML = `
    <div class="auth-heading">Forgot PIN?</div>
    <div class="auth-sub">
      Contact <strong>Shanthini K</strong> (shanthini.k@kriyadocs.com) to reset
      your PIN. They will provide a temporary PIN to log in.
    </div>
    <button class="auth-btn" onclick="window._authBack()">← Back to Login</button>`;
};

window._authBack = function() {
  renderEmailStep();
};

window._authLogout = function() {
  clearSession();
  location.reload();
};

window._authShowUserMenu = function() {
  const existing = document.getElementById('user-menu-popup');
  if (existing) { existing.remove(); return; }

  const user = getSession();
  const popup = document.createElement('div');
  popup.id = 'user-menu-popup';
  popup.style.cssText = `
    position:fixed;top:52px;right:16px;
    background:white;border:1px solid var(--border);
    border-radius:10px;box-shadow:var(--shm);
    padding:8px;z-index:1000;min-width:180px`;
  popup.innerHTML = `
    <div style="padding:8px 12px 10px;border-bottom:1px solid var(--border);margin-bottom:4px">
      <div style="font-size:13px;font-weight:700;color:var(--navy)">${user?.name || ''}</div>
      <div style="font-size:11px;color:var(--lt)">${user?.email || ''}</div>
      <span class="badge badge-navy" style="margin-top:4px">${user?.role || ''}</span>
    </div>
    <button onclick="document.getElementById('user-menu-popup')?.remove();window._authChangePin()"
      style="width:100%;text-align:left;padding:8px 12px;border:none;background:none;
        font-size:12px;font-family:'DM Sans',sans-serif;cursor:pointer;border-radius:6px;color:var(--text)"
      onmouseover="this.style.background='var(--bg)'"
      onmouseout="this.style.background='none'">
      🔑 Change PIN
    </button>
    <button onclick="window._authLogout()"
      style="width:100%;text-align:left;padding:8px 12px;border:none;background:none;
        font-size:12px;font-family:'DM Sans',sans-serif;cursor:pointer;border-radius:6px;color:#dc2626"
      onmouseover="this.style.background='#fef2f2'"
      onmouseout="this.style.background='none'">
      🚪 Sign Out
    </button>`;
  document.body.appendChild(popup);

  setTimeout(() => {
    document.addEventListener('click', function h(e) {
      if (!popup.contains(e.target) && e.target.closest('.user-chip') === null) {
        popup.remove();
        document.removeEventListener('click', h);
      }
    });
  }, 10);
};

window._authChangePin = function() {
  const session = getSession();
  if (!session) return;
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-shell').style.display = 'none';
  renderSetPinStep({ ...session, status: 'pending' });
};
