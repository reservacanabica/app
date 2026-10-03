/**
 * COMPONENTE: 68_LoteCoARepository.gs
 * PAPEL: Repository pattern para entidade Lote CoA
 *
 * RESPONSABILIDADE:
 * - Abstração de acesso à aba "Lotes_CoA"
 * - CRUD operations específico para Lotes CoA
 * - Queries avançadas (por insumo, status auditoria, status liberação)
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

const LOTES_COA_SHEET = 'Lotes_CoA';

// ============================================================================
// CREATE
// ============================================================================

/**
 * Cria novo Lote CoA
 *
 * @param {string} userId — ID do usuário que cria (para auditoria)
 * @param {object} data — dados do lote
 * @returns {object} Lote criado
 */
function createLoteCoA_(userId, data) {
  const lote = {
    id: generateUUID_(),
    insumoId: data.insumoId,
    numeroLote: data.numeroLote,
    dataFabricacao: data.dataFabricacao || '',
    dataValidade: data.dataValidade || '',
    laboratorioEmissor: data.laboratorioEmissor || '',
    teor_Pb_ppm: data.teor_Pb_ppm || '',
    teor_Cd_ppm: data.teor_Cd_ppm || '',
    teor_As_ppm: data.teor_As_ppm || '',
    teor_Hg_ppm: data.teor_Hg_ppm || '',
    statusAuditoria: data.statusAuditoria || COA_STATUS_AUDITORIA.PENDENTE,
    statusLiberacao: data.statusLiberacao || COA_STATUS_LIBERACAO.PENDENTE,
    drivePdfCoAURL: data.drivePdfCoAURL || '',
    dataAuditoria: data.dataAuditoria || '',
    auditorEmail: data.auditorEmail || '',
    sourceVersion: data.sourceVersion || '',
    createdAt: nowIso_(),
    updatedAt: nowIso_()
  };

  return createRecord_(LOTES_COA_SHEET, lote, userId);
}

// ============================================================================
// READ
// ============================================================================

/**
 * Busca Lote por ID
 *
 * @param {string} id
 * @returns {object|null}
 */
function getLoteCoAById_(id) {
  return getRecordById_(LOTES_COA_SHEET, id);
}

/**
 * Lista todos os Lotes CoA (com filtros e paginação)
 *
 * @param {object} filters — {insumoId, statusAuditoria, statusLiberacao}
 * @param {object} pagination — {page, pageSize, sortBy, sortOrder}
 * @returns {object} {items, pagination}
 */
function listLotesCoA_(filters, pagination) {
  filters = filters || {};

  return listRecords_(LOTES_COA_SHEET, filters, pagination);
}

/**
 * Lista Lotes por Insumo
 *
 * @param {string} insumoId
 * @returns {array}
 */
function getLotesByInsumo_(insumoId) {
  return searchRecords_(LOTES_COA_SHEET, { insumoId: insumoId });
}

/**
 * Lista Lotes por status de auditoria
 *
 * @param {string} statusAuditoria
 * @returns {array}
 */
function getLotesByStatusAuditoria_(statusAuditoria) {
  return searchRecords_(LOTES_COA_SHEET, { statusAuditoria: statusAuditoria });
}

/**
 * Lista Lotes por status de liberação
 *
 * @param {string} statusLiberacao
 * @returns {array}
 */
function getLotesByStatusLiberacao_(statusLiberacao) {
  return searchRecords_(LOTES_COA_SHEET, { statusLiberacao: statusLiberacao });
}

/**
 * Busca Lotes por número de lote (pattern)
 *
 * @param {string} pattern
 * @returns {array}
 */
function searchLotesByNumero_(pattern) {
  return searchRecordsByPattern_(LOTES_COA_SHEET, 'numeroLote', pattern);
}

/**
 * Lista Lotes LIBERADOS por insumo
 *
 * @param {string} insumoId
 * @returns {array}
 */
function getLotesLiberadosByInsumo_(insumoId) {
  const allLotes = getLotesByInsumo_(insumoId);
  return allLotes.filter(function(lote) {
    return lote.statusLiberacao === COA_STATUS_LIBERACAO.LIBERADO;
  });
}

/**
 * Lista Lotes com ALERTAS ou REPROVADOS
 *
 * @returns {array}
 */
function getLotesComProblemas_() {
  const all = getAllRecords_(LOTES_COA_SHEET);
  return all.filter(function(lote) {
    return lote.statusAuditoria === COA_STATUS_AUDITORIA.ALERTA ||
           lote.statusAuditoria === COA_STATUS_AUDITORIA.REPROVADO ||
           lote.statusLiberacao === COA_STATUS_LIBERACAO.QUARENTENA ||
           lote.statusLiberacao === COA_STATUS_LIBERACAO.BLOQUEADO;
  });
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Atualiza Lote CoA
 *
 * @param {string} id
 * @param {object} updates
 * @param {string} userId — usuário que faz update (para auditoria)
 * @returns {object}
 */
function updateLoteCoA_(id, updates, userId) {
  updates.updatedAt = nowIso_();

  return updateRecord_(LOTES_COA_SHEET, id, updates);
}

/**
 * Atualiza status de auditoria do Lote
 *
 * @param {string} id
 * @param {string} newStatus
 * @param {string} userId
 * @param {string} auditorEmail
 * @returns {object}
 */
function updateLoteStatusAuditoria_(id, newStatus, userId, auditorEmail) {
  return updateLoteCoA_(id, {
    statusAuditoria: newStatus,
    dataAuditoria: nowIso_(),
    auditorEmail: auditorEmail || ''
  }, userId);
}

/**
 * Atualiza status de liberação do Lote
 *
 * @param {string} id
 * @param {string} newStatus
 * @param {string} userId
 * @returns {object}
 */
function updateLoteStatusLiberacao_(id, newStatus, userId) {
  return updateLoteCoA_(id, { statusLiberacao: newStatus }, userId);
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Deleta Lote CoA (soft delete)
 *
 * @param {string} id
 * @returns {object}
 */
function deleteLoteCoA_(id) {
  return deleteRecord_(LOTES_COA_SHEET, id);
}

// ============================================================================
// AGGREGAÇÕES
// ============================================================================

/**
 * Conta Lotes por status de auditoria
 *
 * @returns {object}
 */
function getLoteCountByStatusAuditoria_() {
  return countRecordsByStatus_(LOTES_COA_SHEET, 'statusAuditoria');
}

/**
 * Conta Lotes por status de liberação
 *
 * @returns {object}
 */
function getLoteCountByStatusLiberacao_() {
  return countRecordsByStatus_(LOTES_COA_SHEET, 'statusLiberacao');
}

/**
 * Retorna total de Lotes
 *
 * @returns {number}
 */
function getTotalLotes_() {
  return countActiveRecords_(LOTES_COA_SHEET);
}

/**
 * Retorna estatísticas de Lotes
 *
 * @returns {object}
 */
function getLoteStats_() {
  const byAuditoria = getLoteCountByStatusAuditoria_();
  const byLiberacao = getLoteCountByStatusLiberacao_();
  const total = getTotalLotes_();

  return {
    total: total,
    byStatusAuditoria: byAuditoria,
    byStatusLiberacao: byLiberacao,
    timestamp: nowIso_()
  };
}

// ============================================================================
// VALIDAÇÃO
// ============================================================================

/**
 * Verifica se Lote existe
 *
 * @param {string} id
 * @returns {boolean}
 */
function loteCoAExists_(id) {
  return getLoteCoAById_(id) !== null;
}

/**
 * Valida dados de Lote para criação/atualização
 *
 * @param {object} data
 * @returns {object} {valid, errors}
 */
function validateLoteCoAData_(data) {
  const errors = [];

  if (!data.insumoId || !insumoExists_(data.insumoId)) {
    errors.push({ field: 'insumoId', message: 'Insumo não encontrado' });
  }

  if (!data.numeroLote || data.numeroLote.trim().length < 1) {
    errors.push({ field: 'numeroLote', message: 'Número do lote obrigatório' });
  }

  if (data.statusAuditoria && !Object.values(COA_STATUS_AUDITORIA).includes(data.statusAuditoria)) {
    errors.push({ field: 'statusAuditoria', message: 'Status de auditoria inválido' });
  }

  if (data.statusLiberacao && !Object.values(COA_STATUS_LIBERACAO).includes(data.statusLiberacao)) {
    errors.push({ field: 'statusLiberacao', message: 'Status de liberação inválido' });
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// ============================================================================
// EXPORTAR
// ============================================================================

const LOTE_COA_REPOSITORY_LOADED = true;
