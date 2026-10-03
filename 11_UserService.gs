/**
 * COMPONENTE: 11_UserService.gs
 * PAPEL: Casos de uso de administração de usuários.
 *
 * PRINCIPAIS FUNCIONALIDADES:
 * - CRUD de usuários, validação de papéis e ciclo de vida administrativo;
 * - mantém o CRUD centralizado no Google Sheets identificado por SPREADSHEETS_ID;
 * - expõe apenas contratos pequenos para facilitar testes e futura substituição.
 *
 * INTEGRAÇÕES:
 * - UserRepository, PermissionService, AuditService;
 * - Bootstrap, Constants, Config, Response e os serviços explicitamente chamados pelo corpo.
 *
 * ENTIDADES/ABAS ENVOLVIDAS:
 * - Users, AuditLog.
 *
 * SEGURANÇA E LIMITAÇÕES:
 * - senhas em texto plano são mantidas somente porque foram solicitadas para este protótipo;
 * - não registrar senha, token ou payload sensível em Logger.log, respostas ou exportações;
 * - aplicar autorização antes de toda escrita e registrar o evento em AuditLog;
 * - este arquivo é um esqueleto executável/documentado, não um laudo científico nem substituto de revisão humana.
 *
 * STATUS: ESQUELETO DE ARQUITETURA — preencher regras de negócio e testes antes de produção.
 */

/**
 * Lista todos os usuários com filtros aplicados
 * 
 * @param {object} request - Requisição com permissões e filtros
 * @returns {Array<object>} Lista de usuários sanitizados
 * @throws {Error} Se permissão negada ou falha na leitura
 */
function listUsers_(request) {
  try {
    requirePermission_(request, 'users.read');
    
    if (!request || typeof request !== 'object') {
      throwError_('INVALID_REQUEST', 'Request inválido para listUsers_', {});
    }
    
    const filters = request.filters || {};
    const result = listRecords_(APP_SHEETS.USERS, filters);
    
    // CORREÇÃO 8: listRecords_ retorna {items, pagination}, não array direto
    const users = (result && result.items) ? result.items : [];
    
    // Sanitizar todos os usuários (remover senhas)
    return users.map(function(user) {
      return sanitizeUser_(user);
    });
    
  } catch (error) {
    logException_('Erro ao listar usuários', error);
    throw error;
  }
}

/**
 * Salva (cria ou atualiza) um usuário com validação completa
 * 
 * @param {object} request - Requisição com dados do usuário
 * @returns {object} Usuário criado/atualizado (sanitizado)
 * @throws {Error} Se validação falhar ou permissão negada
 */
function saveUser_(request) {
  try {
    requirePermission_(request, 'users.write');
    
    // Validar estrutura da requisição
    if (!request || !request.data || typeof request.data !== 'object') {
      throwError_('INVALID_REQUEST', 'Request.data inválido para saveUser_', {});
    }
    
    // Validar campos obrigatórios
    if (!request.data.username || typeof request.data.username !== 'string') {
      throwError_('VALIDATION_ERROR', 'Campo username obrigatório', {});
    }
    
    if (!request.data.role || typeof request.data.role !== 'string') {
      throwError_('VALIDATION_ERROR', 'Campo role obrigatório', {});
    }
    
    // Validar password apenas se fornecido (atualização pode não enviar)
    if (request.data.password) {
      validatePasswordInput_(request.data.password);
    }
    
    // Verificar se username já existe (para criação)
    const existingByUsername = getUserByUsername_(request.data.username);
    if (existingByUsername && (!request.data.id || existingByUsername.id !== request.data.id)) {
      throwError_('DUPLICATE_USERNAME', 'Username já existe', {
        username: request.data.username
      });
    }
    
    const data = Object.assign({}, request.data, {
      id: request.data.id || newId_('usr'),
      status: request.data.status || APP_STATUS.ACTIVE,
      updatedAt: nowIso_(),
      createdAt: request.data.createdAt || nowIso_()
    });
    
    const isUpdate = data.id && getUserById_(data.id);
    const result = isUpdate
      ? updateRecordByField_(APP_SHEETS.USERS, 'id', data.id, data)
      : createUserRecord_(data);
    
    if (!result) {
      throwError_('SAVE_FAILED', 'Falha ao salvar usuário', {userId: data.id});
    }
    
    auditEvent_('USER_MUTATION', 'Users', data.id, isUpdate ? 'UPDATE' : 'CREATE', {
      username: data.username,
      role: data.role
    }, request.correlationId);
    
    return sanitizeUser_(result);
    
  } catch (error) {
    logException_('Erro ao salvar usuário', error);
    throw error;
  }
}
