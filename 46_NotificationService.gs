/**
 * COMPONENTE: 46_NotificationService.gs
 * PAPEL: Serviço de notificações (email)
 *
 * RESPONSABILIDADE:
 * - Enviar notificações por email
 * - Gerenciar templates de email
 * - Rastrear envios
 *
 * TIPOS:
 * - JOB_COMPLETED — job em batch completado
 * - JOB_FAILED — job falhado
 * - VALIDATION_FAILED — validações falharam
 * - ERROR_ALERT — erro do sistema
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// ENVIO DE EMAIL
// ============================================================================

/**
 * Envia notificação por email
 *
 * @param {string} to — email destinatário
 * @param {string} subject
 * @param {string} body — conteúdo HTML/texto
 * @param {object} options — {cc, bcc, replyTo}
 * @returns {boolean}
 */
function sendNotificationEmail_(to, subject, body, options) {
  try {
    options = options || {};

    logDebug_('Enviando email', {
      to: to,
      subject: subject
    });

    // Usar GmailApp (apenas em contexto de proprietário)
    try {
      GmailApp.sendEmail(to, subject, body, {
        htmlBody: body,
        cc: options.cc,
        bcc: options.bcc,
        replyTo: options.replyTo,
        name: 'Canabica Sistema'
      });

      auditCreate_('Email', generateUUID_(), 'system', {
        to: to,
        subject: subject,
        status: 'SENT'
      });

      return true;

    } catch (gmailError) {
      // Fallback: apenas logar se GmailApp não disponível
      logWarn_('Email não pode ser enviado (GmailApp não disponível)', {
        to: to,
        subject: subject,
        error: gmailError.message
      });

      // Ainda registrar a tentativa
      auditCreate_('Email', generateUUID_(), 'system', {
        to: to,
        subject: subject,
        status: 'FAILED',
        reason: 'GmailApp indisponível'
      });

      return false;
    }

  } catch (error) {
    logException_('Erro ao enviar email', error);
    return false;
  }
}

// ============================================================================
// TEMPLATES DE EMAIL
// ============================================================================

/**
 * Template: Job completado
 */
function buildJobCompletedEmail_(job, result) {
  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>Job Completado</h2>
        <p>Seu job de <strong>${job.type}</strong> foi completado com sucesso.</p>
        
        <h3>Detalhes:</h3>
        <ul>
          <li><strong>Job ID:</strong> ${job.id}</li>
          <li><strong>Tipo:</strong> ${job.type}</li>
          <li><strong>Status:</strong> COMPLETED</li>
          <li><strong>Criado:</strong> ${job.createdAt}</li>
          <li><strong>Completado:</strong> ${job.completedAt}</li>
        </ul>

        <h3>Resultado:</h3>
        <pre>${JSON.stringify(result, null, 2)}</pre>

        <p>Acesse o dashboard para mais detalhes.</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          Este é um email automático do sistema Canabica. Não responda este email.
        </p>
      </body>
    </html>
  `;

  return htmlBody;
}

/**
 * Template: Job falhado
 */
function buildJobFailedEmail_(job, errorMessage) {
  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #d9534f;">Job Falhado</h2>
        <p>Seu job de <strong>${job.type}</strong> falhou.</p>
        
        <h3>Detalhes:</h3>
        <ul>
          <li><strong>Job ID:</strong> ${job.id}</li>
          <li><strong>Tipo:</strong> ${job.type}</li>
          <li><strong>Status:</strong> FAILED</li>
          <li><strong>Erro:</strong> ${errorMessage}</li>
          <li><strong>Tentativas:</strong> ${job.retries} / ${job.maxRetries}</li>
        </ul>

        <p>O job será automaticamente retentado (se não tiver excedido o máximo de tentativas).</p>
        <hr>
        <p style="color: #666; font-size: 12px;">
          Este é um email automático do sistema Canabica.
        </p>
      </body>
    </html>
  `;

  return htmlBody;
}

/**
 * Template: Validações falharam
 */
function buildValidationFailedEmail_(validationReport, studyTitle) {
  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #f0ad4e;">Validações Falharam</h2>
        <p>O estudo <strong>${studyTitle}</strong> possui validações falhadas.</p>
        
        <h3>Resumo:</h3>
        <ul>
          <li><strong>Total de Validações:</strong> ${validationReport.validationsRun}</li>
          <li><strong>Passou:</strong> ${validationReport.passed}</li>
          <li><strong>Falhou:</strong> ${validationReport.failed}</li>
          <li><strong>Taxa de Sucesso:</strong> ${validationReport.passRate}</li>
        </ul>

        <h3>Próximos Passos:</h3>
        <ol>
          <li>Revisar as validações falhadas no dashboard</li>
          <li>Corrigir os dados conforme necessário</li>
          <li>Executar as validações novamente</li>
        </ol>

        <hr>
        <p style="color: #666; font-size: 12px;">
          Este é um email automático do sistema Canabica.
        </p>
      </body>
    </html>
  `;

  return htmlBody;
}

/**
 * Template: Alerta de erro
 */
function buildErrorAlertEmail_(error, context) {
  const htmlBody = `
    <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2 style="color: #d9534f;">Alerta de Erro do Sistema</h2>
        <p>Um erro foi detectado no sistema Canabica.</p>
        
        <h3>Detalhes do Erro:</h3>
        <ul>
          <li><strong>Mensagem:</strong> ${error.message}</li>
          <li><strong>Código:</strong> ${error.code}</li>
          <li><strong>Timestamp:</strong> ${nowIso_()}</li>
        </ul>

        <h3>Contexto:</h3>
        <pre>${JSON.stringify(context, null, 2)}</pre>

        <p><strong>Ação Recomendada:</strong> Verifique o log de auditoria e contate o administrador se necessário.</p>

        <hr>
        <p style="color: #666; font-size: 12px;">
          Este é um email automático do sistema Canabica. Não responda este email.
        </p>
      </body>
    </html>
  `;

  return htmlBody;
}

// ============================================================================
// NOTIFICAÇÕES DE NEGÓCIO
// ============================================================================

/**
 * Notifica quando job completou
 *
 * @param {string} userEmail
 * @param {object} job
 * @param {object} result
 */
function notifyJobCompleted_(userEmail, job, result) {
  try {
    const body = buildJobCompletedEmail_(job, result);

    return sendNotificationEmail_(
      userEmail,
      '[Canabica] Job Completado: ' + job.type,
      body
    );

  } catch (error) {
    logException_('Erro ao notificar job completado', error);
    return false;
  }
}

/**
 * Notifica quando job falhou
 *
 * @param {string} userEmail
 * @param {object} job
 */
function notifyJobFailed_(userEmail, job) {
  try {
    const body = buildJobFailedEmail_(job, job.errorMessage);

    return sendNotificationEmail_(
      userEmail,
      '[Canabica] Job Falhado: ' + job.type,
      body
    );

  } catch (error) {
    logException_('Erro ao notificar job falhado', error);
    return false;
  }
}

/**
 * Notifica sobre validações falhadas
 *
 * @param {string} userEmail
 * @param {object} validationReport
 * @param {string} studyTitle
 */
function notifyValidationFailed_(userEmail, validationReport, studyTitle) {
  try {
    const body = buildValidationFailedEmail_(validationReport, studyTitle);

    return sendNotificationEmail_(
      userEmail,
      '[Canabica] Validações Falharam: ' + studyTitle,
      body
    );

  } catch (error) {
    logException_('Erro ao notificar validação falhada', error);
    return false;
  }
}

/**
 * Notifica administrador sobre erro crítico
 *
 * @param {object} error
 * @param {object} context
 */
function notifyAdminError_(error, context) {
  try {
    const admins = getRecordsByStatus_(USER_ROLES.ADMIN);

    admins.forEach(function(admin) {
      const body = buildErrorAlertEmail_(error, context);

      sendNotificationEmail_(
        admin.email,
        '[Canabica] ALERTA: Erro Crítico do Sistema',
        body
      );
    });

  } catch (error) {
    logException_('Erro ao notificar admin', error);
  }
}

// ============================================================================
// ESTATÍSTICAS
// ============================================================================

/**
 * Retorna estatísticas de notificações
 *
 * @returns {object}
 */
function getNotificationStats_() {
  const all = getAllRecords_(getSheet_('AuditLog')) || [];
  const emailAudits = all.filter(function(log) {
    return log.entity === 'Email';
  });

  return {
    total: emailAudits.length,
    sent: emailAudits.filter(function(e) { return e.status === 'SENT'; }).length,
    failed: emailAudits.filter(function(e) { return e.status === 'FAILED'; }).length,
    timestamp: nowIso_()
  };
}

const NOTIFICATION_SERVICE_LOADED = true;
