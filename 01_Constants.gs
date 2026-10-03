/**
 * COMPONENTE: 01_Constants.gs
 * PAPEL: Schema definição, enums, constantes globais — FONTE DE VERDADE
 *
 * IMPORTANTE: Qualquer mudança aqui requer:
 * 1. Atualizar 15_SchemaService.gs para refletir nova estrutura
 * 2. Migrar dados existentes (if applicable)
 * 3. Testar com 45_SetupService.gs
 *
 * STATUS: v2.0 — Schema completo validado
 * 
 * CHANGELOG v2.1.0 (PROMPT 1): Adicionadas 5 entidades de domínio de qualidade de insumos + permissões
 */

// ============================================================================
// CONSTANTES DE APLICAÇÃO
// ============================================================================

const APP_VERSION = '2.0.0';
const APP_NAME = 'Canabica Scientific System';
const APP_DESCRIPTION = 'Trichoderma × Cannabis Research Management';
const DEPLOYMENT_DATE = '2026-09-30';

// ============================================================================
// SCHEMA DE ABAS (fonte de verdade)
// ============================================================================

/**
 * Define todas as abas obrigatórias e suas colunas em ordem EXATA
 * Alterações devem ser documentadas em CHANGELOG
 */
const SHEET_SCHEMA = {
  Users: {
    columns: [
      'id',           // UUID v4 — chave primária
      'username',     // string unique — login identifier
      'password',     // string hash ou texto plano (PLAIN_TEXT_PASSWORDS property)
      'displayName',  // string — nome exibição
      'role',         // enum: admin, researcher, analyst, viewer, service
      'status',       // enum: ACTIVE, INACTIVE, SUSPENDED
      'createdAt',    // ISO 8601 UTC
      'updatedAt',    // ISO 8601 UTC
      'lastLoginAt'   // ISO 8601 UTC ou null
    ],
    description: 'Usuários do sistema com papéis e status'
  },

  Sessions: {
    columns: [
      'id',          // UUID v4 — chave primária
      'token',       // string UUID — token de sessão
      'userId',      // UUID FK → Users.id
      'createdAt',   // ISO 8601 UTC
      'expiresAt',   // ISO 8601 UTC
      'revokedAt',   // ISO 8601 UTC ou null
      'status'       // enum: ACTIVE, EXPIRED, REVOKED
    ],
    description: 'Sessões de usuário e tokens'
  },

  Studies: {
    columns: [
      'id',              // UUID v4
      'title',           // string — título do estudo
      'objective',       // string — objetivo científico
      'hostSpecies',     // string — p.ex. "Cannabis sativa"
      'fungalStrain',    // string — p.ex. "Trichoderma afroharzianum"
      'cultivar',        // string — cultivar específico
      'status',          // enum: DRAFT, ACTIVE, COMPLETED, ARCHIVED
      'ownerId',         // UUID FK → Users.id
      'createdAt',       // ISO 8601 UTC
      'updatedAt'        // ISO 8601 UTC
    ],
    description: 'Estudos científicos — entidade raiz'
  },

  Experiments: {
    columns: [
      'id',              // UUID v4
      'studyId',         // UUID FK → Studies.id
      'design',          // string — design experimental (p.ex. "CRD", "RCBD")
      'treatments',      // JSON array de strings
      'replicates',      // number — número de replicatas
      'conditions',      // JSON object com condições ambientais
      'status',          // enum: DRAFT, ACTIVE, COMPLETED, ARCHIVED
      'createdAt',       // ISO 8601 UTC
      'updatedAt'        // ISO 8601 UTC
    ],
    description: 'Experimentos dentro de estudos'
  },

  Observations: {
    columns: [
      'id',              // UUID v4
      'experimentId',    // UUID FK → Experiments.id
      'variable',        // string — nome da variável (p.ex. "pH", "biomass")
      'value',           // string ou number — valor observado
      'unit',            // string — unidade (p.ex. "mg/L", "g/L")
      'groupName',       // string — grupo experimental
      'replicate',       // number — número da replicata
      'observedAt',      // ISO 8601 UTC — data/hora coleta
      'notes',           // string — anotações adicionais
      'createdBy'        // UUID FK → Users.id
    ],
    description: 'Observações de experimentos'
  },

  References: {
    columns: [
      'id',              // UUID v4
      'citation',        // string — referência formatada
      'doi',             // string — DOI se disponível
      'year',            // number — ano publicação
      'source',          // string — journal ou periódico
      'section',         // string — capítulo ou página
      'url',             // string — link externo
      'createdAt',       // ISO 8601 UTC
      'updatedAt'        // ISO 8601 UTC
    ],
    description: 'Referências bibliográficas'
  },

  Evidence: {
    columns: [
      'id',              // UUID v4
      'claim',           // string — descrição do claim
      'referenceId',     // UUID FK → References.id
      'location',        // string — localização no texto (p.ex. "página 45")
      'evidenceGrade',   // enum: HIGH, MEDIUM, LOW, INSUFFICIENT
      'verdict',         // enum: CONFIRMED, PARTIAL, CONTESTED, UNVERIFIED
      'notes',           // string — anotações críticas
      'createdAt',       // ISO 8601 UTC
      'updatedAt'        // ISO 8601 UTC
    ],
    description: 'Evidência vinculada a referências'
  },

  ValidationRuns: {
    columns: [
      'id',              // UUID v4
      'scope',           // string — escopo validação (p.ex. "study-123")
      'status',          // enum: PENDING, RUNNING, COMPLETED, FAILED
      'severity',        // enum: INFO, WARNING, ERROR
      'summary',         // string — resumo resultados
      'resultJson',      // JSON string — detalhes validações
      'startedAt',       // ISO 8601 UTC
      'finishedAt',      // ISO 8601 UTC ou null
      'createdBy'        // UUID FK → Users.id
    ],
    description: 'Execuções de validação lógica'
  },

  AuditLog: {
    columns: [
      'id',              // UUID v4
      'eventType',       // string — tipo evento (p.ex. "AUTH_SUCCESS")
      'actorUserId',     // UUID FK → Users.id ou null para sistema
      'entity',          // string — entidade afetada (p.ex. "Study")
      'entityId',        // UUID — ID da entidade afetada
      'action',          // string — ação realizada (CREATE, UPDATE, DELETE)
      'correlationId',   // UUID — rastreamento requisição
      'detailsJson',     // JSON string — detalhes da alteração (sem senhas!)
      'createdAt'        // ISO 8601 UTC
    ],
    description: 'Auditoria completa de todas as alterações'
  },

  BatchJobs: {
    columns: [
      'id',              // UUID v4
      'type',            // string — tipo job (p.ex. "EXPORT_CSV", "VALIDATION")
      'status',          // enum: PENDING, RUNNING, COMPLETED, FAILED
      'payloadJson',     // JSON string — entrada do job
      'attempts',        // number — número tentativas
      'availableAt',     // ISO 8601 UTC — próxima tentativa
      'lockedAt',        // ISO 8601 UTC — quando foi locked
      'lockedBy',        // string — ID do worker/executor
      'resultJson',      // JSON string — resultado ou erro
      'createdAt',       // ISO 8601 UTC
      'updatedAt'        // ISO 8601 UTC
    ],
    description: 'Fila de jobs assíncronos'
  },

  Insumos_Catalogo: {
    columns: [
      'id',                          // UUID v4 — chave primária
      'nomeComercial',               // string — nome comercial do insumo
      'tipoSal',                     // string — tipo de sal (ex: "Nitrato de Cálcio")
      'fabricante',                  // string — fabricante
      'paisOrigem',                  // string — país de origem
      'registroMAPAEstabelecimento', // string — registro MAPA do estabelecimento
      'registroMAPAProduto',         // string — registro MAPA do produto
      'agenteQuelante',              // enum: EDTA, DTPA, EDDHA
      'solubilidade_gL_20C',         // number — solubilidade em g/L a 20°C
      'purezaPercentual',            // number — pureza em %
      'driveFichaTecnicaURL',        // string — URL do Google Drive para ficha técnica
      'ativo',                       // enum: ATIVO, INATIVO
      'createdAt',                   // ISO 8601 UTC
      'updatedAt'                    // ISO 8601 UTC
    ],
    description: 'Catálogo de insumos com dados técnicos e MAPA'
  },

  Lotes_CoA: {
    columns: [
      'id',                // UUID v4 — chave primária
      'insumoId',          // UUID FK → Insumos_Catalogo.id
      'numeroLote',        // string — número do lote
      'dataFabricacao',    // ISO 8601 date — data de fabricação
      'dataValidade',      // ISO 8601 date — data de validade
      'laboratorioEmissor',// string — laboratório emissor do CoA
      'teor_Pb_ppm',       // string — teor de chumbo em ppm
      'teor_Cd_ppm',       // string — teor de cádmio em ppm
      'teor_As_ppm',       // string — teor de arsênio em ppm
      'teor_Hg_ppm',       // string — teor de mercúrio em ppm
      'statusAuditoria',   // enum: PENDENTE, APROVADO, ALERTA, REPROVADO, BLOQUEADO
      'statusLiberacao',   // enum: PENDENTE, LIBERADO, QUARENTENA, BLOQUEADO
      'drivePdfCoAURL',    // string — URL do Google Drive para PDF do CoA
      'dataAuditoria',     // ISO 8601 UTC — data da auditoria
      'auditorEmail',      // string — email do auditor
      'sourceVersion',     // string — versão da fonte de dados
      'createdAt',         // ISO 8601 UTC
      'updatedAt'          // ISO 8601 UTC
    ],
    description: 'Lotes com Certificate of Analysis e auditoria de metais pesados'
  },

  Receitas_Fertirrigacao: {
    columns: [
      'id',                // UUID v4 — chave primária
      'nomeFase',          // string — nome da fase de cultivo
      'alvo_P_ppm',        // number — alvo de P em ppm
      'alvo_N_NO3_ppm',    // number — alvo de N-NO3 em ppm
      'alvo_N_NH4_ppm',    // number — alvo de N-NH4 em ppm
      'alvo_K_ppm',        // number — alvo de K em ppm
      'alvo_Ca_ppm',       // number — alvo de Ca em ppm
      'alvo_Mg_ppm',       // number — alvo de Mg em ppm
      'alvo_Fe_ppm',       // number — alvo de Fe em ppm
      'quelatoExigido',    // enum: EDTA, DTPA, EDDHA
      'pH_SolucaoAlvo',    // number — pH alvo da solução
      'EC_Alvo_dS_m',      // number — EC alvo em dS/m
      'ruleVersion',       // string — versão da regra
      'createdAt',         // ISO 8601 UTC
      'updatedAt'          // ISO 8601 UTC
    ],
    description: 'Receitas de fertirrigação por fase de cultivo'
  },

  Protocolos_Biologicos: {
    columns: [
      'id',                  // UUID v4 — chave primária
      'nomeProtocolo',       // string — nome do protocolo
      'faseCultivo',         // enum: PROPAGACAO, VEGETATIVA, FLORACAO
      'tipoAplicacao',       // enum: FOLIAR, SOLO, INOCULACAO
      'ecMaximo_dS_m',       // number — EC máximo em dS/m
      'pHMinimo',            // number — pH mínimo
      'pHMaximo',            // number — pH máximo
      'incompatibilidades',  // string — descrição de incompatibilidades
      'observacoes',         // string — observações gerais
      'ativo',               // enum: ATIVO, INATIVO
      'createdAt',           // ISO 8601 UTC
      'updatedAt'            // ISO 8601 UTC
    ],
    description: 'Protocolos de aplicação biológica com restrições'
  },

  Pareceres_Compatibilidade: {
    columns: [
      'id',                // UUID v4 — chave primária
      'receitaId',         // UUID FK → Receitas_Fertirrigacao.id
      'protocoloId',       // UUID FK → Protocolos_Biologicos.id
      'loteIds',           // string — lista de IDs de lotes (JSON array)
      'veredicto',         // enum: COMPATIVEL, COMPATIVEL_COM_RESSALVAS, INCOMPATIVEL, REVISAO_HUMANA
      'alertas',           // string — alertas identificados
      'bloqueios',         // string — bloqueios identificados
      'regrasAcionadas',   // string — regras que foram acionadas
      'evidencias',        // string — evidências para o parecer
      'usuarioEmail',      // string — email do usuário que solicitou
      'createdAt',         // ISO 8601 UTC
      'updatedAt'          // ISO 8601 UTC
    ],
    description: 'Pareceres de compatibilidade receita×protocolo×lote'
  },

  DB_PACIENTES: {
    columns: [
      'id',                     // UUID v4 — chave primária
      'nome',                   // string — nome completo
      'cpf_hash',               // string — hash SHA-256 do CPF
      'email',                  // string — email do paciente
      'telefone',               // string — telefone de contato
      'data_nasc',              // ISO 8601 date — data de nascimento
      'termos_lgpd_aceite',     // boolean — aceite do termo TCLE/LGPD
      'medico_id',              // UUID FK → Users.id (médico responsável)
      'criado_em'               // ISO 8601 UTC
    ],
    description: 'Pacientes cadastrados com dados sensíveis protegidos (LGPD)'
  },

  DB_PRONTUARIOS: {
    columns: [
      'id',                     // UUID v4 — chave primária
      'paciente_id',            // UUID FK → DB_PACIENTES.id
      'medico_crm',             // string — CRM do médico responsável
      'anamnese_json',          // JSON string — histórico e sintomas
      'cid10',                  // string — código CID-10 da patologia
      'elegivel',               // boolean — elegibilidade para tratamento
      'status',                 // enum: ATIVO, ARQUIVADO
      'atualizado_em'           // ISO 8601 UTC
    ],
    description: 'Prontuários eletrônicos médicos com anamnese e diagnóstico'
  },

  DB_RECEITAS: {
    columns: [
      'id',                     // UUID v4 — chave primária
      'prontuario_id',          // UUID FK → DB_PRONTUARIOS.id
      'paciente_id',            // UUID FK → DB_PACIENTES.id
      'medico_id',              // UUID FK → Users.id
      'produto_nome',           // string — nome do produto prescrito
      'concentracao',           // string — concentração (ex: "30mg/mL CBD")
      'posologia',              // string — posologia detalhada
      'via_adm',                // string — via de administração (sublingual, oral)
      'quimiotipo',             // string — quimiotipo (CBD, THC, balanceado)
      'dose_mg_cbd',            // number — dose de CBD em mg por tomada (P0-3)
      'dose_mg_thc',            // number — dose de THC em mg por tomada (P0-3)
      'concentracao_mg_ml',     // number — concentração do produto em mg/mL (P0-3)
      'volume_ml',              // number — volume por tomada em mL (P0-3)
      'dose_inicial_mg',        // number — dose inicial (protocolo start low) (P0-3)
      'incremento_mg',          // number — incremento por ajuste de dose (P0-3)
      'intervalo_dias',         // number — dias entre aumentos de dose (P0-3)
      'dose_alvo_mg',           // number — dose-alvo terapêutica (P0-3)
      'dose_maxima_mg',         // number — dose máxima permitida (P0-3)
      'tipo_receituario',       // enum: CONTROLE_ESPECIAL | NOTIFICACAO_A (P0-6)
      'validade_dias',          // number — validade da receita (30 dias padrão) (P0-6)
      'renovacao_de_id',        // UUID FK → DB_RECEITAS.id (se renovação) (P0-6)
      'hash_validacao',         // string — hash SHA-256 de autenticidade
      'pdf_drive_id',           // string — ID do arquivo PDF no Google Drive
      'status',                 // enum: RASCUNHO, PRONTO_PARA_ASSINATURA, ASSINADA, CANCELADA
      'emitido_em'              // ISO 8601 UTC
    ],
    description: 'Receitas médicas digitais com validação criptográfica'
  },

  DB_CULTIVO_PLANTAS: {
    columns: [
      'id',                     // UUID v4 — chave primária
      'paciente_id',            // UUID FK → DB_PACIENTES.id (grower)
      'strain_nome',            // string — nome da strain cultivada
      'quimiotipo',             // string — quimiotipo (CBD-dominant, balanceado)
      'ratio_cbd_thc',          // string — ratio CBD:THC (ex: "20:1")
      'fase',                   // enum: GERMINACAO, VEGETATIVO, FLORACAO, SECAGEM, CURA
      'data_plantio',           // ISO 8601 date — data de plantio
      'status'                  // enum: ATIVA, COLHIDA, DESCARTADA
    ],
    description: 'Plantas de cultivo medicinal rastreadas por paciente (Habeas Corpus)'
  },

  DB_CULTIVO_LOGS: {
    columns: [
      'id',                     // UUID v4 — chave primária
      'planta_id',              // UUID FK → DB_CULTIVO_PLANTAS.id
      'temp_c',                 // number — temperatura em °C
      'umidade_pct',            // number — umidade relativa em %
      'vpd',                    // number — Vapor Pressure Deficit calculado (kPa)
      'ph',                     // string — pH da solução nutritiva
      'ec_ppm',                 // string — condutividade elétrica em ppm
      'observacoes',            // string — observações do cultivador
      'registrado_em'           // ISO 8601 UTC
    ],
    description: 'Logs ambientais diários de cultivo com VPD calculado automaticamente'
  },

  DB_DIARIO_DOSES: {
    columns: [
      'id',                     // UUID v4 — chave primária
      'paciente_id',            // UUID FK → DB_PACIENTES.id
      'receita_id',             // UUID FK → DB_RECEITAS.id
      'gotas_manha',            // number — número de gotas pela manhã
      'gotas_tarde',            // number — número de gotas à tarde
      'gotas_noite',            // number — número de gotas à noite
      'escala_sintoma',         // number — escala 0-10 de intensidade do sintoma
      'efeitos_adversos_json',  // JSON string — array de efeitos adversos reportados
      'registrado_em'           // ISO 8601 UTC
    ],
    description: 'Diário de autoaplicação de doses e monitoramento de sintomas/efeitos adversos'
  },

  REF_COMORBIDADES_CANABICAS: {
    sheetName: 'REF_COMORBIDADES_CANABICAS',
    columns: [
      'id', 'codigo', 'nome_terapeutica', 'indicacao', 'triagem',
      'cid10_sugerido', 'total_evidencias', 'estudos_prioritarios_json',
      'quimiotipo_alvo', 'terpenos_focalizados', 'manejo_solo_ideal',
      'grau_coa_exigido', 'limites_criticos_coa', 'mecanismo_agro_saude',
      'descricao_curta', 'ativo'
    ],
    keyColumn: 'id',
    description: 'Catálogo de 46 comorbidades canábicas com perfil terapêutico e agronômico'
  },

  DB_COMORBIDADES_PACIENTE: {
    sheetName: 'DB_COMORBIDADES_PACIENTE',
    columns: [
      'id', 'paciente_id', 'comorbidade_id', 'prioridade',
      'outra_descricao', 'quimiotipo_sugerido', 'solo_recomendado',
      'grau_coa_obrigatorio', 'evidencias_resumo_json',
      'nota_medica', 'criado_em', 'atualizado_em'
    ],
    keyColumn: 'id',
    description: 'Comorbidades selecionadas por paciente com parâmetros denormalizados'
  },

  User_Paciente_Mapping: {
    sheetName: 'User_Paciente_Mapping',
    columns: [
      'id',           // UUID v4 — chave primária
      'userId',       // UUID FK → Users.id
      'pacienteId',   // UUID FK → DB_PACIENTES.id
      'medicoId',     // UUID FK → Users.id (médico responsável)
      'dataVinculo',  // ISO 8601 UTC — data de criação do vínculo
      'status',       // enum: ATIVO, INATIVO
      'createdAt',    // ISO 8601 UTC
      'updatedAt',    // ISO 8601 UTC
      'createdBy'     // UUID FK → Users.id (quem criou o registro)
    ],
    keyColumn: 'id',
    description: 'Mapeamento N:N entre usuários, pacientes e médicos responsáveis'
  },

  DB_LOTES_COLHEITA: {
    columns: [
      'id',                  // UUID v4 — chave primária
      'plantas_ids_json',    // JSON array — IDs das plantas incluídas no lote
      'data_colheita',       // ISO 8601 date — data da colheita
      'peso_umido_g',        // number — peso úmido total em gramas
      'peso_seco_g',         // number — peso seco total em gramas
      'sala_cultivo',        // string — identificação da sala/local
      'operador_id',         // UUID FK → Users.id (quem colheu)
      'strain_nome',         // string — nome da strain colhida
      'status_lote',         // enum: COLHIDO, SECAGEM, CURA, LIBERADO, DESCARTADO
      'observacoes',         // string — observações gerais
      'createdAt',           // ISO 8601 UTC
      'updatedAt'            // ISO 8601 UTC
    ],
    description: 'Lotes de colheita para rastreabilidade seed-to-sale'
  },

  DB_DESCARTES: {
    columns: [
      'id',                  // UUID v4 — chave primária
      'planta_id',           // UUID FK → DB_CULTIVO_PLANTAS.id (nullable)
      'lote_id',             // UUID FK → DB_LOTES_COLHEITA.id (nullable)
      'motivo',              // string — motivo do descarte
      'peso_g',              // number — peso descartado em gramas
      'testemunha_id',       // UUID FK → Users.id (quem testemunhou o descarte)
      'metodo_descarte',     // string — método (compostagem, incineração, etc.)
      'data_descarte',       // ISO 8601 date
      'observacoes',         // string — observações adicionais
      'createdAt'            // ISO 8601 UTC
    ],
    description: 'Registro de descartes para controle de desvio e reconciliação de massa'
  },

  DB_COA_PRODUTO_FINAL: {
    columns: [
      'id',                      // UUID v4 — chave primária
      'lote_colheita_id',        // UUID FK → DB_LOTES_COLHEITA.id
      'thc_pct',                 // number — THC % (descarboxilado)
      'thca_pct',                // number — THCA % (ácido, pré-descarboxilação)
      'cbd_pct',                 // number — CBD %
      'cbda_pct',                // number — CBDA %
      'cbg_pct',                 // number — CBG %
      'thcv_pct',                // number — THCV %
      'perfil_terpenos_json',    // JSON object — {terpeno: pct}
      'aflatoxina_total_ppb',    // number — aflatoxinas totais (B1+B2+G1+G2) em ppb
      'ocratoxina_ppb',          // number — ocratoxina A em ppb
      'pesticidas_json',         // JSON object — {molecula: resultado_ppm}
      'microbiologico_json',     // JSON object — {TAMC, TYMC, E_coli, Salmonella, Aspergillus}
      'solventes_json',          // JSON object — para extratos (etanol, butano, etc.)
      'agua_atividade_aw',       // number — water activity (0-1)
      'metais_pesados_json',     // JSON object — {Pb_ppm, Cd_ppm, As_ppm, Hg_ppm}
      'laboratorio',             // string — nome do laboratório emissor
      'acreditacao_iso17025',    // boolean — laboratório acreditado ISO 17025
      'metodo',                  // string — método analítico (HPLC, GC-MS, LC-MS)
      'data_analise',            // ISO 8601 date
      'status_liberacao',        // enum: PENDENTE, LIBERADO, BLOQUEADO
      'createdAt',               // ISO 8601 UTC
      'updatedAt'                // ISO 8601 UTC
    ],
    description: 'Certificate of Analysis do produto final por lote de colheita'
  },

  DB_MEDICAMENTOS_USO: {
    columns: [
      'id',                      // UUID v4
      'paciente_id',             // UUID FK → DB_PACIENTES.id
      'medicamento_nome',        // string — nome do medicamento
      'principio_ativo',         // string — DCI / principio ativo
      'dose',                    // string — dose e frequência
      'via_administracao',       // string — via de administração
      'inicio_uso',              // ISO 8601 date — data de início
      'fim_uso',                 // ISO 8601 date — data de término (nullable)
      'ativo',                   // boolean — se ainda em uso
      'createdAt',               // ISO 8601 UTC
      'updatedAt'                // ISO 8601 UTC
    ],
    description: 'Medicamentos em uso pelo paciente (para checagem de interações CYP450)'
  },

  REF_INTERACOES: {
    columns: [
      'id',                      // UUID v4
      'substancia_canabica',     // string — CBD, THC, CBG, etc.
      'medicamento_classe',      // string — classe terapêutica (anticonvulsivante, anticoagulante, etc.)
      'medicamento_nome',        // string — nome específico (clobazam, varfarina, etc.)
      'mecanismo',               // string — mecanismo da interação (inibição CYP3A4, etc.)
      'severidade',              // enum: LEVE, MODERADA, GRAVE (validado por SEVERIDADE_INTERACAO)
      'evidencia',               // enum: BEM_DOCUMENTADA, PROVAVEL, TEORICA (validado por EVIDENCIA_INTERACAO)
      'recomendacao',            // string — recomendação clínica
      'referencia_pubmed_id',    // string — PubMed ID da fonte
      'ativo'                    // boolean
    ],
    description: 'Tabela de referência de interações medicamentosas CYP450',
    validation: {
      severidade: { type: 'enum', values: ['LEVE', 'MODERADA', 'GRAVE'] },
      evidencia: { type: 'enum', values: ['BEM_DOCUMENTADA', 'PROVAVEL', 'TEORICA'] }
    }
  }
};

// ============================================================================
// ENUMS E STATUS
// ============================================================================

const USER_ROLES = {
  ADMIN: 'admin',
  RESEARCHER: 'researcher',
  ANALYST: 'analyst',
  VIEWER: 'viewer',
  SERVICE: 'service'
};

const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  SUSPENDED: 'SUSPENDED'
};

const SESSION_STATUS = {
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  REVOKED: 'REVOKED'
};

const RECEITA_MEDICA_STATUS = {
  RASCUNHO: 'RASCUNHO',
  PRONTO_PARA_ASSINATURA: 'PRONTO_PARA_ASSINATURA',
  ASSINADA: 'ASSINADA',
  CANCELADA: 'CANCELADA'
};

const STUDY_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED'
};

const ENTITY_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  ARCHIVED: 'ARCHIVED'
};

const EVIDENCE_GRADE = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INSUFFICIENT: 'INSUFFICIENT'
};

const VERDICT_TYPE = {
  CONFIRMED: 'CONFIRMED',
  PARTIAL: 'PARTIAL',
  CONTESTED: 'CONTESTED',
  UNVERIFIED: 'UNVERIFIED'
};

const VALIDATION_STATUS = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

const VALIDATION_SEVERITY = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  ERROR: 'ERROR'
};

const BATCH_JOB_STATUS = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED'
};

const BATCH_JOB_TYPE = {
  EXPORT_CSV: 'EXPORT_CSV',
  EXPORT_JSON: 'EXPORT_JSON',
  IMPORT_CSV: 'IMPORT_CSV',
  VALIDATION_RUN: 'VALIDATION_RUN',
  REPORT_GENERATION: 'REPORT_GENERATION'
};

const AUDIT_EVENT_TYPE = {
  AUTH_SUCCESS: 'AUTH_SUCCESS',
  AUTH_FAILURE: 'AUTH_FAILURE',
  LOGOUT: 'LOGOUT',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  EXPORT: 'EXPORT',
  IMPORT: 'IMPORT',
  VALIDATION_RUN: 'VALIDATION_RUN',
  SYSTEM_ERROR: 'SYSTEM_ERROR'
};

const AUDIT_ACTION = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  SOFT_DELETE: 'SOFT_DELETE'
};

// ============================================================================
// ENUMS DO DOMÍNIO DE QUALIDADE DE INSUMOS (PROMPT 1)
// ============================================================================

const INPUT_STATUS = {
  ATIVO: 'ATIVO',
  INATIVO: 'INATIVO'
};

const AGENTE_QUELANTE = {
  EDTA: 'EDTA',
  DTPA: 'DTPA',
  EDDHA: 'EDDHA'
};

const COA_STATUS_AUDITORIA = {
  PENDENTE: 'PENDENTE',
  APROVADO: 'APROVADO',
  ALERTA: 'ALERTA',
  REPROVADO: 'REPROVADO',
  BLOQUEADO: 'BLOQUEADO'
};

const COA_STATUS_LIBERACAO = {
  PENDENTE: 'PENDENTE',
  LIBERADO: 'LIBERADO',
  QUARENTENA: 'QUARENTENA',
  BLOQUEADO: 'BLOQUEADO'
};

const FASE_CULTIVO = {
  PROPAGACAO: 'PROPAGACAO',
  VEGETATIVA: 'VEGETATIVA',
  FLORACAO: 'FLORACAO'
};

const TIPO_APLICACAO = {
  FOLIAR: 'FOLIAR',
  SOLO: 'SOLO',
  INOCULACAO: 'INOCULACAO'
};

const VEREDICTO_COMPATIBILIDADE = {
  COMPATIVEL: 'COMPATIVEL',
  COMPATIVEL_COM_RESSALVAS: 'COMPATIVEL_COM_RESSALVAS',
  INCOMPATIVEL: 'INCOMPATIVEL',
  REVISAO_HUMANA: 'REVISAO_HUMANA'
};

// ============================================================================
// ENUMS DO DOMÍNIO DE BIO.VALIDATE (PROMPT 5)
// ============================================================================

const BIO_RULE_TYPE = {
  REGULATORY_BLOCK: 'REGULATORY_BLOCK',       // Hard block (regulatory/safety)
  PROJECT_POLICY: 'PROJECT_POLICY',           // Project-specific policy
  SCIENTIFIC_WARNING: 'SCIENTIFIC_WARNING',   // Evidence-based caution
  OPERATIONAL_WARNING: 'OPERATIONAL_WARNING'  // Operational risk
};

const BIO_RULE_SOURCE_TYPE = {
  PROTOCOL_DOCUMENT: 'PROTOCOL_DOCUMENT',
  SCIENTIFIC_PAPER: 'SCIENTIFIC_PAPER',
  REGULATORY_NORM: 'REGULATORY_NORM',
  INTERNAL_POLICY: 'INTERNAL_POLICY',
  EXPERT_CONSENSUS: 'EXPERT_CONSENSUS'
};

const BIO_RULE_REVIEW_STATUS = {
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  SUPERSEDED: 'SUPERSEDED',
  ARCHIVED: 'ARCHIVED'
};

// ============================================================================
// ENUMS DO DOMÍNIO DE COMORBIDADES CANÁBICAS (PROMPT MC-1)
// ============================================================================

const TRIAGEM_CIENTIFICA = {
  A: 'A',  // Síntese + Ensaio Clínico (evidência forte)
  B: 'B',  // Síntese OU Ensaio Clínico (evidência moderada)
  C: 'C',  // Estudos Observacionais (evidência preliminar)
  D: 'D',  // Pré-clínico (in vitro / animal)
  E: 'E'   // Insuficiente (< 3 estudos ou metodologia fraca)
};

const QUIMIOTIPO = {
  TIPO_I_THC: 'TIPO_I_THC',
  TIPO_II_EQUILIBRADO: 'TIPO_II_EQUILIBRADO',
  TIPO_III_CBD: 'TIPO_III_CBD',
  TIPO_IV_CBG: 'TIPO_IV_CBG',
  DEFINIR_MEDICO: 'DEFINIR_MEDICO'
};

const MANEJO_SOLO = {
  SOLO_VIVO_ORGANICO: 'SOLO_VIVO_ORGANICO',
  HIDROPONIA_MINERAL: 'HIDROPONIA_MINERAL',
  SUBSTRATO_TRICHODERMA: 'SUBSTRATO_TRICHODERMA',
  AVALIACAO_INDIVIDUAL: 'AVALIACAO_INDIVIDUAL'
};

const GRAU_COA = {
  GRAU_1_ESTRITO: 'GRAU_1_ESTRITO',
  GRAU_2_PADRAO: 'GRAU_2_PADRAO',
  GRAU_3_NEUROPSIQUIATRICO: 'GRAU_3_NEUROPSIQUIATRICO',
  GRAU_4_TOPICO: 'GRAU_4_TOPICO',
  AVALIADO_MEDICO: 'AVALIADO_MEDICO'
};

// ============================================================================
// ENUMS P0 (P0-1, P0-3, P0-5, P0-6)
// ============================================================================

const STATUS_LOTE_COLHEITA = {
  COLHIDO: 'COLHIDO',
  SECAGEM: 'SECAGEM',
  CURA: 'CURA',
  LIBERADO: 'LIBERADO',
  DESCARTADO: 'DESCARTADO'
};

const COA_STATUS_LIBERACAO_FINAL = {
  PENDENTE: 'PENDENTE',
  LIBERADO: 'LIBERADO',
  BLOQUEADO: 'BLOQUEADO'
};

const SEVERIDADE_INTERACAO = {
  LEVE: 'LEVE',
  MODERADA: 'MODERADA',
  GRAVE: 'GRAVE'
};

const EVIDENCIA_INTERACAO = {
  BEM_DOCUMENTADA: 'BEM_DOCUMENTADA',
  PROVAVEL: 'PROVAVEL',
  TEORICA: 'TEORICA'
};

const TIPO_RECEITUARIO = {
  CONTROLE_ESPECIAL: 'CONTROLE_ESPECIAL',  // THC ≤0,2%, receita branca
  NOTIFICACAO_A: 'NOTIFICACAO_A'           // THC >0,2%, receita amarela
};

// ============================================================================
// LIMITES E CONFIGURAÇÕES PADRÃO
// ============================================================================

const CONFIG_DEFAULTS = {
  SESSION_TTL_HOURS: 8,
  CACHE_TTL_SECONDS: 300,
  MAX_BATCH_SIZE: 100,
  MAX_LOG_SIZE_ROWS: 10000,
  MAX_RETRY_ATTEMPTS: 3,
  LOCK_TIMEOUT_SECONDS: 30,
  REQUEST_TIMEOUT_SECONDS: 240
};

// P0-5: Limiar de divergência de massa para reconciliação seed-to-sale
// Política interna do projeto baseada em práticas de BPF (EU-GMP EudraLex Vol. 4 Part II)
// que toleram divergências de até 5% em materiais vegetais não-processados (perda de umidade,
// resíduos de poda). Para produtos processados com maior controle, considerar reduzir para 2%.
// Ref: WHO GACP (2003) Section 8.2 - Material accountability
const LIMIAR_DIVERGENCIA_RECONCILIACAO_PCT = 5.0;

/**
 * Limiar de divergência para reconciliação de massa seed-to-sale (P0-5)
 * 
 * ORIGEM: Baseado em práticas de BPF (Boas Práticas de Fabricação) para produtos farmacêuticos
 * e controle de insumos controlados. Apesar da RDC 1.013/2026 (Cannabis) e RDC 658/2022 (BPF)
 * não especificarem limiar numérico exato para divergência de massa, o valor de 5% é:
 * 
 * - Alinhado com tolerâncias de pesagem de matéria-prima farmacêutica (±2-5% USP <1251>)
 * - Consistente com requisitos de reconciliação de medicamentos controlados (Portaria SVS 344/1998)
 * - Suficientemente restritivo para detectar desvios significativos sem gerar falsos positivos
 *   devido a perda natural de umidade, trim de baixa qualidade, e amostragem para CoA
 * 
 * POLÍTICA INTERNA: Este limiar pode ser ajustado conforme histórico de cultivo e processos
 * específicos da operação. Divergências >5% requerem investigação obrigatória e registro em auditoria.
 * 
 * REFERÊNCIAS:
 * - RDC 1.013/2026: Rastreabilidade seed-to-sale de cannabis medicinal
 * - RDC 658/2022: Boas Práticas de Fabricação de Medicamentos
 * - Portaria SVS/MS 344/1998: Controle de medicamentos e substâncias sujeitas a controle especial
 * - USP <1251>: Weighing on an Analytical Balance
 */
const LIMIAR_DIVERGENCIA_RECONCILIACAO_PCT = 5.0;

// ============================================================================
// VALIDAÇÕES DE DOMÍNIO
// ============================================================================

/**
 * Limites e regras científicas para validação
 */
const DOMAIN_RULES = {
  username: {
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_.-]+$/,
    description: 'Alfanumérico, underscore, ponto, hífen'
  },
  
  email: {
    pattern: /@/,
    description: 'Formato email básico'
  },
  
  password: {
    minLength: 6,
    maxLength: 100,
    description: 'Mínimo 6 caracteres'
  },
  
  title: {
    minLength: 3,
    maxLength: 255,
    description: 'Título do estudo'
  },
  
  replicates: {
    min: 2,
    max: 1000,
    description: 'Mínimo 2 replicatas (design experimental)'
  },
  
  pValue: {
    min: 0,
    max: 1,
    description: 'P-value deve estar entre 0 e 1'
  },

  observationValue: {
    description: 'Valor numérico ou string (depende da variável)'
  }
};

// ============================================================================
// PERMISSÕES (RBAC Matrix)
// ============================================================================

/**
 * Define permissões por role
 * Verificadas em 12_PermissionService.gs
 */
const ROLE_PERMISSIONS = {
  admin: [
    // System
    'system.configure',
    'system.ping',
    'system.health',
    'system.info',
    
    // Auth
    'auth.login',
    'auth.logout',
    'auth.refresh',
    
    // Users (full access)
    'users.create',
    'users.read',
    'users.update',
    'users.delete',
    
    // Studies (full access)
    'studies.create',
    'studies.read',
    'studies.update',
    'studies.delete',
    
    // Experiments (full access)
    'experiments.create',
    'experiments.read',
    'experiments.update',
    'experiments.delete',
    
    // Observations (full access)
    'observations.create',
    'observations.read',
    'observations.update',
    'observations.delete',
    
    // References, Evidence (full access)
    'references.create',
    'references.read',
    'references.update',
    'references.delete',
    'evidence.create',
    'evidence.read',
    'evidence.update',
    'evidence.delete',
    
    // Validations
    'validation.run',
    'validation.read',
    
    // Audit
    'audit.read',
    
    // Batch & Export
    'batch.submit',
    'batch.read',
    'export.execute',
    'import.execute',
    
    // Dashboard
    'dashboard.read',
    'maturity.read',
    
    // Insumos (full access)
    'insumos.create',
    'insumos.read',
    'insumos.update',
    'insumos.delete',
    
    // Lotes CoA (full access)
    'lotes.create',
    'lotes.read',
    'lotes.update',
    'lotes.delete',
    
    // Receitas Fertirrigação (full access)
    'receitas.create',
    'receitas.read',
    'receitas.update',
    'receitas.delete',
    
    // Protocolos Biológicos (full access)
    'protocolos.create',
    'protocolos.read',
    'protocolos.update',
    'protocolos.delete',
    
    // Pareceres Compatibilidade (full access)
    'pareceres.create',
    'pareceres.read',
    'pareceres.update',
    'pareceres.delete',
    
    // Comorbidades Canábicas (full access)
    'comorbidades.read',
    'comorbidades.write',
    'coa.audit'
  ],

  researcher: [
    // Auth
    'auth.login',
    'auth.logout',
    'auth.refresh',
    
    // Studies (create/read/update own)
    'studies.create',
    'studies.read',
    'studies.update',
    
    // Experiments (create/read/update own)
    'experiments.create',
    'experiments.read',
    'experiments.update',
    
    // Observations (create/read/update own)
    'observations.create',
    'observations.read',
    'observations.update',
    
    // References, Evidence (create/read/update own)
    'references.create',
    'references.read',
    'references.update',
    'evidence.create',
    'evidence.read',
    'evidence.update',
    
    // Validations
    'validation.run',
    'validation.read',
    
    // Batch & Export
    'batch.submit',
    'export.execute',
    
    // Dashboard
    'dashboard.read',
    'maturity.read',
    
    // Insumos (create/read/update own)
    'insumos.create',
    'insumos.read',
    'insumos.update',
    
    // Lotes CoA (create/read/update own)
    'lotes.create',
    'lotes.read',
    'lotes.update',
    
    // Receitas Fertirrigação (create/read/update own)
    'receitas.create',
    'receitas.read',
    'receitas.update',
    
    // Protocolos Biológicos (read/create/update)
    'protocolos.create',
    'protocolos.read',
    'protocolos.update',
    
    // Pareceres Compatibilidade (create/read)
    'pareceres.create',
    'pareceres.read',
    
    // Comorbidades Canábicas (read + audit CoA)
    'comorbidades.read',
    'coa.audit'
  ],

  analyst: [
    // Auth
    'auth.login',
    'auth.logout',
    'auth.refresh',
    
    // Studies (read)
    'studies.read',
    
    // Experiments (read)
    'experiments.read',
    
    // Observations (create/read — sem update)
    'observations.create',
    'observations.read',
    
    // References (read)
    'references.read',
    'evidence.read',
    
    // Validations
    'validation.run',
    'validation.read',
    
    // Batch & Export
    'export.execute',
    
    // Dashboard
    'dashboard.read',
    'maturity.read',
    
    // Insumos (read)
    'insumos.read',
    
    // Lotes CoA (read)
    'lotes.read',
    
    // Receitas Fertirrigação (read)
    'receitas.read',
    
    // Protocolos Biológicos (read)
    'protocolos.read',
    
    // Pareceres Compatibilidade (read)
    'pareceres.read'
  ],

  viewer: [
    // Auth
    'auth.login',
    'auth.logout',
    'auth.refresh',
    
    // Read-only access
    'studies.read',
    'experiments.read',
    'observations.read',
    'references.read',
    'evidence.read',
    
    // Insumos domain (read-only)
    'insumos.read',
    'lotes.read',
    'receitas.read',
    'protocolos.read',
    'pareceres.read',
    
    // Dashboard
    'dashboard.read'
  ],

  service: [
    // Service account — acesso limitado para automação
    'auth.login',
    'auth.refresh',
    
    // Leitura de dados
    'studies.read',
    'experiments.read',
    'observations.read',
    
    // Criar observações via API
    'observations.create',
    
    // Batch jobs
    'batch.submit',
    'batch.read'
  ],

  medico: [
    // Auth
    'auth.login',
    'auth.logout',
    'auth.refresh',
    
    // Usuários (read-only)
    'users.read',
    
    // Prontuários (CRUD)
    'prontuario.create',
    'prontuario.read',
    'prontuario.update',
    
    // Prescrições (CRUD + emitir)
    'prescricao.create',
    'prescricao.read',
    'prescricao.update',
    'prescricao.emitir',
    
    // Triagem clínica (read/update)
    'triagem.read',
    'triagem.update',
    
    // Titulação (read/monitorar)
    'titulacao.read',
    'titulacao.monitorar',
    
    // Alertas clínicos (read/resolve)
    'alerta.read',
    'alerta.resolve',
    
    // Insumos domain (read-only para contexto clínico)
    'inputs.read',
    'coa.read',
    'recipes.read',
    'protocols.read',
    'compatibility.read',
    
    // Comorbidades Canábicas (read/write/audit)
    'comorbidades.read',
    'comorbidades.write',
    'coa.audit',
    
    // Dashboard
    'dashboard.read'
  ],

  tecnico_agricola: [
    // Auth
    'auth.login',
    'auth.logout',
    'auth.refresh',
    
    // Insumos (full CRUD)
    'inputs.create',
    'inputs.read',
    'inputs.update',
    'inputs.delete',
    
    // Lotes CoA (full CRUD + audit)
    'coa.create',
    'coa.read',
    'coa.update',
    'coa.audit',
    
    // Receitas Fertirrigação (full CRUD)
    'recipes.create',
    'recipes.read',
    'recipes.update',
    'recipes.delete',
    
    // Protocolos Biológicos (full CRUD)
    'protocols.create',
    'protocols.read',
    'protocols.update',
    'protocols.delete',
    
    // Pareceres Compatibilidade (analyze/read/review)
    'compatibility.analyze',
    'compatibility.read',
    'compatibility.review',
    
    // Cultivo (read + audit para laudos periciais)
    'cultivo.read',
    'cultivo.audit',
    
    // Laudos periciais (create/export)
    'laudo.create',
    'laudo.export',
    
    // Comorbidades Canábicas (read + audit CoA)
    'comorbidades.read',
    'coa.audit',
    
    // Dashboard
    'dashboard.read'
  ],

  grower: [
    // Auth
    'auth.login',
    'auth.logout',
    'auth.refresh',
    
    // Cultivo próprio (CRUD restrito ao próprio usuário)
    'cultivo_proprio.create',
    'cultivo_proprio.read',
    'cultivo_proprio.update',
    
    // Diário de doses (create/read próprio)
    'doses.create',
    'doses.read',
    
    // Receitas próprias (read-only)
    'receita_propria.read',
    
    // Prontuário próprio (read-only)
    'prontuario_proprio.read',
    
    // Comorbidades Canábicas (read + audit CoA)
    'comorbidades.read',
    'coa.audit',
    
    // Dashboard
    'dashboard.read'
  ],

  paciente: [
    // Auth
    'auth.login',
    'auth.logout',
    'auth.refresh',
    
    // Triagem (create/read)
    'triagem.create',
    'triagem.read',
    
    // Diário de doses (create/read próprio)
    'doses.create',
    'doses.read',
    
    // Receitas próprias (read-only)
    'receita_propria.read',
    
    // Prontuário próprio (read-only)
    'prontuario_proprio.read',
    
    // Consentimento TCLE/LGPD (create/read)
    'consentimento.create',
    'consentimento.read',
    
    // Comorbidades Canábicas (read/write)
    'comorbidades.read',
    'comorbidades.write',
    
    // Dashboard
    'dashboard.read'
  ]
};

// ============================================================================
// EXPORTAR
// ============================================================================

// Confirma que arquivo foi carregado
const CONSTANTS_LOADED = true;
