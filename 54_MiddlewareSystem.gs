/**
 * COMPONENTE: 54_MiddlewareSystem.gs
 * PAPEL: Sistema de middleware extensível para pipeline de requisições API.
 *
 * PRINCIPAIS FUNCIONALIDADES:
 * - Pipeline de middleware configurável e ordenável
 * - Middlewares reutilizáveis para autenticação, autorização, logging, cache, etc.
 * - Suporte a middlewares síncronos e assíncronos
 * - Contexto compartilhado entre middlewares
 * - Error handling e recovery
 *
 * INTEGRAÇÕES:
 * - ApiService (usa o middleware pipeline)
 * - AuthService, PermissionService, AuditService
 *
 * STATUS: PRODUÇÃO - Sistema de middleware modular e extensível
 */

/**
 * Classe para gerenciar pipeline de middlewares.
 * 
 * @class MiddlewarePipeline
 */
function MiddlewarePipeline() {
  this.middlewares = [];
}

/**
 * Adiciona middleware ao pipeline.
 * 
 * @param {Function} middleware - Função middleware (ctx, next) => void
 * @param {Object} [options] - Opções do middleware
 * @param {string} [options.name] - Nome do middleware
 * @param {number} [options.priority] - Prioridade de execução (menor = primeiro)
 * @param {boolean} [options.enabled=true] - Se middleware está habilitado
 * @returns {MiddlewarePipeline} this para chaining
 * 
 * @example
 * pipeline.use(authMiddleware, { name: 'auth', priority: 10 })
 *        .use(loggingMiddleware, { name: 'logging', priority: 20 });
 */
MiddlewarePipeline.prototype.use = function(middleware, options) {
  options = options || {};
  
  this.middlewares.push({
    fn: middleware,
    name: options.name || 'anonymous',
    priority: options.priority || 100,
    enabled: options.enabled !== false
  });
  
  // Ordena por prioridade
  this.middlewares.sort(function(a, b) {
    return a.priority - b.priority;
  });
  
  return this;
};

/**
 * Remove middleware do pipeline por nome.
 * 
 * @param {string} name - Nome do middleware
 * @returns {boolean} true se removido
 */
MiddlewarePipeline.prototype.remove = function(name) {
  const index = this.middlewares.findIndex(function(m) {
    return m.name === name;
  });
  
  if (index >= 0) {
    this.middlewares.splice(index, 1);
    return true;
  }
  
  return false;
};

/**
 * Habilita ou desabilita middleware por nome.
 * 
 * @param {string} name - Nome do middleware
 * @param {boolean} enabled - Estado desejado
 * @returns {boolean} true se encontrado
 */
MiddlewarePipeline.prototype.toggle = function(name, enabled) {
  const middleware = this.middlewares.find(function(m) {
    return m.name === name;
  });
  
  if (middleware) {
    middleware.enabled = enabled;
    return true;
  }
  
  return false;
};

/**
 * Executa pipeline de middlewares.
 * 
 * @param {Object} ctx - Contexto compartilhado
 * @returns {*} Resultado final
 * @throws {Error} Se algum middleware lançar erro
 */
MiddlewarePipeline.prototype.execute = function(ctx) {
  const enabledMiddlewares = this.middlewares.filter(function(m) {
    return m.enabled;
  });
  
  let index = 0;
  
  function next() {
    if (index >= enabledMiddlewares.length) {
      return;
    }
    
    const middleware = enabledMiddlewares[index++];
    
    try {
      middleware.fn(ctx, next);
    } catch (error) {
      // Propaga erro para ser tratado externamente
      throw error;
    }
  }
  
  next();
  return ctx.result;
};

/**
 * Lista middlewares configurados.
 * 
 * @returns {Array} Array de middlewares
 */
MiddlewarePipeline.prototype.list = function() {
  return this.middlewares.map(function(m) {
    return {
      name: m.name,
      priority: m.priority,
      enabled: m.enabled
    };
  });
};

// ============================================================================
// MIDDLEWARES PRÉ-DEFINIDOS
// ============================================================================

/**
 * Middleware de autenticação via token.
 * 
 * @param {Object} ctx - Contexto da requisição
 * @param {Function} next - Próximo middleware
 * @throws {Error} AUTH_TOKEN_MISSING ou AUTH_TOKEN_INVALID
 */
function authenticationMiddleware_(ctx, next) {
  const endpoint = ctx.endpoint;
  
  // Pula autenticação se não requerida
  if (endpoint.auth === false) {
    next();
    return;
  }
  
  const token = ctx.request.token;
  
  if (!token) {
    throw createError_('AUTH_TOKEN_MISSING', 'Token de autenticação não fornecido');
  }
  
  const session = validateSessionToken_(token);
  if (!session || !session.userId) {
    throw createError_('AUTH_TOKEN_INVALID', 'Token inválido ou expirado');
  }
  
  const user = getUserById_(session.userId);
  if (!user) {
    throw createError_('AUTH_USER_NOT_FOUND', 'Usuário não encontrado');
  }
  
  // Adiciona usuário ao contexto
  ctx.user = user;
  ctx.session = session;
  
  next();
}

/**
 * Middleware de autorização por permissões.
 * 
 * @param {Object} ctx - Contexto da requisição
 * @param {Function} next - Próximo middleware
 * @throws {Error} AUTH_UNAUTHORIZED ou AUTH_FORBIDDEN
 */
function authorizationMiddleware_(ctx, next) {
  const endpoint = ctx.endpoint;
  
  // Pula autorização se não há permissões configuradas
  if (!endpoint.permissions || endpoint.permissions.length === 0) {
    next();
    return;
  }
  
  if (!ctx.user) {
    throw createError_('AUTH_UNAUTHORIZED', 'Autenticação necessária');
  }
  
  for (var i = 0; i < endpoint.permissions.length; i++) {
    const permission = endpoint.permissions[i];
    if (!hasPermission_(ctx.user, permission)) {
      throw createError_('AUTH_FORBIDDEN', 'Permissão negada: ' + permission);
    }
  }
  
  next();
}

/**
 * Middleware de rate limiting.
 * 
 * @param {Object} ctx - Contexto da requisição
 * @param {Function} next - Próximo middleware
 * @throws {Error} RATE_LIMIT_EXCEEDED
 */
function rateLimitMiddleware_(ctx, next) {
  const endpoint = ctx.endpoint;
  
  // Pula rate limit se não configurado
  if (!endpoint.rateLimit) {
    next();
    return;
  }
  
  const key = 'ratelimit:' + (ctx.user ? ctx.user.id : 'anonymous') + ':' + ctx.request.action;
  const cache = CacheService.getScriptCache();
  
  const current = parseInt(cache.get(key) || '0');
  
  if (current >= endpoint.rateLimit.requests) {
    const resetIn = endpoint.rateLimit.window;
    throw createError_(
      'RATE_LIMIT_EXCEEDED', 
      'Limite de requisições excedido. Tente novamente em ' + resetIn + 's',
      { resetIn: resetIn, limit: endpoint.rateLimit.requests }
    );
  }
  
  cache.put(key, String(current + 1), endpoint.rateLimit.window);
  
  // Adiciona headers de rate limit ao contexto
  ctx.rateLimitInfo = {
    limit: endpoint.rateLimit.requests,
    remaining: endpoint.rateLimit.requests - current - 1,
    reset: Math.floor(Date.now() / 1000) + endpoint.rateLimit.window
  };
  
  next();
}

/**
 * Middleware de cache de leitura com LRU.
 * 
 * @param {Object} ctx - Contexto da requisição
 * @param {Function} next - Próximo middleware
 */
function cacheReadMiddleware_(ctx, next) {
  const endpoint = ctx.endpoint;
  
  // Pula cache se não cacheable ou não é GET
  if (!endpoint.cacheable || endpoint.method !== 'GET') {
    next();
    return;
  }
  
  const cacheKey = buildCacheKey_(ctx.request.action, ctx.request.data, ctx.user);
  const cache = getCacheInstance_('api', { maxSize: 200, defaultTTL: 300 });
  
  const cached = cache.get(cacheKey);
  
  if (cached) {
    ctx.result = cached;
    ctx.cached = true;
    // Não chama next() - curto-circuita o pipeline
    return;
  }
  
  next();
}

/**
 * Middleware de cache de escrita com LRU.
 * 
 * @param {Object} ctx - Contexto da requisição
 * @param {Function} next - Próximo middleware
 */
function cacheWriteMiddleware_(ctx, next) {
  next();
  
  const endpoint = ctx.endpoint;
  
  // Só cacheia se configurado e resultado disponível
  if (!endpoint.cacheable || !ctx.result || ctx.cached) {
    return;
  }
  
  const cacheKey = buildCacheKey_(ctx.request.action, ctx.request.data, ctx.user);
  const cache = getCacheInstance_('api', { maxSize: 200, defaultTTL: 300 });
  const ttl = endpoint.cacheTime || 300;
  
  cache.set(cacheKey, ctx.result, ttl);
}

/**
 * Middleware de logging de requisições.
 * 
 * @param {Object} ctx - Contexto da requisição
 * @param {Function} next - Próximo middleware
 */
function requestLoggingMiddleware_(ctx, next) {
  const startTime = Date.now();
  
  logInfo_('API request started', {
    action: ctx.request.action,
    correlationId: ctx.correlationId,
    userId: ctx.user ? ctx.user.id : null,
    ip: ctx.request.metadata ? ctx.request.metadata.ip : null
  });
  
  try {
    next();
    
    logInfo_('API request completed', {
      action: ctx.request.action,
      correlationId: ctx.correlationId,
      duration: Date.now() - startTime,
      cached: ctx.cached || false
    });
  } catch (error) {
    logError_('API request failed', {
      action: ctx.request.action,
      correlationId: ctx.correlationId,
      duration: Date.now() - startTime,
      error: error.code || 'UNKNOWN',
      message: error.message
    });
    
    throw error; // Re-lança para tratamento externo
  }
}

/**
 * Middleware de auditoria.
 * 
 * @param {Object} ctx - Contexto da requisição
 * @param {Function} next - Próximo middleware
 */
function auditMiddleware_(ctx, next) {
  next();
  
  // Só audita operações de escrita ou ações sensíveis
  const writeOperations = ['create', 'update', 'delete', 'save'];
  const needsAudit = writeOperations.some(function(op) {
    return ctx.request.action.includes(op);
  });
  
  if (!needsAudit) {
    return;
  }
  
  const actorId = ctx.user ? ctx.user.id : 'anonymous';
  const parts = ctx.request.action.split('.');
  const entity = parts[0]; // ex: "studies" de "studies.create"
  const action = parts[1];  // ex: "create"
  
  auditEvent_(
    action.toUpperCase() + '_SUCCESS',
    entity,
    ctx.result && ctx.result.id ? ctx.result.id : '',
    action,
    { action: ctx.request.action },
    ctx.correlationId,
    actorId
  );
}

/**
 * Middleware de validação de schema.
 * 
 * @param {Object} ctx - Contexto da requisição
 * @param {Function} next - Próximo middleware
 * @throws {Error} VALIDATION_ERROR
 */
function schemaValidationMiddleware_(ctx, next) {
  const endpoint = ctx.endpoint;
  
  // Pula validação se não há schema
  if (!endpoint.schema) {
    next();
    return;
  }
  
  validateRequestSchema_(ctx.request.data || {}, endpoint.schema);
  
  next();
}

/**
 * Middleware de sanitização de input.
 * 
 * @param {Object} ctx - Contexto da requisição
 * @param {Function} next - Próximo middleware
 */
function inputSanitizationMiddleware_(ctx, next) {
  // Sanitiza strings no payload
  if (ctx.request.data && typeof ctx.request.data === 'object') {
    ctx.request.data = sanitizeObject_(ctx.request.data);
  }
  
  next();
}

/**
 * Sanitiza recursivamente strings em objeto.
 * 
 * @param {*} obj - Objeto a sanitizar
 * @returns {*} Objeto sanitizado
 */
function sanitizeObject_(obj) {
  if (typeof obj === 'string') {
    return sanitizeHtml_(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject_);
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    Object.keys(obj).forEach(function(key) {
      sanitized[key] = sanitizeObject_(obj[key]);
    });
    return sanitized;
  }
  
  return obj;
}

/**
 * Middleware de transformação de resposta.
 * 
 * @param {Object} ctx - Contexto da requisição
 * @param {Function} next - Próximo middleware
 */
function responseTransformMiddleware_(ctx, next) {
  next();
  
  // Remove campos sensíveis do resultado
  if (ctx.result && typeof ctx.result === 'object') {
    ctx.result = removeSensitiveFields_(ctx.result);
  }
}

/**
 * Remove campos sensíveis de objeto recursivamente.
 * 
 * @param {*} obj - Objeto a limpar
 * @returns {*} Objeto sem campos sensíveis
 */
function removeSensitiveFields_(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'privateKey'];
  
  if (Array.isArray(obj)) {
    return obj.map(removeSensitiveFields_);
  }
  
  const cleaned = {};
  Object.keys(obj).forEach(function(key) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveFields.some(function(field) {
      return lowerKey.includes(field);
    });
    
    if (!isSensitive) {
      cleaned[key] = removeSensitiveFields_(obj[key]);
    }
  });
  
  return cleaned;
}

/**
 * Middleware de CORS headers (se aplicável).
 * 
 * @param {Object} ctx - Contexto da requisição
 * @param {Function} next - Próximo middleware
 */
function corsMiddleware_(ctx, next) {
  // Adiciona headers CORS ao contexto
  ctx.headers = ctx.headers || {};
  ctx.headers['Access-Control-Allow-Origin'] = '*';
  ctx.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
  ctx.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization';
  
  next();
}

/**
 * Middleware de compressão de resposta (simulado).
 * 
 * @param {Object} ctx - Contexto da requisição
 * @param {Function} next - Próximo middleware
 */
function compressionMiddleware_(ctx, next) {
  next();
  
  // Marca se resposta deveria ser comprimida
  if (ctx.result && JSON.stringify(ctx.result).length > 10000) {
    ctx.shouldCompress = true;
  }
}

// ============================================================================
// FACTORY DE PIPELINE PADRÃO
// ============================================================================

/**
 * Cria pipeline padrão com middlewares comuns.
 * 
 * @param {Object} [options] - Opções de configuração
 * @param {boolean} [options.enableAuth=true] - Habilita autenticação
 * @param {boolean} [options.enableCache=true] - Habilita cache
 * @param {boolean} [options.enableRateLimit=true] - Habilita rate limit
 * @param {boolean} [options.enableAudit=true] - Habilita auditoria
 * @param {boolean} [options.enableLogging=true] - Habilita logging
 * @returns {MiddlewarePipeline} Pipeline configurado
 * 
 * @example
 * const pipeline = createDefaultPipeline_({ enableCache: false });
 */
function createDefaultPipeline_(options) {
  options = options || {};
  
  const pipeline = new MiddlewarePipeline();
  
  // Ordem de execução baseada em priority
  pipeline
    .use(corsMiddleware_, { 
      name: 'cors', 
      priority: 5,
      enabled: options.enableCors !== false
    })
    .use(inputSanitizationMiddleware_, { 
      name: 'sanitization', 
      priority: 10,
      enabled: options.enableSanitization !== false
    })
    .use(requestLoggingMiddleware_, { 
      name: 'logging', 
      priority: 15,
      enabled: options.enableLogging !== false
    })
    .use(schemaValidationMiddleware_, { 
      name: 'validation', 
      priority: 20,
      enabled: options.enableValidation !== false
    })
    .use(authenticationMiddleware_, { 
      name: 'authentication', 
      priority: 30,
      enabled: options.enableAuth !== false
    })
    .use(authorizationMiddleware_, { 
      name: 'authorization', 
      priority: 40,
      enabled: options.enableAuth !== false
    })
    .use(rateLimitMiddleware_, { 
      name: 'rateLimit', 
      priority: 50,
      enabled: options.enableRateLimit !== false
    })
    .use(cacheReadMiddleware_, { 
      name: 'cacheRead', 
      priority: 60,
      enabled: options.enableCache !== false
    })
    .use(cacheWriteMiddleware_, { 
      name: 'cacheWrite', 
      priority: 90,
      enabled: options.enableCache !== false
    })
    .use(responseTransformMiddleware_, { 
      name: 'responseTransform', 
      priority: 95,
      enabled: options.enableResponseTransform !== false
    })
    .use(auditMiddleware_, { 
      name: 'audit', 
      priority: 100,
      enabled: options.enableAudit !== false
    })
    .use(compressionMiddleware_, { 
      name: 'compression', 
      priority: 110,
      enabled: options.enableCompression !== false
    });
  
  return pipeline;
}


/**
 * Middleware de feature flags.
 * 
 * Bloqueia acesso a endpoints que requerem features desabilitadas.
 * 
 * @param {Object} ctx - Contexto da requisição
 * @param {Function} next - Próximo middleware
 * @throws {Error} FEATURE_DISABLED
 */
function featureFlagMiddleware_(ctx, next) {
  const endpoint = ctx.endpoint;
  
  // Pula se endpoint não requer feature flag
  if (!endpoint.requiredFeatures || endpoint.requiredFeatures.length === 0) {
    next();
    return;
  }
  
  const user = ctx.user;
  
  // Verifica cada feature requerida
  for (var i = 0; i < endpoint.requiredFeatures.length; i++) {
    const featureKey = endpoint.requiredFeatures[i];
    
    if (!isFeatureEnabled_(featureKey, user, ctx)) {
      throw createError_(
        'FEATURE_DISABLED',
        'Esta funcionalidade está temporariamente desabilitada',
        { feature: featureKey }
      );
    }
  }
  
  // Adiciona features disponíveis ao contexto
  ctx.enabledFeatures = endpoint.requiredFeatures;
  
  next();
}
