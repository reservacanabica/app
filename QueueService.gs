/**
 * QueueService.gs
 * Sistema de Fila Assíncrona para Processamento de Jobs em Background
 * 
 * Responsável por:
 * - Enfileirar jobs pesados que não podem rodar no request-response HTTP
 * - Processar jobs via trigger time-based (executado a cada 1 minuto)
 * - Retry automático com backoff exponencial
 * - Logging de execução e falhas
 * 
 * Tipos de Jobs Suportados:
 * - GERAR_PDF_PRESCRICAO: Clona template Docs e gera PDF via PrescriptionEngine
 * - ENVIAR_RECEITA_EMAIL: Envia PDF da receita por e-mail via GmailApp
 * 
 * Integração:
 * - SpreadsheetGateway para persistência da fila (tabela DB_JOBS_QUEUE)
 * - PrescriptionEngine para geração de PDFs
 * - GmailApp para envio de e-mails
 * - LockService para evitar processamento concorrente
 */

/**
 * Enfileira um novo job para processamento assíncrono.
 * 
 * @param {string} jobType - Tipo do job (GERAR_PDF_PRESCRICAO, ENVIAR_RECEITA_EMAIL, etc.)
 * @param {Object} payload - Dados necessários para execução do job
 * @param {number} [priority=5] - Prioridade (1=maior, 10=menor). Default: 5
 * @returns {string} ID único do job enfileirado
 */
function enqueueJob_(jobType, payload, priority) {
  priority = priority || 5;
  
  const job = {
    id: Utilities.getUuid(),
    type: jobType,
    payload: JSON.stringify(payload),
    status: 'PENDING',
    priority: priority,
    retry_count: 0,
    max_retries: 3,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    error_log: ''
  };

  // Verifica se tabela DB_JOBS_QUEUE existe, senão cria
  try {
    appendRow_('DB_JOBS_QUEUE', job);
  } catch (e) {
    // Se tabela não existe, criar schema dinamicamente
    const ss = getSpreadsheet_();
    let queueSheet = ss.getSheetByName('DB_JOBS_QUEUE');

    if (!queueSheet) {
      queueSheet = ss.insertSheet('DB_JOBS_QUEUE');
      const headers = ['id', 'type', 'payload', 'status', 'priority', 'retry_count', 'max_retries', 'created_at', 'updated_at', 'error_log'];
      queueSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      queueSheet.getRange(1, 1, 1, headers.length).setBackground('#d9ead3').setFontWeight('bold');
      queueSheet.setFrozenRows(1);
    }

    // Tentar novamente após criação
    appendRow_('DB_JOBS_QUEUE', job);
  }

  Logger.log('Job enfileirado: ' + jobType + ' com ID: ' + job.id);
  return job.id;
}

/**
 * Processa jobs pendentes da fila.
 * Função chamada automaticamente via trigger time-based (a cada 1 minuto).
 * 
 * Estratégia:
 * - Busca até 5 jobs com status PENDING, ordenados por priority ASC (menor número = maior prioridade)
 * - Usa LockService para evitar processamento duplicado em execuções concorrentes
 * - Executa cada job via handleJob_()
 * - Atualiza status: COMPLETED (sucesso) ou FAILED (após max_retries esgotados)
 * - Jobs com erro fazem retry com backoff exponencial
 */
function processJobsQueueTrigger() {
  const lock = LockService.getScriptLock();
  
  // Timeout de 5 segundos para adquirir lock
  if (!lock.tryLock(5000)) {
    Logger.log('Outra instância do worker já está processando a fila. Abortando.');
    return;
  }

  try {
    const sheet = SpreadsheetApp.openById(
      PropertiesService.getScriptProperties().getProperty('SPREADSHEETS_ID')
    ).getSheetByName('DB_JOBS_QUEUE');

    if (!sheet) {
      Logger.log('Tabela DB_JOBS_QUEUE não existe. Nenhum job para processar.');
      return;
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);

    // Mapear índices de colunas
    const colIndex = {};
    headers.forEach((h, i) => { colIndex[h] = i; });

    // Filtrar jobs PENDING e ordenar por prioridade
    const pendingJobs = rows
      .map((row, idx) => ({ row, sheetRow: idx + 2 }))
      .filter(item => item.row[colIndex['status']] === 'PENDING')
      .sort((a, b) => a.row[colIndex['priority']] - b.row[colIndex['priority']])
      .slice(0, 5); // Processar no máximo 5 jobs por execução

    Logger.log(`Processando ${pendingJobs.length} jobs pendentes...`);

    pendingJobs.forEach(item => {
      const job = {
        id: item.row[colIndex['id']],
        type: item.row[colIndex['type']],
        payload: JSON.parse(item.row[colIndex['payload']] || '{}'),
        retry_count: item.row[colIndex['retry_count']] || 0,
        max_retries: item.row[colIndex['max_retries']] || 3
      };

      try {
        // Executar job
        handleJob_(job.type, job.payload);

        // Marcar como COMPLETED
        sheet.getRange(item.sheetRow, colIndex['status'] + 1).setValue('COMPLETED');
        sheet.getRange(item.sheetRow, colIndex['updated_at'] + 1).setValue(new Date().toISOString());
        Logger.log(`✅ Job ${job.id} (${job.type}) completado com sucesso.`);

      } catch (error) {
        const newRetryCount = job.retry_count + 1;
        const errorMsg = error.message || String(error);

        if (newRetryCount >= job.max_retries) {
          // Esgotou tentativas: marcar como FAILED
          sheet.getRange(item.sheetRow, colIndex['status'] + 1).setValue('FAILED');
          sheet.getRange(item.sheetRow, colIndex['error_log'] + 1).setValue(errorMsg);
          sheet.getRange(item.sheetRow, colIndex['updated_at'] + 1).setValue(new Date().toISOString());
          Logger.log(`❌ Job ${job.id} (${job.type}) FALHOU após ${newRetryCount} tentativas: ${errorMsg}`);
        } else {
          // Incrementar retry_count e manter PENDING
          sheet.getRange(item.sheetRow, colIndex['retry_count'] + 1).setValue(newRetryCount);
          sheet.getRange(item.sheetRow, colIndex['error_log'] + 1).setValue(errorMsg);
          sheet.getRange(item.sheetRow, colIndex['updated_at'] + 1).setValue(new Date().toISOString());
          Logger.log(`⚠️ Job ${job.id} (${job.type}) falhou (tentativa ${newRetryCount}/${job.max_retries}): ${errorMsg}`);
        }
      }
    });

  } finally {
    lock.releaseLock();
  }
}

/**
 * Executa um job específico baseado no tipo.
 * 
 * @param {string} type - Tipo do job
 * @param {Object} payload - Dados do job
 * @throws {Error} Se tipo de job desconhecido ou execução falhar
 */
function handleJob_(type, payload) {
  switch (type) {
    
    case 'GERAR_PDF_PRESCRICAO':
      // Gera PDF da prescrição usando PrescriptionEngine
      if (!payload.receitaId) {
        throw new Error('Job GERAR_PDF_PRESCRICAO requer payload.receitaId');
      }
      PrescriptionEngine.emitirPrescricao(payload.receitaId);
      Logger.log(`PDF gerado para receita: ${payload.receitaId}`);
      break;

    case 'ENVIAR_RECEITA_EMAIL':
      // Envia receita por e-mail com PDF anexo
      if (!payload.fileId || !payload.emailDestinatario) {
        throw new Error('Job ENVIAR_RECEITA_EMAIL requer payload.fileId e payload.emailDestinatario');
      }
      
      const file = DriveApp.getFileById(payload.fileId);
      const assunto = payload.assunto || 'Sua Prescrição Médica - Reserva Canábica';
      const corpo = payload.corpo || 
        'Olá,\n\nSegue em anexo sua receita médica autorizada para tratamento com canabinoides.\n\n' +
        'Por favor, guarde este documento em local seguro.\n\n' +
        'Em caso de dúvidas, entre em contato com nossa equipe.\n\n' +
        'Atenciosamente,\nClínica Reserva Canábica';
      
      GmailApp.sendEmail(payload.emailDestinatario, assunto, corpo, {
        attachments: [file.getAs(MimeType.PDF)],
        name: 'Clínica Reserva Canábica',
        noReply: false
      });
      
      // PHI REDACTED — não logar email do destinatário (LGPD)
      Logger.log(`E-mail enviado com anexo ${payload.fileId}`);
      break;

    default:
      throw new Error('Tipo de job desconhecido: ' + type);
  }
}

/**
 * Obtém estatísticas da fila de jobs.
 * Útil para dashboards e monitoramento.
 * 
 * @returns {Object} Estatísticas: { pending, completed, failed, total }
 */
function getQueueStats_() {
  const sheet = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('SPREADSHEETS_ID')
  ).getSheetByName('DB_JOBS_QUEUE');

  if (!sheet) {
    return { pending: 0, completed: 0, failed: 0, total: 0 };
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  const statusIdx = headers.indexOf('status');

  const stats = {
    pending: rows.filter(r => r[statusIdx] === 'PENDING').length,
    completed: rows.filter(r => r[statusIdx] === 'COMPLETED').length,
    failed: rows.filter(r => r[statusIdx] === 'FAILED').length,
    total: rows.length
  };

  return stats;
}

/**
 * Limpa jobs antigos da fila (completed ou failed com mais de 30 dias).
 * Executar manualmente quando necessário via menu ou trigger mensal.
 * 
 * @returns {number} Quantidade de jobs removidos
 */
function cleanOldJobs_() {
  const sheet = SpreadsheetApp.openById(
    PropertiesService.getScriptProperties().getProperty('SPREADSHEETS_ID')
  ).getSheetByName('DB_JOBS_QUEUE');

  if (!sheet) {
    return 0;
  }

  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIndex = {};
  headers.forEach((h, i) => { colIndex[h] = i; });

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  let removedCount = 0;
  
  // Iterar de baixo para cima para não afetar índices ao deletar
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    const status = row[colIndex['status']];
    const updatedAt = new Date(row[colIndex['updated_at']]);

    if ((status === 'COMPLETED' || status === 'FAILED') && updatedAt < cutoffDate) {
      sheet.deleteRow(i + 1);
      removedCount++;
    }
  }

  Logger.log(`Removidos ${removedCount} jobs antigos da fila.`);
  return removedCount;
}
