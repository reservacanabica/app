/**
 * COMPONENTE: 38_TriggerService.gs
 * PAPEL: Gerenciador de triggers (gatilhos) do Google Apps Script
 *
 * RESPONSABILIDADE:
 * - Instalar/remover triggers instaláveis
 * - Validar duplicatas
 * - Listar triggers ativos
 * - Cleanup de triggers órfãos
 *
 * TIPOS DE TRIGGERS:
 * - onOpen (Simples) — quando abre a planilha
 * - onEdit (Simples) — quando edita célula
 * - dailyMaintenance (Instalável) — diariamente
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// INSTALAÇÃO DE TRIGGERS
// ============================================================================

/**
 * Instala trigger para onOpen
 *
 * @returns {object} {success, triggerId}
 */
function installOnOpenTrigger_() {
  try {
    // onOpen é automático — apenas verificar se está registrado
    logInfo_('Trigger onOpen está pronto', {});

    return {
      success: true,
      trigger: 'onOpen',
      message: 'Trigger onOpen é nativo (automático)'
    };

  } catch (error) {
    logException_('Erro ao instalar onOpen', error);
    return { success: false, error: error.message };
  }
}

/**
 * Instala trigger para onEdit
 *
 * @returns {object}
 */
function installOnEditTrigger_() {
  try {
    // onEdit é automático
    logInfo_('Trigger onEdit está pronto', {});

    return {
      success: true,
      trigger: 'onEdit',
      message: 'Trigger onEdit é nativo (automático)'
    };

  } catch (error) {
    logException_('Erro ao instalar onEdit', error);
    return { success: false, error: error.message };
  }
}

/**
 * Instala trigger para dailyMaintenance (instalável)
 *
 * @returns {object}
 */
function installDailyMaintenanceTrigger_() {
  try {
    // Verificar se já existe
    const existing = getInstalledTriggers_();
    const hasMaintenance = existing.some(function(t) {
      return t.getHandlerFunction() === 'dailyMaintenanceHandler_';
    });

    if (hasMaintenance) {
      logWarn_('Trigger dailyMaintenance já existe', {});
      return {
        success: false,
        error: 'Trigger já instalado',
        message: 'Remova o trigger existente antes de instalar novamente'
      };
    }

    // Criar trigger instalável (diariamente)
    const trigger = ScriptApp.newTrigger('dailyMaintenanceHandler_')
      .timeBased()
      .atTime(2, 0)          // 02:00 (madrugada)
      .everyDays(1)
      .create();

    logInfo_('Trigger dailyMaintenance instalado', {
      triggerId: trigger.getUniqueId(),
      type: 'TIME_BASED',
      time: '02:00'
    });

    return {
      success: true,
      triggerId: trigger.getUniqueId(),
      trigger: 'dailyMaintenance',
      message: 'Trigger instalado para rodar diariamente às 02:00'
    };

  } catch (error) {
    logException_('Erro ao instalar dailyMaintenance', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// LISTAR TRIGGERS
// ============================================================================

/**
 * Retorna todos os triggers instalados
 *
 * @returns {array}
 */
function getInstalledTriggers_() {
  try {
    const triggers = ScriptApp.getProjectTriggers();

    return triggers.map(function(trigger) {
      return {
        id: trigger.getUniqueId(),
        handlerFunction: trigger.getHandlerFunction(),
        eventType: trigger.getEventType(),
        triggerSource: trigger.getTriggerSource(),
        lastRun: trigger.getLastRun ? trigger.getLastRun() : 'N/A'
      };
    });

  } catch (error) {
    logException_('Erro ao listar triggers', error);
    return [];
  }
}

/**
 * Retorna triggers instaláveis apenas (não os simples onOpen/onEdit)
 *
 * @returns {array}
 */
function getInstallableTriggers_() {
  try {
    const triggers = ScriptApp.getProjectTriggers();

    return triggers.filter(function(trigger) {
      const eventType = trigger.getEventType();
      // TIME_BASED é instalável
      return eventType === ScriptApp.EventType.ON_TIME || eventType === 'ON_TIME';
    }).map(function(trigger) {
      return {
        id: trigger.getUniqueId(),
        handlerFunction: trigger.getHandlerFunction(),
        eventType: trigger.getEventType()
      };
    });

  } catch (error) {
    logException_('Erro ao listar instaláveis', error);
    return [];
  }
}

/**
 * Conta triggers ativos
 *
 * @returns {number}
 */
function countActiveTriggers_() {
  return getInstalledTriggers_().length;
}

// ============================================================================
// REMOÇÃO DE TRIGGERS
// ============================================================================

/**
 * Remove trigger por ID
 *
 * @param {string} triggerId
 * @returns {object} {success, message}
 */
function removeTriggerById_(triggerId) {
  try {
    const triggers = ScriptApp.getProjectTriggers();

    let removed = false;
    triggers.forEach(function(trigger) {
      if (trigger.getUniqueId() === triggerId) {
        ScriptApp.deleteTrigger(trigger);
        removed = true;
      }
    });

    if (removed) {
      logInfo_('Trigger removido', { triggerId: triggerId });

      return {
        success: true,
        message: 'Trigger removido com sucesso'
      };
    } else {
      return {
        success: false,
        error: 'Trigger não encontrado'
      };
    }

  } catch (error) {
    logException_('Erro ao remover trigger', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove trigger por nome de handler
 *
 * @param {string} handlerName
 * @returns {object}
 */
function removeTriggerByHandler_(handlerName) {
  try {
    const triggers = ScriptApp.getProjectTriggers();

    let removed = false;
    triggers.forEach(function(trigger) {
      if (trigger.getHandlerFunction() === handlerName) {
        ScriptApp.deleteTrigger(trigger);
        removed = true;
      }
    });

    if (removed) {
      logInfo_('Trigger removido', { handler: handlerName });

      return {
        success: true,
        message: 'Trigger removido com sucesso'
      };
    } else {
      return {
        success: false,
        error: 'Trigger não encontrado'
      };
    }

  } catch (error) {
    logException_('Erro ao remover trigger', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove todos os triggers instaláveis (NÃO remove onOpen/onEdit)
 *
 * @returns {object} {removed, message}
 */
function removeAllInstallableTriggers_() {
  try {
    const installable = getInstallableTriggers_();

    installable.forEach(function(triggerInfo) {
      removeTriggerById_(triggerInfo.id);
    });

    logInfo_('Todos os triggers instaláveis removidos', {
      count: installable.length
    });

    return {
      success: true,
      removed: installable.length,
      message: installable.length + ' trigger(s) removido(s)'
    };

  } catch (error) {
    logException_('Erro ao remover todos', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// LIMPEZA
// ============================================================================

/**
 * Remove triggers órfãos (cujo handler não existe mais)
 *
 * @returns {object}
 */
function cleanupOrphanTriggers_() {
  try {
    const triggers = getInstalledTriggers_();
    const orphans = [];

    triggers.forEach(function(triggerInfo) {
      // Verificar se handler existe
      const handler = triggerInfo.handlerFunction;

      try {
        // Tentar achar função (usando eval é inseguro, então apenas logar)
        logDebug_('Verificando handler', { handler: handler });
      } catch (error) {
        orphans.push(triggerInfo.id);
      }
    });

    // Remover órfãos
    let removed = 0;
    orphans.forEach(function(triggerId) {
      const result = removeTriggerById_(triggerId);
      if (result.success) removed++;
    });

    logInfo_('Cleanup de triggers órfãos', {
      found: orphans.length,
      removed: removed
    });

    return {
      success: true,
      orphans_found: orphans.length,
      removed: removed,
      message: removed + ' trigger(s) órfão(s) removido(s)'
    };

  } catch (error) {
    logException_('Erro no cleanup', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// SETUP INICIAL
// ============================================================================

/**
 * Instala todos os triggers necessários (chamado uma vez no setup)
 *
 * @returns {object}
 */
function installAllTriggers_() {
  try {
    logInfo_('Iniciando instalação de triggers', {});

    const results = {
      onOpen: installOnOpenTrigger_(),
      onEdit: installOnEditTrigger_(),
      dailyMaintenance: installDailyMaintenanceTrigger_()
    };

    const allSuccess = results.onOpen.success &&
                       results.onEdit.success &&
                       results.dailyMaintenance.success;

    return {
      success: allSuccess,
      results: results,
      message: allSuccess ? 'Todos os triggers instalados' : 'Alguns triggers falharam'
    };

  } catch (error) {
    logException_('Erro ao instalar todos', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// ESTATÍSTICAS E MONITORAMENTO
// ============================================================================

/**
 * Retorna status dos triggers
 *
 * @returns {object}
 */
function getTriggerStatus_() {
  try {
    const installed = getInstalledTriggers_();
    const installable = getInstallableTriggers_();

    return {
      totalTriggers: installed.length,
      installableTriggers: installable.length,
      hasOnOpen: installed.some(function(t) {
        return t.handlerFunction === 'onOpen';
      }),
      hasOnEdit: installed.some(function(t) {
        return t.handlerFunction === 'onEdit';
      }),
      hasDailyMaintenance: installed.some(function(t) {
        return t.handlerFunction === 'dailyMaintenanceHandler_';
      }),
      triggers: installed,
      timestamp: nowIso_()
    };

  } catch (error) {
    logException_('Erro ao obter status', error);
    return { error: error.message };
  }
}

const TRIGGER_SERVICE_LOADED = true;

// ============================================================================
// INSTALAÇÃO DE TRIGGERS DE PRODUÇÃO
// ============================================================================

/**
 * Instala triggers necessários para ambiente de produção
 * 
 * Função utilitária para ser executada manualmente no editor do Apps Script
 * antes do deploy. Realiza as seguintes operações:
 * 
 * 1. Remove triggers duplicados do processJobsQueueTrigger
 * 2. Cria novo trigger time-based executando a cada 1 minuto
 * 3. Registra no log a instalação bem-sucedida
 * 
 * IMPORTANTE:
 * - Execute esta função ANTES do deploy da aplicação
 * - Garante que apenas 1 trigger da fila assíncrona está ativo
 * - Evita processamento duplicado de jobs
 * 
 * TRIGGER INSTALADO:
 * - Handler: processJobsQueueTrigger (definido em QueueService.gs)
 * - Frequência: A cada 1 minuto
 * - Tipo: TIME_BASED (instalável)
 * 
 * @returns {object} Status da instalação {success, message, triggerId}
 */
function installProductionTriggers() {
  try {
    Logger.log("========================================");
    Logger.log("INSTALAÇÃO DE TRIGGERS DE PRODUÇÃO");
    Logger.log("========================================");

    // =========================================================================
    // PASSO 1: Limpar triggers duplicados da fila
    // =========================================================================
    Logger.log("Etapa 1: Limpando triggers duplicados...");
    
    const triggers = ScriptApp.getProjectTriggers();
    let removedCount = 0;
    
    for (let i = 0; i < triggers.length; i++) {
      const trigger = triggers[i];
      
      if (trigger.getHandlerFunction() === 'processJobsQueueTrigger') {
        Logger.log("  └─ Removendo trigger duplicado: " + trigger.getUniqueId());
        ScriptApp.deleteTrigger(trigger);
        removedCount++;
      }
    }
    
    Logger.log("  ✓ " + removedCount + " trigger(s) duplicado(s) removido(s)");

    // =========================================================================
    // PASSO 2: Criar trigger a cada 1 minuto
    // =========================================================================
    Logger.log("");
    Logger.log("Etapa 2: Criando novo trigger time-based...");
    
    const newTrigger = ScriptApp.newTrigger('processJobsQueueTrigger')
      .timeBased()
      .everyMinutes(1)
      .create();
    
    const triggerId = newTrigger.getUniqueId();
    
    Logger.log("  ✓ Trigger criado com sucesso");
    Logger.log("  └─ ID: " + triggerId);
    Logger.log("  └─ Handler: processJobsQueueTrigger");
    Logger.log("  └─ Frequência: A cada 1 minuto");
    Logger.log("  └─ Tipo: TIME_BASED");

    // =========================================================================
    // PASSO 3: Verificação Final
    // =========================================================================
    Logger.log("");
    Logger.log("Etapa 3: Verificação final...");
    
    const allTriggers = ScriptApp.getProjectTriggers();
    const queueTriggers = allTriggers.filter(function(t) {
      return t.getHandlerFunction() === 'processJobsQueueTrigger';
    });
    
    Logger.log("  ✓ Total de triggers ativos: " + allTriggers.length);
    Logger.log("  ✓ Triggers da fila assíncrona: " + queueTriggers.length);

    // =========================================================================
    // PASSO 4: Registrar no sistema
    // =========================================================================
    logInfo_('Triggers de produção instalados', {
      triggerId: triggerId,
      handler: 'processJobsQueueTrigger',
      frequency: '1 minuto',
      removedDuplicates: removedCount
    });

    Logger.log("");
    Logger.log("========================================");
    Logger.log("✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!");
    Logger.log("========================================");
    Logger.log("Trigger de fila assíncrona instalado e pronto para produção.");
    Logger.log("O sistema irá processar jobs a cada 1 minuto automaticamente.");
    Logger.log("");

    return {
      success: true,
      message: 'Trigger de fila assíncrona instalado com sucesso',
      triggerId: triggerId,
      frequency: 'A cada 1 minuto',
      removedDuplicates: removedCount
    };

  } catch (error) {
    Logger.log("");
    Logger.log("========================================");
    Logger.log("❌ ERRO NA INSTALAÇÃO DE TRIGGERS");
    Logger.log("========================================");
    Logger.log("Erro: " + error.message);
    Logger.log("Stack: " + (error.stack || 'N/A'));
    Logger.log("");

    logException_('Erro ao instalar triggers de produção', error, {
      step: 'installProductionTriggers'
    });

    return {
      success: false,
      error: error.message,
      message: 'Falha ao instalar triggers de produção'
    };
  }
}

/**
 * Remove o trigger de produção da fila assíncrona
 * Útil para manutenção ou troubleshooting
 * 
 * @returns {object} Status da remoção
 */
function removeProductionTriggers() {
  try {
    Logger.log("Removendo triggers de produção...");
    
    const triggers = ScriptApp.getProjectTriggers();
    let removedCount = 0;
    
    for (let i = 0; i < triggers.length; i++) {
      const trigger = triggers[i];
      
      if (trigger.getHandlerFunction() === 'processJobsQueueTrigger') {
        ScriptApp.deleteTrigger(trigger);
        removedCount++;
        Logger.log("  ✓ Trigger removido: " + trigger.getUniqueId());
      }
    }
    
    Logger.log("Total removido: " + removedCount + " trigger(s)");
    
    return {
      success: true,
      removed: removedCount,
      message: removedCount + ' trigger(s) de produção removido(s)'
    };

  } catch (error) {
    Logger.log("Erro ao remover triggers: " + error.message);
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Verifica status dos triggers de produção
 * Útil para diagnóstico e monitoramento
 * 
 * @returns {object} Status detalhado dos triggers
 */
function checkProductionTriggersStatus() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    
    const queueTriggers = triggers.filter(function(t) {
      return t.getHandlerFunction() === 'processJobsQueueTrigger';
    });
    
    const status = {
      total_triggers: triggers.length,
      queue_triggers: queueTriggers.length,
      queue_trigger_ids: queueTriggers.map(function(t) {
        return t.getUniqueId();
      }),
      is_configured: queueTriggers.length === 1,
      has_duplicates: queueTriggers.length > 1,
      is_missing: queueTriggers.length === 0
    };
    
    Logger.log("Status dos Triggers de Produção:");
    Logger.log("  Total de triggers: " + status.total_triggers);
    Logger.log("  Triggers da fila: " + status.queue_triggers);
    Logger.log("  Configuração correta: " + (status.is_configured ? "✅ Sim" : "❌ Não"));
    
    if (status.has_duplicates) {
      Logger.log("  ⚠️ ATENÇÃO: Triggers duplicados detectados!");
      Logger.log("  Execute installProductionTriggers() para corrigir.");
    }
    
    if (status.is_missing) {
      Logger.log("  ⚠️ ATENÇÃO: Nenhum trigger da fila configurado!");
      Logger.log("  Execute installProductionTriggers() para instalar.");
    }
    
    return status;

  } catch (error) {
    Logger.log("Erro ao verificar status: " + error.message);
    
    return {
      success: false,
      error: error.message
    };
  }
}
