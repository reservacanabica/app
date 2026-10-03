/**
 * COMPONENTE: 37_ExportService.gs
 * PAPEL: Serviço de exportação de dados (CSV/JSON)
 *
 * RESPONSABILIDADE:
 * - Exportar dados em múltiplos formatos
 * - Sanitizar dados sensíveis (senhas, tokens)
 * - Suporte a filtros e seleção de campos
 * - Gerar relatórios estruturados
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// SANITIZAÇÃO
// ============================================================================

/**
 * Campos que NUNCA devem ser exportados (sensíveis)
 */
const SENSITIVE_FIELDS = ['password', 'token', 'secret', 'apiKey', 'privateKey'];

/**
 * Sanitiza um objeto removendo campos sensíveis
 *
 * @param {object} obj
 * @returns {object}
 */
function sanitizeForExport_(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = {};

  Object.keys(obj).forEach(function(key) {
    // Verificar se campo é sensível
    const isSensitive = SENSITIVE_FIELDS.some(function(sensitive) {
      return key.toLowerCase().includes(sensitive.toLowerCase());
    });

    if (!isSensitive) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitized[key] = sanitizeForExport_(obj[key]);
      } else {
        sanitized[key] = obj[key];
      }
    }
  });

  return sanitized;
}

/**
 * Sanitiza array de objetos
 *
 * @param {array} data
 * @returns {array}
 */
function sanitizeArrayForExport_(data) {
  if (!Array.isArray(data)) {
    return data;
  }

  return data.map(function(item) {
    return sanitizeForExport_(item);
  });
}

// ============================================================================
// EXPORTAR PARA CSV
// ============================================================================

/**
 * Exporta dados para CSV
 *
 * @param {array} data
 * @param {object} options — {fields, sanitize}
 * @returns {string}
 */
function exportToCSV_(data, options) {
  try {
    options = options || { sanitize: true };

    if (!Array.isArray(data) || data.length === 0) {
      return 'No data to export';
    }

    // Sanitizar se necessário
    let exportData = data;
    if (options.sanitize !== false) {
      exportData = sanitizeArrayForExport_(data);
    }

    // Selecionar campos
    let fields = options.fields;
    if (!fields) {
      // Usar todos os campos da primeira linha
      fields = Object.keys(exportData[0]);
    }

    // Header
    let csv = fields.join(',') + '\n';

    // Dados
    exportData.forEach(function(item) {
      const values = fields.map(function(field) {
        const value = item[field] || '';

        // Escapar aspas e quebras de linha
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return '"' + value.replace(/"/g, '""') + '"';
        }

        return value;
      });

      csv += values.join(',') + '\n';
    });

    return csv;

  } catch (error) {
    logException_('Erro ao exportar para CSV', error);
    throw error;
  }
}

// ============================================================================
// EXPORTAR PARA JSON
// ============================================================================

/**
 * Exporta dados para JSON
 *
 * @param {array} data
 * @param {object} options — {sanitize, pretty}
 * @returns {string}
 */
function exportToJSON_(data, options) {
  try {
    options = options || { sanitize: true, pretty: true };

    // Sanitizar se necessário
    let exportData = data;
    if (options.sanitize !== false) {
      exportData = sanitizeArrayForExport_(data);
    }

    if (options.pretty) {
      return JSON.stringify(exportData, null, 2);
    } else {
      return JSON.stringify(exportData);
    }

  } catch (error) {
    logException_('Erro ao exportar para JSON', error);
    throw error;
  }
}

// ============================================================================
// EXPORTAÇÃO POR ENTIDADE
// ============================================================================

/**
 * Exporta Studies
 *
 * @param {string} format — "CSV" ou "JSON"
 * @param {object} filters
 * @returns {string}
 */
function exportStudies_(format, filters) {
  try {
    const result = listStudies_(filters, { pageSize: 1000 });
    const data = sanitizeArrayForExport_(result.items);

    if (format === 'CSV') {
      return exportToCSV_(data, { fields: ['id', 'title', 'description', 'hostSpecies', 'status', 'createdAt'] });
    } else {
      return exportToJSON_(data);
    }

  } catch (error) {
    logException_('Erro ao exportar Studies', error);
    throw error;
  }
}

/**
 * Exporta Experiments
 *
 * @param {string} format
 * @param {string} studyId (opcional — filtrar por study)
 * @returns {string}
 */
function exportExperiments_(format, studyId) {
  try {
    let data;

    if (studyId) {
      data = getExperimentsByStudy_(studyId) || [];
    } else {
      const result = listExperiments_({}, { pageSize: 1000 });
      data = result.items;
    }

    data = sanitizeArrayForExport_(data);

    if (format === 'CSV') {
      return exportToCSV_(data, { fields: ['id', 'studyId', 'title', 'protocol', 'replicates', 'status', 'createdAt'] });
    } else {
      return exportToJSON_(data);
    }

  } catch (error) {
    logException_('Erro ao exportar Experiments', error);
    throw error;
  }
}

/**
 * Exporta Observations
 *
 * @param {string} format
 * @param {string} experimentId (opcional)
 * @returns {string}
 */
function exportObservations_(format, experimentId) {
  try {
    let data;

    if (experimentId) {
      data = getObservationsByExperiment_(experimentId) || [];
    } else {
      const result = listObservations_({}, { pageSize: 1000 });
      data = result.items;
    }

    data = sanitizeArrayForExport_(data);

    if (format === 'CSV') {
      return exportToCSV_(data, { fields: ['id', 'experimentId', 'variable', 'value', 'unit', 'replicate', 'timestamp', 'validated'] });
    } else {
      return exportToJSON_(data);
    }

  } catch (error) {
    logException_('Erro ao exportar Observations', error);
    throw error;
  }
}

/**
 * Exporta Study completo (com hierarchy)
 *
 * @param {string} studyId
 * @param {string} format — "CSV" ou "JSON"
 * @returns {string|object}
 */
function exportStudyComplete_(studyId, format) {
  try {
    const study = getStudyById_(studyId);
    if (!study) {
      throwError_('NOT_FOUND', 'Study não encontrado', {});
    }

    const experiments = getExperimentsByStudy_(studyId) || [];
    const observations = [];

    experiments.forEach(function(exp) {
      const obs = getObservationsByExperiment_(exp.id) || [];
      observations.push.apply(observations, obs);
    });

    const data = {
      study: sanitizeForExport_(study),
      experiments: sanitizeArrayForExport_(experiments),
      observations: sanitizeArrayForExport_(observations),
      metadata: {
        exportedAt: nowIso_(),
        experimentCount: experiments.length,
        observationCount: observations.length
      }
    };

    if (format === 'JSON') {
      return exportToJSON_([data], { pretty: true });
    } else if (format === 'CSV') {
      // Retornar dados estruturados para processamento
      return JSON.stringify(data);
    }

    return data;

  } catch (error) {
    logException_('Erro ao exportar Study completo', error);
    throw error;
  }
}

// ============================================================================
// RELATÓRIOS
// ============================================================================

/**
 * Gera relatório de estudos em JSON
 *
 * @returns {string}
 */
function generateStudiesReport_() {
  try {
    const studies = getStudiesByStatus_(APP_STATUS.ACTIVE);
    const report = {
      timestamp: nowIso_(),
      total: studies.length,
      byHostSpecies: {},
      studies: []
    };

    studies.forEach(function(study) {
      const experiments = getExperimentsByStudy_(study.id) || [];
      let totalObservations = 0;

      experiments.forEach(function(exp) {
        const obs = getObservationsByExperiment_(exp.id) || [];
        totalObservations += obs.length;
      });

      // Agrupar por host species
      if (!report.byHostSpecies[study.hostSpecies]) {
        report.byHostSpecies[study.hostSpecies] = 0;
      }
      report.byHostSpecies[study.hostSpecies]++;

      report.studies.push({
        id: study.id,
        title: study.title,
        hostSpecies: study.hostSpecies,
        experiments: experiments.length,
        observations: totalObservations,
        createdAt: study.createdAt
      });
    });

    return exportToJSON_([report], { pretty: true });

  } catch (error) {
    logException_('Erro ao gerar relatório', error);
    throw error;
  }
}

const EXPORT_SERVICE_LOADED = true;
