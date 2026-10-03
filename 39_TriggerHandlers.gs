/**
 * COMPONENTE: 39_TriggerHandlers.gs
 * PAPEL: Manipuladores de eventos (gatilhos)
 *
 * RESPONSABILIDADE:
 * - Manejar eventos onOpen, onEdit, dailyMaintenance
 * - Executar ações conforme necessário
 * - Tratamento robusto de erros
 *
 * HANDLERS:
 * - onOpen() — Google Sheets native (simples)
 * - onEdit(e) — Google Sheets native (simples)
 * - dailyMaintenanceHandler_() — Instalável (time-based)
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// onOpen — Executado ao abrir a planilha
// ============================================================================

/**
 * Trigger: onOpen
 * Executado automaticamente ao abrir planilha
 *
 * @param {object} e — evento nativo do Google Sheets
 */
function onOpen(e) {
  try {
    logDebug_('onOpen disparado', {
      user: Session.getActiveUser().getEmail(),
      timestamp: nowIso_()
    });

    const ui = SpreadsheetApp.getUi();

    // Criar menu customizado
    const menu = ui.createMenu('Canabica')
      .addItem('📊 Dashboard', 'showDashboard_')
      .addItem('⚙️ Setup', 'showSetup_')
      .addItem('🏥 Health Check', 'showHealthCheck_')
      .addItem('📋 Validações', 'showValidations_')
      .addItem('🔄 Importar', 'showImport_')
      .addItem('📤 Exportar', 'showExport_')
      .addItem('🧪 Testes', 'showTests_')
      .addSeparator()
      .addItem('ℹ️ Sobre', 'showAbout_');

    menu.addToUi();

    logInfo_('Menu Canabica criado', {
      user: Session.getActiveUser().getEmail()
    });

    // Mostrar toast de boas-vindas (opcional)
    ui.alert('Bem-vindo ao Canabica! 🌿\n\nUse o menu "Canabica" para operações.');

  } catch (error) {
    logException_('Erro em onOpen', error);
  }
}

// ============================================================================
// onEdit — Executado ao editar célula
// ============================================================================

/**
 * Trigger: onEdit
 * Executado automaticamente ao editar célula
 *
 * @param {object} e — evento nativo do Google Sheets
 */
function onEdit(e) {
  try {
    const range = e.range;
    const sheet = range.getSheet();
    const sheetName = sheet.getName();
    const row = range.getRow();
    const col = range.getColumn();
    const value = range.getValue();
    const user = Session.getActiveUser().getEmail();

    logDebug_('onEdit disparado', {
      sheet: sheetName,
      cell: range.getA1Notation(),
      value: value,
      user: user
    });

    // Auditaria mínima (sem incluir valor — pode ser sensível)
    auditOnEdit_('onEdit', {
      sheet: sheetName,
      cell: range.getA1Notation(),
      user: user,
      timestamp: nowIso_()
    });

    // Ações específicas por sheet (opcional)
    if (sheetName === 'Studies') {
      handleEditStudies_(range, value, user);
    } else if (sheetName === 'Observations') {
      handleEditObservations_(range, value, user);
    }

  } catch (error) {
    logException_('Erro em onEdit', error);
  }
}

/**
 * Handler específico para edições em Studies
 */
function handleEditStudies_(range, value, user) {
  try {
    const cell = range.getA1Notation();

    // Exemplo: se status foi editado, validar transição
    if (cell.includes('D')) { // Coluna D = status (exemplo)
      logDebug_('Status alterado em Studies', {
        cell: cell,
        newValue: value,
        user: user
      });
    }

  } catch (error) {
    logException_('Erro ao tratar Studies', error);
  }
}

/**
 * Handler específico para edições em Observations
 */
function handleEditObservations_(range, value, user) {
  try {
    const cell = range.getA1Notation();

    // Exemplo: se value foi editado, marcar como not validated
    if (cell.includes('D')) { // Coluna D = value (exemplo)
      logDebug_('Valor alterado em Observations', {
        cell: cell,
        newValue: value,
        user: user
      });

      // Marcar como requerendo validação
      const row = range.getRow();
      const sheet = range.getSheet();

      // Adicionar flag em coluna de validação
      sheet.getRange(row, 10).setValue(false); // Coluna J = validated
    }

  } catch (error) {
    logException_('Erro ao tratar Observations', error);
  }
}

// ============================================================================
// dailyMaintenanceHandler_ — Rodina diária
// ============================================================================

/**
 * Trigger: dailyMaintenance
 * Executado diariamente às 02:00
 *
 * Responsabilidades:
 * - Validar schema
 * - Processar batch jobs pendentes
 * - Limpar sessões expiradas
 * - Gerar relatório de saúde
 */
function dailyMaintenanceHandler_() {
  try {
    logInfo_('dailyMaintenanceHandler iniciado', {
      timestamp: nowIso_()
    });

    const results = {
      schema: false,
      batchJobs: false,
      sessions: false,
      health: false,
      errors: []
    };

    // 1. VALIDAR SCHEMA
    try {
      logDebug_('Validando schema...', {});
      const schemaResult = validateSchemaIntegrity_();

      if (schemaResult.valid) {
        logInfo_('Schema íntegro', schemaResult);
        results.schema = true;
      } else {
        logWarn_('Schema com problemas', schemaResult);
        results.schema = false;
        results.errors.push('Schema: ' + schemaResult.error);
      }

    } catch (error) {
      logException_('Erro ao validar schema', error);
      results.errors.push('Schema check falhou: ' + error.message);
    }

    // 2. PROCESSAR BATCH JOBS PENDENTES
    try {
      logDebug_('Processando batch jobs...', {});
      const pending = getPendingBatchJobs_();

      if (pending && pending.length > 0) {
        logInfo_('Encontrados ' + pending.length + ' jobs pendentes', {});

        pending.slice(0, 5).forEach(function(job) { // Limitar a 5 por dia
          processBatchJob_(job.id);
        });

        results.batchJobs = true;
      }

    } catch (error) {
      logException_('Erro ao processar batch jobs', error);
      results.errors.push('Batch jobs: ' + error.message);
    }

    // 3. LIMPAR SESSÕES EXPIRADAS
    try {
      logDebug_('Limpando sessões expiradas...', {});
      const cleanupResult = cleanupExpiredSessions_();

      logInfo_('Sessões expiradas limpas', cleanupResult);
      results.sessions = true;

    } catch (error) {
      logException_('Erro ao limpar sessões', error);
      results.errors.push('Sessions cleanup: ' + error.message);
    }

    // 4. GERAR RELATÓRIO DE SAÚDE
    try {
      logDebug_('Gerando relatório de saúde...', {});
      const health = getSystemHealth_();

      logInfo_('Relatório de saúde gerado', health);
      results.health = true;

    } catch (error) {
      logException_('Erro ao gerar health', error);
      results.errors.push('Health check: ' + error.message);
    }

    // 5. AUDITARIA
    auditSystemMaintenance_('dailyMaintenance', results);

    const success = results.schema && results.batchJobs && results.sessions && results.health;

    logInfo_('dailyMaintenanceHandler concluído', {
      success: success,
      results: results,
      errors: results.errors.length
    });

    // Notificar admin se houve erros
    if (results.errors.length > 0) {
      notifyAdminOfMaintenanceErrors_(results.errors);
    }

  } catch (error) {
    logException_('Erro crítico em dailyMaintenanceHandler', error);

    // Registrar erro crítico
    auditSystemError_(error, {
      handler: 'dailyMaintenanceHandler',
      critical: true
    });
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Valida integridade do schema
 *
 * @returns {object}
 */
function validateSchemaIntegrity_() {
  try {
    const sheet = SpreadsheetApp.getActiveSheet();
    const requiredSheets = [
      'Users', 'Sessions', 'Studies', 'Experiments',
      'Observations', 'References', 'Evidence', 'ValidationRuns',
      'AuditLog', 'BatchJobs'
    ];

    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheetNames = spreadsheet.getSheets().map(function(s) { return s.getName(); });

    const missing = requiredSheets.filter(function(name) {
      return !sheetNames.includes(name);
    });

    if (missing.length > 0) {
      return {
        valid: false,
        error: 'Abas faltando: ' + missing.join(', '),
        missing: missing
      };
    }

    return {
      valid: true,
      allPresent: true,
      timestamp: nowIso_()
    };

  } catch (error) {
    logException_('Erro ao validar schema', error);
    return { valid: false, error: error.message };
  }
}

/**
 * Limpa sessões expiradas
 *
 * @returns {object}
 */
function cleanupExpiredSessions_() {
  try {
    const all = getAllRecords_(getSheet_('Sessions')) || [];
    const now = nowUnix_();
    let expired = 0;

    all.forEach(function(session) {
      if (session.status === 'ACTIVE') {
        const expiresAt = new Date(session.expiresAt).getTime() / 1000;

        if (now >= expiresAt) {
          // Marcar como expirada
          updateRecord_('Sessions', session.id, {
            status: APP_STATUS.ARCHIVED,
            revokedAt: nowIso_()
          });

          expired++;
        }
      }
    });

    return {
      total: all.length,
      expired: expired,
      active: all.length - expired,
      timestamp: nowIso_()
    };

  } catch (error) {
    logException_('Erro ao limpar sessões', error);
    return { error: error.message };
  }
}

/**
 * Auditaria de edição (sem registrar valores — podem ser sensíveis)
 *
 * @param {string} action
 * @param {object} details
 */
function auditOnEdit_(action, details) {
  try {
    createRecord_('AuditLog', {
      id: generateUUID_(),
      eventType: 'EDIT',
      action: action,
      actor: details.user,
      entity: details.sheet,
      timestamp: details.timestamp,
      details: JSON.stringify(details),
      severity: 'LOW'
    });

  } catch (error) {
    logException_('Erro ao auditar onEdit', error);
  }
}

/**
 * Auditaria de manutenção do sistema
 */
function auditSystemMaintenance_(handler, results) {
  try {
    createRecord_('AuditLog', {
      id: generateUUID_(),
      eventType: 'SYSTEM',
      action: handler,
      actor: 'system',
      entity: 'System',
      timestamp: nowIso_(),
      details: JSON.stringify(results),
      severity: 'INFO'
    });

  } catch (error) {
    logException_('Erro ao auditar manutenção', error);
  }
}

/**
 * Notifica admin de erros de manutenção
 */
function notifyAdminOfMaintenanceErrors_(errors) {
  try {
    const adminUsers = getAllRecords_(getSheet_('Users')) || [];
    const admins = adminUsers.filter(function(u) { return u.role === USER_ROLES.ADMIN; });

    admins.forEach(function(admin) {
      try {
        const body = '<html><body><h2>Erros na Manutenção Diária</h2><ul>' +
          errors.map(function(e) { return '<li>' + e + '</li>'; }).join('') +
          '</ul></body></html>';

        sendNotificationEmail_(admin.email, '[Canabica] Erros na Manutenção Diária', body);

      } catch (error) {
        logWarn_('Não foi possível notificar admin', { admin: admin.email });
      }
    });

  } catch (error) {
    logException_('Erro ao notificar admin', error);
  }
}

// ============================================================================
// MENU HANDLERS (chamados pelo onOpen)
// ============================================================================

function showDashboard_() {
  try {
    const dashboard = getDashboardCached_();
    const ui = SpreadsheetApp.getUi();

    const html = '<html><body><h2>Dashboard Canabica</h2>' +
      '<pre>' + JSON.stringify(dashboard, null, 2) + '</pre>' +
      '</body></html>';

    ui.showModelessDialog(ui.HtmlOutput.createHtmlOutput(html), 'Dashboard');

  } catch (error) {
    logException_('Erro ao mostrar dashboard', error);
  }
}

function showSetup_() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Setup inicial em desenvolvimento...');
}

function showHealthCheck_() {
  try {
    const health = getSystemHealth_();
    const ui = SpreadsheetApp.getUi();

    const html = '<html><body><h2>Health Check</h2>' +
      '<pre>' + JSON.stringify(health, null, 2) + '</pre>' +
      '</body></html>';

    ui.showModelessDialog(ui.HtmlOutput.createHtmlOutput(html), 'Health Check');

  } catch (error) {
    logException_('Erro no health check', error);
  }
}

function showValidations_() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Validações em desenvolvimento...');
}

function showImport_() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Importação em desenvolvimento...');
}

function showExport_() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Exportação em desenvolvimento...');
}

function showTests_() {
  const ui = SpreadsheetApp.getUi();
  ui.alert('Testes em desenvolvimento...');
}

function showAbout_() {
  const ui = SpreadsheetApp.getUi();
  const msg = 'Canabica Sistema v2.0\n\n' +
    'Gerenciador de Pesquisa em Trichoderma × Cannabis\n\n' +
    'Implementação: FASE 1-7\n' +
    'Status: Desenvolvimento';

  ui.alert(msg);
}

const TRIGGER_HANDLERS_LOADED = true;
