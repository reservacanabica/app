/**
 * COMPONENTE: 24_StudyRepository.gs
 * PAPEL: Repository pattern para entidade Study
 *
 * RESPONSABILIDADE:
 * - Abstração de acesso à aba "Studies"
 * - CRUD operations específico para Studies
 * - Queries avançadas (por status, owner, etc)
 *
 * INTEGRAÇÕES:
 * - Gateway (I/O de planilha)
 * - CrudService (operações genéricas)
 * - Constants (schema, status)
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const STUDIES_SHEET = 'Studies';

// ============================================================================
// CREATE
// ============================================================================

/**
 * Cria novo Study
 *
 * @param {object} data — {title, objective, hostSpecies, fungalStrain, cultivar, status}
 * @param {string} ownerId — ID do usuário que cria
 * @returns {object} Study criado
 */
function createStudy_(ownerId, data) {
  const study = {
    id: generateUUID_(),
    title: data.title,
    objective: data.objective || '',
    hostSpecies: data.hostSpecies,
    fungalStrain: data.fungalStrain || '',
    cultivar: data.cultivar || '',
    status: data.status || APP_STATUS.DRAFT,
    ownerId: ownerId,
    createdAt: nowIso_(),
    updatedAt: nowIso_()
    // Schema possui apenas: id, title, objective, hostSpecies, fungalStrain, cultivar, status, ownerId, createdAt, updatedAt
  };

  return createRecord_(STUDIES_SHEET, study, ownerId);
}

// ============================================================================
// READ
// ============================================================================

/**
 * Busca Study por ID
 *
 * @param {string} id
 * @returns {object|null}
 */
function getStudyById_(id) {
  return getRecordById_(STUDIES_SHEET, id);
}

/**
 * Lista todos os Studies (com filtros e paginação)
 *
 * @param {object} filters — {status, ownerId, hostSpecies}
 * @param {object} pagination — {page, pageSize, sortBy, sortOrder}
 * @returns {object} {items, pagination}
 */
function listStudies_(filters, pagination) {
  filters = filters || {};

  // Padrão: listar apenas DRAFT, ACTIVE, COMPLETED (não ARCHIVED)
  if (!filters.status) {
    filters.status = undefined; // listRecords_ já exclui ARCHIVED
  }

  return listRecords_(STUDIES_SHEET, filters, pagination);
}

/**
 * Lista Studies por status
 *
 * @param {string} status
 * @returns {array}
 */
function getStudiesByStatus_(status) {
  return searchRecords_(STUDIES_SHEET, { status: status });
}

/**
 * Lista Studies por owner
 *
 * @param {string} ownerId
 * @returns {array}
 */
function getStudiesByOwner_(ownerId) {
  return searchRecords_(STUDIES_SHEET, { ownerId: ownerId });
}

/**
 * Lista Studies por host species
 *
 * @param {string} hostSpecies
 * @returns {array}
 */
function getStudiesByHostSpecies_(hostSpecies) {
  return searchRecords_(STUDIES_SHEET, { hostSpecies: hostSpecies });
}

/**
 * Busca Studies por padrão no título
 *
 * @param {string} pattern
 * @returns {array}
 */
function searchStudiesByTitle_(pattern) {
  return searchRecordsByPattern_(STUDIES_SHEET, 'title', pattern);
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Atualiza Study
 *
 * @param {string} id
 * @param {object} updates
 * @param {string} userId — usuário que faz update (para auditoria)
 * @returns {object}
 */
function updateStudy_(id, updates, userId) {
  updates.updatedAt = nowIso_();
  updates.lastModifiedBy = userId;

  return updateRecord_(STUDIES_SHEET, id, updates);
}

/**
 * Atualiza status do Study
 *
 * @param {string} id
 * @param {string} newStatus
 * @param {string} userId
 * @returns {object}
 */
function updateStudyStatus_(id, newStatus, userId) {
  return updateStudy_(id, { status: newStatus }, userId);
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Deleta Study (soft delete)
 *
 * @param {string} id
 * @returns {object}
 */
function deleteStudy_(id) {
  return deleteRecord_(STUDIES_SHEET, id);
}

// ============================================================================
// AGGREGAÇÕES
// ============================================================================

/**
 * Conta Studies por status
 *
 * @returns {object}
 */
function getStudyCountByStatus_() {
  return countRecordsByStatus_(STUDIES_SHEET);
}

/**
 * Retorna total de Studies ativos
 *
 * @returns {number}
 */
function getTotalStudies_() {
  return countActiveRecords_(STUDIES_SHEET);
}

/**
 * Retorna estatísticas de Studies
 *
 * @returns {object}
 */
function getStudyStats_() {
  const byStatus = getStudyCountByStatus_();
  const total = getTotalStudies_();

  return {
    total: total,
    byStatus: byStatus,
    timestamp: nowIso_()
  };
}

// ============================================================================
// VALIDAÇÃO
// ============================================================================

/**
 * Verifica se Study existe
 *
 * @param {string} id
 * @returns {boolean}
 */
function studyExists_(id) {
  return getStudyById_(id) !== null;
}

/**
 * Valida dados de Study para criação/atualização
 *
 * @param {object} data
 * @returns {object} {valid, errors}
 */
function validateStudyData_(data) {
  const errors = [];

  if (!data.title || data.title.trim().length < 3) {
    errors.push({ field: 'title', message: 'Título obrigatório (mín. 3 caracteres)' });
  }

  if (data.title && data.title.length > 200) {
    errors.push({ field: 'title', message: 'Título máximo 200 caracteres' });
  }

  if (!data.hostSpecies || data.hostSpecies.trim().length === 0) {
    errors.push({ field: 'hostSpecies', message: 'Espécie hospedeira obrigatória' });
  }

  if (data.status && !['DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED'].includes(data.status)) {
    errors.push({ field: 'status', message: 'Status inválido' });
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// ============================================================================
// EXPORTAR
// ============================================================================

const STUDY_REPOSITORY_LOADED = true;
