/**
 * COMPONENTE: 69_ReceitaFertirrigacaoRepository.gs
 * PAPEL: Repository pattern para entidade Receita de Fertirrigação
 *
 * RESPONSABILIDADE:
 * - Abstração de acesso à aba "Receitas_Fertirrigacao"
 * - CRUD operations específico para Receitas
 * - Queries avançadas (por fase, quelato exigido)
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

const RECEITAS_SHEET = 'Receitas_Fertirrigacao';

// ============================================================================
// CREATE
// ============================================================================

/**
 * Cria nova Receita de Fertirrigação
 *
 * @param {string} userId — ID do usuário que cria (para auditoria)
 * @param {object} data — dados da receita
 * @returns {object} Receita criada
 */
function createReceitaFertirrigacao_(userId, data) {
  const receita = {
    id: generateUUID_(),
    nomeFase: data.nomeFase,
    alvo_P_ppm: data.alvo_P_ppm || 0,
    alvo_N_NO3_ppm: data.alvo_N_NO3_ppm || 0,
    alvo_N_NH4_ppm: data.alvo_N_NH4_ppm || 0,
    alvo_K_ppm: data.alvo_K_ppm || 0,
    alvo_Ca_ppm: data.alvo_Ca_ppm || 0,
    alvo_Mg_ppm: data.alvo_Mg_ppm || 0,
    alvo_Fe_ppm: data.alvo_Fe_ppm || 0,
    quelatoExigido: data.quelatoExigido || '',
    pH_SolucaoAlvo: data.pH_SolucaoAlvo || 0,
    EC_Alvo_dS_m: data.EC_Alvo_dS_m || 0,
    ruleVersion: data.ruleVersion || '',
    createdAt: nowIso_(),
    updatedAt: nowIso_()
  };

  return createRecord_(RECEITAS_SHEET, receita, userId);
}

// ============================================================================
// READ
// ============================================================================

/**
 * Busca Receita por ID
 *
 * @param {string} id
 * @returns {object|null}
 */
function getReceitaById_(id) {
  return getRecordById_(RECEITAS_SHEET, id);
}

/**
 * Lista todas as Receitas (com filtros e paginação)
 *
 * @param {object} filters — {nomeFase, quelatoExigido}
 * @param {object} pagination — {page, pageSize, sortBy, sortOrder}
 * @returns {object} {items, pagination}
 */
function listReceitas_(filters, pagination) {
  filters = filters || {};

  return listRecords_(RECEITAS_SHEET, filters, pagination);
}

/**
 * Busca Receitas por padrão no nome da fase
 *
 * @param {string} pattern
 * @returns {array}
 */
function searchReceitasByFase_(pattern) {
  return searchRecordsByPattern_(RECEITAS_SHEET, 'nomeFase', pattern);
}

/**
 * Lista Receitas por fase de cultivo
 *
 * @param {string} fase - Fase de cultivo (PROPAGACAO, VEGETATIVA, FLORACAO)
 * @returns {array}
 */
function getReceitasByFase_(fase) {
  return searchRecords_(RECEITAS_SHEET, { nomeFase: fase });
}

/**
 * Lista Receitas por quelato exigido
 *
 * @param {string} quelato
 * @returns {array}
 */
function getReceitasByQuelato_(quelato) {
  return searchRecords_(RECEITAS_SHEET, { quelatoExigido: quelato });
}

/**
 * Lista Receitas com pH alvo em range específico
 *
 * @param {number} minPH
 * @param {number} maxPH
 * @returns {array}
 */
function getReceitasByPHRange_(minPH, maxPH) {
  const all = getAllRecords_(RECEITAS_SHEET);
  return all.filter(function(receita) {
    return receita.pH_SolucaoAlvo >= minPH && receita.pH_SolucaoAlvo <= maxPH;
  });
}

/**
 * Lista Receitas com EC alvo em range específico
 *
 * @param {number} minEC
 * @param {number} maxEC
 * @returns {array}
 */
function getReceitasByECRange_(minEC, maxEC) {
  const all = getAllRecords_(RECEITAS_SHEET);
  return all.filter(function(receita) {
    return receita.EC_Alvo_dS_m >= minEC && receita.EC_Alvo_dS_m <= maxEC;
  });
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Atualiza Receita
 *
 * @param {string} id
 * @param {object} updates
 * @param {string} userId — usuário que faz update (para auditoria)
 * @returns {object}
 */
function updateReceita_(id, updates, userId) {
  updates.updatedAt = nowIso_();

  return updateRecord_(RECEITAS_SHEET, id, updates);
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Deleta Receita (soft delete)
 *
 * @param {string} id
 * @returns {object}
 */
function deleteReceita_(id) {
  return deleteRecord_(RECEITAS_SHEET, id);
}

// ============================================================================
// AGGREGAÇÕES
// ============================================================================

/**
 * Retorna total de Receitas
 *
 * @returns {number}
 */
function getTotalReceitas_() {
  return countActiveRecords_(RECEITAS_SHEET);
}

/**
 * Retorna estatísticas de Receitas
 *
 * @returns {object}
 */
function getReceitaStats_() {
  const total = getTotalReceitas_();

  return {
    total: total,
    timestamp: nowIso_()
  };
}

// ============================================================================
// VALIDAÇÃO
// ============================================================================

/**
 * Verifica se Receita existe
 *
 * @param {string} id
 * @returns {boolean}
 */
function receitaExists_(id) {
  return getReceitaById_(id) !== null;
}

/**
 * Valida dados de Receita para criação/atualização
 *
 * @param {object} data
 * @returns {object} {valid, errors}
 */
function validateReceitaData_(data) {
  const errors = [];

  if (!data.nomeFase || data.nomeFase.trim().length < 1) {
    errors.push({ field: 'nomeFase', message: 'Nome da fase obrigatório' });
  }

  if (data.pH_SolucaoAlvo && (data.pH_SolucaoAlvo < 0 || data.pH_SolucaoAlvo > 14)) {
    errors.push({ field: 'pH_SolucaoAlvo', message: 'pH deve estar entre 0 e 14' });
  }

  if (data.EC_Alvo_dS_m && data.EC_Alvo_dS_m < 0) {
    errors.push({ field: 'EC_Alvo_dS_m', message: 'EC deve ser positivo' });
  }

  if (data.quelatoExigido && !Object.values(AGENTE_QUELANTE).includes(data.quelatoExigido)) {
    errors.push({ field: 'quelatoExigido', message: 'Quelato inválido' });
  }

  // Validar valores de nutrientes (devem ser >= 0)
  const nutrientes = ['alvo_P_ppm', 'alvo_N_NO3_ppm', 'alvo_N_NH4_ppm', 'alvo_K_ppm', 'alvo_Ca_ppm', 'alvo_Mg_ppm', 'alvo_Fe_ppm'];
  nutrientes.forEach(function(campo) {
    if (data[campo] !== undefined && data[campo] < 0) {
      errors.push({ field: campo, message: 'Valor deve ser >= 0' });
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// ============================================================================
// EXPORTAR
// ============================================================================

const RECEITA_FERTIRRIGACAO_REPOSITORY_LOADED = true;
