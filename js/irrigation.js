// ═══════════════════════════════════════════════════
//  irrigation.js  —  equivalente a irrigation.h del firmware
//
//  Encapsula todos los comandos de control de riego:
//  manual on/off, pausa, reanudación.
//  No conoce el DOM — solo habla MQTT.
// ═══════════════════════════════════════════════════

import { TOPICS } from './config.js';
import { publish, isConnected } from './mqtt.js';

// ── Comandos de riego manual ─────────────────────────

/**
 * Inicia riego manual en una zona sin límite de tiempo.
 * El riego corre hasta recibir manual/off.
 * @param {number} zone - Zona 1-4 (1-based, igual que el protocolo)
 * @returns {boolean} false si no hay conexión
 */
export function startManual(zone) {
  if (!isConnected()) return false;
  publish(TOPICS.cmdManual, { action: 'on', zone });
  return true;
}

/**
 * Detiene cualquier riego manual en curso.
 * El ESP ignora este comando si no hay manual activo.
 */
export function stopManual() {
  if (!isConnected()) return false;
  publish(TOPICS.cmdManual, { action: 'off' });
  return true;
}

// ── Pausa / reanudación ──────────────────────────────

/**
 * Pausa el programa en ejecución.
 * El ESP responde con ack error si no hay programa activo.
 */
export function pauseProgram() {
  if (!isConnected()) return false;
  publish(TOPICS.cmdPause, { action: 'pause' });
  return true;
}

/**
 * Reanuda el programa pausado.
 * El ESP responde con ack error si no hay pausa activa o hay manual en curso.
 */
export function resumeProgram() {
  if (!isConnected()) return false;
  publish(TOPICS.cmdPause, { action: 'resume' });
  return true;
}

// ── Toggle pausa (decide según el estado actual) ─────

/**
 * Alterna entre pausar y reanudar según el modo actual del status.
 * @param {object} status - Último riego/status recibido del ESP
 */
export function togglePause(status) {
  if (!status) return false;
  if (status.mode === 'program') return pauseProgram();
  if (status.mode === 'paused')  return resumeProgram();
  return false;
}

// ── Comandos de programas ────────────────────────────

/**
 * Guarda o edita un programa en la EEPROM del ESP.
 * @param {object} prog - { id, enabled, days (array), start, zones (array) }
 */
export function setProgram(prog) {
  if (!isConnected()) return false;
  publish(TOPICS.cmdProgram, { action: 'set', ...prog });
  return true;
}

/**
 * Elimina un programa de la EEPROM.
 * @param {number} id - Slot 0-31
 */
export function deleteProgram(id) {
  if (!isConnected()) return false;
  publish(TOPICS.cmdProgram, { action: 'delete', id });
  return true;
}

/** Solicita al ESP que publique la lista de programas y el status. */
export function requestSync() {
  if (!isConnected()) return false;
  publish(TOPICS.cmdSync, {});
  return true;
}
