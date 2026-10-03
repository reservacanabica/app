/**
 * COMPONENTE: PacienteRepository.gs
 * PAPEL: Repositório de pacientes com proteção LGPD
 *
 * RESPONSABILIDADE:
 * - CRUD de pacientes com CPF hasheado
 * - Validação de consentimento TCLE/LGPD obrigatório
 * - Mascaramento de dados sensíveis em leituras
 * - Integração com SecurityUtils para proteção de dados
 *
 * STATUS: v3.0 — PROMPT 7
 */

// ============================================================================
// CRIAÇÃO DE PACIENTE
// ============================================================================

/**
 * Cria novo paciente com validação completa
 * 
 * IMPORTANTE: CPF é hasheado automaticamente antes de persistir.
 * Consentimento LGPD é obrigatório.
 * 
 * @param {Object} dados - Dados do paciente
 * @param {string} dados.nome - Nome completo
 * @param {string} dados.cpf - CPF (será hasheado)
 * @param {string} dados.email - Email
 * @param {string} dados.telefone - Telefone
 * @param {string} dados.data_nasc - Data de nascimento (ISO 8601)
 * @param {boolean} dados.termos_lgpd_aceite - Aceite do termo TCLE/LGPD
 * @param {string} dados.medico_id - UUID do médico responsável
 * @returns {Object} Paciente criado
 */
function createPaciente_(dados) {
  // Validação de dados obrigatórios
  if (!dados.nome || !dados.cpf || !dados.email) {
    throw new Error('Nome, CPF e email são obrigatórios');
  }

  // Validação de consentimento LGPD obrigatório
  if (dados.termos_lgpd_aceite !== true) {
    throw new Error('Consentimento TCLE/LGPD é obrigatório para cadastro');
  }

  // Validar CPF
  if (!SecurityUtils.validarCpf(dados.cpf)) {
    throw new Error('CPF inválido');
  }

  // Verificar duplicidade de CPF
  const cpfHash = SecurityUtils.hashCpf(dados.cpf);
  const existente = findPacienteByCpfHash_(cpfHash);
  if (existente) {
    throw new Error('Paciente com este CPF já está cadastrado');
  }

  // Preparar registro
  const paciente = {
    id: Utilities.getUuid(),
    nome: SecurityUtils.sanitizarString(dados.nome),
    cpf_hash: cpfHash,
    email: dados.email.toLowerCase().trim(),
    telefone: SecurityUtils.apenasDigitos(dados.telefone || ''),
    data_nasc: dados.data_nasc || '',
    termos_lgpd_aceite: true,
    medico_id: dados.medico_id || '',
    criado_em: new Date().toISOString()
  };

  // Persistir usando SpreadsheetGateway
  const success = appendRowToSheet_('DB_PACIENTES', paciente);

  if (!success) {
    throw new Error('Falha ao criar paciente');
  }

  // Retornar paciente com CPF mascarado
  return sanitizePacienteForOutput_(paciente, dados.cpf);
}

// ============================================================================
// LEITURA DE PACIENTES
// ============================================================================

/**
 * Busca paciente por ID
 * 
 * @param {string} id - UUID do paciente
 * @returns {Object|null} Paciente com dados mascarados
 */
function getPacienteById_(id) {
  if (!id) {
    return null;
  }

  const paciente = getRowById_('DB_PACIENTES', id);

  if (!paciente) {
    return null;
  }

  return sanitizePacienteForOutput_(paciente);
}

/**
 * Lista pacientes com filtros e paginação
 * 
 * @param {Object} filters - Filtros de busca
 * @param {Object} pagination - {page, pageSize}
 * @returns {Object} {items, page, pageSize, total, totalPages}
 */
function listPacientes_(filters, pagination) {
  filters = filters || {};
  pagination = pagination || {page: 1, pageSize: 20};

  const allRows = getAllRows_('DB_PACIENTES');

  // Aplicar filtros
  let filtered = allRows.filter(function(row) {
    // Filtro por médico responsável
    if (filters.medico_id && row.medico_id !== filters.medico_id) {
      return false;
    }

    // Filtro por status de consentimento
    if (filters.termos_lgpd_aceite !== undefined && row.termos_lgpd_aceite !== filters.termos_lgpd_aceite) {
      return false;
    }

    // Filtro por nome (busca parcial)
    if (filters.nome) {
      const nomeFilter = String(filters.nome).toLowerCase();
      const nomeRow = String(row.nome || '').toLowerCase();
      if (nomeRow.indexOf(nomeFilter) === -1) {
        return false;
      }
    }

    return true;
  });

  // Ordenar por data de criação (mais recente primeiro)
  filtered.sort(function(a, b) {
    return new Date(b.criado_em) - new Date(a.criado_em);
  });

  // Paginar
  const page = Math.max(1, pagination.page || 1);
  const pageSize = Math.max(1, Math.min(100, pagination.pageSize || 20));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  const items = filtered.slice(start, end).map(function(p) {
    return sanitizePacienteForOutput_(p);
  });

  return {
    items: items,
    page: page,
    pageSize: pageSize,
    total: filtered.length,
    totalPages: Math.ceil(filtered.length / pageSize)
  };
}

/**
 * Busca paciente por hash de CPF (uso interno)
 * 
 * @param {string} cpfHash - Hash SHA-256 do CPF
 * @returns {Object|null} Paciente
 */
function findPacienteByCpfHash_(cpfHash) {
  if (!cpfHash) {
    return null;
  }

  const allRows = getAllRows_('DB_PACIENTES');

  const found = allRows.find(function(row) {
    return row.cpf_hash === cpfHash;
  });

  return found || null;
}

// ============================================================================
// ATUALIZAÇÃO DE PACIENTE
// ============================================================================

/**
 * Atualiza dados do paciente
 * 
 * IMPORTANTE: CPF não pode ser alterado após criação.
 * Consentimento LGPD não pode ser revogado (apenas anotado).
 * 
 * @param {string} id - UUID do paciente
 * @param {Object} updates - Campos a atualizar
 * @returns {Object} Paciente atualizado
 */
function updatePaciente_(id, updates) {
  if (!id) {
    throw new Error('ID do paciente é obrigatório');
  }

  const existing = getPacienteById_(id);
  if (!existing) {
    throw new Error('Paciente não encontrado');
  }

  // Proteger campos imutáveis
  delete updates.id;
  delete updates.cpf_hash;
  delete updates.criado_em;
  delete updates.termos_lgpd_aceite; // Não pode revogar consentimento

  // Sanitizar dados
  if (updates.nome) {
    updates.nome = SecurityUtils.sanitizarString(updates.nome);
  }
  if (updates.email) {
    updates.email = updates.email.toLowerCase().trim();
  }
  if (updates.telefone) {
    updates.telefone = SecurityUtils.apenasDigitos(updates.telefone);
  }

  // Atualizar via SpreadsheetGateway
  const success = updateRowById_('DB_PACIENTES', id, updates);

  if (!success) {
    throw new Error('Falha ao atualizar paciente');
  }

  return getPacienteById_(id);
}

// ============================================================================
// REMOÇÃO DE PACIENTE
// ============================================================================

/**
 * Remove paciente (soft delete / anonimização LGPD)
 * 
 * LGPD Art. 18: Direito à eliminação de dados pessoais.
 * Remove dados sensíveis mas mantém registro histórico anonimizado.
 * 
 * @param {string} id - UUID do paciente
 * @returns {boolean} true se removido com sucesso
 */
function deletePaciente_(id) {
  if (!id) {
    throw new Error('ID do paciente é obrigatório');
  }

  const existing = getPacienteById_(id);
  if (!existing) {
    throw new Error('Paciente não encontrado');
  }

  // Verificar se há prontuários/receitas vinculados
  const prontuarios = getAllRows_('DB_PRONTUARIOS').filter(function(p) {
    return p.paciente_id === id;
  });

  if (prontuarios.length > 0) {
    // Anonimizar em vez de deletar (requisito LGPD + histórico médico)
    return anonimizarPaciente_(id);
  }

  // Remover completamente se não houver histórico médico
  return deleteRowById_('DB_PACIENTES', id);
}

/**
 * Anonimiza dados do paciente mantendo histórico
 * 
 * @param {string} id - UUID do paciente
 * @returns {boolean} true se anonimizado com sucesso
 */
function anonimizarPaciente_(id) {
  const updates = {
    nome: 'PACIENTE_ANONIMIZADO_' + id.substring(0, 8),
    cpf_hash: 'ANONIMIZADO_' + new Date().getTime(),
    email: 'anonimizado@exemplo.com',
    telefone: '',
    data_nasc: '',
    termos_lgpd_aceite: false
  };

  return updateRowById_('DB_PACIENTES', id, updates);
}

// ============================================================================
// UTILITÁRIOS INTERNOS
// ============================================================================

/**
 * Sanitiza paciente para output (mascara dados sensíveis)
 * 
 * @param {Object} paciente - Paciente do banco
 * @param {string} cpfOriginal - CPF original (opcional, para mascarar)
 * @returns {Object} Paciente com dados mascarados
 */
function sanitizePacienteForOutput_(paciente, cpfOriginal) {
  if (!paciente) {
    return null;
  }

  return {
    id: paciente.id,
    nome: paciente.nome,
    cpf_mascarado: cpfOriginal ? SecurityUtils.mascararCpf(cpfOriginal) : '***.***.***-**',
    email: paciente.email,
    email_mascarado: SecurityUtils.mascararEmail(paciente.email),
    telefone_mascarado: SecurityUtils.mascararTelefone(paciente.telefone),
    data_nasc: paciente.data_nasc,
    termos_lgpd_aceite: paciente.termos_lgpd_aceite,
    medico_id: paciente.medico_id,
    criado_em: paciente.criado_em
  };
}

/**
 * Valida idade mínima (18 anos) para consentimento
 * 
 * @param {string} dataNasc - Data de nascimento (ISO 8601)
 * @returns {boolean} true se maior de 18 anos
 */
function validarIdadeMinima_(dataNasc) {
  if (!dataNasc) {
    return false;
  }

  const hoje = new Date();
  const nascimento = new Date(dataNasc);
  const idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();

  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
    return idade - 1 >= 18;
  }

  return idade >= 18;
}

// ============================================================================
// HELPERS DO SPREADSHEET GATEWAY
// ============================================================================

// Nota: appendRowToSheet_, getAllRows_, getRowById_, updateRowById_, deleteRowById_
// são providas por 14_SpreadsheetGateway.gs — não redefinir aqui.

// ============================================================================
// EXPORTAR
// ============================================================================

const PACIENTE_REPOSITORY_LOADED = true;
