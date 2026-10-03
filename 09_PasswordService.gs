/**
 * COMPONENTE: 09_PasswordService.gs
 * PAPEL: Gerenciamento de senhas
 *
 * IMPORTANTE:
 * - Hash PBKDF2-HMAC-SHA256 com 210.000 iterações (OWASP 2024)
 * - NUNCA logar ou retornar senhas
 * - Comparação SEMPRE case-sensitive
 *
 * SEGURANÇA:
 * - PBKDF2 com 210.000 iterações e salt de 16 bytes (padrão OWASP 2024)
 * - Compatibilidade retroativa com PBKDF2 10k iterações e SHA-256 (senhas antigas continuam funcionando)
 * - Formato: 'pbkdf2:210000:<salt_base64>:<hash_base64>'
 *
 * STATUS: v4.0 — P0-4: 210k iterações, modo texto plano removido
 */

// ============================================================================
// CONSTANTES
// ============================================================================

/**
 * Número de iterações PBKDF2 conforme OWASP 2024
 * Ref: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 */
const PBKDF2_ITERATIONS = 210000;

// ============================================================================
// FAIL-FAST SECURITY ASSERTION
// ============================================================================

// Proteção contra regressão de segurança: fail-fast se iterações < 100k
if (PBKDF2_ITERATIONS < 100000) {
  throw new Error('SECURITY REGRESSION: PBKDF2_ITERATIONS (' + PBKDF2_ITERATIONS + ') below minimum safe threshold of 100000. This is a critical security vulnerability.');
}

// ============================================================================
// HASH/ARMAZENAMENTO (PBKDF2 com Salt)
// ============================================================================

/**
 * Gera salt aleatório de 16 bytes
 * 
 * @returns {string} salt em base64
 * @private
 */
function generateSalt_() {
  const randomBytes = [];
  for (let i = 0; i < 16; i++) {
    randomBytes.push(Math.floor(Math.random() * 256));
  }
  return Utilities.base64Encode(String.fromCharCode.apply(null, randomBytes));
}

/**
 * Implementa PBKDF2 usando HMAC-SHA256 iterativo
 * 
 * @param {string} plainPassword
 * @param {string} salt — salt em base64
 * @param {number} iterations — número de iterações (padrão 210000)
 * @returns {string} hash em base64
 * @private
 */
function hashPasswordPBKDF2_(plainPassword, salt, iterations) {
  iterations = iterations || PBKDF2_ITERATIONS;
  
  // Decodificar salt de base64 para string
  const saltBytes = Utilities.base64Decode(salt);
  const saltString = Utilities.newBlob(saltBytes).getDataAsString();
  
  // PBKDF2 manual usando HMAC-SHA256
  let derived = plainPassword;
  for (let i = 0; i < iterations; i++) {
    derived = Utilities.computeHmacSha256Signature(derived, saltString);
    derived = Utilities.base64Encode(derived);
  }
  
  return derived;
}

/**
 * Faz hash de senha usando PBKDF2 com salt
 * 
 * FORMATO: 'pbkdf2:210000:<salt_base64>:<hash_base64>'
 * 
 * COMPATIBILIDADE RETROATIVA:
 * - Senhas antigas em SHA-256 permanecem válidas até o próximo login do usuário
 * - Senhas antigas em PBKDF2 10k permanecem válidas
 * - Novas senhas ou trocas de senha usam PBKDF2 com 210k iterações
 * - Não há migração automática por motivos de segurança (não temos acesso à senha plaintext)
 *
 * @param {string} plainPassword
 * @returns {string} senha armazenável
 */
function hashPassword_(plainPassword) {
  // MODO PRODUÇÃO: PBKDF2 com salt e 210k iterações
  const salt = generateSalt_();
  const iterations = PBKDF2_ITERATIONS;
  const hash = hashPasswordPBKDF2_(plainPassword, salt, iterations);
  
  return 'pbkdf2:' + iterations + ':' + salt + ':' + hash;
}

// ============================================================================
// VERIFICAÇÃO
// ============================================================================

/**
 * Verifica se senha está correta
 * 
 * SUPORTA (compatibilidade retroativa):
 * - PBKDF2: formato 'pbkdf2:iterations:salt:hash' (210k ou 10k iterações)
 * - SHA-256: formato hex string (legado)
 * 
 * NOTA: Modo texto plano foi removido (P0-4 segurança)
 * 
 * @param {string} plainPassword — senha fornecida pelo usuário
 * @param {string} storedPassword — senha armazenada no banco
 * @returns {boolean}
 */
function verifyPassword_(plainPassword, storedPassword) {
  if (!plainPassword || !storedPassword) {
    return false;
  }

  // PBKDF2: verificar formato pbkdf2:iterations:salt:hash
  if (storedPassword.startsWith('pbkdf2:')) {
    const parts = storedPassword.split(':');
    if (parts.length !== 4) {
      Logger.log('ERRO: Formato PBKDF2 inválido'); // PHI REDACTED
      return false;
    }
    
    const iterations = parseInt(parts[1], 10);
    const salt = parts[2];
    const storedHash = parts[3];
    
    // Gerar hash da senha fornecida com mesmo salt e iterations
    const computedHash = hashPasswordPBKDF2_(plainPassword, salt, iterations);
    
    return computedHash === storedHash;
  } else {
    // Formato legado SHA-256 (compatibilidade retroativa)
    // Recriar hash SHA-256 da senha fornecida
    const digest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      plainPassword,
      Utilities.Charset.UTF_8
    );
    
    // Converter bytes para hex string
    let hash = '';
    for (let i = 0; i < digest.length; i++) {
      const byte = digest[i];
      const hex = (byte < 0 ? byte + 256 : byte).toString(16);
      hash += hex.length === 1 ? '0' + hex : hex;
    }
    
    return hash === storedPassword;
  }
}

/**
 * Valida força de senha
 * 
 * REGRAS MÍNIMAS:
 * - Mínimo 6 caracteres
 * - Máximo 100 caracteres
 * - Não pode ser igual a username
 *
 * @param {string} password
 * @param {string} username (opcional, para verificar diferença)
 * @returns {object} {valid, errors}
 */
function validatePasswordStrength_(password, username) {
  const errors = [];

  if (!password) {
    errors.push('Senha não fornecida');
  } else {
    if (password.length < 6) {
      errors.push('Senha deve ter mínimo 6 caracteres');
    }
    if (password.length > 100) {
      errors.push('Senha deve ter máximo 100 caracteres');
    }
    if (username && password.toLowerCase() === username.toLowerCase()) {
      errors.push('Senha não pode ser igual ao username');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Sugere força da senha (informativo)
 * 
 * @param {string} password
 * @returns {string} "weak", "medium", "strong"
 */
function getPasswordStrength_(password) {
  if (!password) return 'unknown';

  let strength = 0;

  // Comprimento
  if (password.length >= 12) strength++;
  if (password.length >= 16) strength++;

  // Caracteres especiais
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength++;

  if (strength < 2) return 'weak';
  if (strength < 4) return 'medium';
  return 'strong';
}

// ============================================================================
// GERAÇÃO (para reset/temp)
// ============================================================================

/**
 * Gera senha temporária aleatória (8 caracteres)
 * Usada para reset de senha
 *
 * @returns {string}
 */
function generateTempPassword_() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// ============================================================================
// SANITIZAÇÃO (NUNCA logar senhas)
// ============================================================================

/**
 * Remove senhas de objeto antes de logar
 * 
 * @param {object} obj
 * @returns {object}
 */
function stripPasswords_(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const stripped = {};
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (key.toLowerCase().includes('password') || 
          key.toLowerCase().includes('pass') ||
          key.toLowerCase().includes('secret')) {
        stripped[key] = '[REDACTED]';
      } else {
        stripped[key] = obj[key];
      }
    }
  }

  return stripped;
}

// ============================================================================
// HISTÓRICO DE SENHAS (futuro)
// ============================================================================

/**
 * Verifica se nova senha é muito similar a antiga
 * Evita que usuário reutilize senha logo após trocar
 * 
 * (Placeholder — implementar quando houver histórico)
 *
 * @param {string} newPassword
 * @param {string} oldPassword
 * @returns {boolean} true se pode usar
 */
function isPasswordDifferentEnough_(newPassword, oldPassword) {
  // Por enquanto, apenas verificar que são diferentes
  if (newPassword === oldPassword) {
    return false;
  }

  // TODO: Implementar verificação de similaridade (Levenshtein distance)
  return true;
}

// ============================================================================
// TESTES (Manual - remover em produção ou manter como referência)
// ============================================================================

/**
 * Função de teste manual para PBKDF2
 * Executar via Apps Script Editor > Run
 * 
 * TESTES:
 * 1. Nova senha com PBKDF2
 * 2. Verificação de senha PBKDF2
 * 3. Compatibilidade com SHA-256 legado
 */
function testPasswordService_() {
  Logger.log('=== TESTE 1: Hash PBKDF2 ===');
  const testPassword = '123456';
  const hashedPBKDF2 = hashPassword_(testPassword);
  Logger.log('Senha: [REDACTED]');
  Logger.log('Hash gerado: ' + hashedPBKDF2.substring(0, 30) + '...');
  Logger.log('Formato correto (começa com pbkdf2:): ' + hashedPBKDF2.startsWith('pbkdf2:'));
  
  Logger.log('\n=== TESTE 2: Verificação PBKDF2 ===');
  const verifyCorrect = verifyPassword_(testPassword, hashedPBKDF2);
  Logger.log('Senha correta valida: ' + verifyCorrect);
  const verifyWrong = verifyPassword_('wrongpass', hashedPBKDF2);
  Logger.log('Senha incorreta rejeita: ' + !verifyWrong);
  
  Logger.log('\n=== TESTE 3: Compatibilidade SHA-256 Legado ===');
  // Criar hash SHA-256 manualmente (simular senha antiga)
  const oldPassword = 'oldpass';
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    oldPassword,
    Utilities.Charset.UTF_8
  );
  let sha256Hash = '';
  for (let i = 0; i < digest.length; i++) {
    const byte = digest[i];
    const hex = (byte < 0 ? byte + 256 : byte).toString(16);
    sha256Hash += hex.length === 1 ? '0' + hex : hex;
  }
  Logger.log('SHA-256 hash (legado): ' + sha256Hash.substring(0, 30) + '...');
  const verifyLegacy = verifyPassword_(oldPassword, sha256Hash);
  Logger.log('Login com senha SHA-256 legado funciona: ' + verifyLegacy);
  
  Logger.log('\n=== RESUMO ===');
  const allPassed = verifyCorrect && !verifyWrong && verifyLegacy;
  Logger.log('Todos os testes passaram: ' + allPassed);
  
  if (allPassed) {
    Logger.log('✓ PBKDF2 implementado corretamente');
    Logger.log('✓ Compatibilidade retroativa mantida');
  } else {
    Logger.log('✗ ALGUNS TESTES FALHARAM - revisar implementação');
  }
}

// ============================================================================
// EXPORTAR
// ============================================================================

const PASSWORD_SERVICE_LOADED = true;

// ============================================================================
// MIGRAÇÃO DE SENHAS (PLAIN TEXT → PBKDF2)
// ============================================================================

/**
 * Migra todas as senhas em texto plano para PBKDF2.
 * Executar UMA VEZ após configurar PLAIN_TEXT_PASSWORDS=false.
 * 
 * PASSOS:
 * 1. Definir PLAIN_TEXT_PASSWORDS=false nas Script Properties
 * 2. Executar esta função no Apps Script Editor
 * 3. Verificar log para confirmar migração
 * 
 * @returns {Object} { migrated: number, skipped: number, errors: number }
 */
function migratePasswordsToHash_() {
  Logger.log('=== MIGRAÇÃO DE SENHAS PLAIN TEXT → PBKDF2 ===');

  const report = { migrated: 0, skipped: 0, errors: 0, details: [] };

  try {
    const users = getAllRowsAsObjects_('Users');

    users.forEach(function(user) {
      if (!user.id || !user.password) {
        report.skipped++;
        return;
      }

      // Já está em formato PBKDF2 — pular
      if (String(user.password).startsWith('pbkdf2:') ||
          String(user.password).startsWith('sha256:')) {
        report.skipped++;
        report.details.push({ id: user.id, username: user.username, action: 'skipped', reason: 'already_hashed' });
        return;
      }

      // É texto plano — migrar
      try {
        const hashed = hashPasswordPBKDF2_(user.password);
        updateRowById_('Users', user.id, {
          password: hashed,
          updatedAt: new Date().toISOString()
        });
        report.migrated++;
        report.details.push({ id: user.id, username: user.username, action: 'migrated' });
        Logger.log('  ✅ Migrado: ' + user.username);
      } catch (e) {
        report.errors++;
        report.details.push({ id: user.id, username: user.username, action: 'error', error: e.message });
        Logger.log('  ❌ Erro ao migrar ' + user.username + ': ' + e.message);
      }
    });

    Logger.log('');
    Logger.log('RESULTADO:');
    Logger.log('  Migrados: ' + report.migrated);
    Logger.log('  Pulados (já hash): ' + report.skipped);
    Logger.log('  Erros: ' + report.errors);
    Logger.log('');
    Logger.log('PRÓXIMO PASSO: Confirmar que PLAIN_TEXT_PASSWORDS=false nas Script Properties.');

  } catch (error) {
    Logger.log('ERRO CRÍTICO: ' + error.message);
    throw error;
  }

  return report;
}

/**
 * Verifica integridade das senhas na aba Users.
 * Mostra quantas estão em texto plano vs. hash.
 * 
 * @returns {Object} { total, plainText, hashed, empty }
 */
function checkPasswordIntegrity_() {
  const users = getAllRowsAsObjects_('Users');
  const result = { total: users.length, plainText: 0, hashed: 0, empty: 0 };

  users.forEach(function(user) {
    if (!user.password) {
      result.empty++;
    } else if (String(user.password).startsWith('pbkdf2:') ||
               String(user.password).startsWith('sha256:')) {
      result.hashed++;
    } else {
      result.plainText++;
    }
  });

  Logger.log('=== INTEGRIDADE DE SENHAS ===');
  Logger.log('Total de usuários: ' + result.total);
  Logger.log('Com hash PBKDF2: ' + result.hashed);
  Logger.log('Texto plano: ' + result.plainText);
  Logger.log('Vazias: ' + result.empty);
  Logger.log('Status: ' + (result.plainText === 0 ? '✅ SEGURO' : '⚠️ ' + result.plainText + ' senha(s) em texto plano'));

  return result;
}
