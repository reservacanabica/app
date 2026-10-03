/**
 * COMPONENTE: 56_FeatureFlagService.gs
 * PAPEL: Sistema de feature flags para controle de funcionalidades por ambiente/usuário.
 *
 * PRINCIPAIS FUNCIONALIDADES:
 * - Feature flags configuráveis por usuário, role ou globalmente
 * - Rollout gradual de funcionalidades (percentual de usuários)
 * - Estratégias de ativação (whitelist, blacklist, percentage, schedule)
 * - Histórico de mudanças de flags
 * - A/B testing support
 * - Emergency kill switch
 *
 * INTEGRAÇÕES:
 * - Middleware de feature flags
 * - ApiService para endpoints de gerenciamento
 * - PropertiesService para persistência
 *
 * STATUS: PRODUÇÃO - Sistema de feature flags completo
 */

/**
 * Estrutura de feature flag.
 * 
 * @typedef {Object} FeatureFlag
 * @property {string} key - Chave única da feature (ex: "new-dashboard")
 * @property {string} name - Nome legível
 * @property {string} description - Descrição da feature
 * @property {boolean} enabled - Se flag está globalmente habilitada
 * @property {string} strategy - Estratégia: "global", "whitelist", "blacklist", "percentage", "schedule", "role"
 * @property {Object} config - Configuração específica da estratégia
 * @property {string} createdBy - ID do usuário que criou
 * @property {string} createdAt - Data criação ISO 8601
 * @property {string} updatedAt - Data última atualização
 */

/**
 * Carrega todas as feature flags.
 * 
 * @returns {Object.<string, FeatureFlag>} Mapa de flags
 * @private
 */
function loadFeatureFlags_() {
  try {
    const props = PropertiesService.getScriptProperties();
    const stored = props.getProperty('FEATURE_FLAGS');
    
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    logError_('Failed to load feature flags', { error: e.message });
  }
  
  return {};
}

/**
 * Salva feature flags.
 * 
 * @param {Object.<string, FeatureFlag>} flags - Mapa de flags
 * @private
 */
function saveFeatureFlags_(flags) {
  try {
    const props = PropertiesService.getScriptProperties();
    props.setProperty('FEATURE_FLAGS', JSON.stringify(flags));
    
    logInfo_('Feature flags saved', { count: Object.keys(flags).length });
  } catch (e) {
    logError_('Failed to save feature flags', { error: e.message });
    throw createError_('FEATURE_FLAG_SAVE_FAILED', 'Não foi possível salvar feature flags');
  }
}

/**
 * Verifica se feature está habilitada para usuário/contexto.
 * 
 * @param {string} featureKey - Chave da feature
 * @param {Object} [user] - Usuário (opcional)
 * @param {Object} [context] - Contexto adicional (opcional)
 * @returns {boolean} true se feature habilitada
 * 
 * @example
 * if (isFeatureEnabled_('new-dashboard', user)) {
 *   // Renderiza novo dashboard
 * }
 * 
 * @example
 * // Com contexto
 * if (isFeatureEnabled_('export-csv', user, { format: 'csv' })) {
 *   // Permite exportação
 * }
 */
function isFeatureEnabled_(featureKey, user, context) {
  const flags = loadFeatureFlags_();
  const flag = flags[featureKey];
  
  // Flag não existe = desabilitada
  if (!flag) {
    return false;
  }
  
  // Flag globalmente desabilitada
  if (!flag.enabled) {
    return false;
  }
  
  // Aplica estratégia
  return evaluateStrategy_(flag, user, context);
}

/**
 * Avalia estratégia de feature flag.
 * 
 * @param {FeatureFlag} flag - Feature flag
 * @param {Object} [user] - Usuário
 * @param {Object} [context] - Contexto
 * @returns {boolean} true se habilitada pela estratégia
 * @private
 */
function evaluateStrategy_(flag, user, context) {
  const strategy = flag.strategy || 'global';
  const config = flag.config || {};
  
  switch (strategy) {
    case 'global':
      return true; // Habilitada para todos
    
    case 'whitelist':
      if (!user) return false;
      const whitelist = config.userIds || [];
      return whitelist.includes(user.id);
    
    case 'blacklist':
      if (!user) return true;
      const blacklist = config.userIds || [];
      return !blacklist.includes(user.id);
    
    case 'percentage':
      if (!user) return false;
      const percentage = config.percentage || 0;
      return isUserInPercentage_(user.id, flag.key, percentage);
    
    case 'role':
      if (!user) return false;
      const allowedRoles = config.roles || [];
      return allowedRoles.includes(user.role);
    
    case 'schedule':
      return isInSchedule_(config.schedule);
    
    case 'custom':
      // Permite função customizada
      if (config.evaluator && typeof config.evaluator === 'function') {
        return config.evaluator(user, context);
      }
      return false;
    
    default:
      logWarn_('Unknown feature flag strategy', { strategy: strategy, key: flag.key });
      return false;
  }
}

/**
 * Verifica se usuário está no percentual de rollout.
 * 
 * Usa hash consistente do userId + featureKey para garantir que
 * o mesmo usuário sempre recebe o mesmo resultado.
 * 
 * @param {string} userId - ID do usuário
 * @param {string} featureKey - Chave da feature
 * @param {number} percentage - Percentual (0-100)
 * @returns {boolean} true se usuário está no percentual
 * @private
 */
function isUserInPercentage_(userId, featureKey, percentage) {
  if (percentage >= 100) return true;
  if (percentage <= 0) return false;
  
  // Hash consistente
  const seed = userId + ':' + featureKey;
  const hash = hashString_(seed);
  const hashValue = parseInt(hash.substring(0, 8), 16);
  
  // Mapeia para 0-100
  const bucket = hashValue % 100;
  
  return bucket < percentage;
}

/**
 * Verifica se está dentro do schedule configurado.
 * 
 * @param {Object} schedule - Configuração de schedule
 * @param {string} [schedule.startDate] - Data início ISO 8601
 * @param {string} [schedule.endDate] - Data fim ISO 8601
 * @param {Array<string>} [schedule.daysOfWeek] - Dias da semana (0-6, 0=domingo)
 * @param {string} [schedule.startTime] - Hora início (HH:mm)
 * @param {string} [schedule.endTime] - Hora fim (HH:mm)
 * @returns {boolean} true se dentro do schedule
 * @private
 */
function isInSchedule_(schedule) {
  if (!schedule) return true;
  
  const now = new Date();
  
  // Verifica range de datas
  if (schedule.startDate) {
    const startDate = new Date(schedule.startDate);
    if (now < startDate) return false;
  }
  
  if (schedule.endDate) {
    const endDate = new Date(schedule.endDate);
    if (now > endDate) return false;
  }
  
  // Verifica dia da semana
  if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
    const dayOfWeek = now.getDay();
    if (!schedule.daysOfWeek.includes(dayOfWeek)) {
      return false;
    }
  }
  
  // Verifica horário
  if (schedule.startTime && schedule.endTime) {
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const startParts = schedule.startTime.split(':');
    const endParts = schedule.endTime.split(':');
    
    const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
    
    if (currentTime < startMinutes || currentTime > endMinutes) {
      return false;
    }
  }
  
  return true;
}

/**
 * Cria ou atualiza feature flag.
 * 
 * @param {string} key - Chave única da feature
 * @param {Object} flagData - Dados da flag
 * @param {string} flagData.name - Nome legível
 * @param {string} [flagData.description] - Descrição
 * @param {boolean} [flagData.enabled=false] - Se habilitada
 * @param {string} [flagData.strategy='global'] - Estratégia
 * @param {Object} [flagData.config] - Configuração da estratégia
 * @param {string} userId - ID do usuário que cria/atualiza
 * @returns {FeatureFlag} Flag criada/atualizada
 * 
 * @example
 * setFeatureFlag_('new-dashboard', {
 *   name: 'Novo Dashboard',
 *   description: 'Dashboard redesenhado com novas métricas',
 *   enabled: true,
 *   strategy: 'percentage',
 *   config: { percentage: 10 } // 10% dos usuários
 * }, 'admin-user-id');
 */
function setFeatureFlag_(key, flagData, userId) {
  const flags = loadFeatureFlags_();
  const isNew = !flags[key];
  const now = new Date().toISOString();
  
  const flag = {
    key: key,
    name: flagData.name,
    description: flagData.description || '',
    enabled: flagData.enabled !== undefined ? flagData.enabled : false,
    strategy: flagData.strategy || 'global',
    config: flagData.config || {},
    createdBy: isNew ? userId : flags[key].createdBy,
    createdAt: isNew ? now : flags[key].createdAt,
    updatedAt: now
  };
  
  flags[key] = flag;
  saveFeatureFlags_(flags);
  
  // Log alteração
  auditEvent_(
    isNew ? 'FEATURE_FLAG_CREATED' : 'FEATURE_FLAG_UPDATED',
    'FeatureFlags',
    key,
    isNew ? 'CREATE' : 'UPDATE',
    { flag: flag },
    getCorrelationId_(),
    userId
  );
  
  logInfo_('Feature flag set', { key: key, isNew: isNew });
  
  return flag;
}

/**
 * Remove feature flag.
 * 
 * @param {string} key - Chave da feature
 * @param {string} userId - ID do usuário que remove
 * @returns {boolean} true se removida
 */
function deleteFeatureFlag_(key, userId) {
  const flags = loadFeatureFlags_();
  
  if (!flags[key]) {
    return false;
  }
  
  delete flags[key];
  saveFeatureFlags_(flags);
  
  auditEvent_(
    'FEATURE_FLAG_DELETED',
    'FeatureFlags',
    key,
    'DELETE',
    {},
    getCorrelationId_(),
    userId
  );
  
  logInfo_('Feature flag deleted', { key: key });
  
  return true;
}

/**
 * Lista todas as feature flags.
 * 
 * @param {Object} [filters] - Filtros
 * @param {boolean} [filters.enabledOnly] - Apenas habilitadas
 * @param {string} [filters.strategy] - Filtrar por estratégia
 * @returns {Array<FeatureFlag>} Array de flags
 */
function listFeatureFlags_(filters) {
  filters = filters || {};
  const flags = loadFeatureFlags_();
  let result = Object.values(flags);
  
  // Filtro: apenas habilitadas
  if (filters.enabledOnly) {
    result = result.filter(function(flag) {
      return flag.enabled;
    });
  }
  
  // Filtro: estratégia
  if (filters.strategy) {
    result = result.filter(function(flag) {
      return flag.strategy === filters.strategy;
    });
  }
  
  // Ordena por nome
  result.sort(function(a, b) {
    return a.name.localeCompare(b.name);
  });
  
  return result;
}

/**
 * Obtém feature flag específica.
 * 
 * @param {string} key - Chave da feature
 * @returns {FeatureFlag|null} Flag ou null
 */
function getFeatureFlag_(key) {
  const flags = loadFeatureFlags_();
  return flags[key] || null;
}

/**
 * Avalia múltiplas features de uma vez.
 * 
 * @param {Array<string>} featureKeys - Array de chaves
 * @param {Object} [user] - Usuário
 * @param {Object} [context] - Contexto
 * @returns {Object.<string, boolean>} Mapa de key -> enabled
 * 
 * @example
 * const features = evaluateFeatures_(['new-dashboard', 'export-csv', 'beta-ui'], user);
 * // { 'new-dashboard': true, 'export-csv': false, 'beta-ui': true }
 */
function evaluateFeatures_(featureKeys, user, context) {
  const result = {};
  
  featureKeys.forEach(function(key) {
    result[key] = isFeatureEnabled_(key, user, context);
  });
  
  return result;
}

/**
 * Incrementa percentual de rollout gradualmente.
 * 
 * @param {string} key - Chave da feature
 * @param {number} increment - Incremento (ex: 10 para +10%)
 * @param {number} [max=100] - Percentual máximo
 * @param {string} userId - ID do usuário
 * @returns {FeatureFlag} Flag atualizada
 * 
 * @example
 * // Aumenta rollout em 10%
 * incrementRollout_('new-feature', 10, 100, 'admin-id');
 */
function incrementRollout_(key, increment, max, userId) {
  const flag = getFeatureFlag_(key);
  
  if (!flag) {
    throw createError_('FEATURE_FLAG_NOT_FOUND', 'Feature flag não encontrada');
  }
  
  if (flag.strategy !== 'percentage') {
    throw createError_('INVALID_STRATEGY', 'Feature não usa estratégia de percentual');
  }
  
  max = max || 100;
  const currentPercentage = flag.config.percentage || 0;
  const newPercentage = Math.min(currentPercentage + increment, max);
  
  flag.config.percentage = newPercentage;
  flag.updatedAt = new Date().toISOString();
  
  const flags = loadFeatureFlags_();
  flags[key] = flag;
  saveFeatureFlags_(flags);
  
  auditEvent_(
    'FEATURE_FLAG_ROLLOUT_INCREMENTED',
    'FeatureFlags',
    key,
    'UPDATE',
    { from: currentPercentage, to: newPercentage },
    getCorrelationId_(),
    userId
  );
  
  logInfo_('Feature flag rollout incremented', { 
    key: key, 
    from: currentPercentage, 
    to: newPercentage 
  });
  
  return flag;
}

/**
 * Emergency kill switch - desabilita feature imediatamente.
 * 
 * @param {string} key - Chave da feature
 * @param {string} reason - Motivo da desabilitação
 * @param {string} userId - ID do usuário
 * @returns {FeatureFlag} Flag desabilitada
 */
function killSwitchFeature_(key, reason, userId) {
  const flag = getFeatureFlag_(key);
  
  if (!flag) {
    throw createError_('FEATURE_FLAG_NOT_FOUND', 'Feature flag não encontrada');
  }
  
  flag.enabled = false;
  flag.updatedAt = new Date().toISOString();
  
  const flags = loadFeatureFlags_();
  flags[key] = flag;
  saveFeatureFlags_(flags);
  
  auditEvent_(
    'FEATURE_FLAG_KILLED',
    'FeatureFlags',
    key,
    'KILL_SWITCH',
    { reason: reason },
    getCorrelationId_(),
    userId
  );
  
  logWarn_('Feature flag killed', { key: key, reason: reason });
  
  return flag;
}

/**
 * Obtém estatísticas de uso de feature flags.
 * 
 * @returns {Object} Estatísticas
 */
function getFeatureFlagStats_() {
  const flags = loadFeatureFlags_();
  const allFlags = Object.values(flags);
  
  const stats = {
    total: allFlags.length,
    enabled: 0,
    disabled: 0,
    byStrategy: {},
    recentlyUpdated: []
  };
  
  allFlags.forEach(function(flag) {
    if (flag.enabled) {
      stats.enabled++;
    } else {
      stats.disabled++;
    }
    
    const strategy = flag.strategy || 'global';
    stats.byStrategy[strategy] = (stats.byStrategy[strategy] || 0) + 1;
  });
  
  // Últimas 5 atualizadas
  const sorted = allFlags.sort(function(a, b) {
    return new Date(b.updatedAt) - new Date(a.updatedAt);
  });
  
  stats.recentlyUpdated = sorted.slice(0, 5).map(function(flag) {
    return {
      key: flag.key,
      name: flag.name,
      updatedAt: flag.updatedAt
    };
  });
  
  return stats;
}

// ============================================================================
// FEATURE FLAGS PRÉ-DEFINIDAS
// ============================================================================

/**
 * Inicializa feature flags padrão do sistema.
 * 
 * @param {string} userId - ID do usuário admin
 */
function initializeDefaultFeatureFlags_(userId) {
  const defaultFlags = [
    {
      key: 'new-dashboard',
      name: 'Novo Dashboard',
      description: 'Dashboard redesenhado com visualizações aprimoradas',
      enabled: false,
      strategy: 'percentage',
      config: { percentage: 0 }
    },
    {
      key: 'advanced-filters',
      name: 'Filtros Avançados',
      description: 'Sistema de filtros avançados com query builder',
      enabled: false,
      strategy: 'role',
      config: { roles: ['admin', 'researcher'] }
    },
    {
      key: 'export-formats',
      name: 'Formatos de Exportação Adicionais',
      description: 'Suporte a JSON, XML e Excel',
      enabled: true,
      strategy: 'global'
    },
    {
      key: 'real-time-collaboration',
      name: 'Colaboração em Tempo Real',
      description: 'Edição colaborativa de estudos',
      enabled: false,
      strategy: 'whitelist',
      config: { userIds: [] }
    },
    {
      key: 'beta-features',
      name: 'Features Beta',
      description: 'Acesso a funcionalidades em desenvolvimento',
      enabled: false,
      strategy: 'role',
      config: { roles: ['admin'] }
    }
  ];
  
  defaultFlags.forEach(function(flagData) {
    setFeatureFlag_(flagData.key, flagData, userId);
  });
  
  logInfo_('Default feature flags initialized', { count: defaultFlags.length });
}

/**
 * Helper para verificar múltiplas features de uma vez.
 * Útil para componentes que dependem de várias flags.
 * 
 * @param {Array<string>} requiredKeys - Features obrigatórias (todas devem estar ON)
 * @param {Array<string>} [optionalKeys] - Features opcionais
 * @param {Object} [user] - Usuário
 * @returns {Object} { allRequired: boolean, optional: {...} }
 */
function checkFeatureBundle_(requiredKeys, optionalKeys, user) {
  const required = {};
  let allRequired = true;
  
  requiredKeys.forEach(function(key) {
    const enabled = isFeatureEnabled_(key, user);
    required[key] = enabled;
    if (!enabled) allRequired = false;
  });
  
  const optional = {};
  if (optionalKeys) {
    optionalKeys.forEach(function(key) {
      optional[key] = isFeatureEnabled_(key, user);
    });
  }
  
  return {
    allRequired: allRequired,
    required: required,
    optional: optional
  };
}
