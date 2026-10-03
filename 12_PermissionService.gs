/**
 * COMPONENTE: 12_PermissionService.gs
 * PAPEL: Verificação de permissões (RBAC)
 *
 * RESPONSABILIDADE:
 * - Verificar se usuário tem permissão para ação
 * - Suportar verificações granulares ("studies.read", "studies.delete")
 * - Logar tentativas de acesso negado
 * - Coordenar com AuditService
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// VERIFICAÇÃO DE PERMISSÃO
// ============================================================================

/**
 * Verifica se role tem permissão para ação
 *
 * @param {string} role — um dos USER_ROLES
 * @param {string} permission — ex: "studies.create", "users.delete"
 * @returns {boolean}
 */
function hasPermission_(role, permission) {
  if (!role || !permission) {
    return false;
  }

  const permissions = ROLE_PERMISSIONS[role];

  if (!permissions) {
    return false;
  }

  return permissions.includes(permission);
}

/**
 * Verifica se usuário tem permissão (requer user object)
 *
 * @param {object} user — objeto do usuário
 * @param {string} permission
 * @returns {boolean}
 */
function userHasPermission_(user, permission) {
  if (!user || !user.role) {
    return false;
  }

  return hasPermission_(user.role, permission);
}

/**
 * Requer permissão ou lança erro (para usar em handlers)
 *
 * @param {object} user
 * @param {string} permission
 * @throws {object} erro estruturado
 */
function requirePermission_(user, permission) {
  if (!userHasPermission_(user, permission)) {
    auditPermissionDenied_(user ? user.id : null, permission, 'Unknown');
    throwError_(
      'FORBIDDEN',
      'Sem permissão para: ' + permission,
      { role: user ? user.role : null, permission: permission }
    );
  }
}

/**
 * Verifica múltiplas permissões (AND)
 *
 * @param {object} user
 * @param {array} permissions
 * @returns {boolean}
 */
function userHasAllPermissions_(user, permissions) {
  if (!user || !permissions || permissions.length === 0) {
    return false;
  }

  return permissions.every(function(perm) {
    return userHasPermission_(user, perm);
  });
}

/**
 * Verifica múltiplas permissões (OR)
 *
 * @param {object} user
 * @param {array} permissions
 * @returns {boolean}
 */
function userHasAnyPermission_(user, permissions) {
  if (!user || !permissions || permissions.length === 0) {
    return false;
  }

  return permissions.some(function(perm) {
    return userHasPermission_(user, perm);
  });
}

// ============================================================================
// VERIFICAÇÕES ESPECÍFICAS
// ============================================================================

/**
 * Verifica se é admin
 */
function isAdmin_(user) {
  return user && user.role === USER_ROLES.ADMIN;
}

/**
 * Verifica se é researcher
 */
function isResearcher_(user) {
  return user && user.role === USER_ROLES.RESEARCHER;
}

/**
 * Verifica se é analyst
 */
function isAnalyst_(user) {
  return user && user.role === USER_ROLES.ANALYST;
}

/**
 * Verifica se é viewer
 */
function isViewer_(user) {
  return user && user.role === USER_ROLES.VIEWER;
}

/**
 * Verifica se é service account
 */
function isService_(user) {
  return user && user.role === USER_ROLES.SERVICE;
}

// ============================================================================
// VERIFICAÇÕES DE PROPRIEDADE
// ============================================================================

/**
 * Verifica se usuário é dono de entidade (para dados próprios)
 *
 * @param {object} user
 * @param {object} entity — objeto com ownerId ou userId
 * @param {string} ownerField (default: "ownerId")
 * @returns {boolean}
 */
function isOwner_(user, entity, ownerField) {
  ownerField = ownerField || 'ownerId';

  if (!user || !entity) {
    return false;
  }

  // Admin sempre é "dono"
  if (isAdmin_(user)) {
    return true;
  }

  // Verificar se é o dono
  const ownerField_actual = entity[ownerField] || entity.userId;
  return ownerField_actual === user.id;
}

/**
 * Requer ser dono ou admin
 */
function requireOwnerOrAdmin_(user, entity, ownerField) {
  if (!isOwner_(user, entity, ownerField)) {
    throwError_(
      'FORBIDDEN',
      'Sem permissão para acessar este recurso',
      { reason: 'not_owner' }
    );
  }
}

// ============================================================================
// LISTAS DE PERMISSÕES
// ============================================================================

/**
 * Retorna todas as permissões de um role
 *
 * @param {string} role
 * @returns {array}
 */
function getPermissionsForRole_(role) {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Compara permissões entre dois roles
 *
 * @param {string} role1
 * @param {string} role2
 * @returns {object} {same, role1Only, role2Only, shared}
 */
function compareRolePermissions_(role1, role2) {
  const perms1 = getPermissionsForRole_(role1);
  const perms2 = getPermissionsForRole_(role2);

  const shared = perms1.filter(function(p) {
    return perms2.includes(p);
  });

  const role1Only = perms1.filter(function(p) {
    return !perms2.includes(p);
  });

  const role2Only = perms2.filter(function(p) {
    return !perms1.includes(p);
  });

  return {
    same: shared.length === perms1.length && shared.length === perms2.length,
    role1Only: role1Only,
    role2Only: role2Only,
    shared: shared
  };
}

/**
 * Retorna matriz de permissões (todas as permissões por role)
 *
 * @returns {object}
 */
function getPermissionMatrix_() {
  const matrix = {};

  Object.keys(USER_ROLES).forEach(function(roleKey) {
    const role = USER_ROLES[roleKey];
    matrix[role] = getPermissionsForRole_(role);
  });

  return matrix;
}

// ============================================================================
// VALIDAÇÃO
// ============================================================================

/**
 * Valida se role é válido
 *
 * @param {string} role
 * @returns {boolean}
 */
function isValidRole_(role) {
  return isInEnum_(role, USER_ROLES);
}

/**
 * Valida se permissão é definida (existe em algum role)
 *
 * @param {string} permission
 * @returns {boolean}
 */
function isValidPermission_(permission) {
  const allRoles = Object.values(USER_ROLES);

  return allRoles.some(function(role) {
    return hasPermission_(role, permission);
  });
}

// ============================================================================
// ESTATÍSTICAS
// ============================================================================

/**
 * Retorna estatísticas de permissões
 *
 * @returns {object}
 */
function getPermissionStats_() {
  const matrix = getPermissionMatrix_();
  const stats = {
    totalRoles: Object.keys(USER_ROLES).length,
    roleStats: {}
  };

  Object.keys(matrix).forEach(function(role) {
    stats.roleStats[role] = {
      permissionCount: matrix[role].length,
      permissions: matrix[role]
    };
  });

  // Permissões totais únicas
  const allPerms = new Set();
  Object.keys(matrix).forEach(function(role) {
    matrix[role].forEach(function(perm) {
      allPerms.add(perm);
    });
  });

  stats.totalUniquePermissions = allPerms.size;

  return stats;
}

/**
 * Gera relatório de acesso para usuário
 *
 * @param {object} user
 * @returns {object}
 */
function getUserAccessReport_(user) {
  const permissions = getPermissionsForRole_(user.role);

  return {
    userId: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    totalPermissions: permissions.length,
    canCreate: permissions.filter(function(p) {
      return p.includes('create') || p.includes('write');
    }).length,
    canRead: permissions.filter(function(p) {
      return p.includes('read') || p.includes('list');
    }).length,
    canUpdate: permissions.filter(function(p) {
      return p.includes('update');
    }).length,
    canDelete: permissions.filter(function(p) {
      return p.includes('delete');
    }).length,
    permissions: permissions
  };
}

// ============================================================================
// ESCOPO DE DADOS (DATA SCOPE)
// ============================================================================

/**
 * Aplica restrição de escopo de registros conforme papel do usuário autenticado
 * 
 * REGRAS:
 * - Admin: visão irrestrita (retorna filtros sem modificação)
 * - Médico: apenas prontuários e receitas onde medico_id == user.id
 * - Técnico Agrícola: visão global (sem restrição - auditor de insumos)
 * - Grower: apenas registros onde paciente_id == user.id (cultivo próprio)
 * - Paciente: apenas registros onde paciente_id == user.id (dados próprios)
 * 
 * @param {Object} user - Objeto do usuário autenticado { id, email, role }
 * @param {string} entityName - Nome da entidade/aba (ex: "DB_CULTIVO_PLANTAS")
 * @param {Object} filters - Filtros de busca originais
 * @returns {Object} Filtros com restrição injetada obrigatoriamente
 */
function applyDataScope_(user, entityName, filters) {
  const scopedFilters = Object.assign({}, filters || {});
  
  // Admin tem visão irrestrita
  if (!user || user.role === 'admin') {
    return scopedFilters;
  }
  
  // Técnico Agrícola tem visão global para auditoria de insumos
  if (user.role === 'tecnico_agricola') {
    return scopedFilters;
  }
  
  // Mapeamento de entidades que requerem escopo por paciente_id
  const patientScopedEntities = [
    'DB_CULTIVO_PLANTAS',
    'DB_CULTIVO_LOGS',
    'DB_DIARIO_DOSES',
    'DB_RECEITAS',
    'DB_PRONTUARIOS',
    'DB_TRIAGEM'
  ];
  
  // Mapeamento de entidades que requerem escopo por medico_id
  const doctorScopedEntities = [
    'DB_PRONTUARIOS',
    'DB_RECEITAS',
    'DB_TRIAGEM'
  ];
  
  // Regras para Grower e Paciente: apenas seus próprios registros
  if (user.role === 'grower' || user.role === 'paciente') {
    if (patientScopedEntities.includes(entityName)) {
      scopedFilters.paciente_id = user.id;
    }
  }
  
  // Regras para Médico: apenas pacientes associados ao seu ID
  if (user.role === 'medico') {
    if (doctorScopedEntities.includes(entityName)) {
      scopedFilters.medico_id = user.id;
    }
  }
  
  return scopedFilters;
}

/**
 * Verifica se registro específico pertence ao usuário (validação pós-query)
 * Usado após busca por ID para garantir que grower/paciente não acessem dados alheios
 * 
 * @param {Object} user - Usuário autenticado
 * @param {string} entityName - Nome da entidade
 * @param {Object} record - Registro recuperado
 * @returns {boolean} true se usuário pode acessar, false caso contrário
 */
function canAccessRecord_(user, entityName, record) {
  // Admin pode tudo
  if (!user || user.role === 'admin') {
    return true;
  }
  
  // Técnico agrícola pode tudo (auditor)
  if (user.role === 'tecnico_agricola') {
    return true;
  }
  
  // Médico pode acessar registros de seus pacientes
  if (user.role === 'medico') {
    const doctorScopedEntities = [
      'DB_PRONTUARIOS',
      'DB_RECEITAS',
      'DB_TRIAGEM'
    ];
    
    if (doctorScopedEntities.includes(entityName)) {
      return record.medico_id === user.id;
    }
    
    return true; // Outras entidades não têm restrição para médico
  }
  
  // Grower e Paciente: apenas próprios registros
  if (user.role === 'grower' || user.role === 'paciente') {
    const patientScopedEntities = [
      'DB_CULTIVO_PLANTAS',
      'DB_CULTIVO_LOGS',
      'DB_DIARIO_DOSES',
      'DB_RECEITAS',
      'DB_PRONTUARIOS',
      'DB_TRIAGEM'
    ];
    
    if (patientScopedEntities.includes(entityName)) {
      return record.paciente_id === user.id;
    }
  }
  
  return true;
}

/**
 * Valida acesso a registro por ID e lança erro 403 se negado
 * 
 * @param {Object} user - Usuário autenticado
 * @param {string} entityName - Nome da entidade
 * @param {Object} record - Registro recuperado
 * @throws {Object} Erro FORBIDDEN se acesso negado
 */
function requireRecordAccess_(user, entityName, record) {
  if (!canAccessRecord_(user, entityName, record)) {
    auditPermissionDenied_(
      user ? user.id : null,
      'record.access',
      entityName + '/' + (record.id || 'unknown')
    );
    
    throwError_(
      'FORBIDDEN',
      'Acesso negado a registro de outro usuário',
      {
        entityName: entityName,
        recordId: record.id,
        reason: 'data_scope_violation'
      }
    );
  }
}

/**
 * Retorna lista de entidades que o usuário pode acessar sem restrição de escopo
 * 
 * @param {Object} user - Usuário autenticado
 * @returns {Array<string>} Lista de nomes de entidades
 */
function getUnrestrictedEntities_(user) {
  if (!user) {
    return [];
  }
  
  // Admin e técnico agrícola têm acesso irrestrito a tudo
  if (user.role === 'admin' || user.role === 'tecnico_agricola') {
    return ['*']; // Todas as entidades
  }
  
  // Médico tem acesso irrestrito a catálogos de insumos (read-only via permissões)
  if (user.role === 'medico') {
    return [
      'Insumos_Catalogo',
      'Lotes_CoA',
      'Receitas_Fertirrigacao',
      'Protocolos_Biologicos',
      'Pareceres_Compatibilidade'
    ];
  }
  
  // Grower tem acesso read-only a receitas globais (via permissões)
  if (user.role === 'grower') {
    return [
      'Receitas_Fertirrigacao',
      'Protocolos_Biologicos'
    ];
  }
  
  // Paciente não tem acesso irrestrito a nada
  if (user.role === 'paciente') {
    return [];
  }
  
  return [];
}

// ============================================================================
// EXPORTAR
// ============================================================================

const PERMISSION_SERVICE_LOADED = true;
