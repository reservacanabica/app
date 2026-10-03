/**
 * COMPONENTE: 49_MaturityTests.gs
 * PAPEL: Testes e exemplos para ferramenta de maturidade.
 *
 * PRINCIPAIS FUNCIONALIDADES:
 * - testes de avaliação de maturidade;
 * - exemplos de uso da API;
 * - validação de scores e níveis.
 *
 * INTEGRAÇÕES:
 * - MaturityAssessment, TestFixtures;
 * - Bootstrap, Constants, Config, Response e os serviços explicitamente chamados pelo corpo.
 *
 * STATUS: TESTES E EXEMPLOS.
 */

/**
 * Teste rápido da ferramenta de maturidade
 * Executa avaliação completa e imprime resultados no log
 */
function testMaturityAssessment() {
  Logger.log('=== TESTE DE AVALIAÇÃO DE MATURIDADE ===');
  
  try {
    // Simular request com permissões de admin
    const mockRequest = {
      action: 'maturity.assess',
      user: {
        id: 'test_admin',
        role: 'admin',
        permissions: ['dashboard.read']
      },
      token: 'test_token_123'
    };
    
    // Mock da função de permissão para teste
    const originalRequirePermission = typeof requirePermission_ !== 'undefined' ? requirePermission_ : null;
    requirePermission_ = function() { return true; };
    
    Logger.log('Executando avaliação completa...');
    const startTime = Date.now();
    
    const report = assessBackendMaturity_(mockRequest);
    
    const duration = Date.now() - startTime;
    
    // Restaurar função original
    if (originalRequirePermission) {
      requirePermission_ = originalRequirePermission;
    }
    
    Logger.log('\n--- RESUMO ---');
    Logger.log('Score Geral: ' + report.summary.overallScore + '/100');
    Logger.log('Nível: ' + report.summary.overallLevel.name + ' (Nível ' + report.summary.overallLevel.level + ')');
    Logger.log('Descrição: ' + report.summary.overallLevel.description);
    Logger.log('Duração: ' + duration + 'ms');
    
    Logger.log('\n--- SCORES POR CATEGORIA ---');
    Object.keys(report.categoryScores).forEach(function(key) {
      const cat = report.categoryScores[key];
      Logger.log(cat.category + ': ' + cat.score + '/100 - ' + cat.level.name);
    });
    
    Logger.log('\n--- TOP 5 RECOMENDAÇÕES ---');
    report.prioritizedRecommendations.slice(0, 5).forEach(function(rec, idx) {
      Logger.log((idx + 1) + '. [' + rec.priority + '] ' + rec.title);
      Logger.log('   Esforço: ' + rec.effort + ' | Categoria: ' + rec.category);
      Logger.log('   ' + rec.description);
    });
    
    Logger.log('\n--- MÉTRICAS DO SISTEMA ---');
    if (report.metrics.totalRecords !== undefined) {
      Logger.log('Total de Registros: ' + report.metrics.totalRecords);
    }
    if (report.metrics.sheets) {
      Logger.log('Sheets com dados:');
      Object.keys(report.metrics.sheets).forEach(function(sheetName) {
        const sheet = report.metrics.sheets[sheetName];
        if (!sheet.error && sheet.records > 0) {
          Logger.log('  - ' + sheetName + ': ' + sheet.records + ' registros');
        }
      });
    }
    
    Logger.log('\n=== TESTE CONCLUÍDO COM SUCESSO ===');
    return report;
    
  } catch (error) {
    Logger.log('\n!!! ERRO NO TESTE !!!');
    Logger.log('Mensagem: ' + error.message);
    Logger.log('Stack: ' + error.stack);
    throw error;
  }
}

/**
 * Teste do resumo simplificado de maturidade
 */
function testMaturitySummary() {
  Logger.log('=== TESTE DE RESUMO DE MATURIDADE ===');
  
  try {
    const mockRequest = {
      action: 'maturity.summary',
      user: { id: 'test_user', role: 'researcher', permissions: ['dashboard.read'] },
      token: 'test_token_456'
    };
    
    // Mock da função de permissão
    requirePermission_ = function() { return true; };
    
    const summary = getMaturitySummary_(mockRequest);
    
    Logger.log('Score Geral: ' + summary.overallScore);
    Logger.log('Nível: ' + summary.level);
    Logger.log('Avaliado em: ' + summary.assessedAt);
    Logger.log('\nTop 5 Recomendações:');
    summary.topRecommendations.forEach(function(rec, idx) {
      Logger.log((idx + 1) + '. ' + rec.title + ' [' + rec.priority + ']');
    });
    
    Logger.log('\n=== TESTE DE RESUMO CONCLUÍDO ===');
    return summary;
    
  } catch (error) {
    Logger.log('Erro: ' + error.message);
    throw error;
  }
}

/**
 * Teste de avaliações individuais por categoria
 */
function testIndividualAssessments() {
  Logger.log('=== TESTE DE AVALIAÇÕES INDIVIDUAIS ===');
  
  const assessments = {
    'Arquitetura': assessArchitecture_,
    'Segurança': assessSecurity_,
    'Observabilidade': assessObservability_,
    'Qualidade de Dados': assessDataQuality_,
    'Testes': assessTesting_,
    'Performance': assessPerformance_,
    'Manutenibilidade': assessMaintainability_,
    'Documentação': assessDocumentation_
  };
  
  Object.keys(assessments).forEach(function(name) {
    try {
      Logger.log('\n--- ' + name + ' ---');
      const result = assessments[name]();
      Logger.log('Score: ' + result.score + '/' + result.maxScore);
      Logger.log('Checks: ' + result.checks.length);
      Logger.log('Recomendações: ' + result.recommendations.length);
      
      // Mostrar checks
      result.checks.forEach(function(check) {
        const status = check.status === 'PASS' ? '✓' : check.status === 'PARTIAL' ? '~' : '✗';
        Logger.log('  ' + status + ' ' + check.name + ' (' + check.points + ' pts)');
      });
      
    } catch (error) {
      Logger.log('  ERRO: ' + error.message);
    }
  });
  
  Logger.log('\n=== TESTE DE AVALIAÇÕES INDIVIDUAIS CONCLUÍDO ===');
}

/**
 * Teste de geração de roadmap
 */
function testRoadmapGeneration() {
  Logger.log('=== TESTE DE GERAÇÃO DE ROADMAP ===');
  
  // Criar recomendações de teste
  const testRecommendations = [
    { title: 'Crítico 1', priority: 'CRITICAL', effort: 'LOW', category: 'security' },
    { title: 'Crítico 2', priority: 'CRITICAL', effort: 'HIGH', category: 'security' },
    { title: 'Alta 1', priority: 'HIGH', effort: 'LOW', category: 'testing' },
    { title: 'Alta 2', priority: 'HIGH', effort: 'MEDIUM', category: 'testing' },
    { title: 'Alta 3', priority: 'HIGH', effort: 'HIGH', category: 'performance' },
    { title: 'Média 1', priority: 'MEDIUM', effort: 'MEDIUM', category: 'documentation' },
    { title: 'Baixa 1', priority: 'LOW', effort: 'LOW', category: 'maintainability' }
  ];
  
  const roadmap = generateRoadmap_(testRecommendations);
  
  Logger.log('\nImediato (0-1 mês): ' + roadmap.immediate.items.length + ' itens');
  roadmap.immediate.items.forEach(function(item) {
    Logger.log('  - ' + item.title);
  });
  
  Logger.log('\nCurto Prazo (1-3 meses): ' + roadmap.shortTerm.items.length + ' itens');
  roadmap.shortTerm.items.forEach(function(item) {
    Logger.log('  - ' + item.title);
  });
  
  Logger.log('\nMédio Prazo (3-6 meses): ' + roadmap.mediumTerm.items.length + ' itens');
  roadmap.mediumTerm.items.forEach(function(item) {
    Logger.log('  - ' + item.title);
  });
  
  Logger.log('\nLongo Prazo (6+ meses): ' + roadmap.longTerm.items.length + ' itens');
  roadmap.longTerm.items.forEach(function(item) {
    Logger.log('  - ' + item.title);
  });
  
  Logger.log('\n=== TESTE DE ROADMAP CONCLUÍDO ===');
}

/**
 * Teste de coleta de métricas do sistema
 */
function testMetricsCollection() {
  Logger.log('=== TESTE DE COLETA DE MÉTRICAS ===');
  
  try {
    const metrics = collectSystemMetrics_();
    
    if (!metrics) {
      Logger.log('⚠️ Função collectSystemMetrics_() retornou undefined');
      return;
    }
    
    if (metrics.error) {
      Logger.log('Erro ao coletar métricas: ' + metrics.error);
      return;
    }
    
    Logger.log('Total de Registros: ' + metrics.totalRecords);
    Logger.log('Última Modificação: ' + metrics.lastModified);
    
    Logger.log('\nRegistros por Sheet:');
    if (metrics.sheets && typeof metrics.sheets === 'object') {
      Object.keys(metrics.sheets).forEach(function(sheetName) {
        const sheet = metrics.sheets[sheetName];
        if (sheet.error) {
          Logger.log('  ' + sheetName + ': ' + sheet.error);
        } else {
          Logger.log('  ' + sheetName + ': ' + sheet.records + ' registros, ' + sheet.columns + ' colunas');
        }
      });
    } else {
      Logger.log('⚠️ metrics.sheets está undefined ou não é um objeto');
    }
    
    if (metrics.auditLog && !metrics.auditLog.error) {
      Logger.log('\nAudit Log:');
      Logger.log('  Total de Eventos: ' + metrics.auditLog.totalEvents);
      Logger.log('  Erros Recentes: ' + metrics.auditLog.recentErrors);
    }
    
    Logger.log('\n=== TESTE DE MÉTRICAS CONCLUÍDO ===');
    return metrics;
    
  } catch (error) {
    Logger.log('Erro: ' + error.message);
    throw error;
  }
}

/**
 * Teste de níveis de maturidade
 */
function testMaturityLevels() {
  Logger.log('=== TESTE DE NÍVEIS DE MATURIDADE ===');
  
  const testScores = [10, 25, 40, 55, 75, 95];
  
  testScores.forEach(function(score) {
    const level = getMaturityLevel_(score);
    Logger.log('Score ' + score + ' → Nível ' + level.level + ': ' + level.name);
  });
  
  Logger.log('\n=== TESTE DE NÍVEIS CONCLUÍDO ===');
}

/**
 * Executar todos os testes
 */
function runAllMaturityTests() {
  Logger.log('╔════════════════════════════════════════════════════════════╗');
  Logger.log('║     SUITE COMPLETA DE TESTES - AVALIAÇÃO DE MATURIDADE    ║');
  Logger.log('╚════════════════════════════════════════════════════════════╝\n');
  
  try {
    testMaturityLevels();
    Logger.log('\n' + '─'.repeat(60) + '\n');
    
    testIndividualAssessments();
    Logger.log('\n' + '─'.repeat(60) + '\n');
    
    testRoadmapGeneration();
    Logger.log('\n' + '─'.repeat(60) + '\n');
    
    testMetricsCollection();
    Logger.log('\n' + '─'.repeat(60) + '\n');
    
    testMaturitySummary();
    Logger.log('\n' + '─'.repeat(60) + '\n');
    
    testMaturityAssessment();
    
    Logger.log('\n╔════════════════════════════════════════════════════════════╗');
    Logger.log('║           TODOS OS TESTES CONCLUÍDOS COM SUCESSO           ║');
    Logger.log('╚════════════════════════════════════════════════════════════╝');
    
  } catch (error) {
    Logger.log('\n╔════════════════════════════════════════════════════════════╗');
    Logger.log('║                    FALHA NOS TESTES                        ║');
    Logger.log('╚════════════════════════════════════════════════════════════╝');
    Logger.log('Erro: ' + error.message);
    throw error;
  }
}

/**
 * Exemplo de uso da API via HTTP
 */
function exampleHttpUsage() {
  Logger.log('=== EXEMPLO DE USO VIA HTTP ===\n');
  
  Logger.log('1. Obter avaliação completa:');
  Logger.log('POST https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec');
  Logger.log(JSON.stringify({
    action: 'maturity.assess',
    token: 'your_session_token_here'
  }, null, 2));
  
  Logger.log('\n2. Obter resumo rápido:');
  Logger.log('POST https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec');
  Logger.log(JSON.stringify({
    action: 'maturity.summary',
    token: 'your_session_token_here'
  }, null, 2));
  
  Logger.log('\n3. Acessar interface web:');
  Logger.log('GET https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?page=maturity');
}
