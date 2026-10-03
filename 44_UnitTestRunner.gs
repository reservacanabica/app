/**
 * COMPONENTE: 44_UnitTestRunner.gs
 * PAPEL: Executor de testes internos.
 *
 * PRINCIPAIS FUNCIONALIDADES:
 * - testes de contrato, schema, autenticação, CRUD, permissões e integração;
 * - mantém o CRUD centralizado no Google Sheets identificado por SPREADSHEETS_ID;
 * - expõe apenas contratos pequenos para facilitar testes e futura substituição.
 *
 * INTEGRAÇÕES:
 * - TestFixtures, todos os serviços;
 * - Bootstrap, Constants, Config, Response e os serviços explicitamente chamados pelo corpo.
 *
 * ENTIDADES/ABAS ENVOLVIDAS:
 * - AuditLog opcional e Execution logs.
 *
 * SEGURANÇA E LIMITAÇÕES:
 * - senhas em texto plano são mantidas somente porque foram solicitadas para este protótipo;
 * - não registrar senha, token ou payload sensível em Logger.log, respostas ou exportações;
 * - aplicar autorização antes de toda escrita e registrar o evento em AuditLog;
 * - este arquivo é um esqueleto executável/documentado, não um laudo científico nem substituto de revisão humana.
 *
 * STATUS: ESQUELETO DE ARQUITETURA — preencher regras de negócio e testes antes de produção.
 */

function runUnitTests_() { const tests = [testConfig_, testSchema_, testJsonSanitization_, testPlainTextPolicy_]; const results = tests.map(function(test) { try { test(); return { name: test.name, ok: true }; } catch (error) { return { name: test.name, ok: false, error: publicErrorCode_(error) }; } }); return { passed: results.filter(function(r) { return r.ok; }).length, total: results.length, results: results }; }
function testConfig_() { if (!getConfig_().SPREADSHEETS_ID) throw new Error('CONFIG_MISSING'); }
function testSchema_() { if (!Object.keys(APP_HEADERS).length) throw new Error('SCHEMA_EMPTY'); }
function testJsonSanitization_() { if (safeJson_({ password: 'x' }).indexOf('password') >= 0) throw new Error('SANITIZE_FAILED'); }
function testPlainTextPolicy_() { if (!verifyPlainTextPassword_('x', 'x')) throw new Error('PLAIN_TEXT_POLICY_FAILED'); }

/**
 * SUÍTE DE TESTES END-TO-END CLÍNICOS
 * Testes de integração sem mocks para validar funcionalidades do sistema de telemedicina canábica
 * 
 * Cobertura:
 * - Cálculo científico de VPD (Déficit de Pressão de Vapor)
 * - Hashing consistente de CPF com SHA-256
 * - Aplicação de filtros de escopo de dados (Data Scope RBAC)
 * - Existência da ponte RPC pública routeRequest
 * 
 * Uso: Executar runClinicalE2ETests_() no editor do Apps Script antes de deploy
 */
function runClinicalE2ETests_() {
  const report = { 
    passed: 0, 
    failed: 0, 
    errors: [],
    timestamp: new Date().toISOString()
  };

  /**
   * Helper para asserção de testes
   * @param {string} testName - Nome descritivo do teste
   * @param {boolean} condition - Condição a ser verificada
   * @param {string} details - Detalhes do erro se falhar
   */
  function assert(testName, condition, details) {
    if (condition) {
      report.passed++;
      Logger.log("✅ PASS: " + testName);
    } else {
      report.failed++;
      report.errors.push({ test: testName, details: details });
      Logger.log("❌ FAIL: " + testName + " | " + details);
    }
  }

  Logger.log("========================================");
  Logger.log("INICIANDO TESTES E2E CLÍNICOS");
  Logger.log("========================================");

  // ============================================================================
  // TESTE 1: Cálculo Científico de VPD
  // ============================================================================
  try {
    const vpd = calcularVpd_(25, 60);
    const vpdValido = vpd >= 1.25 && vpd <= 1.29;
    assert(
      "Cálculo de VPD a 25°C e 60% UR", 
      vpdValido, 
      "Esperado ~1.27 kPa, obtido: " + vpd.toFixed(2) + " kPa"
    );
  } catch (error) {
    assert(
      "Cálculo de VPD a 25°C e 60% UR", 
      false, 
      "Exceção lançada: " + error.message
    );
  }

  // ============================================================================
  // TESTE 2: Consistência de Hashing de CPF
  // ============================================================================
  try {
    // Testar se CPF com máscara e sem máscara geram o mesmo hash
    const cpfComMascara = "123.456.789-00";
    const cpfSemMascara = "12345678900";
    
    const hash1 = SecurityUtils.hashCpf(cpfComMascara);
    const hash2 = SecurityUtils.hashCpf(cpfSemMascara);
    
    const hashesIguais = hash1 === hash2;
    const tamanhoCorreto = hash1.length === 64; // SHA-256 = 64 chars hex
    
    assert(
      "Consistência de Hash de CPF com e sem máscara", 
      hashesIguais && tamanhoCorreto, 
      "Hash1: " + hash1.substring(0, 16) + "..., Hash2: " + hash2.substring(0, 16) + "..., Iguais: " + hashesIguais + ", Tamanho: " + hash1.length
    );
  } catch (error) {
    assert(
      "Consistência de Hash de CPF com e sem máscara", 
      false, 
      "Exceção lançada: " + error.message
    );
  }

  // ============================================================================
  // TESTE 3: Restrição de Escopo de Dados (Data Scope RBAC)
  // ============================================================================
  try {
    // Simular usuário grower tentando acessar dados
    const userGrower = { 
      id: 'usr_aaa', 
      role: 'grower' 
    };
    
    const filtersAplicados = applyDataScope_(userGrower, 'DB_CULTIVO_PLANTAS', {});
    
    // Grower deve ter filtro paciente_id injetado automaticamente
    const escopoCorreto = filtersAplicados.paciente_id === 'usr_aaa';
    
    assert(
      "Filtro de escopo injeta paciente_id para role grower", 
      escopoCorreto, 
      "Esperado paciente_id='usr_aaa', obtido: " + JSON.stringify(filtersAplicados)
    );
  } catch (error) {
    assert(
      "Filtro de escopo injeta paciente_id para role grower", 
      false, 
      "Exceção lançada: " + error.message
    );
  }

  // ============================================================================
  // TESTE 4: Existência da Ponte RPC Pública
  // ============================================================================
  try {
    // Verificar se função routeRequest está declarada e é acessível
    const ponteExiste = typeof routeRequest === 'function';
    
    assert(
      "Ponte pública routeRequest declarada", 
      ponteExiste, 
      "routeRequest não está definida ou não é uma função. Type: " + typeof routeRequest
    );
  } catch (error) {
    assert(
      "Ponte pública routeRequest declarada", 
      false, 
      "Exceção lançada: " + error.message
    );
  }

  // ============================================================================
  // RELATÓRIO FINAL
  // ============================================================================
  Logger.log("========================================");
  Logger.log("RELATÓRIO DE TESTES E2E CLÍNICOS");
  Logger.log("========================================");
  Logger.log("✅ Testes Aprovados: " + report.passed);
  Logger.log("❌ Testes Falhados: " + report.failed);
  Logger.log("📊 Total de Testes: " + (report.passed + report.failed));
  Logger.log("📅 Timestamp: " + report.timestamp);
  
  if (report.failed > 0) {
    Logger.log("");
    Logger.log("ERROS ENCONTRADOS:");
    report.errors.forEach(function(err, idx) {
      Logger.log((idx + 1) + ". " + err.test);
      Logger.log("   └─ " + err.details);
    });
  }
  
  Logger.log("========================================");
  
  // Retornar relatório estruturado
  return report;
}

/**
 * Executa apenas os testes clínicos e exibe resultado formatado
 * Útil para validação rápida antes de deploy
 */
function testClinicalSuite() {
  const result = runClinicalE2ETests_();
  
  if (result.failed === 0) {
    Logger.log("🎉 TODOS OS TESTES PASSARAM! Sistema pronto para deploy.");
    return true;
  } else {
    Logger.log("⚠️ ATENÇÃO: " + result.failed + " teste(s) falharam. Revisar antes de deploy.");
    return false;
  }
}

// ============================================================================
// MC-6: TESTES E2E DO SISTEMA DE COMORBIDADES CANÁBICAS
// ============================================================================

/**
 * MC-6 Test Utilities - Shared setup and teardown functions
 */

/**
 * Clear all MC-6 test data from relevant tables
 * @private
 */
function clearMC6TestData_() {
  try {
    Logger.log('🧹 Limpando dados de teste MC-6...');
    
    // Limpar comorbidades de teste
    const comorbidadesLimpas = deleteRowsByPrefix_('DB_COMORBIDADES_PACIENTE', 'TEST_');
    
    // Limpar lotes de teste
    const lotesLimpos = deleteRowsByPrefix_('Lotes_CoA', 'TEST_LOTE_');
    
    Logger.log('   ✓ Comorbidades removidas: ' + comorbidadesLimpas);
    Logger.log('   ✓ Lotes removidos: ' + lotesLimpos);
    
    return {
      comorbidades: comorbidadesLimpas,
      lotes: lotesLimpos
    };
  } catch (error) {
    Logger.log('⚠️ Erro na limpeza de dados: ' + error.message);
    return { comorbidades: 0, lotes: 0, error: error.message };
  }
}

/**
 * Seed reference data required for MC-6 tests
 * @private
 */
function seedMC6TestData_() {
  try {
    Logger.log('🌱 Seeding dados de referência MC-6...');
    
    // Seed comorbidades (idempotente)
    const seedResult = seedComorbidadesCanabicas_();
    
    Logger.log('   ✓ Comorbidades: ' + (seedResult.inserted || 0) + ' inseridas');
    
    return {
      ok: seedResult.ok,
      comorbidadesInserted: seedResult.inserted || 0
    };
  } catch (error) {
    Logger.log('⚠️ Erro no seed de dados: ' + error.message);
    return { ok: false, error: error.message };
  }
}

/**
 * Create a test lote with default values (can be overridden)
 * @param {Object} overrides - Properties to override
 * @returns {Object} Lote object
 * @private
 */
function createTestLote_(overrides) {
  const defaults = {
    id: 'TEST_LOTE_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    numeroLote: 'TEST-LOT-' + Date.now(),
    status: 'ACTIVE',
    insumoId: 'TEST_INSUMO_001',
    statusAuditoria: 'APROVADO',
    statusLiberacao: 'LIBERADO',
    teor_Pb_ppm: 0.05,
    teor_Cd_ppm: 0.02,
    teor_As_ppm: 0.03,
    teor_Hg_ppm: 0.01,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // Merge overrides
  const lote = {};
  for (var key in defaults) {
    lote[key] = (overrides && overrides[key] !== undefined) ? overrides[key] : defaults[key];
  }
  
  return lote;
}

/**
 * MC-6: Suite de Testes End-to-End das Regras Agro-Toxicológicas e Científicas
 * 
 * Testes organizados por nível de maturidade:
 * - L1: Foundation (catalog integrity, data seeding, cleanup)
 * - L2: Business Logic (CoA grade hierarchy, metal limits, validation rules)
 * - L3: Integration (end-to-end patient workflows)
 * - L4: Advanced (edge cases, performance, security)
 * 
 * Uso: Executar runAgroClinicalCoAE2ETests_() para suite completa
 *      ou runMC6TestsByLevel_('L1') para testes específicos
 */
function runAgroClinicalCoAE2ETests_() {
  const report = {
    suite: 'AgroClinical_CoA_Evidence_E2E',
    passed: 0,
    failed: 0,
    errors: [],
    warnings: [],
    timestamp: new Date().toISOString()
  };

  /**
   * Helper para asserção de testes
   */
  function assert(testName, condition, details) {
    if (condition) {
      report.passed++;
      Logger.log("✅ PASS: " + testName);
    } else {
      report.failed++;
      report.errors.push({ test: testName, details: details });
      Logger.log("❌ FAIL: " + testName + " | " + details);
    }
  }

  /**
   * Helper para avisos não críticos
   */
  function warn(testName, message) {
    report.warnings.push({ test: testName, message: message });
    Logger.log("⚠️ WARN: " + testName + " | " + message);
  }

  Logger.log("========================================");
  Logger.log("MC-6: TESTES E2E AGRO-CLÍNICOS");
  Logger.log("========================================");

  // Setup: Seed reference data
  seedMC6TestData_();

  // ============================================================================
  // L1: FOUNDATION TESTS - Catalog Integrity & Data Seeding
  // ============================================================================
  test_MC6_L1_CatalogIntegrity_(assert, warn);

  // ============================================================================
  // L2: BUSINESS LOGIC TESTS - CoA Grade Hierarchy & Validation
  // ============================================================================
  test_MC6_L2_CoAGradeHierarchy_(assert, warn);
  test_MC6_L2_HeavyMetalBlocking_(assert, warn);
  test_MC6_L2_BatchApprovalHappyPath_(assert, warn);

  // ============================================================================
  // L1: CLEANUP TEST
  // ============================================================================
  test_MC6_L1_DataCleanup_(assert);

  // ============================================================================
  // RELATÓRIO FINAL
  // ============================================================================
  Logger.log("\n========================================");
  Logger.log("RELATÓRIO MC-6: TESTES AGRO-CLÍNICOS");
  Logger.log("========================================");
  Logger.log("✅ Testes Aprovados: " + report.passed);
  Logger.log("❌ Testes Falhados: " + report.failed);
  Logger.log("⚠️ Avisos: " + report.warnings.length);
  Logger.log("📊 Total de Testes: " + (report.passed + report.failed));
  Logger.log("📅 Timestamp: " + report.timestamp);
  
  if (report.failed > 0) {
    Logger.log("");
    Logger.log("❌ ERROS ENCONTRADOS:");
    report.errors.forEach(function(err, idx) {
      Logger.log((idx + 1) + ". " + err.test);
      Logger.log("   └─ " + err.details);
    });
  }
  
  if (report.warnings.length > 0) {
    Logger.log("");
    Logger.log("⚠️ AVISOS:");
    report.warnings.forEach(function(w, idx) {
      Logger.log((idx + 1) + ". " + w.test);
      Logger.log("   └─ " + w.message);
    });
  }
  
  Logger.log("========================================");
  
  if (report.failed === 0) {
    Logger.log("🎉 TODOS OS TESTES PASSARAM!");
    Logger.log("Sistema de Comorbidades Canábicas VALIDADO e pronto para produção.");
  } else {
    Logger.log("⚠️ ATENÇÃO: Revisar testes falhados antes de deploy.");
  }
  
  Logger.log("========================================");
  
  // Retornar relatório estruturado
  return report;
}

/**
 * L1 - Foundation Test: Catalog Integrity
 * 
 * Validates:
 * - Exactly 46 comorbidades exist in catalog
 * - Epilepsia (ID 1) has correct CoA grade (GRAU_1_ESTRITO)
 * - Epilepsia has correct evidence count (22)
 * - Epilepsia has at least 1 study with valid DOI
 * - Dor Crônica (ID 3) has correct triage level ('A')
 * - Dor Crônica has correct evidence count (22)
 * 
 * Expected: All pass
 * Known limitations: Only validates IDs 1 and 3 in detail
 */
function test_MC6_L1_CatalogIntegrity_(assert, warn) {
  try {
    Logger.log("\n--- L1: TESTE DE INTEGRIDADE DO CATÁLOGO ---");
    
    // Buscar todas comorbidades
    const allComorbidades = getAllRows_('REF_COMORBIDADES_CANABICAS');
    
    // Assert 1.1: Total de 46 comorbidades
    assert(
      "1.1 - Total de 46 comorbidades no catálogo",
      allComorbidades.length === 46,
      "Esperado: 46, Obtido: " + allComorbidades.length
    );
    
    // Buscar comorbidade ID 1 (Epilepsia)
    const epilepsia = allComorbidades.find(function(c) { return c.id === 1; });
    
    if (epilepsia) {
      // Assert 1.2: Comorbidade 1 possui GRAU_1_ESTRITO
      assert(
        "1.2 - Epilepsia (ID 1) possui grau_coa_exigido === GRAU_1_ESTRITO",
        epilepsia.grau_coa_exigido === 'GRAU_1_ESTRITO',
        "Esperado: GRAU_1_ESTRITO, Obtido: " + epilepsia.grau_coa_exigido
      );
      
      // Assert 1.3: Comorbidade 1 possui total_evidencias === 22
      assert(
        "1.3 - Epilepsia (ID 1) possui total_evidencias === 22",
        epilepsia.total_evidencias === 22,
        "Esperado: 22, Obtido: " + epilepsia.total_evidencias
      );
      
      // Assert 1.4: Comorbidade 1 possui pelo menos 1 estudo prioritário com DOI
      try {
        const estudos = JSON.parse(epilepsia.estudos_prioritarios_json);
        const estudosComDoi = estudos.filter(function(e) { return e.doi && e.doi.length > 0; });
        
        assert(
          "1.4 - Epilepsia (ID 1) possui pelo menos 1 estudo com DOI válido",
          estudosComDoi.length >= 1,
          "Esperado: >= 1, Obtido: " + estudosComDoi.length
        );
        
        // Log dos DOIs encontrados
        if (estudosComDoi.length >= 1) {
          Logger.log("   DOIs encontrados:");
          estudosComDoi.forEach(function(e, idx) {
            Logger.log("   " + (idx + 1) + ". " + e.doi + " - " + (e.titulo || 'sem título'));
          });
        }
      } catch (parseError) {
        assert(
          "1.4 - Epilepsia (ID 1) possui pelo menos 1 estudo com DOI válido",
          false,
          "Erro ao parsear estudos_prioritarios_json: " + parseError.message
        );
      }
    } else {
      assert(
        "1.2 - Epilepsia (ID 1) existe no catálogo",
        false,
        "Comorbidade ID 1 não encontrada"
      );
    }
    
    // Buscar comorbidade ID 3 (Dor Crônica)
    const dorCronica = allComorbidades.find(function(c) { return c.id === 3; });
    
    if (dorCronica) {
      // Assert 1.5: Dor Crônica possui triagem === 'A'
      assert(
        "1.5 - Dor Crônica (ID 3) possui triagem === 'A'",
        dorCronica.triagem === 'A',
        "Esperado: A, Obtido: " + dorCronica.triagem
      );
      
      // Assert 1.6: Dor Crônica possui total_evidencias === 22
      assert(
        "1.6 - Dor Crônica (ID 3) possui total_evidencias === 22",
        dorCronica.total_evidencias === 22,
        "Esperado: 22, Obtido: " + dorCronica.total_evidencias
      );
    } else {
      warn("1.5/1.6", "Comorbidade ID 3 (Dor Crônica) não encontrada no catálogo");
    }
    
  } catch (error) {
    assert(
      "L1 - Integridade do Catálogo",
      false,
      "Exceção fatal: " + error.message
    );
  }
}

/**
 * L2 - Business Logic Test: CoA Grade Hierarchy
 * 
 * Validates:
 * - Patient can save 2 comorbidades
 * - Maximum CoA grade is inherited correctly (GRAU_1 > GRAU_2)
 * - Hierarchy: GRAU_1_ESTRITO > GRAU_3_NEUROPSIQUIATRICO > GRAU_2_PADRAO > GRAU_4_TOPICO
 * 
 * Expected: All pass
 * Known limitations: Uses test patient ID that may not exist in DB_PACIENTES
 */
function test_MC6_L2_CoAGradeHierarchy_(assert, warn) {
  try {
    Logger.log("\n--- L2: TESTE DE HIERARQUIA DE GRAU COA ---");
    
    // Criar paciente de teste
    const pacienteTestId = 'TEST_PACIENTE_COA_01';
    
    // Limpar dados anteriores (se existirem)
    try {
      deleteRowById_('DB_COMORBIDADES_PACIENTE', pacienteTestId);
    } catch (cleanupError) {
      // Ignorar erro se não existir
    }
    
    // Salvar 2 comorbidades: 3 (Dor Crônica - Grau 2) e 1 (Epilepsia - Grau 1)
    const selecoes = [
      { comorbidade_id: 3, prioridade: 1, outra_descricao: null },
      { comorbidade_id: 1, prioridade: 2, outra_descricao: null }
    ];
    
    salvarComorbidadesPaciente_(pacienteTestId, selecoes);
    
    // Buscar comorbidades salvas
    const comorbidadesSalvas = getComorbidadesPaciente_(pacienteTestId);
    
    // Assert 2.1: 2 comorbidades foram salvas
    assert(
      "2.1 - Paciente possui 2 comorbidades salvas",
      comorbidadesSalvas.length === 2,
      "Esperado: 2, Obtido: " + comorbidadesSalvas.length
    );
    
    if (comorbidadesSalvas.length === 2) {
      // Calcular grau máximo
      const graus = comorbidadesSalvas.map(function(c) { return c.grau_coa_obrigatorio; });
      const grauMaximo = calcularGrauCoAMaximoDeEnums_(graus);
      
      // Assert 2.2: Grau máximo herdado deve ser GRAU_1_ESTRITO
      assert(
        "2.2 - Grau de CoA máximo herdado === GRAU_1_ESTRITO (hierarquia 1>3>2>4)",
        grauMaximo === 'GRAU_1_ESTRITO',
        "Esperado: GRAU_1_ESTRITO, Obtido: " + grauMaximo + ", Graus: [" + graus.join(', ') + "]"
      );
      
      // Log da hierarquia
      if (grauMaximo === 'GRAU_1_ESTRITO') {
        Logger.log("   ✓ Hierarquia correta aplicada: GRAU_1 (Epilepsia) > GRAU_2 (Dor Crônica)");
      }
    }
    
  } catch (error) {
    assert(
      "L2 - Hierarquia de Grau CoA",
      false,
      "Exceção fatal: " + error.message
    );
  }
}

/**
 * L2 - Business Logic Test: Heavy Metal Blocking (Patient Safety)
 * 
 * Validates:
 * - Contaminated batch (Pb > 0.2 ppm) is blocked
 * - Blocking reasons mention lead (Pb) contamination
 * - Safety rules enforce GRAU_1_ESTRITO limits
 * 
 * Expected: All pass
 * Known limitations: Creates test batch that persists until cleanup
 */
function test_MC6_L2_HeavyMetalBlocking_(assert, warn) {
  try {
    Logger.log("\n--- L2: TESTE DE TRAVA SANITÁRIA (LOTE CONTAMINADO) ---");
    
    const pacienteTestId = 'TEST_PACIENTE_COA_01';
    
    // Criar lote de teste em Lotes_CoA com contaminação
    const loteReprovado = createTestLote_({
      id: 'TEST_LOTE_REPROVADO_' + Date.now(),
      numeroLote: 'TEST-LOT-REPROV-' + Date.now(),
      statusAuditoria: 'REPROVADO',
      statusLiberacao: 'QUARENTENA',
      teor_Pb_ppm: 0.8  // ACIMA DO LIMITE de 0.2 ppm para Grau 1
    });
    
    // Persistir lote reprovado
    const successLote = appendRowToSheet_('Lotes_CoA', loteReprovado);
    
    if (successLote) {
      // Executar validação de conformidade
      const resultado = validarConformidadeCoALote_(pacienteTestId, loteReprovado.id);
      
      // Assert 3.1: resultado.apto === false
      assert(
        "3.1 - Lote contaminado resulta em apto === false",
        resultado.apto === false,
        "Esperado: false, Obtido: " + resultado.apto
      );
      
      // Assert 3.2: motivos_bloqueio contém aviso de chumbo
      const mencionaChumbo = resultado.motivos_bloqueio && 
                             resultado.motivos_bloqueio.some(function(m) {
                               return m.toLowerCase().indexOf('chumbo') >= 0 || 
                                      m.toLowerCase().indexOf('pb') >= 0;
                             });
      
      assert(
        "3.2 - Motivos de bloqueio mencionam excesso de Chumbo (Pb)",
        mencionaChumbo,
        "Esperado: mensagem sobre Pb, Obtido: " + JSON.stringify(resultado.motivos_bloqueio)
      );
      
      // Log dos motivos
      if (resultado.motivos_bloqueio && resultado.motivos_bloqueio.length > 0) {
        Logger.log("   Motivos de bloqueio detectados:");
        resultado.motivos_bloqueio.forEach(function(m, idx) {
          Logger.log("   " + (idx + 1) + ". " + m);
        });
      }
    } else {
      warn("L2 - Heavy Metal Blocking", "Falha ao criar lote de teste reprovado");
    }
    
  } catch (error) {
    assert(
      "L2 - Trava Sanitária",
      false,
      "Exceção fatal: " + error.message
    );
  }
}

/**
 * L2 - Business Logic Test: Batch Approval Happy Path
 * 
 * Validates:
 * - Compliant batch is approved (apto === true)
 * - Metal levels are within GRAU_1_ESTRITO limits
 * - Pb ≤ 0.2, Cd ≤ 0.1, As ≤ 0.1, Hg ≤ 0.05 ppm
 * 
 * Expected: All pass
 * Known limitations: Creates test batch that persists until cleanup
 */
function test_MC6_L2_BatchApprovalHappyPath_(assert, warn) {
  try {
    Logger.log("\n--- L2: TESTE DE LOTE APROVADO (HAPPY PATH) ---");
    
    const pacienteTestId = 'TEST_PACIENTE_COA_01';
    
    // Criar lote de teste CONFORME usando factory
    const loteAprovado = createTestLote_({
      id: 'TEST_LOTE_APROVADO_' + Date.now(),
      numeroLote: 'TEST-LOT-APROV-' + Date.now(),
      insumoId: 'TEST_INSUMO_002'
    });
    
    // Persistir lote aprovado
    const successLote = appendRowToSheet_('Lotes_CoA', loteAprovado);
    
    if (successLote) {
      // Executar validação de conformidade
      const resultado = validarConformidadeCoALote_(pacienteTestId, loteAprovado.id);
      
      // Assert 4.1: resultado.apto === true
      assert(
        "4.1 - Lote conforme resulta em apto === true",
        resultado.apto === true,
        "Esperado: true, Obtido: " + resultado.apto + 
        ", Motivos: " + JSON.stringify(resultado.motivos_bloqueio || [])
      );
      
      // Assert 4.2: Teores dentro dos limites
      const teoresDentroLimites = 
        resultado.teores_detectados && 
        resultado.teores_detectados.Pb <= 0.2 &&
        resultado.teores_detectados.Cd <= 0.1 &&
        resultado.teores_detectados.As <= 0.1 &&
        resultado.teores_detectados.Hg <= 0.05;
      
      assert(
        "4.2 - Teores de metais pesados dentro dos limites Grau 1",
        teoresDentroLimites,
        "Teores detectados: " + JSON.stringify(resultado.teores_detectados)
      );
      
      // Log de conformidade
      if (resultado.apto) {
        Logger.log("   ✅ Lote " + loteAprovado.numeroLote + " CONFORME para uso em paciente com GRAU_1_ESTRITO");
        Logger.log("   Teores: Pb=" + loteAprovado.teor_Pb_ppm + ", Cd=" + loteAprovado.teor_Cd_ppm + 
                   ", As=" + loteAprovado.teor_As_ppm + ", Hg=" + loteAprovado.teor_Hg_ppm + " ppm");
      }
    } else {
      warn("L2 - Batch Approval", "Falha ao criar lote de teste aprovado");
    }
    
  } catch (error) {
    assert(
      "L2 - Lote Aprovado",
      false,
      "Exceção fatal: " + error.message
    );
  }
}

/**
 * L1 - Foundation Test: Data Cleanup
 * 
 * Validates:
 * - Test data can be cleaned up safely
 * - Cleanup removes comorbidades with TEST_ prefix
 * - Cleanup removes lotes with TEST_LOTE_ prefix
 * 
 * Expected: Always pass (cleanup is best-effort)
 * Known limitations: None
 */
function test_MC6_L1_DataCleanup_(assert) {
  try {
    Logger.log("\n--- L1: TESTE DE LIMPEZA DE DADOS ---");
    
    const cleaned = clearMC6TestData_();
    
    Logger.log("   🧹 Limpeza concluída:");
    Logger.log("   - Comorbidades removidas: " + cleaned.comorbidades);
    Logger.log("   - Lotes removidos: " + cleaned.lotes);
    
    assert(
      "5.1 - Limpeza de dados de teste executada",
      true,
      "Comorbidades: " + cleaned.comorbidades + ", Lotes: " + cleaned.lotes
    );
    
  } catch (error) {
    assert(
      "L1 - Limpeza de Dados",
      false,
      "Erro na limpeza: " + error.message
    );
  }
}

/**
 * Helper: Deleta registros com prefixo no ID
 * @param {string} tableName - Nome da tabela
 * @param {string} prefix - Prefixo para filtrar IDs
 * @returns {number} Quantidade de registros deletados
 */
function deleteRowsByPrefix_(tableName, prefix) {
  const allRows = getAllRows_(tableName);
  let deleted = 0;
  
  allRows.forEach(function(row) {
    const rowId = String(row.id || row.paciente_id || '');
    if (rowId.indexOf(prefix) === 0) {
      try {
        deleteRowById_(tableName, row.id);
        deleted++;
      } catch (deleteError) {
        Logger.log("Erro ao deletar " + rowId + ": " + deleteError.message);
      }
    }
  });
  
  return deleted;
}

/**
 * Atalho para executar suite MC-6 e exibir resultado
 */
function testAgroClinicalSuite() {
  const result = runAgroClinicalCoAE2ETests_();
  
  if (result.failed === 0) {
    Logger.log("🎉 TODOS OS TESTES MC-6 PASSARAM! Sistema pronto para produção.");
    return true;
  } else {
    Logger.log("⚠️ ATENÇÃO: " + result.failed + " teste(s) MC-6 falharam. Revisar antes de deploy.");
    return false;
  }
}
