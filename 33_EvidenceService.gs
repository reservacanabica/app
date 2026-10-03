/**
 * COMPONENTE: 33_EvidenceService.gs
 * PAPEL: Serviço para Evidence
 *
 * STATUS: v2.0 — Implementado
 */

function createNewEvidence_(userId, data) {
  try {
    if (!data.observationId) {
      throwError_('VALIDATION_ERROR', 'Observation ID obrigatório', {});
    }

    // Verificar que Observation existe
    const observation = getObservationById_(data.observationId);
    if (!observation) {
      throwError_('NOT_FOUND', 'Observation não encontrada', {});
    }

    // Verificar que Reference existe (se fornecida)
    if (data.referenceId) {
      const reference = getReferenceById_(data.referenceId);
      if (!reference) {
        throwError_('NOT_FOUND', 'Reference não encontrada', {});
      }
    }

    const evidence = createEvidence_(userId, data);

    auditCreate_('Evidence', evidence.id, userId, {
      observationId: data.observationId,
      referenceId: data.referenceId
    });

    return evidence;
  } catch (error) {
    logException_('Erro ao criar Evidence', error);
    throw error;
  }
}

function updateEvidenceWithRules_(id, updates, userId) {
  try {
    const evidence = getEvidenceById_(id);
    if (!evidence) {
      throwError_('NOT_FOUND', 'Evidence não encontrada', {});
    }

    // Não permitir mudar observationId
    if (updates.observationId && updates.observationId !== evidence.observationId) {
      throwError_('CONFLICT', 'Não é permitido mudar a Observation', {});
    }

    const updated = updateEvidence_(id, updates, userId);

    auditUpdate_('Evidence', id, userId, { changes: updates });

    return updated;
  } catch (error) {
    logException_('Erro ao atualizar Evidence', error);
    throw error;
  }
}

function deleteEvidenceWithValidation_(id, userId, reason) {
  try {
    const evidence = getEvidenceById_(id);
    if (!evidence) {
      throwError_('NOT_FOUND', 'Evidence não encontrada', {});
    }

    const deleted = deleteEvidence_(id);

    auditDelete_('Evidence', id, { deletedBy: userId, reason: reason });

    return deleted;
  } catch (error) {
    logException_('Erro ao deletar Evidence', error);
    throw error;
  }
}

function getEvidenceWithContext_(id) {
  try {
    const evidence = getEvidenceById_(id);
    if (!evidence) return null;

    if (evidence.observationId) {
      evidence.observation = getObservationById_(evidence.observationId);
    }

    if (evidence.referenceId) {
      evidence.reference = getReferenceById_(evidence.referenceId);
    }

    return evidence;
  } catch (error) {
    logException_('Erro ao obter contexto', error);
    return null;
  }
}

const EVIDENCE_SERVICE_LOADED = true;
