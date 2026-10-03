# %% [markdown]
# # 🩺 Notebook Médico NEON — Reserva Canábica
#
# Análises estatísticas sobre comorbidades, protocolos, pareceres e receitas
# com **estética neon cyberpunk** (fundo preto + laranja/rosa/verde/roxo).
#
# **Pré-requisitos (Google Colab):**
# ```
# !pip install requests matplotlib seaborn pandas numpy scipy wordcloud --quiet
# ```
#
# **Configuração obrigatória:**
# - `APPS_SCRIPT_WEB_APP_URL` — URL do Web App do Apps Script
# - `FOLDER_ID` — ID da pasta do Google Drive para salvar os PNGs

# %% — Instalação
# !pip install requests matplotlib seaborn pandas numpy scipy wordcloud --quiet

# %% — Imports e configuração
import io
import json
import os
from collections import Counter
from datetime import datetime
from getpass import getpass
from typing import Any, Dict, List, Optional

import matplotlib
import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from matplotlib.gridspec import GridSpec

# Wordcloud para nuvem de comorbidades/terpenos
try:
    from wordcloud import WordCloud
except ImportError:
    WordCloud = None

# 🎨 ESTÉTICA NEON (cyberpunk/futurista)
sns.set_theme(style="dark")
matplotlib.rcParams.update({
    "figure.dpi": 150,
    "figure.facecolor": "#000000",
    "axes.facecolor": "#0a0a0a",
    "axes.edgecolor": "#00ff41",
    "axes.titlesize": 14,
    "axes.labelsize": 11,
    "axes.titleweight": "bold",
    "axes.labelcolor": "#00ff41",
    "xtick.labelsize": 9,
    "ytick.labelsize": 9,
    "xtick.color": "#00ff41",
    "ytick.color": "#00ff41",
    "legend.fontsize": 9,
    "legend.facecolor": "#0a0a0a",
    "legend.edgecolor": "#00ff41",
    "text.color": "#00ff41",
    "grid.color": "#1a1a1a",
    "grid.alpha": 0.3,
})

APPS_SCRIPT_WEB_APP_URL: str = os.getenv("APPS_SCRIPT_WEB_APP_URL", "COLE_A_URL_DO_WEB_APP_AQUI")
FOLDER_ID: str = os.getenv("FOLDER_ID", "COLE_O_ID_DA_PASTA_DO_DRIVE_AQUI")
REQUEST_TIMEOUT_SECONDS: int = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "30"))

_session_token: Optional[str] = None
_current_user: Optional[Dict[str, Any]] = None

# Paleta NEON (4 cores principais: laranja, rosa choque, verde cana, roxo)
CORES = {
    "neon_verde":    "#00ff41",  # Verde cana neon (principal)
    "neon_laranja":  "#ff6600",  # Laranja elétrico
    "neon_rosa":     "#ff0080",  # Rosa choque
    "neon_roxo":     "#9d00ff",  # Roxo neon
    "neon_amarelo":  "#ffff00",  # Amarelo neon (acentos)
    "cinza_escuro":  "#1a1a1a",  # Cinza para fundos
    "branco_neon":   "#e0e0e0",  # Branco suavizado
}

# %% — Camada de comunicação
import requests as _requests

def _post(action: str, payload: Optional[Dict[str, Any]] = None) -> Any:
    if APPS_SCRIPT_WEB_APP_URL.startswith("COLE_"):
        raise RuntimeError("Defina APPS_SCRIPT_WEB_APP_URL.")
    body = {"action": action, **(payload or {})}
    if _session_token:
        body["token"] = _session_token
    resp = _requests.post(APPS_SCRIPT_WEB_APP_URL, json=body, timeout=REQUEST_TIMEOUT_SECONDS)
    resp.raise_for_status()
    data = resp.json()
    if not data.get("ok"):
        err = data.get("error", {})
        raise RuntimeError(f"API error {err.get('code','UNKNOWN')}: {err.get('message','Falha')}")
    return data.get("data")

def ping() -> Dict[str, Any]:
    return _post("system.ping")

def login(username: Optional[str] = None, password: Optional[str] = None) -> Dict[str, Any]:
    global _session_token, _current_user
    username = username or input("Usuário: ")
    password = password if password is not None else getpass("Senha: ")
    result = _post("auth.login", {"username": username, "password": password})
    _session_token = result["session"]["token"]
    _current_user = result["user"]
    print(f"✅ Autenticado como {_current_user.get('name', username)} ({_current_user.get('role')})")
    return {"user": _current_user, "expiresAt": result["session"]["expiresAt"]}

def logout() -> Dict[str, Any]:
    global _session_token, _current_user
    result = _post("auth.logout") if _session_token else {"loggedOut": True}
    _session_token, _current_user = None, None
    return result

# %% — Persistência no Drive
def _autenticar_drive():
    try:
        from google.colab import auth
        from googleapiclient.discovery import build
        auth.authenticate_user()
        return build("drive", "v3")
    except ImportError:
        print("⚠️  google-colab não disponível. PNGs serão salvos localmente.")
        return None

def salvar_png_no_drive(fig: plt.Figure, nome_arquivo: str, folder_id: str, drive_service: Any = None) -> Optional[str]:
    if not nome_arquivo.endswith(".png"):
        nome_arquivo += ".png"
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight", facecolor="#000000")
    buf.seek(0)
    if drive_service is None:
        drive_service = _autenticar_drive()
    if drive_service is not None:
        try:
            from googleapiclient.http import MediaIoBaseUpload
            file_metadata = {"name": nome_arquivo, "parents": [folder_id]}
            media = MediaIoBaseUpload(buf, mimetype="image/png", resumable=True)
            uploaded = drive_service.files().create(body=file_metadata, media_body=media, fields="id,webViewLink").execute()
            url = uploaded.get("webViewLink", "")
            print(f"📁 Salvo no Drive: {nome_arquivo}  →  {url}")
            return url
        except Exception as e:
            print(f"⚠️  Falha no upload para o Drive: {e}")
    local_path = f"/tmp/{nome_arquivo}"
    with open(local_path, "wb") as f:
        f.write(buf.getvalue())
    print(f"💾 Salvo localmente: {local_path}")
    return local_path

def salvar_todos_os_pngs(figuras: Dict[str, plt.Figure], folder_id: str) -> Dict[str, str]:
    drive_service = _autenticar_drive()
    urls: Dict[str, str] = {}
    for nome, fig in figuras.items():
        url = salvar_png_no_drive(fig, nome, folder_id, drive_service)
        if url:
            urls[nome] = url
    return urls

# %% — Funções de busca de dados médicos
def fetch_comorbidades_pacientes(filters: Optional[Dict] = None) -> pd.DataFrame:
    raw = _post("comorbidade.listar", {"filters": filters or {}})
    records = raw if isinstance(raw, list) else raw.get("comorbidades", raw.get("records", []))
    df = pd.DataFrame(records)
    for col in ["prioridade", "comorbidade_id", "total_evidencias"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df

def fetch_prontuarios(filters: Optional[Dict] = None) -> pd.DataFrame:
    raw = _post("prontuarios.list", {"filters": filters or {}})
    records = raw if isinstance(raw, list) else raw.get("prontuarios", raw.get("records", []))
    return pd.DataFrame(records)

def fetch_pareceres(filters: Optional[Dict] = None) -> pd.DataFrame:
    raw = _post("pareceres.list", {"filters": filters or {}})
    records = raw if isinstance(raw, list) else raw.get("pareceres", raw.get("records", []))
    return pd.DataFrame(records)

def fetch_receitas_fitoterapicas(filters: Optional[Dict] = None) -> pd.DataFrame:
    raw = _post("receitas_fitoterapicas.list", {"filters": filters or {}})
    records = raw if isinstance(raw, list) else raw.get("receitas", raw.get("records", []))
    df = pd.DataFrame(records)
    for col in ["dosagem_valor_num", "volume_total_ml"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df

def fetch_comorbidades_catalogo() -> pd.DataFrame:
    raw = _post("comorbidade.catalogo", {})
    records = raw if isinstance(raw, list) else raw.get("catalogo", raw.get("records", []))
    return pd.DataFrame(records)

# %% — GRÁFICOS MÉDICOS (12 ANÁLISES)

# 🎯 FRONTEND: Dashboard principal > Card "Comorbidades Atendidas"
def grafico_top_comorbidades(df_pacientes_comorbidades: pd.DataFrame) -> plt.Figure:
    """Bar horizontal NEON: top 10 comorbidades mais frequentes."""
    col_nome = next((c for c in ["nome_terapeutica", "nome_comorbidade", "nome"] if c in df_pacientes_comorbidades.columns), None)
    if col_nome is None:
        fig, ax = plt.subplots(figsize=(10, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Coluna 'nome' ausente", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig

    contagem = df_pacientes_comorbidades[col_nome].value_counts().head(10)
    fig, ax = plt.subplots(figsize=(11, 7), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    bars = ax.barh([str(v)[:40] for v in contagem.index], contagem.values,
                   color=CORES["neon_rosa"], edgecolor=CORES["branco_neon"], linewidth=1.5, alpha=0.9)
    for bar, val in zip(bars, contagem.values):
        ax.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height() / 2, str(val),
                va="center", ha="left", color=CORES["neon_amarelo"], fontsize=10, fontweight="bold")
    ax.set_title("🩺 Top 10 Comorbidades Mais Frequentes", color=CORES["neon_verde"], fontweight="bold", pad=15)
    ax.set_xlabel("Número de Pacientes", color=CORES["neon_verde"])
    ax.grid(axis="x", color=CORES["cinza_escuro"], alpha=0.3)
    for spine in ax.spines.values():
        spine.set_edgecolor(CORES["neon_verde"])
        spine.set_linewidth(1.5)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Protocolos" > Card "Evidência Científica"
def grafico_distribuicao_triagem(df_catalogo: pd.DataFrame) -> plt.Figure:
    """Pie chart NEON: distribuição por triagem científica (A/B/C/D/E)."""
    col_triagem = "triagem" if "triagem" in df_catalogo.columns else None
    if col_triagem is None:
        fig, ax = plt.subplots(figsize=(8, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Coluna 'triagem' ausente", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig

    contagem = df_catalogo[col_triagem].value_counts()
    cores_triagem = {
        "A": CORES["neon_verde"],
        "B": CORES["neon_laranja"],
        "C": CORES["neon_amarelo"],
        "D": CORES["neon_rosa"],
        "E": CORES["neon_roxo"],
    }
    cores = [cores_triagem.get(str(t).upper(), CORES["cinza_escuro"]) for t in contagem.index]

    fig, ax = plt.subplots(figsize=(9, 7), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    wedges, texts, autotexts = ax.pie(
        contagem.values,
        labels=[f"{t} ({v})" for t, v in zip(contagem.index, contagem.values)],
        autopct="%1.1f%%",
        startangle=90,
        colors=cores,
        textprops={"fontsize": 10, "color": CORES["branco_neon"], "weight": "bold"},
        wedgeprops={"edgecolor": "#000000", "linewidth": 2},
    )
    for autotext in autotexts:
        autotext.set_color("#000000")
    ax.set_title("📊 Distribuição por Triagem Científica\n(Grau de Evidência)", color=CORES["neon_verde"], fontweight="bold", pad=20)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Protocolos" > Seção "Grau CoA × Prioridade"
def grafico_grau_coa_por_prioridade_stacked(df_pacientes_comorbidades: pd.DataFrame) -> plt.Figure:
    """Stacked bar NEON: grau CoA × prioridade de comorbidade."""
    col_prioridade = "prioridade" if "prioridade" in df_pacientes_comorbidades.columns else None
    col_grau = next((c for c in ["grau_coa_obrigatorio", "grau_coa"] if c in df_pacientes_comorbidades.columns), None)
    if col_prioridade is None or col_grau is None:
        fig, ax = plt.subplots(figsize=(10, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Colunas 'prioridade' ou 'grau_coa' ausentes", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig

    df_plot = df_pacientes_comorbidades[[col_prioridade, col_grau]].dropna()
    cross = pd.crosstab(df_plot[col_prioridade], df_plot[col_grau])

    cores_grau = {
        "GRAU_1_ESTRITO":          CORES["neon_roxo"],
        "GRAU_2_PADRAO":           CORES["neon_verde"],
        "GRAU_3_NEUROPSIQUIATRICO":CORES["neon_rosa"],
        "GRAU_4_TOPICO":           CORES["neon_laranja"],
    }
    cores_plot = [cores_grau.get(col, CORES["cinza_escuro"]) for col in cross.columns]

    fig, ax = plt.subplots(figsize=(11, 6), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    cross.plot(kind="bar", stacked=True, ax=ax, color=cores_plot, edgecolor="#000000", linewidth=1.5, width=0.7)
    ax.set_title("🛡️  Grau de CoA Exigido por Prioridade", color=CORES["neon_verde"], fontweight="bold", pad=15)
    ax.set_xlabel("Prioridade (1º = mais importante)", color=CORES["neon_verde"])
    ax.set_ylabel("Quantidade de Pacientes", color=CORES["neon_verde"])
    ax.legend(title="Grau CoA", bbox_to_anchor=(1.05, 1), loc="upper left", fontsize=8,
              facecolor="#0a0a0a", edgecolor=CORES["neon_verde"])
    ax.tick_params(axis="x", rotation=0)
    ax.grid(axis="y", color=CORES["cinza_escuro"], alpha=0.3)
    for spine in ax.spines.values():
        spine.set_edgecolor(CORES["neon_verde"])
        spine.set_linewidth(1.5)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Protocolos" > Card "Quimiotipos Sugeridos"
def grafico_quimiotipos_sugeridos(df_pacientes_comorbidades: pd.DataFrame) -> plt.Figure:
    """Pie chart NEON: quimiotipos sugeridos."""
    col_quim = next((c for c in ["quimiotipo_sugerido", "quimiotipo"] if c in df_pacientes_comorbidades.columns), None)
    if col_quim is None:
        fig, ax = plt.subplots(figsize=(8, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Coluna 'quimiotipo' ausente", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig

    contagem = df_pacientes_comorbidades[col_quim].value_counts()
    cores_quim = {
        "TIPO_I_THC":        CORES["neon_laranja"],
        "TIPO_II_EQUILIBRADO":CORES["neon_verde"],
        "TIPO_III_CBD":      CORES["neon_rosa"],
        "TIPO_IV_CBG":       CORES["neon_roxo"],
    }
    cores = [cores_quim.get(str(q), CORES["cinza_escuro"]) for q in contagem.index]

    fig, ax = plt.subplots(figsize=(9, 7), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    wedges, texts, autotexts = ax.pie(
        contagem.values,
        labels=[f"{str(q).replace('_',' ')} ({v})" for q, v in zip(contagem.index, contagem.values)],
        autopct="%1.1f%%",
        startangle=45,
        colors=cores,
        textprops={"fontsize": 9, "color": CORES["branco_neon"], "weight": "bold"},
        wedgeprops={"edgecolor": "#000000", "linewidth": 2},
    )
    for autotext in autotexts:
        autotext.set_color("#000000")
    ax.set_title("🧬 Quimiotipos Sugeridos (THC, CBD, Equilíbrio, CBG)", color=CORES["neon_verde"], fontweight="bold", pad=20)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Protocolos" > Modal "Terpenos Focalizados"
def grafico_nuvem_terpenos(df_pacientes_comorbidades: pd.DataFrame) -> plt.Figure:
    """Word cloud NEON: terpenos focalizados."""
    if WordCloud is None:
        fig, ax = plt.subplots(figsize=(10, 5), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "wordcloud não instalado (pip install wordcloud)", ha="center", va="center",
                color=CORES["neon_verde"], fontsize=12)
        return fig

    col_terpenos = next((c for c in ["terpenos_focalizados", "terpenos"] if c in df_pacientes_comorbidades.columns), None)
    if col_terpenos is None:
        fig, ax = plt.subplots(figsize=(10, 5), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Coluna 'terpenos' ausente", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig

    todas_terps = []
    for t in df_pacientes_comorbidades[col_terpenos].dropna():
        terps = [x.strip() for x in str(t).replace(",", " ").replace(";", " ").split()]
        todas_terps.extend(terps)

    if not todas_terps:
        fig, ax = plt.subplots(figsize=(10, 5), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Nenhum terpeno encontrado", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig

    freq = Counter(todas_terps)
    # Colormap customizada (rosa → verde)
    from matplotlib.colors import LinearSegmentedColormap
    cores_cmap = [CORES["neon_rosa"], CORES["neon_verde"]]
    cmap_custom = LinearSegmentedColormap.from_list("neon", cores_cmap)
    
    wc = WordCloud(
        width=1000, height=500,
        background_color="#0a0a0a",
        colormap=cmap_custom,
        relative_scaling=0.5,
        min_font_size=10,
    ).generate_from_frequencies(freq)

    fig, ax = plt.subplots(figsize=(12, 6), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    ax.imshow(wc, interpolation="bilinear")
    ax.axis("off")
    ax.set_title("🌿 Terpenos Focalizados Mais Frequentes", color=CORES["neon_verde"], fontweight="bold", pad=15)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Receitas" > Card "Vias de Administração"
def grafico_via_administracao(df_receitas: pd.DataFrame) -> plt.Figure:
    """Bar chart NEON: distribuição por via de administração."""
    col_via = next((c for c in ["via_administracao", "via"] if c in df_receitas.columns), None)
    if col_via is None:
        fig, ax = plt.subplots(figsize=(10, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Coluna 'via_administracao' ausente", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig

    contagem = df_receitas[col_via].value_counts()
    cores_vias = [CORES["neon_verde"], CORES["neon_laranja"], CORES["neon_rosa"], CORES["neon_roxo"]]
    
    fig, ax = plt.subplots(figsize=(10, 6), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    bars = ax.bar(
        [str(v).capitalize() for v in contagem.index],
        contagem.values,
        color=cores_vias[:len(contagem)],
        edgecolor=CORES["branco_neon"],
        linewidth=1.5,
        alpha=0.9,
    )
    for bar, val in zip(bars, contagem.values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.7, str(val),
                ha="center", va="bottom", color=CORES["neon_amarelo"], fontsize=10, fontweight="bold")
    ax.set_title("💊 Distribuição de Receitas por Via de Administração", color=CORES["neon_verde"], fontweight="bold", pad=15)
    ax.set_ylabel("Quantidade de Receitas", color=CORES["neon_verde"])
    ax.tick_params(axis="x", rotation=20)
    ax.grid(axis="y", color=CORES["cinza_escuro"], alpha=0.3)
    for spine in ax.spines.values():
        spine.set_edgecolor(CORES["neon_verde"])
        spine.set_linewidth(1.5)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Pareceres" > Card "Status"
def grafico_status_pareceres_donut(df_pareceres: pd.DataFrame) -> plt.Figure:
    """Donut chart NEON: status dos pareceres."""
    col_status = "status" if "status" in df_pareceres.columns else None
    if col_status is None:
        fig, ax = plt.subplots(figsize=(8, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Coluna 'status' ausente", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig

    contagem = df_pareceres[col_status].value_counts()
    cores_status = {
        "emitido":   CORES["neon_verde"],
        "pendente":  CORES["neon_amarelo"],
        "arquivado": CORES["neon_roxo"],
    }
    cores = [cores_status.get(str(s).lower(), CORES["cinza_escuro"]) for s in contagem.index]

    fig, ax = plt.subplots(figsize=(8, 7), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    wedges, texts, autotexts = ax.pie(
        contagem.values,
        labels=[f"{str(s).capitalize()} ({v})" for s, v in zip(contagem.index, contagem.values)],
        autopct="%1.1f%%",
        startangle=90,
        colors=cores,
        textprops={"fontsize": 10, "color": CORES["branco_neon"], "weight": "bold"},
        wedgeprops={"width": 0.4, "edgecolor": "#000000", "linewidth": 2},
    )
    for autotext in autotexts:
        autotext.set_color("#000000")
    ax.set_title("📋 Status dos Pareceres Agroclínicos", color=CORES["neon_verde"], fontweight="bold", pad=20)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Protocolos" > Análise "Evidências × Triagem"
def grafico_evidencias_por_comorbidade_scatter(df_catalogo: pd.DataFrame) -> plt.Figure:
    """Scatter NEON: evidências × triagem científica."""
    col_evidencias = next((c for c in ["total_evidencias", "estudos"] if c in df_catalogo.columns), None)
    col_triagem = "triagem" if "triagem" in df_catalogo.columns else None
    
    if col_evidencias is None or col_triagem is None:
        fig, ax = plt.subplots(figsize=(10, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Colunas ausentes", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig

    df_plot = df_catalogo[[col_evidencias, col_triagem]].dropna(subset=[col_evidencias, col_triagem]).copy()
    df_plot[col_evidencias] = pd.to_numeric(df_plot[col_evidencias], errors="coerce")
    df_plot = df_plot.dropna(subset=[col_evidencias])

    cores_triagem = {
        "A": CORES["neon_verde"],
        "B": CORES["neon_laranja"],
        "C": CORES["neon_amarelo"],
        "D": CORES["neon_rosa"],
        "E": CORES["neon_roxo"]
    }
    
    fig, ax = plt.subplots(figsize=(11, 7), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")

    for triagem, grupo in df_plot.groupby(col_triagem):
        cor = cores_triagem.get(str(triagem).upper(), CORES["cinza_escuro"])
        ax.scatter(
            grupo.index, grupo[col_evidencias],
            color=cor, label=f"Triagem {triagem}",
            alpha=0.8, s=100, edgecolors=CORES["branco_neon"], linewidth=1.5,
        )

    ax.set_title("📚 Evidências Científicas por Comorbidade (colorido por Triagem)", color=CORES["neon_verde"], fontweight="bold", pad=15)
    ax.set_xlabel("Comorbidade (índice)", color=CORES["neon_verde"])
    ax.set_ylabel("Total de Estudos", color=CORES["neon_verde"])
    ax.legend(title="Triagem", fontsize=8, facecolor="#0a0a0a", edgecolor=CORES["neon_verde"])
    ax.grid(color=CORES["cinza_escuro"], alpha=0.3)
    for spine in ax.spines.values():
        spine.set_edgecolor(CORES["neon_verde"])
        spine.set_linewidth(1.5)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Dashboard principal > Card "Resumo Médico"
def grafico_painel_resumo_medico(
    df_pacientes_comorb: pd.DataFrame,
    df_receitas: pd.DataFrame,
    df_pareceres: pd.DataFrame,
    df_prontuarios: pd.DataFrame
) -> plt.Figure:
    """Dashboard 2×2 NEON: métricas-chave médicas."""
    total_comorbidades = df_pacientes_comorb["comorbidade_id"].nunique() if "comorbidade_id" in df_pacientes_comorb.columns else len(df_pacientes_comorb)
    total_receitas = len(df_receitas)
    total_pareceres = len(df_pareceres)
    total_prontuarios = len(df_prontuarios)
    
    fig = plt.figure(figsize=(13, 9), facecolor="#000000")
    gs = GridSpec(2, 2, figure=fig, hspace=0.3, wspace=0.3)
    
    cards = [
        (gs[0, 0], total_comorbidades, "Comorbidades\nCatalogadas", CORES["neon_rosa"]),
        (gs[0, 1], total_receitas, "Receitas\nFitoterápicas", CORES["neon_laranja"]),
        (gs[1, 0], total_pareceres, "Pareceres\nAgroclínicos", CORES["neon_roxo"]),
        (gs[1, 1], total_prontuarios, "Prontuários\nAtivos", CORES["neon_verde"]),
    ]
    
    for subplot, valor, label, cor in cards:
        ax = fig.add_subplot(subplot)
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.6, str(valor), ha="center", va="center", fontsize=56, fontweight="bold",
                color=cor, transform=ax.transAxes)
        ax.text(0.5, 0.3, label, ha="center", va="center", fontsize=13, color=CORES["branco_neon"],
                transform=ax.transAxes)
        ax.axis("off")
    
    fig.suptitle("📊 Painel Médico — Reserva Canábica", fontsize=16, fontweight="bold",
                 color=CORES["neon_verde"], y=0.98)
    return fig

# 🎯 FRONTEND: Página "Protocolos" > Análise "Prioridade × Evidências"
def grafico_histograma_evidencias_por_prioridade(df_pacientes_comorb: pd.DataFrame, df_catalogo: pd.DataFrame) -> plt.Figure:
    """Histograma empilhado NEON: evidências por prioridade."""
    if df_pacientes_comorb.empty or df_catalogo.empty:
        fig, ax = plt.subplots(figsize=(10, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Sem dados", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig
    
    # Merge para trazer evidências
    col_comorb_id = "comorbidade_id" if "comorbidade_id" in df_pacientes_comorb.columns else None
    col_prioridade = "prioridade" if "prioridade" in df_pacientes_comorb.columns else None
    col_evidencias = next((c for c in ["total_evidencias", "estudos"] if c in df_catalogo.columns), None)
    
    if not all([col_comorb_id, col_prioridade, col_evidencias]):
        fig, ax = plt.subplots(figsize=(10, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Colunas ausentes", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig
    
    df_merge = df_pacientes_comorb.merge(
        df_catalogo[[col_comorb_id, col_evidencias] if col_comorb_id in df_catalogo.columns else df_catalogo],
        on=col_comorb_id, how="left"
    )
    df_merge[col_evidencias] = pd.to_numeric(df_merge[col_evidencias], errors="coerce").fillna(0)
    
    prioridades = sorted(df_merge[col_prioridade].dropna().unique())
    data_por_pri = [df_merge[df_merge[col_prioridade] == p][col_evidencias].values for p in prioridades]
    cores = [CORES["neon_verde"], CORES["neon_laranja"], CORES["neon_rosa"], CORES["neon_roxo"], CORES["neon_amarelo"]][:len(prioridades)]
    
    fig, ax = plt.subplots(figsize=(12, 6), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    
    bins = np.linspace(0, df_merge[col_evidencias].max(), 12)
    ax.hist(data_por_pri, bins=bins, stacked=True, color=cores, edgecolor="#000000", linewidth=1.5, alpha=0.9,
            label=[f"Prioridade {int(p)}" for p in prioridades])
    
    ax.set_title("📊 Distribuição de Evidências por Prioridade (empilhado)", color=CORES["neon_verde"], fontweight="bold", pad=15)
    ax.set_xlabel("Total de Estudos Científicos", color=CORES["neon_verde"])
    ax.set_ylabel("Frequência", color=CORES["neon_verde"])
    ax.legend(facecolor="#0a0a0a", edgecolor=CORES["neon_verde"], loc="upper right")
    ax.grid(axis="y", color=CORES["cinza_escuro"], alpha=0.3)
    for spine in ax.spines.values():
        spine.set_edgecolor(CORES["neon_verde"])
        spine.set_linewidth(1.5)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Receitas" > Modal "Dosagem"
def grafico_violino_dosagem(df_receitas: pd.DataFrame) -> plt.Figure:
    """Violin plot NEON: distribuição de dosagem por via."""
    col_dosagem = next((c for c in ["dosagem_valor_num", "dosagem"] if c in df_receitas.columns), None)
    col_via = next((c for c in ["via_administracao", "via"] if c in df_receitas.columns), None)
    
    if col_dosagem is None or col_via is None or df_receitas.empty:
        fig, ax = plt.subplots(figsize=(10, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Dados insuficientes", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig
    
    df_plot = df_receitas[[col_via, col_dosagem]].dropna()
    df_plot[col_dosagem] = pd.to_numeric(df_plot[col_dosagem], errors="coerce")
    df_plot = df_plot.dropna()
    
    vias = df_plot[col_via].unique()
    data_por_via = [df_plot[df_plot[col_via] == v][col_dosagem].values for v in vias]
    
    fig, ax = plt.subplots(figsize=(11, 7), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    
    cores_violin = [CORES["neon_verde"], CORES["neon_laranja"], CORES["neon_rosa"], CORES["neon_roxo"]]
    parts = ax.violinplot(data_por_via, positions=range(1, len(vias)+1), showmeans=True, showextrema=True, widths=0.6)
    
    for i, pc in enumerate(parts["bodies"]):
        pc.set_facecolor(cores_violin[i % len(cores_violin)])
        pc.set_edgecolor(CORES["branco_neon"])
        pc.set_linewidth(2)
        pc.set_alpha(0.8)
    
    for partname in ("cbars", "cmins", "cmaxes", "cmeans"):
        if partname in parts:
            vp = parts[partname]
            vp.set_edgecolor(CORES["neon_amarelo"])
            vp.set_linewidth(2)
    
    ax.set_title("🎻 Distribuição de Dosagem por Via de Administração (Violin Plot)", color=CORES["neon_verde"], fontweight="bold", pad=15)
    ax.set_ylabel("Dosagem (mg)", color=CORES["neon_verde"])
    ax.set_xticks(range(1, len(vias)+1))
    ax.set_xticklabels([str(v).capitalize()[:15] for v in vias], rotation=20)
    ax.grid(axis="y", color=CORES["cinza_escuro"], alpha=0.3)
    for spine in ax.spines.values():
        spine.set_edgecolor(CORES["neon_verde"])
        spine.set_linewidth(1.5)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Protocolos" > Análise "Densidade de Prioridades"
def grafico_kde_prioridades(df_pacientes_comorb: pd.DataFrame) -> plt.Figure:
    """KDE NEON: densidade de distribuição das prioridades."""
    col_prioridade = "prioridade" if "prioridade" in df_pacientes_comorb.columns else None
    if col_prioridade is None or df_pacientes_comorb.empty:
        fig, ax = plt.subplots(figsize=(10, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Coluna 'prioridade' ausente", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig
    
    prioridades = df_pacientes_comorb[col_prioridade].dropna()
    
    fig, ax = plt.subplots(figsize=(11, 6), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    
    if len(prioridades) > 1:
        prioridades.plot.kde(ax=ax, color=CORES["neon_rosa"], linewidth=3, label="Prioridades", alpha=0.9)
        ax.fill_between(ax.get_lines()[0].get_xdata(), ax.get_lines()[0].get_ydata(), alpha=0.3, color=CORES["neon_rosa"])
    
    ax.set_title("📈 Densidade de Distribuição de Prioridades (KDE)", color=CORES["neon_verde"], fontweight="bold", pad=15)
    ax.set_xlabel("Prioridade (1 = mais importante)", color=CORES["neon_verde"])
    ax.set_ylabel("Densidade", color=CORES["neon_verde"])
    ax.legend(facecolor="#0a0a0a", edgecolor=CORES["neon_verde"])
    ax.grid(color=CORES["cinza_escuro"], alpha=0.3)
    for spine in ax.spines.values():
        spine.set_edgecolor(CORES["neon_verde"])
        spine.set_linewidth(1.5)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Pareceres" > Timeline "Emissão de Pareceres"
def grafico_gantt_pareceres(df_pareceres: pd.DataFrame) -> plt.Figure:
    """Gantt chart NEON: timeline de emissão de pareceres (simulado)."""
    if df_pareceres.empty:
        pareceres = []
    else:
        # Simular timeline com 8 pareceres
        pareceres = []
        for i in range(min(8, len(df_pareceres))):
            inicio = i * 7  # offset em dias
            duracao = 10 + (i % 4) * 3  # 10-19 dias
            status = df_pareceres.iloc[i].get("status", "pendente") if i < len(df_pareceres) else "pendente"
            pareceres.append({"id": f"Parecer #{i+1}", "inicio": inicio, "duracao": duracao, "status": str(status).lower()})
    
    if not pareceres:
        fig, ax = plt.subplots(figsize=(12, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Sem dados de pareceres", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig
    
    fig, ax = plt.subplots(figsize=(13, 7), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    
    cores_status = {
        "emitido":   CORES["neon_verde"],
        "pendente":  CORES["neon_amarelo"],
        "arquivado": CORES["neon_roxo"],
    }
    
    for i, parecer in enumerate(pareceres):
        cor = cores_status.get(parecer["status"], CORES["cinza_escuro"])
        ax.barh(i, parecer["duracao"], left=parecer["inicio"], height=0.6, color=cor,
                edgecolor=CORES["branco_neon"], linewidth=1.5, alpha=0.9)
        ax.text(parecer["inicio"] + parecer["duracao"]/2, i, f"{parecer['duracao']}d",
                ha="center", va="center", color="#000000", fontsize=9, fontweight="bold")
    
    ax.set_yticks(range(len(pareceres)))
    ax.set_yticklabels([p["id"] for p in pareceres])
    ax.set_xlabel("Dias desde início", color=CORES["neon_verde"])
    ax.set_title("📅 Timeline de Emissão de Pareceres Agroclínicos (Gantt)", color=CORES["neon_verde"], fontweight="bold", pad=15)
    ax.grid(axis="x", color=CORES["cinza_escuro"], alpha=0.3)
    for spine in ax.spines.values():
        spine.set_edgecolor(CORES["neon_verde"])
        spine.set_linewidth(1.5)
    fig.tight_layout()
    return fig

# %% — Execução completa

def run_all_medical_analyses(folder_id: Optional[str] = None) -> Dict[str, str]:
    """
    Executa todas as 12 análises médicas com estética NEON, exibe e salva PNGs no Drive.

    Returns:
        Dicionário {nome_grafico: url_drive_ou_caminho_local}.
    """
    fid = folder_id or FOLDER_ID
    if fid.startswith("COLE_"):
        print("⚠️  FOLDER_ID não configurado — PNGs serão salvos localmente em /tmp/")

    print("\n🩺 Iniciando análises médicas NEON — Reserva Canábica")
    print("=" * 70)

    # 1. Buscar dados
    print("\n📡 Buscando dados...")
    df_pacientes_comorb = fetch_comorbidades_pacientes()
    df_catalogo         = fetch_comorbidades_catalogo()
    df_prontuarios      = fetch_prontuarios()
    df_pareceres        = fetch_pareceres()
    df_receitas         = fetch_receitas_fitoterapicas()

    print(f"  Pacientes × Comorbidades: {len(df_pacientes_comorb)} registros")
    print(f"  Catálogo comorbidades:    {len(df_catalogo)} registros")
    print(f"  Prontuários:              {len(df_prontuarios)} registros")
    print(f"  Pareceres:                {len(df_pareceres)} registros")
    print(f"  Receitas:                 {len(df_receitas)} registros")

    # 2. Gerar gráficos
    print("\n📊 Gerando gráficos NEON...")
    ts = datetime.now().strftime("%Y%m%d_%H%M")
    figuras: Dict[str, plt.Figure] = {}

    figuras[f"med_01_bar_top_comorbidades_{ts}"]      = grafico_top_comorbidades(df_pacientes_comorb)
    figuras[f"med_02_pie_triagem_{ts}"]               = grafico_distribuicao_triagem(df_catalogo)
    figuras[f"med_03_stacked_grau_coa_{ts}"]          = grafico_grau_coa_por_prioridade_stacked(df_pacientes_comorb)
    figuras[f"med_04_pie_quimiotipos_{ts}"]           = grafico_quimiotipos_sugeridos(df_pacientes_comorb)
    figuras[f"med_05_wordcloud_terpenos_{ts}"]        = grafico_nuvem_terpenos(df_pacientes_comorb)
    figuras[f"med_06_bar_via_admin_{ts}"]             = grafico_via_administracao(df_receitas)
    figuras[f"med_07_donut_pareceres_{ts}"]           = grafico_status_pareceres_donut(df_pareceres)
    figuras[f"med_08_scatter_evidencias_{ts}"]        = grafico_evidencias_por_comorbidade_scatter(df_catalogo)
    figuras[f"med_09_dashboard_resumo_{ts}"]          = grafico_painel_resumo_medico(df_pacientes_comorb, df_receitas, df_pareceres, df_prontuarios)
    figuras[f"med_10_histogram_evidencias_pri_{ts}"]  = grafico_histograma_evidencias_por_prioridade(df_pacientes_comorb, df_catalogo)
    figuras[f"med_11_violin_dosagem_{ts}"]            = grafico_violino_dosagem(df_receitas)
    figuras[f"med_12_kde_prioridades_{ts}"]           = grafico_kde_prioridades(df_pacientes_comorb)
    figuras[f"med_13_gantt_pareceres_{ts}"]           = grafico_gantt_pareceres(df_pareceres)

    # Exibir todos
    for nome, fig in figuras.items():
        plt.figure(fig.number)
        plt.show()

    # 3. Salvar no Drive
    print("\n📁 Salvando PNGs no Drive...")
    urls = salvar_todos_os_pngs(figuras, fid)

    for fig in figuras.values():
        plt.close(fig)

    print(f"\n✅ {len(urls)} gráficos médicos NEON salvos com sucesso.")
    return urls

# %% [markdown]
# ## Exemplos de uso
#
# ```python
# import os
# os.environ["APPS_SCRIPT_WEB_APP_URL"] = "https://script.google.com/macros/s/SEU_ID/exec"
# os.environ["FOLDER_ID"] = "1aBcD2eFgHiJ3kLmN"
#
# login()
# urls = run_all_medical_analyses()
# logout()
# ```
#
# **13 Gráficos NEON gerados:**
# 1. `med_01_bar_top_comorbidades` — Bar horizontal: top 10 comorbidades
# 2. `med_02_pie_triagem` — Pie chart: triagem científica (A/B/C/D/E)
# 3. `med_03_stacked_grau_coa` — Stacked bar: grau CoA × prioridade
# 4. `med_04_pie_quimiotipos` — Pie chart: quimiotipos sugeridos
# 5. `med_05_wordcloud_terpenos` — Word cloud: terpenos focalizados
# 6. `med_06_bar_via_admin` — Bar chart: vias de administração
# 7. `med_07_donut_pareceres` — Donut chart: status dos pareceres
# 8. `med_08_scatter_evidencias` — Scatter: evidências × triagem
# 9. `med_09_dashboard_resumo` — Dashboard 2×2: métricas-chave
# 10. `med_10_histogram_evidencias_pri` — Histograma empilhado: evidências por prioridade
# 11. `med_11_violin_dosagem` — Violin plot: dosagem por via
# 12. `med_12_kde_prioridades` — KDE: densidade de prioridades
# 13. `med_13_gantt_pareceres` — Gantt: timeline de pareceres
