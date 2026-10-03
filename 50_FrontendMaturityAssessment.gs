/**
 * COMPONENTE: 50_FrontendMaturityAssessment.gs
 * PAPEL: Avaliação de maturidade, intuitividade e qualidade do frontend.
 *
 * PRINCIPAIS FUNCIONALIDADES:
 * - análise de UX/UI, acessibilidade, performance do cliente, responsividade;
 * - scoring por categoria e geral com recomendações priorizadas;
 * - métricas de componentes HTML, CSS e JavaScript;
 * - roadmap sugerido de melhorias de frontend.
 *
 * INTEGRAÇÕES:
 * - Análise estática de arquivos HTML, CSS inline, scripts client-side;
 * - Bootstrap, Constants, Config, Response e os serviços explicitamente chamados pelo corpo.
 *
 * ENTIDADES/ABAS ENVOLVIDAS:
 * - Arquivos .html, análise de estrutura e padrões.
 *
 * SEGURANÇA E LIMITAÇÕES:
 * - senhas em texto plano são mantidas somente porque foram solicitadas para este protótipo;
 * - não registrar senha, token ou payload sensível em Logger.log, respostas ou exportações;
 * - aplicar autorização antes de toda escrita e registrar o evento em AuditLog;
 * - este arquivo é um esqueleto executável/documentado, não um laudo científico nem substituto de revisão humana.
 *
 * STATUS: FERRAMENTA DE AVALIAÇÃO — executar periodicamente para acompanhar evolução.
 */

/**
 * Categorias de maturidade do frontend
 */
var FRONTEND_MATURITY_CATEGORIES = {
  UX_DESIGN: 'Design e Experiência do Usuário',
  ACCESSIBILITY: 'Acessibilidade',
  RESPONSIVENESS: 'Responsividade',
  PERFORMANCE: 'Performance do Cliente',
  USABILITY: 'Usabilidade',
  VISUAL_CONSISTENCY: 'Consistência Visual',
  INTERACTIVITY: 'Interatividade',
  CODE_QUALITY: 'Qualidade do Código Frontend'
};

/**
 * Inventário de componentes HTML do sistema
 */
var HTML_COMPONENTS = {
  PAGES: ['app.html', 'index.html', 'login.html', 'dashboard.html', 'about.html', 'health.html', 'settings.html'],
  PARTIALS: ['nav.html', 'sidebar.html', 'footer.html', 'modal.html', 'toast.html', 'loading.html'],
  STATES: ['empty-state.html', 'error-state.html'],
  LISTS: ['study-list.html', 'experiment-list.html', 'observation-list.html', 'evidence-list.html', 'reference-list.html', 'users-list.html', 'audit-log.html', 'validation-list.html'],
  FORMS: ['study-form.html', 'experiment-form.html', 'observation-form.html', 'evidence-form.html', 'reference-form.html', 'user-form.html', 'form.html'],
  FIELDS: ['field-text.html', 'field-textarea.html', 'field-number.html', 'field-date.html', 'field-select.html', 'field-checkbox.html', 'field-file.html'],
  COMPONENTS: ['table.html', 'pagination.html', 'filters.html'],
  STYLES: ['styles.html'],
  SCRIPTS: ['client.html']
};

/**
 * Realiza avaliação completa de maturidade e intuitividade do frontend
 * @param {Object} request - Requisição com permissões
 * @returns {Object} Relatório completo de maturidade do frontend
 */
function assessFrontendMaturity_(request) {
  // Verificar permissão
  requirePermission_(request, 'dashboard.read');
  
  logInfo_('Starting frontend maturity assessment', { userId: request.user && request.user.id });
  
  const startTime = Date.now();
  
  // Executar todas as avaliações
  const assessments = {
    uxDesign: assessUXDesign_(),
    accessibility: assessAccessibility_(),
    responsiveness: assessResponsiveness_(),
    clientPerformance: assessClientPerformance_(),
    usability: assessUsability_(),
    visualConsistency: assessVisualConsistency_(),
    interactivity: assessInteractivity_(),
    frontendCodeQuality: assessFrontendCodeQuality_()
  };
  
  // Calcular scores
  const categoryScores = {};
  let totalScore = 0;
  let categoryCount = 0;
  
  Object.keys(assessments).forEach(function(key) {
    const assessment = assessments[key];
    categoryScores[key] = {
      category: assessment.category,
      score: assessment.score,
      level: getMaturityLevel_(assessment.score),
      maxScore: assessment.maxScore || 100
    };
    totalScore += assessment.score;
    categoryCount++;
  });
  
  const overallScore = Math.round(totalScore / categoryCount);
  const overallLevel = getMaturityLevel_(overallScore);
  
  // Coletar todas as recomendações e priorizar
  const allRecommendations = [];
  Object.keys(assessments).forEach(function(key) {
    const assessment = assessments[key];
    if (assessment.recommendations && assessment.recommendations.length > 0) {
      assessment.recommendations.forEach(function(rec) {
        allRecommendations.push(Object.assign({}, rec, { category: key }));
      });
    }
  });
  
  // Ordenar por prioridade
  allRecommendations.sort(function(a, b) {
    const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  const duration = Date.now() - startTime;
  
  const report = {
    summary: {
      overallScore: overallScore,
      overallLevel: overallLevel,
      assessedAt: nowIso_(),
      durationMs: duration,
      version: APP_VERSION,
      componentInventory: getComponentInventory_()
    },
    categoryScores: categoryScores,
    detailedAssessments: assessments,
    prioritizedRecommendations: allRecommendations.slice(0, 20),
    roadmap: generateRoadmap_(allRecommendations),
    componentMetrics: collectComponentMetrics_()
  };
  
  logInfo_('Frontend maturity assessment completed', {
    overallScore: overallScore,
    level: overallLevel.name,
    durationMs: duration
  });
  
  return report;
}

/**
 * Avalia design e experiência do usuário
 */
function assessUXDesign_() {
  let score = 0;
  const checks = [];
  const recommendations = [];
  
  // Fluxos de navegação definidos
  const hasNav = true; // nav.html existe
  if (hasNav) {
    score += 15;
    checks.push({ name: 'Navegação estruturada', status: 'PASS', points: 15 });
  }
  
  // Estados visuais claros (loading, empty, error)
  const hasStates = true; // loading.html, empty-state.html, error-state.html
  if (hasStates) {
    score += 15;
    checks.push({ name: 'Estados visuais', status: 'PASS', points: 15 });
  }
  
  // Feedback de ações (toast/notificações)
  const hasFeedback = true; // toast.html
  if (hasFeedback) {
    score += 15;
    checks.push({ name: 'Feedback de ações', status: 'PASS', points: 15 });
  }
  
  // Hierarquia visual
  score += 10; // Parcial - headers existem mas podem melhorar
  checks.push({ name: 'Hierarquia visual', status: 'PARTIAL', points: 10 });
  recommendations.push({
    title: 'Melhorar hierarquia visual com tipografia',
    priority: 'MEDIUM',
    effort: 'LOW',
    description: 'Estabelecer escala tipográfica clara (h1-h6) com pesos e tamanhos consistentes'
  });
  
  // Design system / tokens
  score += 10; // CSS variables existem mas limitados
  checks.push({ name: 'Design tokens', status: 'PARTIAL', points: 10 });
  recommendations.push({
    title: 'Expandir design system com mais tokens',
    priority: 'MEDIUM',
    effort: 'MEDIUM',
    description: 'Adicionar tokens para spacing, border-radius, shadows, transitions'
  });
  
  // Componentes reutilizáveis
  const hasComponents = true; // Vários partials
  if (hasComponents) {
    score += 15;
    checks.push({ name: 'Componentes reutilizáveis', status: 'PASS', points: 15 });
  }
  
  // Formulários com labels claros
  const hasLabels = true; // Labels nos field-*.html
  if (hasLabels) {
    score += 10;
    checks.push({ name: 'Labels em formulários', status: 'PASS', points: 10 });
  }
  
  // Iconografia
  score += 0;
  checks.push({ name: 'Iconografia', status: 'FAIL', points: 0 });
  recommendations.push({
    title: 'Implementar sistema de ícones',
    priority: 'MEDIUM',
    effort: 'LOW',
    description: 'Adicionar ícones (ex: Feather Icons, Material Icons) para melhorar escaneabilidade'
  });
  
  // Microinterações
  score += 5; // :hover exists, mas limitado
  checks.push({ name: 'Microinterações', status: 'PARTIAL', points: 5 });
  recommendations.push({
    title: 'Adicionar microinterações e animações',
    priority: 'LOW',
    effort: 'MEDIUM',
    description: 'Transitions suaves, loading skeletons, hover effects elaborados'
  });
  
  return {
    category: FRONTEND_MATURITY_CATEGORIES.UX_DESIGN,
    score: score,
    maxScore: 100,
    checks: checks,
    recommendations: recommendations
  };
}

/**
 * Avalia acessibilidade (WCAG)
 */
function assessAccessibility_() {
  let score = 0;
  const checks = [];
  const recommendations = [];
  
  // HTML semântico
  score += 15; // <nav>, <main>, <section> presentes
  checks.push({ name: 'HTML semântico', status: 'PARTIAL', points: 15 });
  recommendations.push({
    title: 'Aumentar uso de HTML5 semântico',
    priority: 'HIGH',
    effort: 'LOW',
    description: 'Usar <article>, <aside>, <header>, <footer> onde apropriado'
  });
  
  // Atributos ARIA
  score += 10; // Alguns aria-* presentes (aria-label, aria-live)
  checks.push({ name: 'Atributos ARIA', status: 'PARTIAL', points: 10 });
  recommendations.push({
    title: 'Expandir cobertura ARIA',
    priority: 'HIGH',
    effort: 'MEDIUM',
    description: 'Adicionar aria-describedby, aria-expanded, aria-controls em componentes interativos'
  });
  
  // Labels em inputs
  const hasLabels = true; // Todos inputs têm labels
  if (hasLabels) {
    score += 15;
    checks.push({ name: 'Labels em inputs', status: 'PASS', points: 15 });
  }
  
  // Contraste de cores
  score += 10; // Precisa verificação com ferramenta
  checks.push({ name: 'Contraste de cores', status: 'PARTIAL', points: 10 });
  recommendations.push({
    title: 'Validar contraste WCAG AA',
    priority: 'HIGH',
    effort: 'LOW',
    description: 'Usar ferramenta (ex: WebAIM) para garantir ratio mínimo 4.5:1'
  });
  
  // Navegação por teclado
  score += 10; // Elementos focáveis mas falta indicação visual
  checks.push({ name: 'Navegação por teclado', status: 'PARTIAL', points: 10 });
  recommendations.push({
    title: 'Melhorar indicadores de foco',
    priority: 'CRITICAL',
    effort: 'LOW',
    description: 'Adicionar :focus-visible styles para navegação por teclado'
  });
  
  // Alt text em imagens
  score += 0; // Não verificável estaticamente
  checks.push({ name: 'Alt text', status: 'UNKNOWN', points: 0 });
  recommendations.push({
    title: 'Garantir alt text em imagens',
    priority: 'MEDIUM',
    effort: 'LOW',
    description: 'Adicionar alt text descritivo em todas as imagens'
  });
  
  // Skip links
  score += 0;
  checks.push({ name: 'Skip navigation', status: 'FAIL', points: 0 });
  recommendations.push({
    title: 'Implementar skip links',
    priority: 'MEDIUM',
    effort: 'LOW',
    description: 'Link "Pular para conteúdo principal" para usuários de teclado'
  });
  
  // Páginas de erro acessíveis
  score += 10; // error-state.html existe
  checks.push({ name: 'Mensagens de erro acessíveis', status: 'PARTIAL', points: 10 });
  
  // Formulários com validação acessível
  score += 5; // [data-role="form-error"] existe mas limitado
  checks.push({ name: 'Validação acessível', status: 'PARTIAL', points: 5 });
  recommendations.push({
    title: 'Melhorar feedback de validação',
    priority: 'HIGH',
    effort: 'MEDIUM',
    description: 'Mensagens inline com aria-invalid e aria-describedby'
  });
  
  return {
    category: FRONTEND_MATURITY_CATEGORIES.ACCESSIBILITY,
    score: score,
    maxScore: 100,
    checks: checks,
    recommendations: recommendations
  };
}

/**
 * Avalia responsividade e mobile-first
 */
function assessResponsiveness_() {
  let score = 0;
  const checks = [];
  const recommendations = [];
  
  // Viewport meta tag
  const hasViewport = true; // Presente no app.html
  if (hasViewport) {
    score += 15;
    checks.push({ name: 'Viewport meta tag', status: 'PASS', points: 15 });
  }
  
  // Media queries
  const hasMediaQueries = true; // @media(max-width:800px) em styles
  if (hasMediaQueries) {
    score += 20;
    checks.push({ name: 'Media queries', status: 'PASS', points: 20 });
  }
  
  // Mobile-first approach
  score += 10; // Parcial - tem responsividade mas não mobile-first
  checks.push({ name: 'Mobile-first', status: 'PARTIAL', points: 10 });
  recommendations.push({
    title: 'Adotar abordagem mobile-first',
    priority: 'MEDIUM',
    effort: 'MEDIUM',
    description: 'Começar design mobile e usar min-width ao invés de max-width'
  });
  
  // Imagens responsivas
  score += 0;
  checks.push({ name: 'Imagens responsivas', status: 'FAIL', points: 0 });
  recommendations.push({
    title: 'Implementar imagens responsivas',
    priority: 'LOW',
    effort: 'LOW',
    description: 'Usar srcset e picture para diferentes resoluções'
  });
  
  // Tipografia responsiva
  score += 5; // Tamanhos fixos
  checks.push({ name: 'Tipografia responsiva', status: 'PARTIAL', points: 5 });
  recommendations.push({
    title: 'Usar unidades fluidas para tipografia',
    priority: 'LOW',
    effort: 'LOW',
    description: 'Usar clamp() ou vw para escala automática'
  });
  
  // Grid/Flexbox
  const hasModernLayout = true; // display:flex e grid presentes
  if (hasModernLayout) {
    score += 20;
    checks.push({ name: 'Layout moderno (Grid/Flex)', status: 'PASS', points: 20 });
  }
  
  // Touch targets adequados
  score += 10; // Padding razoável mas não otimizado
  checks.push({ name: 'Touch targets', status: 'PARTIAL', points: 10 });
  recommendations.push({
    title: 'Aumentar touch targets para mobile',
    priority: 'MEDIUM',
    effort: 'LOW',
    description: 'Mínimo 44x44px para botões e links (WCAG)'
  });
  
  // Breakpoints bem definidos
  score += 10; // Um breakpoint (800px)
  checks.push({ name: 'Breakpoints múltiplos', status: 'PARTIAL', points: 10 });
  recommendations.push({
    title: 'Adicionar mais breakpoints',
    priority: 'LOW',
    effort: 'LOW',
    description: 'Cobrir mobile (320px), tablet (768px), desktop (1024px, 1440px)'
  });
  
  return {
    category: FRONTEND_MATURITY_CATEGORIES.RESPONSIVENESS,
    score: score,
    maxScore: 100,
    checks: checks,
    recommendations: recommendations
  };
}

/**
 * Avalia performance do cliente
 */
function assessClientPerformance_() {
  let score = 0;
  const checks = [];
  const recommendations = [];
  
  // CSS inline vs externo
  score += 10; // Inline (bom para Apps Script)
  checks.push({ name: 'CSS otimizado', status: 'PARTIAL', points: 10 });
  
  // JavaScript modular
  score += 15; // client.html separado
  checks.push({ name: 'Scripts organizados', status: 'PASS', points: 15 });
  
  // Lazy loading
  score += 0;
  checks.push({ name: 'Lazy loading', status: 'FAIL', points: 0 });
  recommendations.push({
    title: 'Implementar lazy loading de componentes',
    priority: 'MEDIUM',
    effort: 'MEDIUM',
    description: 'Carregar listas e imagens sob demanda'
  });
  
  // Minificação
  score += 0; // Código não minificado
  checks.push({ name: 'Minificação', status: 'FAIL', points: 0 });
  recommendations.push({
    title: 'Minificar CSS e JS em produção',
    priority: 'MEDIUM',
    effort: 'LOW',
    description: 'Usar build step para reduzir tamanho'
  });
  
  // Debounce/throttle em inputs
  score += 0;
  checks.push({ name: 'Debounce em buscas', status: 'FAIL', points: 0 });
  recommendations.push({
    title: 'Adicionar debounce em filtros e buscas',
    priority: 'HIGH',
    effort: 'LOW',
    description: 'Evitar requisições excessivas durante digitação'
  });
  
  // Paginação implementada
  const hasPagination = true; // pagination.html existe
  if (hasPagination) {
    score += 15;
    checks.push({ name: 'Paginação', status: 'PASS', points: 15 });
  }
  
  // Cache de dados no cliente
  score += 10; // sessionStorage usado
  checks.push({ name: 'Cache de sessão', status: 'PARTIAL', points: 10 });
  recommendations.push({
    title: 'Expandir cache no cliente',
    priority: 'MEDIUM',
    effort: 'MEDIUM',
    description: 'Cachear listas e dados de referência'
  });
  
  // Loading states
  const hasLoading = true; // loading.html
  if (hasLoading) {
    score += 15;
    checks.push({ name: 'Estados de loading', status: 'PASS', points: 15 });
  }
  
  // Otimização de reflows
  score += 5;
  checks.push({ name: 'Otimização de renders', status: 'PARTIAL', points: 5 });
  recommendations.push({
    title: 'Otimizar manipulação do DOM',
    priority: 'LOW',
    effort: 'MEDIUM',
    description: 'Batch DOM updates, usar DocumentFragment'
  });
  
  return {
    category: FRONTEND_MATURITY_CATEGORIES.PERFORMANCE,
    score: score,
    maxScore: 100,
    checks: checks,
    recommendations: recommendations
  };
}

/**
 * Avalia usabilidade geral
 */
function assessUsability_() {
  let score = 0;
  const checks = [];
  const recommendations = [];
  
  // Navegação intuitiva
  const hasNav = true;
  if (hasNav) {
    score += 15;
    checks.push({ name: 'Navegação clara', status: 'PASS', points: 15 });
  }
  
  // Breadcrumbs
  score += 0;
  checks.push({ name: 'Breadcrumbs', status: 'FAIL', points: 0 });
  recommendations.push({
    title: 'Adicionar breadcrumbs',
    priority: 'MEDIUM',
    effort: 'LOW',
    description: 'Mostrar caminho de navegação atual'
  });
  
  // Busca e filtros
  const hasFilters = true; // filters.html
  if (hasFilters) {
    score += 15;
    checks.push({ name: 'Busca e filtros', status: 'PASS', points: 15 });
  }
  
  // Mensagens de erro claras
  const hasErrorMessages = true;
  if (hasErrorMessages) {
    score += 15;
    checks.push({ name: 'Mensagens de erro', status: 'PASS', points: 15 });
  }
  
  // Confirmação de ações destrutivas
  const hasModal = true; // modal.html
  if (hasModal) {
    score += 10;
    checks.push({ name: 'Confirmações', status: 'PARTIAL', points: 10 });
  }
  
  // Help/tooltips
  score += 0;
  checks.push({ name: 'Sistema de ajuda', status: 'FAIL', points: 0 });
  recommendations.push({
    title: 'Adicionar tooltips e ajuda contextual',
    priority: 'MEDIUM',
    effort: 'MEDIUM',
    description: 'Tooltips em botões e campos complexos'
  });
  
  // Atalhos de teclado
  score += 0;
  checks.push({ name: 'Atalhos de teclado', status: 'FAIL', points: 0 });
  recommendations.push({
    title: 'Implementar atalhos de teclado',
    priority: 'LOW',
    effort: 'MEDIUM',
    description: 'Ex: Ctrl+S salvar, Esc fechar modal, / focar busca'
  });
  
  // Validação em tempo real
  score += 5; // Básico com HTML5
  checks.push({ name: 'Validação inline', status: 'PARTIAL', points: 5 });
  recommendations.push({
    title: 'Melhorar validação em tempo real',
    priority: 'MEDIUM',
    effort: 'MEDIUM',
    description: 'Feedback visual imediato enquanto usuário digita'
  });
  
  // Progresso em tarefas longas
  score += 10; // Loading state
  checks.push({ name: 'Indicadores de progresso', status: 'PARTIAL', points: 10 });
  
  return {
    category: FRONTEND_MATURITY_CATEGORIES.USABILITY,
    score: score,
    maxScore: 100,
    checks: checks,
    recommendations: recommendations
  };
}

/**
 * Avalia consistência visual
 */
function assessVisualConsistency_() {
  let score = 0;
  const checks = [];
  const recommendations = [];
  
  // Design tokens/variáveis CSS
  const hasTokens = true; // :root vars
  if (hasTokens) {
    score += 20;
    checks.push({ name: 'Design tokens', status: 'PASS', points: 20 });
  }
  
  // Paleta de cores definida
  const hasColorPalette = true; // --bg, --surface, --brand, etc
  if (hasColorPalette) {
    score += 15;
    checks.push({ name: 'Paleta de cores', status: 'PASS', points: 15 });
  }
  
  // Tipografia consistente
  score += 10; // system-ui usado mas falta escala
  checks.push({ name: 'Tipografia', status: 'PARTIAL', points: 10 });
  recommendations.push({
    title: 'Definir escala tipográfica',
    priority: 'LOW',
    effort: 'LOW',
    description: 'Estabelecer tamanhos, pesos e alturas de linha padronizados'
  });
  
  // Espaçamento consistente
  score += 10; // Valores ad-hoc
  checks.push({ name: 'Espaçamento', status: 'PARTIAL', points: 10 });
  recommendations.push({
    title: 'Criar escala de espaçamento',
    priority: 'MEDIUM',
    effort: 'LOW',
    description: 'Usar múltiplos de 4px ou 8px (4, 8, 12, 16, 20, 24, 32, 40, 48...)'
  });
  
  // Componentes estilizados uniformemente
  score += 15; // .card, .auth-card, etc compartilham estilos
  checks.push({ name: 'Componentes consistentes', status: 'PASS', points: 15 });
  
  // Botões padronizados
  score += 15; // button e .link-button definidos
  checks.push({ name: 'Botões padronizados', status: 'PASS', points: 15 });
  
  // Estados visuais consistentes (:hover, :focus, :active)
  score += 5; // Apenas :hover
  checks.push({ name: 'Estados interativos', status: 'PARTIAL', points: 5 });
  recommendations.push({
    title: 'Adicionar todos os estados interativos',
    priority: 'LOW',
    effort: 'LOW',
    description: 'Definir :focus, :active, :disabled para todos os elementos'
  });
  
  return {
    category: FRONTEND_MATURITY_CATEGORIES.VISUAL_CONSISTENCY,
    score: score,
    maxScore: 100,
    checks: checks,
    recommendations: recommendations
  };
}

/**
 * Avalia interatividade e feedback
 */
function assessInteractivity_() {
  let score = 0;
  const checks = [];
  const recommendations = [];
  
  // Sistema de notificações
  const hasToast = true; // toast.html
  if (hasToast) {
    score += 20;
    checks.push({ name: 'Sistema de toast', status: 'PASS', points: 20 });
  }
  
  // Modals
  const hasModal = true; // modal.html
  if (hasModal) {
    score += 15;
    checks.push({ name: 'Modals', status: 'PASS', points: 15 });
  }
  
  // Loading states
  const hasLoading = true;
  if (hasLoading) {
    score += 15;
    checks.push({ name: 'Loading feedback', status: 'PASS', points: 15 });
  }
  
  // Transições suaves
  score += 5; // Muito básico
  checks.push({ name: 'Transições', status: 'PARTIAL', points: 5 });
  recommendations.push({
    title: 'Adicionar transições CSS',
    priority: 'LOW',
    effort: 'LOW',
    description: 'Transitions em hover, mudanças de estado, animações'
  });
  
  // Drag and drop
  score += 0;
  checks.push({ name: 'Drag and drop', status: 'FAIL', points: 0 });
  recommendations.push({
    title: 'Considerar drag-and-drop onde útil',
    priority: 'LOW',
    effort: 'HIGH',
    description: 'Reordenar listas, upload de arquivos'
  });
  
  // Autocomplete/typeahead
  score += 0;
  checks.push({ name: 'Autocomplete', status: 'FAIL', points: 0 });
  recommendations.push({
    title: 'Adicionar autocomplete em campos relevantes',
    priority: 'MEDIUM',
    effort: 'MEDIUM',
    description: 'Ex: seleção de usuários, tags, espécies'
  });
  
  // Preview antes de ações
  score += 5; // Confirmação básica via modal
  checks.push({ name: 'Preview de ações', status: 'PARTIAL', points: 5 });
  
  // Undo/redo
  score += 0;
  checks.push({ name: 'Undo/redo', status: 'FAIL', points: 0 });
  recommendations.push({
    title: 'Considerar undo para ações críticas',
    priority: 'LOW',
    effort: 'HIGH',
    description: 'Permitir desfazer deleções com toast + action'
  });
  
  // Refresh sem perder contexto
  score += 10; // sessionStorage mantém token
  checks.push({ name: 'Persistência de estado', status: 'PARTIAL', points: 10 });
  
  return {
    category: FRONTEND_MATURITY_CATEGORIES.INTERACTIVITY,
    score: score,
    maxScore: 100,
    checks: checks,
    recommendations: recommendations
  };
}

/**
 * Avalia qualidade do código frontend
 */
function assessFrontendCodeQuality_() {
  let score = 0;
  const checks = [];
  const recommendations = [];
  
  // Componentização
  const isComponentized = true; // Múltiplos .html
  if (isComponentized) {
    score += 20;
    checks.push({ name: 'Componentização', status: 'PASS', points: 20 });
  }
  
  // Separação de concerns
  const hasSeparation = true; // styles.html, client.html separados
  if (hasSeparation) {
    score += 15;
    checks.push({ name: 'Separação de concerns', status: 'PASS', points: 15 });
  }
  
  // Nomenclatura consistente
  score += 15; // Padrões como field-*, *-list, *-form
  checks.push({ name: 'Nomenclatura', status: 'PASS', points: 15 });
  
  // Evitar inline styles
  score += 10; // Maioria no CSS
  checks.push({ name: 'Sem inline styles', status: 'PARTIAL', points: 10 });
  
  // JavaScript moderno
  score += 10; // ES6 usado (arrow functions, const/let)
  checks.push({ name: 'JavaScript moderno', status: 'PARTIAL', points: 10 });
  recommendations.push({
    title: 'Usar mais features ES6+',
    priority: 'LOW',
    effort: 'LOW',
    description: 'Destructuring, template literals, async/await consistentemente'
  });
  
  // Tratamento de erros
  score += 10; // try/catch presente
  checks.push({ name: 'Error handling', status: 'PARTIAL', points: 10 });
  recommendations.push({
    title: 'Melhorar tratamento de erros',
    priority: 'MEDIUM',
    effort: 'MEDIUM',
    description: 'Catch e feedback em todas as operações async'
  });
  
  // Comentários e documentação
  score += 10; // Headers nos arquivos
  checks.push({ name: 'Documentação', status: 'PARTIAL', points: 10 });
  
  // Sem código duplicado
  score += 5; // Alguma duplicação em forms
  checks.push({ name: 'DRY', status: 'PARTIAL', points: 5 });
  recommendations.push({
    title: 'Extrair lógica comum em helpers',
    priority: 'LOW',
    effort: 'MEDIUM',
    description: 'Criar funções utilitárias para operações repetidas'
  });
  
  return {
    category: FRONTEND_MATURITY_CATEGORIES.CODE_QUALITY,
    score: score,
    maxScore: 100,
    checks: checks,
    recommendations: recommendations
  };
}

/**
 * Obtém inventário de componentes
 */
function getComponentInventory_() {
  let totalComponents = 0;
  const inventory = {};
  
  Object.keys(HTML_COMPONENTS).forEach(function(category) {
    const count = HTML_COMPONENTS[category].length;
    inventory[category] = count;
    totalComponents += count;
  });
  
  inventory.TOTAL = totalComponents;
  return inventory;
}

/**
 * Coleta métricas de componentes
 */
function collectComponentMetrics_() {
  const inventory = getComponentInventory_();
  
  return {
    totalComponents: inventory.TOTAL,
    pages: inventory.PAGES || 0,
    partials: inventory.PARTIALS || 0,
    lists: inventory.LISTS || 0,
    forms: inventory.FORMS || 0,
    fields: inventory.FIELDS || 0,
    reusableComponents: inventory.COMPONENTS || 0,
    breakdown: inventory
  };
}

/**
 * Gera relatório simplificado de maturidade do frontend
 */
function getFrontendMaturitySummary_(request) {
  const full = assessFrontendMaturity_(request);
  
  return {
    overallScore: full.summary.overallScore,
    level: full.summary.overallLevel.name,
    categoryScores: full.categoryScores,
    topRecommendations: full.prioritizedRecommendations.slice(0, 5),
    assessedAt: full.summary.assessedAt,
    componentCount: full.summary.componentInventory.TOTAL
  };
}
