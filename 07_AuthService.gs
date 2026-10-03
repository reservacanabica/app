/**
 * COMPONENTE: 07_AuthService.gs
 * PAPEL: Orquestrador de autenticação
 *
 * RESPONSABILIDADE:
 * - Login (validar credenciais, criar sessão)
 * - Logout (revogar sessão)
 * - Validar token (verificação de cada requisição)
 * - Refresh de token
 * - Coordenar com UserRepository, SessionService, PasswordService, AuditService
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// LOGIN
// ============================================================================

/**
 * Realiza autenticação completa do usuário com validação e auditoria
 * 
 * Fluxo: valida credenciais → verifica status da conta → cria sessão → registra auditoria.
 * Implementa proteção contra timing attacks usando mensagens de erro genéricas.
 * 
 * @param {string} username - Nome de usuário (case-sensitive)
 * @param {string} password - Senha em texto plano (será comparada com hash PBKDF2)
 * @param {string} [correlationId] - ID opcional para rastreamento da requisição na auditoria
 * @returns {object} Resultado: {ok: boolean, session?: object, user?: object, error?: object, correlationId: string}
 * @example
 * const result = performLogin_('john', 'password123', 'req_abc');
 * if (result.ok) {
 *   console.log('Token:', result.session.token);
 * }
 */
function performLogin_(username, password, correlationId) {
  const startTime = nowUnix_();
  correlationId = correlationId || generateUUID_();

  // Validar entrada
  if (!username || !password) {
    auditAuthFailure_(username || 'N/A', 'Credenciais vazias');
    const error = createError_(
      'INVALID_CREDENTIALS',
      'Usuário ou senha incorretos',
      { reason: 'missing_credentials' }
    );
    return { ok: false, error: error, correlationId: correlationId };
  }
  
  // Validar tipos
  if (typeof username !== 'string' || typeof password !== 'string') {
    auditAuthFailure_(username, 'Tipos inválidos');
    const error = createError_(
      'INVALID_CREDENTIALS',
      'Credenciais inválidas',
      { reason: 'invalid_types' }
    );
    return { ok: false, error: error, correlationId: correlationId };
  }

  try {
    // 1. Buscar usuário por username
    const user = getUserByUsername_(username);

    if (!user) {
      auditAuthFailure_(username, 'Usuário não encontrado');
      const error = createError_(
        'INVALID_CREDENTIALS',
        'Usuário ou senha incorretos',
        { reason: 'user_not_found' }
      );
      return { ok: false, error: error, correlationId: correlationId };
    }

    // 2. Verificar status
    if (user.status !== USER_STATUS.ACTIVE) {
      auditAuthFailure_(username, 'Conta não ativa (status: ' + user.status + ')');
      const error = createError_(
        'AUTH_USER_SUSPENDED',
        'Conta suspensa ou inativa',
        { status: user.status }
      );
      return { ok: false, error: error, correlationId: correlationId };
    }

    // 3. Verificar senha
    if (!verifyPassword_(password, user.password)) {
      auditAuthFailure_(username, 'Senha incorreta');
      const error = createError_(
        'INVALID_CREDENTIALS',
        'Usuário ou senha incorretos',
        { reason: 'invalid_password' }
      );
      return { ok: false, error: error, correlationId: correlationId };
    }

    // 4. Criar sessão
    let session;
    try {
      session = createSession_(user.id);
    } catch (error) {
      logError_('Erro ao criar sessão', { error: error.message });
      const err = createError_(
        'INTERNAL_ERROR',
        'Erro ao criar sessão',
        {}
      );
      return { ok: false, error: err, correlationId: correlationId };
    }

    // 5. Atualizar lastLoginAt
    try {
      updateLastLogin_(user.id);
    } catch (error) {
      logWarn_('Erro ao atualizar lastLoginAt', { error: error.message });
    }

    // 6. Registrar auditoria
    const duration = nowUnix_() - startTime;
    auditAuthSuccess_(user.id, {
      username: user.username,
      durationMs: duration
    });

    logInfo_('Login bem-sucedido', {
      userId: user.id,
      username: user.username,
      role: user.role,
      durationMs: duration
    });

    // Retornar resposta (sem incluir senha!)
    return {
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        status: user.status
      },
      session: {
        id: session.id,
        token: session.token,
        expiresAt: session.expiresAt
      },
      correlationId: correlationId
    };

  } catch (error) {
    logException_('Erro durante login', error);
    auditSystemError_(error, { action: 'login', username: username });

    const err = createError_(
      'INTERNAL_ERROR',
      'Erro ao processar login',
      {}
    );
    return { ok: false, error: err, correlationId: correlationId };
  }
}

// ============================================================================
// LOGOUT
// ============================================================================

/**
 * Realiza logout
 *
 * @param {string} token
 * @returns {object} {ok, error}
 */
function performLogout_(token) {
  if (!token) {
    return {
      ok: false,
      error: createError_('AUTH_TOKEN_MISSING', 'Token ausente', {})
    };
  }

  try {
    const session = getSessionByToken_(token);

    if (!session) {
      return {
        ok: false,
        error: createError_('AUTH_TOKEN_INVALID', 'Token não encontrado', {})
      };
    }

    // Revogar sessão
    revokeSession_(token);

    // Registrar auditoria
    auditLogout_(session.userId);

    logInfo_('Logout bem-sucedido', {
      userId: session.userId
    });

    return { ok: true };

  } catch (error) {
    logException_('Erro durante logout', error);

    return {
      ok: false,
      error: createError_('INTERNAL_ERROR', 'Erro ao processar logout', {})
    };
  }
}

// ============================================================================
// VALIDAÇÃO DE TOKEN
// ============================================================================

/**
 * Valida token e retorna contexto do usuário
 *
 * @param {string} token
 * @returns {object} {valid, session, user, error}
 */
function validateTokenAndGetUser_(token) {
  const validation = validateToken_(token);

  if (!validation.valid) {
    return {
      valid: false,
      session: null,
      user: null,
      error: createError_(
        'AUTH_TOKEN_INVALID',
        'Token inválido ou expirado',
        { reason: validation.error }
      )
    };
  }

  const session = validation.session;
  const user = getUserById_(session.userId);

  if (!user) {
    return {
      valid: false,
      session: session,
      user: null,
      error: createError_('AUTH_USER_NOT_FOUND', 'Usuário não encontrado', {})
    };
  }

  return {
    valid: true,
    session: session,
    user: user,
    error: null
  };
}

// ============================================================================
// REFRESH DE TOKEN
// ============================================================================

/**
 * Renova token (quando próximo ao vencimento)
 *
 * @param {string} oldToken
 * @returns {object} {ok, session, error}
 */
function performTokenRefresh_(oldToken) {
  const validation = validateToken_(oldToken);

  if (!validation.valid) {
    return {
      ok: false,
      error: createError_(
        'AUTH_TOKEN_INVALID',
        'Token inválido ou expirado',
        {}
      )
    };
  }

  try {
    const newSession = refreshSession_(oldToken);

    return {
      ok: true,
      session: {
        id: newSession.id,
        token: newSession.token,
        expiresAt: newSession.expiresAt
      }
    };

  } catch (error) {
    logException_('Erro ao renovar token', error);

    return {
      ok: false,
      error: createError_('INTERNAL_ERROR', 'Erro ao renovar token', {})
    };
  }
}

// ============================================================================
// CRIAÇÃO DE USUÁRIO (pelo admin)
// ============================================================================

/**
 * Admin cria novo usuário
 *
 * @param {string} adminUserId
 * @param {object} userData
 * @param {string} correlationId
 * @returns {object} {ok, user, error}
 */
function createUserAsAdmin_(adminUserId, userData, correlationId) {
  correlationId = correlationId || generateUUID_();

  try {
    // Verificar que admin tem permissão
    const admin = getUserById_(adminUserId);
    if (!admin || admin.role !== USER_ROLES.ADMIN) {
      auditPermissionDenied_(adminUserId, 'users.create', 'User');
      return {
        ok: false,
        error: createError_('FORBIDDEN', 'Sem permissão para criar usuários', {})
      };
    }

    // Criar usuário
    const user = createUser_(userData);

    // Registrar auditoria
    auditCreate_('User', user.id, adminUserId, {
      username: user.username,
      role: user.role
    }, correlationId);

    logInfo_('Usuário criado por admin', {
      newUserId: user.id,
      adminId: adminUserId,
      role: user.role
    });

    return {
      ok: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt
      }
    };

  } catch (error) {
    logException_('Erro ao criar usuário', error);

    return {
      ok: false,
      error: createError_(
        'INTERNAL_ERROR',
        'Erro ao criar usuário',
        { details: error.message }
      )
    };
  }
}

// ============================================================================
// MÉTODOS DE REQUISIÇÃO (para Router usar)
// ============================================================================

/**
 * Handler para requisição POST /auth/login
 * Chamado pelo Router
 */
/**
 * Caso de uso: Login
 * Chamado pelos handlers/adaptadores
 * Retorna resultado bruto {ok, user, session, error}
 * 
 * @param {object} requestData - {username, password, correlationId}
 * @returns {object} {ok, user?, session?, error?}
 */
function authLoginUseCase_(requestData) {
  const username = requestData.username;
  const password = requestData.password;
  const correlationId = requestData.correlationId;

  return performLogin_(username, password, correlationId);
}

/**
 * Caso de uso: Logout
 * Chamado pelos handlers/adaptadores
 * Retorna resultado bruto {ok, error?}
 * 
 * @param {string} token
 * @returns {object}
 */
function authLogoutUseCase_(token) {
  return performLogout_(token);
}

/**
 * Caso de uso: Refresh token
 * Chamado pelos handlers/adaptadores
 * Retorna resultado bruto {ok, session?, error?}
 * 
 * @param {string} token
 * @returns {object}
 */
function authRefreshUseCase_(token) {
  return performTokenRefresh_(token);
}

/**
 * Caso de uso: Validar token
 * Chamado pelos handlers/adaptadores
 * Retorna resultado formatado {ok, valid, user?, error?}
 * 
 * @param {string} token
 * @returns {object}
 */
function authValidateUseCase_(token) {
  const result = validateTokenAndGetUser_(token);

  if (result.valid) {
    return {
      ok: true,
      valid: true,
      user: {
        id: result.user.id,
        username: result.user.username,
        role: result.user.role
      },
      expiresAt: result.session.expiresAt
    };
  } else {
    return {
      ok: false,
      valid: false,
      error: result.error
    };
  }
}

// ============================================================================
// ESTATÍSTICAS
// ============================================================================

/**
 * Retorna estatísticas de autenticação
 *
 * @returns {object}
 */
function getAuthStats_() {
  const userStats = getUserStats_();
  const sessionStats = getSessionStats_();
  const auditStats = getAuditStats_();

  return {
    users: userStats,
    sessions: sessionStats,
    auditEvents: auditStats,
    timestamp: nowIso_()
  };
}

// ============================================================================
// EXPORTAR
// ============================================================================

const AUTH_SERVICE_LOADED = true;
