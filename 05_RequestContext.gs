/**
 * COMPONENTE: 05_RequestContext.gs
 * PAPEL: Contexto de requisição (extração, validação, enriquecimento)
 *
 * RESPONSABILIDADE:
 * - Normalizar requisição
 * - Extrair e validar token
 * - Enriquecer com informações de usuário
 * - Gerar correlationId
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// NORMALIZAÇÃO
// ============================================================================

/**
 * Normaliza requisição bruta
 * 
 * VERSÃO OFICIAL: Esta é a implementação canônica usada pelo pipeline
 * Outra versão legada existe em 00_Bootstrap.gs (normalizeRequestLegacy_)
 * 
 * Diferenças da versão legada:
 * - Retorna objeto padrão completo (não {}) quando request é inválido
 * - Inclui pagination e metadata por padrão
 * - Gera correlationId automaticamente se ausente
 *
 * @param {object} request
 * @returns {object} requisição normalizada
 */
function normalizeRequest_(request) {
  if (!request || typeof request !== 'object') {
    return {
      action: '',
      token: '',
      data: {},
      filters: {},
      pagination: { page: 1, pageSize: 20 },
      correlationId: generateUUID_(),
      metadata: {}
    };
  }

  return {
    action: String(request.action || '').trim(),
    token: String(request.token || '').trim(),
    data: request.data || {},
    filters: request.filters || {},
    pagination: request.pagination || { page: 1, pageSize: 20 },
    correlationId: request.correlationId || generateUUID_(),
    metadata: request.metadata || {}
  };
}

// ============================================================================
// EXTRAÇÃO DE CONTEXTO
// ============================================================================

/**
 * Extrai contexto completo da requisição
 *
 * @param {object} request — requisição normalizada
 * @returns {object} contexto enriquecido
 */
function buildRequestContext_(request) {
  const context = {
    action: request.action,
    token: request.token,
    correlationId: request.correlationId,
    data: request.data,
    filters: request.filters,
    pagination: request.pagination,
    timestamp: nowIso_(),
    user: null,
    session: null,
    isAuthenticated: false,
    requiresAuth: true,
    startTime: nowUnix_()
  };

  // Ações que não requerem autenticação
  const noAuthActions = [
    'auth.login',
    'system.ping',
    'system.health',
    'system.info'
  ];

  context.requiresAuth = !noAuthActions.includes(request.action);

  // Se requer auth, validar token
  if (context.requiresAuth) {
    if (!request.token) {
      context.error = authErrorMissingCredentials_();
      return context;
    }

    const validation = validateTokenAndGetUser_(request.token);

    if (!validation.valid) {
      context.error = validation.error;
      return context;
    }

    context.isAuthenticated = true;
    context.user = validation.user;
    context.session = validation.session;
  }

  return context;
}

// ============================================================================
// VALIDAÇÃO DE CONTEXTO
// ============================================================================

/**
 * Valida se contexto está pronto para processamento
 *
 * @param {object} context
 * @returns {object} {valid, error}
 */
function validateContext_(context) {
  // Verificar erro de auth
  if (context.error) {
    return {
      valid: false,
      error: context.error
    };
  }

  // Verificar ação
  if (!context.action) {
    return {
      valid: false,
      error: createError_('ACTION_NOT_FOUND', 'Action não fornecido', {})
    };
  }

  // Verificar autenticação se requer
  if (context.requiresAuth && !context.isAuthenticated) {
    return {
      valid: false,
      error: createError_('AUTH_UNAUTHORIZED', 'Autenticação necessária', {})
    };
  }

  return { valid: true, error: null };
}

// ============================================================================
// ENRIQUECIMENTO
// ============================================================================

/**
 * Enriquece contexto com metadados adicionais
 *
 * @param {object} context
 * @param {object} additionalMetadata
 * @returns {object}
 */
function enrichContext_(context, additionalMetadata) {
  if (additionalMetadata) {
    context.metadata = merge_(context.metadata, additionalMetadata);
  }

  // Adicionar informações úteis
  if (context.user) {
    context.metadata.userId = context.user.id;
    context.metadata.userRole = context.user.role;
  }

  return context;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Verifica se contexto é admin
 */
function contextIsAdmin_(context) {
  return context.isAuthenticated && isAdmin_(context.user);
}

/**
 * Verifica se contexto tem permissão
 */
function contextHasPermission_(context, permission) {
  return context.isAuthenticated && userHasPermission_(context.user, permission);
}

/**
 * Verifica se contexto é proprietário de entidade
 */
function contextIsOwner_(context, entity, ownerField) {
  return context.isAuthenticated && isOwner_(context.user, entity, ownerField);
}

// ============================================================================
// LOG DE CONTEXTO
// ============================================================================

/**
 * Formata contexto para logging (sem dados sensíveis)
 *
 * @param {object} context
 * @returns {object}
 */
function contextForLog_(context) {
  return {
    action: context.action,
    correlationId: context.correlationId,
    isAuthenticated: context.isAuthenticated,
    userRole: context.user ? context.user.role : null,
    timestamp: context.timestamp
  };
}

/**
 * Log de requisição recebida
 */
function logRequestReceived_(context) {
  logDebug_('REQUEST_RECEIVED: ' + context.action, contextForLog_(context));
}

/**
 * Log de requisição processada
 */
function logRequestProcessed_(context, duration) {
  logDebug_('REQUEST_PROCESSED: ' + context.action, merge_(contextForLog_(context), {
    durationMs: duration
  }));
}

// ============================================================================
// EXPORTAR
// ============================================================================

const REQUEST_CONTEXT_LOADED = true;
