/**
 * COMPONENTE: 26_ComorbidadeRepository.gs
 * PAPEL: Repositório de Comorbidades Canábicas (MC-1)
 * 
 * FUNCIONALIDADES:
 * - Seed das 46 comorbidades do catálogo canônico
 * - Salvar seleção de comorbidades do paciente (até 5)
 * - Validar conformidade de CoA de lote vs. grau exigido
 * - Cálculo de grau máximo de rigor de CoA
 * 
 * DEPENDÊNCIAS:
 * - 14_SpreadsheetGateway.gs (I/O)
 * - 16_LockService.gs (atomicidade)
 * - 13_AuditService.gs (auditoria)
 * - 01_Constants.gs (schema + enums)
 * 
 * STATUS: v1.0 — PROMPT MC-1
 * DATA: 2026-10-01
 */

// ============================================================================
// SEED DO CATÁLOGO DE 46 COMORBIDADES
// ============================================================================

/**
 * Popula tabela REF_COMORBIDADES_CANABICAS com as 46 comorbidades
 * @returns {Object} {ok: boolean, inserted: number, errors: array}
 */
function seedComorbidadesCanabicas_() {
  try {
    const sheetName = SHEET_SCHEMA.REF_COMORBIDADES_CANABICAS.sheetName;
    
    // Verificar se já está populado (previne duplicação)
    const existentes = getAllRecords_(sheetName);
    if (existentes && existentes.length === 46) {
      Logger.log('SEED COMORBIDADES: Tabela já populada com 46 registros');
      return {ok: true, inserted: 0, message: 'Tabela já populada'};
    }
    
    // Se quantidade está incorreta, limpar e re-seed
    if (existentes && existentes.length > 0 && existentes.length !== 46) {
      Logger.log('AVISO: ' + existentes.length + ' registros encontrados. Limpando antes de re-seed...');
      const ss = getSpreadsheet_();
      const sheet = ss.getSheetByName(sheetName);
      if (sheet) {
        // Deletar todas as linhas de dados (manter header)
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          sheet.deleteRows(2, lastRow - 1);
        }
      }
    }
    
    Logger.log('SEED COMORBIDADES: Iniciando população de 46 comorbidades...');
    
    // Dados das 46 comorbidades (fonte: prompts.md + MC_COMORBIDADES_MATRIX.md)
    const comorbidades = getComorbidadesCanonicalData_();
    
    // Inserir via SpreadsheetGateway
    const ss = getSpreadsheet_();    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error('Aba REF_COMORBIDADES_CANABICAS não existe. Execute setupProject_() primeiro.');
    }
    
    let inserted = 0;
    const errors = [];
    
    comorbidades.forEach(function(c, index) {
      try {
        // Validar estrutura
        if (!c.id || !c.codigo || !c.grau_coa_exigido) {
          throw new Error('Comorbidade ' + (index + 1) + ' com dados incompletos');
        }
        
        // Validar estudos prioritários (JSON válido)
        if (c.id !== 46 && (!c.estudos_prioritarios_json || c.estudos_prioritarios_json === '[]')) {
          Logger.log('AVISO: Comorbidade ' + c.id + ' sem estudos prioritários');
        }
        
        // Preparar row
        const row = [
          c.id,
          c.codigo,
          c.nome_terapeutica,
          c.indicacao,
          c.triagem,
          c.cid10_sugerido,
          c.total_evidencias,
          c.estudos_prioritarios_json,
          c.quimiotipo_alvo,
          c.terpenos_focalizados,
          c.manejo_solo_ideal,
          c.grau_coa_exigido,
          c.limites_criticos_coa,
          c.mecanismo_agro_saude,
          c.descricao_curta,
          c.ativo
        ];
        
        sheet.appendRow(row);
        inserted++;
        
      } catch (err) {
        errors.push('Comorbidade ' + (index + 1) + ': ' + err.message);
        Logger.log('ERRO ao inserir comorbidade ' + (index + 1) + ': ' + err.message);
      }
    });
    
    Logger.log('SEED COMORBIDADES: Concluído. Inseridas ' + inserted + ' de 46 comorbidades');
    
    // Registrar auditoria
    auditCreate_(sheetName, {count: inserted}, 'SYSTEM', {
      action: 'SEED_COMORBIDADES',
      total: 46,
      inserted: inserted,
      errors: errors.length
    });
    
    return {
      ok: true,
      inserted: inserted,
      errors: errors
    };
    
  } catch (error) {
    Logger.log('ERRO CRÍTICO no seed de comorbidades: ' + error.message);
    return {
      ok: false,
      error: 'SEED_ERROR',
      message: error.message,
      errors: []
    };
  }
}

// ============================================================================
// SALVAR COMORBIDADES DO PACIENTE
// ============================================================================

/**
 * Salva seleção de comorbidades do paciente (operação transacional)
 * @param {string} pacienteId - UUID do paciente
 * @param {Array} selecoes - Array de {comorbidade_id, prioridade, outra_descricao?, nota_medica?}
 * @returns {Object} {ok: boolean, saved: array, grau_coa_maximo: string}
 */
function salvarComorbidadesPaciente_(pacienteId, selecoes) {
  const lock = LockService.getScriptLock();
  
  try {
    // 1. VALIDAÇÃO DE ENTRADA
    if (!pacienteId || typeof pacienteId !== 'string') {
      return {ok: false, error: 'VALIDATION_ERROR', message: 'pacienteId inválido'};
    }
    
    if (!Array.isArray(selecoes) || selecoes.length < 1 || selecoes.length > 5) {
      return {ok: false, error: 'VALIDATION_ERROR', message: 'Selecione de 1 a 5 comorbidades'};
    }
    
    // Validar prioridades únicas
    const prioridades = selecoes.map(function(s) { return s.prioridade; });
    const prioridadesSet = {};
    for (var i = 0; i < prioridades.length; i++) {
      if (prioridadesSet[prioridades[i]]) {
        return {ok: false, error: 'VALIDATION_ERROR', message: 'Prioridades devem ser únicas'};
      }
      prioridadesSet[prioridades[i]] = true;
    }
    
    // Validar "outra condição" (ID 46)
    const temOutra = selecoes.some(function(s) { return parseInt(s.comorbidade_id) === 46; });
    if (temOutra) {
      const outra = selecoes.find(function(s) { return parseInt(s.comorbidade_id) === 46; });
      if (!outra.outra_descricao || outra.outra_descricao.length < 5) {
        return {ok: false, error: 'VALIDATION_ERROR', message: 'Campo "Outra condição" requer descrição de no mínimo 5 caracteres'};
      }
    }
    
    // 2. OBTER LOCK (atomicidade)
    const hasLock = lock.tryLock(10000); // 10 segundos
    
    if (!hasLock) {
      return {ok: false, error: 'LOCK_TIMEOUT', message: 'Sistema ocupado. Tente novamente em alguns segundos.'};
    }
    
    // 3. BUSCAR DADOS COMPLETOS DAS COMORBIDADES SELECIONADAS
    const catalogoCompleto = getAllRecords_('REF_COMORBIDADES_CANABICAS');
    const comorbidadesSelecionadas = [];
    
    for (var i = 0; i < selecoes.length; i++) {
      const sel = selecoes[i];
      const comorbidadeRef = catalogoCompleto.find(function(c) {
        return parseInt(c.id) === parseInt(sel.comorbidade_id);
      });
      
      if (!comorbidadeRef) {
        lock.releaseLock();
        return {ok: false, error: 'NOT_FOUND', message: 'Comorbidade ID ' + sel.comorbidade_id + ' não encontrada no catálogo'};
      }
      
      comorbidadesSelecionadas.push({
        selecao: sel,
        referencia: comorbidadeRef
      });
    }
    
    // 4. CALCULAR GRAU MÁXIMO DE COA
    const grauMax = calcularGrauCoAMaximo_(comorbidadesSelecionadas.map(function(c) {
      return c.referencia;
    }));
    
    Logger.log('COMORBIDADES PACIENTE: Grau máximo de CoA calculado = ' + grauMax);
    
    // 5. DELETAR REGISTROS ANTIGOS DO PACIENTE
    deleteComorbidadesPaciente_(pacienteId);
    
    // 6. INSERIR NOVOS REGISTROS COM DADOS DENORMALIZADOS
    const sheetName = SHEET_SCHEMA.DB_COMORBIDADES_PACIENTE.sheetName;
    const ss = getSpreadsheet_();    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      lock.releaseLock();
      throw new Error('Aba DB_COMORBIDADES_PACIENTE não existe');
    }
    
    const saved = [];
    const now = new Date().toISOString();
    
    for (var i = 0; i < comorbidadesSelecionadas.length; i++) {
      const item = comorbidadesSelecionadas[i];
      const sel = item.selecao;
      const ref = item.referencia;
      
      const record = {
        id: Utilities.getUuid(),
        paciente_id: pacienteId,
        comorbidade_id: ref.id,
        prioridade: sel.prioridade,
        outra_descricao: sel.outra_descricao || '',
        quimiotipo_sugerido: ref.quimiotipo_alvo,
        solo_recomendado: ref.manejo_solo_ideal,
        grau_coa_obrigatorio: ref.grau_coa_exigido,
        evidencias_resumo_json: ref.estudos_prioritarios_json,
        nota_medica: sel.nota_medica || '',
        criado_em: now,
        atualizado_em: now
      };
      
      const row = [
        record.id,
        record.paciente_id,
        record.comorbidade_id,
        record.prioridade,
        record.outra_descricao,
        record.quimiotipo_sugerido,
        record.solo_recomendado,
        record.grau_coa_obrigatorio,
        record.evidencias_resumo_json,
        record.nota_medica,
        record.criado_em,
        record.atualizado_em
      ];
      
      sheet.appendRow(row);
      saved.push(record);
    }
    
    Logger.log('COMORBIDADES PACIENTE: Salvos ' + saved.length + ' registros para paciente ' + pacienteId);
    
    // 7. REGISTRAR AUDITORIA
    auditCreate_(sheetName, saved, pacienteId, {
      action: 'SALVAR_COMORBIDADES',
      paciente_id: pacienteId,
      total_selecoes: selecoes.length,
      grau_coa_maximo: grauMax
    });
    
    return {
      ok: true,
      saved: saved,
      grau_coa_maximo: grauMax
    };
    
  } catch (error) {
    Logger.log('ERRO ao salvar comorbidades do paciente: ' + error.message);
    return {
      ok: false,
      error: 'SAVE_ERROR',
      message: error.message
    };
    
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// BUSCAR COMORBIDADES DO PACIENTE
// ============================================================================

/**
 * Busca comorbidades do paciente ordenadas por prioridade
 * @param {string} pacienteId - UUID do paciente
 * @returns {Array} Lista de comorbidades ordenadas por prioridade
 */
function getComorbidadesPaciente_(pacienteId) {
  try {
    const sheetName = SHEET_SCHEMA.DB_COMORBIDADES_PACIENTE.sheetName;
    const records = getAllRecords_(sheetName);
    
    const comorbidadesPaciente = records.filter(function(r) {
      return r.paciente_id === pacienteId;
    });
    
    // Ordenar por prioridade (crescente)
    comorbidadesPaciente.sort(function(a, b) {
      return parseInt(a.prioridade) - parseInt(b.prioridade);
    });
    
    return comorbidadesPaciente;
    
  } catch (error) {
    Logger.log('ERRO ao buscar comorbidades do paciente: ' + error.message);
    return [];
  }
}

// ============================================================================
// VALIDAR CONFORMIDADE DE COA DE LOTE
// ============================================================================

/**
 * Valida se lote de CoA atende aos requisitos das comorbidades do paciente
 * @param {string} pacienteId - UUID do paciente
 * @param {string} loteCoAId - UUID do lote em Lotes_CoA
 * @returns {Object} {apto: boolean, grau_exigido: string, motivos_bloqueio: array, dados_lote: object}
 */
function validarConformidadeCoALote_(pacienteId, loteCoAId) {
  try {
    // 1. BUSCAR COMORBIDADES DO PACIENTE
    const comorbidadesPaciente = getComorbidadesPaciente_(pacienteId);
    
    if (comorbidadesPaciente.length === 0) {
      return {
        ok: false,
        apto: null,
        motivos_bloqueio: [],
        error: 'NO_COMORBIDADES',
        message: 'Paciente não possui comorbidades cadastradas'
      };
    }
    
    // 2. CALCULAR GRAU MÁXIMO EXIGIDO
    const grauExigido = comorbidadesPaciente[0].grau_coa_obrigatorio; // Já vem denormalizado
    
    // Recalcular para garantir hierarquia correta
    const grausUnicos = {};
    comorbidadesPaciente.forEach(function(c) {
      grausUnicos[c.grau_coa_obrigatorio] = true;
    });
    
    const grauMaximo = calcularGrauCoAMaximoDeEnums_(Object.keys(grausUnicos));
    
    Logger.log('VALIDAÇÃO CoA: Paciente exige grau ' + grauMaximo);
    
    // 3. BUSCAR LOTE
    const lote = getLoteCoAById_(loteCoAId);
    
    if (!lote) {
      return {
        ok: false,
        apto: null,
        motivos_bloqueio: [],
        error: 'LOTE_NOT_FOUND',
        message: 'Lote de CoA não encontrado: ' + loteCoAId
      };
    }
    
    Logger.log('VALIDAÇÃO CoA: Lote ' + lote.numeroLote + ' | Status: ' + lote.statusLiberacao);
    
    // 4. APLICAR REGRAS DE CONFORMIDADE POR GRAU
    let apto = true;
    const motivos_bloqueio = [];
    const comorbidades_criticas = [];
    
    // Identificar comorbidades que exigem o grau mais alto
    comorbidadesPaciente.forEach(function(c) {
      if (c.grau_coa_obrigatorio === grauMaximo) {
        comorbidades_criticas.push({
          id: c.comorbidade_id,
          nome: 'Comorbidade ID ' + c.comorbidade_id,
          grau: c.grau_coa_obrigatorio
        });
      }
    });
    
    // GRAU 1 - ESTRITO (pediátrico/oncológico)
    if (grauMaximo === GRAU_COA.GRAU_1_ESTRITO) {
      const limites = {
        Pb: 0.2,
        Cd: 0.1,
        As: 0.1,
        Hg: 0.05
      };
      
      if (parseFloat(lote.teor_Pb_ppm) > limites.Pb) {
        motivos_bloqueio.push('Chumbo (Pb) ' + lote.teor_Pb_ppm + ' ppm > ' + limites.Pb + ' ppm: risco neurotóxico para paciente vulnerável');
        apto = false;
      }
      
      if (parseFloat(lote.teor_Cd_ppm) > limites.Cd) {
        motivos_bloqueio.push('Cádmio (Cd) ' + lote.teor_Cd_ppm + ' ppm > ' + limites.Cd + ' ppm: risco de lesão renal e hepática');
        apto = false;
      }
      
      if (parseFloat(lote.teor_As_ppm) > limites.As) {
        motivos_bloqueio.push('Arsênio (As) ' + lote.teor_As_ppm + ' ppm > ' + limites.As + ' ppm: risco carcinogênico');
        apto = false;
      }
      
      if (parseFloat(lote.teor_Hg_ppm) > limites.Hg) {
        motivos_bloqueio.push('Mercúrio (Hg) ' + lote.teor_Hg_ppm + ' ppm > ' + limites.Hg + ' ppm: risco de dano neurológico');
        apto = false;
      }
      
      if (lote.statusLiberacao !== COA_STATUS_LIBERACAO.LIBERADO) {
        motivos_bloqueio.push('Lote não está liberado: status atual = ' + lote.statusLiberacao);
        apto = false;
      }
    }
    
    // GRAU 2 - PADRÃO
    else if (grauMaximo === GRAU_COA.GRAU_2_PADRAO) {
      const limites = {
        Pb: 0.5,
        Cd: 0.2
      };
      
      if (parseFloat(lote.teor_Pb_ppm) > limites.Pb) {
        motivos_bloqueio.push('Chumbo (Pb) ' + lote.teor_Pb_ppm + ' ppm > ' + limites.Pb + ' ppm (limite padrão clínico)');
        apto = false;
      }
      
      if (parseFloat(lote.teor_Cd_ppm) > limites.Cd) {
        motivos_bloqueio.push('Cádmio (Cd) ' + lote.teor_Cd_ppm + ' ppm > ' + limites.Cd + ' ppm (limite padrão clínico)');
        apto = false;
      }
      
      if (lote.statusLiberacao !== COA_STATUS_LIBERACAO.LIBERADO) {
        motivos_bloqueio.push('Lote não está liberado: status atual = ' + lote.statusLiberacao);
        apto = false;
      }
    }
    
    // GRAU 3 - NEUROPSIQUIÁTRICO (validação de THC adicional se disponível)
    else if (grauMaximo === GRAU_COA.GRAU_3_NEUROPSIQUIATRICO) {
      // Validação básica de liberação
      if (lote.statusLiberacao !== COA_STATUS_LIBERACAO.LIBERADO) {
        motivos_bloqueio.push('Lote não está liberado: status atual = ' + lote.statusLiberacao);
        apto = false;
      }
      
      // TODO: Validar THC < 0.2% quando campo estiver disponível em Lotes_CoA
    }
    
    // GRAU 4 - TÓPICO (validação microbiológica)
    else if (grauMaximo === GRAU_COA.GRAU_4_TOPICO) {
      if (lote.statusLiberacao !== COA_STATUS_LIBERACAO.LIBERADO) {
        motivos_bloqueio.push('Lote não está liberado para uso tópico: status atual = ' + lote.statusLiberacao);
        apto = false;
      }
    }
    
    // 5. RETORNAR RESULTADO
    return {
      ok: true,
      apto: apto,
      grau_exigido: grauMaximo,
      grau_lote: lote.statusAuditoria,
      motivos_bloqueio: motivos_bloqueio,
      comorbidades_criticas: comorbidades_criticas,
      teores_detectados: {
        Pb: parseFloat(lote.teor_Pb_ppm),
        Cd: parseFloat(lote.teor_Cd_ppm),
        As: parseFloat(lote.teor_As_ppm),
        Hg: parseFloat(lote.teor_Hg_ppm)
      },
      dados_lote: {
        id: lote.id,
        numeroLote: lote.numeroLote,
        insumoId: lote.insumoId,
        teor_Pb_ppm: lote.teor_Pb_ppm,
        teor_Cd_ppm: lote.teor_Cd_ppm,
        teor_As_ppm: lote.teor_As_ppm,
        teor_Hg_ppm: lote.teor_Hg_ppm,
        statusLiberacao: lote.statusLiberacao,
        statusAuditoria: lote.statusAuditoria
      }
    };
    
  } catch (error) {
    Logger.log('ERRO ao validar conformidade de CoA: ' + error.message);
    return {
      ok: false,
      apto: null,
      motivos_bloqueio: [],
      error: 'VALIDATION_ERROR',
      message: error.message
    };
  }
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Calcula grau máximo de CoA entre um array de comorbidades
 * Hierarquia: GRAU_1 > GRAU_3 > GRAU_2 > GRAU_4
 */
function calcularGrauCoAMaximo_(comorbidades) {
  const hierarquia = {
    'GRAU_1_ESTRITO': 4,
    'GRAU_3_NEUROPSIQUIATRICO': 3,
    'GRAU_2_PADRAO': 2,
    'GRAU_4_TOPICO': 1,
    'AVALIADO_MEDICO': 0
  };
  
  let grauMax = 'GRAU_4_TOPICO';
  let pesoMax = 1;
  
  comorbidades.forEach(function(c) {
    const grau = c.grau_coa_exigido;
    const peso = hierarquia[grau] || 0;
    
    if (peso > pesoMax) {
      pesoMax = peso;
      grauMax = grau;
    }
  });
  
  return grauMax;
}

/**
 * Calcula grau máximo de CoA a partir de array de strings de enums
 */
function calcularGrauCoAMaximoDeEnums_(grausArray) {
  const hierarquia = {
    'GRAU_1_ESTRITO': 4,
    'GRAU_3_NEUROPSIQUIATRICO': 3,
    'GRAU_2_PADRAO': 2,
    'GRAU_4_TOPICO': 1,
    'AVALIADO_MEDICO': 0
  };
  
  let grauMax = 'GRAU_4_TOPICO';
  let pesoMax = 1;
  
  grausArray.forEach(function(grau) {
    const peso = hierarquia[grau] || 0;
    if (peso > pesoMax) {
      pesoMax = peso;
      grauMax = grau;
    }
  });
  
  return grauMax;
}

/**
 * Deleta comorbidades anteriores do paciente
 * @private
 */
function deleteComorbidadesPaciente_(pacienteId) {
  try {
    const sheetName = SHEET_SCHEMA.DB_COMORBIDADES_PACIENTE.sheetName;
    const ss = getSpreadsheet_();    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) return;
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const pacienteIdColIndex = headers.indexOf('paciente_id');
    
    if (pacienteIdColIndex === -1) {
      Logger.log('AVISO: Coluna paciente_id não encontrada em DB_COMORBIDADES_PACIENTE');
      return;
    }
    
    // Iterar de baixo para cima (para evitar problemas de índice ao deletar)
    for (var i = data.length - 1; i > 0; i--) {
      if (data[i][pacienteIdColIndex] === pacienteId) {
        sheet.deleteRow(i + 1);
        Logger.log('Deletada linha ' + (i + 1) + ' de comorbidade do paciente ' + pacienteId);
      }
    }
    
  } catch (error) {
    Logger.log('ERRO ao deletar comorbidades do paciente: ' + error.message);
  }
}

/**
 * Busca lote de CoA por ID
 * @private
 */
function getLoteCoAById_(loteId) {
  try {
    const lotes = getAllRecords_('Lotes_CoA');
    return lotes.find(function(l) {
      return l.id === loteId;
    });
  } catch (error) {
    Logger.log('ERRO ao buscar lote de CoA: ' + error.message);
    return null;
  }
}

/**
 * Retorna dados canônicos das 46 comorbidades
 * Fonte: prompts.md + MC_COMORBIDADES_MATRIX.md
 * @private
 */
function getComorbidadesCanonicalData_() {
  // Dados das 46 comorbidades
  // Fonte: Matriz Canônica do prompts.md v5.0.0
  
  return [
    // ID 1: Antiepilética (Dravet/LGS)
    {
      id: 1,
      codigo: 'CANABICA_ANTIEPILEPTICA',
      nome_terapeutica: 'canábica antiepilética',
      indicacao: 'epilepsias refratárias, síndrome de Dravet e Lennox-Gastaut',
      triagem: 'B',
      cid10_sugerido: 'G40',
      total_evidencias: 22,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Cannabidiol for drug-resistant epilepsy',
          url: 'https://doi.org/10.1016/j.seizure.2025.04.017',
          doi: '10.1016/j.seizure.2025.04.017',
          pmid: '39270448',
          tipo_estudo: 'Ensaio Clínico Randomizado',
          ano: 2025,
          grau_oxford: '1B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Linalol',
      manejo_solo_ideal: 'HIDROPONIA_MINERAL',
      grau_coa_exigido: 'GRAU_1_ESTRITO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.2,
        max_Cd_ppm: 0.1,
        max_As_ppm: 0.1,
        max_Hg_ppm: 0.05,
        thc_max_pct: null,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Hidroponia de precisão elimina metais pesados do substrato, garantindo CBD purificado para controle de crises sem neurotoxinas. Linalol atua em canais GABA-A potencializando efeito anticonvulsivante.',
      descricao_curta: 'Redução de crises epilépticas refratárias com CBD purificado e livre de metais pesados',
      ativo: true
    },
    
    // ID 2: Antiespasmódica (Esclerose Múltipla)
    {
      id: 2,
      codigo: 'CANABICA_ANTIESPASMODICA',
      nome_terapeutica: 'canábica antiespasmódica',
      indicacao: 'espasticidade na esclerose múltipla',
      triagem: 'B',
      cid10_sugerido: 'G35',
      total_evidencias: 12,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Cannabis for spasticity in multiple sclerosis',
          url: 'https://doi.org/10.3390/medsci14030346',
          doi: '10.3390/medsci14030346',
          pmid: '',
          tipo_estudo: 'Revisão Sistemática',
          ano: 2024,
          grau_oxford: '2A'
        }
      ]),
      quimiotipo_alvo: 'TIPO_II_EQUILIBRADO',
      terpenos_focalizados: 'Mirceno, Cariofileno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Solo vivo orgânico estimula síntese de mirceno relaxante muscular e beta-cariofileno anti-inflamatório via CB2 periférico',
      descricao_curta: 'Alívio de espasticidade muscular na esclerose múltipla com THC:CBD balanceado',
      ativo: true
    },
    
    // ID 3: Analgésica (Dor Crônica) — GRAU A
    {
      id: 3,
      codigo: 'CANABICA_ANALGESICA',
      nome_terapeutica: 'canábica analgésica',
      indicacao: 'dor crônica e neuropática',
      triagem: 'A',
      cid10_sugerido: 'R52',
      total_evidencias: 22,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Cannabis and cannabinoids for chronic pain',
          url: 'https://doi.org/10.1097/01.ju.0001110040.79467.6e.16',
          doi: '10.1097/01.ju.0001110040.79467.6e.16',
          pmid: '',
          tipo_estudo: 'Metanálise de Ensaios Clínicos',
          ano: 2024,
          grau_oxford: '1A'
        }
      ]),
      quimiotipo_alvo: 'TIPO_II_EQUILIBRADO',
      terpenos_focalizados: 'Beta-Cariofileno, Mirceno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Solo com fósforo biodisponível e Trichoderma estimula beta-cariofileno, agonista seletivo de CB2 periférico para analgesia sem psicoatividade',
      descricao_curta: 'Controle de dor crônica e neuropática com evidência clínica forte (Grau A)',
      ativo: true
    },
    
    // ID 4: Ansiolítica (Transtornos de Ansiedade)
    {
      id: 4,
      codigo: 'CANABICA_ANSIOLITICA',
      nome_terapeutica: 'canábica ansiolítica',
      indicacao: 'transtornos de ansiedade',
      triagem: 'B',
      cid10_sugerido: 'F41',
      total_evidencias: 17,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Cannabidiol for anxiety disorders',
          url: 'https://doi.org/10.1089/can.2022.0225',
          doi: '10.1089/can.2022.0225',
          pmid: '',
          tipo_estudo: 'Ensaio Clínico Controlado',
          ano: 2023,
          grau_oxford: '1B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Limoneno, Linalol',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_3_NEUROPSIQUIATRICO',
      limites_criticos_coa: JSON.stringify({
        thc_max_pct: 0.2,
        min_linalol_pct: 0.2,
        min_limoneno_pct: 0.3,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Solo aerado estimula monoterpenos (limoneno, linalol) que modulam receptores 5-HT1A serotoninérgicos. CBD sem THC evita crise de pânico.',
      descricao_curta: 'Redução de ansiedade com CBD e terpenos ansiolíticos, controle estrito de THC',
      ativo: true
    },
    
    // ID 5: Antiemética (Náuseas por Quimioterapia)
    {
      id: 5,
      codigo: 'CANABICA_ANTIEMETICA',
      nome_terapeutica: 'canábica antiemética',
      indicacao: 'náuseas e vômitos induzidos por quimioterapia',
      triagem: 'B',
      cid10_sugerido: 'R11',
      total_evidencias: 7,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Cannabinoids for chemotherapy-induced nausea',
          url: 'https://doi.org/10.1016/j.ejpb.2025.114705',
          doi: '10.1016/j.ejpb.2025.114705',
          pmid: '',
          tipo_estudo: 'Ensaio Clínico',
          ano: 2025,
          grau_oxford: '1B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_I_THC',
      terpenos_focalizados: 'Mirceno, Limoneno',
      manejo_solo_ideal: 'HIDROPONIA_MINERAL',
      grau_coa_exigido: 'GRAU_1_ESTRITO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.2,
        max_Cd_ppm: 0.1,
        max_As_ppm: 0.1,
        max_Hg_ppm: 0.05,
        aflatoxinas_max_ppb: 2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Hidroponia mineral padronizada elimina micotoxinas, essencial para pacientes imunossuprimidos. THC age em receptores 5-HT3 controlando náusea.',
      descricao_curta: 'Controle de náuseas e vômitos em quimioterapia com THC purificado',
      ativo: true
    },
    
    // ID 6: Orexígena (Perda de apetite/Caquexia)
    {
      id: 6,
      codigo: 'CANABICA_OREXIGENA',
      nome_terapeutica: 'canábica orexígena',
      indicacao: 'perda de apetite e caquexia associada ao HIV/AIDS ou câncer',
      triagem: 'E',
      cid10_sugerido: 'R63.0',
      total_evidencias: 4,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Therapeutic potential of phytocannabinoids in cancer anorexia-cachexia syndrome',
          url: 'https://doi.org/10.1016/j.appet.2014.06.039',
          doi: '10.1016/j.appet.2014.06.039',
          pmid: '',
          tipo_estudo: 'Revisão',
          ano: 2014,
          grau_oxford: '4'
        }
      ]),
      quimiotipo_alvo: 'TIPO_I_THC',
      terpenos_focalizados: 'Mirceno, Beta-Pineno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_1_ESTRITO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.2,
        max_Cd_ppm: 0.1,
        max_As_ppm: 0.1,
        max_Hg_ppm: 0.05,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'THC estimula apetite via CB1 hipotalâmico; solo orgânico garante perfil terpenoide completo sem contaminantes para pacientes imunossuprimidos',
      descricao_curta: 'Estímulo do apetite e redução de perda ponderal em caquexia associada ao HIV/AIDS ou câncer',
      ativo: true
    },
    
    // ID 7: Hipnótica (Insônia)
    {
      id: 7,
      codigo: 'CANABICA_HIPNOTICA',
      nome_terapeutica: 'canábica hipnótica',
      indicacao: 'insônia e distúrbios do sono',
      triagem: 'B',
      cid10_sugerido: 'G47.0',
      total_evidencias: 4,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Medical cannabis for treatment of insomnia in adults: A systematic review and meta-analysis',
          url: 'https://europepmc.org/article/MED/42207928',
          doi: '',
          pmid: '42207928',
          tipo_estudo: 'Revisão Sistemática/Meta-análise',
          ano: 2026,
          grau_oxford: '1A'
        }
      ]),
      quimiotipo_alvo: 'TIPO_II_EQUILIBRADO',
      terpenos_focalizados: 'Mirceno, Terpinoleno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Mirceno sedativo e terpinoleno modulam latência do sono; solo vivo produz terpenos em concentrações terapêuticas',
      descricao_curta: 'Avaliação de latência, duração e qualidade do sono em pessoas com insônia ou sono prejudicado por outras condições',
      ativo: true
    },
    
    // ID 8: Anti-inflamatória
    {
      id: 8,
      codigo: 'CANABICA_ANTI_INFLAMATORIA',
      nome_terapeutica: 'canábica anti-inflamatória',
      indicacao: 'inflamação e doenças inflamatórias',
      triagem: 'B',
      cid10_sugerido: 'M06.9',
      total_evidencias: 16,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'The Effects of Cannabinoids on Pro- and Anti-Inflammatory Cytokines: A Systematic Review of In Vivo Studies',
          url: 'https://doi.org/10.1089/can.2020.0105',
          doi: '10.1089/can.2020.0105',
          pmid: '',
          tipo_estudo: 'Revisão Sistemática',
          ano: 2021,
          grau_oxford: '1A'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Beta-Cariofileno, Bisabolol',
      manejo_solo_ideal: 'SUBSTRATO_TRICHODERMA',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Trichoderma estimula beta-cariofileno (agonista CB2) e bisabolol anti-inflamatório; CBD modula citocinas sem psicoatividade',
      descricao_curta: 'Modulação de mediadores e sintomas inflamatórios em doenças de mecanismos muito distintos',
      ativo: true
    },
    
    // ID 9: Neuroprotetora
    {
      id: 9,
      codigo: 'CANABICA_NEUROPROTETORA',
      nome_terapeutica: 'canábica neuroprotetora',
      indicacao: 'neuroproteção em doenças neurológicas',
      triagem: 'B',
      cid10_sugerido: 'G31.9',
      total_evidencias: 3,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Exploring the neuroprotective effects and underlying mechanisms of medical cannabinoids in ischemic stroke',
          url: 'https://europepmc.org/article/MED/41551042',
          doi: '',
          pmid: '41551042',
          tipo_estudo: 'Revisão Sistemática/Meta-análise',
          ano: 2025,
          grau_oxford: '1A'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Alfa-Pineno, Linalol',
      manejo_solo_ideal: 'SUBSTRATO_TRICHODERMA',
      grau_coa_exigido: 'GRAU_1_ESTRITO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.2,
        max_Cd_ppm: 0.1,
        max_As_ppm: 0.1,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'CBD e alfa-pineno com propriedades antioxidantes neuroprotetoras; controle estrito de metais pesados neurotóxicos',
      descricao_curta: 'Proteção de neurônios ou desaceleração de lesão neurodegenerativa, além do eventual alívio de sintomas neurológicos',
      ativo: true
    },
    
    // ID 10: Miorrelaxante
    {
      id: 10,
      codigo: 'CANABICA_MIORRELAXANTE',
      nome_terapeutica: 'canábica miorrelaxante',
      indicacao: 'espasticidade, contraturas e hipertonia muscular',
      triagem: 'E',
      cid10_sugerido: 'M62.4',
      total_evidencias: 0,
      estudos_prioritarios_json: '[]',
      quimiotipo_alvo: 'TIPO_II_EQUILIBRADO',
      terpenos_focalizados: 'Mirceno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Mirceno potencializa efeito miorrelaxante do THC:CBD equilibrado modulando tônus muscular via CB1 e CB2',
      descricao_curta: 'Redução de hipertonia, contraturas dolorosas e espasmos de diferentes causas neurológicas',
      ativo: true
    },
    
    // ID 11: Antidepressiva
    {
      id: 11,
      codigo: 'CANABICA_ANTIDEPRESSIVA',
      nome_terapeutica: 'canábica antidepressiva',
      indicacao: 'transtornos depressivos',
      triagem: 'E',
      cid10_sugerido: 'F32',
      total_evidencias: 4,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'A Novel Anti-Inflammatory Formulation Comprising Celecoxib and Cannabidiol Exerts Antidepressant and Anxiolytic Effects',
          url: 'https://doi.org/10.1089/can.2022.0225',
          doi: '10.1089/can.2022.0225',
          pmid: '',
          tipo_estudo: 'Estudo Experimental',
          ano: 2022,
          grau_oxford: '2B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Limoneno, Beta-Pineno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_3_NEUROPSIQUIATRICO',
      limites_criticos_coa: JSON.stringify({
        thc_max_pct: 0.2,
        min_limoneno_pct: 0.3,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Limoneno elevador de humor e CBD modulam neurotransmissores serotoninérgicos; solo aerado maximiza monoterpenos',
      descricao_curta: 'Investigação de efeitos sobre humor deprimido, anedonia e sintomas associados',
      ativo: true
    },
    
    // ID 12: Antipsicótica
    {
      id: 12,
      codigo: 'CANABICA_ANTIPSICOTICA',
      nome_terapeutica: 'canábica antipsicótica',
      indicacao: 'psicose e esquizofrenia',
      triagem: 'B',
      cid10_sugerido: 'F20',
      total_evidencias: 11,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'The Relationship Between Cannabis Use and Schizophrenia As a Risk Factor or For Its Therapeutic Potential',
          url: 'https://europepmc.org/article/MED/41127784',
          doi: '',
          pmid: '41127784',
          tipo_estudo: 'Revisão Sistemática',
          ano: 2025,
          grau_oxford: '1A'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Linalol',
      manejo_solo_ideal: 'HIDROPONIA_MINERAL',
      grau_coa_exigido: 'GRAU_3_NEUROPSIQUIATRICO',
      limites_criticos_coa: JSON.stringify({
        thc_max_pct: 0.1,
        min_cbd_pct: 15,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'CBD puro sem THC evita exacerbação psicótica; hidroponia garante ausência de contaminantes e controle rigoroso de canabinoides',
      descricao_curta: 'Uso adjuvante do CBD para sintomas psicóticos e esquizofrenia, sem substituir antipsicóticos comprovados',
      ativo: true
    },
    
    // ID 13: Antiprurítica
    {
      id: 13,
      codigo: 'CANABICA_ANTIPRURITICA',
      nome_terapeutica: 'canábica antiprurítica',
      indicacao: 'prurido crônico',
      triagem: 'E',
      cid10_sugerido: 'L29',
      total_evidencias: 4,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Therapeutic potential of cannabinoids for treating atopic dermatitis',
          url: 'https://europepmc.org/article/MED/40818974',
          doi: '',
          pmid: '40818974',
          tipo_estudo: 'Revisão Narrativa',
          ano: 2025,
          grau_oxford: '4'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Alfa-Bisabolol, Canfeno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_4_TOPICO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 1.0,
        max_Cd_ppm: 0.3,
        microbios_topico: true
      }),
      mecanismo_agro_saude: 'Alfa-bisabolol anti-inflamatório e CBD modulam receptores CB1/CB2 cutâneos reduzindo prurido; uso tópico',
      descricao_curta: 'Alívio do prurido crônico de origem dermatológica, neuropática, renal ou hepática',
      ativo: true
    },
    
    // ID 14: Antimigrenosa
    {
      id: 14,
      codigo: 'CANABICA_ANTIMIGRENOSA',
      nome_terapeutica: 'canábica antimigrenosa',
      indicacao: 'enxaqueca',
      triagem: 'B',
      cid10_sugerido: 'G43',
      total_evidencias: 5,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Vaporized cannabis versus placebo for acute migraine: A randomized, double-blind, placebo-controlled crossover trial',
          url: 'https://europepmc.org/article/MED/41469488',
          doi: '',
          pmid: '41469488',
          tipo_estudo: 'Ensaio Clínico Randomizado',
          ano: 2026,
          grau_oxford: '1B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_II_EQUILIBRADO',
      terpenos_focalizados: 'Beta-Cariofileno, Mirceno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Beta-cariofileno anti-inflamatório CB2 e mirceno analgésico modulam cascata de enxaqueca; THC:CBD equilibrado',
      descricao_curta: 'Prevenção ou tratamento das crises de enxaqueca, incluindo dor, náusea e fotofobia',
      ativo: true
    },
    
    // ID 15: Antiepilética Pediátrica (Esclerose Tuberosa)
    {
      id: 15,
      codigo: 'CANABICA_ANTIEPILEPTICA_PEDIATRICA',
      nome_terapeutica: 'canábica antiepilética pediátrica',
      indicacao: 'crises associadas ao complexo de esclerose tuberosa',
      triagem: 'B',
      cid10_sugerido: 'Q85.1',
      total_evidencias: 9,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Cannabidiol treatment for seizures in tuberous sclerosis complex',
          url: 'https://doi.org/10.1016/j.yebeh.2022.108761',
          doi: '10.1016/j.yebeh.2022.108761',
          pmid: '',
          tipo_estudo: 'Estudo Clínico',
          ano: 2022,
          grau_oxford: '2B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Linalol',
      manejo_solo_ideal: 'HIDROPONIA_MINERAL',
      grau_coa_exigido: 'GRAU_1_ESTRITO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.2,
        max_Cd_ppm: 0.1,
        max_As_ppm: 0.1,
        max_Hg_ppm: 0.05,
        thc_max_pct: 0.1,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'CBD purificado para população pediátrica; hidroponia elimina contaminantes e garante perfil canabinoide consistente',
      descricao_curta: 'Controle de crises pediátricas, com ênfase nas associadas ao complexo de esclerose tuberosa',
      ativo: true
    },
    
    // ID 16: Broncodilatadora
    {
      id: 16,
      codigo: 'CANABICA_BRONCODILATADORA',
      nome_terapeutica: 'canábica broncodilatadora',
      indicacao: 'asma e broncoconstrição',
      triagem: 'C',
      cid10_sugerido: 'J45',
      total_evidencias: 1,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Inhaled Cannabis, Asthma, and Chronic Obstructive Pulmonary Disease',
          url: 'https://europepmc.org/article/MED/40906010',
          doi: '',
          pmid: '40906010',
          tipo_estudo: 'Estudo Observacional',
          ano: 2026,
          grau_oxford: '3B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Alfa-Pineno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_1_ESTRITO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.2,
        max_Cd_ppm: 0.1,
        microbios_respiratorio: true,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Alfa-pineno broncodilatador; controle microbiológico rigoroso para uso em vias respiratórias comprometidas',
      descricao_curta: 'Investigação de broncodilatação e de sintomas relacionados à asma ou broncoconstrição',
      ativo: true
    },
    
    // ID 17: Antidiarreica
    {
      id: 17,
      codigo: 'CANABICA_ANTIDIARREICA',
      nome_terapeutica: 'canábica antidiarreica',
      indicacao: 'diarreia e síndrome do intestino irritável',
      triagem: 'B',
      cid10_sugerido: 'K58',
      total_evidencias: 4,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Effects of Cannabidiol Chewing Gum on Perceived Pain and Well-Being of Irritable Bowel Syndrome Patients',
          url: 'https://doi.org/10.1089/can.2020.0087',
          doi: '10.1089/can.2020.0087',
          pmid: '',
          tipo_estudo: 'Ensaio Clínico Randomizado',
          ano: 2022,
          grau_oxford: '1B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Beta-Cariofileno',
      manejo_solo_ideal: 'SUBSTRATO_TRICHODERMA',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Beta-cariofileno modula motilidade intestinal via CB2 entérico; CBD reduz inflamação e dor visceral',
      descricao_curta: 'Modulação de motilidade, dor e diarreia, inclusive em síndrome do intestino irritável',
      ativo: true
    },
    
    // ID 18: Gastroprotetora
    {
      id: 18,
      codigo: 'CANABICA_GASTROPROTETORA',
      nome_terapeutica: 'canábica gastroprotetora',
      indicacao: 'doença inflamatória intestinal e lesão gastrointestinal',
      triagem: 'B',
      cid10_sugerido: 'K50',
      total_evidencias: 6,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Efficacy of Exogenous Cannabinoids in Pre-Clinical Models of Inflammatory Bowel Disease',
          url: 'https://doi.org/10.1177/25785125261428842',
          doi: '10.1177/25785125261428842',
          pmid: '',
          tipo_estudo: 'Revisão Sistemática/Meta-análise',
          ano: 2026,
          grau_oxford: '1A'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Beta-Cariofileno, Bisabolol',
      manejo_solo_ideal: 'SUBSTRATO_TRICHODERMA',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Trichoderma + solo vivo estimulam beta-cariofileno e bisabolol anti-inflamatórios; CBD protege mucosa gastrointestinal',
      descricao_curta: 'Proteção da mucosa e redução de sintomas em lesões gastrointestinais ou doença inflamatória intestinal',
      ativo: true
    },
    
    // ID 19: Antibacteriana
    {
      id: 19,
      codigo: 'CANABICA_ANTIBACTERIANA',
      nome_terapeutica: 'canábica antibacteriana',
      indicacao: 'atividade contra infecções bacterianas',
      triagem: 'B',
      cid10_sugerido: 'A49',
      total_evidencias: 6,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Impact of CBD and hemp oil use on drug test results',
          url: 'https://europepmc.org/article/MED/41942676',
          doi: '',
          pmid: '41942676',
          tipo_estudo: 'Revisão Sistemática',
          ano: 2026,
          grau_oxford: '1A'
        }
      ]),
      quimiotipo_alvo: 'TIPO_IV_CBG',
      terpenos_focalizados: 'Beta-Pineno, Eucaliptol',
      manejo_solo_ideal: 'HIDROPONIA_MINERAL',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        microbios_contagem: true,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'CBG e beta-pineno com atividade antibacteriana; hidroponia garante pureza e ausência de contaminação microbiana cruzada',
      descricao_curta: 'Avaliação de atividade contra bactérias, incluindo cepas resistentes, principalmente em laboratório',
      ativo: true
    },
    
    // ID 20: Antioxidante
    {
      id: 20,
      codigo: 'CANABICA_ANTIOXIDANTE',
      nome_terapeutica: 'canábica antioxidante',
      indicacao: 'estresse oxidativo',
      triagem: 'B',
      cid10_sugerido: 'E88.9',
      total_evidencias: 10,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Cannabidiol-Driven Alterations to Inflammatory Protein Landscape',
          url: 'https://doi.org/10.1089/can.2020.0109',
          doi: '10.1089/can.2020.0109',
          pmid: '',
          tipo_estudo: 'Estudo Pré-clínico',
          ano: 2021,
          grau_oxford: '5'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Humuleno, Terpinoleno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'CBD e terpenos com propriedades antioxidantes; solo vivo rico em microbiota produz metabólitos secundários protetores',
      descricao_curta: 'Redução de marcadores de estresse oxidativo e dano celular',
      ativo: true
    },
    
    // ID 21: Antiacneica
    {
      id: 21,
      codigo: 'CANABICA_ANTIACNEICA',
      nome_terapeutica: 'canábica antiacneica',
      indicacao: 'acne vulgar e acne inflamatória',
      triagem: 'B',
      cid10_sugerido: 'L70',
      total_evidencias: 6,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'CBD-Containing Hemp Extracts and Isolated CBD for Acne',
          url: 'https://europepmc.org/article/MED/42357416',
          doi: '',
          pmid: '42357416',
          tipo_estudo: 'Revisão Sistemática',
          ano: 2026,
          grau_oxford: '1A'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Alfa-Pineno, Limoneno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_4_TOPICO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 1.0,
        max_Cd_ppm: 0.3,
        microbios_topico: true
      }),
      mecanismo_agro_saude: 'CBD regula produção sebácea e reduz inflamação; alfa-pineno e limoneno antibacterianos; uso tópico',
      descricao_curta: 'Redução de inflamação, produção sebácea e número de lesões de acne',
      ativo: true
    },
    
    // ID 22: Antipsoriática
    {
      id: 22,
      codigo: 'CANABICA_ANTIPSORIATICA',
      nome_terapeutica: 'canábica antipsoriática',
      indicacao: 'psoríase',
      triagem: 'D',
      cid10_sugerido: 'L40',
      total_evidencias: 3,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Cannabidiol Mediates In Vitro Attenuation of Proinflammatory Cytokine Responses in Psoriatic Disease',
          url: 'https://doi.org/10.1089/can.2023.0237',
          doi: '10.1089/can.2023.0237',
          pmid: '',
          tipo_estudo: 'Estudo Pré-clínico',
          ano: 2024,
          grau_oxford: '5'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Beta-Cariofileno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_4_TOPICO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 1.0,
        max_Cd_ppm: 0.3,
        microbios_topico: true
      }),
      mecanismo_agro_saude: 'CBD e beta-cariofileno modulam hiperproliferação de queratinócitos e inflamação; uso tópico',
      descricao_curta: 'Controle de placas, descamação, prurido e inflamação na psoríase',
      ativo: true
    },
    
    // ID 23: Oncológica Adjuvante
    {
      id: 23,
      codigo: 'CANABICA_ONCOLOGICA_ADJUVANTE',
      nome_terapeutica: 'canábica oncológica adjuvante',
      indicacao: 'controle de sintomas relacionados ao câncer e ao tratamento oncológico',
      triagem: 'B',
      cid10_sugerido: 'C80',
      total_evidencias: 5,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Cannabinoids for Medical Purposes in Children: A Living Systematic Review',
          url: 'https://europepmc.org/article/MED/40437694',
          doi: '',
          pmid: '40437694',
          tipo_estudo: 'Revisão Sistemática',
          ano: 2025,
          grau_oxford: '1A'
        }
      ]),
      quimiotipo_alvo: 'TIPO_II_EQUILIBRADO',
      terpenos_focalizados: 'Mirceno, Cariofileno',
      manejo_solo_ideal: 'SUBSTRATO_TRICHODERMA',
      grau_coa_exigido: 'GRAU_1_ESTRITO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.2,
        max_Cd_ppm: 0.1,
        max_As_ppm: 0.1,
        max_Hg_ppm: 0.05,
        aflatoxinas_max_ppb: 2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'THC:CBD equilibrado para controle multissintomático; controle rigoroso de contaminantes para pacientes oncológicos',
      descricao_curta: 'Suporte ao controle de dor, náusea, sono, apetite e outros sintomas relacionados ao câncer ou ao tratamento',
      ativo: true
    },
    
    // ID 24: Paliativa
    {
      id: 24,
      codigo: 'CANABICA_PALIATIVA',
      nome_terapeutica: 'canábica paliativa',
      indicacao: 'controle de sintomas em cuidados paliativos',
      triagem: 'E',
      cid10_sugerido: 'Z51.5',
      total_evidencias: 2,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'The use of cannabinoids in palliating cancer-related symptoms',
          url: 'https://europepmc.org/article/MED/38343467',
          doi: '',
          pmid: '38343467',
          tipo_estudo: 'Revisão Narrativa',
          ano: 2024,
          grau_oxford: '4'
        }
      ]),
      quimiotipo_alvo: 'TIPO_II_EQUILIBRADO',
      terpenos_focalizados: 'Mirceno, Linalol',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_1_ESTRITO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.2,
        max_Cd_ppm: 0.1,
        max_As_ppm: 0.1,
        max_Hg_ppm: 0.05,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Formulação individualizada THC:CBD para conforto multidimensional; pureza máxima para pacientes em cuidados paliativos',
      descricao_curta: 'Alívio multidimensional de dor, náusea, falta de apetite, ansiedade e sono no contexto paliativo',
      ativo: true
    },
    
    // ID 25: Antifibromiálgica
    {
      id: 25,
      codigo: 'CANABICA_ANTIFIBROMIALGICA',
      nome_terapeutica: 'canábica antifibromiálgica',
      indicacao: 'dor e sintomas da fibromialgia',
      triagem: 'A',
      cid10_sugerido: 'M79.7',
      total_evidencias: 13,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Oral Medicinal Cannabis Does Not Alter Plasma Levels of Endocannabinoid-Related N-Acylethanolamines in Fibromyalgia Patients',
          url: 'https://doi.org/10.1177/25785125261469541',
          doi: '10.1177/25785125261469541',
          pmid: '',
          tipo_estudo: 'Ensaio Clínico Randomizado',
          ano: 2026,
          grau_oxford: '1B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_II_EQUILIBRADO',
      terpenos_focalizados: 'Beta-Cariofileno, Mirceno',
      manejo_solo_ideal: 'SUBSTRATO_TRICHODERMA',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Beta-cariofileno analgésico via CB2 e mirceno relaxante muscular; THC:CBD equilibrado para dor difusa e sono',
      descricao_curta: 'Redução de dor difusa, distúrbio do sono e impacto funcional na fibromialgia',
      ativo: true
    },
    
    // ID 26: Antiendometriótica
    {
      id: 26,
      codigo: 'CANABICA_ANTIENDOMETRIOTICA',
      nome_terapeutica: 'canábica antiendometriótica',
      indicacao: 'dor e sintomas da endometriose',
      triagem: 'A',
      cid10_sugerido: 'N80',
      total_evidencias: 6,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Challenges in conducting a feasibility randomized controlled trial of medicinal cannabis for endometriosis pain in Australia',
          url: 'https://europepmc.org/article/MED/41005282',
          doi: '',
          pmid: '41005282',
          tipo_estudo: 'Ensaio Clínico Randomizado',
          ano: 2025,
          grau_oxford: '1B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_II_EQUILIBRADO',
      terpenos_focalizados: 'Beta-Cariofileno, Linalol',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Beta-cariofileno anti-inflamatório e linalol analgésico modulam dor pélvica via CB2; THC:CBD equilibrado',
      descricao_curta: 'Alívio da dor pélvica e de sintomas associados à endometriose',
      ativo: true
    },
    
    // ID 27: Antineuropática Diabética
    {
      id: 27,
      codigo: 'CANABICA_ANTINEUROPATICA_DIABETICA',
      nome_terapeutica: 'canábica antineuropática diabética',
      indicacao: 'neuropatia periférica diabética dolorosa',
      triagem: 'B',
      cid10_sugerido: 'G63.2',
      total_evidencias: 3,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Are Cannabis-Based Medicines a Useful Treatment for Neuropathic Pain',
          url: 'https://europepmc.org/article/MED/40563456',
          doi: '',
          pmid: '40563456',
          tipo_estudo: 'Revisão Sistemática',
          ano: 2025,
          grau_oxford: '1A'
        }
      ]),
      quimiotipo_alvo: 'TIPO_II_EQUILIBRADO',
      terpenos_focalizados: 'Alfa-Pineno, Cariofileno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Alfa-pineno e beta-cariofileno analgésicos; THC:CBD equilibrado modula dor neuropática via CB1 e CB2',
      descricao_curta: 'Redução da dor neuropática periférica causada por diabetes',
      ativo: true
    },
    
    // ID 28: Antiestresse Pós-Traumático
    {
      id: 28,
      codigo: 'CANABICA_ANTIESTRESSE_POS_TRAUMATICO',
      nome_terapeutica: 'canábica antiestresse pós-traumático',
      indicacao: 'transtorno de estresse pós-traumático (TEPT)',
      triagem: 'B',
      cid10_sugerido: 'F43.1',
      total_evidencias: 11,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Efficacy, effectiveness and safety of medical cannabis in PTSD',
          url: 'https://europepmc.org/article/MED/42210342',
          doi: '',
          pmid: '42210342',
          tipo_estudo: 'Revisão Sistemática',
          ano: 2026,
          grau_oxford: '1A'
        }
      ]),
      quimiotipo_alvo: 'TIPO_II_EQUILIBRADO',
      terpenos_focalizados: 'Linalol, Mirceno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_3_NEUROPSIQUIATRICO',
      limites_criticos_coa: JSON.stringify({
        thc_max_pct: 10,
        min_cbd_pct: 5,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Linalol ansiolítico e mirceno sedativo; THC:CBD equilibrado modula extinção de memórias traumáticas',
      descricao_curta: 'Investigação de pesadelos, hiperalerta, ansiedade e outros sintomas do transtorno de estresse pós-traumático',
      ativo: true
    },
    
    // ID 29: Neurocognitiva (TDAH)
    {
      id: 29,
      codigo: 'CANABICA_NEUROCOGNITIVA',
      nome_terapeutica: 'canábica neurocognitiva',
      indicacao: 'sintomas do transtorno de déficit de atenção e hiperatividade',
      triagem: 'E',
      cid10_sugerido: 'F90',
      total_evidencias: 3,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Medical Cannabis for Adult Attention Deficit Hyperactivity Disorder',
          url: 'https://doi.org/10.1159/000495307',
          doi: '10.1159/000495307',
          pmid: '',
          tipo_estudo: 'Relato de Caso',
          ano: 2018,
          grau_oxford: '4'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Alfa-Pineno, Limoneno',
      manejo_solo_ideal: 'SUBSTRATO_TRICHODERMA',
      grau_coa_exigido: 'GRAU_3_NEUROPSIQUIATRICO',
      limites_criticos_coa: JSON.stringify({
        thc_max_pct: 0.2,
        min_cbd_pct: 10,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'CBD com alfa-pineno potencializa foco e atenção; controle rigoroso de THC para evitar prejuízo cognitivo',
      descricao_curta: 'Avaliação de atenção, impulsividade e hiperatividade em pessoas com TDAH',
      ativo: true
    },
    
    // ID 30: Anti-irritabilidade Autística
    {
      id: 30,
      codigo: 'CANABICA_ANTI_IRRITABILIDADE_AUTISTICA',
      nome_terapeutica: 'canábica anti-irritabilidade autística',
      indicacao: 'irritabilidade e sintomas associados ao transtorno do espectro autista',
      triagem: 'B',
      cid10_sugerido: 'F84',
      total_evidencias: 13,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Efficacy and Safety of Cannabinoid-Based Products in Children and Adolescents with Autism Spectrum Disorder',
          url: 'https://europepmc.org/article/MED/42339654',
          doi: '',
          pmid: '42339654',
          tipo_estudo: 'Revisão Sistemática',
          ano: 2026,
          grau_oxford: '1A'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Linalol, Cariofileno',
      manejo_solo_ideal: 'HIDROPONIA_MINERAL',
      grau_coa_exigido: 'GRAU_1_ESTRITO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.2,
        max_Cd_ppm: 0.1,
        max_As_ppm: 0.1,
        thc_max_pct: 0.1,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'CBD purificado para população pediátrica; linalol ansiolítico e cariofileno anti-inflamatório; hidroponia garante pureza',
      descricao_curta: 'Redução de irritabilidade, agressividade e sintomas associados ao transtorno do espectro autista',
      ativo: true
    },
    
    // ID 31: Hipotensora Ocular
    {
      id: 31,
      codigo: 'CANABICA_HIPOTENSORA_OCULAR',
      nome_terapeutica: 'canábica hipotensora ocular',
      indicacao: 'pressão intraocular elevada e glaucoma',
      triagem: 'B',
      cid10_sugerido: 'H40',
      total_evidencias: 4,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Nonpsychotropic Cannabinoids for Intraocular Pressure Reduction',
          url: 'https://doi.org/10.1089/jop.2011.0041',
          doi: '10.1089/jop.2011.0041',
          pmid: '',
          tipo_estudo: 'Estudo Experimental',
          ano: 2011,
          grau_oxford: '2B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_I_THC',
      terpenos_focalizados: 'Alfa-Pineno',
      manejo_solo_ideal: 'HIDROPONIA_MINERAL',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'THC reduz pressão intraocular via receptores canabinoides oculares; alfa-pineno potencializa efeito',
      descricao_curta: 'Redução da pressão intraocular em glaucoma ou hipertensão ocular',
      ativo: true
    },
    
    // ID 32: Antitremórica
    {
      id: 32,
      codigo: 'CANABICA_ANTITREMORICA',
      nome_terapeutica: 'canábica antitremórica',
      indicacao: 'tremor essencial e tremor associado à doença de Parkinson',
      triagem: 'B',
      cid10_sugerido: 'G25',
      total_evidencias: 2,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Double-Blind, Randomized, Placebo-Controlled, Crossover Study of Oral Cannabidiol and Tetrahydrocannabinol for Essential Tremor',
          url: 'https://europepmc.org/article/MED/40248111',
          doi: '',
          pmid: '40248111',
          tipo_estudo: 'Ensaio Clínico Randomizado',
          ano: 2025,
          grau_oxford: '1B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_II_EQUILIBRADO',
      terpenos_focalizados: 'Beta-Cariofileno, Mirceno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'THC:CBD equilibrado modula circuitos motores; beta-cariofileno e mirceno reduzem tremor via CB1/CB2',
      descricao_curta: 'Redução de tremor essencial ou tremor associado à doença de Parkinson',
      ativo: true
    },
    
    // ID 33: Antiespástica
    {
      id: 33,
      codigo: 'CANABICA_ANTIESPASSTICA',
      nome_terapeutica: 'canábica antiespástica',
      indicacao: 'espasmos musculares',
      triagem: 'B',
      cid10_sugerido: 'G83.9',
      total_evidencias: 7,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Nabiximols in Multiple Sclerosis: Beyond Spasticity',
          url: 'https://europepmc.org/article/MED/42506315',
          doi: '',
          pmid: '42506315',
          tipo_estudo: 'Revisão Sistemática/Meta-análise',
          ano: 2026,
          grau_oxford: '1A'
        }
      ]),
      quimiotipo_alvo: 'TIPO_II_EQUILIBRADO',
      terpenos_focalizados: 'Mirceno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Mirceno relaxante muscular potencializa efeito antiespástico de THC:CBD via CB1 e CB2',
      descricao_curta: 'Controle de espasmos e espasticidade em condições neurológicas, incluindo esclerose múltipla',
      ativo: true
    },
    
    // ID 34: Urológica
    {
      id: 34,
      codigo: 'CANABICA_UROLOGICA',
      nome_terapeutica: 'canábica urológica',
      indicacao: 'dor e sintomas da cistite intersticial',
      triagem: 'D',
      cid10_sugerido: 'N30.1',
      total_evidencias: 7,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Intravesical Cannabidiol for Inflammation and Pain in Interstitial Cystitis',
          url: 'https://europepmc.org/article/MED/41508393',
          doi: '',
          pmid: '41508393',
          tipo_estudo: 'Estudo Experimental',
          ano: 2026,
          grau_oxford: '2B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Beta-Cariofileno, Linalol',
      manejo_solo_ideal: 'SUBSTRATO_TRICHODERMA',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'CBD anti-inflamatório e beta-cariofileno analgésico modulam dor vesical via CB2',
      descricao_curta: 'Alívio de dor vesical, urgência e frequência na cistite intersticial/síndrome da bexiga dolorosa',
      ativo: true
    },
    
    // ID 35: Antitique
    {
      id: 35,
      codigo: 'CANABICA_ANTITIQUE',
      nome_terapeutica: 'canábica antitique',
      indicacao: 'tiques associados à síndrome de Tourette',
      triagem: 'B',
      cid10_sugerido: 'F95.2',
      total_evidencias: 12,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Effects of Different Cannabinoid Formulations on Anxiety-Related Disorders, and Tourette Syndrome',
          url: 'https://europepmc.org/article/MED/40956670',
          doi: '',
          pmid: '40956670',
          tipo_estudo: 'Revisão Sistemática/Meta-análise',
          ano: 2025,
          grau_oxford: '1A'
        }
      ]),
      quimiotipo_alvo: 'TIPO_I_THC',
      terpenos_focalizados: 'Linalol, Mirceno',
      manejo_solo_ideal: 'HIDROPONIA_MINERAL',
      grau_coa_exigido: 'GRAU_3_NEUROPSIQUIATRICO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.2,
        max_Cd_ppm: 0.1,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'THC modula circuitos dopaminérgicos e GABAérgicos; linalol ansiolítico reduz tiques; hidroponia garante pureza',
      descricao_curta: 'Redução de tiques motores e vocais na síndrome de Tourette',
      ativo: true
    },
    
    // ID 36: Antiaditiva
    {
      id: 36,
      codigo: 'CANABICA_ANTIADITIVA',
      nome_terapeutica: 'canábica antiaditiva',
      indicacao: 'transtornos por uso de opioides, álcool e outras substâncias',
      triagem: 'B',
      cid10_sugerido: 'F11',
      total_evidencias: 13,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Efficacy of cannabidiol alone or in combination with THC for substance use disorders',
          url: 'https://europepmc.org/article/MED/39947878',
          doi: '',
          pmid: '39947878',
          tipo_estudo: 'Revisão Sistemática',
          ano: 2025,
          grau_oxford: '1A'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Limoneno, Linalol',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_3_NEUROPSIQUIATRICO',
      limites_criticos_coa: JSON.stringify({
        thc_max_pct: 0.2,
        min_cbd_pct: 10,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'CBD reduz fissura e ansiedade de abstinência; limoneno e linalol ansiolíticos; controle de THC para evitar dependência',
      descricao_curta: 'Investigação de fissura, abstinência e recaída em transtornos por uso de opioides, álcool, cannabis ou outras substâncias',
      ativo: true
    },
    
    // ID 37: Metabólica
    {
      id: 37,
      codigo: 'CANABICA_METABOLICA',
      nome_terapeutica: 'canábica metabólica',
      indicacao: 'obesidade e alterações metabólicas',
      triagem: 'E',
      cid10_sugerido: 'E66',
      total_evidencias: 2,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Obesity, diabetes and metabolic syndrome',
          url: 'https://doi.org/10.4172/2165-7904.s1.013',
          doi: '10.4172/2165-7904.s1.013',
          pmid: '',
          tipo_estudo: 'Revisão',
          ano: 2015,
          grau_oxford: '4'
        }
      ]),
      quimiotipo_alvo: 'TIPO_IV_CBG',
      terpenos_focalizados: 'Humuleno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'CBG e humuleno supressor de apetite modulam metabolismo via CB1 e CB2; solo vivo otimiza perfil canabinoide',
      descricao_curta: 'Modulação de apetite, peso, resistência à insulina e outros parâmetros metabólicos',
      ativo: true
    },
    
    // ID 38: Osteoprotetora
    {
      id: 38,
      codigo: 'CANABICA_OSTEOPROTETORA',
      nome_terapeutica: 'canábica osteoprotetora',
      indicacao: 'osteoporose e perda de massa óssea',
      triagem: 'B',
      cid10_sugerido: 'M81',
      total_evidencias: 4,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Cannabidiol in Periodontal Therapy',
          url: 'https://europepmc.org/article/MED/42193486',
          doi: '',
          pmid: '42193486',
          tipo_estudo: 'Revisão Sistemática',
          ano: 2026,
          grau_oxford: '1A'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Beta-Cariofileno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'CBD e beta-cariofileno estimulam osteoblastos via CB2; solo vivo fornece minerais biodisponíveis',
      descricao_curta: 'Prevenção de perda óssea e promoção de formação ou reparo do osso',
      ativo: true
    },
    
    // ID 39: Enteroprotetora
    {
      id: 39,
      codigo: 'CANABICA_ENTEROPROTETORA',
      nome_terapeutica: 'canábica enteroprotetora',
      indicacao: 'saúde intestinal, microbiota e doença inflamatória intestinal',
      triagem: 'B',
      cid10_sugerido: 'K63.8',
      total_evidencias: 4,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Short-Term Low Dose Cannabidiol Does Not Influence Glucose Tolerance or Gut Microbiome',
          url: 'https://europepmc.org/article/MED/41167732',
          doi: '',
          pmid: '41167732',
          tipo_estudo: 'Ensaio Clínico Randomizado',
          ano: 2026,
          grau_oxford: '1B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Beta-Cariofileno, Bisabolol',
      manejo_solo_ideal: 'SUBSTRATO_TRICHODERMA',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'CBD e terpenos modulam microbiota e barreira intestinal; Trichoderma estimula compostos prebióticos',
      descricao_curta: 'Modulação de barreira intestinal, inflamação e microbiota, além de sintomas digestivos',
      ativo: true
    },
    
    // ID 40: Cardioprotetora
    {
      id: 40,
      codigo: 'CANABICA_CARDIOPROTETORA',
      nome_terapeutica: 'canábica cardioprotetora',
      indicacao: 'doenças cardiovasculares, pressão arterial e função vascular',
      triagem: 'B',
      cid10_sugerido: 'I10',
      total_evidencias: 3,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Chronic Effects of Oral Cannabidiol Delivery on 24-h Ambulatory Blood Pressure in Patients with Hypertension',
          url: 'https://doi.org/10.1089/can.2022.0320',
          doi: '10.1089/can.2022.0320',
          pmid: '',
          tipo_estudo: 'Ensaio Clínico Randomizado',
          ano: 2024,
          grau_oxford: '1B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Alfa-Pineno, Linalol',
      manejo_solo_ideal: 'HIDROPONIA_MINERAL',
      grau_coa_exigido: 'GRAU_1_ESTRITO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.2,
        max_Cd_ppm: 0.1,
        max_As_ppm: 0.1,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'CBD vasodilatador e anti-inflamatório; alfa-pineno e linalol modulam pressão arterial; pureza máxima',
      descricao_curta: 'Investigação de pressão arterial, função vascular, isquemia e outros desfechos cardiovasculares',
      ativo: true
    },
    
    // ID 41: Retinoprotetora
    {
      id: 41,
      codigo: 'CANABICA_RETINOPROTETORA',
      nome_terapeutica: 'canábica retinoprotetora',
      indicacao: 'neuroproteção da retina e doenças oculares',
      triagem: 'E',
      cid10_sugerido: 'H35.9',
      total_evidencias: 3,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Intravitreal CBD-loaded niosomes enhance retinal neuroprotection in ischemic injury',
          url: 'https://europepmc.org/article/MED/40174680',
          doi: '',
          pmid: '40174680',
          tipo_estudo: 'Estudo Experimental',
          ano: 2025,
          grau_oxford: '2B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Alfa-Pineno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_1_ESTRITO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.2,
        max_Cd_ppm: 0.1,
        max_As_ppm: 0.1,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'CBD neuroprotetor e antioxidante protege células retinianas; alfa-pineno potencializa efeito',
      descricao_curta: 'Proteção de retina e nervo óptico em doenças degenerativas ou lesões oculares',
      ativo: true
    },
    
    // ID 42: Hepatoprotetora
    {
      id: 42,
      codigo: 'CANABICA_HEPATOPROTETORA',
      nome_terapeutica: 'canábica hepatoprotetora',
      indicacao: 'esteatose, fibrose e lesão hepática',
      triagem: 'C',
      cid10_sugerido: 'K76',
      total_evidencias: 8,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Associations of Cannabis Use, Metabolic Dysfunction-Associated Steatotic Liver Disease, and Liver Fibrosis',
          url: 'https://doi.org/10.1089/can.2024.0027',
          doi: '10.1089/can.2024.0027',
          pmid: '',
          tipo_estudo: 'Estudo Observacional',
          ano: 2024,
          grau_oxford: '3B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Alfa-Pineno, Terpinoleno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_1_ESTRITO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.2,
        max_Cd_ppm: 0.1,
        max_As_ppm: 0.1,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'CBD anti-fibrótico e anti-inflamatório hepático; alfa-pineno e terpinoleno antioxidantes',
      descricao_curta: 'Redução de esteatose, inflamação, fibrose ou lesão hepática',
      ativo: true
    },
    
    // ID 43: Nefroprotetora
    {
      id: 43,
      codigo: 'CANABICA_NEFROPROTETORA',
      nome_terapeutica: 'canábica nefroprotetora',
      indicacao: 'doença e lesão renal',
      triagem: 'E',
      cid10_sugerido: 'N28',
      total_evidencias: 3,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Cannabidiol Suppresses Cytokine Storm and Protects Against Cardiac and Renal Injury Associated with Sepsis',
          url: 'https://doi.org/10.1089/can.2022.0170',
          doi: '10.1089/can.2022.0170',
          pmid: '',
          tipo_estudo: 'Estudo Experimental',
          ano: 2024,
          grau_oxford: '2B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Alfa-Bisabolol',
      manejo_solo_ideal: 'HIDROPONIA_MINERAL',
      grau_coa_exigido: 'GRAU_1_ESTRITO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.2,
        max_Cd_ppm: 0.1,
        max_As_ppm: 0.1,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'CBD anti-inflamatório e antioxidante protege função renal; alfa-bisabolol potencializa efeito',
      descricao_curta: 'Proteção contra lesão renal aguda, fibrose ou progressão de doença renal',
      ativo: true
    },
    
    // ID 44: Imunomoduladora
    {
      id: 44,
      codigo: 'CANABICA_IMUNOMODULADORA',
      nome_terapeutica: 'canábica imunomoduladora',
      indicacao: 'modulação da resposta imunológica',
      triagem: 'E',
      cid10_sugerido: 'D89.9',
      total_evidencias: 9,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Cannabinoids as Immune System Modulators',
          url: 'https://doi.org/10.1089/can.2022.0133',
          doi: '10.1089/can.2022.0133',
          pmid: '',
          tipo_estudo: 'Revisão',
          ano: 2023,
          grau_oxford: '4'
        }
      ]),
      quimiotipo_alvo: 'TIPO_III_CBD',
      terpenos_focalizados: 'Beta-Cariofileno, Linalol',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_1_ESTRITO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.2,
        max_Cd_ppm: 0.1,
        max_As_ppm: 0.1,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'CBD e beta-cariofileno modulam citocinas e resposta imune via CB2; controle rigoroso de contaminantes',
      descricao_curta: 'Modulação de citocinas e respostas imunes em inflamação, autoimunidade ou outras condições',
      ativo: true
    },
    
    // ID 45: Condroprotetora
    {
      id: 45,
      codigo: 'CANABICA_CONDROPROTETORA',
      nome_terapeutica: 'canábica condroprotetora',
      indicacao: 'osteoartrite, artrose e dor articular',
      triagem: 'E',
      cid10_sugerido: 'M15',
      total_evidencias: 6,
      estudos_prioritarios_json: JSON.stringify([
        {
          titulo: 'Synthetic transdermal cannabidiol for treatment of knee pain due to osteoarthritis',
          url: 'https://doi.org/10.1016/j.joca.2018.02.067',
          doi: '10.1016/j.joca.2018.02.067',
          pmid: '',
          tipo_estudo: 'Estudo Experimental',
          ano: 2018,
          grau_oxford: '2B'
        }
      ]),
      quimiotipo_alvo: 'TIPO_II_EQUILIBRADO',
      terpenos_focalizados: 'Beta-Cariofileno, Mirceno',
      manejo_solo_ideal: 'SOLO_VIVO_ORGANICO',
      grau_coa_exigido: 'GRAU_2_PADRAO',
      limites_criticos_coa: JSON.stringify({
        max_Pb_ppm: 0.5,
        max_Cd_ppm: 0.2,
        exigir_terpenos: true
      }),
      mecanismo_agro_saude: 'Beta-cariofileno anti-inflamatório e mirceno analgésico; THC:CBD equilibrado protege cartilagem via CB2',
      descricao_curta: 'Redução de dor e inflamação articular e possível proteção de cartilagem na osteoartrite',
      ativo: true
    },
    
    // ID 46: Outra não listada
    {
      id: 46,
      codigo: 'CANABICA_OUTRA',
      nome_terapeutica: 'outra não listada',
      indicacao: 'condição clínica sob demanda individualizada',
      triagem: 'E',
      cid10_sugerido: 'Z00',
      total_evidencias: 0,
      estudos_prioritarios_json: '[]',
      quimiotipo_alvo: 'DEFINIR_MEDICO',
      terpenos_focalizados: 'Customizado',
      manejo_solo_ideal: 'AVALIACAO_INDIVIDUAL',
      grau_coa_exigido: 'AVALIADO_MEDICO',
      limites_criticos_coa: '{}',
      mecanismo_agro_saude: 'Avaliação agronômica individualizada conforme prescrição médica e manejo ajustado sob medida',
      descricao_curta: 'Condição clínica não listada — avaliação médica e agronômica individualizada',
      ativo: true
    }
  ];
}

// ============================================================================
// CONFIRMAÇÃO DE CARREGAMENTO
// ============================================================================

const COMORBIDADE_REPOSITORY_LOADED = true;
Logger.log('✅ 26_ComorbidadeRepository.gs carregado com sucesso');


// ============================================================================
// HELPERS PARA ANÁLISE DE CULTIVO (WORKFLOW #1)
// ============================================================================

/**
 * Busca comorbidade canônica por ID
 * 
 * @param {number} comorbidadeId - ID da comorbidade (1-46)
 * @returns {object|null} Comorbidade ou null se não encontrada
 */
function getComorbidadeCanabicaById_(comorbidadeId) {
  try {
    const sheetName = SHEET_SCHEMA.REF_COMORBIDADES_CANABICAS.sheetName;
    const records = getAllRecords_(sheetName);
    
    const comorbidade = records.find(function(r) {
      return parseInt(r.id) === parseInt(comorbidadeId);
    });
    
    return comorbidade || null;
    
  } catch (error) {
    Logger.log('ERRO ao buscar comorbidade por ID: ' + error.message);
    return null;
  }
}

/**
 * Busca mecanismo agro-saúde de uma comorbidade específica
 * 
 * Retorna a descrição do mecanismo que conecta práticas agrícolas
 * (tipo de cultivo, solo, nutrientes) com efeitos terapêuticos.
 * 
 * @param {number} comorbidadeId - ID da comorbidade (1-46)
 * @returns {string|null} Texto do mecanismo ou null se não encontrado
 */
function getMecanismoAgroSaude_(comorbidadeId) {
  try {
    const comorbidade = getComorbidadeCanabicaById_(comorbidadeId);
    
    if (!comorbidade) {
      Logger.log('AVISO: Comorbidade ID ' + comorbidadeId + ' não encontrada');
      return null;
    }
    
    return comorbidade.mecanismo_agro_saude || null;
    
  } catch (error) {
    Logger.log('ERRO ao buscar mecanismo agro-saúde: ' + error.message);
    return null;
  }
}
