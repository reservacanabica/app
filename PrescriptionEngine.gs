/**
 * PrescriptionEngine.gs
 * Motor de Prescrição Médica e Geração de PDF
 *
 * CORRIGIDO: Substituídas chamadas SpreadsheetGateway.getRowById_/updateRowById_
 * pelas funções livres getRowById_ e updateRowById_ de 14_SpreadsheetGateway.gs
 */

const PrescriptionEngine = {

  /**
   * Emite uma prescrição médica a partir de um registro existente na DB_RECEITAS.
   * @param {string} receitaId
   * @returns {Object} { receitaId, pdfUrl, driveFileId, hash }
   */
  emitirPrescricao(receitaId) {
    // 1. Buscar dados da receita
    const receita = getRowById_('DB_RECEITAS', receitaId);
    if (!receita) {
      throw new Error('Receita não encontrada: ' + receitaId);
    }

    // 2. Buscar dados do paciente
    const paciente = getRowById_('DB_PACIENTES', receita.paciente_id);
    if (!paciente) {
      throw new Error('Paciente não encontrado para a receita: ' + receitaId);
    }

    // 3. Validar propriedades obrigatórias do script
    const props = PropertiesService.getScriptProperties();
    const templateId = props.getProperty('TEMPLATE_DOCS_PRESCRICAO_ID');
    const folderId   = props.getProperty('FOLDER_PRESCRICOES_ID');

    if (!templateId || !folderId) {
      throw new Error(
        'Propriedades TEMPLATE_DOCS_PRESCRICAO_ID e FOLDER_PRESCRICOES_ID ' +
        'devem estar configuradas nas Script Properties.'
      );
    }

    // 4. Clonar documento template
    const pastaDestino = DriveApp.getFolderById(folderId);
    const arquivoTemp  = DriveApp.getFileById(templateId).makeCopy('TEMP_REC_' + receita.id, pastaDestino);
    const docTemp      = DocumentApp.openById(arquivoTemp.getId());
    const body         = docTemp.getBody();

    // 5. Gerar Hash SHA-256 de validação
    const rawString  = receita.id + '|' + paciente.cpf_hash + '|' + receita.produto_nome + '|' + receita.emitido_em;
    const hashBytes  = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, rawString);
    const hashValidacao = hashBytes
      .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2))
      .join('')
      .substring(0, 16)
      .toUpperCase();

    // 6. Substituir tags no corpo do documento
    body.replaceText('{{NOME_PACIENTE}}',  paciente.nome          || '');
    body.replaceText('{{CID10}}',          receita.cid10          || '');
    body.replaceText('{{PRODUTO}}',        receita.produto_nome   || '');
    body.replaceText('{{CONCENTRACAO}}',   receita.concentracao   || '');
    body.replaceText('{{POSOLOGIA}}',      receita.posologia      || '');
    body.replaceText('{{VIA_ADMIN}}',      receita.via_adm        || '');
    body.replaceText('{{QUIMIOTIPO}}',     receita.quimiotipo     || 'Não especificado');
    body.replaceText('{{DATA_EMISSAO}}',   Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'dd/MM/yyyy'));
    body.replaceText('{{HASH_VALIDACAO}}', hashValidacao);

    // 7. Salvar e fechar rascunho
    docTemp.saveAndClose();

    // 8. Converter para PDF
    const pdfBlob = arquivoTemp.getAs(MimeType.PDF);
    pdfBlob.setName('Receita_' + paciente.nome.replace(/\s+/g, '_') + '_' + receita.id + '.pdf');
    const arquivoFinalPdf = pastaDestino.createFile(pdfBlob);

    // 9. Deletar rascunho temporário
    arquivoTemp.setTrashed(true);

    // 10. Atualizar registro na DB_RECEITAS
    updateRowById_('DB_RECEITAS', receita.id, {
      hash_validacao: hashValidacao,
      pdf_drive_id:   arquivoFinalPdf.getId(),
      status:         'PRONTO_PARA_ASSINATURA'
    });

    return {
      receitaId:   receita.id,
      pdfUrl:      arquivoFinalPdf.getUrl(),
      driveFileId: arquivoFinalPdf.getId(),
      hash:        hashValidacao
    };
  },

  /**
   * Valida hash de receita.
   * @param {string} receitaId
   * @param {string} hashFornecido
   * @returns {boolean}
   */
  validarHashReceita(receitaId, hashFornecido) {
    const receita = getRowById_('DB_RECEITAS', receitaId);
    if (!receita || !receita.hash_validacao) return false;
    return receita.hash_validacao.toUpperCase() === hashFornecido.toUpperCase();
  },

  /**
   * Obtém URL de visualização do PDF.
   * @param {string} receitaId
   * @returns {string|null}
   */
  obterUrlPdf(receitaId) {
    const receita = getRowById_('DB_RECEITAS', receitaId);
    if (!receita || !receita.pdf_drive_id) return null;
    try {
      return DriveApp.getFileById(receita.pdf_drive_id).getUrl();
    } catch (e) {
      Logger.log('Erro ao obter URL do PDF para receita ' + receitaId + ': ' + e.message);
      return null;
    }
  },

  /**
   * Marca receita como assinada digitalmente.
   * @param {string} receitaId
   * @param {Object} dadosAssinatura
   * @returns {boolean}
   */
  marcarComoAssinada(receitaId, dadosAssinatura) {
    dadosAssinatura = dadosAssinatura || {};
    updateRowById_('DB_RECEITAS', receitaId, {
      status:                  'ASSINADA',
      assinatura_timestamp:    dadosAssinatura.timestamp   || new Date().toISOString(),
      assinatura_certificado:  dadosAssinatura.certificado || '',
      atualizado_em:           new Date().toISOString()
    });
    return true;
  }
};
