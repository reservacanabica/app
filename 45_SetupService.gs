/**
 * COMPONENTE: 45_SetupService.gs
 * PAPEL: Inicialização completa do projeto
 *
 * FUNÇÃO CRÍTICA:
 * - setupProject_() deve ser executado UMA VEZ após deploy
 * - Inicializa todas as configurações
 * - Cria schema completo
 * - Insere usuário admin inicial
 * - Cria menu no Sheets
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// SETUP PRINCIPAL
// ============================================================================

/**
 * EXECUTAR UMA VEZ APENAS após deploy
 * Instruções:
 * 1. Definir SPREADSHEETS_ID em Project Settings > Script Properties
 * 2. Abrir o Apps Script Editor
 * 3. Selecionar setupProject_ na dropdown
 * 4. Clicar Run
 * 5. Autorizar quando solicitado
 * 6. Aguardar conclusão (1-2 minutos)
 * 7. Verificar em Execution logs
 *
 * @returns {object} relatório de setup
 */
function setupProject_() {
  logInfo_('=== INICIANDO SETUP DO PROJETO ===', {});
  
  const startTime = nowUnix_();
  const report = {
    timestamp: nowIso_(),
    steps: [],
    errors: [],
    success: false
  };

  try {
    // STEP 1: Validar configuração
    logInfo_('STEP 1: Validando configuração', {});
    try {
      validateConfiguration_();
      report.steps.push({ step: 1, name: 'Validar Config', ok: true });
      logInfo_('  ✅ Configuração válida', {});
    } catch (error) {
      report.steps.push({ step: 1, name: 'Validar Config', ok: false, error: error.message });
      report.errors.push('Falha na validação: ' + error.message);
      throw error;
    }

    // STEP 2: Inicializar default config
    logInfo_('STEP 2: Inicializando configuração padrão', {});
    try {
      initializeDefaultConfiguration_();
      report.steps.push({ step: 2, name: 'Init Config', ok: true });
      logInfo_('  ✅ Configuração padrão inicializada', {});
    } catch (error) {
      report.steps.push({ step: 2, name: 'Init Config', ok: false, error: error.message });
      logWarn_('  ⚠️ Configuração padrão pode ter problemas', { error: error.message });
    }

    // STEP 3: Criar schema
    logInfo_('STEP 3: Criando schema de abas', {});
    try {
      const schemaReport = initializeSchema_();
      report.steps.push({
        step: 3,
        name: 'Create Schema',
        ok: true,
        created: schemaReport.created.length,
        verified: schemaReport.verified.length
      });
      logInfo_('  ✅ Schema criado', {
        created: schemaReport.created.length,
        verified: schemaReport.verified.length
      });
    } catch (error) {
      report.steps.push({ step: 3, name: 'Create Schema', ok: false, error: error.message });
      report.errors.push('Falha ao criar schema: ' + error.message);
      throw error;
    }

    // STEP 4: Criar usuário admin inicial
    logInfo_('STEP 4: Criando usuário admin inicial', {});
    try {
      const adminExists = getAllRowsAsObjects_('Users').some(function(u) {
        return u.role === USER_ROLES.ADMIN;
      });

      if (!adminExists) {
        const adminId = generateUUID_();
        const adminUser = {
          id: adminId,
          username: 'admin',
          password: 'admin123', // MUDAR NA PRIMEIRA EXECUÇÃO!
          displayName: 'Administrator',
          role: USER_ROLES.ADMIN,
          status: USER_STATUS.ACTIVE,
          createdAt: nowIso_(),
          updatedAt: nowIso_(),
          lastLoginAt: null
        };

        appendRow_('Users', adminUser);
        report.steps.push({
          step: 4,
          name: 'Create Admin User',
          ok: true,
          adminId: adminId
        });
        logInfo_('  ✅ Usuário admin criado', {
          username: 'admin',
          password: '(hidden)',
          id: adminId
        });
      } else {
        report.steps.push({
          step: 4,
          name: 'Create Admin User',
          ok: true,
          message: 'Usuário admin já existe'
        });
        logInfo_('  ℹ️ Usuário admin já existe', {});
      }
    } catch (error) {
      report.steps.push({ step: 4, name: 'Create Admin User', ok: false, error: error.message });
      logWarn_('  ⚠️ Falha ao criar admin', { error: error.message });
    }

    // STEP 5: Criar menu
    logInfo_('STEP 5: Criando menu no Sheets', {});
    try {
      createSheetMenu_();
      report.steps.push({ step: 5, name: 'Create Menu', ok: true });
      logInfo_('  ✅ Menu criado', {});
    } catch (error) {
      report.steps.push({ step: 5, name: 'Create Menu', ok: false, error: error.message });
      logWarn_('  ⚠️ Falha ao criar menu', { error: error.message });
    }

    // STEP 6: Health check
    logInfo_('STEP 6: Executando health check', {});
    try {
      const health = getHealthReport_();
      report.steps.push({
        step: 6,
        name: 'Health Check',
        ok: health.healthy,
        healthy: health.healthy
      });
      logInfo_('  ✅ Health check concluído', { healthy: health.healthy });
    } catch (error) {
      report.steps.push({ step: 6, name: 'Health Check', ok: false, error: error.message });
      logWarn_('  ⚠️ Falha no health check', { error: error.message });
    }

    report.success = true;
    const duration = nowUnix_() - startTime;
    report.durationMs = duration;

    logInfo_('=== SETUP CONCLUÍDO COM SUCESSO ===', report);

  } catch (error) {
    report.success = false;
    const duration = nowUnix_() - startTime;
    report.durationMs = duration;
    logException_('Setup falhou', error);
  }

  // Log final
  Logger.log('\n\n' + formatSetupReport_(report) + '\n\n');

  return report;
}

// ============================================================================
// MENU
// ============================================================================

/**
 * Cria menu custom no Sheets
 */
function createSheetMenu_() {
  const ui = SpreadsheetApp.getUi();

  const menu = ui.createMenu('Canabica');
  menu.addItem('📊 Dashboard', 'openDashboard_');
  menu.addItem('🏥 Health Check', 'showHealthCheck_');
  menu.addItem('🧪 Tests', 'showTests_');
  menu.addItem('ℹ️ About', 'showAbout_');
  menu.addToUi();

  logInfo_('Menu criado no Sheets', {});
}

// ============================================================================
// HANDLERS DE MENU
// ============================================================================

/**
 * Handler: Dashboard (placeholder)
 */
function openDashboard_() {
  const ui = SpreadsheetApp.getUi();
  const health = getHealthStatus_();
  ui.alert('Dashboard\n\nStatus: ' + health.status + '\nVersion: ' + health.version);
}

/**
 * Handler: Health Check
 */
function showHealthCheck_() {
  const ui = SpreadsheetApp.getUi();
  const report = getHealthReportFormatted_();
  
  // Limitar tamanho do alert
  const truncated = report.length > 5000 ? report.substring(0, 5000) + '\n... (truncado)' : report;
  ui.alert(truncated);
  
  // Log completo no editor
  Logger.log(report);
}

/**
 * Handler: Tests
 */
function showTests_() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Testes\n\nTestes disponíveis no Execution Log.\nVer 44_UnitTestRunner.gs');
}

/**
 * Handler: About
 */
function showAbout_() {
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    APP_NAME + '\n' +
    'Version ' + APP_VERSION + '\n' +
    'Deployed: ' + DEPLOYMENT_DATE + '\n\n' +
    APP_DESCRIPTION
  );
}

// ============================================================================
// onOpen (gatilho)
// ============================================================================

/**
 * Chamado automaticamente ao abrir a planilha
 */
function onOpen() {
  createSheetMenu_();
}

// ============================================================================
// FORMATAÇÃO
// ============================================================================

/**
 * Formata relatório de setup para exibição
 */
function formatSetupReport_(report) {
  let output = '╔════════════════════════════════════════╗\n';
  output += '║     SETUP PROJECT REPORT               ║\n';
  output += '╚════════════════════════════════════════╝\n\n';

  output += 'Timestamp: ' + report.timestamp + '\n';
  output += 'Duration: ' + report.durationMs + 'ms\n';
  output += 'Status: ' + (report.success ? '✅ SUCCESS' : '❌ FAILED') + '\n\n';

  output += '📋 STEPS:\n';
  report.steps.forEach(function(step) {
    const status = step.ok ? '✅' : '❌';
    output += status + ' [' + step.step + '] ' + step.name + '\n';
    if (step.error) {
      output += '   ERROR: ' + step.error + '\n';
    }
    if (step.created !== undefined) {
      output += '   Created: ' + step.created + '\n';
    }
    if (step.verified !== undefined) {
      output += '   Verified: ' + step.verified + '\n';
    }
  });

  if (report.errors.length > 0) {
    output += '\n❌ ERRORS:\n';
    report.errors.forEach(function(err) {
      output += '• ' + err + '\n';
    });
  }

  output += '\n────────────────────────────────────────\n';

  return output;
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================

/**
 * Reseta projeto completamente (DESTRUTIVO)
 * Use apenas em debug
 */
function resetProjectDestructive_() {
  if (!isDebugMode_()) {
    throw new Error('resetProjectDestructive_ requer DEBUG_MODE=true');
  }

  logWarn_('RESETTING PROJECT COMPLETELY', {});

  const report = {
    timestamp: nowIso_(),
    reset: []
  };

  // Reset schema
  const schemaReset = resetSchemaDestructive_();
  report.reset.push({ component: 'Schema', ...schemaReset });

  logInfo_('Project reset completo', report);
  return report;
}

/**
 * Exibe esquema (info)
 */
function showSchema_() {
  const description = getSchemaDescription_();
  Logger.log(description);
}

/**
 * Exibe configuração atual
 */
function showConfiguration_() {
  const config = getAllConfiguration_();
  Logger.log('CONFIGURATION:');
  Logger.log(JSON.stringify(config, null, 2));
}

// ============================================================================
// EXPORTAR
// ============================================================================

const SETUP_SERVICE_LOADED = true;
