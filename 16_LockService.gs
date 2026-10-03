/**
 * COMPONENTE: 16_LockService.gs
 * PAPEL: Wrapper do LockService nativo
 *
 * RESPONSABILIDADE:
 * - Adquirir/liberar locks com timeout
 * - Evitar race conditions
 * - Prevenir deadlock
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// LOCK ACQUISITION
// ============================================================================

/**
 * Adquire um lock exclusivo do Google Apps Script com timeout configurável
 * 
 * Tenta adquirir um lock de script usando LockService nativo. Se não conseguir
 * dentro do timeout, retorna acquired=false. Essencial para prevenir race conditions
 * em operações concorrentes de escrita em planilhas.
 *
 * @param {string} lockName - Nome único identificador do lock (usado apenas para logs/debug)
 * @param {number} [timeoutSeconds=30] - Tempo máximo em segundos para aguardar o lock
 * @returns {object} Resultado: {acquired: boolean, error?: string, lockName: string, timeout?: number}
 * @throws {Error} Se houver erro interno do LockService (retornado como {acquired: false, error: message})
 * @example
 * const result = acquireLock_('WRITE_USERS', 10);
 * if (result.acquired) {
 *   // executar operação crítica
 *   releaseLock_('WRITE_USERS');
 * }
 */
function acquireLock_(lockName, timeoutSeconds) {
  timeoutSeconds = timeoutSeconds || CONFIG_DEFAULTS.LOCK_TIMEOUT_SECONDS;

  try {
    const lock = LockService.getScriptLock();
    
    // tryLock retorna false se não conseguir
    const acquired = lock.tryLock(timeoutSeconds * 1000);

    if (!acquired) {
      return {
        acquired: false,
        error: 'Timeout ao adquirir lock: ' + lockName,
        lockName: lockName
      };
    }

    return {
      acquired: true,
      lockName: lockName,
      timeout: timeoutSeconds
    };

  } catch (error) {
    return {
      acquired: false,
      error: error.message,
      lockName: lockName
    };
  }
}

/**
 * Libera lock
 *
 * @param {string} lockName
 */
function releaseLock_(lockName) {
  try {
    const lock = LockService.getScriptLock();
    lock.releaseLock();
  } catch (error) {
    logWarn_('Erro ao liberar lock', {
      lockName: lockName,
      error: error.message
    });
  }
}

// ============================================================================
// OPERAÇÕES COM LOCK
// ============================================================================

/**
 * Executa uma função dentro de um lock exclusivo (pattern: acquire-execute-release)
 * 
 * Adquire o lock, executa a função fornecida, libera o lock e retorna o resultado.
 * Se o lock não puder ser adquirido ou se a função lançar erro, garante que o lock
 * seja sempre liberado (pattern try-finally). Ideal para operações atômicas em planilhas.
 *
 * @param {string} lockName - Nome identificador do lock
 * @param {Function} fn - Função a ser executada dentro do lock (sem parâmetros)
 * @param {number} [timeoutSeconds] - Timeout opcional para aguardar o lock
 * @returns {object} Resultado: {success: boolean, result: any, error: string|null}
 * @example
 * const result = withLock_('WRITE_USERS', function() {
 *   return createUser_({username: 'john', role: 'VIEWER'});
 * }, 15);
 * if (result.success) console.log('User created:', result.result);
 */
function withLock_(lockName, fn, timeoutSeconds) {
  const lockResult = acquireLock_(lockName, timeoutSeconds);

  if (!lockResult.acquired) {
    return {
      success: false,
      error: lockResult.error,
      result: null
    };
  }

  try {
    const result = fn();
    releaseLock_(lockName);

    return {
      success: true,
      result: result,
      error: null
    };

  } catch (error) {
    releaseLock_(lockName);

    return {
      success: false,
      error: error.message,
      result: null
    };
  }
}

// ============================================================================
// LOCKS ESPECÍFICAS
// ============================================================================

/**
 * Lock para operações de escrita em Users
 */
function withUserLock_(fn) {
  return withLock_('LOCK_USERS', fn, 10);
}

/**
 * Lock para operações de escrita em Sessions
 */
function withSessionLock_(fn) {
  return withLock_('LOCK_SESSIONS', fn, 10);
}

/**
 * Lock para operações de escrita em Studies
 */
function withStudyLock_(fn) {
  return withLock_('LOCK_STUDIES', fn, 15);
}

/**
 * Lock para operações de escrita em Experiments
 */
function withExperimentLock_(fn) {
  return withLock_('LOCK_EXPERIMENTS', fn, 15);
}

/**
 * Lock para operações de escrita em Observations
 */
function withObservationLock_(fn) {
  return withLock_('LOCK_OBSERVATIONS', fn, 10);
}

/**
 * Lock para operações em AuditLog
 */
function withAuditLock_(fn) {
  return withLock_('LOCK_AUDIT', fn, 5);
}

/**
 * Lock para operações de schema
 */
function withSchemaLock_(fn) {
  return withLock_('LOCK_SCHEMA', fn, 30);
}

// ============================================================================
// LOCK STATS
// ============================================================================

/**
 * Retorna estatísticas de locks (informacional)
 *
 * @returns {object}
 */
function getLockStats_() {
  return {
    lockService: 'Google Apps Script LockService',
    maxTimeout: CONFIG_DEFAULTS.LOCK_TIMEOUT_SECONDS + ' seconds',
    timestamp: nowIso_(),
    note: 'LockService é by-script, não global. Use com cuidado em concorrência.'
  };
}

// ============================================================================
// EXPORTAR
// ============================================================================

const LOCK_SERVICE_LOADED = true;
