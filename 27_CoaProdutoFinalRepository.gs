/**
 * COMPONENTE: 27_CoaProdutoFinalRepository.gs
 * PAPEL: Repositório de CoA de produto final
 * STATUS: v1.0 — P0-1: Certificate of Analysis por lote de colheita
 * 
 * RESPONSABILIDADE:
 * - CRUD de CoA de produto final
 * - Vinculação com lote de colheita
 * - Armazenamento de perfis de canabinoides, terpenos, metais pesados, microbiologia
 */

// ============================================================================
// LEITURA
// ============================================================================

/**
 * Retorna todos os CoAs de produto final
 * @returns {Array} Array de CoAs
 */
function getAllCoasProdutoFinal_() {
  return getAllRowsAsObjects_('DB_COA_PRODUTO_FINAL');
}

/**
 * Busca CoA por ID
 * @param {string} coaId
 * @returns {Object|null}
 */
function getCoaProdutoFinalById_(coaId) {
  return getRowById_('DB_COA_PRODUTO_FINAL', coaId);
}

/**
 * Busca CoA por lote de colheita
 * @param {string} loteId
 * @returns {Object|null}
 */
function getCoaByLoteColheita_(loteId) {
  const coas = getAllCoasProdutoFinal_();
  return coas.find(function(c) { 
    return c.lote_colheita_id === loteId; 
  }) || null;
}

/**
 * Busca CoAs por status de liberação
 * @param {string} status
 * @returns {Array}
 */
function getCoasByStatus_(status) {
  const coas = getAllCoasProdutoFinal_();
  return coas.filter(function(c) { 
    return c.status_liberacao === status; 
  });
}

// ============================================================================
// CRIAÇÃO
// ============================================================================

/**
 * Cria novo CoA de produto final
 * @param {Object} coaData
 * @returns {Object} CoA criado
 */
function createCoaProdutoFinal_(coaData) {
  // Validar campos obrigatórios
  if (!coaData.lote_colheita_id) {
    throw createError_('VALIDATION_ERROR', 'lote_colheita_id obrigatório', {});
  }
  
  const coa = {
    id: generateUUID_(),
    lote_colheita_id: coaData.lote_colheita_id,
    thc_pct: coaData.thc_pct || 0,
    thca_pct: coaData.thca_pct || 0,
    cbd_pct: coaData.cbd_pct || 0,
    cbda_pct: coaData.cbda_pct || 0,
    cbg_pct: coaData.cbg_pct || 0,
    thcv_pct: coaData.thcv_pct || 0,
    perfil_terpenos_json: coaData.perfil_terpenos_json || '{}',
    aflatoxina_total_ppb: coaData.aflatoxina_total_ppb || 0,
    ocratoxina_ppb: coaData.ocratoxina_ppb || 0,
    pesticidas_json: coaData.pesticidas_json || '{}',
    microbiologico_json: coaData.microbiologico_json || '{}',
    solventes_json: coaData.solventes_json || '{}',
    agua_atividade_aw: coaData.agua_atividade_aw || 0,
    metais_pesados_json: coaData.metais_pesados_json || '{}',
    laboratorio: coaData.laboratorio || '',
    acreditacao_iso17025: coaData.acreditacao_iso17025 || false,
    metodo: coaData.metodo || '',
    data_analise: coaData.data_analise || nowIso_().split('T')[0],
    status_liberacao: coaData.status_liberacao || COA_STATUS_LIBERACAO_FINAL.PENDENTE,
    createdAt: nowIso_(),
    updatedAt: nowIso_()
  };
  
  appendRow_('DB_COA_PRODUTO_FINAL', coa);
  
  logInfo_('CoA produto final criado', {
    coaId: coa.id,
    loteId: coa.lote_colheita_id,
    thc_pct: coa.thc_pct,
    cbd_pct: coa.cbd_pct
  });
  
  return coa;
}

// ============================================================================
// ATUALIZAÇÃO
// ============================================================================

/**
 * Atualiza CoA de produto final
 * @param {string} coaId
 * @param {Object} updates
 * @returns {Object} CoA atualizado
 */
function updateCoaProdutoFinal_(coaId, updates) {
  updates.updatedAt = nowIso_();
  return updateRowById_('DB_COA_PRODUTO_FINAL', coaId, updates);
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

const COA_PRODUTO_FINAL_REPOSITORY_LOADED = true;
