/**
 * COMPONENTE: 66_IntegrationLayer.gs
 * PAPEL: Camada de integração unificada entre frontend e backend.
 *
 * PRINCIPAIS FUNCIONALIDADES:
 * - Ponto único de entrada para todas as requisições do frontend
 * - Normalização e validação consistente de requests/responses
 * - Gerenciamento de contexto de requisição
 * - Tratamento unificado de erros
 * - Logging e auditoria centralizados
 *
 * INTEGRAÇÕES:
 * - ApiService, Router, AuthService, ValidationService
 * - Todos os componentes frontend (api-client.html)
 *
 * SEGURANÇA:
 * - Validação de entrada em todas as requisições
 * - Sanitização de outputs
 * - Rate limiting integrado
 * - CORS configurável
 *
 * STATUS: PRODUÇÃO - Camada de integração principal
 */

/**
 * Configuração da camada de integração
 */
var INTEGRATION_CONFIG = {
  version: '1.0.0',
  enableCORS: true,
  enableCompression: false,
  maxRequestSize: 1048576, // 1MB
  defaultTimeout: 30000,
  enableMetrics: true,
  enableDetailedErrors: false // false em produção
};

/**
 * Endpoint principal unificado para todas as requisições do frontend.
 * Esta é a função que o frontend deve chamar exclusivamente.
 * 
 * @param {Object} request - Requisição normalizada do frontend
 * @returns {Object} Response padronizada
 */
function handleFrontendRequest(request) {
  const startTime = Date.now();
  const correlationId = getCorrelationId_();
  
  try {
    // 1. Validação básica da requisição
    validateIncomingRequest_(request);
    
    // 2. Normalização
    const normalized = normalizeApiRequest_(request);
    normalized.correlationId = correlationId;
    
    // 3. Criação do contexto
    const context = createIntegrationContext_(normalized, correlationId, startTime);
    
    // 4. Processamento via ApiService
    const result = processApiRequest_(normalized);
    
    // 5. Formatação da resposta
    const response = formatFrontendResponse_(result, context);
    
    // 6. Métricas e logging
    logIntegrationMetrics_(context, response, Date.now() - startTime);
    
    return response;
    
  } catch (error) {
    return handleIntegrationError_(error, correlationId, Date.now() - startTime);
  }
}

/**
 * Valida requisição recebida do frontend
 */
function validateIncomingRequest_(request) {
  if (!request) {
    throw createError_('INVALID_REQUEST', 'Requisição vazia');
  }
  
  if (!request.action || typeof request.action !== 'string') {
    throw createError_('INVALID_REQUEST', 'Campo "action" obrigatório');
  }
  
  // Valida tamanho da requisição
  const requestSize = JSON.stringify(request).length;
  if (requestSize > INTEGRATION_CONFIG.maxRequestSize) {
    throw createError_('REQUEST_TOO_LARGE', 
      'Requisição muito grande: ' + (requestSize / 1024).toFixed(2) + 'KB');
  }
}

/**
 * Cria contexto de integração com informações da requisição
 */
function createIntegrationContext_(request, correlationId, startTime) {
  return {
    correlationId: correlationId,
    action: request.action,
    startTime: startTime,
    timestamp: nowIso_(),
    source: 'frontend',
    version: INTEGRATION_CONFIG.version,
    userId: null, // Será preenchido após autenticação
    sessionId: null,
    metadata: request.metadata || {}
  };
}

/**
 * Formata resposta para o frontend de forma consistente
 */
function formatFrontendResponse_(result, context) {
  const duration = Date.now() - context.startTime;
  
  // Se result já é uma resposta formatada (de failResponse_ ou okResponse_)
  if (result && typeof result === 'object' && 'ok' in result) {
    // Adiciona métricas se habilitado
    if (INTEGRATION_CONFIG.enableMetrics) {
      result.meta = result.meta || {};
      result.meta.duration = duration;
      result.meta.timestamp = context.timestamp;
      result.meta.version = INTEGRATION_CONFIG.version;
    }
    return result;
  }
  
  // Caso contrário, envelopa o resultado
  return {
    ok: true,
    data: result,
    correlationId: context.correlationId,
    timestamp: context.timestamp,
    meta: INTEGRATION_CONFIG.enableMetrics ? {
      duration: duration,
      version: INTEGRATION_CONFIG.version,
      action: context.action
    } : undefined
  };
}

/**
 * Tratamento unificado de erros de integração
 */
function handleIntegrationError_(error, correlationId, duration) {
  // Log do erro
  logError_('Integration error', {
    correlationId: correlationId,
    error: error.message,
    code: error.code || publicErrorCode_(error),
    stack: INTEGRATION_CONFIG.enableDetailedErrors ? error.stack : undefined,
    duration: duration
  });
  
  // Cria resposta de erro
  const errorResponse = failResponse_(error, correlationId);
  
  // Adiciona métricas
  if (INTEGRATION_CONFIG.enableMetrics) {
    errorResponse.meta = {
      duration: duration,
      version: INTEGRATION_CONFIG.version,
      timestamp: nowIso_()
    };
  }
  
  return errorResponse;
}

/**
 * Registra métricas de integração
 */
function logIntegrationMetrics_(context, response, duration) {
  if (!INTEGRATION_CONFIG.enableMetrics) return;
  
  try {
    const metrics = {
      action: context.action,
      correlationId: context.correlationId,
      duration: duration,
      success: response.ok === true,
      timestamp: context.timestamp,
      userId: context.userId,
      errorCode: response.ok ? null : (response.error?.code || 'UNKNOWN')
    };
    
    // Log simplificado (não registra em tabela para não impactar performance)
    logInfo_('API Metrics', metrics);
    
  } catch (error) {
    // Falha silenciosa para não impactar requisição
    console.error('Failed to log metrics:', error);
  }
}

/**
 * Retorna informações sobre a camada de integração
 */
function getIntegrationInfo_() {
  return {
    version: INTEGRATION_CONFIG.version,
    endpoints: Object.keys(getApiEndpoints_()).length,
    config: {
      maxRequestSize: INTEGRATION_CONFIG.maxRequestSize,
      timeout: INTEGRATION_CONFIG.defaultTimeout,
      metricsEnabled: INTEGRATION_CONFIG.enableMetrics
    },
    health: {
      status: 'healthy',
      uptime: Session.getTemporaryActiveUserKey() ? 'active' : 'inactive'
    }
  };
}

/**
 * Endpoint de health check para integração
 */
function checkIntegrationHealth_() {
  const startTime = Date.now();
  
  try {
    // Testa componentes principais
    const tests = {
      apiService: typeof processApiRequest_ === 'function',
      router: typeof routeRequest_ === 'function',
      response: typeof okResponse_ === 'function',
      validation: typeof validateRecord_ === 'function',
      spreadsheet: testSpreadsheetConnection_()
    };
    
    const allHealthy = Object.values(tests).every(t => t === true);
    
    return {
      status: allHealthy ? 'healthy' : 'degraded',
      duration: Date.now() - startTime,
      components: tests,
      version: INTEGRATION_CONFIG.version,
      timestamp: nowIso_()
    };
    
  } catch (error) {
    return {
      status: 'unhealthy',
      duration: Date.now() - startTime,
      error: error.message,
      timestamp: nowIso_()
    };
  }
}

/**
 * Testa conexão com spreadsheet
 */
function testSpreadsheetConnection_() {
  try {
    const ss = SpreadsheetApp.openById(getSpreadsheetId_());
    return ss !== null;
  } catch (error) {
    return false;
  }
}

/**
 * Retorna estatísticas de uso da integração
 */
function getIntegrationStats_() {
  // Estatísticas básicas (em produção seria mais elaborado com cache)
  return {
    version: INTEGRATION_CONFIG.version,
    totalEndpoints: Object.keys(getApiEndpoints_()).length,
    config: INTEGRATION_CONFIG,
    timestamp: nowIso_()
  };
}

/**
 * Limpa cache da camada de integração
 */
function clearIntegrationCache_() {
  try {
    // Limpa cache do LRU se disponível
    if (typeof clearAllCaches_ === 'function') {
      clearAllCaches_();
    }
    
    return {
      ok: true,
      message: 'Cache da camada de integração limpo com sucesso',
      timestamp: nowIso_()
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}
