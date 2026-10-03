/**
 * COMPONENTE: 67_InsumoRepository.gs
 * PAPEL: Repository pattern para entidade Insumo (Catálogo)
 *
 * RESPONSABILIDADE:
 * - Abstração de acesso à aba "Insumos_Catalogo"
 * - CRUD operations específico para Insumos
 * - Queries avançadas (por fabricante, tipo, status)
 *
 * INTEGRAÇÕES:
 * - Gateway (I/O de planilha)
 * - CrudService (operações genéricas)
 * - Constants (schema, enums)
 *
 * STATUS: v2.1 — Implementado (PROMPT 1)
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const INSUMOS_SHEET = 'Insumos_Catalogo';

// ============================================================================
// CREATE
// ============================================================================

/**
 * Cria novo Insumo
 *
 * @param {string} userId — ID do usuário que cria (para auditoria)
 * @param {object} data — dados do insumo
 * @returns {object} Insumo criado
 */
function createInsumo_(userId, data) {
  const insumo = {
    id: generateUUID_(),
    nomeComercial: data.nomeComercial,
    tipoSal: data.tipoSal,
    fabricante: data.fabricante,
    paisOrigem: data.paisOrigem || '',
    registroMAPAEstabelecimento: data.registroMAPAEstabelecimento || '',
    registroMAPAProduto: data.registroMAPAProduto || '',
    agenteQuelante: data.agenteQuelante || '',
    solubilidade_gL_20C: data.solubilidade_gL_20C || 0,
    purezaPercentual: data.purezaPercentual || 0,
    driveFichaTecnicaURL: data.driveFichaTecnicaURL || '',
    ativo: data.ativo || INPUT_STATUS.ATIVO,
    createdAt: nowIso_(),
    updatedAt: nowIso_()
  };

  return createRecord_(INSUMOS_SHEET, insumo, userId);
}

// ============================================================================
// READ
// ============================================================================

/**
 * Busca Insumo por ID
 *
 * @param {string} id
 * @returns {object|null}
 */
function getInsumoById_(id) {
  return getRecordById_(INSUMOS_SHEET, id);
}

/**
 * Lista todos os Insumos (com filtros e paginação)
 *
 * @param {object} filters — {ativo, fabricante, tipoSal}
 * @param {object} pagination — {page, pageSize, sortBy, sortOrder}
 * @returns {object} {items, pagination}
 */
function listInsumos_(filters, pagination) {
  filters = filters || {};

  // Padrão: listar apenas ATIVO
  if (!filters.ativo) {
    filters.ativo = INPUT_STATUS.ATIVO;
  }

  return listRecords_(INSUMOS_SHEET, filters, pagination);
}

/**
 * Lista Insumos por fabricante
 *
 * @param {string} fabricante
 * @returns {array}
 */
function getInsumosByFabricante_(fabricante) {
  return searchRecords_(INSUMOS_SHEET, { fabricante: fabricante });
}

/**
 * Lista Insumos por tipo de sal
 *
 * @param {string} tipoSal
 * @returns {array}
 */
function getInsumosByTipoSal_(tipoSal) {
  return searchRecords_(INSUMOS_SHEET, { tipoSal: tipoSal });
}

/**
 * Busca Insumos por padrão no nome comercial
 *
 * @param {string} pattern
 * @returns {array}
 */
function searchInsumosByNome_(pattern) {
  return searchRecordsByPattern_(INSUMOS_SHEET, 'nomeComercial', pattern);
}

/**
 * Lista Insumos por agente quelante
 *
 * @param {string} agente
 * @returns {array}
 */
function getInsumosByAgenteQuelante_(agente) {
  return searchRecords_(INSUMOS_SHEET, { agenteQuelante: agente });
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Atualiza Insumo
 *
 * @param {string} id
 * @param {object} updates
 * @param {string} userId — usuário que faz update (para auditoria)
 * @returns {object}
 */
function updateInsumo_(id, updates, userId) {
  updates.updatedAt = nowIso_();

  return updateRecord_(INSUMOS_SHEET, id, updates);
}

/**
 * Atualiza status do Insumo (ATIVO/INATIVO)
 *
 * @param {string} id
 * @param {string} newStatus
 * @param {string} userId
 * @returns {object}
 */
function updateInsumoStatus_(id, newStatus, userId) {
  return updateInsumo_(id, { ativo: newStatus }, userId);
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Deleta Insumo (soft delete — marca como INATIVO)
 *
 * @param {string} id
 * @returns {object}
 */
function deleteInsumo_(id) {
  return updateRecord_(INSUMOS_SHEET, id, {
    ativo: INPUT_STATUS.INATIVO,
    updatedAt: nowIso_()
  });
}

// ============================================================================
// AGGREGAÇÕES
// ============================================================================

/**
 * Conta Insumos por status
 *
 * @returns {object}
 */
function getInsumoCountByStatus_() {
  return countRecordsByStatus_(INSUMOS_SHEET, 'ativo');
}

/**
 * Retorna total de Insumos ativos
 *
 * @returns {number}
 */
function getTotalInsumos_() {
  return countActiveRecords_(INSUMOS_SHEET);
}

/**
 * Retorna estatísticas de Insumos
 *
 * @returns {object}
 */
function getInsumoStats_() {
  const byStatus = getInsumoCountByStatus_();
  const total = getTotalInsumos_();

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
 * Verifica se Insumo existe
 *
 * @param {string} id
 * @returns {boolean}
 */
function insumoExists_(id) {
  return getInsumoById_(id) !== null;
}

/**
 * Valida dados de Insumo para criação/atualização
 *
 * @param {object} data
 * @returns {object} {valid, errors}
 */
function validateInsumoData_(data) {
  const errors = [];

  if (!data.nomeComercial || data.nomeComercial.trim().length < 1) {
    errors.push({ field: 'nomeComercial', message: 'Nome comercial obrigatório' });
  }

  if (!data.tipoSal || data.tipoSal.trim().length < 1) {
    errors.push({ field: 'tipoSal', message: 'Tipo de sal obrigatório' });
  }

  if (!data.fabricante || data.fabricante.trim().length < 1) {
    errors.push({ field: 'fabricante', message: 'Fabricante obrigatório' });
  }

  if (data.purezaPercentual && (data.purezaPercentual < 0 || data.purezaPercentual > 100)) {
    errors.push({ field: 'purezaPercentual', message: 'Pureza deve estar entre 0 e 100%' });
  }

  if (data.agenteQuelante && !Object.values(AGENTE_QUELANTE).includes(data.agenteQuelante)) {
    errors.push({ field: 'agenteQuelante', message: 'Agente quelante inválido' });
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// ============================================================================
// EXPORTAR
// ============================================================================

const INSUMO_REPOSITORY_LOADED = true;
