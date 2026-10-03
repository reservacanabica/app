/**
 * COMPONENTE: 30_ReceitaService.gs
 * PAPEL: Business logic para Receitas de Fertirrigação
 *
 * RESPONSABILIDADE:
 * - Cálculo de balanceamento nutricional
 * - Sugestão de insumos
 * - Validação de receitas completas
 * - Comparação entre receitas
 *
 * INTEGRAÇÕES:
 * - ReceitaFertirrigacaoRepository (acesso a dados)
 * - InsumoRepository (sugestão de insumos)
 *
 * STATUS: v2.1 — Implementado (PROMPT 3)
 */

// ============================================================================
// BUSINESS LOGIC — Balanceamento Nutricional
// ============================================================================

/**
 * Calcula balanço nutricional da receita
 * Retorna ratios importantes e flags de alerta
 *
 * @param {object} receita
 * @returns {object} {ratios, alertas, recomendacoes}
 */
function calcularBalanco_(receita) {
  const alertas = [];
  const recomendacoes = [];

  // Calcular totais
  const N_total = (receita.alvo_N_NO3_ppm || 0) + (receita.alvo_N_NH4_ppm || 0);
  const P = receita.alvo_P_ppm || 0;
  const K = receita.alvo_K_ppm || 0;
  const Ca = receita.alvo_Ca_ppm || 0;
  const Mg = receita.alvo_Mg_ppm || 0;
  const Fe = receita.alvo_Fe_ppm || 0;

  // Calcular ratios
  const ratios = {
    N_P_K: formatRatio_(N_total, P, K),
    N_P: (P > 0 ? (N_total / P).toFixed(2) : 'N/A'),
    N_K: (K > 0 ? (N_total / K).toFixed(2) : 'N/A'),
    Ca_Mg: (Mg > 0 ? (Ca / Mg).toFixed(2) : 'N/A'),
    NO3_NH4: (receita.alvo_N_NH4_ppm > 0 ? (receita.alvo_N_NO3_ppm / receita.alvo_N_NH4_ppm).toFixed(2) : 'N/A')
  };

  // Validar ratio Ca:Mg (ideal: 3-5:1)
  if (Ca > 0 && Mg > 0) {
    const ratioCaMg = Ca / Mg;
    if (ratioCaMg < 2) {
      alertas.push('Ratio Ca:Mg muito baixo (' + ratioCaMg.toFixed(2) + ':1). Ideal: 3-5:1');
      recomendacoes.push('Aumentar Ca ou diminuir Mg');
    } else if (ratioCaMg > 6) {
      alertas.push('Ratio Ca:Mg muito alto (' + ratioCaMg.toFixed(2) + ':1). Ideal: 3-5:1');
      recomendacoes.push('Diminuir Ca ou aumentar Mg');
    }
  }

  // Validar ratio NO3:NH4 (ideal: 10-20:1 para cannabis)
  if (receita.alvo_N_NO3_ppm > 0 && receita.alvo_N_NH4_ppm > 0) {
    const ratioNO3NH4 = receita.alvo_N_NO3_ppm / receita.alvo_N_NH4_ppm;
    if (ratioNO3NH4 < 8) {
      alertas.push('Ratio NO3:NH4 muito baixo (' + ratioNO3NH4.toFixed(2) + ':1). Ideal: 10-20:1');
      recomendacoes.push('Aumentar NO3 ou diminuir NH4');
    } else if (ratioNO3NH4 > 25) {
      alertas.push('Ratio NO3:NH4 muito alto (' + ratioNO3NH4.toFixed(2) + ':1). Ideal: 10-20:1');
      recomendacoes.push('Diminuir NO3 ou aumentar NH4');
    }
  }

  // Validar pH (ideal: 5.8-6.5 para cannabis)
  if (receita.pH_SolucaoAlvo) {
    if (receita.pH_SolucaoAlvo < 5.5) {
      alertas.push('pH muito baixo: ' + receita.pH_SolucaoAlvo + '. Ideal: 5.8-6.5');
      recomendacoes.push('Aumentar pH com base (ex: KOH)');
    } else if (receita.pH_SolucaoAlvo > 6.8) {
      alertas.push('pH muito alto: ' + receita.pH_SolucaoAlvo + '. Ideal: 5.8-6.5');
      recomendacoes.push('Diminuir pH com ácido (ex: H3PO4)');
    }
  }

  // Validar EC (ideal: 1.0-2.5 dS/m para cannabis)
  if (receita.EC_Alvo_dS_m) {
    if (receita.EC_Alvo_dS_m < 0.8) {
      alertas.push('EC muito baixo: ' + receita.EC_Alvo_dS_m + ' dS/m. Ideal: 1.0-2.5 dS/m');
      recomendacoes.push('Aumentar concentração de nutrientes');
    } else if (receita.EC_Alvo_dS_m > 3.0) {
      alertas.push('EC muito alto: ' + receita.EC_Alvo_dS_m + ' dS/m. Ideal: 1.0-2.5 dS/m');
      recomendacoes.push('Diluir solução ou reduzir nutrientes');
    }
  }

  // Validar presença de Fe (importante com quelato)
  if (Fe === 0) {
    alertas.push('Ferro (Fe) não definido. Micronutriente essencial');
    recomendacoes.push('Adicionar fonte de Fe (ex: Fe-EDTA)');
  }

  return {
    ratios: ratios,
    alertas: alertas,
    recomendacoes: recomendacoes
  };
}

/**
 * Formata ratio N:P:K
 *
 * @param {number} n
 * @param {number} p
 * @param {number} k
 * @returns {string} Ex: "10:5:20"
 */
function formatRatio_(n, p, k) {
  if (n === 0 && p === 0 && k === 0) {
    return '0:0:0';
  }

  // Encontrar o menor valor não-zero
  const valores = [n, p, k].filter(function(v) { return v > 0; });
  if (valores.length === 0) {
    return '0:0:0';
  }

  const minVal = Math.min.apply(Math, valores);

  // Normalizar
  const nNorm = (n / minVal).toFixed(1);
  const pNorm = (p / minVal).toFixed(1);
  const kNorm = (k / minVal).toFixed(1);

  return nNorm + ':' + pNorm + ':' + kNorm;
}

// ============================================================================
// BUSINESS LOGIC — Sugestões
// ============================================================================

/**
 * Sugere insumos para atingir receita
 * (Placeholder — requer algoritmo de otimização complexo)
 *
 * @param {object} receita
 * @returns {array} Array de sugestões {insumo, quantidade_g_L}
 */
function sugerirInsumos_(receita) {
  // TODO: Implementar algoritmo de otimização linear
  // Por ora, retorna lista vazia
  
  logWarn_('sugerirInsumos_ não implementado completamente', {
    receitaId: receita.id,
    reason: 'Requer algoritmo de otimização e dados de composição nutricional'
  });

  return [];
}

// ============================================================================
// BUSINESS LOGIC — Validações
// ============================================================================

/**
 * Valida se receita está completa (todos os nutrientes essenciais)
 *
 * @param {object} receita
 * @returns {object} {completa, faltantes, avisos}
 */
function validarReceitaCompleta_(receita) {
  const faltantes = [];
  const avisos = [];

  // Nutrientes essenciais primários
  if (!receita.alvo_N_NO3_ppm && !receita.alvo_N_NH4_ppm) {
    faltantes.push('Nitrogênio (N)');
  }
  if (!receita.alvo_P_ppm || receita.alvo_P_ppm === 0) {
    faltantes.push('Fósforo (P)');
  }
  if (!receita.alvo_K_ppm || receita.alvo_K_ppm === 0) {
    faltantes.push('Potássio (K)');
  }

  // Nutrientes secundários
  if (!receita.alvo_Ca_ppm || receita.alvo_Ca_ppm === 0) {
    avisos.push('Cálcio (Ca) não definido');
  }
  if (!receita.alvo_Mg_ppm || receita.alvo_Mg_ppm === 0) {
    avisos.push('Magnésio (Mg) não definido');
  }

  // Micronutrientes
  if (!receita.alvo_Fe_ppm || receita.alvo_Fe_ppm === 0) {
    avisos.push('Ferro (Fe) não definido');
  }

  // pH e EC
  if (!receita.pH_SolucaoAlvo || receita.pH_SolucaoAlvo === 0) {
    avisos.push('pH alvo não definido');
  }
  if (!receita.EC_Alvo_dS_m || receita.EC_Alvo_dS_m === 0) {
    avisos.push('EC alvo não definido');
  }

  return {
    completa: faltantes.length === 0,
    faltantes: faltantes,
    avisos: avisos
  };
}

// ============================================================================
// BUSINESS LOGIC — Comparações
// ============================================================================

/**
 * Compara duas receitas e retorna diferenças
 *
 * @param {string} receitaId1
 * @param {string} receitaId2
 * @returns {object} {receita1, receita2, diferencas}
 */
function compararReceitas_(receitaId1, receitaId2) {
  const receita1 = getReceitaById_(receitaId1);
  const receita2 = getReceitaById_(receitaId2);

  if (!receita1) {
    throw new Error('Receita 1 não encontrada: ' + receitaId1);
  }
  if (!receita2) {
    throw new Error('Receita 2 não encontrada: ' + receitaId2);
  }

  const diferencas = [];

  // Comparar nutrientes
  const nutrientes = [
    'alvo_P_ppm',
    'alvo_N_NO3_ppm',
    'alvo_N_NH4_ppm',
    'alvo_K_ppm',
    'alvo_Ca_ppm',
    'alvo_Mg_ppm',
    'alvo_Fe_ppm'
  ];

  nutrientes.forEach(function(campo) {
    const val1 = receita1[campo] || 0;
    const val2 = receita2[campo] || 0;
    const diff = val2 - val1;

    if (diff !== 0) {
      diferencas.push({
        campo: campo,
        receita1: val1,
        receita2: val2,
        diferenca: diff,
        percentual: (val1 > 0 ? ((diff / val1) * 100).toFixed(1) + '%' : 'N/A')
      });
    }
  });

  // Comparar pH
  if (receita1.pH_SolucaoAlvo !== receita2.pH_SolucaoAlvo) {
    diferencas.push({
      campo: 'pH_SolucaoAlvo',
      receita1: receita1.pH_SolucaoAlvo,
      receita2: receita2.pH_SolucaoAlvo,
      diferenca: (receita2.pH_SolucaoAlvo - receita1.pH_SolucaoAlvo).toFixed(2),
      percentual: 'N/A'
    });
  }

  // Comparar EC
  if (receita1.EC_Alvo_dS_m !== receita2.EC_Alvo_dS_m) {
    diferencas.push({
      campo: 'EC_Alvo_dS_m',
      receita1: receita1.EC_Alvo_dS_m,
      receita2: receita2.EC_Alvo_dS_m,
      diferenca: (receita2.EC_Alvo_dS_m - receita1.EC_Alvo_dS_m).toFixed(2),
      percentual: (receita1.EC_Alvo_dS_m > 0 ?
        (((receita2.EC_Alvo_dS_m - receita1.EC_Alvo_dS_m) / receita1.EC_Alvo_dS_m) * 100).toFixed(1) + '%' :
        'N/A')
    });
  }

  return {
    receita1: receita1,
    receita2: receita2,
    diferencas: diferencas
  };
}

// ============================================================================
// EXPORTAR
// ============================================================================

const RECEITA_SERVICE_LOADED = true;
