/**
 * COMPONENTE: 06_Response.gs
 * PAPEL: Formatadores de resposta HTTP
 *
 * RESPONSABILIDADE:
 * - Formatar respostas sucesso (200, 201)
 * - Formatar respostas erro (400, 401, 403, 404, 500)
 * - Padronizar envelope de resposta
 * - Adicionar metadados (timestamp, correlationId)
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// RESPOSTAS DE SUCESSO
// ============================================================================

/**
 * Resposta padrão sucesso (200 OK)
 *
 * @param {*} data — dados da resposta
 * @param {object} options — {correlationId, message, metadata}
 * @returns {object}
 */
function okResponse_(data, options) {
  options = options || {};

  return {
    success: true,
    status: 200,
    data: data,
    message: options.message || 'OK',
    timestamp: nowIso_(),
    correlationId: options.correlationId || generateUUID_(),
    metadata: options.metadata || {}
  };
}

/**
 * Resposta sucesso com listagem (200 OK)
 *
 * @param {array} items — array de itens
 * @param {object} pagination — {page, pageSize, total, totalPages}
 * @param {object} options — {correlationId, message, metadata}
 * @returns {object}
 */
function listResponse_(items, pagination, options) {
  options = options || {};

  return {
    success: true,
    status: 200,
    data: items || [],
    pagination: pagination || {
      page: 1,
      pageSize: items ? items.length : 0,
      total: items ? items.length : 0,
      totalPages: 1
    },
    message: options.message || 'OK',
    timestamp: nowIso_(),
    correlationId: options.correlationId || generateUUID_(),
    metadata: options.metadata || {}
  };
}

/**
 * Resposta criação (201 Created)
 *
 * @param {*} data — dados criados
 * @param {object} options — {correlationId, message, metadata}
 * @returns {object}
 */
function createdResponse_(data, options) {
  options = options || {};

  return {
    success: true,
    status: 201,
    data: data,
    message: options.message || 'Recurso criado com sucesso',
    timestamp: nowIso_(),
    correlationId: options.correlationId || generateUUID_(),
    metadata: options.metadata || {}
  };
}

/**
 * Resposta aceito (202 Accepted) — para operações assíncronas
 *
 * @param {object} jobInfo — {jobId, status, estimatedTime}
 * @param {object} options — {correlationId, message, metadata}
 * @returns {object}
 */
function acceptedResponse_(jobInfo, options) {
  options = options || {};

  return {
    success: true,
    status: 202,
    data: jobInfo,
    message: options.message || 'Requisição aceita para processamento',
    timestamp: nowIso_(),
    correlationId: options.correlationId || generateUUID_(),
    metadata: options.metadata || {}
  };
}

/**
 * Resposta sem conteúdo (204 No Content)
 *
 * @param {object} options — {correlationId}
 * @returns {object}
 */
function noContentResponse_(options) {
  options = options || {};

  return {
    success: true,
    status: 204,
    data: null,
    message: 'Sem conteúdo',
    timestamp: nowIso_(),
    correlationId: options.correlationId || generateUUID_(),
    metadata: options.metadata || {}
  };
}

// ============================================================================
// RESPOSTAS DE ERRO
// ============================================================================

/**
 * Resposta erro genérico
 *
 * @param {number} status — código HTTP (400, 401, 403, 404, 500)
 * @param {object} error — erro estruturado (code, message, details)
 * @param {object} options — {correlationId, metadata}
 * @returns {object}
 */
function errorResponse_(status, error, options) {
  options = options || {};

  return {
    success: false,
    status: status,
    statusCode: status,  // ADICIONADO: alias para compatibilidade com cliente
    error: {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Erro ao processar requisição',
      details: error.details || {}
    },
    timestamp: nowIso_(),
    correlationId: options.correlationId || generateUUID_(),
    metadata: options.metadata || {}
  };
}

/**
 * Resposta erro validação (400 Bad Request)
 *
 * @param {array} fieldErrors — [{field, code, message}]
 * @param {object} options — {correlationId, metadata}
 * @returns {object}
 */
function validationErrorResponse_(fieldErrors, options) {
  options = options || {};

  return {
    success: false,
    status: 400,
    statusCode: 400,  // ADICIONADO: alias para compatibilidade com cliente
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Erro na validação de dados',
      fields: fieldErrors || []
    },
    timestamp: nowIso_(),
    correlationId: options.correlationId || generateUUID_(),
    metadata: options.metadata || {}
  };
}

/**
 * Resposta erro autenticação (401 Unauthorized)
 *
 * @param {string} message
 * @param {object} options — {correlationId, metadata}
 * @returns {object}
 */
function unauthorizedResponse_(message, options) {
  options = options || {};

  return {
    success: false,
    status: 401,
    statusCode: 401,  // ADICIONADO: alias para compatibilidade com cliente
    error: {
      code: 'AUTH_UNAUTHORIZED',
      message: message || 'Autenticação necessária',
      details: {}
    },
    timestamp: nowIso_(),
    correlationId: options.correlationId || generateUUID_(),
    metadata: options.metadata || {}
  };
}

/**
 * Resposta erro proibido (403 Forbidden)
 *
 * @param {string} message
 * @param {object} options — {correlationId, metadata}
 * @returns {object}
 */
function forbiddenResponse_(message, options) {
  options = options || {};

  return {
    success: false,
    status: 403,
    statusCode: 403,  // ADICIONADO: alias para compatibilidade com cliente
    error: {
      code: 'FORBIDDEN',
      message: message || 'Acesso negado',
      details: {}
    },
    timestamp: nowIso_(),
    correlationId: options.correlationId || generateUUID_(),
    metadata: options.metadata || {}
  };
}

/**
 * Resposta não encontrado (404 Not Found)
 *
 * @param {string} resourceType — ex: "Study", "User"
 * @param {string} resourceId
 * @param {object} options — {correlationId, metadata}
 * @returns {object}
 */
function notFoundResponse_(resourceType, resourceId, options) {
  options = options || {};

  return {
    success: false,
    status: 404,
    statusCode: 404,  // ADICIONADO: alias para compatibilidade com cliente
    error: {
      code: 'NOT_FOUND',
      message: (resourceType || 'Recurso') + ' não encontrado',
      details: {
        resourceType: resourceType,
        resourceId: resourceId
      }
    },
    timestamp: nowIso_(),
    correlationId: options.correlationId || generateUUID_(),
    metadata: options.metadata || {}
  };
}

/**
 * Resposta conflito (409 Conflict)
 *
 * @param {string} message
 * @param {object} options — {correlationId, metadata}
 * @returns {object}
 */
function conflictResponse_(message, options) {
  options = options || {};

  return {
    success: false,
    status: 409,
    statusCode: 409,  // ADICIONADO: alias para compatibilidade com cliente
    error: {
      code: 'CONFLICT',
      message: message || 'Conflito ao processar requisição',
      details: {}
    },
    timestamp: nowIso_(),
    correlationId: options.correlationId || generateUUID_(),
    metadata: options.metadata || {}
  };
}

/**
 * Resposta erro servidor (500 Internal Server Error)
 *
 * @param {string} message
 * @param {object} details — contexto do erro
 * @param {object} options — {correlationId, metadata}
 * @returns {object}
 */
function errorServerResponse_(message, details, options) {
  options = options || {};

  return {
    success: false,
    status: 500,
    statusCode: 500,  // ADICIONADO: alias para compatibilidade com cliente
    error: {
      code: 'INTERNAL_ERROR',
      message: message || 'Erro ao processar requisição',
      details: details || {}
    },
    timestamp: nowIso_(),
    correlationId: options.correlationId || generateUUID_(),
    metadata: options.metadata || {}
  };
}

/**
 * Resposta não implementado (501 Not Implemented)
 *
 * @param {object} options — {correlationId, metadata}
 * @returns {object}
 */
function notImplementedResponse_(options) {
  options = options || {};

  return {
    success: false,
    status: 501,
    statusCode: 501,  // ADICIONADO: alias para compatibilidade com cliente
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Funcionalidade ainda não implementada',
      details: {}
    },
    timestamp: nowIso_(),
    correlationId: options.correlationId || generateUUID_(),
    metadata: options.metadata || {}
  };
}

// ============================================================================
// CONVERSORES DE ERRO ESTRUTURADO
// ============================================================================

/**
 * Converte erro estruturado (de ErrorHandler) para resposta HTTP
 *
 * @param {object} error — {code, message, statusCode, details}
 * @param {object} options — {correlationId, metadata}
 * @returns {object}
 */
function errorToResponse_(error, options) {
  options = options || {};

  const statusCode = error.statusCode || 500;

  return {
    success: false,
    status: statusCode,
    statusCode: statusCode,  // ADICIONADO: alias para compatibilidade com cliente
    error: {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'Erro ao processar requisição',
      details: error.details || {}
    },
    timestamp: nowIso_(),
    correlationId: options.correlationId || generateUUID_(),
    metadata: options.metadata || {}
  };
}

// ============================================================================
// RESPOSTAS ESPECIALIZADAS
// ============================================================================

/**
 * Resposta de login
 *
 * @param {object} user
 * @param {object} session — {id, token, expiresAt}
 * @param {object} options
 * @returns {object}
 */
function loginResponse_(user, session, options) {
  options = options || {};

  return okResponse_({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      status: user.status
    },
    session: {
      id: session.id,
      token: session.token,
      expiresAt: session.expiresAt
    }
  }, {
    message: 'Login bem-sucedido',
    correlationId: options.correlationId
  });
}

/**
 * Resposta de logout
 *
 * @param {object} options
 * @returns {object}
 */
function logoutResponse_(options) {
  options = options || {};

  return okResponse_({
    message: 'Logout realizado'
  }, {
    message: 'Logout bem-sucedido',
    correlationId: options.correlationId
  });
}

/**
 * Resposta de validação de token
 *
 * @param {object} user
 * @param {object} session
 * @param {object} options
 * @returns {object}
 */
function validateTokenResponse_(user, session, options) {
  options = options || {};

  return okResponse_({
    valid: true,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    },
    expiresAt: session.expiresAt
  }, {
    message: 'Token válido',
    correlationId: options.correlationId
  });
}

/**
 * Resposta de saúde do sistema
 *
 * @param {object} healthStatus — {status, components, timestamp}
 * @param {object} options
 * @returns {object}
 */
function healthResponse_(healthStatus, options) {
  options = options || {};

  return okResponse_(healthStatus, {
    message: 'Health check completo',
    correlationId: options.correlationId
  });
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Converte resposta para JSON para envio
 *
 * @param {object} response
 * @returns {string}
 */
function responseToJSON_(response) {
  return JSON.stringify(response);
}

/**
 * Converte resposta para ContentService output
 *
 * @param {object} response
 * @returns {HtmlOutput}
 */
function responseToOutput_(response) {
  return ContentService
    .createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Cria resposta de erro rápida
 *
 * @param {string} code
 * @param {string} message
 * @param {number} status (default: 400)
 * @param {object} options
 * @returns {object}
 */
function quickErrorResponse_(code, message, status, options) {
  options = options || {};
  status = status || 400;

  return errorResponse_(status, {
    code: code,
    message: message,
    details: options.details || {}
  }, options);
}

// ============================================================================
// EXPORTAR
// ============================================================================

const RESPONSE_SERVICE_LOADED = true;
