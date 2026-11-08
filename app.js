(function () {
  "use strict";

  // ---------- Setup ----------
  const cfg = window.APP_CONFIG || {};
  const configured =
    cfg.SUPABASE_URL && !/YOUR_/.test(cfg.SUPABASE_URL) &&
    cfg.SUPABASE_ANON_KEY && !/YOUR_/.test(cfg.SUPABASE_ANON_KEY);
  const sb = configured && window.supabase
    ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY)
    : null;

  const TABLE = "responses";
  const TEAM_SIZE = 6;
  const FONT = "'Space Grotesk', system-ui, sans-serif";
  const COLORS = [
    "#FF6B6B", "#FFA94D", "#FFE066", "#8CE99A", "#3BC9DB",
    "#4C8DFF", "#B197FC", "#F783AC", "#C8A27A", "#E9ECEF"
  ];

  const app = document.getElementById("app");
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };

  const STEP_NAME = 0;
  const FIRST_Q = 1;
  const STEP_HOURS = FIRST_Q + QUESTIONS.length;
  const FIRST_LOGI = STEP_HOURS + 1;
  const STEP_AREA = FIRST_LOGI + LOGISTICS.length;
  const STEP_COLOR = STEP_AREA + 1;
  const TOTAL = STEP_COLOR + 1;

  let state = freshState();
  let lastRow = null;
  let autoTimer = null;
  let lastSig = "";
  let compareSel = null;
  let lastRows = [];

  function freshState() {
    return {
      name: store.get("skillsmap_name") || "",
      answers: Array(QUESTIONS.length).fill(null),
      sat: 8, sun: 8, logi: {}, tasks: [], other: "", color: null, step: 0
    };
  }

  // ---------- Helpers ----------
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  const keyOf = n => n.trim().toLowerCase().replace(/\s+/g, " ");
  const $ = id => document.getElementById(id);

  function rgba(hex, a) {
    const h = hex.replace("#", "");
    const n = parseInt(h.length === 3 ? h.split("").map(x => x + x).join("") : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function computeScores(answers) {
    return AXES.map(ax => {
      let s = 0, m = 0;
      QUESTIONS.forEach((q, i) => {
        if (q.axis !== ax.id) return;
        m += Math.max(...q.options.map(o => o.pts));
        const a = answers[i];
        if (a != null && q.options[a]) s += q.options[a].pts;
      });
      return m ? Math.round((s / m) * 100) : 0;
    });
  }

  function extraOf(r) {
    try {
      const a = JSON.parse(r.area);
      if (Array.isArray(a)) return { tasks: a, logi: {} };
      if (a && typeof a === "object") return { tasks: a.tasks || [], logi: a.logi || {} };
    } catch (e) { /* plain text */ }
    return { tasks: r.area ? [r.area] : [], logi: {} };
  }
  const tasksOf = r => extraOf(r).tasks;
  const logiOf = r => extraOf(r).logi;

  function taskLabels() {
    return state.tasks.map(t => t === "other" ? state.other.trim() : TASKS[+t]);
  }

  function tasksValid() {
    return state.tasks.length > 0 && (!state.tasks.includes("other") || state.other.trim().length > 0);
  }

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2400);
  }

  function banner() {
    return sb ? "" : `<p class="warn">Not connected to the database yet. Add the Supabase URL and key in config.js.</p>`;
  }

  function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }

  // ---------- Router ----------
  function route() {
    const h = location.hash;
    if (h.startsWith("#/quiz")) {
      if (state.submitted) { const n = state.name; state = freshState(); state.name = n; }
      renderQuiz();
    }
    else if (h.startsWith("#/result")) renderResult();
    else if (h.startsWith("#/dashboard")) renderDashboard();
    else renderHome();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);

  // ---------- Home ----------
  function renderHome() {
    stopAuto();
    app.innerHTML = `
      <main class="wrap home">
        <div class="badge">NASA Space Apps 2026 · Team 1</div>
        <h1>Skills Map</h1>
        <p class="lead">Answer ${QUESTIONS.length} quick questions so we can split the hackathon work based on what everyone is good at and enjoys. It takes about 5 minutes.</p>
        <div class="stack">
          <a class="btn primary" href="#/quiz">Take the quiz</a>
          <a class="btn ghost" href="#/dashboard">View team dashboard</a>
        </div>
        ${banner()}
      </main>`;
  }

  // ---------- Quiz ----------
  function slider(id, label, val) {
    return `
      <div class="slider">
        <div class="sl-head"><span>${label}</span><b id="${id}v">${val} h</b></div>
        <input type="range" id="${id}" min="0" max="24" step="1" value="${val}">
        <div class="ticks"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
      </div>`;
  }

  function renderQuiz() {
    stopAuto();
    const s = state.step;
    let body = "";

    if (s === STEP_NAME) {
      body = `
        <div class="q-axis">Let's start</div>
        <h2>What's your name?</h2>
        <input id="name" class="input" maxlength="24" placeholder="Your name" value="${esc(state.name)}" autocomplete="off">
        <p class="hint">If you take the quiz again with the same name, your latest answers replace the old ones.</p>
        <button class="btn primary" id="next" ${state.name.trim() ? "" : "disabled"}>Start</button>`;
    } else if (s < STEP_HOURS) {
      const qi = s - FIRST_Q, q = QUESTIONS[qi], ax = AXES.find(a => a.id === q.axis);
      body = `
        <div class="q-axis" style="--ax:${ax.color}">${esc(ax.label)}</div>
        <h2>${esc(q.text)}</h2>
        <div class="options">
          ${q.options.map((o, i) =>
            `<button class="opt ${state.answers[qi] === i ? "sel" : ""}" data-i="${i}">${esc(o.label)}</button>`).join("")}
        </div>`;
    } else if (s === STEP_HOURS) {
      body = `
        <div class="q-axis">Availability</div>
        <h2>How many hours can you work on each day?</h2>
        ${slider("sat", "Saturday 14 Nov", state.sat)}
        ${slider("sun", "Sunday 15 Nov", state.sun)}
        <button class="btn primary" id="next">Next</button>`;
    } else if (s < STEP_AREA) {
      const L = LOGISTICS[s - FIRST_LOGI];
      body = `
        <div class="q-axis">Logistics</div>
        <h2>${esc(L.text)}</h2>
        <div class="options">
          ${L.options.map(o =>
            `<button class="opt ${state.logi[L.id] === o ? "sel" : ""}" data-o="${esc(o)}">${esc(o)}</button>`).join("")}
        </div>`;
    } else if (s === STEP_AREA) {
      const tb = (label, id) => {
        const rk = state.tasks.indexOf(String(id));
        return `<button class="task ${rk >= 0 ? "sel" : ""}" data-t="${id}"><span class="rk">${rk >= 0 ? rk + 1 : ""}</span><span>${esc(label)}</span></button>`;
      };
      body = `
        <div class="q-axis">Preference</div>
        <h2>What would you like to work on?</h2>
        <p class="hint">Pick up to 4 in order of preference. Tap again to remove. Your #1 shows on your card.</p>
        <div class="tasks">${TASKS.map((t, i) => tb(t, i)).join("")}${tb("Other", "other")}</div>
        <input id="other" class="input other-in" maxlength="30" placeholder="Describe your other task" value="${esc(state.other)}" autocomplete="off" ${state.tasks.includes("other") ? "" : "hidden"}>
        <button class="btn primary" id="next" ${tasksValid() ? "" : "disabled"}>Next</button>`;
    } else {
      body = `
        <div class="q-axis">Last step</div>
        <h2>Pick your color</h2>
        <div class="colors">
          ${COLORS.map(c =>
            `<button class="swatch ${state.color === c ? "sel" : ""}" data-c="${c}" style="--c:${c}" aria-label="${c}"></button>`).join("")}
        </div>
        <p class="hint" id="taken"></p>
        <button class="btn primary" id="submit" ${state.color ? "" : "disabled"}>Submit</button>
        <p class="err" id="err"></p>`;
    }

    const pct = Math.round((s / (TOTAL - 1)) * 100);
    app.innerHTML = `
      <main class="wrap quiz">
        <div class="topbar">
          <button class="link" id="back">${s === 0 ? "← Home" : "← Back"}</button>
          <span class="count">${s === 0 ? "" : `${s} / ${TOTAL - 1}`}</span>
        </div>
        <div class="progress"><div style="width:${pct}%"></div></div>
        <section class="slide">${body}</section>
      </main>`;
    bindQuiz();
  }

  function next() {
    state.step = Math.min(state.step + 1, TOTAL - 1);
    renderQuiz();
    window.scrollTo(0, 0);
  }

  function bindQuiz() {
    const s = state.step;
    $("back").onclick = () => {
      if (s === 0) location.hash = "#/";
      else { state.step--; renderQuiz(); }
    };

    if (s === STEP_NAME) {
      const inp = $("name");
      inp.focus();
      inp.oninput = () => { state.name = inp.value; $("next").disabled = !inp.value.trim(); };
      inp.onkeydown = e => { if (e.key === "Enter" && inp.value.trim()) next(); };
      $("next").onclick = next;
    } else if (s < STEP_HOURS) {
      const qi = s - FIRST_Q;
      document.querySelectorAll(".opt").forEach(b => {
        b.onclick = () => {
          state.answers[qi] = +b.dataset.i;
          document.querySelectorAll(".opt").forEach(x => x.classList.remove("sel"));
          b.classList.add("sel");
          setTimeout(next, 200);
        };
      });
    } else if (s === STEP_HOURS) {
      ["sat", "sun"].forEach(k => {
        const r = $(k);
        r.oninput = () => { state[k] = +r.value; $(k + "v").textContent = r.value + " h"; };
      });
      $("next").onclick = next;
    } else if (s < STEP_AREA) {
      const L = LOGISTICS[s - FIRST_LOGI];
      document.querySelectorAll(".opt").forEach(b => {
        b.onclick = () => {
          state.logi[L.id] = b.dataset.o;
          document.querySelectorAll(".opt").forEach(x => x.classList.remove("sel"));
          b.classList.add("sel");
          setTimeout(next, 200);
        };
      });
    } else if (s === STEP_AREA) {
      const other = $("other");
      const refresh = () => {
        document.querySelectorAll(".task").forEach(b => {
          const rk = state.tasks.indexOf(b.dataset.t);
          b.classList.toggle("sel", rk >= 0);
          b.querySelector(".rk").textContent = rk >= 0 ? rk + 1 : "";
        });
        other.hidden = !state.tasks.includes("other");
        $("next").disabled = !tasksValid();
      };
      document.querySelectorAll(".task").forEach(b => {
        b.onclick = () => {
          const id = b.dataset.t, i = state.tasks.indexOf(id);
          if (i >= 0) state.tasks.splice(i, 1);
          else if (state.tasks.length >= 4) { toast("You can pick up to 4. Tap one to remove it."); return; }
          else state.tasks.push(id);
          refresh();
          if (id === "other" && !other.hidden) other.focus();
        };
      });
      other.oninput = () => { state.other = other.value; $("next").disabled = !tasksValid(); };
      $("next").onclick = () => { if (tasksValid()) next(); };
    } else {
      markTakenColors();
      document.querySelectorAll(".swatch").forEach(b => {
        b.onclick = () => {
          state.color = b.dataset.c;
          document.querySelectorAll(".swatch").forEach(x => x.classList.remove("sel"));
          b.classList.add("sel");
          $("submit").disabled = false;
        };
      });
      $("submit").onclick = submit;
    }
  }

  async function markTakenColors() {
    if (!sb) return;
    try {
      const { data } = await sb.from(TABLE).select("name,name_key,color");
      const me = keyOf(state.name);
      const others = (data || []).filter(r => r.name_key !== me);
      const used = {};
      others.forEach(r => { used[r.color] = r.name; });
      document.querySelectorAll(".swatch").forEach(b => {
        if (used[b.dataset.c]) { b.classList.add("taken"); b.title = "Used by " + used[b.dataset.c]; }
      });
      if (others.length && $("taken")) $("taken").textContent = "Dimmed colors are already used by teammates.";
    } catch (e) { /* not critical */ }
  }

  async function submit() {
    const btn = $("submit"), err = $("err");
    const noLogi = LOGISTICS.find(L => !state.logi[L.id]);
    if (noLogi) { err.textContent = `Please answer: ${noLogi.text}`; return; }
    if (!tasksValid()) { err.textContent = "Pick at least one task you'd like to work on."; return; }
    const missing = state.answers.findIndex(a => a == null);
    if (missing !== -1) {
      err.textContent = `Question ${missing + 1} is unanswered. Go back and complete it.`;
      return;
    }
    const row = {
      name_key: keyOf(state.name),
      name: state.name.trim(),
      color: state.color,
      answers: state.answers,
      scores: computeScores(state.answers),
      area: JSON.stringify({ tasks: taskLabels(), logi: state.logi }),
      hours_sat: state.sat,
      hours_sun: state.sun,
      updated_at: new Date().toISOString()
    };
    store.set("skillsmap_name", row.name);

    if (sb) {
      btn.disabled = true;
      btn.textContent = "Saving...";
      const { error } = await sb.from(TABLE).upsert(row, { onConflict: "name_key" });
      if (error) {
        btn.disabled = false;
        btn.textContent = "Submit";
        err.textContent = "Could not save: " + error.message;
        return;
      }
    }
    lastRow = row;
    state.submitted = true;
    location.hash = "#/result";
  }

  // ---------- Result ----------
  async function renderResult() {
    stopAuto();
    if (!lastRow) { location.hash = "#/"; return; }
    await document.fonts.ready;
    app.innerHTML = `
      <main class="wrap">
        <div class="topbar"><a class="link" href="#/">← Home</a></div>
        <h2 class="center">Your skills map</h2>
        ${sb ? `<p class="hint center">Saved to the team dashboard.</p>` : `<p class="warn">Not saved: database not connected.</p>`}
        <div class="card-wrap" id="cw"></div>
        <div class="actions">
          <button class="btn primary" id="cpimg">Copy image</button>
          <button class="btn ghost" id="dlimg">Download image</button>
          <button class="btn ghost" id="cptxt">Copy answers as text</button>
          <a class="btn ghost" href="#/dashboard">Team dashboard</a>
        </div>
        <button class="link center-block" id="retake">Retake the quiz</button>
      </main>`;
    const c = cardCanvas(lastRow);
    $("cw").appendChild(c);
    $("cpimg").onclick = () => copyCanvas(c, fileName(lastRow.name));
    $("dlimg").onclick = () => downloadCanvas(c, fileName(lastRow.name));
    $("cptxt").onclick = () => copyText(rowText(lastRow));
    $("retake").onclick = () => { location.hash = "#/quiz"; };
  }

  // ---------- Dashboard ----------
  async function fetchRows() {
    if (!sb) return [];
    const { data, error } = await sb.from(TABLE).select("*").order("updated_at", { ascending: true });
    if (error) throw error;
    return (data || []).map(r => ({ ...r, scores: computeScores(r.answers) }));
  }

  async function renderDashboard() {
    stopAuto();
    lastSig = "";
    app.innerHTML = `
      <main class="wrap wide">
        <div class="topbar">
          <a class="link" href="#/">← Home</a>
          <button class="link" id="refresh">Refresh</button>
        </div>
        <div class="dash-head">
          <div>
            <h1 class="h-dash">Team dashboard</h1>
            <p class="hint" id="meta">Loading...</p>
          </div>
          <a class="btn primary" href="#/quiz">Take the quiz</a>
        </div>
        ${banner()}
        <div id="dash"></div>
      </main>`;
    $("refresh").onclick = () => { lastSig = ""; loadDash(); };
    await document.fonts.ready;
    await loadDash();
    autoTimer = setInterval(loadDash, 20000);
  }

  async function loadDash() {
    const meta = $("meta"), dash = $("dash");
    if (!meta || !dash) return;
    let rows;
    try { rows = await fetchRows(); }
    catch (e) { meta.textContent = "Could not load: " + e.message; return; }

    meta.textContent = `${rows.length} of ${TEAM_SIZE} responses · updates automatically`;
    const sig = JSON.stringify(rows.map(r => [r.name_key, r.updated_at]));
    if (sig === lastSig) return;
    lastSig = sig;

    if (!rows.length) {
      dash.innerHTML = `<p class="empty">No responses yet. Be the first one!</p>`;
      return;
    }

    lastRows = rows;
    dash.innerHTML = `
      <div class="actions">
        <button class="btn ghost" id="allimg">Copy all as image</button>
        <button class="btn ghost" id="alldl">Download all as image</button>
        <button class="btn ghost" id="alltxt">Copy all answers as text</button>
      </div>
      <h3 class="sec">Individual maps</h3>
      <div class="grid" id="grid"></div>
      <div class="sec-row"><h3 class="sec">Strongest per area</h3>
        <div class="mini"><button class="btn ghost" id="bestimg">Copy image</button><button class="btn ghost" id="besttxt">Copy text</button></div></div>
      <div class="best">${bestPerArea(rows)}</div>
      <h3 class="sec">Compare</h3>
      <p class="hint">Choose who to overlay on the radar.</p>
      <div class="chips" id="chips"></div>
      <div class="panel" id="teamp"></div>
      <div class="sec-row"><h3 class="sec">Availability</h3>
        <div class="mini"><button class="btn ghost" id="avimg">Copy image</button><button class="btn ghost" id="avtxt">Copy text</button></div></div>
      <div class="avail">${availability(rows)}</div>`;

    $("bestimg").onclick = () => copyCanvas(bestCanvas(rows), "team-strongest-per-area");
    $("besttxt").onclick = () => copyText(bestText(rows));
    $("avimg").onclick = () => copyCanvas(availCanvas(rows), "team-availability");
    $("avtxt").onclick = () => copyText(availText(rows));

    renderCompare();

    const grid = $("grid");
    rows.forEach((r, i) => {
      const div = document.createElement("div");
      div.className = "person";
      const c = cardCanvas(r);
      div.appendChild(c);
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `
        <button class="btn ghost" data-a="img">Copy image</button>
        <button class="btn ghost" data-a="txt">Copy text</button>`;
      row.querySelector('[data-a="img"]').onclick = () => copyCanvas(c, fileName(r.name));
      row.querySelector('[data-a="txt"]').onclick = () => copyText(rowText(r));
      div.appendChild(row);
      grid.appendChild(div);
    });

    $("allimg").onclick = () => copyCanvas(allCanvas(rows), "team-skills-map");
    $("alldl").onclick = () => downloadCanvas(allCanvas(rows), "team-skills-map");
    $("alltxt").onclick = () => copyText(allText(rows));
  }

  function bestPerArea(rows) {
    return AXES.map((ax, i) => {
      const top = rows.slice().sort((a, b) => b.scores[i] - a.scores[i]).slice(0, 3);
      return `
        <div class="best-item">
          <h4 style="color:${ax.color}">${esc(ax.label)}</h4>
          <ol>${top.map(r => `<li><span style="color:${r.color}">${esc(r.name)}</span> <span class="s">${r.scores[i]}</span></li>`).join("")}</ol>
        </div>`;
    }).join("");
  }

  function renderCompare() {
    const rows = lastRows, chips = $("chips"), panel = $("teamp");
    if (!chips || !panel || !rows.length) return;
    const keys = rows.map(r => r.name_key);
    if (compareSel) compareSel = compareSel.filter(k => keys.includes(k));
    if (!compareSel || !compareSel.length) {
      const me = keyOf(store.get("skillsmap_name") || "");
      compareSel = [keys.includes(me) ? me : keys[0]];
    }
    const all = compareSel.length === rows.length;
    chips.innerHTML =
      rows.map(r => `<button class="chip ${compareSel.includes(r.name_key) ? "sel" : ""}" data-k="${esc(r.name_key)}" style="--c:${r.color}"><i></i>${esc(r.name)}</button>`).join("") +
      `<button class="chip ghost" id="chipall">${all ? "Clear" : "All"}</button>`;
    chips.querySelectorAll(".chip[data-k]").forEach(b => {
      b.onclick = () => {
        const k = b.dataset.k, i = compareSel.indexOf(k);
        if (i >= 0) { if (compareSel.length > 1) compareSel.splice(i, 1); }
        else compareSel.push(k);
        renderCompare();
      };
    });
    $("chipall").onclick = () => {
      compareSel = all ? [compareSel[0]] : keys.slice();
      renderCompare();
    };
    panel.innerHTML = "";
    panel.appendChild(teamCanvas(rows.filter(r => compareSel.includes(r.name_key))));
  }

  function availability(rows) {
    const bar = (day, h, col) => `
      <div class="av-line"><span class="av-day">${day}</span>
        <div class="av-bar"><div style="width:${(h / 24) * 100}%;background:${col}"></div><span>${h}h</span></div></div>`;
    return rows.map(r => `
      <div class="av-row">
        <div class="av-who"><div class="av-name" style="color:${r.color}">${esc(r.name)}</div>
          <div class="av-logi">${LOGISTICS.map(L => `${L.label}: ${esc(logiOf(r)[L.id] || "-")}`).join("<br>")}</div></div>
        <div class="av-bars">${bar("Sat", r.hours_sat, r.color)}${bar("Sun", r.hours_sun, rgba(r.color, 0.6))}</div>
      </div>`).join("");
  }

  // ---------- Text export ----------
  function rowText(r) {
    const lines = [
      `Name: ${r.name}`,
      `Availability: Saturday ${r.hours_sat}h, Sunday ${r.hours_sun}h`,
      `Preferred tasks (ranked): ${tasksOf(r).map((t, i) => `${i + 1}. ${t}`).join(", ") || "-"}`,
      `Scores (0-100): ` + AXES.map((a, i) => `${a.label} ${r.scores[i]}`).join(", "),
      "",
      "Answers:"
    ];
    LOGISTICS.slice().reverse().forEach(L => lines.splice(2, 0, `${L.label}: ${logiOf(r)[L.id] || "-"}`));
    QUESTIONS.forEach((q, i) => {
      const ax = AXES.find(a => a.id === q.axis);
      const o = q.options[r.answers[i]];
      lines.push(`${i + 1}. [${ax.label}] ${q.text}: ${o ? o.label : "-"}`);
    });
    return lines.join("\n");
  }

  function topOf(rows, i) {
    return rows.slice().sort((a, b) => b.scores[i] - a.scores[i]).slice(0, 3);
  }

  function bestText(rows) {
    return "Strongest per area (top 3, score 0-100)\n\n" + AXES.map((ax, i) =>
      `${ax.label}: ` + topOf(rows, i).map((r, k) => `${k + 1}. ${r.name} ${r.scores[i]}`).join(", ")).join("\n");
  }

  function availText(rows) {
    return "Availability (hours per day)\n\n" + rows.map(r => {
      const l = logiOf(r);
      return `${r.name}: Sat ${r.hours_sat}h, Sun ${r.hours_sun}h · ` +
        LOGISTICS.map(L => `${L.label}: ${l[L.id] || "-"}`).join(" · ");
    }).join("\n");
  }

  function allText(rows) {
    return `Team skills survey for NASA Space Apps 2026 (challenge: Harmonization of MODIS and VIIRS Hot Spots). ` +
      `${rows.length} responses, each one a self-assessment.\n\n` +
      rows.map(rowText).join("\n\n---\n\n");
  }

  // ---------- Clipboard / download ----------
  function fileName(name) {
    return "skills-map-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  async function copyCanvas(c, name) {
    try {
      if (!navigator.clipboard || !window.ClipboardItem) throw new Error("unsupported");
      const blob = new Promise(res => c.toBlob(res, "image/png"));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast("Image copied. Paste it in Telegram.");
    } catch (e) {
      downloadCanvas(c, name);
      toast("Copy not supported here, image downloaded instead.");
    }
  }

  function downloadCanvas(c, name) {
    const a = document.createElement("a");
    a.download = (name || "skills-map") + ".png";
    a.href = c.toDataURL("image/png");
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function copyText(t) {
    try {
      await navigator.clipboard.writeText(t);
      toast("Copied to clipboard.");
    } catch (e) {
      window.prompt("Copy this text:", t);
    }
  }

  // ---------- Canvas drawing ----------
  const CARD_W = 600, CARD_H = 790;

  function makeCanvas(w, h) {
    const d = 2;
    const c = document.createElement("canvas");
    c.width = w * d;
    c.height = h * d;
    c.style.width = "100%";
    c.style.maxWidth = w + "px";
    const ctx = c.getContext("2d");
    ctx.scale(d, d);
    return [c, ctx];
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function fitFont(ctx, text, weight, size, maxW) {
    let s = size;
    ctx.font = `${weight} ${s}px ${FONT}`;
    while (ctx.measureText(text).width > maxW && s > 12) {
      s -= 1;
      ctx.font = `${weight} ${s}px ${FONT}`;
    }
  }

  function drawRadar(ctx, cx, cy, R, sets, opts) {
    const o = opts || {};
    const n = AXES.length;
    const ang = i => -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const pt = (i, v) => {
      const a = ang(i), rr = (R * Math.max(v, 3)) / 100;
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
    };
    ctx.save();

    // grid
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(160,175,230,0.18)";
    for (let k = 1; k <= 4; k++) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = ang(i), rr = (R * k) / 4;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const a = ang(i);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
    }

    // data
    const single = sets.length === 1;
    sets.forEach(s => {
      ctx.beginPath();
      s.values.forEach((v, i) => {
        const [x, y] = pt(i, v);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.closePath();
      ctx.fillStyle = rgba(s.color, single ? 0.28 : 0.1);
      ctx.fill();
      ctx.lineWidth = single ? 3 : 2.5;
      ctx.strokeStyle = s.color;
      ctx.stroke();
      if (single) {
        s.values.forEach((v, i) => {
          const [x, y] = pt(i, v);
          ctx.beginPath();
          ctx.arc(x, y, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = s.color;
          ctx.fill();
        });
      }
    });

    // labels
    const fs = o.labelSize || 15;
    for (let i = 0; i < n; i++) {
      const a = ang(i), c = Math.cos(a), sn = Math.sin(a);
      const lx = cx + c * (R + 18), ly = cy + sn * (R + 18);
      ctx.textAlign = Math.abs(c) < 0.2 ? "center" : c > 0 ? "left" : "right";
      ctx.textBaseline = "middle";
      let y = ly;
      if (sn < -0.9) y -= o.values ? 18 : 6;
      if (sn > 0.9) y += o.values ? 18 : 6;
      ctx.fillStyle = "#d6dcf5";
      ctx.font = `600 ${fs}px ${FONT}`;
      ctx.fillText(AXES[i].short, lx, o.values && single ? y - 9 : y);
      if (o.values && single) {
        ctx.fillStyle = sets[0].color;
        ctx.font = `700 ${fs}px ${FONT}`;
        ctx.fillText(String(sets[0].values[i]), lx, y + 10);
      }
    }
    ctx.restore();
  }

  function drawCard(ctx, x, y, w, h, r) {
    ctx.save();
    roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 24);
    ctx.fillStyle = "#0d1430";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = r.color;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = r.color;
    fitFont(ctx, r.name, 700, 38, w - 60);
    ctx.fillText(r.name, x + w / 2, y + 64);

    ctx.fillStyle = "#8b93b8";
    ctx.font = `500 13px ${FONT}`;
    ctx.fillText("NASA SPACE APPS 2026 · TEAM 1", x + w / 2, y + 90);

    drawRadar(ctx, x + w / 2, y + 345, 150, [{ color: r.color, values: r.scores }], { labelSize: 15, values: true });

    // footer
    ctx.strokeStyle = "rgba(160,175,230,0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 30, y + 580);
    ctx.lineTo(x + w - 30, y + 580);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = "#8b93b8";
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText("WANTS TO WORK ON", x + 30, y + 612);
    const tk = tasksOf(r);
    ctx.fillStyle = r.color;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText("#1", x + 30, y + 646);
    const off = ctx.measureText("#1 ").width;
    ctx.fillStyle = "#ffffff";
    fitFont(ctx, tk[0] || "-", 700, 24, w - 60 - off);
    ctx.fillText(tk[0] || "-", x + 30 + off, y + 646);
    if (tk.length > 1) {
      const rest = tk.slice(1).map((t, i) => `${i + 2}. ${t}`).join("    ");
      ctx.fillStyle = "#aab2d6";
      fitFont(ctx, rest, 500, 15, w - 60);
      ctx.fillText(rest, x + 30, y + 676);
    }

    ctx.fillStyle = "#8b93b8";
    ctx.font = `600 12px ${FONT}`;
    ctx.fillText("AVAILABILITY", x + 30, y + 718);
    ctx.fillStyle = "#e8ecff";
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText(`Sat ${r.hours_sat}h  ·  Sun ${r.hours_sun}h`, x + 30, y + 750);

    ctx.restore();
  }

  function cardCanvas(r) {
    const [c, ctx] = makeCanvas(CARD_W, CARD_H);
    drawCard(ctx, 0, 0, CARD_W, CARD_H, r);
    return c;
  }

  function teamHeight(rows, w) {
    const perRow = Math.max(1, Math.floor((w - 60) / 170));
    return 640 + Math.ceil(rows.length / perRow) * 34;
  }

  function drawTeam(ctx, x, y, w, rows) {
    const h = teamHeight(rows, w);
    ctx.save();
    roundRect(ctx, x + 1, y + 1, w - 2, h - 2, 24);
    ctx.fillStyle = "#0d1430";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(160,175,230,0.25)";
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#e8ecff";
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText("Team overview", x + w / 2, y + 54);
    ctx.fillStyle = "#8b93b8";
    ctx.font = `500 13px ${FONT}`;
    ctx.fillText("NASA SPACE APPS 2026 · TEAM 1", x + w / 2, y + 80);

    drawRadar(ctx, x + w / 2, y + 340, 200, rows.map(r => ({ color: r.color, values: r.scores })), { labelSize: 16 });

    // legend
    const perRow = Math.max(1, Math.floor((w - 60) / 170));
    const ly0 = y + 610;
    rows.forEach((r, i) => {
      const row = Math.floor(i / perRow), col = i % perRow;
      const itemsInRow = Math.min(perRow, rows.length - row * perRow);
      const startX = x + w / 2 - (itemsInRow * 170) / 2;
      const lx = startX + col * 170 + 14, ly = ly0 + row * 34;
      ctx.beginPath();
      ctx.arc(lx, ly, 7, 0, Math.PI * 2);
      ctx.fillStyle = r.color;
      ctx.fill();
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#e8ecff";
      fitFont(ctx, r.name, 600, 16, 135);
      ctx.fillText(r.name, lx + 14, ly);
    });
    ctx.restore();
  }

  function teamCanvas(rows) {
    const w = 720, h = teamHeight(rows, w);
    const [c, ctx] = makeCanvas(w, h);
    drawTeam(ctx, 0, 0, w, rows);
    return c;
  }

  function sheet(ctx, W, H, title) {
    roundRect(ctx, 1, 1, W - 2, H - 2, 24);
    ctx.fillStyle = "#0d1430";
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(160,175,230,0.25)";
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#e8ecff";
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(title, W / 2, 54);
    ctx.fillStyle = "#8b93b8";
    ctx.font = `500 13px ${FONT}`;
    ctx.fillText("NASA SPACE APPS 2026 · TEAM 1", W / 2, 80);
  }

  function bestCanvas(rows) {
    const W = 960, pad = 30, gap = 16, cols = 3, bh = 150, top = 110;
    const bw = (W - pad * 2 - gap * (cols - 1)) / cols;
    const nRows = Math.ceil(AXES.length / cols);
    const H = top + nRows * bh + (nRows - 1) * gap + pad;
    const [c, ctx] = makeCanvas(W, H);
    sheet(ctx, W, H, "Strongest per area");
    AXES.forEach((ax, i) => {
      const x = pad + (i % cols) * (bw + gap), y = top + Math.floor(i / cols) * (bh + gap);
      roundRect(ctx, x, y, bw, bh, 14);
      ctx.fillStyle = "#111a3a";
      ctx.fill();
      ctx.strokeStyle = "rgba(160,175,230,0.16)";
      ctx.stroke();
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = ax.color;
      fitFont(ctx, ax.label.toUpperCase(), 700, 14, bw - 36);
      ctx.fillText(ax.label.toUpperCase(), x + 18, y + 34);
      topOf(rows, i).forEach((r, k) => {
        const ly = y + 70 + k * 28;
        ctx.textAlign = "left";
        ctx.fillStyle = "#8b93b8";
        ctx.font = `600 17px ${FONT}`;
        ctx.fillText(`${k + 1}.`, x + 18, ly);
        ctx.fillStyle = r.color;
        fitFont(ctx, r.name, 600, 17, bw - 110);
        ctx.fillText(r.name, x + 42, ly);
        ctx.textAlign = "right";
        ctx.fillStyle = "#aab2d6";
        ctx.font = `600 17px ${FONT}`;
        ctx.fillText(String(r.scores[i]), x + bw - 18, ly);
      });
    });
    return c;
  }

  function availCanvas(rows) {
    const W = 960, pad = 30, top = 110, rh = 84, nameW = 250;
    const H = top + rows.length * rh + pad - 10;
    const [c, ctx] = makeCanvas(W, H);
    sheet(ctx, W, H, "Availability");
    const bx = pad + nameW, bwMax = W - pad - bx - 40;
    rows.forEach((r, i) => {
      const y = top + i * rh, l = logiOf(r);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      ctx.fillStyle = r.color;
      fitFont(ctx, r.name, 700, 20, nameW - 20);
      ctx.fillText(r.name, pad + 10, y + 22);
      ctx.fillStyle = "#8b93b8";
      LOGISTICS.forEach((L, k) => {
        const t = `${L.label}: ${l[L.id] || "-"}`;
        fitFont(ctx, t, 500, 13, nameW - 20);
        ctx.fillText(t, pad + 10, y + 44 + k * 18);
      });
      [["Sat", r.hours_sat, r.color], ["Sun", r.hours_sun, rgba(r.color, 0.6)]].forEach(([d, h, col], k) => {
        const by = y + 6 + k * 28;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#8b93b8";
        ctx.font = `600 13px ${FONT}`;
        ctx.fillText(d, bx, by + 10);
        roundRect(ctx, bx + 40, by, bwMax, 20, 6);
        ctx.fillStyle = "rgba(160,175,230,0.16)";
        ctx.fill();
        if (h > 0) {
          roundRect(ctx, bx + 40, by, Math.max(12, (bwMax * h) / 24), 20, 6);
          ctx.fillStyle = col;
          ctx.fill();
        }
        ctx.fillStyle = h > 2 ? "#050816" : "#e8ecff";
        ctx.font = `700 12px ${FONT}`;
        ctx.fillText(`${h}h`, bx + 48, by + 10);
      });
    });
    return c;
  }

  function allCanvas(rows) {
    const gap = 40, pad = 40;
    const W = pad * 2 + CARD_W * 2 + gap;
    const cardRows = Math.ceil(rows.length / 2);
    const H = pad + cardRows * (CARD_H + gap) + pad - gap;
    const [c, ctx] = makeCanvas(W, H);
    c.style.maxWidth = "100%";
    ctx.fillStyle = "#070b1d";
    ctx.fillRect(0, 0, W, H);
    rows.forEach((r, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const onlyOne = i === rows.length - 1 && rows.length % 2 === 1;
      const x = onlyOne ? (W - CARD_W) / 2 : pad + col * (CARD_W + gap);
      const y = pad + row * (CARD_H + gap);
      drawCard(ctx, x, y, CARD_W, CARD_H, r);
    });
    return c;
  }

  // ---------- Start ----------
  route();
})();
