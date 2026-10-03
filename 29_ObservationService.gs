/**
 * COMPONENTE: 29_ObservationService.gs
 * PAPEL: Serviço de domínio para Observation
 *
 * STATUS: v2.0 — Implementado
 */

/**
 * Cria nova Observation
 */
function createNewObservation_(userId, data) {
  try {
    const validation = validateObservationData_(data);
    if (!validation.valid) {
      throwError_('VALIDATION_ERROR', 'Dados inválidos', { fields: validation.errors });
    }

    // Verificar que Experiment existe
    const experiment = getExperimentById_(data.experimentId);
    if (!experiment) {
      throwError_('NOT_FOUND', 'Experiment não encontrado', {});
    }

    const observation = createObservation_(userId, data);

    logInfo_('Observation criada', {
      observationId: observation.id,
      experimentId: data.experimentId,
      variable: data.variable
    });

    auditCreate_('Observation', observation.id, userId, {
      variable: observation.variable,
      experimentId: data.experimentId
    });

    return observation;

  } catch (error) {
    logException_('Erro ao criar Observation', error);
    throw error;
  }
}

/**
 * Atualiza Observation
 */
function updateObservationWithRules_(id, updates, userId) {
  try {
    const observation = getObservationById_(id);
    if (!observation) {
      throwError_('NOT_FOUND', 'Observation não encontrada', {});
    }

    // Não permitir mudar experimentId
    if (updates.experimentId && updates.experimentId !== observation.experimentId) {
      throwError_('CONFLICT', 'Não é permitido mudar o Experiment de uma Observation', {});
    }

    const updated = updateObservation_(id, updates, userId);

    auditUpdate_('Observation', id, userId, { changes: updates });

    return updated;

  } catch (error) {
    logException_('Erro ao atualizar Observation', error);
    throw error;
  }
}

/**
 * Deleta Observation
 */
function deleteObservationWithValidation_(id, userId, reason) {
  try {
    const observation = getObservationById_(id);
    if (!observation) {
      throwError_('NOT_FOUND', 'Observation não encontrada', {});
    }

    // Se já foi validada, avisar
    if (observation.validated) {
      logWarn_('Deletando Observation validada', {
        observationId: id,
        validator: observation.validator
      });
    }

    const deleted = deleteObservation_(id);

    auditDelete_('Observation', id, { deletedBy: userId, reason: reason });

    return deleted;

  } catch (error) {
    logException_('Erro ao deletar Observation', error);
    throw error;
  }
}

/**
 * Marca Observation como validada
 */
function markObservationAsValidated_(id, userId) {
  try {
    const observation = getObservationById_(id);
    if (!observation) {
      throwError_('NOT_FOUND', 'Observation não encontrada', {});
    }

    const validated = validateObservation_(id, userId);

    auditUpdate_('Observation', id, userId, {
      action: 'marked_as_validated'
    });

    return validated;

  } catch (error) {
    logException_('Erro ao validar Observation', error);
    throw error;
  }
}

/**
 * Obtém Observations com dados agregados
 */
function getObservationsWithStats_(experimentId) {
  try {
    const observations = getObservationsByExperiment_(experimentId) || [];

    // Agrupar por variável
    const byVariable = {};
    observations.forEach(function(obs) {
      if (!byVariable[obs.variable]) {
        byVariable[obs.variable] = [];
      }
      byVariable[obs.variable].push(obs);
    });

    return {
      total: observations.length,
      byVariable: byVariable,
      validated: observations.filter(function(o) { return o.validated; }).length,
      notValidated: observations.filter(function(o) { return !o.validated; }).length
    };

  } catch (error) {
    logException_('Erro ao obter stats', error);
    return { total: 0, byVariable: {}, validated: 0, notValidated: 0 };
  }
}

/**
 * Retorna Observations recentes por Experiment
 */
function getRecentObservations_(experimentId, limit) {
  try {
    limit = limit || 10;
    const observations = getObservationsByExperiment_(experimentId) || [];

    return observations
      .sort(function(a, b) {
        return new Date(b.timestamp) - new Date(a.timestamp);
      })
      .slice(0, limit);

  } catch (error) {
    logException_('Erro ao obter recentes', error);
    return [];
  }
}

/**
 * Bulk create Observations (para importação)
 */
function createObservationsBulk_(userId, data) {
  try {
    const results = [];
    const errors = [];

    data.forEach(function(obs, index) {
      try {
        const created = createNewObservation_(userId, obs);
        results.push(created);
      } catch (error) {
        errors.push({
          index: index,
          error: error.message
        });
      }
    });

    logInfo_('Bulk create observations', {
      userId: userId,
      total: data.length,
      success: results.length,
      failed: errors.length
    });

    return {
      created: results,
      errors: errors,
      success: errors.length === 0
    };

  } catch (error) {
    logException_('Erro em bulk create', error);
    throw error;
  }
}

const OBSERVATION_SERVICE_LOADED = true;
