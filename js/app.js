/* Favorita Forecast · lógica de la página (sin dependencias salvo Chart.js local) */
(function () {
  "use strict";

  const D = window.FAVORITA;
  if (!D) { document.body.insertAdjacentHTML("afterbegin", '<p style="padding:24px">No se encontró data/data.js. Ejecuta <code>python scripts/build_data.py</code>.</p>'); return; }

  const FC = D.forecast;          // {dates, stores, families, forecast[1782][16]}
  const VAL = D.validation;       // {dates, actual, lightgbm, tweedie}
  const M = D.metrics;            // {models, rolling, shap, params, optuna, ...}
  const NF = FC.families.length;
  const NS = FC.stores.length;

  const FAM_ES = {
    "AUTOMOTIVE": "Automotriz", "BABY CARE": "Cuidado de bebés", "BEAUTY": "Belleza", "BEVERAGES": "Bebidas",
    "BOOKS": "Libros", "BREAD/BAKERY": "Pan y panadería", "CELEBRATION": "Celebración", "CLEANING": "Limpieza",
    "DAIRY": "Lácteos", "DELI": "Delicatessen", "EGGS": "Huevos", "FROZEN FOODS": "Congelados",
    "GROCERY I": "Abarrotes I", "GROCERY II": "Abarrotes II", "HARDWARE": "Ferretería",
    "HOME AND KITCHEN I": "Hogar y cocina I", "HOME AND KITCHEN II": "Hogar y cocina II",
    "HOME APPLIANCES": "Electrodomésticos", "HOME CARE": "Cuidado del hogar", "LADIESWEAR": "Ropa de mujer",
    "LAWN AND GARDEN": "Jardín", "LINGERIE": "Lencería", "LIQUOR,WINE,BEER": "Licores, vino y cerveza",
    "MAGAZINES": "Revistas", "MEATS": "Carnes", "PERSONAL CARE": "Cuidado personal", "PET SUPPLIES": "Mascotas",
    "PLAYERS AND ELECTRONICS": "Electrónica", "POULTRY": "Pollo", "PREPARED FOODS": "Comidas preparadas",
    "PRODUCE": "Frutas y verduras", "SCHOOL AND OFFICE SUPPLIES": "Útiles escolares y oficina", "SEAFOOD": "Mariscos"
  };
  const famLabel = (i) => FAM_ES[FC.families[i]] || FC.families[i];

  const nf0 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 1 });
  const nf4 = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  const nf2 = new Intl.NumberFormat("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (x) => nf2.format(x * 100) + "%";
  const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const short = (s) => { const t = parse(s); return t.getUTCDate() + " " + MONTHS[t.getUTCMonth()]; };
  const dayName = (s) => DAYS[parse(s).getUTCDay()];
  const $ = (id) => document.getElementById(id);
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  /* ---------- Hero KPIs ---------- */
  const best = M.models[0];
  document.querySelector('[data-k="rmsle"]').textContent = nf4.format(best.RMSLE);
  document.querySelector('[data-k="wape"]').textContent = pct(best.WAPE);
  document.querySelector('[data-k="nfeat"]').textContent = M.n_features;

  /* ---------- Agregación ---------- */
  // Devuelve los índices de serie (tienda*NF + familia) que cumplen la selección.
  function seriesIdx(store, fam) {
    const out = [];
    for (let s = 0; s < NS; s++) {
      if (store !== "all" && s !== Number(store)) continue;
      for (let f = 0; f < NF; f++) {
        if (fam !== "all" && f !== Number(fam)) continue;
        out.push(s * NF + f);
      }
    }
    return out;
  }
  function sumByDay(matrix, idx, nDays) {
    const r = new Array(nDays).fill(0);
    for (const i of idx) { const row = matrix[i]; for (let d = 0; d < nDays; d++) r[d] += row[d]; }
    return r;
  }

  /* ---------- Controles ---------- */
  const selStore = $("sel-store"), selFam = $("sel-family"), selFrom = $("sel-from"), selTo = $("sel-to"), chkVal = $("chk-val");
  selStore.innerHTML = '<option value="all">Todas las tiendas</option>' +
    FC.stores.map((s, i) => `<option value="${i}">Tienda ${s}</option>`).join("");
  selFam.innerHTML = '<option value="all">Todas las familias</option>' +
    FC.families.map((_, i) => `<option value="${i}">${famLabel(i)}</option>`).join("");
  const dateOpts = FC.dates.map((d, i) => `<option value="${i}">${short(d)} (${dayName(d).slice(0, 3)})</option>`).join("");
  selFrom.innerHTML = dateOpts; selTo.innerHTML = dateOpts; selTo.value = String(FC.dates.length - 1);
  [selStore, selFam, selFrom, selTo, chkVal].forEach((el) => el.addEventListener("change", () => {
    if (el === selFrom && +selFrom.value > +selTo.value) selTo.value = selFrom.value;
    if (el === selTo && +selTo.value < +selFrom.value) selFrom.value = selTo.value;
    renderExplorer();
  }));

  /* ---------- Gráficos ---------- */
  const charts = {};
  function mk(id, cfg) { if (charts[id]) charts[id].destroy(); charts[id] = new Chart($(id), cfg); return charts[id]; }
  function baseOpts() {
    const grid = css("--line"), tick = css("--muted");
    Chart.defaults.font.family = css("--sans"); Chart.defaults.color = tick;
    return { grid, tick, responsive: true, maintainAspectRatio: false };
  }
  const tipNum = (c) => `${c.dataset.label}: ${nf1.format(c.parsed.y ?? c.parsed.x)}`;

  function renderExplorer() {
    const o = baseOpts();
    const store = selStore.value, fam = selFam.value;
    const from = +selFrom.value, to = +selTo.value;
    const idx = seriesIdx(store, fam);
    const nd = FC.dates.length;
    const fcAll = sumByDay(FC.forecast, idx, nd);
    const rng = fcAll.slice(from, to + 1);
    const rngDates = FC.dates.slice(from, to + 1);

    const storeTxt = store === "all" ? "Todas las tiendas" : `Tienda ${FC.stores[store]}`;
    const famTxt = fam === "all" ? "todas las familias" : famLabel(fam);
    $("ts-title").textContent = `${storeTxt} · ${famTxt}`;

    // KPIs
    const total = rng.reduce((a, b) => a + b, 0);
    const avg = total / rng.length;
    const maxV = Math.max(...rng), minV = Math.min(...rng);
    const peakI = rng.indexOf(maxV);
    $("k-total").textContent = nf0.format(total);
    $("k-avg").textContent = nf1.format(avg);
    $("k-peak").textContent = nf0.format(maxV);
    $("k-peak-l").textContent = `día pico · ${short(rngDates[peakI])}`;
    const vAct = sumByDay(VAL.actual, idx, VAL.dates.length);
    const vPred = sumByDay(VAL.lightgbm, idx, VAL.dates.length);
    const sumAct = vAct.reduce((a, b) => a + b, 0);
    // WAPE a nivel de serie (como en el informe): suma |error| de cada serie-día / suma real.
    let absErr = 0;
    for (const i of idx) for (let d = 0; d < VAL.dates.length; d++) absErr += Math.abs(VAL.lightgbm[i][d] - VAL.actual[i][d]);
    $("k-wape").textContent = sumAct > 0 ? pct(absErr / sumAct) : "n/d";

    // Serie temporal: validación | hueco | pronóstico
    const gap = [""];
    const labels = [...VAL.dates.map(short), ...gap, ...FC.dates.map(short)];
    const nv = VAL.dates.length;
    const padV = (arr) => [...arr, null, ...new Array(nd).fill(null)];
    const padF = [...new Array(nv + 1).fill(null), ...fcAll.map((v, i) => (i >= from && i <= to ? v : null))];
    const showVal = chkVal.checked;
    const ds = [];
    if (showVal) {
      ds.push({ label: "Real (validación)", data: padV(vAct), borderColor: css("--slate"), backgroundColor: css("--slate"), borderWidth: 2, pointRadius: 2, tension: .25 });
      ds.push({ label: "Predicho (validación)", data: padV(vPred), borderColor: css("--teal"), backgroundColor: css("--teal"), borderDash: [6, 4], borderWidth: 2, pointRadius: 0, tension: .25 });
    }
    const fcSeries = { label: "Pronóstico (16–31 ago)", data: showVal ? padF : padF.slice(nv + 1), borderColor: css("--accent"), backgroundColor: css("--accent"), borderWidth: 3, pointRadius: 3, tension: .25 };
    ds.push(fcSeries);
    mk("ch-ts", {
      type: "line",
      data: { labels: showVal ? labels : labels.slice(nv + 1), datasets: ds },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false }, spanGaps: false,
        plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { label: tipNum } } },
        scales: {
          x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } },
          y: { beginAtZero: true, grid: { color: o.grid }, ticks: { callback: (v) => nf0.format(v) }, title: { display: true, text: "Unidades / día" } }
        }
      }
    });

    // Desglose: la otra dimensión (familias si hay una tienda o todas; tiendas si hay familia fija y tiendas = todas)
    let items;
    if (fam === "all") {
      $("bd-title").textContent = "Top 10 familias · total del rango";
      items = FC.families.map((_, f) => {
        let t = 0; for (let s = 0; s < NS; s++) { if (store !== "all" && s !== +store) continue; for (let d = from; d <= to; d++) t += FC.forecast[s * NF + f][d]; }
        return { name: famLabel(f), v: t };
      });
    } else if (store === "all") {
      $("bd-title").textContent = "Top 10 tiendas · total del rango";
      items = FC.stores.map((st, s) => {
        let t = 0; for (let d = from; d <= to; d++) t += FC.forecast[s * NF + +fam][d];
        return { name: "Tienda " + st, v: t };
      });
    } else {
      $("bd-title").textContent = "Pronóstico diario (barras)";
      items = rngDates.map((d, i) => ({ name: short(d), v: rng[i] }));
    }
    const daily = store !== "all" && fam !== "all";
    if (!daily) items = items.sort((a, b) => b.v - a.v).slice(0, 10);
    mk("ch-bd", {
      type: "bar",
      data: { labels: items.map((x) => x.name), datasets: [{ label: "Unidades", data: items.map((x) => x.v), backgroundColor: css("--accent"), borderRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: daily ? "x" : "y",
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${nf1.format(c.parsed.x ?? c.parsed.y)} unid.` } } },
        scales: {
          x: { grid: { color: daily ? "transparent" : o.grid }, ticks: { callback: function (v) { return daily ? this.getLabelForValue(v) : nf0.format(v); } } },
          y: { grid: { color: daily ? o.grid : "transparent" }, ticks: { callback: function (v) { return daily ? nf0.format(v) : this.getLabelForValue(v); } } }
        }
      }
    });

    // Tabla
    $("tbl-days").querySelector("tbody").innerHTML = rng.map((v, i) => {
      const diff = avg > 0 ? (v / avg - 1) : 0;
      const cls = diff >= 0 ? "" : "";
      return `<tr><td>${short(rngDates[i])} 2017</td><td>${dayName(rngDates[i])}</td><td class="num">${nf1.format(v)}</td><td class="num ${cls}">${diff >= 0 ? "+" : ""}${nf1.format(diff * 100)}%</td></tr>`;
    }).join("");

    renderExplorer.current = { store, fam, from, to, rng, rngDates };
  }

  $("btn-csv").addEventListener("click", () => {
    const c = renderExplorer.current; if (!c) return;
    const sLabel = c.store === "all" ? "todas" : FC.stores[c.store];
    const fLabel = c.fam === "all" ? "todas" : FC.families[c.fam];
    const lines = ["fecha,tienda,familia,ventas_pronosticadas"].concat(c.rng.map((v, i) => `${c.rngDates[i]},${sLabel},"${fLabel}",${v.toFixed(2)}`));
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `pronostico_tienda-${sLabel}_familia-${String(fLabel).toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  /* ---------- Modelos ---------- */
  const modelRows = M.models;
  $("tbl-models").querySelector("tbody").innerHTML = modelRows.map((r, i) =>
    `<tr class="${i === 0 ? "best" : ""}"><td>${r.Modelo}</td><td class="num">${nf4.format(r.RMSLE)}</td><td class="num">${nf2.format(r.MAE)}</td><td class="num">${pct(r.WAPE)}</td></tr>`).join("");

  let metric = "RMSLE";
  function renderModels() {
    const o = baseOpts();
    let rows = modelRows.slice();
    if (metric === "RMSLE") rows = rows.filter((r) => r.RMSLE < 3);
    const vals = rows.map((r) => (metric === "WAPE" ? r.WAPE * 100 : r[metric]));
    const min = Math.min(...vals);
    mk("ch-models", {
      type: "bar",
      data: { labels: rows.map((r) => r.Modelo), datasets: [{ data: vals, borderRadius: 4, backgroundColor: vals.map((v) => (v === min ? css("--teal") : css("--slate"))) }] },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: "y",
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => metric === "WAPE" ? nf2.format(c.parsed.x) + "%" : metric === "RMSLE" ? nf4.format(c.parsed.x) : nf2.format(c.parsed.x) } } },
        scales: { x: { beginAtZero: true, grid: { color: o.grid }, title: { display: true, text: metric === "WAPE" ? "WAPE (%)" : metric } }, y: { grid: { display: false } } }
      }
    });
  }
  $("seg-metric").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    metric = b.dataset.m;
    $("seg-metric").querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
    renderModels();
  });

  function renderOptuna() {
    const o = baseOpts();
    const tr = M.optuna; let run = Infinity;
    const bestSoFar = tr.map((t) => (run = Math.min(run, t.v)));
    mk("ch-optuna", {
      type: "line",
      data: { labels: tr.map((t) => t.n + 1), datasets: [
        { label: "RMSLE del ensayo", data: tr.map((t) => t.v), borderColor: "transparent", backgroundColor: css("--slate"), pointRadius: 3, showLine: false },
        { label: "Mejor acumulado", data: bestSoFar, borderColor: css("--accent"), backgroundColor: css("--accent"), borderWidth: 2, pointRadius: 0, stepped: true }
      ] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${nf4.format(c.parsed.y)}` } } },
        scales: { x: { grid: { display: false }, title: { display: true, text: "Ensayo" } }, y: { grid: { color: o.grid }, ticks: { maxTicksLimit: 4, callback: (v) => nf4.format(v) } } }
      }
    });
  }

  /* ---------- Rolling origin ---------- */
  $("tbl-roll").querySelector("tbody").innerHTML = M.rolling.map((r) =>
    `<tr><td>${r.Modelo}</td><td>${short(r.Inicio)} – ${short(r.Fin)} 2017</td><td class="num">${nf4.format(r.RMSLE)}</td><td class="num">${nf2.format(r.MAE)}</td><td class="num">${pct(r.WAPE)}</td></tr>`).join("");
  function renderRoll() {
    const o = baseOpts();
    mk("ch-roll", {
      type: "bar",
      data: { labels: M.rolling.map((r) => r.Modelo), datasets: [
        { label: "RMSLE", data: M.rolling.map((r) => r.RMSLE), backgroundColor: css("--teal"), borderRadius: 4, yAxisID: "y" },
        { label: "WAPE (%)", data: M.rolling.map((r) => r.WAPE * 100), backgroundColor: css("--accent"), borderRadius: 4, yAxisID: "y1" }
      ] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: "bottom", labels: { usePointStyle: true, boxWidth: 8 } }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${nf4.format(c.parsed.y)}` } } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, position: "left", grid: { color: o.grid }, title: { display: true, text: "RMSLE" } },
          y1: { beginAtZero: true, position: "right", grid: { display: false }, title: { display: true, text: "WAPE (%)" } }
        }
      }
    });
  }

  /* ---------- SHAP ---------- */
  function renderShap() {
    const o = baseOpts();
    const top = M.shap.slice(0, 15);
    mk("ch-shap", {
      type: "bar",
      data: { labels: top.map((r) => r.feature), datasets: [{ data: top.map((r) => r.mean_abs_shap), backgroundColor: css("--teal"), borderRadius: 4 }] },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: "y",
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => "|SHAP| medio: " + nf4.format(c.parsed.x) } } },
        scales: { x: { beginAtZero: true, grid: { color: o.grid } }, y: { grid: { display: false }, ticks: { font: { family: css("--mono"), size: 11 } } } }
      }
    });
  }

  /* ---------- Hiperparámetros ---------- */
  const P = M.params;
  const pr = (k, v) => `<tr><td>${k}</td><td>${v}</td></tr>`;
  $("tbl-params").querySelector("tbody").innerHTML = [
    pr("learning_rate", nf4.format(P.learning_rate)), pr("num_leaves", P.num_leaves), pr("max_depth", P.max_depth),
    pr("min_child_samples", P.min_child_samples), pr("subsample", nf4.format(P.subsample)), pr("colsample_bytree", nf4.format(P.colsample_bytree)),
    pr("reg_alpha", P.reg_alpha.toExponential(2)), pr("reg_lambda", nf4.format(P.reg_lambda)),
    pr("n_estimators (máx.)", P.n_estimators), pr("mejor iteración", M.best_iteration), pr("objetivo", P.objective + " sobre log(1+ventas)")
  ].join("");

  /* ---------- Render + tema ---------- */
  function renderAll() { renderExplorer(); renderModels(); renderOptuna(); renderRoll(); renderShap(); }
  renderAll();
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", renderAll);
})();
