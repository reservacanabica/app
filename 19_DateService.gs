/**
 * COMPONENTE: 19_DateService.gs
 * PAPEL: Manipulação de datas — ISO 8601 UTC, cálculos TTL, comparações
 *
 * PADRÃO UNIVERSAL:
 * - Sempre usar ISO 8601: YYYY-MM-DDTHH:mm:ss.sssZ
 * - Sempre UTC (Z suffix)
 * - Nunca armazenar em timestamp (use string ISO)
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// GETTERS DE DATA ATUAL
// ============================================================================

/**
 * Retorna data/hora atual em ISO 8601 UTC
 * Usado em TODOS os timestamps
 *
 * @returns {string} ex: "2026-09-30T12:34:56.789Z"
 */
function nowIso_() {
  return new Date().toISOString();
}

/**
 * Retorna timestamp Unix (ms)
 *
 * @returns {number}
 */
function nowUnix_() {
  return Date.now();
}

/**
 * Retorna apenas data em ISO (sem hora)
 *
 * @returns {string} ex: "2026-09-30"
 */
function todayIso_() {
  return new Date().toISOString().split('T')[0];
}

// ============================================================================
// CÁLCULOS COM TTL
// ============================================================================

/**
 * Calcula expiração adicionando horas
 *
 * @param {number} hours
 * @param {string} baseIso (opcional, default = now)
 * @returns {string} data expiração em ISO
 */
function addHours_(hours, baseIso) {
  const base = baseIso ? new Date(baseIso) : new Date();
  base.setHours(base.getHours() + hours);
  return base.toISOString();
}

/**
 * Calcula expiração adicionando minutos
 *
 * @param {number} minutes
 * @param {string} baseIso (opcional)
 * @returns {string}
 */
function addMinutes_(minutes, baseIso) {
  const base = baseIso ? new Date(baseIso) : new Date();
  base.setMinutes(base.getMinutes() + minutes);
  return base.toISOString();
}

/**
 * Calcula expiração adicionando segundos
 *
 * @param {number} seconds
 * @param {string} baseIso (opcional)
 * @returns {string}
 */
function addSeconds_(seconds, baseIso) {
  const base = baseIso ? new Date(baseIso) : new Date();
  base.setSeconds(base.getSeconds() + seconds);
  return base.toISOString();
}

/**
 * Calcula expiração adicionando dias
 *
 * @param {number} days
 * @param {string} baseIso (opcional)
 * @returns {string}
 */
function addDays_(days, baseIso) {
  const base = baseIso ? new Date(baseIso) : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString();
}

// ============================================================================
// COMPARAÇÕES
// ============================================================================

/**
 * Verifica se data está expirada
 *
 * @param {string} expirationIso
 * @returns {boolean} true se expirado
 */
function isExpired_(expirationIso) {
  if (!expirationIso) return true;
  const now = new Date();
  const expiration = new Date(expirationIso);
  return now > expiration;
}

/**
 * Verifica se data ainda é válida
 *
 * @param {string} expirationIso
 * @returns {boolean} true se válido (não expirado)
 */
function isValid_(expirationIso) {
  return !isExpired_(expirationIso);
}

/**
 * Calcula tempo restante até expiração (em ms)
 *
 * @param {string} expirationIso
 * @returns {number} ms até expiração (negativo se já expirado)
 */
function timeUntilExpiration_(expirationIso) {
  const now = new Date().getTime();
  const expiration = new Date(expirationIso).getTime();
  return expiration - now;
}

/**
 * Verifica se data1 é anterior a data2
 *
 * @param {string} iso1
 * @param {string} iso2
 * @returns {boolean}
 */
function isBefore_(iso1, iso2) {
  return new Date(iso1) < new Date(iso2);
}

/**
 * Verifica se data1 é posterior a data2
 *
 * @param {string} iso1
 * @param {string} iso2
 * @returns {boolean}
 */
function isAfter_(iso1, iso2) {
  return new Date(iso1) > new Date(iso2);
}

/**
 * Diferença entre duas datas em dias
 *
 * @param {string} iso1
 * @param {string} iso2
 * @returns {number} dias (negativo se iso1 < iso2)
 */
function daysBetween_(iso1, iso2) {
  const d1 = new Date(iso1).getTime();
  const d2 = new Date(iso2).getTime();
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * Diferença entre duas datas em horas
 *
 * @param {string} iso1
 * @param {string} iso2
 * @returns {number}
 */
function hoursBetween_(iso1, iso2) {
  const d1 = new Date(iso1).getTime();
  const d2 = new Date(iso2).getTime();
  return Math.floor((d2 - d1) / (1000 * 60 * 60));
}

// ============================================================================
// FORMATAÇÃO
// ============================================================================

/**
 * Formata ISO para formato legível
 * ex: "2026-09-30" ou "Sep 30, 2026"
 *
 * @param {string} isoString
 * @param {string} format (default: 'date' — outros: 'datetime', 'time')
 * @returns {string}
 */
function formatDate_(isoString, format) {
  if (!isoString) return '';

  format = format || 'date';
  const date = new Date(isoString);

  if (format === 'date') {
    return date.toLocaleDateString('pt-BR');
  } else if (format === 'time') {
    return date.toLocaleTimeString('pt-BR');
  } else if (format === 'datetime') {
    return date.toLocaleString('pt-BR');
  }

  return isoString;
}

/**
 * Formata diferença de tempo em texto legível
 * ex: "2 hours ago", "3 days ago"
 *
 * @param {string} pastIso
 * @param {string} baseIso (opcional, default = now)
 * @returns {string}
 */
function formatTimeAgo_(pastIso, baseIso) {
  const base = baseIso ? new Date(baseIso) : new Date();
  const past = new Date(pastIso);
  const diffMs = base.getTime() - past.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return diffSecs + ' segundo' + (diffSecs !== 1 ? 's' : '');
  } else if (diffMins < 60) {
    return diffMins + ' minuto' + (diffMins !== 1 ? 's' : '');
  } else if (diffHours < 24) {
    return diffHours + ' hora' + (diffHours !== 1 ? 's' : '');
  } else {
    return diffDays + ' dia' + (diffDays !== 1 ? 's' : '');
  }
}

// ============================================================================
// PARSING
// ============================================================================

/**
 * Parse string ISO → objeto Date
 *
 * @param {string} isoString
 * @returns {Date|null}
 */
function parseIso_(isoString) {
  if (!isoString) return null;
  const date = new Date(isoString);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * Extract apenas a data (remove hora)
 *
 * @param {string} isoString
 * @returns {string} ex: "2026-09-30"
 */
function getDatePart_(isoString) {
  if (!isoString) return '';
  return isoString.split('T')[0];
}

/**
 * Extract apenas a hora (remove data)
 *
 * @param {string} isoString
 * @returns {string} ex: "12:34:56"
 */
function getTimePart_(isoString) {
  if (!isoString) return '';
  const time = isoString.split('T')[1];
  return time ? time.split('.')[0] : '';
}

// ============================================================================
// VALIDAÇÕES
// ============================================================================

/**
 * Valida formato ISO 8601
 *
 * @param {string} isoString
 * @returns {boolean}
 */
function isValidIso_(isoString) {
  if (!isoString || typeof isoString !== 'string') {
    return false;
  }
  const date = new Date(isoString);
  return !isNaN(date.getTime());
}

/**
 * Valida que data está no passado (para observações)
 *
 * @param {string} isoString
 * @returns {boolean}
 */
function isPastDate_(isoString) {
  if (!isValidIso_(isoString)) return false;
  const date = new Date(isoString);
  const now = new Date();
  return date < now;
}

/**
 * Valida que data está no futuro
 *
 * @param {string} isoString
 * @returns {boolean}
 */
function isFutureDate_(isoString) {
  if (!isValidIso_(isoString)) return false;
  const date = new Date(isoString);
  const now = new Date();
  return date > now;
}

// ============================================================================
// SESSION TTL
// ============================================================================

/**
 * Calcula data de expiração de sessão
 * Baseado em SESSION_TTL_HOURS de config
 *
 * @param {string} baseIso (opcional)
 * @returns {string}
 */
function calculateSessionExpiration_(baseIso) {
  const ttlHours = getSessionTTLHours_();
  return addHours_(ttlHours, baseIso);
}

/**
 * Verifica se sessão está prestes a expirar (< 5 minutos)
 *
 * @param {string} expirationIso
 * @returns {boolean}
 */
function isSessionAboutToExpire_(expirationIso) {
  const timeRemaining = timeUntilExpiration_(expirationIso);
  const fiveMinutesMs = 5 * 60 * 1000;
  return timeRemaining > 0 && timeRemaining < fiveMinutesMs;
}

// ============================================================================
// EXPORTAR
// ============================================================================

const DATE_SERVICE_LOADED = true;
