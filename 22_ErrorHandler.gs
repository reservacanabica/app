/**
 * COMPONENTE: 22_ErrorHandler.gs
 * PAPEL: Tratamento centralizado de erros
 *
 * RESPONSABILIDADE:
 * - Criar objetos de erro estruturados
 * - Mapear erros para códigos públicos
 * - Categorizar erros (VALIDATION, AUTH, PERMISSION, SYSTEM)
 * - Nunca expor stack traces ou detalhes internos
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// CRIAR ERROS ESTRUTURADOS
// ============================================================================

/**
 * Cria erro estruturado
 *
 * @param {string} code — código de erro público (VALIDATION_ERROR, AUTH_FAILED, etc)
 * @param {string} message — mensagem segura (sem detalhes internos)
 * @param {object} details — detalhes internos (só para log, não retorna ao cliente)
 * @returns {object}
 */
function createError_(code, message, details) {
  const error = {
    code: code,
    message: message,
    details: details || {},
    timestamp: nowIso_(),
    category: categorizeErrorCode_(code)
  };
  
  // Logar erro
  logError_(code + ': ' + message, details);
  
  return error;
}

/**
 * Throw error estruturado
 */
function throwError_(code, message, details) {
  const error = createError_(code, message, details);
  throw new Error(JSON.stringify(error));
}

// ============================================================================
// CATEGORIZAÇÃO
// ============================================================================

/**
 * Mapeia código para categoria
 */
function categorizeErrorCode_(code) {
  if (code.includes('VALID') || code.includes('SCHEMA')) {
    return 'VALIDATION';
  } else if (code.includes('AUTH') || code.includes('TOKEN') || code.includes('CREDENTIAL')) {
    return 'AUTH';
  } else if (code.includes('FORBIDDEN') || code.includes('PERMISSION')) {
    return 'PERMISSION';
  } else if (code.includes('NOT_FOUND') || code.includes('MISSING')) {
    return 'NOT_FOUND';
  } else {
    return 'SYSTEM';
  }
}

// ============================================================================
// ERROS COMUNS - VALIDAÇÃO
// ============================================================================

/**
 * Cria erro de campo obrigatório faltando
 * 
 * @param {string} fieldName - Nome do campo que está faltando
 * @returns {object} Erro estruturado
 */
function validateErrorMissingField_(fieldName) {
  return createError_(
    'VALIDATION_ERROR',
    'Campo obrigatório: ' + fieldName,
    { field: fieldName, type: 'MISSING' }
  );
}

/**
 * Cria erro de tipo inválido
 * 
 * @param {string} fieldName - Nome do campo
 * @param {string} expected - Tipo esperado
 * @param {string} actual - Tipo atual recebido
 * @returns {object} Erro estruturado
 */
function validateErrorInvalidType_(fieldName, expected, actual) {
  return createError_(
    'VALIDATION_ERROR',
    'Campo "' + fieldName + '" deve ser ' + expected,
    { field: fieldName, expected: expected, actual: actual }
  );
}

/**
 * Cria erro de valor inválido em enum
 * 
 * @param {string} fieldName - Nome do campo
 * @param {*} value - Valor recebido
 * @param {array} allowed - Valores permitidos
 * @returns {object} Erro estruturado
 */
function validateErrorInvalidEnum_(fieldName, value, allowed) {
  return createError_(
    'VALIDATION_ERROR',
    'Campo "' + fieldName + '" tem valor inválido',
    { field: fieldName, value: value, allowed: allowed }
  );
}

function validateErrorInvalidEmail_(email) {
  return createError_(
    'VALIDATION_ERROR',
    'Email inválido',
    { email: email }
  );
}

function validateErrorInvalidUUID_(id) {
  return createError_(
    'VALIDATION_ERROR',
    'ID inválido',
    { id: id }
  );
}

function validateErrorMinLength_(fieldName, min, actual) {
  return createError_(
    'VALIDATION_ERROR',
    'Campo "' + fieldName + '" deve ter mínimo ' + min + ' caracteres',
    { field: fieldName, min: min, actual: actual }
  );
}

function validateErrorMaxLength_(fieldName, max, actual) {
  return createError_(
    'VALIDATION_ERROR',
    'Campo "' + fieldName + '" deve ter máximo ' + max + ' caracteres',
    { field: fieldName, max: max, actual: actual }
  );
}

// ============================================================================
// ERROS COMUNS - AUTENTICAÇÃO
// ============================================================================

function authErrorMissingCredentials_() {
  return createError_(
    'AUTH_TOKEN_MISSING',
    'Token de autenticação ausente',
    {}
  );
}

function authErrorInvalidToken_() {
  return createError_(
    'AUTH_TOKEN_INVALID',
    'Token inválido ou expirado',
    {}
  );
}

function authErrorSessionExpired_() {
  return createError_(
    'SESSION_EXPIRED',
    'Sessão expirada',
    {}
  );
}

function authErrorInvalidCredentials_() {
  return createError_(
    'INVALID_CREDENTIALS',
    'Usuário ou senha incorretos',
    {} // Nunca detalhar qual está errado
  );
}

function authErrorUserNotFound_(username) {
  return createError_(
    'AUTH_USER_NOT_FOUND',
    'Usuário não encontrado',
    { username: username }
  );
}

function authErrorUserSuspended_(username) {
  return createError_(
    'AUTH_USER_SUSPENDED',
    'Conta suspensa',
    { username: username }
  );
}

// ============================================================================
// ERROS COMUNS - AUTORIZAÇÃO
// ============================================================================

function permissionErrorDenied_(action, role) {
  return createError_(
    'FORBIDDEN',
    'Sem permissão para: ' + action,
    { action: action, role: role }
  );
}

function permissionErrorEndpointNotFound_(action) {
  return createError_(
    'ACTION_NOT_FOUND',
    'Ação não encontrada: ' + action,
    { action: action }
  );
}

// ============================================================================
// ERROS COMUNS - NÃO ENCONTRADO
// ============================================================================

function notFoundError_(entity, id) {
  return createError_(
    'RECORD_NOT_FOUND',
    entity + ' não encontrado',
    { entity: entity, id: id }
  );
}

// ============================================================================
// ERROS COMUNS - SISTEMA
// ============================================================================

function configErrorMissingProperty_(propertyName) {
  return createError_(
    'MISSING_SPREADSHEET_ID',
    'Propriedade não configurada: ' + propertyName,
    { property: propertyName }
  );
}

function lockErrorTimeout_() {
  return createError_(
    'LOCK_TIMEOUT',
    'Timeout ao adquirir lock',
    {}
  );
}

function rateLimitError_() {
  return createError_(
    'RATE_LIMIT_EXCEEDED',
    'Muitas requisições. Aguarde.',
    {}
  );
}

function internalError_(internalMessage) {
  return createError_(
    'INTERNAL_ERROR',
    'Erro interno do servidor',
    { internalMessage: internalMessage }
  );
}

function spreadsheetError_(internalMessage) {
  return createError_(
    'SPREADSHEET_ERROR',
    'Erro ao acessar planilha',
    { internalMessage: internalMessage }
  );
}

// ============================================================================
// PARSE DE ERRO
// ============================================================================

/**
 * Parse erro catch → objeto estruturado
 */
function parseError_(error) {
  if (!error) {
    return createError_('INTERNAL_ERROR', 'Erro desconhecido', {});
  }
  
  // Se é erro estruturado (stringify)
  if (typeof error === 'string' && error.startsWith('{')) {
    try {
      return JSON.parse(error);
    } catch (e) {
      // Não é JSON válido, tratar como string
    }
  }
  
  // Se é objeto de erro nativo
  if (error.message) {
    return createError_(
      'INTERNAL_ERROR',
      'Erro: ' + error.message,
      { originalMessage: error.message }
    );
  }
  
  // String simples
  return createError_(
    'INTERNAL_ERROR',
    String(error),
    {}
  );
}

// ============================================================================
// FORMATAÇÃO PARA RESPOSTA
// ============================================================================

/**
 * Formata erro para resposta HTTP
 */
function formatErrorResponse_(error, correlationId) {
  if (!error) {
    error = createError_('INTERNAL_ERROR', 'Erro desconhecido', {});
  }
  
  return {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      category: error.category || 'SYSTEM'
    },
    correlationId: correlationId || 'N/A',
    meta: {
      timestamp: nowIso_(),
      version: APP_VERSION
    }
  };
}

// ============================================================================
// VALIDAÇÃO COM ERROR HANDLING
// ============================================================================

/**
 * Wrapper para validação que lança erro
 */
function validate_(condition, errorCode, errorMessage, details) {
  if (!condition) {
    throwError_(errorCode, errorMessage, details);
  }
}

/**
 * Wrapper para operações com try-catch automático
 */
function tryCatch_(fn, errorPrefix) {
  errorPrefix = errorPrefix || 'Operação';
  
  try {
    return { ok: true, data: fn() };
  } catch (error) {
    const parsed = parseError_(error);
    logError_(errorPrefix, {
      error: parsed,
      originalError: error.message
    });
    return { ok: false, error: parsed };
  }
}

// ============================================================================
// EXPORTAR
// ============================================================================

const ERROR_HANDLER_LOADED = true;
