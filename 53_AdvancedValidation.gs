/**
 * COMPONENTE: 53_AdvancedValidation.gs
 * PAPEL: Validadores customizados e utilitários de validação avançada.
 *
 * PRINCIPAIS FUNCIONALIDADES:
 * - Validadores reutilizáveis para casos comuns (email, URL, datas, etc.)
 * - Validação de integridade científica (p-values, intervalos de confiança, etc.)
 * - Helpers para composição de schemas complexos
 * - Validação cross-field (dependências entre campos)
 *
 * INTEGRAÇÕES:
 * - ApiService (usado nos schemas de endpoints)
 * - ValidationService (validação de domínio)
 *
 * STATUS: PRODUÇÃO - Validadores avançados para qualidade de dados
 */

/**
 * Biblioteca de validadores customizados reutilizáveis.
 */
const VALIDATORS = Object.freeze({
  
  /**
   * Valida email no formato padrão.
   * @param {string} value - Email a validar
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  email: function(value) {
    if (!value) return null;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(value)) {
      return 'Email inválido';
    }
    return null;
  },
  
  /**
   * Valida URL no formato http(s).
   * @param {string} value - URL a validar
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  url: function(value) {
    if (!value) return null;
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return 'URL deve usar protocolo HTTP ou HTTPS';
      }
      return null;
    } catch (e) {
      return 'URL inválida';
    }
  },
  
  /**
   * Valida DOI no formato padrão.
   * @param {string} value - DOI a validar
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  doi: function(value) {
    if (!value) return null;
    const doiPattern = /^10\.\d{4,9}\/[-._;()/:a-zA-Z0-9]+$/;
    if (!doiPattern.test(value)) {
      return 'DOI inválido (formato: 10.xxxx/yyyy)';
    }
    return null;
  },
  
  /**
   * Valida data ISO 8601 e verifica se não é futura.
   * @param {string} value - Data a validar
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  pastDate: function(value) {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return 'Data inválida (use formato ISO 8601)';
    }
    if (date > new Date()) {
      return 'Data não pode ser futura';
    }
    return null;
  },
  
  /**
   * Valida data ISO 8601 e verifica se não é passada.
   * @param {string} value - Data a validar
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  futureDate: function(value) {
    if (!value) return null;
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      return 'Data inválida (use formato ISO 8601)';
    }
    if (date < new Date()) {
      return 'Data não pode ser passada';
    }
    return null;
  },
  
  /**
   * Valida UUID v4.
   * @param {string} value - UUID a validar
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  uuid: function(value) {
    if (!value) return null;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(value)) {
      return 'UUID inválido';
    }
    return null;
  },
  
  /**
   * Valida p-value (0 < p ≤ 1).
   * @param {number} value - P-value a validar
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  pValue: function(value) {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'number') {
      return 'P-value deve ser um número';
    }
    if (value <= 0 || value > 1) {
      return 'P-value deve estar entre 0 (exclusivo) e 1 (inclusivo)';
    }
    return null;
  },
  
  /**
   * Valida intervalo de confiança.
   * @param {Object} value - Objeto com lower e upper
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  confidenceInterval: function(value) {
    if (!value) return null;
    if (typeof value !== 'object') {
      return 'Intervalo de confiança deve ser um objeto';
    }
    if (typeof value.lower !== 'number' || typeof value.upper !== 'number') {
      return 'Intervalo deve ter propriedades lower e upper numéricas';
    }
    if (value.lower >= value.upper) {
      return 'Limite inferior deve ser menor que limite superior';
    }
    return null;
  },
  
  /**
   * Valida concentração química (positiva).
   * @param {number} value - Concentração a validar
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  concentration: function(value) {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'number') {
      return 'Concentração deve ser um número';
    }
    if (value < 0) {
      return 'Concentração não pode ser negativa';
    }
    return null;
  },
  
  /**
   * Valida JSON string.
   * @param {string} value - JSON a validar
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  json: function(value) {
    if (!value) return null;
    try {
      JSON.parse(value);
      return null;
    } catch (e) {
      return 'JSON inválido: ' + e.message;
    }
  },
  
  /**
   * Valida senha forte.
   * @param {string} value - Senha a validar
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  strongPassword: function(value) {
    if (!value) return null;
    const errors = [];
    if (value.length < 8) {
      errors.push('mínimo 8 caracteres');
    }
    if (!/[A-Z]/.test(value)) {
      errors.push('deve conter letra maiúscula');
    }
    if (!/[a-z]/.test(value)) {
      errors.push('deve conter letra minúscula');
    }
    if (!/[0-9]/.test(value)) {
      errors.push('deve conter número');
    }
    if (!/[^A-Za-z0-9]/.test(value)) {
      errors.push('deve conter caractere especial');
    }
    return errors.length > 0 ? 'Senha fraca: ' + errors.join(', ') : null;
  },
  
  /**
   * Valida telefone internacional.
   * @param {string} value - Telefone a validar
   * @returns {string|null} Mensagem de erro ou null se válido
   */
  phone: function(value) {
    if (!value) return null;
    const phonePattern = /^\+?[1-9]\d{1,14}$/;
    if (!phonePattern.test(value.replace(/[\s\-\(\)]/g, ''))) {
      return 'Telefone inválido (use formato internacional)';
    }
    return null;
  }
});

/**
 * Schemas pré-definidos para entidades científicas.
 */
const SCIENTIFIC_SCHEMAS = Object.freeze({
  
  /**
   * Schema para resultado estatístico.
   */
  statisticalResult: {
    mean: { type: 'number', required: true },
    sd: { type: 'number', required: true, min: 0 },
    n: { type: 'number', required: true, integer: true, min: 1 },
    pValue: { type: 'number', custom: VALIDATORS.pValue },
    confidenceInterval: {
      type: 'object',
      custom: VALIDATORS.confidenceInterval
    }
  },
  
  /**
   * Schema para concentração química.
   */
  chemicalConcentration: {
    value: { type: 'number', required: true, custom: VALIDATORS.concentration },
    unit: { 
      type: 'string', 
      required: true, 
      enum: ['mg/mL', 'μg/mL', 'ng/mL', 'ppm', 'ppb', '%', 'M', 'mM', 'μM'] 
    }
  },
  
  /**
   * Schema para referência bibliográfica.
   */
  citation: {
    authors: { 
      type: 'array', 
      required: true,
      minLength: 1,
      items: { type: 'string', maxLength: 200 }
    },
    title: { type: 'string', required: true, maxLength: 500 },
    year: { type: 'number', required: true, integer: true, min: 1900, max: 2100 },
    journal: { type: 'string', maxLength: 200 },
    volume: { type: 'string', maxLength: 50 },
    pages: { type: 'string', maxLength: 50 },
    doi: { type: 'string', custom: VALIDATORS.doi }
  },
  
  /**
   * Schema para condições ambientais.
   */
  environmentalConditions: {
    temperature: { 
      type: 'number', 
      min: -50, 
      max: 100,
      custom: function(value, data) {
        if (data.temperatureUnit === 'F' && (value < -58 || value > 212)) {
          return 'Temperatura em Fahrenheit fora do range (-58°F a 212°F)';
        }
        return null;
      }
    },
    temperatureUnit: { type: 'string', enum: ['C', 'F', 'K'], required: true },
    humidity: { type: 'number', min: 0, max: 100 },
    lightCycle: { type: 'string', maxLength: 50 },
    photoperiod: { 
      type: 'number', 
      min: 0, 
      max: 24,
      custom: function(value) {
        if (value && !Number.isInteger(value * 2)) {
          return 'Fotoperíodo deve ser múltiplo de 0.5 horas';
        }
        return null;
      }
    }
  }
});

/**
 * Valida integridade de dados cross-field.
 * 
 * @param {Object} data - Dados a validar
 * @param {Array<Function>} rules - Array de funções de validação
 * @returns {Array<string>} Array de erros (vazio se válido)
 * 
 * @example
 * const rules = [
 *   function(data) {
 *     if (data.startDate && data.endDate && data.startDate > data.endDate) {
 *       return 'Data inicial não pode ser posterior à data final';
 *     }
 *   },
 *   function(data) {
 *     if (data.treatment === 'control' && data.concentration > 0) {
 *       return 'Grupo controle não deve ter concentração';
 *     }
 *   }
 * ];
 * const errors = validateCrossField_(data, rules);
 */
function validateCrossField_(data, rules) {
  const errors = [];
  
  rules.forEach(function(rule) {
    try {
      const error = rule(data);
      if (error) {
        errors.push(error);
      }
    } catch (e) {
      errors.push('Erro na validação cross-field: ' + e.message);
    }
  });
  
  return errors;
}

/**
 * Cria validador de range com unidades.
 * 
 * @param {number} min - Valor mínimo
 * @param {number} max - Valor máximo
 * @param {string} unit - Unidade de medida
 * @returns {Function} Função validadora
 * 
 * @example
 * const validatepH = createRangeValidator_(0, 14, 'pH');
 * const error = validatepH(7.5); // null (válido)
 * const error2 = validatepH(15); // 'Valor fora do range (0-14 pH)'
 */
function createRangeValidator_(min, max, unit) {
  return function(value) {
    if (value === undefined || value === null) return null;
    if (typeof value !== 'number') {
      return 'Deve ser um número';
    }
    if (value < min || value > max) {
      return `Valor fora do range (${min}-${max} ${unit})`;
    }
    return null;
  };
}

/**
 * Cria validador de enum com mensagem customizada.
 * 
 * @param {Array} allowedValues - Valores permitidos
 * @param {string} fieldName - Nome do campo para mensagem
 * @returns {Function} Função validadora
 * 
 * @example
 * const validateRole = createEnumValidator_(['admin', 'user', 'guest'], 'role');
 * const error = validateRole('admin'); // null
 * const error2 = validateRole('superuser'); // 'role inválido. Valores permitidos: admin, user, guest'
 */
function createEnumValidator_(allowedValues, fieldName) {
  return function(value) {
    if (!value) return null;
    if (!allowedValues.includes(value)) {
      return `${fieldName} inválido. Valores permitidos: ${allowedValues.join(', ')}`;
    }
    return null;
  };
}

/**
 * Combina múltiplos validadores em um único.
 * 
 * @param {Array<Function>} validators - Array de funções validadoras
 * @returns {Function} Função validadora combinada
 * 
 * @example
 * const validateEmailStrong = combineValidators_([
 *   VALIDATORS.email,
 *   function(value) {
 *     if (value && !value.endsWith('@company.com')) {
 *       return 'Email deve ser do domínio @company.com';
 *     }
 *   }
 * ]);
 */
function combineValidators_(validators) {
  return function(value, data) {
    for (var i = 0; i < validators.length; i++) {
      const error = validators[i](value, data);
      if (error) return error;
    }
    return null;
  };
}

/**
 * Valida array de objetos contra schema.
 * 
 * @param {Array} items - Array de itens a validar
 * @param {Object} schema - Schema para cada item
 * @returns {Array<string>} Array de erros com índices
 * 
 * @example
 * const errors = validateArrayOfObjects_(
 *   [{name: 'A', value: 10}, {name: '', value: -5}],
 *   {name: {required: true}, value: {type: 'number', min: 0}}
 * );
 * // ['[1].name: Campo obrigatório', '[1].value: valor mínimo 0']
 */
function validateArrayOfObjects_(items, schema) {
  const errors = [];
  
  if (!Array.isArray(items)) {
    return ['Deve ser um array'];
  }
  
  items.forEach(function(item, index) {
    try {
      const itemSchema = {};
      const itemData = {};
      
      Object.keys(schema).forEach(function(key) {
        itemSchema[`[${index}].${key}`] = schema[key];
        itemData[`[${index}].${key}`] = item[key];
      });
      
      validateRequestSchema_(itemData, itemSchema);
    } catch (e) {
      if (e.details && e.details.fields) {
        errors.push(...e.details.fields);
      }
    }
  });
  
  return errors;
}
