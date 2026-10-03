/**
 * COMPONENTE: CultivoPlantaRepository.gs
 * PAPEL: Repositório de plantas de cultivo medicinal
 *
 * RESPONSABILIDADE:
 * - CRUD de plantas vinculadas a pacientes growers
 * - Controle de fases fenológicas
 * - Rastreabilidade para Habeas Corpus preventivo
 * - Escopo restrito: apenas plantas do próprio paciente
 *
 * STATUS: v3.0 — PROMPT 7
 */

// ============================================================================
// CRIAÇÃO DE PLANTA
// ============================================================================

/**
 * Registra nova planta de cultivo medicinal
 * 
 * @param {Object} dados - Dados da planta
 * @param {string} dados.paciente_id - UUID do paciente grower
 * @param {string} dados.strain_nome - Nome da strain
 * @param {string} dados.quimiotipo - Quimiotipo (CBD-dominant, THC-dominant, balanceado)
 * @param {string} dados.ratio_cbd_thc - Ratio CBD:THC (ex: "20:1", "1:1")
 * @param {string} dados.fase - Fase fenológica
 * @param {string} dados.data_plantio - Data de plantio (ISO 8601)
 * @returns {Object} Planta criada
 */
function createPlanta_(dados) {
  // Validação de dados obrigatórios
  if (!dados.paciente_id || !dados.strain_nome) {
    throw new Error('Paciente ID e nome da strain são obrigatórios');
  }

  // Verificar se paciente existe
  const paciente = getPacienteById_(dados.paciente_id);
  if (!paciente) {
    throw new Error('Paciente não encontrado');
  }

  // Validar fase fenológica
  const fasesValidas = ['GERMINACAO', 'VEGETATIVO', 'FLORACAO', 'SECAGEM', 'CURA'];
  const fase = dados.fase || 'GERMINACAO';
  if (fasesValidas.indexOf(fase) === -1) {
    throw new Error('Fase inválida. Use: ' + fasesValidas.join(', '));
  }

  // Preparar registro
  const planta = {
    id: Utilities.getUuid(),
    paciente_id: dados.paciente_id,
    strain_nome: SecurityUtils.sanitizarString(dados.strain_nome),
    quimiotipo: dados.quimiotipo || 'CBD-dominant',
    ratio_cbd_thc: dados.ratio_cbd_thc || '20:1',
    fase: fase,
    data_plantio: dados.data_plantio || new Date().toISOString().split('T')[0],
    status: 'ATIVA'
  };

  // Persistir
  const success = appendRowToSheet_('DB_CULTIVO_PLANTAS', planta);

  if (!success) {
    throw new Error('Falha ao registrar planta');
  }

  return planta;
}

// ============================================================================
// LEITURA DE PLANTAS
// ============================================================================

/**
 * Busca planta por ID
 * 
 * @param {string} id - UUID da planta
 * @returns {Object|null} Planta
 */
function getPlantaById_(id) {
  if (!id) {
    return null;
  }

  return getRowById_('DB_CULTIVO_PLANTAS', id);
}

/**
 * Lista plantas por paciente (grower)
 * 
 * @param {string} pacienteId - UUID do paciente
 * @param {Object} filters - Filtros adicionais
 * @returns {Array<Object>} Lista de plantas
 */
function getPlantasByPacienteId_(pacienteId, filters) {
  if (!pacienteId) {
    return [];
  }

  filters = filters || {};
  const allRows = getAllRows_('DB_CULTIVO_PLANTAS');

  // Aplicar filtros
  let filtered = allRows.filter(function(row) {
    // Filtro obrigatório por paciente
    if (row.paciente_id !== pacienteId) {
      return false;
    }

    // Filtro por status
    if (filters.status && row.status !== filters.status) {
      return false;
    }

    // Filtro por fase
    if (filters.fase && row.fase !== filters.fase) {
      return false;
    }

    // Filtro por quimiotipo
    if (filters.quimiotipo && row.quimiotipo !== filters.quimiotipo) {
      return false;
    }

    return true;
  });

  // Ordenar por data de plantio (mais recente primeiro)
  filtered.sort(function(a, b) {
    return new Date(b.data_plantio) - new Date(a.data_plantio);
  });

  return filtered;
}

/**
 * Lista plantas com paginação
 * 
 * @param {Object} filters - Filtros de busca
 * @param {Object} pagination - {page, pageSize}
 * @returns {Object} {items, page, pageSize, total, totalPages}
 */
function listPlantas_(filters, pagination) {
  filters = filters || {};
  pagination = pagination || {page: 1, pageSize: 20};

  const allRows = getAllRows_('DB_CULTIVO_PLANTAS');

  // Aplicar filtros
  let filtered = allRows.filter(function(row) {
    // Filtro por paciente
    if (filters.paciente_id && row.paciente_id !== filters.paciente_id) {
      return false;
    }

    // Filtro por status
    if (filters.status && row.status !== filters.status) {
      return false;
    }

    // Filtro por fase
    if (filters.fase && row.fase !== filters.fase) {
      return false;
    }

    return true;
  });

  // Ordenar por data de plantio (mais recente primeiro)
  filtered.sort(function(a, b) {
    return new Date(b.data_plantio) - new Date(a.data_plantio);
  });

  // Paginar
  const page = Math.max(1, pagination.page || 1);
  const pageSize = Math.max(1, Math.min(100, pagination.pageSize || 20));
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
// ATUALIZAÇÃO DE PLANTA
// ============================================================================

/**
 * Atualiza dados da planta
 * 
 * @param {string} id - UUID da planta
 * @param {Object} updates - Campos a atualizar
 * @returns {Object} Planta atualizada
 */
function updatePlanta_(id, updates) {
  if (!id) {
    throw new Error('ID da planta é obrigatório');
  }

  const existing = getPlantaById_(id);
  if (!existing) {
    throw new Error('Planta não encontrada');
  }

  // Proteger campos imutáveis
  delete updates.id;
  delete updates.paciente_id;
  delete updates.data_plantio;

  // Validar fase se fornecida
  if (updates.fase) {
    const fasesValidas = ['GERMINACAO', 'VEGETATIVO', 'FLORACAO', 'SECAGEM', 'CURA'];
    if (fasesValidas.indexOf(updates.fase) === -1) {
      throw new Error('Fase inválida');
    }
  }

  // Validar status se fornecido
  if (updates.status) {
    const statusValidos = ['ATIVA', 'COLHIDA', 'DESCARTADA'];
    if (statusValidos.indexOf(updates.status) === -1) {
      throw new Error('Status inválido');
    }
  }

  // Persistir
  const success = updateRowById_('DB_CULTIVO_PLANTAS', id, updates);

  if (!success) {
    throw new Error('Falha ao atualizar planta');
  }

  return getPlantaById_(id);
}

/**
 * Avança planta para próxima fase fenológica
 * 
 * @param {string} id - UUID da planta
 * @returns {Object} Planta atualizada
 */
function avancarFaseFenologica_(id) {
  const planta = getPlantaById_(id);
  if (!planta) {
    throw new Error('Planta não encontrada');
  }

  const sequenciaFases = ['GERMINACAO', 'VEGETATIVO', 'FLORACAO', 'SECAGEM', 'CURA'];
  const faseAtualIndex = sequenciaFases.indexOf(planta.fase);

  if (faseAtualIndex === -1) {
    throw new Error('Fase atual inválida');
  }

  if (faseAtualIndex === sequenciaFases.length - 1) {
    throw new Error('Planta já está na fase final (CURA)');
  }

  const proximaFase = sequenciaFases[faseAtualIndex + 1];

  return updatePlanta_(id, {fase: proximaFase});
}

/**
 * Marca planta como colhida
 * 
 * @param {string} id - UUID da planta
 * @returns {Object} Planta atualizada
 */
function colherPlanta_(id) {
  return updatePlanta_(id, {
    status: 'COLHIDA',
    fase: 'CURA'
  });
}

// ============================================================================
// ESTATÍSTICAS DE CULTIVO
// ============================================================================

/**
 * Retorna estatísticas de cultivo do paciente
 * 
 * @param {string} pacienteId - UUID do paciente
 * @returns {Object} Estatísticas
 */
function getEstatisticasCultivo_(pacienteId) {
  const plantas = getPlantasByPacienteId_(pacienteId, {});

  const stats = {
    total: plantas.length,
    ativas: 0,
    colhidas: 0,
    descartadas: 0,
    porFase: {
      GERMINACAO: 0,
      VEGETATIVO: 0,
      FLORACAO: 0,
      SECAGEM: 0,
      CURA: 0
    },
    porQuimiotipo: {}
  };

  plantas.forEach(function(p) {
    // Contar por status
    if (p.status === 'ATIVA') stats.ativas++;
    if (p.status === 'COLHIDA') stats.colhidas++;
    if (p.status === 'DESCARTADA') stats.descartadas++;

    // Contar por fase
    if (stats.porFase[p.fase] !== undefined) {
      stats.porFase[p.fase]++;
    }

    // Contar por quimiotipo
    if (!stats.porQuimiotipo[p.quimiotipo]) {
      stats.porQuimiotipo[p.quimiotipo] = 0;
    }
    stats.porQuimiotipo[p.quimiotipo]++;
  });

  return stats;
}

// ============================================================================
// EXPORTAR
// ============================================================================

const CULTIVO_PLANTA_REPOSITORY_LOADED = true;
