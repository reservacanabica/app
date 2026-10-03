/**
 * COMPONENTE: 29_LoteService.gs
 * PAPEL: Business logic para Lotes CoA
 *
 * RESPONSABILIDADE:
 * - Workflows de aprovação/reprovação
 * - Análise de metais pesados
 * - Alertas de validade
 * - Cálculo de quality score
 *
 * INTEGRAÇÕES:
 * - LoteCoARepository (acesso a dados)
 * - InsumoRepository (dados do insumo relacionado)
 *
 * STATUS: v2.1 — Implementado (PROMPT 3)
 */

// ============================================================================
// BUSINESS LOGIC — Workflows
// ============================================================================

/**
 * Workflow de aprovação completo de lote
 * Transição: PENDENTE → APROVADO → LIBERADO
 *
 * @param {string} loteId
 * @param {string} auditorEmail
 * @param {string} userId — ID do usuário que executa
 * @returns {object} Lote atualizado
 */
function aprovarLoteWorkflow_(loteId, auditorEmail, userId) {
  const lote = getLoteCoAById_(loteId);
  if (!lote) {
    throw new Error('Lote não encontrado: ' + loteId);
  }

  // Validar transições permitidas
  if (lote.statusAuditoria !== COA_STATUS_AUDITORIA.PENDENTE) {
    throw new Error('Lote não está PENDENTE. Status atual: ' + lote.statusAuditoria);
  }

  // Passo 1: Atualizar status de auditoria para APROVADO
  const aprovado = updateLoteStatusAuditoria_(
    loteId,
    COA_STATUS_AUDITORIA.APROVADO,
    userId,
    auditorEmail
  );

  // Passo 2: Atualizar status de liberação para LIBERADO
  const liberado = updateLoteStatusLiberacao_(
    loteId,
    COA_STATUS_LIBERACAO.LIBERADO,
    userId
  );

  logInfo_('Lote aprovado e liberado', {
    loteId: loteId,
    numeroLote: lote.numeroLote,
    auditorEmail: auditorEmail,
    userId: userId
  });

  return liberado;
}

/**
 * Workflow de reprovação completo de lote
 * Transição: PENDENTE → REPROVADO → BLOQUEADO
 *
 * @param {string} loteId
 * @param {string} motivo
 * @param {string} auditorEmail
 * @param {string} userId
 * @returns {object} Lote atualizado
 */
function reprovarLoteWorkflow_(loteId, motivo, auditorEmail, userId) {
  const lote = getLoteCoAById_(loteId);
  if (!lote) {
    throw new Error('Lote não encontrado: ' + loteId);
  }

  // Validar transições permitidas
  if (lote.statusAuditoria !== COA_STATUS_AUDITORIA.PENDENTE) {
    throw new Error('Lote não está PENDENTE. Status atual: ' + lote.statusAuditoria);
  }

  // Passo 1: Atualizar status de auditoria para REPROVADO
  const reprovado = updateLoteStatusAuditoria_(
    loteId,
    COA_STATUS_AUDITORIA.REPROVADO,
    userId,
    auditorEmail
  );

  // Passo 2: Atualizar status de liberação para BLOQUEADO
  const bloqueado = updateLoteStatusLiberacao_(
    loteId,
    COA_STATUS_LIBERACAO.BLOQUEADO,
    userId
  );

  // Passo 3: Registrar motivo no campo de observações (via update genérico)
  updateLoteCoA_(loteId, {
    sourceVersion: 'REPROVADO: ' + motivo
  }, userId);

  logWarn_('Lote reprovado e bloqueado', {
    loteId: loteId,
    numeroLote: lote.numeroLote,
    motivo: motivo,
    auditorEmail: auditorEmail,
    userId: userId
  });

  return bloqueado;
}

// ============================================================================
// BUSINESS LOGIC — Análise de Metais Pesados
// ============================================================================

/**
 * Analisa teores de metais pesados do lote
 * Limites baseados em IN 27/2006 MAPA (fertilizantes orgânicos)
 *
 * Limites (mg/kg = ppm):
 * - Pb (Chumbo): 150 ppm
 * - Cd (Cádmio): 3 ppm
 * - As (Arsênio): 20 ppm
 * - Hg (Mercúrio): 1 ppm
 *
 * @param {object} lote
 * @returns {object} {safe, alertas, bloqueios}
 */
function analisarMetaisPesados_(lote) {
  const alertas = [];
  const bloqueios = [];

  // Limites MAPA IN 27/2006
  const limites = {
    Pb: 150,  // Chumbo
    Cd: 3,    // Cádmio
    As: 20,   // Arsênio
    Hg: 1     // Mercúrio
  };

  // Analisar Pb (Chumbo)
  if (lote.teor_Pb_ppm) {
    const valorPb = parseFloat(lote.teor_Pb_ppm);
    if (!isNaN(valorPb)) {
      if (valorPb > limites.Pb) {
        bloqueios.push('Pb (Chumbo) acima do limite: ' + valorPb + ' ppm > ' + limites.Pb + ' ppm');
      } else if (valorPb > limites.Pb * 0.8) {
        alertas.push('Pb (Chumbo) próximo ao limite: ' + valorPb + ' ppm (limite: ' + limites.Pb + ' ppm)');
      }
    }
  }

  // Analisar Cd (Cádmio)
  if (lote.teor_Cd_ppm) {
    const valorCd = parseFloat(lote.teor_Cd_ppm);
    if (!isNaN(valorCd)) {
      if (valorCd > limites.Cd) {
        bloqueios.push('Cd (Cádmio) acima do limite: ' + valorCd + ' ppm > ' + limites.Cd + ' ppm');
      } else if (valorCd > limites.Cd * 0.8) {
        alertas.push('Cd (Cádmio) próximo ao limite: ' + valorCd + ' ppm (limite: ' + limites.Cd + ' ppm)');
      }
    }
  }

  // Analisar As (Arsênio)
  if (lote.teor_As_ppm) {
    const valorAs = parseFloat(lote.teor_As_ppm);
    if (!isNaN(valorAs)) {
      if (valorAs > limites.As) {
        bloqueios.push('As (Arsênio) acima do limite: ' + valorAs + ' ppm > ' + limites.As + ' ppm');
      } else if (valorAs > limites.As * 0.8) {
        alertas.push('As (Arsênio) próximo ao limite: ' + valorAs + ' ppm (limite: ' + limites.As + ' ppm)');
      }
    }
  }

  // Analisar Hg (Mercúrio)
  if (lote.teor_Hg_ppm) {
    const valorHg = parseFloat(lote.teor_Hg_ppm);
    if (!isNaN(valorHg)) {
      if (valorHg > limites.Hg) {
        bloqueios.push('Hg (Mercúrio) acima do limite: ' + valorHg + ' ppm > ' + limites.Hg + ' ppm');
      } else if (valorHg > limites.Hg * 0.8) {
        alertas.push('Hg (Mercúrio) próximo ao limite: ' + valorHg + ' ppm (limite: ' + limites.Hg + ' ppm)');
      }
    }
  }

  return {
    safe: bloqueios.length === 0,
    alertas: alertas,
    bloqueios: bloqueios
  };
}

// ============================================================================
// BUSINESS LOGIC — Validade
// ============================================================================

/**
 * Busca lotes próximos ao vencimento
 *
 * @param {number} diasAlerta — Quantos dias antes de vencer (padrão: 30)
 * @returns {array} Array de lotes próximos ao vencimento
 */
function getLotesProximosVencimento_(diasAlerta) {
  diasAlerta = diasAlerta || 30;

  const todos = getAllRecords_('Lotes_CoA');
  const agora = new Date();
  const limiteAlerta = new Date();
  limiteAlerta.setDate(limiteAlerta.getDate() + diasAlerta);

  const proximos = [];

  todos.forEach(function(lote) {
    if (lote.dataValidade && lote.statusLiberacao === COA_STATUS_LIBERACAO.LIBERADO) {
      const dataValidade = new Date(lote.dataValidade);
      
      // Lote vence entre agora e limiteAlerta
      if (dataValidade > agora && dataValidade <= limiteAlerta) {
        const diasRestantes = Math.ceil((dataValidade - agora) / (1000 * 60 * 60 * 24));
        proximos.push({
          lote: lote,
          diasRestantes: diasRestantes,
          dataValidade: lote.dataValidade
        });
      }
    }
  });

  // Ordenar por dias restantes (ascendente)
  proximos.sort(function(a, b) {
    return a.diasRestantes - b.diasRestantes;
  });

  return proximos;
}

// ============================================================================
// BUSINESS LOGIC — Quality Score
// ============================================================================

/**
 * Calcula quality score do lote (0-100)
 * Baseado em: metais pesados, status auditoria, validade
 *
 * @param {object} lote
 * @returns {number} Score 0-100
 */
function calcularQualityScore_(lote) {
  let score = 100;

  // Análise de metais pesados (0-60 pontos de desconto)
  const metais = analisarMetaisPesados_(lote);
  
  // Bloqueios: -20 pontos cada
  score -= metais.bloqueios.length * 20;
  
  // Alertas: -5 pontos cada
  score -= metais.alertas.length * 5;

  // Status de auditoria (0-20 pontos de desconto)
  if (lote.statusAuditoria === COA_STATUS_AUDITORIA.REPROVADO) {
    score -= 50; // Penalidade severa
  } else if (lote.statusAuditoria === COA_STATUS_AUDITORIA.ALERTA) {
    score -= 10;
  } else if (lote.statusAuditoria === COA_STATUS_AUDITORIA.PENDENTE) {
    score -= 5;
  }

  // Validade (0-10 pontos de desconto)
  if (lote.dataValidade) {
    const agora = new Date();
    const validade = new Date(lote.dataValidade);
    const diasRestantes = Math.ceil((validade - agora) / (1000 * 60 * 60 * 24));
    
    if (diasRestantes < 0) {
      score -= 50; // Vencido: penalidade severa
    } else if (diasRestantes < 30) {
      score -= 10; // Vence em menos de 30 dias
    } else if (diasRestantes < 90) {
      score -= 5; // Vence em menos de 90 dias
    }
  }

  // Garantir que score está entre 0 e 100
  if (score < 0) score = 0;
  if (score > 100) score = 100;

  return Math.round(score);
}

// ============================================================================
// EXPORTAR
// ============================================================================

const LOTE_SERVICE_LOADED = true;
