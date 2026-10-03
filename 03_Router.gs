/**
 * COMPONENTE: 03_Router.gs
 * PAPEL: Roteador de ações
 *
 * RESPONSABILIDADE:
 * - Listar ações válidas (whitelist)
 * - Rotear requisição para handler apropriado
 * - Verificar permissões
 * - Delegar para serviços
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// WHITELIST DE AÇÕES
// ============================================================================

/**
 * Define ações válidas no sistema
 * Formato: "namespace.action"
 *
 * @returns {object}
 */
function getActionWhitelist_() {
  return {
    // ====== AUTENTICAÇÃO ======
    'auth.login': { requiredAuth: false, handler: handleAuthLogin_ },
    'auth.logout': { requiredAuth: true, handler: handleAuthLogout_ },
    'auth.refresh': { requiredAuth: false, handler: handleAuthRefresh_ },
    'auth.validate': { requiredAuth: true, handler: handleAuthValidate_ },

    // ====== SISTEMA ======
    'system.ping': { requiredAuth: false, handler: handleSystemPing_ },
    'system.health': { requiredAuth: false, handler: handleSystemHealth_ },
    'system.info': { requiredAuth: false, handler: handleSystemInfo_ },
    'system.setup': { requiredAuth: true, handler: handleSystemSetup_, permission: 'system.admin' },

    // ====== USUÁRIOS ======
    'users.create': { requiredAuth: true, handler: handleUserCreate_, permission: 'users.create' },
    'users.list': { requiredAuth: true, handler: handleUserList_, permission: 'users.read' },
    'users.get': { requiredAuth: true, handler: handleUserGet_, permission: 'users.read' },
    'users.update': { requiredAuth: true, handler: handleUserUpdate_, permission: 'users.update' },
    'users.delete': { requiredAuth: true, handler: handleUserDelete_, permission: 'users.delete' },
    'users.changePassword': { requiredAuth: true, handler: handleUserChangePassword_, permission: 'users.update' },

    // ====== ESTUDOS ======
    'studies.create': { requiredAuth: true, handler: handleStudyCreate_, permission: 'studies.create' },
    'studies.list': { requiredAuth: true, handler: handleStudyList_, permission: 'studies.read' },
    'studies.get': { requiredAuth: true, handler: handleStudyGet_, permission: 'studies.read' },
    'studies.update': { requiredAuth: true, handler: handleStudyUpdate_, permission: 'studies.update' },
    'studies.delete': { requiredAuth: true, handler: handleStudyDelete_, permission: 'studies.delete' },

    // ====== EXPERIMENTOS ======
    'experiments.create': { requiredAuth: true, handler: handleExperimentCreate_, permission: 'experiments.create' },
    'experiments.list': { requiredAuth: true, handler: handleExperimentList_, permission: 'experiments.read' },
    'experiments.get': { requiredAuth: true, handler: handleExperimentGet_, permission: 'experiments.read' },
    'experiments.update': { requiredAuth: true, handler: handleExperimentUpdate_, permission: 'experiments.update' },
    'experiments.delete': { requiredAuth: true, handler: handleExperimentDelete_, permission: 'experiments.delete' },
    'experiments.list_by_substrate': { requiredAuth: true, handler: handleExperimentsListBySubstrate_, permission: 'experiments.read' },

    // ====== OBSERVAÇÕES ======
    'observations.create': { requiredAuth: true, handler: handleObservationCreate_, permission: 'observations.create' },
    'observations.list': { requiredAuth: true, handler: handleObservationList_, permission: 'observations.read' },
    'observations.get': { requiredAuth: true, handler: handleObservationGet_, permission: 'observations.read' },
    'observations.update': { requiredAuth: true, handler: handleObservationUpdate_, permission: 'observations.update' },
    'observations.delete': { requiredAuth: true, handler: handleObservationDelete_, permission: 'observations.delete' },
    'observations.aggregate_by_substrate': { requiredAuth: true, handler: handleObservationsAggregateBySubstrate_, permission: 'observations.read' },

    // ====== INSUMOS (PROMPT 1) ======
    'insumos.create': { requiredAuth: true, handler: handleInsumoCreate_, permission: 'insumos.create' },
    'insumos.list': { requiredAuth: true, handler: handleInsumoList_, permission: 'insumos.read' },
    'insumos.get': { requiredAuth: true, handler: handleInsumoGet_, permission: 'insumos.read' },
    'insumos.update': { requiredAuth: true, handler: handleInsumoUpdate_, permission: 'insumos.update' },
    'insumos.delete': { requiredAuth: true, handler: handleInsumoDelete_, permission: 'insumos.delete' },

    // ====== LOTES CoA (PROMPT 1) ======
    'lotes.create': { requiredAuth: true, handler: handleLoteCoACreate_, permission: 'lotes.create' },
    'lotes.list': { requiredAuth: true, handler: handleLoteCoAList_, permission: 'lotes.read' },
    'lotes.get': { requiredAuth: true, handler: handleLoteCoAGet_, permission: 'lotes.read' },
    'lotes.update': { requiredAuth: true, handler: handleLoteCoAUpdate_, permission: 'lotes.update' },
    'lotes.delete': { requiredAuth: true, handler: handleLoteCoADelete_, permission: 'lotes.delete' },

    // ====== RECEITAS FERTIRRIGAÇÃO (PROMPT 1) ======
    'receitas.create': { requiredAuth: true, handler: handleReceitaCreate_, permission: 'receitas.create' },
    'receitas.list': { requiredAuth: true, handler: handleReceitaList_, permission: 'receitas.read' },
    'receitas.get': { requiredAuth: true, handler: handleReceitaGet_, permission: 'receitas.read' },
    'receitas.update': { requiredAuth: true, handler: handleReceitaUpdate_, permission: 'receitas.update' },
    'receitas.delete': { requiredAuth: true, handler: handleReceitaDelete_, permission: 'receitas.delete' },

    // ====== PROTOCOLOS BIOLÓGICOS (PROMPT 1) ======
    'protocolos.create': { requiredAuth: true, handler: handleProtocoloCreate_, permission: 'protocolos.create' },
    'protocolos.list': { requiredAuth: true, handler: handleProtocoloList_, permission: 'protocolos.read' },
    'protocolos.get': { requiredAuth: true, handler: handleProtocoloGet_, permission: 'protocolos.read' },
    'protocolos.update': { requiredAuth: true, handler: handleProtocoloUpdate_, permission: 'protocolos.update' },
    'protocolos.delete': { requiredAuth: true, handler: handleProtocoloDelete_, permission: 'protocolos.delete' },

    // ====== PARECERES COMPATIBILIDADE (PROMPT 1) ======
    'pareceres.create': { requiredAuth: true, handler: handleParecerCreate_, permission: 'pareceres.create' },
    'pareceres.list': { requiredAuth: true, handler: handleParecerList_, permission: 'pareceres.read' },
    'pareceres.get': { requiredAuth: true, handler: handleParecerGet_, permission: 'pareceres.read' },
    'pareceres.analisar': { requiredAuth: true, handler: handleParecerAnalisar_, permission: 'pareceres.create' },

    // ====== BIO.VALIDATE (PROMPT 5) ======
    'bio.validate': { requiredAuth: true, handler: handleBioValidate_, permission: 'pareceres.create' },

    // ====== COMORBIDADES CANÁBICAS (PROMPT MC-1) ======
    'comorbidade.catalogo': { requiredAuth: true, handler: handleComorbidadeCatalogo_, permission: 'comorbidades.read' },
    'comorbidade.salvar': { requiredAuth: true, handler: handleComorbidadeSalvar_, permission: 'comorbidades.write' },
    'comorbidade.listar': { requiredAuth: true, handler: handleComorbidadeListar_, permission: 'comorbidades.read' },
    'comorbidade.validar_coa': { requiredAuth: true, handler: handleComorbidadeValidarCoA_, permission: 'comorbidades.read' },
    'comorbidade.estudos': { requiredAuth: true, handler: handleComorbidadeEstudos_, permission: 'comorbidades.read' },
    'comorbidade.pendente': { requiredAuth: true, handler: handleComorbidadePendente_, permission: 'comorbidades.read' },
    'comorbidade.analise_cultivo': { requiredAuth: true, handler: handleComorbidadeAnaliseCultivo_, permission: 'comorbidades.read' },
    'comorbidade.clusters': { requiredAuth: true, handler: handleComorbidadeClusters_, permission: 'comorbidades.read' },
    'comorbidade.stats_medico': { requiredAuth: true, handler: handleComorbidadeStatsMedico_, permission: 'comorbidades.read' },
    'comorbidade.heatmap_correlacao': { requiredAuth: true, handler: handleComorbidadeHeatmapCorrelacao_, permission: 'comorbidades.read' },

    // ====== DASHBOARD (CORREÇÃO #3 - BOTÕES DESCONECTADOS) ======
    'dashboard.stats': { requiredAuth: true, handler: handleDashboardStats_, permission: 'dashboard.read' },
    'dashboard.medico': { requiredAuth: true, handler: handleDashboardMedico_, permission: 'dashboard.read' },
    'dashboard.counts': { requiredAuth: true, handler: handleDashboardCounts_, permission: 'dashboard.read' },

    // ====== PRONTUÁRIO AGRO-CLÍNICO (PROMPT MC-5) ======
    'prontuario.auditoria_coa': { requiredAuth: true, handler: handleProntuarioAuditoriaCoA_, permission: 'prontuarios.read' },
    'prontuario.emitir_parecer': { requiredAuth: true, handler: handleProntuarioEmitirParecer_, permission: 'prontuarios.update' }
  };
}

// ============================================================================
// ROTEAMENTO
// ============================================================================

/**
 * Roteia requisição para handler apropriado
 *
 * @param {object} context — contexto da requisição (buildRequestContext_)
 * @returns {object} resposta
 */
function routeRequest_(context) {
  const startTime = nowUnix_();

  try {
    // 1. Registrar requisição recebida
    logRequestReceived_(context);

    // 2. Validar contexto
    const validation = validateContext_(context);
    if (!validation.valid) {
      logInfo_('Contexto inválido: ' + validation.error.code, {
        action: context.action,
        error: validation.error
      });
      return errorToResponse_(validation.error, { correlationId: context.correlationId });
    }

    // 3. Buscar ação na whitelist
    const whitelist = getActionWhitelist_();
    const actionConfig = whitelist[context.action];

    if (!actionConfig) {
      logWarn_('Ação não encontrada', {
        action: context.action,
        correlationId: context.correlationId
      });
      return notFoundResponse_('Ação', context.action, {
        correlationId: context.correlationId
      });
    }

    // 4. Verificar autenticação
    if (actionConfig.requiredAuth && !context.isAuthenticated) {
      logWarn_('Autenticação necessária', {
        action: context.action,
        correlationId: context.correlationId
      });
      return unauthorizedResponse_('Autenticação necessária', {
        correlationId: context.correlationId
      });
    }

    // 5. Verificar permissão
    if (actionConfig.permission) {
      if (!userHasPermission_(context.user, actionConfig.permission)) {
        logWarn_('Permissão negada', {
          action: context.action,
          userId: context.user.id,
          permission: actionConfig.permission,
          correlationId: context.correlationId
        });
        auditPermissionDenied_(context.user.id, actionConfig.permission, context.action);

        return forbiddenResponse_(
          'Sem permissão para: ' + actionConfig.permission,
          { correlationId: context.correlationId }
        );
      }
    }

    // 6. Executar handler
    logDebug_('Executando handler', {
      action: context.action,
      handler: actionConfig.handler.name,
      correlationId: context.correlationId
    });

    const result = actionConfig.handler(context);

    // 7. Enriquecer resultado com metadados
    if (result && typeof result === 'object') {
      if (!result.correlationId) {
        result.correlationId = context.correlationId;
      }
      if (!result.timestamp) {
        result.timestamp = nowIso_();
      }
    }

    // 8. Registrar conclusão
    const duration = nowUnix_() - startTime;
    logRequestProcessed_(context, duration);

    return result;

  } catch (error) {
    const duration = nowUnix_() - startTime;

    logException_('Erro ao rotear requisição', error, {
      action: context.action,
      correlationId: context.correlationId,
      durationMs: duration
    });

    auditSystemError_(error, {
      action: 'route_request',
      requestAction: context.action,
      userId: context.user ? context.user.id : null
    });

    return errorServerResponse_(
      'Erro ao processar requisição',
      { error: error.message },
      { correlationId: context.correlationId }
    );
  }
}

// ============================================================================
// HANDLERS SISTEMA
// ============================================================================

/**
 * Handler: system.ping
 */
function handleSystemPing_(context) {
  return okResponse_({ pong: true }, {
    message: 'Pong',
    correlationId: context.correlationId
  });
}

/**
 * Handler: system.health
 */
function handleSystemHealth_(context) {
  const health = getSystemHealth_();
  return healthResponse_(health, {
    correlationId: context.correlationId
  });
}

/**
 * Handler: system.info
 */
function handleSystemInfo_(context) {
  const info = {
    version: APP_VERSION,
    environment: ENVIRONMENT,
    timestamp: nowIso_(),
    features: {
      auth: true,
      validation: true,
      audit: true,
      rbac: true
    }
  };

  return okResponse_(info, {
    message: 'Informações do sistema',
    correlationId: context.correlationId
  });
}

/**
 * Handler: system.setup (inicializar projeto)
 */
function handleSystemSetup_(context) {
  try {
    const setupResult = setupProject_();

    if (setupResult.ok) {
      return okResponse_(setupResult.details, {
        message: 'Sistema configurado com sucesso',
        correlationId: context.correlationId
      });
    } else {
      return errorServerResponse_(setupResult.error, {}, {
        correlationId: context.correlationId
      });
    }

  } catch (error) {
    logException_('Erro ao configurar sistema', error);
    return errorServerResponse_('Erro ao configurar sistema', {
      error: error.message
    }, {
      correlationId: context.correlationId
    });
  }
}

// ============================================================================
// HANDLERS AUTENTICAÇÃO
// ============================================================================

/**
 * PADRÃO HANDLER vs CASO DE USO:
 * 
 * Handlers (aqui no Router):
 * - Recebem `context` completo (com user, session, correlationId)
 * - Retornam envelope API formatado (via *Response_ helpers)
 * - São os adaptadores de transporte
 * 
 * Casos de Uso (no AuthService):
 * - Recebem dados brutos (username, password, token)
 * - Retornam resultado bruto {ok, data, error}
 * - São a lógica de negócio pura
 * - Nomeados com sufixo UseCase_ (ex: authLoginUseCase_)
 */

/**
 * Handler: auth.login
 */
function handleAuthLogin_(context) {
  const result = performLogin_(
    context.data.username,
    context.data.password,
    context.correlationId
  );

  if (result.ok) {
    return loginResponse_(result.user, result.session, {
      correlationId: context.correlationId
    });
  } else {
    const statusCode = getStatusCodeFromError_(result.error);
    return errorToResponse_(result.error, {
      correlationId: context.correlationId
    });
  }
}

/**
 * Handler: auth.logout
 */
function handleAuthLogout_(context) {
  const result = performLogout_(context.token);

  if (result.ok) {
    return logoutResponse_({
      correlationId: context.correlationId
    });
  } else {
    return errorToResponse_(result.error, {
      correlationId: context.correlationId
    });
  }
}

/**
 * Handler: auth.refresh
 */
function handleAuthRefresh_(context) {
  const result = performTokenRefresh_(context.token);

  if (result.ok) {
    return okResponse_(result.session, {
      message: 'Token renovado',
      correlationId: context.correlationId
    });
  } else {
    return errorToResponse_(result.error, {
      correlationId: context.correlationId
    });
  }
}

/**
 * Handler: auth.validate
 */
function handleAuthValidate_(context) {
  const validation = validateTokenAndGetUser_(context.token);

  if (validation.valid) {
    return validateTokenResponse_(validation.user, validation.session, {
      correlationId: context.correlationId
    });
  } else {
    return errorToResponse_(validation.error, {
      correlationId: context.correlationId
    });
  }
}

// ============================================================================
// HANDLERS USUÁRIOS
// ============================================================================

/**
 * PADRÃO DE ESCOPO DE DADOS (Data Scope) — PROMPT 6
 * 
 * Todos os handlers .list devem aplicar applyDataScope_ antes da query:
 *   const scopedFilters = applyDataScope_(context.user, 'EntityName', context.filters || {});
 * 
 * Todos os handlers .get devem validar acesso ao registro após recuperação:
 *   requireRecordAccess_(context.user, 'EntityName', record);
 * 
 * Isso garante que:
 * - Admin vê tudo (irrestrito)
 * - Técnico Agrícola vê tudo (auditor global)
 * - Médico vê apenas seus pacientes (medico_id filter)
 * - Grower/Paciente vêem apenas seus próprios registros (paciente_id filter)
 */

/**
 * Handler: users.create
 */
function handleUserCreate_(context) {
  try {
    const validation = validateObject_(context.data || {}, getCreateUserSchema_());
    if (!validation.valid) {
      return validationErrorResponse_(validation.errors, {correlationId: context.correlationId});
    }
    const user = createUser_(context.data);
    auditCreate_('User', user.id, context.user.id, {username: user.username, role: user.role}, context.correlationId);
    return createdResponse_(user, {message: 'Usuário criado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao criar usuário', error);
    return errorServerResponse_('Erro ao criar usuário', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: users.list
 */
function handleUserList_(context) {
  try {
    const users = getAllUsers_();
    const sanitized = users.map(function(u) {
      return {
        id: u.id,
        username: u.username,
        displayName: u.displayName,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt
      };
    });
    return listResponse_(sanitized, {page: 1, pageSize: sanitized.length, total: sanitized.length, totalPages: 1}, {message: 'Lista de usuários', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao listar usuários', error);
    return errorServerResponse_('Erro ao listar usuários', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: users.get
 */
function handleUserGet_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const user = getUserById_(id);
    if (!user) return notFoundResponse_('User', id, {correlationId: context.correlationId});
    const sanitized = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt
    };
    return okResponse_(sanitized, {message: 'Usuário encontrado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao buscar usuário', error);
    return errorServerResponse_('Erro ao buscar usuário', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: users.update
 */
function handleUserUpdate_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const existing = getUserById_(id);
    if (!existing) return notFoundResponse_('User', id, {correlationId: context.correlationId});
    const updates = Object.assign({}, context.data);
    // Proteger campos imutáveis
    delete updates.id;
    delete updates.createdAt;
    delete updates.createdBy;
    const success = updateUser_(id, updates);
    if (!success) return errorServerResponse_('Falha ao atualizar usuário', {}, {correlationId: context.correlationId});
    const updated = getUserById_(id);
    auditUpdate_('User', id, context.user.id, existing, updated, context.correlationId);
    return okResponse_(updated, {message: 'Usuário atualizado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao atualizar usuário', error);
    return errorServerResponse_('Erro ao atualizar usuário', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: users.delete
 */
function handleUserDelete_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const existing = getUserById_(id);
    if (!existing) return notFoundResponse_('User', id, {correlationId: context.correlationId});
    deleteUser_(id);
    auditDelete_('User', id, context.user.id, {username: existing.username}, context.correlationId);
    return okResponse_({deleted: true, id: id}, {message: 'Usuário deletado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao deletar usuário', error);
    return errorServerResponse_('Erro ao deletar usuário', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: users.changePassword
 */
function handleUserChangePassword_(context) {
  try {
    const id = context.data && context.data.id;
    const newPassword = context.data && context.data.newPassword;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    if (!newPassword) return validationErrorResponse_({newPassword: 'Nova senha obrigatória'}, {correlationId: context.correlationId});
    const user = getUserById_(id);
    if (!user) return notFoundResponse_('User', id, {correlationId: context.correlationId});
    resetUserPassword_(id, newPassword);
    auditUpdate_('User', id, context.user.id, {}, {passwordChanged: true}, context.correlationId);
    return okResponse_({changed: true}, {message: 'Senha alterada', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao alterar senha', error);
    return errorServerResponse_('Erro ao alterar senha', {error: error.message}, {correlationId: context.correlationId});
  }
}

// ============================================================================
// HANDLERS ESTUDOS
// ============================================================================

/**
 * Handler: studies.create
 */
function handleStudyCreate_(context) {
  try {
    const validation = validateObject_(context.data || {}, getCreateStudySchema_());
    if (!validation.valid) {
      return validationErrorResponse_(validation.errors, {correlationId: context.correlationId});
    }
    const study = createStudy_(context.user.id, context.data);
    auditCreate_('Study', study.id, context.user.id, {title: study.title}, context.correlationId);
    return createdResponse_(study, {message: 'Study criado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao criar study', error);
    return errorServerResponse_('Erro ao criar study', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: studies.list
 */
function handleStudyList_(context) {
  try {
    // Aplicar escopo de dados por role
    const scopedFilters = applyDataScope_(context.user, 'Studies', context.filters || {});
    const result = listStudies_(scopedFilters, context.pagination || {page: 1, pageSize: 20});
    return okResponse_(result, {message: 'Studies listados', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao listar studies', error);
    return errorServerResponse_('Erro ao listar studies', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: studies.get
 */
function handleStudyGet_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const study = getStudyById_(id);
    if (!study) return notFoundResponse_('Study', id, {correlationId: context.correlationId});
    
    // Validar acesso ao registro por escopo de dados
    requireRecordAccess_(context.user, 'Studies', study);
    
    return okResponse_(study, {message: 'Study encontrado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao buscar study', error);
    return errorServerResponse_('Erro ao buscar study', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: studies.update
 */
function handleStudyUpdate_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const existing = getStudyById_(id);
    if (!existing) return notFoundResponse_('Study', id, {correlationId: context.correlationId});
    const updates = Object.assign({}, context.data);
    // Proteger campos imutáveis
    delete updates.id;
    delete updates.createdAt;
    delete updates.ownerId;
    delete updates.createdBy;
    const updated = updateStudy_(id, updates, context.user.id);
    auditUpdate_('Study', id, context.user.id, existing, updates, context.correlationId);
    return okResponse_(updated, {message: 'Study atualizado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao atualizar study', error);
    return errorServerResponse_('Erro ao atualizar study', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: studies.delete
 */
function handleStudyDelete_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const existing = getStudyById_(id);
    if (!existing) return notFoundResponse_('Study', id, {correlationId: context.correlationId});
    deleteStudy_(id);
    auditDelete_('Study', id, context.user.id, {title: existing.title}, context.correlationId);
    return okResponse_({deleted: true, id: id}, {message: 'Study deletado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao deletar study', error);
    return errorServerResponse_('Erro ao deletar study', {error: error.message}, {correlationId: context.correlationId});
  }
}

// ============================================================================
// HANDLERS EXPERIMENTOS
// ============================================================================

/**
 * Handler: experiments.create
 */
function handleExperimentCreate_(context) {
  try {
    const validation = validateObject_(context.data || {}, getCreateExperimentSchema_());
    if (!validation.valid) {
      return validationErrorResponse_(validation.errors, {correlationId: context.correlationId});
    }
    const studyId = context.data.studyId;
    const experiment = createExperiment_(studyId, context.user.id, context.data);
    auditCreate_('Experiment', experiment.id, context.user.id, {studyId: studyId}, context.correlationId);
    return createdResponse_(experiment, {message: 'Experiment criado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao criar experiment', error);
    return errorServerResponse_('Erro ao criar experiment', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: experiments.list
 */
function handleExperimentList_(context) {
  try {
    const result = listExperiments_(context.filters || {}, context.pagination || {page: 1, pageSize: 20});
    return okResponse_(result, {message: 'Experiments listados', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao listar experiments', error);
    return errorServerResponse_('Erro ao listar experiments', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: experiments.get
 */
function handleExperimentGet_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const experiment = getExperimentById_(id);
    if (!experiment) return notFoundResponse_('Experiment', id, {correlationId: context.correlationId});
    return okResponse_(experiment, {message: 'Experiment encontrado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao buscar experiment', error);
    return errorServerResponse_('Erro ao buscar experiment', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: experiments.update
 */
function handleExperimentUpdate_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const existing = getExperimentById_(id);
    if (!existing) return notFoundResponse_('Experiment', id, {correlationId: context.correlationId});
    const updates = Object.assign({}, context.data);
    // Proteger campos imutáveis
    delete updates.id;
    delete updates.createdAt;
    delete updates.studyId;
    delete updates.ownerId;
    delete updates.createdBy;
    const updated = updateExperiment_(id, updates, context.user.id);
    auditUpdate_('Experiment', id, context.user.id, existing, updates, context.correlationId);
    return okResponse_(updated, {message: 'Experiment atualizado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao atualizar experiment', error);
    return errorServerResponse_('Erro ao atualizar experiment', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: experiments.delete
 */
function handleExperimentDelete_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const existing = getExperimentById_(id);
    if (!existing) return notFoundResponse_('Experiment', id, {correlationId: context.correlationId});
    deleteExperiment_(id);
    auditDelete_('Experiment', id, context.user.id, {studyId: existing.studyId}, context.correlationId);
    return okResponse_({deleted: true, id: id}, {message: 'Experiment deletado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao deletar experiment', error);
    return errorServerResponse_('Erro ao deletar experiment', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: experiments.list_by_substrate
 * 
 * Lista experimentos agrupados por tipo de substrato com estatísticas
 * 
 * @param {object} context — Contexto da requisição
 * @returns {object} Response com experimentos organizados por substrato
 */
function handleExperimentsListBySubstrate_(context) {
  try {
    // Buscar todos os tipos de substrato disponíveis
    const substrateTypes = getSubstrateTypes_();
    
    // Estrutura de resposta
    const result = {
      substratos: [],
      total_experimentos: 0,
      timestamp: nowIso_()
    };
    
    // Para cada tipo de substrato, buscar experimentos
    substrateTypes.forEach(function(substrate) {
      const experiments = getExperimentsBySubstrate_(substrate.label);
      
      result.substratos.push({
        tipo: substrate.label,
        tipo_key: substrate.key,
        total_experimentos: experiments.length,
        experimentos: experiments.map(function(exp) {
          return {
            id: exp.id,
            studyId: exp.studyId,
            design: exp.design,
            replicates: exp.replicates,
            status: exp.status,
            createdAt: exp.createdAt
          };
        })
      });
      
      result.total_experimentos += experiments.length;
    });
    
    logInfo_('Experimentos listados por substrato', {
      total: result.total_experimentos,
      substratos: result.substratos.length,
      userId: context.user.id
    });
    
    return okResponse_(result, {
      message: 'Experimentos agrupados por substrato',
      correlationId: context.correlationId
    });
    
  } catch (error) {
    logException_('Erro ao listar experiments por substrato', error);
    return errorServerResponse_(
      'Erro ao listar experiments por substrato',
      {error: error.message},
      {correlationId: context.correlationId}
    );
  }
}

// ============================================================================
// HANDLERS OBSERVAÇÕES
// ============================================================================

/**
 * Handler: observations.create
 */
function handleObservationCreate_(context) {
  try {
    const validation = validateObject_(context.data || {}, getCreateObservationSchema_());
    if (!validation.valid) {
      return validationErrorResponse_(validation.errors, {correlationId: context.correlationId});
    }
    const observation = createObservation_(context.user.id, context.data);
    auditCreate_('Observation', observation.id, context.user.id, {experimentId: observation.experimentId}, context.correlationId);
    return createdResponse_(observation, {message: 'Observation criada', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao criar observation', error);
    return errorServerResponse_('Erro ao criar observation', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: observations.list
 */
function handleObservationList_(context) {
  try {
    const result = listObservations_(context.filters || {}, context.pagination || {page: 1, pageSize: 20});
    return okResponse_(result, {message: 'Observations listadas', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao listar observations', error);
    return errorServerResponse_('Erro ao listar observations', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: observations.get
 */
function handleObservationGet_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const observation = getObservationById_(id);
    if (!observation) return notFoundResponse_('Observation', id, {correlationId: context.correlationId});
    return okResponse_(observation, {message: 'Observation encontrada', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao buscar observation', error);
    return errorServerResponse_('Erro ao buscar observation', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: observations.update
 */
function handleObservationUpdate_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const existing = getObservationById_(id);
    if (!existing) return notFoundResponse_('Observation', id, {correlationId: context.correlationId});
    const updates = Object.assign({}, context.data);
    // Proteger campos imutáveis
    delete updates.id;
    delete updates.createdAt;
    delete updates.experimentId;
    delete updates.createdBy;
    const updated = updateObservation_(id, updates, context.user.id);
    auditUpdate_('Observation', id, context.user.id, existing, updates, context.correlationId);
    return okResponse_(updated, {message: 'Observation atualizada', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao atualizar observation', error);
    return errorServerResponse_('Erro ao atualizar observation', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: observations.delete
 */
function handleObservationDelete_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const existing = getObservationById_(id);
    if (!existing) return notFoundResponse_('Observation', id, {correlationId: context.correlationId});
    deleteObservation_(id);
    auditDelete_('Observation', id, context.user.id, {experimentId: existing.experimentId}, context.correlationId);
    return okResponse_({deleted: true, id: id}, {message: 'Observation deletada', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao deletar observation', error);
    return errorServerResponse_('Erro ao deletar observation', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: observations.aggregate_by_substrate
 * 
 * Agrega observações por tipo de substrato calculando estatísticas de performance
 * Métricas: altura média, vigor médio, produção média, total de observações
 * 
 * @param {object} context — Contexto da requisição
 * @returns {object} Response com métricas agregadas por substrato
 */
function handleObservationsAggregateBySubstrate_(context) {
  try {
    // Buscar todos os tipos de substrato
    const substrateTypes = getSubstrateTypes_();
    
    // Estrutura de resposta
    const result = {
      metricas_por_substrato: [],
      total_observacoes: 0,
      variaveis_analisadas: ['altura', 'vigor', 'producao'],
      timestamp: nowIso_()
    };
    
    // Para cada tipo de substrato
    substrateTypes.forEach(function(substrate) {
      // Buscar experimentos deste substrato
      const experiments = getExperimentsBySubstrate_(substrate.label);
      
      // Acumular observações de todos os experimentos
      const allObservations = [];
      experiments.forEach(function(exp) {
        const obs = getObservationsByExperiment_(exp.id) || [];
        allObservations.push.apply(allObservations, obs);
      });
      
      // Separar por variável
      const alturaObs = allObservations.filter(function(o) { 
        return o.variable && o.variable.toLowerCase().indexOf('altura') !== -1; 
      });
      const vigorObs = allObservations.filter(function(o) { 
        return o.variable && o.variable.toLowerCase().indexOf('vigor') !== -1; 
      });
      const producaoObs = allObservations.filter(function(o) { 
        return o.variable && (
          o.variable.toLowerCase().indexOf('producao') !== -1 ||
          o.variable.toLowerCase().indexOf('produção') !== -1 ||
          o.variable.toLowerCase().indexOf('yield') !== -1
        ); 
      });
      
      // Calcular médias
      const calcMedia = function(observations) {
        if (observations.length === 0) return 0;
        const sum = observations.reduce(function(acc, obs) {
          return acc + (parseFloat(obs.value) || 0);
        }, 0);
        return sum / observations.length;
      };
      
      const metrics = {
        tipo_substrato: substrate.label,
        tipo_key: substrate.key,
        total_experimentos: experiments.length,
        total_observacoes: allObservations.length,
        metricas: {
          altura_media_cm: calcMedia(alturaObs).toFixed(2),
          total_obs_altura: alturaObs.length,
          vigor_medio: calcMedia(vigorObs).toFixed(2),
          total_obs_vigor: vigorObs.length,
          producao_media_g: calcMedia(producaoObs).toFixed(2),
          total_obs_producao: producaoObs.length
        },
        unidades: {
          altura: alturaObs.length > 0 ? alturaObs[0].unit : 'cm',
          vigor: vigorObs.length > 0 ? vigorObs[0].unit : 'escala',
          producao: producaoObs.length > 0 ? producaoObs[0].unit : 'g'
        }
      };
      
      result.metricas_por_substrato.push(metrics);
      result.total_observacoes += allObservations.length;
    });
    
    // Calcular ranking (melhor substrato por métrica)
    const ranking = {
      melhor_altura: '',
      melhor_vigor: '',
      melhor_producao: ''
    };
    
    let maxAltura = -1, maxVigor = -1, maxProducao = -1;
    result.metricas_por_substrato.forEach(function(m) {
      const altura = parseFloat(m.metricas.altura_media_cm);
      const vigor = parseFloat(m.metricas.vigor_medio);
      const producao = parseFloat(m.metricas.producao_media_g);
      
      if (altura > maxAltura) {
        maxAltura = altura;
        ranking.melhor_altura = m.tipo_substrato;
      }
      if (vigor > maxVigor) {
        maxVigor = vigor;
        ranking.melhor_vigor = m.tipo_substrato;
      }
      if (producao > maxProducao) {
        maxProducao = producao;
        ranking.melhor_producao = m.tipo_substrato;
      }
    });
    
    result.ranking = ranking;
    
    logInfo_('Observações agregadas por substrato', {
      total: result.total_observacoes,
      substratos: result.metricas_por_substrato.length,
      userId: context.user.id
    });
    
    return okResponse_(result, {
      message: 'Observações agregadas por substrato',
      correlationId: context.correlationId
    });
    
  } catch (error) {
    logException_('Erro ao agregar observations por substrato', error);
    return errorServerResponse_(
      'Erro ao agregar observations por substrato',
      {error: error.message},
      {correlationId: context.correlationId}
    );
  }
}

// ============================================================================
// HANDLERS INSUMOS (PROMPT 1)
// ============================================================================

/**
 * Handler: insumos.create
 */
function handleInsumoCreate_(context) {
  try {
    const validation = validateObject_(context.data || {}, getCreateInsumoSchema_());
    if (!validation.valid) {
      return validationErrorResponse_(validation.errors, {correlationId: context.correlationId});
    }
    const insumo = createInsumo_(context.user.id, context.data);
    auditCreate_('Insumos_Catalogo', insumo.id, context.user.id, {nomeComercial: insumo.nomeComercial}, context.correlationId);
    return createdResponse_(insumo, {message: 'Insumo criado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao criar insumo', error);
    return errorServerResponse_('Erro ao criar insumo', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: insumos.list
 */
function handleInsumoList_(context) {
  try {
    const result = listInsumos_(context.filters || {}, context.pagination || {page: 1, pageSize: 20});
    return okResponse_(result, {message: 'Insumos listados', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao listar insumos', error);
    return errorServerResponse_('Erro ao listar insumos', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: insumos.get
 */
function handleInsumoGet_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const insumo = getInsumoById_(id);
    if (!insumo) return notFoundResponse_('Insumo', id, {correlationId: context.correlationId});
    return okResponse_(insumo, {message: 'Insumo encontrado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao buscar insumo', error);
    return errorServerResponse_('Erro ao buscar insumo', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: insumos.update
 */
function handleInsumoUpdate_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const existing = getInsumoById_(id);
    if (!existing) return notFoundResponse_('Insumo', id, {correlationId: context.correlationId});
    const updates = Object.assign({}, context.data);
    delete updates.id;
    delete updates.createdAt;
    const updated = updateInsumo_(id, updates, context.user.id);
    auditUpdate_('Insumos_Catalogo', id, context.user.id, existing, updates, context.correlationId);
    return okResponse_(updated, {message: 'Insumo atualizado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao atualizar insumo', error);
    return errorServerResponse_('Erro ao atualizar insumo', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: insumos.delete
 */
function handleInsumoDelete_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const existing = getInsumoById_(id);
    if (!existing) return notFoundResponse_('Insumo', id, {correlationId: context.correlationId});
    deleteInsumo_(id);
    auditDelete_('Insumos_Catalogo', id, context.user.id, {nomeComercial: existing.nomeComercial}, context.correlationId);
    return okResponse_({deleted: true, id: id}, {message: 'Insumo deletado (soft)', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao deletar insumo', error);
    return errorServerResponse_('Erro ao deletar insumo', {error: error.message}, {correlationId: context.correlationId});
  }
}

// ============================================================================
// HANDLERS LOTES CoA (PROMPT 1)
// ============================================================================

/**
 * Handler: lotes.create
 */
function handleLoteCoACreate_(context) {
  try {
    const validation = validateObject_(context.data || {}, getCreateLoteCoASchema_());
    if (!validation.valid) {
      return validationErrorResponse_(validation.errors, {correlationId: context.correlationId});
    }
    const lote = createLoteCoA_(context.user.id, context.data);
    auditCreate_('Lotes_CoA', lote.id, context.user.id, {numeroLote: lote.numeroLote, insumoId: lote.insumoId}, context.correlationId);
    return createdResponse_(lote, {message: 'Lote CoA criado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao criar lote CoA', error);
    return errorServerResponse_('Erro ao criar lote CoA', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: lotes.list
 */
function handleLoteCoAList_(context) {
  try {
    const result = listLotesCoA_(context.filters || {}, context.pagination || {page: 1, pageSize: 20});
    return okResponse_(result, {message: 'Lotes CoA listados', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao listar lotes CoA', error);
    return errorServerResponse_('Erro ao listar lotes CoA', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: lotes.get
 */
function handleLoteCoAGet_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const lote = getLoteCoAById_(id);
    if (!lote) return notFoundResponse_('Lote CoA', id, {correlationId: context.correlationId});
    return okResponse_(lote, {message: 'Lote CoA encontrado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao buscar lote CoA', error);
    return errorServerResponse_('Erro ao buscar lote CoA', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: lotes.update
 */
function handleLoteCoAUpdate_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const existing = getLoteCoAById_(id);
    if (!existing) return notFoundResponse_('Lote CoA', id, {correlationId: context.correlationId});
    const updates = Object.assign({}, context.data);
    delete updates.id;
    delete updates.createdAt;
    delete updates.insumoId;
    const updated = updateLoteCoA_(id, updates, context.user.id);
    auditUpdate_('Lotes_CoA', id, context.user.id, existing, updates, context.correlationId);
    return okResponse_(updated, {message: 'Lote CoA atualizado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao atualizar lote CoA', error);
    return errorServerResponse_('Erro ao atualizar lote CoA', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: lotes.delete
 */
function handleLoteCoADelete_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const existing = getLoteCoAById_(id);
    if (!existing) return notFoundResponse_('Lote CoA', id, {correlationId: context.correlationId});
    deleteLoteCoA_(id);
    auditDelete_('Lotes_CoA', id, context.user.id, {numeroLote: existing.numeroLote}, context.correlationId);
    return okResponse_({deleted: true, id: id}, {message: 'Lote CoA deletado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao deletar lote CoA', error);
    return errorServerResponse_('Erro ao deletar lote CoA', {error: error.message}, {correlationId: context.correlationId});
  }
}

// ============================================================================
// HANDLERS RECEITAS FERTIRRIGAÇÃO (PROMPT 1)
// ============================================================================

/**
 * Handler: receitas.create
 */
function handleReceitaCreate_(context) {
  try {
    const validation = validateObject_(context.data || {}, getCreateReceitaFertirrigacaoSchema_());
    if (!validation.valid) {
      return validationErrorResponse_(validation.errors, {correlationId: context.correlationId});
    }
    const receita = createReceitaFertirrigacao_(context.user.id, context.data);
    auditCreate_('Receitas_Fertirrigacao', receita.id, context.user.id, {nomeFase: receita.nomeFase}, context.correlationId);
    return createdResponse_(receita, {message: 'Receita criada', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao criar receita', error);
    return errorServerResponse_('Erro ao criar receita', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: receitas.list
 */
function handleReceitaList_(context) {
  try {
    const result = listReceitas_(context.filters || {}, context.pagination || {page: 1, pageSize: 20});
    return okResponse_(result, {message: 'Receitas listadas', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao listar receitas', error);
    return errorServerResponse_('Erro ao listar receitas', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: receitas.get
 */
function handleReceitaGet_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const receita = getReceitaById_(id);
    if (!receita) return notFoundResponse_('Receita', id, {correlationId: context.correlationId});
    return okResponse_(receita, {message: 'Receita encontrada', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao buscar receita', error);
    return errorServerResponse_('Erro ao buscar receita', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: receitas.update
 */
function handleReceitaUpdate_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const existing = getReceitaById_(id);
    if (!existing) return notFoundResponse_('Receita', id, {correlationId: context.correlationId});
    const updates = Object.assign({}, context.data);
    delete updates.id;
    delete updates.createdAt;
    const updated = updateReceita_(id, updates, context.user.id);
    auditUpdate_('Receitas_Fertirrigacao', id, context.user.id, existing, updates, context.correlationId);
    return okResponse_(updated, {message: 'Receita atualizada', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao atualizar receita', error);
    return errorServerResponse_('Erro ao atualizar receita', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: receitas.delete
 */
function handleReceitaDelete_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const existing = getReceitaById_(id);
    if (!existing) return notFoundResponse_('Receita', id, {correlationId: context.correlationId});
    deleteReceita_(id);
    auditDelete_('Receitas_Fertirrigacao', id, context.user.id, {nomeFase: existing.nomeFase}, context.correlationId);
    return okResponse_({deleted: true, id: id}, {message: 'Receita deletada', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao deletar receita', error);
    return errorServerResponse_('Erro ao deletar receita', {error: error.message}, {correlationId: context.correlationId});
  }
}

// ============================================================================
// HANDLERS PROTOCOLOS BIOLÓGICOS (PROMPT 1)
// ============================================================================

/**
 * Handler: protocolos.create
 */
function handleProtocoloCreate_(context) {
  try {
    const validation = validateObject_(context.data || {}, getCreateProtocoloBiologicoSchema_());
    if (!validation.valid) {
      return validationErrorResponse_(validation.errors, {correlationId: context.correlationId});
    }
    const protocolo = createProtocoloBiologico_(context.user.id, context.data);
    auditCreate_('Protocolos_Biologicos', protocolo.id, context.user.id, {nomeProtocolo: protocolo.nomeProtocolo}, context.correlationId);
    return createdResponse_(protocolo, {message: 'Protocolo criado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao criar protocolo', error);
    return errorServerResponse_('Erro ao criar protocolo', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: protocolos.list
 */
function handleProtocoloList_(context) {
  try {
    const result = listProtocolos_(context.filters || {}, context.pagination || {page: 1, pageSize: 20});
    return okResponse_(result, {message: 'Protocolos listados', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao listar protocolos', error);
    return errorServerResponse_('Erro ao listar protocolos', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: protocolos.get
 */
function handleProtocoloGet_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const protocolo = getProtocoloById_(id);
    if (!protocolo) return notFoundResponse_('Protocolo', id, {correlationId: context.correlationId});
    return okResponse_(protocolo, {message: 'Protocolo encontrado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao buscar protocolo', error);
    return errorServerResponse_('Erro ao buscar protocolo', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: protocolos.update
 */
function handleProtocoloUpdate_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const existing = getProtocoloById_(id);
    if (!existing) return notFoundResponse_('Protocolo', id, {correlationId: context.correlationId});
    const updates = Object.assign({}, context.data);
    delete updates.id;
    delete updates.createdAt;
    const updated = updateProtocolo_(id, updates, context.user.id);
    auditUpdate_('Protocolos_Biologicos', id, context.user.id, existing, updates, context.correlationId);
    return okResponse_(updated, {message: 'Protocolo atualizado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao atualizar protocolo', error);
    return errorServerResponse_('Erro ao atualizar protocolo', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: protocolos.delete
 */
function handleProtocoloDelete_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const existing = getProtocoloById_(id);
    if (!existing) return notFoundResponse_('Protocolo', id, {correlationId: context.correlationId});
    deleteProtocolo_(id);
    auditDelete_('Protocolos_Biologicos', id, context.user.id, {nomeProtocolo: existing.nomeProtocolo}, context.correlationId);
    return okResponse_({deleted: true, id: id}, {message: 'Protocolo deletado (soft)', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao deletar protocolo', error);
    return errorServerResponse_('Erro ao deletar protocolo', {error: error.message}, {correlationId: context.correlationId});
  }
}

// ============================================================================
// HANDLERS PARECERES COMPATIBILIDADE (PROMPT 1)
// ============================================================================

/**
 * Handler: pareceres.create
 */
function handleParecerCreate_(context) {
  try {
    const parecer = createParecerCompatibilidade_(context.user.id, context.data);
    auditCreate_('Pareceres_Compatibilidade', parecer.id, context.user.id, {receitaId: parecer.receitaId, protocoloId: parecer.protocoloId}, context.correlationId);
    return createdResponse_(parecer, {message: 'Parecer criado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao criar parecer', error);
    return errorServerResponse_('Erro ao criar parecer', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: pareceres.list
 */
function handleParecerList_(context) {
  try {
    const result = listPareceres_(context.filters || {}, context.pagination || {page: 1, pageSize: 20});
    return okResponse_(result, {message: 'Pareceres listados', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao listar pareceres', error);
    return errorServerResponse_('Erro ao listar pareceres', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: pareceres.get
 */
function handleParecerGet_(context) {
  try {
    const id = context.data && context.data.id;
    if (!id) return validationErrorResponse_({id: 'ID obrigatório'}, {correlationId: context.correlationId});
    const parecer = getParecerById_(id);
    if (!parecer) return notFoundResponse_('Parecer', id, {correlationId: context.correlationId});
    return okResponse_(parecer, {message: 'Parecer encontrado', correlationId: context.correlationId});
  } catch (error) {
    logException_('Erro ao buscar parecer', error);
    return errorServerResponse_('Erro ao buscar parecer', {error: error.message}, {correlationId: context.correlationId});
  }
}

/**
 * Handler: pareceres.analisar (Business Logic)
 */
function handleParecerAnalisar_(context) {
  try {
    const receitaId = context.data && context.data.receitaId;
    const protocoloId = context.data && context.data.protocoloId;
    const loteIds = context.data && context.data.loteIds;
    const usuarioEmail = context.user && context.user.username;
    
    if (!receitaId) return validationErrorResponse_({receitaId: 'receitaId obrigatório'}, {correlationId: context.correlationId});
    if (!protocoloId) return validationErrorResponse_({protocoloId: 'protocoloId obrigatório'}, {correlationId: context.correlationId});
    
    const parecer = analisarCompatibilidade_(receitaId, protocoloId, loteIds || [], usuarioEmail, context.user.id);
    
    auditCreate_('Pareceres_Compatibilidade', parecer.id, context.user.id, {
      receitaId: parecer.receitaId,
      protocoloId: parecer.protocoloId,
      veredicto: parecer.veredicto
    }, context.correlationId);
    
    return createdResponse_(parecer, {
      message: 'Análise de compatibilidade concluída',
      correlationId: context.correlationId
    });
  } catch (error) {
    logException_('Erro ao analisar compatibilidade', error);
    return errorServerResponse_('Erro ao analisar compatibilidade', {error: error.message}, {correlationId: context.correlationId});
  }
}

// ============================================================================
// HANDLERS BIO.VALIDATE (PROMPT 5)
// ============================================================================

/**
 * Handler: bio.validate
 * Validates biological compatibility parameters before parecer creation
 */
function handleBioValidate_(context) {
  try {
    // Validate required params
    const required = ['faseCultivo', 'metodoAplicacao'];
    const missing = required.filter(field => !context.data || !context.data[field]);
    
    if (missing.length > 0) {
      return validationErrorResponse_(
        { _error: 'Campos obrigatórios: ' + missing.join(', ') },
        { correlationId: context.correlationId }
      );
    }

    // Delegate to service
    const result = BioCompatibilityService.validateBioCompatibility({
      faseCultivo: context.data.faseCultivo,
      tipoInsumo: context.data.tipoInsumo,
      metodoAplicacao: context.data.metodoAplicacao,
      cultivo: context.data.cultivo,
      lote: context.data.lote,
      protocolo: context.data.protocolo,
      receitaId: context.data.receitaId,
      correlationId: context.correlationId,
      userId: context.user.id
    });

    // Audit log
    auditCreate_(
      'BioValidation',
      result.metadata.validationId,
      context.user.id,
      { veredicto: result.veredicto, regrasAcionadas: result.regrasAcionadas.length },
      context.correlationId
    );

    return okResponse_(result, {
      message: 'Validação biológica concluída',
      correlationId: context.correlationId
    });

  } catch (error) {
    logException_('Erro ao validar compatibilidade biológica', error);
    return errorServerResponse_(
      'Erro ao validar compatibilidade biológica',
      { error: error.message },
      { correlationId: context.correlationId }
    );
  }
}

// ============================================================================
// HANDLERS COMORBIDADES CANÁBICAS (PROMPT MC-1)
// ============================================================================

/**
 * Handler: comorbidade.catalogo
 * Retorna catálogo completo das 46 comorbidades
 */
function handleComorbidadeCatalogo_(context) {
  try {
    // Cache o catálogo por 6 horas
    const cache = CacheService.getScriptCache();
    const cacheKey = 'catalogo_comorbidades_v1';
    
    let catalogoJson = cache.get(cacheKey);
    
    if (!catalogoJson) {
      const catalogo = getAllRecords_('REF_COMORBIDADES_CANABICAS');
      catalogoJson = JSON.stringify(catalogo);
      cache.put(cacheKey, catalogoJson, 21600); // 6 horas
    }
    
    const catalogo = JSON.parse(catalogoJson);
    
    // Aplicar filtros se fornecidos
    let filtered = catalogo;
    
    if (context.data && context.data.filtros) {
      const filtros = context.data.filtros;
      
      if (filtros.triagem) {
        filtered = filtered.filter(function(c) {
          return c.triagem === filtros.triagem;
        });
      }
      
      if (filtros.grau_coa) {
        filtered = filtered.filter(function(c) {
          return c.grau_coa_exigido === filtros.grau_coa;
        });
      }
    }
    
    return okResponse_({
      items: filtered,
      total: filtered.length
    }, {
      message: 'Catálogo de comorbidades canábicas',
      correlationId: context.correlationId
    });
    
  } catch (error) {
    logException_('Erro ao buscar catálogo de comorbidades', error);
    return errorServerResponse_(
      'Erro ao buscar catálogo',
      { error: error.message },
      { correlationId: context.correlationId }
    );
  }
}

/**
 * Handler: comorbidade.salvar
 * Salva seleção de comorbidades do paciente (1 a 5)
 */
function handleComorbidadeSalvar_(context) {
  try {
    // Validar entrada
    if (!context.data || !context.data.paciente_id) {
      return validationErrorResponse_(
        { paciente_id: 'Campo obrigatório' },
        { correlationId: context.correlationId }
      );
    }
    
    if (!context.data.selecoes || !Array.isArray(context.data.selecoes)) {
      return validationErrorResponse_(
        { selecoes: 'Array de seleções obrigatório' },
        { correlationId: context.correlationId }
      );
    }
    
    // Chamar repository
    const result = salvarComorbidadesPaciente_(
      context.data.paciente_id,
      context.data.selecoes
    );
    
    if (!result.ok) {
      if (result.error === 'VALIDATION_ERROR') {
        return validationErrorResponse_(
          { message: result.message },
          { correlationId: context.correlationId }
        );
      }
      
      if (result.error === 'LOCK_TIMEOUT') {
        return errorServerResponse_(
          result.message,
          {},
          { correlationId: context.correlationId }
        );
      }
      
      return errorServerResponse_(
        'Erro ao salvar comorbidades',
        { error: result.message },
        { correlationId: context.correlationId }
      );
    }
    
    return okResponse_({
      saved: result.saved,
      grau_coa_maximo: result.grau_coa_maximo
    }, {
      message: 'Comorbidades salvas com sucesso',
      correlationId: context.correlationId
    });
    
  } catch (error) {
    logException_('Erro ao salvar comorbidades do paciente', error);
    return errorServerResponse_(
      'Erro ao salvar comorbidades',
      { error: error.message },
      { correlationId: context.correlationId }
    );
  }
}

/**
 * Handler: comorbidade.listar
 * Lista comorbidades do paciente ordenadas por prioridade
 */
function handleComorbidadeListar_(context) {
  try {
    if (!context.data || !context.data.paciente_id) {
      return validationErrorResponse_(
        { paciente_id: 'Campo obrigatório' },
        { correlationId: context.correlationId }
      );
    }
    
    const comorbidades = getComorbidadesPaciente_(context.data.paciente_id);
    
    // Calcular grau máximo se houver comorbidades
    let grau_coa_maximo = null;
    if (comorbidades.length > 0) {
      const graus = {};
      comorbidades.forEach(function(c) {
        graus[c.grau_coa_obrigatorio] = true;
      });
      grau_coa_maximo = calcularGrauCoAMaximoDeEnums_(Object.keys(graus));
    }
    
    return okResponse_({
      items: comorbidades,
      grau_coa_maximo: grau_coa_maximo
    }, {
      message: 'Comorbidades do paciente',
      correlationId: context.correlationId
    });
    
  } catch (error) {
    logException_('Erro ao listar comorbidades do paciente', error);
    return errorServerResponse_(
      'Erro ao listar comorbidades',
      { error: error.message },
      { correlationId: context.correlationId }
    );
  }
}

/**
 * Handler: comorbidade.validar_coa
 * Valida conformidade de lote de CoA com comorbidades do paciente
 */
function handleComorbidadeValidarCoA_(context) {
  try {
    if (!context.data || !context.data.paciente_id || !context.data.lote_coa_id) {
      return validationErrorResponse_(
        { 
          paciente_id: context.data && context.data.paciente_id ? null : 'Campo obrigatório',
          lote_coa_id: context.data && context.data.lote_coa_id ? null : 'Campo obrigatório'
        },
        { correlationId: context.correlationId }
      );
    }
    
    const result = validarConformidadeCoALote_(
      context.data.paciente_id,
      context.data.lote_coa_id
    );
    
    if (!result.ok) {
      if (result.error === 'NO_COMORBIDADES' || result.error === 'LOTE_NOT_FOUND') {
        return notFoundResponse_(
          result.error === 'NO_COMORBIDADES' ? 'Comorbidades' : 'Lote',
          result.error === 'NO_COMORBIDADES' ? context.data.paciente_id : context.data.lote_coa_id,
          { 
            message: result.message,
            correlationId: context.correlationId 
          }
        );
      }
      
      return errorServerResponse_(
        'Erro ao validar conformidade',
        { error: result.message },
        { correlationId: context.correlationId }
      );
    }
    
    // Registrar auditoria se houver bloqueio sanitário
    if (!result.apto) {
      auditCreate_('COMORBIDADE_BLOQUEIO_COA', {
        paciente_id: context.data.paciente_id,
        lote_id: context.data.lote_coa_id,
        grau_exigido: result.grau_exigido,
        motivos: result.motivos_bloqueio
      }, context.user.id, {
        action: 'VALIDAR_COA_BLOQUEADO',
        correlationId: context.correlationId
      });
    }
    
    return okResponse_({
      apto: result.apto,
      grau_exigido: result.grau_exigido,
      grau_lote: result.grau_lote,
      motivos_bloqueio: result.motivos_bloqueio,
      comorbidades_criticas: result.comorbidades_criticas,
      dados_lote: result.dados_lote
    }, {
      message: result.apto ? 'Lote compatível com comorbidades do paciente' : 'Lote NÃO compatível — bloqueio sanitário ativo',
      correlationId: context.correlationId
    });
    
  } catch (error) {
    logException_('Erro ao validar conformidade de CoA', error);
    return errorServerResponse_(
      'Erro ao validar conformidade',
      { error: error.message },
      { correlationId: context.correlationId }
    );
  }
}

/**
 * Handler: comorbidade.estudos
 * Retorna estudos prioritários de uma comorbidade específica
 */
function handleComorbidadeEstudos_(context) {
  try {
    if (!context.data || !context.data.comorbidade_id) {
      return validationErrorResponse_(
        { comorbidade_id: 'Campo obrigatório' },
        { correlationId: context.correlationId }
      );
    }
    
    const catalogo = getAllRecords_('REF_COMORBIDADES_CANABICAS');
    const comorbidade = catalogo.find(function(c) {
      return parseInt(c.id) === parseInt(context.data.comorbidade_id);
    });
    
    if (!comorbidade) {
      return notFoundResponse_(
        'Comorbidade',
        context.data.comorbidade_id,
        { correlationId: context.correlationId }
      );
    }
    
    // Parsear JSON de estudos
    let estudos = [];
    try {
      estudos = JSON.parse(comorbidade.estudos_prioritarios_json);
    } catch (parseError) {
      Logger.log('ERRO ao parsear estudos da comorbidade ' + comorbidade.id + ': ' + parseError.message);
      estudos = [];
    }
    
    return okResponse_({
      comorbidade_id: comorbidade.id,
      nome_terapeutica: comorbidade.nome_terapeutica,
      triagem: comorbidade.triagem,
      total_evidencias: comorbidade.total_evidencias,
      estudos: estudos
    }, {
      message: 'Estudos prioritários da comorbidade',
      correlationId: context.correlationId
    });
    
  } catch (error) {
    logException_('Erro ao buscar estudos da comorbidade', error);
    return errorServerResponse_(
      'Erro ao buscar estudos',
      { error: error.message },
      { correlationId: context.correlationId }
    );
  }
}

/**
 * Handler: comorbidade.pendente
 * Verifica se usuário/paciente já respondeu comorbidades (para onboarding)
 */
function handleComorbidadePendente_(context) {
  try {
    // Buscar ID do paciente associado ao usuário atual
    const userId = context.user.id;
    
    // Tentar buscar mapeamento user → paciente
    const mapping = getMappingByUser_(userId);
    
    // Se mapping existe, usar pacienteId do mapping; senão, fallback para userId (compatibilidade)
    const pacienteId = mapping ? mapping.pacienteId : userId;
    
    const comorbidades = getComorbidadesPaciente_(pacienteId);
    
    const respondeu = comorbidades.length > 0;
    
    return okResponse_({
      respondeu: respondeu,
      total_comorbidades: comorbidades.length,
      pacienteId: pacienteId,
      usouMapping: mapping !== null
    }, {
      message: respondeu ? 'Usuário já respondeu comorbidades' : 'Usuário ainda não respondeu comorbidades',
      correlationId: context.correlationId
    });
    
  } catch (error) {
    logException_('Erro ao verificar comorbidades pendentes', error);
    return errorServerResponse_(
      'Erro ao verificar onboarding',
      { error: error.message },
      { correlationId: context.correlationId }
    );
  }
}

/**
 * Handler: comorbidade.analise_cultivo
 * 
 * Retorna análise de métodos de cultivo baseada nas comorbidades do paciente.
 * Agrega por manejo_solo_ideal e calcula distribuição/recomendação principal.
 */
function handleComorbidadeAnaliseCultivo_(context) {
  try {
    // Validar entrada
    const pacienteId = context.request.data.pacienteId;
    
    if (!pacienteId || typeof pacienteId !== 'string') {
      return errorValidationResponse_(
        'pacienteId obrigatório',
        { campo: 'pacienteId' },
        { correlationId: context.correlationId }
      );
    }
    
    logDebug_('Analisando cultivo para paciente', {
      pacienteId: pacienteId,
      userId: context.user.id,
      correlationId: context.correlationId
    });
    
    // Buscar comorbidades do paciente
    const comorbidadesPaciente = getComorbidadesPaciente_(pacienteId);
    
    if (comorbidadesPaciente.length === 0) {
      return errorNotFoundResponse_(
        'Paciente sem comorbidades cadastradas',
        { pacienteId: pacienteId },
        { correlationId: context.correlationId }
      );
    }
    
    // Agregar por manejo_solo_ideal
    const distribuicao = {};
    const detalhamento = [];
    
    comorbidadesPaciente.forEach(function(c) {
      const solo = c.solo_recomendado;
      
      // Inicializar grupo se não existe
      if (!distribuicao[solo]) {
        distribuicao[solo] = {
          metodo: solo,
          count: 0,
          percentual: 0,
          comorbidades: []
        };
      }
      
      // Incrementar contagem
      distribuicao[solo].count++;
      distribuicao[solo].comorbidades.push({
        nome: c.nome_terapeutica,
        prioridade: c.prioridade,
        quimiotipo: c.quimiotipo_sugerido,
        grau_coa: c.grau_coa_obrigatorio
      });
      
      // Buscar mecanismo agro-saúde
      const mecanismo = getMecanismoAgroSaude_(c.comorbidade_id);
      
      // Adicionar ao detalhamento
      detalhamento.push({
        comorbidade_id: c.comorbidade_id,
        nome: c.nome_terapeutica,
        prioridade: c.prioridade,
        quimiotipo: c.quimiotipo_sugerido,
        cultivo_ideal: c.solo_recomendado,
        grau_coa: c.grau_coa_obrigatorio,
        mecanismo: mecanismo || 'Mecanismo não documentado'
      });
    });
    
    // Calcular percentuais
    const totalComorbidades = comorbidadesPaciente.length;
    for (let solo in distribuicao) {
      distribuicao[solo].percentual = Math.round(
        (distribuicao[solo].count / totalComorbidades) * 100
      );
    }
    
    // Encontrar recomendação principal (maior count)
    let maxCount = 0;
    let recomendacaoMetodo = '';
    for (let solo in distribuicao) {
      if (distribuicao[solo].count > maxCount) {
        maxCount = distribuicao[solo].count;
        recomendacaoMetodo = solo;
      }
    }
    
    const percentualRecomendacao = Math.round((maxCount / totalComorbidades) * 100);
    
    logInfo_('Análise de cultivo calculada', {
      pacienteId: pacienteId,
      total_comorbidades: totalComorbidades,
      recomendacao: recomendacaoMetodo,
      percentual: percentualRecomendacao
    });
    
    return okResponse_({
      pacienteId: pacienteId,
      total_comorbidades: totalComorbidades,
      recomendacao_principal: {
        metodo: recomendacaoMetodo,
        count: maxCount,
        percentual: percentualRecomendacao,
        descricao: formatarDescricaoMetodo_(recomendacaoMetodo)
      },
      distribuicao: distribuicao,
      detalhamento: detalhamento.sort(function(a, b) {
        return a.prioridade - b.prioridade;
      })
    }, {
      message: 'Análise de cultivo calculada com sucesso',
      correlationId: context.correlationId
    });
    
  } catch (error) {
    logException_('Erro ao analisar cultivo', error, {
      pacienteId: context.request.data.pacienteId
    });
    return errorServerResponse_(
      'Erro ao processar análise de cultivo',
      { error: error.message },
      { correlationId: context.correlationId }
    );
  }
}

/**
 * Formata nome legível do método de cultivo
 * 
 * @param {string} metodo - enum MANEJO_SOLO
 * @returns {string}
 * @private
 */
function formatarDescricaoMetodo_(metodo) {
  const descricoes = {
    'SOLO_VIVO_ORGANICO': 'Solo vivo orgânico com microbiota ativa e matéria orgânica',
    'HIDROPONIA_MINERAL': 'Hidroponia mineral de precisão com controle rigoroso de nutrientes',
    'SUBSTRATO_TRICHODERMA': 'Substrato inoculado com Trichoderma spp. para bioestimulação',
    'AVALIACAO_INDIVIDUAL': 'Avaliação individual - requer análise caso a caso'
  };
  return descricoes[metodo] || metodo;
}

/**
 * Handler: comorbidade.clusters
 * 
 * Agrupa comorbidades similares usando análise de co-ocorrência em pacientes
 * Algoritmo K-means simplificado baseado em Jaccard index
 * 
 * @param {object} context — Contexto da requisição
 * @returns {object} Response com clusters identificados
 */
function handleComorbidadeClusters_(context) {
  try {
    // Parâmetros opcionais
    const numClusters = (context.data && context.data.num_clusters) ? 
      parseInt(context.data.num_clusters) : 5; // Default: 5 clusters
    
    if (numClusters < 2 || numClusters > 10) {
      return validationErrorResponse_({
        num_clusters: 'Número de clusters deve estar entre 2 e 10'
      }, {correlationId: context.correlationId});
    }
    
    // 1. Carregar todos os pacientes e suas comorbidades
    const comorbidadesPaciente = getAllRecords_('DB_COMORBIDADES_PACIENTE');
    
    if (!comorbidadesPaciente || comorbidadesPaciente.length === 0) {
      return okResponse_({
        clusters: [],
        total_pacientes: 0,
        total_comorbidades: 0,
        message: 'Nenhuma comorbidade registrada para análise'
      }, {correlationId: context.correlationId});
    }
    
    // 2. Construir matriz de co-ocorrência
    // comorbidadeId -> [pacienteId1, pacienteId2, ...]
    const coOccurrenceMap = {};
    const pacientesUnicos = {};
    
    comorbidadesPaciente.forEach(function(c) {
      const comorbId = parseInt(c.comorbidade_id);
      if (!coOccurrenceMap[comorbId]) {
        coOccurrenceMap[comorbId] = [];
      }
      coOccurrenceMap[comorbId].push(c.paciente_id);
      pacientesUnicos[c.paciente_id] = true;
    });
    
    // 3. Calcular índice de Jaccard entre todas as comorbidades
    const comorbidadesIds = Object.keys(coOccurrenceMap).map(Number);
    const jaccardMatrix = [];
    
    comorbidadesIds.forEach(function(id1) {
      const row = [];
      comorbidadesIds.forEach(function(id2) {
        if (id1 === id2) {
          row.push(1.0); // Similaridade perfeita consigo mesmo
        } else {
          const set1 = coOccurrenceMap[id1];
          const set2 = coOccurrenceMap[id2];
          const intersection = set1.filter(function(p) { 
            return set2.indexOf(p) !== -1; 
          }).length;
          const union = new Set(set1.concat(set2)).size;
          const jaccard = union > 0 ? intersection / union : 0;
          row.push(jaccard);
        }
      });
      jaccardMatrix.push(row);
    });
    
    // 4. K-means simplificado: atribuir cada comorbidade ao cluster mais similar
    // Inicializar centroides aleatórios
    const centroids = [];
    for (let i = 0; i < numClusters; i++) {
      const randomIdx = Math.floor(Math.random() * comorbidadesIds.length);
      centroids.push(comorbidadesIds[randomIdx]);
    }
    
    // Atribuir cada comorbidade ao centroide mais próximo
    const clusters = [];
    for (let i = 0; i < numClusters; i++) {
      clusters.push({
        cluster_id: i + 1,
        centroid_comorbidade_id: centroids[i],
        membros: [],
        total_membros: 0,
        total_pacientes_impactados: 0
      });
    }
    
    comorbidadesIds.forEach(function(comorbId, idx) {
      let maxSimilarity = -1;
      let bestCluster = 0;
      
      centroids.forEach(function(centroidId, clusterIdx) {
        const centroidIdx = comorbidadesIds.indexOf(centroidId);
        const similarity = jaccardMatrix[idx][centroidIdx];
        
        if (similarity > maxSimilarity) {
          maxSimilarity = similarity;
          bestCluster = clusterIdx;
        }
      });
      
      // Adicionar ao cluster
      clusters[bestCluster].membros.push({
        comorbidade_id: comorbId,
        total_pacientes: coOccurrenceMap[comorbId].length,
        similaridade_ao_centroide: maxSimilarity.toFixed(3)
      });
    });
    
    // 5. Calcular estatísticas por cluster
    clusters.forEach(function(cluster) {
      cluster.total_membros = cluster.membros.length;
      
      // Contar pacientes únicos impactados por este cluster
      const pacientesImpactados = {};
      cluster.membros.forEach(function(membro) {
        const pacientes = coOccurrenceMap[membro.comorbidade_id] || [];
        pacientes.forEach(function(p) {
          pacientesImpactados[p] = true;
        });
      });
      cluster.total_pacientes_impactados = Object.keys(pacientesImpactados).length;
      
      // Ordenar membros por total de pacientes (decrescente)
      cluster.membros.sort(function(a, b) {
        return b.total_pacientes - a.total_pacientes;
      });
    });
    
    // Ordenar clusters por total de membros (decrescente)
    clusters.sort(function(a, b) {
      return b.total_membros - a.total_membros;
    });
    
    logInfo_('Clusters de comorbidades calculados', {
      total_clusters: clusters.length,
      total_comorbidades: comorbidadesIds.length,
      total_pacientes: Object.keys(pacientesUnicos).length,
      userId: context.user.id
    });
    
    return okResponse_({
      clusters: clusters,
      total_pacientes: Object.keys(pacientesUnicos).length,
      total_comorbidades_analisadas: comorbidadesIds.length,
      num_clusters: numClusters,
      algoritmo: 'K-means com Jaccard Index',
      timestamp: nowIso_()
    }, {
      message: 'Clusters calculados com sucesso',
      correlationId: context.correlationId
    });
    
  } catch (error) {
    logException_('Erro ao calcular clusters', error);
    return errorServerResponse_(
      'Erro ao processar clusters de comorbidades',
      {error: error.message},
      {correlationId: context.correlationId}
    );
  }
}

/**
 * Handler: comorbidade.stats_medico
 * 
 * Retorna estatísticas por médico: total de pacientes, distribuição de comorbidades,
 * padrões de prescrição
 * 
 * @param {object} context — Contexto da requisição
 * @returns {object} Response com estatísticas do médico
 */
function handleComorbidadeStatsMedico_(context) {
  try {
    // Validar entrada: medicoId opcional (se omitido, usa context.user.id)
    const medicoId = (context.data && context.data.medico_id) ? 
      context.data.medico_id : context.user.id;
    
    // 1. Buscar pacientes deste médico via User↔Paciente mapping
    const mappings = getAllRecords_('USER_PACIENTE_MAPPING');
    const pacientesDoMedico = mappings
      .filter(function(m) { return m.medico_id === medicoId; })
      .map(function(m) { return m.paciente_id; });
    
    if (pacientesDoMedico.length === 0) {
      return okResponse_({
        medico_id: medicoId,
        total_pacientes: 0,
        comorbidades_distribuicao: [],
        message: 'Médico não possui pacientes vinculados'
      }, {correlationId: context.correlationId});
    }
    
    // 2. Buscar todas as comorbidades desses pacientes
    const comorbidadesPaciente = getAllRecords_('DB_COMORBIDADES_PACIENTE');
    const comorbidadesMedico = comorbidadesPaciente.filter(function(c) {
      return pacientesDoMedico.indexOf(c.paciente_id) !== -1;
    });
    
    // 3. Contar distribuição de comorbidades
    const distribuicao = {};
    comorbidadesMedico.forEach(function(c) {
      const comorbId = parseInt(c.comorbidade_id);
      if (!distribuicao[comorbId]) {
        distribuicao[comorbId] = {
          comorbidade_id: comorbId,
          total_prescricoes: 0,
          pacientes: []
        };
      }
      distribuicao[comorbId].total_prescricoes++;
      distribuicao[comorbId].pacientes.push(c.paciente_id);
    });
    
    // Transformar em array ordenado
    const distribuicaoArray = Object.keys(distribuicao).map(function(id) {
      const item = distribuicao[id];
      return {
        comorbidade_id: item.comorbidade_id,
        total_prescricoes: item.total_prescricoes,
        total_pacientes_unicos: new Set(item.pacientes).size,
        percentual_do_total: Math.round(
          (item.total_prescricoes / comorbidadesMedico.length) * 100
        )
      };
    });
    
    // Ordenar por total_prescricoes (decrescente)
    distribuicaoArray.sort(function(a, b) {
      return b.total_prescricoes - a.total_prescricoes;
    });
    
    // 4. Calcular estatísticas de quimiotipo e solo recomendado
    const quimiotipos = {};
    const solos = {};
    const grausCoa = {};
    
    comorbidadesMedico.forEach(function(c) {
      // Quimiotipo
      const quim = c.quimiotipo_sugerido || 'NAO_ESPECIFICADO';
      quimiotipos[quim] = (quimiotipos[quim] || 0) + 1;
      
      // Solo
      const solo = c.solo_recomendado || 'NAO_ESPECIFICADO';
      solos[solo] = (solos[solo] || 0) + 1;
      
      // Grau CoA
      const grau = c.grau_coa_obrigatorio || 'NAO_ESPECIFICADO';
      grausCoa[grau] = (grausCoa[grau] || 0) + 1;
    });
    
    // 5. Identificar top 3 comorbidades
    const top3 = distribuicaoArray.slice(0, 3);
    
    logInfo_('Estatísticas de médico calculadas', {
      medico_id: medicoId,
      total_pacientes: pacientesDoMedico.length,
      total_comorbidades: comorbidadesMedico.length,
      userId: context.user.id
    });
    
    return okResponse_({
      medico_id: medicoId,
      total_pacientes: pacientesDoMedico.length,
      total_comorbidades_prescritas: comorbidadesMedico.length,
      comorbidades_distribuicao: distribuicaoArray,
      top_3_comorbidades: top3,
      padroes_prescricao: {
        quimiotipos: quimiotipos,
        solos_recomendados: solos,
        graus_coa: grausCoa
      },
      timestamp: nowIso_()
    }, {
      message: 'Estatísticas do médico calculadas',
      correlationId: context.correlationId
    });
    
  } catch (error) {
    logException_('Erro ao calcular estatísticas de médico', error);
    return errorServerResponse_(
      'Erro ao processar estatísticas do médico',
      {error: error.message},
      {correlationId: context.correlationId}
    );
  }
}

/**
 * Handler: comorbidade.heatmap_correlacao
 * 
 * Calcula matriz de correlação entre comorbidades usando índice de Jaccard
 * baseado em co-ocorrência em pacientes
 * 
 * @param {object} context — Contexto da requisição
 * @returns {object} Response com matriz de correlação
 */
function handleComorbidadeHeatmapCorrelacao_(context) {
  try {
    // Parâmetros opcionais
    const minOccurrence = (context.data && context.data.min_occurrence) ? 
      parseInt(context.data.min_occurrence) : 2; // Mínimo 2 pacientes
    
    // 1. Carregar todos os pacientes e suas comorbidades
    const comorbidadesPaciente = getAllRecords_('DB_COMORBIDADES_PACIENTE');
    
    if (!comorbidadesPaciente || comorbidadesPaciente.length === 0) {
      return okResponse_({
        matriz: [],
        comorbidades: [],
        total_pacientes: 0,
        message: 'Nenhuma comorbidade registrada para análise'
      }, {correlationId: context.correlationId});
    }
    
    // 2. Construir mapa de co-ocorrência
    const coOccurrenceMap = {};
    const pacientesUnicos = {};
    
    comorbidadesPaciente.forEach(function(c) {
      const comorbId = parseInt(c.comorbidade_id);
      if (!coOccurrenceMap[comorbId]) {
        coOccurrenceMap[comorbId] = [];
      }
      coOccurrenceMap[comorbId].push(c.paciente_id);
      pacientesUnicos[c.paciente_id] = true;
    });
    
    // 3. Filtrar comorbidades por minOccurrence
    const comorbidadesIds = Object.keys(coOccurrenceMap)
      .map(Number)
      .filter(function(id) {
        return coOccurrenceMap[id].length >= minOccurrence;
      })
      .sort(function(a, b) { return a - b; });
    
    if (comorbidadesIds.length === 0) {
      return okResponse_({
        matriz: [],
        comorbidades: [],
        total_pacientes: Object.keys(pacientesUnicos).length,
        message: 'Nenhuma comorbidade com mínimo de ' + minOccurrence + ' ocorrências'
      }, {correlationId: context.correlationId});
    }
    
    // 4. Calcular índice de Jaccard entre todas as comorbidades
    const matriz = [];
    
    comorbidadesIds.forEach(function(id1) {
      const row = [];
      comorbidadesIds.forEach(function(id2) {
        if (id1 === id2) {
          row.push(1.0); // Correlação perfeita consigo mesmo
        } else {
          const set1 = coOccurrenceMap[id1];
          const set2 = coOccurrenceMap[id2];
          
          // Interseção: pacientes que têm AMBAS as comorbidades
          const intersection = set1.filter(function(p) { 
            return set2.indexOf(p) !== -1; 
          }).length;
          
          // União: pacientes que têm PELO MENOS UMA das comorbidades
          const union = new Set(set1.concat(set2)).size;
          
          // Jaccard Index = |A ∩ B| / |A ∪ B|
          const jaccard = union > 0 ? intersection / union : 0;
          row.push(parseFloat(jaccard.toFixed(4)));
        }
      });
      matriz.push(row);
    });
    
    // 5. Identificar pares com alta correlação (Jaccard > 0.3)
    const paresCorrelhados = [];
    for (let i = 0; i < comorbidadesIds.length; i++) {
      for (let j = i + 1; j < comorbidadesIds.length; j++) {
        const jaccard = matriz[i][j];
        if (jaccard > 0.3) {
          paresCorrelhados.push({
            comorbidade_1: comorbidadesIds[i],
            comorbidade_2: comorbidadesIds[j],
            jaccard_index: jaccard,
            coocorrencias: matriz[i][j] * coOccurrenceMap[comorbidadesIds[i]].length
          });
        }
      }
    }
    
    // Ordenar pares por Jaccard (decrescente)
    paresCorrelhados.sort(function(a, b) {
      return b.jaccard_index - a.jaccard_index;
    });
    
    // 6. Construir metadados das comorbidades
    const comorbidadesMetadata = comorbidadesIds.map(function(id) {
      return {
        comorbidade_id: id,
        total_pacientes: coOccurrenceMap[id].length,
        percentual_populacao: Math.round(
          (coOccurrenceMap[id].length / Object.keys(pacientesUnicos).length) * 100
        )
      };
    });
    
    logInfo_('Heatmap de correlação calculado', {
      total_comorbidades: comorbidadesIds.length,
      total_pares_correlacionados: paresCorrelhados.length,
      total_pacientes: Object.keys(pacientesUnicos).length,
      userId: context.user.id
    });
    
    return okResponse_({
      matriz: matriz,
      comorbidades: comorbidadesMetadata,
      comorbidades_ids: comorbidadesIds,
      pares_altamente_correlacionados: paresCorrelhados.slice(0, 10), // Top 10
      total_pacientes: Object.keys(pacientesUnicos).length,
      algoritmo: 'Jaccard Index',
      timestamp: nowIso_()
    }, {
      message: 'Heatmap de correlação calculado',
      correlationId: context.correlationId
    });
    
  } catch (error) {
    logException_('Erro ao calcular heatmap de correlação', error);
    return errorServerResponse_(
      'Erro ao processar heatmap de correlação',
      {error: error.message},
      {correlationId: context.correlationId}
    );
  }
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extrai status code HTTP de erro estruturado
 *
 * @param {object} error
 * @returns {number}
 */
function getStatusCodeFromError_(error) {
  const statusCodeMap = {
    'INVALID_CREDENTIALS': 401,
    'AUTH_UNAUTHORIZED': 401,
    'AUTH_TOKEN_INVALID': 401,
    'AUTH_USER_SUSPENDED': 403,
    'FORBIDDEN': 403,
    'NOT_FOUND': 404,
    'VALIDATION_ERROR': 400,
    'CONFLICT': 409,
    'INTERNAL_ERROR': 500
  };

  return statusCodeMap[error.code] || 500;
}

// ============================================================================
// HANDLERS PRONTUÁRIO AGRO-CLÍNICO (PROMPT MC-5)
// ============================================================================

/**
 * Handler: prontuario.auditoria_coa
 * 
 * Retorna auditoria completa de CoA para um paciente específico
 * Valida conformidade do lote contra grau de CoA exigido pelas comorbidades
 */
function handleProntuarioAuditoriaCoA_(context) {
  // CORRIGIDO: usar context.data em vez de context.params
  const data = context.data || {};
  const pacienteId = data.paciente_id;

  if (!pacienteId) {
    // CORRIGIDO: errorResponse_ recebe (status, error, options)
    return errorResponse_(400, {
      code: 'MISSING_PARAMETER',
      message: 'Parâmetro paciente_id é obrigatório'
    }, {
      correlationId: context.correlationId
    });
  }

  try {
    // 1. Carregar comorbidades do paciente
    const comorbidades = getComorbidadesPaciente_(pacienteId);
    
    if (!comorbidades || comorbidades.length === 0) {
      return okResponse_({
        paciente_id: pacienteId,
        tem_comorbidades: false,
        auditoria: null,
        mensagem: 'Paciente não possui comorbidades registradas'
      }, {
        correlationId: context.correlationId
      });
    }

    // 2. Calcular grau de CoA máximo exigido
    const graus = comorbidades.map(function(c) { return c.grau_coa_obrigatorio; });
    const grauMaximo = calcularGrauCoAMaximo_(graus);

    // 3. Buscar auditoria completa
    const auditoria = getAuditoriaCoACompleta_(pacienteId, grauMaximo);

    // 4. Retornar resultado
    return okResponse_({
      paciente_id: pacienteId,
      tem_comorbidades: true,
      total_comorbidades: comorbidades.length,
      grau_coa_exigido: grauMaximo,
      auditoria: auditoria,
      conforme: auditoria.conforme === true,
      bloqueio_ativo: auditoria.bloqueio_clinico_ativo === true
    }, {
      correlationId: context.correlationId
    });

  } catch (error) {
    Logger.log('ERRO em handleProntuarioAuditoriaCoA_: ' + error.message);
    // CORRIGIDO: errorResponse_ com assinatura correta
    return errorResponse_(500, {
      code: 'INTERNAL_ERROR',
      message: error.message || 'Erro ao buscar auditoria de CoA'
    }, {
      correlationId: context.correlationId
    });
  }
}

/**
 * Handler: prontuario.emitir_parecer
 * 
 * Emite Parecer de Compatibilidade Médico-Agronômica formal
 * Valida conformidade de CoA e gera documento com citações científicas
 */
function handleProntuarioEmitirParecer_(context) {
  // CORRIGIDO: usar context.data em vez de context.params
  const data = context.data || {};
  const pacienteId = data.paciente_id;
  const medicoCrm = data.medico_crm || context.user?.crm;

  if (!pacienteId) {
    // CORRIGIDO: errorResponse_ recebe (status, error, options)
    return errorResponse_(400, {
      code: 'MISSING_PARAMETER',
      message: 'Parâmetro paciente_id é obrigatório'
    }, {
      correlationId: context.correlationId
    });
  }

  if (!medicoCrm) {
    // CORRIGIDO: errorResponse_ recebe (status, error, options)
    return errorResponse_(400, {
      code: 'MISSING_PARAMETER',
      message: 'Parâmetro medico_crm é obrigatório'
    }, {
      correlationId: context.correlationId
    });
  }

  try {
    // Gerar parecer (função lança erro se houver bloqueio sanitário)
    const parecer = emitirParecerAgroClinico_(pacienteId, medicoCrm);

    // Log de auditoria
    logAudit_({
      action: 'prontuario.emitir_parecer',
      userId: context.user?.id || 'unknown',
      resourceType: 'parecer_agroclinico',
      resourceId: parecer.id,
      changes: {
        paciente_id: pacienteId,
        medico_crm: medicoCrm,
        total_comorbidades: parecer.diagnostico.comorbidades_registradas.length,
        grau_coa: parecer.diagnostico.grau_coa_exigido,
        conforme: true
      },
      timestamp: new Date().toISOString()
    });

    return okResponse_({
      success: true,
      parecer: parecer,
      mensagem: 'Parecer de Compatibilidade Médico-Agronômica emitido com sucesso'
    }, {
      correlationId: context.correlationId
    });

  } catch (error) {
    Logger.log('ERRO em handleProntuarioEmitirParecer_: ' + error.message);
    
    // Se for erro de bloqueio sanitário, retornar 403 (Forbidden)
    if (error.message.indexOf('Bloqueio Sanitário') !== -1) {
      // CORRIGIDO: errorResponse_ com assinatura correta
      return errorResponse_(403, {
        code: 'BLOCKED',
        message: error.message
      }, {
        correlationId: context.correlationId
      });
    }

    // CORRIGIDO: errorResponse_ com assinatura correta
    return errorResponse_(500, {
      code: 'INTERNAL_ERROR',
      message: error.message || 'Erro ao emitir parecer'
    }, {
      correlationId: context.correlationId
    });
  }
}

// ============================================================================
// EXPORTAR
// ============================================================================

const ROUTER_LOADED = true;
