/**
 * COMPONENTE: 47_BatchJobService.gs
 * PAPEL: Serviço de processamento assíncronos (batch jobs)
 *
 * RESPONSABILIDADE:
 * - Criar jobs assíncronos
 * - Rastrear progresso
 * - Reportar resultados
 * - Suporte a retry
 *
 * TIPOS DE JOBS:
 * - IMPORT_CSV — importação de arquivo
 * - EXPORT_CSV — exportação de dados
 * - VALIDATION_RUN — executar validações
 * - BATCH_DELETE — deletar múltiplos registros
 *
 * NOTA: Acesso primitivo a dados (getAllBatchJobs_, getBatchJobById_,
 * getUserBatchJobs_, getBatchJobsByStatus_, create/update) vive em
 * BatchJobRepository.gs.
 *
 * STATUS: v2.0 — Implementado
 */

/**
 * Cria novo job em batch
 *
 * @param {string} userId
 * @param {string} jobType — "IMPORT_CSV", "EXPORT_CSV", "VALIDATION_RUN", "BATCH_DELETE"
 * @param {object} parameters — parâmetros do job
 * @returns {object} job criado
 */
function createBatchJob_(userId, jobType, parameters) {
  try {
    const job = {
      id: generateUUID_(),
      type: jobType,
      status: 'QUEUED',           // QUEUED → RUNNING → COMPLETED/FAILED
      createdBy: userId,
      createdAt: nowIso_(),
      startedAt: '',
      completedAt: '',
      progress: 0,                 // 0-100
      totalItems: parameters.totalItems || 0,
      processedItems: 0,
      failedItems: 0,
      parameters: JSON.stringify(parameters),
      result: '',                  // JSON stringified
      errorMessage: '',
      retries: 0,
      maxRetries: parameters.maxRetries || 3,
      estimatedDuration: parameters.estimatedDuration || 0
    };

    return createBatchJobRecord_(job, userId);

  } catch (error) {
    logException_('Erro ao criar batch job', error);
    throw error;
  }
}

/**
 * Atualiza status de job
 */
function updateBatchJobStatus_(jobId, status, updates) {
  updates = updates || {};
  updates.status = status;

  if (status === 'RUNNING' && !updates.startedAt) {
    updates.startedAt = nowIso_();
  }

  if (status === 'COMPLETED' || status === 'FAILED') {
    updates.completedAt = nowIso_();
  }

  return updateBatchJobRecord_(jobId, updates);
}

/**
 * Atualiza progresso de job
 */
function updateBatchJobProgress_(jobId, processedItems, failedItems, progress) {
  return updateBatchJobRecord_(jobId, {
    processedItems: processedItems,
    failedItems: failedItems,
    progress: Math.min(100, progress || 0),
    updatedAt: nowIso_()
  });
}

// ============================================================================
// PROCESSAMENTO DE JOBS
// ============================================================================

/**
 * Processa um job em batch (executar job)
 *
 * @param {string} jobId
 */
function processBatchJob_(jobId) {
  try {
    const job = getBatchJobById_(jobId);
    if (!job) {
      logError_('Job não encontrado', { jobId: jobId });
      return;
    }

    // Marcar como RUNNING
    updateBatchJobStatus_(jobId, 'RUNNING');

    const parameters = JSON.parse(job.parameters || '{}');
    let result;

    try {
      // Executar baseado no tipo
      switch (job.type) {
        case 'IMPORT_CSV':
          result = processBatchImport_(job, parameters);
          break;

        case 'EXPORT_CSV':
          result = processBatchExport_(job, parameters);
          break;

        case 'VALIDATION_RUN':
          result = processBatchValidation_(job, parameters);
          break;

        case 'BATCH_DELETE':
          result = processBatchDelete_(job, parameters);
          break;

        default:
          throw new Error('Job type desconhecido: ' + job.type);
      }

      // Sucesso
      updateBatchJobStatus_(jobId, 'COMPLETED', {
        result: JSON.stringify(result),
        progress: 100
      });

      auditCreate_('BatchJob', jobId, job.createdBy, {
        type: job.type,
        status: 'COMPLETED',
        result: result
      });

      logInfo_('Batch job completado', {
        jobId: jobId,
        type: job.type,
        duration: result.duration
      });

    } catch (error) {
      // Falha
      logException_('Erro ao processar batch job', error);

      // Retry
      const retries = job.retries + 1;
      if (retries < job.maxRetries) {
        updateBatchJobStatus_(jobId, 'QUEUED', {
          retries: retries,
          errorMessage: error.message + ' (tentativa ' + retries + ')'
        });

        logWarn_('Job retry agendado', {
          jobId: jobId,
          attempt: retries
        });
      } else {
        updateBatchJobStatus_(jobId, 'FAILED', {
          errorMessage: error.message + ' (máximo de tentativas)',
          retries: retries
        });

        auditCreate_('BatchJob', jobId, job.createdBy, {
          type: job.type,
          status: 'FAILED',
          error: error.message
        });
      }
    }

  } catch (error) {
    logException_('Erro crítico no batch job', error);
  }
}

// ============================================================================
// PROCESSADORES DE TIPO DE JOB
// ============================================================================

/**
 * Processa IMPORT_CSV
 */
function processBatchImport_(job, parameters) {
  const startTime = nowUnix_();

  try {
    const result = importData_(
      parameters.format,
      parameters.content,
      parameters.entityType,
      job.createdBy
    );

    return {
      type: 'IMPORT_CSV',
      imported: result.imported.length,
      failed: result.failed.length,
      total: result.imported.length + result.failed.length,
      duration: nowUnix_() - startTime,
      errors: result.failed
    };

  } catch (error) {
    throw error;
  }
}

/**
 * Processa EXPORT_CSV
 */
function processBatchExport_(job, parameters) {
  const startTime = nowUnix_();

  try {
    let data;

    if (parameters.entityType === 'Study' && parameters.studyId) {
      data = exportStudyComplete_(parameters.studyId, parameters.format);
    } else if (parameters.entityType === 'Study') {
      data = exportStudies_(parameters.format, parameters.filters);
    } else if (parameters.entityType === 'Experiment') {
      data = exportExperiments_(parameters.format, parameters.studyId);
    } else if (parameters.entityType === 'Observation') {
      data = exportObservations_(parameters.format, parameters.experimentId);
    }

    return {
      type: 'EXPORT_CSV',
      format: parameters.format,
      entityType: parameters.entityType,
      dataSize: data ? data.length : 0,
      duration: nowUnix_() - startTime
    };

  } catch (error) {
    throw error;
  }
}

/**
 * Processa VALIDATION_RUN
 */
function processBatchValidation_(job, parameters) {
  const startTime = nowUnix_();

  try {
    const result = runValidationsForStudy_(parameters.studyId, job.createdBy);

    return {
      type: 'VALIDATION_RUN',
      studyId: parameters.studyId,
      total: result.total,
      passed: result.passed_count,
      failed: result.failed_count,
      duration: nowUnix_() - startTime,
      details: result.results
    };

  } catch (error) {
    throw error;
  }
}

/**
 * Processa BATCH_DELETE
 */
function processBatchDelete_(job, parameters) {
  const startTime = nowUnix_();
  let deleted = 0;
  let failed = 0;

  try {
    const ids = parameters.ids || [];

    ids.forEach(function(id) {
      try {
        deleteRecord_(parameters.entityType, id);
        deleted++;
        updateBatchJobProgress_(job.id, deleted, failed, Math.min(100, (deleted / ids.length) * 100));
      } catch (error) {
        failed++;
        logWarn_('Erro ao deletar item', { id: id, error: error.message });
      }
    });

    return {
      type: 'BATCH_DELETE',
      entityType: parameters.entityType,
      total: ids.length,
      deleted: deleted,
      failed: failed,
      duration: nowUnix_() - startTime
    };

  } catch (error) {
    throw error;
  }
}

// ============================================================================
// CONSULTAS
// ============================================================================

/**
 * Retorna jobs pendentes para processar
 *
 * @returns {array}
 */
function getPendingBatchJobs_() {
  return getBatchJobsByStatus_('QUEUED');
}

/**
 * Retorna estatísticas de batch jobs
 *
 * @returns {object}
 */
function getBatchJobStats_() {
  const all = getAllBatchJobs_() || [];

  return {
    total: all.length,
    queued: all.filter(function(j) { return j.status === 'QUEUED'; }).length,
    running: all.filter(function(j) { return j.status === 'RUNNING'; }).length,
    completed: all.filter(function(j) { return j.status === 'COMPLETED'; }).length,
    failed: all.filter(function(j) { return j.status === 'FAILED'; }).length,
    byType: {
      import: all.filter(function(j) { return j.type === 'IMPORT_CSV'; }).length,
      export: all.filter(function(j) { return j.type === 'EXPORT_CSV'; }).length,
      validation: all.filter(function(j) { return j.type === 'VALIDATION_RUN'; }).length,
      delete: all.filter(function(j) { return j.type === 'BATCH_DELETE'; }).length
    }
  };
}

const BATCH_JOB_SERVICE_LOADED = true;
