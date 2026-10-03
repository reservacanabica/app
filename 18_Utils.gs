/**
 * COMPONENTE: 18_Utils.gs
 * PAPEL: Utilitários globais - UUID, sanitização, formatação, escaping
 *
 * RESPONSABILIDADE:
 * - Geração UUID v4 (usado por todas as repositories)
 * - Escaping HTML para prevenir XSS
 * - Sanitização para logs (não salvar dados sensíveis)
 * - Helpers de formatação
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// GERAÇÃO DE UUID V4
// ============================================================================

/**
 * Gera UUID v4 (random-based)
 * Usa Google Apps Script Utilities.getUuid()
 *
 * @returns {string} UUID formatado: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
function generateUUID_() {
  return Utilities.getUuid();
}

/**
 * Valida se string é UUID v4 válido
 *
 * @param {string} value
 * @returns {boolean}
 */
function isValidUUID_(value) {
  if (!value || typeof value !== 'string') {
    return false;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

// ============================================================================
// ESCAPING PARA SEGURANÇA
// ============================================================================

/**
 * Escapa caracteres HTML para prevenir XSS
 * Usado em TODAS as respostas/templates
 *
 * @param {string} input
 * @returns {string} HTML-escaped
 */
function escapeHtml_(input) {
  if (!input) return '';

  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Escapa para atributo HTML
 *
 * @param {string} input
 * @returns {string}
 */
function escapeAttribute_(input) {
  if (!input) return '';
  return escapeHtml_(input);
}

/**
 * Escapa para URL (simples)
 *
 * @param {string} input
 * @returns {string}
 */
function escapeUrl_(input) {
  if (!input) return '';
  return encodeURIComponent(String(input));
}

/**
 * Escapa para JSON string
 *
 * @param {string} input
 * @returns {string}
 */
function escapeJson_(input) {
  if (!input) return '';

  return String(input)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

// ============================================================================
// SANITIZAÇÃO PARA LOGS
// ============================================================================

/**
 * Remove/mascara dados sensíveis de um objeto para logging
 * Nunca loga: senha, token, dados sensíveis
 *
 * @param {object} obj
 * @returns {object} sanitizado
 */
function sanitizeForLog_(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = {};
  const sensitiveKeys = [
    'password',
    'token',
    'secret',
    'apiKey',
    'privateKey',
    'credentials',
    'ssn',
    'cardNumber',
    'cvv'
  ];

  Object.keys(obj).forEach(function(key) {
    if (sensitiveKeys.some(function(sensitive) {
      return key.toLowerCase().includes(sensitive.toLowerCase());
    })) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitized[key] = sanitizeForLog_(obj[key]);
    } else {
      sanitized[key] = obj[key];
    }
  });

  return sanitized;
}

// ============================================================================
// FORMATAÇÃO DE STRINGS
// ============================================================================

/**
 * Converte string para slug (URL-safe)
 * Exemplo: "My Title" → "my-title"
 *
 * @param {string} str
 * @returns {string}
 */
function toSlug_(str) {
  if (!str) return '';

  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Capitaliza primeira letra
 *
 * @param {string} str
 * @returns {string}
 */
function capitalize_(str) {
  if (!str) return '';
  return String(str).charAt(0).toUpperCase() + String(str).slice(1);
}

/**
 * Padding de string à esquerda
 *
 * @param {string} str
 * @param {number} length
 * @param {string} char (default '0')
 * @returns {string}
 */
function padLeft_(str, length, char) {
  char = char || '0';
  str = String(str);
  while (str.length < length) {
    str = char + str;
  }
  return str;
}

/**
 * Trunca string com ellipsis
 *
 * @param {string} str
 * @param {number} maxLength
 * @param {string} ellipsis (default '...')
 * @returns {string}
 */
function truncate_(str, maxLength, ellipsis) {
  ellipsis = ellipsis || '...';
  if (!str || str.length <= maxLength) {
    return str;
  }
  return str.substring(0, maxLength - ellipsis.length) + ellipsis;
}

// ============================================================================
// CONVERSÃO DE TIPOS
// ============================================================================

/**
 * Tenta converter para number; retorna null se inválido
 *
 * @param {*} value
 * @returns {number|null}
 */
function toNumber_(value) {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

/**
 * Tenta converter para boolean
 *
 * @param {*} value
 * @returns {boolean}
 */
function toBoolean_(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return !!value;
}

/**
 * Tenta converter para array
 *
 * @param {*} value
 * @returns {array}
 */
function toArray_(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    return value.split(',').map(function(v) { return v.trim(); });
  }
  return [value];
}

// ============================================================================
// HASH SIMPLES (para não-senha)
// ============================================================================

/**
 * Cria hash simples (não criptográfico) para verificação
 * NÃO usar para senhas — usar 09_PasswordService.gs
 *
 * @param {string} str
 * @returns {string}
 */
function simpleHash_(str) {
  if (!str) return '';

  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }

  return Math.abs(hash).toString(16);
}

// ============================================================================
// DEEP CLONE
// ============================================================================

/**
 * Clone profundo de objeto/array
 *
 * @param {*} obj
 * @returns {*}
 */
function deepClone_(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (obj instanceof Array) {
    const arrCopy = [];
    for (let i = 0; i < obj.length; i++) {
      arrCopy[i] = deepClone_(obj[i]);
    }
    return arrCopy;
  }

  if (obj instanceof Object) {
    const objCopy = {};
    for (let key in obj) {
      if (obj.hasOwnProperty(key)) {
        objCopy[key] = deepClone_(obj[key]);
      }
    }
    return objCopy;
  }
}

// ============================================================================
// VALIDAÇÕES RÁPIDAS
// ============================================================================

/**
 * Valida email básico
 *
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail_(email) {
  if (!email) return false;
  return String(email).includes('@');
}

/**
 * Valida que valor está em enum
 *
 * @param {*} value
 * @param {object} enumObj
 * @returns {boolean}
 */
function isInEnum_(value, enumObj) {
  return Object.values(enumObj).includes(value);
}

// ============================================================================
// MERGE DE OBJETOS
// ============================================================================

/**
 * Merge raso de dois objetos
 *
 * @param {object} base
 * @param {object} override
 * @returns {object}
 */
function merge_(base, override) {
  if (!base) base = {};
  if (!override) return base;

  const result = {};
  for (let key in base) {
    if (base.hasOwnProperty(key)) {
      result[key] = base[key];
    }
  }

  for (let key in override) {
    if (override.hasOwnProperty(key)) {
      result[key] = override[key];
    }
  }

  return result;
}

// ============================================================================
// EXPORTAR
// ============================================================================

const UTILS_LOADED = true;
