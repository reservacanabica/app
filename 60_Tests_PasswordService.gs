/**
 * COMPONENTE: 60_Tests_PasswordService.gs
 * PAPEL: Testes unitários para PasswordService (PBKDF2)
 *
 * RESPONSABILIDADE:
 * - Validar hashing PBKDF2 com salt
 * - Testar verificação de senha
 * - Garantir backward compatibility com SHA-256
 * - Validar força de senha
 *
 * STATUS: v1.0 — Implementado (Ampliação de Maturidade +0.1%)
 */

// ============================================================================
// SUITE DE TESTES
// ============================================================================

/**
 * Executa todos os testes do PasswordService
 * 
 * @returns {object} Resultado dos testes {passed, failed, total, details}
 */
function runPasswordServiceTests_() {
  const results = {
    passed: 0,
    failed: 0,
    total: 0,
    details: []
  };

  const tests = [
    testPBKDF2_hashing_,
    testPBKDF2_verification_,
    testSHA256_backwardCompatibility_,
    testPasswordStrength_weak_,
    testPasswordStrength_strong_,
    testHashFormat_,
    testSaltUniqueness_
  ];

  tests.forEach(function(testFn) {
    results.total++;
    try {
      testFn();
      results.passed++;
      results.details.push({
        test: testFn.name,
        status: 'PASSED',
        message: 'OK'
      });
    } catch (error) {
      results.failed++;
      results.details.push({
        test: testFn.name,
        status: 'FAILED',
        message: error.message
      });
    }
  });

  return results;
}

// ============================================================================
// TESTES INDIVIDUAIS
// ============================================================================

/**
 * Teste 1: PBKDF2 hash é gerado corretamente
 */
function testPBKDF2_hashing_() {
  const password = 'Test@Pass123';
  const hash = hashPassword_(password);

  // Verificar formato: pbkdf2:iterations:salt_base64:hash_base64
  if (!hash.startsWith('pbkdf2:')) {
    throw new Error('Hash não começa com prefixo pbkdf2:');
  }

  const parts = hash.split(':');
  if (parts.length !== 4) {
    throw new Error('Hash não tem 4 partes (formato inválido)');
  }

  if (parts[0] !== 'pbkdf2') {
    throw new Error('Algoritmo não é pbkdf2');
  }

  const iterations = parseInt(parts[1]);
  if (isNaN(iterations) || iterations < 10000) {
    throw new Error('Iterações insuficientes: ' + iterations);
  }

  if (!parts[2] || parts[2].length < 8) {
    throw new Error('Salt muito curto');
  }

  if (!parts[3] || parts[3].length < 16) {
    throw new Error('Hash muito curto');
  }
}

/**
 * Teste 2: Verificação de senha funciona
 */
function testPBKDF2_verification_() {
  const password = 'MySecurePass456!';
  const hash = hashPassword_(password);

  // Senha correta deve verificar
  if (!verifyPassword_(password, hash)) {
    throw new Error('Senha correta não verificou');
  }

  // Senha errada não deve verificar
  if (verifyPassword_('WrongPassword', hash)) {
    throw new Error('Senha errada verificou (falso positivo)');
  }
}

/**
 * Teste 3: Backward compatibility com SHA-256
 */
function testSHA256_backwardCompatibility_() {
  // Simular hash SHA-256 legado (sem prefixo pbkdf2:)
  const password = 'OldPassword123';
  const oldHash = Utilities.base64Encode(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      password
    )
  );

  // Deve verificar senha antiga
  if (!verifyPassword_(password, oldHash)) {
    throw new Error('Backward compatibility quebrada - senha SHA-256 não verificou');
  }

  // Senha errada não deve verificar mesmo com hash antigo
  if (verifyPassword_('WrongOldPassword', oldHash)) {
    throw new Error('Hash SHA-256 aceitou senha errada');
  }
}

/**
 * Teste 4: Senha fraca é detectada
 */
function testPasswordStrength_weak_() {
  const weakPasswords = ['123456', 'password', 'abc', 'test', '1111'];

  weakPasswords.forEach(function(pwd) {
    const check = checkPasswordStrength_(pwd);
    if (check.strong) {
      throw new Error('Senha fraca "' + pwd + '" foi considerada forte');
    }
  });
}

/**
 * Teste 5: Senha forte passa na validação
 */
function testPasswordStrength_strong_() {
  const strongPasswords = [
    'MyS3cur3P@ssw0rd!',
    'C0mpl3x&Pass#2024',
    'Str0ng!Passw0rd#123'
  ];

  strongPasswords.forEach(function(pwd) {
    const check = checkPasswordStrength_(pwd);
    if (!check.strong) {
      throw new Error('Senha forte "' + pwd + '" foi rejeitada. Motivos: ' + JSON.stringify(check.reasons));
    }
  });
}

/**
 * Teste 6: Formato do hash é consistente
 */
function testHashFormat_() {
  const password = 'FormatTest123!';
  const hash1 = hashPassword_(password);
  const hash2 = hashPassword_(password);

  // Dois hashes da mesma senha devem ser DIFERENTES (por causa do salt)
  if (hash1 === hash2) {
    throw new Error('Dois hashes iguais - salt não está sendo usado!');
  }

  // Mas ambos devem verificar a senha
  if (!verifyPassword_(password, hash1) || !verifyPassword_(password, hash2)) {
    throw new Error('Hashes gerados não verificam a senha original');
  }
}

/**
 * Teste 7: Salt é único por hash
 */
function testSaltUniqueness_() {
  const password = 'SaltTest123!';
  const hashes = [];

  // Gerar 10 hashes
  for (let i = 0; i < 10; i++) {
    hashes.push(hashPassword_(password));
  }

  // Extrair salts
  const salts = hashes.map(function(h) {
    return h.split(':')[2]; // posição do salt
  });

  // Verificar que todos são únicos
  const uniqueSalts = new Set(salts);
  if (uniqueSalts.size !== 10) {
    throw new Error('Salts não são únicos! Encontrados ' + uniqueSalts.size + ' únicos de 10');
  }
}

// ============================================================================
// TESTE MANUAL (pode ser chamado do Script Editor)
// ============================================================================

/**
 * Função helper para executar testes manualmente
 * Uso: No Script Editor, executar testPasswordService()
 */
function testPasswordService() {
  const results = runPasswordServiceTests_();

  Logger.log('═══════════════════════════════════════');
  Logger.log('PASSWORD SERVICE - RESULTADOS DOS TESTES');
  Logger.log('═══════════════════════════════════════');
  Logger.log('Total: ' + results.total);
  Logger.log('Passou: ' + results.passed);
  Logger.log('Falhou: ' + results.failed);
  Logger.log('───────────────────────────────────────');

  results.details.forEach(function(detail) {
    const status = detail.status === 'PASSED' ? '✓' : '✗';
    Logger.log(status + ' ' + detail.test + ': ' + detail.message);
  });

  Logger.log('═══════════════════════════════════════');

  if (results.failed > 0) {
    throw new Error(results.failed + ' testes falharam!');
  }

  Logger.log('✓ Todos os ' + results.passed + ' testes passaram!');
  return results;
}

// ============================================================================
// EXPORTAR
// ============================================================================

const PASSWORD_SERVICE_TESTS_LOADED = true;
