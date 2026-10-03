/**
 * COMPONENTE: 04_WebApp.gs
 * PAPEL: Entry points do Google Apps Script (doPost, doGet)
 *
 * RESPONSABILIDADE:
 * - Receber requisições HTTP
 * - Normalizar entrada
 * - Chamar pipeline de processamento
 * - Retornar resposta estruturada
 * - Tratamento de erro no nível mais alto
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// MIDDLEWARE PIPELINE
// ============================================================================

/**
 * Pipeline de processamento de requisição
 * Ordem: Normalização → Validação → Autenticação → Roteamento → Resposta
 *
 * @param {object} rawRequest — requisição bruta
 * @param {string} method — "POST" ou "GET"
 * @returns {object} resposta estruturada
 */
function processPipeline_(rawRequest, method) {
  const correlationId = generateUUID_();
  const pipelineStartTime = nowUnix_();

  try {
    logDebug_('Pipeline iniciado', {
      method: method,
      correlationId: correlationId,
      timestamp: nowIso_()
    });

    // 1. NORMALIZAÇÃO
    const normalizedRequest = normalizeRequest_(rawRequest);
    normalizedRequest.correlationId = normalizedRequest.correlationId || correlationId;

    logDebug_('Requisição normalizada', {
      action: normalizedRequest.action,
      correlationId: normalizedRequest.correlationId,
      hasToken: !!normalizedRequest.token
    });

    // 2. CONSTRUÇÃO DE CONTEXTO
    const context = buildRequestContext_(normalizedRequest);
    context.method = method;

    logDebug_('Contexto construído', {
      action: context.action,
      isAuthenticated: context.isAuthenticated,
      correlationId: context.correlationId
    });

    // 3. ROTEAMENTO E PROCESSAMENTO
    const response = routeRequest_(context);

    // 4. ENRIQUECIMENTO DE RESPOSTA
    const enrichedResponse = enrichResponse_(response, {
      method: method,
      pipelineDurationMs: nowUnix_() - pipelineStartTime
    });

    logDebug_('Resposta gerada', {
      status: enrichedResponse.status,
      success: enrichedResponse.success,
      correlationId: enrichedResponse.correlationId
    });

    return enrichedResponse;

  } catch (error) {
    const pipelineDurationMs = nowUnix_() - pipelineStartTime;

    logException_('Erro crítico no pipeline', error, {
      method: method,
      correlationId: correlationId,
      pipelineDurationMs: pipelineDurationMs
    });

    auditSystemError_(error, {
      action: 'pipeline_error',
      method: method
    });

    // Retornar erro genérico
    return errorServerResponse_(
      'Erro ao processar requisição',
      {
        pipelineError: true,
        error: error.message
      },
      { correlationId: correlationId }
    );
  }
}

// ============================================================================
// PONTE RPC PÚBLICA (google.script.run)
// ============================================================================

/**
 * Ponto de entrada público para chamadas RPC do frontend via google.script.run
 * ATENÇÃO: Função SEM underline no final (obrigatório para google.script.run)
 * 
 * FLUXO CORRETO:
 * 1. Recebe requisição bruta do browser
 * 2. Normaliza via normalizeRequest_
 * 3. Constrói contexto autenticado via buildRequestContext_
 * 4. Passa para routeRequest_ (mesmo fluxo que doPost/doGet)
 * 
 * @param {Object} rawRequest - { action, data, token, correlationId }
 * @returns {Object} Resposta no envelope padronizado
 */
function routeRequest(rawRequest) {
  const correlationId = (rawRequest && rawRequest.correlationId) || generateUUID_();
  const startTime = nowUnix_();

  try {
    logDebug_('RPC request received', {
      action: rawRequest && rawRequest.action,
      hasToken: !!(rawRequest && rawRequest.token),
      correlationId: correlationId
    });

    // 1. NORMALIZAÇÃO (mesma lógica do pipeline HTTP)
    const normalizedRequest = normalizeRequest_(rawRequest);
    normalizedRequest.correlationId = normalizedRequest.correlationId || correlationId;

    logDebug_('RPC request normalized', {
      action: normalizedRequest.action,
      correlationId: normalizedRequest.correlationId
    });

    // 2. CONSTRUÇÃO DE CONTEXTO AUTENTICADO
    const context = buildRequestContext_(normalizedRequest);
    context.method = 'RPC';

    logDebug_('RPC context built', {
      action: context.action,
      isAuthenticated: context.isAuthenticated,
      correlationId: context.correlationId
    });

    // 3. ROTEAMENTO (agora com contexto completo)
    const response = routeRequest_(context);

    // 4. ENRIQUECIMENTO DE RESPOSTA
    const enrichedResponse = enrichResponse_(response, {
      method: 'RPC',
      pipelineDurationMs: nowUnix_() - startTime
    });

    logDebug_('RPC response generated', {
      status: enrichedResponse.status,
      success: enrichedResponse.success,
      correlationId: enrichedResponse.correlationId
    });

    return enrichedResponse;

  } catch (error) {
    const pipelineDurationMs = nowUnix_() - startTime;

    logException_('Erro crítico no RPC pipeline', error, {
      correlationId: correlationId,
      pipelineDurationMs: pipelineDurationMs
    });

    auditSystemError_(error, {
      action: 'rpc_pipeline_error',
      method: 'RPC'
    });

    // Retornar erro estruturado
    return errorServerResponse_(
      'Erro ao processar requisição RPC',
      {
        pipelineError: true,
        error: error.message
      },
      { correlationId: correlationId }
    );
  }
}

// ============================================================================
// ENTRY POINTS
// ============================================================================

/**
 * Google Apps Script entry point: POST
 * Recebe: {"action": "...", "token": "...", "data": {...}}
 *
 * @param {object} e — evento de requisição (Google Apps Script)
 * @returns {HtmlOutput}
 */
function doPost(e) {
  try {
    const event = e || {};
    // Extrair conteúdo
    let requestData;

    if (event.postData && event.postData.contents) {
      try {
        requestData = JSON.parse(event.postData.contents);
      } catch (parseError) {
        logWarn_('Erro ao fazer parse de JSON', {
          error: parseError.message
        });

        return responseToOutput_(
          quickErrorResponse_('INVALID_JSON', 'JSON inválido', 400)
        );
      }
    } else {
      const params = event.parameter || {};
      requestData = {
        action: params.action || '',
        token: params.token || '',
        data: params
      };
    }

    // ========================================================================
    // ROTA WEBHOOK: Callback de Assinatura Digital
    // ========================================================================
    // Detecta se a requisição é de um webhook externo de assinatura eletrônica
    // Parâmetros esperados:
    // - source: 'webhook_assinatura' (identifica origem do webhook)
    // - receitaId: ID da receita assinada
    // - certificado: (opcional) Dados do certificado digital utilizado
    // - timestamp: (opcional) Timestamp da assinatura
    //
    // Ação: Atualiza DB_RECEITAS com status ASSINADA via PrescriptionEngine.marcarComoAssinada()
    if (requestData.source === 'webhook_assinatura' || 
        (requestData.data && requestData.data.source === 'webhook_assinatura')) {
      
      try {
        const webhookData = requestData.data || requestData;
        const receitaId = webhookData.receitaId || webhookData.receita_id;
        
        if (!receitaId) {
          logWarn_('Webhook de assinatura sem receitaId', webhookData);
          return responseToOutput_(
            quickErrorResponse_('MISSING_RECEITA_ID', 'receitaId é obrigatório no webhook', 400)
          );
        }

        // Preparar dados da assinatura
        const dadosAssinatura = {
          timestamp: webhookData.timestamp || webhookData.assinatura_timestamp || new Date().toISOString(),
          certificado: webhookData.certificado || webhookData.certificate_data || '',
          provider: webhookData.provider || 'unknown',
          signature_id: webhookData.signature_id || ''
        };

        // Marcar receita como assinada
        PrescriptionEngine.marcarComoAssinada(receitaId, dadosAssinatura);

        logDebug_('Webhook de assinatura processado', {
          receitaId: receitaId,
          timestamp: dadosAssinatura.timestamp,
          provider: dadosAssinatura.provider
        });

        // Auditar evento
        auditLog_({
          action: 'webhook.assinatura.processado',
          entity: 'receita',
          entityId: receitaId,
          details: {
            provider: dadosAssinatura.provider,
            timestamp: dadosAssinatura.timestamp
          }
        });

        // Retornar confirmação de processamento
        return responseToOutput_({
          success: true,
          status: 200,
          data: {
            receitaId: receitaId,
            status: 'ASSINADA',
            message: 'Assinatura registrada com sucesso'
          },
          timestamp: new Date().toISOString()
        });

      } catch (webhookError) {
        logException_('Erro ao processar webhook de assinatura', webhookError, {
          requestData: requestData
        });

        return responseToOutput_(
          errorServerResponse_('Erro ao processar webhook de assinatura', {
            error: webhookError.message
          })
        );
      }
    }
    // ========================================================================

    // Processar através do pipeline padrão
    const response = processPipeline_(requestData, 'POST');

    // Retornar como JSON
    return responseToOutput_(response);

  } catch (error) {
    logException_('Erro em doPost', error);

    return responseToOutput_(
      errorServerResponse_('Erro ao processar POST', {
        error: error.message
      })
    );
  }
}

/**
 * Google Apps Script entry point: GET
 * Suporta: /webapp?action=...&token=...
 *
 * @param {object} e — evento de requisição (Google Apps Script)
 * @returns {HtmlOutput}
 */
function doGet(e) {
  try {
    const event = e || {};
    // Log para debug
    Logger.log('doGet called');
    Logger.log('Parameters: ' + JSON.stringify(event));
    
    // Extrair parâmetros
    const params = event.parameter || {};
    const requestData = {
      action: params.action || '',
      token: params.token || '',
      data: params
    };

    // Se há action, processar como API
    if (requestData.action && requestData.action !== '') {
      Logger.log('Processing action: ' + requestData.action);
      const response = processPipeline_(requestData, 'GET');
      return responseToOutput_(response);
    }

    // Sem action, retornar SPA principal
    Logger.log('Rendering index page - step 1: calling renderPage_');
    var output;
    try {
      output = renderPage_('index', 'Canabica - Sistema de Pesquisa', {});
    } catch (renderError) {
      Logger.log('RENDER ERROR: ' + renderError.message);
      Logger.log('RENDER STACK: ' + renderError.stack);
      return HtmlService.createHtmlOutput(
        '<html><body style="font-family:monospace;padding:20px">' +
        '<h2>Erro ao renderizar página</h2>' +
        '<p><b>Mensagem:</b> ' + renderError.message + '</p>' +
        '<pre>' + (renderError.stack || '') + '</pre>' +
        '</body></html>'
      );
    }
    Logger.log('Page rendered successfully');
    return output;

  } catch (error) {
    Logger.log('Error in doGet: ' + error.message);
    Logger.log('Stack: ' + error.stack);
    
    return HtmlService.createHtmlOutput(
      '<html><body style="font-family:monospace;padding:20px">' +
      '<h2>Error in doGet</h2>' +
      '<p>' + error.message + '</p>' +
      '<pre>' + (error.stack || '') + '</pre>' +
      '</body></html>'
    );
  }
}

// ============================================================================
// PROCESSADORES DE REQUISIÇÃO
// ============================================================================

/**
 * Processa requisição genérica
 * Compatível com curl, fetch, etc.
 *
 * @param {object} e
 * @returns {HtmlOutput}
 */
function apiCall(e) {
  const event = e || {};
  // Delegar para doPost/doGet conforme método
  if (event.contentLength > 0) {
    return doPost(event);
  } else {
    return doGet(event);
  }
}

// ============================================================================
// ENRIQUECIMENTO DE RESPOSTA
// ============================================================================

/**
 * Enriquece resposta com metadados adicionais
 *
 * @param {object} response
 * @param {object} metadata
 * @returns {object}
 */
function enrichResponse_(response, metadata) {
  if (!response) {
    return errorServerResponse_('Resposta nula', {});
  }

  // Adicionar metadados de execução
  if (!response.metadata) {
    response.metadata = {};
  }

  if (metadata.method) {
    response.metadata.method = metadata.method;
  }

  if (metadata.pipelineDurationMs) {
    response.metadata.pipelineDurationMs = metadata.pipelineDurationMs;
  }

  // Garantir timestamp
  if (!response.timestamp) {
    response.timestamp = nowIso_();
  }

  // Garantir status (para respostas que não implementarem)
  if (typeof response.status === 'undefined') {
    response.status = response.success ? 200 : 500;
  }

  return response;
}

// ============================================================================
// HANDLERS DE ERRO GLOBAL
// ============================================================================

/**
 * Tratador centralizado de erros (para uso em try-catch)
 *
 * @param {object} error
 * @param {object} context — contexto onde erro ocorreu
 * @returns {object}
 */
function handleGlobalError_(error, context) {
  const errorInfo = {
    message: error.message || 'Erro desconhecido',
    stack: error.stack || '',
    timestamp: nowIso_(),
    context: context || {}
  };

  logException_('Erro global capturado', error, errorInfo);

  auditSystemError_(error, {
    action: 'global_error',
    context: context
  });

  return errorServerResponse_(
    'Erro ao processar requisição',
    errorInfo,
    { correlationId: context && context.correlationId }
  );
}

// ============================================================================
// CORS E HEADERS
// ============================================================================

/**
 * Retorna resposta com headers CORS apropriados
 *
 * @param {object} response
 * @returns {HtmlOutput}
 */
function responseWithCORS_(response) {
  const output = responseToOutput_(response);

  // Google Apps Script não permite customizar headers de CORS diretamente
  // Em produção, usar proxy com headers apropriados

  return output;
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Health check simples (sem autenticação)
 * GET /webapp?action=system.health
 *
 * @returns {HtmlOutput}
 */
function healthCheck() {
  try {
    const health = getSystemHealth_();

    const response = healthResponse_(health, {
      correlationId: generateUUID_()
    });

    return responseToOutput_(response);

  } catch (error) {
    logException_('Erro no health check', error);

    return responseToOutput_(
      errorServerResponse_('Health check falhou', {
        error: error.message
      })
    );
  }
}

// ============================================================================
// LOGGING DE REQUISIÇÃO
// ============================================================================

/**
 * Log estruturado de requisição e resposta
 *
 * @param {object} request — requisição normalizada
 * @param {object} response — resposta estruturada
 * @param {number} durationMs — tempo total
 */
function logRequestResponseCycle_(request, response, durationMs) {
  const logData = {
    action: request.action,
    method: request.method,
    status: response.status,
    success: response.success,
    durationMs: durationMs,
    correlationId: request.correlationId,
    hasError: !response.success && response.error
  };

  if (!response.success && response.error) {
    logData.errorCode = response.error.code;
    logData.errorMessage = response.error.message;
  }

  if (durationMs > 5000) {
    logWarn_('Requisição lenta', logData);
  } else {
    logDebug_('Ciclo requisição-resposta completo', logData);
  }
}

// ============================================================================
// VALIDAÇÃO PRÉVIA DE REQUISIÇÃO
// ============================================================================

/**
 * Valida requisição bruta antes de processar
 *
 * @param {object} rawRequest
 * @returns {object} {valid, error}
 */
function validateRawRequest_(rawRequest) {
  // Verificar se é objeto
  if (!rawRequest || typeof rawRequest !== 'object') {
    return {
      valid: false,
      error: createError_('INVALID_REQUEST', 'Requisição deve ser um objeto', {})
    };
  }

  // Verificar tamanho (limite arbitrário: 1MB)
  const requestString = JSON.stringify(rawRequest);
  const sizeInMB = new Blob([requestString]).size / (1024 * 1024);

  if (sizeInMB > 1) {
    return {
      valid: false,
      error: createError_('REQUEST_TOO_LARGE', 'Requisição excede 1MB', {})
    };
  }

  return { valid: true, error: null };
}

// ============================================================================
// EXPORTAR
// ============================================================================

const WEBAPP_LOADED = true;
