/**
 * @fileoverview WebComponentsService - Gerenciamento de Web Components
 * 
 * @description
 * Registra, valida e gerencia Web Components customizados do sistema.
 * Fornece metadados, versionamento e catálogo de componentes.
 * 
 * FUNCIONALIDADES PRINCIPAIS:
 * - Registro de componentes
 * - Validação de custom elements
 * - Catálogo de componentes
 * - Versionamento
 * - Documentação automática
 * - Hot reload (desenvolvimento)
 * 
 * COMPONENTES DISPONÍVEIS:
 * - app-button: Botão acessível com estados
 * - app-input: Input com validação integrada
 * - app-modal: Modal/dialog acessível
 * - app-table: Tabela de dados avançada
 * - app-toast: Notificações toast
 * - app-badge: Badge/pill de status
 * - app-card: Card container
 * - app-spinner: Loading spinner
 * 
 * @author Sistema Canabica
 * @version 1.0.0
 * @since 2024-01-15
 */

/**
 * Namespace para serviço de Web Components
 * @namespace
 */
var WebComponentsService = (function() {
  'use strict';

  // ============================================================================
  // CONSTANTES
  // ============================================================================

  /**
   * Prefixo dos componentes
   * @const {string}
   */
  var COMPONENT_PREFIX = 'app-';

  /**
   * Versão do sistema de componentes
   * @const {string}
   */
  var COMPONENTS_VERSION = '1.0.0';

  /**
   * Catálogo de componentes registrados
   * @const {Object}
   */
  var COMPONENTS_CATALOG = {
    'app-button': {
      name: 'app-button',
      version: '1.0.0',
      category: 'Form',
      description: 'Botão acessível com estados (primary, secondary, danger)',
      props: ['variant', 'size', 'disabled', 'loading', 'icon'],
      events: ['click', 'focus', 'blur'],
      accessibility: 'WCAG 2.1 AA',
      file: 'web-components/app-button.html'
    },
    'app-input': {
      name: 'app-input',
      version: '1.0.0',
      category: 'Form',
      description: 'Input com validação integrada e estados de erro',
      props: ['type', 'label', 'placeholder', 'required', 'error', 'hint', 'disabled'],
      events: ['input', 'change', 'blur', 'focus'],
      accessibility: 'WCAG 2.1 AA',
      file: 'web-components/app-input.html'
    },
    'app-modal': {
      name: 'app-modal',
      version: '1.0.0',
      category: 'Overlay',
      description: 'Modal/dialog acessível com focus trap',
      props: ['open', 'title', 'size', 'closeOnEscape', 'closeOnBackdrop'],
      events: ['open', 'close', 'confirm', 'cancel'],
      accessibility: 'WCAG 2.1 AA',
      file: 'web-components/app-modal.html'
    },
    'app-table': {
      name: 'app-table',
      version: '1.0.0',
      category: 'Data Display',
      description: 'Tabela de dados com ordenação, paginação e seleção',
      props: ['columns', 'data', 'sortable', 'selectable', 'pagination'],
      events: ['sort', 'select', 'row-click', 'page-change'],
      accessibility: 'WCAG 2.1 AA',
      file: 'web-components/app-table.html'
    },
    'app-toast': {
      name: 'app-toast',
      version: '1.0.0',
      category: 'Feedback',
      description: 'Notificações toast não-bloqueantes',
      props: ['type', 'message', 'duration', 'position', 'closable'],
      events: ['show', 'hide', 'close'],
      accessibility: 'WCAG 2.1 AA',
      file: 'web-components/app-toast.html'
    },
    'app-badge': {
      name: 'app-badge',
      version: '1.0.0',
      category: 'Data Display',
      description: 'Badge/pill de status com cores semânticas',
      props: ['variant', 'size', 'dot', 'count'],
      events: [],
      accessibility: 'WCAG 2.1 AA',
      file: 'web-components/app-badge.html'
    },
    'app-card': {
      name: 'app-card',
      version: '1.0.0',
      category: 'Layout',
      description: 'Card container com header, body e footer',
      props: ['title', 'subtitle', 'bordered', 'hoverable'],
      events: ['click'],
      accessibility: 'WCAG 2.1 AA',
      file: 'web-components/app-card.html'
    },
    'app-spinner': {
      name: 'app-spinner',
      version: '1.0.0',
      category: 'Feedback',
      description: 'Loading spinner acessível',
      props: ['size', 'color', 'label'],
      events: [],
      accessibility: 'WCAG 2.1 AA',
      file: 'web-components/app-spinner.html'
    }
  };

  // ============================================================================
  // REGISTRO DE COMPONENTES
  // ============================================================================

  /**
   * Registra um componente no catálogo
   * 
   * @param {Object} componentDef - Definição do componente
   * @param {string} componentDef.name - Nome do componente (ex: 'app-button')
   * @param {string} componentDef.version - Versão do componente
   * @param {string} componentDef.category - Categoria
   * @param {string} componentDef.description - Descrição
   * @param {Array<string>} componentDef.props - Props aceitas
   * @param {Array<string>} componentDef.events - Eventos emitidos
   * @param {string} componentDef.file - Caminho do arquivo
   * @returns {Object} Resultado do registro
   */
  function registerComponent(componentDef) {
    try {
      // Validar nome
      if (!componentDef.name || !componentDef.name.startsWith(COMPONENT_PREFIX)) {
        throw new Error('Nome do componente deve começar com "' + COMPONENT_PREFIX + '"');
      }

      // Validar unicidade
      if (COMPONENTS_CATALOG[componentDef.name]) {
        LoggerService.warn('Componente já registrado, sobrescrevendo', { name: componentDef.name });
      }

      // Adicionar metadados
      componentDef.registeredAt = new Date().toISOString();
      componentDef.accessibility = componentDef.accessibility || 'WCAG 2.1 AA';

      // Salvar no catálogo
      COMPONENTS_CATALOG[componentDef.name] = componentDef;

      LoggerService.info('Componente registrado', { name: componentDef.name });

      return {
        success: true,
        component: componentDef.name
      };

    } catch (error) {
      LoggerService.error('Erro ao registrar componente', error);
      throw error;
    }
  }

  /**
   * Remove componente do catálogo
   * 
   * @param {string} componentName - Nome do componente
   * @returns {boolean} Sucesso da operação
   */
  function unregisterComponent(componentName) {
    try {
      if (!COMPONENTS_CATALOG[componentName]) {
        throw new Error('Componente não encontrado: ' + componentName);
      }

      delete COMPONENTS_CATALOG[componentName];

      LoggerService.info('Componente removido', { name: componentName });

      return true;

    } catch (error) {
      LoggerService.error('Erro ao remover componente', error);
      throw error;
    }
  }

  // ============================================================================
  // CATÁLOGO E LISTAGEM
  // ============================================================================

  /**
   * Lista todos os componentes registrados
   * 
   * @param {Object} filters - Filtros opcionais
   * @param {string} [filters.category] - Filtrar por categoria
   * @param {string} [filters.search] - Buscar por nome ou descrição
   * @returns {Array<Object>} Lista de componentes
   */
  function listComponents(filters) {
    try {
      filters = filters || {};
      var components = Object.values(COMPONENTS_CATALOG);

      // Filtrar por categoria
      if (filters.category) {
        components = components.filter(function(c) {
          return c.category === filters.category;
        });
      }

      // Buscar por texto
      if (filters.search) {
        var searchLower = filters.search.toLowerCase();
        components = components.filter(function(c) {
          return c.name.toLowerCase().indexOf(searchLower) >= 0 ||
                 c.description.toLowerCase().indexOf(searchLower) >= 0;
        });
      }

      return components;

    } catch (error) {
      LoggerService.error('Erro ao listar componentes', error);
      throw error;
    }
  }

  /**
   * Obtém detalhes de um componente
   * 
   * @param {string} componentName - Nome do componente
   * @returns {Object|null} Definição do componente
   */
  function getComponent(componentName) {
    return COMPONENTS_CATALOG[componentName] || null;
  }

  /**
   * Lista categorias disponíveis
   * 
   * @returns {Array<Object>} Categorias com contagem
   */
  function listCategories() {
    var categories = {};

    Object.values(COMPONENTS_CATALOG).forEach(function(component) {
      if (!categories[component.category]) {
        categories[component.category] = {
          name: component.category,
          count: 0,
          components: []
        };
      }
      categories[component.category].count++;
      categories[component.category].components.push(component.name);
    });

    return Object.values(categories);
  }

  // ============================================================================
  // VALIDAÇÃO
  // ============================================================================

  /**
   * Valida nome de custom element
   * 
   * @param {string} name - Nome a validar
   * @returns {Object} Resultado da validação
   */
  function validateCustomElementName(name) {
    var result = {
      valid: true,
      errors: []
    };

    // Deve conter hífen
    if (name.indexOf('-') === -1) {
      result.valid = false;
      result.errors.push('Nome deve conter hífen (ex: my-element)');
    }

    // Não pode começar com dígito
    if (/^\d/.test(name)) {
      result.valid = false;
      result.errors.push('Nome não pode começar com dígito');
    }

    // Apenas lowercase, dígitos e hífen
    if (!/^[a-z0-9-]+$/.test(name)) {
      result.valid = false;
      result.errors.push('Use apenas lowercase, dígitos e hífen');
    }

    // Não pode ser palavra reservada
    var reserved = [
      'annotation-xml', 'color-profile', 'font-face', 'font-face-src',
      'font-face-uri', 'font-face-format', 'font-face-name', 'missing-glyph'
    ];
    if (reserved.indexOf(name) >= 0) {
      result.valid = false;
      result.errors.push('Nome reservado: ' + name);
    }

    return result;
  }

  /**
   * Valida definição de componente
   * 
   * @param {Object} componentDef - Definição a validar
   * @returns {Object} Resultado da validação
   */
  function validateComponentDefinition(componentDef) {
    var result = {
      valid: true,
      errors: [],
      warnings: []
    };

    // Campos obrigatórios
    if (!componentDef.name) {
      result.valid = false;
      result.errors.push('Campo "name" é obrigatório');
    } else {
      var nameValidation = validateCustomElementName(componentDef.name);
      if (!nameValidation.valid) {
        result.valid = false;
        result.errors = result.errors.concat(nameValidation.errors);
      }
    }

    if (!componentDef.version) {
      result.warnings.push('Campo "version" recomendado');
    }

    if (!componentDef.description) {
      result.warnings.push('Campo "description" recomendado');
    }

    if (!componentDef.props || !Array.isArray(componentDef.props)) {
      result.warnings.push('Campo "props" deve ser array');
    }

    if (!componentDef.events || !Array.isArray(componentDef.events)) {
      result.warnings.push('Campo "events" deve ser array');
    }

    return result;
  }

  // ============================================================================
  // GERAÇÃO DE DOCUMENTAÇÃO
  // ============================================================================

  /**
   * Gera documentação de componente em Markdown
   * 
   * @param {string} componentName - Nome do componente
   * @returns {string} Documentação em Markdown
   */
  function generateComponentDocs(componentName) {
    var component = getComponent(componentName);
    if (!component) {
      throw new Error('Componente não encontrado: ' + componentName);
    }

    var docs = [];
    
    docs.push('# ' + component.name);
    docs.push('');
    docs.push('**Versão:** ' + component.version);
    docs.push('**Categoria:** ' + component.category);
    docs.push('**Acessibilidade:** ' + component.accessibility);
    docs.push('');
    docs.push('## Descrição');
    docs.push('');
    docs.push(component.description);
    docs.push('');

    // Props
    if (component.props && component.props.length > 0) {
      docs.push('## Props');
      docs.push('');
      docs.push('| Prop | Tipo | Padrão | Descrição |');
      docs.push('|------|------|--------|-----------|');
      component.props.forEach(function(prop) {
        docs.push('| `' + prop + '` | - | - | - |');
      });
      docs.push('');
    }

    // Events
    if (component.events && component.events.length > 0) {
      docs.push('## Eventos');
      docs.push('');
      docs.push('| Evento | Payload | Descrição |');
      docs.push('|--------|---------|-----------|');
      component.events.forEach(function(event) {
        docs.push('| `' + event + '` | - | - |');
      });
      docs.push('');
    }

    // Exemplo de uso
    docs.push('## Exemplo de Uso');
    docs.push('');
    docs.push('```html');
    docs.push('<' + component.name + '>');
    docs.push('  <!-- conteúdo -->');
    docs.push('</' + component.name + '>');
    docs.push('```');
    docs.push('');

    return docs.join('\n');
  }

  /**
   * Gera catálogo completo de componentes
   * 
   * @returns {string} Catálogo em Markdown
   */
  function generateCatalog() {
    var catalog = [];

    catalog.push('# Catálogo de Web Components');
    catalog.push('');
    catalog.push('**Versão:** ' + COMPONENTS_VERSION);
    catalog.push('**Total de Componentes:** ' + Object.keys(COMPONENTS_CATALOG).length);
    catalog.push('');

    // Por categoria
    var categories = listCategories();
    categories.forEach(function(category) {
      catalog.push('## ' + category.name + ' (' + category.count + ')');
      catalog.push('');

      category.components.forEach(function(componentName) {
        var component = getComponent(componentName);
        catalog.push('### `<' + component.name + '>`');
        catalog.push('');
        catalog.push(component.description);
        catalog.push('');
        catalog.push('**Props:** ' + (component.props.length > 0 ? component.props.join(', ') : 'Nenhuma'));
        catalog.push('**Eventos:** ' + (component.events.length > 0 ? component.events.join(', ') : 'Nenhum'));
        catalog.push('');
      });
    });

    return catalog.join('\n');
  }

  // ============================================================================
  // ESTATÍSTICAS
  // ============================================================================

  /**
   * Retorna estatísticas dos componentes
   * 
   * @returns {Object} Estatísticas
   */
  function getStatistics() {
    var components = Object.values(COMPONENTS_CATALOG);

    return {
      total: components.length,
      byCategory: listCategories().reduce(function(acc, cat) {
        acc[cat.name] = cat.count;
        return acc;
      }, {}),
      totalProps: components.reduce(function(sum, c) {
        return sum + (c.props ? c.props.length : 0);
      }, 0),
      totalEvents: components.reduce(function(sum, c) {
        return sum + (c.events ? c.events.length : 0);
      }, 0),
      version: COMPONENTS_VERSION
    };
  }

  // ============================================================================
  // UTILITÁRIOS
  // ============================================================================

  /**
   * Converte props para atributos HTML
   * 
   * @param {Object} props - Props do componente
   * @returns {string} String de atributos
   */
  function propsToAttributes(props) {
    return Object.keys(props || {}).map(function(key) {
      var value = props[key];
      
      // Boolean attributes
      if (typeof value === 'boolean') {
        return value ? key : '';
      }
      
      // String/Number attributes
      if (typeof value === 'string' || typeof value === 'number') {
        return key + '="' + value + '"';
      }
      
      // JSON attributes
      return key + "='" + JSON.stringify(value) + "'";
    }).filter(Boolean).join(' ');
  }

  /**
   * Gera snippet de componente
   * 
   * @param {string} componentName - Nome do componente
   * @param {Object} props - Props a incluir
   * @returns {string} HTML snippet
   */
  function generateSnippet(componentName, props) {
    var component = getComponent(componentName);
    if (!component) {
      throw new Error('Componente não encontrado: ' + componentName);
    }

    var attrs = propsToAttributes(props);
    return '<' + componentName + (attrs ? ' ' + attrs : '') + '></' + componentName + '>';
  }

  // ============================================================================
  // API PÚBLICA
  // ============================================================================

  return {
    // Registro
    registerComponent: registerComponent,
    unregisterComponent: unregisterComponent,
    
    // Catálogo
    listComponents: listComponents,
    getComponent: getComponent,
    listCategories: listCategories,
    
    // Validação
    validateCustomElementName: validateCustomElementName,
    validateComponentDefinition: validateComponentDefinition,
    
    // Documentação
    generateComponentDocs: generateComponentDocs,
    generateCatalog: generateCatalog,
    
    // Estatísticas
    getStatistics: getStatistics,
    
    // Utilitários
    propsToAttributes: propsToAttributes,
    generateSnippet: generateSnippet,
    
    // Constantes
    COMPONENT_PREFIX: COMPONENT_PREFIX,
    COMPONENTS_VERSION: COMPONENTS_VERSION,
    COMPONENTS_CATALOG: COMPONENTS_CATALOG
  };

})();
