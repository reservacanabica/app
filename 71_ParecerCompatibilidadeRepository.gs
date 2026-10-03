/**
 * COMPONENTE: 71_ParecerCompatibilidadeRepository.gs
 * PAPEL: Repository pattern para entidade Parecer de Compatibilidade
 *
 * RESPONSABILIDADE:
 * - Abstração de acesso à aba "Pareceres_Compatibilidade"
 * - CRUD operations específico para Pareceres
 * - Queries avançadas (por veredicto, receita, protocolo)
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

const PARECERES_SHEET = 'Pareceres_Compatibilidade';

// ============================================================================
// CREATE
// ============================================================================

/**
 * Cria novo Parecer de Compatibilidade
 *
 * @param {string} userId — ID do usuário que cria (para auditoria)
 * @param {object} data — dados do parecer
 * @returns {object} Parecer criado
 */
function createParecerCompatibilidade_(userId, data) {
  const parecer = {
    id: generateUUID_(),
    receitaId: data.receitaId,
    protocoloId: data.protocoloId,
    loteIds: data.loteIds || '',
    veredicto: data.veredicto || VEREDICTO_COMPATIBILIDADE.REVISAO_HUMANA,
    alertas: data.alertas || '',
    bloqueios: data.bloqueios || '',
    regrasAcionadas: data.regrasAcionadas || '',
    evidencias: data.evidencias || '',
    usuarioEmail: data.usuarioEmail || '',
    createdAt: nowIso_(),
    updatedAt: nowIso_()
  };

  return createRecord_(PARECERES_SHEET, parecer, userId);
}

// ============================================================================
// READ
// ============================================================================

/**
 * Busca Parecer por ID
 *
 * @param {string} id
 * @returns {object|null}
 */
function getParecerById_(id) {
  return getRecordById_(PARECERES_SHEET, id);
}

/**
 * Lista todos os Pareceres (com filtros e paginação)
 *
 * @param {object} filters — {veredicto, receitaId, protocoloId}
 * @param {object} pagination — {page, pageSize, sortBy, sortOrder}
 * @returns {object} {items, pagination}
 */
function listPareceres_(filters, pagination) {
  filters = filters || {};

  return listRecords_(PARECERES_SHEET, filters, pagination);
}

/**
 * Lista Pareceres por Receita
 *
 * @param {string} receitaId
 * @returns {array}
 */
function getPareceresByReceita_(receitaId) {
  return searchRecords_(PARECERES_SHEET, { receitaId: receitaId });
}

/**
 * Lista Pareceres por Protocolo
 *
 * @param {string} protocoloId
 * @returns {array}
 */
function getPareceresByProtocolo_(protocoloId) {
  return searchRecords_(PARECERES_SHEET, { protocoloId: protocoloId });
}

/**
 * Lista Pareceres por veredicto
 *
 * @param {string} veredicto
 * @returns {array}
 */
function getPareceresByVeredicto_(veredicto) {
  return searchRecords_(PARECERES_SHEET, { veredicto: veredicto });
}

/**
 * Lista Pareceres INCOMPATÍVEIS
 *
 * @returns {array}
 */
function getPareceresIncompativeis_() {
  return getPareceresByVeredicto_(VEREDICTO_COMPATIBILIDADE.INCOMPATIVEL);
}

/**
 * Lista Pareceres que precisam de REVISÃO HUMANA
 *
 * @returns {array}
 */
function getPareceresParaRevisao_() {
  return getPareceresByVeredicto_(VEREDICTO_COMPATIBILIDADE.REVISAO_HUMANA);
}

/**
 * Lista Pareceres COMPATÍVEIS COM RESSALVAS
 *
 * @returns {array}
 */
function getPareceresComRessalvas_() {
  return getPareceresByVeredicto_(VEREDICTO_COMPATIBILIDADE.COMPATIVEL_COM_RESSALVAS);
}

/**
 * Busca Parecer específico por Receita + Protocolo (mais recente)
 *
 * @param {string} receitaId
 * @param {string} protocoloId
 * @returns {object|null}
 */
function getLatestParecerByReceitaProtocolo_(receitaId, protocoloId) {
  const all = searchRecords_(PARECERES_SHEET, {
    receitaId: receitaId,
    protocoloId: protocoloId
  });

  if (all.length === 0) {
    return null;
  }

  // Ordenar por createdAt DESC
  all.sort(function(a, b) {
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return all[0];
}

/**
 * Lista Pareceres por usuário solicitante
 *
 * @param {string} usuarioEmail
 * @returns {array}
 */
function getPareceresByUsuario_(usuarioEmail) {
  return searchRecords_(PARECERES_SHEET, { usuarioEmail: usuarioEmail });
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Atualiza Parecer
 *
 * @param {string} id
 * @param {object} updates
 * @param {string} userId — usuário que faz update (para auditoria)
 * @returns {object}
 */
function updateParecer_(id, updates, userId) {
  updates.updatedAt = nowIso_();

  return updateRecord_(PARECERES_SHEET, id, updates);
}

/**
 * Atualiza veredicto do Parecer
 *
 * @param {string} id
 * @param {string} newVeredicto
 * @param {string} userId
 * @returns {object}
 */
function updateParecerVeredicto_(id, newVeredicto, userId) {
  return updateParecer_(id, { veredicto: newVeredicto }, userId);
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Deleta Parecer (soft delete)
 *
 * @param {string} id
 * @returns {object}
 */
function deleteParecer_(id) {
  return deleteRecord_(PARECERES_SHEET, id);
}

// ============================================================================
// AGGREGAÇÕES
// ============================================================================

/**
 * Conta Pareceres por veredicto
 *
 * @returns {object}
 */
function getParecerCountByVeredicto_() {
  return countRecordsByStatus_(PARECERES_SHEET, 'veredicto');
}

/**
 * Retorna total de Pareceres
 *
 * @returns {number}
 */
function getTotalPareceres_() {
  return countActiveRecords_(PARECERES_SHEET);
}

/**
 * Retorna estatísticas de Pareceres
 *
 * @returns {object}
 */
function getParecerStats_() {
  const byVeredicto = getParecerCountByVeredicto_();
  const total = getTotalPareceres_();

  return {
    total: total,
    byVeredicto: byVeredicto,
    timestamp: nowIso_()
  };
}

// ============================================================================
// VALIDAÇÃO
// ============================================================================

/**
 * Verifica se Parecer existe
 *
 * @param {string} id
 * @returns {boolean}
 */
function parecerExists_(id) {
  return getParecerById_(id) !== null;
}

/**
 * Valida dados de Parecer para criação/atualização
 *
 * @param {object} data
 * @returns {object} {valid, errors}
 */
function validateParecerData_(data) {
  const errors = [];

  if (!data.receitaId || !receitaExists_(data.receitaId)) {
    errors.push({ field: 'receitaId', message: 'Receita não encontrada' });
  }

  if (!data.protocoloId || !protocoloExists_(data.protocoloId)) {
    errors.push({ field: 'protocoloId', message: 'Protocolo não encontrado' });
  }

  if (data.veredicto && !Object.values(VEREDICTO_COMPATIBILIDADE).includes(data.veredicto)) {
    errors.push({ field: 'veredicto', message: 'Veredicto inválido' });
  }

  // Validar loteIds se fornecido (deve ser JSON array válido ou string vazia)
  if (data.loteIds && data.loteIds !== '') {
    try {
      const loteArray = JSON.parse(data.loteIds);
      if (!Array.isArray(loteArray)) {
        errors.push({ field: 'loteIds', message: 'loteIds deve ser array JSON' });
      }
    } catch (e) {
      errors.push({ field: 'loteIds', message: 'loteIds inválido (não é JSON)' });
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// ============================================================================
// BUSINESS LOGIC — Análise de Compatibilidade
// ============================================================================

/**
 * Analisa compatibilidade entre Receita, Protocolo e Lotes
 * REGRA DE NEGÓCIO SIMPLIFICADA (para expansão futura)
 *
 * @param {string} receitaId
 * @param {string} protocoloId
 * @param {array} loteIds — array de IDs de lotes
 * @param {string} usuarioEmail
 * @returns {object} Parecer criado
 */
function analisarCompatibilidade_(receitaId, protocoloId, loteIds, usuarioEmail, userId) {
  const receita = getReceitaById_(receitaId);
  const protocolo = getProtocoloById_(protocoloId);

  if (!receita || !protocolo) {
    throw new Error('Receita ou Protocolo não encontrado');
  }

  const alertas = [];
  const bloqueios = [];
  const regrasAcionadas = [];
  let veredicto = VEREDICTO_COMPATIBILIDADE.COMPATIVEL;

  // REGRA 1: Verificar compatibilidade de pH
  if (receita.pH_SolucaoAlvo < protocolo.pHMinimo || receita.pH_SolucaoAlvo > protocolo.pHMaximo) {
    bloqueios.push('pH da receita fora do range do protocolo');
    regrasAcionadas.push('REGRA_PH_RANGE');
    veredicto = VEREDICTO_COMPATIBILIDADE.INCOMPATIVEL;
  }

  // REGRA 2: Verificar compatibilidade de EC
  if (receita.EC_Alvo_dS_m > protocolo.ecMaximo_dS_m && protocolo.ecMaximo_dS_m > 0) {
    bloqueios.push('EC da receita excede o máximo do protocolo');
    regrasAcionadas.push('REGRA_EC_MAXIMO');
    veredicto = VEREDICTO_COMPATIBILIDADE.INCOMPATIVEL;
  }

  // REGRA 3: Verificar quelato (se aplicável)
  if (receita.quelatoExigido && protocolo.incompatibilidades.indexOf(receita.quelatoExigido) > -1) {
    bloqueios.push('Quelato da receita incompatível com protocolo');
    regrasAcionadas.push('REGRA_QUELATO_INCOMPATIVEL');
    veredicto = VEREDICTO_COMPATIBILIDADE.INCOMPATIVEL;
  }

  // REGRA 4: Verificar lotes (status de liberação)
  if (loteIds && loteIds.length > 0) {
    loteIds.forEach(function(loteId) {
      const lote = getLoteCoAById_(loteId);
      if (lote) {
        if (lote.statusLiberacao !== COA_STATUS_LIBERACAO.LIBERADO) {
          alertas.push('Lote ' + lote.numeroLote + ' não está LIBERADO');
          regrasAcionadas.push('REGRA_LOTE_NAO_LIBERADO');
          if (veredicto === VEREDICTO_COMPATIBILIDADE.COMPATIVEL) {
            veredicto = VEREDICTO_COMPATIBILIDADE.COMPATIVEL_COM_RESSALVAS;
          }
        }
      }
    });
  }

  // Se nenhum bloqueio/alerta, mas há observações no protocolo
  if (bloqueios.length === 0 && alertas.length === 0 && protocolo.observacoes) {
    alertas.push('Verificar observações do protocolo: ' + protocolo.observacoes);
  }

  const parecerData = {
    receitaId: receitaId,
    protocoloId: protocoloId,
    loteIds: JSON.stringify(loteIds || []),
    veredicto: veredicto,
    alertas: alertas.join('; '),
    bloqueios: bloqueios.join('; '),
    regrasAcionadas: regrasAcionadas.join(', '),
    evidencias: 'Análise automática baseada em pH, EC, quelato e status de lotes',
    usuarioEmail: usuarioEmail
  };

  return createParecerCompatibilidade_(userId, parecerData);
}

// ============================================================================
// EXPORTAR
// ============================================================================

const PARECER_COMPATIBILIDADE_REPOSITORY_LOADED = true;
