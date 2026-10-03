/**
 * COMPONENTE: 33_ReceitaService.gs
 * PAPEL: Lógica de negócio para receitas médicas
 * STATUS: v1.0 — P0-6: Tipo de receituário automático, hash de validação, integração ICP-Brasil futura
 * 
 * RESPONSABILIDADE:
 * - Determinar tipo de receituário por THC
 * - Gerar hash de validação
 * - Validação regulatória + interações medicamentosas
 * - Criação de receita com todas as validações
 * 
 * TODO: Integração com assinatura digital ICP-Brasil (CFM 1.821/2007)
 */

// ============================================================================
// TIPO DE RECEITUÁRIO
// ============================================================================

/**
 * Determina tipo de receituário baseado em teor de THC
 * RDC 1.015/2026: THC ≤0,2% = Receita de Controle Especial (branca)
 *                 THC >0,2% = Notificação de Receita A (amarela)
 * 
 * @param {number} doseMgThc
 * @param {number} doseMgCbd
 * @returns {Object} {tipo, validade_dias, cor, vias, descricao}
 */
function determinarTipoReceituario_(doseMgThc, doseMgCbd) {
  const thcTotal = parseFloat(doseMgThc) || 0;
  const cbdTotal = parseFloat(doseMgCbd) || 0;
  const total = thcTotal + cbdTotal;
  
  if (total === 0) {
    throw createError_('VALIDATION_ERROR', 'Dose total zero', {});
  }
  
  const thcPorcentagem = (thcTotal / total) * 100;
  
  // NOTA (P0-6): Validades baseadas em prática comum de receitas controladas no Brasil
  // RDC 1.015/2026 Art. 8º: Validar se há diferença entre validades de CONTROLE_ESPECIAL vs NOTIFICACAO_A
  // TODO: Confirmar validades específicas na norma publicada e parametrizar se necessário
  if (thcPorcentagem <= 0.2) {
    return {
      tipo: TIPO_RECEITUARIO.CONTROLE_ESPECIAL,
      validade_dias: 30, // Receita branca comum: 30 dias
      cor: 'branca',
      vias: 2,
      descricao: 'Receita de Controle Especial (branca, 2 vias)'
    };
  } else {
    // RDC 1.015/2026 + Portaria SVS/MS 344/1998 Art. 35
    // Notificação A: validade 30 dias corridos a partir da data de emissão
    return {
      tipo: TIPO_RECEITUARIO.NOTIFICACAO_A,
      validade_dias: 30,
      cor: 'amarela',
      vias: 2,
      descricao: 'Notificação de Receita A (amarela, 2 vias)'
    };
  }
}

// ============================================================================
// HASH DE VALIDAÇÃO
// ============================================================================

/**
 * Gera hash de validação SHA-256 para receita
 * 
 * DISCLAIMER: NÃO substitui assinatura digital ICP-Brasil
 * Este hash serve apenas para integridade interna dos dados
 * 
 * @param {Object} receita
 * @returns {string} Hash SHA-256 hex
 */
function gerarHashValidacao_(receita) {
  // Concatenar campos críticos
  const conteudo = [
    receita.id,
    receita.paciente_id,
    receita.medico_id,
    receita.produto_nome,
    receita.dose_mg_cbd,
    receita.dose_mg_thc,
    receita.posologia,
    receita.emitido_em || nowIso_()
  ].join('|');
  
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    conteudo,
    Utilities.Charset.UTF_8
  );
  
  let hash = '';
  for (let i = 0; i < digest.length; i++) {
    const byte = digest[i];
    const hex = (byte < 0 ? byte + 256 : byte).toString(16);
    hash += hex.length === 1 ? '0' + hex : hex;
  }
  
  return hash;
}

// ============================================================================
// CRIAÇÃO DE RECEITA COM VALIDAÇÃO COMPLETA
// ============================================================================

/**
 * Cria receita com validação completa
 * 
 * FLUXO:
 * 1. Validar paciente e médico
 * 2. Validar contraindicações regulatórias (RDC 1.015/2026)
 * 3. Checar interações medicamentosas (CYP450)
 * 4. Determinar tipo de receituário automaticamente
 * 5. Gerar hash de validação
 * 6. Persistir e auditar
 * 
 * @param {Object} requestContext
 * @param {Object} receitaData
 * @returns {Object} {receita, tipoReceituario, interacoes, warnings}
 */
function criarReceita_(requestContext, receitaData) {
  requirePermission_(requestContext, 'receitas.create');
  
  // 1. Validar paciente e médico
  const paciente = getRowById_('DB_PACIENTES', receitaData.paciente_id);
  if (!paciente) {
    throw createError_('VALIDATION_ERROR', 'Paciente não encontrado', {});
  }
  
  const medico = getUserById_(receitaData.medico_id);
  if (!medico) {
    throw createError_('VALIDATION_ERROR', 'Médico inválido', {});
  }
  
  // 2. Validar contraindicações regulatórias
  const validacaoRegulatoria = validarContraindicoesRegulatorias_(receitaData, paciente);
  if (!validacaoRegulatoria.valido) {
    throw createError_('REGULATORY_BLOCK', 'Contraindicações regulatórias', {
      bloqueios: validacaoRegulatoria.bloqueios
    });
  }
  
  // 3. Checar interações medicamentosas
  const substancias = [];
  if (parseFloat(receitaData.dose_mg_cbd) > 0) substancias.push('CBD');
  if (parseFloat(receitaData.dose_mg_thc) > 0) substancias.push('THC');
  
  const interacoes = checarInteracoesMedicamentosas_(receitaData.paciente_id, substancias);
  
  // 4. Determinar tipo de receituário
  const tipoReceituario = determinarTipoReceituario_(
    receitaData.dose_mg_thc,
    receitaData.dose_mg_cbd
  );
  
  // 5. Criar receita
  const receita = {
    id: generateUUID_(),
    prontuario_id: receitaData.prontuario_id || '',
    paciente_id: receitaData.paciente_id,
    medico_id: receitaData.medico_id,
    produto_nome: receitaData.produto_nome,
    concentracao: receitaData.concentracao,
    posologia: receitaData.posologia,
    via_adm: receitaData.via_adm,
    quimiotipo: receitaData.quimiotipo,
    dose_mg_cbd: receitaData.dose_mg_cbd,
    dose_mg_thc: receitaData.dose_mg_thc,
    concentracao_mg_ml: receitaData.concentracao_mg_ml,
    volume_ml: receitaData.volume_ml,
    dose_inicial_mg: receitaData.dose_inicial_mg,
    incremento_mg: receitaData.incremento_mg,
    intervalo_dias: receitaData.intervalo_dias,
    dose_alvo_mg: receitaData.dose_alvo_mg,
    dose_maxima_mg: receitaData.dose_maxima_mg,
    tipo_receituario: tipoReceituario.tipo,
    validade_dias: tipoReceituario.validade_dias,
    renovacao_de_id: receitaData.renovacao_de_id || null,
    hash_validacao: '',  // será preenchido após criação
    pdf_drive_id: '',
    status: RECEITA_MEDICA_STATUS.RASCUNHO,
    emitido_em: nowIso_()
  };
  
  // 6. Gerar hash de validação
  receita.hash_validacao = gerarHashValidacao_(receita);
  
  // 7. Persistir
  appendRow_('DB_RECEITAS', receita);
  
  // 8. Auditar
  auditCreate_('DB_RECEITAS', receita.id, requestContext.user.id, {
    pacienteId: paciente.id, // PHI REDACTED: apenas ID
    tipo: tipoReceituario.tipo,
    thc_mg: receita.dose_mg_thc,
    cbd_mg: receita.dose_mg_cbd,
    interacoes: interacoes.temInteracoes ? interacoes.interacoes.length : 0,
    warnings: validacaoRegulatoria.warnings.length
  }, requestContext.correlationId);
  
  logInfo_('Receita criada', {
    receitaId: receita.id,
    tipo: tipoReceituario.tipo,
    interacoes: interacoes.temInteracoes
  });
  
  return {
    receita: receita,
    tipoReceituario: tipoReceituario,
    interacoes: interacoes,
    warnings: validacaoRegulatoria.warnings
  };
}

// ============================================================================
// TODO: INTEGRAÇÃO COM ASSINATURA DIGITAL ICP-BRASIL
// ============================================================================

/**
 * TODO: Integração com Assinatura Digital ICP-Brasil
 * 
 * REQUISITOS LEGAIS:
 * - CFM 1.821/2007: Prontuário eletrônico deve ter assinatura digital certificada ICP-Brasil
 * - IN RFB 1.637/2016: Assinatura eletrônica em documentos fiscais
 * - MP 2.200-2/2001: ICP-Brasil como infraestrutura de chaves públicas brasileira
 * 
 * OPÇÕES DE IMPLEMENTAÇÃO:
 * 
 * 1. Integração com Plataforma de Prescrição Certificada:
 *    - Memed API: https://memed.com.br/developers
 *    - iClinic API: https://api.iclinic.com.br
 *    - Amplimed: https://amplimed.com.br
 *    
 * 2. Certificado Digital Próprio (A1/A3):
 *    - Biblioteca: https://github.com/gjuniioor/pkcs11js (Node.js)
 *    - Serviço cloud: Assinei, ClickSign, DocuSign (com ICP-Brasil)
 *    - Apps Script limitation: não suporta bibliotecas nativas de criptografia
 *    
 * 3. Webhook de Assinatura Externa:
 *    - Médico assina via plataforma externa
 *    - Webhook callback atualiza DB_RECEITAS.status → ASSINADA
 *    - Armazena certificado/timestamp em campo dedicado
 * 
 * CAMPOS ADICIONAIS NECESSÁRIOS (adicionar ao schema quando implementar):
 * - assinatura_digital_base64: string — certificado ICP-Brasil em base64
 * - assinatura_timestamp: ISO 8601 UTC — timestamp da assinatura
 * - assinatura_provider: string — provedor (Memed, iClinic, Assinei, etc.)
 * - assinatura_certificado_cn: string — Common Name do certificado do médico
 * - assinatura_valida: boolean — validação do certificado
 * 
 * IMPLEMENTAÇÃO SUGERIDA (FASE 2):
 * 1. Receita criada com status PRONTO_PARA_ASSINATURA
 * 2. Enviar via API para plataforma de prescrição (Memed)
 * 3. Médico assina na interface da plataforma
 * 4. Webhook retorna para doPost() com assinatura e PDF
 * 5. Atualizar status → ASSINADA, armazenar PDF no Drive
 * 6. Gerar QR Code com hash + timestamp para validação
 * 
 * NOTA: A função gerarHashValidacao_() atual é placeholder educacional
 * e NÃO atende requisitos legais. Manter apenas como integridade interna.
 */

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

const RECEITA_SERVICE_LOADED = true;
