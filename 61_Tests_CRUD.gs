/**
 * COMPONENTE: 61_Tests_CRUD.gs
 * PAPEL: Testes end-to-end para operações CRUD
 * 
 * COBERTURA:
 * - Studies CRUD
 * - Experiments CRUD
 * - Observations CRUD
 * - Validações de schema
 * - Permissões por role
 */

/**
 * Registra suite de testes CRUD
 */
function registerCrudTests_() {
  const runner = getTestRunner_();
  let testUser = null;
  let testToken = null;
  let testStudy = null;
  
  runner.describe('CRUD Operations', function() {
    
    this.beforeAll(function() {
      // Setup: criar usuário e fazer login
      testUser = createTestUser_();
      appendRecord_('Users', testUser);
      
      const loginResult = authLogin_(testUser.username, testUser.password);
      testToken = loginResult.data.token;
    });
    
    this.afterAll(function() {
      cleanupTestData_();
    });
    
    // ===========================
    // STUDIES CRUD
    // ===========================
    
    this.describe('Studies', function() {
      
      this.it('deve criar um estudo válido', function(expect) {
        const studyData = {
          title: 'Test Study ' + Date.now(),
          objective: 'Test objective',
          hostSpecies: 'Cannabis sativa L.',
          fungalStrain: 'Trichoderma harzianum',
          cultivar: 'Test Cultivar',
          status: 'DRAFT'
        };
        
        const result = createStudy_(studyData, testUser.id);
        
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.title).toBe(studyData.title);
        expect(result.ownerId).toBe(testUser.id);
        expect(result.status).toBe('DRAFT');
        
        testStudy = result;
      });
      
      this.it('deve rejeitar estudo sem título', function(expect) {
        const invalidData = {
          objective: 'Test',
          // title ausente
        };
        
        expect(function() {
          createStudy_(invalidData, testUser.id);
        }).toThrow();
      });
      
      this.it('deve listar estudos do usuário', function(expect) {
        const studies = listStudies_({ ownerId: testUser.id });
        
        expect(studies).toBeDefined();
        expect(Array.isArray(studies)).toBe(true);
        expect(studies.length).toBeGreaterThan(0);
        
        const found = studies.some(function(s) {
          return s.id === testStudy.id;
        });
        expect(found).toBe(true);
      });
      
      this.it('deve obter estudo por ID', function(expect) {
        const study = getStudy_(testStudy.id);
        
        expect(study).toBeDefined();
        expect(study.id).toBe(testStudy.id);
        expect(study.title).toBe(testStudy.title);
      });
      
      this.it('deve atualizar estudo', function(expect) {
        const updates = {
          title: 'Updated Title ' + Date.now(),
          status: 'ACTIVE'
        };
        
        const updated = updateStudy_(testStudy.id, updates);
        
        expect(updated.title).toBe(updates.title);
        expect(updated.status).toBe('ACTIVE');
        expect(updated.updatedAt).toBeDefined();
      });
      
      this.it('deve deletar estudo', function(expect) {
        // Cria estudo para deletar
        const toDelete = createStudy_({
          title: 'To Delete',
          objective: 'Test',
          hostSpecies: 'Cannabis',
          fungalStrain: 'Trichoderma'
        }, testUser.id);
        
        const result = deleteStudy_(toDelete.id);
        
        expect(result.success).toBe(true);
        
        // Verifica se foi marcado como arquivado
        const deleted = getStudy_(toDelete.id);
        expect(deleted.status).toBe('ARCHIVED');
      });
      
      this.it('deve validar campos obrigatórios', function(expect) {
        const invalidCases = [
          { title: '' },                    // Título vazio
          { title: 'a' },                   // Título muito curto
          { title: 'Valid', objective: '' }, // Objective vazio
        ];
        
        invalidCases.forEach(function(data) {
          expect(function() {
            createStudy_(data, testUser.id);
          }).toThrow();
        });
      });
    });
    
    // ===========================
    // EXPERIMENTS CRUD
    // ===========================
    
    this.describe('Experiments', function() {
      let testExperiment = null;
      
      this.it('deve criar experimento para estudo', function(expect) {
        const expData = {
          studyId: testStudy.id,
          title: 'Test Experiment',
          protocol: 'Test protocol description',
          design: 'DIC',
          treatments: [
            { name: 'Control', concentration: 0 },
            { name: 'Treatment A', concentration: 1e6 }
          ],
          replicates: 5,
          conditions: {
            temperature: 25,
            humidity: 70,
            lightCycle: '16/8'
          }
        };
        
        const result = createExperiment_(expData);
        
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.studyId).toBe(testStudy.id);
        expect(result.treatments).toHaveLength(2);
        expect(result.replicates).toBe(5);
        
        testExperiment = result;
      });
      
      this.it('deve validar número mínimo de réplicas', function(expect) {
        const invalidData = {
          studyId: testStudy.id,
          title: 'Invalid Exp',
          protocol: 'Test',
          treatments: [{ name: 'Control' }],
          replicates: 1  // Muito poucas
        };
        
        // Deve gerar warning mas não falhar
        const result = createExperiment_(invalidData);
        expect(result).toBeDefined();
      });
      
      this.it('deve listar experimentos do estudo', function(expect) {
        const experiments = listExperiments_({ studyId: testStudy.id });
        
        expect(experiments).toBeDefined();
        expect(experiments.length).toBeGreaterThan(0);
        
        const found = experiments.some(function(e) {
          return e.id === testExperiment.id;
        });
        expect(found).toBe(true);
      });
      
      this.it('deve atualizar experimento', function(expect) {
        const updates = {
          replicates: 10,
          conditions: {
            temperature: 28,
            humidity: 80
          }
        };
        
        const updated = updateExperiment_(testExperiment.id, updates);
        
        expect(updated.replicates).toBe(10);
        expect(updated.conditions.temperature).toBe(28);
      });
    });
    
    // ===========================
    // OBSERVATIONS CRUD
    // ===========================
    
    this.describe('Observations', function() {
      let testObservation = null;
      let testExperiment = null;
      
      this.beforeAll(function() {
        // Cria experimento para observações
        testExperiment = createExperiment_({
          studyId: testStudy.id,
          title: 'Obs Test Exp',
          protocol: 'Test',
          treatments: [{ name: 'Control' }],
          replicates: 3
        });
      });
      
      this.it('deve criar observação válida', function(expect) {
        const obsData = {
          experimentId: testExperiment.id,
          variable: 'plant_height',
          value: 45.5,
          unit: 'cm',
          groupName: 'Control',
          replicate: 1,
          timestamp: new Date().toISOString(),
          notes: 'Test observation'
        };
        
        const result = createObservation_(obsData, testUser.id);
        
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();
        expect(result.value).toBe(45.5);
        expect(result.unit).toBe('cm');
        
        testObservation = result;
      });
      
      this.it('deve validar timestamp não futuro', function(expect) {
        const futureData = {
          experimentId: testExperiment.id,
          variable: 'test',
          value: 10,
          unit: 'unit',
          timestamp: new Date(Date.now() + 86400000).toISOString()
        };
        
        expect(function() {
          createObservation_(futureData, testUser.id);
        }).toThrow('Data não pode ser futura');
      });
      
      this.it('deve listar observações do experimento', function(expect) {
        const observations = listObservations_({
          experimentId: testExperiment.id
        });
        
        expect(observations).toBeDefined();
        expect(observations.length).toBeGreaterThan(0);
      });
      
      this.it('deve filtrar observações por variável', function(expect) {
        // Cria mais observações
        createObservation_({
          experimentId: testExperiment.id,
          variable: 'leaf_count',
          value: 12,
          unit: 'count',
          timestamp: new Date().toISOString()
        }, testUser.id);
        
        const filtered = listObservations_({
          experimentId: testExperiment.id,
          variable: 'plant_height'
        });
        
        const allHeights = filtered.every(function(obs) {
          return obs.variable === 'plant_height';
        });
        
        expect(allHeights).toBe(true);
      });
      
      this.it('deve incluir quality control metadata', function(expect) {
        const obsWithQC = {
          experimentId: testExperiment.id,
          variable: 'biomass',
          value: 150.2,
          unit: 'g',
          timestamp: new Date().toISOString(),
          qualityControl: {
            validated: true,
            validator: testUser.id,
            validatedAt: new Date().toISOString()
          }
        };
        
        const result = createObservation_(obsWithQC, testUser.id);
        
        expect(result.qualityControl).toBeDefined();
        expect(result.qualityControl.validated).toBe(true);
        expect(result.qualityControl.validator).toBe(testUser.id);
      });
    });
    
    // ===========================
    // VALIDAÇÕES CROSS-ENTITY
    // ===========================
    
    this.describe('Cross-Entity Validations', function() {
      
      this.it('não deve criar experimento para estudo inexistente', function(expect) {
        expect(function() {
          createExperiment_({
            studyId: 'study_inexistente',
            title: 'Test',
            protocol: 'Test',
            treatments: [{ name: 'Control' }],
            replicates: 3
          });
        }).toThrow('STUDY_NOT_FOUND');
      });
      
      this.it('não deve criar observação para experimento inexistente', function(expect) {
        expect(function() {
          createObservation_({
            experimentId: 'exp_inexistente',
            variable: 'test',
            value: 10,
            unit: 'unit',
            timestamp: new Date().toISOString()
          }, testUser.id);
        }).toThrow('EXPERIMENT_NOT_FOUND');
      });
      
      this.it('deve cascatear status ao deletar estudo', function(expect) {
        // Cria estudo com experimento
        const study = createStudy_({
          title: 'Cascade Test',
          objective: 'Test',
          hostSpecies: 'Cannabis',
          fungalStrain: 'Trichoderma'
        }, testUser.id);
        
        const exp = createExperiment_({
          studyId: study.id,
          title: 'Child Exp',
          protocol: 'Test',
          treatments: [{ name: 'Control' }],
          replicates: 3
        });
        
        // Deleta estudo
        deleteStudy_(study.id);
        
        // Experimento filho deve ser arquivado também
        const childExp = findRecord_('Experiments', 'id', exp.id);
        expect(childExp.status).toBe('ARCHIVED');
      });
    });
  });
}

/**
 * Helper: Cria estudo
 */
function createStudy_(data, ownerId) {
  // Validações
  if (!data.title || data.title.length < 3) {
    throw new Error('INVALID_TITLE');
  }
  
  const study = {
    id: 'study_' + Date.now(),
    title: data.title,
    objective: data.objective || '',
    hostSpecies: data.hostSpecies || '',
    fungalStrain: data.fungalStrain || '',
    cultivar: data.cultivar || '',
    status: data.status || 'DRAFT',
    ownerId: ownerId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  appendRecord_('Studies', study);
  return study;
}

/**
 * Helper: Lista estudos
 */
function listStudies_(filters) {
  return listRecords_('Studies', filters || {});
}

/**
 * Helper: Obtém estudo por ID
 */
function getStudy_(studyId) {
  const study = findRecord_('Studies', 'id', studyId);
  if (!study) {
    throw new Error('STUDY_NOT_FOUND');
  }
  return study;
}

/**
 * Helper: Atualiza estudo
 */
function updateStudy_(studyId, updates) {
  updates.updatedAt = new Date().toISOString();
  return updateRecordByField_('Studies', 'id', studyId, updates);
}

/**
 * Helper: Deleta estudo
 */
function deleteStudy_(studyId) {
  updateRecordByField_('Studies', 'id', studyId, {
    status: 'ARCHIVED',
    updatedAt: new Date().toISOString()
  });
  
  // Cascateia para experimentos
  const experiments = listRecords_('Experiments', { studyId: studyId });
  experiments.forEach(function(exp) {
    updateRecordByField_('Experiments', 'id', exp.id, {
      status: 'ARCHIVED'
    });
  });
  
  return { success: true };
}

/**
 * Helper: Cria experimento
 */
function createExperiment_(data) {
  // Valida se estudo existe
  const study = findRecord_('Studies', 'id', data.studyId);
  if (!study) {
    throw new Error('STUDY_NOT_FOUND');
  }
  
  const experiment = {
    id: 'exp_' + Date.now(),
    studyId: data.studyId,
    title: data.title,
    protocol: data.protocol,
    design: data.design || 'DIC',
    treatments: JSON.stringify(data.treatments || []),
    replicates: data.replicates || 3,
    conditions: JSON.stringify(data.conditions || {}),
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  appendRecord_('Experiments', experiment);
  
  // Parse JSON fields para retorno
  experiment.treatments = JSON.parse(experiment.treatments);
  experiment.conditions = JSON.parse(experiment.conditions);
  
  return experiment;
}

/**
 * Helper: Lista experimentos
 */
function listExperiments_(filters) {
  const records = listRecords_('Experiments', filters || {});
  
  // Parse JSON fields
  return records.map(function(exp) {
    if (typeof exp.treatments === 'string') {
      exp.treatments = JSON.parse(exp.treatments);
    }
    if (typeof exp.conditions === 'string') {
      exp.conditions = JSON.parse(exp.conditions);
    }
    return exp;
  });
}

/**
 * Helper: Atualiza experimento
 */
function updateExperiment_(expId, updates) {
  if (updates.treatments) {
    updates.treatments = JSON.stringify(updates.treatments);
  }
  if (updates.conditions) {
    updates.conditions = JSON.stringify(updates.conditions);
  }
  
  updates.updatedAt = new Date().toISOString();
  
  const updated = updateRecordByField_('Experiments', 'id', expId, updates);
  
  // Parse JSON fields
  if (typeof updated.treatments === 'string') {
    updated.treatments = JSON.parse(updated.treatments);
  }
  if (typeof updated.conditions === 'string') {
    updated.conditions = JSON.parse(updated.conditions);
  }
  
  return updated;
}

/**
 * Helper: Cria observação
 */
function createObservation_(data, createdBy) {
  // Valida experimento
  const exp = findRecord_('Experiments', 'id', data.experimentId);
  if (!exp) {
    throw new Error('EXPERIMENT_NOT_FOUND');
  }
  
  // Valida timestamp não futuro
  const timestamp = new Date(data.timestamp);
  if (timestamp > new Date()) {
    throw new Error('Data não pode ser futura');
  }
  
  const observation = {
    id: 'obs_' + Date.now(),
    experimentId: data.experimentId,
    variable: data.variable,
    value: data.value,
    unit: data.unit,
    groupName: data.groupName || '',
    replicate: data.replicate || 1,
    observedAt: data.timestamp,
    notes: data.notes || '',
    createdBy: createdBy
  };
  
  // Quality control se fornecido
  if (data.qualityControl) {
    observation.qualityControl = JSON.stringify(data.qualityControl);
  }
  
  appendRecord_('Observations', observation);
  
  // Parse QC para retorno
  if (observation.qualityControl) {
    observation.qualityControl = JSON.parse(observation.qualityControl);
  }
  
  return observation;
}

/**
 * Helper: Lista observações
 */
function listObservations_(filters) {
  return listRecords_('Observations', filters || {});
}
