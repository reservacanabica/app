/**
 * COMPONENTE: 55_LRUCache.gs
 * PAPEL: Sistema de cache LRU (Least Recently Used) com eviction policy inteligente.
 *
 * PRINCIPAIS FUNCIONALIDADES:
 * - Cache com política de eviction LRU
 * - Tamanho máximo configurável
 * - TTL (Time To Live) por entrada
 * - Estatísticas de hit rate e performance
 * - Suporte a namespace para organização
 * - Invalidação seletiva e em lote
 *
 * INTEGRAÇÕES:
 * - CacheService do Google Apps Script (como storage backend)
 * - ApiService (middleware de cache)
 *
 * LIMITAÇÕES:
 * - Google Apps Script CacheService tem limite de 100KB por entrada
 * - Cache é por script execution (não persiste entre execuções)
 * - Para cache persistente, usar PropertiesService (mais lento)
 *
 * STATUS: PRODUÇÃO - Cache inteligente com LRU eviction
 */

/**
 * Classe LRUCache com política de eviction.
 * 
 * @class LRUCache
 * @param {Object} options - Opções de configuração
 * @param {number} [options.maxSize=100] - Número máximo de entradas
 * @param {number} [options.defaultTTL=300] - TTL padrão em segundos
 * @param {string} [options.namespace='default'] - Namespace do cache
 * @param {boolean} [options.persistent=false] - Usar PropertiesService (persistente mas lento)
 */
function LRUCache(options) {
  options = options || {};
  
  this.maxSize = options.maxSize || 100;
  this.defaultTTL = options.defaultTTL || 300; // 5 minutos
  this.namespace = options.namespace || 'default';
  this.persistent = options.persistent || false;
  
  // Storage backend
  this.storage = this.persistent 
    ? PropertiesService.getScriptProperties()
    : CacheService.getScriptCache();
  
  // Metadata em memória para acesso rápido
  this.metadata = this._loadMetadata();
  
  // Estatísticas
  this.stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    errors: 0
  };
}

/**
 * Carrega metadata do storage.
 * 
 * @returns {Object} Metadata
 * @private
 */
LRUCache.prototype._loadMetadata = function() {
  try {
    const key = this._metadataKey();
    const stored = this.storage.getProperty ? 
      this.storage.getProperty(key) : 
      this.storage.get(key);
    
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    logWarn_('Failed to load cache metadata', { error: e.message });
  }
  
  return {
    keys: [],        // Array de chaves ordenadas por último acesso
    entries: {},     // Map de chave -> { size, expires, accessed }
    totalSize: 0     // Tamanho total em número de entradas
  };
};

/**
 * Salva metadata no storage.
 * 
 * @private
 */
LRUCache.prototype._saveMetadata = function() {
  try {
    const key = this._metadataKey();
    const serialized = JSON.stringify(this.metadata);
    
    if (this.storage.setProperty) {
      this.storage.setProperty(key, serialized);
    } else {
      // CacheService - usa TTL longo para metadata
      this.storage.put(key, serialized, 21600); // 6 horas
    }
  } catch (e) {
    logError_('Failed to save cache metadata', { error: e.message });
    this.stats.errors++;
  }
};

/**
 * Gera chave de metadata.
 * 
 * @returns {string} Chave
 * @private
 */
LRUCache.prototype._metadataKey = function() {
  return 'lru:meta:' + this.namespace;
};

/**
 * Gera chave completa com namespace.
 * 
 * @param {string} key - Chave original
 * @returns {string} Chave com namespace
 * @private
 */
LRUCache.prototype._fullKey = function(key) {
  return 'lru:' + this.namespace + ':' + key;
};

/**
 * Obtém valor do cache.
 * 
 * @param {string} key - Chave
 * @returns {*} Valor ou null se não encontrado/expirado
 * 
 * @example
 * const value = cache.get('user:123');
 * if (value) {
 *   console.log('Cache hit:', value);
 * }
 */
LRUCache.prototype.get = function(key) {
  try {
    const fullKey = this._fullKey(key);
    const entry = this.metadata.entries[key];
    
    // Verifica se existe e não expirou
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    if (entry.expires && entry.expires < Date.now()) {
      // Expirado - remove
      this.delete(key);
      this.stats.misses++;
      return null;
    }
    
    // Busca valor do storage
    let value;
    if (this.storage.getProperty) {
      value = this.storage.getProperty(fullKey);
    } else {
      value = this.storage.get(fullKey);
    }
    
    if (!value) {
      // Inconsistência: metadata existe mas valor não
      delete this.metadata.entries[key];
      const keyIndex = this.metadata.keys.indexOf(key);
      if (keyIndex >= 0) {
        this.metadata.keys.splice(keyIndex, 1);
      }
      this._saveMetadata();
      this.stats.misses++;
      return null;
    }
    
    // Atualiza último acesso (move para o final = mais recente)
    this._touch(key);
    
    this.stats.hits++;
    
    // Desserializa
    return JSON.parse(value);
    
  } catch (e) {
    logError_('Cache get failed', { key: key, error: e.message });
    this.stats.errors++;
    return null;
  }
};

/**
 * Armazena valor no cache.
 * 
 * @param {string} key - Chave
 * @param {*} value - Valor (será serializado como JSON)
 * @param {number} [ttl] - TTL em segundos (usa defaultTTL se omitido)
 * @returns {boolean} true se armazenado com sucesso
 * 
 * @example
 * cache.set('user:123', { name: 'John', role: 'admin' }, 600);
 */
LRUCache.prototype.set = function(key, value, ttl) {
  try {
    ttl = ttl || this.defaultTTL;
    
    // Verifica se precisa fazer eviction
    if (this.metadata.totalSize >= this.maxSize && !this.metadata.entries[key]) {
      this._evictLRU();
    }
    
    // Serializa valor
    const serialized = JSON.stringify(value);
    const fullKey = this._fullKey(key);
    
    // Armazena no storage
    if (this.storage.setProperty) {
      this.storage.setProperty(fullKey, serialized);
    } else {
      this.storage.put(fullKey, serialized, ttl);
    }
    
    // Atualiza metadata
    const isNew = !this.metadata.entries[key];
    
    this.metadata.entries[key] = {
      size: serialized.length,
      expires: Date.now() + (ttl * 1000),
      accessed: Date.now()
    };
    
    if (isNew) {
      this.metadata.keys.push(key);
      this.metadata.totalSize++;
    } else {
      // Atualiza posição (move para o final)
      this._touch(key);
    }
    
    this._saveMetadata();
    this.stats.sets++;
    
    return true;
    
  } catch (e) {
    logError_('Cache set failed', { key: key, error: e.message });
    this.stats.errors++;
    return false;
  }
};

/**
 * Remove entrada do cache.
 * 
 * @param {string} key - Chave
 * @returns {boolean} true se removido
 */
LRUCache.prototype.delete = function(key) {
  try {
    const fullKey = this._fullKey(key);
    
    // Remove do storage
    if (this.storage.deleteProperty) {
      this.storage.deleteProperty(fullKey);
    } else {
      this.storage.remove(fullKey);
    }
    
    // Remove metadata
    if (this.metadata.entries[key]) {
      delete this.metadata.entries[key];
      
      const keyIndex = this.metadata.keys.indexOf(key);
      if (keyIndex >= 0) {
        this.metadata.keys.splice(keyIndex, 1);
        this.metadata.totalSize--;
      }
      
      this._saveMetadata();
      return true;
    }
    
    return false;
    
  } catch (e) {
    logError_('Cache delete failed', { key: key, error: e.message });
    this.stats.errors++;
    return false;
  }
};

/**
 * Verifica se chave existe no cache (sem afetar LRU).
 * 
 * @param {string} key - Chave
 * @returns {boolean} true se existe e não expirou
 */
LRUCache.prototype.has = function(key) {
  const entry = this.metadata.entries[key];
  
  if (!entry) {
    return false;
  }
  
  if (entry.expires && entry.expires < Date.now()) {
    return false;
  }
  
  return true;
};

/**
 * Limpa todo o cache do namespace.
 * 
 * @returns {number} Número de entradas removidas
 */
LRUCache.prototype.clear = function() {
  try {
    const count = this.metadata.keys.length;
    
    // Remove todas as entradas do storage
    this.metadata.keys.forEach(function(key) {
      const fullKey = this._fullKey(key);
      if (this.storage.deleteProperty) {
        this.storage.deleteProperty(fullKey);
      } else {
        this.storage.remove(fullKey);
      }
    }.bind(this));
    
    // Reseta metadata
    this.metadata = {
      keys: [],
      entries: {},
      totalSize: 0
    };
    
    this._saveMetadata();
    
    return count;
    
  } catch (e) {
    logError_('Cache clear failed', { error: e.message });
    this.stats.errors++;
    return 0;
  }
};

/**
 * Atualiza último acesso (move para o final da fila LRU).
 * 
 * @param {string} key - Chave
 * @private
 */
LRUCache.prototype._touch = function(key) {
  const keyIndex = this.metadata.keys.indexOf(key);
  if (keyIndex >= 0) {
    // Remove da posição atual
    this.metadata.keys.splice(keyIndex, 1);
    // Adiciona no final (mais recente)
    this.metadata.keys.push(key);
  }
  
  if (this.metadata.entries[key]) {
    this.metadata.entries[key].accessed = Date.now();
  }
};

/**
 * Remove entrada menos recentemente usada (LRU eviction).
 * 
 * @private
 */
LRUCache.prototype._evictLRU = function() {
  if (this.metadata.keys.length === 0) {
    return;
  }
  
  // Primeira chave é a menos recentemente usada
  const lruKey = this.metadata.keys[0];
  
  logInfo_('LRU eviction', { 
    key: lruKey, 
    namespace: this.namespace,
    totalSize: this.metadata.totalSize 
  });
  
  this.delete(lruKey);
  this.stats.evictions++;
};

/**
 * Limpa entradas expiradas.
 * 
 * @returns {number} Número de entradas removidas
 */
LRUCache.prototype.cleanup = function() {
  const now = Date.now();
  let removed = 0;
  
  const expiredKeys = this.metadata.keys.filter(function(key) {
    const entry = this.metadata.entries[key];
    return entry && entry.expires && entry.expires < now;
  }.bind(this));
  
  expiredKeys.forEach(function(key) {
    this.delete(key);
    removed++;
  }.bind(this));
  
  if (removed > 0) {
    logInfo_('Cache cleanup', { removed: removed, namespace: this.namespace });
  }
  
  return removed;
};

/**
 * Obtém estatísticas do cache.
 * 
 * @returns {Object} Estatísticas
 * 
 * @example
 * const stats = cache.getStats();
 * console.log('Hit rate:', stats.hitRate);
 */
LRUCache.prototype.getStats = function() {
  const totalRequests = this.stats.hits + this.stats.misses;
  const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) : 0;
  
  return {
    hits: this.stats.hits,
    misses: this.stats.misses,
    sets: this.stats.sets,
    evictions: this.stats.evictions,
    errors: this.stats.errors,
    hitRate: hitRate,
    hitRatePercent: (hitRate * 100).toFixed(2) + '%',
    size: this.metadata.totalSize,
    maxSize: this.maxSize,
    utilization: ((this.metadata.totalSize / this.maxSize) * 100).toFixed(2) + '%',
    namespace: this.namespace
  };
};

/**
 * Reseta estatísticas.
 */
LRUCache.prototype.resetStats = function() {
  this.stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    evictions: 0,
    errors: 0
  };
};

/**
 * Lista todas as chaves do cache (ordenadas por LRU).
 * 
 * @param {number} [limit] - Número máximo de chaves a retornar
 * @returns {Array<Object>} Array de {key, accessed, expires, size}
 */
LRUCache.prototype.keys = function(limit) {
  const result = [];
  const keys = limit ? this.metadata.keys.slice(-limit) : this.metadata.keys;
  
  keys.forEach(function(key) {
    const entry = this.metadata.entries[key];
    if (entry) {
      result.push({
        key: key,
        accessed: new Date(entry.accessed).toISOString(),
        expires: entry.expires ? new Date(entry.expires).toISOString() : null,
        size: entry.size
      });
    }
  }.bind(this));
  
  return result;
};

/**
 * Obtém múltiplas entradas de uma vez.
 * 
 * @param {Array<string>} keys - Array de chaves
 * @returns {Object} Mapa de chave -> valor
 * 
 * @example
 * const values = cache.getMulti(['key1', 'key2', 'key3']);
 * // { key1: value1, key2: value2, key3: null }
 */
LRUCache.prototype.getMulti = function(keys) {
  const result = {};
  
  keys.forEach(function(key) {
    result[key] = this.get(key);
  }.bind(this));
  
  return result;
};

/**
 * Armazena múltiplas entradas de uma vez.
 * 
 * @param {Object} entries - Mapa de chave -> valor
 * @param {number} [ttl] - TTL comum para todas as entradas
 * @returns {Object} Mapa de chave -> boolean (sucesso)
 * 
 * @example
 * cache.setMulti({
 *   'key1': value1,
 *   'key2': value2
 * }, 600);
 */
LRUCache.prototype.setMulti = function(entries, ttl) {
  const result = {};
  
  Object.keys(entries).forEach(function(key) {
    result[key] = this.set(key, entries[key], ttl);
  }.bind(this));
  
  return result;
};

/**
 * Invalida entradas por padrão (regex ou prefix).
 * 
 * @param {string|RegExp} pattern - Padrão para matching
 * @returns {number} Número de entradas invalidadas
 * 
 * @example
 * // Invalida todas as chaves de usuário
 * cache.invalidatePattern(/^user:/);
 * 
 * @example
 * // Invalida por prefix
 * cache.invalidatePattern('study:');
 */
LRUCache.prototype.invalidatePattern = function(pattern) {
  let removed = 0;
  const regex = pattern instanceof RegExp ? pattern : new RegExp('^' + pattern);
  
  const matchingKeys = this.metadata.keys.filter(function(key) {
    return regex.test(key);
  });
  
  matchingKeys.forEach(function(key) {
    if (this.delete(key)) {
      removed++;
    }
  }.bind(this));
  
  if (removed > 0) {
    logInfo_('Cache invalidation', { 
      pattern: pattern.toString(), 
      removed: removed, 
      namespace: this.namespace 
    });
  }
  
  return removed;
};

// ============================================================================
// CACHE MANAGER GLOBAL
// ============================================================================

var _cacheInstances = {};

/**
 * Obtém ou cria instância de cache por namespace.
 * 
 * @param {string} [namespace='default'] - Namespace do cache
 * @param {Object} [options] - Opções de configuração
 * @returns {LRUCache} Instância de cache
 * 
 * @example
 * const apiCache = getCacheInstance_('api', { maxSize: 200, defaultTTL: 600 });
 * const userCache = getCacheInstance_('users', { maxSize: 50, defaultTTL: 300 });
 */
function getCacheInstance_(namespace, options) {
  namespace = namespace || 'default';
  
  if (!_cacheInstances[namespace]) {
    options = options || {};
    options.namespace = namespace;
    _cacheInstances[namespace] = new LRUCache(options);
  }
  
  return _cacheInstances[namespace];
}

/**
 * Limpa todas as instâncias de cache.
 * 
 * @returns {Object} Estatísticas por namespace
 */
function clearAllCaches_() {
  const stats = {};
  
  Object.keys(_cacheInstances).forEach(function(namespace) {
    const cache = _cacheInstances[namespace];
    const removed = cache.clear();
    stats[namespace] = removed;
  });
  
  return stats;
}

/**
 * Obtém estatísticas de todas as instâncias de cache.
 * 
 * @returns {Object} Estatísticas por namespace
 */
function getAllCacheStats_() {
  const stats = {};
  
  Object.keys(_cacheInstances).forEach(function(namespace) {
    const cache = _cacheInstances[namespace];
    stats[namespace] = cache.getStats();
  });
  
  return stats;
}

/**
 * Executa cleanup em todas as instâncias de cache.
 * 
 * @returns {Object} Número de entradas removidas por namespace
 */
function cleanupAllCaches_() {
  const removed = {};
  
  Object.keys(_cacheInstances).forEach(function(namespace) {
    const cache = _cacheInstances[namespace];
    removed[namespace] = cache.cleanup();
  });
  
  return removed;
}

/**
 * Helper: constrói chave de cache padronizada.
 * 
 * @param {string} action - Ação da API
 * @param {Object} data - Dados da requisição
 * @param {Object} [user] - Usuário (para cache por usuário)
 * @returns {string} Chave de cache
 */
function buildCacheKey_(action, data, user) {
  const parts = [action];
  
  if (user) {
    parts.push('u:' + user.id);
  }
  
  if (data && Object.keys(data).length > 0) {
    // Hash simplificado dos dados
    const dataStr = JSON.stringify(data);
    const hash = hashString_(dataStr);
    parts.push('d:' + hash);
  }
  
  return parts.join(':');
}

/**
 * Hash simples de string (djb2 algorithm).
 * 
 * @param {string} str - String a hashear
 * @returns {string} Hash hexadecimal
 * @private
 */
function hashString_(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash).toString(16);
}
