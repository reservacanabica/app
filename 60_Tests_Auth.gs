/**
 * COMPONENTE: 60_Tests_Auth.gs
 * PAPEL: Testes end-to-end para sistema de autenticação
 * 
 * COBERTURA:
 * - Login/Logout
 * - Validação de sessão
 * - Expiração de sessão
 * - Permissões e roles
 * - Token refresh
 */

/**
 * Registra suite de testes de autenticação
 */
function registerAuthTests_() {
  const runner = getTestRunner_();
  let testUser = null;
  let testSession = null;
  
  runner.describe('Autenticação', function() {
    
    this.beforeAll(function() {
      logInfo_('Setup: Criando usuário de teste');
      testUser = createTestUser_();
      appendRecord_('Users', testUser);
    });
    
    this.afterAll(function() {
      logInfo_('Teardown: Removendo usuário de teste');
      cleanupTestData_();
    });
    
    // ===========================
    // LOGIN
    // ===========================
    
    this.it('deve fazer login com credenciais válidas', function(expect) {
      const result = authLogin_(testUser.username, testUser.password);
      
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
      expect(result.data).toHaveProperty('token');
      expect(result.data).toHaveProperty('user');
      expect(result.data.user.username).toBe(testUser.username);
      
      testSession = result.data;
    });
    
    this.it('deve rejeitar login com senha incorreta', function(expect) {
      expect(function() {
        authLogin_(testUser.username, 'senha_errada');
      }).toThrow('INVALID_CREDENTIALS');
    });
    
    this.it('deve rejeitar login com usuário inexistente', function(expect) {
      expect(function() {
        authLogin_('usuario_inexistente@test.com', 'senha');
      }).toThrow('USER_NOT_FOUND');
    });
    
    this.it('deve rejeitar login com campos vazios', function(expect) {
      expect(function() {
        authLogin_('', '');
      }).toThrow();
      
      expect(function() {
        authLogin_(testUser.username, '');
      }).toThrow();
    });
    
    // ===========================
    // VALIDAÇÃO DE SESSÃO
    // ===========================
    
    this.it('deve validar sessão ativa', function(expect) {
      const session = validateSession_(testSession.token);
      
      expect(session).toBeDefined();
      expect(session.status).toBe('ACTIVE');
      expect(session.userId).toBe(testUser.id);
    });
    
    this.it('deve rejeitar token inválido', function(expect) {
      expect(function() {
        validateSession_('token_invalido_123');
      }).toThrow('SESSION_NOT_FOUND');
    });
    
    this.it('deve rejeitar token expirado', function(expect) {
      // Cria sessão já expirada
      const expiredSession = {
        id: 'expired_' + Date.now(),
        token: 'expired_token_' + Date.now(),
        userId: testUser.id,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
        expiresAt: new Date(Date.now() - 3600000).toISOString(),
        status: 'ACTIVE'
      };
      
      appendRecord_('Sessions', expiredSession);
      
      expect(function() {
        validateSession_(expiredSession.token);
      }).toThrow('SESSION_EXPIRED');
    });
    
    // ===========================
    // LOGOUT
    // ===========================
    
    this.it('deve fazer logout e revogar sessão', function(expect) {
      const result = authLogout_(testSession.token);
      
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
      
      // Verifica se sessão foi revogada
      expect(function() {
        validateSession_(testSession.token);
      }).toThrow('SESSION_REVOKED');
    });
    
    // ===========================
    // PERMISSÕES
    // ===========================
    
    this.it('deve verificar permissões de role', function(expect) {
      // Cria novo login para teste de permissões
      const loginResult = authLogin_(testUser.username, testUser.password);
      const token = loginResult.data.token;
      
      // Researcher pode ler studies
      const canRead = hasPermission_(token, 'studies.read');
      expect(canRead).toBe(true);
      
      // Researcher não pode fazer admin
      const canAdmin = hasPermission_(token, 'system.admin');
      expect(canAdmin).toBe(false);
    });
    
    this.it('deve admin ter todas as permissões', function(expect) {
      // Cria usuário admin
      const adminUser = createTestUser_();
      adminUser.role = 'admin';
      appendRecord_('Users', adminUser);
      
      const loginResult = authLogin_(adminUser.username, adminUser.password);
      const token = loginResult.data.token;
      
      // Admin tem todas as permissões
      expect(hasPermission_(token, 'studies.read')).toBe(true);
      expect(hasPermission_(token, 'studies.create')).toBe(true);
      expect(hasPermission_(token, 'studies.delete')).toBe(true);
      expect(hasPermission_(token, 'system.admin')).toBe(true);
    });
    
    // ===========================
    // TOKEN REFRESH
    // ===========================
    
    this.it('deve renovar token próximo da expiração', function(expect) {
      const loginResult = authLogin_(testUser.username, testUser.password);
      const originalToken = loginResult.data.token;
      
      // Simula passagem de tempo (próximo da expiração)
      const session = findRecord_('Sessions', 'token', originalToken);
      const nearExpiry = new Date(Date.now() + 600000).toISOString(); // 10min
      updateRecordByField_('Sessions', 'token', originalToken, {
        expiresAt: nearExpiry
      });
      
      // Refresh token
      const refreshResult = refreshToken_(originalToken);
      
      expect(refreshResult).toBeDefined();
      expect(refreshResult.token).toBeDefined();
      expect(refreshResult.token).not.toBe(originalToken);
      
      // Novo token deve ser válido
      const newSession = validateSession_(refreshResult.token);
      expect(newSession.status).toBe('ACTIVE');
    });
    
    // ===========================
    // SEGURANÇA
    // ===========================
    
    this.it('não deve retornar senha no login', function(expect) {
      const result = authLogin_(testUser.username, testUser.password);
      
      expect(result.data.user).not.toHaveProperty('password');
    });
    
    this.it('deve registrar login em auditoria', function(expect) {
      authLogin_(testUser.username, testUser.password);
      
      const audits = listRecords_('AuditLog', {
        eventType: 'AUTH_LOGIN',
        actorUserId: testUser.id
      });
      
      expect(audits.length).toBeGreaterThan(0);
    });
    
    this.it('deve registrar logout em auditoria', function(expect) {
      const loginResult = authLogin_(testUser.username, testUser.password);
      authLogout_(loginResult.data.token);
      
      const audits = listRecords_('AuditLog', {
        eventType: 'AUTH_LOGOUT',
        actorUserId: testUser.id
      });
      
      expect(audits.length).toBeGreaterThan(0);
    });
  });
}

/**
 * Helper: Verifica se usuário tem permissão
 */
function hasPermission_(token, permission) {
  try {
    const session = validateSession_(token);
    const user = findRecord_('Users', 'id', session.userId);
    
    // Admin tem tudo
    if (user.role === 'admin') {
      return true;
    }
    
    // Mapeamento simplificado de permissões por role
    const rolePermissions = {
      researcher: [
        'studies.read', 'studies.create', 'studies.update',
        'experiments.read', 'experiments.create', 'experiments.update',
        'observations.read', 'observations.create'
      ],
      analyst: [
        'studies.read', 'experiments.read', 'observations.read',
        'maturity.backend', 'maturity.frontend'
      ],
      viewer: [
        'studies.read', 'experiments.read', 'observations.read'
      ]
    };
    
    const permissions = rolePermissions[user.role] || [];
    return permissions.indexOf(permission) >= 0;
    
  } catch (error) {
    return false;
  }
}

/**
 * Helper: Refresh token
 */
function refreshToken_(oldToken) {
  const session = validateSession_(oldToken);
  
  // Cria novo token
  const newToken = 'tok_' + Utilities.getUuid();
  const newExpiry = new Date(Date.now() + (8 * 60 * 60 * 1000)).toISOString();
  
  // Revoga token antigo
  updateRecordByField_('Sessions', 'token', oldToken, {
    status: 'REVOKED',
    revokedAt: new Date().toISOString()
  });
  
  // Cria nova sessão
  const newSession = {
    id: 'ses_' + Date.now(),
    token: newToken,
    userId: session.userId,
    createdAt: new Date().toISOString(),
    expiresAt: newExpiry,
    status: 'ACTIVE'
  };
  
  appendRecord_('Sessions', newSession);
  
  return {
    token: newToken,
    expiresAt: newExpiry
  };
}
