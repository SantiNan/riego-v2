// ═══════════════════════════════════════════════════
//  config.js  —  equivalente a config.h del firmware
//
//  Único archivo que hay que tocar para cambiar
//  credenciales o ajustar constantes de la app.
// ═══════════════════════════════════════════════════

// ── Broker MQTT ─────────────────────────────────────
export const MQTT = {
  host:     '8102444dc84b4a3cbdc8bef567d51698.s1.eu.hivemq.cloud',
  port:     8884,
  username: 'espRiego',
  password: 'Riego1234',
  // Client ID único por sesión (igual que en el firmware: "web-riego-{rand}")
  clientId: 'web-riego-' + Math.random().toString(16).slice(2, 10),
};

// ── Topics MQTT ──────────────────────────────────────
export const TOPICS = {
  // ESP escucha
  cmdProgram: 'riego/cmd/program',
  cmdManual:  'riego/cmd/manual',
  cmdSync:    'riego/cmd/sync',
  cmdPause:   'riego/cmd/pause',
  // ESP publica
  status:     'riego/status',
  programs:   'riego/programs',
  ack:        'riego/ack',
};

// ── Límites (espejo de config.h) ─────────────────────
export const MAX_PROGRAMS  = 32;   // slots de EEPROM
export const MAX_ZONES     = 4;
export const MAX_DURATION  = 255;  // minutos, uint8_t

// ── Timeouts y polling ───────────────────────────────
export const OFFLINE_TIMEOUT_S = 90;   // sin status → offline
export const OFFLINE_CHECK_MS  = 15000;

// ── Colores por zona (CSS var names) ─────────────────
export const ZONE_COLORS = ['z1', 'z2', 'z3', 'z4'];

// ── Nombres de días ──────────────────────────────────
export const DAY_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
export const DAY_FULL  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
