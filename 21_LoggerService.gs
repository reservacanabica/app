/**
 * COMPONENTE: 21_LoggerService.gs
 * PAPEL: Logging estruturado centralizado
 *
 * NÍVEIS: DEBUG, INFO, WARN, ERROR
 * Usa Logger.log() + formatação estruturada
 * NUNCA logar senhas, tokens, dados sensíveis
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

/**
 * Mapeia string de nível para valor numérico
 */
function getLevelValue_(levelStr) {
  return LOG_LEVELS[levelStr] || LOG_LEVELS.INFO;
}

/**
 * Obtém nível configurado
 */
function getCurrentLogLevel_() {
  const levelStr = getLogLevel_();
  return getLevelValue_(levelStr);
}

/**
 * Verifica se nível deve ser logado
 */
function shouldLog_(levelStr) {
  return getLevelValue_(levelStr) >= getCurrentLogLevel_();
}

// ============================================================================
// FORMATADORES
// ============================================================================

/**
 * Formata mensagem de log estruturada
 */
function formatLogMessage_(level, message, data) {
  const timestamp = nowIso_();
  const levelPadded = level.padEnd(5);
  
  let output = '[' + timestamp + '] [' + levelPadded + '] ' + message;
  
  if (data && Object.keys(data).length > 0) {
    // Sanitizar dados antes de logar
    const sanitized = sanitizeForLog_(data);
    output += '\n  Data: ' + JSON.stringify(sanitized, null, 2);
  }
  
  return output;
}

/**
 * Formata erro com stack trace
 */
function formatErrorMessage_(message, error) {
  let output = message;
  
  if (error) {
    if (error.message) {
      output += '\n  Error: ' + error.message;
    }
    if (error.stack) {
      output += '\n  Stack: ' + error.stack;
    }
  }
  
  return output;
}

// ============================================================================
// FUNÇÕES DE LOG
// ============================================================================

/**
 * Log DEBUG
 */
function logDebug_(message, data) {
  if (!shouldLog_('DEBUG')) return;
  
  const formatted = formatLogMessage_('DEBUG', message, data);
  Logger.log(formatted);
}

/**
 * Log INFO (mais comum)
 */
function logInfo_(message, data) {
  if (!shouldLog_('INFO')) return;
  
  const formatted = formatLogMessage_('INFO', message, data);
  Logger.log(formatted);
}

/**
 * Log WARN
 */
function logWarn_(message, data) {
  if (!shouldLog_('WARN')) return;
  
  const formatted = formatLogMessage_('WARN', message, data);
  Logger.log(formatted);
}

/**
 * Log ERROR
 */
function logError_(message, data) {
  if (!shouldLog_('ERROR')) return;
  
  const formatted = formatLogMessage_('ERROR', message, data);
  Logger.log(formatted);
}

/**
 * Log ERROR com exceção
 */
function logException_(message, error) {
  const formatted = formatErrorMessage_(message, error);
  Logger.log('[' + nowIso_() + '] [ERROR] ' + formatted);
}

// ============================================================================
// HELPERS ESPECIALIZADOS
// ============================================================================

/**
 * Log de requisição HTTP
 */
function logRequest_(action, token, data) {
  logDebug_('REQUEST: ' + action, {
    token: token ? '[PRESENT]' : '[MISSING]',
    dataKeys: data ? Object.keys(data) : []
  });
}

/**
 * Log de resposta HTTP
 */
function logResponse_(action, ok, code, duration) {
  const level = ok ? 'INFO' : 'WARN';
  if (level === 'INFO') {
    logInfo_('RESPONSE: ' + action, {
      ok: ok,
      code: code,
      durationMs: duration
    });
  } else {
    logWarn_('RESPONSE: ' + action, {
      ok: ok,
      code: code,
      durationMs: duration
    });
  }
}

/**
 * Log de acesso
 */
function logAccess_(action, userId, resource) {
  logInfo_('ACCESS: ' + action, {
    userId: userId,
    resource: resource
  });
}

/**
 * Log de negação de acesso
 */
function logAccessDenied_(action, userId, permission) {
  logWarn_('ACCESS_DENIED: ' + action, {
    userId: userId,
    permission: permission,
    timestamp: nowIso_()
  });
}

/**
 * Log de performance (método lento)
 */
function logPerformance_(operation, durationMs, threshold) {
  threshold = threshold || 1000;
  
  if (durationMs > threshold) {
    logWarn_('SLOW_OPERATION: ' + operation, {
      durationMs: durationMs,
      threshold: threshold
    });
  } else {
    logDebug_('OPERATION: ' + operation, {
      durationMs: durationMs
    });
  }
}

/**
 * Log de validação que falhou
 */
function logValidationFailure_(field, rule, value) {
  logWarn_('VALIDATION_FAILED: ' + field, {
    rule: rule,
    value: value ? '[SET]' : '[EMPTY]'
  });
}

// ============================================================================
// AGREGAÇÃO DE LOGS
// ============================================================================

/**
 * Retorna resumo de logs (mock — em produção seria query a AuditLog)
 */
function getLogSummary_() {
  return {
    timestamp: nowIso_(),
    message: 'Ver Execution Logs no IDE (Ctrl+Enter)',
    note: 'Logs estruturados em Logger.log()'
  };
}

// ============================================================================
// EXPORTAR
// ============================================================================

const LOGGER_LOADED = true;
