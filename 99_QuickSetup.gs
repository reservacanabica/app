/**
 * 99_QuickSetup.gs
 * Cria 24 abas + popula dados sintéticos sem dependências externas.
 * EXECUTAR: quickSetupComplete()
 */

// ─── FUNÇÃO PRINCIPAL ────────────────────────────────────────────────────────

function quickSetupComplete() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var now = new Date().toISOString();

  Logger.log('=== QUICK SETUP COMPLETO ===');

  // IDs compartilhados para foreign keys
  var u1 = Utilities.getUuid(), u2 = Utilities.getUuid(), u3 = Utilities.getUuid();
  var s1 = Utilities.getUuid(), s2 = Utilities.getUuid(), s3 = Utilities.getUuid();
  var e1 = Utilities.getUuid(), e2 = Utilities.getUuid(), e3 = Utilities.getUuid();
  var r1 = Utilities.getUuid(), r2 = Utilities.getUuid(), r3 = Utilities.getUuid();
  var p1 = Utilities.getUuid(), p2 = Utilities.getUuid(), p3 = Utilities.getUuid();
  var i1 = Utilities.getUuid(), i2 = Utilities.getUuid(), i3 = Utilities.getUuid();
  var l1 = Utilities.getUuid(), l2 = Utilities.getUuid(), l3 = Utilities.getUuid();
  var rc1 = Utilities.getUuid(), rc2 = Utilities.getUuid(), rc3 = Utilities.getUuid();
  var pr1 = Utilities.getUuid(), pr2 = Utilities.getUuid(), pr3 = Utilities.getUuid();
  var pn1 = Utilities.getUuid(), pn2 = Utilities.getUuid(), pn3 = Utilities.getUuid();
  var rm1 = Utilities.getUuid(), rm2 = Utilities.getUuid(), rm3 = Utilities.getUuid();
  var pl1 = Utilities.getUuid(), pl2 = Utilities.getUuid(), pl3 = Utilities.getUuid();
  var co1 = Utilities.getUuid(), co2 = Utilities.getUuid(), co3 = Utilities.getUuid();

  _sheet(ss, 'Users',
    ['id','username','password','displayName','role','status','createdAt','updatedAt','lastLoginAt'],
    [[u1,'admin','admin123','Administrator','admin','ACTIVE',now,now,null],
     [u2,'researcher1','senha123','Dr. Silva','researcher','ACTIVE',now,now,null],
     [u3,'analyst1','senha123','Ana Analista','analyst','ACTIVE',now,now,null]]);

  _sheet(ss, 'Sessions',
    ['id','token','userId','createdAt','expiresAt','revokedAt','status'],
    [[Utilities.getUuid(),Utilities.getUuid(),u1,now,now,null,'ACTIVE'],
     [Utilities.getUuid(),Utilities.getUuid(),u2,now,now,null,'ACTIVE'],
     [Utilities.getUuid(),Utilities.getUuid(),u3,now,now,null,'EXPIRED']]);

  _sheet(ss, 'Studies',
    ['id','title','objective','hostSpecies','fungalStrain','cultivar','status','ownerId','createdAt','updatedAt'],
    [[s1,'Cannabis x Trichoderma','Avaliar biocontrole','Cannabis sativa','T. harzianum','Super Lemon Haze','ACTIVE',u2,now,now],
     [s2,'Otimizacao Fertirrigacao','Maximizar CBD','Cannabis indica','T. afroharzianum','Blue Dream','DRAFT',u2,now,now],
     [s3,'Controle Fusarium','Antagonismo fungico','Cannabis sativa','T. asperellum',"Charlotte's Web",'COMPLETED',u2,now,now]]);

  _sheet(ss, 'Experiments',
    ['id','studyId','design','treatments','replicates','conditions','status','createdAt','updatedAt'],
    [[e1,s1,'RCBD','["Controle","T106","T108"]',4,'{"temp":25,"hum":60}','ACTIVE',now,now],
     [e2,s2,'CRD','["NPK100","NPK75","NPK50"]',3,'{"temp":23,"hum":65}','DRAFT',now,now],
     [e3,s3,'Factorial','["A","B","A+B"]',5,'{"temp":26,"hum":55}','COMPLETED',now,now]]);

  _sheet(ss, 'Observations',
    ['id','experimentId','variable','value','unit','groupName','replicate','observedAt','notes','createdBy'],
    [[Utilities.getUuid(),e1,'biomass','145.3','g','T106',1,now,'Floração',u2],
     [Utilities.getUuid(),e1,'pH','6.2','','Controle',2,now,'Rizosfera',u2],
     [Utilities.getUuid(),e2,'CBD','18.5','%','NPK75',1,now,'HPLC',u2]]);

  _sheet(ss, 'References',
    ['id','citation','doi','year','source','section','url','createdAt','updatedAt'],
    [[r1,'Harman et al. Trichoderma','10.1038/nrmicro1129',2004,'Nat Rev Microbiology','p43-56','https://doi.org/10.1038/nrmicro1129',now,now],
     [r2,'Russo E. Taming THC','10.1111/bcp.12250',2011,'British J Pharmacology','p1344','https://doi.org/10.1111/bcp.12250',now,now],
     [r3,'Andre et al. Cannabis','10.3389/fpls.2016.00019',2016,'Frontiers Plant Science','p1-18','https://doi.org/10.3389/fpls.2016',now,now]]);

  _sheet(ss, 'Evidence',
    ['id','claim','referenceId','location','evidenceGrade','verdict','notes','createdAt','updatedAt'],
    [[Utilities.getUuid(),'Trichoderma +30% biomassa',r1,'Table 2','HIGH','CONFIRMED','Metanalise 15 estudos',now,now],
     [Utilities.getUuid(),'Efeito entourage CBD+THC',r2,'p1350','MEDIUM','PARTIAL','Evidencia in vitro',now,now],
     [Utilities.getUuid(),'Fotoperiodo 12/12 induz floracao',r3,'Sec 3.2','HIGH','CONFIRMED','Consenso cientifico',now,now]]);

  _sheet(ss, 'ValidationRuns',
    ['id','scope','status','severity','summary','resultJson','startedAt','finishedAt','createdBy'],
    [[Utilities.getUuid(),'study-'+s1,'COMPLETED','INFO','12 OK','{"checks":12}',now,now,u2],
     [Utilities.getUuid(),'experiment-'+e1,'COMPLETED','WARNING','1 alerta','{"warnings":1}',now,now,u2],
     [Utilities.getUuid(),'global','RUNNING','INFO','Em progresso','{}',now,null,u1]]);

  _sheet(ss, 'AuditLog',
    ['id','eventType','actorUserId','entity','entityId','action','correlationId','detailsJson','createdAt'],
    [[Utilities.getUuid(),'AUTH_SUCCESS',u1,'Session',Utilities.getUuid(),'CREATE',Utilities.getUuid(),'{"ip":"192.168.1.1"}',now],
     [Utilities.getUuid(),'CREATE',u2,'Study',s1,'CREATE',Utilities.getUuid(),'{"title":"Cannabis"}',now],
     [Utilities.getUuid(),'UPDATE',u2,'Experiment',e1,'UPDATE',Utilities.getUuid(),'{"status":"ACTIVE"}',now]]);

  _sheet(ss, 'BatchJobs',
    ['id','type','status','payloadJson','attempts','availableAt','lockedAt','lockedBy','resultJson','createdAt','updatedAt'],
    [[Utilities.getUuid(),'EXPORT_CSV','COMPLETED','{"entity":"Studies"}',1,now,now,'worker-1','{"rows":3}',now,now],
     [Utilities.getUuid(),'VALIDATION_RUN','RUNNING','{"scope":"global"}',1,now,now,'worker-2','{}',now,now],
     [Utilities.getUuid(),'EXPORT_JSON','PENDING','{"entity":"Users"}',0,now,null,null,null,now,now]]);

  _sheet(ss, 'Insumos_Catalogo',
    ['id','nomeComercial','tipoSal','fabricante','paisOrigem','registroMAPAEstabelecimento','registroMAPAProduto','agenteQuelante','solubilidade_gL_20C','purezaPercentual','driveFichaTecnicaURL','ativo','createdAt','updatedAt'],
    [[i1,'CalMag Pro','Nitrato de Calcio','Yara','Noruega','SP-123','PR-789','EDTA',1200,99.5,'https://drive.google.com/i1','ATIVO',now,now],
     [i2,'FerroPro DTPA','Quelato de Ferro','SQM','Chile','SP-234','PR-890','DTPA',800,98.0,'https://drive.google.com/i2','ATIVO',now,now],
     [i3,'MKP Ultrapuro','Fosfato Monopotassico','Haifa','Israel','SP-345','PR-901','',2300,99.8,'https://drive.google.com/i3','ATIVO',now,now]]);

  _sheet(ss, 'Lotes_CoA',
    ['id','insumoId','numeroLote','dataFabricacao','dataValidade','laboratorioEmissor','teor_Pb_ppm','teor_Cd_ppm','teor_As_ppm','teor_Hg_ppm','statusAuditoria','statusLiberacao','drivePdfCoAURL','dataAuditoria','auditorEmail','sourceVersion','createdAt','updatedAt'],
    [[l1,i1,'LOTE-2026-001','2026-01-15','2028-01-15','SGS Brasil','0.8','0.05','0.03','0.01','APROVADO','LIBERADO','https://drive.google.com/l1',now,'auditor@lab.com','v1.0',now,now],
     [l2,i2,'LOTE-2026-002','2026-02-20','2028-02-20','Intertek','1.2','0.08','0.04','0.02','ALERTA','QUARENTENA','https://drive.google.com/l2',now,'auditor@lab.com','v1.0',now,now],
     [l3,i3,'LOTE-2026-003','2026-03-10','2028-03-10','Bureau Veritas','0.5','0.03','0.02','0.01','APROVADO','LIBERADO','https://drive.google.com/l3',now,'auditor@lab.com','v1.0',now,now]]);

  _sheet(ss, 'Receitas_Fertirrigacao',
    ['id','nomeFase','alvo_P_ppm','alvo_N_NO3_ppm','alvo_N_NH4_ppm','alvo_K_ppm','alvo_Ca_ppm','alvo_Mg_ppm','alvo_Fe_ppm','quelatoExigido','pH_SolucaoAlvo','EC_Alvo_dS_m','ruleVersion','createdAt','updatedAt'],
    [[rc1,'Vegetativo',60,150,10,200,180,50,3,'EDTA',6.0,1.8,'v1.0',now,now],
     [rc2,'Floracao Inicial',80,120,8,250,200,60,3.5,'DTPA',6.2,2.0,'v1.0',now,now],
     [rc3,'Floracao Tardia',100,80,5,300,180,55,2.5,'EDDHA',6.3,2.2,'v1.0',now,now]]);

  _sheet(ss, 'Protocolos_Biologicos',
    ['id','nomeProtocolo','faseCultivo','tipoAplicacao','ecMaximo_dS_m','pHMinimo','pHMaximo','incompatibilidades','observacoes','ativo','createdAt','updatedAt'],
    [[pr1,'Trichoderma Solo','PROPAGACAO','SOLO',2.5,5.5,7.0,'Fungicidas cupricos','Aplicar em substrato umido','ATIVO',now,now],
     [pr2,'Trichoderma Foliar','VEGETATIVA','FOLIAR',1.5,6.0,7.5,'pH < 5.5','Aplicar ao entardecer','ATIVO',now,now],
     [pr3,'Bacillus subtilis','FLORACAO','INOCULACAO',2.0,6.0,7.0,'Fungicidas sistemicos','Compativel com silicio','ATIVO',now,now]]);

  _sheet(ss, 'Pareceres_Compatibilidade',
    ['id','receitaId','protocoloId','loteIds','veredicto','alertas','bloqueios','regrasAcionadas','evidencias','usuarioEmail','createdAt','updatedAt'],
    [[Utilities.getUuid(),rc1,pr1,'["'+l1+'"]','COMPATIVEL','','','RULE-001','EC OK, pH OK','dr@canabica.com',now,now],
     [Utilities.getUuid(),rc2,pr2,'["'+l2+'"]','COMPATIVEL_COM_RESSALVAS','Lote quarentena','','RULE-002','Aguardar lote','dr@canabica.com',now,now],
     [Utilities.getUuid(),rc3,pr3,'["'+l3+'"]','COMPATIVEL','','','RULE-001','Tudo OK','dr@canabica.com',now,now]]);

  _sheet(ss, 'DB_PACIENTES',
    ['id','nome','cpf_hash','email','telefone','data_nasc','termos_lgpd_aceite','medico_id','criado_em'],
    [[p1,'Maria Silva Santos','hash_cpf_001','maria@email.com','11987654321','1985-05-15',true,u2,now],
     [p2,'Joao Pedro Oliveira','hash_cpf_002','joao@email.com','11976543210','1978-11-22',true,u2,now],
     [p3,'Ana Costa Lima','hash_cpf_003','ana@email.com','11965432109','1990-03-08',true,u2,now]]);

  _sheet(ss, 'DB_PRONTUARIOS',
    ['id','paciente_id','medico_crm','anamnese_json','cid10','elegivel','status','atualizado_em'],
    [[pn1,p1,'CRM/SP 123456','{"queixa":"dor cronica"}','M79.1',true,'ATIVO',now],
     [pn2,p2,'CRM/SP 123456','{"queixa":"epilepsia"}','G40.9',true,'ATIVO',now],
     [pn3,p3,'CRM/SP 123456','{"queixa":"ansiedade"}','F41.1',true,'ATIVO',now]]);

  _sheet(ss, 'DB_RECEITAS',
    ['id','prontuario_id','paciente_id','medico_id','produto_nome','concentracao','posologia','via_adm','quimiotipo','hash_validacao','pdf_drive_id','status','emitido_em'],
    [[rm1,pn1,p1,u2,'Oleo CBD Full Spectrum','30mg/mL CBD','0.3mL 2x/dia','sublingual','TIPO_III_CBD','hash001','drive001','ASSINADA',now],
     [rm2,pn2,p2,u2,'Oleo CBD:THC 20:1','25mg/mL CBD','0.5mL 3x/dia','sublingual','TIPO_II_EQUILIBRADO','hash002','drive002','ASSINADA',now],
     [rm3,pn3,p3,u2,'Oleo CBD Isolado','50mg/mL CBD','0.2mL 2x/dia','oral','TIPO_III_CBD','hash003','drive003','PRONTO_PARA_ASSINATURA',now]]);

  _sheet(ss, 'DB_CULTIVO_PLANTAS',
    ['id','paciente_id','strain_nome','quimiotipo','ratio_cbd_thc','fase','data_plantio','status'],
    [[pl1,p1,"Charlotte's Web",'TIPO_III_CBD','20:1','FLORACAO','2026-08-01','ATIVA'],
     [pl2,p2,'ACDC','TIPO_III_CBD','18:1','VEGETATIVO','2026-09-01','ATIVA'],
     [pl3,p3,'Harlequin','TIPO_II_EQUILIBRADO','5:2','CURA','2026-06-15','COLHIDA']]);

  _sheet(ss, 'DB_CULTIVO_LOGS',
    ['id','planta_id','temp_c','umidade_pct','vpd','ph','ec_ppm','observacoes','registrado_em'],
    [[Utilities.getUuid(),pl1,24,58,1.05,'6.2','1200','Normal',now],
     [Utilities.getUuid(),pl2,25,60,1.15,'6.0','1000','Rega aumentada',now],
     [Utilities.getUuid(),pl3,20,50,0.85,'6.5','800','Secagem',now]]);

  _sheet(ss, 'DB_DIARIO_DOSES',
    ['id','paciente_id','receita_id','gotas_manha','gotas_tarde','gotas_noite','escala_sintoma','efeitos_adversos_json','registrado_em'],
    [[Utilities.getUuid(),p1,rm1,10,10,0,3,'[]',now],
     [Utilities.getUuid(),p2,rm2,15,15,15,5,'["sonolencia leve"]',now],
     [Utilities.getUuid(),p3,rm3,8,8,0,4,'[]',now]]);

  _sheet(ss, 'REF_COMORBIDADES_CANABICAS',
    ['id','codigo','nome_terapeutica','indicacao','triagem','cid10_sugerido','total_evidencias','estudos_prioritarios_json','quimiotipo_alvo','terpenos_focalizados','manejo_solo_ideal','grau_coa_exigido','limites_criticos_coa','mecanismo_agro_saude','descricao_curta','ativo'],
    [[co1,'COMORB-001','Epilepsia Refrataria','Reducao crises','A','G40.9',42,'[{"doi":"10.1016/neuro"}]','TIPO_II_EQUILIBRADO','Linalol','HIDROPONIA_MINERAL','GRAU_1_ESTRITO','Pb<0.5,Cd<0.1','Modulacao GABA','Evidencia forte','ATIVO'],
     [co2,'COMORB-003','Dor Cronica','Analgesia','B','M79.1',35,'[{"doi":"10.1097/pain"}]','TIPO_II_EQUILIBRADO','Mirceno','SOLO_VIVO_ORGANICO','GRAU_2_PADRAO','Pb<2.0,Cd<0.3','CB1/CB2 TRPV1','Ensaios positivos','ATIVO'],
     [co3,'COMORB-015','Ansiedade Generalizada','Reducao ansiedade','B','F41.1',28,'[{"doi":"10.1016/neuro2"}]','TIPO_III_CBD','Limoneno','SUBSTRATO_TRICHODERMA','GRAU_3_NEUROPSIQUIATRICO','Pb<0.5,Cd<0.1','5-HT1A via CBD','Evidencia moderada','ATIVO']]);

  _sheet(ss, 'DB_COMORBIDADES_PACIENTE',
    ['id','paciente_id','comorbidade_id','prioridade','outra_descricao','quimiotipo_sugerido','solo_recomendado','grau_coa_obrigatorio','evidencias_resumo_json','nota_medica','criado_em','atualizado_em'],
    [[Utilities.getUuid(),p1,co2,1,'','TIPO_II_EQUILIBRADO','SOLO_VIVO_ORGANICO','GRAU_2_PADRAO','{"estudos":35}','Resposta positiva esperada',now,now],
     [Utilities.getUuid(),p2,co1,1,'','TIPO_II_EQUILIBRADO','HIDROPONIA_MINERAL','GRAU_1_ESTRITO','{"estudos":42}','Epilepsia refrataria',now,now],
     [Utilities.getUuid(),p3,co3,1,'','TIPO_III_CBD','SUBSTRATO_TRICHODERMA','GRAU_3_NEUROPSIQUIATRICO','{"estudos":28}','Ansiedade moderada',now,now]]);

  _sheet(ss, 'User_Paciente_Mapping',
    ['id','userId','pacienteId','medicoId','dataVinculo','status','createdAt','updatedAt','createdBy'],
    [[Utilities.getUuid(),u2,p1,u2,now,'ATIVO',now,now,u1],
     [Utilities.getUuid(),u2,p2,u2,now,'ATIVO',now,now,u1],
     [Utilities.getUuid(),u2,p3,u2,now,'ATIVO',now,now,u1]]);

  Logger.log('');
  Logger.log('=== CONCLUIDO ===');
  Logger.log('24 abas criadas');
  Logger.log('72 registros inseridos (3 por aba)');
  Logger.log('');
  Logger.log('CREDENCIAIS:');
  Logger.log('  admin / admin123');
  Logger.log('  researcher1 / senha123');
  Logger.log('  analyst1 / senha123');
  
  SpreadsheetApp.getUi().alert('✅ SETUP COMPLETO!\n\n24 abas criadas\n72 registros inseridos\n\nCredenciais:\nadmin / admin123\nresearcher1 / senha123\nanalyst1 / senha123');
}

// ─── HELPER ──────────────────────────────────────────────────────────────────

function _sheet(ss, nome, cols, rows) {
  var sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
  } else {
    sh.clear();
  }
  sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
  if (rows && rows.length > 0) {
    sh.getRange(2, 1, rows.length, cols.length).setValues(rows);
  }
  Logger.log('  ✅ ' + nome + ' (' + rows.length + ' registros)');
}

function addHours(isoStr, h) {
  var d = new Date(isoStr);
  d.setHours(d.getHours() + h);
  return d.toISOString();
}
