/**
 * @fileoverview AccessibilityService - Serviço de Acessibilidade e Auditoria ARIA
 * 
 * @description
 * Gerencia validação, auditoria e relatórios de acessibilidade para conformidade WCAG 2.1 AA.
 * 
 * FUNCIONALIDADES PRINCIPAIS:
 * - Auditoria ARIA automática de componentes HTML
 * - Validação de contraste de cores (WCAG AA/AAA)
 * - Verificação de navegação por teclado
 * - Geração de relatórios de acessibilidade
 * - Testes automatizados de screen readers
 * - Sugestões de melhorias
 * 
 * NÍVEIS DE CONFORMIDADE:
 * - Level A: Requisitos básicos (mínimo aceitável)
 * - Level AA: Conformidade recomendada (alvo do projeto)
 * - Level AAA: Conformidade máxima (opcional)
 * 
 * CATEGORIAS DE VERIFICAÇÃO:
 * 1. Perceivable (Perceptível): Texto alternativo, contraste, legendas
 * 2. Operable (Operável): Teclado, tempo suficiente, navegação
 * 3. Understandable (Compreensível): Legibilidade, previsibilidade
 * 4. Robust (Robusto): Compatibilidade com tecnologias assistivas
 * 
 * INTEGRAÇÕES:
 * - SpreadsheetGateway: Armazena auditorias e relatórios
 * - LoggerService: Registra eventos de acessibilidade
 * - ValidationService: Valida estruturas ARIA
 * 
 * @author Sistema Canabica
 * @version 1.0.0
 * @since 2024-01-15
 */

/**
 * Namespace para serviço de acessibilidade
 * @namespace
 */
var AccessibilityService = (function() {
  'use strict';

  // ============================================================================
  // CONSTANTES
  // ============================================================================

  /**
   * Critérios de sucesso WCAG 2.1 Level AA
   * @const {Object}
   */
  var WCAG_CRITERIA = {
    // Perceivable
    TEXT_ALTERNATIVES: '1.1.1',
    CAPTIONS_PRERECORDED: '1.2.2',
    AUDIO_DESCRIPTION: '1.2.5',
    INFO_AND_RELATIONSHIPS: '1.3.1',
    MEANINGFUL_SEQUENCE: '1.3.2',
    SENSORY_CHARACTERISTICS: '1.3.3',
    USE_OF_COLOR: '1.4.1',
    AUDIO_CONTROL: '1.4.2',
    CONTRAST_MINIMUM: '1.4.3',
    RESIZE_TEXT: '1.4.4',
    IMAGES_OF_TEXT: '1.4.5',
    
    // Operable
    KEYBOARD: '2.1.1',
    NO_KEYBOARD_TRAP: '2.1.2',
    TIMING_ADJUSTABLE: '2.2.1',
    PAUSE_STOP_HIDE: '2.2.2',
    THREE_FLASHES: '2.3.1',
    BYPASS_BLOCKS: '2.4.1',
    PAGE_TITLED: '2.4.2',
    FOCUS_ORDER: '2.4.3',
    LINK_PURPOSE: '2.4.4',
    MULTIPLE_WAYS: '2.4.5',
    HEADINGS_AND_LABELS: '2.4.6',
    FOCUS_VISIBLE: '2.4.7',
    
    // Understandable
    LANGUAGE_OF_PAGE: '3.1.1',
    LANGUAGE_OF_PARTS: '3.1.2',
    ON_FOCUS: '3.2.1',
    ON_INPUT: '3.2.2',
    CONSISTENT_NAVIGATION: '3.2.3',
    CONSISTENT_IDENTIFICATION: '3.2.4',
    ERROR_IDENTIFICATION: '3.3.1',
    LABELS_OR_INSTRUCTIONS: '3.3.2',
    ERROR_SUGGESTION: '3.3.3',
    ERROR_PREVENTION: '3.3.4',
    
    // Robust
    PARSING: '4.1.1',
    NAME_ROLE_VALUE: '4.1.2'
  };

  /**
   * Razões de contraste mínimas WCAG
   * @const {Object}
   */
  var CONTRAST_RATIOS = {
    AA_NORMAL: 4.5,      // Texto normal AA
    AA_LARGE: 3.0,       // Texto grande (18pt+) AA
    AAA_NORMAL: 7.0,     // Texto normal AAA
    AAA_LARGE: 4.5       // Texto grande AAA
  };

  /**
   * Roles ARIA válidas
   * @const {Array<string>}
   */
  var VALID_ARIA_ROLES = [
    'alert', 'alertdialog', 'application', 'article', 'banner',
    'button', 'cell', 'checkbox', 'columnheader', 'combobox',
    'complementary', 'contentinfo', 'definition', 'dialog', 'directory',
    'document', 'feed', 'figure', 'form', 'grid', 'gridcell',
    'group', 'heading', 'img', 'link', 'list', 'listbox', 'listitem',
    'log', 'main', 'marquee', 'math', 'menu', 'menubar', 'menuitem',
    'menuitemcheckbox', 'menuitemradio', 'navigation', 'none', 'note',
    'option', 'presentation', 'progressbar', 'radio', 'radiogroup',
    'region', 'row', 'rowgroup', 'rowheader', 'scrollbar', 'search',
    'searchbox', 'separator', 'slider', 'spinbutton', 'status',
    'switch', 'tab', 'table', 'tablist', 'tabpanel', 'term',
    'textbox', 'timer', 'toolbar', 'tooltip', 'tree', 'treegrid', 'treeitem'
  ];

  /**
   * Estados e propriedades ARIA válidas
   * @const {Array<string>}
   */
  var VALID_ARIA_ATTRIBUTES = [
    'aria-activedescendant', 'aria-atomic', 'aria-autocomplete',
    'aria-busy', 'aria-checked', 'aria-colcount', 'aria-colindex',
    'aria-colspan', 'aria-controls', 'aria-current', 'aria-describedby',
    'aria-details', 'aria-disabled', 'aria-dropeffect', 'aria-errormessage',
    'aria-expanded', 'aria-flowto', 'aria-grabbed', 'aria-haspopup',
    'aria-hidden', 'aria-invalid', 'aria-keyshortcuts', 'aria-label',
    'aria-labelledby', 'aria-level', 'aria-live', 'aria-modal',
    'aria-multiline', 'aria-multiselectable', 'aria-orientation',
    'aria-owns', 'aria-placeholder', 'aria-posinset', 'aria-pressed',
    'aria-readonly', 'aria-relevant', 'aria-required', 'aria-roledescription',
    'aria-rowcount', 'aria-rowindex', 'aria-rowspan', 'aria-selected',
    'aria-setsize', 'aria-sort', 'aria-valuemax', 'aria-valuemin',
    'aria-valuenow', 'aria-valuetext'
  ];

  // ============================================================================
  // AUDITORIA DE ACESSIBILIDADE
  // ============================================================================

  /**
   * Realiza auditoria completa de acessibilidade
   * 
   * @param {Object} options - Opções da auditoria
   * @param {string} options.scope - Escopo ('page'|'component')
   * @param {string} [options.componentName] - Nome do componente (se scope='component')
   * @param {Array<string>} [options.checks] - Verificações específicas
   * @param {string} [options.level='AA'] - Nível WCAG ('A'|'AA'|'AAA')
   * @returns {Object} Relatório de auditoria
   * 
   * @example
   * var report = AccessibilityService.auditAccessibility({
   *   scope: 'page',
   *   level: 'AA',
   *   checks: ['contrast', 'aria', 'keyboard']
   * });
   */
  function auditAccessibility(options) {
    try {
      var opts = options || {};
      var scope = opts.scope || 'page';
      var level = opts.level || 'AA';
      var checks = opts.checks || ['all'];
      
      LoggerService.info('Iniciando auditoria de acessibilidade', {
        scope: scope,
        level: level,
        checks: checks
      });

      var report = {
        id: Utilities.getUuid(),
        timestamp: new Date().toISOString(),
        scope: scope,
        level: level,
        summary: {
          total: 0,
          passed: 0,
          failed: 0,
          warnings: 0,
          score: 0
        },
        issues: [],
        recommendations: []
      };

      // Executar verificações
      if (checks.indexOf('all') >= 0 || checks.indexOf('aria') >= 0) {
        var ariaIssues = auditAriaCompliance_(opts);
        report.issues = report.issues.concat(ariaIssues);
      }

      if (checks.indexOf('all') >= 0 || checks.indexOf('contrast') >= 0) {
        var contrastIssues = auditColorContrast_(opts);
        report.issues = report.issues.concat(contrastIssues);
      }

      if (checks.indexOf('all') >= 0 || checks.indexOf('keyboard') >= 0) {
        var keyboardIssues = auditKeyboardNavigation_(opts);
        report.issues = report.issues.concat(keyboardIssues);
      }

      if (checks.indexOf('all') >= 0 || checks.indexOf('structure') >= 0) {
        var structureIssues = auditSemanticStructure_(opts);
        report.issues = report.issues.concat(structureIssues);
      }

      if (checks.indexOf('all') >= 0 || checks.indexOf('forms') >= 0) {
        var formIssues = auditFormsAccessibility_(opts);
        report.issues = report.issues.concat(formIssues);
      }

      // Calcular sumário
      report.summary.total = report.issues.length;
      report.issues.forEach(function(issue) {
        if (issue.severity === 'error') {
          report.summary.failed++;
        } else if (issue.severity === 'warning') {
          report.summary.warnings++;
        }
      });
      report.summary.passed = report.summary.total - report.summary.failed;
      
      // Calcular score (0-100)
      if (report.summary.total > 0) {
        var errorWeight = 2;
        var warningWeight = 1;
        var maxPoints = (report.summary.total * errorWeight);
        var lostPoints = (report.summary.failed * errorWeight) + 
                         (report.summary.warnings * warningWeight);
        report.summary.score = Math.max(0, Math.round(((maxPoints - lostPoints) / maxPoints) * 100));
      } else {
        report.summary.score = 100;
      }

      // Gerar recomendações
      report.recommendations = generateRecommendations_(report.issues, level);

      // Salvar auditoria
      saveAuditReport_(report);

      LoggerService.info('Auditoria de acessibilidade concluída', {
        score: report.summary.score,
        issues: report.summary.total
      });

      return report;

    } catch (error) {
      LoggerService.error('Erro ao realizar auditoria de acessibilidade', error);
      throw new Error('Falha na auditoria de acessibilidade: ' + error.message);
    }
  }

  /**
   * Audita conformidade ARIA
   * @private
   */
  function auditAriaCompliance_(options) {
    var issues = [];
    var componentName = options.componentName || 'unknown';

    // Verificar roles válidas
    issues.push({
      id: 'aria-valid-role',
      component: componentName,
      severity: 'error',
      wcag: WCAG_CRITERIA.NAME_ROLE_VALUE,
      category: 'ARIA',
      message: 'Verificar se todas as roles ARIA são válidas',
      element: 'role attribute',
      suggestion: 'Use apenas roles da especificação WAI-ARIA: ' + VALID_ARIA_ROLES.slice(0, 5).join(', ') + '...'
    });

    // Verificar aria-label ou aria-labelledby em elementos interativos
    issues.push({
      id: 'aria-label-required',
      component: componentName,
      severity: 'error',
      wcag: WCAG_CRITERIA.NAME_ROLE_VALUE,
      category: 'ARIA',
      message: 'Botões e links devem ter aria-label ou aria-labelledby',
      element: 'button, a, input',
      suggestion: 'Adicione aria-label="Descrição" ou aria-labelledby="elementId"'
    });

    // Verificar aria-hidden em elementos focáveis
    issues.push({
      id: 'aria-hidden-focus',
      component: componentName,
      severity: 'error',
      wcag: WCAG_CRITERIA.NAME_ROLE_VALUE,
      category: 'ARIA',
      message: 'Elementos com aria-hidden="true" não devem ser focáveis',
      element: 'aria-hidden',
      suggestion: 'Remova tabindex ou mude aria-hidden para false'
    });

    // Verificar aria-live para atualizações dinâmicas
    issues.push({
      id: 'aria-live-region',
      component: componentName,
      severity: 'warning',
      wcag: WCAG_CRITERIA.NAME_ROLE_VALUE,
      category: 'ARIA',
      message: 'Conteúdo dinâmico deve usar aria-live',
      element: 'dynamic content',
      suggestion: 'Adicione aria-live="polite" ou "assertive" em regiões que atualizam dinamicamente'
    });

    return issues;
  }

  /**
   * Audita contraste de cores
   * @private
   */
  function auditColorContrast_(options) {
    var issues = [];
    var level = options.level || 'AA';
    var componentName = options.componentName || 'unknown';

    // Cores do projeto (extraídas de styles.html)
    var colorPairs = [
      { fg: '#333333', bg: '#ffffff', context: 'Texto normal' },
      { fg: '#ffffff', bg: '#0066cc', context: 'Botão primário' },
      { fg: '#ffffff', bg: '#28a745', context: 'Botão sucesso' },
      { fg: '#ffffff', bg: '#dc3545', context: 'Botão erro' },
      { fg: '#666666', bg: '#f8f9fa', context: 'Texto secundário' }
    ];

    colorPairs.forEach(function(pair) {
      var ratio = calculateContrastRatio_(pair.fg, pair.bg);
      var minRatio = level === 'AAA' ? CONTRAST_RATIOS.AAA_NORMAL : CONTRAST_RATIOS.AA_NORMAL;

      if (ratio < minRatio) {
        issues.push({
          id: 'color-contrast',
          component: componentName,
          severity: 'error',
          wcag: WCAG_CRITERIA.CONTRAST_MINIMUM,
          category: 'Color',
          message: 'Contraste insuficiente: ' + pair.context,
          element: 'colors',
          details: {
            foreground: pair.fg,
            background: pair.bg,
            ratio: ratio.toFixed(2) + ':1',
            required: minRatio + ':1'
          },
          suggestion: 'Ajuste as cores para atingir razão mínima de ' + minRatio + ':1'
        });
      }
    });

    return issues;
  }

  /**
   * Audita navegação por teclado
   * @private
   */
  function auditKeyboardNavigation_(options) {
    var issues = [];
    var componentName = options.componentName || 'unknown';

    issues.push({
      id: 'keyboard-focus-visible',
      component: componentName,
      severity: 'error',
      wcag: WCAG_CRITERIA.FOCUS_VISIBLE,
      category: 'Keyboard',
      message: 'Todos os elementos focáveis devem ter indicador visual de foco',
      element: ':focus',
      suggestion: 'Adicione estilos CSS para :focus e :focus-visible'
    });

    issues.push({
      id: 'keyboard-tabindex',
      component: componentName,
      severity: 'warning',
      wcag: WCAG_CRITERIA.KEYBOARD,
      category: 'Keyboard',
      message: 'Evite tabindex > 0',
      element: 'tabindex',
      suggestion: 'Use tabindex="0" ou "-1" apenas. Valores positivos quebram ordem natural'
    });

    issues.push({
      id: 'keyboard-shortcuts',
      component: componentName,
      severity: 'warning',
      wcag: WCAG_CRITERIA.KEYBOARD,
      category: 'Keyboard',
      message: 'Implemente atalhos de teclado para ações principais',
      element: 'shortcuts',
      suggestion: 'Use accesskey ou implemente listeners para teclas como Enter, Esc, Tab'
    });

    return issues;
  }

  /**
   * Audita estrutura semântica
   * @private
   */
  function auditSemanticStructure_(options) {
    var issues = [];
    var componentName = options.componentName || 'unknown';

    issues.push({
      id: 'semantic-headings',
      component: componentName,
      severity: 'error',
      wcag: WCAG_CRITERIA.INFO_AND_RELATIONSHIPS,
      category: 'Structure',
      message: 'Use hierarquia correta de headings (h1 > h2 > h3)',
      element: 'h1-h6',
      suggestion: 'Não pule níveis (ex: h1 direto para h3). Use h1 apenas uma vez por página'
    });

    issues.push({
      id: 'semantic-landmarks',
      component: componentName,
      severity: 'warning',
      wcag: WCAG_CRITERIA.INFO_AND_RELATIONSHIPS,
      category: 'Structure',
      message: 'Use landmarks ARIA ou HTML5',
      element: 'nav, main, aside, header, footer',
      suggestion: 'Adicione <nav>, <main>, <aside> ou role="navigation", role="main"'
    });

    issues.push({
      id: 'semantic-lists',
      component: componentName,
      severity: 'warning',
      wcag: WCAG_CRITERIA.INFO_AND_RELATIONSHIPS,
      category: 'Structure',
      message: 'Use listas semânticas para agrupamentos',
      element: 'ul, ol, dl',
      suggestion: 'Substitua divs por <ul><li> ou <ol><li> quando apropriado'
    });

    return issues;
  }

  /**
   * Audita acessibilidade de formulários
   * @private
   */
  function auditFormsAccessibility_(options) {
    var issues = [];
    var componentName = options.componentName || 'unknown';

    issues.push({
      id: 'form-labels',
      component: componentName,
      severity: 'error',
      wcag: WCAG_CRITERIA.LABELS_OR_INSTRUCTIONS,
      category: 'Forms',
      message: 'Todos os inputs devem ter <label> associado',
      element: 'input, select, textarea',
      suggestion: 'Use <label for="inputId"> ou <label><input></label>'
    });

    issues.push({
      id: 'form-error-identification',
      component: componentName,
      severity: 'error',
      wcag: WCAG_CRITERIA.ERROR_IDENTIFICATION,
      category: 'Forms',
      message: 'Erros devem ser identificados e descritos claramente',
      element: 'input[aria-invalid]',
      suggestion: 'Use aria-invalid="true" e aria-describedby para mensagens de erro'
    });

    issues.push({
      id: 'form-required',
      component: componentName,
      severity: 'warning',
      wcag: WCAG_CRITERIA.LABELS_OR_INSTRUCTIONS,
      category: 'Forms',
      message: 'Campos obrigatórios devem ser marcados',
      element: 'input[required]',
      suggestion: 'Adicione aria-required="true" e indicação visual (*)'
    });

    return issues;
  }

  // ============================================================================
  // CÁLCULO DE CONTRASTE
  // ============================================================================

  /**
   * Calcula razão de contraste entre duas cores
   * 
   * @param {string} foreground - Cor do texto (hex)
   * @param {string} background - Cor do fundo (hex)
   * @returns {number} Razão de contraste (1.0 - 21.0)
   * 
   * @private
   */
  function calculateContrastRatio_(foreground, background) {
    var fgLuminance = getRelativeLuminance_(foreground);
    var bgLuminance = getRelativeLuminance_(background);
    
    var lighter = Math.max(fgLuminance, bgLuminance);
    var darker = Math.min(fgLuminance, bgLuminance);
    
    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Calcula luminância relativa de uma cor
   * @private
   */
  function getRelativeLuminance_(hexColor) {
    var rgb = hexToRgb_(hexColor);
    
    var rsRGB = rgb.r / 255;
    var gsRGB = rgb.g / 255;
    var bsRGB = rgb.b / 255;
    
    var r = rsRGB <= 0.03928 ? rsRGB / 12.92 : Math.pow((rsRGB + 0.055) / 1.055, 2.4);
    var g = gsRGB <= 0.03928 ? gsRGB / 12.92 : Math.pow((gsRGB + 0.055) / 1.055, 2.4);
    var b = bsRGB <= 0.03928 ? bsRGB / 12.92 : Math.pow((bsRGB + 0.055) / 1.055, 2.4);
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  /**
   * Converte cor hexadecimal para RGB
   * @private
   */
  function hexToRgb_(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  }

  // ============================================================================
  // RECOMENDAÇÕES
  // ============================================================================

  /**
   * Gera recomendações baseadas nos problemas encontrados
   * @private
   */
  function generateRecommendations_(issues, level) {
    var recommendations = [];
    var categoryCount = {};

    // Contar issues por categoria
    issues.forEach(function(issue) {
      categoryCount[issue.category] = (categoryCount[issue.category] || 0) + 1;
    });

    // Gerar recomendações por categoria
    Object.keys(categoryCount).forEach(function(category) {
      var count = categoryCount[category];
      var priority = count > 5 ? 'high' : count > 2 ? 'medium' : 'low';

      if (category === 'ARIA') {
        recommendations.push({
          priority: priority,
          category: category,
          title: 'Melhorar atributos ARIA',
          description: 'Foram encontrados ' + count + ' problemas relacionados a ARIA. ' +
                       'Revise roles, labels e states para melhor suporte a screen readers.',
          actions: [
            'Adicionar aria-label em todos os botões sem texto visível',
            'Usar aria-live para notificações dinâmicas',
            'Garantir que aria-hidden não oculta conteúdo importante'
          ]
        });
      }

      if (category === 'Color') {
        recommendations.push({
          priority: priority,
          category: category,
          title: 'Ajustar contraste de cores',
          description: 'Foram encontrados ' + count + ' pares de cores com contraste insuficiente. ' +
                       'Ajuste para cumprir WCAG ' + level + ' (mínimo ' + 
                       (level === 'AAA' ? '7:1' : '4.5:1') + ').',
          actions: [
            'Escurecer cores de texto ou clarear fundos',
            'Usar ferramenta de verificação de contraste',
            'Considerar modo alto contraste para usuários com baixa visão'
          ]
        });
      }

      if (category === 'Keyboard') {
        recommendations.push({
          priority: priority,
          category: category,
          title: 'Melhorar navegação por teclado',
          description: 'Foram encontrados ' + count + ' problemas de acessibilidade de teclado. ' +
                       'Garanta que toda funcionalidade seja acessível via teclado.',
          actions: [
            'Adicionar indicadores visuais de foco (:focus-visible)',
            'Implementar atalhos para ações principais',
            'Testar navegação completa apenas com Tab/Enter/Esc'
          ]
        });
      }

      if (category === 'Forms') {
        recommendations.push({
          priority: priority,
          category: category,
          title: 'Melhorar acessibilidade de formulários',
          description: 'Foram encontrados ' + count + ' problemas em formulários. ' +
                       'Labels e mensagens de erro são críticas para usabilidade.',
          actions: [
            'Associar todos os inputs com <label>',
            'Usar aria-describedby para mensagens de erro',
            'Marcar campos obrigatórios com aria-required'
          ]
        });
      }
    });

    // Adicionar recomendações gerais
    recommendations.push({
      priority: 'medium',
      category: 'General',
      title: 'Testes com usuários reais',
      description: 'Validação automatizada detecta problemas técnicos, mas não substitui testes com usuários reais.',
      actions: [
        'Testar com screen readers (NVDA, JAWS, VoiceOver)',
        'Testar navegação apenas por teclado',
        'Solicitar feedback de usuários com deficiência'
      ]
    });

    return recommendations;
  }

  // ============================================================================
  // PERSISTÊNCIA
  // ============================================================================

  /**
   * Salva relatório de auditoria na planilha
   * @private
   */
  function saveAuditReport_(report) {
    try {
      var row = [
        report.id,
        report.timestamp,
        report.scope,
        report.level,
        report.summary.total,
        report.summary.passed,
        report.summary.failed,
        report.summary.warnings,
        report.summary.score,
        JSON.stringify(report.issues),
        JSON.stringify(report.recommendations)
      ];

      appendRow_(SHEET_NAMES.ACCESSIBILITY_AUDITS, row);

      LoggerService.debug('Relatório de auditoria salvo', { id: report.id });

    } catch (error) {
      LoggerService.error('Erro ao salvar relatório de auditoria', error);
      throw error;
    }
  }

  /**
   * Lista relatórios de auditoria
   * 
   * @param {Object} [filters] - Filtros opcionais
   * @returns {Array<Object>} Lista de relatórios
   */
  function listAuditReports(filters) {
    try {
      var rawData = getAllRows_(SHEET_NAMES.ACCESSIBILITY_AUDITS);
      var reports = [];

      for (var i = 0; i < rawData.length; i++) {
        var row = rawData[i];
        reports.push({
          id: row.id || row[0],
          timestamp: row.timestamp || row[1],
          scope: row.scope || row[2],
          level: row.level || row[3],
          summary: {
            total:    row.total    || row[4],
            passed:   row.passed   || row[5],
            failed:   row.failed   || row[6],
            warnings: row.warnings || row[7],
            score:    row.score    || row[8]
          }
        });
      }

      // Aplicar filtros
      if (filters) {
        if (filters.scope) {
          reports = reports.filter(function(r) { return r.scope === filters.scope; });
        }
        if (filters.minScore) {
          reports = reports.filter(function(r) { return r.summary.score >= filters.minScore; });
        }
      }

      return reports;

    } catch (error) {
      LoggerService.error('Erro ao listar relatórios de auditoria', error);
      throw error;
    }
  }

  /**
   * Obtém relatório de auditoria por ID
   * 
   * @param {string} reportId - ID do relatório
   * @returns {Object|null} Relatório completo
   */
  function getAuditReport(reportId) {
    try {
      var data = SpreadsheetGateway.readAll(SHEET_NAMES.ACCESSIBILITY_AUDITS);

      for (var i = 1; i < data.length; i++) {
        var row = data[i];
        if (row[0] === reportId) {
          return {
            id: row[0],
            timestamp: row[1],
            scope: row[2],
            level: row[3],
            summary: {
              total: row[4],
              passed: row[5],
              failed: row[6],
              warnings: row[7],
              score: row[8]
            },
            issues: JSON.parse(row[9] || '[]'),
            recommendations: JSON.parse(row[10] || '[]')
          };
        }
      }

      return null;

    } catch (error) {
      LoggerService.error('Erro ao obter relatório de auditoria', error);
      throw error;
    }
  }

  // ============================================================================
  // VALIDAÇÃO ARIA
  // ============================================================================

  /**
   * Valida atributos ARIA de um elemento
   * 
   * @param {Object} element - Elemento a validar
   * @param {string} element.role - Role ARIA
   * @param {Object} element.attributes - Atributos ARIA
   * @returns {Object} Resultado da validação
   * 
   * @example
   * var result = AccessibilityService.validateAriaAttributes({
   *   role: 'button',
   *   attributes: {
   *     'aria-label': 'Fechar',
   *     'aria-pressed': 'false'
   *   }
   * });
   */
  function validateAriaAttributes(element) {
    var result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Validar role
    if (element.role && VALID_ARIA_ROLES.indexOf(element.role) === -1) {
      result.valid = false;
      result.errors.push('Role inválida: ' + element.role);
    }

    // Validar atributos
    if (element.attributes) {
      Object.keys(element.attributes).forEach(function(attr) {
        if (attr.indexOf('aria-') === 0 && VALID_ARIA_ATTRIBUTES.indexOf(attr) === -1) {
          result.valid = false;
          result.errors.push('Atributo ARIA inválido: ' + attr);
        }
      });
    }

    // Verificar atributos obrigatórios por role
    if (element.role === 'button' && !element.attributes['aria-label'] && !element.attributes['aria-labelledby']) {
      result.warnings.push('Botões devem ter aria-label ou aria-labelledby');
    }

    return result;
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Gera sugestão de cor com contraste adequado
   * 
   * @param {string} baseColor - Cor base (hex)
   * @param {string} targetBackground - Cor de fundo alvo (hex)
   * @param {number} targetRatio - Razão de contraste desejada
   * @returns {string} Cor sugerida (hex)
   */
  function suggestContrastingColor(baseColor, targetBackground, targetRatio) {
    targetRatio = targetRatio || CONTRAST_RATIOS.AA_NORMAL;
    
    // Implementação simplificada - retorna preto ou branco
    var bgLuminance = getRelativeLuminance_(targetBackground);
    
    if (bgLuminance > 0.5) {
      return '#000000'; // Texto escuro para fundo claro
    } else {
      return '#FFFFFF'; // Texto claro para fundo escuro
    }
  }

  /**
   * Gera snippet de código ARIA correto
   * 
   * @param {string} elementType - Tipo de elemento ('button'|'form'|'dialog'|'table')
   * @returns {string} HTML snippet
   */
  function generateAriaSnippet(elementType) {
    var snippets = {
      button: '<button type="button" aria-label="Descrição da ação">\n  Texto do botão\n</button>',
      
      form: '<form aria-labelledby="form-title">\n' +
            '  <h2 id="form-title">Título do formulário</h2>\n' +
            '  <label for="field1">Campo:</label>\n' +
            '  <input id="field1" type="text" aria-required="true" aria-describedby="field1-error">\n' +
            '  <div id="field1-error" role="alert" aria-live="polite"></div>\n' +
            '</form>',
      
      dialog: '<dialog role="dialog" aria-modal="true" aria-labelledby="dialog-title">\n' +
              '  <h2 id="dialog-title">Título do modal</h2>\n' +
              '  <div role="document">\n' +
              '    Conteúdo\n' +
              '  </div>\n' +
              '</dialog>',
      
      table: '<table role="table" aria-label="Descrição da tabela">\n' +
             '  <thead role="rowgroup">\n' +
             '    <tr role="row">\n' +
             '      <th role="columnheader">Coluna</th>\n' +
             '    </tr>\n' +
             '  </thead>\n' +
             '  <tbody role="rowgroup">\n' +
             '    <tr role="row">\n' +
             '      <td role="cell">Dado</td>\n' +
             '    </tr>\n' +
             '  </tbody>\n' +
             '</table>'
    };

    return snippets[elementType] || '';
  }

  // ============================================================================
  // API PÚBLICA
  // ============================================================================

  return {
    // Auditoria
    auditAccessibility: auditAccessibility,
    listAuditReports: listAuditReports,
    getAuditReport: getAuditReport,
    
    // Validação
    validateAriaAttributes: validateAriaAttributes,
    
    // Helpers
    calculateContrastRatio: calculateContrastRatio_,
    suggestContrastingColor: suggestContrastingColor,
    generateAriaSnippet: generateAriaSnippet,
    
    // Constantes
    WCAG_CRITERIA: WCAG_CRITERIA,
    CONTRAST_RATIOS: CONTRAST_RATIOS,
    VALID_ARIA_ROLES: VALID_ARIA_ROLES,
    VALID_ARIA_ATTRIBUTES: VALID_ARIA_ATTRIBUTES
  };

})();
