# %% [markdown]
# # 🌱 Notebook Agronômico NEON — Reserva Canábica
#
# Análises estatísticas avançadas sobre cultivares, quimiotipos, canabinoides e terpenos
# com **estética neon cyberpunk** (fundo preto + cores vibrantes).
#
# **Pré-requisitos (Google Colab):**
# ```
# !pip install requests matplotlib seaborn pandas numpy scipy --quiet
# ```
#
# **Configuração obrigatória:**
# - `APPS_SCRIPT_WEB_APP_URL` — URL do Web App do Apps Script
# - `FOLDER_ID` — ID da pasta do Google Drive para salvar os PNGs

# %% — Instalação
# !pip install requests matplotlib seaborn pandas numpy scipy --quiet

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
from scipy import stats

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

# %% — Funções de busca de dados agroclínicos
def fetch_cultivares(filters: Optional[Dict] = None) -> pd.DataFrame:
    raw = _post("cultivar.list", {"filters": filters or {}})
    records = raw if isinstance(raw, list) else raw.get("cultivares", raw.get("records", []))
    df = pd.DataFrame(records)
    for col in ["thc_min", "thc_max", "cbd_min", "cbd_max", "cbg_min", "cbg_max"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df

def fetch_quimiotipos_db() -> pd.DataFrame:
    raw = _post("quimiotipo.list", {})
    records = raw if isinstance(raw, list) else raw.get("quimiotipos", raw.get("records", []))
    return pd.DataFrame(records)

def fetch_perfis_terpenos_db() -> pd.DataFrame:
    raw = _post("perfil_terpenos.list", {})
    records = raw if isinstance(raw, list) else raw.get("perfis", raw.get("records", []))
    return pd.DataFrame(records)

def fetch_terpenos_db() -> pd.DataFrame:
    raw = _post("terpenos.list", {})
    records = raw if isinstance(raw, list) else raw.get("terpenos", raw.get("records", []))
    return pd.DataFrame(records)

def fetch_metodos_cultivo() -> pd.DataFrame:
    raw = _post("metodos_cultivo.list", {})
    records = raw if isinstance(raw, list) else raw.get("metodos", raw.get("records", []))
    return pd.DataFrame(records)

# %% — GRÁFICOS AGROCLÍNICOS (12 ANÁLISES)

# 🎯 FRONTEND: Dashboard principal > Card "Genética Disponível"
def grafico_distribuicao_cultivares_por_quimiotipo(df_cultivares: pd.DataFrame) -> plt.Figure:
    """Pie chart NEON: distribuição de cultivares por quimiotipo."""
    col_quim = "quimiotipo" if "quimiotipo" in df_cultivares.columns else None
    if col_quim is None or df_cultivares.empty:
        fig, ax = plt.subplots(figsize=(8, 6), facecolor="#000000")
        ax.text(0.5, 0.5, "Sem dados", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        ax.set_facecolor("#0a0a0a")
        return fig
    
    contagem = df_cultivares[col_quim].value_counts()
    cores = [CORES["neon_laranja"], CORES["neon_verde"], CORES["neon_rosa"], CORES["neon_roxo"]][:len(contagem)]
    
    fig, ax = plt.subplots(figsize=(9, 7), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    wedges, texts, autotexts = ax.pie(
        contagem.values,
        labels=[f"{str(q).replace('_',' ')} ({v})" for q, v in zip(contagem.index, contagem.values)],
        autopct="%1.1f%%",
        startangle=45,
        colors=cores,
        textprops={"fontsize": 10, "color": CORES["branco_neon"], "weight": "bold"},
        wedgeprops={"edgecolor": "#000000", "linewidth": 2},
    )
    for autotext in autotexts:
        autotext.set_color("#000000")
    ax.set_title("🌱 Distribuição de Cultivares por Quimiotipo", color=CORES["neon_verde"], fontweight="bold", pad=20)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Cultivares" > Seção "Perfil de Canabinoides"
def grafico_cannabinoides_boxplot(df_cultivares: pd.DataFrame) -> plt.Figure:
    """Box plot triplo NEON: distribuição de %THC, %CBD, %CBG."""
    fig, axes = plt.subplots(1, 3, figsize=(14, 5), facecolor="#000000")
    cannabinoids = [
        ("thc_min", "thc_max", "THC", CORES["neon_laranja"]),
        ("cbd_min", "cbd_max", "CBD", CORES["neon_verde"]),
        ("cbg_min", "cbg_max", "CBG", CORES["neon_roxo"]),
    ]
    
    for ax, (col_min, col_max, nome, cor) in zip(axes, cannabinoids):
        ax.set_facecolor("#0a0a0a")
        if col_min in df_cultivares.columns and col_max in df_cultivares.columns:
            vals = pd.concat([df_cultivares[col_min], df_cultivares[col_max]]).dropna()
            if len(vals) > 0:
                bp = ax.boxplot([vals], vert=True, patch_artist=True, widths=0.6,
                                boxprops=dict(facecolor=cor, edgecolor=CORES["branco_neon"], linewidth=2, alpha=0.7),
                                whiskerprops=dict(color=cor, linewidth=2),
                                capprops=dict(color=cor, linewidth=2),
                                medianprops=dict(color=CORES["neon_amarelo"], linewidth=3))
                ax.set_title(f"% {nome}", color=cor, fontweight="bold", fontsize=12)
                ax.set_ylabel("Concentração (%)", color=CORES["neon_verde"])
                ax.tick_params(colors=CORES["neon_verde"])
                ax.grid(axis="y", color=CORES["cinza_escuro"], alpha=0.3)
            else:
                ax.text(0.5, 0.5, "Sem dados", ha="center", va="center", transform=ax.transAxes, color=CORES["neon_verde"])
        ax.set_xticklabels([nome])
        for spine in ax.spines.values():
            spine.set_edgecolor(CORES["neon_verde"])
            spine.set_linewidth(1.5)
    
    fig.suptitle("🧪 Perfil de Canabinoides nas Cultivares", color=CORES["neon_verde"], fontweight="bold", fontsize=14, y=0.98)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Cultivares" > Seção "Métodos de Cultivo"
def grafico_cultivares_por_metodo_stacked(df_cultivares: pd.DataFrame) -> plt.Figure:
    """Stacked bar NEON: cultivares por método de cultivo × quimiotipo."""
    col_metodo = next((c for c in ["metodo_cultivo", "metodo"] if c in df_cultivares.columns), None)
    col_quim = "quimiotipo" if "quimiotipo" in df_cultivares.columns else None
    
    if col_metodo is None or col_quim is None or df_cultivares.empty:
        fig, ax = plt.subplots(figsize=(10, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Dados insuficientes", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig
    
    cross = pd.crosstab(df_cultivares[col_metodo], df_cultivares[col_quim])
    cores = [CORES["neon_laranja"], CORES["neon_verde"], CORES["neon_rosa"], CORES["neon_roxo"]][:len(cross.columns)]
    
    fig, ax = plt.subplots(figsize=(12, 6), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    cross.plot(kind="bar", stacked=True, ax=ax, color=cores, edgecolor="#000000", linewidth=1.5, width=0.7)
    ax.set_title("🌿 Cultivares por Método de Cultivo (empilhado por Quimiotipo)", color=CORES["neon_verde"], fontweight="bold", pad=15)
    ax.set_xlabel("Método de Cultivo", color=CORES["neon_verde"])
    ax.set_ylabel("Quantidade de Cultivares", color=CORES["neon_verde"])
    ax.legend(title="Quimiotipo", facecolor="#0a0a0a", edgecolor=CORES["neon_verde"], title_fontsize=9, loc="upper right")
    ax.tick_params(axis="x", rotation=25, colors=CORES["neon_verde"])
    ax.grid(axis="y", color=CORES["cinza_escuro"], alpha=0.3)
    for spine in ax.spines.values():
        spine.set_edgecolor(CORES["neon_verde"])
        spine.set_linewidth(1.5)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Terpenos" > Card "Prevalência"
def grafico_top_terpenos_horizontal_neon(df_perfis: pd.DataFrame) -> plt.Figure:
    """Bar horizontal NEON: top 10 terpenos mais prevalentes."""
    col_terps = next((c for c in ["terpenos", "perfil_terpenos"] if c in df_perfis.columns), None)
    if col_terps is None or df_perfis.empty:
        fig, ax = plt.subplots(figsize=(10, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Dados de terpenos ausentes", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig
    
    all_terps = []
    for t in df_perfis[col_terps].dropna():
        terps = [x.strip() for x in str(t).replace(",", " ").replace(";", " ").split()]
        all_terps.extend(terps)
    
    if not all_terps:
        fig, ax = plt.subplots(figsize=(10, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Nenhum terpeno encontrado", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig
    
    freq = Counter(all_terps)
    top10 = freq.most_common(10)
    nomes, valores = zip(*top10)
    
    fig, ax = plt.subplots(figsize=(11, 7), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    bars = ax.barh([str(n)[:30] for n in nomes], valores, color=CORES["neon_rosa"], edgecolor=CORES["branco_neon"], linewidth=1.5, alpha=0.9)
    
    for bar, val in zip(bars, valores):
        ax.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height()/2, str(val),
                va="center", ha="left", color=CORES["neon_amarelo"], fontsize=10, fontweight="bold")
    
    ax.set_title("🌿 Top 10 Terpenos Mais Prevalentes", color=CORES["neon_verde"], fontweight="bold", pad=15)
    ax.set_xlabel("Frequência", color=CORES["neon_verde"])
    ax.grid(axis="x", color=CORES["cinza_escuro"], alpha=0.3)
    for spine in ax.spines.values():
        spine.set_edgecolor(CORES["neon_verde"])
        spine.set_linewidth(1.5)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Cultivares" > Modal "Perfil Terpenoídico"
def grafico_perfil_terpenos_radar(df_perfis: pd.DataFrame) -> plt.Figure:
    """Radar chart NEON: perfil terpênico médio (top 8 terpenos)."""
    col_terps = next((c for c in ["terpenos", "perfil_terpenos"] if c in df_perfis.columns), None)
    if col_terps is None or df_perfis.empty:
        fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(polar=True), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Dados ausentes", ha="center", va="center", transform=ax.transAxes, color=CORES["neon_verde"], fontsize=14)
        return fig
    
    all_terps = []
    for t in df_perfis[col_terps].dropna():
        terps = [x.strip() for x in str(t).replace(",", " ").replace(";", " ").split()]
        all_terps.extend(terps)
    
    if not all_terps:
        fig, ax = plt.subplots(figsize=(8, 8), subplot_kw=dict(polar=True), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        return fig
    
    freq = Counter(all_terps)
    top8 = freq.most_common(8)
    nomes, valores = zip(*top8)
    
    # Normalizar para 0-100
    max_val = max(valores)
    valores_norm = [v/max_val * 100 for v in valores]
    
    angles = np.linspace(0, 2 * np.pi, len(nomes), endpoint=False).tolist()
    valores_norm += valores_norm[:1]
    angles += angles[:1]
    
    fig, ax = plt.subplots(figsize=(9, 9), subplot_kw=dict(polar=True), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    ax.plot(angles, valores_norm, color=CORES["neon_verde"], linewidth=3, label="Perfil Médio")
    ax.fill(angles, valores_norm, color=CORES["neon_verde"], alpha=0.3)
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels([str(n)[:15] for n in nomes], color=CORES["neon_verde"], fontsize=9)
    ax.set_ylim(0, 100)
    ax.set_yticks([25, 50, 75, 100])
    ax.set_yticklabels(["25", "50", "75", "100"], color=CORES["neon_verde"], fontsize=8)
    ax.grid(color=CORES["cinza_escuro"], alpha=0.5)
    ax.spines["polar"].set_edgecolor(CORES["neon_verde"])
    ax.spines["polar"].set_linewidth(2)
    ax.set_title("🎯 Perfil Terpenoídico Médio (Top 8)", color=CORES["neon_verde"], fontweight="bold", pad=25, fontsize=14)
    ax.legend(loc="upper right", bbox_to_anchor=(1.3, 1.1), facecolor="#0a0a0a", edgecolor=CORES["neon_verde"])
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Cultivares" > Gráfico "Ratio THC/CBD"
def grafico_ratio_thc_cbd_scatter(df_cultivares: pd.DataFrame) -> plt.Figure:
    """Scatter NEON: THC × CBD colorido por quimiotipo."""
    if df_cultivares.empty:
        fig, ax = plt.subplots(figsize=(10, 7), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Sem dados", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig
    
    df_plot = df_cultivares.copy()
    df_plot["thc_medio"] = (df_plot.get("thc_min", 0) + df_plot.get("thc_max", 0)) / 2
    df_plot["cbd_medio"] = (df_plot.get("cbd_min", 0) + df_plot.get("cbd_max", 0)) / 2
    df_plot = df_plot[(df_plot["thc_medio"] > 0) | (df_plot["cbd_medio"] > 0)]
    
    col_quim = "quimiotipo" if "quimiotipo" in df_plot.columns else None
    cores_quim = {
        "TIPO_I_THC": CORES["neon_laranja"],
        "TIPO_II_EQUILIBRADO": CORES["neon_verde"],
        "TIPO_III_CBD": CORES["neon_rosa"],
        "TIPO_IV_CBG": CORES["neon_roxo"],
    }
    
    fig, ax = plt.subplots(figsize=(11, 8), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    
    if col_quim:
        for quim, grupo in df_plot.groupby(col_quim):
            cor = cores_quim.get(str(quim), CORES["neon_magenta"])
            ax.scatter(grupo["thc_medio"], grupo["cbd_medio"], color=cor, label=str(quim).replace("_", " "),
                      s=120, alpha=0.8, edgecolors=CORES["branco_neon"], linewidth=1.5)
    else:
        ax.scatter(df_plot["thc_medio"], df_plot["cbd_medio"], color=CORES["neon_verde"], s=120, alpha=0.8,
                  edgecolors=CORES["branco_neon"], linewidth=1.5)
    
    ax.set_title("⚖️  Ratio THC × CBD por Cultivar (colorido por Quimiotipo)", color=CORES["neon_verde"], fontweight="bold", pad=15)
    ax.set_xlabel("% THC médio", color=CORES["neon_verde"])
    ax.set_ylabel("% CBD médio", color=CORES["neon_verde"])
    ax.legend(title="Quimiotipo", facecolor="#0a0a0a", edgecolor=CORES["neon_verde"], fontsize=8, loc="upper right")
    ax.grid(color=CORES["cinza_escuro"], alpha=0.3)
    for spine in ax.spines.values():
        spine.set_edgecolor(CORES["neon_verde"])
        spine.set_linewidth(1.5)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Cultivares" > Comparativo "Canabinoides por Método"
def grafico_metodos_cultivo_cannabinoides_grouped(df_cultivares: pd.DataFrame) -> plt.Figure:
    """Grouped bar NEON: %THC e %CBD médios por método de cultivo."""
    col_metodo = next((c for c in ["metodo_cultivo", "metodo"] if c in df_cultivares.columns), None)
    if col_metodo is None or df_cultivares.empty:
        fig, ax = plt.subplots(figsize=(10, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Dados insuficientes", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig
    
    df_plot = df_cultivares.copy()
    df_plot["thc_medio"] = (df_plot.get("thc_min", 0) + df_plot.get("thc_max", 0)) / 2
    df_plot["cbd_medio"] = (df_plot.get("cbd_min", 0) + df_plot.get("cbd_max", 0)) / 2
    
    grouped = df_plot.groupby(col_metodo)[["thc_medio", "cbd_medio"]].mean()
    
    fig, ax = plt.subplots(figsize=(11, 6), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    x = np.arange(len(grouped.index))
    width = 0.35
    
    bars1 = ax.bar(x - width/2, grouped["thc_medio"], width, label="THC", color=CORES["neon_laranja"],
                   edgecolor=CORES["branco_neon"], linewidth=1.5, alpha=0.9)
    bars2 = ax.bar(x + width/2, grouped["cbd_medio"], width, label="CBD", color=CORES["neon_verde"],
                   edgecolor=CORES["branco_neon"], linewidth=1.5, alpha=0.9)
    
    for bars in [bars1, bars2]:
        for bar in bars:
            height = bar.get_height()
            if height > 0:
                ax.text(bar.get_x() + bar.get_width()/2, height + 0.3, f"{height:.1f}%",
                       ha="center", va="bottom", color=CORES["neon_amarelo"], fontsize=9, fontweight="bold")
    
    ax.set_title("🌱 Canabinoides Médios por Método de Cultivo", color=CORES["neon_verde"], fontweight="bold", pad=15)
    ax.set_xlabel("Método de Cultivo", color=CORES["neon_verde"])
    ax.set_ylabel("% médio", color=CORES["neon_verde"])
    ax.set_xticks(x)
    ax.set_xticklabels([str(m)[:20] for m in grouped.index], rotation=20)
    ax.legend(facecolor="#0a0a0a", edgecolor=CORES["neon_verde"])
    ax.grid(axis="y", color=CORES["cinza_escuro"], alpha=0.3)
    for spine in ax.spines.values():
        spine.set_edgecolor(CORES["neon_verde"])
        spine.set_linewidth(1.5)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Dashboard principal > Card "Resumo Genético"
def grafico_painel_resumo_agro(
    df_cultivares: pd.DataFrame,
    df_quimiotipos: pd.DataFrame,
    df_terpenos: pd.DataFrame,
    df_metodos: pd.DataFrame
) -> plt.Figure:
    """Dashboard 2×2 NEON: métricas-chave agroclínicas."""
    total_cultivares = len(df_cultivares)
    total_quimiotipos = len(df_quimiotipos)
    total_terpenos = len(df_terpenos)
    total_metodos = len(df_metodos)
    
    fig = plt.figure(figsize=(13, 9), facecolor="#000000")
    gs = GridSpec(2, 2, figure=fig, hspace=0.3, wspace=0.3)
    
    cards = [
        (gs[0, 0], total_cultivares, "Cultivares\nDisponíveis", CORES["neon_verde"]),
        (gs[0, 1], total_quimiotipos, "Quimiotipos\nCatalogados", CORES["neon_rosa"]),
        (gs[1, 0], total_terpenos, "Terpenos\nIdentificados", CORES["neon_roxo"]),
        (gs[1, 1], total_metodos, "Métodos de\nCultivo", CORES["neon_laranja"]),
    ]
    
    for subplot, valor, label, cor in cards:
        ax = fig.add_subplot(subplot)
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.6, str(valor), ha="center", va="center", fontsize=56, fontweight="bold",
                color=cor, transform=ax.transAxes)
        ax.text(0.5, 0.3, label, ha="center", va="center", fontsize=13, color=CORES["branco_neon"],
                transform=ax.transAxes)
        ax.axis("off")
        for spine in ax.spines.values():
            spine.set_edgecolor(cor)
            spine.set_linewidth(2)
    
    fig.suptitle("📊 Painel Agroclínico — Reserva Canábica", fontsize=16, fontweight="bold",
                 color=CORES["neon_verde"], y=0.98)
    return fig

# 🎯 FRONTEND: Página "Cultivares" > Análise Avançada "Distribuição THC"
def grafico_histograma_thc_empilhado(df_cultivares: pd.DataFrame) -> plt.Figure:
    """Histograma empilhado NEON: distribuição %THC por quimiotipo."""
    if df_cultivares.empty:
        fig, ax = plt.subplots(figsize=(10, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Sem dados", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig
    
    df_plot = df_cultivares.copy()
    df_plot["thc_medio"] = (df_plot.get("thc_min", 0) + df_plot.get("thc_max", 0)) / 2
    df_plot = df_plot[df_plot["thc_medio"] > 0]
    
    col_quim = "quimiotipo" if "quimiotipo" in df_plot.columns else None
    if col_quim is None:
        fig, ax = plt.subplots(figsize=(10, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Coluna 'quimiotipo' ausente", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig
    
    cores_quim = {
        "TIPO_I_THC": CORES["neon_laranja"],
        "TIPO_II_EQUILIBRADO": CORES["neon_verde"],
        "TIPO_III_CBD": CORES["neon_rosa"],
        "TIPO_IV_CBG": CORES["neon_roxo"],
    }
    
    fig, ax = plt.subplots(figsize=(12, 6), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    
    bins = np.linspace(0, df_plot["thc_medio"].max(), 15)
    quimiotipos = df_plot[col_quim].unique()
    data_por_quim = [df_plot[df_plot[col_quim] == q]["thc_medio"].values for q in quimiotipos]
    cores = [cores_quim.get(str(q), CORES["neon_magenta"]) for q in quimiotipos]
    
    ax.hist(data_por_quim, bins=bins, stacked=True, color=cores, edgecolor="#000000", linewidth=1.5, alpha=0.9,
            label=[str(q).replace("_", " ") for q in quimiotipos])
    
    ax.set_title("📊 Distribuição de %THC (empilhado por Quimiotipo)", color=CORES["neon_verde"], fontweight="bold", pad=15)
    ax.set_xlabel("% THC médio", color=CORES["neon_verde"])
    ax.set_ylabel("Frequência (cultivares)", color=CORES["neon_verde"])
    ax.legend(facecolor="#0a0a0a", edgecolor=CORES["neon_verde"], loc="upper right")
    ax.grid(axis="y", color=CORES["cinza_escuro"], alpha=0.3)
    for spine in ax.spines.values():
        spine.set_edgecolor(CORES["neon_verde"])
        spine.set_linewidth(1.5)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Cultivares" > Modal "Comparativo Estatístico"
def grafico_violino_cannabinoides(df_cultivares: pd.DataFrame) -> plt.Figure:
    """Violin plot NEON: distribuição de THC, CBD, CBG."""
    if df_cultivares.empty:
        fig, ax = plt.subplots(figsize=(10, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Sem dados", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig
    
    df_plot = df_cultivares.copy()
    df_plot["thc_medio"] = (df_plot.get("thc_min", 0) + df_plot.get("thc_max", 0)) / 2
    df_plot["cbd_medio"] = (df_plot.get("cbd_min", 0) + df_plot.get("cbd_max", 0)) / 2
    df_plot["cbg_medio"] = (df_plot.get("cbg_min", 0) + df_plot.get("cbg_max", 0)) / 2
    
    data = []
    for col, nome in [("thc_medio", "THC"), ("cbd_medio", "CBD"), ("cbg_medio", "CBG")]:
        vals = df_plot[col].dropna()
        if len(vals) > 0:
            for v in vals:
                data.append({"Canabinoide": nome, "Valor": v})
    
    df_violin = pd.DataFrame(data)
    
    fig, ax = plt.subplots(figsize=(11, 7), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    
    cores_violin = {"THC": CORES["neon_laranja"], "CBD": CORES["neon_verde"], "CBG": CORES["neon_roxo"]}
    parts = ax.violinplot(
        [df_violin[df_violin["Canabinoide"] == c]["Valor"].values for c in ["THC", "CBD", "CBG"]],
        positions=[1, 2, 3],
        showmeans=True,
        showextrema=True,
        widths=0.7,
    )
    
    for i, (pc, canabinoide) in enumerate(zip(parts["bodies"], ["THC", "CBD", "CBG"])):
        pc.set_facecolor(cores_violin[canabinoide])
        pc.set_edgecolor(CORES["branco_neon"])
        pc.set_linewidth(2)
        pc.set_alpha(0.8)
    
    for partname in ("cbars", "cmins", "cmaxes", "cmeans"):
        if partname in parts:
            vp = parts[partname]
            vp.set_edgecolor(CORES["neon_amarelo"])
            vp.set_linewidth(2)
    
    ax.set_title("🎻 Distribuição de Canabinoides (Violin Plot)", color=CORES["neon_verde"], fontweight="bold", pad=15)
    ax.set_ylabel("% Concentração", color=CORES["neon_verde"])
    ax.set_xticks([1, 2, 3])
    ax.set_xticklabels(["THC", "CBD", "CBG"])
    ax.grid(axis="y", color=CORES["cinza_escuro"], alpha=0.3)
    for spine in ax.spines.values():
        spine.set_edgecolor(CORES["neon_verde"])
        spine.set_linewidth(1.5)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Cultivares" > Análise "Densidade THC/CBD"
def grafico_kde_thc_cbd(df_cultivares: pd.DataFrame) -> plt.Figure:
    """KDE (densidade) NEON: distribuição suavizada de THC e CBD."""
    if df_cultivares.empty:
        fig, ax = plt.subplots(figsize=(10, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Sem dados", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig
    
    df_plot = df_cultivares.copy()
    df_plot["thc_medio"] = (df_plot.get("thc_min", 0) + df_plot.get("thc_max", 0)) / 2
    df_plot["cbd_medio"] = (df_plot.get("cbd_min", 0) + df_plot.get("cbd_max", 0)) / 2
    
    thc_vals = df_plot["thc_medio"].dropna()
    cbd_vals = df_plot["cbd_medio"].dropna()
    
    fig, ax = plt.subplots(figsize=(11, 6), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    
    if len(thc_vals) > 1:
        thc_vals.plot.kde(ax=ax, color=CORES["neon_laranja"], linewidth=3, label="THC", alpha=0.9)
    if len(cbd_vals) > 1:
        cbd_vals.plot.kde(ax=ax, color=CORES["neon_verde"], linewidth=3, label="CBD", alpha=0.9)
    
    ax.set_title("📈 Densidade de Probabilidade: THC vs. CBD (KDE)", color=CORES["neon_verde"], fontweight="bold", pad=15)
    ax.set_xlabel("% Concentração", color=CORES["neon_verde"])
    ax.set_ylabel("Densidade", color=CORES["neon_verde"])
    ax.legend(facecolor="#0a0a0a", edgecolor=CORES["neon_verde"])
    ax.grid(color=CORES["cinza_escuro"], alpha=0.3)
    for spine in ax.spines.values():
        spine.set_edgecolor(CORES["neon_verde"])
        spine.set_linewidth(1.5)
    fig.tight_layout()
    return fig

# 🎯 FRONTEND: Página "Produção" > Timeline de Ciclos
def grafico_gantt_ciclos_cultivo(df_cultivares: pd.DataFrame) -> plt.Figure:
    """Gantt chart NEON: timeline de ciclos de cultivo (simulado)."""
    # Dados simulados (no mundo real viriam de tabela "Ciclos_Producao")
    if df_cultivares.empty:
        ciclos = []
    else:
        # Simular 8 ciclos baseados nas cultivares
        ciclos = []
        cultivares_sample = df_cultivares.head(8)["cultivar"].tolist() if "cultivar" in df_cultivares.columns else []
        for i, cult in enumerate(cultivares_sample):
            inicio = i * 15  # dias offset
            duracao = 60 + (i % 3) * 10  # 60-80 dias
            ciclos.append({"cultivar": str(cult)[:20], "inicio": inicio, "duracao": duracao})
    
    if not ciclos:
        fig, ax = plt.subplots(figsize=(12, 6), facecolor="#000000")
        ax.set_facecolor("#0a0a0a")
        ax.text(0.5, 0.5, "Sem dados de ciclos", ha="center", va="center", color=CORES["neon_verde"], fontsize=14)
        return fig
    
    fig, ax = plt.subplots(figsize=(13, 7), facecolor="#000000")
    ax.set_facecolor("#0a0a0a")
    
    cores_gantt = [CORES["neon_verde"], CORES["neon_rosa"], CORES["neon_roxo"], CORES["neon_laranja"],
                   CORES["neon_verde"], CORES["neon_rosa"], CORES["neon_roxo"], CORES["neon_laranja"]]
    
    for i, ciclo in enumerate(ciclos):
        cor = cores_gantt[i % len(cores_gantt)]
        ax.barh(i, ciclo["duracao"], left=ciclo["inicio"], height=0.6, color=cor, edgecolor=CORES["branco_neon"],
                linewidth=1.5, alpha=0.9)
        ax.text(ciclo["inicio"] + ciclo["duracao"]/2, i, f"{ciclo['duracao']}d",
                ha="center", va="center", color="#000000", fontsize=9, fontweight="bold")
    
    ax.set_yticks(range(len(ciclos)))
    ax.set_yticklabels([c["cultivar"] for c in ciclos])
    ax.set_xlabel("Dias desde início do projeto", color=CORES["neon_verde"])
    ax.set_ylabel("Cultivar", color=CORES["neon_verde"])
    ax.set_title("📅 Timeline de Ciclos de Cultivo (Gantt)", color=CORES["neon_verde"], fontweight="bold", pad=15)
    ax.grid(axis="x", color=CORES["cinza_escuro"], alpha=0.3)
    for spine in ax.spines.values():
        spine.set_edgecolor(CORES["neon_verde"])
        spine.set_linewidth(1.5)
    fig.tight_layout()
    return fig

# %% — Execução completa

def run_all_agro_analyses(folder_id: Optional[str] = None) -> Dict[str, str]:
    """
    Executa todas as 12 análises agroclínicas com estética NEON, exibe e salva PNGs no Drive.

    Returns:
        Dicionário {nome_grafico: url_drive_ou_caminho_local}.
    """
    fid = folder_id or FOLDER_ID
    if fid.startswith("COLE_"):
        print("⚠️  FOLDER_ID não configurado — PNGs serão salvos localmente em /tmp/")

    print("\n🌱 Iniciando análises agroclínicas NEON — Reserva Canábica")
    print("=" * 70)

    # 1. Buscar dados
    print("\n📡 Buscando dados...")
    df_cultivares     = fetch_cultivares()
    df_quimiotipos    = fetch_quimiotipos_db()
    df_perfis         = fetch_perfis_terpenos_db()
    df_terpenos       = fetch_terpenos_db()
    df_metodos        = fetch_metodos_cultivo()

    print(f"  Cultivares:       {len(df_cultivares)} registros")
    print(f"  Quimiotipos:      {len(df_quimiotipos)} registros")
    print(f"  Perfis terpenos:  {len(df_perfis)} registros")
    print(f"  Terpenos:         {len(df_terpenos)} registros")
    print(f"  Métodos cultivo:  {len(df_metodos)} registros")

    # 2. Gerar gráficos
    print("\n📊 Gerando gráficos NEON...")
    ts = datetime.now().strftime("%Y%m%d_%H%M")
    figuras: Dict[str, plt.Figure] = {}

    figuras[f"agro_01_pie_quimiotipos_{ts}"]          = grafico_distribuicao_cultivares_por_quimiotipo(df_cultivares)
    figuras[f"agro_02_boxplot_cannabinoides_{ts}"]    = grafico_cannabinoides_boxplot(df_cultivares)
    figuras[f"agro_03_stacked_metodos_{ts}"]          = grafico_cultivares_por_metodo_stacked(df_cultivares)
    figuras[f"agro_04_bar_terpenos_{ts}"]             = grafico_top_terpenos_horizontal_neon(df_perfis)
    figuras[f"agro_05_radar_perfil_{ts}"]             = grafico_perfil_terpenos_radar(df_perfis)
    figuras[f"agro_06_scatter_ratio_{ts}"]            = grafico_ratio_thc_cbd_scatter(df_cultivares)
    figuras[f"agro_07_grouped_metodos_canna_{ts}"]    = grafico_metodos_cultivo_cannabinoides_grouped(df_cultivares)
    figuras[f"agro_08_dashboard_resumo_{ts}"]         = grafico_painel_resumo_agro(df_cultivares, df_quimiotipos, df_terpenos, df_metodos)
    figuras[f"agro_09_histogram_thc_{ts}"]            = grafico_histograma_thc_empilhado(df_cultivares)
    figuras[f"agro_10_violin_cannabinoides_{ts}"]     = grafico_violino_cannabinoides(df_cultivares)
    figuras[f"agro_11_kde_thc_cbd_{ts}"]              = grafico_kde_thc_cbd(df_cultivares)
    figuras[f"agro_12_gantt_ciclos_{ts}"]             = grafico_gantt_ciclos_cultivo(df_cultivares)

    # Exibir todos
    for nome, fig in figuras.items():
        plt.figure(fig.number)
        plt.show()

    # 3. Salvar no Drive
    print("\n📁 Salvando PNGs no Drive...")
    urls = salvar_todos_os_pngs(figuras, fid)

    for fig in figuras.values():
        plt.close(fig)

    print(f"\n✅ {len(urls)} gráficos agroclínicos NEON salvos com sucesso.")
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
# urls = run_all_agro_analyses()
# logout()
# ```
#
# **12 Gráficos NEON gerados:**
# 1. `agro_01_pie_quimiotipos` — Pie chart: distribuição por quimiotipo
# 2. `agro_02_boxplot_cannabinoides` — Box plot triplo: THC, CBD, CBG
# 3. `agro_03_stacked_metodos` — Stacked bar: cultivares por método × quimiotipo
# 4. `agro_04_bar_terpenos` — Bar horizontal: top 10 terpenos
# 5. `agro_05_radar_perfil` — Radar: perfil terpênico médio
# 6. `agro_06_scatter_ratio` — Scatter: THC × CBD por quimiotipo
# 7. `agro_07_grouped_metodos_canna` — Grouped bar: canabinoides por método
# 8. `agro_08_dashboard_resumo` — Dashboard 2×2: métricas-chave
# 9. `agro_09_histogram_thc` — Histograma empilhado: distribuição %THC
# 10. `agro_10_violin_cannabinoides` — Violin plot: THC, CBD, CBG
# 11. `agro_11_kde_thc_cbd` — KDE: densidade THC vs. CBD
# 12. `agro_12_gantt_ciclos` — Gantt: timeline de ciclos de cultivo
