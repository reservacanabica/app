/**
 * COMPONENTE: 31_ReferenceService.gs
 * PAPEL: Serviço para Reference
 *
 * STATUS: v2.0 — Implementado
 */

function createNewReference_(userId, data) {
  try {
    if (!data.title || data.title.length < 5) {
      throwError_('VALIDATION_ERROR', 'Título obrigatório', {});
    }

    const reference = createReference_(userId, data);

    auditCreate_('Reference', reference.id, userId, {
      title: reference.title,
      doi: reference.doi
    });

    return reference;
  } catch (error) {
    logException_('Erro ao criar Reference', error);
    throw error;
  }
}

function updateReferenceWithRules_(id, updates, userId) {
  try {
    const reference = getReferenceById_(id);
    if (!reference) {
      throwError_('NOT_FOUND', 'Reference não encontrada', {});
    }

    const updated = updateReference_(id, updates, userId);

    auditUpdate_('Reference', id, userId, { changes: updates });

    return updated;
  } catch (error) {
    logException_('Erro ao atualizar Reference', error);
    throw error;
  }
}

function deleteReferenceWithValidation_(id, userId, reason) {
  try {
    const reference = getReferenceById_(id);
    if (!reference) {
      throwError_('NOT_FOUND', 'Reference não encontrada', {});
    }

    const deleted = deleteReference_(id);

    auditDelete_('Reference', id, { deletedBy: userId, reason: reason });

    return deleted;
  } catch (error) {
    logException_('Erro ao deletar Reference', error);
    throw error;
  }
}

const REFERENCE_SERVICE_LOADED = true;
