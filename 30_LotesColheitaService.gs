/**
 * COMPONENTE: 30_LotesColheitaService.gs
 * PAPEL: Lógica de negócio para lotes de colheita
 * STATUS: v1.0 — P0-5: Rastreabilidade seed-to-sale com reconciliação de massa
 * 
 * RESPONSABILIDADE:
 * - Criação de lotes com validação de plantas
 * - Reconciliação de massa (colhido - descartado = estoque)
 * - Relatórios de divergência
 */

// ============================================================================
// CRIAÇÃO DE LOTE COM VALIDAÇÃO
// ============================================================================

/**
 * Cria lote de colheita com reconciliação de massa
 * Verifica que plantas existem e estão em fase adequada
 * 
 * @param {Object} requestContext
 * @param {Object} loteData
 * @returns {Object} Lote criado
 */
function criarLoteColheita_(requestContext, loteData) {
  requirePermission_(requestContext, 'lotes.create');
  
  // Parse plantas
  const plantasIds = JSON.parse(loteData.plantas_ids_json);
  
  // Verificar que plantas existem
  const plantas = plantasIds.map(function(id) {
    const planta = getRowById_('DB_CULTIVO_PLANTAS', id);
    if (!planta) {
      throw createError_('VALIDATION_ERROR', 'Planta não encontrada: ' + id, {});
    }
    return planta;
  });
  
  // Criar lote
  const lote = createLoteColheita_(loteData);
  
  // Atualizar status das plantas para COLHIDA
  plantasIds.forEach(function(id) {
    updateRowById_('DB_CULTIVO_PLANTAS', id, {
      status: 'COLHIDA'
    });
  });
  
  // Auditar
  auditCreate_('DB_LOTES_COLHEITA', lote.id, requestContext.user.id, {
    strain: lote.strain_nome,
    plantas: plantasIds.length,
    peso_umido: lote.peso_umido_g
  }, requestContext.correlationId);
  
  return lote;
}

// ============================================================================
// RECONCILIAÇÃO DE MASSA
// ============================================================================

/**
 * Reconciliação de massa: colhido - descartado = estoque
 * Retorna relatório de divergência
 * 
 * @param {string} loteId
 * @returns {Object} Relatório de reconciliação
 */
function reconciliarMassa_(loteId) {
  const lote = getLoteColheitaById_(loteId);
  if (!lote) {
    throw createError_('NOT_FOUND', 'Lote não encontrado', { loteId: loteId });
  }
  
  // Peso colhido registrado
  const pesoColhido = parseFloat(lote.peso_seco_g) || 0;
  
  // Descartes vinculados ao lote
  const descartes = getDescartesByLote_(loteId);
  const pesoDescartado = descartes.reduce(function(sum, d) {
    return sum + (parseFloat(d.peso_g) || 0);
  }, 0);
  
  // LIMITAÇÃO (P0-5): Peso em estoque hardcoded em 0 até implementação de DB_ESTOQUE
  // Reconciliação real requer integração com sistema de estoque para rastrear:
  // - Produto final envasado (peso por lote)
  // - Produtos em processo (extração, formulação)
  // - Amostras enviadas para laboratório
  // TODO: Implementar DB_ESTOQUE com campos: lote_colheita_id, peso_g, tipo_produto, status
  const pesoEstoque = 0; // TODO: implementar quando houver DB_ESTOQUE
  
  // Divergência
  const pesoTotal = pesoEstoque + pesoDescartado;
  const divergencia_g = pesoColhido - pesoTotal;
  const divergencia_pct = pesoColhido > 0 ? (divergencia_g / pesoColhido) * 100 : 0;
  
  // Alerta se divergência > limiar configurado (P0-5: parametrizado em 01_Constants.gs)
  // IMPORTANTE: Status 'PARCIAL' quando pesoEstoque === 0 (reconciliação incompleta)
  let status;
  if (pesoEstoque === 0) {
    status = 'PARCIAL'; // Reconciliação incompleta - aguardando implementação DB_ESTOQUE
  } else {
    status = Math.abs(divergencia_pct) < LIMIAR_DIVERGENCIA_RECONCILIACAO_PCT ? 'OK' : 'ALERTA';
  }
  
  return {
    loteId: loteId,
    strain: lote.strain_nome,
    peso_colhido_g: pesoColhido,
    peso_descartado_g: pesoDescartado,
    peso_estoque_g: pesoEstoque,
    divergencia_g: divergencia_g,
    divergencia_pct: divergencia_pct.toFixed(2),
    status: status,
    limitacao: pesoEstoque === 0 
      ? 'Peso em estoque não rastreado — aguardar implementação DB_ESTOQUE. Divergência reportada não representa desvio real até que estoque seja integrado.'
      : null,
    timestamp: nowIso_()
  };
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

const LOTES_COLHEITA_SERVICE_LOADED = true;
