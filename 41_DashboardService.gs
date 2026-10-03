/**
 * COMPONENTE: 41_DashboardService.gs
 * PAPEL: Serviço de Dashboard
 *
 * RESPONSABILIDADE:
 * - Agregar estatísticas do dashboard
 * - Retornar dados do dashboard médico
 * - Fornecer contagens globais
 *
 * STATUS: v1.0 — Implementado (Correção #3)
 */

// ============================================================================
// HANDLERS DE DASHBOARD
// ============================================================================

/**
 * Handler: dashboard.stats
 * Retorna estatísticas agregadas para o dashboard principal
 * 
 * @param {object} context - contexto da requisição
 * @returns {object} resposta com estatísticas
 */
function handleDashboardStats_(context) {
  try {
    logDebug_('Carregando estatísticas do dashboard', {
      userId: context.user.id,
      role: context.user.role,
      correlationId: context.correlationId
    });

    const stats = getDashboardStats_(context.user);

    return okResponse_(stats, {
      message: 'Estatísticas do dashboard carregadas',
      correlationId: context.correlationId
    });

  } catch (error) {
    logException_('Erro ao carregar estatísticas do dashboard', error, {
      userId: context.user.id,
      correlationId: context.correlationId
    });

    return errorServerResponse_(
      'Erro ao carregar estatísticas',
      { error: error.message },
      { correlationId: context.correlationId }
    );
  }
}

/**
 * Handler: dashboard.medico
 * Retorna dados agregados do dashboard médico (comorbidades + CoA + telemetria)
 * 
 * @param {object} context - contexto da requisição
 * @returns {object} resposta com dados do dashboard médico
 */
function handleDashboardMedico_(context) {
  try {
    logDebug_('Carregando dados do dashboard médico', {
      userId: context.user.id,
      role: context.user.role,
      correlationId: context.correlationId
    });

    const dashboardData = getDashboardMedicoData_(context.user);

    return okResponse_(dashboardData, {
      message: 'Dashboard médico carregado',
      correlationId: context.correlationId
    });

  } catch (error) {
    logException_('Erro ao carregar dashboard médico', error, {
      userId: context.user.id,
      correlationId: context.correlationId
    });

    return errorServerResponse_(
      'Erro ao carregar dashboard médico',
      { error: error.message },
      { correlationId: context.correlationId }
    );
  }
}

/**
 * Handler: dashboard.counts
 * Retorna contagens globais (studies, experiments, users, etc.)
 * 
 * @param {object} context - contexto da requisição
 * @returns {object} resposta com contagens
 */
function handleDashboardCounts_(context) {
  try {
    logDebug_('Carregando contagens do dashboard', {
      userId: context.user.id,
      role: context.user.role,
      correlationId: context.correlationId
    });

    const counts = getDashboardCounts_(context.user);

    return okResponse_(counts, {
      message: 'Contagens carregadas',
      correlationId: context.correlationId
    });

  } catch (error) {
    logException_('Erro ao carregar contagens', error, {
      userId: context.user.id,
      correlationId: context.correlationId
    });

    return errorServerResponse_(
      'Erro ao carregar contagens',
      { error: error.message },
      { correlationId: context.correlationId }
    );
  }
}

// ============================================================================
// FUNÇÕES INTERNAS — ESTATÍSTICAS
// ============================================================================

/**
 * Obtém estatísticas agregadas para o dashboard principal
 * 
 * @param {object} user - usuário autenticado
 * @returns {object} estatísticas
 * @private
 */
function getDashboardStats_(user) {
  const role = user.role;

  // Contagens básicas
  const totalStudies = countStudies_();
  const totalExperiments = countExperiments_();
  const totalObservations = countObservations_();
  const totalUsers = countUsers_();

  // Dados específicos por role
  let roleSpecific = {};

  if (role === 'admin' || role === 'tecnico_agricola') {
    // Admin e Técnico Agrícola veem dados globais
    roleSpecific = {
      activeUsers: countActiveUsers_(),
      pendingAudits: countPendingAudits_(),
      recentActivity: getRecentActivity_(10)
    };
  } else if (role === 'medico') {
    // Médico vê dados de seus pacientes
    roleSpecific = {
      myPatients: countMyPatients_(user.id),
      pendingConsults: countPendingConsults_(user.id),
      recentPrescriptions: getRecentPrescriptions_(user.id, 5)
    };
  } else if (role === 'grower') {
    // Grower vê dados de seus cultivos
    roleSpecific = {
      activeCultivations: countActiveCultivations_(user.id),
      pendingHarvests: countPendingHarvests_(user.id),
      recentObservations: getRecentObservations_(user.id, 5)
    };
  } else if (role === 'paciente') {
    // Paciente vê apenas seus próprios dados
    roleSpecific = {
      myStudies: countMyStudies_(user.id),
      myComorbidades: countMyComorbidades_(user.id),
      nextAppointment: getNextAppointment_(user.id)
    };
  }

  return {
    global: {
      totalStudies: totalStudies,
      totalExperiments: totalExperiments,
      totalObservations: totalObservations,
      totalUsers: totalUsers
    },
    roleSpecific: roleSpecific,
    timestamp: nowIso_()
  };
}

/**
 * Obtém dados agregados do dashboard médico
 * 
 * @param {object} user - usuário autenticado
 * @returns {object} dados do dashboard médico
 * @private
 */
function getDashboardMedicoData_(user) {
  const userId = user.id;
  const role = user.role;

  // Comorbidades do usuário
  const comorbidades = getUserComorbidades_(userId);

  // Status CoA (simulado para MVP)
  const coaStatus = getMockCoAStatus_();

  // Telemetria (apenas para grower/tecnico_agricola)
  let telemetria = null;
  if (role === 'grower' || role === 'tecnico_agricola') {
    telemetria = getTelemetriaData_(userId);
  }

  return {
    comorbidades: comorbidades || [],
    coaStatus: coaStatus,
    telemetria: telemetria,
    timestamp: nowIso_()
  };
}

/**
 * Obtém contagens globais para exibição no dashboard
 * 
 * @param {object} user - usuário autenticado
 * @returns {object} contagens
 * @private
 */
function getDashboardCounts_(user) {
  const role = user.role;

  // Contagens básicas acessíveis a todos
  const counts = {
    studies: countStudies_(),
    experiments: countExperiments_(),
    observations: countObservations_()
  };

  // Contagens restritas por role
  if (role === 'admin' || role === 'tecnico_agricola') {
    counts.users = countUsers_();
    counts.insumos = countInsumos_();
    counts.lotes = countLotes_();
    counts.receitas = countReceitas_();
    counts.protocolos = countProtocolos_();
    counts.pareceres = countPareceres_();
  }

  if (role === 'medico' || role === 'admin') {
    counts.comorbidades = countAllComorbidades_();
    counts.pacientes = countPacientes_();
  }

  return {
    counts: counts,
    timestamp: nowIso_()
  };
}

// ============================================================================
// FUNÇÕES DE CONTAGEM — STUBS (implementar conforme repositórios existem)
// ============================================================================

function countStudies_() {
  try {
    return countActiveRecords_(STUDIES_SHEET) || 0;
  } catch (e) {
    return 0;
  }
}

function countExperiments_() {
  try {
    return countActiveRecords_(EXPERIMENTS_SHEET) || 0;
  } catch (e) {
    return 0;
  }
}

function countObservations_() {
  try {
    return countActiveRecords_(OBSERVATIONS_SHEET) || 0;
  } catch (e) {
    return 0;
  }
}

function countUsers_() {
  try {
    const users = getAllUsers_();
    return users ? users.length : 0;
  } catch (e) {
    return 0;
  }
}

function countActiveUsers_() {
  try {
    const users = getAllUsers_();
    return users ? users.filter(function(u) { return u.status === 'active'; }).length : 0;
  } catch (e) {
    return 0;
  }
}

function countPendingAudits_() {
  // Stub: implementar quando sistema de auditoria de CoA existir
  return 0;
}

function getRecentActivity_(limit) {
  try {
    const records = getAllRowsAsObjects_('AuditLog');
    if (!records || records.length === 0) {
      return [];
    }
    
    // Ordenar por createdAt DESC
    const sorted = records.sort(function(a, b) {
      const dateA = a.createdAt || '';
      const dateB = b.createdAt || '';
      return dateB.localeCompare(dateA);
    });
    
    // Retornar primeiros 'limit' registros
    return sorted.slice(0, limit);
  } catch (e) {
    Logger.log('WARN: Erro ao carregar atividades recentes: ' + e.message);
    return [];
  }
}

function countMyPatients_(medicoId) {
  try {
    if (!medicoId) {
      return 0;
    }
    
    // Buscar mapeamentos ativos do médico
    const mappings = getMappingsByMedico_(medicoId);
    
    return mappings.length;
    
  } catch (error) {
    Logger.log('ERRO ao contar pacientes do médico: ' + error.message);
    return 0;
  }
}

function countPendingConsults_(medicoId) {
  try {
    // Verificar se sheet Agendamentos existe
    if (!sheetExists_('Agendamentos')) {
      Logger.log('WARN: Sheet Agendamentos não existe, retornando 0');
      return 0;
    }
    
    const records = getAllRowsAsObjects_('Agendamentos');
    if (!records || records.length === 0) {
      return 0;
    }
    
    // Filtrar por medico_id e status='pendente'
    const pending = records.filter(function(r) {
      return r.medico_id === medicoId && r.status === 'pendente';
    });
    
    return pending.length;
  } catch (e) {
    Logger.log('WARN: Erro ao contar consultas pendentes: ' + e.message);
    return 0;
  }
}

function getRecentPrescriptions_(medicoId, limit) {
  // Stub: implementar quando sistema de prescrições existir
  return [];
}

function countActiveCultivations_(growerId) {
  try {
    const records = getAllRowsAsObjects_('DB_CULTIVO_PLANTAS');
    if (!records || records.length === 0) {
      return 0;
    }
    
    // Filtrar por paciente_id (grower é paciente) e status='ATIVA'
    const active = records.filter(function(r) {
      return r.paciente_id === growerId && r.status === 'ATIVA';
    });
    
    return active.length;
  } catch (e) {
    Logger.log('WARN: Erro ao contar cultivos ativos: ' + e.message);
    return 0;
  }
}

function countPendingHarvests_(growerId) {
  try {
    const records = getAllRowsAsObjects_('DB_CULTIVO_PLANTAS');
    if (!records || records.length === 0) {
      return 0;
    }
    
    // Filtrar por paciente_id, fase='FLORACAO' e status='ATIVA'
    const pending = records.filter(function(r) {
      return r.paciente_id === growerId && 
             r.fase === 'FLORACAO' && 
             r.status === 'ATIVA';
    });
    
    return pending.length;
  } catch (e) {
    Logger.log('WARN: Erro ao contar colheitas pendentes: ' + e.message);
    return 0;
  }
}

function getRecentObservations_(userId, limit) {
  try {
    const result = listObservations_({ createdBy: userId }, { page: 1, pageSize: limit });
    return (result && result.items) ? result.items.slice(0, limit) : [];
  } catch (e) {
    return [];
  }
}

function countMyStudies_(userId) {
  try {
    const userStudies = getStudiesByOwner_(userId);
    return userStudies ? userStudies.length : 0;
  } catch (e) {
    return 0;
  }
}

function countMyComorbidades_(userId) {
  try {
    const comorbidades = getUserComorbidades_(userId);
    return comorbidades ? comorbidades.length : 0;
  } catch (e) {
    return 0;
  }
}

function getNextAppointment_(userId) {
  // Stub: implementar quando sistema de agendamentos existir
  return null;
}

function countInsumos_() {
  try {
    const records = getAllRowsAsObjects_('Insumos_Catalogo');
    if (!records || records.length === 0) {
      return 0;
    }
    
    // Filtrar por ativo='ATIVO'
    const ativos = records.filter(function(r) {
      return r.ativo === 'ATIVO';
    });
    
    return ativos.length;
  } catch (e) {
    Logger.log('WARN: Erro ao contar insumos: ' + e.message);
    return 0;
  }
}

function countLotes_() {
  try {
    // Usar getRowCount_ do SpreadsheetGateway para contar total de lotes
    const count = getRowCount_('Lotes_CoA');
    return count;
  } catch (e) {
    Logger.log('WARN: Erro ao contar lotes: ' + e.message);
    return 0;
  }
}

function countReceitas_() {
  // Stub: implementar quando ReceitaRepository existir
  return 0;
}

function countProtocolos_() {
  // Stub: implementar quando ProtocoloRepository existir
  return 0;
}

function countPareceres_() {
  // Stub: implementar quando ParecerRepository existir
  return 0;
}

function countAllComorbidades_() {
  // Stub: implementar quando ComorbidadeRepository tiver método de contagem global
  return 0;
}

function countPacientes_() {
  try {
    const users = getAllUsers_();
    if (!users) return 0;
    return users.filter(function(u) { return u.role === 'paciente'; }).length;
  } catch (e) {
    return 0;
  }
}

/**
 * Retorna status CoA simulado (MVP)
 * @private
 */
function getMockCoAStatus_() {
  return {
    nivel1: {
      status: 'conforme',
      detalhes: 'Metais Pesados: Pb < 0.2 ppm | Cd < 0.1 ppm ✅ CONFORME'
    },
    nivel2: {
      status: 'conforme',
      detalhes: 'Livre de Aflatoxinas e Fungos ✅'
    },
    nivel3: {
      status: 'conforme',
      detalhes: 'Pureza CO₂/Etanol ✅'
    },
    nivel4: {
      status: 'pendente',
      detalhes: 'Aguardando laudo de concentração nominal'
    },
    geral: {
      conforme: false,
      texto: '⚠️ LAUDO PENDENTE (Nível 4)'
    }
  };
}

/**
 * Retorna dados de telemetria simulados (MVP)
 * @private
 */
function getTelemetriaData_(userId) {
  return {
    vpd: {
      valor: 1.1,
      unidade: 'kPa',
      status: 'ideal'
    },
    interpretacao: 'Seu VPD atual (1.1 kPa) está na faixa ideal (0.8–1.2 kPa) para sintetizar o beta-cariofileno necessário para suas queixas inflamatórias.'
  };
}

/**
 * Retorna comorbidades do usuário
 * Delega para ComorbidadeRepository quando disponível
 * @private
 */
function getUserComorbidades_(userId) {
  try {
    // Tenta usar o repositório se existir
    if (typeof listarComorbidadesUsuario_ === 'function') {
      return listarComorbidadesUsuario_(userId);
    }
    
    // Fallback: retorna array vazio
    return [];
  } catch (e) {
    logWarn_('Erro ao carregar comorbidades do usuário', { userId: userId, error: e.message });
    return [];
  }
}

// ============================================================================
// ALIAS DE COMPATIBILIDADE
// ============================================================================

/**
 * Alias público de getDashboardStats_ para uso no assessor de maturidade
 * e em chamadas externas ao serviço de dashboard.
 * @param {Object} user
 * @returns {Object}
 */
function getDashboardData_(user) {
  return getDashboardStats_(user);
}

const DASHBOARD_SERVICE_LOADED = true;
