/**
 * COMPONENTE: ReceitaMedicaRepository.gs
 * PAPEL: Repositório de receitas médicas digitais (aba DB_RECEITAS)
 *
 * RESPONSABILIDADE:
 * - CRUD de receitas médicas emitidas para pacientes
 * - Vínculo obrigatório prontuário-paciente-médico
 * - Proteção de campos de validação criptográfica (hash_validacao, pdf_drive_id),
 *   que só podem ser preenchidos por PrescriptionEngine.gs
 * - Bloqueio de alteração/remoção de receitas já assinadas digitalmente
 *
 * NOTA: Não confundir com Receitas_Fertirrigacao (69_ReceitaFertirrigacaoRepository.gs),
 * que é um domínio agronômico distinto. Esta repositório cobre receitas médicas
 * (DB_RECEITAS) consumidas por PrescriptionEngine.gs para emissão de PDF e
 * assinatura digital.
 */

// ============================================================================
// CRIAÇÃO DE RECEITA MÉDICA
// ============================================================================

/**
 * Cria nova receita médica em status RASCUNHO
 *
 * @param {Object} dados - Dados da receita
 * @param {string} dados.prontuario_id - UUID do prontuário de origem
 * @param {string} dados.paciente_id - UUID do paciente
 * @param {string} dados.medico_id - UUID do médico responsável (Users.id)
 * @param {string} dados.produto_nome - Nome do produto prescrito
 * @param {string} dados.concentracao - Concentração (ex: "30mg/mL CBD")
 * @param {string} dados.posologia - Posologia detalhada
 * @param {string} dados.via_adm - Via de administração (sublingual, oral, etc.)
 * @param {string} [dados.quimiotipo] - Quimiotipo (CBD, THC, balanceado)
 * @param {string} [dados.cid10] - CID-10 (herdado do prontuário se omitido)
 * @returns {Object} Receita criada
 */
function createReceitaMedica_(dados) {
  dados = dados || {};

  // Validação de dados obrigatórios
  if (!dados.prontuario_id || !dados.paciente_id || !dados.medico_id) {
    throw new Error('prontuario_id, paciente_id e medico_id são obrigatórios');
  }
  if (!dados.produto_nome || !dados.posologia) {
    throw new Error('produto_nome e posologia são obrigatórios');
  }

  // Verificar se paciente existe
  const paciente = getPacienteById_(dados.paciente_id);
  if (!paciente) {
    throw new Error('Paciente não encontrado');
  }

  // Verificar se prontuário existe e pertence ao paciente informado
  const prontuario = getProntuarioById_(dados.prontuario_id, false);
  if (!prontuario) {
    throw new Error('Prontuário não encontrado');
  }
  if (prontuario.paciente_id !== dados.paciente_id) {
    throw new Error('Prontuário não pertence ao paciente informado');
  }

  // Preparar registro
  const receita = {
    id: Utilities.getUuid(),
    prontuario_id: dados.prontuario_id,
    paciente_id: dados.paciente_id,
    medico_id: dados.medico_id,
    produto_nome: SecurityUtils.sanitizarString(dados.produto_nome),
    concentracao: dados.concentracao || '',
    posologia: SecurityUtils.sanitizarString(dados.posologia),
    via_adm: dados.via_adm || '',
    quimiotipo: dados.quimiotipo || '',
    hash_validacao: '',
    pdf_drive_id: '',
    status: RECEITA_MEDICA_STATUS.RASCUNHO,
    emitido_em: new Date().toISOString()
  };

  // Persistir usando SpreadsheetGateway
  const success = appendRowToSheet_('DB_RECEITAS', receita);

  if (!success) {
    throw new Error('Falha ao criar receita médica');
  }

  return receita;
}

// ============================================================================
// LEITURA DE RECEITAS MÉDICAS
// ============================================================================

/**
 * Busca receita médica por ID
 *
 * @param {string} id - UUID da receita
 * @returns {Object|null} Receita médica
 */
function getReceitaMedicaById_(id) {
  if (!id) {
    return null;
  }

  return getRowById_('DB_RECEITAS', id);
}

/**
 * Lista receitas médicas com filtros e paginação
 *
 * @param {Object} filters - Filtros de busca
 * @param {string} [filters.paciente_id] - Filtra por paciente
 * @param {string} [filters.medico_id] - Filtra por médico
 * @param {string} [filters.prontuario_id] - Filtra por prontuário
 * @param {string} [filters.status] - Filtra por status
 * @param {string} [filters.produto_nome] - Busca parcial por nome do produto
 * @param {Object} pagination - {page, pageSize}
 * @returns {Object} {items, page, pageSize, total, totalPages}
 */
function listReceitasMedicas_(filters, pagination) {
  filters = filters || {};
  pagination = pagination || {page: 1, pageSize: 20};

  const allRows = getAllRows_('DB_RECEITAS');

  let filtered = allRows.filter(function(row) {
    if (filters.paciente_id && row.paciente_id !== filters.paciente_id) {
      return false;
    }
    if (filters.medico_id && row.medico_id !== filters.medico_id) {
      return false;
    }
    if (filters.prontuario_id && row.prontuario_id !== filters.prontuario_id) {
      return false;
    }
    if (filters.status && row.status !== filters.status) {
      return false;
    }
    if (filters.produto_nome) {
      const produtoFilter = String(filters.produto_nome).toLowerCase();
      const produtoRow = String(row.produto_nome || '').toLowerCase();
      if (produtoRow.indexOf(produtoFilter) === -1) {
        return false;
      }
    }
    return true;
  });

  // Ordenar por data de emissão (mais recente primeiro)
  filtered.sort(function(a, b) {
    return new Date(b.emitido_em) - new Date(a.emitido_em);
  });

  // Paginar
  const page = Math.max(1, pagination.page || 1);
  const pageSize = Math.max(1, Math.min(100, pagination.pageSize || 20));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  return {
    items: filtered.slice(start, end),
    page: page,
    pageSize: pageSize,
    total: filtered.length,
    totalPages: Math.ceil(filtered.length / pageSize)
  };
}

// ============================================================================
// ATUALIZAÇÃO DE RECEITA MÉDICA
// ============================================================================

/**
 * Atualiza dados de uma receita médica
 *
 * IMPORTANTE: Receitas já assinadas (status ASSINADA) são imutáveis.
 * Campos de validação criptográfica (hash_validacao, pdf_drive_id) e vínculos
 * (prontuario_id, paciente_id, medico_id, emitido_em) só podem ser alterados
 * por PrescriptionEngine.gs, nunca diretamente por este repositório.
 *
 * @param {string} id - UUID da receita
 * @param {Object} updates - Campos a atualizar
 * @returns {Object} Receita atualizada
 */
function updateReceitaMedica_(id, updates) {
  if (!id) {
    throw new Error('ID da receita é obrigatório');
  }

  const existing = getReceitaMedicaById_(id);
  if (!existing) {
    throw new Error('Receita não encontrada');
  }

  if (existing.status === RECEITA_MEDICA_STATUS.ASSINADA) {
    throw new Error('Receita assinada digitalmente não pode ser alterada');
  }

  updates = updates || {};

  // Proteger campos imutáveis / geridos exclusivamente por PrescriptionEngine.gs
  delete updates.id;
  delete updates.prontuario_id;
  delete updates.paciente_id;
  delete updates.medico_id;
  delete updates.emitido_em;
  delete updates.hash_validacao;
  delete updates.pdf_drive_id;

  // Sanitizar dados
  if (updates.produto_nome) {
    updates.produto_nome = SecurityUtils.sanitizarString(updates.produto_nome);
  }
  if (updates.posologia) {
    updates.posologia = SecurityUtils.sanitizarString(updates.posologia);
  }

  const success = updateRowById_('DB_RECEITAS', id, updates);

  if (!success) {
    throw new Error('Falha ao atualizar receita médica');
  }

  return getReceitaMedicaById_(id);
}

// ============================================================================
// REMOÇÃO DE RECEITA MÉDICA
// ============================================================================

/**
 * Remove receita médica
 *
 * Receitas já assinadas (status ASSINADA) não podem ser removidas — devem ser
 * canceladas via updateReceitaMedica_(id, {status: RECEITA_MEDICA_STATUS.CANCELADA})
 * para preservar o histórico de auditoria.
 *
 * @param {string} id - UUID da receita
 * @returns {boolean} true se removida com sucesso
 */
function deleteReceitaMedica_(id) {
  if (!id) {
    throw new Error('ID da receita é obrigatório');
  }

  const existing = getReceitaMedicaById_(id);
  if (!existing) {
    throw new Error('Receita não encontrada');
  }

  if (existing.status === RECEITA_MEDICA_STATUS.ASSINADA) {
    throw new Error('Receita assinada digitalmente não pode ser removida; cancele-a em vez de excluir');
  }

  return deleteRowById_('DB_RECEITAS', id);
}
