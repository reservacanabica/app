/**
 * COMPONENTE: SecurityUtils.gs
 * PAPEL: Utilitários de segurança e criptografia
 *
 * RESPONSABILIDADE:
 * - Hashing de dados sensíveis (CPF) com HMAC-SHA256
 * - Mascaramento de dados para exibição
 * - Proteção de informações pessoais (LGPD)
 *
 * STATUS: v4.0 — P0-4: HMAC-SHA256 para CPF (não mais SHA-256 simples)
 */

// ============================================================================
// HASHING CRIPTOGRÁFICO
// ============================================================================

/**
 * Gera HMAC-SHA256 de CPF com chave secreta
 * 
 * IMPORTANTE: O CPF nunca é armazenado em texto plano.
 * Apenas o HMAC é persistido no banco de dados.
 * 
 * SEGURANÇA (P0-4):
 * - Migrado de SHA-256 simples para HMAC-SHA256
 * - Chave HMAC armazenada em Script Properties (CPF_HMAC_KEY)
 * - NUNCA hardcodar a chave no código
 * 
 * @param {string} cpf - CPF em qualquer formato (com ou sem pontuação)
 * @returns {string} HMAC-SHA256 em base64
 */
function hashCpf_(cpf) {
  if (!cpf) {
    return '';
  }

  // Obter chave HMAC da configuração (obrigatório)
  const props = PropertiesService.getScriptProperties();
  const hmacKey = props.getProperty('CPF_HMAC_KEY');
  
  if (!hmacKey) {
    throw new Error('CONFIGURAÇÃO CRÍTICA AUSENTE: CPF_HMAC_KEY não definida nas Script Properties. Configure antes de usar o sistema.');
  }

  // Limpar CPF (apenas dígitos)
  const cleanCpf = String(cpf).replace(/\D/g, '');

  // Validar formato básico
  if (cleanCpf.length !== 11) {
    throw new Error('CPF inválido: deve conter 11 dígitos');
  }

  // Gerar HMAC-SHA256
  const hmacBytes = Utilities.computeHmacSha256Signature(cleanCpf, hmacKey);
  const hmacBase64 = Utilities.base64Encode(hmacBytes);

  return hmacBase64;
}

/**
 * Mascara CPF para exibição segura
 * 
 * Formato de saída: XXX.***.***-XX
 * Mostra apenas primeiro e últimos 2 dígitos
 * 
 * @param {string} cpf - CPF em qualquer formato
 * @returns {string} CPF mascarado
 */
function mascararCpf_(cpf) {
  if (!cpf) {
    return '***.***.***-**';
  }

  // Limpar CPF (apenas dígitos)
  const digits = String(cpf).replace(/\D/g, '');

  // Validar formato básico
  if (digits.length !== 11) {
    return '***.***.***-**';
  }

  // Formato: XXX.***.***-XX
  const masked = digits.substring(0, 3) + '.***.***-' + digits.substring(9, 11);
  return masked;
}

// ============================================================================
// VALIDAÇÃO DE CPF
// ============================================================================

/**
 * Valida dígitos verificadores de CPF
 * 
 * @param {string} cpf - CPF em qualquer formato
 * @returns {boolean} true se CPF é válido
 */
function validarCpf_(cpf) {
  if (!cpf) {
    return false;
  }

  // Limpar CPF
  const cleanCpf = String(cpf).replace(/\D/g, '');

  // Validar comprimento
  if (cleanCpf.length !== 11) {
    return false;
  }

  // Rejeitar sequências conhecidas inválidas
  const invalidSequences = [
    '00000000000', '11111111111', '22222222222', '33333333333',
    '44444444444', '55555555555', '66666666666', '77777777777',
    '88888888888', '99999999999'
  ];

  if (invalidSequences.indexOf(cleanCpf) !== -1) {
    return false;
  }

  // Validar primeiro dígito verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (10 - i);
  }
  let digit1 = 11 - (sum % 11);
  if (digit1 >= 10) digit1 = 0;

  if (parseInt(cleanCpf.charAt(9)) !== digit1) {
    return false;
  }

  // Validar segundo dígito verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (11 - i);
  }
  let digit2 = 11 - (sum % 11);
  if (digit2 >= 10) digit2 = 0;

  if (parseInt(cleanCpf.charAt(10)) !== digit2) {
    return false;
  }

  return true;
}

// ============================================================================
// HASHING GENÉRICO
// ============================================================================

/**
 * Gera hash SHA-256 de string genérica
 * 
 * Usado para gerar hashes de validação de documentos,
 * assinaturas digitais, etc.
 * 
 * @param {string} data - Dados a serem hasheados
 * @returns {string} Hash hexadecimal SHA-256
 */
function hashSha256_(data) {
  if (!data) {
    return '';
  }

  const digestBytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(data),
    Utilities.Charset.UTF_8
  );

  const hashHex = digestBytes
    .map(function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    })
    .join('');

  return hashHex;
}

/**
 * Gera hash SHA-256 truncado (16 caracteres)
 * 
 * Usado para IDs de validação compactos
 * 
 * @param {string} data - Dados a serem hasheados
 * @returns {string} Hash hexadecimal truncado (16 chars)
 */
function hashSha256Short_(data) {
  const fullHash = hashSha256_(data);
  return fullHash.substring(0, 16).toUpperCase();
}

// ============================================================================
// MASCARAMENTO DE DADOS SENSÍVEIS
// ============================================================================

/**
 * Mascara email para exibição segura
 * 
 * Formato: us***@domain.com
 * 
 * @param {string} email - Email a ser mascarado
 * @returns {string} Email mascarado
 */
function mascararEmail_(email) {
  if (!email || typeof email !== 'string') {
    return '***@***.***';
  }

  const parts = email.split('@');
  if (parts.length !== 2) {
    return '***@***.***';
  }

  const localPart = parts[0];
  const domain = parts[1];

  // Mostrar apenas 2 primeiros caracteres do local
  const maskedLocal = localPart.length > 2
    ? localPart.substring(0, 2) + '***'
    : '***';

  return maskedLocal + '@' + domain;
}

/**
 * Mascara telefone para exibição segura
 * 
 * Formato: (XX) X****-XXXX
 * 
 * @param {string} telefone - Telefone a ser mascarado
 * @returns {string} Telefone mascarado
 */
function mascararTelefone_(telefone) {
  if (!telefone) {
    return '(XX) X****-XXXX';
  }

  // Limpar telefone (apenas dígitos)
  const digits = String(telefone).replace(/\D/g, '');

  // Celular (11 dígitos)
  if (digits.length === 11) {
    return '(' + digits.substring(0, 2) + ') ' + digits.charAt(2) + '****-' + digits.substring(7, 11);
  }

  // Fixo (10 dígitos)
  if (digits.length === 10) {
    return '(' + digits.substring(0, 2) + ') ****-' + digits.substring(6, 10);
  }

  return '(XX) X****-XXXX';
}

// ============================================================================
// SANITIZAÇÃO DE DADOS
// ============================================================================

/**
 * Remove caracteres não numéricos de string
 * 
 * @param {string} value - Valor a ser limpo
 * @returns {string} Apenas dígitos
 */
function apenasDigitos_(value) {
  if (!value) {
    return '';
  }
  return String(value).replace(/\D/g, '');
}

/**
 * Sanitiza string removendo caracteres perigosos
 * 
 * @param {string} value - Valor a ser sanitizado
 * @returns {string} String sanitizada
 */
function sanitizarString_(value) {
  if (!value) {
    return '';
  }

  return String(value)
    .replace(/[<>]/g, '') // Remove < e >
    .replace(/['"]/g, '')  // Remove aspas
    .trim();
}

// ============================================================================
// MIGRAÇÃO DE HASHES (SHA-256 LEGACY → HMAC-SHA256)
// ============================================================================

/**
 * Migra hashes CPF de SHA-256 simples para HMAC-SHA256
 * 
 * CONTEXTO: Antes do P0-4, CPFs eram hasheados com SHA-256 simples.
 * Esta função recalcula todos os hashes usando HMAC-SHA256 com chave secreta.
 * 
 * EXECUTAR UMA VEZ após configurar CPF_HMAC_KEY nas Script Properties.
 * 
 * AVISO: Esta função requer que CPFs originais estejam acessíveis.
 * Como CPFs não são armazenados em texto plano, apenas novos registros
 * usarão HMAC-SHA256. Registros antigos permanecem com SHA-256 legacy
 * até atualização manual do registro.
 * 
 * LIMITAÇÃO: Diferente de senhas (que são rehashadas no login), CPF não
 * tem trigger automático. Para migração completa, seria necessário:
 * 1. Exportar CPFs em texto plano de fonte externa (ex: sistema legado)
 * 2. Re-importar com novo hash HMAC-SHA256
 * 
 * Esta função documenta a necessidade; implementação completa requer
 * decisão sobre fonte de dados de CPF em texto plano.
 * 
 * @returns {Object} Relatório de migração
 */
function migrateCpfHashesToHmac_() {
  logWarn_('migrateCpfHashesToHmac_: Migração de CPF requer CPFs em texto plano', {
    razao: 'CPF não é armazenado em texto plano; apenas hash existe no banco',
    solucao: 'Novos registros usarão HMAC-SHA256 automaticamente',
    legado: 'Registros antigos permanecem com SHA-256 até atualização manual'
  });

  // Verificar que CPF_HMAC_KEY está configurada
  const props = PropertiesService.getScriptProperties();
  const hmacKey = props.getProperty('CPF_HMAC_KEY');
  
  if (!hmacKey) {
    throw new Error('CPF_HMAC_KEY não configurada. Configure antes de migrar.');
  }

  // Contadores
  const report = {
    timestamp: nowIso_(),
    hmacKeyConfigured: true,
    migracao: 'N/A',
    motivo: 'CPF não armazenado em texto plano; apenas novos registros usarão HMAC-SHA256',
    recomendacao: 'Se necessário migrar registros antigos, re-importar de fonte externa com hashCpf_()'
  };

  logInfo_('Relatório de migração CPF', report);
  
  return report;
}

// ============================================================================
// OBJETO PÚBLICO (API)
// ============================================================================

/**
 * API pública do SecurityUtils
 * Exporta apenas funções seguras sem underline
 */
const SecurityUtils = {
  // Hashing
  hashCpf: hashCpf_,
  hashSha256: hashSha256_,
  hashSha256Short: hashSha256Short_,

  // Validação
  validarCpf: validarCpf_,

  // Mascaramento
  mascararCpf: mascararCpf_,
  mascararEmail: mascararEmail_,
  mascararTelefone: mascararTelefone_,

  // Sanitização
  apenasDigitos: apenasDigitos_,
  sanitizarString: sanitizarString_
};

// ============================================================================
// EXPORTAR
// ============================================================================

const SECURITY_UTILS_LOADED = true;
