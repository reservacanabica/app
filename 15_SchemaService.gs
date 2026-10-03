/**
 * COMPONENTE: 15_SchemaService.gs
 * PAPEL: Criação e verificação idempotente de schema
 *
 * FUNÇÃO CRÍTICA:
 * - Chamada UMA VEZ por 45_SetupService.gs durante setupProject_()
 * - Cria todas as 10 abas com cabeçalhos corretos
 * - IDEMPOTENTE — pode ser executada múltiplas vezes sem problemas
 * - Valida integridade do schema
 *
 * STATUS: v2.0 — Implementado e testado
 */

// ============================================================================
// INICIALIZAÇÃO DE SCHEMA
// ============================================================================

/**
 * Cria schema completo (idempotente)
 * Chamado por setupProject_() na primeira execução
 *
 * @returns {object} relatório de schema
 */
function initializeSchema_() {
  logInfo_('Iniciando schema setup', {});

  const report = {
    timestamp: nowIso_(),
    created: [],
    verified: [],
    errors: []
  };

  // Iterar sobre todas as abas definidas em SHEET_SCHEMA
  Object.keys(SHEET_SCHEMA).forEach(function(sheetName) {
    try {
      const schema = SHEET_SCHEMA[sheetName];
      const columns = schema.columns;

      if (sheetExists_(sheetName)) {
        // Aba existe — verificar integridade
        const status = verifySheetIntegrity_(sheetName, columns);
        if (status.valid) {
          report.verified.push(sheetName);
          logInfo_('Aba verificada: ' + sheetName, status);
        } else {
          report.errors.push({
            sheet: sheetName,
            error: 'Integridade comprometida',
            details: status.issues
          });
          logError_('Aba com problema: ' + sheetName, status.issues);
        }
      } else {
        // Aba não existe — criar
        createSheetWithHeaders_(sheetName, columns);
        report.created.push(sheetName);
        logInfo_('Aba criada: ' + sheetName, {
          columns: columns.length
        });
      }
    } catch (error) {
      report.errors.push({
        sheet: sheetName,
        error: error.message
      });
      logError_('Erro ao processar ' + sheetName, { error: error.message });
    }
  });

  logInfo_('Schema setup concluído', report);
  return report;
}

// ============================================================================
// VERIFICAÇÃO DE INTEGRIDADE
// ============================================================================

/**
 * Verifica se aba tem cabeçalhos corretos
 *
 * @param {string} sheetName
 * @param {array} expectedColumns
 * @returns {object} {valid, issues}
 */
function verifySheetIntegrity_(sheetName, expectedColumns) {
  const actualHeaders = getSheetHeaders_(sheetName);

  const issues = [];

  // Verificar quantidade de colunas
  if (actualHeaders.length !== expectedColumns.length) {
    issues.push({
      type: 'COLUMN_COUNT_MISMATCH',
      expected: expectedColumns.length,
      actual: actualHeaders.length
    });
  }

  // Verificar nomes de colunas
  for (let i = 0; i < expectedColumns.length; i++) {
    if (actualHeaders[i] !== expectedColumns[i]) {
      issues.push({
        type: 'COLUMN_NAME_MISMATCH',
        position: i + 1,
        expected: expectedColumns[i],
        actual: actualHeaders[i] || '(missing)'
      });
    }
  }

  return {
    valid: issues.length === 0,
    issues: issues,
    actualHeaders: actualHeaders,
    expectedHeaders: expectedColumns
  };
}

/**
 * Valida todas as abas e retorna relatório
 *
 * @returns {object} relatório completo
 */
function validateAllSheets_() {
  const report = {
    timestamp: nowIso_(),
    totalSheets: 0,
    validSheets: 0,
    invalidSheets: [],
    missingSheets: [],
    details: []
  };

  Object.keys(SHEET_SCHEMA).forEach(function(sheetName) {
    report.totalSheets++;

    if (!sheetExists_(sheetName)) {
      report.missingSheets.push(sheetName);
      report.details.push({
        sheet: sheetName,
        status: 'MISSING'
      });
      return;
    }

    const schema = SHEET_SCHEMA[sheetName];
    const status = verifySheetIntegrity_(sheetName, schema.columns);

    if (status.valid) {
      report.validSheets++;
      const stats = getSheetStats_(sheetName);
      report.details.push({
        sheet: sheetName,
        status: 'VALID',
        stats: stats
      });
    } else {
      report.invalidSheets.push({
        sheet: sheetName,
        issues: status.issues
      });
      report.details.push({
        sheet: sheetName,
        status: 'INVALID',
        issues: status.issues
      });
    }
  });

  return report;
}

/**
 * Valida relações (foreign keys)
 * NOTA: Esta é uma validação básica. Validação completa fica em 35_ValidationRunService.gs
 *
 * @returns {object}
 */
function validateRelations_() {
  const report = {
    timestamp: nowIso_(),
    checks: [],
    errors: []
  };

  // Verificar que Experiments.studyId referencia Studies.id
  try {
    const experiments = getAllRowsAsObjects_('Experiments');
    const studies = getAllRowsAsObjects_('Studies');
    const studyIds = studies.map(function(s) { return s.id; });

    let orphanedExperiments = 0;
    experiments.forEach(function(exp) {
      if (!studyIds.includes(exp.studyId)) {
        orphanedExperiments++;
      }
    });

    if (orphanedExperiments > 0) {
      report.errors.push({
        relation: 'Experiments.studyId → Studies.id',
        orphaned: orphanedExperiments
      });
    } else {
      report.checks.push({
        relation: 'Experiments.studyId → Studies.id',
        status: 'OK'
      });
    }
  } catch (error) {
    report.errors.push({
      check: 'Experiments → Studies',
      error: error.message
    });
  }

  // Verificar que Observations.experimentId referencia Experiments.id
  try {
    const observations = getAllRowsAsObjects_('Observations');
    const experiments = getAllRowsAsObjects_('Experiments');
    const experimentIds = experiments.map(function(e) { return e.id; });

    let orphanedObservations = 0;
    observations.forEach(function(obs) {
      if (!experimentIds.includes(obs.experimentId)) {
        orphanedObservations++;
      }
    });

    if (orphanedObservations > 0) {
      report.errors.push({
        relation: 'Observations.experimentId → Experiments.id',
        orphaned: orphanedObservations
      });
    } else {
      report.checks.push({
        relation: 'Observations.experimentId → Experiments.id',
        status: 'OK'
      });
    }
  } catch (error) {
    report.errors.push({
      check: 'Observations → Experiments',
      error: error.message
    });
  }

  return report;
}

// ============================================================================
// RELATÓRIOS
// ============================================================================

/**
 * Gera relatório completo de schema
 *
 * @returns {object}
 */
function getSchemaReport_() {
  const sheetValidation = validateAllSheets_();
  const relationValidation = validateRelations_();

  return {
    timestamp: nowIso_(),
    version: APP_VERSION,
    sheets: sheetValidation,
    relations: relationValidation,
    isHealthy: sheetValidation.invalidSheets.length === 0 &&
               sheetValidation.missingSheets.length === 0 &&
               relationValidation.errors.length === 0
  };
}

/**
 * Exibe estrutura de schema em formato legível
 *
 * @returns {string}
 */
function getSchemaDescription_() {
  let desc = 'SCHEMA DO SISTEMA CANABICA v' + APP_VERSION + '\n\n';

  Object.keys(SHEET_SCHEMA).forEach(function(sheetName) {
    const schema = SHEET_SCHEMA[sheetName];
    desc += '📋 ' + sheetName + '\n';
    desc += '   ' + schema.description + '\n';
    desc += '   Colunas: ' + schema.columns.length + '\n';
    schema.columns.forEach(function(col, idx) {
      desc += '     ' + (idx + 1) + '. ' + col + '\n';
    });
    desc += '\n';
  });

  return desc;
}

// ============================================================================
// RECRIAÇÃO DE SCHEMA (destrutivo)
// ============================================================================

/**
 * DESTRUTIVO: Deleta e recria todas as abas (limpa dados!)
 * Use apenas para teste ou reset completo
 *
 * @returns {object} relatório
 */
function resetSchemaDestructive_() {
  if (!isDebugMode_()) {
    throw new Error('resetSchemaDestructive_ requer DEBUG_MODE=true');
  }

  logWarn_('RESETTING SCHEMA (DESTRUTIVO)', {});

  const report = {
    deleted: [],
    created: [],
    timestamp: nowIso_()
  };

  // Deletar abas existentes
  Object.keys(SHEET_SCHEMA).forEach(function(sheetName) {
    try {
      if (sheetExists_(sheetName)) {
        deleteSheet_(sheetName);
        report.deleted.push(sheetName);
      }
    } catch (error) {
      logError_('Erro ao deletar ' + sheetName, { error: error.message });
    }
  });

  // Recriar abas
  Object.keys(SHEET_SCHEMA).forEach(function(sheetName) {
    try {
      const schema = SHEET_SCHEMA[sheetName];
      createSheetWithHeaders_(sheetName, schema.columns);
      report.created.push(sheetName);
    } catch (error) {
      logError_('Erro ao criar ' + sheetName, { error: error.message });
    }
  });

  logInfo_('Schema reset completo', report);
  return report;
}

// ============================================================================
// EXPORTAR
// ============================================================================

const SCHEMA_SERVICE_LOADED = true;
