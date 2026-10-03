/**
 * COMPONENTE: 28_ObservationRepository.gs
 * PAPEL: Repository para entidade Observation
 *
 * STATUS: v2.0 — Implementado
 */

const OBSERVATIONS_SHEET = 'Observations';

/**
 * Cria nova Observation
 */
function createObservation_(userId, data) {
  const observation = {
    id: generateUUID_(),
    experimentId: data.experimentId,
    variable: data.variable,
    value: data.value,
    unit: data.unit,
    groupName: data.groupName || '',
    replicate: data.replicate || 1,
    observedAt: data.observedAt || nowIso_(),
    notes: data.notes || '',
    createdBy: userId
    // Campos não persistidos no schema: timestamp, status, validated, validator, validatedAt, ownerId, createdAt, updatedAt, lastModifiedBy
  };

  return createRecord_(OBSERVATIONS_SHEET, observation, userId);
}

/**
 * Busca Observation por ID
 */
function getObservationById_(id) {
  return getRecordById_(OBSERVATIONS_SHEET, id);
}

/**
 * Lista Observations por Experiment
 */
function getObservationsByExperiment_(experimentId) {
  return searchRecords_(OBSERVATIONS_SHEET, { experimentId: experimentId });
}

/**
 * Lista todas as Observations
 */
function listObservations_(filters, pagination) {
  filters = filters || {};
  return listRecords_(OBSERVATIONS_SHEET, filters, pagination);
}

/**
 * Atualiza Observation
 */
function updateObservation_(id, updates, userId) {
  updates.updatedAt = nowIso_();
  updates.lastModifiedBy = userId;
  return updateRecord_(OBSERVATIONS_SHEET, id, updates);
}

/**
 * Deleta Observation
 */
function deleteObservation_(id) {
  return deleteRecord_(OBSERVATIONS_SHEET, id);
}

/**
 * Valida Observation (marca como validada)
 */
function validateObservation_(id, validatorId) {
  return updateObservation_(id, {
    validated: true,
    validator: validatorId,
    validatedAt: nowIso_(),
    status: APP_STATUS.ACTIVE
  }, validatorId);
}

/**
 * Retorna Observations por variable
 */
function getObservationsByVariable_(experimentId, variable) {
  const all = getObservationsByExperiment_(experimentId) || [];
  return all.filter(function(obs) {
    return obs.variable === variable;
  });
}

/**
 * Retorna estatísticas de Observations
 */
function getObservationStats_() {
  return {
    total: countActiveRecords_(OBSERVATIONS_SHEET),
    byStatus: countRecordsByStatus_(OBSERVATIONS_SHEET),
    timestamp: nowIso_()
  };
}

/**
 * Valida dados de Observation
 */
function validateObservationData_(data) {
  const errors = [];

  if (!data.experimentId) {
    errors.push({ field: 'experimentId', message: 'Experiment ID obrigatório' });
  }

  if (!data.variable) {
    errors.push({ field: 'variable', message: 'Variável obrigatória' });
  }

  if (typeof data.value !== 'number') {
    errors.push({ field: 'value', message: 'Valor deve ser numérico' });
  }

  if (!data.unit) {
    errors.push({ field: 'unit', message: 'Unidade obrigatória' });
  }

  return { valid: errors.length === 0, errors: errors };
}

const OBSERVATION_REPOSITORY_LOADED = true;
