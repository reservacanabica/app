/**
 * COMPONENTE: 72_UserPacienteMappingRepository.gs
 * PAPEL: Mapeamento User↔Paciente
 * DEPENDÊNCIAS: 14_SpreadsheetGateway.gs, 13_AuditService.gs
 * 
 * FUNCIONALIDADES:
 * - Criar mapeamento entre usuário, paciente e médico
 * - Buscar pacientes de um médico
 * - Buscar paciente de um usuário
 * - Atualizar status de mapeamento
 * 
 * STATUS: v1.0 — FEAT-004
 * DATA: 2026-10-01
 */

// ============================================================================
// CRIAR MAPEAMENTO
// ============================================================================

/**
 * Cria mapeamento entre usuário, paciente e médico responsável
 * 
 * @param {string} userId - UUID do usuário
 * @param {string} pacienteId - UUID do paciente
 * @param {string} medicoId - UUID do médico responsável
 * @param {string} createdBy - UUID de quem criou o registro
 * @returns {Object} {ok: true, mapping: {...}} ou {ok: false, error: string}
 */
function createMapping_(userId, pacienteId, medicoId, createdBy) {
  try {
    // Validação de entrada
    if (!userId || !pacienteId || !medicoId || !createdBy) {
      return {
        ok: false,
        error: 'VALIDATION_ERROR',
        message: 'userId, pacienteId, medicoId e createdBy são obrigatórios'
      };
    }
    
    const now = new Date().toISOString();
    
    // Criar registro
    const mapping = {
      id: Utilities.getUuid(),
      userId: userId,
      pacienteId: pacienteId,
      medicoId: medicoId,
      dataVinculo: now,
      status: 'ATIVO',
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy
    };
    
    // Inserir via SpreadsheetGateway
    appendRow_('User_Paciente_Mapping', mapping);
    
    // Registrar auditoria
    auditCreate_(
      'User_Paciente_Mapping',
      mapping.id,
      createdBy,
      {
        userId: userId,
        pacienteId: pacienteId,
        medicoId: medicoId
      },
      null
    );
    
    Logger.log('MAPPING CRIADO: ' + mapping.id + ' | User: ' + userId + ' | Paciente: ' + pacienteId + ' | Médico: ' + medicoId);
    
    return {
      ok: true,
      mapping: mapping
    };
    
  } catch (error) {
    Logger.log('ERRO ao criar mapeamento: ' + error.message);
    return {
      ok: false,
      error: 'CREATE_ERROR',
      message: error.message
    };
  }
}

// ============================================================================
// BUSCAR MAPEAMENTOS
// ============================================================================

/**
 * Busca todos os mapeamentos ativos de um médico
 * 
 * @param {string} medicoId - UUID do médico
 * @returns {Array} Array de mapeamentos ativos
 */
function getMappingsByMedico_(medicoId) {
  try {
    if (!medicoId) {
      Logger.log('AVISO: getMappingsByMedico_ chamado sem medicoId');
      return [];
    }
    
    const allRecords = getAllRowsAsObjects_('User_Paciente_Mapping');
    
    // Filtrar por medicoId e status ATIVO
    const mappings = allRecords.filter(function(record) {
      return record.medicoId === medicoId && record.status === 'ATIVO';
    });
    
    Logger.log('MAPPINGS ENCONTRADOS: ' + mappings.length + ' para médico ' + medicoId);
    
    return mappings;
    
  } catch (error) {
    Logger.log('ERRO ao buscar mapeamentos do médico: ' + error.message);
    return [];
  }
}

/**
 * Busca mapeamento ativo de um usuário
 * Retorna o primeiro mapeamento ativo encontrado
 * 
 * @param {string} userId - UUID do usuário
 * @returns {Object|null} Mapeamento encontrado ou null
 */
function getMappingByUser_(userId) {
  try {
    if (!userId) {
      Logger.log('AVISO: getMappingByUser_ chamado sem userId');
      return null;
    }
    
    const allRecords = getAllRowsAsObjects_('User_Paciente_Mapping');
    
    // Buscar primeiro registro com userId e status ATIVO
    const mapping = allRecords.find(function(record) {
      return record.userId === userId && record.status === 'ATIVO';
    });
    
    if (mapping) {
      Logger.log('MAPPING ENCONTRADO: ' + mapping.id + ' | User: ' + userId + ' | Paciente: ' + mapping.pacienteId);
    } else {
      Logger.log('MAPPING NÃO ENCONTRADO para userId: ' + userId);
    }
    
    return mapping || null;
    
  } catch (error) {
    Logger.log('ERRO ao buscar mapeamento do usuário: ' + error.message);
    return null;
  }
}

// ============================================================================
// ATUALIZAR MAPEAMENTO
// ============================================================================

/**
 * Atualiza status de um mapeamento
 * 
 * @param {string} mappingId - UUID do mapeamento
 * @param {string} newStatus - Novo status (ATIVO ou INATIVO)
 * @param {string} updatedBy - UUID de quem atualizou
 * @returns {Object} {ok: true, mapping: {...}} ou {ok: false, error: string}
 */
function updateMappingStatus_(mappingId, newStatus, updatedBy) {
  try {
    // Validação de entrada
    if (!mappingId || !newStatus || !updatedBy) {
      return {
        ok: false,
        error: 'VALIDATION_ERROR',
        message: 'mappingId, newStatus e updatedBy são obrigatórios'
      };
    }
    
    // Validar status
    if (newStatus !== 'ATIVO' && newStatus !== 'INATIVO') {
      return {
        ok: false,
        error: 'VALIDATION_ERROR',
        message: 'Status deve ser ATIVO ou INATIVO'
      };
    }
    
    // Buscar mapeamento existente
    const allRecords = getAllRowsAsObjects_('User_Paciente_Mapping');
    const mapping = allRecords.find(function(record) {
      return record.id === mappingId;
    });
    
    if (!mapping) {
      return {
        ok: false,
        error: 'NOT_FOUND',
        message: 'Mapeamento não encontrado: ' + mappingId
      };
    }
    
    // Guardar dados antigos para auditoria
    const oldStatus = mapping.status;
    
    // Atualizar campos
    mapping.status = newStatus;
    mapping.updatedAt = new Date().toISOString();
    
    // Salvar via SpreadsheetGateway
    updateRowById_('User_Paciente_Mapping', mappingId, mapping);
    
    // Registrar auditoria
    auditUpdate_(
      'User_Paciente_Mapping',
      mappingId,
      updatedBy,
      { status: oldStatus },
      { status: newStatus },
      null
    );
    
    Logger.log('MAPPING ATUALIZADO: ' + mappingId + ' | Status: ' + oldStatus + ' → ' + newStatus);
    
    return {
      ok: true,
      mapping: mapping
    };
    
  } catch (error) {
    Logger.log('ERRO ao atualizar status do mapeamento: ' + error.message);
    return {
      ok: false,
      error: 'UPDATE_ERROR',
      message: error.message
    };
  }
}
