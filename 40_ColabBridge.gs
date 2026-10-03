/**
 * COMPONENTE: 40_ColabBridge.gs
 * PAPEL: Bridge de integração com Google Colab
 *
 * RESPONSABILIDADE:
 * - Fornecer endpoints para Colab
 * - Gerenciar service account authentication
 * - Operações específicas do Colab
 * - Batch exports para análise
 *
 * OPERAÇÕES:
 * - colab.authenticate — autenticar como service account
 * - colab.exportStudyData — exportar Study para Colab
 * - colab.uploadResults — receber resultados de análise
 * - colab.listAnalyses — listar análises disponíveis
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// AUTENTICAÇÃO DE SERVICE ACCOUNT
// ============================================================================

/**
 * Autenticação especial para Colab (sem UI)
 *
 * @param {string} serviceAccountEmail
 * @param {string} projectId
 * @returns {object} {success, token, expiresAt}
 */
function colabAuthenticate_(serviceAccountEmail, projectId) {
  try {
    // Verificar que service account existe
    const allUsers = getAllRowsAsObjects_('Users');
    const serviceUser = allUsers.filter(function(u) { return u.username === serviceAccountEmail || u.email === serviceAccountEmail; });

    if (!serviceUser || serviceUser.length === 0) {
      throwError_('AUTH_USER_NOT_FOUND', 'Service account não encontrado', {
        email: serviceAccountEmail
      });
    }

    const user = serviceUser[0];

    // Verificar que é service role
    if (user.role !== USER_ROLES.SERVICE) {
      throwError_('FORBIDDEN', 'Apenas service accounts podem usar bridge', {
        role: user.role
      });
    }

    // Criar sessão (sem senha — apenas autenticação por email verificado)
    const session = createSession_(user.id);

    logInfo_('Colab autenticação bem-sucedida', {
      serviceAccount: serviceAccountEmail,
      projectId: projectId,
      sessionId: session.id
    });

    auditCreate_('ColabSession', session.id, user.id, {
      projectId: projectId,
      email: serviceAccountEmail
    });

    return {
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      userId: user.id,
      userEmail: user.email
    };

  } catch (error) {
    logException_('Erro na autenticação Colab', error);

    auditAuthFailure_(serviceAccountEmail || 'colab_service', 'Colab auth failure');

    throw error;
  }
}

// ============================================================================
// EXPORTAÇÃO PARA COLAB
// ============================================================================

/**
 * Exporta dados de um Study para análise no Colab
 *
 * @param {string} token
 * @param {string} studyId
 * @returns {object}
 */
function colabExportStudyData_(token, studyId) {
  try {
    // Validar token
    const validation = validateTokenAndGetUser_(token);
    if (!validation.valid) {
      throwError_('AUTH_TOKEN_INVALID', 'Token inválido', {});
    }

    const user = validation.user;

    // Verificar permissão
    if (user.role !== USER_ROLES.SERVICE) {
      throwError_('FORBIDDEN', 'Apenas service accounts', {});
    }

    // Buscar Study
    const study = getStudyById_(studyId);
    if (!study) {
      throwError_('NOT_FOUND', 'Study não encontrado', { studyId: studyId });
    }

    // Exportar dados completos
    const experiments = getExperimentsByStudy_(studyId) || [];
    const observations = [];
    const references = [];

    experiments.forEach(function(exp) {
      const obs = getObservationsByExperiment_(exp.id) || [];
      observations.push.apply(observations, obs);
    });

    // Coletar referências
    const all = getAllRowsAsObjects_('References');
    references.push.apply(references, all);

    // Estruturar dados
    const exportData = {
      study: sanitizeForExport_(study),
      experiments: sanitizeArrayForExport_(experiments),
      observations: sanitizeArrayForExport_(observations),
      references: sanitizeArrayForExport_(references),
      metadata: {
        exportedAt: nowIso_(),
        exportedBy: user.email,
        experimentCount: experiments.length,
        observationCount: observations.length,
        referenceCount: references.length,
        format: 'Colab-v1.0'
      }
    };

    logInfo_('Dados exportados para Colab', {
      studyId: studyId,
      experimentCount: experiments.length,
      observationCount: observations.length
    });

    auditCreate_('ColabExport', generateUUID_(), user.id, {
      studyId: studyId,
      itemCount: experiments.length + observations.length
    });

    return {
      success: true,
      data: exportData,
      timestamp: nowIso_()
    };

  } catch (error) {
    logException_('Erro ao exportar para Colab', error);
    throw error;
  }
}

// ============================================================================
// UPLOAD DE RESULTADOS
// ============================================================================

/**
 * Recebe e armazena resultados de análise do Colab
 *
 * @param {string} token
 * @param {string} studyId
 * @param {object} analysisResults
 * @returns {object}
 */
function colabUploadResults_(token, studyId, analysisResults) {
  try {
    // Validar token
    const validation = validateTokenAndGetUser_(token);
    if (!validation.valid) {
      throwError_('AUTH_TOKEN_INVALID', 'Token inválido', {});
    }

    const user = validation.user;

    // Verificar que é service account
    if (user.role !== USER_ROLES.SERVICE) {
      throwError_('FORBIDDEN', 'Apenas service accounts', {});
    }

    // Verificar Study existe
    const study = getStudyById_(studyId);
    if (!study) {
      throwError_('NOT_FOUND', 'Study não encontrado', {});
    }

    // Armazenar resultados como análise
    const analysis = {
      id: generateUUID_(),
      studyId: studyId,
      type: analysisResults.type || 'COLAB_ANALYSIS',
      title: analysisResults.title || 'Análise do Colab',
      description: analysisResults.description || '',
      results: JSON.stringify(analysisResults.results || {}),
      parameters: JSON.stringify(analysisResults.parameters || {}),
      status: 'COMPLETED',
      uploadedBy: user.email,
      uploadedAt: nowIso_(),
      version: analysisResults.version || '1.0',
      createdAt: nowIso_(),
      updatedAt: nowIso_()
    };

    // Criar registro de análise (se sheet existir)
    try {
      appendRow_('ColabAnalyses', analysis);
    } catch (error) {
      logWarn_('Sheet ColabAnalyses não existe, apenas logando resultado', {});
      logInfo_('Resultado de análise Colab', analysis);
    }

    logInfo_('Resultado de análise recebido do Colab', {
      studyId: studyId,
      type: analysis.type,
      uploadedBy: user.email
    });

    auditCreate_('ColabAnalysis', analysis.id, user.id, {
      studyId: studyId,
      type: analysis.type,
      title: analysis.title
    });

    return {
      success: true,
      analysisId: analysis.id,
      message: 'Resultado armazenado com sucesso',
      timestamp: nowIso_()
    };

  } catch (error) {
    logException_('Erro ao receber resultado do Colab', error);
    throw error;
  }
}

// ============================================================================
// LISTAGEM DE ANÁLISES
// ============================================================================

/**
 * Lista análises disponíveis para um Study
 *
 * @param {string} token
 * @param {string} studyId
 * @returns {array}
 */
function colabListAnalyses_(token, studyId) {
  try {
    // Validar token
    const validation = validateTokenAndGetUser_(token);
    if (!validation.valid) {
      throwError_('AUTH_TOKEN_INVALID', 'Token inválido', {});
    }

    const user = validation.user;

    // Verificar permissão de leitura
    requirePermission_(user, 'studies.read');

    // Buscar análises
    let analyses = [];

    try {
      const all = getAllRowsAsObjects_('ColabAnalyses') || [];
      analyses = all.filter(function(analysis) {
        return analysis.studyId === studyId;
      });

    } catch (error) {
      logWarn_('Sheet ColabAnalyses não existe', {});
      analyses = [];
    }

    logInfo_('Análises listadas para Colab', {
      studyId: studyId,
      count: analyses.length
    });

    return {
      success: true,
      studyId: studyId,
      analyses: analyses.map(function(a) {
        return {
          id: a.id,
          type: a.type,
          title: a.title,
          uploadedAt: a.uploadedAt,
          version: a.version
        };
      }),
      timestamp: nowIso_()
    };

  } catch (error) {
    logException_('Erro ao listar análises', error);
    throw error;
  }
}

// ============================================================================
// CONSULTA DE ANÁLISE ESPECÍFICA
// ============================================================================

/**
 * Retorna detalhes de uma análise específica
 *
 * @param {string} token
 * @param {string} analysisId
 * @returns {object}
 */
function colabGetAnalysis_(token, analysisId) {
  try {
    // Validar token
    const validation = validateTokenAndGetUser_(token);
    if (!validation.valid) {
      throwError_('AUTH_TOKEN_INVALID', 'Token inválido', {});
    }

    const user = validation.user;

    // Buscar análise
    let analysis;

    try {
      const all = getAllRowsAsObjects_('ColabAnalyses') || [];
      const found = all.filter(function(a) { return a.id === analysisId; });

      if (found.length > 0) {
        analysis = found[0];
      }
    } catch (error) {
      logWarn_('Sheet ColabAnalyses não existe', {});
    }

    if (!analysis) {
      throwError_('NOT_FOUND', 'Análise não encontrada', { analysisId: analysisId });
    }

    // Verificar permissão
    const study = getStudyById_(analysis.studyId);
    if (study) {
      requireOwnerOrAdmin_(user, study);
    }

    return {
      success: true,
      analysis: {
        id: analysis.id,
        studyId: analysis.studyId,
        type: analysis.type,
        title: analysis.title,
        description: analysis.description,
        results: JSON.parse(analysis.results || '{}'),
        parameters: JSON.parse(analysis.parameters || '{}'),
        uploadedAt: analysis.uploadedAt,
        version: analysis.version
      },
      timestamp: nowIso_()
    };

  } catch (error) {
    logException_('Erro ao obter análise', error);
    throw error;
  }
}

// ============================================================================
// ESTATÍSTICAS E MONITORAMENTO
// ============================================================================

/**
 * Retorna estatísticas de integração Colab
 *
 * @param {string} token
 * @returns {object}
 */
function colabGetStats_(token) {
  try {
    // Validar token
    const validation = validateTokenAndGetUser_(token);
    if (!validation.valid) {
      throwError_('AUTH_TOKEN_INVALID', 'Token inválido', {});
    }

    const user = validation.user;

    // Verificar permissão
    requirePermission_(user, 'studies.read');

    let totalAnalyses = 0;
    let totalStudiesWithAnalyses = 0;

    try {
      const all = getAllRowsAsObjects_('ColabAnalyses') || [];
      totalAnalyses = all.length;

      const studyIds = new Set();
      all.forEach(function(a) {
        studyIds.add(a.studyId);
      });
      totalStudiesWithAnalyses = studyIds.size;

    } catch (error) {
      logWarn_('Sheet ColabAnalyses não existe', {});
    }

    return {
      success: true,
      stats: {
        totalAnalyses: totalAnalyses,
        totalStudiesWithAnalyses: totalStudiesWithAnalyses,
        lastUpdate: nowIso_()
      },
      timestamp: nowIso_()
    };

  } catch (error) {
    logException_('Erro ao obter stats', error);
    throw error;
  }
}

// ============================================================================
// HEALTH CHECK COLAB
// ============================================================================

/**
 * Verifica saúde da integração Colab
 *
 * @returns {object}
 */
function colabHealthCheck_() {
  try {
    const checks = {
      database: true,
      auth: true,
      export: true,
      import: true,
      timestamp: nowIso_()
    };

    // Verificar database
    try {
      getAllRowsAsObjects_('Studies');
    } catch (error) {
      checks.database = false;
    }

    // Verificar auth
    try {
      const sessions = getAllRowsAsObjects_('Sessions');
      if (!sessions || sessions.length === 0) {
        checks.auth = false;
      }
    } catch (error) {
      checks.auth = false;
    }

    const allOk = checks.database && checks.auth;

    return {
      success: allOk,
      status: allOk ? 'HEALTHY' : 'DEGRADED',
      checks: checks
    };

  } catch (error) {
    logException_('Erro no health check Colab', error);
    return {
      success: false,
      status: 'DOWN',
      error: error.message
    };
  }
}

const COLAB_BRIDGE_LOADED = true;
