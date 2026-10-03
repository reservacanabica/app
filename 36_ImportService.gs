/**
 * COMPONENTE: 36_ImportService.gs
 * PAPEL: Serviço de importação de dados (CSV/JSON)
 *
 * RESPONSABILIDADE:
 * - Parsear CSV/JSON
 * - Validar dados antes de importar
 * - Dry-run para visualizar sem salvar
 * - Suporte a mapeamento de colunas
 * - Relatório de erros e warnings
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// PARSEAR DADOS
// ============================================================================

/**
 * Parseia CSV e retorna array de objetos
 *
 * @param {string} csvContent
 * @returns {array}
 */
function parseCSV_(csvContent) {
  try {
    const lines = csvContent.split('\n').filter(function(line) {
      return line.trim().length > 0;
    });

    if (lines.length < 2) {
      throwError_('VALIDATION_ERROR', 'CSV vazio ou inválido', {});
    }

    // Headers (primeira linha)
    const headers = parseCSVLine_(lines[0]);

    // Dados
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine_(lines[i]);
      const obj = {};

      for (let j = 0; j < headers.length; j++) {
        obj[headers[j].toLowerCase()] = values[j] || '';
      }

      if (Object.keys(obj).some(function(k) { return obj[k] !== ''; })) {
        data.push(obj);
      }
    }

    return data;

  } catch (error) {
    logException_('Erro ao parsear CSV', error);
    throw error;
  }
}

/**
 * Parseia linha CSV (com suporte a quoted fields)
 *
 * @param {string} line
 * @returns {array}
 */
function parseCSVLine_(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Parseia JSON
 *
 * @param {string} jsonContent
 * @returns {array}
 */
function parseJSON_(jsonContent) {
  try {
    const data = JSON.parse(jsonContent);

    if (!Array.isArray(data)) {
      throwError_('VALIDATION_ERROR', 'JSON deve ser um array', {});
    }

    return data;

  } catch (error) {
    logException_('Erro ao parsear JSON', error);
    throw error;
  }
}

// ============================================================================
// DRY-RUN (validação sem salvar)
// ============================================================================

/**
 * Executa dry-run de importação
 * Retorna o que seria importado sem realmente importar
 *
 * @param {string} format — "CSV" ou "JSON"
 * @param {string} content — conteúdo bruto
 * @param {string} entityType — "Study", "Experiment", "Observation"
 * @returns {object} {valid, items, errors, warnings}
 */
function dryRunImport_(format, content, entityType) {
  try {
    const startTime = nowUnix_();

    // Parse
    let data;
    if (format === 'CSV') {
      data = parseCSV_(content);
    } else if (format === 'JSON') {
      data = parseJSON_(content);
    } else {
      throwError_('VALIDATION_ERROR', 'Formato desconhecido: ' + format, {});
    }

    // Validar cada item
    const errors = [];
    const warnings = [];
    const validItems = [];

    data.forEach(function(item, index) {
      try {
        const validation = validateImportItem_(item, entityType);

        if (validation.valid) {
          validItems.push(item);
        } else {
          errors.push({
            row: index + 2, // +2 porque começa de 0, +1 por header
            errors: validation.errors
          });

          if (validation.warnings && validation.warnings.length > 0) {
            warnings.push({
              row: index + 2,
              warnings: validation.warnings
            });
          }
        }

      } catch (error) {
        errors.push({
          row: index + 2,
          error: error.message
        });
      }
    });

    const duration = nowUnix_() - startTime;

    return {
      valid: errors.length === 0,
      format: format,
      entityType: entityType,
      totalRows: data.length,
      validRows: validItems.length,
      invalidRows: errors.length,
      items: validItems,
      errors: errors,
      warnings: warnings,
      duration: duration,
      timestamp: nowIso_()
    };

  } catch (error) {
    logException_('Erro no dry-run', error);
    throw error;
  }
}

/**
 * Valida item individual para importação
 *
 * @param {object} item
 * @param {string} entityType
 * @returns {object} {valid, errors, warnings}
 */
function validateImportItem_(item, entityType) {
  const errors = [];
  const warnings = [];

  if (entityType === 'Study') {
    if (!item.title || item.title.length < 3) {
      errors.push('Title obrigatório e mínimo 3 caracteres');
    }
    if (!item.host_species && !item.hostspecies) {
      errors.push('Host species obrigatório');
    }
  } else if (entityType === 'Experiment') {
    if (!item.study_id && !item.studyid) {
      errors.push('Study ID obrigatório');
    }
    if (!item.title) {
      errors.push('Title obrigatório');
    }
    if (!item.protocol) {
      errors.push('Protocol obrigatório');
    }
  } else if (entityType === 'Observation') {
    if (!item.experiment_id && !item.experimentid) {
      errors.push('Experiment ID obrigatório');
    }
    if (!item.variable) {
      errors.push('Variable obrigatório');
    }
    if (!item.value || isNaN(item.value)) {
      errors.push('Value deve ser numérico');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

// ============================================================================
// IMPORTAÇÃO REAL
// ============================================================================

/**
 * Importa dados (após validação)
 *
 * @param {string} format
 * @param {string} content
 * @param {string} entityType
 * @param {string} userId
 * @returns {object} {imported, failed, details}
 */
function importData_(format, content, entityType, userId) {
  try {
    // Primeiro, dry-run
    const dryRun = dryRunImport_(format, content, entityType);

    if (!dryRun.valid) {
      logWarn_('Importação com erros de validação', {
        format: format,
        entityType: entityType,
        errors: dryRun.errors.length
      });

      return {
        success: false,
        dryRun: dryRun,
        error: 'Existem erros de validação'
      };
    }

    // Importar itens válidos
    const imported = [];
    const failed = [];

    dryRun.items.forEach(function(item, index) {
      try {
        let created;

        if (entityType === 'Study') {
          created = createNewStudy_(userId, normalizeStudyData_(item));
          imported.push(created);
        } else if (entityType === 'Experiment') {
          created = createNewExperiment_(userId, normalizeExperimentData_(item));
          imported.push(created);
        } else if (entityType === 'Observation') {
          created = createNewObservation_(userId, normalizeObservationData_(item));
          imported.push(created);
        }

        auditCreate_(entityType, created.id, userId, {
          source: 'IMPORT',
          format: format,
          rowIndex: index
        });

      } catch (error) {
        failed.push({
          index: index,
          item: item,
          error: error.message
        });
      }
    });

    logInfo_('Importação completa', {
      format: format,
      entityType: entityType,
      userId: userId,
      imported: imported.length,
      failed: failed.length
    });

    return {
      success: failed.length === 0,
      imported: imported,
      failed: failed,
      stats: {
        total: dryRun.items.length,
        imported: imported.length,
        failed: failed.length
      },
      timestamp: nowIso_()
    };

  } catch (error) {
    logException_('Erro na importação', error);
    throw error;
  }
}

// ============================================================================
// NORMALIZADORES DE DADOS
// ============================================================================

/**
 * Normaliza dados de Study do CSV
 */
function normalizeStudyData_(item) {
  return {
    title: item.title || item.title,
    description: item.description || item.description || '',
    hostSpecies: item.host_species || item.hostspecies || '',
    fungalStrain: item.fungal_strain || item.fungalstrain || '',
    cultivar: item.cultivar || item.cultivar || '',
    objective: item.objective || item.objective || '',
    status: item.status || 'DRAFT'
  };
}

/**
 * Normaliza dados de Experiment do CSV
 */
function normalizeExperimentData_(item) {
  return {
    studyId: item.study_id || item.studyid || '',
    title: item.title || '',
    protocol: item.protocol || '',
    design: item.design || item.design || '',
    replicates: parseInt(item.replicates) || 3,
    treatments: item.treatments ? JSON.parse(item.treatments) : [],
    conditions: item.conditions ? JSON.parse(item.conditions) : {}
  };
}

/**
 * Normaliza dados de Observation do CSV
 */
function normalizeObservationData_(item) {
  return {
    experimentId: item.experiment_id || item.experimentid || '',
    variable: item.variable || '',
    value: parseFloat(item.value) || 0,
    unit: item.unit || '',
    groupName: item.group_name || item.groupname || '',
    replicate: parseInt(item.replicate) || 0,
    timestamp: item.timestamp || nowIso_(),
    notes: item.notes || item.notes || ''
  };
}

// ============================================================================
// EXPORTAÇÃO PARA IMPORT
// ============================================================================

/**
 * Gera template CSV para importação
 *
 * @param {string} entityType
 * @returns {string}
 */
function generateImportTemplate_(entityType) {
  let headers = [];

  if (entityType === 'Study') {
    headers = ['title', 'description', 'host_species', 'fungal_strain', 'cultivar', 'objective'];
  } else if (entityType === 'Experiment') {
    headers = ['study_id', 'title', 'protocol', 'design', 'replicates', 'treatments', 'conditions'];
  } else if (entityType === 'Observation') {
    headers = ['experiment_id', 'variable', 'value', 'unit', 'group_name', 'replicate', 'timestamp', 'notes'];
  }

  // Criar linha de headers + uma linha de exemplo
  const csvHeaders = headers.join(',');
  const csvExample = headers.map(function() { return '[example]'; }).join(',');

  return csvHeaders + '\n' + csvExample;
}

const IMPORT_SERVICE_LOADED = true;
