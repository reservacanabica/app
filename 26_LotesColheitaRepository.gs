/**
 * COMPONENTE: 26_LotesColheitaRepository.gs
 * PAPEL: Repositório de lotes de colheita
 * STATUS: v1.0 — P0-5: Rastreabilidade seed-to-sale
 * 
 * RESPONSABILIDADE:
 * - CRUD de lotes de colheita
 * - Vinculação com plantas colhidas
 * - Rastreabilidade de massa
 */

// ============================================================================
// LEITURA
// ============================================================================

/**
 * Retorna todos os lotes de colheita
 * @returns {Array} Array de lotes
 */
function getAllLotesColheita_() {
  return getAllRowsAsObjects_('DB_LOTES_COLHEITA');
}

/**
 * Busca lote por ID
 * @param {string} loteId
 * @returns {Object|null}
 */
function getLoteColheitaById_(loteId) {
  return getRowById_('DB_LOTES_COLHEITA', loteId);
}

/**
 * Busca lotes por status
 * @param {string} status — STATUS_LOTE_COLHEITA
 * @returns {Array}
 */
function getLotesByStatus_(status) {
  const lotes = getAllLotesColheita_();
  return lotes.filter(function(l) { 
    return l.status_lote === status; 
  });
}

/**
 * Busca lotes por strain
 * @param {string} strainNome
 * @returns {Array}
 */
function getLotesByStrain_(strainNome) {
  const lotes = getAllLotesColheita_();
  return lotes.filter(function(l) { 
    return l.strain_nome === strainNome; 
  });
}

// ============================================================================
// CRIAÇÃO
// ============================================================================

/**
 * Cria novo lote de colheita
 * @param {Object} loteData
 * @returns {Object} Lote criado
 */
function createLoteColheita_(loteData) {
  // Validar campos obrigatórios
  if (!loteData.plantas_ids_json || !loteData.data_colheita) {
    throw createError_('VALIDATION_ERROR', 'Campos obrigatórios faltando', {
      missing: ['plantas_ids_json', 'data_colheita']
    });
  }
  
  const lote = {
    id: generateUUID_(),
    plantas_ids_json: loteData.plantas_ids_json,
    data_colheita: loteData.data_colheita,
    peso_umido_g: loteData.peso_umido_g || 0,
    peso_seco_g: loteData.peso_seco_g || 0,
    sala_cultivo: loteData.sala_cultivo || '',
    operador_id: loteData.operador_id || '',
    strain_nome: loteData.strain_nome || '',
    status_lote: loteData.status_lote || STATUS_LOTE_COLHEITA.COLHIDO,
    observacoes: loteData.observacoes || '',
    createdAt: nowIso_(),
    updatedAt: nowIso_()
  };
  
  appendRow_('DB_LOTES_COLHEITA', lote);
  
  logInfo_('Lote de colheita criado', {
    loteId: lote.id,
    strain: lote.strain_nome,
    peso_seco_g: lote.peso_seco_g
  });
  
  return lote;
}

// ============================================================================
// ATUALIZAÇÃO
// ============================================================================

/**
 * Atualiza lote de colheita
 * @param {string} loteId
 * @param {Object} updates
 * @returns {Object} Lote atualizado
 */
function updateLoteColheita_(loteId, updates) {
  updates.updatedAt = nowIso_();
  return updateRowById_('DB_LOTES_COLHEITA', loteId, updates);
}

// ============================================================================
// EXCLUSÃO
// ============================================================================

/**
 * Deleta lote de colheita
 * @param {string} loteId
 * @returns {boolean}
 */
function deleteLoteColheita_(loteId) {
  return deleteRowById_('DB_LOTES_COLHEITA', loteId);
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

const LOTES_COLHEITA_REPOSITORY_LOADED = true;
