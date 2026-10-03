/**
 * COMPONENTE: CultivoLogRepository.gs
 * PAPEL: Repositório de logs ambientais de cultivo com VPD
 *
 * RESPONSABILIDADE:
 * - Registro de telemetria ambiental diária
 * - Cálculo automático de VPD (Vapor Pressure Deficit)
 * - Uso de LockService para concorrência
 * - Rastreabilidade para laudos periciais agronômicos
 *
 * STATUS: v3.0 — PROMPT 7
 */

// ============================================================================
// CÁLCULO DE VPD (VAPOR PRESSURE DEFICIT)
// ============================================================================

/**
 * Calcula VPD (Vapor Pressure Deficit) baseado em temperatura e umidade
 * 
 * Fórmula científica:
 * VPsat = 0.61078 × exp((17.27 × T) / (T + 237.3))
 * VPa = VPsat × (RH / 100)
 * VPD = VPsat - VPa (em kPa)
 * 
 * VPD ideal para Cannabis:
 * - Vegetativo: 0.8-1.2 kPa
 * - Floração: 1.0-1.5 kPa
 * 
 * @param {number} tempC - Temperatura em °C
 * @param {number} rh - Umidade relativa em %
 * @returns {number} VPD em kPa (2 casas decimais)
 */
function calcularVpd_(tempC, rh) {
  const t = parseFloat(tempC);
  const u = parseFloat(rh);

  // Validação de entradas
  if (isNaN(t) || isNaN(u)) {
    return 0;
  }

  if (t < -10 || t > 50) {
    throw new Error('Temperatura fora do intervalo válido (-10°C a 50°C)');
  }

  if (u < 0 || u > 100) {
    throw new Error('Umidade relativa deve estar entre 0% e 100%');
  }

  // Calcular VPsat (pressão de vapor saturada)
  const vpSat = 0.61078 * Math.exp((17.27 * t) / (t + 237.3));

  // Calcular VPa (pressão de vapor atual)
  const vpAir = vpSat * (u / 100);

  // Calcular VPD
  const vpd = vpSat - vpAir;

  // Retornar com 2 casas decimais
  return parseFloat(vpd.toFixed(2));
}

/**
 * Interpreta valor de VPD para feedback ao cultivador
 * 
 * @param {number} vpd - VPD em kPa
 * @param {string} fase - Fase fenológica (VEGETATIVO, FLORACAO, etc.)
 * @returns {Object} {status, mensagem, recomendacao}
 */
function interpretarVpd_(vpd, fase) {
  let idealMin, idealMax;

  // Definir faixas ideais por fase
  if (fase === 'VEGETATIVO') {
    idealMin = 0.8;
    idealMax = 1.2;
  } else if (fase === 'FLORACAO') {
    idealMin = 1.0;
    idealMax = 1.5;
  } else {
    idealMin = 0.8;
    idealMax = 1.5;
  }

  let status, mensagem, recomendacao;

  if (vpd < idealMin) {
    status = 'BAIXO';
    mensagem = 'VPD abaixo do ideal - ambiente muito úmido';
    recomendacao = 'Aumentar temperatura ou reduzir umidade. Risco de fungos e mofo.';
  } else if (vpd > idealMax) {
    status = 'ALTO';
    mensagem = 'VPD acima do ideal - ambiente muito seco';
    recomendacao = 'Reduzir temperatura ou aumentar umidade. Risco de estresse hídrico.';
  } else {
    status = 'IDEAL';
    mensagem = 'VPD dentro da faixa ideal para a fase';
    recomendacao = 'Manter condições atuais.';
  }

  return {
    status: status,
    mensagem: mensagem,
    recomendacao: recomendacao,
    faixaIdeal: idealMin.toFixed(1) + ' - ' + idealMax.toFixed(1) + ' kPa'
  };
}

// ============================================================================
// CRIAÇÃO DE LOG AMBIENTAL
// ============================================================================

/**
 * Registra log ambiental com cálculo automático de VPD
 * 
 * IMPORTANTE: Usa LockService para garantir atomicidade em ambientes concorrentes
 * 
 * @param {Object} dados - Dados do log
 * @param {string} dados.planta_id - UUID da planta
 * @param {number} dados.temp_c - Temperatura em °C
 * @param {number} dados.umidade_pct - Umidade relativa em %
 * @param {string} dados.ph - pH da solução nutritiva (opcional)
 * @param {string} dados.ec_ppm - EC em ppm (opcional)
 * @param {string} dados.observacoes - Observações do cultivador (opcional)
 * @returns {Object} Log criado
 */
function inserirLogAmbiental_(dados) {
  // Obter lock para operação atômica
  const lock = LockService.getScriptLock();
  const lockAcquired = lock.tryLock(10000); // 10 segundos timeout

  if (!lockAcquired) {
    throw new Error('Lock timeout ao registrar log ambiental. Tente novamente.');
  }

  try {
    // Validação de dados obrigatórios
    if (!dados.planta_id) {
      throw new Error('Planta ID é obrigatório');
    }

    if (dados.temp_c === undefined || dados.umidade_pct === undefined) {
      throw new Error('Temperatura e umidade são obrigatórios');
    }

    // Verificar se planta existe
    const planta = getPlantaById_(dados.planta_id);
    if (!planta) {
      throw new Error('Planta não encontrada');
    }

    // Calcular VPD automaticamente
    const vpd = calcularVpd_(dados.temp_c, dados.umidade_pct);

    // Preparar registro
    const log = {
      id: Utilities.getUuid(),
      planta_id: dados.planta_id,
      temp_c: parseFloat(dados.temp_c),
      umidade_pct: parseFloat(dados.umidade_pct),
      vpd: vpd,
      ph: dados.ph || '',
      ec_ppm: dados.ec_ppm || '',
      observacoes: dados.observacoes || '',
      registrado_em: new Date().toISOString()
    };

    // Persistir
    const success = appendRowToSheet_('DB_CULTIVO_LOGS', log);

    if (!success) {
      throw new Error('Falha ao registrar log ambiental');
    }

    // Adicionar interpretação do VPD
    log.vpd_interpretacao = interpretarVpd_(vpd, planta.fase);

    return log;

  } finally {
    // Sempre liberar lock
    lock.releaseLock();
  }
}

// ============================================================================
// LEITURA DE LOGS
// ============================================================================

/**
 * Busca log por ID
 * 
 * @param {string} id - UUID do log
 * @returns {Object|null} Log
 */
function getLogById_(id) {
  if (!id) {
    return null;
  }

  return getRowById_('DB_CULTIVO_LOGS', id);
}

/**
 * Lista logs por planta
 * 
 * @param {string} plantaId - UUID da planta
 * @param {Object} filters - Filtros adicionais
 * @returns {Array<Object>} Lista de logs
 */
function getLogsByPlantaId_(plantaId, filters) {
  if (!plantaId) {
    return [];
  }

  filters = filters || {};
  const allRows = getAllRows_('DB_CULTIVO_LOGS');

  // Aplicar filtros
  let filtered = allRows.filter(function(row) {
    // Filtro obrigatório por planta
    if (row.planta_id !== plantaId) {
      return false;
    }

    // Filtro por intervalo de datas
    if (filters.data_inicio) {
      const dataInicio = new Date(filters.data_inicio);
      const dataLog = new Date(row.registrado_em);
      if (dataLog < dataInicio) {
        return false;
      }
    }

    if (filters.data_fim) {
      const dataFim = new Date(filters.data_fim);
      const dataLog = new Date(row.registrado_em);
      if (dataLog > dataFim) {
        return false;
      }
    }

    return true;
  });

  // Ordenar por data de registro (mais recente primeiro)
  filtered.sort(function(a, b) {
    return new Date(b.registrado_em) - new Date(a.registrado_em);
  });

  return filtered;
}

/**
 * Lista logs com paginação
 * 
 * @param {Object} filters - Filtros de busca
 * @param {Object} pagination - {page, pageSize}
 * @returns {Object} {items, page, pageSize, total, totalPages}
 */
function listLogs_(filters, pagination) {
  filters = filters || {};
  pagination = pagination || {page: 1, pageSize: 50};

  const allRows = getAllRows_('DB_CULTIVO_LOGS');

  // Aplicar filtros
  let filtered = allRows.filter(function(row) {
    // Filtro por planta
    if (filters.planta_id && row.planta_id !== filters.planta_id) {
      return false;
    }

    // Filtro por paciente (via planta)
    if (filters.paciente_id) {
      const planta = getPlantaById_(row.planta_id);
      if (!planta || planta.paciente_id !== filters.paciente_id) {
        return false;
      }
    }

    return true;
  });

  // Ordenar por data de registro (mais recente primeiro)
  filtered.sort(function(a, b) {
    return new Date(b.registrado_em) - new Date(a.registrado_em);
  });

  // Paginar
  const page = Math.max(1, pagination.page || 1);
  const pageSize = Math.max(1, Math.min(100, pagination.pageSize || 50));
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  const items = filtered.slice(start, end);

  return {
    items: items,
    page: page,
    pageSize: pageSize,
    total: filtered.length,
    totalPages: Math.ceil(filtered.length / pageSize)
  };
}

// ============================================================================
// ANÁLISE E ESTATÍSTICAS
// ============================================================================

/**
 * Calcula médias ambientais para período
 * 
 * @param {string} plantaId - UUID da planta
 * @param {number} diasAtras - Número de dias para analisar
 * @returns {Object} Médias e estatísticas
 */
function calcularMediasAmbientais_(plantaId, diasAtras) {
  diasAtras = diasAtras || 7; // Padrão 7 dias

  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - diasAtras);

  const logs = getLogsByPlantaId_(plantaId, {
    data_inicio: dataLimite.toISOString()
  });

  if (logs.length === 0) {
    return null;
  }

  let somaTemp = 0;
  let somaUmidade = 0;
  let somaVpd = 0;
  let count = logs.length;

  logs.forEach(function(log) {
    somaTemp += parseFloat(log.temp_c || 0);
    somaUmidade += parseFloat(log.umidade_pct || 0);
    somaVpd += parseFloat(log.vpd || 0);
  });

  return {
    periodo_dias: diasAtras,
    total_registros: count,
    temp_media: parseFloat((somaTemp / count).toFixed(1)),
    umidade_media: parseFloat((somaUmidade / count).toFixed(1)),
    vpd_medio: parseFloat((somaVpd / count).toFixed(2)),
    data_inicio: dataLimite.toISOString().split('T')[0],
    data_fim: new Date().toISOString().split('T')[0]
  };
}

/**
 * Identifica alertas de condições ambientais
 * 
 * @param {string} plantaId - UUID da planta
 * @returns {Array<Object>} Lista de alertas
 */
function identificarAlertasAmbientais_(plantaId) {
  const planta = getPlantaById_(plantaId);
  if (!planta) {
    return [];
  }

  // Analisar últimas 24 horas
  const dataLimite = new Date();
  dataLimite.setHours(dataLimite.getHours() - 24);

  const logs = getLogsByPlantaId_(plantaId, {
    data_inicio: dataLimite.toISOString()
  });

  const alertas = [];

  logs.forEach(function(log) {
    // Alerta de temperatura extrema
    if (log.temp_c < 15) {
      alertas.push({
        tipo: 'TEMP_BAIXA',
        severidade: 'ALTA',
        mensagem: 'Temperatura muito baixa (' + log.temp_c + '°C) - risco de estresse',
        data: log.registrado_em
      });
    }

    if (log.temp_c > 32) {
      alertas.push({
        tipo: 'TEMP_ALTA',
        severidade: 'ALTA',
        mensagem: 'Temperatura muito alta (' + log.temp_c + '°C) - risco de estresse térmico',
        data: log.registrado_em
      });
    }

    // Alerta de umidade extrema
    if (log.umidade_pct > 70) {
      alertas.push({
        tipo: 'UMIDADE_ALTA',
        severidade: 'MEDIA',
        mensagem: 'Umidade muito alta (' + log.umidade_pct + '%) - risco de fungos',
        data: log.registrado_em
      });
    }

    if (log.umidade_pct < 30) {
      alertas.push({
        tipo: 'UMIDADE_BAIXA',
        severidade: 'MEDIA',
        mensagem: 'Umidade muito baixa (' + log.umidade_pct + '%) - risco de estresse hídrico',
        data: log.registrado_em
      });
    }

    // Alerta de VPD fora da faixa
    const vpdInterpretacao = interpretarVpd_(log.vpd, planta.fase);
    if (vpdInterpretacao.status !== 'IDEAL') {
      alertas.push({
        tipo: 'VPD_FORA_IDEAL',
        severidade: 'BAIXA',
        mensagem: vpdInterpretacao.mensagem + ' (VPD: ' + log.vpd + ' kPa)',
        data: log.registrado_em
      });
    }
  });

  return alertas;
}

// ============================================================================
// EXPORTAR
// ============================================================================

const CULTIVO_LOG_REPOSITORY_LOADED = true;
