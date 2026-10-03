/**
 * COMPONENTE: BatchJobRepository.gs
 * PAPEL: Data access layer para BatchJobs
 *
 * RESPONSABILIDADE:
 * - CRUD primitivo e consultas de jobs em batch
 * - Sem lógica de negócio (processamento, retry ficam no Service)
 * - Usa a camada genérica de CRUD (23_CrudService.gs), que por sua vez
 *   usa o SpreadsheetGateway como único ponto de I/O
 *
 * STATUS: v1.0 — Implementado
 */

const BATCH_JOBS_SHEET = 'BatchJobs';

// ============================================================================
// LEITURA
// ============================================================================

/**
 * Obtém todos os batch jobs
 *
 * @returns {array}
 */
function getAllBatchJobs_() {
  return getAllRowsAsObjects_(BATCH_JOBS_SHEET);
}

/**
 * Busca job por ID
 *
 * @param {string} id
 * @returns {object|null}
 */
function getBatchJobById_(id) {
  return getRecordById_(BATCH_JOBS_SHEET, id);
}

/**
 * Lista jobs do usuário
 *
 * @param {string} userId
 * @returns {array}
 */
function getUserBatchJobs_(userId) {
  return searchRecords_(BATCH_JOBS_SHEET, { createdBy: userId });
}

/**
 * Lista jobs por status
 *
 * @param {string} status
 * @returns {array}
 */
function getBatchJobsByStatus_(status) {
  return searchRecords_(BATCH_JOBS_SHEET, { status: status });
}

// ============================================================================
// ESCRITA
// ============================================================================

/**
 * Persiste um novo batch job
 *
 * @param {object} job — job já montado pelo Service
 * @param {string} userId
 * @returns {object} job criado
 */
function createBatchJobRecord_(job, userId) {
  return createRecord_(BATCH_JOBS_SHEET, job, userId);
}

/**
 * Atualiza campos de um batch job existente
 *
 * @param {string} id
 * @param {object} updates
 * @returns {object}
 */
function updateBatchJobRecord_(id, updates) {
  return updateRecord_(BATCH_JOBS_SHEET, id, updates);
}

// ============================================================================
// EXPORTAR
// ============================================================================

const BATCH_JOB_REPOSITORY_LOADED = true;
