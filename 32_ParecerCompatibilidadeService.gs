/**
 * @file 32_ParecerCompatibilidadeService.gs
 * @description Service layer para Pareceres de Compatibilidade
 * Encapsula lógica de negócio: análise automática, workflow de aprovação humana,
 * estatísticas de compatibilidade, e relatórios consolidados
 */

var ParecerCompatibilidadeService = (function() {
  'use strict';

  /**
   * Cria parecer de compatibilidade com análise automática completa
   * Wrapper de alto nível que executa todas as 4 regras de compatibilidade
   * 
   * @param {string} receitaId
   * @param {string} protocoloId
   * @param {Array<string>} loteIds - Lista de IDs de lotes envolvidos
   * @returns {Object} Parecer criado com veredicto automático
   */
  function analisarCompatibilidadeCompleta_(receitaId, protocoloId, loteIds) {
    if (!receitaId || !protocoloId) {
      throw new Error('receitaId e protocoloId são obrigatórios');
    }

    if (!loteIds || !Array.isArray(loteIds) || loteIds.length === 0) {
      throw new Error('loteIds deve ser array não-vazio');
    }

    // Validação de existência
    var receita = getReceitaById_(receitaId);
    if (!receita) {
      throw new Error('Receita não encontrada: ' + receitaId);
    }

    var protocolo = getProtocoloById_(protocoloId);
    if (!protocolo) {
      throw new Error('Protocolo não encontrado: ' + protocoloId);
    }

    var lotes = loteIds.map(function(id) {
      var lote = getLoteCoAById_(id);
      if (!lote) {
        throw new Error('Lote não encontrado: ' + id);
      }
      return lote;
    });

    // Executa análise automática (4 regras) via repository
    return analisarCompatibilidade_(receitaId, protocoloId, loteIds, Session.getEffectiveUser().getEmail(), Session.getEffectiveUser().getEmail());
  }

  /**
   * Solicita revisão humana para parecer com veredicto REVISAO_HUMANA
   * Atualiza parecer com solicitação e notifica analista (placeholder)
   * 
   * @param {string} parecerId
   * @param {string} motivo - Razão da solicitação de revisão
   * @param {string} analistaEmail - Email do analista responsável
   * @returns {Object} Parecer atualizado
   */
  function solicitarRevisaoHumana_(parecerId, motivo, analistaEmail) {
    var parecer = getParecerById_(parecerId);
    if (!parecer) {
      throw new Error('Parecer não encontrado: ' + parecerId);
    }

    if (parecer.veredicto !== 'REVISAO_HUMANA') {
      throw new Error('Apenas pareceres com veredicto REVISAO_HUMANA podem solicitar revisão');
    }

    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    var obs = parecer.observacoes || '';
    var novaObs = obs + '\n[' + timestamp + '] Revisão solicitada para: ' + analistaEmail + 
                  '\nMotivo: ' + motivo;

    // TODO: Integrar com sistema de notificação (email, Slack, etc)
    // _enviarNotificacaoAnalista(analistaEmail, parecerId, motivo);

    return updateParecer_(parecerId, {
      observacoes: novaObs.trim(),
      analista_responsavel: analistaEmail
    }, Session.getEffectiveUser().getEmail());
  }

  /**
   * Aprova parecer após revisão humana
   * Muda veredicto de REVISAO_HUMANA para COMPATIVEL ou COMPATIVEL_COM_RESSALVAS
   * 
   * @param {string} parecerId
   * @param {string} novoVeredicto - COMPATIVEL ou COMPATIVEL_COM_RESSALVAS
   * @param {string} justificativa
   * @param {string} aprovadorEmail
   * @returns {Object} Parecer atualizado
   */
  function aprovarParecer_(parecerId, novoVeredicto, justificativa, aprovadorEmail) {
    var parecer = getParecerById_(parecerId);
    if (!parecer) {
      throw new Error('Parecer não encontrado: ' + parecerId);
    }

    var verdictosValidos = ['COMPATIVEL', 'COMPATIVEL_COM_RESSALVAS'];
    if (verdictosValidos.indexOf(novoVeredicto) === -1) {
      throw new Error('novoVeredicto deve ser COMPATIVEL ou COMPATIVEL_COM_RESSALVAS');
    }

    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    var obs = parecer.observacoes || '';
    var novaObs = obs + '\n[' + timestamp + '] Aprovado por: ' + aprovadorEmail + 
                  '\nVeredicto final: ' + novoVeredicto +
                  '\nJustificativa: ' + justificativa;

    return updateParecer_(parecerId, {
      veredicto: novoVeredicto,
      observacoes: novaObs.trim(),
      aprovado_por: aprovadorEmail,
      data_aprovacao: new Date()
    }, Session.getEffectiveUser().getEmail());
  }

  /**
   * Reprova parecer após revisão humana
   * Muda veredicto de REVISAO_HUMANA para INCOMPATIVEL
   * 
   * @param {string} parecerId
   * @param {string} justificativa
   * @param {string} reprovadorEmail
   * @returns {Object} Parecer atualizado
   */
  function reprovarParecer_(parecerId, justificativa, reprovadorEmail) {
    var parecer = getParecerById_(parecerId);
    if (!parecer) {
      throw new Error('Parecer não encontrado: ' + parecerId);
    }

    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    var obs = parecer.observacoes || '';
    var novaObs = obs + '\n[' + timestamp + '] Reprovado por: ' + reprovadorEmail + 
                  '\nJustificativa: ' + justificativa;

    return updateParecer_(parecerId, {
      veredicto: 'INCOMPATIVEL',
      observacoes: novaObs.trim(),
      reprovado_por: reprovadorEmail,
      data_reprovacao: new Date()
    }, Session.getEffectiveUser().getEmail());
  }

  /**
   * Obtém estatísticas de compatibilidade para uma receita específica
   * Analisa histórico de pareceres e calcula taxa de aprovação
   * 
   * @param {string} receitaId
   * @param {number} diasHistorico - Default 90 dias
   * @returns {Object} Estatísticas consolidadas
   */
  function getEstatisticasReceita_(receitaId, diasHistorico) {
    diasHistorico = diasHistorico || 90;

    var dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - diasHistorico);

    var pareceres = getPareceresByReceita_(receitaId);
    
    // Filtra por período
    pareceres = pareceres.filter(function(p) {
      return new Date(p.created_at) >= dataInicio;
    });

    if (pareceres.length === 0) {
      return {
        receitaId: receitaId,
        totalPareceres: 0,
        diasAnalisados: diasHistorico,
        taxaAprovacao: null,
        mensagem: 'Sem pareceres nos últimos ' + diasHistorico + ' dias'
      };
    }

    var porVeredicto = _contarPorVeredicto(pareceres);
    var totalAprovados = porVeredicto.COMPATIVEL + porVeredicto.COMPATIVEL_COM_RESSALVAS;
    var taxaAprovacao = (totalAprovados / pareceres.length) * 100;

    return {
      receitaId: receitaId,
      totalPareceres: pareceres.length,
      diasAnalisados: diasHistorico,
      taxaAprovacao: taxaAprovacao,
      distribuicao: porVeredicto,
      protocolosMaisUsados: _getProtocolosMaisUsados(pareceres)
    };
  }

  /**
   * Obtém estatísticas de compatibilidade para um protocolo específico
   * 
   * @param {string} protocoloId
   * @param {number} diasHistorico - Default 90 dias
   * @returns {Object} Estatísticas consolidadas
   */
  function getEstatisticasProtocolo_(protocoloId, diasHistorico) {
    diasHistorico = diasHistorico || 90;

    var dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - diasHistorico);

    var pareceres = getPareceresByProtocolo_(protocoloId);
    
    pareceres = pareceres.filter(function(p) {
      return new Date(p.created_at) >= dataInicio;
    });

    if (pareceres.length === 0) {
      return {
        protocoloId: protocoloId,
        totalPareceres: 0,
        diasAnalisados: diasHistorico,
        taxaAprovacao: null,
        mensagem: 'Sem pareceres nos últimos ' + diasHistorico + ' dias'
      };
    }

    var porVeredicto = _contarPorVeredicto(pareceres);
    var totalAprovados = porVeredicto.COMPATIVEL + porVeredicto.COMPATIVEL_COM_RESSALVAS;
    var taxaAprovacao = (totalAprovados / pareceres.length) * 100;

    return {
      protocoloId: protocoloId,
      totalPareceres: pareceres.length,
      diasAnalisados: diasHistorico,
      taxaAprovacao: taxaAprovacao,
      distribuicao: porVeredicto,
      receitasMaisUsadas: _getReceitasMaisUsadas(pareceres)
    };
  }

  /**
   * Conta pareceres por veredicto
   * @private
   */
  function _contarPorVeredicto(pareceres) {
    var contadores = {
      COMPATIVEL: 0,
      COMPATIVEL_COM_RESSALVAS: 0,
      INCOMPATIVEL: 0,
      REVISAO_HUMANA: 0
    };

    pareceres.forEach(function(p) {
      if (contadores.hasOwnProperty(p.veredicto)) {
        contadores[p.veredicto]++;
      }
    });

    return contadores;
  }

  /**
   * Identifica protocolos mais usados em pareceres
   * @private
   */
  function _getProtocolosMaisUsados(pareceres) {
    var freq = {};
    
    pareceres.forEach(function(p) {
      freq[p.protocolo_id] = (freq[p.protocolo_id] || 0) + 1;
    });

    var lista = Object.keys(freq).map(function(id) {
      return { protocoloId: id, count: freq[id] };
    });

    lista.sort(function(a, b) { return b.count - a.count; });
    return lista.slice(0, 5);
  }

  /**
   * Identifica receitas mais usadas em pareceres
   * @private
   */
  function _getReceitasMaisUsadas(pareceres) {
    var freq = {};
    
    pareceres.forEach(function(p) {
      freq[p.receita_id] = (freq[p.receita_id] || 0) + 1;
    });

    var lista = Object.keys(freq).map(function(id) {
      return { receitaId: id, count: freq[id] };
    });

    lista.sort(function(a, b) { return b.count - a.count; });
    return lista.slice(0, 5);
  }

  /**
   * Gera relatório consolidado de compatibilidade para período
   * Agrega estatísticas de todas as receitas e protocolos
   * 
   * @param {Date} dataInicio
   * @param {Date} dataFim
   * @returns {Object} Relatório consolidado
   */
  function gerarRelatorioConsolidado_(dataInicio, dataFim) {
    if (!dataInicio || !dataFim) {
      throw new Error('dataInicio e dataFim são obrigatórias');
    }

    if (dataInicio > dataFim) {
      throw new Error('dataInicio não pode ser maior que dataFim');
    }

    var sheetName = 'Pareceres_Compatibilidade';
    var data = getAllRows_(sheetName);

    var pareceres = data.filter(function(row) {
      var criado = new Date(row.created_at);
      return criado >= dataInicio && criado <= dataFim;
    });

    if (pareceres.length === 0) {
      return {
        periodo: {
          inicio: dataInicio,
          fim: dataFim
        },
        totalPareceres: 0,
        mensagem: 'Nenhum parecer encontrado no período'
      };
    }

    var porVeredicto = _contarPorVeredicto(pareceres);
    var totalAprovados = porVeredicto.COMPATIVEL + porVeredicto.COMPATIVEL_COM_RESSALVAS;
    var taxaAprovacao = (totalAprovados / pareceres.length) * 100;

    // Identifica problemas mais comuns
    var problemasFrequentes = _analisarProblemasFrequentes(pareceres);

    return {
      periodo: {
        inicio: dataInicio,
        fim: dataFim,
        dias: Math.ceil((dataFim - dataInicio) / (1000 * 60 * 60 * 24))
      },
      totalPareceres: pareceres.length,
      taxaAprovacao: taxaAprovacao,
      distribuicao: porVeredicto,
      protocolosMaisUsados: _getProtocolosMaisUsados(pareceres),
      receitasMaisUsadas: _getReceitasMaisUsadas(pareceres),
      problemasFrequentes: problemasFrequentes
    };
  }

  /**
   * Analisa pareceres para identificar problemas mais comuns
   * @private
   */
  function _analisarProblemasFrequentes(pareceres) {
    var problemas = {
      ph_fora_range: 0,
      ec_excedido: 0,
      quelato_incompativel: 0,
      lote_nao_liberado: 0
    };

    pareceres.forEach(function(p) {
      var obs = (p.observacoes || '').toLowerCase();
      
      if (obs.indexOf('ph') !== -1 && obs.indexOf('fora') !== -1) {
        problemas.ph_fora_range++;
      }
      if (obs.indexOf('ec') !== -1 && obs.indexOf('excede') !== -1) {
        problemas.ec_excedido++;
      }
      if (obs.indexOf('quelato') !== -1 && obs.indexOf('incompatível') !== -1) {
        problemas.quelato_incompativel++;
      }
      if (obs.indexOf('lote') !== -1 && obs.indexOf('liberado') !== -1) {
        problemas.lote_nao_liberado++;
      }
    });

    var lista = Object.keys(problemas).map(function(tipo) {
      return { tipo: tipo, ocorrencias: problemas[tipo] };
    });

    lista.sort(function(a, b) { return b.ocorrencias - a.ocorrencias; });
    return lista;
  }

  /**
   * Obtém pareceres pendentes de revisão humana
   * Útil para dashboard de analistas
   * 
   * @param {string} analistaEmail - Filtro opcional por analista
   * @returns {Array<Object>} Lista de pareceres com veredicto REVISAO_HUMANA
   */
  function getPareceresRevisaoPendente_(analistaEmail) {
    var pareceres = getPareceresByVeredicto_('REVISAO_HUMANA');

    if (analistaEmail) {
      pareceres = pareceres.filter(function(p) {
        return p.analista_responsavel === analistaEmail;
      });
    }

    // Ordena por data de criação (mais antigos primeiro)
    pareceres.sort(function(a, b) {
      return new Date(a.created_at) - new Date(b.created_at);
    });

    // Enriquece com tempo de espera
    pareceres.forEach(function(p) {
      var criado = new Date(p.created_at);
      var agora = new Date();
      var diasEspera = Math.ceil((agora - criado) / (1000 * 60 * 60 * 24));
      p._diasEspera = diasEspera;
      p._prioridade = diasEspera > 7 ? 'ALTA' : diasEspera > 3 ? 'MEDIA' : 'BAIXA';
    });

    return pareceres;
  }

  /**
   * Compara duas combinações receita+protocolo lado a lado
   * Útil para escolher melhor combinação antes de criar parecer
   * 
   * @param {string} receitaId1
   * @param {string} protocoloId1
   * @param {string} receitaId2
   * @param {string} protocoloId2
   * @returns {Object} Comparação detalhada com recomendação
   */
  function compararCombinacoes_(receitaId1, protocoloId1, receitaId2, protocoloId2) {
    // Simula análise sem criar parecer
    var analise1 = {
      receita_id: receitaId1,
      protocolo_id: protocoloId1,
      compatibilidade: protocoloService_.validarCompatibilidadeComReceita(protocoloId1, receitaId1)
    };

    var analise2 = {
      receita_id: receitaId2,
      protocolo_id: protocoloId2,
      compatibilidade: protocoloService_.validarCompatibilidadeComReceita(protocoloId2, receitaId2)
    };

    // Calcula score (100 - penalidades)
    var score1 = 100 - (analise1.compatibilidade.bloqueios.length * 30) - 
                        (analise1.compatibilidade.alertas.length * 10);
    var score2 = 100 - (analise2.compatibilidade.bloqueios.length * 30) - 
                        (analise2.compatibilidade.alertas.length * 10);

    analise1.score = Math.max(0, score1);
    analise2.score = Math.max(0, score2);

    var recomendacao = score1 > score2 ? 1 : score1 < score2 ? 2 : 0;

    return {
      combinacao1: analise1,
      combinacao2: analise2,
      recomendacao: recomendacao === 1 ? 'Combinação 1' : 
                    recomendacao === 2 ? 'Combinação 2' : 
                    'Ambas equivalentes',
      diferencaScore: Math.abs(score1 - score2)
    };
  }

  // Interface pública
  return {
    analisarCompatibilidadeCompleta: analisarCompatibilidadeCompleta_,
    solicitarRevisaoHumana: solicitarRevisaoHumana_,
    aprovarParecer: aprovarParecer_,
    reprovarParecer: reprovarParecer_,
    getEstatisticasReceita: getEstatisticasReceita_,
    getEstatisticasProtocolo: getEstatisticasProtocolo_,
    gerarRelatorioConsolidado: gerarRelatorioConsolidado_,
    getPareceresRevisaoPendente: getPareceresRevisaoPendente_,
    compararCombinacoes: compararCombinacoes_
  };
})();
