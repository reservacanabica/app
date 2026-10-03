/**
 * COMPONENTE: 23_CrudService.gs
 * PAPEL: Serviço CRUD genérico (base para entidades)
 *
 * RESPONSABILIDADE:
 * - Operações CRUD padronizadas (Create, Read, Update, Delete)
 * - Paginação e filtros genéricos
 * - Suporte a soft delete (status=ARCHIVED)
 * - Validação e auditoria integrada
 *
 * INTEGRAÇÕES:
 * - Gateway (leitura/escrita em Sheets)
 * - ValidationService (validação de campos)
 * - AuditService (registro de eventos)
 * - PermissionService (verificação de acesso)
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// CREATE
// ============================================================================

/**
 * Cria novo registro genérico em qualquer sheet com validação e metadados automáticos
 * 
 * Adiciona automaticamente: ID único (UUID), timestamps (createdAt, updatedAt), status (DRAFT),
 * e ownerId se fornecido. Converte objeto para linha respeitando schema da sheet.
 *
 * @param {string} sheetName - Nome da aba (ex: "Studies", "Users", "Experiments")
 * @param {object} data - Dados do registro a criar (campos conforme schema da sheet)
 * @param {string} [ownerId] - ID do proprietário do registro (para controle de acesso e soft delete)
 * @returns {object} Registro criado com todos os metadados adicionados
 * @throws {Error} VALIDATION_ERROR se sheet não existir, INTERNAL_ERROR se append falhar
 * @example
 * const study = createRecord_('Studies', {title: 'My Study', hostSpecies: 'Cannabis'}, 'usr_123');
 * console.log('Created:', study.id);
 */
function createRecord_(sheetName, data, ownerId) {
  try {
    // Validar parâmetros
    if (!sheetName || typeof sheetName !== 'string') {
      throwError_('VALIDATION_ERROR', 'sheetName inválido', {});
    }
    
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throwError_('VALIDATION_ERROR', 'data deve ser um objeto', {});
    }
    
    // Validar sheet existe
    if (!sheetExists_(sheetName)) {
      throwError_('VALIDATION_ERROR', 'Sheet não encontrado: ' + sheetName, {});
    }

    // Gerar ID único
    data.id = data.id || generateUUID_();

    // Adicionar metadados
    data.createdAt = nowIso_();
    data.updatedAt = nowIso_();
    data.status = data.status || APP_STATUS.DRAFT;
    if (ownerId) {
      data.ownerId = ownerId;
    }

    // Append na sheet (appendRow_ já converte objeto → array de valores)
    appendRowToSheet_(sheetName, data);

    logDebug_('Registro criado', {
      sheetName: sheetName,
      id: data.id,
      ownerId: ownerId
    });

    return data;

  } catch (error) {
    logException_('Erro ao criar registro', error, {
      sheetName: sheetName
    });
    throwError_('INTERNAL_ERROR', 'Erro ao criar registro: ' + error.message, {});
  }
}

// ============================================================================
// READ
// ============================================================================

/**
 * Busca registro por ID
 *
 * @param {string} sheetName
 * @param {string} id
 * @returns {object|null}
 */
function getRecordById_(sheetName, id) {
  try {
    if (!sheetExists_(sheetName)) {
      logWarn_('Sheet não existe em getRecordById_', { sheetName: sheetName });
      return null;
    }

    const records = getAllRecords_(sheetName);

    for (let i = 0; i < records.length; i++) {
      if (records[i].id === id && records[i].status !== APP_STATUS.ARCHIVED) {
        return records[i];
      }
    }

    return null;

  } catch (error) {
    logException_('Erro ao buscar registro', error, {
      sheetName: sheetName,
      id: id
    });
    // IMPORTANTE: Propagar erro em vez de retornar null
    // Retornar null mascara falhas de I/O como "registro não encontrado"
    throw error;
  }
}

/**
 * Lista registros com filtros e paginação
 *
 * @param {string} sheetName
 * @param {object} filters — {status, ownerId, ...}
 * @param {object} pagination — {page, pageSize, sortBy, sortOrder}
 * @returns {object} {items, pagination: {page, pageSize, total, totalPages}}
 */
function listRecords_(sheetName, filters, pagination) {
  try {
    if (!sheetExists_(sheetName)) {
      logWarn_('Sheet não existe em listRecords_', { sheetName: sheetName });
      return { items: [], pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 } };
    }

    let records = getAllRecords_(sheetName);

    // 1. FILTROS
    if (filters && typeof filters === 'object') {
      Object.keys(filters).forEach(function(key) {
        records = records.filter(function(record) {
          return record[key] === filters[key];
        });
      });
    }

    // 2. EXCLUIR ARQUIVADOS (por padrão)
    records = records.filter(function(record) {
      return record.status !== APP_STATUS.ARCHIVED;
    });

    // 3. ORDENAÇÃO
    pagination = pagination || { page: 1, pageSize: 20, sortBy: 'createdAt', sortOrder: 'desc' };
    const sortBy = pagination.sortBy || 'createdAt';
    const sortOrder = pagination.sortOrder || 'desc';

    records.sort(function(a, b) {
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';

      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // 4. PAGINAÇÃO
    const page = Math.max(1, pagination.page || 1);
    const pageSize = Math.min(100, Math.max(1, pagination.pageSize || 20));
    const total = records.length;
    const totalPages = Math.ceil(total / pageSize);

    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const items = records.slice(start, end);

    return {
      items: items,
      pagination: {
        page: page,
        pageSize: pageSize,
        total: total,
        totalPages: totalPages
      }
    };

  } catch (error) {
    logException_('Erro ao listar registros', error, {
      sheetName: sheetName
    });
    // IMPORTANTE: Propagar erro em vez de retornar lista vazia
    // Lista vazia mascara falhas de I/O como "sem resultados"
    throw error;
  }
}

// ============================================================================
// UPDATE
// ============================================================================

/**
 * Atualiza registro
 *
 * @param {string} sheetName
 * @param {string} id
 * @param {object} updates — campos a atualizar
 * @returns {object} registro atualizado
 */
function updateRecord_(sheetName, id, updates) {
  try {
    if (!sheetExists_(sheetName)) {
      throwError_('VALIDATION_ERROR', 'Sheet não encontrado: ' + sheetName, {});
    }

    // Buscar registro existente
    const record = getRecordById_(sheetName, id);
    if (!record) {
      throwError_('NOT_FOUND', 'Registro não encontrado: ' + id, {});
    }

    // Merge updates
    const updated = merge_(record, updates);
    updated.updatedAt = nowIso_();

    // Atualizar usando updateRowById_ do gateway
    const success = updateRowById_(sheetName, id, updated);
    
    if (!success) {
      throwError_('INTERNAL_ERROR', 'Falha ao atualizar registro no sheet', {});
    }

    logDebug_('Registro atualizado', {
      sheetName: sheetName,
      id: id,
      fields: Object.keys(updates)
    });

    return updated;

  } catch (error) {
    logException_('Erro ao atualizar registro', error, {
      sheetName: sheetName,
      id: id
    });
    throw error;
  }
}

// ============================================================================
// DELETE (Soft Delete)
// ============================================================================

/**
 * Deleta registro (soft delete)
 *
 * @param {string} sheetName
 * @param {string} id
 * @returns {object} registro "deletado"
 */
function deleteRecord_(sheetName, id) {
  try {
    // Soft delete: marcar como ARCHIVED
    const updated = updateRecord_(sheetName, id, {
      status: APP_STATUS.ARCHIVED,
      archivedAt: nowIso_()
    });

    auditDelete_(sheetName, id, {
      reason: 'Soft delete'
    });

    logDebug_('Registro deletado (soft)', {
      sheetName: sheetName,
      id: id
    });

    return updated;

  } catch (error) {
    logException_('Erro ao deletar registro', error, {
      sheetName: sheetName,
      id: id
    });
    throw error;
  }
}

/**
 * Deleta registro permanentemente (hard delete)
 * CUIDADO: Operação irreversível
 *
 * @param {string} sheetName
 * @param {string} id
 */
function deleteRecordPermanent_(sheetName, id) {
  try {
    if (!sheetExists_(sheetName)) {
      throwError_('VALIDATION_ERROR', 'Sheet não encontrado', {});
    }

    const record = getRecordById_(sheetName, id);
    if (!record) {
      throwError_('NOT_FOUND', 'Registro não encontrado', {});
    }

    // Deletar linha usando deleteRowById_ do gateway
    const success = deleteRowById_(sheetName, id);
    
    if (!success) {
      throwError_('INTERNAL_ERROR', 'Falha ao deletar registro do sheet', {});
    }

    auditDelete_(sheetName, id, {
      reason: 'Hard delete permanente',
      severity: 'HIGH'
    });

    logWarn_('Registro deletado permanentemente', {
      sheetName: sheetName,
      id: id
    });

  } catch (error) {
    logException_('Erro ao deletar permanentemente', error);
    throw error;
  }
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Cria múltiplos registros
 *
 * @param {string} sheetName
 * @param {array} records — array de dados
 * @param {string} ownerId
 * @returns {array} registros criados
 */
function createRecordsBulk_(sheetName, records, ownerId) {
  try {
    const results = [];

    for (let i = 0; i < records.length; i++) {
      try {
        const created = createRecord_(sheetName, records[i], ownerId);
        results.push(created);
      } catch (error) {
        logWarn_('Erro ao criar registro em bulk', {
          index: i,
          error: error.message
        });
        // Continuar com próximos
      }
    }

    logInfo_('Bulk create completo', {
      sheetName: sheetName,
      total: records.length,
      success: results.length,
      failed: records.length - results.length
    });

    return results;

  } catch (error) {
    logException_('Erro em bulk create', error);
    throw error;
  }
}

/**
 * Atualiza múltiplos registros
 *
 * @param {string} sheetName
 * @param {array} updates — {id, fields}
 * @returns {array}
 */
function updateRecordsBulk_(sheetName, updates) {
  try {
    const results = [];

    for (let i = 0; i < updates.length; i++) {
      try {
        const updated = updateRecord_(sheetName, updates[i].id, updates[i].fields);
        results.push(updated);
      } catch (error) {
        logWarn_('Erro ao atualizar em bulk', {
          index: i,
          id: updates[i].id,
          error: error.message
        });
      }
    }

    return results;

  } catch (error) {
    logException_('Erro em bulk update', error);
    throw error;
  }
}

// ============================================================================
// BUSCA AVANÇADA
// ============================================================================

/**
 * Busca registros por múltiplos critérios
 *
 * @param {string} sheetName
 * @param {object} criteria — {field: value, ...}
 * @returns {array}
 */
function searchRecords_(sheetName, criteria) {
  try {
    if (!sheetExists_(sheetName)) {
      logWarn_('Sheet não existe em searchRecords_', { sheetName: sheetName });
      return [];
    }

    let records = getAllRecords_(sheetName);

    // Aplicar critérios
    Object.keys(criteria).forEach(function(key) {
      records = records.filter(function(record) {
        return record[key] === criteria[key];
      });
    });

    // Excluir arquivados
    records = records.filter(function(record) {
      return record.status !== APP_STATUS.ARCHIVED;
    });

    return records;

  } catch (error) {
    logException_('Erro em search', error);
    throw error;
  }
}

/**
 * Busca registros com padrão (string matching)
 *
 * @param {string} sheetName
 * @param {string} field
 * @param {string} pattern — padrão de busca
 * @returns {array}
 */
function searchRecordsByPattern_(sheetName, field, pattern) {
  try {
    if (!sheetExists_(sheetName)) {
      logWarn_('Sheet não existe em searchRecordsByPattern_', { sheetName: sheetName });
      return [];
    }

    let records = getAllRecords_(sheetName);

    const regex = new RegExp(pattern, 'i');
    records = records.filter(function(record) {
      return regex.test(String(record[field] || ''));
    });

    records = records.filter(function(record) {
      return record.status !== APP_STATUS.ARCHIVED;
    });

    return records;

  } catch (error) {
    logException_('Erro em pattern search', error);
    throw error;
  }
}

// ============================================================================
// AGGREGAÇÕES
// ============================================================================

/**
 * Conta registros por status
 *
 * @param {string} sheetName
 * @returns {object} {DRAFT: N, ACTIVE: N, ...}
 */
function countRecordsByStatus_(sheetName) {
  try {
    if (!sheetExists_(sheetName)) {
      logWarn_('Sheet não existe em countRecordsByStatus_', { sheetName: sheetName });
      return {};
    }

    const records = getAllRecords_(sheetName);
    const counts = {};

    records.forEach(function(record) {
      const status = record.status || 'UNKNOWN';
      counts[status] = (counts[status] || 0) + 1;
    });

    return counts;

  } catch (error) {
    logException_('Erro ao contar por status', error);
    throw error;
  }
}

/**
 * Conta total de registros ativos
 *
 * @param {string} sheetName
 * @returns {number}
 */
function countActiveRecords_(sheetName) {
  try {
    if (!sheetExists_(sheetName)) {
      logWarn_('Sheet não existe em countActiveRecords_', { sheetName: sheetName });
      return 0;
    }

    const records = getAllRecords_(sheetName);

    return records.filter(function(record) {
      return record.status !== APP_STATUS.ARCHIVED;
    }).length;

  } catch (error) {
    logException_('Erro ao contar ativos', error);
    throw error;
  }
}

// ============================================================================
// EXPORTAR
// ============================================================================

const CRUD_SERVICE_LOADED = true;
