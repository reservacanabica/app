/**
 * @file 33_BioCompatibilityService.gs
 * @description Service layer for biological compatibility validation
 * PRE-validation of application parameters (faseCultivo, tipoInsumo, metodoAplicacao)
 * BEFORE parecer creation. Complementary to ParecerCompatibilidadeService (POST-selection analysis).
 * 
 * ARCHITECTURE:
 * - bio.validate: validates PARAMETERS before selection
 * - ParecerCompatibilidadeService: analyzes SPECIFIC combinations after selection
 */

var BioCompatibilityService = (function() {
  'use strict';

  // Rule version for traceability
  var RULE_VERSION_ = 'v1.0.0';
  var RULE_LAST_UPDATED_ = '2026-09-30';

  // Rule IDs
  var RULES_ = {
    PHASE_APPLICATION: 'BIO-001',
    EC_INOCULATION: 'BIO-002',
    DOCUMENTARY_COMPATIBILITY: 'BIO-003',
    BATCH_LIBERATION: 'BIO-004'
  };

  // Prohibited combinations (PROJECT_POLICY)
  var PROHIBITED_COMBINATIONS_ = {
    'FLORACAO:FOLIAR': { 
      block: true, 
      reason: 'Aplicação foliar durante floração apresenta risco de EC elevado prejudicar desenvolvimento floral'
    },
    'PROPAGACAO:SOLO': { 
      block: false, 
      warn: true, 
      reason: 'Preferir inoculação durante propagação para melhor estabelecimento da simbiose'
    }
  };

  /**
   * Main validation entry point
   * @param {Object} params - Validation parameters
   * @param {string} params.faseCultivo - Cultivation phase (PROPAGACAO, VEGETATIVA, FLORACAO)
   * @param {string} params.tipoInsumo - Input type (optional)
   * @param {string} params.metodoAplicacao - Application method (FOLIAR, SOLO, INOCULACAO)
   * @param {string} params.cultivo - Cultivo ID (optional)
   * @param {string} params.lote - Lote ID (optional)
   * @param {string} params.protocolo - Protocolo ID (optional)
   * @param {string} params.receitaId - Receita ID (optional)
   * @param {string} params.userId - User ID
   * @param {string} params.correlationId - Request correlation ID
   * @returns {Object} Validation result
   */
  function validateBioCompatibility(params) {
    if (!params || !params.faseCultivo || !params.metodoAplicacao) {
      throw new Error('faseCultivo e metodoAplicacao são obrigatórios');
    }

    var validationId = Utilities.getUuid();
    var startTime = new Date();

    try {
      // Create validation run record
      var validationRun = createValidationRun_(validationId, params);

      // Evaluate all applicable rules
      var triggeredRules = evaluateRules_(params);

      // Generate opinion based on triggered rules
      var opinion = generateOpinion_(triggeredRules);

      // Build traceability record
      var traceability = buildTraceability_(params, triggeredRules, validationId);

      // Extract alerts and blocks
      var alertas = [];
      var bloqueios = [];
      triggeredRules.forEach(function(rule) {
        if (rule.severity === 'ERROR') {
          bloqueios.push(rule.message);
        } else if (rule.severity === 'WARNING') {
          alertas.push(rule.message);
        }
      });

      var result = {
        validationId: validationId,
        compativel: opinion === VEREDICTO_COMPATIBILIDADE.COMPATIVEL,
        veredicto: opinion,
        alertas: alertas,
        bloqueios: bloqueios,
        regrasAcionadas: triggeredRules.map(function(r) { return r.ruleId; }),
        evidencias: triggeredRules,
        metadata: traceability
      };

      // Update validation run with result
      updateValidationRun_(validationId, 'COMPLETED', result);

      // Audit log
      if (typeof auditCreate_ === 'function') {
        auditCreate_(
          'BioValidation',
          validationId,
          params.userId,
          { veredicto: opinion, rulesTriggered: triggeredRules.length },
          params.correlationId
        );
      }

      return result;

    } catch (error) {
      updateValidationRun_(validationId, 'FAILED', { error: error.message });
      throw error;
    }
  }

  /**
   * Evaluate all applicable rules
   * @private
   * @param {Object} params
   * @returns {Array} Array of triggered rules
   */
  function evaluateRules_(params) {
    var triggered = [];

    // Rule 1: Phase × Application compatibility
    var rule1 = validatePhaseApplicationRule_(params.faseCultivo, params.metodoAplicacao);
    if (rule1.triggered) {
      triggered.push(rule1);
    }

    // Rule 2: EC × Inoculation risk (requires receita)
    if (params.receitaId && params.metodoAplicacao === 'INOCULACAO') {
      var rule2 = validateECInoculationRule_(params.receitaId);
      if (rule2.triggered) {
        triggered.push(rule2);
      }
    }

    // Rule 3: Documentary compatibility (requires lote)
    if (params.lote) {
      var rule3 = validateDocumentaryCompatibility_(params.lote);
      if (rule3.triggered) {
        triggered.push(rule3);
      }
    }

    // Rule 4: Batch liberation status (requires lote)
    if (params.lote) {
      var rule4 = validateBatchLiberationStatus_(params.lote);
      if (rule4.triggered) {
        triggered.push(rule4);
      }
    }

    return triggered;
  }

  /**
   * Rule 1: Validate phase × application compatibility
   * @private
   * @param {string} faseCultivo
   * @param {string} metodoAplicacao
   * @returns {Object} Rule result
   */
  function validatePhaseApplicationRule_(faseCultivo, metodoAplicacao) {
    var key = faseCultivo + ':' + metodoAplicacao;
    var rule = PROHIBITED_COMBINATIONS_[key];

    if (rule && rule.block) {
      return {
        ruleId: RULES_.PHASE_APPLICATION,
        ruleType: BIO_RULE_TYPE.PROJECT_POLICY,
        ruleVersion: RULE_VERSION_,
        triggered: true,
        severity: 'ERROR',
        message: rule.reason,
        references: [],
        evidenceGrade: 'HIGH'
      };
    }

    if (rule && rule.warn) {
      return {
        ruleId: RULES_.PHASE_APPLICATION,
        ruleType: BIO_RULE_TYPE.SCIENTIFIC_WARNING,
        ruleVersion: RULE_VERSION_,
        triggered: true,
        severity: 'WARNING',
        message: rule.reason,
        references: [],
        evidenceGrade: 'MEDIUM'
      };
    }

    return {
      ruleId: RULES_.PHASE_APPLICATION,
      ruleType: BIO_RULE_TYPE.PROJECT_POLICY,
      ruleVersion: RULE_VERSION_,
      triggered: false,
      severity: 'INFO',
      message: 'Combinação fase × aplicação compatível',
      references: [],
      evidenceGrade: 'HIGH'
    };
  }

  /**
   * Rule 2: Validate EC × Inoculation risk
   * @private
   * @param {string} receitaId
   * @returns {Object} Rule result
   */
  function validateECInoculationRule_(receitaId) {
    try {
      var receita = getReceitaById_(receitaId);
      if (!receita) {
        return {
          ruleId: RULES_.EC_INOCULATION,
          ruleType: BIO_RULE_TYPE.OPERATIONAL_WARNING,
          ruleVersion: RULE_VERSION_,
          triggered: false,
          severity: 'INFO',
          message: 'Receita não encontrada para validação de EC',
          references: [],
          evidenceGrade: 'INSUFFICIENT'
        };
      }

      var ecValue = parseFloat(receita.ecTotal_dS_m || 0);
      var EC_THRESHOLD = 2.0; // dS/m

      if (ecValue > EC_THRESHOLD) {
        return {
          ruleId: RULES_.EC_INOCULATION,
          ruleType: BIO_RULE_TYPE.OPERATIONAL_WARNING,
          ruleVersion: RULE_VERSION_,
          triggered: true,
          severity: 'WARNING',
          message: 'EC ' + ecValue.toFixed(2) + ' dS/m excede limite seguro para inoculação com Trichoderma (máx 2.0 dS/m). Considerar redução de concentração ou método alternativo.',
          references: ['References sheet - scientific paper on Trichoderma salt sensitivity'],
          evidenceGrade: 'HIGH'
        };
      }

      return {
        ruleId: RULES_.EC_INOCULATION,
        ruleType: BIO_RULE_TYPE.OPERATIONAL_WARNING,
        ruleVersion: RULE_VERSION_,
        triggered: false,
        severity: 'INFO',
        message: 'EC dentro do limite seguro para inoculação',
        references: [],
        evidenceGrade: 'HIGH'
      };

    } catch (error) {
      return {
        ruleId: RULES_.EC_INOCULATION,
        ruleType: BIO_RULE_TYPE.OPERATIONAL_WARNING,
        ruleVersion: RULE_VERSION_,
        triggered: false,
        severity: 'INFO',
        message: 'Erro ao validar EC: ' + error.message,
        references: [],
        evidenceGrade: 'INSUFFICIENT'
      };
    }
  }

  /**
   * Rule 3: Validate documentary compatibility
   * @private
   * @param {string} loteId
   * @returns {Object} Rule result
   */
  function validateDocumentaryCompatibility_(loteId) {
    try {
      var lote = getLoteCoAById_(loteId);
      if (!lote) {
        return {
          ruleId: RULES_.DOCUMENTARY_COMPATIBILITY,
          ruleType: BIO_RULE_TYPE.REGULATORY_BLOCK,
          ruleVersion: RULE_VERSION_,
          triggered: true,
          severity: 'ERROR',
          message: 'Lote não encontrado: ' + loteId,
          references: [],
          evidenceGrade: 'HIGH'
        };
      }

      // Check if lote has valid CoA
      if (!lote.drivePdfCoAURL || lote.drivePdfCoAURL.trim() === '') {
        return {
          ruleId: RULES_.DOCUMENTARY_COMPATIBILITY,
          ruleType: BIO_RULE_TYPE.REGULATORY_BLOCK,
          ruleVersion: RULE_VERSION_,
          triggered: true,
          severity: 'ERROR',
          message: 'Lote ' + lote.numeroLote + ' sem Certificado de Análise válido',
          references: [],
          evidenceGrade: 'HIGH'
        };
      }

      // Check insumo MAPA registration
      var insumo = getInsumoById_(lote.insumoId);
      if (insumo && !insumo.registroMAPAEstabelecimento) {
        return {
          ruleId: RULES_.DOCUMENTARY_COMPATIBILITY,
          ruleType: BIO_RULE_TYPE.REGULATORY_BLOCK,
          ruleVersion: RULE_VERSION_,
          triggered: true,
          severity: 'ERROR',
          message: 'Insumo sem registro MAPA de estabelecimento',
          references: [],
          evidenceGrade: 'HIGH'
        };
      }

      return {
        ruleId: RULES_.DOCUMENTARY_COMPATIBILITY,
        ruleType: BIO_RULE_TYPE.REGULATORY_BLOCK,
        ruleVersion: RULE_VERSION_,
        triggered: false,
        severity: 'INFO',
        message: 'Documentação do lote conforme',
        references: [],
        evidenceGrade: 'HIGH'
      };

    } catch (error) {
      return {
        ruleId: RULES_.DOCUMENTARY_COMPATIBILITY,
        ruleType: BIO_RULE_TYPE.REGULATORY_BLOCK,
        ruleVersion: RULE_VERSION_,
        triggered: true,
        severity: 'ERROR',
        message: 'Erro ao validar documentação: ' + error.message,
        references: [],
        evidenceGrade: 'INSUFFICIENT'
      };
    }
  }

  /**
   * Rule 4: Validate batch liberation status
   * @private
   * @param {string} loteId
   * @returns {Object} Rule result
   */
  function validateBatchLiberationStatus_(loteId) {
    try {
      var lote = getLoteCoAById_(loteId);
      if (!lote) {
        return {
          ruleId: RULES_.BATCH_LIBERATION,
          ruleType: BIO_RULE_TYPE.REGULATORY_BLOCK,
          ruleVersion: RULE_VERSION_,
          triggered: true,
          severity: 'ERROR',
          message: 'Lote não encontrado: ' + loteId,
          references: [],
          evidenceGrade: 'HIGH'
        };
      }

      if (lote.statusLiberacao !== 'LIBERADO') {
        return {
          ruleId: RULES_.BATCH_LIBERATION,
          ruleType: BIO_RULE_TYPE.REGULATORY_BLOCK,
          ruleVersion: RULE_VERSION_,
          triggered: true,
          severity: 'ERROR',
          message: 'Lote ' + lote.numeroLote + ' não liberado (status: ' + lote.statusLiberacao + ')',
          references: [],
          evidenceGrade: 'HIGH'
        };
      }

      return {
        ruleId: RULES_.BATCH_LIBERATION,
        ruleType: BIO_RULE_TYPE.REGULATORY_BLOCK,
        ruleVersion: RULE_VERSION_,
        triggered: false,
        severity: 'INFO',
        message: 'Lote liberado para uso',
        references: [],
        evidenceGrade: 'HIGH'
      };

    } catch (error) {
      return {
        ruleId: RULES_.BATCH_LIBERATION,
        ruleType: BIO_RULE_TYPE.REGULATORY_BLOCK,
        ruleVersion: RULE_VERSION_,
        triggered: true,
        severity: 'ERROR',
        message: 'Erro ao validar status de liberação: ' + error.message,
        references: [],
        evidenceGrade: 'INSUFFICIENT'
      };
    }
  }

  /**
   * Generate final opinion based on triggered rules
   * @private
   * @param {Array} triggeredRules
   * @returns {string} Opinion (COMPATIVEL, COMPATIVEL_COM_RESSALVAS, INCOMPATIVEL, REVISAO_HUMANA)
   */
  function generateOpinion_(triggeredRules) {
    var hasRegulatoryBlock = false;
    var hasProjectPolicy = false;
    var hasScientificWarning = false;
    var hasOperationalWarning = false;
    var hasInsufficient = false;

    triggeredRules.forEach(function(rule) {
      if (!rule.triggered) return;

      if (rule.ruleType === BIO_RULE_TYPE.REGULATORY_BLOCK) {
        hasRegulatoryBlock = true;
      } else if (rule.ruleType === BIO_RULE_TYPE.PROJECT_POLICY && rule.severity === 'ERROR') {
        hasProjectPolicy = true;
      } else if (rule.ruleType === BIO_RULE_TYPE.SCIENTIFIC_WARNING) {
        hasScientificWarning = true;
      } else if (rule.ruleType === BIO_RULE_TYPE.OPERATIONAL_WARNING) {
        hasOperationalWarning = true;
      }

      if (rule.evidenceGrade === 'INSUFFICIENT') {
        hasInsufficient = true;
      }
    });

    // Decision logic
    if (hasRegulatoryBlock || hasProjectPolicy) {
      return VEREDICTO_COMPATIBILIDADE.INCOMPATIVEL;
    }

    if (hasInsufficient) {
      return VEREDICTO_COMPATIBILIDADE.REVISAO_HUMANA;
    }

    if (hasScientificWarning || hasOperationalWarning) {
      return VEREDICTO_COMPATIBILIDADE.COMPATIVEL_COM_RESSALVAS;
    }

    return VEREDICTO_COMPATIBILIDADE.COMPATIVEL;
  }

  /**
   * Build traceability record
   * @private
   * @param {Object} params
   * @param {Array} triggeredRules
   * @param {string} validationId
   * @returns {Object} Traceability metadata
   */
  function buildTraceability_(params, triggeredRules, validationId) {
    return {
      validationId: validationId,
      timestamp: new Date().toISOString(),
      userId: params.userId,
      correlationId: params.correlationId,
      ruleVersion: RULE_VERSION_,
      inputsUsed: {
        faseCultivo: params.faseCultivo,
        tipoInsumo: params.tipoInsumo,
        metodoAplicacao: params.metodoAplicacao,
        cultivo: params.cultivo,
        lote: params.lote,
        protocolo: params.protocolo,
        receitaId: params.receitaId
      },
      rulesApplied: triggeredRules.map(function(rule) {
        return {
          ruleId: rule.ruleId,
          ruleType: rule.ruleType,
          ruleVersion: rule.ruleVersion,
          triggered: rule.triggered,
          sourceRef: rule.references
        };
      }),
      evidence: triggeredRules.filter(function(r) { return r.triggered; })
    };
  }

  /**
   * Create validation run record
   * Delegada a createValidationRun_() de 34_ValidationRunRepository.gs
   * @private
   * @param {string} validationId
   * @param {Object} params
   * @returns {Object} Validation run
   */
  function createBioValidationRun_(validationId, params) {
    var now = new Date().toISOString();
    var run = {
      id: validationId,
      scope: 'bio-validate',
      status: 'RUNNING',
      userId: params.userId || null,
      params: JSON.stringify(params),
      createdAt: now,
      updatedAt: now
    };
    try {
      appendRow_('ValidationRuns', run);
    } catch (e) {
      Logger.log('Warning: Could not persist bio validation run: ' + e.message);
    }
    return run;
  }

  /**
   * Update validation run with result
   * Delegada a updateRowById_() de 14_SpreadsheetGateway.gs
   * @private
   * @param {string} validationId
   * @param {string} status - COMPLETED or FAILED
   * @param {Object} result
   */
  function updateBioValidationRun_(validationId, status, result) {
    try {
      updateRowById_('ValidationRuns', validationId, {
        status: status,
        result: JSON.stringify(result),
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      Logger.log('Warning: Could not update bio validation run: ' + e.message);
    }
  }

  // Public API
  return {
    validateBioCompatibility: validateBioCompatibility
  };

})();
