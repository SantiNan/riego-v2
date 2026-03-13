// ═══════════════════════════════════════════════════
//  mqtt.js  —  equivalente a mqtt_comm.h del firmware
//
//  Gestiona la conexión al broker, suscripciones y
//  publicación. Expone callbacks que el orquestador
//  (app.js) conecta a los handlers de negocio.
// ═══════════════════════════════════════════════════

import { MQTT, TOPICS } from './config.js';

// ── Estado interno del módulo ────────────────────────
let _client    = null;
let _connected = false;

// ── Callbacks (se asignan desde app.js) ─────────────
export const on = {
  connect:    () => {},
  disconnect: () => {},
  status:     (_msg) => {},
  programs:   (_msg) => {},
  ack:        (_msg) => {},
};

// ── API pública ──────────────────────────────────────

/** Inicializa la conexión MQTT. Requiere que mqtt.min.js esté cargado globalmente. */
export function connect() {
  const url = `wss://${MQTT.host}:${MQTT.port}/mqtt`;

  _client = window.mqtt.connect(url, {
    username:        MQTT.username,
    password:        MQTT.password,
    clientId:        MQTT.clientId,
    clean:           true,
    reconnectPeriod: 3000,
    connectTimeout:  10000,
  });

  _client.on('connect', _onConnect);
  _client.on('reconnect', () => { _connected = false; on.disconnect(); });
  _client.on('offline',   () => { _connected = false; on.disconnect(); });
  _client.on('error',     (err) => { console.error('[MQTT]', err); _connected = false; on.disconnect(); });
  _client.on('message',   _onMessage);
}

/** Publica un objeto JSON en un topic. */
export function publish(topic, payload) {
  if (!_client || !_connected) return false;
  _client.publish(topic, JSON.stringify(payload));
  return true;
}

export function isConnected() { return _connected; }

// ── Handlers internos ────────────────────────────────

function _onConnect() {
  _connected = true;
  _client.subscribe([TOPICS.status, TOPICS.programs, TOPICS.ack]);
  on.connect();
}

function _onMessage(topic, payload) {
  let msg;
  try { msg = JSON.parse(payload.toString()); }
  catch (e) { console.warn('[MQTT] Parse error:', e); return; }

  if      (topic === TOPICS.status)   on.status(msg);
  else if (topic === TOPICS.programs) on.programs(msg);
  else if (topic === TOPICS.ack)      on.ack(msg);
}
