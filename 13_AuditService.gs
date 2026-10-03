/**
 * COMPONENTE: 13_AuditService.gs
 * PAPEL: Auditoria — rastreamento de TODAS as alterações
 *
 * RESPONSABILIDADE:
 * - Registrar eventos em AuditLog
 * - NUNCA logar dados sensíveis (senha, token)
 * - Correlacionar eventos por correlationId
 * - Limpar logs antigos periodicamente
 *
 * NOTA: Acesso primitivo a dados (getAllAuditLogs_, getAuditLogsBy*_,
 * create/delete) vive em AuditLogRepository.gs.
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// LOG DE AUDITORIA
// ============================================================================

/**
 * Registra evento de auditoria no AuditLog para rastreamento completo de alterações
 * 
 * Cria entrada estruturada no log de auditoria com timestamp, ator, entidade afetada,
 * tipo de ação e detalhes serializados. NUNCA inclua dados sensíveis (senhas, tokens)
 * nos detalhes. O correlationId permite rastrear múltiplos eventos de uma mesma requisição.
 *
 * @param {string} eventType - Tipo do evento: AUTH_SUCCESS, AUTH_FAILURE, CREATE, UPDATE, DELETE, etc.
 * @param {string} entityType - Tipo da entidade: User, Study, Experiment, Session, etc.
 * @param {string} entityId - ID do registro afetado (usar 'N/A' se não aplicável)
 * @param {string} action - Ação realizada: CREATE, UPDATE, DELETE, SOFT_DELETE, AUTH, EXPORT, IMPORT, VALIDATE
 * @param {string|null} userId - ID do usuário que realizou a ação (null para eventos de sistema)
 * @param {object} [details={}] - Objeto com detalhes da alteração (será serializado como JSON)
 * @param {string|null} [correlationId] - ID de correlação para agrupar eventos relacionados
 * @returns {void}
 * @example
 * logAudit_('CREATE', 'User', 'usr_123', 'CREATE', 'usr_admin', 
 *   {username: 'john', role: 'VIEWER'}, 'req_789');
 */
function logAudit_(eventType, entityType, entityId, action, userId, details, correlationId) {
  if (!isAuditLogEnabled_()) {
    return;
  }

  try {
    const auditEntry = {
      id: generateUUID_(),
      eventType: eventType,
      actorUserId: userId || null,
      entity: entityType,
      entityId: entityId,
      action: action,
      correlationId: correlationId || 'N/A',
      detailsJson: JSON.stringify(details || {}),
      createdAt: nowIso_()
    };

    createAuditLogEntry_(auditEntry);
  } catch (error) {
    logError_('Falha ao registrar auditoria', {
      eventType: eventType,
      error: error.message
    });
  }
}

/**
 * Log simplificado (para chamadas frequentes)
 */
function audit_(eventType, entityId, details) {
  logAudit_(
    eventType,
    'Unknown',
    entityId,
    'SYSTEM',
    null,
    details,
    null
  );
}

// ============================================================================
// EVENTOS ESPECÍFICOS
// ============================================================================

/**
 * Log: Autenticação bem-sucedida
 */
function auditAuthSuccess_(userId, details) {
  logAudit_(
    AUDIT_EVENT_TYPE.AUTH_SUCCESS,
    'User',
    userId,
    'AUTH',
    userId,
    details,
    null
  );
}

/**
 * Log: Falha de autenticação
 */
function auditAuthFailure_(username, reason) {
  logAudit_(
    AUDIT_EVENT_TYPE.AUTH_FAILURE,
    'User',
    'N/A',
    'AUTH',
    null,
    { username: username, reason: reason },
    null
  );
}

/**
 * Log: Logout
 */
function auditLogout_(userId) {
  logAudit_(
    AUDIT_EVENT_TYPE.LOGOUT,
    'Session',
    'N/A',
    'DELETE',
    userId,
    { action: 'logout' },
    null
  );
}

/**
 * Log: Permissão negada
 */
function auditPermissionDenied_(userId, action, resource) {
  logAudit_(
    AUDIT_EVENT_TYPE.PERMISSION_DENIED,
    resource,
    'N/A',
    action,
    userId,
    { action: action, resource: resource },
    null
  );
}

/**
 * Log: Criação de entidade
 */
function auditCreate_(entityType, entityId, userId, details, correlationId) {
  logAudit_(
    AUDIT_EVENT_TYPE.CREATE,
    entityType,
    entityId,
    AUDIT_ACTION.CREATE,
    userId,
    details,
    correlationId
  );
}

/**
 * Log: Atualização de entidade
 */
function auditUpdate_(entityType, entityId, userId, oldData, newData, correlationId) {
  const changes = {};
  for (let key in newData) {
    if (newData[key] !== oldData[key]) {
      changes[key] = {
        old: oldData[key],
        new: newData[key]
      };
    }
  }

  logAudit_(
    AUDIT_EVENT_TYPE.UPDATE,
    entityType,
    entityId,
    AUDIT_ACTION.UPDATE,
    userId,
    { changes: changes },
    correlationId
  );
}

/**
 * Log: Deleção física
 */
function auditDelete_(entityType, entityId, userId, details, correlationId) {
  logAudit_(
    AUDIT_EVENT_TYPE.DELETE,
    entityType,
    entityId,
    AUDIT_ACTION.DELETE,
    userId,
    details,
    correlationId
  );
}

/**
 * Log: Deleção lógica (soft delete)
 */
function auditSoftDelete_(entityType, entityId, userId, correlationId) {
  logAudit_(
    AUDIT_EVENT_TYPE.DELETE,
    entityType,
    entityId,
    AUDIT_ACTION.SOFT_DELETE,
    userId,
    { type: 'soft_delete', status: 'ARCHIVED' },
    correlationId
  );
}

/**
 * Log: Exportação de dados
 */
function auditExport_(format, scope, userId) {
  logAudit_(
    AUDIT_EVENT_TYPE.EXPORT,
    'Data',
    'EXPORT_' + format.toUpperCase(),
    'EXPORT',
    userId,
    { format: format, scope: scope },
    null
  );
}

/**
 * Log: Importação de dados
 */
function auditImport_(format, rowCount, userId) {
  logAudit_(
    AUDIT_EVENT_TYPE.IMPORT,
    'Data',
    'IMPORT_' + format.toUpperCase(),
    'IMPORT',
    userId,
    { format: format, rowCount: rowCount },
    null
  );
}

/**
 * Log: Execução de validação
 */
function auditValidationRun_(validationRunId, userId, scope) {
  logAudit_(
    AUDIT_EVENT_TYPE.VALIDATION_RUN,
    'ValidationRun',
    validationRunId,
    'VALIDATE',
    userId,
    { scope: scope },
    null
  );
}

/**
 * Log: Erro do sistema
 */
function auditSystemError_(error, context) {
  logAudit_(
    AUDIT_EVENT_TYPE.SYSTEM_ERROR,
    'System',
    'ERROR',
    'SYSTEM',
    null,
    { error: error.message, context: context },
    null
  );
}

// ============================================================================
// MANUTENÇÃO
// ============================================================================

/**
 * Limpa logs antigos (mais de 90 dias)
 * Deve ser executado periodicamente
 *
 * @returns {number} quantidade deletada
 */
function cleanupOldAuditLogs_() {
  const logs = getAllAuditLogs_();
  const ninetyDaysAgo = addDays_(-90);
  let deleted = 0;

  logs.forEach(function(log) {
    if (isBefore_(log.createdAt, ninetyDaysAgo)) {
      if (deleteAuditLogEntry_(log.id)) {
        deleted++;
      }
    }
  });

  logInfo_('Cleanup de AuditLog', { deleted: deleted });
  return deleted;
}

/**
 * Exporta logs para análise
 *
 * @param {string} startIso
 * @param {string} endIso
 * @returns {array}
 */
function exportAuditLogsForAnalysis_(startIso, endIso) {
  const logs = getAuditLogsByDateRange_(startIso, endIso);

  return logs.map(function(log) {
    const details = {};
    try {
      details.parsed = JSON.parse(log.detailsJson || '{}');
    } catch (e) {
      details.parsed = {};
    }

    return {
      timestamp: log.createdAt,
      eventType: log.eventType,
      actor: log.actorUserId,
      entity: log.entity,
      entityId: log.entityId,
      action: log.action,
      details: details.parsed
    };
  });
}

/**
 * Retorna estatísticas de auditoria
 *
 * @returns {object}
 */
function getAuditStats_() {
  const logs = getAllAuditLogs_();

  const eventCounts = getAuditLogCounts_();

  const userCounts = {};
  logs.forEach(function(log) {
    if (log.actorUserId) {
      if (!userCounts[log.actorUserId]) {
        userCounts[log.actorUserId] = 0;
      }
      userCounts[log.actorUserId]++;
    }
  });

  const mostActiveUser = Object.keys(userCounts).reduce(function(a, b) {
    return userCounts[a] > userCounts[b] ? a : b;
  }, null);

  return {
    total: logs.length,
    eventTypes: eventCounts,
    mostActiveUser: mostActiveUser,
    maxActionsPerUser: Math.max.apply(null, Object.values(userCounts)) || 0,
    timestamp: nowIso_()
  };
}

// ============================================================================
// EXPORTAR
// ============================================================================

const AUDIT_SERVICE_LOADED = true;
