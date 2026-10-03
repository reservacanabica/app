/**
 * COMPONENTE: 35_ValidationRunService.gs
 * PAPEL: Serviço de Validações Científicas
 *
 * RESPONSABILIDADE:
 * - Executar validações científicas
 * - Rastrear resultados
 * - Reportar erros e warnings
 *
 * VALIDAÇÕES (10 + extensível):
 * V01: Consistência de p-valor (0 < p ≤ 1)
 * V02: Intervalos de confiança coerentes
 * V03: Tamanho amostral ≥ mínimo
 * V04: Contagem TYMC ≤ limites Ph.Eur
 * V05: Concentrações de canabinoides em faixa
 * V06: Soma de frações ≤ 100%
 * V07: Evidence referencia Reference existente
 * V08: Observation referencia Experiment existente
 * V09: Schema de abas corretos
 * V10: Sem Study ID órfão em Experiments
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// VALIDAÇÕES CIENTÍFICAS
// ============================================================================

/**
 * Executa todas as validações para um Study
 *
 * @param {string} studyId
 * @param {string} userId
 * @returns {object} {passed, total, results}
 */
function runValidationsForStudy_(studyId, userId) {
  try {
    const study = getStudyById_(studyId);
    if (!study) {
      throwError_('NOT_FOUND', 'Study não encontrado', {});
    }

    const startTime = nowUnix_();
    const results = [];

    // V10: Verificar que todos os Experiments têm studyId válido
    const experiments = getExperimentsByStudy_(studyId) || [];
    experiments.forEach(function(exp) {
      const result = executeValidation_('V10', 'Study', studyId, {
        experimentId: exp.id,
        hasStudyId: exp.studyId === studyId
      }, userId);
      results.push(result);
    });

    // V08: Verificar que todas as Observations têm experimentId válido
    experiments.forEach(function(exp) {
      const observations = getObservationsByExperiment_(exp.id) || [];
      observations.forEach(function(obs) {
        const result = executeValidation_('V08', 'Observation', obs.id, {
          experimentId: obs.experimentId,
          exists: exp.id === obs.experimentId
        }, userId);
        results.push(result);
      });

      // V03: Validar tamanho amostral
      if (observations.length > 0) {
        const result = executeValidation_('V03', 'Experiment', exp.id, {
          observationCount: observations.length,
          minimumRequired: 3,
          valid: observations.length >= 3
        }, userId);
        results.push(result);
      }
    });

    // V07: Verificar Evidence
    experiments.forEach(function(exp) {
      const observations = getObservationsByExperiment_(exp.id) || [];
      observations.forEach(function(obs) {
        const evidences = getEvidenceByObservation_(obs.id) || [];
        evidences.forEach(function(evid) {
          if (evid.referenceId) {
            const ref = getReferenceById_(evid.referenceId);
            const result = executeValidation_('V07', 'Evidence', evid.id, {
              referenceId: evid.referenceId,
              exists: ref !== null
            }, userId);
            results.push(result);
          }
        });
      });
    });

    const duration = nowUnix_() - startTime;
    const passed = results.filter(function(r) { return r.passed; }).length;

    logInfo_('Validações completas para Study', {
      studyId: studyId,
      total: results.length,
      passed: passed,
      duration: duration
    });

    return {
      passed: passed === results.length,
      total: results.length,
      passed_count: passed,
      failed_count: results.length - passed,
      duration: duration,
      results: results,
      timestamp: nowIso_()
    };

  } catch (error) {
    logException_('Erro ao executar validações', error);
    throw error;
  }
}

/**
 * Executa validação individual
 *
 * @param {string} ruleId
 * @param {string} entityType
 * @param {string} entityId
 * @param {object} data — dados para validar
 * @param {string} userId
 * @returns {object} {ruleId, passed, details, errors}
 */
function executeValidation_(ruleId, entityType, entityId, data, userId) {
  try {
    const startTime = nowUnix_();
    const result = {
      ruleId: ruleId,
      entityType: entityType,
      entityId: entityId,
      passed: false,
      details: data,
      errors: [],
      warnings: []
    };

    // Executar validação específica
    switch (ruleId) {
      case 'V01':
        result.passed = validatePValue_(data);
        break;
      case 'V02':
        result.passed = validateConfidenceIntervals_(data);
        break;
      case 'V03':
        result.passed = validateSampleSize_(data);
        break;
      case 'V04':
        result.passed = validateTYMCLimits_(data);
        break;
      case 'V05':
        result.passed = validateCannabinoidsRange_(data);
        break;
      case 'V06':
        result.passed = validateFractionSum_(data);
        break;
      case 'V07':
        result.passed = validateReferenceExists_(data);
        break;
      case 'V08':
        result.passed = validateExperimentExists_(data);
        break;
      case 'V09':
        result.passed = validateSchemaConsistency_(data);
        break;
      case 'V10':
        result.passed = validateStudyIdIntegrity_(data);
        break;
      default:
        result.errors.push('Validação desconhecida: ' + ruleId);
    }

    const duration = nowUnix_() - startTime;

    // Armazenar resultado
    createValidationRun_(userId, {
      entityType: entityType,
      entityId: entityId,
      validationType: 'SCIENTIFIC',
      ruleId: ruleId,
      passed: result.passed,
      details: result,
      errors: result.errors,
      warnings: result.warnings,
      duration: duration
    });

    return result;

  } catch (error) {
    logException_('Erro ao executar validação', error);
    return {
      ruleId: ruleId,
      passed: false,
      errors: [error.message]
    };
  }
}

// ============================================================================
// VALIDADORES ESPECÍFICOS
// ============================================================================

/**
 * V01: Validar p-valor (0 < p ≤ 1)
 */
function validatePValue_(data) {
  if (!data.pValue && data.pValue !== 0) return true; // opcional
  const p = parseFloat(data.pValue);
  return p > 0 && p <= 1;
}

/**
 * V02: Validar IC coerente com efeito
 */
function validateConfidenceIntervals_(data) {
  if (!data.ci_lower || !data.ci_upper) return true; // opcional
  const lower = parseFloat(data.ci_lower);
  const upper = parseFloat(data.ci_upper);
  return lower < upper && (lower < 0 ? upper > 0 : true);
}

/**
 * V03: Tamanho amostral ≥ 3
 */
function validateSampleSize_(data) {
  if (!data.observationCount) return false;
  return data.observationCount >= (data.minimumRequired || 3);
}

/**
 * V04: Contagem TYMC ≤ Ph.Eur 5.1.8
 */
function validateTYMCLimits_(data) {
  if (!data.tymc_count) return true; // opcional
  const limit = 10000; // Ph.Eur exemplo
  return data.tymc_count <= limit;
}

/**
 * V05: Canabinoides em faixa de referência
 */
function validateCannabinoidsRange_(data) {
  if (!data.thc && !data.cbd) return true; // opcional
  
  const thc = parseFloat(data.thc) || 0;
  const cbd = parseFloat(data.cbd) || 0;

  return (thc >= 0 && thc <= 100) && (cbd >= 0 && cbd <= 100);
}

/**
 * V06: Soma de frações ≤ 100%
 */
function validateFractionSum_(data) {
  if (!data.fractions) return true; // opcional
  
  const sum = data.fractions.reduce(function(a, b) {
    return a + (parseFloat(b) || 0);
  }, 0);

  return sum <= 100.1; // permitir pequeno erro de arredondamento
}

/**
 * V07: Evidence referencia Reference existente
 */
function validateReferenceExists_(data) {
  if (!data.referenceId) return true; // opcional
  return data.exists === true;
}

/**
 * V08: Observation referencia Experiment existente
 */
function validateExperimentExists_(data) {
  return data.exists === true;
}

/**
 * V09: Schema de abas corretos
 */
function validateSchemaConsistency_(data) {
  return data.schemasValid === true;
}

/**
 * V10: Sem Study ID órfão
 */
function validateStudyIdIntegrity_(data) {
  return data.hasStudyId === true;
}

// ============================================================================
// RELATÓRIOS
// ============================================================================

/**
 * Gera relatório de validações para Study
 *
 * @param {string} studyId
 * @returns {object}
 */
function generateValidationReport_(studyId) {
  try {
    const validations = getValidationRunsByEntity_('Study', studyId);
    
    if (validations.length === 0) {
      return {
        studyId: studyId,
        validationsRun: 0,
        passed: 0,
        failed: 0,
        message: 'Nenhuma validação executada'
      };
    }

    const passed = validations.filter(function(v) { return v.passed; }).length;
    const failed = validations.length - passed;

    return {
      studyId: studyId,
      validationsRun: validations.length,
      passed: passed,
      failed: failed,
      passRate: ((passed / validations.length) * 100).toFixed(2) + '%',
      summary: {
        passed: passed > 0 ? 'Algumas validações passaram' : 'Nenhuma validação passou',
        failed: failed > 0 ? failed + ' validações falharam' : 'Todas as validações passaram'
      },
      details: validations,
      timestamp: nowIso_()
    };

  } catch (error) {
    logException_('Erro ao gerar relatório', error);
    return { error: error.message };
  }
}

const VALIDATION_RUN_SERVICE_LOADED = true;
