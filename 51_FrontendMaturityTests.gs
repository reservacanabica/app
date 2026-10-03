/**
 * COMPONENTE: 51_FrontendMaturityTests.gs
 * PAPEL: Testes e exemplos para ferramenta de maturidade do frontend.
 *
 * PRINCIPAIS FUNCIONALIDADES:
 * - testes de avaliação de maturidade frontend;
 * - exemplos de uso da API;
 * - validação de scores e níveis.
 *
 * INTEGRAÇÕES:
 * - FrontendMaturityAssessment, TestFixtures;
 *
 * STATUS: TESTES E EXEMPLOS.
 */

/**
 * Teste completo da avaliação de maturidade do frontend
 */
function testFrontendMaturityAssessment() {
  Logger.log('=== TESTE DE AVALIAÇÃO DE MATURIDADE DO FRONTEND ===');
  
  try {
    const mockRequest = {
      action: 'frontend.maturity.assess',
      user: {
        id: 'test_admin',
        role: 'admin',
        permissions: ['dashboard.read']
      },
      token: 'test_token_123'
    };
    
    // Mock da função de permissão
    requirePermission_ = function() { return true; };
    
    Logger.log('Executando avaliação completa do frontend...');
    const startTime = Date.now();
    
    const report = assessFrontendMaturity_(mockRequest);
    
    const duration = Date.now() - startTime;
    
    Logger.log('\n--- RESUMO ---');
    Logger.log('Score Geral: ' + report.summary.overallScore + '/100');
    Logger.log('Nível: ' + report.summary.overallLevel.name + ' (Nível ' + report.summary.overallLevel.level + ')');
    Logger.log('Descrição: ' + report.summary.overallLevel.description);
    Logger.log('Duração: ' + duration + 'ms');
    
    Logger.log('\n--- INVENTÁRIO DE COMPONENTES ---');
    const inventory = report.summary.componentInventory;
    Logger.log('Total: ' + inventory.TOTAL);
    Logger.log('Páginas: ' + inventory.PAGES);
    Logger.log('Partials: ' + inventory.PARTIALS);
    Logger.log('Listas: ' + inventory.LISTS);
    Logger.log('Formulários: ' + inventory.FORMS);
    Logger.log('Campos: ' + inventory.FIELDS);
    
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
    
    Logger.log('\n--- MÉTRICAS DE COMPONENTES ---');
    const metrics = report.componentMetrics;
    Logger.log('Total de Componentes: ' + metrics.totalComponents);
    Logger.log('Páginas: ' + metrics.pages);
    Logger.log('Formulários: ' + metrics.forms);
    Logger.log('Campos: ' + metrics.fields);
    
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
 * Teste do resumo simplificado
 */
function testFrontendMaturitySummary() {
  Logger.log('=== TESTE DE RESUMO DE MATURIDADE DO FRONTEND ===');
  
  try {
    const mockRequest = {
      action: 'frontend.maturity.summary',
      user: { id: 'test_user', role: 'researcher', permissions: ['dashboard.read'] },
      token: 'test_token_456'
    };
    
    requirePermission_ = function() { return true; };
    
    const summary = getFrontendMaturitySummary_(mockRequest);
    
    Logger.log('Score Geral: ' + summary.overallScore);
    Logger.log('Nível: ' + summary.level);
    Logger.log('Componentes: ' + summary.componentCount);
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
function testFrontendIndividualAssessments() {
  Logger.log('=== TESTE DE AVALIAÇÕES INDIVIDUAIS - FRONTEND ===');
  
  const assessments = {
    'UX Design': assessUXDesign_,
    'Acessibilidade': assessAccessibility_,
    'Responsividade': assessResponsiveness_,
    'Performance Cliente': assessClientPerformance_,
    'Usabilidade': assessUsability_,
    'Consistência Visual': assessVisualConsistency_,
    'Interatividade': assessInteractivity_,
    'Qualidade do Código': assessFrontendCodeQuality_
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
        const status = check.status === 'PASS' ? '✓' : 
                      check.status === 'PARTIAL' ? '~' : 
                      check.status === 'UNKNOWN' ? '?' : '✗';
        Logger.log('  ' + status + ' ' + check.name + ' (' + check.points + ' pts)');
      });
      
      // Mostrar recomendações críticas
      const critical = result.recommendations.filter(function(r) { return r.priority === 'CRITICAL'; });
      if (critical.length > 0) {
        Logger.log('  CRÍTICO:');
        critical.forEach(function(rec) {
          Logger.log('    → ' + rec.title);
        });
      }
      
    } catch (error) {
      Logger.log('  ERRO: ' + error.message);
    }
  });
  
  Logger.log('\n=== TESTE DE AVALIAÇÕES INDIVIDUAIS CONCLUÍDO ===');
}

/**
 * Teste do inventário de componentes
 */
function testComponentInventory() {
  Logger.log('=== TESTE DE INVENTÁRIO DE COMPONENTES ===');
  
  const inventory = getComponentInventory_();
  
  Logger.log('\nTotal de Componentes: ' + inventory.TOTAL);
  Logger.log('\nPor Categoria:');
  
  Object.keys(HTML_COMPONENTS).forEach(function(category) {
    const count = HTML_COMPONENTS[category].length;
    Logger.log('  ' + category + ': ' + count);
    
    // Listar alguns componentes
    const components = HTML_COMPONENTS[category].slice(0, 3);
    components.forEach(function(comp) {
      Logger.log('    - ' + comp);
    });
    if (HTML_COMPONENTS[category].length > 3) {
      Logger.log('    ... e mais ' + (HTML_COMPONENTS[category].length - 3));
    }
  });
  
  Logger.log('\n=== TESTE DE INVENTÁRIO CONCLUÍDO ===');
  return inventory;
}

/**
 * Teste de métricas de componentes
 */
function testComponentMetrics() {
  Logger.log('=== TESTE DE MÉTRICAS DE COMPONENTES ===');
  
  const metrics = collectComponentMetrics_();
  
  Logger.log('Total de Componentes: ' + metrics.totalComponents);
  Logger.log('Páginas: ' + metrics.pages);
  Logger.log('Componentes Parciais: ' + metrics.partials);
  Logger.log('Listas: ' + metrics.lists);
  Logger.log('Formulários: ' + metrics.forms);
  Logger.log('Campos de Input: ' + metrics.fields);
  Logger.log('Componentes Reutilizáveis: ' + metrics.reusableComponents);
  
  Logger.log('\nDetalhamento:');
  Object.keys(metrics.breakdown).forEach(function(key) {
    Logger.log('  ' + key + ': ' + metrics.breakdown[key]);
  });
  
  Logger.log('\n=== TESTE DE MÉTRICAS CONCLUÍDO ===');
  return metrics;
}

/**
 * Comparação Backend vs Frontend
 */
function compareBackendAndFrontendMaturity() {
  Logger.log('=== COMPARAÇÃO: BACKEND VS FRONTEND ===\n');
  
  try {
    const mockRequest = {
      user: { id: 'test', role: 'admin', permissions: ['dashboard.read'] },
      token: 'test'
    };
    
    requirePermission_ = function() { return true; };
    
    Logger.log('Avaliando Backend...');
    const backendReport = assessBackendMaturity_(mockRequest);
    
    Logger.log('Avaliando Frontend...');
    const frontendReport = assessFrontendMaturity_(mockRequest);
    
    Logger.log('\n╔════════════════════════════════════════════════════════════╗');
    Logger.log('║                    COMPARAÇÃO DE SCORES                    ║');
    Logger.log('╚════════════════════════════════════════════════════════════╝\n');
    
    Logger.log('BACKEND:  ' + backendReport.summary.overallScore + '/100 (' + backendReport.summary.overallLevel.name + ')');
    Logger.log('FRONTEND: ' + frontendReport.summary.overallScore + '/100 (' + frontendReport.summary.overallLevel.name + ')');
    
    const diff = backendReport.summary.overallScore - frontendReport.summary.overallScore;
    if (diff > 0) {
      Logger.log('\nBackend está ' + diff + ' pontos à frente');
    } else if (diff < 0) {
      Logger.log('\nFrontend está ' + Math.abs(diff) + ' pontos à frente');
    } else {
      Logger.log('\nScores empatados!');
    }
    
    Logger.log('\n--- ANÁLISE POR ÁREA ---\n');
    
    Logger.log('Backend - Principais Forças:');
    const backendTop = Object.keys(backendReport.categoryScores)
      .map(function(k) { return backendReport.categoryScores[k]; })
      .sort(function(a, b) { return b.score - a.score; })
      .slice(0, 3);
    backendTop.forEach(function(cat) {
      Logger.log('  ✓ ' + cat.category + ': ' + cat.score);
    });
    
    Logger.log('\nFrontend - Principais Forças:');
    const frontendTop = Object.keys(frontendReport.categoryScores)
      .map(function(k) { return frontendReport.categoryScores[k]; })
      .sort(function(a, b) { return b.score - a.score; })
      .slice(0, 3);
    frontendTop.forEach(function(cat) {
      Logger.log('  ✓ ' + cat.category + ': ' + cat.score);
    });
    
    Logger.log('\n--- PRIORIDADES GERAIS ---\n');
    
    const allRecommendations = [].concat(
      backendReport.prioritizedRecommendations.map(function(r) { return Object.assign({}, r, {area: 'Backend'}); }),
      frontendReport.prioritizedRecommendations.map(function(r) { return Object.assign({}, r, {area: 'Frontend'}); })
    );
    
    allRecommendations.sort(function(a, b) {
      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    Logger.log('Top 10 Recomendações (Backend + Frontend):');
    allRecommendations.slice(0, 10).forEach(function(rec, idx) {
      Logger.log((idx + 1) + '. [' + rec.priority + '] ' + rec.area + ': ' + rec.title);
    });
    
    Logger.log('\n=== COMPARAÇÃO CONCLUÍDA ===');
    
    return {
      backend: backendReport.summary.overallScore,
      frontend: frontendReport.summary.overallScore,
      difference: diff
    };
    
  } catch (error) {
    Logger.log('Erro: ' + error.message);
    throw error;
  }
}

/**
 * Executar todos os testes do frontend
 */
function runAllFrontendMaturityTests() {
  Logger.log('╔════════════════════════════════════════════════════════════╗');
  Logger.log('║   SUITE COMPLETA DE TESTES - MATURIDADE DO FRONTEND       ║');
  Logger.log('╚════════════════════════════════════════════════════════════╝\n');
  
  try {
    testComponentInventory();
    Logger.log('\n' + '─'.repeat(60) + '\n');
    
    testComponentMetrics();
    Logger.log('\n' + '─'.repeat(60) + '\n');
    
    testFrontendIndividualAssessments();
    Logger.log('\n' + '─'.repeat(60) + '\n');
    
    testFrontendMaturitySummary();
    Logger.log('\n' + '─'.repeat(60) + '\n');
    
    testFrontendMaturityAssessment();
    Logger.log('\n' + '─'.repeat(60) + '\n');
    
    compareBackendAndFrontendMaturity();
    
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
function exampleFrontendMaturityHttpUsage() {
  Logger.log('=== EXEMPLO DE USO VIA HTTP - FRONTEND ===\n');
  
  Logger.log('1. Obter avaliação completa do frontend:');
  Logger.log('POST https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec');
  Logger.log(JSON.stringify({
    action: 'frontend.maturity.assess',
    token: 'your_session_token_here'
  }, null, 2));
  
  Logger.log('\n2. Obter resumo rápido:');
  Logger.log('POST https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec');
  Logger.log(JSON.stringify({
    action: 'frontend.maturity.summary',
    token: 'your_session_token_here'
  }, null, 2));
  
  Logger.log('\n3. Acessar interface web:');
  Logger.log('GET https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?page=frontend-maturity');
}
