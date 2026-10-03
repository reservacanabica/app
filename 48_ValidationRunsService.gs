/**
 * @file 48_ValidationRunsService.gs
 * @description Service layer for ValidationRuns entity
 * Stores validation execution history for bio.validate and other validation workflows
 * 
 * CORRIGIDO: Substituídas chamadas SpreadsheetGateway.x() (objeto inexistente)
 * pelas funções livres de 14_SpreadsheetGateway.gs
 */

var ValidationRunsService = (function() {
  'use strict';

  var SHEET_NAME_ = 'ValidationRuns';

  /**
   * Create validation run record
   * @param {string} scope - Validation scope (e.g., 'bio-validate', 'parecer-analysis')
   * @param {string} userId - User ID
   * @param {Object} params - Validation parameters
   * @returns {Object} Created validation run with id
   */
  function createValidationRun(scope, userId, params) {
    if (!scope || !userId) {
      throw new Error('scope e userId são obrigatórios');
    }

    var id = Utilities.getUuid();
    var now = new Date().toISOString();

    var validationRun = {
      id: id,
      scope: scope,
      status: 'PENDING',
      userId: userId,
      params: JSON.stringify(params || {}),
      result: '',
      createdAt: now,
      updatedAt: now
    };

    appendRow_(SHEET_NAME_, validationRun);
    return validationRun;
  }

  /**
   * Update validation run with result
   * @param {string} validationRunId - Validation run ID
   * @param {string} status - Status (COMPLETED, FAILED)
   * @param {Object} resultJson - Result object
   * @returns {Object} Updated validation run
   */
  function updateValidationRunResult(validationRunId, status, resultJson) {
    if (!validationRunId || !status) {
      throw new Error('validationRunId e status são obrigatórios');
    }

    var updates = {
      status: status,
      result: JSON.stringify(resultJson || {}),
      updatedAt: new Date().toISOString()
    };

    updateRowById_(SHEET_NAME_, validationRunId, updates);
    return getRowById_(SHEET_NAME_, validationRunId);
  }

  /**
   * Get validation runs by scope
   * @param {string} scope - Validation scope
   * @param {number} limit - Max results (default 100)
   * @returns {Array} Array of validation runs
   */
  function getValidationRunsByScope(scope, limit) {
    limit = limit || 100;

    var allRuns = getAllRows_(SHEET_NAME_);
    var filtered = allRuns.filter(function(run) {
      return run.scope === scope;
    });

    filtered.sort(function(a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return filtered.slice(0, limit);
  }

  /**
   * Get validation runs by user
   * @param {string} userId - User ID
   * @param {number} limit - Max results (default 100)
   * @returns {Array} Array of validation runs
   */
  function getValidationRunsByUser(userId, limit) {
    limit = limit || 100;

    var allRuns = getAllRows_(SHEET_NAME_);
    var filtered = allRuns.filter(function(run) {
      return run.userId === userId;
    });

    filtered.sort(function(a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return filtered.slice(0, limit);
  }

  /**
   * Get validation run statistics
   * @returns {Object} Statistics object
   */
  function getValidationRunStats() {
    var allRuns = getAllRows_(SHEET_NAME_);

    var stats = {
      total: allRuns.length,
      byStatus: {},
      byScope: {},
      avgDuration: 0
    };

    var totalDuration = 0;
    var completedCount = 0;

    allRuns.forEach(function(run) {
      if (!stats.byStatus[run.status]) stats.byStatus[run.status] = 0;
      stats.byStatus[run.status]++;

      if (!stats.byScope[run.scope]) stats.byScope[run.scope] = 0;
      stats.byScope[run.scope]++;

      if (run.status === 'COMPLETED' && run.createdAt && run.updatedAt) {
        var duration = new Date(run.updatedAt) - new Date(run.createdAt);
        totalDuration += duration;
        completedCount++;
      }
    });

    if (completedCount > 0) {
      stats.avgDuration = Math.round(totalDuration / completedCount / 1000);
    }

    return stats;
  }

  /**
   * Delete old validation runs (cleanup)
   * @param {number} daysToKeep - Keep runs newer than this many days
   * @returns {number} Number of deleted runs
   */
  function cleanupOldValidationRuns(daysToKeep) {
    daysToKeep = daysToKeep || 90;

    var cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    var allRuns = getAllRows_(SHEET_NAME_);
    var toDelete = allRuns.filter(function(run) {
      return new Date(run.createdAt) < cutoffDate;
    });

    toDelete.forEach(function(run) {
      deleteRowById_(SHEET_NAME_, run.id);
    });

    return toDelete.length;
  }

  // Public API
  return {
    createValidationRun: createValidationRun,
    updateValidationRunResult: updateValidationRunResult,
    getValidationRunsByScope: getValidationRunsByScope,
    getValidationRunsByUser: getValidationRunsByUser,
    getValidationRunStats: getValidationRunStats,
    cleanupOldValidationRuns: cleanupOldValidationRuns
  };

})();
