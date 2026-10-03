/**
 * COMPONENTE: 25_StudyService.gs
 * PAPEL: Serviço de domínio para Study
 *
 * RESPONSABILIDADE:
 * - Lógica de negócio para Studies
 * - Validação de regras de domínio
 * - Orquestração de operações
 * - Integração com outros serviços (Experiments, Observations)
 *
 * INTEGRAÇÕES:
 * - StudyRepository, ExperimentRepository
 * - ValidationService, PermissionService, AuditService
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// OPERAÇÕES PRINCIPAIS
// ============================================================================

/**
 * Cria novo Study (com validação)
 *
 * @param {string} userId — proprietário
 * @param {object} data — {title, description, status, hostSpecies, fungalStrain, cultivar, objective}
 * @returns {object} Study criado
 * @throws {Error}
 */
function createNewStudy_(userId, data) {
  try {
    // 1. Validar dados
    const validation = validateStudyData_(data);
    if (!validation.valid) {
      throwError_('VALIDATION_ERROR', 'Dados do Study inválidos', {
        fields: validation.errors
      });
    }

    // 2. Verificar permissão do usuário
    const user = getUserById_(userId);
    if (!user) {
      throwError_('AUTH_USER_NOT_FOUND', 'Usuário não encontrado', {});
    }

    // 3. Criar estudo
    const study = createStudy_(userId, data);

    logInfo_('Study criado', {
      studyId: study.id,
      userId: userId,
      title: study.title
    });

    // 4. Auditar
    auditCreate_('Study', study.id, userId, {
      title: study.title,
      hostSpecies: study.hostSpecies,
      status: study.status
    });

    return study;

  } catch (error) {
    logException_('Erro ao criar Study', error);
    throw error;
  }
}

/**
 * Recupera estudo com contexto completo (experimentos, etc)
 *
 * @param {string} id
 * @returns {object}
 */
function getStudyWithContext_(id) {
  try {
    const study = getStudyById_(id);
    if (!study) {
      return null;
    }

    // Adicionar contexto
    study.experiments = getExperimentsByStudy_(id);
    study.experimentCount = study.experiments.length;

    // Calcular métricas
    const observations = [];
    study.experiments.forEach(function(exp) {
      const obs = getObservationsByExperiment_(exp.id) || [];
      observations.push.apply(observations, obs);
    });

    study.observationCount = observations.length;
    study.lastUpdated = study.updatedAt;

    return study;

  } catch (error) {
    logException_('Erro ao obter contexto do Study', error);
    return null;
  }
}

/**
 * Atualiza Study com validação completa de regras de negócio e transições de status
 * 
 * Verifica: (1) estudo existe, (2) transição de status é válida, (3) dados atualizados
 * são válidos, (4) usuário tem permissão. Registra auditoria com valores old/new.
 *
 * @param {string} id - ID do Study a atualizar
 * @param {object} updates - Campos a atualizar (parcial): {title?, status?, objective?, ...}
 * @param {string} userId - ID do usuário realizando a atualização (para auditoria)
 * @returns {object} Study atualizado completo
 * @throws {Error} NOT_FOUND se Study inexistente, VALIDATION_ERROR se dados/transição inválidos
 * @example
 * const updated = updateStudyWithRules_('std_123', {status: 'PUBLISHED'}, 'usr_456');
 */
function updateStudyWithRules_(id, updates, userId) {
  try {
    // Validar parâmetros
    if (!id || typeof id !== 'string') {
      throwError_('VALIDATION_ERROR', 'ID do Study inválido', {});
    }
    
    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      throwError_('VALIDATION_ERROR', 'Updates deve ser um objeto', {});
    }
    
    if (Object.keys(updates).length === 0) {
      throwError_('VALIDATION_ERROR', 'Nenhuma atualização fornecida', {});
    }
    
    // 1. Buscar estudo existente
    const study = getStudyById_(id);
    if (!study) {
      throwError_('NOT_FOUND', 'Study não encontrado', { id: id });
    }

    // 2. Validar transição de status (se houver)
    if (updates.status && updates.status !== study.status) {
      validateStatusTransition_(study.status, updates.status);
    }

    // 3. Validar dados
    if (updates.title || updates.hostSpecies) {
      const validation = validateStudyData_(merge_(study, updates));
      if (!validation.valid) {
        throwError_('VALIDATION_ERROR', 'Dados inválidos', {
          fields: validation.errors
        });
      }
    }

    // 4. Verificar permissão de update
    requireOwnerOrAdmin_(getUserById_(userId), study);

    // 5. Atualizar
    const updated = updateStudy_(id, updates, userId);

    logInfo_('Study atualizado', {
      studyId: id,
      userId: userId,
      updatedFields: Object.keys(updates)
    });

    // 6. Auditar
    auditUpdate_('Study', id, userId, {
      changes: updates
    });

    return updated;

  } catch (error) {
    logException_('Erro ao atualizar Study', error);
    throw error;
  }
}

/**
 * Muda status do Study
 *
 * @param {string} id
 * @param {string} newStatus
 * @param {string} userId
 * @param {string} reason (opcional)
 * @returns {object}
 * @throws {Error}
 */
function changeStudyStatus_(id, newStatus, userId, reason) {
  try {
    const study = getStudyById_(id);
    if (!study) {
      throwError_('NOT_FOUND', 'Study não encontrado', {});
    }

    // Validar transição
    validateStatusTransition_(study.status, newStatus);

    // Verificar permissão
    requireOwnerOrAdmin_(getUserById_(userId), study);

    // Atualizar
    const updated = updateStudyStatus_(id, newStatus, userId);

    logInfo_('Status do Study alterado', {
      studyId: id,
      oldStatus: study.status,
      newStatus: newStatus,
      reason: reason
    });

    // Auditar
    auditStatusChange_('Study', id, userId, {
      oldStatus: study.status,
      newStatus: newStatus,
      reason: reason
    });

    return updated;

  } catch (error) {
    logException_('Erro ao mudar status', error);
    throw error;
  }
}

/**
 * Deleta Study (com validações)
 *
 * @param {string} id
 * @param {string} userId
 * @param {string} reason (opcional)
 * @returns {object}
 * @throws {Error}
 */
function deleteStudyWithValidation_(id, userId, reason) {
  try {
    // 1. Buscar estudo
    const study = getStudyById_(id);
    if (!study) {
      throwError_('NOT_FOUND', 'Study não encontrado', {});
    }

    // 2. Verificar se há experimentos vinculados
    const experiments = getExperimentsByStudy_(id);
    if (experiments && experiments.length > 0) {
      throwError_('CONFLICT', 'Study possui experimentos vinculados. Delete os experimentos primeiro.', {
        experimentCount: experiments.length
      });
    }

    // 3. Verificar permissão
    requireOwnerOrAdmin_(getUserById_(userId), study);

    // 4. Deletar (soft delete)
    const deleted = deleteStudy_(id);

    logInfo_('Study deletado', {
      studyId: id,
      userId: userId,
      reason: reason
    });

    // 5. Auditar
    auditDelete_('Study', id, {
      deletedBy: userId,
      reason: reason
    });

    return deleted;

  } catch (error) {
    logException_('Erro ao deletar Study', error);
    throw error;
  }
}

// ============================================================================
// VALIDAÇÃO DE REGRAS DE NEGÓCIO
// ============================================================================

/**
 * Valida transição de status
 *
 * @param {string} currentStatus
 * @param {string} newStatus
 * @throws {Error}
 */
function validateStatusTransition_(currentStatus, newStatus) {
  // Máquina de estados simples
  const validTransitions = {
    'DRAFT': ['DRAFT', 'ACTIVE', 'ARCHIVED'],
    'ACTIVE': ['ACTIVE', 'COMPLETED', 'ARCHIVED'],
    'COMPLETED': ['COMPLETED', 'ARCHIVED'],
    'ARCHIVED': ['ARCHIVED'] // Não pode voltar de ARCHIVED
  };

  const allowed = validTransitions[currentStatus] || [];

  if (!allowed.includes(newStatus)) {
    throwError_('CONFLICT', 'Transição de status inválida: ' + currentStatus + ' → ' + newStatus, {
      current: currentStatus,
      requested: newStatus,
      allowed: allowed
    });
  }
}

// ============================================================================
// CONSULTAS E RELATÓRIOS
// ============================================================================

/**
 * Retorna listagem de Studies com estatísticas agregadas
 *
 * @param {object} filters
 * @param {object} pagination
 * @returns {object}
 */
function getStudiesWithStats_(filters, pagination) {
  try {
    const result = listStudies_(filters, pagination);

    result.stats = {
      total: result.pagination.total,
      byStatus: getStudyCountByStatus_(),
      timestamp: nowIso_()
    };

    return result;

  } catch (error) {
    logException_('Erro ao listar com stats', error);
    return { items: [], pagination: {}, stats: {} };
  }
}

/**
 * Retorna Studies recentes (últimos N dias)
 *
 * @param {number} days (default: 7)
 * @returns {array}
 */
function getRecentStudies_(days) {
  try {
    days = days || 7;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    const cutoffIso = cutoffDate.toISOString();

    const all = getStudiesByStatus_(APP_STATUS.ACTIVE);

    return all.filter(function(study) {
      return study.createdAt >= cutoffIso;
    });

  } catch (error) {
    logException_('Erro ao obter recentes', error);
    return [];
  }
}

/**
 * Retorna Studies por usuário com contagem de experimentos
 *
 * @param {string} userId
 * @returns {array}
 */
function getUserStudies_(userId) {
  try {
    const studies = getStudiesByOwner_(userId);

    return studies.map(function(study) {
      const experiments = getExperimentsByStudy_(study.id) || [];
      study.experimentCount = experiments.length;
      return study;
    });

  } catch (error) {
    logException_('Erro ao obter estudos do usuário', error);
    return [];
  }
}

/**
 * Busca Studies por múltiplos critérios avançados
 *
 * @param {object} criteria
 * @returns {array}
 */
function advancedStudySearch_(criteria) {
  try {
    let studies = [];

    // Buscar todos os studies e filtrar
    const all = getStudiesByStatus_(APP_STATUS.ACTIVE);

    studies = all.filter(function(study) {
      if (criteria.title && !study.title.toLowerCase().includes(criteria.title.toLowerCase())) {
        return false;
      }
      if (criteria.hostSpecies && study.hostSpecies !== criteria.hostSpecies) {
        return false;
      }
      if (criteria.ownerId && study.ownerId !== criteria.ownerId) {
        return false;
      }
      if (criteria.fungalStrain && !study.fungalStrain.includes(criteria.fungalStrain)) {
        return false;
      }
      return true;
    });

    return studies;

  } catch (error) {
    logException_('Erro em busca avançada', error);
    return [];
  }
}

// ============================================================================
// EXPORTAR
// ============================================================================

const STUDY_SERVICE_LOADED = true;
