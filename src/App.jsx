import React, { useState, useEffect, useRef, useCallback } from "react";
import { loadData, saveData, subscribe, cloudEnabled } from "./storage.js";
import { onAuthChange, signIn, signOutUser, resetPassword, authErrorMessage } from "./auth.js";

/* ============================================================
   gswmind — organizador pessoal inspirado no Trello,
   com áreas da vida segregadas (cada área = um quadro próprio)
   ============================================================ */

/* ---------- paletas ---------- */

const LABEL_COLORS = [
  { id: "purple", bg: "#7c5cff", text: "#fff" },
  { id: "green", bg: "#2ecc80", text: "#0b2a1a" },
  { id: "orange", bg: "#ff9f43", text: "#3a2200" },
  { id: "red", bg: "#ff5d5d", text: "#fff" },
  { id: "blue", bg: "#4da3ff", text: "#062243" },
  { id: "pink", bg: "#ff6fb5", text: "#3d0a24" },
  { id: "yellow", bg: "#ffd644", text: "#3a2e00" },
  { id: "teal", bg: "#2ed6c3", text: "#00332d" },
];

const BOARD_BGS = [
  { id: "grape", css: "linear-gradient(160deg,#2b1b4d 0%,#7a3fa0 60%,#b05fb8 100%)" },
  { id: "ocean", css: "linear-gradient(160deg,#0b2545 0%,#13567a 55%,#1b8aa6 100%)" },
  { id: "forest", css: "linear-gradient(160deg,#0e2a1c 0%,#1d5c3a 60%,#3d8f5f 100%)" },
  { id: "sunset", css: "linear-gradient(160deg,#3d1635 0%,#a03a52 55%,#e2774d 100%)" },
  { id: "midnight", css: "linear-gradient(160deg,#0d0d14 0%,#1a1a2e 60%,#25253f 100%)" },
  { id: "sand", css: "linear-gradient(160deg,#4a3421 0%,#8a6642 60%,#c2996a 100%)" },
  { id: "ink", css: "#101014" },
  { id: "slate", css: "#1c2230" },
  { id: "wine", css: "#2e1220" },
  { id: "pine", css: "#12241c" },
];

const LIST_COLORS = [
  "#8e97a8", "#4da3ff", "#2ecc80", "#ff9f43",
  "#ff5d5d", "#7c5cff", "#ff6fb5", "#2ed6c3", "#ffd644",
];

const AREA_COLORS = ["#4da3ff", "#2ecc80", "#ff9f43", "#ff6fb5", "#7c5cff", "#2ed6c3", "#ffd644", "#ff5d5d"];

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* ---------- estado inicial ---------- */

const initialData = () => {
  const mkLabels = () => [
    { id: uid(), name: "urgente", color: "red" },
    { id: uid(), name: "rápido", color: "green" },
  ];
  return {
    version: 1,
    boards: [
      {
        id: uid(), name: "Work", color: "#4da3ff", bg: "grape", labels: mkLabels(),
        lists: [
          { id: uid(), name: "em andamento", color: "#4da3ff", cards: [{ id: uid(), title: "task x", desc: "", labels: [], due: "", done: false }] },
          { id: uid(), name: "concluído", color: "#2ecc80", cards: [] },
        ],
      },
      { id: uid(), name: "Rotina", color: "#2ecc80", bg: "forest", labels: mkLabels(), lists: [
        { id: uid(), name: "hoje", color: "#ffd644", cards: [] },
        { id: uid(), name: "feito", color: "#2ecc80", cards: [] },
      ]},
      { id: uid(), name: "Estudos", color: "#ff9f43", bg: "ocean", labels: mkLabels(), lists: [
        { id: uid(), name: "quero aprender", color: "#7c5cff", cards: [] },
        { id: uid(), name: "estudando", color: "#4da3ff", cards: [] },
        { id: uid(), name: "dominado", color: "#2ecc80", cards: [] },
      ]},
      { id: uid(), name: "Metas pessoais", color: "#ff6fb5", bg: "sunset", labels: mkLabels(), lists: [
        { id: uid(), name: "sonhos", color: "#ff6fb5", cards: [] },
        { id: uid(), name: "em progresso", color: "#ff9f43", cards: [] },
        { id: uid(), name: "conquistado", color: "#2ecc80", cards: [] },
      ]},
    ],
  };
};

/* ---------- helpers ---------- */

const labelColor = (cid) => LABEL_COLORS.find((c) => c.id === cid) || LABEL_COLORS[0];
const bgCss = (bgId) => (BOARD_BGS.find((b) => b.id === bgId) || BOARD_BGS[0]).css;

const fmtDue = (iso) => {
  if (!iso) return null;
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
};
const dueState = (iso, done) => {
  if (!iso || done) return "neutral";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(iso + "T00:00:00");
  if (d < today) return "late";
  const diff = (d - today) / 86400000;
  return diff <= 1 ? "soon" : "neutral";
};

/* ============================================================ */

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      setAuthChecked(true);
    });
    return unsub;
  }, []);

  if (!cloudEnabled) {
    // Sem Firebase configurado: usa o app direto, sem login, salvando local.
    return <MainApp uid="local" onSignOut={null} userEmail={null} />;
  }

  if (!authChecked) {
    return (
      <div style={{ minHeight: "100vh", background: "#101014", display: "flex", alignItems: "center", justifyContent: "center", color: "#8e97a8", fontFamily: "Inter, sans-serif" }}>
        <GlobalStyle />
        carregando…
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <MainApp uid={user.uid} onSignOut={signOutUser} userEmail={user.email} />;
}

/* ============================ LOGIN ============================ */

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setInfo("");
    if (!email.trim() || !password) { setError("Preencha e-mail e senha."); return; }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    setError(""); setInfo("");
    if (!email.trim()) { setError("Digite seu e-mail no campo acima primeiro."); return; }
    setBusy(true);
    try {
      await resetPassword(email.trim());
      setInfo("Enviamos um link para redefinir sua senha nesse e-mail.");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", background: "linear-gradient(160deg,#101014 0%,#181822 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Inter', sans-serif" }}>
      <GlobalStyle />
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="gswmind"
            style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", margin: "0 auto 12px", display: "block", boxShadow: "0 0 0 1px rgba(255,255,255,.08), 0 8px 24px rgba(0,0,0,.4)" }} />
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: "#e8eaf0" }}>
            gswmind<span style={{ color: "#7c5cff" }}>.</span>
          </div>
          <div style={{ fontSize: 13, color: "#6b7180", marginTop: 4 }}>seu organizador pessoal, sincronizado</div>
        </div>

        <form onSubmit={submit} style={{ background: "#17171d", border: "1px solid #26262e", borderRadius: 16, padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 12, color: "#8e97a8" }}>E-mail</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
              style={{ background: "#1c1c24", border: "1px solid #34343f", borderRadius: 9, padding: "10px 12px", color: "#e8eaf0", fontSize: 14, outline: "none" }} />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 12, color: "#8e97a8" }}>Senha</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="sua senha"
              style={{ background: "#1c1c24", border: "1px solid #34343f", borderRadius: 9, padding: "10px 12px", color: "#e8eaf0", fontSize: 14, outline: "none" }} />
          </label>

          {error && <div style={{ fontSize: 12.5, color: "#ff8a8a", background: "rgba(255,93,93,.1)", border: "1px solid rgba(255,93,93,.3)", borderRadius: 8, padding: "8px 10px" }}>{error}</div>}
          {info && <div style={{ fontSize: 12.5, color: "#8fe0c8", background: "rgba(46,204,128,.1)", border: "1px solid rgba(46,204,128,.3)", borderRadius: 8, padding: "8px 10px" }}>{info}</div>}

          <button type="submit" disabled={busy}
            style={{ marginTop: 4, background: "#7c5cff", border: "none", borderRadius: 9, padding: "11px 0", color: "#fff", fontSize: 14, fontWeight: 700, opacity: busy ? 0.6 : 1 }}>
            {busy ? "aguarde…" : "Entrar"}
          </button>

          <button type="button" onClick={forgot} disabled={busy}
            style={{ background: "none", border: "none", color: "#8e97a8", fontSize: 12.5, marginTop: -2 }}>
            Esqueci minha senha
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: 11.5, color: "#4a4e5a", marginTop: 14 }}>
          Acesso restrito. Só contas cadastradas pelo administrador entram.
        </div>
      </div>
    </div>
  );
}

/* ============================ APP PRINCIPAL ============================ */

function MainApp({ uid, onSignOut, userEmail }) {
  const [data, setData] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const saveTimer = useRef(null);
  const lastJson = useRef("");

  /* --- carregar --- */
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    (async () => {
      let d = null;
      try {
        d = await loadData(uid);
      } catch (e) { console.error("Erro ao carregar:", e); }
      if (cancelled) return;
      if (!d || !d.boards || !d.boards.length) d = initialData();
      lastJson.current = JSON.stringify(d);
      setData(d);
      setActiveId(d.boards[0].id);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [uid]);

  /* --- sync em tempo real vindo de outros aparelhos --- */
  useEffect(() => {
    const unsub = subscribe(uid, (remote, json) => {
      if (json === lastJson.current) return; // nada mudou
      lastJson.current = json;
      setData(remote);
      setActiveId((cur) =>
        remote.boards.some((b) => b.id === cur) ? cur : remote.boards[0]?.id
      );
    });
    return unsub;
  }, [uid]);

  /* --- salvar (debounce) --- */
  const persist = useCallback((d) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState("saving");
    saveTimer.current = setTimeout(async () => {
      try {
        lastJson.current = await saveData(uid, d);
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      } catch (e) {
        console.error("Erro ao salvar:", e);
        setSaveState("error");
      }
    }, 500);
  }, [uid]);

  const update = useCallback((fn) => {
    setData((prev) => {
      const next = fn(structuredClone(prev));
      persist(next);
      return next;
    });
  }, [persist]);

  if (!loaded || !data) {
    return (
      <div style={{ minHeight: "100vh", background: "#101014", display: "flex", alignItems: "center", justifyContent: "center", color: "#8e97a8", fontFamily: "Inter, sans-serif" }}>
        <GlobalStyle />
        abrindo seus quadros…
      </div>
    );
  }

  const board = data.boards.find((b) => b.id === activeId) || data.boards[0];

  return (
    <div style={{ display: "flex", height: "100dvh", overflow: "hidden", fontFamily: "'Inter', sans-serif", background: "#101014", color: "#e8eaf0" }}>
      <GlobalStyle />
      <Sidebar data={data} activeId={board.id} setActiveId={setActiveId} update={update} saveState={saveState} onSignOut={onSignOut} userEmail={userEmail} />
      <Board key={board.id} board={board} update={update} onDeleteBoard={() => {
        if (data.boards.length === 1) return;
        update((d) => { d.boards = d.boards.filter((b) => b.id !== board.id); return d; });
        const rest = data.boards.filter((b) => b.id !== board.id);
        setActiveId(rest[0].id);
      }} canDelete={data.boards.length > 1} />
    </div>
  );
}

function GlobalStyle() {
  return (
    <style>{`
      html, body, #root { margin: 0; padding: 0; height: 100%; background: #101014; }
      * { box-sizing: border-box; }
      *::-webkit-scrollbar { height: 10px; width: 10px; }
      *::-webkit-scrollbar-thumb { background: rgba(255,255,255,.18); border-radius: 8px; }
      *::-webkit-scrollbar-track { background: transparent; }
      input, textarea, select, button { font-family: 'Inter', sans-serif; }
      button { cursor: pointer; }
      .card-hover:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(0,0,0,.35); }
      @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
    `}</style>
  );
}

/* ============================ SIDEBAR ============================ */

function Sidebar({ data, activeId, setActiveId, update, saveState, onSignOut, userEmail }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [collapsed, setCollapsed] = useState(() => (typeof window !== "undefined" ? window.innerWidth < 640 : false));

  const addBoard = () => {
    const n = name.trim();
    if (!n) { setAdding(false); return; }
    const id = uid();
    update((d) => {
      d.boards.push({
        id, name: n,
        color: AREA_COLORS[d.boards.length % AREA_COLORS.length],
        bg: BOARD_BGS[d.boards.length % BOARD_BGS.length].id,
        labels: [],
        lists: [
          { id: uid(), name: "a fazer", color: "#8e97a8", cards: [] },
          { id: uid(), name: "em andamento", color: "#4da3ff", cards: [] },
          { id: uid(), name: "concluído", color: "#2ecc80", cards: [] },
        ],
      });
      return d;
    });
    setName(""); setAdding(false); setActiveId(id);
  };

  if (collapsed) {
    return (
      <div style={{ width: 52, flexShrink: 0, background: "#141419", borderRight: "1px solid #26262e", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 14, gap: 10 }}>
        <button onClick={() => setCollapsed(false)} title="Abrir menu" style={{ background: "none", border: "none", color: "#8e97a8", fontSize: 18 }}>»</button>
        {data.boards.map((b) => (
          <button key={b.id} onClick={() => setActiveId(b.id)} title={b.name}
            style={{ width: 26, height: 26, borderRadius: 8, border: b.id === activeId ? `2px solid ${b.color}` : "2px solid transparent", background: b.color + "33" }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ width: 232, flexShrink: 0, background: "#141419", borderRight: "1px solid #26262e", display: "flex", flexDirection: "column", padding: "16px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 6px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
          <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1, color: "#e8eaf0" }}>
            gswmind<span style={{ color: "#7c5cff" }}>.</span>
          </div>
        </div>
        <button onClick={() => setCollapsed(true)} title="Recolher menu" style={{ background: "none", border: "none", color: "#8e97a8", fontSize: 16 }}>«</button>
      </div>

      <div style={{ fontSize: 11, letterSpacing: 1.4, textTransform: "uppercase", color: "#6b7180", padding: "4px 8px 8px" }}>áreas da vida</div>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
        {data.boards.map((b) => {
          const active = b.id === activeId;
          const total = b.lists.reduce((n, l) => n + l.cards.length, 0);
          return (
            <button key={b.id} onClick={() => setActiveId(b.id)}
              style={{
                display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: 10,
                background: active ? "rgba(255,255,255,.07)" : "transparent",
                border: "1px solid " + (active ? "rgba(255,255,255,.12)" : "transparent"),
                color: active ? b.color : "#c3c8d4", fontSize: 14, fontWeight: active ? 700 : 500,
                textAlign: "left",
              }}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: b.color, flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
              <span style={{ fontSize: 11, color: "#6b7180" }}>{total || ""}</span>
            </button>
          );
        })}

        {adding ? (
          <div style={{ padding: "6px 4px" }}>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addBoard(); if (e.key === "Escape") setAdding(false); }}
              placeholder="nome da área…"
              style={{ width: "100%", background: "#1c1c24", border: "1px solid #34343f", borderRadius: 8, padding: "8px 10px", color: "#e8eaf0", fontSize: 13, outline: "none" }} />
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button onClick={addBoard} style={{ flex: 1, background: "#7c5cff", border: "none", borderRadius: 8, padding: "6px 0", color: "#fff", fontSize: 12.5, fontWeight: 600 }}>Criar área</button>
              <button onClick={() => setAdding(false)} style={{ background: "none", border: "none", color: "#8e97a8", fontSize: 12.5 }}>cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 10, background: "none", border: "1px dashed #34343f", color: "#8e97a8", fontSize: 13.5, marginTop: 6 }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> nova área
          </button>
        )}
      </div>

      <div style={{ padding: "10px 8px 0", fontSize: 11.5, color: saveState === "error" ? "#ff5d5d" : "#5c6270", minHeight: 34 }}>
        <div>
          {saveState === "saving" && "salvando…"}
          {saveState === "saved" && "✓ tudo salvo"}
          {saveState === "error" && "erro ao salvar — verifique a conexão"}
        </div>
        <div style={{ marginTop: 2, color: "#424652" }}>
          {cloudEnabled ? "☁ sync ligado" : "💾 salvando só neste aparelho"}
        </div>
      </div>

      {onSignOut && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid #26262e" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, color: "#c3c8d4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={userEmail}>{userEmail}</div>
          </div>
          <button onClick={() => { if (window.confirm("Sair da sua conta?")) onSignOut(); }}
            title="Sair" style={{ background: "none", border: "1px solid #34343f", borderRadius: 7, color: "#8e97a8", fontSize: 11, padding: "5px 9px" }}>
            sair
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================ BOARD ============================ */

function Board({ board, update, onDeleteBoard, canDelete }) {
  const [menu, setMenu] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(board.name);
  const [addingList, setAddingList] = useState(false);
  const [listName, setListName] = useState("");
  const [openCard, setOpenCard] = useState(null);
  const drag = useRef(null);
  const [dragOver, setDragOver] = useState(null);

  const mutBoard = (fn) => update((d) => { const b = d.boards.find((x) => x.id === board.id); fn(b); return d; });

  const saveName = () => {
    const n = nameDraft.trim();
    if (n) mutBoard((b) => { b.name = n; });
    setEditingName(false);
  };

  const addList = () => {
    const n = listName.trim();
    if (!n) { setAddingList(false); return; }
    mutBoard((b) => b.lists.push({ id: uid(), name: n, color: LIST_COLORS[b.lists.length % LIST_COLORS.length], cards: [] }));
    setListName(""); setAddingList(false);
  };

  const onCardDragStart = (listId, cardId) => (e) => {
    drag.current = { type: "card", cardId, fromList: listId };
    e.dataTransfer.effectAllowed = "move";
  };
  const onListDragStart = (listId) => (e) => {
    drag.current = { type: "list", listId };
    e.dataTransfer.effectAllowed = "move";
  };
  const dropCard = (toListId, toIndex) => {
    const d = drag.current;
    if (!d || d.type !== "card") return;
    mutBoard((b) => {
      const from = b.lists.find((l) => l.id === d.fromList);
      const to = b.lists.find((l) => l.id === toListId);
      const idx = from.cards.findIndex((c) => c.id === d.cardId);
      if (idx === -1) return;
      const [card] = from.cards.splice(idx, 1);
      let insert = toIndex;
      if (from === to && idx < toIndex) insert -= 1;
      to.cards.splice(Math.max(0, Math.min(insert, to.cards.length)), 0, card);
    });
    drag.current = null; setDragOver(null);
  };
  const dropList = (toIndex) => {
    const d = drag.current;
    if (!d || d.type !== "list") return;
    mutBoard((b) => {
      const idx = b.lists.findIndex((l) => l.id === d.listId);
      if (idx === -1) return;
      const [l] = b.lists.splice(idx, 1);
      let insert = toIndex;
      if (idx < toIndex) insert -= 1;
      b.lists.splice(Math.max(0, Math.min(insert, b.lists.length)), 0, l);
    });
    drag.current = null; setDragOver(null);
  };

  const currentCard = openCard
    ? (() => {
        const l = board.lists.find((x) => x.id === openCard.listId);
        const c = l && l.cards.find((x) => x.id === openCard.cardId);
        return c ? { list: l, card: c } : null;
      })()
    : null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: bgCss(board.bg), minWidth: 0, position: "relative" }}>
      {/* header do quadro */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", background: "rgba(0,0,0,.28)", backdropFilter: "blur(6px)", flexWrap: "wrap" }}>
        {editingName ? (
          <input autoFocus value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
            onBlur={saveName} onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false); }}
            style={{ fontSize: 20, fontWeight: 800, background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.25)", borderRadius: 8, color: "#fff", padding: "4px 10px", outline: "none" }} />
        ) : (
          <h1 onClick={() => { setNameDraft(board.name); setEditingName(true); }} title="Clique para renomear"
            style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.3, margin: 0, color: "#fff", cursor: "text", textShadow: "0 2px 8px rgba(0,0,0,.4)" }}>
            {board.name}
          </h1>
        )}
        <div style={{ flex: 1 }} />
        <HeaderBtn active={menu === "labels"} onClick={() => setMenu(menu === "labels" ? null : "labels")}>🏷 etiquetas</HeaderBtn>
        <HeaderBtn active={menu === "bg"} onClick={() => setMenu(menu === "bg" ? null : "bg")}>🎨 fundo</HeaderBtn>
        <HeaderBtn active={menu === "settings"} onClick={() => setMenu(menu === "settings" ? null : "settings")}>⋯</HeaderBtn>
      </div>

      {menu === "bg" && (
        <Popover onClose={() => setMenu(null)} title="Fundo do quadro">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
            {BOARD_BGS.map((bg) => (
              <button key={bg.id} onClick={() => { mutBoard((b) => { b.bg = bg.id; }); }}
                title={bg.id}
                style={{ height: 44, borderRadius: 8, background: bg.css, border: board.bg === bg.id ? "2px solid #fff" : "2px solid rgba(255,255,255,.15)" }} />
            ))}
          </div>
        </Popover>
      )}

      {menu === "labels" && (
        <Popover onClose={() => setMenu(null)} title="Etiquetas desta área">
          <LabelManager board={board} mutBoard={mutBoard} />
        </Popover>
      )}

      {menu === "settings" && (
        <Popover onClose={() => setMenu(null)} title="Área">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 12.5, color: "#8e97a8" }}>Cor da área no menu:</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {AREA_COLORS.map((c) => (
                <button key={c} onClick={() => mutBoard((b) => { b.color = c; })}
                  style={{ width: 26, height: 26, borderRadius: 99, background: c, border: board.color === c ? "2px solid #fff" : "2px solid transparent" }} />
              ))}
            </div>
            <button disabled={!canDelete}
              onClick={() => { if (window.confirm(`Excluir a área "${board.name}" e tudo dentro dela?`)) { setMenu(null); onDeleteBoard(); } }}
              style={{ marginTop: 6, background: "rgba(255,93,93,.12)", border: "1px solid rgba(255,93,93,.4)", color: "#ff8a8a", borderRadius: 8, padding: "8px 10px", fontSize: 13, opacity: canDelete ? 1 : 0.4 }}>
              Excluir esta área
            </button>
            {!canDelete && <div style={{ fontSize: 11.5, color: "#8e97a8" }}>Você precisa ter pelo menos uma área.</div>}
          </div>
        </Popover>
      )}

      {/* listas */}
      <div style={{ flex: 1, overflowX: "auto", overflowY: "hidden", display: "flex", alignItems: "flex-start", gap: 14, padding: "16px 16px 22px" }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); if (drag.current && drag.current.type === "list") dropList(board.lists.length); }}>
        {board.lists.map((list, li) => (
          <ListColumn key={list.id} list={list} index={li} board={board} mutBoard={mutBoard}
            onOpenCard={(cardId) => setOpenCard({ listId: list.id, cardId })}
            onCardDragStart={onCardDragStart} onListDragStart={onListDragStart}
            dropCard={dropCard} dropList={dropList}
            dragRef={drag} dragOver={dragOver} setDragOver={setDragOver} />
        ))}

        <div style={{ flexShrink: 0, width: 264 }}>
          {addingList ? (
            <div style={{ background: "rgba(10,10,14,.72)", backdropFilter: "blur(6px)", border: "1.5px solid rgba(255,255,255,.25)", borderRadius: 16, padding: 10 }}>
              <input autoFocus value={listName} onChange={(e) => setListName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addList(); if (e.key === "Escape") setAddingList(false); }}
                placeholder="nome da lista…"
                style={{ width: "100%", background: "#1c1c24", border: "1px solid #34343f", borderRadius: 8, padding: "8px 10px", color: "#e8eaf0", fontSize: 13, outline: "none" }} />
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button onClick={addList} style={{ background: "#7c5cff", border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", fontSize: 12.5, fontWeight: 600 }}>Adicionar lista</button>
                <button onClick={() => setAddingList(false)} style={{ background: "none", border: "none", color: "#c3c8d4", fontSize: 12.5 }}>cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingList(true)}
              style={{ width: "100%", background: "rgba(10,10,14,.35)", border: "1.5px dashed rgba(255,255,255,.35)", borderRadius: 16, padding: "14px 12px", color: "#fff", fontSize: 14, textAlign: "left" }}>
              + adicionar outra lista
            </button>
          )}
        </div>
      </div>

      {currentCard && (
        <CardModal board={board} list={currentCard.list} card={currentCard.card}
          mutBoard={mutBoard} onClose={() => setOpenCard(null)} />
      )}
    </div>
  );
}

function HeaderBtn({ children, onClick, active }) {
  return (
    <button onClick={onClick}
      style={{ background: active ? "rgba(255,255,255,.22)" : "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.18)", color: "#fff", borderRadius: 9, padding: "7px 12px", fontSize: 13 }}>
      {children}
    </button>
  );
}

function Popover({ title, children, onClose }) {
  return (
    <div style={{ position: "absolute", top: 56, right: 14, zIndex: 40, width: "min(300px, calc(100vw - 28px))", background: "#17171d", border: "1px solid #34343f", borderRadius: 14, padding: 14, boxShadow: "0 18px 50px rgba(0,0,0,.5)" }}>
      <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#e8eaf0", flex: 1 }}>{title}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#8e97a8", fontSize: 16 }}>✕</button>
      </div>
      {children}
    </div>
  );
}

/* ============================ LISTA ============================ */

function ListColumn({ list, index, board, mutBoard, onOpenCard, onCardDragStart, onListDragStart, dropCard, dropList, dragRef, dragOver, setDragOver }) {
  const [editName, setEditName] = useState(false);
  const [draft, setDraft] = useState(list.name);
  const [adding, setAdding] = useState(false);
  const [cardTitle, setCardTitle] = useState("");
  const [showColors, setShowColors] = useState(false);

  const mutList = (fn) => mutBoard((b) => { const l = b.lists.find((x) => x.id === list.id); fn(l, b); });

  const saveName = () => { const n = draft.trim(); if (n) mutList((l) => { l.name = n; }); setEditName(false); };
  const addCard = () => {
    const t = cardTitle.trim();
    if (!t) { setAdding(false); return; }
    mutList((l) => l.cards.push({ id: uid(), title: t, desc: "", labels: [], due: "", done: false }));
    setCardTitle("");
  };

  const isCardDrag = () => dragRef.current && dragRef.current.type === "card";
  const isListDrag = () => dragRef.current && dragRef.current.type === "list";

  return (
    <div draggable onDragStart={onListDragStart(list.id)}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => {
        e.preventDefault(); e.stopPropagation();
        if (isListDrag()) dropList(index);
        else if (isCardDrag()) dropCard(list.id, list.cards.length);
      }}
      style={{
        flexShrink: 0, width: 264, maxHeight: "100%", display: "flex", flexDirection: "column",
        background: "rgba(10,10,14,.72)", backdropFilter: "blur(6px)",
        border: `1.5px solid ${list.color}`, borderRadius: 16,
        boxShadow: `0 4px 24px rgba(0,0,0,.28)`,
      }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px 6px", cursor: "grab" }}>
        {editName ? (
          <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={saveName}
            onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditName(false); }}
            style={{ flex: 1, minWidth: 0, background: "#1c1c24", border: "1px solid #34343f", borderRadius: 7, color: "#e8eaf0", padding: "3px 8px", fontSize: 14, fontWeight: 600, outline: "none" }} />
        ) : (
          <div onClick={() => { setDraft(list.name); setEditName(true); }} title="Clique para renomear"
            style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: list.color, cursor: "text", lineHeight: 1.2 }}>
            {list.name}
          </div>
        )}
        <span style={{ fontSize: 11.5, color: "#8e97a8" }}>{list.cards.length}</span>
        <button onClick={() => setShowColors(!showColors)} title="Cor da lista"
          style={{ width: 18, height: 18, borderRadius: 6, background: list.color, border: "1px solid rgba(255,255,255,.35)" }} />
        <button onClick={() => { if (window.confirm(`Excluir a lista "${list.name}"?`)) mutBoard((b) => { b.lists = b.lists.filter((x) => x.id !== list.id); }); }}
          title="Excluir lista" style={{ background: "none", border: "none", color: "#6b7180", fontSize: 14, padding: 0 }}>✕</button>
      </div>

      {showColors && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", padding: "0 12px 8px" }}>
          {LIST_COLORS.map((c) => (
            <button key={c} onClick={() => { mutList((l) => { l.color = c; }); setShowColors(false); }}
              style={{ width: 20, height: 20, borderRadius: 6, background: c, border: list.color === c ? "2px solid #fff" : "2px solid transparent" }} />
          ))}
        </div>
      )}

      <div style={{ overflowY: "auto", padding: "2px 10px", display: "flex", flexDirection: "column", gap: 8, minHeight: 24 }}>
        {list.cards.map((card, ci) => (
          <React.Fragment key={card.id}>
            <div
              onDragOver={(e) => { if (isCardDrag()) { e.preventDefault(); e.stopPropagation(); setDragOver(list.id + ":" + ci); } }}
              onDrop={(e) => { if (isCardDrag()) { e.preventDefault(); e.stopPropagation(); dropCard(list.id, ci); } }}
              style={{ height: dragOver === list.id + ":" + ci ? 34 : 0, transition: "height .12s", borderRadius: 10, background: dragOver === list.id + ":" + ci ? "rgba(255,255,255,.12)" : "transparent", margin: dragOver === list.id + ":" + ci ? "0 0 2px" : 0 }} />
            <CardItem card={card} board={board}
              onClick={() => onOpenCard(card.id)}
              onDragStart={onCardDragStart(list.id, card.id)}
              onToggleDone={(e) => { e.stopPropagation(); mutList((l) => { const c = l.cards.find((x) => x.id === card.id); c.done = !c.done; }); }} />
          </React.Fragment>
        ))}
        <div
          onDragOver={(e) => { if (isCardDrag()) { e.preventDefault(); e.stopPropagation(); setDragOver(list.id + ":end"); } }}
          onDragLeave={() => setDragOver(null)}
          onDrop={(e) => { if (isCardDrag()) { e.preventDefault(); e.stopPropagation(); dropCard(list.id, list.cards.length); } }}
          style={{ height: dragOver === list.id + ":end" ? 34 : 8, transition: "height .12s", borderRadius: 10, background: dragOver === list.id + ":end" ? "rgba(255,255,255,.12)" : "transparent" }} />
      </div>

      <div style={{ padding: "4px 10px 10px" }}>
        {adding ? (
          <div>
            <textarea autoFocus value={cardTitle} onChange={(e) => setCardTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addCard(); } if (e.key === "Escape") setAdding(false); }}
              placeholder="título do cartão…" rows={2}
              style={{ width: "100%", resize: "none", background: "#1c1c24", border: "1px solid #34343f", borderRadius: 10, padding: "8px 10px", color: "#e8eaf0", fontSize: 13.5, outline: "none" }} />
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button onClick={addCard} style={{ background: list.color, border: "none", borderRadius: 8, padding: "6px 14px", color: "#0b0b10", fontSize: 12.5, fontWeight: 700 }}>Adicionar</button>
              <button onClick={() => setAdding(false)} style={{ background: "none", border: "none", color: "#8e97a8", fontSize: 12.5 }}>cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            style={{ width: "100%", textAlign: "left", background: "none", border: "none", color: "#9aa1b0", fontSize: 13.5, padding: "6px 4px", borderRadius: 8 }}>
            + adicionar um cartão
          </button>
        )}
      </div>
    </div>
  );
}

/* ============================ CARTÃO ============================ */

function CardItem({ card, board, onClick, onDragStart, onToggleDone }) {
  const ds = dueState(card.due, card.done);
  return (
    <div draggable onDragStart={onDragStart} onClick={onClick} className="card-hover"
      style={{
        background: "#1b1b23", border: "1px solid #2c2c36", borderRadius: 12, padding: "9px 11px",
        cursor: "pointer", transition: "transform .12s, box-shadow .12s", opacity: card.done ? 0.65 : 1,
      }}>
      {card.labels.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6 }}>
          {card.labels.map((lid) => {
            const lab = board.labels.find((x) => x.id === lid);
            if (!lab) return null;
            const c = labelColor(lab.color);
            return <span key={lid} style={{ background: c.bg, color: c.text, fontSize: 10.5, fontWeight: 600, borderRadius: 5, padding: "2px 7px" }}>{lab.name}</span>;
          })}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <button onClick={onToggleDone} title={card.done ? "Reabrir" : "Concluir"}
          style={{
            width: 16, height: 16, marginTop: 2, borderRadius: 99, flexShrink: 0,
            border: `2px solid ${card.done ? "#2ecc80" : "#4a4a58"}`,
            background: card.done ? "#2ecc80" : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center", color: "#0b2a1a", fontSize: 10, fontWeight: 800, padding: 0,
          }}>
          {card.done ? "✓" : ""}
        </button>
        <div style={{ flex: 1, fontSize: 13.5, lineHeight: 1.35, color: "#e8eaf0", textDecoration: card.done ? "line-through" : "none" }}>
          {card.title}
        </div>
      </div>
      {(card.due || card.desc) && (
        <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
          {card.due && (
            <span style={{
              fontSize: 11, fontWeight: 600, borderRadius: 6, padding: "2px 8px",
              background: ds === "late" ? "rgba(255,93,93,.2)" : ds === "soon" ? "rgba(255,159,67,.2)" : "rgba(255,255,255,.08)",
              color: ds === "late" ? "#ff8a8a" : ds === "soon" ? "#ffbe7a" : "#9aa1b0",
            }}>🕑 {fmtDue(card.due)}</span>
          )}
          {card.desc && <span style={{ fontSize: 11, color: "#6b7180" }}>≡ nota</span>}
        </div>
      )}
    </div>
  );
}

/* ============================ MODAL DO CARTÃO ============================ */

function CardModal({ board, list, card, mutBoard, onClose }) {
  const [title, setTitle] = useState(card.title);
  const [desc, setDesc] = useState(card.desc);

  const mutCard = (fn) => mutBoard((b) => {
    const l = b.lists.find((x) => x.id === list.id);
    const c = l && l.cards.find((x) => x.id === card.id);
    if (c) fn(c, l, b);
  });

  const commitTitle = () => { const t = title.trim(); if (t && t !== card.title) mutCard((c) => { c.title = t; }); };
  const commitDesc = () => { if (desc !== card.desc) mutCard((c) => { c.desc = desc; }); };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", backdropFilter: "blur(3px)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 14px 14px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, background: "#17171d", border: `1.5px solid ${list.color}`, borderRadius: 18, padding: 20, boxShadow: "0 30px 80px rgba(0,0,0,.6)" }}>

        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <button onClick={() => mutCard((c) => { c.done = !c.done; })}
            style={{ width: 22, height: 22, marginTop: 4, borderRadius: 99, flexShrink: 0, border: `2px solid ${card.done ? "#2ecc80" : "#4a4a58"}`, background: card.done ? "#2ecc80" : "transparent", color: "#0b2a1a", fontWeight: 800, fontSize: 12, padding: 0 }}>
            {card.done ? "✓" : ""}
          </button>
          <textarea value={title} onChange={(e) => setTitle(e.target.value)} onBlur={commitTitle} rows={1}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", resize: "none", color: "#e8eaf0", fontSize: 18, fontWeight: 700, lineHeight: 1.3 }} />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#8e97a8", fontSize: 18 }}>✕</button>
        </div>
        <div style={{ fontSize: 12, color: "#6b7180", margin: "2px 0 16px 32px" }}>
          na lista <span style={{ color: list.color, fontWeight: 600 }}>{list.name}</span> · área <b>{board.name}</b>
        </div>

        <Section label="Etiquetas">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {board.labels.length === 0 && <span style={{ fontSize: 12.5, color: "#6b7180" }}>Nenhuma etiqueta nesta área ainda — crie em “🏷 etiquetas” no topo do quadro.</span>}
            {board.labels.map((lab) => {
              const on = card.labels.includes(lab.id);
              const c = labelColor(lab.color);
              return (
                <button key={lab.id}
                  onClick={() => mutCard((cd) => { cd.labels = on ? cd.labels.filter((x) => x !== lab.id) : [...cd.labels, lab.id]; })}
                  style={{ background: on ? c.bg : "transparent", color: on ? c.text : "#c3c8d4", border: `1.5px solid ${c.bg}`, borderRadius: 8, padding: "4px 10px", fontSize: 12.5, fontWeight: 600 }}>
                  {lab.name} {on ? "✓" : ""}
                </button>
              );
            })}
          </div>
        </Section>

        <Section label="Data de entrega">
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="date" value={card.due || ""} onChange={(e) => mutCard((c) => { c.due = e.target.value; })}
              style={{ background: "#1c1c24", border: "1px solid #34343f", borderRadius: 8, color: "#e8eaf0", padding: "7px 10px", fontSize: 13, outline: "none", colorScheme: "dark" }} />
            {card.due && <button onClick={() => mutCard((c) => { c.due = ""; })} style={{ background: "none", border: "none", color: "#8e97a8", fontSize: 12.5 }}>remover</button>}
          </div>
        </Section>

        <Section label="Descrição">
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} onBlur={commitDesc}
            placeholder="Adicione detalhes, links, passos…" rows={4}
            style={{ width: "100%", background: "#1c1c24", border: "1px solid #34343f", borderRadius: 10, color: "#e8eaf0", padding: "10px 12px", fontSize: 13.5, lineHeight: 1.5, outline: "none", resize: "vertical" }} />
        </Section>

        <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
          <select value={list.id}
            onChange={(e) => {
              const toId = e.target.value;
              mutBoard((b) => {
                const from = b.lists.find((x) => x.id === list.id);
                const to = b.lists.find((x) => x.id === toId);
                const idx = from.cards.findIndex((x) => x.id === card.id);
                const [c] = from.cards.splice(idx, 1);
                to.cards.push(c);
              });
              onClose();
            }}
            style={{ background: "#1c1c24", border: "1px solid #34343f", borderRadius: 8, color: "#e8eaf0", padding: "7px 10px", fontSize: 13, outline: "none" }}>
            {board.lists.map((l) => <option key={l.id} value={l.id}>mover para: {l.name}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <button onClick={() => { if (window.confirm("Excluir este cartão?")) { mutBoard((b) => { const l = b.lists.find((x) => x.id === list.id); l.cards = l.cards.filter((x) => x.id !== card.id); }); onClose(); } }}
            style={{ background: "rgba(255,93,93,.12)", border: "1px solid rgba(255,93,93,.4)", color: "#ff8a8a", borderRadius: 8, padding: "7px 12px", fontSize: 12.5 }}>
            Excluir cartão
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, letterSpacing: 1.2, textTransform: "uppercase", color: "#6b7180", marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  );
}

/* ============================ ETIQUETAS ============================ */

function LabelManager({ board, mutBoard }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(LABEL_COLORS[0].id);

  const add = () => {
    const n = name.trim();
    if (!n) return;
    mutBoard((b) => b.labels.push({ id: uid(), name: n, color }));
    setName("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto" }}>
        {board.labels.length === 0 && <div style={{ fontSize: 12.5, color: "#6b7180" }}>Nenhuma etiqueta ainda. Crie a primeira abaixo.</div>}
        {board.labels.map((lab) => {
          const c = labelColor(lab.color);
          return (
            <div key={lab.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ flex: 1, background: c.bg, color: c.text, borderRadius: 7, padding: "5px 10px", fontSize: 12.5, fontWeight: 600 }}>{lab.name}</span>
              <button onClick={() => mutBoard((b) => {
                b.labels = b.labels.filter((x) => x.id !== lab.id);
                b.lists.forEach((l) => l.cards.forEach((cd) => { cd.labels = cd.labels.filter((x) => x !== lab.id); }));
              })}
                title="Excluir etiqueta" style={{ background: "none", border: "none", color: "#6b7180", fontSize: 14 }}>✕</button>
            </div>
          );
        })}
      </div>

      <div style={{ borderTop: "1px solid #26262e", paddingTop: 10 }}>
        <input value={name} onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="nome da nova etiqueta…"
          style={{ width: "100%", background: "#1c1c24", border: "1px solid #34343f", borderRadius: 8, padding: "8px 10px", color: "#e8eaf0", fontSize: 13, outline: "none" }} />
        <div style={{ display: "flex", gap: 6, margin: "8px 0" }}>
          {LABEL_COLORS.map((c) => (
            <button key={c.id} onClick={() => setColor(c.id)}
              style={{ width: 24, height: 24, borderRadius: 7, background: c.bg, border: color === c.id ? "2px solid #fff" : "2px solid transparent" }} />
          ))}
        </div>
        <button onClick={add} style={{ background: "#7c5cff", border: "none", borderRadius: 8, padding: "7px 14px", color: "#fff", fontSize: 12.5, fontWeight: 600 }}>Criar etiqueta</button>
      </div>
    </div>
  );
}
