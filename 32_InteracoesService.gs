/**
 * COMPONENTE: 32_InteracoesService.gs
 * PAPEL: Checagem de interações medicamentosas CYP450
 * STATUS: v1.0 — P0-3: Interações CYP450 CBD×medicamentos
 * 
 * RESPONSABILIDADE:
 * - Seed de interações críticas em REF_INTERACOES
 * - Checagem de interações medicamentosas
 * - Alertas por severidade
 */

// ============================================================================
// SEED DE INTERAÇÕES CRÍTICAS
// ============================================================================

/**
 * Popula REF_INTERACOES com interações críticas CBD×medicamentos
 * Executa apenas se tabela estiver vazia
 * 
 * Fontes:
 * - PubMed ID 28538134: CBD×Clobazam
 * - PubMed ID 29285829: CBD×Varfarina
 * - PubMed ID 30671616: CBD×ISRSs
 * - PubMed ID 28061193: THC×Benzodiazepínicos
 */
function popularInteracoesCriticas_() {
  const existentes = getAllRowsAsObjects_('REF_INTERACOES');
  if (existentes.length > 0) {
    logInfo_('Interações já populadas', { total: existentes.length });
    return {
      populado: false,
      razao: 'Tabela já contém interações',
      total: existentes.length
    };
  }
  
  const interacoes = [
    {
      id: generateUUID_(),
      substancia_canabica: 'CBD',
      medicamento_classe: 'Anticonvulsivante',
      medicamento_nome: 'Clobazam',
      mecanismo: 'CBD inibe CYP2C19, aumentando norclobazam (metabólito ativo)',
      severidade: SEVERIDADE_INTERACAO.GRAVE,
      evidencia: EVIDENCIA_INTERACAO.BEM_DOCUMENTADA,
      recomendacao: 'Reduzir dose de clobazam em 50% ao iniciar CBD. Monitorar sedação, ataxia.',
      referencia_pubmed_id: '28538134',
      ativo: true
    },
    {
      id: generateUUID_(),
      substancia_canabica: 'CBD',
      medicamento_classe: 'Anticoagulante',
      medicamento_nome: 'Varfarina',
      mecanismo: 'CBD inibe CYP2C9, aumentando nível de varfarina',
      severidade: SEVERIDADE_INTERACAO.GRAVE,
      evidencia: EVIDENCIA_INTERACAO.BEM_DOCUMENTADA,
      recomendacao: 'Monitorar INR semanalmente nas primeiras 4 semanas. Ajustar dose conforme INR.',
      referencia_pubmed_id: '29285829',
      ativo: true
    },
    {
      id: generateUUID_(),
      substancia_canabica: 'CBD',
      medicamento_classe: 'Anticonvulsivante',
      medicamento_nome: 'Ácido Valproico',
      mecanismo: 'CBD inibe CYP2C9, pode aumentar nível de valproato',
      severidade: SEVERIDADE_INTERACAO.MODERADA,
      evidencia: EVIDENCIA_INTERACAO.PROVAVEL,
      recomendacao: 'Monitorar enzimas hepáticas. Avaliar sinais de hepatotoxicidade.',
      referencia_pubmed_id: '30671616',
      ativo: true
    },
    {
      id: generateUUID_(),
      substancia_canabica: 'CBD',
      medicamento_classe: 'ISRS',
      medicamento_nome: 'Citalopram',
      mecanismo: 'CBD inibe CYP2C19, pode aumentar nível de citalopram',
      severidade: SEVERIDADE_INTERACAO.MODERADA,
      evidencia: EVIDENCIA_INTERACAO.PROVAVEL,
      recomendacao: 'Monitorar sintomas de excesso serotoninérgico. Considerar ECG (QTc).',
      referencia_pubmed_id: '30671616',
      ativo: true
    },
    {
      id: generateUUID_(),
      substancia_canabica: 'CBD',
      medicamento_classe: 'ISRS',
      medicamento_nome: 'Sertralina',
      mecanismo: 'CBD inibe CYP2D6, pode aumentar nível de sertralina',
      severidade: SEVERIDADE_INTERACAO.MODERADA,
      evidencia: EVIDENCIA_INTERACAO.PROVAVEL,
      recomendacao: 'Monitorar efeitos adversos serotoninérgicos. Ajustar dose se necessário.',
      referencia_pubmed_id: '30671616',
      ativo: true
    },
    {
      id: generateUUID_(),
      substancia_canabica: 'THC',
      medicamento_classe: 'Sedativo/Hipnótico',
      medicamento_nome: 'Benzodiazepínicos',
      mecanismo: 'Efeito aditivo depressor do SNC',
      severidade: SEVERIDADE_INTERACAO.MODERADA,
      evidencia: EVIDENCIA_INTERACAO.PROVAVEL,
      recomendacao: 'Reduzir dose de benzodiazepínico. Monitorar sedação excessiva e risco de quedas.',
      referencia_pubmed_id: '28061193',
      ativo: true
    }
  ];
  
  // P0-3: Validar cada interação contra schema antes de inserir
  const schema = getCreateInteracaoSchema_();
  const interacoesValidas = [];
  const errosValidacao = [];
  
  interacoes.forEach(function(interacao) {
    const validacao = validateObject_(interacao, schema);
    if (validacao.valid) {
      interacoesValidas.push(interacao);
    } else {
      errosValidacao.push({
        medicamento: interacao.medicamento_nome,
        erros: validacao.errors
      });
      logError_('Interação inválida no seed', { 
        medicamento: interacao.medicamento_nome,
        erros: validacao.errors 
      });
    }
  });
  
  // Se houve erros de validação, abortar
  if (errosValidacao.length > 0) {
    throw new Error('SEED_VALIDATION_ERROR: ' + errosValidacao.length + 
                    ' interações com validação falha. Verifique logs.');
  }
  
  // Inserir todas as interações válidas
  interacoesValidas.forEach(function(int) {
    appendRow_('REF_INTERACOES', int);
  });
  
  logInfo_('Interações críticas populadas', { total: interacoesValidas.length });
  
  return {
    populado: true,
    total: interacoesValidas.length
  };
}

// ============================================================================
// CHECAGEM DE INTERAÇÕES
// ============================================================================

/**
 * Checa interações medicamentosas para prescrição
 * 
 * LIMITAÇÃO: Retorna vazio se DB_MEDICAMENTOS_USO não contém registros para o paciente.
 * Isto pode criar falso negativo se o médico ainda não preencheu a lista de medicamentos.
 * 
 * RECOMENDAÇÃO FUTURA: ValidationService deveria exigir que DB_MEDICAMENTOS_USO seja
 * explicitamente preenchido (mesmo com nota "nenhum medicamento concomitante") antes
 * de permitir prescrição. Decisão de produto sobre se bloquear ou apenas alertar.
 * 
 * @param {string} pacienteId
 * @param {Array} substancias — ['CBD', 'THC']
 * @returns {Object} {temInteracoes: boolean, interacoes: [], medicamentos: []}
 */
function checarInteracoesMedicamentosas_(pacienteId, substancias) {
  // Buscar medicamentos em uso pelo paciente
  const medicamentosUso = getAllRowsAsObjects_('DB_MEDICAMENTOS_USO').filter(function(m) {
    return m.paciente_id === pacienteId && m.ativo === true;
  });
  
  // ATENÇÃO (P0-3 Review Finding): Se vazio, pode ser porque (1) paciente não usa medicamentos OU
  // (2) médico ainda não preencheu. Não há como distinguir os dois casos aqui.
  // SOLUÇÃO: Retornar warning com severidade HIGH_PRIORITY para forçar confirmação do prescritor
  if (medicamentosUso.length === 0) {
    return {
      temInteracoes: false,
      interacoes: [],
      medicamentos: [],
      alerta: {
        tipo: 'HIGH_PRIORITY',
        mensagem: 'Nenhum medicamento registrado em DB_MEDICAMENTOS_USO para este paciente. ' +
                  'ATENÇÃO: Confirme se o paciente realmente NÃO usa medicamentos concomitantes ' +
                  'ou se a lista precisa ser preenchida antes de prescrever cannabis.',
        acao_requerida: 'Verifique prontuário e atualize DB_MEDICAMENTOS_USO antes de prosseguir'
      }
    };
  }
  
  // Buscar interações conhecidas
  const todasInteracoes = getAllRowsAsObjects_('REF_INTERACOES').filter(function(i) {
    return i.ativo === true;
  });
  
  const interacoesEncontradas = [];
  
  medicamentosUso.forEach(function(med) {
    substancias.forEach(function(subst) {
      const matches = todasInteracoes.filter(function(int) {
        return (
          int.substancia_canabica === subst &&
          (
            int.medicamento_nome.toLowerCase() === med.principio_ativo.toLowerCase() ||
            int.medicamento_nome.toLowerCase() === med.medicamento_nome.toLowerCase() ||
            med.medicamento_nome.toLowerCase().indexOf(int.medicamento_nome.toLowerCase()) !== -1
          )
        );
      });
      
      matches.forEach(function(match) {
        interacoesEncontradas.push({
          medicamento: med.medicamento_nome,
          principioAtivo: med.principio_ativo,
          substanciaCanabica: match.substancia_canabica,
          severidade: match.severidade,
          mecanismo: match.mecanismo,
          recomendacao: match.recomendacao,
          evidencia: match.evidencia,
          pubmedId: match.referencia_pubmed_id
        });
      });
    });
  });
  
  return {
    temInteracoes: interacoesEncontradas.length > 0,
    interacoes: interacoesEncontradas,
    medicamentos: medicamentosUso.map(function(m) {
      return {
        nome: m.medicamento_nome,
        principioAtivo: m.principio_ativo,
        dose: m.dose
      };
    })
  };
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

const INTERACOES_SERVICE_LOADED = true;
