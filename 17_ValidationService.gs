/**
 * COMPONENTE: 17_ValidationService.gs
 * PAPEL: Validação de entrada (schemas)
 *
 * RESPONSABILIDADE:
 * - Validar objetos contra schemas
 * - Retornar erros estruturados
 * - Suportar tipos: string, number, boolean, object, array, enum
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// VALIDAÇÃO DE TIPO
// ============================================================================

/**
 * Valida tipo de valor
 *
 * @param {*} value
 * @param {string} expectedType — "string", "number", "boolean", "object", "array", "date"
 * @returns {boolean}
 */
function isValidType_(value, expectedType) {
  if (value === null || value === undefined) {
    return false;
  }

  switch (expectedType) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && !isNaN(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    case 'date':
      return typeof value === 'string' && isValidIso_(value);
    default:
      return true;
  }
}

// ============================================================================
// VALIDAÇÃO DE CAMPO
// ============================================================================

/**
 * Valida um campo contra regras de validação
 * 
 * Verifica se um valor individual atende aos requisitos definidos nas regras,
 * incluindo tipo, obrigatoriedade, limites numéricos, comprimento de string,
 * padrões regex, enumerações e validações customizadas.
 *
 * @param {string} fieldName - Nome do campo sendo validado (para mensagens de erro)
 * @param {*} value - Valor a ser validado
 * @param {object} rules - Regras de validação: {type, required, min, max, minLength, maxLength, pattern, enum, custom}
 * @param {string} [rules.type] - Tipo esperado: "string", "number", "boolean", "object", "array", "date"
 * @param {boolean} [rules.required] - Se true, campo não pode ser null/undefined/empty
 * @param {number} [rules.min] - Valor mínimo para números
 * @param {number} [rules.max] - Valor máximo para números
 * @param {number} [rules.minLength] - Comprimento mínimo para strings
 * @param {number} [rules.maxLength] - Comprimento máximo para strings
 * @param {RegExp} [rules.pattern] - Padrão regex que a string deve corresponder
 * @param {Array} [rules.enum] - Array de valores permitidos
 * @param {Function} [rules.custom] - Função customizada (value) => errorMessage|null
 * @returns {object} Resultado da validação: {valid: boolean, error: string|null}
 * @example
 * validateField_('username', 'john', {type: 'string', required: true, minLength: 3})
 * // Returns: {valid: true, error: null}
 */
function validateField_(fieldName, value, rules) {
  if (!rules) {
    return { valid: true, error: null };
  }

  // Verificar obrigatório
  if (rules.required && (value === null || value === undefined || value === '')) {
    return {
      valid: false,
      error: fieldName + ' é obrigatório'
    };
  }

  // Se não obrigatório e vazio, retornar OK
  if (!rules.required && (value === null || value === undefined || value === '')) {
    return { valid: true, error: null };
  }

  // Verificar tipo
  if (rules.type && !isValidType_(value, rules.type)) {
    return {
      valid: false,
      error: fieldName + ' deve ser ' + rules.type + ', recebido ' + typeof value
    };
  }

  // Verificar string length
  if (rules.type === 'string' && value) {
    if (rules.minLength && value.length < rules.minLength) {
      return {
        valid: false,
        error: fieldName + ' deve ter mínimo ' + rules.minLength + ' caracteres'
      };
    }
    if (rules.maxLength && value.length > rules.maxLength) {
      return {
        valid: false,
        error: fieldName + ' deve ter máximo ' + rules.maxLength + ' caracteres'
      };
    }
  }

  // Verificar number range
  if (rules.type === 'number' && typeof value === 'number') {
    if (rules.min !== undefined && value < rules.min) {
      return {
        valid: false,
        error: fieldName + ' deve ser >= ' + rules.min
      };
    }
    if (rules.max !== undefined && value > rules.max) {
      return {
        valid: false,
        error: fieldName + ' deve ser <= ' + rules.max
      };
    }
  }

  // Verificar padrão (regex)
  if (rules.pattern && typeof value === 'string') {
    if (!rules.pattern.test(value)) {
      return {
        valid: false,
        error: fieldName + ' não corresponde ao padrão esperado'
      };
    }
  }

  // Verificar enum
  if (rules.enum && !rules.enum.includes(value)) {
    return {
      valid: false,
      error: fieldName + ' deve ser um de: ' + rules.enum.join(', ')
    };
  }

  // Verificar customizada
  if (rules.custom && typeof rules.custom === 'function') {
    const customError = rules.custom(value);
    if (customError) {
      return {
        valid: false,
        error: fieldName + ': ' + customError
      };
    }
  }

  return { valid: true, error: null };
}

// ============================================================================
// VALIDAÇÃO DE OBJETO (SCHEMA)
// ============================================================================

/**
 * Valida objeto completo contra um schema de validação
 * 
 * Aplica validateField_ a cada campo definido no schema e acumula todos os erros
 * encontrados. Retorna se o objeto é válido e um mapa de erros por campo.
 *
 * @param {object} obj - Objeto a ser validado
 * @param {object} schema - Schema de validação: {fieldName: {type, required, ...rules}, ...}
 * @returns {object} Resultado: {valid: boolean, errors: {fieldName: errorMessage, ...}}
 * @example
 * const schema = {username: {type: 'string', required: true}, age: {type: 'number', min: 0}};
 * validateObject_({username: 'john', age: 25}, schema)
 * // Returns: {valid: true, errors: {}}
 */
function validateObject_(obj, schema) {
  if (!obj || typeof obj !== 'object') {
    return {
      valid: false,
      errors: { _root: 'Objeto inválido' }
    };
  }

  const errors = {};

  Object.keys(schema).forEach(function(fieldName) {
    const rules = schema[fieldName];
    const value = obj[fieldName];

    const validation = validateField_(fieldName, value, rules);

    if (!validation.valid) {
      errors[fieldName] = validation.error;
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors: errors
  };
}

// ============================================================================
// SCHEMAS PREDEFINIDOS
// ============================================================================

/**
 * Schema para login
 */
function getLoginSchema_() {
  return {
    username: {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 50
    },
    password: {
      type: 'string',
      required: true,
      minLength: 6,
      maxLength: 100
    }
  };
}

/**
 * Schema para criação de usuário
 */
function getCreateUserSchema_() {
  return {
    username: {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 50,
      pattern: /^[a-zA-Z0-9_.-]+$/
    },
    password: {
      type: 'string',
      required: true,
      minLength: 6,
      maxLength: 100
    },
    displayName: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 100
    },
    role: {
      type: 'string',
      required: true,
      enum: Object.values(USER_ROLES)
    }
  };
}

/**
 * Schema para criação de estudo
 */
function getCreateStudySchema_() {
  return {
    title: {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 255
    },
    objective: {
      type: 'string',
      required: false,
      maxLength: 2000
    },
    hostSpecies: {
      type: 'string',
      required: true,
      maxLength: 255
    },
    fungalStrain: {
      type: 'string',
      required: true,
      maxLength: 255
    },
    cultivar: {
      type: 'string',
      required: false,
      maxLength: 255
    }
  };
}

/**
 * Schema para criação de experimento
 */
function getCreateExperimentSchema_() {
  return {
    studyId: {
      type: 'string',
      required: true,
      custom: function(value) {
        return getRowById_('Studies', value) ? null : 'Study não encontrado';
      }
    },
    design: {
      type: 'string',
      required: true,
      maxLength: 255
    },
    treatments: {
      type: 'string',
      required: false,
      maxLength: 1000
    },
    replicates: {
      type: 'number',
      required: true,
      min: 2,
      max: 1000
    },
    conditions: {
      type: 'string',
      required: false,
      maxLength: 2000
    }
  };
}

/**
 * Schema para criação de observação
 */
function getCreateObservationSchema_() {
  return {
    experimentId: {
      type: 'string',
      required: true,
      custom: function(value) {
        return getRowById_('Experiments', value) ? null : 'Experiment não encontrado';
      }
    },
    variable: {
      type: 'string',
      required: true,
      maxLength: 100
    },
    value: {
      type: 'string',
      required: true,
      maxLength: 500
    },
    unit: {
      type: 'string',
      required: true,
      maxLength: 50
    },
    groupName: {
      type: 'string',
      required: false,
      maxLength: 100
    },
    replicate: {
      type: 'number',
      required: true,
      min: 1
    },
    observedAt: {
      type: 'date',
      required: true,
      custom: function(value) {
        return isPastDate_(value) ? null : 'Data deve estar no passado';
      }
    },
    notes: {
      type: 'string',
      required: false,
      maxLength: 2000
    }
  };
}

// ============================================================================
// SCHEMAS PARA DOMÍNIO DE QUALIDADE DE INSUMOS (PROMPT 1)
// ============================================================================

/**
 * Schema para criação de insumo
 */
function getCreateInsumoSchema_() {
  return {
    nomeComercial: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 255
    },
    tipoSal: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 255
    },
    fabricante: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 255
    },
    paisOrigem: {
      type: 'string',
      required: false,
      maxLength: 100
    },
    registroMAPAEstabelecimento: {
      type: 'string',
      required: false,
      maxLength: 100
    },
    registroMAPAProduto: {
      type: 'string',
      required: false,
      maxLength: 100
    },
    agenteQuelante: {
      type: 'string',
      required: false,
      enum: Object.values(AGENTE_QUELANTE)
    },
    solubilidade_gL_20C: {
      type: 'number',
      required: false,
      min: 0
    },
    purezaPercentual: {
      type: 'number',
      required: false,
      min: 0,
      max: 100
    },
    driveFichaTecnicaURL: {
      type: 'string',
      required: false,
      maxLength: 1000
    },
    ativo: {
      type: 'string',
      required: false,
      enum: Object.values(INPUT_STATUS)
    }
  };
}

/**
 * Schema para criação de lote CoA
 */
function getCreateLoteCoASchema_() {
  return {
    insumoId: {
      type: 'string',
      required: true,
      custom: function(value) {
        return getRowById_('Insumos_Catalogo', value) ? null : 'Insumo não encontrado';
      }
    },
    numeroLote: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 100
    },
    dataFabricacao: {
      type: 'date',
      required: false
    },
    dataValidade: {
      type: 'date',
      required: false
    },
    laboratorioEmissor: {
      type: 'string',
      required: false,
      maxLength: 255
    },
    teor_Pb_ppm: {
      type: 'string',
      required: false,
      maxLength: 50
    },
    teor_Cd_ppm: {
      type: 'string',
      required: false,
      maxLength: 50
    },
    teor_As_ppm: {
      type: 'string',
      required: false,
      maxLength: 50
    },
    teor_Hg_ppm: {
      type: 'string',
      required: false,
      maxLength: 50
    },
    statusAuditoria: {
      type: 'string',
      required: false,
      enum: Object.values(COA_STATUS_AUDITORIA)
    },
    statusLiberacao: {
      type: 'string',
      required: false,
      enum: Object.values(COA_STATUS_LIBERACAO)
    },
    drivePdfCoAURL: {
      type: 'string',
      required: false,
      maxLength: 1000
    },
    auditorEmail: {
      type: 'string',
      required: false,
      maxLength: 255
    }
  };
}

/**
 * Schema para criação de receita de fertirrigação
 */
function getCreateReceitaFertirrigacaoSchema_() {
  return {
    nomeFase: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 100
    },
    alvo_P_ppm: {
      type: 'number',
      required: false,
      min: 0
    },
    alvo_N_NO3_ppm: {
      type: 'number',
      required: false,
      min: 0
    },
    alvo_N_NH4_ppm: {
      type: 'number',
      required: false,
      min: 0
    },
    alvo_K_ppm: {
      type: 'number',
      required: false,
      min: 0
    },
    alvo_Ca_ppm: {
      type: 'number',
      required: false,
      min: 0
    },
    alvo_Mg_ppm: {
      type: 'number',
      required: false,
      min: 0
    },
    alvo_Fe_ppm: {
      type: 'number',
      required: false,
      min: 0
    },
    quelatoExigido: {
      type: 'string',
      required: false,
      enum: Object.values(AGENTE_QUELANTE)
    },
    pH_SolucaoAlvo: {
      type: 'number',
      required: false,
      min: 0,
      max: 14
    },
    EC_Alvo_dS_m: {
      type: 'number',
      required: false,
      min: 0
    },
    ruleVersion: {
      type: 'string',
      required: false,
      maxLength: 50
    }
  };
}

/**
 * Schema para criação de protocolo biológico
 */
function getCreateProtocoloBiologicoSchema_() {
  return {
    nomeProtocolo: {
      type: 'string',
      required: true,
      minLength: 1,
      maxLength: 255
    },
    faseCultivo: {
      type: 'string',
      required: false,
      enum: Object.values(FASE_CULTIVO)
    },
    tipoAplicacao: {
      type: 'string',
      required: false,
      enum: Object.values(TIPO_APLICACAO)
    },
    ecMaximo_dS_m: {
      type: 'number',
      required: false,
      min: 0
    },
    pHMinimo: {
      type: 'number',
      required: false,
      min: 0,
      max: 14
    },
    pHMaximo: {
      type: 'number',
      required: false,
      min: 0,
      max: 14
    },
    incompatibilidades: {
      type: 'string',
      required: false,
      maxLength: 2000
    },
    observacoes: {
      type: 'string',
      required: false,
      maxLength: 2000
    },
    ativo: {
      type: 'string',
      required: false,
      enum: Object.values(INPUT_STATUS)
    }
  };
}

/**
 * Schema para criação de interação medicamentosa CYP450 (P0-3)
 * Valida campos obrigatórios e enums de severidade/evidência
 * 
 * @returns {Object} Schema de validação
 */
function getCreateInteracaoSchema_() {
  return {
    substancia_canabica: {
      type: 'string',
      required: true,
      minLength: 2,
      maxLength: 50
    },
    medicamento_classe: {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 100
    },
    medicamento_nome: {
      type: 'string',
      required: true,
      minLength: 3,
      maxLength: 100
    },
    mecanismo: {
      type: 'string',
      required: true,
      minLength: 10,
      maxLength: 500
    },
    severidade: {
      type: 'string',
      required: true,
      enum: Object.values(SEVERIDADE_INTERACAO)
    },
    evidencia: {
      type: 'string',
      required: true,
      enum: Object.values(EVIDENCIA_INTERACAO)
    },
    recomendacao: {
      type: 'string',
      required: true,
      minLength: 10,
      maxLength: 1000
    },
    referencia_pubmed_id: {
      type: 'string',
      required: false,
      maxLength: 50
    },
    ativo: {
      type: 'boolean',
      required: false
    }
  };
}

// ============================================================================
// GETTERS DE SCHEMA
// ============================================================================

/**
 * Retorna schema apropriado para endpoint
 *
 * @param {string} action — ex: "auth.login", "studies.create"
 * @returns {object|null}
 */
function getSchemaForAction_(action) {
  switch (action) {
    case 'auth.login':
      return getLoginSchema_();
    case 'users.create':
      return getCreateUserSchema_();
    case 'studies.create':
      return getCreateStudySchema_();
    case 'experiments.create':
      return getCreateExperimentSchema_();
    case 'observations.create':
      return getCreateObservationSchema_();
    case 'insumos.create':
      return getCreateInsumoSchema_();
    case 'lotes.create':
      return getCreateLoteCoASchema_();
    case 'receitas.create':
      return getCreateReceitaFertirrigacaoSchema_();
    case 'protocolos.create':
      return getCreateProtocoloBiologicoSchema_();
    default:
      return null;
  }
}

// ============================================================================
// VALIDAÇÃO DE REQUISIÇÃO COMPLETA
// ============================================================================

/**
 * Valida requisição completa
 *
 * @param {object} request
 * @returns {object} {valid, errors}
 */
function validateRequest_(request) {
  const errors = [];

  // Verificar ação
  if (!request.action || typeof request.action !== 'string') {
    errors.push('Campo "action" obrigatório e deve ser string');
  }

  // Verificar token (se não for login)
  if (request.action !== 'auth.login' && request.action !== 'system.ping') {
    if (!request.token || typeof request.token !== 'string') {
      errors.push('Campo "token" obrigatório (exceto para login/ping)');
    }
  }

  // Validar schema de dados
  if (request.data && typeof request.data === 'object') {
    const schema = getSchemaForAction_(request.action);
    if (schema) {
      const validation = validateObject_(request.data, schema);
      if (!validation.valid) {
        errors.push('Dados inválidos: ' + JSON.stringify(validation.errors));
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

// ============================================================================
// VALIDAÇÃO REGULATÓRIA RDC 1.015/2026 (P0-2)
// ============================================================================

/**
 * Calcula idade em anos a partir da data de nascimento
 * @param {string} dataNasc — ISO 8601 date
 * @returns {number} Idade em anos
 */
function calcularIdade_(dataNasc) {
  const hoje = new Date();
  const nasc = new Date(dataNasc);
  let idade = hoje.getFullYear() - nasc.getFullYear();
  const m = hoje.getMonth() - nasc.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
    idade--;
  }
  return idade;
}

/**
 * Valida contraindicações regulatórias RDC 1.015/2026
 * 
 * BLOQUEIOS REGULATÓRIOS:
 * - THC >0,2% + idade <18 → bloquear (Art. 5º parágrafo único)
 * - THC >0,2% + gestante → bloquear
 * - THC >0,2% + lactante → bloquear
 * 
 * WARNINGS CIENTÍFICOS:
 * - Idade >65 → avaliação benefício-risco
 * - Histórico de dependência → avaliação de risco
 * 
 * @param {Object} receita — dados da receita
 * @param {Object} paciente — dados do paciente
 * @returns {Object} {valido: boolean, bloqueios: [], warnings: []}
 */
function validarContraindicoesRegulatorias_(receita, paciente) {
  const resultado = {
    valido: true,
    bloqueios: [],
    warnings: []
  };
  
  // Calcular % THC total
  const thcMg = parseFloat(receita.dose_mg_thc) || 0;
  const cbdMg = parseFloat(receita.dose_mg_cbd) || 0;
  const totalMg = thcMg + cbdMg;
  
  const thcPorcentagem = totalMg > 0 ? (thcMg / totalMg) * 100 : 0;
  
  // BLOCK 1: THC >0,2% para menores de 18 anos (RDC 1.015/2026 Art. 5º)
  const idade = calcularIdade_(paciente.data_nasc);
  if (idade < 18 && thcPorcentagem > 0.2) {
    resultado.valido = false;
    resultado.bloqueios.push({
      tipo: BIO_RULE_TYPE.REGULATORY_BLOCK,
      norma: 'RDC 1.015/2026 Art. 5º parágrafo único',
      campo: 'idade',
      valor: idade,
      limite: 18,
      thc_pct: thcPorcentagem.toFixed(2),
      razao: 'THC >0,2% contraindicado para menores de 18 anos'
    });
  }
  
  // BLOCK 2: THC >0,2% para gestantes
  if (paciente.gestante === true && thcPorcentagem > 0.2) {
    resultado.valido = false;
    resultado.bloqueios.push({
      tipo: BIO_RULE_TYPE.REGULATORY_BLOCK,
      norma: 'RDC 1.015/2026 Art. 5º parágrafo único',
      campo: 'gestante',
      thc_pct: thcPorcentagem.toFixed(2),
      razao: 'THC >0,2% contraindicado para gestantes'
    });
  }
  
  // BLOCK 3: THC >0,2% para lactantes
  if (paciente.lactante === true && thcPorcentagem > 0.2) {
    resultado.valido = false;
    resultado.bloqueios.push({
      tipo: BIO_RULE_TYPE.REGULATORY_BLOCK,
      norma: 'RDC 1.015/2026 Art. 5º parágrafo único',
      campo: 'lactante',
      thc_pct: thcPorcentagem.toFixed(2),
      razao: 'THC >0,2% contraindicado para lactantes'
    });
  }
  
  // WARNING: >65 anos (avaliação benefício-risco)
  if (idade > 65) {
    resultado.warnings.push({
      tipo: BIO_RULE_TYPE.SCIENTIFIC_WARNING,
      norma: 'Boas Práticas Clínicas — Geriatria',
      campo: 'idade',
      valor: idade,
      razao: 'Paciente >65 anos — avaliar benefício-risco, risco aumentado de quedas e interações'
    });
  }
  
  // WARNING: Histórico de dependência (se campo existir)
  if (paciente.historico_dependencia === true) {
    resultado.warnings.push({
      tipo: BIO_RULE_TYPE.SCIENTIFIC_WARNING,
      norma: 'DSM-5 Cannabis Use Disorder',
      campo: 'historico_dependencia',
      razao: 'Histórico de dependência — avaliar risco de uso problemático de cannabis'
    });
  }
  
  return resultado;
}

// ============================================================================
// EXPORTAR
// ============================================================================

const VALIDATION_SERVICE_LOADED = true;
