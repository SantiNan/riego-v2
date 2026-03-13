// ═══════════════════════════════════════════════════
//  programs.js  —  equivalente a storage.h del firmware
//
//  Lógica de datos de programas: encode/decode de
//  bitmask de días, validación, búsqueda de slot libre.
//  No toca el DOM ni MQTT — solo datos puros.
// ═══════════════════════════════════════════════════

import { MAX_PROGRAMS, DAY_FULL } from './config.js';

// ── Bitmask helpers ──────────────────────────────────

/** Convierte array de días [0..6] a bitmask uint8.
 *  Mismo encoding que el firmware: bit N = día N (0=dom). */
export function encodeDays(daysArray) {
  return daysArray.reduce((acc, d) => acc | (1 << d), 0);
}

/** Convierte bitmask a array de índices de días activos. */
export function decodeDays(bitmask) {
  const days = [];
  for (let i = 0; i <= 6; i++) {
    if (bitmask & (1 << i)) days.push(i);
  }
  return days;
}

/** Convierte bitmask a string legible para mostrar en UI. */
export function formatDays(bitmask) {
  if (bitmask === 0)   return 'Nunca';
  if (bitmask === 127) return 'Todos los días';
  if (bitmask === 65)  return 'Fines de semana';  // bit0 (dom) + bit6 (sáb)
  if (bitmask === 62)  return 'Lun – Vie';        // bits 1–5

  // Mostrar en orden L-M-X-J-V-S-D
  const order = [1, 2, 3, 4, 5, 6, 0];
  const active = decodeDays(bitmask);
  return order
    .filter(d => active.includes(d))
    .map(d => DAY_FULL[d])
    .join(', ');
}

// ── Slot management ──────────────────────────────────

/** Devuelve el primer ID de slot libre, o -1 si la EEPROM está llena. */
export function findFreeSlot(programs) {
  const used = new Set(programs.filter(Boolean).map(p => p.id));
  for (let i = 0; i < MAX_PROGRAMS; i++) {
    if (!used.has(i)) return i;
  }
  return -1;
}

// ── Validación ───────────────────────────────────────

/**
 * Valida los datos de un programa antes de enviarlo al ESP.
 * Retorna null si es válido, o un string con el mensaje de error.
 */
export function validateProgram({ days, zones }) {
  if (!days || days.length === 0)
    return 'Seleccioná al menos un día';
  if (!zones || zones.every(z => z === 0))
    return 'Configurá al menos una zona';
  return null;
}

// ── Sorting ──────────────────────────────────────────

/** Ordena programas por hora de inicio (string "HH:MM"). */
export function sortByTime(programs) {
  return [...programs].sort((a, b) => a.start.localeCompare(b.start));
}
