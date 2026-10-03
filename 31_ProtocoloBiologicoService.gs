/**
 * @file 31_ProtocoloBiologicoService.gs
 * @description Service layer para Protocolos Biológicos
 * Encapsula lógica de negócio: validação de compatibilidade, gestão de incompatibilidades,
 * versionamento de protocolos, e análise de risco químico
 */

var ProtocoloBiologicoService = (function() {
  'use strict';

  /**
   * Valida compatibilidade de um protocolo com uma receita específica
   * Verifica pH, EC, quelatos incompatíveis, e concentrações críticas
   * 
   * @param {string} protocoloId - ID do protocolo
   * @param {string} receitaId - ID da receita
   * @returns {Object} { compativel: boolean, alertas: string[], bloqueios: string[] }
   */
  function validarCompatibilidadeComReceita_(protocoloId, receitaId) {
    if (!protocoloId || !receitaId) {
      throw new Error('protocoloId e receitaId são obrigatórios');
    }

    var protocolo = getProtocoloById_(protocoloId);
    if (!protocolo) {
      throw new Error('Protocolo não encontrado: ' + protocoloId);
    }

    var receita = getReceitaById_(receitaId);
    if (!receita) {
      throw new Error('Receita não encontrada: ' + receitaId);
    }

    var alertas = [];
    var bloqueios = [];

    // REGRA 1: Range de pH
    if (receita.ph_solucao < protocolo.ph_minimo || receita.ph_solucao > protocolo.ph_maximo) {
      bloqueios.push(Utilities.formatString(
        'pH da receita (%.1f) fora do range do protocolo (%.1f - %.1f)',
        receita.ph_solucao,
        protocolo.ph_minimo,
        protocolo.ph_maximo
      ));
    }

    // REGRA 2: EC máximo
    if (receita.ec_final > protocolo.ec_maximo) {
      bloqueios.push(Utilities.formatString(
        'EC da receita (%.2f mS/cm) excede máximo do protocolo (%.2f mS/cm)',
        receita.ec_final,
        protocolo.ec_maximo
      ));
    }

    // REGRA 3: Quelatos incompatíveis
    if (protocolo.quelatos_incompativeis && protocolo.quelatos_incompativeis.length > 0) {
      var quelatosReceita = _extrairQuelatosReceita(receita);
      var incompativeis = quelatosReceita.filter(function(q) {
        return protocolo.quelatos_incompativeis.indexOf(q) !== -1;
      });

      if (incompativeis.length > 0) {
        bloqueios.push(
          'Quelatos incompatíveis detectados: ' + incompativeis.join(', ')
        );
      }
    }

    // REGRA 4: Concentrações críticas (alerta, não bloqueio)
    if (protocolo.concentracoes_criticas) {
      var avisos = _verificarConcentracoesCriticas(receita, protocolo.concentracoes_criticas);
      alertas = alertas.concat(avisos);
    }

    return {
      compativel: bloqueios.length === 0,
      alertas: alertas,
      bloqueios: bloqueios
    };
  }

  /**
   * Extrai lista de quelatos usados na receita (parsing simplificado)
   * Em produção, requer parsing do campo observacoes ou campo dedicado
   * 
   * @private
   * @param {Object} receita
   * @returns {Array<string>} Lista de quelatos (e.g., ['EDTA', 'DTPA'])
   */
  function _extrairQuelatosReceita(receita) {
    var quelatos = [];
    var campos = [
      receita.fe_ppm,
      receita.mn_ppm,
      receita.zn_ppm,
      receita.cu_ppm,
      receita.observacoes
    ];

    var texto = campos.join(' ').toUpperCase();

    if (texto.indexOf('EDTA') !== -1) quelatos.push('EDTA');
    if (texto.indexOf('DTPA') !== -1) quelatos.push('DTPA');
    if (texto.indexOf('EDDHA') !== -1) quelatos.push('EDDHA');

    return quelatos;
  }

  /**
   * Verifica se concentrações da receita excedem limites críticos do protocolo
   * 
   * @private
   * @param {Object} receita
   * @param {Object} concentracoesCriticas - { N_max: 200, P_max: 50, ... }
   * @returns {Array<string>} Lista de alertas
   */
  function _verificarConcentracoesCriticas(receita, concentracoesCriticas) {
    var alertas = [];

    var mapeamento = {
      'N_max': { valor: receita.n_ppm, nome: 'Nitrogênio' },
      'P_max': { valor: receita.p_ppm, nome: 'Fósforo' },
      'K_max': { valor: receita.k_ppm, nome: 'Potássio' },
      'Ca_max': { valor: receita.ca_ppm, nome: 'Cálcio' },
      'Mg_max': { valor: receita.mg_ppm, nome: 'Magnésio' },
      'Fe_max': { valor: receita.fe_ppm, nome: 'Ferro' },
      'Mn_max': { valor: receita.mn_ppm, nome: 'Manganês' },
      'Zn_max': { valor: receita.zn_ppm, nome: 'Zinco' },
      'Cu_max': { valor: receita.cu_ppm, nome: 'Cobre' },
      'B_max': { valor: receita.b_ppm, nome: 'Boro' },
      'Mo_max': { valor: receita.mo_ppm, nome: 'Molibdênio' }
    };

    for (var chave in concentracoesCriticas) {
      if (mapeamento[chave]) {
        var limite = concentracoesCriticas[chave];
        var atual = mapeamento[chave].valor;
        var nome = mapeamento[chave].nome;

        if (atual > limite) {
          alertas.push(Utilities.formatString(
            '%s (%.1f ppm) excede limite crítico do protocolo (%.1f ppm)',
            nome,
            atual,
            limite
          ));
        }
      }
    }

    return alertas;
  }

  /**
   * Obtém protocolo com lista de receitas compatíveis (pre-calculado)
   * Útil para sugerir receitas ao usuário ao escolher um protocolo
   * 
   * @param {string} protocoloId
   * @param {string} faseCultivo - Filtro opcional (PROPAGACAO, VEGETATIVA, FLORACAO)
   * @returns {Object} { protocolo: Object, receitasCompativeis: Array<Object> }
   */
  function getProtocoloComReceitas_(protocoloId, faseCultivo) {
    var protocolo = getProtocoloById_(protocoloId);
    if (!protocolo) {
      throw new Error('Protocolo não encontrado: ' + protocoloId);
    }

    var todasReceitas = getReceitasByFase_(protocolo.fase_cultivo);
    
    // Filtra receitas compatíveis
    var receitasCompativeis = todasReceitas.filter(function(receita) {
      var compat = validarCompatibilidadeComReceita_(protocoloId, receita.id);
      return compat.compativel;
    });

    // Adiciona score de compatibilidade (quanto menor alertas, melhor)
    receitasCompativeis.forEach(function(receita) {
      var compat = validarCompatibilidadeComReceita_(protocoloId, receita.id);
      receita._compatibilityScore = 100 - (compat.alertas.length * 10);
    });

    // Ordena por score decrescente
    receitasCompativeis.sort(function(a, b) {
      return b._compatibilityScore - a._compatibilityScore;
    });

    return {
      protocolo: protocolo,
      receitasCompativeis: receitasCompativeis
    };
  }

  /**
   * Adiciona incompatibilidade química ao protocolo
   * Atualiza campo JSON quelatos_incompativeis
   * 
   * @param {string} protocoloId
   * @param {string} quelato - EDTA, DTPA, EDDHA
   * @param {string} motivo - Razão da incompatibilidade
   * @returns {Object} Protocolo atualizado
   */
  function adicionarIncompatibilidade_(protocoloId, quelato, motivo) {
    var protocolo = getProtocoloById_(protocoloId);
    if (!protocolo) {
      throw new Error('Protocolo não encontrado: ' + protocoloId);
    }

    var quelatosValidos = ['EDTA', 'DTPA', 'EDDHA'];
    if (quelatosValidos.indexOf(quelato) === -1) {
      throw new Error('Quelato inválido. Use: ' + quelatosValidos.join(', '));
    }

    var incompativeis = protocolo.quelatos_incompativeis || [];
    if (incompativeis.indexOf(quelato) === -1) {
      incompativeis.push(quelato);
    }

    // Atualiza também observações com histórico
    var obs = protocolo.observacoes || '';
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    var novaObs = obs + '\n[' + timestamp + '] Incompatibilidade adicionada: ' + quelato + ' - ' + motivo;

    return updateProtocolo_(protocoloId, {
      quelatos_incompativeis: incompativeis,
      observacoes: novaObs.trim()
    }, Session.getEffectiveUser().getEmail());
  }

  /**
   * Remove incompatibilidade química do protocolo
   * 
   * @param {string} protocoloId
   * @param {string} quelato
   * @returns {Object} Protocolo atualizado
   */
  function removerIncompatibilidade_(protocoloId, quelato) {
    var protocolo = getProtocoloById_(protocoloId);
    if (!protocolo) {
      throw new Error('Protocolo não encontrado: ' + protocoloId);
    }

    var incompativeis = protocolo.quelatos_incompativeis || [];
    var index = incompativeis.indexOf(quelato);
    
    if (index !== -1) {
      incompativeis.splice(index, 1);
    }

    return updateProtocolo_(protocoloId, {
      quelatos_incompativeis: incompativeis
    }, Session.getEffectiveUser().getEmail());
  }

  /**
   * Cria nova versão de um protocolo (versionamento manual)
   * Copia protocolo existente incrementando contador de versão
   * 
   * @param {string} protocoloId
   * @param {Object} alteracoes - Campos a serem modificados na nova versão
   * @param {string} motivoVersao - Justificativa da nova versão
   * @returns {Object} Novo protocolo (versão incrementada)
   */
  function criarNovaVersao_(protocoloId, alteracoes, motivoVersao) {
    var protocoloOriginal = getProtocoloById_(protocoloId);
    if (!protocoloOriginal) {
      throw new Error('Protocolo não encontrado: ' + protocoloId);
    }

    // Incrementa versão
    var novaVersao = (protocoloOriginal.versao || 1) + 1;

    // Copia dados do original
    var novoProtocolo = {
      organismo_alvo: protocoloOriginal.organismo_alvo,
      tipo_aplicacao: protocoloOriginal.tipo_aplicacao,
      fase_cultivo: protocoloOriginal.fase_cultivo,
      concentracao_recomendada: protocoloOriginal.concentracao_recomendada,
      intervalo_aplicacao_dias: protocoloOriginal.intervalo_aplicacao_dias,
      ph_minimo: protocoloOriginal.ph_minimo,
      ph_maximo: protocoloOriginal.ph_maximo,
      ec_maximo: protocoloOriginal.ec_maximo,
      temperatura_minima: protocoloOriginal.temperatura_minima,
      temperatura_maxima: protocoloOriginal.temperatura_maxima,
      quelatos_incompativeis: protocoloOriginal.quelatos_incompativeis ? 
        JSON.parse(JSON.stringify(protocoloOriginal.quelatos_incompativeis)) : [],
      concentracoes_criticas: protocoloOriginal.concentracoes_criticas ?
        JSON.parse(JSON.stringify(protocoloOriginal.concentracoes_criticas)) : null,
      precaucoes: protocoloOriginal.precaucoes,
      observacoes: protocoloOriginal.observacoes,
      versao: novaVersao,
      data_versao: new Date()
    };

    // Aplica alterações
    for (var campo in alteracoes) {
      if (alteracoes.hasOwnProperty(campo)) {
        novoProtocolo[campo] = alteracoes[campo];
      }
    }

    // Adiciona motivo às observações
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
    novoProtocolo.observacoes = (novoProtocolo.observacoes || '') + 
      '\n[' + timestamp + '] Versão ' + novaVersao + ': ' + motivoVersao;

    return createProtocoloBiologico_(Session.getEffectiveUser().getEmail(), novoProtocolo);
  }

  /**
   * Obtém histórico de versões de um protocolo
   * Busca todos os protocolos com mesmo organismo_alvo
   * 
   * @param {string} organismoAlvo
   * @returns {Array<Object>} Lista de protocolos ordenados por versão DESC
   */
  function getHistoricoVersoes_(organismoAlvo) {
    var todos = getProtocolosByOrganismoAlvo_(organismoAlvo);
    
    // Ordena por versão decrescente
    todos.sort(function(a, b) {
      return (b.versao || 1) - (a.versao || 1);
    });

    return todos;
  }

  /**
   * Calcula score de eficácia de um protocolo baseado em pareceres históricos
   * Score = % de pareceres COMPATIVEL nos últimos 30 dias
   * 
   * @param {string} protocoloId
   * @param {number} diasHistorico - Default 30 dias
   * @returns {Object} { score: number, totalPareceres: number, compatibilidadeRate: number }
   */
  function calcularScoreEficacia_(protocoloId, diasHistorico) {
    diasHistorico = diasHistorico || 30;

    var dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - diasHistorico);

    // Busca pareceres via 14_SpreadsheetGateway.gs (funções livres)
    var sheetName = 'Pareceres_Compatibilidade';
    var data = getAllRows_(sheetName);

    var pareceres = data.filter(function(row) {
      return row.protocolo_id === protocoloId &&
             new Date(row.created_at) >= dataInicio;
    });

    if (pareceres.length === 0) {
      return {
        score: null,
        totalPareceres: 0,
        compatibilidadeRate: 0,
        mensagem: 'Sem pareceres nos últimos ' + diasHistorico + ' dias'
      };
    }

    var compativeis = pareceres.filter(function(p) {
      return p.veredicto === 'COMPATIVEL';
    }).length;

    var compatibilidadeRate = (compativeis / pareceres.length) * 100;

    return {
      score: Math.round(compatibilidadeRate),
      totalPareceres: pareceres.length,
      compatibilidadeRate: compatibilidadeRate
    };
  }

  /**
   * Sugere ajustes em uma receita para torná-la compatível com o protocolo
   * Retorna recomendações de alteração de pH, EC, ou remoção de quelatos
   * 
   * @param {string} protocoloId
   * @param {string} receitaId
   * @returns {Object} { ajustes: Array<Object>, receitaAjustada: Object }
   */
  function sugerirAjustesReceita_(protocoloId, receitaId) {
    var validacao = validarCompatibilidadeComReceita_(protocoloId, receitaId);
    
    if (validacao.compativel) {
      return {
        ajustes: [],
        mensagem: 'Receita já é compatível com o protocolo'
      };
    }

    var protocolo = getProtocoloById_(protocoloId);
    var receita = getReceitaById_(receitaId);
    var ajustes = [];

    // Ajuste de pH
    if (receita.ph_solucao < protocolo.ph_minimo) {
      ajustes.push({
        campo: 'ph_solucao',
        valorAtual: receita.ph_solucao,
        valorSugerido: protocolo.ph_minimo,
        acao: 'Aumentar pH para ' + protocolo.ph_minimo
      });
    } else if (receita.ph_solucao > protocolo.ph_maximo) {
      ajustes.push({
        campo: 'ph_solucao',
        valorAtual: receita.ph_solucao,
        valorSugerido: protocolo.ph_maximo,
        acao: 'Reduzir pH para ' + protocolo.ph_maximo
      });
    }

    // Ajuste de EC
    if (receita.ec_final > protocolo.ec_maximo) {
      var reducaoPercentual = ((receita.ec_final - protocolo.ec_maximo) / receita.ec_final) * 100;
      ajustes.push({
        campo: 'ec_final',
        valorAtual: receita.ec_final,
        valorSugerido: protocolo.ec_maximo,
        acao: 'Reduzir EC em ' + reducaoPercentual.toFixed(1) + '% (diluir solução)'
      });
    }

    // Remoção de quelatos incompatíveis
    var quelatosReceita = _extrairQuelatosReceita(receita);
    var incompativeis = quelatosReceita.filter(function(q) {
      return protocolo.quelatos_incompativeis.indexOf(q) !== -1;
    });

    if (incompativeis.length > 0) {
      ajustes.push({
        campo: 'quelatos',
        valorAtual: incompativeis.join(', '),
        valorSugerido: null,
        acao: 'Remover ou substituir quelatos: ' + incompativeis.join(', ')
      });
    }

    return {
      ajustes: ajustes,
      receitaOriginal: receita
    };
  }

  // Interface pública
  return {
    validarCompatibilidadeComReceita: validarCompatibilidadeComReceita_,
    getProtocoloComReceitas: getProtocoloComReceitas_,
    adicionarIncompatibilidade: adicionarIncompatibilidade_,
    removerIncompatibilidade: removerIncompatibilidade_,
    criarNovaVersao: criarNovaVersao_,
    getHistoricoVersoes: getHistoricoVersoes_,
    calcularScoreEficacia: calcularScoreEficacia_,
    sugerirAjustesReceita: sugerirAjustesReceita_
  };
})();
