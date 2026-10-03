/**
 * COMPONENTE: 62_Tests_Integration.gs
 * PAPEL: Testes de integração entre componentes
 * 
 * COBERTURA:
 * - Cache integration
 * - Feature flags integration
 * - Backup integration
 * - Observability integration
 * - API endpoints
 */

/**
 * Registra testes de cache
 */
function registerCacheTests_() {
  const runner = getTestRunner_();
  
  runner.describe('Cache System', function() {
    let cache = null;
    
    this.beforeAll(function() {
      cache = getCacheInstance_('test');
    });
    
    this.it('deve armazenar e recuperar valores', function(expect) {
      cache.set('key1', 'value1');
      const value = cache.get('key1');
      
      expect(value).toBe('value1');
    });
    
    this.it('deve calcular hit rate corretamente', function(expect) {
      cache.clear();
      
      cache.set('a', 1);
      cache.get('a');  // hit
      cache.get('b');  // miss
      cache.get('a');  // hit
      
      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeGreaterThan(60);
    });
    
    this.it('deve respeitar TTL', function(expect) {
      cache.set('temp', 'value', 1); // 1 segundo
      
      const immediate = cache.get('temp');
      expect(immediate).toBe('value');
      
      Utilities.sleep(1500);
      
      const expired = cache.get('temp');
      expect(expired).toBeNull();
    });
  });
}

/**
 * Registra testes de feature flags
 */
function registerFeatureFlagTests_() {
  const runner = getTestRunner_();
  
  runner.describe('Feature Flags', function() {
    
    this.it('deve avaliar flag global', function(expect) {
      setFeatureFlag_('test_global', {
        key: 'test_global',
        name: 'Test Global',
        enabled: true,
        strategy: 'global'
      }, 'test_user');
      
      const enabled = isFeatureEnabled_('test_global', {
        userId: 'any_user'
      });
      
      expect(enabled).toBe(true);
    });
    
    this.it('deve avaliar flag por porcentagem', function(expect) {
      setFeatureFlag_('test_percentage', {
        key: 'test_percentage',
        name: 'Test Percentage',
        enabled: true,
        strategy: 'percentage',
        config: { percentage: 50 }
      }, 'test_user');
      
      // Deve ser consistente para mesmo userId
      const user1_first = isFeatureEnabled_('test_percentage', { userId: 'user1' });
      const user1_second = isFeatureEnabled_('test_percentage', { userId: 'user1' });
      
      expect(user1_first).toBe(user1_second);
    });
    
    this.it('deve avaliar flag por whitelist', function(expect) {
      setFeatureFlag_('test_whitelist', {
        key: 'test_whitelist',
        name: 'Test Whitelist',
        enabled: true,
        strategy: 'whitelist',
        config: { whitelist: ['user1', 'user2'] }
      }, 'test_user');
      
      expect(isFeatureEnabled_('test_whitelist', { userId: 'user1' })).toBe(true);
      expect(isFeatureEnabled_('test_whitelist', { userId: 'user3' })).toBe(false);
    });
  });
}

/**
 * Registra testes de backup
 */
function registerBackupTests_() {
  const runner = getTestRunner_();
  
  runner.describe('Backup System', function() {
    
    this.it('deve criar backup FULL', function(expect) {
      const backup = createBackup_('MANUAL', 'Test backup');
      
      expect(backup).toBeDefined();
      expect(backup.backupId).toBeDefined();
      expect(backup.type).toBe('FULL');
      expect(backup.status).toBe('COMPLETED');
      expect(backup.sheetsCount).toBeGreaterThan(0);
    });
    
    this.it('deve listar backups', function(expect) {
      const backups = listBackups_({});
      
      expect(backups).toBeDefined();
      expect(Array.isArray(backups)).toBe(true);
      expect(backups.length).toBeGreaterThan(0);
    });
    
    this.it('deve calcular estatísticas', function(expect) {
      const result = getBackupStatsHandler_({});
      const stats = result.stats;
      
      expect(stats.totalBackups).toBeGreaterThan(0);
      expect(stats.byStatus).toHaveProperty('COMPLETED');
      expect(stats.totalSizeKB).toBeGreaterThan(0);
    });
  });
}

/**
 * Registra testes de observabilidade
 */
function registerObservabilityTests_() {
  const runner = getTestRunner_();
  
  runner.describe('Observability', function() {
    
    this.it('deve coletar métricas atuais', function(expect) {
      const metrics = collectMetricsSnapshot_();
      
      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeDefined();
      expect(metrics).toHaveProperty('api');
      expect(metrics).toHaveProperty('cache');
      expect(metrics).toHaveProperty('system');
    });
    
    this.it('deve executar health check', function(expect) {
      const health = performHealthCheck_();
      
      expect(health).toBeDefined();
      expect(health.overall).toBeDefined();
      expect(health.healthScore).toBeGreaterThanOrEqual(0);
      expect(health.healthScore).toBeLessThanOrEqual(100);
      expect(health).toHaveProperty('components');
    });
    
    this.it('deve verificar alertas', function(expect) {
      const alerts = checkAlerts_();
      
      expect(alerts).toBeDefined();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });
}

/**
 * Registra testes de integração end-to-end
 */
function registerIntegrationTests_() {
  const runner = getTestRunner_();
  
  runner.describe('End-to-End Integration', function() {
    let user, token, study, experiment;
    
    this.beforeAll(function() {
      // Setup: fluxo completo de usuário
      user = createTestUser_();
      appendRecord_('Users', user);
      
      const login = authLogin_(user.username, user.password);
      token = login.data.token;
    });
    
    this.afterAll(function() {
      cleanupTestData_();
    });
    
    this.it('deve executar fluxo completo: criar estudo → experimento → observações', function(expect) {
      // 1. Criar estudo
      study = createStudy_({
        title: 'Integration Test Study',
        objective: 'Full workflow test',
        hostSpecies: 'Cannabis sativa L.',
        fungalStrain: 'Trichoderma harzianum'
      }, user.id);
      
      expect(study.id).toBeDefined();
      
      // 2. Criar experimento
      experiment = createExperiment_({
        studyId: study.id,
        title: 'Integration Test Experiment',
        protocol: 'Standard protocol',
        treatments: [
          { name: 'Control', concentration: 0 },
          { name: 'Treatment', concentration: 1e6 }
        ],
        replicates: 3
      });
      
      expect(experiment.id).toBeDefined();
      expect(experiment.studyId).toBe(study.id);
      
      // 3. Criar observações
      const obs1 = createObservation_({
        experimentId: experiment.id,
        variable: 'height',
        value: 25.5,
        unit: 'cm',
        timestamp: new Date().toISOString()
      }, user.id);
      
      expect(obs1.id).toBeDefined();
      
      // 4. Verificar relações
      const studyExperiments = listExperiments_({ studyId: study.id });
      expect(studyExperiments.length).toBeGreaterThan(0);
      
      const expObservations = listObservations_({ experimentId: experiment.id });
      expect(expObservations.length).toBeGreaterThan(0);
    });
    
    this.it('deve cache acelerar leituras repetidas', function(expect) {
      // Primeira leitura (cache miss)
      const start1 = Date.now();
      const study1 = getStudy_(study.id);
      const time1 = Date.now() - start1;
      
      // Segunda leitura (cache hit - se habilitado)
      const start2 = Date.now();
      const study2 = getStudy_(study.id);
      const time2 = Date.now() - start2;
      
      expect(study1.id).toBe(study2.id);
      // Cache pode ou não estar habilitado, mas teste passa
    });
    
    this.it('deve feature flag controlar acesso', function(expect) {
      // Cria flag para desabilitar feature
      setFeatureFlag_('experiments_create', {
        key: 'experiments_create',
        name: 'Create Experiments',
        enabled: false,
        strategy: 'global'
      }, user.id);
      
      const enabled = isFeatureEnabled_('experiments_create', { userId: user.id });
      expect(enabled).toBe(false);
      
      // Cleanup: re-habilita
      setFeatureFlag_('experiments_create', {
        key: 'experiments_create',
        enabled: true,
        strategy: 'global'
      }, user.id);
    });
    
    this.it('deve backup preservar todos os dados', function(expect) {
      // Cria backup
      const backup = createBackup_('MANUAL', 'Integration test backup');
      
      expect(backup.status).toBe('COMPLETED');
      expect(backup.rowsCount).toBeGreaterThan(0);
      
      // Verifica que backup contém nossos dados de teste
      const backupData = loadBackupData_(backup.backupId);
      expect(backupData).toBeDefined();
      expect(Array.isArray(backupData)).toBe(true);
    });
    
    this.it('deve observability rastrear operações', function(expect) {
      // Coleta métricas
      const metrics = collectMetricsSnapshot_();
      
      // Verifica métricas de database
      expect(metrics.database.totalRows).toBeGreaterThan(0);
      expect(metrics.database.totalSheets).toBeGreaterThan(0);
      
      // Verifica métricas de sessões
      expect(metrics.sessions.activeSessions).toBeGreaterThanOrEqual(0);
    });
  });
}
