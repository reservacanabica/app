/**
 * COMPONENTE: 26_ExperimentRepository.gs
 * PAPEL: Repository para entidade Experiment
 *
 * STATUS: v2.0 — Implementado
 */

const EXPERIMENTS_SHEET = 'Experiments';

/**
 * Tipos de substratos disponíveis para cultivo
 * @constant
 */
const SUBSTRATE_TYPES = {
  SOLO_ORGANICO: 'Solo Orgânico',
  HIDROPONIA: 'Hidroponia',
  TRICHODERMA: 'Substrato com Trichoderma'
};

/**
 * Cria novo Experiment
 */
function createExperiment_(studyId, ownerId, data) {
  const experiment = {
    id: generateUUID_(),
    studyId: studyId,
    design: data.design || '',
    treatments: JSON.stringify(data.treatments || []),
    replicates: data.replicates || 3,
    conditions: JSON.stringify(data.conditions || {}),
    substrateType: data.substrateType || SUBSTRATE_TYPES.SOLO_ORGANICO,
    status: data.status || APP_STATUS.DRAFT,
    createdAt: nowIso_(),
    updatedAt: nowIso_()
    // Schema possui: id, studyId, design, treatments, replicates, conditions, substrateType, status, createdAt, updatedAt
  };

  return createRecord_(EXPERIMENTS_SHEET, experiment, ownerId);
}

/**
 * Busca Experiment por ID
 */
function getExperimentById_(id) {
  return getRecordById_(EXPERIMENTS_SHEET, id);
}

/**
 * Lista Experiments por Study
 */
function getExperimentsByStudy_(studyId) {
  return searchRecords_(EXPERIMENTS_SHEET, { studyId: studyId });
}

/**
 * Lista todos os Experiments
 */
function listExperiments_(filters, pagination) {
  filters = filters || {};
  return listRecords_(EXPERIMENTS_SHEET, filters, pagination);
}

/**
 * Atualiza Experiment
 */
function updateExperiment_(id, updates, userId) {
  updates.updatedAt = nowIso_();
  updates.lastModifiedBy = userId;
  return updateRecord_(EXPERIMENTS_SHEET, id, updates);
}

/**
 * Deleta Experiment
 */
function deleteExperiment_(id) {
  return deleteRecord_(EXPERIMENTS_SHEET, id);
}

/**
 * Retorna estatísticas de Experiments
 */
function getExperimentStats_() {
  return {
    total: countActiveRecords_(EXPERIMENTS_SHEET),
    byStatus: countRecordsByStatus_(EXPERIMENTS_SHEET),
    timestamp: nowIso_()
  };
}

/**
 * Lista Experiments por tipo de substrato
 *
 * @param {string} substrateType — SUBSTRATE_TYPES value
 * @returns {array}
 */
function getExperimentsBySubstrate_(substrateType) {
  return searchRecords_(EXPERIMENTS_SHEET, { substrateType: substrateType });
}

/**
 * Retorna tipos de substratos disponíveis
 *
 * @returns {array} Array de objetos {key, label}
 */
function getSubstrateTypes_() {
  return Object.keys(SUBSTRATE_TYPES).map(function(key) {
    return {
      key: key,
      label: SUBSTRATE_TYPES[key]
    };
  });
}

/**
 * Valida dados de Experiment
 */
function validateExperimentData_(data) {
  const errors = [];

  if (!data.title || data.title.length < 3) {
    errors.push({ field: 'title', message: 'Título obrigatório' });
  }

  if (!data.studyId) {
    errors.push({ field: 'studyId', message: 'Study ID obrigatório' });
  }

  if (!data.protocol) {
    errors.push({ field: 'protocol', message: 'Protocolo obrigatório' });
  }

  if (!data.replicates || data.replicates < 1) {
    errors.push({ field: 'replicates', message: 'Mínimo 1 réplica' });
  }

  if (data.substrateType && !Object.values(SUBSTRATE_TYPES).includes(data.substrateType)) {
    errors.push({ field: 'substrateType', message: 'Tipo de substrato inválido' });
  }

  return { valid: errors.length === 0, errors: errors };
}

const EXPERIMENT_REPOSITORY_LOADED = true;
