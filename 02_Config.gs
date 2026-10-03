/**
 * COMPONENTE: 02_Config.gs
 * PAPEL: Leitura de Script Properties; validações obrigatórias; inicialização
 *
 * FLUXO:
 * 1. Chamado por 45_SetupService.gs durante setupProject_()
 * 2. Valida properties obrigatórias
 * 3. Fornece getters seguros com fallbacks
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// GETTERS DE CONFIGURAÇÃO COM VALIDAÇÃO
// ============================================================================

/**
 * Obtém ID da planilha — OBRIGATÓRIO
 */
function getSpreadsheetId_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEETS_ID');
  if (!id || id.trim() === '') {
    throw new Error('FATAL: SPREADSHEETS_ID não configurado em Script Properties');
  }
  return id;
}

/**
 * Obtém duração de sessão em horas
 */
function getSessionTTLHours_() {
  const ttl = PropertiesService.getScriptProperties().getProperty('SESSION_TTL_HOURS');
  return parseInt(ttl || CONFIG_DEFAULTS.SESSION_TTL_HOURS);
}

/**
 * Se true, permite senhas em texto plano (APENAS PROTÓTIPO)
 */
function usePlainTextPasswords_() {
  const flag = PropertiesService.getScriptProperties().getProperty('PLAIN_TEXT_PASSWORDS');
  return (flag === 'true');
}

/**
 * Nível de logging
 */
function getLogLevel_() {
  const level = PropertiesService.getScriptProperties().getProperty('LOG_LEVEL');
  return level || 'INFO';
}

/**
 * Se auditoria está ativada
 */
function isAuditLogEnabled_() {
  const flag = PropertiesService.getScriptProperties().getProperty('ENABLE_AUDIT_LOG');
  return (flag !== 'false');
}

/**
 * TTL padrão cache em segundos
 */
function getCacheTTLSeconds_() {
  const ttl = PropertiesService.getScriptProperties().getProperty('CACHE_TTL_SECONDS');
  return parseInt(ttl || CONFIG_DEFAULTS.CACHE_TTL_SECONDS);
}

/**
 * Máximo de registros por operação batch
 */
function getMaxBatchSize_() {
  const size = PropertiesService.getScriptProperties().getProperty('MAX_BATCH_SIZE');
  return parseInt(size || CONFIG_DEFAULTS.MAX_BATCH_SIZE);
}

/**
 * Timezone para operações de data
 */
function getTimezone_() {
  return PropertiesService.getScriptProperties().getProperty('TIMEZONE') || 'UTC';
}

/**
 * Localização padrão
 */
function getLocale_() {
  return PropertiesService.getScriptProperties().getProperty('LOCALE') || 'pt-BR';
}

/**
 * Modo debug
 */
function isDebugMode_() {
  const flag = PropertiesService.getScriptProperties().getProperty('DEBUG_MODE');
  return (flag === 'true');
}

/**
 * ID da pasta no Google Drive onde os PNGs de análise dos notebooks serão depositados.
 * Configure via Script Properties: FOLDER_ID → <ID_DA_PASTA_DO_DRIVE>
 *
 * Como obter o ID: abra a pasta no Drive, copie o trecho após /folders/ na URL.
 * Exemplo: https://drive.google.com/drive/folders/1aBcD2eFgHiJ3kLmN → "1aBcD2eFgHiJ3kLmN"
 *
 * @returns {string|null} ID da pasta ou null se não configurado
 */
function getAnalysesFolderId_() {
  const id = PropertiesService.getScriptProperties().getProperty('FOLDER_ID');
  if (!id || id.trim() === '') {
    logWarn_('FOLDER_ID não configurado em Script Properties — PNGs de análise não serão salvos no Drive', {});
    return null;
  }
  return id.trim();
}

/**
 * Verifica se a pasta de análises está configurada e acessível.
 * Útil para health-check antes de executar notebooks.
 *
 * @returns {{ok: boolean, folderId: string|null, folderName: string|null, error: string|null}}
 */
function checkAnalysesFolderHealth_() {
  const folderId = getAnalysesFolderId_();
  if (!folderId) {
    return { ok: false, folderId: null, folderName: null, error: 'FOLDER_ID não configurado' };
  }
  try {
    const folder = DriveApp.getFolderById(folderId);
    return { ok: true, folderId: folderId, folderName: folder.getName(), error: null };
  } catch (e) {
    return { ok: false, folderId: folderId, folderName: null, error: String(e.message) };
  }
}

// ============================================================================
// INICIALIZAÇÃO E VALIDAÇÃO
// ============================================================================

/**
 * Valida que todas as properties obrigatórias estão configuradas
 * Chamado por 45_SetupService.gs
 *
 * @throws {Error} Se properties obrigatórias faltam
 */
function validateConfiguration_() {
  const errors = [];

  // Verificar SPREADSHEETS_ID (obrigatório)
  try {
    getSpreadsheetId_();
  } catch (e) {
    errors.push('SPREADSHEETS_ID: ' + e.message);
  }

  // Verificar CPF_HMAC_KEY (obrigatório para segurança LGPD)
  const scriptProperties = PropertiesService.getScriptProperties();
  const cpfHmacKey = scriptProperties.getProperty('CPF_HMAC_KEY');
  if (!cpfHmacKey || cpfHmacKey.length < 16) {
    errors.push('CPF_HMAC_KEY: Chave HMAC não configurada ou muito curta (mínimo 16 caracteres). Configure nas Script Properties antes de inicializar o sistema. Gere com: openssl rand -base64 32');
  }

  if (errors.length > 0) {
    throw new Error('Configuração inválida:\n' + errors.join('\n'));
  }
}

/**
 * Inicializa configuration com valores padrão se não existir
 * Chamado por 45_SetupService.gs
 */
function initializeDefaultConfiguration_() {
  const scriptProperties = PropertiesService.getScriptProperties();

  const defaults = {
    'SESSION_TTL_HOURS': String(CONFIG_DEFAULTS.SESSION_TTL_HOURS),
    'PLAIN_TEXT_PASSWORDS': 'true', // APENAS PROTÓTIPO
    'LOG_LEVEL': 'INFO',
    'ENABLE_AUDIT_LOG': 'true',
    'CACHE_TTL_SECONDS': String(CONFIG_DEFAULTS.CACHE_TTL_SECONDS),
    'MAX_BATCH_SIZE': String(CONFIG_DEFAULTS.MAX_BATCH_SIZE),
    'TIMEZONE': 'UTC',
    'LOCALE': 'pt-BR',
    'DEBUG_MODE': 'false'
  };

  Object.keys(defaults).forEach(function(key) {
    if (!scriptProperties.getProperty(key)) {
      scriptProperties.setProperty(key, defaults[key]);
    }
  });
}

/**
 * Retorna objeto com toda configuração atual
 */
function getAllConfiguration_() {
  const scriptProperties = PropertiesService.getScriptProperties();
  const allProps = scriptProperties.getProperties();

  return {
    SPREADSHEETS_ID:    allProps['SPREADSHEETS_ID'] || 'NOT SET',
    FOLDER_ID:          allProps['FOLDER_ID']        || 'NOT SET',
    SESSION_TTL_HOURS:  getSessionTTLHours_(),
    PLAIN_TEXT_PASSWORDS: usePlainTextPasswords_(),
    LOG_LEVEL:          getLogLevel_(),
    ENABLE_AUDIT_LOG:   isAuditLogEnabled_(),
    CACHE_TTL_SECONDS:  getCacheTTLSeconds_(),
    MAX_BATCH_SIZE:     getMaxBatchSize_(),
    TIMEZONE:           getTimezone_(),
    LOCALE:             getLocale_(),
    DEBUG_MODE:         isDebugMode_()
  };
}

// ============================================================================
// EXPORTAR
// ============================================================================

const CONFIG_LOADED = true;
