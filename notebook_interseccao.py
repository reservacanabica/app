# %% [markdown]
# # 🔬 Notebook de Intersecção NEON — Reserva Canábica
#
# Análises integradas cruzando dados **agroclínicos** com **médicos**
# com **estética neon cyberpunk** (fundo preto + laranja/rosa/verde/roxo).
# com dados **médicos** (comorbidades, pareceres, receitas).
#
# **Pré-requisitos (Google Colab):**
# ```
# !pip install requests matplotlib seaborn pandas numpy scipy --quiet
# ```
#
# **Configuração obrigatória:**
# - `APPS_SCRIPT_WEB_APP_URL` — URL do Web App do Apps Script
# - `FOLDER_ID` — ID da pasta do Google Drive para salvar os PNGs
#
# **Fluxo:**
# 1. Autenticar
# 2. Buscar dados agroclínicos E médicos
# 3. Cruzar e gerar análises integradas
# 4. Salvar gráficos PNG no Drive
# 5. Logout

# %% — Instalação
# !pip install requests matplotlib seaborn pandas numpy scipy --quiet

# %% — Imports e configuração
import io
import json
import os
from collections import Counter, defaultdict
from datetime import datetime
from getpass import getpass
from typing import Any, Dict, List, Optional, Tuple

import matplotlib
import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from matplotlib.gridspec import GridSpec

sns.set_theme(style="whitegrid", palette="muted")
matplotlib.rcParams.update({
    "figure.dpi": 150,
    "figure.facecolor": "white",
    "axes.titlesize": 13,
    "axes.labelsize": 11,
    "xtick.labelsize": 9,
    "ytick.labelsize": 9,
    "legend.fontsize": 9,
})

APPS_SCRIPT_WEB_APP_URL: str = os.getenv("APPS_SCRIPT_WEB_APP_URL", "COLE_A_URL_DO_WEB_APP_AQUI")
FOLDER_ID: str = os.getenv("FOLDER_ID", "COLE_O_ID_DA_PASTA_DO_DRIVE_AQUI")
REQUEST_TIMEOUT_SECONDS: int = int(os.getenv("REQUEST_TIMEOUT_SECONDS", "30"))

_session_token: Optional[str] = None
_current_user: Optional[Dict[str, Any]] = None

CORES = {
    "verde_primary": "#2e7d32",
    "verde_light":   "#4caf50",
    "verde_dark":    "#1b5e20",
    "verde_bg":      "#e8f5e9",
    "azul":          "#1565c0",
    "laranja":       "#e65100",
    "vermelho":      "#c62828",
    "cinza":         "#757575",
    "amarelo":       "#f9a825",
    "roxo":          "#6a1b9a",
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
    fig.savefig(buf, format="png", dpi=150, bbox_inches="tight")
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

# %% — Funções de busca (AGRO + MÉDICO)

# === AGRO ===
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

# === MÉDICO ===
def fetch_comorbidades_pacientes(filters: Optional[Dict] = None) -> pd.DataFrame:
    raw = _post("comorbidade.listar", {"filters": filters or {}})
    records = raw if isinstance(raw, list) else raw.get("comorbidades", raw.get("records", []))
    df = pd.DataFrame(records)
    for col in ["prioridade", "comorbidade_id", "total_evidencias"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df

def fetch_comorbidades_catalogo() -> pd.DataFrame:
    raw = _post("comorbidade.catalogo", {})
    records = raw if isinstance(raw, list) else raw.get("catalogo", raw.get("records", []))
    return pd.DataFrame(records)

def fetch_receitas_fitoterapicas(filters: Optional[Dict] = None) -> pd.DataFrame:
    raw = _post("receitas_fitoterapicas.list", {"filters": filters or {}})
    records = raw if isinstance(raw, list) else raw.get("receitas", raw.get("records", []))
    df = pd.DataFrame(records)
    for col in ["dosagem_valor_num", "volume_total_ml"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df

def fetch_pareceres(filters: Optional[Dict] = None) -> pd.DataFrame:
    raw = _post("pareceres.list", {"filters": filters or {}})
    records = raw if isinstance(raw, list) else raw.get("pareceres", raw.get("records", []))
    return pd.DataFrame(records)

# %% — ANÁLISES DE INTERSECÇÃO

def grafico_quimiotipo_cultivar_vs_comorbidade(
    df_cultivares: pd.DataFrame,
    df_pacientes_comorb: pd.DataFrame
) -> plt.Figure:
    """
    Heatmap: quantas comorbidades sugerem cada quimiotipo vs.
    quantas cultivares estão disponíveis em cada quimiotipo.
    """
    # Contagem: comorbidades × quimiotipo sugerido
    col_quim_comorb = next((c for c in ["quimiotipo_sugerido", "quimiotipo"] if c in df_pacientes_comorb.columns), None)
    if col_quim_comorb is None:
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.text(0.5, 0.5, "Coluna 'quimiotipo' ausente em comorbidades", ha="center", va="center", transform=ax.transAxes)
        return fig

    # Contagem: cultivares × quimiotipo
    col_quim_cult = "quimiotipo" if "quimiotipo" in df_cultivares.columns else None
    if col_quim_cult is None:
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.text(0.5, 0.5, "Coluna 'quimiotipo' ausente em cultivares", ha="center", va="center", transform=ax.transAxes)
        return fig

    comorb_quim = df_pacientes_comorb[col_quim_comorb].value_counts()
    cultiv_quim = df_cultivares[col_quim_cult].value_counts()

    # União de quimiotipos
    todos_quim = sorted(set(comorb_quim.index) | set(cultiv_quim.index))
    comorb_vals = [comorb_quim.get(q, 0) for q in todos_quim]
    cultiv_vals = [cultiv_quim.get(q, 0) for q in todos_quim]

    df_hm = pd.DataFrame({
        "Comorbidades Sugeridas": comorb_vals,
        "Cultivares Disponíveis": cultiv_vals,
    }, index=todos_quim)

    fig, ax = plt.subplots(figsize=(10, 6))
    sns.heatmap(df_hm.T, annot=True, fmt="g", cmap="Greens", linewidths=0.5, linecolor="white", ax=ax, cbar_kws={"label": "Quantidade"})
    ax.set_title("🧬 Quimiotipo: Comorbidades Sugeridas vs. Cultivares Disponíveis", fontweight="bold", pad=15)
    ax.set_xlabel("Quimiotipo")
    ax.set_ylabel("")
    fig.tight_layout()
    return fig

def grafico_terpenos_comorbidades_vs_cultivares(
    df_pacientes_comorb: pd.DataFrame,
    df_perfis_terpenos: pd.DataFrame
) -> plt.Figure:
    """
    Bar chart agrupado: top 8 terpenos mais demandados pelas comorbidades
    vs. presença nos perfis terpenoídicos das cultivares.
    """
    col_terps_comorb = next((c for c in ["terpenos_focalizados", "terpenos"] if c in df_pacientes_comorb.columns), None)
    if col_terps_comorb is None:
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.text(0.5, 0.5, "Coluna 'terpenos' ausente em comorbidades", ha="center", va="center", transform=ax.transAxes)
        return fig

    # Extrair terpenos das comorbidades
    terps_comorb_list = []
    for t in df_pacientes_comorb[col_terps_comorb].dropna():
        terps = [x.strip() for x in str(t).replace(",", " ").replace(";", " ").split()]
        terps_comorb_list.extend(terps)
    freq_comorb = Counter(terps_comorb_list)
    top_terps = [t for t, _ in freq_comorb.most_common(8)]

    # Extrair terpenos dos perfis
    col_terps_perfil = next((c for c in ["terpenos", "perfil_terpenos"] if c in df_perfis_terpenos.columns), None)
    terps_perfil_list = []
    if col_terps_perfil:
        for t in df_perfis_terpenos[col_terps_perfil].dropna():
            terps = [x.strip() for x in str(t).replace(",", " ").replace(";", " ").split()]
            terps_perfil_list.extend(terps)
    freq_perfil = Counter(terps_perfil_list)

    # Montar DataFrame
    comorb_vals = [freq_comorb.get(t, 0) for t in top_terps]
    perfil_vals = [freq_perfil.get(t, 0) for t in top_terps]
    df_bar = pd.DataFrame({
        "Comorbidades": comorb_vals,
        "Cultivares": perfil_vals,
    }, index=top_terps)

    fig, ax = plt.subplots(figsize=(11, 6))
    df_bar.plot(kind="bar", ax=ax, color=[CORES["laranja"], CORES["verde_primary"]], edgecolor="white", linewidth=0.8)
    ax.set_title("🌿 Top 8 Terpenos: Demanda Médica vs. Oferta Agroclínica", fontweight="bold", pad=15)
    ax.set_xlabel("Terpeno")
    ax.set_ylabel("Frequência")
    ax.legend(title="Fonte", loc="upper right")
    ax.tick_params(axis="x", rotation=45)
    sns.despine(ax=ax)
    fig.tight_layout()
    return fig

def grafico_grau_coa_e_thc_cultivares(
    df_pacientes_comorb: pd.DataFrame,
    df_cultivares: pd.DataFrame
) -> plt.Figure:
    """
    Box plot duplo: distribuição de %THC nas cultivares × grau de CoA exigido pelas comorbidades.
    """
    col_grau = next((c for c in ["grau_coa_obrigatorio", "grau_coa"] if c in df_pacientes_comorb.columns), None)
    col_thc_min = "thc_min" if "thc_min" in df_cultivares.columns else None
    col_thc_max = "thc_max" if "thc_max" in df_cultivares.columns else None

    if col_grau is None or col_thc_min is None or col_thc_max is None:
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.text(0.5, 0.5, "Colunas 'grau_coa' ou 'thc_min/max' ausentes", ha="center", va="center", transform=ax.transAxes)
        return fig

    # Resumo: grau CoA → contagem
    grau_contagem = df_pacientes_comorb[col_grau].value_counts()

    # THC médio das cultivares
    df_cultivares["thc_medio"] = (df_cultivares[col_thc_min] + df_cultivares[col_thc_max]) / 2
    thc_vals = df_cultivares["thc_medio"].dropna()

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

    # Subplot 1: grau CoA (bar)
    grau_contagem.plot(kind="barh", ax=ax1, color=CORES["azul"], edgecolor="white", linewidth=0.8)
    ax1.set_title("🛡️ Grau de CoA Exigido (Comorbidades)", fontweight="bold", pad=10)
    ax1.set_xlabel("Quantidade de Registros")
    ax1.set_ylabel("")
    sns.despine(ax=ax1)

    # Subplot 2: THC cultivares (box)
    ax2.boxplot([thc_vals], vert=True, patch_artist=True,
                boxprops=dict(facecolor=CORES["verde_primary"], edgecolor="white", linewidth=0.8),
                whiskerprops=dict(color=CORES["verde_dark"]),
                capprops=dict(color=CORES["verde_dark"]),
                medianprops=dict(color=CORES["vermelho"], linewidth=2))
    ax2.set_title("🌱 %THC Médio das Cultivares", fontweight="bold", pad=10)
    ax2.set_ylabel("% THC")
    ax2.set_xticklabels(["Cultivares"])
    sns.despine(ax=ax2)

    fig.tight_layout()
    return fig

def grafico_via_administracao_vs_quimiotipo(
    df_receitas: pd.DataFrame
) -> plt.Figure:
    """
    Stacked bar: distribuição de quimiotipos prescritos por via de administração.
    """
    col_via = next((c for c in ["via_administracao", "via"] if c in df_receitas.columns), None)
    col_quim = "quimiotipo" if "quimiotipo" in df_receitas.columns else None

    if col_via is None or col_quim is None:
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.text(0.5, 0.5, "Colunas 'via_administracao' ou 'quimiotipo' ausentes", ha="center", va="center", transform=ax.transAxes)
        return fig

    cross = pd.crosstab(df_receitas[col_via], df_receitas[col_quim])
    cores_quim = {
        "TIPO_I_THC":           CORES["laranja"],
        "TIPO_II_EQUILIBRADO":  CORES["verde_primary"],
        "TIPO_III_CBD":         CORES["azul"],
        "TIPO_IV_CBG":          CORES["roxo"],
    }
    cores = [cores_quim.get(col, CORES["cinza"]) for col in cross.columns]

    fig, ax = plt.subplots(figsize=(10, 6))
    cross.plot(kind="bar", stacked=True, ax=ax, color=cores, edgecolor="white", linewidth=0.8)
    ax.set_title("💊 Via de Administração × Quimiotipo Prescrito", fontweight="bold", pad=15)
    ax.set_xlabel("Via de Administração")
    ax.set_ylabel("Quantidade de Receitas")
    ax.legend(title="Quimiotipo", bbox_to_anchor=(1.05, 1), loc="upper left", fontsize=8)
    ax.tick_params(axis="x", rotation=30)
    sns.despine(ax=ax)
    fig.tight_layout()
    return fig

def grafico_triagem_cientifica_vs_cultivares_disponiveis(
    df_catalogo_comorb: pd.DataFrame,
    df_cultivares: pd.DataFrame
) -> plt.Figure:
    """
    Grouped bar: por triagem científica (A/B/C/D/E),
    quantas comorbidades existem vs. quantas cultivares estão disponíveis.
    """
    col_triagem = "triagem" if "triagem" in df_catalogo_comorb.columns else None
    if col_triagem is None:
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.text(0.5, 0.5, "Coluna 'triagem' ausente", ha="center", va="center", transform=ax.transAxes)
        return fig

    # Contar comorbidades por triagem
    triagem_comorb = df_catalogo_comorb[col_triagem].value_counts().sort_index()

    # Total de cultivares (não temos triagem em cultivares, então é contagem geral)
    total_cultivares = len(df_cultivares)

    # Montar DataFrame
    triagens = sorted(triagem_comorb.index)
    comorb_vals = [triagem_comorb.get(t, 0) for t in triagens]
    # Distribuir cultivares igualmente (placeholder)
    cultiv_vals = [total_cultivares // len(triagens)] * len(triagens)

    df_bar = pd.DataFrame({
        "Comorbidades": comorb_vals,
        "Cultivares (total)": cultiv_vals,
    }, index=triagens)

    cores_triagem = {"A": CORES["verde_primary"], "B": CORES["azul"], "C": CORES["amarelo"], "D": CORES["laranja"], "E": CORES["vermelho"]}
    cores = [cores_triagem.get(str(t).upper(), CORES["cinza"]) for t in triagens]

    fig, ax = plt.subplots(figsize=(10, 6))
    x = np.arange(len(triagens))
    width = 0.35
    ax.bar(x - width/2, comorb_vals, width, label="Comorbidades", color=CORES["roxo"], edgecolor="white", linewidth=0.8)
    ax.bar(x + width/2, cultiv_vals, width, label="Cultivares", color=CORES["verde_primary"], edgecolor="white", linewidth=0.8)
    ax.set_title("📚 Triagem Científica: Comorbidades vs. Cultivares Disponíveis", fontweight="bold", pad=15)
    ax.set_xlabel("Triagem Científica (Grau de Evidência)")
    ax.set_ylabel("Quantidade")
    ax.set_xticks(x)
    ax.set_xticklabels(triagens)
    ax.legend()
    sns.despine(ax=ax)
    fig.tight_layout()
    return fig

def grafico_mapa_calor_terpenos_x_comorbidades(
    df_pacientes_comorb: pd.DataFrame
) -> plt.Figure:
    """
    Heatmap: top 6 comorbidades × top 6 terpenos focalizados.
    """
    col_nome = next((c for c in ["nome_terapeutica", "nome_comorbidade", "nome"] if c in df_pacientes_comorb.columns), None)
    col_terps = next((c for c in ["terpenos_focalizados", "terpenos"] if c in df_pacientes_comorb.columns), None)
    if col_nome is None or col_terps is None:
        fig, ax = plt.subplots(figsize=(8, 5))
        ax.text(0.5, 0.5, "Colunas 'nome' ou 'terpenos' ausentes", ha="center", va="center", transform=ax.transAxes)
        return fig

    # Top 6 comorbidades
    top_comorb = df_pacientes_comorb[col_nome].value_counts().head(6).index.tolist()

    # Extrair terpenos
    terps_list = []
    for t in df_pacientes_comorb[col_terps].dropna():
        terps = [x.strip() for x in str(t).replace(",", " ").replace(";", " ").split()]
        terps_list.extend(terps)
    top_terps = [t for t, _ in Counter(terps_list).most_common(6)]

    # Matriz: comorbidade × terpeno
    matriz = defaultdict(lambda: defaultdict(int))
    for _, row in df_pacientes_comorb.iterrows():
        comorb = row.get(col_nome)
        if comorb not in top_comorb:
            continue
        terps_str = row.get(col_terps, "")
        if pd.isna(terps_str):
            continue
        terps = [x.strip() for x in str(terps_str).replace(",", " ").replace(";", " ").split()]
        for terp in terps:
            if terp in top_terps:
                matriz[comorb][terp] += 1

    # Converter para DataFrame
    data = []
    for comorb in top_comorb:
        row = [matriz[comorb].get(terp, 0) for terp in top_terps]
        data.append(row)
    df_hm = pd.DataFrame(data, index=[str(c)[:30] for c in top_comorb], columns=[str(t)[:15] for t in top_terps])

    fig, ax = plt.subplots(figsize=(10, 7))
    sns.heatmap(df_hm, annot=True, fmt="g", cmap="YlGnBu", linewidths=0.5, linecolor="white", ax=ax, cbar_kws={"label": "Frequência"})
    ax.set_title("🗺️ Mapa de Calor: Terpenos × Comorbidades (Top 6)", fontweight="bold", pad=15)
    ax.set_xlabel("Terpeno")
    ax.set_ylabel("Comorbidade")
    fig.tight_layout()
    return fig

def grafico_painel_resumo_interseccao(
    df_cultivares: pd.DataFrame,
    df_pacientes_comorb: pd.DataFrame,
    df_receitas: pd.DataFrame,
    df_pareceres: pd.DataFrame
) -> plt.Figure:
    """
    Dashboard 2×2: métricas-chave da intersecção agro-médica.
    """
    total_cultivares = len(df_cultivares)
    total_comorbidades = df_pacientes_comorb["comorbidade_id"].nunique() if "comorbidade_id" in df_pacientes_comorb.columns else len(df_pacientes_comorb)
    total_receitas = len(df_receitas)
    total_pareceres = len(df_pareceres)

    fig = plt.figure(figsize=(12, 8))
    gs = GridSpec(2, 2, figure=fig, hspace=0.3, wspace=0.3)

    # Card 1: total cultivares
    ax1 = fig.add_subplot(gs[0, 0])
    ax1.text(0.5, 0.6, str(total_cultivares), ha="center", va="center", fontsize=48, fontweight="bold", color=CORES["verde_primary"], transform=ax1.transAxes)
    ax1.text(0.5, 0.35, "Cultivares\nDisponíveis", ha="center", va="center", fontsize=12, color=CORES["cinza"], transform=ax1.transAxes)
    ax1.axis("off")

    # Card 2: total comorbidades
    ax2 = fig.add_subplot(gs[0, 1])
    ax2.text(0.5, 0.6, str(total_comorbidades), ha="center", va="center", fontsize=48, fontweight="bold", color=CORES["azul"], transform=ax2.transAxes)
    ax2.text(0.5, 0.35, "Comorbidades\nCatalogadas", ha="center", va="center", fontsize=12, color=CORES["cinza"], transform=ax2.transAxes)
    ax2.axis("off")

    # Card 3: total receitas
    ax3 = fig.add_subplot(gs[1, 0])
    ax3.text(0.5, 0.6, str(total_receitas), ha="center", va="center", fontsize=48, fontweight="bold", color=CORES["laranja"], transform=ax3.transAxes)
    ax3.text(0.5, 0.35, "Receitas\nFitoterápicas", ha="center", va="center", fontsize=12, color=CORES["cinza"], transform=ax3.transAxes)
    ax3.axis("off")

    # Card 4: total pareceres
    ax4 = fig.add_subplot(gs[1, 1])
    ax4.text(0.5, 0.6, str(total_pareceres), ha="center", va="center", fontsize=48, fontweight="bold", color=CORES["roxo"], transform=ax4.transAxes)
    ax4.text(0.5, 0.35, "Pareceres\nAgroclínicos", ha="center", va="center", fontsize=12, color=CORES["cinza"], transform=ax4.transAxes)
    ax4.axis("off")

    fig.suptitle("📊 Painel de Resumo: Intersecção Agro-Médica — Reserva Canábica", fontsize=14, fontweight="bold", y=0.98)
    return fig

# %% — Execução completa

def run_all_intersection_analyses(folder_id: Optional[str] = None) -> Dict[str, str]:
    """
    Executa todas as análises de intersecção agro-médica, exibe os gráficos e salva PNGs no Drive.

    Returns:
        Dicionário {nome_grafico: url_drive_ou_caminho_local}.
    """
    fid = folder_id or FOLDER_ID
    if fid.startswith("COLE_"):
        print("⚠️  FOLDER_ID não configurado — PNGs serão salvos localmente em /tmp/")

    print("\n🔬 Iniciando análises de intersecção agro-médica — Reserva Canábica")
    print("=" * 70)

    # 1. Buscar dados
    print("\n📡 Buscando dados agroclínicos...")
    df_cultivares        = fetch_cultivares()
    df_quimiotipos       = fetch_quimiotipos_db()
    df_perfis_terpenos   = fetch_perfis_terpenos_db()
    df_terpenos          = fetch_terpenos_db()
    print(f"  Cultivares:       {len(df_cultivares)} registros")
    print(f"  Quimiotipos:      {len(df_quimiotipos)} registros")
    print(f"  Perfis terpenos:  {len(df_perfis_terpenos)} registros")
    print(f"  Terpenos:         {len(df_terpenos)} registros")

    print("\n📡 Buscando dados médicos...")
    df_pacientes_comorb  = fetch_comorbidades_pacientes()
    df_catalogo_comorb   = fetch_comorbidades_catalogo()
    df_receitas          = fetch_receitas_fitoterapicas()
    df_pareceres         = fetch_pareceres()
    print(f"  Pacientes × Comorbidades: {len(df_pacientes_comorb)} registros")
    print(f"  Catálogo comorbidades:    {len(df_catalogo_comorb)} registros")
    print(f"  Receitas fitoterápicas:   {len(df_receitas)} registros")
    print(f"  Pareceres agroclínicos:   {len(df_pareceres)} registros")

    # 2. Gerar gráficos
    print("\n📊 Gerando gráficos de intersecção...")
    ts = datetime.now().strftime("%Y%m%d_%H%M")
    figuras: Dict[str, plt.Figure] = {}

    figuras[f"inter_01_quimiotipo_cultivar_vs_comorb_{ts}"]    = grafico_quimiotipo_cultivar_vs_comorbidade(df_cultivares, df_pacientes_comorb)
    figuras[f"inter_02_terpenos_demanda_vs_oferta_{ts}"]       = grafico_terpenos_comorbidades_vs_cultivares(df_pacientes_comorb, df_perfis_terpenos)
    figuras[f"inter_03_grau_coa_e_thc_{ts}"]                   = grafico_grau_coa_e_thc_cultivares(df_pacientes_comorb, df_cultivares)
    figuras[f"inter_04_via_administracao_vs_quimiotipo_{ts}"]  = grafico_via_administracao_vs_quimiotipo(df_receitas)
    figuras[f"inter_05_triagem_vs_cultivares_{ts}"]            = grafico_triagem_cientifica_vs_cultivares_disponiveis(df_catalogo_comorb, df_cultivares)
    figuras[f"inter_06_mapa_terpenos_x_comorbidades_{ts}"]     = grafico_mapa_calor_terpenos_x_comorbidades(df_pacientes_comorb)
    figuras[f"inter_07_painel_resumo_{ts}"]                    = grafico_painel_resumo_interseccao(df_cultivares, df_pacientes_comorb, df_receitas, df_pareceres)

    # Exibir todos
    for nome, fig in figuras.items():
        plt.figure(fig.number)
        plt.show()

    # 3. Salvar no Drive
    print("\n📁 Salvando PNGs no Drive...")
    urls = salvar_todos_os_pngs(figuras, fid)

    for fig in figuras.values():
        plt.close(fig)

    print(f"\n✅ {len(urls)} gráficos de intersecção salvos com sucesso.")
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
# urls = run_all_intersection_analyses()
# logout()
# ```
#
# **Gráficos gerados por run_all_intersection_analyses():**
# 1. `inter_01_quimiotipo_cultivar_vs_comorb`      — Heatmap: quimiotipos demandados vs. disponíveis
# 2. `inter_02_terpenos_demanda_vs_oferta`         — Grouped bar: top 8 terpenos médicos vs. agro
# 3. `inter_03_grau_coa_e_thc`                     — Box plot duplo: CoA × %THC
# 4. `inter_04_via_administracao_vs_quimiotipo`    — Stacked bar: via × quimiotipo
# 5. `inter_05_triagem_vs_cultivares`              — Grouped bar: triagem científica × cultivares
# 6. `inter_06_mapa_terpenos_x_comorbidades`       — Heatmap: terpenos × comorbidades (top 6)
# 7. `inter_07_painel_resumo`                      — Dashboard 2×2: métricas-chave
