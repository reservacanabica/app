/**
 * COMPONENTE: 70_ProtocoloBiologicoRepository.gs
 * PAPEL: Repository pattern para entidade Protocolo Biológico
 *
 * RESPONSABILIDADE:
 * - Abstração de acesso à aba "Protocolos_Biologicos"
 * - CRUD operations específico para Protocolos
 * - Queries avançadas (por fase cultivo, tipo aplicação, status)
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

const PROTOCOLOS_SHEET = 'Protocolos_Biologicos';

// ============================================================================
// CREATE
// ============================================================================

/**
 * Cria novo Protocolo Biológico
 *
 * @param {string} userId — ID do usuário que cria (para auditoria)
 * @param {object} data — dados do protocolo
 * @returns {object} Protocolo criado
 */
function createProtocoloBiologico_(userId, data) {
  const protocolo = {
    id: generateUUID_(),
    nomeProtocolo: data.nomeProtocolo,
    faseCultivo: data.faseCultivo || '',
    tipoAplicacao: data.tipoAplicacao || '',
    ecMaximo_dS_m: data.ecMaximo_dS_m || 0,
    pHMinimo: data.pHMinimo || 0,
    pHMaximo: data.pHMaximo || 14,
    incompatibilidades: data.incompatibilidades || '',
    observacoes: data.observacoes || '',
    ativo: data.ativo || INPUT_STATUS.ATIVO,
    createdAt: nowIso_(),
    updatedAt: nowIso_()
  };

  return createRecord_(PROTOCOLOS_SHEET, protocolo, userId);
}

// ============================================================================
// READ
// ============================================================================

/**
 * Busca Protocolo por ID
 *
 * @param {string} id
 * @returns {object|null}
 */
function getProtocoloById_(id) {
  return getRecordById_(PROTOCOLOS_SHEET, id);
}

/**
 * Lista todos os Protocolos (com filtros e paginação)
 *
 * @param {object} filters — {ativo, faseCultivo, tipoAplicacao}
 * @param {object} pagination — {page, pageSize, sortBy, sortOrder}
 * @returns {object} {items, pagination}
 */
function listProtocolos_(filters, pagination) {
  filters = filters || {};

  // Padrão: listar apenas ATIVO
  if (!filters.ativo) {
    filters.ativo = INPUT_STATUS.ATIVO;
  }

  return listRecords_(PROTOCOLOS_SHEET, filters, pagination);
}

/**
 * Lista Protocolos por fase de cultivo
 *
 * @param {string} fase
 * @returns {array}
 */
function getProtocolosByFase_(fase) {
  return searchRecords_(PROTOCOLOS_SHEET, { faseCultivo: fase });
}

/**
 * Lista Protocolos por tipo de aplicação
 *
 * @param {string} tipo
 * @returns {array}
 */
function getProtocolosByTipoAplicacao_(tipo) {
  return searchRecords_(PROTOCOLOS_SHEET, { tipoAplicacao: tipo });
}

/**
 * Lista Protocolos por organismo alvo
 *
 * @param {string} organismoAlvo
 * @returns {array}
 */
function getProtocolosByOrganismoAlvo_(organismoAlvo) {
  return searchRecords_(PROTOCOLOS_SHEET, { organismo_alvo: organismoAlvo });
}

/**
 * Busca Protocolos por padrão no nome
 *
 * @param {string} pattern
 * @returns {array}
 */
function searchProtocolosByNome_(pattern) {
  return searchRecordsByPattern_(PROTOCOLOS_SHEET, 'nomeProtocolo', pattern);
}

/**
 * Lista Protocolos compatíveis com range de EC
 *
 * @param {number} ec — EC da solução
 * @returns {array}
 */
function getProtocolosCompatiblesWithEC_(ec) {
  const all = getAllRecords_(PROTOCOLOS_SHEET);
  return all.filter(function(protocolo) {
    return protocolo.ativo === INPUT_STATUS.ATIVO && 
           (protocolo.ecMaximo_dS_m === 0 || ec <= protocolo.ecMaximo_dS_m);
  });
}

/**
 * Lista Protocolos compatíveis com range de pH
 *
 * @param {number} ph — pH da solução
 * @returns {array}
 */
function getProtocolosCompatiblesWithPH_(ph) {
  const all = getAllRecords_(PROTOCOLOS_SHEET);
  return all.filter(function(protocolo) {
    return protocolo.ativo === INPUT_STATUS.ATIVO && 
           ph >= protocolo.pHMinimo && 
           ph <= protocolo.pHMaximo;
  });
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Atualiza Protocolo
 *
 * @param {string} id
 * @param {object} updates
 * @param {string} userId — usuário que faz update (para auditoria)
 * @returns {object}
 */
function updateProtocolo_(id, updates, userId) {
  updates.updatedAt = nowIso_();

  return updateRecord_(PROTOCOLOS_SHEET, id, updates);
}

/**
 * Atualiza status do Protocolo (ATIVO/INATIVO)
 *
 * @param {string} id
 * @param {string} newStatus
 * @param {string} userId
 * @returns {object}
 */
function updateProtocoloStatus_(id, newStatus, userId) {
  return updateProtocolo_(id, { ativo: newStatus }, userId);
}

// ============================================================================
// DELETE
// ============================================================================

/**
 * Deleta Protocolo (soft delete — marca como INATIVO)
 *
 * @param {string} id
 * @returns {object}
 */
function deleteProtocolo_(id) {
  return updateRecord_(PROTOCOLOS_SHEET, id, {
    ativo: INPUT_STATUS.INATIVO,
    updatedAt: nowIso_()
  });
}

// ============================================================================
// AGGREGAÇÕES
// ============================================================================

/**
 * Conta Protocolos por status
 *
 * @returns {object}
 */
function getProtocoloCountByStatus_() {
  return countRecordsByStatus_(PROTOCOLOS_SHEET, 'ativo');
}

/**
 * Retorna total de Protocolos ativos
 *
 * @returns {number}
 */
function getTotalProtocolos_() {
  return countActiveRecords_(PROTOCOLOS_SHEET);
}

/**
 * Retorna estatísticas de Protocolos
 *
 * @returns {object}
 */
function getProtocoloStats_() {
  const byStatus = getProtocoloCountByStatus_();
  const total = getTotalProtocolos_();

  return {
    total: total,
    byStatus: byStatus,
    timestamp: nowIso_()
  };
}

// ============================================================================
// VALIDAÇÃO
// ============================================================================

/**
 * Verifica se Protocolo existe
 *
 * @param {string} id
 * @returns {boolean}
 */
function protocoloExists_(id) {
  return getProtocoloById_(id) !== null;
}

/**
 * Valida dados de Protocolo para criação/atualização
 *
 * @param {object} data
 * @returns {object} {valid, errors}
 */
function validateProtocoloData_(data) {
  const errors = [];

  if (!data.nomeProtocolo || data.nomeProtocolo.trim().length < 1) {
    errors.push({ field: 'nomeProtocolo', message: 'Nome do protocolo obrigatório' });
  }

  if (data.faseCultivo && !Object.values(FASE_CULTIVO).includes(data.faseCultivo)) {
    errors.push({ field: 'faseCultivo', message: 'Fase de cultivo inválida' });
  }

  if (data.tipoAplicacao && !Object.values(TIPO_APLICACAO).includes(data.tipoAplicacao)) {
    errors.push({ field: 'tipoAplicacao', message: 'Tipo de aplicação inválido' });
  }

  if (data.ecMaximo_dS_m && data.ecMaximo_dS_m < 0) {
    errors.push({ field: 'ecMaximo_dS_m', message: 'EC máximo deve ser >= 0' });
  }

  if (data.pHMinimo && (data.pHMinimo < 0 || data.pHMinimo > 14)) {
    errors.push({ field: 'pHMinimo', message: 'pH mínimo deve estar entre 0 e 14' });
  }

  if (data.pHMaximo && (data.pHMaximo < 0 || data.pHMaximo > 14)) {
    errors.push({ field: 'pHMaximo', message: 'pH máximo deve estar entre 0 e 14' });
  }

  if (data.pHMinimo && data.pHMaximo && data.pHMinimo > data.pHMaximo) {
    errors.push({ field: 'pHRange', message: 'pH mínimo não pode ser maior que pH máximo' });
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// ============================================================================
// EXPORTAR
// ============================================================================

const PROTOCOLO_BIOLOGICO_REPOSITORY_LOADED = true;
