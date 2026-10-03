/**
 * COMPONENTE: 00_Bootstrap.gs
 * PAPEL: Inicialização global e utilitários de composição de HTML.
 *
 * PRINCIPAIS FUNCIONALIDADES:
 * - include de parciais HTML, normalização de requisições e funções globais seguras;
 * - mantém o CRUD centralizado no Google Sheets identificado por SPREADSHEETS_ID;
 * - expõe apenas contratos pequenos para facilitar testes e futura substituição.
 *
 * INTEGRAÇÕES:
 * - HtmlService, Web App e todos os serviços internos;
 * - Bootstrap, Constants, Config, Response e os serviços explicitamente chamados pelo corpo.
 *
 * ENTIDADES/ABAS ENVOLVIDAS:
 * - Nenhuma entidade; ponto de entrada técnico.
 *
 * SEGURANÇA E LIMITAÇÕES:
 * - senhas em texto plano são mantidas somente porque foram solicitadas para este protótipo;
 * - não registrar senha, token ou payload sensível em Logger.log, respostas ou exportações;
 * - aplicar autorização antes de toda escrita e registrar o evento em AuditLog;
 * - este arquivo é um esqueleto executável/documentado, não um laudo científico nem substituto de revisão humana.
 *
 * STATUS: ESQUELETO DE ARQUITETURA — preencher regras de negócio e testes antes de produção.
 */

/**
 * Inclui conteúdo de arquivo HTML parcial
 * @param {string} filename - Nome do arquivo sem extensão
 * @returns {string} Conteúdo HTML do parcial
 */
function include(filename) {
  try {
    const cleanFilename = String(filename || '').replace(/\.html$/i, '');
    return HtmlService.createTemplateFromFile(cleanFilename).evaluate().getContent();
  } catch (error) {
    if (typeof logError_ === 'function') {
      logError_('Failed to include file: ' + filename, { error: error.message });
    }
    return '<!-- Erro ao carregar ' + filename + ' -->';
  }
}

/**
 * Normaliza objeto de requisição
 * @param {Object} request - Requisição bruta
 * @returns {Object} Requisição normalizada
 */
/**
 * Normaliza requisição bruta (LEGACY - usar normalizeRequest_ de 05_RequestContext.gs)
 * Mantido para compatibilidade com código legado
 * 
 * @deprecated Use normalizeRequest_ de 05_RequestContext.gs
 * @param {object} request
 * @returns {object} requisição parcialmente normalizada
 */
function normalizeRequestLegacy_(request) {
  if (!request || typeof request !== 'object') {
    return {};
  }
  
  // Normalizar campos comuns
  const normalized = {
    action: String(request.action || '').trim(),
    token: String(request.token || '').trim(),
    data: request.data || {},
    filters: request.filters || {},
    id: request.id || null,
    correlationId: request.correlationId || null
  };
  
  // Preservar campos adicionais
  Object.keys(request).forEach(function(key) {
    if (!normalized.hasOwnProperty(key)) {
      normalized[key] = request[key];
    }
  });
  
  return normalized;
}

/**
 * Gera ID de correlação único para rastreamento
 * @returns {string} UUID v4
 */
function getCorrelationId_() {
  return Utilities.getUuid();
}

/**
 * Cria template HTML com dados injetados
 * @param {string} filename - Nome do template
 * @param {Object} data - Dados a injetar
 * @returns {HtmlOutput} Template avaliado
 */
function renderTemplate_(filename, data) {
  const template = HtmlService.createTemplateFromFile(filename);
  
  // Injetar dados no template
  if (data && typeof data === 'object') {
    Object.keys(data).forEach(function(key) {
      template[key] = data[key];
    });
  }
  
  return template.evaluate();
}

/**
 * Renderiza página HTML completa com título e opções
 * @param {string} filename - Nome do arquivo
 * @param {string} title - Título da página
 * @param {Object} options - Opções adicionais
 * @returns {HtmlOutput} Página HTML
 */
function renderPage_(filename, title, options) {
  const opts = options || {};
  const cleanFilename = String(filename || '').replace(/\.html$/i, '');
  
  const output = HtmlService.createTemplateFromFile(cleanFilename)
    .evaluate()
    .setTitle(title || 'Scientific Sheet CRUD')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.SAMEORIGIN); // P0-4: Proteção contra clickjacking
  
  if (opts.faviconUrl) {
    output.setFaviconUrl(opts.faviconUrl);
  }
  
  if (opts.width && opts.height) {
    output.setWidth(opts.width).setHeight(opts.height);
  }
  
  return output;
}

/**
 * Sanitiza entrada de usuário para prevenir XSS
 * @param {string} input - Texto a sanitizar
 * @returns {string} Texto sanitizado
 */
function sanitizeHtml_(input) {
  if (!input) return '';
  
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Cria link seguro com parâmetros
 * @param {string} baseUrl - URL base
 * @param {Object} params - Parâmetros a adicionar
 * @returns {string} URL completa
 */
function buildUrl_(baseUrl, params) {
  if (!params || Object.keys(params).length === 0) {
    return baseUrl;
  }
  
  const queryString = toQueryString_(params);
  const separator = baseUrl.indexOf('?') >= 0 ? '&' : '?';
  
  return baseUrl + separator + queryString;
}

/**
 * Obtém informações do ambiente de execução
 * @returns {Object} Info do ambiente
 */
function getEnvironmentInfo_() {
  return {
    timezone: Session.getScriptTimeZone(),
    locale: Session.getActiveUserLocale(),
    email: Session.getEffectiveUser().getEmail(), // PHI: usado apenas para contexto UI, não logado
    scriptId: ScriptApp.getScriptId(),
    version: APP_VERSION,
    timestamp: nowIso_()
  };
}

/**
 * Registra evento de acesso para auditoria
 * @param {string} page - Página acessada
 * @param {Object} context - Contexto adicional
 */
function logPageView_(page, context) {
  logInfo_('Page view: ' + page, {
    page: page,
    userAgent: context.userAgent || 'unknown',
    referrer: context.referrer || 'direct',
    timestamp: nowIso_()
  });
}

/**
 * Carrega recurso estático (CSS, JS) inline
 * @param {string} filename - Nome do arquivo
 * @param {string} type - Tipo: 'css' ou 'js'
 * @returns {string} Tag HTML com conteúdo
 */
function loadInlineResource_(filename, type) {
  try {
    const content = HtmlService.createTemplateFromFile(filename).evaluate().getContent();
    
    if (type === 'css') {
      return '<style>' + content + '</style>';
    } else if (type === 'js') {
      return '<script>' + content + '</script>';
    }
    
    return content;
  } catch (error) {
    logError_('Failed to load resource: ' + filename, { error: error.message });
    return '<!-- Erro ao carregar ' + filename + ' -->';
  }
}
