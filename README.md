# Reserva Canabica

Webapp em Google Apps Script para apoiar a gestão do **cultivo e da atenção canábica**. A plataforma reúne registros agronômicos, qualidade e rastreabilidade, pesquisa e informações de acompanhamento em saúde relacionadas ao uso de cannabis.

> **Estágio atual: base funcional em consolidação.** O repositório contém fluxos e repositórios de domínio implementados, autenticação, controle de acesso, auditoria, CRUDs e uma interface em padronização. Ainda há integrações de frontend, fluxos clínicos e requisitos de segurança/compliance a concluir antes de qualquer uso produtivo com dados reais de saúde.

## Propósito

O produto não é centrado em uma única técnica de cultivo, insumo ou linha de pesquisa. Ele se organiza em quatro frentes complementares:

1. **Cultivo** — registro de plantas, fases, observações e parâmetros ambientais; manejo de substratos, insumos, protocolos biológicos e fertirrigação.
2. **Qualidade e rastreabilidade** — lotes, certificados de análise (CoA), validações de compatibilidade e auditoria dos registros.
3. **Atenção canábica** — cadastros de pacientes, prontuários, receitas, diário de doses e acompanhamento de sintomas, quando autorizado e aplicável ao fluxo assistencial.
4. **Pesquisa científica** — estudos, experimentos, evidências, referências, análises e integração com Google Colaboratory.

Trichoderma, formação de solo, fertilização e substratos inoculados são temas válidos nos módulos de manejo e pesquisa, mas são apenas parte do escopo: não definem a identidade nem o público do webapp.

## Estado de implementação

### Implementado no repositório

- Pipeline de requisições em Google Apps Script (`normalização → contexto → autenticação → autorização → roteamento → resposta`);
- Autenticação por sessão, perfis de acesso (RBAC), permissões e trilha de auditoria;
- Persistência em Google Sheets por meio de gateway, serviços, repositórios e validações;
- CRUDs e ações para usuários, estudos, experimentos, observações, insumos, lotes/CoA, receitas de fertirrigação, protocolos biológicos e pareceres de compatibilidade;
- Catálogo e análise de comorbidades canábicas, incluindo consultas de evidências e validação relacionada a CoA;
- Repositórios de domínio para pacientes, prontuários, receitas médicas, diário de doses, plantas e logs de cultivo;
- Dashboard, exportação, importação, fila de tarefas, cache, notificações, health checks e testes internos;
- Integração de análise com Google Colaboratory;
- Interface com tokens e componentes visuais em padronização.

### Em consolidação

- Conexão consistente entre todas as telas e os contratos atuais da API;
- Casca autenticada, navegação, textos de entrada e estados compartilhados do frontend;
- Fluxos completos de ponta a ponta para cultivo, qualidade, pacientes e atenção em saúde;
- Migração integral da biblioteca de ícones e ajustes de responsividade;
- Cobertura e execução contínua dos testes de integração e de interface;
- Normalização definitiva do contrato de paginação e das respostas de listagem.

### Não declarar como pronto para produção

Este projeto **não é** um dispositivo médico, um prontuário eletrônico certificado, um sistema de prescrição autônoma nem uma ferramenta de diagnóstico. Ele não substitui avaliação profissional, decisão clínica, prescrição por profissional habilitado, revisão científica, requisitos legais ou obrigações regulatórias.

Antes de tratar dados pessoais sensíveis ou apoiar processos assistenciais reais, é necessário concluir e validar, no mínimo:

- política de segurança para dados de saúde e aderência à LGPD;
- proteção adequada de credenciais, sessões, logs e dados armazenados;
- revisão das permissões e da rastreabilidade de acesso a prontuários;
- integração e validação do processo de assinatura/prescrição aplicável;
- homologação dos fluxos com equipes de cultivo, qualidade e atenção em saúde;
- testes de segurança, integração, acessibilidade e operação em ambiente de staging.

## Arquitetura

| Camada | Tecnologia e responsabilidade |
|---|---|
| Webapp | Google Apps Script, com `doGet`, `doPost` e ponte RPC para o frontend |
| Interface | Templates HTML, JavaScript e CSS servidos pelo `HtmlService` |
| Domínio | Serviços e repositórios para cultivo, qualidade, pesquisa e atenção canábica |
| Dados | Google Sheets identificado exclusivamente por `SPREADSHEETS_ID` |
| Controle de acesso | Autenticação de sessão, RBAC e permissões por ação |
| Auditoria e operação | Audit log, health checks, cache, filas, notificações e testes |
| Análise | Integração HTTP com Google Colaboratory e Google Drive opcional para resultados |

As ações disponíveis são explicitamente permitidas pelo roteador; toda nova ação deve ser incluída na whitelist, protegida por autenticação e, quando aplicável, pela permissão apropriada.

## Estrutura do domínio

```text
Cultivo
├── Plantas e logs de cultivo
├── Insumos, substratos e fertirrigação
├── Protocolos biológicos
└── Lotes e registros de qualidade

Atenção canábica
├── Pacientes e prontuários
├── Receitas médicas
├── Diário de doses e sintomas
└── Comorbidades, evidências e auditoria de CoA

Pesquisa
├── Estudos e experimentos
├── Observações e referências
├── Validações e pareceres
└── Análises com Colab
```

## Pré-requisitos

- Conta Google com acesso ao Google Apps Script, Google Sheets e Google Drive;
- Uma planilha Google destinada ao ambiente da aplicação;
- Projeto Apps Script configurado para usar o runtime V8;
- Permissões necessárias para planilhas, scripts, requisições externas, e-mail do usuário e leitura do Drive;
- Opcionalmente, uma pasta no Google Drive para armazenar resultados de análises.

## Configuração inicial

1. Crie ou conecte um projeto Google Apps Script.
2. Envie os arquivos `.gs`, `.html` e o [appsscript.json](appsscript.json) para o projeto.
3. Em **Project Settings → Script properties**, defina:

   | Propriedade | Obrigatória | Finalidade |
   |---|---:|---|
   | `SPREADSHEETS_ID` | Sim | ID da planilha usada pela aplicação |
   | `SESSION_TTL_HOURS` | Não | Duração da sessão; há valor padrão |
   | `ENABLE_AUDIT_LOG` | Não | Ativa ou desativa o log de auditoria |
   | `LOG_LEVEL` | Não | Nível de detalhamento dos logs |
   | `FOLDER_ID` | Não | Pasta do Drive para resultados de análises |

4. Execute `setupProject_()` uma vez no editor do Apps Script e conceda as autorizações solicitadas.
5. Verifique o relatório retornado pela função e execute o health check disponível no projeto.
6. Altere as credenciais iniciais criadas pelo setup antes de disponibilizar o ambiente a qualquer usuário.
7. Publique como Web App apenas em um ambiente controlado e valide os fluxos necessários em staging.

> **Segurança:** `PLAIN_TEXT_PASSWORDS` existe como compatibilidade de protótipo e não deve ser habilitado em ambientes com usuários ou dados reais. Não adicione senhas, tokens, dados de pacientes ou informações clínicas a código, logs, exemplos ou documentação.

## Desenvolvimento e validação

Antes de alterar um módulo:

1. Identifique a ação correspondente no [03_Router.gs](03_Router.gs) e a permissão exigida.
2. Preserve o fluxo `request context → autorização → serviço → repositório → resposta`.
3. Não acesse a planilha diretamente fora do gateway e dos repositórios apropriados.
4. Para mudanças de interface, mantenha a linguagem abrangente: “cultivo e atenção canábica”; termos técnicos específicos devem aparecer somente no módulo em que são pertinentes.
5. Execute os testes e health checks disponíveis antes do deploy.

Documentos de suporte e de compatibilidade do frontend estão em [.agents/](.agents/). O plano de padronização visual e de linguagem está em [aprimorar_frontend.md](aprimorar_frontend.md).

## Limites de uso

- Dados e resultados registrados pela aplicação exigem revisão humana qualificada.
- Registros de cultivo e qualidade não substituem controle de qualidade laboratorial, laudo técnico ou processo regulatório.
- Registros de atenção em saúde não substituem atendimento, prontuário certificado, prescrição legalmente válida, farmacovigilância ou decisão profissional.
- A configuração, as permissões e a retenção de dados são responsabilidades da organização que operar o ambiente.

## Autores

- Hélio Craveiro Pessoa Júnior
- Raphael Barbim Frankin Silva
- Alejandra Muniz Tarin Lafuente

## Licença e contribuição

Verifique as políticas e a licença aplicáveis antes de redistribuir, implantar ou conectar serviços de terceiros. Ao contribuir, mantenha mudanças pequenas, rastreáveis, testáveis e compatíveis com os controles de segurança e privacidade do projeto.
