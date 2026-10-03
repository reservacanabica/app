/**
 * COMPONENTE: 27_ExperimentService.gs
 * PAPEL: Serviço de domínio para Experiment
 *
 * STATUS: v2.0 — Implementado
 */

/**
 * Cria novo Experiment
 */
function createNewExperiment_(userId, data) {
  try {
    const validation = validateExperimentData_(data);
    if (!validation.valid) {
      throwError_('VALIDATION_ERROR', 'Dados inválidos', { fields: validation.errors });
    }

    // Verificar que Study existe
    const study = getStudyById_(data.studyId);
    if (!study) {
      throwError_('NOT_FOUND', 'Study não encontrado', {});
    }

    const experiment = createExperiment_(data.studyId, userId, data);

    logInfo_('Experiment criado', {
      experimentId: experiment.id,
      studyId: data.studyId,
      userId: userId
    });

    auditCreate_('Experiment', experiment.id, userId, {
      title: experiment.title,
      studyId: data.studyId
    });

    return experiment;

  } catch (error) {
    logException_('Erro ao criar Experiment', error);
    throw error;
  }
}

/**
 * Atualiza Experiment
 */
function updateExperimentWithRules_(id, updates, userId) {
  try {
    const experiment = getExperimentById_(id);
    if (!experiment) {
      throwError_('NOT_FOUND', 'Experiment não encontrado', {});
    }

    const updated = updateExperiment_(id, updates, userId);

    logInfo_('Experiment atualizado', {
      experimentId: id,
      userId: userId
    });

    auditUpdate_('Experiment', id, userId, { changes: updates });

    return updated;

  } catch (error) {
    logException_('Erro ao atualizar Experiment', error);
    throw error;
  }
}

/**
 * Deleta Experiment
 */
function deleteExperimentWithValidation_(id, userId, reason) {
  try {
    const experiment = getExperimentById_(id);
    if (!experiment) {
      throwError_('NOT_FOUND', 'Experiment não encontrado', {});
    }

    // Verificar se há observações vinculadas
    const observations = getObservationsByExperiment_(id);
    if (observations && observations.length > 0) {
      throwError_('CONFLICT', 'Experiment possui observações. Delete-as primeiro.', {
        observationCount: observations.length
      });
    }

    const deleted = deleteExperiment_(id);

    auditDelete_('Experiment', id, { deletedBy: userId, reason: reason });

    return deleted;

  } catch (error) {
    logException_('Erro ao deletar Experiment', error);
    throw error;
  }
}

/**
 * Obtém Experiment com contexto (observações)
 */
function getExperimentWithContext_(id) {
  try {
    const experiment = getExperimentById_(id);
    if (!experiment) return null;

    experiment.observations = getObservationsByExperiment_(id) || [];
    experiment.observationCount = experiment.observations.length;

    return experiment;

  } catch (error) {
    logException_('Erro ao obter contexto', error);
    return null;
  }
}

/**
 * Retorna Experiments com stats
 */
function getExperimentsWithStats_(filters, pagination) {
  const result = listExperiments_(filters, pagination);
  result.stats = getExperimentStats_();
  return result;
}

const EXPERIMENT_SERVICE_LOADED = true;
