/**
 * COMPONENTE: 30_ReferenceRepository.gs
 * PAPEL: Repository para entidade Reference
 *
 * STATUS: v2.0 — Implementado
 */

const REFERENCES_SHEET = 'References';

function createReference_(userId, data) {
  const reference = {
    id: generateUUID_(),
    title: data.title,
    authors: data.authors || '',
    year: data.year || new Date().getFullYear(),
    doi: data.doi || '',
    pubMedId: data.pubMedId || '',
    url: data.url || '',
    journal: data.journal || '',
    volume: data.volume || '',
    issue: data.issue || '',
    pages: data.pages || '',
    type: data.type || 'JOURNAL',
    abstract: data.abstract || '',
    keywords: data.keywords || '',
    ownerId: userId,
    status: APP_STATUS.DRAFT,
    createdAt: nowIso_(),
    updatedAt: nowIso_()
  };
  return createRecord_(REFERENCES_SHEET, reference, userId);
}

function getReferenceById_(id) {
  return getRecordById_(REFERENCES_SHEET, id);
}

function listReferences_(filters, pagination) {
  return listRecords_(REFERENCES_SHEET, filters, pagination);
}

function getReferencesByYear_(year) {
  return searchRecords_(REFERENCES_SHEET, { year: year });
}

function searchReferencesByTitle_(pattern) {
  return searchRecordsByPattern_(REFERENCES_SHEET, 'title', pattern);
}

function searchReferencesByDOI_(doi) {
  return searchRecords_(REFERENCES_SHEET, { doi: doi });
}

function updateReference_(id, updates, userId) {
  updates.updatedAt = nowIso_();
  return updateRecord_(REFERENCES_SHEET, id, updates);
}

function deleteReference_(id) {
  return deleteRecord_(REFERENCES_SHEET, id);
}

function getReferenceStats_() {
  return {
    total: countActiveRecords_(REFERENCES_SHEET),
    byType: countRecordsByStatus_(REFERENCES_SHEET),
    timestamp: nowIso_()
  };
}

const REFERENCE_REPOSITORY_LOADED = true;
