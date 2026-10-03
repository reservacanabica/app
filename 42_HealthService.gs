/**
 * COMPONENTE: 42_HealthService.gs
 * PAPEL: Verificação de saúde do sistema
 *
 * RESPONSABILIDADE:
 * - Validar configurações obrigatórias
 * - Verificar schema (todas as abas existem e têm cabeçalhos corretos)
 * - Verificar conectividade
 * - Retornar relatório detalhado
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// HEALTH CHECK PRINCIPAL
// ============================================================================

/**
 * Executa health check completo
 *
 * @returns {object} relatório de saúde
 */
function getHealthReport_() {
  const startTime = nowUnix_();
  
  const report = {
    timestamp: nowIso_(),
    version: APP_VERSION,
    healthy: true,
    components: {}
  };

  // 1. Configuração
  report.components.config = checkConfiguration_();
  if (!report.components.config.ok) {
    report.healthy = false;
  }

  // 2. Conectividade
  report.components.connectivity = checkConnectivity_();
  if (!report.components.connectivity.ok) {
    report.healthy = false;
  }

  // 3. Schema
  report.components.schema = checkSchema_();
  if (!report.components.schema.ok) {
    report.healthy = false;
  }

  // 4. Permissões
  report.components.permissions = checkPermissions_();
  if (!report.components.permissions.ok) {
    report.healthy = false;
  }

  // 5. Dados de Teste
  report.components.sampleData = checkSampleData_();

  const duration = nowUnix_() - startTime;
  report.durationMs = duration;
  report.meta = {
    status: report.healthy ? 'HEALTHY' : 'UNHEALTHY',
    timestamp: nowIso_()
  };

  return report;
}

// ============================================================================
// VERIFICAÇÕES INDIVIDUAIS
// ============================================================================

/**
 * Verifica configuração
 */
function checkConfiguration_() {
  const checks = [];
  
  // Verificar SPREADSHEETS_ID
  try {
    getSpreadsheetId_();
    checks.push({ name: 'SPREADSHEETS_ID', ok: true });
  } catch (e) {
    checks.push({ name: 'SPREADSHEETS_ID', ok: false, error: e.message });
  }

  // Verificar SESSION_TTL_HOURS
  try {
    const ttl = getSessionTTLHours_();
    checks.push({ name: 'SESSION_TTL_HOURS', ok: ttl > 0, value: ttl });
  } catch (e) {
    checks.push({ name: 'SESSION_TTL_HOURS', ok: false, error: e.message });
  }

  // Verificar LOG_LEVEL
  try {
    const level = getLogLevel_();
    checks.push({ name: 'LOG_LEVEL', ok: true, value: level });
  } catch (e) {
    checks.push({ name: 'LOG_LEVEL', ok: false, error: e.message });
  }

  const allOk = checks.every(function(c) { return c.ok; });
  
  return {
    ok: allOk,
    checks: checks,
    summary: allOk ? 'Todas as propriedades configuradas' : 'Faltam propriedades obrigatórias'
  };
}

/**
 * Verifica conectividade com Sheets
 */
function checkConnectivity_() {
  const checks = [];
  
  try {
    const spreadsheet = getSpreadsheet_();
    checks.push({
      name: 'Spreadsheet Access',
      ok: true,
      value: spreadsheet.getName()
    });
  } catch (e) {
    checks.push({
      name: 'Spreadsheet Access',
      ok: false,
      error: e.message
    });
    return {
      ok: false,
      checks: checks,
      summary: 'Não conseguiu conectar à planilha'
    };
  }

  try {
    const sheets = getSpreadsheet_().getSheets();
    checks.push({
      name: 'Sheet Enumeration',
      ok: true,
      value: sheets.length + ' abas'
    });
  } catch (e) {
    checks.push({
      name: 'Sheet Enumeration',
      ok: false,
      error: e.message
    });
  }

  const allOk = checks.every(function(c) { return c.ok; });
  
  return {
    ok: allOk,
    checks: checks,
    summary: allOk ? 'Conectividade OK' : 'Problemas de conectividade'
  };
}

/**
 * Verifica schema
 */
function checkSchema_() {
  const report = validateAllSheets_();
  
  const ok = report.invalidSheets.length === 0 &&
             report.missingSheets.length === 0;

  return {
    ok: ok,
    report: report,
    summary: ok ? 'Schema válido' : 'Problemas no schema'
  };
}

/**
 * Verifica RBAC matrix
 */
function checkPermissions_() {
  const checks = [];

  // Verificar que todos os roles estão em ROLE_PERMISSIONS
  Object.keys(USER_ROLES).forEach(function(roleKey) {
    const role = USER_ROLES[roleKey];
    const hasPermissions = ROLE_PERMISSIONS.hasOwnProperty(role);
    checks.push({
      role: role,
      ok: hasPermissions,
      permissions: hasPermissions ? ROLE_PERMISSIONS[role].length : 0
    });
  });

  const allOk = checks.every(function(c) { return c.ok; });

  return {
    ok: allOk,
    checks: checks,
    summary: allOk ? 'RBAC matrix OK' : 'Problemas na matriz de permissões'
  };
}

/**
 * Verifica dados de teste
 */
function checkSampleData_() {
  const counts = {};
  
  Object.keys(SHEET_SCHEMA).forEach(function(sheetName) {
    try {
      const count = getRowCount_(sheetName);
      counts[sheetName] = count;
    } catch (e) {
      counts[sheetName] = 'ERROR: ' + e.message;
    }
  });

  return {
    counts: counts,
    summary: 'Dados existentes nas abas'
  };
}

// ============================================================================
// RESUMO SIMPLES
// ============================================================================

/**
 * Retorna apenas status (simples)
 */
function getHealthStatus_() {
  const report = getHealthReport_();
  
  return {
    healthy: report.healthy,
    status: report.meta.status,
    timestamp: report.timestamp,
    version: report.version
  };
}

/**
 * Retorna relatório formatado para exibição
 */
function getHealthReportFormatted_() {
  const report = getHealthReport_();
  
  let output = '═══════════════════════════════════════════\n';
  output += '  HEALTH CHECK — ' + (report.healthy ? '✅ HEALTHY' : '❌ UNHEALTHY') + '\n';
  output += '═══════════════════════════════════════════\n\n';
  
  output += 'Version: ' + report.version + '\n';
  output += 'Timestamp: ' + report.timestamp + '\n';
  output += 'Duration: ' + report.durationMs + 'ms\n\n';
  
  // Configuração
  output += '📋 CONFIGURAÇÃO\n';
  const configReport = report.components.config;
  output += '   Status: ' + (configReport.ok ? '✅' : '❌') + '\n';
  configReport.checks.forEach(function(check) {
    output += '   • ' + check.name + ': ' + (check.ok ? '✅' : '❌');
    if (check.value) output += ' (' + check.value + ')';
    if (check.error) output += ' ERROR: ' + check.error;
    output += '\n';
  });
  output += '\n';
  
  // Conectividade
  output += '🌐 CONECTIVIDADE\n';
  const connReport = report.components.connectivity;
  output += '   Status: ' + (connReport.ok ? '✅' : '❌') + '\n';
  connReport.checks.forEach(function(check) {
    output += '   • ' + check.name + ': ' + (check.ok ? '✅' : '❌');
    if (check.value) output += ' (' + check.value + ')';
    if (check.error) output += ' ERROR: ' + check.error;
    output += '\n';
  });
  output += '\n';
  
  // Schema
  output += '📊 SCHEMA\n';
  const schemaReport = report.components.schema;
  output += '   Status: ' + (schemaReport.ok ? '✅' : '❌') + '\n';
  output += '   Abas válidas: ' + schemaReport.report.validSheets + '/' + schemaReport.report.totalSheets + '\n';
  if (schemaReport.report.missingSheets.length > 0) {
    output += '   Faltando: ' + schemaReport.report.missingSheets.join(', ') + '\n';
  }
  if (schemaReport.report.invalidSheets.length > 0) {
    output += '   Inválidas: ' + schemaReport.report.invalidSheets.length + '\n';
  }
  output += '\n';
  
  // RBAC
  output += '🔐 PERMISSÕES (RBAC)\n';
  const permReport = report.components.permissions;
  output += '   Status: ' + (permReport.ok ? '✅' : '❌') + '\n';
  permReport.checks.forEach(function(check) {
    output += '   • ' + check.role + ': ' + check.permissions + ' permissões\n';
  });
  output += '\n';
  
  // Dados
  output += '📈 DADOS\n';
  const dataReport = report.components.sampleData;
  Object.keys(dataReport.counts).forEach(function(sheet) {
    const count = dataReport.counts[sheet];
    output += '   • ' + sheet + ': ' + count + ' registros\n';
  });
  
  output += '\n═══════════════════════════════════════════\n';
  
  return output;
}

// ============================================================================
// QUICK CHECKS
// ============================================================================

/**
 * Verifica se sistema está pronto para uso
 */
function isSystemReady_() {
  const config = checkConfiguration_();
  const connectivity = checkConnectivity_();
  const schema = checkSchema_();

  return config.ok && connectivity.ok && schema.ok;
}

/**
 * Retorna lista de problemas
 */
function getHealthProblems_() {
  const report = getHealthReport_();
  const problems = [];

  if (!report.components.config.ok) {
    report.components.config.checks.forEach(function(c) {
      if (!c.ok) {
        problems.push('CONFIG: ' + c.name + ' — ' + c.error);
      }
    });
  }

  if (!report.components.connectivity.ok) {
    report.components.connectivity.checks.forEach(function(c) {
      if (!c.ok) {
        problems.push('CONNECTIVITY: ' + c.name + ' — ' + c.error);
      }
    });
  }

  if (!report.components.schema.ok) {
    const schemaReport = report.components.schema.report;
    if (schemaReport.missingSheets.length > 0) {
      problems.push('SCHEMA: Abas faltando — ' + schemaReport.missingSheets.join(', '));
    }
    if (schemaReport.invalidSheets.length > 0) {
      problems.push('SCHEMA: Abas inválidas — ' + schemaReport.invalidSheets.length);
    }
  }

  return problems;
}

// ============================================================================
// EXPORTAR
// ============================================================================

const HEALTH_SERVICE_LOADED = true;
