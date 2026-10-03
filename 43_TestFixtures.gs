/**
 * COMPONENTE: 43_TestFixtures.gs
 * PAPEL: Fixtures determinísticas para testes.
 *
 * PRINCIPAIS FUNCIONALIDADES:
 * - dados sintéticos mínimos e limpeza segura de registros de teste;
 * - mantém o CRUD centralizado no Google Sheets identificado por SPREADSHEETS_ID;
 * - expõe apenas contratos pequenos para facilitar testes e futura substituição.
 *
 * INTEGRAÇÕES:
 * - SetupService, Repositories, Constants;
 * - Bootstrap, Constants, Config, Response e os serviços explicitamente chamados pelo corpo.
 *
 * ENTIDADES/ABAS ENVOLVIDAS:
 * - Linhas marcadas TEST_FIXTURE.
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
 * Seed basic test fixtures
 * Creates minimal test data for various tables
 */
function seedTestFixtures_() {
  ensureSchema_();
  
  const marker = 'TEST_FIXTURE';
  const fixtures = {
    studies: 0,
    comorbidades: 0
  };
  
  try {
    // Seed comorbidades (handled by repository - idempotent)
    const comorbidadesResult = seedComorbidadesCanabicas_();
    fixtures.comorbidades = comorbidadesResult.inserted || 0;
    
    // Seed a test study
    appendRecord_(APP_SHEETS.STUDIES, {
      id: newId_('test'),
      title: marker,
      objective: 'fixture',
      status: 'DRAFT',
      createdAt: nowIso_(),
      updatedAt: nowIso_()
    });
    fixtures.studies = 1;
    
  } catch (error) {
    Logger.log('ERRO ao criar fixtures: ' + error.message);
  }
  
  return {
    seeded: true,
    marker: marker,
    fixtures: fixtures
  };
}

/**
 * Remove test fixtures
 * Cleans up all data marked with TEST_ prefix or TEST_FIXTURE marker
 */
function removeTestFixtures_() {
  try {
    let removed = {
      comorbidades: 0,
      lotes: 0,
      studies: 0
    };
    
    // Clean MC-6 test data
    removed.comorbidades = deleteRowsByPrefix_('DB_COMORBIDADES_PACIENTE', 'TEST_');
    removed.lotes = deleteRowsByPrefix_('Lotes_CoA', 'TEST_LOTE_');
    
    // Note: REF_COMORBIDADES_CANABICAS seed data is NOT removed
    // (it's reference data, not test data)
    
    Logger.log('🧹 Fixtures removidos: ' + JSON.stringify(removed));
    
    return {
      removed: removed,
      message: 'Test fixtures cleaned successfully'
    };
    
  } catch (error) {
    Logger.log('ERRO ao remover fixtures: ' + error.message);
    return {
      removed: { error: error.message },
      message: 'Erro ao limpar fixtures de teste'
    };
  }
}
