/**
 * COMPONENTE: 63_TestRunner.gs
 * PAPEL: Runner principal e relatórios de testes
 * 
 * FUNCIONALIDADES:
 * - Execução de todas as suites
 * - Geração de relatórios HTML
 * - Integração com API REST
 * - Triggers automáticos
 */

/**
 * Função principal: executa todos os testes
 * @returns {Object} Resultados consolidados
 */
function runAllTests() {
  logInfo_('='.repeat(60));
  logInfo_('CANABICA WEBAPP - TEST SUITE');
  logInfo_('='.repeat(60));
  
  const startTime = Date.now();
  
  try {
    // Cria backup de segurança antes dos testes
    logInfo_('Criando backup de segurança...');
    const safetyBackup = createBackup_('AUTO', 'Safety backup before tests');
    
    logInfo_('Iniciando testes...');
    logInfo_('');
    
    // Executa todos os testes
    const results = TestFramework.runAllTests();
    
    const duration = Date.now() - startTime;
    
    // Log resumo
    logInfo_('');
    logInfo_('='.repeat(60));
    logInfo_('RESUMO DOS TESTES');
    logInfo_('='.repeat(60));
    logInfo_('Total de testes: ' + results.totalTests);
    logInfo_('✓ Passou: ' + results.passed + ' (' + 
             (results.passed / results.totalTests * 100).toFixed(1) + '%)');
    logInfo_('✗ Falhou: ' + results.failed);
    logInfo_('⊘ Pulado: ' + results.skipped);
    logInfo_('Duração total: ' + (duration / 1000).toFixed(2) + 's');
    logInfo_('='.repeat(60));
    
    // Gera relatório HTML
    const reportUrl = generateHtmlReport_(results);
    if (reportUrl) {
      logInfo_('Relatório HTML: ' + reportUrl);
    }
    
    // Notifica em caso de falhas
    if (results.failed > 0) {
      logError_('ATENÇÃO: ' + results.failed + ' teste(s) falharam!');
      notifyTestFailures_(results);
    }
    
    // Retorna resultados
    return {
      success: results.failed === 0,
      results: results,
      safetyBackup: safetyBackup.backupId,
      duration: duration,
      reportUrl: reportUrl || null
    };
    
  } catch (error) {
    logError_('Erro fatal durante execução dos testes: ' + error.message);
    logError_(error.stack);
    
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Executa suite específica de testes
 * @param {string} suiteName - Nome da suite
 * @returns {Object} Resultados
 */
function runTestSuite(suiteName) {
  _testRunner = new TestRunner();
  
  switch(suiteName) {
    case 'auth':
      registerAuthTests_();
      break;
    case 'crud':
      registerCrudTests_();
      break;
    case 'cache':
      registerCacheTests_();
      break;
    case 'features':
      registerFeatureFlagTests_();
      break;
    case 'backup':
      registerBackupTests_();
      break;
    case 'observability':
      registerObservabilityTests_();
      break;
    case 'integration':
      registerIntegrationTests_();
      break;
    default:
      throw new Error('Suite desconhecida: ' + suiteName);
  }
  
  const results = _testRunner.run();
  cleanupTestData_();
  
  return results;
}

/**
 * Gera relatório HTML dos testes
 * @param {Object} results - Resultados dos testes
 * @returns {string} URL do relatório ou null
 */
function generateHtmlReport_(results) {
  try {
    const html = buildHtmlReport_(results);
    
    // Salva em Drive (se configurado) ou retorna HTML
    // Por ora, apenas retorna estrutura do relatório
    
    const report = {
      timestamp: results.startTime,
      summary: {
        total: results.totalTests,
        passed: results.passed,
        failed: results.failed,
        skipped: results.skipped,
        passRate: (results.passed / results.totalTests * 100).toFixed(2) + '%',
        duration: results.duration + 'ms'
      },
      suites: results.suites
    };
    
    // Salva relatório em aba TestReports
    try {
      appendRecord_('TestReports', {
        timestamp: results.startTime.toISOString(),
        summary: JSON.stringify(report.summary),
        suites: JSON.stringify(report.suites),
        status: results.failed === 0 ? 'SUCCESS' : 'FAILURE'
      });
    } catch (e) {
      logWarn_('Não foi possível salvar relatório: ' + e.message);
    }
    
    return null; // URL seria retornada se salvasse em Drive
    
  } catch (error) {
    logError_('Erro ao gerar relatório HTML: ' + error.message);
    return null;
  }
}

/**
 * Constrói HTML do relatório
 * @param {Object} results
 * @returns {string} HTML
 */
function buildHtmlReport_(results) {
  const passRate = (results.passed / results.totalTests * 100).toFixed(1);
  const status = results.failed === 0 ? 'SUCCESS' : 'FAILURE';
  const statusColor = status === 'SUCCESS' ? '#10b981' : '#ef4444';
  
  let html = '<!DOCTYPE html>\n';
  html += '<html><head><meta charset="UTF-8">\n';
  html += '<title>Test Report - Canabica WebApp</title>\n';
  html += '<style>\n';
  html += 'body { font-family: monospace; padding: 20px; background: #0f172a; color: #e2e8f0; }\n';
  html += '.header { border-bottom: 2px solid ' + statusColor + '; padding-bottom: 20px; }\n';
  html += '.summary { background: #1e293b; padding: 20px; border-radius: 8px; margin: 20px 0; }\n';
  html += '.suite { background: #1e293b; padding: 15px; margin: 10px 0; border-radius: 8px; }\n';
  html += '.test { padding: 8px; margin: 5px 0; }\n';
  html += '.passed { color: #10b981; }\n';
  html += '.failed { color: #ef4444; }\n';
  html += '.skipped { color: #94a3b8; }\n';
  html += '</style></head><body>\n';
  
  // Header
  html += '<div class="header">\n';
  html += '<h1>🧪 Test Report - Canabica WebApp</h1>\n';
  html += '<p>Status: <strong style="color:' + statusColor + '">' + status + '</strong></p>\n';
  html += '<p>Executed: ' + results.startTime.toISOString() + '</p>\n';
  html += '</div>\n';
  
  // Summary
  html += '<div class="summary">\n';
  html += '<h2>Summary</h2>\n';
  html += '<p>Total Tests: <strong>' + results.totalTests + '</strong></p>\n';
  html += '<p class="passed">✓ Passed: ' + results.passed + ' (' + passRate + '%)</p>\n';
  html += '<p class="failed">✗ Failed: ' + results.failed + '</p>\n';
  html += '<p class="skipped">⊘ Skipped: ' + results.skipped + '</p>\n';
  html += '<p>Duration: ' + (results.duration / 1000).toFixed(2) + 's</p>\n';
  html += '</div>\n';
  
  // Suites
  results.suites.forEach(function(suite) {
    html += '<div class="suite">\n';
    html += '<h3>' + suite.name + '</h3>\n';
    html += '<p>Tests: ' + suite.totalTests + ' | ';
    html += '<span class="passed">✓ ' + suite.passed + '</span> | ';
    html += '<span class="failed">✗ ' + suite.failed + '</span> | ';
    html += 'Duration: ' + suite.duration + 'ms</p>\n';
    
    suite.tests.forEach(function(test) {
      const statusClass = test.status === 'PASSED' ? 'passed' : 
                         test.status === 'FAILED' ? 'failed' : 'skipped';
      const icon = test.status === 'PASSED' ? '✓' : 
                   test.status === 'FAILED' ? '✗' : '⊘';
      
      html += '<div class="test ' + statusClass + '">\n';
      html += icon + ' ' + test.description;
      
      if (test.error) {
        html += '<br><small>' + test.error.message + '</small>';
      }
      
      html += '</div>\n';
    });
    
    html += '</div>\n';
  });
  
  html += '</body></html>';
  
  return html;
}

/**
 * Notifica sobre falhas de testes
 * @param {Object} results
 */
function notifyTestFailures_(results) {
  const failures = [];
  
  results.suites.forEach(function(suite) {
    suite.tests.forEach(function(test) {
      if (test.status === 'FAILED') {
        failures.push({
          suite: suite.name,
          test: test.description,
          error: test.error.message
        });
      }
    });
  });
  
  // Log detalhado das falhas
  logError_('');
  logError_('DETALHES DAS FALHAS:');
  logError_('-'.repeat(60));
  
  failures.forEach(function(failure, index) {
    logError_((index + 1) + '. ' + failure.suite + ' > ' + failure.test);
    logError_('   ' + failure.error);
    logError_('');
  });
  
  // Aqui poderia enviar email, Slack, etc
}

/**
 * Trigger para execução automática de testes
 */
function triggerAutomatedTests_() {
  try {
    logInfo_('Executando testes automáticos via trigger');
    
    const results = runAllTests();
    
    if (!results.success) {
      logError_('Testes automáticos falharam!');
      
      // Envia alerta se configurado
      if (getObservabilityConfig_().alertsEnabled) {
        saveAlert_({
          ruleId: 'automated_tests_failed',
          ruleName: 'Automated Tests Failed',
          severity: 'CRITICAL',
          message: results.results.failed + ' teste(s) falharam na execução automática',
          timestamp: new Date().toISOString(),
          metrics: 'tests.failed',
          threshold: 0,
          actualValue: results.results.failed
        });
      }
    }
    
  } catch (error) {
    logError_('Erro na execução automática de testes: ' + error.message);
  }
}

/**
 * Configura trigger para execução diária de testes
 */
function setupTestTriggers_() {
  // Remove triggers antigos
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'triggerAutomatedTests_') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Cria novo trigger (diário às 2AM)
  ScriptApp.newTrigger('triggerAutomatedTests_')
    .timeBased()
    .atHour(2)
    .everyDays(1)
    .create();
  
  logInfo_('Trigger de testes automáticos configurado (diário às 2AM)');
}

// ===========================
// API HANDLERS
// ===========================

/**
 * Handler para executar todos os testes via API
 */
function runTestsHandler_(request, ctx) {
  const results = runAllTests();
  
  return {
    success: results.success,
    summary: {
      total: results.results.totalTests,
      passed: results.results.passed,
      failed: results.results.failed,
      skipped: results.results.skipped,
      duration: results.duration,
      passRate: (results.results.passed / results.results.totalTests * 100).toFixed(2) + '%'
    },
    safetyBackup: results.safetyBackup,
    reportUrl: results.reportUrl,
    suites: results.results.suites
  };
}

/**
 * Handler para executar suite específica
 */
function runTestSuiteHandler_(request, ctx) {
  const suiteName = request.data.suite;
  
  if (!suiteName) {
    throw createError_('MISSING_SUITE_NAME', 'Nome da suite é obrigatório');
  }
  
  const results = runTestSuite(suiteName);
  
  return {
    success: results.failed === 0,
    suite: suiteName,
    summary: {
      total: results.totalTests,
      passed: results.passed,
      failed: results.failed,
      duration: results.duration
    },
    tests: results.tests
  };
}

/**
 * Handler para listar resultados de testes
 */
function listTestResultsHandler_(request, ctx) {
  const filters = request.filters || {};
  const pagination = request.pagination || {page: 1, pageSize: 20};
  
  const allResults = listRecords_('TestResults', filters);
  
  // Ordena por timestamp (mais recente primeiro)
  allResults.sort(function(a, b) {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });
  
  // Aplica paginação
  const start = (pagination.page - 1) * pagination.pageSize;
  const end = start + pagination.pageSize;
  const paginated = allResults.slice(start, end);
  
  return {
    success: true,
    results: paginated,
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      totalItems: allResults.length,
      totalPages: Math.ceil(allResults.length / pagination.pageSize)
    }
  };
}

/**
 * Handler para configurar triggers de testes
 */
function setupTestTriggersHandler_(request, ctx) {
  setupTestTriggers_();
  
  return {
    success: true,
    message: 'Triggers de testes configurados (diário às 2AM)'
  };
}
