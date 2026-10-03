/**
 * COMPONENTE: 52_ApiService.gs
 * PAPEL: Camada de API unificada com middleware pipeline
 *
 * RESPONSABILIDADE:
 * - Integração entre 04_WebApp.gs e 03_Router.gs
 * - Middleware pipeline: autenticação, autorização, validação, rate limit, cache
 * - Processamento centralizado de requisições
 * - Formatação padronizada de respostas
 *
 * INTEGRAÇÕES:
 * - Router (03_Router.gs), Response (06_Response.gs), ValidationService (17_ValidationService.gs)
 * - RequestContext (05_RequestContext.gs), PermissionService (12_PermissionService.gs)
 * - Cache, Audit, Logging
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Armazena contagem de requisições por usuário
 * Formato: { userId: { count: N, resetAt: timestamp } }
 */
var _rateLimitStorage = {};

const RATE_LIMITS = {
  PUBLIC: { requests: 60, window: 60 },      // 60 req/min para ações públicas
  AUTHENTICATED: { requests: 100, window: 60 }, // 100 req/min para usuários
  ADMIN: { requests: 500, window: 60 }       // 500 req/min para admins
};

/**
 * Verifica rate limit do usuário
 *
 * @param {string} userId — ID do usuário (ou "public" para anônimos)
 * @param {string} tier — "PUBLIC", "AUTHENTICATED", ou "ADMIN"
 * @returns {object} {allowed, remaining, resetAt}
 */
function checkRateLimit_(userId, tier) {
  const now = nowUnix_();
  const limit = RATE_LIMITS[tier] || RATE_LIMITS.AUTHENTICATED;

  const key = userId || 'public';
  let entry = _rateLimitStorage[key] || { count: 0, resetAt: now + limit.window };

  // Se janela expirou, reset
  if (now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + limit.window };
  }

  const allowed = entry.count < limit.requests;
  entry.count++;
  _rateLimitStorage[key] = entry;

  return {
    allowed: allowed,
    remaining: Math.max(0, limit.requests - entry.count),
    resetAt: entry.resetAt,
    tier: tier
  };
}

/**
 * Limpa entries expiradas do rate limit
 */
function cleanupRateLimit_() {
  const now = nowUnix_();

  Object.keys(_rateLimitStorage).forEach(function(key) {
    if (now >= _rateLimitStorage[key].resetAt) {
      delete _rateLimitStorage[key];
    }
  });
}

// ============================================================================
// CACHE
// ============================================================================

/**
 * Cache local de respostas (em memória da execução)
 * Formato: { key: { data, expiresAt } }
 */
var _apiCache = {};

/**
 * Retorna chave de cache para requisição
 *
 * @param {object} context — RequestContext
 * @returns {string}
 */
function getCacheKey_(context) {
  return context.action + ':' + JSON.stringify(context.filters) + ':' + JSON.stringify(context.pagination);
}

/**
 * Busca resposta em cache
 *
 * @param {object} context
 * @returns {object|null}
 */
function getCachedResponse_(context) {
  const key = getCacheKey_(context);
  const entry = _apiCache[key];

  if (!entry) {
    return null;
  }

  if (nowUnix_() >= entry.expiresAt) {
    delete _apiCache[key];
    return null;
  }

  return entry.data;
}

/**
 * Armazena resposta em cache
 *
 * @param {object} context
 * @param {object} response
 * @param {number} ttl — time to live em segundos (default: 300)
 */
function setCacheResponse_(context, response, ttl) {
  ttl = ttl || 300;
  const key = getCacheKey_(context);

  _apiCache[key] = {
    data: response,
    expiresAt: nowUnix_() + ttl
  };
}

/**
 * Limpa cache expirado
 */
function cleanupApiCache_() {
  const now = nowUnix_();

  Object.keys(_apiCache).forEach(function(key) {
    if (now >= _apiCache[key].expiresAt) {
      delete _apiCache[key];
    }
  });
}

// ============================================================================
// PIPELINE DE MIDDLEWARE
// ============================================================================

/**
 * Executa pipeline completo de processamento
 * Chamado por 04_WebApp.gs.processPipeline_()
 *
 * @param {object} context — RequestContext já construído
 * @returns {object} resposta estruturada
 */
function executeApiPipeline_(context) {
  const startTime = nowUnix_();

  try {
    // 1. RATE LIMITING (antes de tudo)
    const tier = context.isAuthenticated
      ? (isAdmin_(context.user) ? 'ADMIN' : 'AUTHENTICATED')
      : 'PUBLIC';

    const rateCheck = checkRateLimit_(
      context.isAuthenticated ? context.user.id : 'public',
      tier
    );

    if (!rateCheck.allowed) {
      logWarn_('Rate limit excedido', {
        userId: context.isAuthenticated ? context.user.id : 'anonymous',
        tier: tier,
        correlationId: context.correlationId
      });

      return errorResponse_(429, {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Limite de requisições excedido',
        details: {
          resetAt: rateCheck.resetAt,
          remaining: rateCheck.remaining
        }
      }, { correlationId: context.correlationId });
    }

    // 2. CACHE CHECK (para ações de leitura)
    if (isReadAction_(context.action)) {
      const cached = getCachedResponse_(context);

      if (cached) {
        logDebug_('Cache hit', {
          action: context.action,
          correlationId: context.correlationId
        });

        cached.meta.cached = true;
        return cached;
      }
    }

    // 3. ROTEAMENTO (delegate ao Router)
    const response = routeRequest_(context);

    // 4. CACHE STORAGE (se aplicável)
    if (isReadAction_(context.action) && response.success && response.status === 200) {
      const cacheTtl = getCacheTtlForAction_(context.action);

      if (cacheTtl > 0) {
        setCacheResponse_(context, response, cacheTtl);
      }
    }

    // 5. AUDITORIA
    const duration = nowUnix_() - startTime;
    logApiCall_(context, response, duration);

    return response;

  } catch (error) {
    logException_('Erro no pipeline da API', error, {
      action: context.action,
      correlationId: context.correlationId
    });

    return errorServerResponse_('Erro ao processar requisição', {
      error: error.message
    }, { correlationId: context.correlationId });
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Verifica se ação é de leitura (cacheável)
 *
 * @param {string} action
 * @returns {boolean}
 */
function isReadAction_(action) {
  // Ações que são safe para cache: list, get, health, info
  return action.indexOf('.list') > -1 ||
         action.indexOf('.get') > -1 ||
         action.indexOf('.health') > -1 ||
         action.indexOf('.info') > -1 ||
         action.indexOf('.ping') > -1;
}

/**
 * Retorna TTL em segundos para ação
 * 0 = não cachear
 *
 * @param {string} action
 * @returns {number}
 */
function getCacheTtlForAction_(action) {
  const cacheTtls = {
    'system.ping': 60,
    'system.health': 30,
    'system.info': 3600,
    'studies.list': 300,
    'studies.get': 600,
    'experiments.list': 300,
    'experiments.get': 600,
    'observations.list': 60,     // Observações mudam frequentemente
    'observations.get': 60,
    'references.list': 600,
    'references.get': 600,
    'evidence.list': 600,
    'evidence.get': 600,
    'validations.list': 300,
    'validations.get': 600
  };

  return cacheTtls[action] || 0;
}

/**
 * Log estruturado de chamada API
 *
 * @param {object} context
 * @param {object} response
 * @param {number} durationMs
 */
function logApiCall_(context, response, durationMs) {
  const logData = {
    action: context.action,
    status: response.status,
    success: response.success,
    durationMs: durationMs,
    correlationId: context.correlationId,
    userId: context.isAuthenticated ? context.user.id : 'anonymous',
    userRole: context.isAuthenticated ? context.user.role : 'none'
  };

  if (!response.success && response.error) {
    logData.errorCode = response.error.code;
    logData.errorMessage = response.error.message;
  }

  if (durationMs > 5000) {
    logWarn_('API call lenta', logData);
  } else if (durationMs > 1000) {
    logDebug_('API call demorada', logData);
  } else {
    logDebug_('API call normal', logData);
  }
}

// ============================================================================
// ENDPOINTS HANDLERS (integram com serviços)
// ============================================================================

/**
 * Handler: studies.list
 */
function handleStudyList_(context) {
  requirePermission_(context.user, 'studies.read');

  const studies = listStudies_(context.filters, context.pagination);

  return listResponse_(studies.items, studies.pagination, {
    correlationId: context.correlationId
  });
}

/**
 * Handler: studies.get
 */
function handleStudyGet_(context) {
  requirePermission_(context.user, 'studies.read');

  const study = getStudyById_(context.data.id);

  if (!study) {
    return notFoundResponse_('Study', context.data.id, {
      correlationId: context.correlationId
    });
  }

  return okResponse_(study, {
    correlationId: context.correlationId
  });
}

/**
 * Handler: studies.create
 */
function handleStudyCreate_(context) {
  requirePermission_(context.user, 'studies.create');

  // Validar dados
  const validation = validateObject_(context.data, getStudySchema_());

  if (!validation.valid) {
    return validationErrorResponse_(validation.errors, {
      correlationId: context.correlationId
    });
  }

  try {
    const study = createStudy_(context.user.id, context.data);

    auditCreate_('Study', study.id, context.user.id, {
      title: study.title,
      status: study.status
    }, context.correlationId);

    return createdResponse_(study, {
      correlationId: context.correlationId
    });

  } catch (error) {
    logException_('Erro ao criar study', error);

    return errorServerResponse_('Erro ao criar study', {
      error: error.message
    }, { correlationId: context.correlationId });
  }
}

/**
 * Handler: experiments.list
 */
function handleExperimentList_(context) {
  requirePermission_(context.user, 'experiments.read');

  const experiments = listExperiments_(context.filters, context.pagination);

  return listResponse_(experiments.items, experiments.pagination, {
    correlationId: context.correlationId
  });
}

/**
 * Handler: observations.create
 */
function handleObservationCreate_(context) {
  requirePermission_(context.user, 'observations.create');

  // Validar dados
  const validation = validateObject_(context.data, getObservationSchema_());

  if (!validation.valid) {
    return validationErrorResponse_(validation.errors, {
      correlationId: context.correlationId
    });
  }

  try {
    const observation = createObservation_(context.user.id, context.data);

    auditCreate_('Observation', observation.id, context.user.id, {
      experimentId: observation.experimentId,
      variable: observation.variable
    }, context.correlationId);

    return createdResponse_(observation, {
      correlationId: context.correlationId
    });

  } catch (error) {
    logException_('Erro ao criar observation', error);

    return errorServerResponse_('Erro ao criar observation', {
      error: error.message
    }, { correlationId: context.correlationId });
  }
}

// ============================================================================
// SCHEMAS DE VALIDAÇÃO
// ============================================================================

/**
 * Schema para Study (criação)
 */
function getStudySchema_() {
  return {
    title: {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 200
    },
    description: {
      type: 'string',
      maxLength: 1000
    },
    status: {
      type: 'string',
      enum: ['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED']
    },
    hostSpecies: {
      type: 'string',
      required: true,
      maxLength: 100
    },
    fungalStrain: {
      type: 'string',
      maxLength: 100
    },
    cultivar: {
      type: 'string',
      maxLength: 100
    },
    objective: {
      type: 'string',
      maxLength: 500
    }
  };
}

/**
 * Schema para Observation (criação)
 */
function getObservationSchema_() {
  return {
    experimentId: {
      type: 'string',
      required: true
    },
    variable: {
      type: 'string',
      required: true,
      maxLength: 100
    },
    value: {
      type: 'number',
      required: true
    },
    unit: {
      type: 'string',
      required: true,
      maxLength: 50
    },
    groupName: {
      type: 'string',
      maxLength: 100
    },
    replicate: {
      type: 'number',
      integer: true,
      min: 1
    },
    timestamp: {
      type: 'string',
      required: true
    },
    notes: {
      type: 'string',
      maxLength: 1000
    }
  };
}

/**
 * Schema para Experiment (criação)
 */
function getExperimentSchema_() {
  return {
    studyId: {
      type: 'string',
      required: true
    },
    title: {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 200
    },
    protocol: {
      type: 'string',
      required: true
    },
    design: {
      type: 'string',
      maxLength: 200
    },
    replicates: {
      type: 'number',
      required: true,
      integer: true,
      min: 1,
      max: 1000
    }
  };
}

// ============================================================================
// ESTATÍSTICAS E MONITORAMENTO
// ============================================================================

/**
 * Retorna estatísticas da API
 *
 * @returns {object}
 */
function getApiStats_() {
  cleanupRateLimit_();
  cleanupApiCache_();

  return {
    rateLimitEntries: Object.keys(_rateLimitStorage).length,
    cacheEntries: Object.keys(_apiCache).length,
    timestamp: nowIso_()
  };
}

/**
 * Retorna informações de cache
 *
 * @returns {object}
 */
function getApiCacheInfo_() {
  cleanupApiCache_();

  const entries = Object.keys(_apiCache);

  return {
    totalEntries: entries.length,
    estimatedSizeKB: entries.reduce(function(sum, key) {
      return sum + (JSON.stringify(_apiCache[key].data).length / 1024);
    }, 0),
    entries: entries.slice(0, 10) // Primeiras 10 para visualização
  };
}

// ============================================================================
// EXPORTAR
// ============================================================================

const API_SERVICE_LOADED = true;
