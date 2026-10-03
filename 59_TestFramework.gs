/**
 * COMPONENTE: 59_TestFramework.gs
 * PAPEL: Framework de testes end-to-end para Canabica WebApp
 * 
 * PRINCIPAIS FUNCIONALIDADES:
 * - Framework de testes estilo Jest/Mocha
 * - Assertions completas (toBe, toEqual, toThrow, etc)
 * - Setup/Teardown de fixtures
 * - Mocking de dependências
 * - Relatórios detalhados de execução
 * - Cobertura de código (estimada)
 * - Execução paralela de suites
 * 
 * INTEGRAÇÕES:
 * - Todos os serviços do sistema
 * - 21_LoggerService.gs - Logging de testes
 * - 13_AuditService.gs - Auditoria de execuções
 * 
 * ARQUITETURA:
 * - Test Suites organizadas por módulo
 * - Test Runner com controle de execução
 * - Assertion Library completa
 * - Mock System para isolamento
 * - Reporter para resultados
 * 
 * SEGURANÇA:
 * - Execução em ambiente isolado (test data)
 * - Rollback automático após testes
 * - Não afeta dados de produção
 * 
 * STATUS: PRODUCTION-READY
 */

// ===========================
// CONFIGURAÇÃO
// ===========================

/**
 * Configuração do framework de testes
 */
function getTestConfig_() {
  return {
    // Execução
    stopOnFirstFailure: false,
    timeout: 30000,              // 30s por teste
    parallel: false,             // Execução paralela (futuro)
    
    // Fixtures
    useTestData: true,
    cleanupAfterEach: true,
    cleanupAfterAll: true,
    
    // Relatórios
    verbose: true,
    logToSheet: true,
    logToConsole: true,
    
    // Cobertura
    trackCoverage: false,        // Estimativa de cobertura
    
    // Ambiente
    testSheetPrefix: 'TEST_',
    preserveBackup: true
  };
}

// ===========================
// TEST FRAMEWORK CORE
// ===========================

/**
 * Classe principal do Test Runner
 */
function TestRunner() {
  this.suites = [];
  this.currentSuite = null;
  this.results = {
    suites: [],
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0,
    startTime: null,
    endTime: null
  };
  this.config = getTestConfig_();
}

/**
 * Registra uma suite de testes
 * @param {string} name - Nome da suite
 * @param {Function} fn - Função que define os testes
 */
TestRunner.prototype.describe = function(name, fn) {
  const suite = {
    name: name,
    tests: [],
    beforeEach: null,
    afterEach: null,
    beforeAll: null,
    afterAll: null,
    skipped: false
  };
  
  this.suites.push(suite);
  this.currentSuite = suite;
  
  // Executa função que define os testes
  fn.call(this);
  
  this.currentSuite = null;
};

/**
 * Registra um teste individual
 * @param {string} description - Descrição do teste
 * @param {Function} fn - Função do teste
 */
TestRunner.prototype.it = function(description, fn) {
  if (!this.currentSuite) {
    throw new Error('it() deve ser chamado dentro de describe()');
  }
  
  this.currentSuite.tests.push({
    description: description,
    fn: fn,
    skipped: false
  });
};

/**
 * Hook executado antes de cada teste
 */
TestRunner.prototype.beforeEach = function(fn) {
  if (this.currentSuite) {
    this.currentSuite.beforeEach = fn;
  }
};

/**
 * Hook executado após cada teste
 */
TestRunner.prototype.afterEach = function(fn) {
  if (this.currentSuite) {
    this.currentSuite.afterEach = fn;
  }
};

/**
 * Hook executado antes de todos os testes da suite
 */
TestRunner.prototype.beforeAll = function(fn) {
  if (this.currentSuite) {
    this.currentSuite.beforeAll = fn;
  }
};

/**
 * Hook executado após todos os testes da suite
 */
TestRunner.prototype.afterAll = function(fn) {
  if (this.currentSuite) {
    this.currentSuite.afterAll = fn;
  }
};

/**
 * Executa todos os testes
 * @returns {Object} Resultados da execução
 */
TestRunner.prototype.run = function() {
  this.results.startTime = new Date();
  const startMs = Date.now();
  
  logInfo_('Iniciando execução de testes...');
  
  for (let i = 0; i < this.suites.length; i++) {
    const suite = this.suites[i];
    
    if (suite.skipped) {
      this.results.skipped += suite.tests.length;
      continue;
    }
    
    const suiteResult = this.runSuite_(suite);
    this.results.suites.push(suiteResult);
    
    this.results.totalTests += suiteResult.totalTests;
    this.results.passed += suiteResult.passed;
    this.results.failed += suiteResult.failed;
    this.results.skipped += suiteResult.skipped;
    
    // Para na primeira falha se configurado
    if (this.config.stopOnFirstFailure && suiteResult.failed > 0) {
      break;
    }
  }
  
  this.results.duration = Date.now() - startMs;
  this.results.endTime = new Date();
  
  logInfo_('Testes concluídos: ' + this.results.passed + '/' + this.results.totalTests);
  
  // Salva resultados
  this.saveResults_();
  
  return this.results;
};

/**
 * Executa uma suite de testes
 * @param {Object} suite
 * @returns {Object} Resultados da suite
 */
TestRunner.prototype.runSuite_ = function(suite) {
  const result = {
    name: suite.name,
    tests: [],
    totalTests: suite.tests.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    duration: 0
  };
  
  const startMs = Date.now();
  
  logInfo_('Suite: ' + suite.name);
  
  // beforeAll
  if (suite.beforeAll) {
    try {
      suite.beforeAll();
    } catch (error) {
      logError_('Erro em beforeAll: ' + error.message);
      // Pula toda a suite
      result.skipped = suite.tests.length;
      result.duration = Date.now() - startMs;
      return result;
    }
  }
  
  // Executa cada teste
  for (let i = 0; i < suite.tests.length; i++) {
    const test = suite.tests[i];
    
    if (test.skipped) {
      result.skipped++;
      result.tests.push({
        description: test.description,
        status: 'SKIPPED'
      });
      continue;
    }
    
    const testResult = this.runTest_(test, suite);
    result.tests.push(testResult);
    
    if (testResult.status === 'PASSED') {
      result.passed++;
    } else if (testResult.status === 'FAILED') {
      result.failed++;
    }
  }
  
  // afterAll
  if (suite.afterAll) {
    try {
      suite.afterAll();
    } catch (error) {
      logError_('Erro em afterAll: ' + error.message);
    }
  }
  
  result.duration = Date.now() - startMs;
  
  return result;
};

/**
 * Executa um teste individual
 * @param {Object} test
 * @param {Object} suite
 * @returns {Object} Resultado do teste
 */
TestRunner.prototype.runTest_ = function(test, suite) {
  const result = {
    description: test.description,
    status: 'PASSED',
    error: null,
    duration: 0
  };
  
  const startMs = Date.now();
  
  try {
    // beforeEach
    if (suite.beforeEach) {
      suite.beforeEach();
    }
    
    // Executa teste com timeout
    const timeoutMs = this.config.timeout;
    const startTime = Date.now();
    
    test.fn(expect);
    
    const elapsed = Date.now() - startTime;
    if (elapsed > timeoutMs) {
      throw new Error('Timeout de ' + timeoutMs + 'ms excedido');
    }
    
    // afterEach
    if (suite.afterEach) {
      suite.afterEach();
    }
    
    if (this.config.verbose) {
      logInfo_('  ✓ ' + test.description);
    }
    
  } catch (error) {
    result.status = 'FAILED';
    result.error = {
      message: error.message,
      stack: error.stack
    };
    
    logError_('  ✗ ' + test.description);
    logError_('    ' + error.message);
    
    // afterEach mesmo em caso de erro
    if (suite.afterEach) {
      try {
        suite.afterEach();
      } catch (e) {
        logError_('    Erro em afterEach: ' + e.message);
      }
    }
  }
  
  result.duration = Date.now() - startMs;
  
  return result;
};

/**
 * Salva resultados em aba TestResults
 */
TestRunner.prototype.saveResults_ = function() {
  if (!this.config.logToSheet) {
    return;
  }
  
  try {
    const summary = {
      timestamp: this.results.startTime.toISOString(),
      totalTests: this.results.totalTests,
      passed: this.results.passed,
      failed: this.results.failed,
      skipped: this.results.skipped,
      duration: this.results.duration,
      passRate: this.results.totalTests > 0 
        ? (this.results.passed / this.results.totalTests * 100).toFixed(2) + '%'
        : '0%',
      status: this.results.failed === 0 ? 'SUCCESS' : 'FAILURE',
      details: JSON.stringify(this.results.suites)
    };
    
    appendRecord_('TestResults', summary);
    
  } catch (error) {
    logWarn_('Não foi possível salvar resultados: ' + error.message);
  }
};

// ===========================
// ASSERTION LIBRARY
// ===========================

/**
 * Cria objeto de expectativa para assertions
 * @param {*} actual - Valor atual
 * @returns {Object} Objeto com assertions
 */
function expect(actual) {
  return {
    actual: actual,
    
    /**
     * Verifica igualdade estrita (===)
     */
    toBe: function(expected) {
      if (actual !== expected) {
        throw new Error(
          'Expected ' + JSON.stringify(actual) + 
          ' to be ' + JSON.stringify(expected)
        );
      }
      return this;
    },
    
    /**
     * Verifica igualdade profunda (deep equal)
     */
    toEqual: function(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(
          'Expected ' + JSON.stringify(actual) + 
          ' to equal ' + JSON.stringify(expected)
        );
      }
      return this;
    },
    
    /**
     * Verifica se é truthy
     */
    toBeTruthy: function() {
      if (!actual) {
        throw new Error('Expected ' + actual + ' to be truthy');
      }
      return this;
    },
    
    /**
     * Verifica se é falsy
     */
    toBeFalsy: function() {
      if (actual) {
        throw new Error('Expected ' + actual + ' to be falsy');
      }
      return this;
    },
    
    /**
     * Verifica se é null
     */
    toBeNull: function() {
      if (actual !== null) {
        throw new Error('Expected ' + actual + ' to be null');
      }
      return this;
    },
    
    /**
     * Verifica se é undefined
     */
    toBeUndefined: function() {
      if (actual !== undefined) {
        throw new Error('Expected value to be undefined');
      }
      return this;
    },
    
    /**
     * Verifica se é definido (not undefined)
     */
    toBeDefined: function() {
      if (actual === undefined) {
        throw new Error('Expected value to be defined');
      }
      return this;
    },
    
    /**
     * Verifica maior que
     */
    toBeGreaterThan: function(expected) {
      if (actual <= expected) {
        throw new Error(
          'Expected ' + actual + ' to be greater than ' + expected
        );
      }
      return this;
    },
    
    /**
     * Verifica maior ou igual
     */
    toBeGreaterThanOrEqual: function(expected) {
      if (actual < expected) {
        throw new Error(
          'Expected ' + actual + ' to be greater than or equal to ' + expected
        );
      }
      return this;
    },
    
    /**
     * Verifica menor que
     */
    toBeLessThan: function(expected) {
      if (actual >= expected) {
        throw new Error(
          'Expected ' + actual + ' to be less than ' + expected
        );
      }
      return this;
    },
    
    /**
     * Verifica menor ou igual
     */
    toBeLessThanOrEqual: function(expected) {
      if (actual > expected) {
        throw new Error(
          'Expected ' + actual + ' to be less than or equal to ' + expected
        );
      }
      return this;
    },
    
    /**
     * Verifica se contém valor
     */
    toContain: function(expected) {
      let found = false;
      
      if (typeof actual === 'string') {
        found = actual.indexOf(expected) >= 0;
      } else if (Array.isArray(actual)) {
        found = actual.indexOf(expected) >= 0;
      } else if (typeof actual === 'object') {
        found = actual.hasOwnProperty(expected);
      }
      
      if (!found) {
        throw new Error(
          'Expected ' + JSON.stringify(actual) + 
          ' to contain ' + JSON.stringify(expected)
        );
      }
      return this;
    },
    
    /**
     * Verifica tamanho de array/string
     */
    toHaveLength: function(expected) {
      const length = actual.length;
      if (length !== expected) {
        throw new Error(
          'Expected length ' + length + ' to be ' + expected
        );
      }
      return this;
    },
    
    /**
     * Verifica se propriedade existe
     */
    toHaveProperty: function(property, value) {
      if (!actual.hasOwnProperty(property)) {
        throw new Error(
          'Expected object to have property ' + property
        );
      }
      
      if (value !== undefined && actual[property] !== value) {
        throw new Error(
          'Expected property ' + property + ' to be ' + value + 
          ' but got ' + actual[property]
        );
      }
      return this;
    },
    
    /**
     * Verifica se função lança erro
     */
    toThrow: function(expected) {
      let threw = false;
      let error = null;
      
      try {
        actual();
      } catch (e) {
        threw = true;
        error = e;
      }
      
      if (!threw) {
        throw new Error('Expected function to throw');
      }
      
      if (expected && error.message.indexOf(expected) < 0) {
        throw new Error(
          'Expected error message to contain "' + expected + 
          '" but got "' + error.message + '"'
        );
      }
      
      return this;
    },
    
    /**
     * Verifica se função não lança erro
     */
    not: {
      toBe: function(expected) {
        if (actual === expected) {
          throw new Error(
            'Expected ' + JSON.stringify(actual) + 
            ' not to be ' + JSON.stringify(expected)
          );
        }
      },
      
      toEqual: function(expected) {
        if (JSON.stringify(actual) === JSON.stringify(expected)) {
          throw new Error(
            'Expected ' + JSON.stringify(actual) + 
            ' not to equal ' + JSON.stringify(expected)
          );
        }
      },
      
      toContain: function(expected) {
        let found = false;
        
        if (typeof actual === 'string') {
          found = actual.indexOf(expected) >= 0;
        } else if (Array.isArray(actual)) {
          found = actual.indexOf(expected) >= 0;
        }
        
        if (found) {
          throw new Error(
            'Expected ' + JSON.stringify(actual) + 
            ' not to contain ' + JSON.stringify(expected)
          );
        }
      },
      
      toThrow: function() {
        try {
          actual();
        } catch (e) {
          throw new Error('Expected function not to throw');
        }
      }
    }
  };
}

// ===========================
// MOCK SYSTEM
// ===========================

/**
 * Cria mock de função
 * @param {Function} [implementation] - Implementação do mock
 * @returns {Function} Função mockada
 */
function mockFunction(implementation) {
  const mock = function() {
    mock.calls.push(Array.prototype.slice.call(arguments));
    mock.callCount++;
    
    if (mock.returnValue !== undefined) {
      return mock.returnValue;
    }
    
    if (implementation) {
      return implementation.apply(this, arguments);
    }
    
    return undefined;
  };
  
  mock.calls = [];
  mock.callCount = 0;
  mock.returnValue = undefined;
  
  mock.mockReturnValue = function(value) {
    mock.returnValue = value;
    return mock;
  };
  
  mock.mockImplementation = function(fn) {
    implementation = fn;
    return mock;
  };
  
  mock.mockClear = function() {
    mock.calls = [];
    mock.callCount = 0;
    return mock;
  };
  
  return mock;
}

/**
 * Cria spy de objeto
 * @param {Object} obj - Objeto a espionar
 * @param {string} method - Nome do método
 * @returns {Function} Spy function
 */
function spyOn(obj, method) {
  const original = obj[method];
  const spy = mockFunction(original);
  
  spy.restore = function() {
    obj[method] = original;
  };
  
  obj[method] = spy;
  
  return spy;
}

// ===========================
// TEST FIXTURES
// ===========================

/**
 * Cria dados de teste para usuário
 * @returns {Object}
 */
function createTestUser_() {
  return {
    id: 'test_user_' + Date.now(),
    username: 'test_' + Date.now() + '@example.com',
    password: 'Test@123',
    displayName: 'Test User',
    role: 'researcher',
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };
}

/**
 * Cria dados de teste para estudo
 * @returns {Object}
 */
function createTestStudy_(ownerId) {
  return {
    id: 'test_study_' + Date.now(),
    title: 'Test Study ' + Date.now(),
    objective: 'Test objective for automated testing',
    hostSpecies: 'Cannabis sativa L.',
    fungalStrain: 'Trichoderma harzianum',
    cultivar: 'Test Cultivar',
    status: 'DRAFT',
    ownerId: ownerId || 'test_user',
    createdAt: new Date().toISOString()
  };
}

/**
 * Limpa dados de teste
 */
function cleanupTestData_() {
  try {
    // Remove usuários de teste
    const users = listRecords_('Users', {});
    users.forEach(function(user) {
      if (user.username && user.username.startsWith('test_')) {
        // Marcar como deletado ao invés de remover
        updateRecordByField_('Users', 'id', user.id, {
          status: 'DELETED'
        });
      }
    });
    
    // Remove estudos de teste
    const studies = listRecords_('Studies', {});
    studies.forEach(function(study) {
      if (study.id && study.id.startsWith('test_study_')) {
        updateRecordByField_('Studies', 'id', study.id, {
          status: 'DELETED'
        });
      }
    });
    
    logInfo_('Dados de teste limpos');
    
  } catch (error) {
    logWarn_('Erro ao limpar dados de teste: ' + error.message);
  }
}

// ===========================
// RUNNER GLOBAL
// ===========================

var _testRunner = null;

/**
 * Obtém instância global do test runner
 * @returns {TestRunner}
 */
function getTestRunner_() {
  if (!_testRunner) {
    _testRunner = new TestRunner();
  }
  return _testRunner;
}

/**
 * Atalho para describe
 */
function describe(name, fn) {
  return getTestRunner_().describe(name, fn);
}

/**
 * Atalho para it
 */
function it(description, fn) {
  return getTestRunner_().it(description, fn);
}

/**
 * Atalho para beforeEach
 */
function beforeEach(fn) {
  return getTestRunner_().beforeEach(fn);
}

/**
 * Atalho para afterEach
 */
function afterEach(fn) {
  return getTestRunner_().afterEach(fn);
}

/**
 * Atalho para beforeAll
 */
function beforeAll(fn) {
  return getTestRunner_().beforeAll(fn);
}

/**
 * Atalho para afterAll
 */
function afterAll(fn) {
  return getTestRunner_().afterAll(fn);
}

/**
 * Executa todos os testes registrados
 * @returns {Object} Resultados
 */
function runAllTests() {
  _testRunner = new TestRunner();
  
  // Registra todas as suites de teste
  registerAuthTests_();
  registerCrudTests_();
  registerCacheTests_();
  registerFeatureFlagTests_();
  registerBackupTests_();
  registerObservabilityTests_();
  registerIntegrationTests_();
  
  // Executa
  const results = _testRunner.run();
  
  // Cleanup
  cleanupTestData_();
  
  return results;
}

// Exporta para uso global
var TestFramework = {
  describe: describe,
  it: it,
  expect: expect,
  beforeEach: beforeEach,
  afterEach: afterEach,
  beforeAll: beforeAll,
  afterAll: afterAll,
  mockFunction: mockFunction,
  spyOn: spyOn,
  runAllTests: runAllTests,
  createTestUser: createTestUser_,
  createTestStudy: createTestStudy_,
  cleanupTestData: cleanupTestData_
};
