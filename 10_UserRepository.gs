/**
 * COMPONENTE: 10_UserRepository.gs
 * PAPEL: Data access layer para Users
 *
 * RESPONSABILIDADE:
 * - CRUD primitivo de usuários
 * - Sem lógica de negócio
 * - Usa SpreadsheetGateway como único ponto de I/O
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// LEITURA
// ============================================================================

/**
 * Obtém todos os usuários
 *
 * @returns {array}
 */
function getAllUsers_() {
  return getAllRowsAsObjects_('Users');
}

/**
 * Busca usuário por ID
 *
 * @param {string} userId
 * @returns {object|null}
 */
function getUserById_(userId) {
  const user = getRowById_('Users', userId);
  return sanitizeUser_(user);
}

/**
 * Busca usuário por username
 *
 * @param {string} username
 * @returns {object|null}
 */
function getUserByUsername_(username) {
  const users = getAllUsers_();
  const user = users.find(function(u) {
    return u.username === username;
  }) || null;
  return sanitizeUser_(user);
}

/**
 * Busca usuários por role
 *
 * @param {string} role
 * @returns {array}
 */
function getUsersByRole_(role) {
  const users = getAllUsers_();
  const filtered = users.filter(function(u) {
    return u.role === role;
  });
  return filtered.map(function(u) {
    return sanitizeUser_(u);
  });
}

/**
 * Busca usuários por status
 *
 * @param {string} status
 * @returns {array}
 */
function getUsersByStatus_(status) {
  const users = getAllUsers_();
  const filtered = users.filter(function(u) {
    return u.status === status;
  });
  return filtered.map(function(u) {
    return sanitizeUser_(u);
  });
}

/**
 * Conta usuários ativos
 *
 * @returns {number}
 */
function getActiveUserCount_() {
  return getUsersByStatus_(USER_STATUS.ACTIVE).length;
}

/**
 * Verifica se username existe
 *
 * @param {string} username
 * @returns {boolean}
 */
function userExists_(username) {
  return getUserByUsername_(username) !== null;
}

/**
 * Verifica se email existe (por displayName como proxy)
 *
 * @param {string} email
 * @returns {boolean}
 */
function emailExists_(email) {
  const users = getAllUsers_();
  return users.some(function(u) {
    return u.displayName === email;
  });
}

// ============================================================================
// ESCRITA
// ============================================================================

/**
 * Cria novo usuário
 *
 * @param {object} userData — {username, password, displayName, role, status}
 * @returns {object} usuário criado (com id)
 * @throws {Error}
 */
function createUser_(userData) {
  // Validações
  if (!userData.username) {
    throw createError_('VALIDATION_ERROR', 'Username obrigatório', {});
  }
  if (!userData.password) {
    throw createError_('VALIDATION_ERROR', 'Senha obrigatória', {});
  }
  if (!userData.displayName) {
    throw createError_('VALIDATION_ERROR', 'Display name obrigatório', {});
  }
  if (!userData.role) {
    throw createError_('VALIDATION_ERROR', 'Role obrigatório', {});
  }

  // Verificar unicidade
  if (userExists_(userData.username)) {
    throw createError_('VALIDATION_ERROR', 'Username já existe', {
      username: userData.username
    });
  }

  // Validar força de senha
  const passStrength = validatePasswordStrength_(userData.password, userData.username);
  if (!passStrength.valid) {
    throw createError_('VALIDATION_ERROR', 'Senha fraca', {
      errors: passStrength.errors
    });
  }

  // Validar role
  if (!isInEnum_(userData.role, USER_ROLES)) {
    throw createError_('VALIDATION_ERROR', 'Role inválido', {
      role: userData.role,
      allowed: Object.values(USER_ROLES)
    });
  }

  // Criar objeto
  const user = {
    id: generateUUID_(),
    username: userData.username,
    password: hashPassword_(userData.password),
    displayName: userData.displayName,
    role: userData.role,
    status: userData.status || USER_STATUS.ACTIVE,
    createdAt: nowIso_(),
    updatedAt: nowIso_(),
    lastLoginAt: null
  };

  // Persistir
  appendRow_('Users', user);

  // SANITIZAR: Remover senha antes de retornar
  const sanitizedUser = sanitizeUser_(user);

  return sanitizedUser;
}

/**
 * Sanitiza usuário removendo campos sensíveis
 * IMPORTANTE: Sempre chamar antes de retornar usuário ao cliente
 * 
 * @param {object} user
 * @returns {object} usuário sem campos sensíveis
 */
function sanitizeUser_(user) {
  if (!user) return null;
  
  const sanitized = Object.assign({}, user);
  
  // Remover campos sensíveis
  delete sanitized.password;
  delete sanitized.passwordHash;  // caso exista com nome diferente
  delete sanitized.token;
  delete sanitized.sessionToken;
  
  return sanitized;
}

/**
 * Atualiza usuário
 *
 * @param {string} userId
 * @param {object} updates — campos a atualizar
 * @returns {boolean} true se atualizado
 * @throws {Error}
 */
function updateUser_(userId, updates) {
  const user = getUserById_(userId);
  if (!user) {
    throw createError_('RECORD_NOT_FOUND', 'Usuário não encontrado', {
      userId: userId
    });
  }

  // Validações de campo
  if (updates.username && updates.username !== user.username) {
    if (userExists_(updates.username)) {
      throw createError_('VALIDATION_ERROR', 'Username já existe', {
        username: updates.username
      });
    }
  }

  if (updates.role) {
    if (!isInEnum_(updates.role, USER_ROLES)) {
      throw createError_('VALIDATION_ERROR', 'Role inválido', {
        role: updates.role
      });
    }
  }

  if (updates.status) {
    if (!isInEnum_(updates.status, USER_STATUS)) {
      throw createError_('VALIDATION_ERROR', 'Status inválido', {
        status: updates.status
      });
    }
  }

  // Se atualizando senha, fazer hash
  if (updates.password) {
    const passStrength = validatePasswordStrength_(updates.password, updates.username || user.username);
    if (!passStrength.valid) {
      throw createError_('VALIDATION_ERROR', 'Senha fraca', {
        errors: passStrength.errors
      });
    }
    updates.password = hashPassword_(updates.password);
  }

  // Adicionar timestamp de atualização
  updates.updatedAt = nowIso_();

  // Persistir
  const result = updateRowById_('Users', userId, updates);

  return result;
}

/**
 * Atualiza lastLoginAt do usuário
 *
 * @param {string} userId
 * @returns {boolean}
 */
function updateLastLogin_(userId) {
  return updateRowById_('Users', userId, {
    lastLoginAt: nowIso_(),
    updatedAt: nowIso_()
  });
}

/**
 * Suspende usuário (soft delete)
 *
 * @param {string} userId
 * @returns {boolean}
 */
function suspendUser_(userId) {
  return updateRowById_('Users', userId, {
    status: USER_STATUS.SUSPENDED,
    updatedAt: nowIso_()
  });
}

/**
 * Ativa usuário
 *
 * @param {string} userId
 * @returns {boolean}
 */
function activateUser_(userId) {
  return updateRowById_('Users', userId, {
    status: USER_STATUS.ACTIVE,
    updatedAt: nowIso_()
  });
}

/**
 * Desativa usuário
 *
 * @param {string} userId
 * @returns {boolean}
 */
function deactivateUser_(userId) {
  return updateRowById_('Users', userId, {
    status: USER_STATUS.INACTIVE,
    updatedAt: nowIso_()
  });
}

/**
 * Reseta senha do usuário (admin only)
 *
 * @param {string} userId
 * @param {string} newPassword
 * @returns {boolean}
 */
function resetUserPassword_(userId, newPassword) {
  const user = getUserById_(userId);
  if (!user) {
    throw createError_('RECORD_NOT_FOUND', 'Usuário não encontrado', {});
  }

  return updateRowById_('Users', userId, {
    password: hashPassword_(newPassword),
    updatedAt: nowIso_()
  });
}

/**
 * Deleta usuário (hard delete — use com cuidado)
 *
 * @param {string} userId
 * @returns {boolean}
 */
function deleteUser_(userId) {
  // Verificar que não é último admin
  const user = getUserById_(userId);
  if (user && user.role === USER_ROLES.ADMIN) {
    const otherAdmins = getUsersByRole_(USER_ROLES.ADMIN).filter(function(u) {
      return u.id !== userId;
    });
    if (otherAdmins.length === 0) {
      throw createError_('VALIDATION_ERROR', 'Não pode deletar único admin', {
        userId: userId
      });
    }
  }

  return deleteRowById_('Users', userId);
}

// ============================================================================
// ESTATÍSTICAS
// ============================================================================

/**
 * Retorna estatísticas de usuários
 *
 * @returns {object}
 */
function getUserStats_() {
  const users = getAllUsers_();

  const byRole = {};
  Object.values(USER_ROLES).forEach(function(role) {
    byRole[role] = users.filter(function(u) {
      return u.role === role;
    }).length;
  });

  const byStatus = {};
  Object.values(USER_STATUS).forEach(function(status) {
    byStatus[status] = users.filter(function(u) {
      return u.status === status;
    }).length;
  });

  // Últimos 7 dias com login
  const sevenDaysAgo = addDays_(-7);
  const recentLogins = users.filter(function(u) {
    return u.lastLoginAt && isAfter_(u.lastLoginAt, sevenDaysAgo);
  }).length;

  return {
    total: users.length,
    active: byStatus[USER_STATUS.ACTIVE] || 0,
    inactive: byStatus[USER_STATUS.INACTIVE] || 0,
    suspended: byStatus[USER_STATUS.SUSPENDED] || 0,
    byRole: byRole,
    recentLogins: recentLogins,
    timestamp: nowIso_()
  };
}

// ============================================================================
// EXPORTAR
// ============================================================================

const USER_REPOSITORY_LOADED = true;
