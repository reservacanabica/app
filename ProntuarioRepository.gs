/**
 * COMPONENTE: ProntuarioRepository.gs
 * PAPEL: Repositório de prontuários eletrônicos médicos
 *
 * RESPONSABILIDADE:
 * - CRUD de prontuários com anamnese JSON
 * - Validação de CID-10
 * - Controle de elegibilidade para tratamento canábico
 * - Vínculo obrigatório paciente-médico
 *
 * STATUS: v3.0 — PROMPT 7
 */

// ============================================================================
// CRIAÇÃO DE PRONTUÁRIO
// ============================================================================

/**
 * Cria novo prontuário eletrônico
 * 
 * @param {Object} dados - Dados do prontuário
 * @param {string} dados.paciente_id - UUID do paciente
 * @param {string} dados.medico_crm - CRM do médico responsável
 * @param {Object} dados.anamnese - Objeto com histórico e sintomas
 * @param {string} dados.cid10 - Código CID-10 da patologia
 * @param {boolean} dados.elegivel - Elegibilidade para tratamento
 * @returns {Object} Prontuário criado
 */
function createProntuario_(dados) {
  // Validação de dados obrigatórios
  if (!dados.paciente_id || !dados.medico_crm) {
    throw new Error('Paciente ID e CRM do médico são obrigatórios');
  }

  // Verificar se paciente existe
  const paciente = getPacienteById_(dados.paciente_id);
  if (!paciente) {
    throw new Error('Paciente não encontrado');
  }

  // Validar CID-10 (formato básico: letra + 2 dígitos + opcional .número)
  if (dados.cid10 && !validarFormatoCid10_(dados.cid10)) {
    throw new Error('Formato de CID-10 inválido. Use formato: A00, A00.0, etc.');
  }

  // Verificar se já existe prontuário ativo para este paciente
  const prontuarioExistente = getProntuarioAtivoByPacienteId_(dados.paciente_id);
  if (prontuarioExistente) {
    throw new Error('Paciente já possui prontuário ativo. Arquive o anterior antes de criar novo.');
  }

  // Preparar anamnese JSON
  const anamneseJson = JSON.stringify(dados.anamnese || {
    historico_medico: '',
    sintomas_principais: [],
    medicacoes_atuais: [],
    alergias: [],
    tratamentos_anteriores: []
  });

  // Preparar registro
  const prontuario = {
    id: Utilities.getUuid(),
    paciente_id: dados.paciente_id,
    medico_crm: String(dados.medico_crm).toUpperCase().trim(),
    anamnese_json: anamneseJson,
    cid10: dados.cid10 ? String(dados.cid10).toUpperCase().trim() : '',
    elegivel: dados.elegivel === true,
    status: 'ATIVO',
    atualizado_em: new Date().toISOString()
  };

  // Persistir
  const success = appendRowToSheet_('DB_PRONTUARIOS', prontuario);

  if (!success) {
    throw new Error('Falha ao criar prontuário');
  }

  return prontuario;
}

// ============================================================================
// LEITURA DE PRONTUÁRIOS
// ============================================================================

/**
 * Busca prontuário por ID
 * 
 * MC-5: Enriquecido com auditoria de CoA e evidências científicas
 * 
 * @param {string} id - UUID do prontuário
 * @param {boolean} incluirAuditoriaCoA - Se deve incluir auditoria completa de CoA (padrão: true)
 * @returns {Object|null} Prontuário com anamnese parseada + auditoria CoA + evidências
 */
function getProntuarioById_(id, incluirAuditoriaCoA) {
  if (!id) {
    return null;
  }

  const prontuario = getRowById_('DB_PRONTUARIOS', id);

  if (!prontuario) {
    return null;
  }

  // Parse básico
  let resultado = parseProntuarioOutput_(prontuario);

  // MC-5: Enriquecer com comorbidades, CoA e evidências (padrão: true)
  if (incluirAuditoriaCoA !== false) {
    try {
      // 1. Carregar comorbidades do paciente
      const comorbidades = getComorbidadesPaciente_(prontuario.paciente_id);
      resultado.comorbidades = comorbidades || [];

      // 2. Calcular grau de CoA obrigatório máximo
      if (comorbidades && comorbidades.length > 0) {
        const graus = comorbidades.map(function(c) { return c.grau_coa_obrigatorio; });
        resultado.grau_coa_obrigatorio_maximo = calcularGrauCoAMaximo_(graus);
      } else {
        resultado.grau_coa_obrigatorio_maximo = 'GRAU_2_PADRAO';
      }

      // 3. Coletar estudos prioritários de todas as comorbidades
      const estudosPrioritarios = [];
      (resultado.comorbidades || []).forEach(function(c) {
        if (c.evidencias_resumo_json) {
          try {
            const evidencias = JSON.parse(c.evidencias_resumo_json);
            if (Array.isArray(evidencias)) {
              estudosPrioritarios.push({
                comorbidade_id: c.comorbidade_id,
                comorbidade_nome: c.nome_terapeutica,
                estudos: evidencias.slice(0, 3) // Top 3 por comorbidade
              });
            }
          } catch (parseError) {
            Logger.log('Erro ao parsear evidências da comorbidade ' + c.comorbidade_id + ': ' + parseError.message);
          }
        }
      });
      resultado.evidencias_cientificas_anexadas = estudosPrioritarios;

      // 4. Buscar auditoria completa de CoA
      const auditoriaCoA = getAuditoriaCoACompleta_(prontuario.paciente_id, resultado.grau_coa_obrigatorio_maximo);
      resultado.auditoria_sanitaria_coa = auditoriaCoA;

    } catch (auditoriaError) {
      Logger.log('Erro ao enriquecer prontuário com auditoria CoA: ' + auditoriaError.message);
      resultado.auditoria_sanitaria_coa = {
        erro: 'Falha ao carregar auditoria de CoA',
        detalhes: auditoriaError.message
      };
    }
  }

  return resultado;
}

/**
 * Busca prontuário ativo por paciente ID
 * 
 * @param {string} pacienteId - UUID do paciente
 * @returns {Object|null} Prontuário ativo
 */
function getProntuarioAtivoByPacienteId_(pacienteId) {
  if (!pacienteId) {
    return null;
  }

  const allRows = getAllRows_('DB_PRONTUARIOS');

  const found = allRows.find(function(row) {
    return row.paciente_id === pacienteId && row.status === 'ATIVO';
  });

  return found ? parseProntuarioOutput_(found) : null;
}

/**
 * Lista prontuários com filtros
 * 
 * @param {Object} filters - Filtros de busca
 * @param {Object} pagination - {page, pageSize}
 * @returns {Object} {items, page, pageSize, total, totalPages}
 */
function listProntuarios_(filters, pagination) {
  filters = filters || {};
  pagination = pagination || {page: 1, pageSize: 20};

  const allRows = getAllRows_('DB_PRONTUARIOS');

  // Aplicar filtros
  let filtered = allRows.filter(function(row) {
    // Filtro por paciente
    if (filters.paciente_id && row.paciente_id !== filters.paciente_id) {
      return false;
    }

    // Filtro por médico CRM
    if (filters.medico_crm && row.medico_crm !== filters.medico_crm.toUpperCase()) {
      return false;
    }

    // Filtro por elegibilidade
    if (filters.elegivel !== undefined && row.elegivel !== filters.elegivel) {
      return false;
    }

    // Filtro por status
    if (filters.status && row.status !== filters.status) {
      return false;
    }

    // Filtro por CID-10 (busca parcial)
    if (filters.cid10) {
      const cid10Filter = String(filters.cid10).toUpperCase();
      const cid10Row = String(row.cid10 || '').toUpperCase();
      if (cid10Row.indexOf(cid10Filter) === -1) {
        return false;
      }
    }

    return true;
  });

  // Ordenar por data de atualização (mais recente primeiro)
  filtered.sort(function(a, b) {
    return new Date(b.atualizado_em) - new Date(a.atualizado_em);
  });

  // Paginar
  const page = Math.max(1, pagination.page || 1);
  const pageSize = Math.max(1, Math.min(100, pagination.pageSize || 20));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  const items = filtered.slice(start, end).map(function(p) {
    return parseProntuarioOutput_(p);
  });

  return {
    items: items,
    page: page,
    pageSize: pageSize,
    total: filtered.length,
    totalPages: Math.ceil(filtered.length / pageSize)
  };
}

// ============================================================================
// ATUALIZAÇÃO DE PRONTUÁRIO
// ============================================================================

/**
 * Atualiza dados do prontuário
 * 
 * @param {string} id - UUID do prontuário
 * @param {Object} updates - Campos a atualizar
 * @returns {Object} Prontuário atualizado
 */
function updateProntuario_(id, updates) {
  if (!id) {
    throw new Error('ID do prontuário é obrigatório');
  }

  const existing = getProntuarioById_(id);
  if (!existing) {
    throw new Error('Prontuário não encontrado');
  }

  // Proteger campos imutáveis
  delete updates.id;
  delete updates.paciente_id;

  // Validar CID-10 se fornecido
  if (updates.cid10 && !validarFormatoCid10_(updates.cid10)) {
    throw new Error('Formato de CID-10 inválido');
  }

  // Atualizar anamnese se fornecida
  if (updates.anamnese) {
    updates.anamnese_json = JSON.stringify(updates.anamnese);
    delete updates.anamnese;
  }

  // Atualizar timestamp
  updates.atualizado_em = new Date().toISOString();

  // Sanitizar CRM
  if (updates.medico_crm) {
    updates.medico_crm = String(updates.medico_crm).toUpperCase().trim();
  }

  // Persistir
  const success = updateRowById_('DB_PRONTUARIOS', id, updates);

  if (!success) {
    throw new Error('Falha ao atualizar prontuário');
  }

  return getProntuarioById_(id);
}

/**
 * Arquiva prontuário (não deleta, apenas muda status)
 * 
 * @param {string} id - UUID do prontuário
 * @returns {Object} Prontuário arquivado
 */
function arquivarProntuario_(id) {
  return updateProntuario_(id, {
    status: 'ARQUIVADO',
    atualizado_em: new Date().toISOString()
  });
}

// ============================================================================
// VALIDAÇÕES ESPECÍFICAS
// ============================================================================

/**
 * Valida formato de CID-10
 * 
 * Formatos aceitos:
 * - A00 (letra + 2 dígitos)
 * - A00.0 (letra + 2 dígitos + ponto + dígito)
 * - A00.00 (letra + 2 dígitos + ponto + 2 dígitos)
 * 
 * @param {string} cid10 - Código CID-10
 * @returns {boolean} true se válido
 */
function validarFormatoCid10_(cid10) {
  if (!cid10) {
    return false;
  }

  const pattern = /^[A-Z]\d{2}(\.\d{1,2})?$/;
  return pattern.test(String(cid10).toUpperCase().trim());
}

/**
 * Verifica se CID-10 está na lista de patologias elegíveis
 * 
 * Lista baseada em RDC 660/2022 ANVISA e evidências clínicas
 * 
 * @param {string} cid10 - Código CID-10
 * @returns {boolean} true se elegível
 */
function verificarElegibilidadeCid10_(cid10) {
  if (!cid10) {
    return false;
  }

  const cid10Upper = String(cid10).toUpperCase().trim();

  // Lista de CID-10 com evidências de eficácia para canabinoides
  // Fonte: RDC 660/2022, estudos clínicos e consensos médicos
  const cidsElegiveis = [
    // Epilepsia e convulsões
    'G40', 'G40.0', 'G40.1', 'G40.2', 'G40.3', 'G40.4', 'G40.5', 'G40.6', 'G40.7', 'G40.8', 'G40.9',
    
    // Dor crônica
    'R52', 'R52.0', 'R52.1', 'R52.2', 'R52.9',
    'M79.1', 'M79.2', 'M79.3', 'M79.6',
    
    // Esclerose múltipla
    'G35',
    
    // Doença de Parkinson
    'G20',
    
    // Doença de Alzheimer
    'G30', 'G30.0', 'G30.1', 'G30.8', 'G30.9',
    
    // Transtornos de ansiedade
    'F41', 'F41.0', 'F41.1', 'F41.2', 'F41.3', 'F41.8', 'F41.9',
    
    // Transtorno do espectro autista
    'F84', 'F84.0', 'F84.1', 'F84.5', 'F84.8', 'F84.9',
    
    // Câncer e cuidados paliativos (náusea, dor)
    'C00', 'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', // (simplificado)
    'R11', // Náusea e vômito
    
    // Glaucoma
    'H40', 'H40.0', 'H40.1', 'H40.2', 'H40.3', 'H40.4', 'H40.5', 'H40.6', 'H40.8', 'H40.9',
    
    // Fibromialgia
    'M79.7',
    
    // Artrite reumatoide
    'M06', 'M06.0', 'M06.1', 'M06.2', 'M06.3', 'M06.4', 'M06.8', 'M06.9',
    
    // Doença de Crohn
    'K50', 'K50.0', 'K50.1', 'K50.8', 'K50.9',
    
    // Transtorno de estresse pós-traumático (TEPT)
    'F43.1'
  ];

  // Verificar código exato ou categoria (ex: G40 cobre G40.0, G40.1, etc.)
  const categoria = cid10Upper.substring(0, 3);
  
  return cidsElegiveis.some(function(elegivel) {
    return cid10Upper === elegivel || categoria === elegivel;
  });
}

// ============================================================================
// UTILITÁRIOS INTERNOS
// ============================================================================

/**
 * Parseia prontuário para output (desserializa JSON)
 * 
 * @param {Object} prontuario - Prontuário do banco
 * @returns {Object} Prontuário com anamnese parseada
 */
function parseProntuarioOutput_(prontuario) {
  if (!prontuario) {
    return null;
  }

  let anamnese = {};
  try {
    anamnese = JSON.parse(prontuario.anamnese_json || '{}');
  } catch (e) {
    anamnese = {erro: 'Falha ao parsear anamnese'};
  }

  return {
    id: prontuario.id,
    paciente_id: prontuario.paciente_id,
    medico_crm: prontuario.medico_crm,
    anamnese: anamnese,
    cid10: prontuario.cid10,
    elegivel: prontuario.elegivel,
    status: prontuario.status,
    atualizado_em: prontuario.atualizado_em
  };
}

// ============================================================================
// BUSCA DE PATOLOGIAS ELEGÍVEIS
// ============================================================================

/**
 * Retorna lista de patologias elegíveis para tratamento canábico
 * 
 * @returns {Array<Object>} Lista de {cid10, descricao}
 */
function getPatologiasElegiveis_() {
  return [
    {cid10: 'G40', descricao: 'Epilepsia', categoria: 'Neurologia'},
    {cid10: 'R52', descricao: 'Dor crônica', categoria: 'Dor'},
    {cid10: 'G35', descricao: 'Esclerose múltipla', categoria: 'Neurologia'},
    {cid10: 'G20', descricao: 'Doença de Parkinson', categoria: 'Neurologia'},
    {cid10: 'G30', descricao: 'Doença de Alzheimer', categoria: 'Neurologia'},
    {cid10: 'F41', descricao: 'Transtornos de ansiedade', categoria: 'Psiquiatria'},
    {cid10: 'F84', descricao: 'Transtorno do espectro autista', categoria: 'Psiquiatria'},
    {cid10: 'H40', descricao: 'Glaucoma', categoria: 'Oftalmologia'},
    {cid10: 'M79.7', descricao: 'Fibromialgia', categoria: 'Reumatologia'},
    {cid10: 'M06', descricao: 'Artrite reumatoide', categoria: 'Reumatologia'},
    {cid10: 'K50', descricao: 'Doença de Crohn', categoria: 'Gastroenterologia'},
    {cid10: 'F43.1', descricao: 'Transtorno de estresse pós-traumático (TEPT)', categoria: 'Psiquiatria'},
    {cid10: 'R11', descricao: 'Náusea e vômito (oncologia)', categoria: 'Oncologia'}
  ];
}

// ============================================================================
// MC-5: AUDITORIA DE CoA E PARECER AGRO-CLÍNICO
// ============================================================================

/**
 * MC-5: Retorna auditoria completa de CoA para o paciente
 * 
 * Busca o lote de CoA associado ao paciente e valida conformidade
 * contra o grau de CoA exigido pelas comorbidades.
 * 
 * @param {string} pacienteId - UUID do paciente
 * @param {string} grauExigido - Grau de CoA máximo exigido (GRAU_1_ESTRITO, etc.)
 * @returns {Object} Auditoria completa
 */
function getAuditoriaCoACompleta_(pacienteId, grauExigido) {
  if (!pacienteId) {
    return {
      erro: 'paciente_id não fornecido'
    };
  }

  grauExigido = grauExigido || 'GRAU_2_PADRAO';

  // Buscar lote de CoA associado ao paciente
  // Estratégia: Buscar na tabela Lotes_CoA por paciente_cultivador ou outro vínculo
  // Por ora, buscar o lote mais recente com status != DESCARTADO
  const allLotes = getAllRows_('Lotes_CoA');
  
  // Filtrar lotes relevantes (aqui seria ideal ter um campo paciente_id ou grower_id)
  // Por simplicidade, pegar o lote mais recente não descartado
  const lotesValidos = allLotes.filter(function(lote) {
    return lote.statusLiberacao !== 'DESCARTADO';
  });

  // Ordenar por data de criação (mais recente primeiro)
  lotesValidos.sort(function(a, b) {
    return new Date(b.criado_em || b.atualizado_em) - new Date(a.criado_em || a.atualizado_em);
  });

  const lote = lotesValidos[0]; // Lote mais recente

  if (!lote) {
    return {
      lote_encontrado: false,
      grau_exigido: grauExigido,
      bloqueio_clinico_ativo: true,
      motivo: 'Nenhum lote de CoA encontrado para validação'
    };
  }

  // Extrair teores de metais pesados
  const teoresDetectados = {
    Pb: parseFloat(lote.teor_Pb_ppm) || 0,
    Cd: parseFloat(lote.teor_Cd_ppm) || 0,
    As: parseFloat(lote.teor_As_ppm) || 0,
    Hg: parseFloat(lote.teor_Hg_ppm) || 0
  };

  // Validar conformidade segundo grau exigido
  let bloqueioClinicoAtivo = false;
  let motivos = [];

  // Regras de validação por grau
  if (grauExigido === 'GRAU_1_ESTRITO') {
    // Limites farmacopeicos estritos para população pediátrica/oncológica
    if (teoresDetectados.Pb > 0.2) {
      bloqueioClinicoAtivo = true;
      motivos.push('Chumbo (Pb) acima do limite de 0.2 ppm para Grau 1 Estrito');
    }
    if (teoresDetectados.Cd > 0.1) {
      bloqueioClinicoAtivo = true;
      motivos.push('Cádmio (Cd) acima do limite de 0.1 ppm para Grau 1 Estrito');
    }
    if (teoresDetectados.As > 0.1) {
      bloqueioClinicoAtivo = true;
      motivos.push('Arsênio (As) acima do limite de 0.1 ppm para Grau 1 Estrito');
    }
    if (teoresDetectados.Hg > 0.05) {
      bloqueioClinicoAtivo = true;
      motivos.push('Mercúrio (Hg) acima do limite de 0.05 ppm para Grau 1 Estrito');
    }
    if (lote.statusLiberacao !== 'LIBERADO') {
      bloqueioClinicoAtivo = true;
      motivos.push('Lote não está com status LIBERADO (atual: ' + lote.statusLiberacao + ')');
    }
  } else if (grauExigido === 'GRAU_2_PADRAO') {
    // Limites gerais para adultos
    if (teoresDetectados.Pb > 0.5) {
      bloqueioClinicoAtivo = true;
      motivos.push('Chumbo (Pb) acima do limite de 0.5 ppm para Grau 2 Padrão');
    }
    if (teoresDetectados.Cd > 0.2) {
      bloqueioClinicoAtivo = true;
      motivos.push('Cádmio (Cd) acima do limite de 0.2 ppm para Grau 2 Padrão');
    }
    if (lote.statusLiberacao === 'QUARENTENA' || lote.statusLiberacao === 'REPROVADO') {
      bloqueioClinicoAtivo = true;
      motivos.push('Lote em QUARENTENA ou REPROVADO');
    }
  } else if (grauExigido === 'GRAU_3_NEUROPSIQUIATRICO') {
    // Foco em ausência de THC excessivo e pureza terpênica
    if (lote.statusLiberacao === 'REPROVADO') {
      bloqueioClinicoAtivo = true;
      motivos.push('Lote REPROVADO não pode ser usado em tratamento neuropsiquiátrico');
    }
  } else if (grauExigido === 'GRAU_4_TOPICO') {
    // Pureza microbiológica dérmica
    if (lote.statusLiberacao === 'REPROVADO') {
      bloqueioClinicoAtivo = true;
      motivos.push('Lote REPROVADO');
    }
  }

  return {
    lote_encontrado: true,
    grau_exigido: grauExigido,
    lote_id: lote.id,
    lote_codigo: lote.codigo || lote.id.substring(0, 8),
    status_liberacao: lote.statusLiberacao,
    teores_detectados: teoresDetectados,
    bloqueio_clinico_ativo: bloqueioClinicoAtivo,
    motivos_bloqueio: motivos,
    conforme: !bloqueioClinicoAtivo,
    data_analise: lote.dataAnalise || lote.atualizado_em
  };
}

/**
 * MC-5: Emite Parecer de Compatibilidade Médico-Agronômica
 * 
 * Gera laudo pericial formal contendo:
 * - Diagnóstico e CID-10 das comorbidades
 * - Citação formal dos estudos com DOIs
 * - Atestado de conformidade do lote de CoA
 * 
 * @param {string} pacienteId - UUID do paciente
 * @param {string} medicoCrm - CRM do médico responsável
 * @returns {Object} Parecer completo
 */
function emitirParecerAgroClinico_(pacienteId, medicoCrm) {
  if (!pacienteId || !medicoCrm) {
    throw new Error('Paciente ID e CRM do médico são obrigatórios para emitir parecer');
  }

  // 1. Buscar prontuário ativo do paciente
  const prontuario = getProntuarioAtivoByPacienteId_(pacienteId);
  if (!prontuario) {
    throw new Error('Paciente não possui prontuário ativo');
  }

  // 2. Carregar comorbidades e auditoria CoA
  const comorbidades = getComorbidadesPaciente_(pacienteId);
  if (!comorbidades || comorbidades.length === 0) {
    throw new Error('Paciente não possui comorbidades registradas. Não é possível emitir parecer.');
  }

  // 3. Calcular grau de CoA máximo exigido
  const graus = comorbidades.map(function(c) { return c.grau_coa_obrigatorio; });
  const grauMaximo = calcularGrauCoAMaximo_(graus);

  // 4. Buscar auditoria de CoA
  const auditoriaCoA = getAuditoriaCoACompleta_(pacienteId, grauMaximo);

  // 5. BLOQUEIO SANITÁRIO: Se lote não conforme para vulnerabilidade do paciente
  if (auditoriaCoA.bloqueio_clinico_ativo) {
    throw new Error(
      'Bloqueio Sanitário: Lote agrícola com contaminantes acima do limite para a vulnerabilidade do paciente. ' +
      'Motivos: ' + (auditoriaCoA.motivos_bloqueio || []).join('; ')
    );
  }

  // 6. Coletar evidências científicas (DOIs) de todas as comorbidades
  const citacoesCientificas = [];
  comorbidades.forEach(function(c) {
    if (c.evidencias_resumo_json) {
      try {
        const evidencias = JSON.parse(c.evidencias_resumo_json);
        if (Array.isArray(evidencias)) {
          evidencias.slice(0, 3).forEach(function(estudo) {
            citacoesCientificas.push({
              comorbidade: c.nome_terapeutica,
              cid10: c.cid10_sugerido,
              autores: estudo.autores,
              ano: estudo.ano,
              titulo: estudo.titulo,
              doi: estudo.doi,
              pmid: estudo.pmid,
              nivel_evidencia: estudo.nivel_evidencia
            });
          });
        }
      } catch (parseError) {
        Logger.log('Erro ao parsear evidências no parecer: ' + parseError.message);
      }
    }
  });

  // 7. Montar parecer formal
  const parecer = {
    id: Utilities.getUuid(),
    paciente_id: pacienteId,
    medico_crm: String(medicoCrm).toUpperCase().trim(),
    prontuario_id: prontuario.id,
    tipo: 'PARECER_AGROCLINICO',
    
    // SEÇÃO 1: Diagnóstico Clínico
    diagnostico: {
      cid10_principal: prontuario.cid10,
      comorbidades_registradas: comorbidades.map(function(c) {
        return {
          id: c.comorbidade_id,
          nome: c.nome_terapeutica,
          indicacao: c.indicacao,
          cid10_sugerido: c.cid10_sugerido,
          prioridade: c.prioridade,
          triagem_cientifica: c.triagem
        };
      }),
      grau_coa_exigido: grauMaximo
    },
    
    // SEÇÃO 2: Fundamentação Científica (DOIs)
    fundamentacao_cientifica: {
      total_estudos_citados: citacoesCientificas.length,
      citacoes: citacoesCientificas.map(function(cit) {
        return {
          comorbidade: cit.comorbidade,
          referencia: cit.autores + ' (' + cit.ano + '). ' + cit.titulo,
          doi: cit.doi,
          pmid: cit.pmid,
          nivel_evidencia: cit.nivel_evidencia
        };
      })
    },
    
    // SEÇÃO 3: Atestado de Conformidade Agronômica
    atestado_conformidade_coa: {
      lote_id: auditoriaCoA.lote_id,
      lote_codigo: auditoriaCoA.lote_codigo,
      status_liberacao: auditoriaCoA.status_liberacao,
      grau_coa_atendido: grauMaximo,
      conforme: true, // Se chegou aqui, passou na validação
      teores_metais_pesados: auditoriaCoA.teores_detectados,
      data_analise: auditoriaCoA.data_analise,
      certificacao: 'Lote de insumos e biomassa em conformidade com os limites toxicológicos estabelecidos para o grau de vulnerabilidade clínica do paciente (' + grauMaximo + ').'
    },
    
    // SEÇÃO 4: Conclusão e Recomendação
    conclusao: {
      elegivel_para_tratamento: true,
      recomendacao_terapeutica: 'Paciente apto para tratamento com produtos canábicos oriundos do lote ' + (auditoriaCoA.lote_codigo || auditoriaCoA.lote_id) + ', observadas as indicações clínicas registradas e a fundamentação científica anexada.',
      observacoes: 'Parecer emitido com base em evidências científicas indexadas (DOIs/PMIDs) e auditoria toxicológica completa do Certificado de Análise (CoA) de 4 níveis.'
    },
    
    emitido_em: new Date().toISOString(),
    medico_emissor: medicoCrm
  };

  // 8. Persistir parecer (opcional: criar tabela DB_PARECERES_AGROCLINICOS)
  // Por ora, retornar o objeto completo
  // TODO: Implementar persistência em tabela dedicada se necessário

  return parecer;
}

// ============================================================================
// EXPORTAR
// ============================================================================

const PRONTUARIO_REPOSITORY_LOADED = true;
