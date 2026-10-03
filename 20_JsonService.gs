/**
 * COMPONENTE: 20_JsonService.gs
 * PAPEL: Conversão e sanitização JSON.
 *
 * PRINCIPAIS FUNCIONALIDADES:
 * - parse seguro, serialização de datas, remoção de campos internos e limites de payload;
 * - mantém o CRUD centralizado no Google Sheets identificado por SPREADSHEETS_ID;
 * - expõe apenas contratos pequenos para facilitar testes e futura substituição.
 *
 * INTEGRAÇÕES:
 * - WebApp, Response, ColabBridge;
 * - Bootstrap, Constants, Config, Response e os serviços explicitamente chamados pelo corpo.
 *
 * ENTIDADES/ABAS ENVOLVIDAS:
 * - Payloads JSON.
 *
 * SEGURANÇA E LIMITAÇÕES:
 * - senhas em texto plano são mantidas somente porque foram solicitadas para este protótipo;
 * - não registrar senha, token ou payload sensível em Logger.log, respostas ou exportações;
 * - aplicar autorização antes de toda escrita e registrar o evento em AuditLog;
 * - este arquivo é um esqueleto executável/documentado, não um laudo científico nem substituto de revisão humana.
 *
 * STATUS: ESQUELETO DE ARQUITETURA — preencher regras de negócio e testes antes de produção.
 */

/**
 * Serializa valor para JSON excluindo campos sensíveis
 * 
 * @description Remove automaticamente campos de senha, token e outros dados sensíveis
 * antes de serializar para JSON. Garante que informações confidenciais não sejam
 * expostas em logs, respostas ou exports.
 * 
 * @param {*} value - Valor a serializar
 * @param {string[]} additionalExclusions - Campos adicionais a excluir
 * 
 * @returns {string} JSON string sem campos sensíveis
 * 
 * @example
 * const user = { name: 'John', password: '123', email: 'john@example.com' };
 * const safe = safeJson_(user);
 * // Resultado: '{"name":"John","email":"john@example.com"}'
 */
function safeJson_(value, additionalExclusions) {
  const exclusions = ['password', 'token', 'refreshToken', 'apiKey', 'secret'];
  
  if (Array.isArray(additionalExclusions)) {
    exclusions.push.apply(exclusions, additionalExclusions);
  }
  
  return JSON.stringify(value, function(key, item) {
    return exclusions.indexOf(key) >= 0 ? undefined : item;
  });
}

/**
 * Parse seguro de JSON com tratamento de erros
 * 
 * @description Faz parse de string JSON com tratamento robusto de erros.
 * Retorna valor padrão em caso de falha ao invés de lançar exceção.
 * 
 * @param {string} text - String JSON a parsear
 * @param {*} defaultValue - Valor padrão se parse falhar
 * 
 * @returns {*} Objeto parseado ou valor padrão
 * 
 * @throws {Error} JSON_PARSE_ERROR se strictMode ativado e parse falhar
 * 
 * @example
 * const data = safeParse_('{"name":"John"}', {});
 * const invalid = safeParse_('invalid json', null); // Retorna null
 */
function safeParse_(text, defaultValue) {
  if (!text || typeof text !== 'string') {
    return defaultValue !== undefined ? defaultValue : null;
  }
  
  try {
    return JSON.parse(text);
  } catch (error) {
    logWarn_('JSON parse failed', { error: error.message, text: truncate_(text, 100) });
    return defaultValue !== undefined ? defaultValue : null;
  }
}

/**
 * Valida se string é JSON válido
 * 
 * @param {string} text - String a validar
 * @returns {boolean} true se JSON válido
 * 
 * @example
 * isValidJson_('{"name":"John"}'); // true
 * isValidJson_('invalid'); // false
 */
function isValidJson_(text) {
  if (!text || typeof text !== 'string') return false;
  
  try {
    JSON.parse(text);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Serializa JSON com pretty print
 * 
 * @param {*} value - Valor a serializar
 * @param {number} indent - Espaços de indentação (padrão: 2)
 * @returns {string} JSON formatado
 * 
 * @example
 * const obj = { name: 'John', age: 30 };
 * const pretty = prettyJson_(obj);
 * // Resultado com indentação e quebras de linha
 */
function prettyJson_(value, indent) {
  const spaces = indent || 2;
  return JSON.stringify(value, null, spaces);
}

/**
 * Remove campos undefined e null de objeto antes de serializar
 * 
 * @param {Object} obj - Objeto a limpar
 * @returns {string} JSON string sem null/undefined
 * 
 * @example
 * const obj = { name: 'John', age: null, city: undefined, email: 'john@example.com' };
 * const clean = cleanJson_(obj);
 * // Resultado: '{"name":"John","email":"john@example.com"}'
 */
function cleanJson_(obj) {
  return JSON.stringify(obj, function(key, value) {
    return value === null || value === undefined ? undefined : value;
  });
}

/**
 * Compara dois objetos JSON para igualdade
 * 
 * @param {*} obj1 - Primeiro objeto
 * @param {*} obj2 - Segundo objeto
 * @returns {boolean} true se objetos são iguais
 * 
 * @example
 * jsonEquals_({ a: 1 }, { a: 1 }); // true
 * jsonEquals_({ a: 1 }, { a: 2 }); // false
 */
function jsonEquals_(obj1, obj2) {
  try {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
  } catch (error) {
    return false;
  }
}

/**
 * Clona objeto via JSON (perde funções e símbolos)
 * 
 * @param {*} obj - Objeto a clonar
 * @returns {*} Clone profundo do objeto
 * 
 * @example
 * const original = { name: 'John', address: { city: 'NYC' } };
 * const copy = jsonClone_(original);
 * copy.address.city = 'LA'; // Não afeta original
 */
function jsonClone_(obj) {
  if (obj === null || obj === undefined) return obj;
  
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (error) {
    logError_('JSON clone failed', { error: error.message });
    return obj;
  }
}

/**
 * Valida tamanho de payload JSON
 * 
 * @param {*} value - Valor a validar
 * @param {number} maxSizeKB - Tamanho máximo em KB (padrão: 1024)
 * @returns {Object} Resultado da validação
 * @returns {boolean} return.valid - true se dentro do limite
 * @returns {number} return.sizeKB - Tamanho em KB
 * 
 * @example
 * const result = validateJsonSize_({ data: '...' }, 500);
 * if (!result.valid) {
 *   throw new Error('Payload muito grande: ' + result.sizeKB + 'KB');
 * }
 */
function validateJsonSize_(value, maxSizeKB) {
  const maxSize = maxSizeKB || 1024;
  const json = JSON.stringify(value);
  const sizeKB = Math.round(json.length / 1024);
  
  return {
    valid: sizeKB <= maxSize,
    sizeKB: sizeKB,
    maxSizeKB: maxSize
  };
}
