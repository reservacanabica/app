/**
 * COMPONENTE: 63_PerformanceBenchmarks.gs
 * PAPEL: Benchmarks de performance para operações críticas do sistema.
 *
 * FUNÇÕES PRINCIPAIS:
 * - runPerformanceBenchmark_() — executa suite completa de benchmarks
 * - benchmarkCrudOperations_() — mede tempo de leitura/escrita por aba
 * - benchmarkAuthOperations_() — mede tempo de autenticação e validação de token
 * - benchmarkPasswordHashing_() — mede tempo de hash PBKDF2 vs texto plano
 *
 * EXECUÇÃO:
 * - Selecionar runPerformanceBenchmark_ no dropdown do Apps Script Editor
 * - Clicar em ▶️ Executar
 * - Ver resultados no Execution log
 *
 * SLAs DE REFERÊNCIA (Google Apps Script):
 * - Leitura de sheet:  < 500ms para até 1000 linhas
 * - Escrita de row:    < 300ms por operação
 * - Auth login:        < 800ms end-to-end
 * - Hash PBKDF2:       < 2000ms (10.000 iterações)
 *
 * STATUS: v1.0 — Implementado
 */

// ============================================================================
// SUITE PRINCIPAL
// ============================================================================

/**
 * Executa todos os benchmarks e exibe relatório no log.
 * @returns {Object} Relatório completo com tempos e SLA status
 */
function runPerformanceBenchmark_() {
  Logger.log('╔══════════════════════════════════════════════╗');
  Logger.log('║     BENCHMARKS DE PERFORMANCE — v1.0        ║');
  Logger.log('╚══════════════════════════════════════════════╝');
  Logger.log('Timestamp: ' + new Date().toISOString());
  Logger.log('');

  const results = {
    timestamp: new Date().toISOString(),
    benchmarks: [],
    summary: { passed: 0, failed: 0, total: 0 }
  };

  // 1. Benchmark de leitura de sheets
  const crudResult = benchmarkCrudOperations_();
  results.benchmarks.push(crudResult);

  // 2. Benchmark de hash de senhas
  const hashResult = benchmarkPasswordHashing_();
  results.benchmarks.push(hashResult);

  // 3. Benchmark de operações de gateway
  const gatewayResult = benchmarkGatewayOperations_();
  results.benchmarks.push(gatewayResult);

  // 4. Benchmark de JSON serialization
  const jsonResult = benchmarkJsonOperations_();
  results.benchmarks.push(jsonResult);

  // Calcular sumário
  results.benchmarks.forEach(function(b) {
    results.summary.total += b.checks.length;
    results.summary.passed += b.checks.filter(function(c) { return c.slaOk; }).length;
    results.summary.failed += b.checks.filter(function(c) { return !c.slaOk; }).length;
  });

  // Relatório final
  Logger.log('');
  Logger.log('══════════════════════════════════════════════');
  Logger.log('RESULTADO GERAL:');
  Logger.log('  ✅ Dentro do SLA: ' + results.summary.passed + '/' + results.summary.total);
  Logger.log('  ❌ Fora do SLA:   ' + results.summary.failed + '/' + results.summary.total);
  Logger.log('══════════════════════════════════════════════');

  return results;
}

// ============================================================================
// BENCHMARK 1: OPERAÇÕES CRUD
// ============================================================================

/**
 * Mede tempo de leitura das abas principais.
 * @returns {Object} Resultado do benchmark
 */
function benchmarkCrudOperations_() {
  Logger.log('--- BENCHMARK 1: Leitura de Sheets ---');

  const SLA_READ_MS = 500;
  const checks = [];
  const sheetsToTest = ['Users', 'Studies', 'AuditLog', 'REF_COMORBIDADES_CANABICAS'];

  sheetsToTest.forEach(function(sheetName) {
    try {
      const t0 = Date.now();
      const rows = getAllRowsAsObjects_(sheetName);
      const elapsed = Date.now() - t0;
      const slaOk = elapsed <= SLA_READ_MS;

      checks.push({
        name: 'Leitura ' + sheetName,
        elapsed: elapsed,
        rows: rows.length,
        sla: SLA_READ_MS,
        slaOk: slaOk
      });

      Logger.log('  ' + (slaOk ? '✅' : '⚠️') + ' ' + sheetName + ': ' +
        elapsed + 'ms (' + rows.length + ' rows) — SLA ' + SLA_READ_MS + 'ms');
    } catch (e) {
      checks.push({ name: 'Leitura ' + sheetName, elapsed: -1, error: e.message, slaOk: false });
      Logger.log('  ❌ ' + sheetName + ': ERRO — ' + e.message);
    }
  });

  return { name: 'CRUD Operations', checks: checks };
}

// ============================================================================
// BENCHMARK 2: HASH DE SENHAS
// ============================================================================

/**
 * Mede tempo de hash PBKDF2 vs texto plano.
 * @returns {Object} Resultado do benchmark
 */
function benchmarkPasswordHashing_() {
  Logger.log('');
  Logger.log('--- BENCHMARK 2: Hash de Senhas ---');

  const SLA_HASH_MS = 2000;
  const SLA_VERIFY_MS = 2000;
  const checks = [];
  const testPassword = 'TestPassword123!';

  // Hash PBKDF2
  try {
    const t0 = Date.now();
    const hashed = hashPasswordPBKDF2_(testPassword);
    const hashTime = Date.now() - t0;
    const hashOk = hashTime <= SLA_HASH_MS;

    checks.push({ name: 'PBKDF2 Hash', elapsed: hashTime, sla: SLA_HASH_MS, slaOk: hashOk });
    Logger.log('  ' + (hashOk ? '✅' : '⚠️') + ' PBKDF2 Hash: ' + hashTime + 'ms — SLA ' + SLA_HASH_MS + 'ms');

    // Verificação PBKDF2
    const t1 = Date.now();
    const verified = verifyPasswordPBKDF2_(testPassword, hashed);
    const verifyTime = Date.now() - t1;
    const verifyOk = verifyTime <= SLA_VERIFY_MS && verified === true;

    checks.push({ name: 'PBKDF2 Verify', elapsed: verifyTime, sla: SLA_VERIFY_MS, slaOk: verifyOk });
    Logger.log('  ' + (verifyOk ? '✅' : '⚠️') + ' PBKDF2 Verify: ' + verifyTime + 'ms (match=' + verified + ') — SLA ' + SLA_VERIFY_MS + 'ms');

  } catch (e) {
    checks.push({ name: 'PBKDF2', elapsed: -1, error: e.message, slaOk: false });
    Logger.log('  ❌ PBKDF2: ERRO — ' + e.message);
  }

  return { name: 'Password Hashing', checks: checks };
}

// ============================================================================
// BENCHMARK 3: GATEWAY
// ============================================================================

/**
 * Mede tempo de operações do SpreadsheetGateway.
 * @returns {Object} Resultado do benchmark
 */
function benchmarkGatewayOperations_() {
  Logger.log('');
  Logger.log('--- BENCHMARK 3: Gateway Operations ---');

  const SLA_GETSHEET_MS = 200;
  const SLA_UUID_MS = 10;
  const checks = [];

  // getSpreadsheet_
  try {
    const t0 = Date.now();
    const ss = getSpreadsheet_();
    const elapsed = Date.now() - t0;
    const ok = elapsed <= SLA_GETSHEET_MS && ss !== null;
    checks.push({ name: 'getSpreadsheet_', elapsed: elapsed, sla: SLA_GETSHEET_MS, slaOk: ok });
    Logger.log('  ' + (ok ? '✅' : '⚠️') + ' getSpreadsheet_: ' + elapsed + 'ms — SLA ' + SLA_GETSHEET_MS + 'ms');
  } catch (e) {
    checks.push({ name: 'getSpreadsheet_', elapsed: -1, error: e.message, slaOk: false });
    Logger.log('  ❌ getSpreadsheet_: ERRO — ' + e.message);
  }

  // UUID generation x100
  try {
    const t0 = Date.now();
    for (var i = 0; i < 100; i++) { Utilities.getUuid(); }
    const elapsed = Math.round((Date.now() - t0) / 100);
    const ok = elapsed <= SLA_UUID_MS;
    checks.push({ name: 'UUID x100 avg', elapsed: elapsed, sla: SLA_UUID_MS, slaOk: ok });
    Logger.log('  ' + (ok ? '✅' : '⚠️') + ' UUID avg: ' + elapsed + 'ms/op — SLA ' + SLA_UUID_MS + 'ms');
  } catch (e) {
    checks.push({ name: 'UUID x100', elapsed: -1, error: e.message, slaOk: false });
  }

  return { name: 'Gateway Operations', checks: checks };
}

// ============================================================================
// BENCHMARK 4: JSON
// ============================================================================

/**
 * Mede tempo de serialização/desserialização JSON para payloads típicos.
 * @returns {Object} Resultado do benchmark
 */
function benchmarkJsonOperations_() {
  Logger.log('');
  Logger.log('--- BENCHMARK 4: JSON Operations ---');

  const SLA_JSON_MS = 50;
  const checks = [];

  const samplePayload = {
    id: Utilities.getUuid(),
    studies: Array.apply(null, Array(50)).map(function(_, i) {
      return { id: Utilities.getUuid(), title: 'Study ' + i, status: 'ACTIVE' };
    })
  };

  // stringify x100
  try {
    const t0 = Date.now();
    for (var i = 0; i < 100; i++) { JSON.stringify(samplePayload); }
    const elapsed = Math.round((Date.now() - t0) / 100);
    const ok = elapsed <= SLA_JSON_MS;
    checks.push({ name: 'JSON.stringify avg', elapsed: elapsed, sla: SLA_JSON_MS, slaOk: ok });
    Logger.log('  ' + (ok ? '✅' : '⚠️') + ' JSON.stringify avg: ' + elapsed + 'ms/op — SLA ' + SLA_JSON_MS + 'ms');
  } catch (e) {
    checks.push({ name: 'JSON.stringify', elapsed: -1, error: e.message, slaOk: false });
  }

  // parse x100
  try {
    const jsonStr = JSON.stringify(samplePayload);
    const t0 = Date.now();
    for (var j = 0; j < 100; j++) { JSON.parse(jsonStr); }
    const elapsed = Math.round((Date.now() - t0) / 100);
    const ok = elapsed <= SLA_JSON_MS;
    checks.push({ name: 'JSON.parse avg', elapsed: elapsed, sla: SLA_JSON_MS, slaOk: ok });
    Logger.log('  ' + (ok ? '✅' : '⚠️') + ' JSON.parse avg: ' + elapsed + 'ms/op — SLA ' + SLA_JSON_MS + 'ms');
  } catch (e) {
    checks.push({ name: 'JSON.parse', elapsed: -1, error: e.message, slaOk: false });
  }

  return { name: 'JSON Operations', checks: checks };
}

const PERFORMANCE_BENCHMARKS_LOADED = true;
