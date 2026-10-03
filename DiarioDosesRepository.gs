/**
 * COMPONENTE: DiarioDosesRepository.gs
 * PAPEL: Repositório de diário de doses e titulação
 *
 * RESPONSABILIDADE:
 * - Registro diário de autoaplicação de doses (gotas)
 * - Monitoramento de sintomas (escala 0-10)
 * - Detecção de efeitos adversos críticos
 * - Alertas clínicos automáticos para médico responsável
 * - Suporte à titulação gradual de dose
 *
 * STATUS: v3.0 — PROMPT 7
 */

// ============================================================================
// CRIAÇÃO DE REGISTRO DE DOSE
// ============================================================================

/**
 * Registra dose diária com sintomas e efeitos adversos
 * 
 * @param {Object} dados - Dados da dose
 * @param {string} dados.paciente_id - UUID do paciente
 * @param {string} dados.receita_id - UUID da receita vinculada
 * @param {number} dados.gotas_manha - Gotas tomadas pela manhã
 * @param {number} dados.gotas_tarde - Gotas tomadas à tarde
 * @param {number} dados.gotas_noite - Gotas tomadas à noite
 * @param {number} dados.escala_sintoma - Escala 0-10 de intensidade do sintoma
 * @param {Array<string>} dados.efeitos_adversos - Array de efeitos adversos
 * @returns {Object} Registro de dose criado
 */
function createDose_(dados) {
  // Validação de dados obrigatórios
  if (!dados.paciente_id || !dados.receita_id) {
    throw new Error('Paciente ID e Receita ID são obrigatórios');
  }

  // Verificar se paciente existe
  const paciente = getPacienteById_(dados.paciente_id);
  if (!paciente) {
    throw new Error('Paciente não encontrado');
  }

  // Validar escala de sintoma (0-10)
  if (dados.escala_sintoma !== undefined) {
    const escala = parseInt(dados.escala_sintoma);
    if (isNaN(escala) || escala < 0 || escala > 10) {
      throw new Error('Escala de sintoma deve ser entre 0 e 10');
    }
  }

  // Validar número de gotas (não negativo)
  const gotasManha = parseInt(dados.gotas_manha || 0);
  const gotasTarde = parseInt(dados.gotas_tarde || 0);
  const gotasNoite = parseInt(dados.gotas_noite || 0);

  if (gotasManha < 0 || gotasTarde < 0 || gotasNoite < 0) {
    throw new Error('Número de gotas não pode ser negativo');
  }

  // Preparar array de efeitos adversos
  const efeitosAdversos = dados.efeitos_adversos || [];
  const efeitosAdversosJson = JSON.stringify(efeitosAdversos);

  // Preparar registro
  const dose = {
    id: Utilities.getUuid(),
    paciente_id: dados.paciente_id,
    receita_id: dados.receita_id,
    gotas_manha: gotasManha,
    gotas_tarde: gotasTarde,
    gotas_noite: gotasNoite,
    escala_sintoma: parseInt(dados.escala_sintoma || 0),
    efeitos_adversos_json: efeitosAdversosJson,
    registrado_em: new Date().toISOString()
  };

  // Persistir
  const success = appendRowToSheet_('DB_DIARIO_DOSES', dose);

  if (!success) {
    throw new Error('Falha ao registrar dose');
  }

  // Verificar efeitos adversos críticos e gerar alerta
  verificarEfeitosAdversosCriticos_(dose, efeitosAdversos);

  return parseDoseOutput_(dose);
}

// ============================================================================
// LEITURA DE DOSES
// ============================================================================

/**
 * Busca dose por ID
 * 
 * @param {string} id - UUID da dose
 * @returns {Object|null} Dose com efeitos adversos parseados
 */
function getDoseById_(id) {
  if (!id) {
    return null;
  }

  const dose = getRowById_('DB_DIARIO_DOSES', id);

  if (!dose) {
    return null;
  }

  return parseDoseOutput_(dose);
}

/**
 * Lista doses por paciente
 * 
 * @param {string} pacienteId - UUID do paciente
 * @param {Object} filters - Filtros adicionais
 * @returns {Array<Object>} Lista de doses
 */
function getDosesByPacienteId_(pacienteId, filters) {
  if (!pacienteId) {
    return [];
  }

  filters = filters || {};
  const allRows = getAllRows_('DB_DIARIO_DOSES');

  // Aplicar filtros
  let filtered = allRows.filter(function(row) {
    // Filtro obrigatório por paciente
    if (row.paciente_id !== pacienteId) {
      return false;
    }

    // Filtro por receita
    if (filters.receita_id && row.receita_id !== filters.receita_id) {
      return false;
    }

    // Filtro por intervalo de datas
    if (filters.data_inicio) {
      const dataInicio = new Date(filters.data_inicio);
      const dataRegistro = new Date(row.registrado_em);
      if (dataRegistro < dataInicio) {
        return false;
      }
    }

    if (filters.data_fim) {
      const dataFim = new Date(filters.data_fim);
      const dataRegistro = new Date(row.registrado_em);
      if (dataRegistro > dataFim) {
        return false;
      }
    }

    return true;
  });

  // Ordenar por data de registro (mais recente primeiro)
  filtered.sort(function(a, b) {
    return new Date(b.registrado_em) - new Date(a.registrado_em);
  });

  return filtered.map(function(d) {
    return parseDoseOutput_(d);
  });
}

/**
 * Lista doses com paginação
 * 
 * @param {Object} filters - Filtros de busca
 * @param {Object} pagination - {page, pageSize}
 * @returns {Object} {items, page, pageSize, total, totalPages}
 */
function listDoses_(filters, pagination) {
  filters = filters || {};
  pagination = pagination || {page: 1, pageSize: 30};

  const allRows = getAllRows_('DB_DIARIO_DOSES');

  // Aplicar filtros
  let filtered = allRows.filter(function(row) {
    // Filtro por paciente
    if (filters.paciente_id && row.paciente_id !== filters.paciente_id) {
      return false;
    }

    // Filtro por receita
    if (filters.receita_id && row.receita_id !== filters.receita_id) {
      return false;
    }

    return true;
  });

  // Ordenar por data de registro (mais recente primeiro)
  filtered.sort(function(a, b) {
    return new Date(b.registrado_em) - new Date(a.registrado_em);
  });

  // Paginar
  const page = Math.max(1, pagination.page || 1);
  const pageSize = Math.max(1, Math.min(100, pagination.pageSize || 30));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  const items = filtered.slice(start, end).map(function(d) {
    return parseDoseOutput_(d);
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
// EFEITOS ADVERSOS
// ============================================================================

/**
 * Lista de efeitos adversos conhecidos com classificação
 * 
 * @returns {Array<Object>} Lista de efeitos adversos
 */
function getEfeitosAdversosConhecidos_() {
  return [
    // CRÍTICOS (requerem atenção médica imediata)
    {id: 'taquicardia', nome: 'Taquicardia (>100 bpm)', severidade: 'CRITICA'},
    {id: 'tontura_severa', nome: 'Tontura severa', severidade: 'CRITICA'},
    {id: 'confusao_mental', nome: 'Confusão mental', severidade: 'CRITICA'},
    {id: 'alucinacao', nome: 'Alucinação', severidade: 'CRITICA'},
    {id: 'dor_peito', nome: 'Dor no peito', severidade: 'CRITICA'},
    
    // MODERADOS (monitorar de perto)
    {id: 'sonolencia', nome: 'Sonolência', severidade: 'MODERADA'},
    {id: 'boca_seca', nome: 'Boca seca', severidade: 'MODERADA'},
    {id: 'tontura_leve', nome: 'Tontura leve', severidade: 'MODERADA'},
    {id: 'nausea', nome: 'Náusea', severidade: 'MODERADA'},
    {id: 'diarreia', nome: 'Diarreia', severidade: 'MODERADA'},
    {id: 'fadiga', nome: 'Fadiga', severidade: 'MODERADA'},
    
    // LEVES (comuns e geralmente transitórios)
    {id: 'olhos_vermelhos', nome: 'Olhos vermelhos', severidade: 'LEVE'},
    {id: 'aumento_apetite', nome: 'Aumento de apetite', severidade: 'LEVE'},
    {id: 'alteracao_humor', nome: 'Alteração de humor leve', severidade: 'LEVE'},
    {id: 'insonia', nome: 'Insônia', severidade: 'LEVE'}
  ];
}

/**
 * Verifica efeitos adversos críticos e dispara alerta
 * 
 * @param {Object} dose - Registro de dose
 * @param {Array<string>} efeitosAdversos - Array de IDs de efeitos
 */
function verificarEfeitosAdversosCriticos_(dose, efeitosAdversos) {
  if (!efeitosAdversos || efeitosAdversos.length === 0) {
    return;
  }

  const efeitosConhecidos = getEfeitosAdversosConhecidos_();
  const efeitosCriticos = efeitosConhecidos.filter(function(e) {
    return e.severidade === 'CRITICA' && efeitosAdversos.indexOf(e.id) !== -1;
  });

  if (efeitosCriticos.length > 0) {
    // Disparar alerta para o médico responsável
    dispararAlertaClinicoUrgente_(dose, efeitosCriticos);
  }
}

/**
 * Dispara alerta clínico urgente para médico responsável
 * 
 * @param {Object} dose - Registro de dose
 * @param {Array<Object>} efeitosCriticos - Efeitos adversos críticos
 */
function dispararAlertaClinicoUrgente_(dose, efeitosCriticos) {
  try {
    const paciente = getPacienteById_(dose.paciente_id);
    if (!paciente) return;

    const prontuario = getProntuarioAtivoByPacienteId_(dose.paciente_id);
    if (!prontuario || !prontuario.medico_crm) return;

    // Buscar email do médico pelo CRM (simulado - ajustar conforme sistema)
    const medicoEmail = buscarEmailMedicoPorCrm_(prontuario.medico_crm);
    if (!medicoEmail) return;

    // Preparar mensagem
    const efeitosNomes = efeitosCriticos.map(function(e) { return e.nome; }).join(', ');
    const assunto = '🚨 ALERTA CLÍNICO URGENTE - Efeitos Adversos Críticos';
    const corpo = 
      'Prezado Dr./Dra.,\n\n' +
      'O paciente ' + paciente.nome + ' (ID: ' + paciente.id.substring(0, 8) + '...) ' +
      'reportou efeitos adversos CRÍTICOS após administração de dose:\n\n' +
      'EFEITOS CRÍTICOS REPORTADOS:\n' +
      '- ' + efeitosNomes + '\n\n' +
      'DOSE ADMINISTRADA:\n' +
      '- Manhã: ' + dose.gotas_manha + ' gotas\n' +
      '- Tarde: ' + dose.gotas_tarde + ' gotas\n' +
      '- Noite: ' + dose.gotas_noite + ' gotas\n\n' +
      'ESCALA DE SINTOMA: ' + dose.escala_sintoma + '/10\n\n' +
      'DATA/HORA: ' + new Date(dose.registrado_em).toLocaleString('pt-BR', {timeZone: 'America/Sao_Paulo'}) + '\n\n' +
      'RECOMENDAÇÃO: Entre em contato com o paciente imediatamente para avaliação.\n\n' +
      '---\n' +
      'Sistema Reserva Canábica - Monitoramento Automático de Segurança';

    // Enviar email (se quota disponível)
    GmailApp.sendEmail(medicoEmail, assunto, corpo, {
      name: 'Reserva Canábica - Alerta Clínico'
    });

    // Registrar alerta no log de auditoria
    logWarn_('Alerta clínico urgente disparado', {
      paciente_id: dose.paciente_id,
      medico_crm: prontuario.medico_crm,
      efeitos_criticos: efeitosCriticos.length
    });

  } catch (error) {
    logException_('Erro ao disparar alerta clínico urgente', error);
  }
}

/**
 * Busca email do médico por CRM (placeholder)
 * 
 * @param {string} crm - CRM do médico
 * @returns {string|null} Email do médico
 */
function buscarEmailMedicoPorCrm_(crm) {
  // TODO: Implementar busca real no cadastro de médicos
  // Por enquanto, retorna null para não disparar emails em desenvolvimento
  return null;
}

// ============================================================================
// ANÁLISE E TITULAÇÃO
// ============================================================================

/**
 * Calcula dose diária total (em gotas)
 * 
 * @param {Object} dose - Registro de dose
 * @returns {number} Total de gotas diárias
 */
function calcularDoseTotal_(dose) {
  return (dose.gotas_manha || 0) + (dose.gotas_tarde || 0) + (dose.gotas_noite || 0);
}

/**
 * Analisa histórico de titulação do paciente
 * 
 * @param {string} pacienteId - UUID do paciente
 * @param {number} diasAnalise - Número de dias para analisar
 * @returns {Object} Análise de titulação
 */
function analisarTitulacao_(pacienteId, diasAnalise) {
  diasAnalise = diasAnalise || 14; // Padrão 14 dias

  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - diasAnalise);

  const doses = getDosesByPacienteId_(pacienteId, {
    data_inicio: dataLimite.toISOString()
  });

  if (doses.length === 0) {
    return null;
  }

  // Calcular médias
  let somaDoseTotal = 0;
  let somaSintoma = 0;
  let totalEfeitosAdversos = 0;

  doses.forEach(function(dose) {
    somaDoseTotal += calcularDoseTotal_(dose);
    somaSintoma += dose.escala_sintoma || 0;
    totalEfeitosAdversos += dose.efeitos_adversos.length;
  });

  const mediaDoseTotal = parseFloat((somaDoseTotal / doses.length).toFixed(1));
  const mediaSintoma = parseFloat((somaSintoma / doses.length).toFixed(1));

  // Identificar tendência de dose
  const doseInicial = calcularDoseTotal_(doses[doses.length - 1]);
  const doseRecente = calcularDoseTotal_(doses[0]);
  const tendencia = doseRecente > doseInicial ? 'CRESCENTE' : (doseRecente < doseInicial ? 'DECRESCENTE' : 'ESTAVEL');

  return {
    periodo_dias: diasAnalise,
    total_registros: doses.length,
    dose_media_total: mediaDoseTotal,
    sintoma_medio: mediaSintoma,
    total_efeitos_adversos: totalEfeitosAdversos,
    tendencia_dose: tendencia,
    dose_inicial: doseInicial,
    dose_recente: doseRecente
  };
}

// ============================================================================
// UTILITÁRIOS INTERNOS
// ============================================================================

/**
 * Parseia dose para output (desserializa JSON)
 * 
 * @param {Object} dose - Dose do banco
 * @returns {Object} Dose com efeitos adversos parseados
 */
function parseDoseOutput_(dose) {
  if (!dose) {
    return null;
  }

  let efeitosAdversos = [];
  try {
    efeitosAdversos = JSON.parse(dose.efeitos_adversos_json || '[]');
  } catch (e) {
    efeitosAdversos = [];
  }

  return {
    id: dose.id,
    paciente_id: dose.paciente_id,
    receita_id: dose.receita_id,
    gotas_manha: dose.gotas_manha,
    gotas_tarde: dose.gotas_tarde,
    gotas_noite: dose.gotas_noite,
    dose_total: calcularDoseTotal_(dose),
    escala_sintoma: dose.escala_sintoma,
    efeitos_adversos: efeitosAdversos,
    registrado_em: dose.registrado_em
  };
}

// ============================================================================
// EXPORTAR
// ============================================================================

const DIARIO_DOSES_REPOSITORY_LOADED = true;
