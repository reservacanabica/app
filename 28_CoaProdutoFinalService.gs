/**
 * COMPONENTE: 28_CoaProdutoFinalService.gs
 * PAPEL: Validação de CoA de produto final
 * STATUS: v1.0 — P0-1: Validação PDE×via×dose, hard blocks microbiológicos
 * 
 * RESPONSABILIDADE:
 * - Validação de CoA conforme grau exigido e via de administração
 * - Hard blocks: Aspergillus para GRAU_1, aflatoxinas >20ppb
 * - Cálculo de PDE (Permitted Daily Exposure) por via
 * - Liberação ou bloqueio de lote
 */

// ============================================================================
// TABELA DE PDE (ICH Q3D / USP <232>)
// ============================================================================

/**
 * Permitted Daily Exposure por elemento e via
 * Valores em µg/dia conforme ICH Q3D
 * 
 * Ref: ICH Q3D Guideline for Elemental Impurities
 * Ref: USP General Chapter <232> Elemental Impurities—Limits
 */
const PDE_METAIS_PESADOS = {
  Pb: { oral: 5, inhalation: 5, parenteral: 5 },
  Cd: { oral: 5, inhalation: 3, parenteral: 2 },
  As: { oral: 15, inhalation: 2, parenteral: 15 },
  Hg: { oral: 30, inhalation: 1, parenteral: 3 }
};

// ============================================================================
// VALIDAÇÃO DE COA
// ============================================================================

/**
 * Valida CoA do produto final conforme grau exigido e via de administração
 * 
 * HARD BLOCKS:
 * - Aspergillus detectado + GRAU_1_ESTRITO → bloqueio (risco aspergilose invasiva)
 * - Aflatoxinas >20 ppb → bloqueio (USP Cannabis)
 * - Metais pesados excedendo PDE → bloqueio
 * 
 * WARNINGS:
 * - Aw >0.65 → risco de fungos
 * 
 * @param {Object} coa — CoA do produto final
 * @param {string} grauExigido — GRAU_COA enum
 * @param {string} via — 'sublingual', 'inalatoria', 'oral', 'topica'
 * @param {number} doseDiaria_g — dose diária em gramas
 * @returns {Object} {aprovado: boolean, bloqueios: [], alertas: []}
 */
function validarCoaProdutoFinal_(coa, grauExigido, via, doseDiaria_g) {
  const resultado = {
    aprovado: true,
    bloqueios: [],
    alertas: [],
    detalhes: {}
  };
  
  // 1. HARD BLOCK: Aspergillus para GRAU_1 (imunossuprimidos)
  if (grauExigido === GRAU_COA.GRAU_1_ESTRITO) {
    const micro = JSON.parse(coa.microbiologico_json || '{}');
    if (micro.Aspergillus && micro.Aspergillus !== 'AUSENTE') {
      resultado.aprovado = false;
      resultado.bloqueios.push({
        tipo: 'REGULATORY_BLOCK',
        campo: 'Aspergillus',
        valor: micro.Aspergillus,
        limite: 'AUSENTE',
        razao: 'Paciente imunossuprimido (GRAU_1) — risco de aspergilose invasiva. USP <1111> Microbiological Examination of Nonsterile Products.'
      });
    }
  }
  
  // 2. HARD BLOCK: Aflatoxinas >20 ppb (USP Cannabis)
  const aflatoxina = parseFloat(coa.aflatoxina_total_ppb) || 0;
  if (aflatoxina > 20) {
    resultado.aprovado = false;
    resultado.bloqueios.push({
      tipo: 'REGULATORY_BLOCK',
      campo: 'aflatoxina_total_ppb',
      valor: aflatoxina,
      limite: 20,
      razao: 'Excede limite USP para aflatoxinas totais (20 ppb). Risco carcinogênico.'
    });
  }
  
  // 3. VALIDAÇÃO PDE: Metais pesados por via e dose
  const viaMap = {
    'sublingual': 'oral',
    'oral': 'oral',
    'inalatoria': 'inhalation',
    'topica': 'parenteral'
  };
  const viaICH = viaMap[via] || 'oral';
  
  // Parse metais pesados
  const metais = JSON.parse(coa.metais_pesados_json || '{}');
  
  // Cálculo: exposicao_diaria_µg = teor_ppm × doseDiaria_g × 1000
  // 1 ppm = 1 µg/g, então ppm × g = µg
  for (var metal in PDE_METAIS_PESADOS) {
    const teor_ppm = parseFloat(metais[metal + '_ppm']) || 0;
    const exposicao_diaria_µg = teor_ppm * doseDiaria_g;
    const pde_limite = PDE_METAIS_PESADOS[metal][viaICH];
    
    if (exposicao_diaria_µg > pde_limite) {
      resultado.aprovado = false;
      resultado.bloqueios.push({
        tipo: 'REGULATORY_BLOCK',
        campo: metal,
        teor_ppm: teor_ppm,
        exposicao_diaria_µg: exposicao_diaria_µg,
        limite_pde_µg: pde_limite,
        via: viaICH,
        razao: 'Exposição diária de ' + metal + ' excede PDE para via ' + viaICH + ' (ICH Q3D)'
      });
    }
  }
  
  // 4. WARNING: Aw >0.65 (risco de fungos)
  const aw = parseFloat(coa.agua_atividade_aw) || 0;
  if (aw > 0.65) {
    resultado.alertas.push({
      tipo: 'SCIENTIFIC_WARNING',
      campo: 'agua_atividade_aw',
      valor: aw,
      limite: 0.65,
      razao: 'Water activity elevada — risco de crescimento fúngico durante armazenamento. Reduzir para <0.65.'
    });
  }
  
  return resultado;
}

// ============================================================================
// LIBERAÇÃO DE COA
// ============================================================================

/**
 * Libera CoA após validação
 * 
 * @param {Object} requestContext
 * @param {string} coaId
 * @param {string} grauExigido
 * @param {string} via
 * @param {number} doseDiaria_g
 * @returns {Object} Resultado da liberação
 */
function liberarCoaProdutoFinal_(requestContext, coaId, grauExigido, via, doseDiaria_g) {
  requirePermission_(requestContext, 'coa.audit');
  
  const coa = getCoaProdutoFinalById_(coaId);
  if (!coa) {
    throw createError_('NOT_FOUND', 'CoA não encontrado', { coaId: coaId });
  }
  
  const validacao = validarCoaProdutoFinal_(coa, grauExigido, via, doseDiaria_g);
  
  if (!validacao.aprovado) {
    // Bloquear
    updateCoaProdutoFinal_(coaId, {
      status_liberacao: COA_STATUS_LIBERACAO_FINAL.BLOQUEADO
    });
    
    auditEvent_('COA_BLOQUEADO', 'DB_COA_PRODUTO_FINAL', coaId, 'UPDATE', {
      grau: grauExigido,
      via: via,
      bloqueios: validacao.bloqueios.length
    }, requestContext.correlationId);
    
    return {
      liberado: false,
      status: COA_STATUS_LIBERACAO_FINAL.BLOQUEADO,
      bloqueios: validacao.bloqueios,
      alertas: validacao.alertas
    };
  }
  
  // Liberar
  updateCoaProdutoFinal_(coaId, {
    status_liberacao: COA_STATUS_LIBERACAO_FINAL.LIBERADO
  });
  
  auditEvent_('COA_LIBERADO', 'DB_COA_PRODUTO_FINAL', coaId, 'UPDATE', {
    grau: grauExigido,
    via: via,
    dose: doseDiaria_g
  }, requestContext.correlationId);
  
  return {
    liberado: true,
    status: COA_STATUS_LIBERACAO_FINAL.LIBERADO,
    alertas: validacao.alertas
  };
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

const COA_PRODUTO_FINAL_SERVICE_LOADED = true;
