/**
 * COMPONENTE: 31_DescartesRepository.gs
 * PAPEL: Repositório de descartes de plantas e lotes
 * STATUS: v1.0 — P0-5: Rastreabilidade seed-to-sale
 * 
 * RESPONSABILIDADE:
 * - CRUD de registros de descarte
 * - Vinculação com plantas ou lotes
 * - Controle de desvio e reconciliação de massa
 */

// ============================================================================
// LEITURA
// ============================================================================

/**
 * Retorna todos os descartes
 * @returns {Array} Array de descartes
 */
function getAllDescartes_() {
  return getAllRowsAsObjects_('DB_DESCARTES');
}

/**
 * Busca descarte por ID
 * @param {string} descarteId
 * @returns {Object|null}
 */
function getDescarteById_(descarteId) {
  return getRowById_('DB_DESCARTES', descarteId);
}

/**
 * Busca descartes por planta
 * @param {string} plantaId
 * @returns {Array}
 */
function getDescartesByPlanta_(plantaId) {
  const descartes = getAllDescartes_();
  return descartes.filter(function(d) { 
    return d.planta_id === plantaId; 
  });
}

/**
 * Busca descartes por lote
 * @param {string} loteId
 * @returns {Array}
 */
function getDescartesByLote_(loteId) {
  const descartes = getAllDescartes_();
  return descartes.filter(function(d) { 
    return d.lote_id === loteId; 
  });
}

// ============================================================================
// CRIAÇÃO
// ============================================================================

/**
 * Cria novo registro de descarte
 * @param {Object} descarteData
 * @returns {Object} Descarte criado
 */
function createDescarte_(descarteData) {
  // Validar campos obrigatórios
  if (!descarteData.peso_g || !descarteData.motivo) {
    throw createError_('VALIDATION_ERROR', 'Campos obrigatórios faltando', {
      missing: ['peso_g', 'motivo']
    });
  }
  
  const descarte = {
    id: generateUUID_(),
    planta_id: descarteData.planta_id || null,
    lote_id: descarteData.lote_id || null,
    motivo: descarteData.motivo,
    peso_g: descarteData.peso_g,
    testemunha_id: descarteData.testemunha_id || '',
    metodo_descarte: descarteData.metodo_descarte || '',
    data_descarte: descarteData.data_descarte || nowIso_().split('T')[0],
    observacoes: descarteData.observacoes || '',
    createdAt: nowIso_()
  };
  
  appendRow_('DB_DESCARTES', descarte);
  
  logInfo_('Descarte registrado', {
    descarteId: descarte.id,
    motivo: descarte.motivo,
    peso_g: descarte.peso_g
  });
  
  return descarte;
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

const DESCARTES_REPOSITORY_LOADED = true;
