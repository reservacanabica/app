/**
 * COMPONENTE: 14_SpreadsheetGateway.gs
 * PAPEL: Abstração única de I/O com Google Sheets
 *
 * IMPORTANTE:
 * - Ponto ÚNICO de acesso ao Sheets
 * - Todas as repositories chamam funções deste arquivo
 * - Implementa transformação: Sheet Range → Array of Objects
 * - Sem lógica de negócio — apenas CRUD primitivo
 *
 * STATUS: v2.0 — Implementado
 */

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

let __SPREADSHEET_CACHE__ = null;

/**
 * Obtém a planilha (com cache)
 *
 * @returns {SpreadsheetApp.Spreadsheet}
 * @throws {Error}
 */
function getSpreadsheet_() {
  if (__SPREADSHEET_CACHE__) {
    return __SPREADSHEET_CACHE__;
  }

  const spreadsheetId = getSpreadsheetId_();
  try {
    __SPREADSHEET_CACHE__ = SpreadsheetApp.openById(spreadsheetId);
    return __SPREADSHEET_CACHE__;
  } catch (error) {
    throw new Error('Não foi possível abrir planilha ' + spreadsheetId + ': ' + error.message);
  }
}

/**
 * Obtém aba pelo nome
 *
 * @param {string} sheetName
 * @returns {Sheet} ou null se não existir
 */
function getSheet_(sheetName) {
  const spreadsheet = getSpreadsheet_();
  try {
    return spreadsheet.getSheetByName(sheetName);
  } catch (error) {
    return null;
  }
}

/**
 * Verifica se aba existe
 *
 * @param {string} sheetName
 * @returns {boolean}
 */
function sheetExists_(sheetName) {
  return getSheet_(sheetName) !== null;
}

// ============================================================================
// CRIAÇÃO E GERENCIAMENTO DE ABAS
// ============================================================================

/**
 * Cria aba com cabeçalhos (idempotente)
 *
 * @param {string} sheetName
 * @param {array} columns — lista de nomes de colunas
 * @returns {Sheet}
 */
function createSheetWithHeaders_(sheetName, columns) {
  let sheet = getSheet_(sheetName);

  if (sheet) {
    // Aba já existe — verificar cabeçalhos
    const existingHeaders = getSheetHeaders_(sheetName);
    if (JSON.stringify(existingHeaders) !== JSON.stringify(columns)) {
      logWarn_('Cabeçalhos de ' + sheetName + ' diferem do schema esperado', {
        expected: columns,
        actual: existingHeaders
      });
    }
    return sheet;
  }

  // Criar aba nova
  const spreadsheet = getSpreadsheet_();
  sheet = spreadsheet.insertSheet(sheetName);

  // Inserir cabeçalhos
  sheet.getRange(1, 1, 1, columns.length).setValues([columns]);

  return sheet;
}

/**
 * Deleta aba
 *
 * @param {string} sheetName
 */
function deleteSheet_(sheetName) {
  const sheet = getSheet_(sheetName);
  if (!sheet) return;

  const spreadsheet = getSpreadsheet_();
  spreadsheet.deleteSheet(sheet);
}

/**
 * Limpa todos os dados de uma aba (mantém cabeçalhos)
 *
 * @param {string} sheetName
 */
function clearSheetData_(sheetName) {
  const sheet = getSheet_(sheetName);
  if (!sheet) return;

  const headers = getSheetHeaders_(sheetName);
  sheet.clearContents();

  // Re-inserir cabeçalhos
  if (headers && headers.length > 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
}

// ============================================================================
// LEITURA DE DADOS
// ============================================================================

/**
 * Obtém cabeçalhos de uma aba
 *
 * @param {string} sheetName
 * @returns {array} lista de nomes de coluna
 */
function getSheetHeaders_(sheetName) {
  const sheet = getSheet_(sheetName);
  if (!sheet) return [];

  const range = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  const values = range.getValues();

  return values[0] || [];
}

/**
 * Retorna todos os dados como array de objetos
 * Exemplo: [{id: '123', name: 'John'}, ...]
 *
 * @param {string} sheetName
 * @returns {array}
 */
function getAllRowsAsObjects_(sheetName) {
  const sheet = getSheet_(sheetName);
  if (!sheet) return [];

  const headers = getSheetHeaders_(sheetName);
  if (headers.length === 0) return [];

  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return []; // Apenas cabeçalho

  const range = sheet.getRange(2, 1, lastRow - 1, headers.length);
  const values = range.getValues();

  return valuesToObjects_(headers, values);
}

/**
 * Alias para getAllRowsAsObjects_ (compatibilidade com código legado)
 * 
 * @param {string} sheetName
 * @returns {array}
 */
function getAllRecords_(sheetName) {
  return getAllRowsAsObjects_(sheetName);
}

/**
 * Retorna uma linha por ID (coluna 'id')
 *
 * @param {string} sheetName
 * @param {string} id
 * @returns {object|null}
 */
function getRowById_(sheetName, id) {
  const rows = getAllRowsAsObjects_(sheetName);
  return rows.find(function(row) {
    return row.id === id;
  }) || null;
}

/**
 * Busca linhas por filtro
 *
 * @param {string} sheetName
 * @param {object} filter — {columnName: value}
 * @returns {array}
 */
function findRows_(sheetName, filter) {
  const rows = getAllRowsAsObjects_(sheetName);

  if (!filter || Object.keys(filter).length === 0) {
    return rows;
  }

  return rows.filter(function(row) {
    for (let key in filter) {
      if (row[key] !== filter[key]) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Conta número de linhas de dados
 *
 * @param {string} sheetName
 * @returns {number}
 */
function getRowCount_(sheetName) {
  const sheet = getSheet_(sheetName);
  if (!sheet) return 0;
  return Math.max(0, sheet.getLastRow() - 1); // -1 para excluir cabeçalho
}

// ============================================================================
// ESCRITA DE DADOS
// ============================================================================

/**
 * Adiciona uma nova linha (append)
 *
 * @param {string} sheetName
 * @param {object} rowObject — {columnName: value}
 * @returns {number} número da linha inserida
 */
function appendRow_(sheetName, rowObject) {
  const sheet = getSheet_(sheetName);
  if (!sheet) throw new Error('Aba não existe: ' + sheetName);

  const headers = getSheetHeaders_(sheetName);
  if (headers.length === 0) {
    throw new Error('Aba sem cabeçalhos: ' + sheetName);
  }

  // Construir array de valores na ordem dos cabeçalhos
  const values = headers.map(function(header) {
    return rowObject[header] !== undefined ? rowObject[header] : '';
  });

  const lastRow = sheet.getLastRow();
  const newRow = lastRow + 1;

  sheet.getRange(newRow, 1, 1, headers.length).setValues([values]);

  return newRow;
}

/**
 * Adiciona múltiplas linhas (batch append)
 *
 * @param {string} sheetName
 * @param {array} rowObjects — array de objetos
 * @returns {array} números das linhas inseridas
 */
function appendRows_(sheetName, rowObjects) {
  if (!rowObjects || rowObjects.length === 0) return [];

  const sheet = getSheet_(sheetName);
  if (!sheet) throw new Error('Aba não existe: ' + sheetName);

  const headers = getSheetHeaders_(sheetName);
  if (headers.length === 0) {
    throw new Error('Aba sem cabeçalhos: ' + sheetName);
  }

  // Construir matriz de valores
  const values = rowObjects.map(function(obj) {
    return headers.map(function(header) {
      return obj[header] !== undefined ? obj[header] : '';
    });
  });

  const lastRow = sheet.getLastRow();
  const newRowStart = lastRow + 1;
  const numRows = rowObjects.length;

  sheet.getRange(newRowStart, 1, numRows, headers.length).setValues(values);

  const insertedRows = [];
  for (let i = 0; i < numRows; i++) {
    insertedRows.push(newRowStart + i);
  }

  return insertedRows;
}

/**
 * Atualiza linha por ID
 *
 * @param {string} sheetName
 * @param {string} id
 * @param {object} updates — campos a atualizar
 * @returns {boolean} true se atualizado
 */
function updateRowById_(sheetName, id, updates) {
  const sheet = getSheet_(sheetName);
  if (!sheet) return false;

  const headers = getSheetHeaders_(sheetName);
  const lastRow = sheet.getLastRow();

  // Encontrar linha com ID
  const range = sheet.getRange(2, 1, lastRow - 1, headers.length);
  const values = range.getValues();
  const idColumnIndex = headers.indexOf('id');

  if (idColumnIndex === -1) {
    throw new Error('Coluna "id" não encontrada em ' + sheetName);
  }

  let foundRowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][idColumnIndex] === id) {
      foundRowIndex = i;
      break;
    }
  }

  if (foundRowIndex === -1) {
    return false; // ID não encontrado
  }

  // Aplicar atualizações
  for (let key in updates) {
    const colIndex = headers.indexOf(key);
    if (colIndex !== -1) {
      values[foundRowIndex][colIndex] = updates[key];
    }
  }

  // Atualizar sheet
  const actualRow = foundRowIndex + 2; // +1 para cabeçalho, +1 para 1-indexed
  sheet.getRange(actualRow, 1, 1, headers.length).setValues([values[foundRowIndex]]);

  return true;
}

/**
 * Deleta linha por ID
 *
 * @param {string} sheetName
 * @param {string} id
 * @returns {boolean} true se deletado
 */
function deleteRowById_(sheetName, id) {
  const sheet = getSheet_(sheetName);
  if (!sheet) return false;

  const headers = getSheetHeaders_(sheetName);
  const lastRow = sheet.getLastRow();

  const range = sheet.getRange(2, 1, lastRow - 1, headers.length);
  const values = range.getValues();
  const idColumnIndex = headers.indexOf('id');

  if (idColumnIndex === -1) {
    throw new Error('Coluna "id" não encontrada em ' + sheetName);
  }

  let foundRowIndex = -1;
  for (let i = 0; i < values.length; i++) {
    if (values[i][idColumnIndex] === id) {
      foundRowIndex = i;
      break;
    }
  }

  if (foundRowIndex === -1) {
    return false; // ID não encontrado
  }

  // Deletar linha do sheet
  const actualRow = foundRowIndex + 2;
  sheet.deleteRow(actualRow);

  return true;
}

// ============================================================================
// HELPERS DE TRANSFORMAÇÃO
// ============================================================================

/**
 * Converte array de valores em array de objetos
 *
 * @param {array} headers
 * @param {array} values — 2D array
 * @returns {array} array de objetos
 */
function valuesToObjects_(headers, values) {
  return values.map(function(row) {
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = row[i] || '';
    }
    return obj;
  });
}

/**
 * Obtém estatísticas da aba
 *
 * @param {string} sheetName
 * @returns {object}
 */
function getSheetStats_(sheetName) {
  const sheet = getSheet_(sheetName);
  if (!sheet) {
    return { exists: false };
  }

  const headers = getSheetHeaders_(sheetName);
  const rowCount = getRowCount_(sheetName);

  return {
    exists: true,
    name: sheetName,
    columns: headers.length,
    rows: rowCount,
    headers: headers,
    lastUpdated: nowIso_()
  };
}

// ============================================================================
// EXPORTAR
// ============================================================================

const GATEWAY_LOADED = true;

// ============================================================================
// ALIASES DE COMPATIBILIDADE
// ============================================================================

/**
 * Alias de getAllRowsAsObjects_ para compatibilidade com testes e repositórios legados
 */
function getAllRows_(sheetName) {
  return getAllRowsAsObjects_(sheetName);
}

/**
 * Alias de appendRow_ para compatibilidade com PacienteRepository e testes
 */
function appendRowToSheet_(sheetName, data) {
  return appendRow_(sheetName, data);
}
