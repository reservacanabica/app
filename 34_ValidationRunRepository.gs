/**
 * COMPONENTE: 34_ValidationRunRepository.gs
 * PAPEL: Repository para ValidationRun (execução de validações científicas)
 *
 * RESPONSABILIDADE:
 * - CRUD de ValidationRun
 * - Rastreamento de validações por entidade
 * - Histórico de validações
 *
 * STATUS: v2.0 — Implementado
 */

const VALIDATION_RUNS_SHEET = 'ValidationRuns';

/**
 * Cria novo ValidationRun
 *
 * @param {string} userId
 * @param {object} data — {entityType, entityId, validationType, ruleId, passed, details}
 * @returns {object}
 */
function createValidationRun_(userId, data) {
  const validationRun = {
    id: generateUUID_(),
    entityType: data.entityType,          // "Study", "Experiment", "Observation"
    entityId: data.entityId,
    validationType: data.validationType,   // "SCHEMA", "BUSINESS", "SCIENTIFIC"
    ruleId: data.ruleId,                   // ex: "V01", "V02"
    passed: data.passed || false,
    details: JSON.stringify(data.details || {}),
    errors: JSON.stringify(data.errors || []),
    warnings: JSON.stringify(data.warnings || []),
    executedBy: userId,
    executedAt: nowIso_(),
    duration: data.duration || 0,          // tempo em ms
    status: APP_STATUS.ACTIVE,
    createdAt: nowIso_(),
    updatedAt: nowIso_()
  };

  return createRecord_(VALIDATION_RUNS_SHEET, validationRun, userId);
}

/**
 * Busca ValidationRun por ID
 */
function getValidationRunById_(id) {
  return getRecordById_(VALIDATION_RUNS_SHEET, id);
}

/**
 * Lista ValidationRuns por entidade
 *
 * @param {string} entityType
 * @param {string} entityId
 * @returns {array}
 */
function getValidationRunsByEntity_(entityType, entityId) {
  const all = searchRecords_(VALIDATION_RUNS_SHEET, { entityType: entityType });
  return all.filter(function(vr) {
    return vr.entityId === entityId;
  });
}

/**
 * Lista ValidationRuns por tipo
 *
 * @param {string} validationType — "SCHEMA", "BUSINESS", "SCIENTIFIC"
 * @returns {array}
 */
function getValidationRunsByType_(validationType) {
  return searchRecords_(VALIDATION_RUNS_SHEET, { validationType: validationType });
}

/**
 * Lista ValidationRuns por rule
 *
 * @param {string} ruleId — ex: "V01"
 * @returns {array}
 */
function getValidationRunsByRule_(ruleId) {
  return searchRecords_(VALIDATION_RUNS_SHEET, { ruleId: ruleId });
}

/**
 * Retorna ValidationRuns recentes para um Study
 *
 * @param {string} studyId
 * @param {number} limit
 * @returns {array}
 */
function getRecentValidationsForStudy_(studyId, limit) {
  limit = limit || 10;

  // Buscar estudos (entityType=Study) E experimentos (entityType=Experiment, vinculados ao study)
  let validations = getValidationRunsByEntity_('Study', studyId);

  // Adicionar validações dos experimentos do study
  const experiments = getExperimentsByStudy_(studyId) || [];
  experiments.forEach(function(exp) {
    const expValidations = getValidationRunsByEntity_('Experiment', exp.id) || [];
    validations.push.apply(validations, expValidations);
  });

  // Ordenar por data descrescente e limitar
  return validations
    .sort(function(a, b) {
      return new Date(b.executedAt) - new Date(a.executedAt);
    })
    .slice(0, limit);
}

/**
 * Lista todas as ValidationRuns com paginação
 */
function listValidationRuns_(filters, pagination) {
  filters = filters || {};
  return listRecords_(VALIDATION_RUNS_SHEET, filters, pagination);
}

/**
 * Retorna estatísticas de validações
 *
 * @returns {object}
 */
function getValidationStats_() {
  const all = getAllRecords_(getSheet_(VALIDATION_RUNS_SHEET)) || [];

  const passed = all.filter(function(vr) { return vr.passed; }).length;
  const failed = all.filter(function(vr) { return !vr.passed; }).length;

  return {
    total: all.length,
    passed: passed,
    failed: failed,
    passRate: all.length > 0 ? ((passed / all.length) * 100).toFixed(2) + '%' : 'N/A',
    timestamp: nowIso_()
  };
}

/**
 * Retorna validações com falhas
 *
 * @returns {array}
 */
function getFailedValidations_() {
  const all = getAllRecords_(getSheet_(VALIDATION_RUNS_SHEET)) || [];
  return all.filter(function(vr) {
    return !vr.passed && vr.status !== APP_STATUS.ARCHIVED;
  });
}

const VALIDATION_REPOSITORY_LOADED = true;
