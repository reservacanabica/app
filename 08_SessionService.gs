/**
 * COMPONENTE: 08_SessionService.gs
 * PAPEL: Lógica de negócio de sessões e tokens
 *
 * RESPONSABILIDADE:
 * - Criar sessão + token UUID
 * - Validar sessão (token existe, não expirado, ACTIVE)
 * - Revogar sessão (logout)
 * - Limpar sessões expiradas
 *
 * NOTA: Acesso primitivo a dados (getAllSessions_, getSessionByToken_,
 * getSessionsByUserId_, create/update/delete) vive em SessionRepository.gs.
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// LEITURA
// ============================================================================

/**
 * Conta sessões ativas
 *
 * @returns {number}
 */
function getActiveSessionCount_() {
  const sessions = getAllSessions_();
  const now = nowIso_();
  return sessions.filter(function(s) {
    return s.status === SESSION_STATUS.ACTIVE &&
           isAfter_(s.expiresAt, now);
  }).length;
}

/**
 * Valida token de sessão verificando existência, expiração e status
 * 
 * Executa validação em 3 camadas: (1) formato do token, (2) existência no banco,
 * (3) não expirado e status ACTIVE. Essencial para autorização de toda requisição autenticada.
 *
 * @param {string} token - Token UUID da sessão a validar
 * @returns {object} Resultado: {valid: boolean, session: object|null, error: string|null}
 * @example
 * const validation = validateToken_('tok_abc123');
 * if (validation.valid) {
 *   console.log('User ID:', validation.session.userId);
 * } else {
 *   console.error('Token inválido:', validation.error);
 * }
 */
function validateToken_(token) {
  if (!token) {
    return {
      valid: false,
      session: null,
      error: 'Token ausente'
    };
  }
  
  if (typeof token !== 'string' || token.length < 10) {
    return {
      valid: false,
      session: null,
      error: 'Token com formato inválido'
    };
  }

  const session = getSessionByToken_(token);

  if (!session) {
    return {
      valid: false,
      session: null,
      error: 'Token não encontrado'
    };
  }

  if (session.status !== SESSION_STATUS.ACTIVE) {
    return {
      valid: false,
      session: session,
      error: 'Sessão não ativa (status: ' + session.status + ')'
    };
  }

  if (isExpired_(session.expiresAt)) {
    // Marcar como expirada
    updateSessionRecord_(session.id, {
      status: SESSION_STATUS.EXPIRED,
      updatedAt: nowIso_()
    });

    return {
      valid: false,
      session: session,
      error: 'Token expirado'
    };
  }

  return {
    valid: true,
    session: session,
    error: null
  };
}

// ============================================================================
// ESCRITA
// ============================================================================

/**
 * Cria nova sessão para usuário
 *
 * @param {string} userId
 * @returns {object} {id, token, userId, expiresAt}
 */
function createSession_(userId) {
  const user = getUserById_(userId);

  if (!user) {
    throw createError_('AUTH_USER_NOT_FOUND', 'Usuário não encontrado', {
      userId: userId
    });
  }

  if (user.status !== USER_STATUS.ACTIVE) {
    throw createError_('AUTH_USER_SUSPENDED', 'Conta não está ativa', {
      userId: userId,
      status: user.status
    });
  }

  const session = {
    id: generateUUID_(),
    token: generateUUID_(),
    userId: userId,
    createdAt: nowIso_(),
    expiresAt: calculateSessionExpiration_(),
    revokedAt: null,
    status: SESSION_STATUS.ACTIVE
  };

  createSessionRecord_(session);

  return session;
}

/**
 * Revoga sessão (logout)
 *
 * @param {string} token
 * @returns {boolean}
 */
function revokeSession_(token) {
  const session = getSessionByToken_(token);

  if (!session) {
    return false;
  }

  return updateSessionRecord_(session.id, {
    status: SESSION_STATUS.REVOKED,
    revokedAt: nowIso_(),
    updatedAt: nowIso_()
  });
}

/**
 * Revoga todas as sessões de um usuário
 *
 * @param {string} userId
 * @returns {number} quantidade revogada
 */
function revokeAllUserSessions_(userId) {
  const sessions = getSessionsByUserId_(userId);
  let count = 0;

  sessions.forEach(function(session) {
    if (revokeSession_(session.token)) {
      count++;
    }
  });

  return count;
}

/**
 * Limpa sessões expiradas (manutenção)
 * Deve ser executado periodicamente por cronograma
 *
 * @returns {object} {deleted, kept}
 */
function cleanupExpiredSessions_() {
  const sessions = getAllSessions_();
  const now = nowIso_();
  let deleted = 0;
  let kept = 0;

  sessions.forEach(function(session) {
    // Manter: sessões ativas não expiradas
    if (session.status === SESSION_STATUS.ACTIVE && isAfter_(session.expiresAt, now)) {
      kept++;
      return;
    }

    // Manter: sessões revogadas/expiradas recentes (últimos 30 dias)
    const thirtyDaysAgo = addDays_(-30);
    if (isAfter_(session.createdAt, thirtyDaysAgo)) {
      kept++;
      return;
    }

    // Deletar: antigas e inativas
    if (deleteSessionRecord_(session.id)) {
      deleted++;
    }
  });

  logInfo_('Cleanup de sessões expiradas', {
    deleted: deleted,
    kept: kept
  });

  return { deleted: deleted, kept: kept };
}

/**
 * Extende expiração de sessão (refresh)
 *
 * @param {string} token
 * @returns {object} nova sessão com novo token
 * @throws {Error}
 */
function refreshSession_(token) {
  const validation = validateToken_(token);

  if (!validation.valid) {
    throw createError_('AUTH_TOKEN_INVALID', 'Token inválido ou expirado', {
      error: validation.error
    });
  }

  const oldSession = validation.session;

  // Criar nova sessão
  const newSession = createSession_(oldSession.userId);

  // Revogar sessão antiga
  revokeSession_(token);

  logInfo_('Sessão renovada', {
    userId: oldSession.userId,
    oldToken: '[REDACTED]',
    newToken: '[REDACTED]'
  });

  return newSession;
}

// ============================================================================
// ESTATÍSTICAS
// ============================================================================

/**
 * Retorna estatísticas de sessões
 *
 * @returns {object}
 */
function getSessionStats_() {
  const sessions = getAllSessions_();
  const now = nowIso_();

  const active = sessions.filter(function(s) {
    return s.status === SESSION_STATUS.ACTIVE && isAfter_(s.expiresAt, now);
  }).length;

  const expired = sessions.filter(function(s) {
    return isExpired_(s.expiresAt);
  }).length;

  const revoked = sessions.filter(function(s) {
    return s.status === SESSION_STATUS.REVOKED;
  }).length;

  // Sessões por usuário
  const userSessionCounts = {};
  sessions.forEach(function(s) {
    if (!userSessionCounts[s.userId]) {
      userSessionCounts[s.userId] = 0;
    }
    userSessionCounts[s.userId]++;
  });

  return {
    total: sessions.length,
    active: active,
    expired: expired,
    revoked: revoked,
    userWithMostSessions: Object.keys(userSessionCounts).reduce(function(a, b) {
      return userSessionCounts[a] > userSessionCounts[b] ? a : b;
    }, null),
    maxSessionsPerUser: Math.max.apply(null, Object.values(userSessionCounts)),
    timestamp: nowIso_()
  };
}

/**
 * Retorna sessões ativas agora
 *
 * @returns {array}
 */
function getActiveSessions_() {
  const sessions = getAllSessions_();
  const now = nowIso_();

  return sessions.filter(function(s) {
    return s.status === SESSION_STATUS.ACTIVE && isAfter_(s.expiresAt, now);
  });
}

// ============================================================================
// EXPORTAR
// ============================================================================

const SESSION_SERVICE_LOADED = true;
