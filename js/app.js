// ═══════════════════════════════════════════════════
//  app.js  —  equivalente a riego.ino del firmware
//
//  Orquestador principal. Conecta los módulos entre
//  sí: no contiene lógica de negocio propia, solo
//  despacha eventos hacia el módulo correcto.
// ═══════════════════════════════════════════════════

import { OFFLINE_TIMEOUT_S, OFFLINE_CHECK_MS } from './config.js';
import * as MQTTClient  from './mqtt.js';
import * as Irrigation  from './irrigation.js';
import { findFreeSlot, validateProgram } from './programs.js';
import {
  setOnlineStatus,
  renderProgramList,
  updateMiniPlayer,
  updateExpandedPlayer,
  openExpandedPlayer,
  closeExpandedPlayer,
  loadProgramForm,
  setZoneValue,
  getZoneValue,
  getFormData,
  showToast,
  showConfirmModal,
  navigateTo,
  navigateBack,
} from './ui.js';

// ── Estado de la app ─────────────────────────────────
const state = {
  programs:  [],    // último riego/programs del ESP
  status:    null,  // último riego/status del ESP
  totalMins: 0,     // duración total de la zona en curso (para barra de progreso)
};

// Estado del formulario de riego manual
const manualForm = {
  zone:     1,
  duration: 20,
};

// ── Arranque ─────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  _initMQTTCallbacks();
  MQTTClient.connect();
  _initEventListeners();
  _startOfflineWatchdog();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }
});

// ── Callbacks MQTT → lógica de app ───────────────────

function _initMQTTCallbacks() {
  MQTTClient.on.connect = () => {
    setOnlineStatus(true);
    Irrigation.requestSync();
  };

  MQTTClient.on.disconnect = () => setOnlineStatus(false);

  MQTTClient.on.status = (msg) => {
    state.status = msg;
    updateMiniPlayer(msg);
    updateExpandedPlayer(msg, state.programs, state.totalMins);
  };

  MQTTClient.on.programs = (msg) => {
    if (!msg.programs) return;
    state.programs = msg.programs;
    renderProgramList(
      state.programs,
      state.status,
      { onToggle: _handleToggle, onEdit: _handleEditProgram }
    );
  };

  MQTTClient.on.ack = (msg) => {
    if (!msg.ok) {
      showToast(msg.error || 'Error en el comando', 'error');
      return;
    }
    if (msg.cmd === 'program' && (msg.action === 'set' || msg.action === 'delete')) {
      const verb = msg.action === 'set' ? 'guardado' : 'eliminado';
      showToast(`Programa ${verb} ✓`, 'success');
      Irrigation.requestSync();
      navigateBack();
    } else if (msg.cmd === 'manual' && msg.action === 'on') {
      showToast('Riego manual iniciado ✓', 'success');
      navigateBack();
    } else if (msg.cmd === 'manual' && msg.action === 'off') {
      showToast('Riego detenido', 'success');
    }
  };
}

// ── Handlers de negocio ──────────────────────────────

function _handleToggle(id, enabled) {
  const prog = state.programs.find(p => p && p.id === id);
  if (!prog) return;
  // Optimistic update local
  prog.enabled = enabled;
  Irrigation.setProgram({ id, enabled, days: prog.days, start: prog.start, zones: prog.zones });
}

function _handleEditProgram(id) {
  const prog = state.programs.find(p => p && p.id === id) ?? null;
  loadProgramForm(prog);
  navigateTo('program');
}

function _handleSaveProgram() {
  const data = getFormData();

  const error = validateProgram(data);
  if (error) { showToast(error, 'error'); return; }

  // Asignar slot libre si es programa nuevo
  if (data.id === -1) {
    data.id = findFreeSlot(state.programs);
    if (data.id === -1) {
      showToast('EEPROM llena (32 programas)', 'error');
      return;
    }
  }

  if (!MQTTClient.isConnected()) { showToast('Sin conexión', 'error'); return; }
  Irrigation.setProgram(data);
}

function _handleDeleteProgram() {
  const id = parseInt(document.getElementById('edit-program-id').value);
  showConfirmModal(
    '¿Eliminar programa?',
    'Esta acción lo eliminará de la EEPROM.',
    () => Irrigation.deleteProgram(id)
  );
}

function _handleStartManual() {
  if (!MQTTClient.isConnected()) { showToast('Sin conexión', 'error'); return; }
  state.totalMins = manualForm.duration;
  Irrigation.startManual(manualForm.zone, manualForm.duration);
}

function _handleStopIrrigation() {
  const s = state.status;
  if (!s || s.mode === 'idle') return;

  if (s.mode === 'manual') {
    Irrigation.stopManual();
  } else {
    showConfirmModal(
      '¿Detener riego?',
      'Se interrumpirá el programa en curso.',
      () => Irrigation.stopManual()
    );
  }
}

// ── Event listeners del DOM ──────────────────────────

function _initEventListeners() {
  // Header
  document.getElementById('btn-add-program').addEventListener('click', () => {
    loadProgramForm(null);
    navigateTo('program');
  });
  document.getElementById('btn-manual-quick').addEventListener('click', () => navigateTo('manual'));

  // Formulario de programa
  document.getElementById('btn-back-program').addEventListener('click', navigateBack);
  document.getElementById('btn-save-program').addEventListener('click', _handleSaveProgram);
  document.getElementById('btn-delete-program').addEventListener('click', _handleDeleteProgram);

  // Selector de días
  document.querySelectorAll('.day-btn').forEach(btn =>
    btn.addEventListener('click', () => btn.classList.toggle('selected'))
  );

  // Steppers de zona
  document.querySelectorAll('.zone-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx   = parseInt(btn.dataset.zone);
      const delta = btn.classList.contains('minus') ? -1 : 1;
      setZoneValue(idx, getZoneValue(idx) + delta);
    });
  });

  // Vista manual
  document.getElementById('btn-back-manual').addEventListener('click', navigateBack);
  document.getElementById('btn-start-manual').addEventListener('click', _handleStartManual);

  document.querySelectorAll('.zone-sel-btn').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.zone-sel-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      manualForm.zone = parseInt(btn.dataset.zone);
    })
  );

  document.querySelectorAll('.dur-preset').forEach(btn =>
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dur-preset').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      _setManualDuration(parseInt(btn.dataset.min));
    })
  );

  document.getElementById('dur-minus').addEventListener('click', () =>
    _setManualDuration(Math.max(1, manualForm.duration - 1))
  );
  document.getElementById('dur-plus').addEventListener('click', () =>
    _setManualDuration(Math.min(255, manualForm.duration + 1))
  );

  // Mini player
  document.getElementById('mini-player-inner').addEventListener('click', (e) => {
    if (!e.target.closest('.mini-btn')) openExpandedPlayer();
  });
  document.getElementById('btn-pause-mini').addEventListener('click', (e) => {
    e.stopPropagation();
    Irrigation.togglePause(state.status);
  });
  document.getElementById('btn-stop-mini').addEventListener('click', (e) => {
    e.stopPropagation();
    _handleStopIrrigation();
  });

  // Expanded player
  document.getElementById('btn-close-player').addEventListener('click', closeExpandedPlayer);
  document.getElementById('btn-pause-expanded').addEventListener('click', () =>
    Irrigation.togglePause(state.status)
  );
  document.getElementById('btn-stop-expanded').addEventListener('click', _handleStopIrrigation);

  // Modal
  document.getElementById('modal-cancel').addEventListener('click', () =>
    document.getElementById('modal-overlay').classList.add('hidden')
  );
  document.getElementById('modal-confirm').addEventListener('click', () => {
    document.getElementById('modal-overlay').classList.add('hidden');
    const fn = document.getElementById('modal-confirm')._pendingConfirm;
    if (fn) fn();
  });
}

// ── Watchdog offline ─────────────────────────────────

function _startOfflineWatchdog() {
  setInterval(() => {
    if (!state.status) return;
    const age = Math.floor(Date.now() / 1000) - state.status.timestamp;
    if (age > OFFLINE_TIMEOUT_S) setOnlineStatus(false);
  }, OFFLINE_CHECK_MS);
}

// ── Helper duración manual ───────────────────────────

function _setManualDuration(val) {
  manualForm.duration = val;
  document.getElementById('dur-val').textContent   = val;
  document.getElementById('manual-duration').value = val;
}
