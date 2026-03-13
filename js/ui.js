// ═══════════════════════════════════════════════════
//  ui.js  —  rendering y actualizaciones del DOM
//
//  Responsabilidad única: reflejar el estado de la
//  app en la pantalla. No envía comandos MQTT ni
//  contiene lógica de negocio.
// ═══════════════════════════════════════════════════

import { ZONE_COLORS } from './config.js';
import { formatDays } from './programs.js';

// ── Status dot ───────────────────────────────────────

export function setOnlineStatus(online) {
  const dot = document.getElementById('status-dot');
  dot.className = 'status-dot ' + (online ? 'online' : 'offline');
}

// ── Program list ─────────────────────────────────────

/**
 * Renderiza la lista de programas en el home.
 * @param {Array}  programs  - Array de programas del ESP
 * @param {object} status    - Último riego/status (para marcar el activo)
 * @param {object} callbacks - { onToggle(id, enabled), onEdit(id) }
 */
export function renderProgramList(programs, status, callbacks) {
  const list  = document.getElementById('programs-list');
  const empty = document.getElementById('empty-state');
  list.innerHTML = '';

  const used = programs.filter(Boolean);
  if (used.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const sorted = [...used].sort((a, b) => a.start.localeCompare(b.start));
  sorted.forEach(prog => {
    const card = _buildProgramCard(prog, status, callbacks);
    list.appendChild(card);
  });
}

function _buildProgramCard(prog, status, { onToggle, onEdit }) {
  const isActive =
    status &&
    (status.mode === 'program' || status.mode === 'paused') &&
    status.program === prog.id;

  const div = document.createElement('div');
  div.className = `program-card${!prog.enabled ? ' disabled' : ''}${isActive ? ' active-card' : ''}`;
  div.dataset.id = prog.id;

  const dotHtml = prog.zones
    .map((z, i) => `<div class="zdot ${ZONE_COLORS[i]}${z > 0 ? ' on' : ''}"></div>`)
    .join('');

  div.innerHTML = `
    <div class="program-card-left">
      <div class="program-time">${prog.start}</div>
      <div class="program-meta">
        <span class="program-days">${formatDays(prog.days)}</span>
        <div class="program-zones-dots">${dotHtml}</div>
      </div>
    </div>
    <div class="program-card-right">
      <label class="toggle-switch" onclick="event.stopPropagation()">
        <input type="checkbox" ${prog.enabled ? 'checked' : ''} data-prog-toggle="${prog.id}">
        <span class="slider"></span>
      </label>
      <div class="chevron-right">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </div>
    </div>
  `;

  div.addEventListener('click', () => onEdit(prog.id));
  div.querySelector(`[data-prog-toggle="${prog.id}"]`)
    .addEventListener('change', (e) => {
      e.stopPropagation();
      onToggle(prog.id, e.target.checked);
    });

  return div;
}

// ── Mini player ──────────────────────────────────────

export function updateMiniPlayer(status) {
  const mp         = document.getElementById('mini-player');
  const miniTitle  = document.getElementById('mini-title');
  const miniSub    = document.getElementById('mini-sub');
  const pauseBtn   = document.getElementById('btn-pause-mini');

  if (!status || status.mode === 'idle') {
    mp.classList.add('hidden');
    mp.classList.remove('paused');
    return;
  }

  mp.classList.remove('hidden');
  const isPaused = status.mode === 'paused';
  mp.classList.toggle('paused', isPaused);

  pauseBtn.innerHTML = isPaused ? _iconPlay(22) : _iconPause(22);

  miniTitle.textContent = _irrigationTitle(status);
  miniSub.textContent   = status.remaining != null
    ? `${status.remaining} min restante${status.remaining !== 1 ? 's' : ''}`
    : '';
}

// ── Expanded player ──────────────────────────────────

export function openExpandedPlayer()  { document.getElementById('expanded-player').classList.remove('hidden'); }
export function closeExpandedPlayer() { document.getElementById('expanded-player').classList.add('hidden'); }

/**
 * Actualiza el contenido del player expandido.
 * @param {object} status    - riego/status del ESP
 * @param {Array}  programs  - lista de programas (para chips de zonas)
 * @param {number} totalMins - duración total de la zona en curso (para progreso)
 */
export function updateExpandedPlayer(status, programs, totalMins) {
  if (!status || status.mode === 'idle') return;

  const ep         = document.getElementById('expanded-player');
  const epLabel    = document.getElementById('ep-label');
  const epZone     = document.getElementById('ep-zone');
  const epRemain   = document.getElementById('ep-remaining');
  const epElapsed  = document.getElementById('ep-elapsed');
  const epFill     = document.getElementById('ep-progress-fill');
  const epZonesSt  = document.getElementById('ep-zones-status');
  const pauseIcon  = document.getElementById('ep-pause-icon');
  const isPaused   = status.mode === 'paused';

  ep.classList.toggle('paused', isPaused);

  epLabel.textContent = status.mode === 'manual'
    ? 'RIEGO MANUAL'
    : `PROGRAMA ${status.program ?? '?'}`;

  epZone.textContent = `Zona ${status.zone ?? '?'}`;

  const rem = status.remaining ?? 0;
  epRemain.textContent = `${rem} min`;

  pauseIcon.innerHTML = isPaused
    ? '<path d="M5 3l14 9-14 9V3z"/>'
    : '<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>';

  // Barra de progreso
  if (totalMins > 0) {
    const elapsed = Math.max(0, totalMins - rem);
    const pct     = Math.min(100, (elapsed / totalMins) * 100);
    epFill.style.width  = pct + '%';
    epElapsed.textContent = `${elapsed} min`;
  } else {
    epElapsed.textContent = '0 min';
  }

  // Chips de zonas (solo en modo programa)
  if (status.mode === 'program' || status.mode === 'paused') {
    const prog = programs.find(p => p && p.id === status.program);
    epZonesSt.innerHTML = prog
      ? prog.zones.map((z, i) => {
          if (z === 0) return '';
          const active = (i + 1) === status.zone;
          return `<div class="ep-zone-chip${active ? ' active-zone' : ''}">
            <div class="zdot ${ZONE_COLORS[i]}"></div>
            Zona ${i + 1}&nbsp;<strong>${z} min</strong>
          </div>`;
        }).join('')
      : '';
  } else {
    epZonesSt.innerHTML = '';
  }
}

// ── Program form ─────────────────────────────────────

/** Carga un programa en el formulario de edición. */
export function loadProgramForm(prog) {
  const isNew = !prog;

  document.getElementById('program-view-title').textContent =
    isNew ? 'Nuevo programa' : 'Editar programa';
  document.getElementById('edit-program-id').value  = isNew ? -1 : prog.id;
  document.getElementById('edit-enabled').checked   = isNew ? true : prog.enabled;
  document.getElementById('edit-time').value        = isNew ? '07:00' : prog.start;
  document.getElementById('delete-section').style.display = isNew ? 'none' : 'block';

  // Days
  const active = isNew ? [] : _decodeDaysBitmask(prog.days);
  document.querySelectorAll('.day-btn').forEach(b => {
    b.classList.toggle('selected', active.includes(parseInt(b.dataset.day)));
  });

  // Zones
  const zones = isNew ? [0, 0, 0, 0] : prog.zones;
  zones.forEach((z, i) => setZoneValue(i, z));
}

export function setZoneValue(idx, val) {
  val = Math.max(0, Math.min(255, val));
  document.getElementById(`zone-val-${idx}`).textContent = val;
  document.getElementById(`zone-input-${idx}`).value     = val;
}

export function getZoneValue(idx) {
  return parseInt(document.getElementById(`zone-input-${idx}`).value) || 0;
}

export function getFormData() {
  return {
    id:      parseInt(document.getElementById('edit-program-id').value),
    enabled: document.getElementById('edit-enabled').checked,
    start:   document.getElementById('edit-time').value,
    days:    [...document.querySelectorAll('.day-btn.selected')]
               .map(b => parseInt(b.dataset.day)),
    zones:   [0, 1, 2, 3].map(i => getZoneValue(i)),
  };
}

// ── Toast notifications ──────────────────────────────

export function showToast(msg, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast     = document.createElement('div');
  const icon      = type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ';
  toast.className = `toast${type !== 'info' ? ` ${type}` : ''}`;
  toast.innerHTML = `<span style="opacity:0.7">${icon}</span> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

// ── Confirm modal ────────────────────────────────────

export function showConfirmModal(title, body, onConfirm) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent  = body;
  document.getElementById('modal-overlay').classList.remove('hidden');
  // onConfirm se conecta una sola vez; el handler permanente está en app.js
  document.getElementById('modal-confirm')._pendingConfirm = onConfirm;
}

// ── Navigation ───────────────────────────────────────

const _viewStack = ['home'];

export function navigateTo(viewId) {
  const current = document.querySelector('.view.active');
  if (current) {
    current.classList.remove('active');
    current.classList.add('slide-out');
    setTimeout(() => current.classList.remove('slide-out'), 350);
  }
  document.getElementById(`view-${viewId}`).classList.add('active');
  _viewStack.push(viewId);
}

export function navigateBack() {
  _viewStack.pop();
  const prev = _viewStack[_viewStack.length - 1] || 'home';
  document.querySelector('.view.active')?.classList.remove('active');
  document.getElementById(`view-${prev}`).classList.add('active');
}

// ── Private helpers ──────────────────────────────────

function _irrigationTitle(status) {
  if (status.mode === 'manual')  return `Riego manual — Zona ${status.zone}`;
  if (status.mode === 'program') return `Programa ${status.program} — Zona ${status.zone}`;
  if (status.mode === 'paused')  return `Pausado — Zona ${status.zone}`;
  return '';
}

function _decodeDaysBitmask(bitmask) {
  const days = [];
  for (let i = 0; i <= 6; i++) if (bitmask & (1 << i)) days.push(i);
  return days;
}

function _iconPause(size) {
  return `<svg viewBox="0 0 24 24" fill="currentColor" width="${size}" height="${size}">
    <rect x="6" y="4" width="4" height="16" rx="1"/>
    <rect x="14" y="4" width="4" height="16" rx="1"/>
  </svg>`;
}

function _iconPlay(size) {
  return `<svg viewBox="0 0 24 24" fill="currentColor" width="${size}" height="${size}">
    <path d="M5 3l14 9-14 9V3z"/>
  </svg>`;
}
