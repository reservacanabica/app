/**
 * COMPONENTE: 28_InsumoService.gs
 * PAPEL: Business logic para Insumos
 *
 * RESPONSABILIDADE:
 * - Agregação de insumos com lotes
 * - Estatísticas de disponibilidade
 * - Validação de conformidade MAPA
 * - Busca por especificações nutricionais
 *
 * INTEGRAÇÕES:
 * - InsumoRepository (acesso a dados)
 * - LoteCoARepository (lotes relacionados)
 *
 * STATUS: v2.1 — Implementado (PROMPT 3)
 */

// ============================================================================
// BUSINESS LOGIC — Agregações
// ============================================================================

/**
 * Busca insumo com lotes agregados e estatísticas
 *
 * @param {string} insumoId
 * @returns {object} {insumo, lotes, stats}
 */
function getInsumoWithLotes_(insumoId) {
  const insumo = getInsumoById_(insumoId);
  if (!insumo) {
    throw new Error('Insumo não encontrado: ' + insumoId);
  }

  const lotes = getLotesByInsumo_(insumoId);

  // Calcular estatísticas
  const stats = {
    totalLotes: lotes.length,
    lotesLiberados: 0,
    lotesPendentes: 0,
    lotesQuarentena: 0,
    lotesBloqueados: 0,
    lotesAprovados: 0,
    lotesReprovados: 0
  };

  lotes.forEach(function(lote) {
    // Status de liberação
    if (lote.statusLiberacao === COA_STATUS_LIBERACAO.LIBERADO) stats.lotesLiberados++;
    else if (lote.statusLiberacao === COA_STATUS_LIBERACAO.PENDENTE) stats.lotesPendentes++;
    else if (lote.statusLiberacao === COA_STATUS_LIBERACAO.QUARENTENA) stats.lotesQuarentena++;
    else if (lote.statusLiberacao === COA_STATUS_LIBERACAO.BLOQUEADO) stats.lotesBloqueados++;

    // Status de auditoria
    if (lote.statusAuditoria === COA_STATUS_AUDITORIA.APROVADO) stats.lotesAprovados++;
    else if (lote.statusAuditoria === COA_STATUS_AUDITORIA.REPROVADO) stats.lotesReprovados++;
  });

  return {
    insumo: insumo,
    lotes: lotes,
    stats: stats
  };
}

/**
 * Busca insumos disponíveis (com pelo menos 1 lote LIBERADO)
 *
 * @param {object} filters — Filtros adicionais
 * @returns {array} Array de insumos disponíveis
 */
function getInsumosDisponiveis_(filters) {
  filters = filters || {};
  filters.ativo = INPUT_STATUS.ATIVO;

  const insumos = listInsumos_(filters, {page: 1, pageSize: 1000});
  const items = insumos.items || [];

  // Filtrar apenas insumos com lotes liberados
  const disponiveis = [];

  items.forEach(function(insumo) {
    const lotesLiberados = getLotesLiberadosByInsumo_(insumo.id);
    if (lotesLiberados.length > 0) {
      disponiveis.push({
        insumo: insumo,
        lotesDisponiveis: lotesLiberados.length
      });
    }
  });

  return disponiveis;
}

// ============================================================================
// BUSINESS LOGIC — Validações
// ============================================================================

/**
 * Valida conformidade MAPA do insumo
 *
 * @param {object} insumo
 * @returns {object} {compliant, warnings, errors}
 */
function validateMAPACompliance_(insumo) {
  const warnings = [];
  const errors = [];

  // Verificar registro MAPA do estabelecimento
  if (!insumo.registroMAPAEstabelecimento || insumo.registroMAPAEstabelecimento.trim() === '') {
    warnings.push('Registro MAPA do estabelecimento não informado');
  }

  // Verificar registro MAPA do produto
  if (!insumo.registroMAPAProduto || insumo.registroMAPAProduto.trim() === '') {
    warnings.push('Registro MAPA do produto não informado');
  }

  // Verificar pureza mínima (80%)
  if (insumo.purezaPercentual && insumo.purezaPercentual < 80) {
    errors.push('Pureza abaixo do mínimo aceitável (80%): ' + insumo.purezaPercentual + '%');
  }

  // Verificar ficha técnica
  if (!insumo.driveFichaTecnicaURL || insumo.driveFichaTecnicaURL.trim() === '') {
    warnings.push('Ficha técnica não anexada');
  }

  // Verificar se está ativo
  if (insumo.ativo !== INPUT_STATUS.ATIVO) {
    errors.push('Insumo marcado como INATIVO');
  }

  return {
    compliant: errors.length === 0,
    warnings: warnings,
    errors: errors
  };
}

/**
 * Busca insumos por nutriente específico
 * (Placeholder — requer extensão do schema com composição nutricional)
 *
 * @param {string} nutrient — Ex: "N", "P", "K", "Ca", "Mg", "Fe"
 * @param {number} minValue — Valor mínimo em %
 * @returns {array} Array de insumos que contêm o nutriente
 */
function getInsumosByNutrient_(nutrient, minValue) {
  // TODO: Requer adicionar campos de composição nutricional ao schema
  // Por ora, retorna lista vazia
  
  logWarn_('getInsumosByNutrient_ não implementado completamente', {
    nutrient: nutrient,
    minValue: minValue,
    reason: 'Schema não possui composição nutricional detalhada'
  });

  return [];
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calcula score de qualidade do insumo (0-100)
 * Baseado em: pureza, registros MAPA, ficha técnica
 *
 * @param {object} insumo
 * @returns {number} Score 0-100
 */
function calcularInsumoQualityScore_(insumo) {
  let score = 0;

  // Pureza (0-40 pontos)
  if (insumo.purezaPercentual) {
    score += (insumo.purezaPercentual / 100) * 40;
  }

  // Registro MAPA Estabelecimento (15 pontos)
  if (insumo.registroMAPAEstabelecimento && insumo.registroMAPAEstabelecimento.trim() !== '') {
    score += 15;
  }

  // Registro MAPA Produto (15 pontos)
  if (insumo.registroMAPAProduto && insumo.registroMAPAProduto.trim() !== '') {
    score += 15;
  }

  // Ficha Técnica (10 pontos)
  if (insumo.driveFichaTecnicaURL && insumo.driveFichaTecnicaURL.trim() !== '') {
    score += 10;
  }

  // Solubilidade informada (10 pontos)
  if (insumo.solubilidade_gL_20C && insumo.solubilidade_gL_20C > 0) {
    score += 10;
  }

  // Agente quelante informado (10 pontos)
  if (insumo.agenteQuelante && insumo.agenteQuelante.trim() !== '') {
    score += 10;
  }

  return Math.round(score);
}

// ============================================================================
// EXPORTAR
// ============================================================================

const INSUMO_SERVICE_LOADED = true;
