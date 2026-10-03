/**
 * COMPONENTE: AuditLogRepository.gs
 * PAPEL: Data access layer para AuditLog
 *
 * RESPONSABILIDADE:
 * - CRUD primitivo e consultas de entradas de auditoria
 * - Sem lógica de negócio (regras de retenção, eventos específicos ficam no Service)
 * - Usa SpreadsheetGateway como único ponto de I/O
 *
 * STATUS: v1.0 — Implementado
 */

// ============================================================================
// LEITURA
// ============================================================================

/**
 * Obtém todo o audit log
 *
 * @returns {array}
 */
function getAllAuditLogs_() {
  return getAllRowsAsObjects_('AuditLog');
}

/**
 * Busca entrada de auditoria por ID
 *
 * @param {string} id
 * @returns {object|null}
 */
function getAuditLogById_(id) {
  return getRowById_('AuditLog', id);
}

/**
 * Busca logs por usuário
 *
 * @param {string} userId
 * @returns {array}
 */
function getAuditLogsByUser_(userId) {
  const logs = getAllAuditLogs_();
  return logs.filter(function(log) {
    return log.actorUserId === userId;
  });
}

/**
 * Busca logs por tipo de evento
 *
 * @param {string} eventType
 * @returns {array}
 */
function getAuditLogsByEvent_(eventType) {
  const logs = getAllAuditLogs_();
  return logs.filter(function(log) {
    return log.eventType === eventType;
  });
}

/**
 * Busca todos os logs de auditoria associados a um correlationId específico
 *
 * @param {string} correlationId - ID de correlação da requisição a rastrear
 * @returns {Array<object>}
 */
function getAuditLogsByCorrelationId_(correlationId) {
  const logs = getAllAuditLogs_();
  return logs.filter(function(log) {
    return log.correlationId === correlationId;
  });
}

/**
 * Busca logs por entidade
 *
 * @param {string} entityType
 * @param {string} [entityId]
 * @returns {array}
 */
function getAuditLogsByEntity_(entityType, entityId) {
  const logs = getAllAuditLogs_();
  return logs.filter(function(log) {
    if (log.entity !== entityType) return false;
    if (entityId && log.entityId !== entityId) return false;
    return true;
  });
}

/**
 * Busca logs em intervalo de datas
 *
 * @param {string} startIso
 * @param {string} endIso
 * @returns {array}
 */
function getAuditLogsByDateRange_(startIso, endIso) {
  const logs = getAllAuditLogs_();
  return logs.filter(function(log) {
    return isAfter_(log.createdAt, startIso) &&
           isBefore_(log.createdAt, endIso);
  });
}

/**
 * Conta logs por tipo de evento
 *
 * @returns {object}
 */
function getAuditLogCounts_() {
  const logs = getAllAuditLogs_();
  const counts = {};

  logs.forEach(function(log) {
    if (!counts[log.eventType]) {
      counts[log.eventType] = 0;
    }
    counts[log.eventType]++;
  });

  return counts;
}

// ============================================================================
// ESCRITA
// ============================================================================

/**
 * Persiste uma nova entrada de auditoria
 *
 * @param {object} entry — entrada já montada pelo Service
 * @returns {object} a própria entrada criada
 */
function createAuditLogEntry_(entry) {
  appendRow_('AuditLog', entry);
  return entry;
}

/**
 * Remove definitivamente uma entrada de auditoria
 *
 * @param {string} id
 * @returns {boolean}
 */
function deleteAuditLogEntry_(id) {
  return deleteRowById_('AuditLog', id);
}

// ============================================================================
// EXPORTAR
// ============================================================================

const AUDIT_LOG_REPOSITORY_LOADED = true;
