/**
 * COMPONENTE: 32_EvidenceRepository.gs
 * PAPEL: Repository para entidade Evidence
 *
 * STATUS: v2.0 — Implementado
 */

const EVIDENCE_SHEET = 'Evidence';

function createEvidence_(userId, data) {
  const evidence = {
    id: generateUUID_(),
    observationId: data.observationId,
    referenceId: data.referenceId,
    type: data.type || 'SUPPORTING',
    description: data.description || '',
    confidence: data.confidence || 'MEDIUM',
    notes: data.notes || '',
    ownerId: userId,
    status: APP_STATUS.DRAFT,
    createdAt: nowIso_(),
    updatedAt: nowIso_()
  };
  return createRecord_(EVIDENCE_SHEET, evidence, userId);
}

function getEvidenceById_(id) {
  return getRecordById_(EVIDENCE_SHEET, id);
}

function listEvidence_(filters, pagination) {
  return listRecords_(EVIDENCE_SHEET, filters, pagination);
}

function getEvidenceByObservation_(observationId) {
  return searchRecords_(EVIDENCE_SHEET, { observationId: observationId });
}

function getEvidenceByReference_(referenceId) {
  return searchRecords_(EVIDENCE_SHEET, { referenceId: referenceId });
}

function updateEvidence_(id, updates, userId) {
  updates.updatedAt = nowIso_();
  return updateRecord_(EVIDENCE_SHEET, id, updates);
}

function deleteEvidence_(id) {
  return deleteRecord_(EVIDENCE_SHEET, id);
}

function getEvidenceStats_() {
  return {
    total: countActiveRecords_(EVIDENCE_SHEET),
    byType: countRecordsByStatus_(EVIDENCE_SHEET),
    timestamp: nowIso_()
  };
}

const EVIDENCE_REPOSITORY_LOADED = true;
