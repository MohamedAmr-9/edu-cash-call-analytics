/**
 * Edu Cash — Call Center Analytics
 * --------------------------------
 * Everything runs client-side: the Excel/CSV file never leaves the browser.
 *
 * Sections
 *   1. State & helpers
 *   2. Settings (Answer definition, agent-code range, evaluation rules)
 *   3. File upload & parsing
 *   4. Aggregation, KPIs & charts
 *   5. Agents (users) tab
 *   6. Call log tab
 *   7. PDF report
 */

// ---- 1. State & helpers ----
let LO = 100,
  HI = 150;
const KEY = "educash_names_v1";
let names = {},
  rows = [],
  stats = { total: 0, badSrc: 0 },
  sortK = "calls",
  sortD = -1;
try {
  names = JSON.parse(localStorage.getItem(KEY) || "{}");
} catch (e) {
  names = {};
}
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(names));
  } catch (e) {}
};
const TK = "educash_theme";
function setTheme(t, sv) {
  document.documentElement.dataset.theme = t;
  $("theme").textContent = t === "light" ? "🌙" : "☀️";
  if (sv)
    try {
      localStorage.setItem(TK, t);
    } catch (e) {}
}
let t0;
try {
  t0 = localStorage.getItem(TK);
} catch (e) {}
setTheme(
  t0 ||
    (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"),
  false,
);
$("theme").onclick = () =>
  setTheme(
    document.documentElement.dataset.theme === "light" ? "dark" : "light",
    true,
  );

// ---- 2. Settings ----
const SK = "educash_settings_v1",
  DEF = {
    thr: 50,
    op: "gt",
    srcLo: 100,
    srcHi: 150,
    mode: "team",
    pLong: 20,
    pShort: 20,
    minAns: 3,
    fLong: 3.5,
    fShort: 1.5,
  };
let SET = { ...DEF },
  TEAM = { avg: 0, avgA: 0 },
  CTX = null;
try {
  const o = JSON.parse(localStorage.getItem(SK) || "{}");
  for (const k in DEF) if (typeof o[k] === typeof DEF[k]) SET[k] = o[k];
} catch (e) {}
LO = SET.srcLo;
HI = SET.srcHi;
const isA = (d) => (SET.op === "gte" ? d >= SET.thr : d > SET.thr);
const saveSet = () => {
  try {
    localStorage.setItem(SK, JSON.stringify(SET));
  } catch (e) {}
};
function explain() {
  const m = TEAM.avgA ? TEAM.avgA / 60 : 0;
  let t =
    "<b>التقييم بيتحسب كده:</b> بناخد متوسط زمن المكالمة لكل Agent (المكالمات الـ Answer بس)، بشرط يكون عنده <b>" +
    SET.minAns +
    '</b> Answers على الأقل (غير كده بتظهر "—").<br>';
  if (SET.mode === "team")
    t +=
      "🔴 <b>طويلة</b>: أكتر من متوسط الفريق بـ " +
      SET.pLong +
      "%" +
      (m
        ? " (أكتر من <b>" + (m * (1 + SET.pLong / 100)).toFixed(1) + " د</b>)"
        : "") +
      "<br>🟢 <b>أقصر</b>: أقل من متوسط الفريق بـ " +
      SET.pShort +
      "%" +
      (m
        ? " (أقل من <b>" + (m * (1 - SET.pShort / 100)).toFixed(1) + " د</b>)"
        : "") +
      "<br>✅ <b>تمام</b>: ما بينهم" +
      (m ? "<br>متوسط الفريق دلوقتي: <b>" + m.toFixed(1) + " د</b>" : "");
  else
    t +=
      "🔴 <b>طويلة</b>: أكتر من <b>" +
      SET.fLong +
      " د</b><br>🟢 <b>أقصر</b>: أقل من <b>" +
      SET.fShort +
      " د</b><br>✅ <b>تمام</b>: ما بينهم";
  t +=
    "<br><small>نفس الشروط دي بتتقيّم بيها كمان كل مكالمة لوحدها في تاب سجل المكالمات (المكالمات الـ Answer بس)، فأي تعديل هنا بيتطبق على الاتنين.</small>";
  $("rule").innerHTML = t;
}
function syncSet() {
  document.querySelectorAll("[data-s]").forEach((i) => {
    i.value = SET[i.dataset.s];
  });
  $("set").dataset.mode = SET.mode;
  $("rulepill").textContent =
    "Answer: Duration " +
    (SET.op === "gte" ? "≥" : ">") +
    " " +
    SET.thr +
    " ث · تعديل";
  explain();
}
function applySet() {
  LO = SET.srcLo;
  HI = SET.srcHi;
  saveSet();
  syncSet();
  users();
  if (CTX) rebuild();
}
document.querySelectorAll("[data-s]").forEach((i) =>
  i.addEventListener("input", () => {
    const k = i.dataset.s,
      v = i.type === "number" ? parseFloat(i.value) : i.value;
    if (i.type === "number" && isNaN(v)) return;
    SET[k] = v;
    saveSet();
    $("smsg").textContent = "✓ تم الحفظ";
    if (k === "srcLo" || k === "srcHi") {
      LO = SET.srcLo;
      HI = SET.srcHi;
      users();
      if (CTX) rebuild();
    } else {
      $("set").dataset.mode = SET.mode;
      syncPill();
      if (rows.length) render();
      else explain();
    }
  }),
);
function syncPill() {
  $("rulepill").textContent =
    "Answer: Duration " +
    (SET.op === "gte" ? "≥" : ">") +
    " " +
    SET.thr +
    " ث · تعديل";
}
$("rulepill").onclick = () =>
  document.querySelector(".tab[data-t=set]").click();
$("sreset").onclick = () => {
  SET = { ...DEF };
  applySet();
  $("smsg").textContent = "✓ رجعت للافتراضي";
};
$("scopy").onclick = async () => {
  const b = $("setbox");
  b.value = JSON.stringify(SET);
  b.select();
  try {
    await navigator.clipboard.writeText(b.value);
    $("smsg").textContent = "✓ تم النسخ";
  } catch (e) {
    $("smsg").textContent = "✓ النص جاهز — انسخه";
  }
};
$("sapply").onclick = () => {
  try {
    const o = JSON.parse($("setbox").value);
    let n = 0;
    for (const k in DEF)
      if (typeof o[k] === typeof DEF[k]) {
        SET[k] = o[k];
        n++;
      }
    applySet();
    $("smsg").textContent = "✓ تم تطبيق " + n + " إعداد";
  } catch (e) {
    $("smsg").textContent = "النص مش صالح";
  }
};
// Tab switching
document.querySelectorAll(".tab").forEach(
  (b) =>
    (b.onclick = () => {
      document
        .querySelectorAll(".tab")
        .forEach((x) => x.classList.toggle("on", x === b));
      $("res").classList.toggle("hide", b.dataset.t !== "res");
      $("log").classList.toggle("hide", b.dataset.t !== "log");
      $("usr").classList.toggle("hide", b.dataset.t !== "usr");
      $("set").classList.toggle("hide", b.dataset.t !== "set");
    }),
);

// Date parsing: accepts ISO text, DD/MM/YYYY, or an Excel serial number
const p2 = (n) => String(n).padStart(2, "0");
function pdt(v) {
  if (typeof v === "number" && v > 20000) {
    const u = new Date(Math.round((v - 25569) * 864e5));
    return { d: u.toISOString().slice(0, 10), h: u.getUTCHours() };
  }
  const t = String(v || "");
  let m = t.match(/(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[ T](\d{1,2}))?/);
  if (m)
    return {
      d: m[1] + "-" + p2(m[2]) + "-" + p2(m[3]),
      h: m[4] !== undefined ? +m[4] : -1,
    };
  m = t.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})(?:[ T](\d{1,2}))?/);
  if (m)
    return {
      d: m[3] + "-" + p2(m[2]) + "-" + p2(m[1]),
      h: m[4] !== undefined ? +m[4] : -1,
    };
  return { d: "", h: -1 };
}
// ---- 3. File upload & parsing ----
const drop = $("drop"),
  file = $("file");
drop.onclick = () => file.click();
drop.ondragover = (e) => {
  e.preventDefault();
  drop.classList.add("over");
};
drop.ondragleave = () => drop.classList.remove("over");
drop.ondrop = (e) => {
  e.preventDefault();
  drop.classList.remove("over");
  if (e.dataTransfer.files[0]) load(e.dataTransfer.files[0]);
};
file.onchange = () => file.files[0] && load(file.files[0]);

function load(f) {
  $("fname").textContent = f.name;
  const r = new FileReader();
  r.onload = (e) => {
    try {
      const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
      const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
        defval: "",
      });
      parse(data);
    } catch (err) {
      $("msg").innerHTML =
        '<span class="warn">تعذّرت قراءة الملف: ' + esc(err.message) + "</span>";
    }
  };
  r.readAsArrayBuffer(f);
}

function build() {
  const { data, kSrc, kDur, kTime, kType, kDst } = CTX;
  stats = { total: data.length, badSrc: 0 };
  rows = [];
  for (const r of data) {
    const s = String(r[kSrc]).trim(),
      n = /^\d+$/.test(s) ? +s : NaN;
    if (!(n >= LO && n <= HI)) {
      stats.badSrc++;
      continue;
    }
    rows.push({
      t: kTime ? String(r[kTime]).trim() : "",
      dst: kDst ? String(r[kDst]).trim() : "",
      st: kType ? String(r[kType]).trim().toUpperCase() : "",
      d: pdt(kTime ? r[kTime] : "").d,
      h: pdt(kTime ? r[kTime] : "").h,
      ext: s,
      dur: +r[kDur] || 0,
      ans: kType ? String(r[kType]).trim().toUpperCase() === "ANSWERED" : true,
    });
  }
}
function rebuild() {
  build();
  fillAgents();
  render();
}
function parse(data) {
  if (!data.length) {
    $("msg").innerHTML = '<span class="warn">الملف فارغ.</span>';
    return;
  }
  const keys = Object.keys(data[0]),
    find = (re) => keys.find((k) => re.test(k.toLowerCase()));
  const kSrc = find(/^src$/) || find(/src/),
    kDur = find(/duration/),
    kTime = find(/start|time|date/),
    kType = find(/call_type/) || find(/status|answer/),
    kDst = find(/^dst$/) || find(/dst|dest/);
  if (!kSrc || !kDur) {
    $("msg").innerHTML =
      '<span class="warn">لم أجد عمودَي Src و Duration في الملف.</span>';
    return;
  }
  CTX = { data, kSrc, kDur, kTime, kType, kDst };
  build();
  tmode = "auto";
  $("d1").value = $("d2").value = "";
  const ds = rows
    .map((r) => r.d)
    .filter(Boolean)
    .sort();
  if (ds.length) {
    $("d1").min = $("d2").min = ds[0];
    $("d1").max = $("d2").max = ds[ds.length - 1];
    $("msg").textContent =
      "تم تحميل " +
      stats.total +
      " صف · التواريخ في الملف: " +
      ds[0] +
      (ds[0] !== ds[ds.length - 1] ? " → " + ds[ds.length - 1] : "");
  } else
    $("msg").innerHTML =
      "تم تحميل " +
      stats.total +
      ' صف · <span class="warn">ما قدرتش أقرا عمود التاريخ، فلتر التاريخ مش هيشتغل.</span>';
  $("out").classList.remove("hide");
  fillAgents();
  render();
}

// ---- 4. Aggregation, KPIs & charts ----
function agg() {
  const ag = $("ag").value,
    onlyAns = $("fAns").checked,
    d1 = $("d1").value,
    d2 = $("d2").value,
    m = {};
  let used = rows.filter(
    (r) =>
      (!ag || r.ext === ag) &&
      (!onlyAns || r.ans) &&
      (!d1 || r.d >= d1) &&
      (!d2 || r.d <= d2),
  );
  for (const r of used) {
    const o =
      m[r.ext] ||
      (m[r.ext] = { ext: r.ext, calls: 0, answers: 0, secs: 0, asecs: 0 });
    o.calls++;
    o.secs += r.dur;
    if (isA(r.dur)) {
      o.answers++;
      o.asecs += r.dur;
    } // Answer = Duration > الحد فقط
  }
  return { list: Object.values(m), used: used.length, rows: used };
}

function fillAgents() {
  const s = $("ag"),
    cur = s.value,
    ex = [...new Set(rows.map((r) => r.ext))].sort();
  s.innerHTML =
    '<option value="">كل الـ Agents</option>' +
    ex
      .map(
        (e) =>
          '<option value="' +
          e +
          '">' +
          e +
          (names[e] ? " — " + esc(names[e]) : "") +
          "</option>",
      )
      .join("");
  s.value = ex.includes(cur) ? cur : "";
  const la = $("lag"),
    lc = la.value;
  la.innerHTML = s.innerHTML;
  la.value = ex.includes(lc) ? lc : "";
  LG.ag = la.value;
  const lo = $("lout"),
    lv = lo.value,
    sts = [...new Set(rows.map((r) => r.st).filter(Boolean))].sort();
  lo.innerHTML =
    '<option value="all">كل النتائج</option>' +
    sts
      .map((x) => '<option value="' + esc(x) + '">' + esc(x) + "</option>")
      .join("");
  lo.value = sts.includes(lv) ? lv : "all";
  LG.out = lo.value;
}
function render() {
  if (!rows.length && !stats.total) return;
  const { list, used, rows: ur } = agg(),
    q = $("q").value.trim().toLowerCase();
  const tc = list.reduce((s, o) => s + o.calls, 0),
    ta = list.reduce((s, o) => s + o.answers, 0),
    ts = list.reduce((s, o) => s + o.secs, 0),
    tas = list.reduce((s, o) => s + o.asecs, 0);
  const teamAvg = tc ? ts / tc : 0,
    teamAvgA = ta ? tas / ta : 0,
    fm = (x) => (x > 0 ? (x / 60).toFixed(1) + " د" : "—");
  TEAM = { avg: teamAvg, avgA: teamAvgA };
  list.forEach((o) => {
    o.avg = o.calls ? o.secs / o.calls : 0;
    o.avgA = o.answers ? o.asecs / o.answers : 0;
  });
  const verdict = (o) => {
    if (o.answers < SET.minAns) return "—";
    const v = o.avgA;
    if (SET.mode === "fixed") {
      const mn = v / 60;
      return mn > SET.fLong
        ? "🔴 طويلة"
        : mn < SET.fShort
          ? "🟢 أقصر"
          : "✅ تمام";
    }
    const b = teamAvgA,
      r = b ? v / b : 1;
    return r > 1 + SET.pLong / 100
      ? "🔴 طويلة"
      : r < 1 - SET.pShort / 100
        ? "🟢 أقصر"
        : "✅ تمام";
  };
  VERD = verdict;
  explain();
  let L = list.filter(
    (o) =>
      !q || o.ext.includes(q) || (names[o.ext] || "").toLowerCase().includes(q),
  );
  L.forEach((o) => {
    o.name = names[o.ext] || "";
    o.rate = o.calls ? o.answers / o.calls : 0;
  });
  L.sort(
    (a, b) => (a[sortK] > b[sortK] ? 1 : a[sortK] < b[sortK] ? -1 : 0) * sortD,
  );
  $("kpis").innerHTML = [
    ["إجمالي Calls", tc],
    ["إجمالي Answers", ta],
    ["نسبة الـ Answer", tc ? Math.round((ta / tc) * 100) + "%" : "0%"],
    ["وقت الحديث (ساعة)", (ts / 3600).toFixed(1)],
    ["متوسط زمن المكالمة", fm(teamAvgA)],
    ["مستخدمون نشطون", list.length],
  ]
    .map(
      (k) =>
        '<div class="kpi"><small>' +
        k[0] +
        "</small><div>" +
        k[1] +
        "</div></div>",
    )
    .join("");
  const H = [
    ["ext", "الكود"],
    ["name", "الاسم"],
    ["calls", "Calls"],
    ["answers", "Answers"],
    ["rate", "النسبة"],
    ["avgA", "متوسط زمن المكالمة"],
    ["st", "التقييم"],
  ];
  $("tbl").innerHTML =
    "<tr>" +
    H.map(
      (h) =>
        '<th data-k="' +
        h[0] +
        '">' +
        h[1] +
        (sortK === h[0] ? (sortD < 0 ? " ▼" : " ▲") : "") +
        "</th>",
    ).join("") +
    "</tr>" +
    L.map(
      (o) =>
        "<tr><td>" +
        o.ext +
        "</td><td>" +
        esc(o.name || "—") +
        "</td><td>" +
        o.calls +
        "</td><td>" +
        o.answers +
        '</td><td><div class="bar"><i style="width:' +
        Math.round(o.rate * 100) +
        '%"></i></div>' +
        Math.round(o.rate * 100) +
        '%</td><td title="' +
        Math.round(o.avgA) +
        ' ثانية">' +
        fm(o.avgA) +
        "</td><td>" +
        verdict(o) +
        "</td></tr>",
    ).join("") +
    '<tr style="font-weight:800"><td colspan="2">الإجمالي</td><td>' +
    tc +
    "</td><td>" +
    ta +
    "</td><td>" +
    (tc ? Math.round((ta / tc) * 100) : 0) +
    "%</td><td>" +
    fm(teamAvgA) +
    "</td><td></td></tr>";
  $("tbl")
    .querySelectorAll("th")
    .forEach(
      (th) =>
        (th.onclick = () => {
          const k = th.dataset.k;
          sortD = sortK === k ? -sortD : -1;
          sortK = k;
          render();
        }),
    );
  $("foot").textContent =
    "الصفوف: " +
    stats.total +
    " ← بعد حذف Src خارج " +
    LO +
    "–" +
    HI +
    ": " +
    (stats.total - stats.badSrc) +
    (" ← بعد الفلاتر: " + used) +
    " · الشروط والتقييم من صفحة ⚙️ الإعدادات";
  L_last = L;
  charts(L, ur);
  logRender();
  UR = ur;
}
let L_last = [],
  TIPS = { ch1: [], ch2: [] },
  tmode = "auto",
  UR = [],
  VERD = (o) => "—";
const nmx = (e) =>
  "<bdi>" + (names[e] ? esc(names[e]) + " (" + e + ")" : e) + "</bdi>";
function bars(lb, a, b, title, id, nb) {
  const W = 640,
    H = 230,
    pl = 30,
    pb = 34,
    pt = 20,
    n = lb.length,
    mx = Math.max(1, ...a, ...b),
    gw = (W - pl - 6) / n,
    bw = Math.min(20, gw / 2.5),
    ch = H - pt - pb,
    base = H - pb;
  let s =
    "<h4>" +
    title +
    (nb
      ? ""
      : ' <button class="pill pdfb" data-pdf="1" title="تقرير PDF لكل Agent">📄 Export PDF</button>') +
    '</h4><svg viewBox="0 0 ' +
    W +
    " " +
    H +
    '" width="100%" style="direction:ltr" role="img">';
  for (let i = 0; i <= 4; i++) {
    const y = pt + ch * (1 - i / 4);
    s +=
      '<line x1="' +
      pl +
      '" x2="' +
      W +
      '" y1="' +
      y +
      '" y2="' +
      y +
      '" class="gl"/><text x="' +
      (pl - 4) +
      '" y="' +
      (y + 3) +
      '" font-size="9" text-anchor="end" class="ax">' +
      Math.round((mx * i) / 4) +
      "</text>";
  }
  lb.forEach((l, i) => {
    const x = pl + gw * i + gw / 2,
      hA = (ch * a[i]) / mx,
      hB = (ch * b[i]) / mx;
    s +=
      '<rect x="' +
      (x - bw) +
      '" y="' +
      (base - hA) +
      '" width="' +
      bw +
      '" height="' +
      hA +
      '" rx="3" fill="#5aa2ff"></rect><rect x="' +
      x +
      '" y="' +
      (base - hB) +
      '" width="' +
      bw +
      '" height="' +
      hB +
      '" rx="3" fill="#2dd4a7"></rect><text x="' +
      x +
      '" y="' +
      (H - pb + 14) +
      '" font-size="10" text-anchor="middle" class="ax">' +
      esc(l) +
      "</text>";
    if (n <= 14)
      s +=
        '<text x="' +
        (x - bw / 2) +
        '" y="' +
        (base - hA - 3) +
        '" font-size="9" text-anchor="middle" class="vl">' +
        a[i] +
        '</text><text x="' +
        (x + bw / 2) +
        '" y="' +
        (base - hB - 3) +
        '" font-size="9" text-anchor="middle" class="vl">' +
        b[i] +
        "</text>";
    s +=
      '<rect class="hit" data-c="' +
      id +
      '" data-i="' +
      i +
      '" x="' +
      (pl + gw * i) +
      '" y="' +
      pt +
      '" width="' +
      gw +
      '" height="' +
      (ch + pb) +
      '"/>';
  });
  return s + "</svg>";
}
function charts(L, ur) {
  TIPS.ch1 = L.map((o) => {
    const hh = {};
    ur.filter((r) => r.ext === o.ext && r.h >= 0).forEach((r) => {
      const x = hh[r.h] || (hh[r.h] = { c: 0, a: 0 });
      x.c++;
      if (isA(r.dur)) x.a++;
    });
    const ks = Object.keys(hh),
      bs = (f) => ks.reduce((b, x) => (hh[x][f] > hh[b][f] ? x : b), ks[0]);
    return (
      "<b>" +
      nmx(o.ext) +
      '</b><div dir="ltr">Calls: <b>' +
      o.calls +
      "</b> · Answers: <b>" +
      o.answers +
      "</b> · " +
      Math.round(o.rate * 100) +
      '%</div><div dir="ltr">Avg call time: <b>' +
      (o.avgA / 60).toFixed(1) +
      " min</b></div>" +
      (ks.length
        ? '<div dir="ltr">⏱ Peak Calls: <b>' +
          bs("c") +
          ":00</b> (" +
          hh[bs("c")].c +
          ") · Answers: <b>" +
          bs("a") +
          ":00</b> (" +
          hh[bs("a")].a +
          ")</div>"
        : "")
    );
  });
  $("ch1").innerHTML = L.length
    ? bars(
        L.map((o) => (o.name ? o.name.split(" ")[0] : o.ext).slice(0, 9)),
        L.map((o) => o.calls),
        L.map((o) => o.answers),
        "حسب المستخدم",
        "ch1",
      )
    : "";
  const days = [...new Set(ur.map((r) => r.d).filter(Boolean))].sort();
  if (!days.length) {
    $("ch2").innerHTML = "";
    return;
  }
  const byH = tmode === "hour" || (tmode === "auto" && days.length === 1),
    k = (r) => (byH ? r.h : r.d),
    m = {};
  ur.forEach((r) => {
    if (byH && r.h < 0) return;
    const o = m[k(r)] || (m[k(r)] = { c: 0, a: 0, ag: {} });
    const x = o.ag[r.ext] || (o.ag[r.ext] = { c: 0, a: 0 });
    o.c++;
    x.c++;
    if (isA(r.dur)) {
      o.a++;
      x.a++;
    }
  });
  let keys = Object.keys(m).sort((x, y) => (byH ? x - y : x < y ? -1 : 1));
  if (byH && keys.length) {
    const lo = +keys[0],
      hi = +keys[keys.length - 1];
    keys = [];
    for (let i = lo; i <= hi; i++) keys.push(String(i));
  }
  const g = (x) => m[x] || { c: 0, a: 0 };
  TIPS.ch2 = keys.map((x) => {
    const o = g(x),
      en = Object.entries(o.ag || {}),
      by = (f) => en.slice().sort((p, q) => q[1][f] - p[1][f])[0];
    const hd = byH
      ? "🕒 الساعة <bdi>" +
        x +
        ":00–" +
        ((+x + 1) % 24) +
        ":00</bdi> · <bdi>" +
        (days.length > 1
          ? "إجمالي " + days.length + " أيام</bdi>"
          : days[0] + "</bdi>")
      : "📅 <bdi>" + x + "</bdi>";
    if (!en.length) return "<b>" + hd + "</b><div>مفيش مكالمات</div>";
    const tc = by("c"),
      ta = by("a");
    return (
      "<b>" +
      hd +
      '</b><div dir="ltr">Calls: <b>' +
      o.c +
      "</b> · Answers: <b>" +
      o.a +
      "</b> · " +
      Math.round((o.a / o.c) * 100) +
      '%</div><div dir="ltr">🏆 Top Calls: <b>' +
      nmx(tc[0]) +
      "</b> (" +
      tc[1].c +
      ") · Top Answers: <b>" +
      nmx(ta[0]) +
      "</b> (" +
      ta[1].a +
      ")</div>" +
      "<table><tr><td></td><td>Calls</td><td>Answers</td></tr>" +
      en
        .sort((p, q) => q[1].c - p[1].c)
        .slice(0, 12)
        .map(
          (e) =>
            "<tr><td>" +
            nmx(e[0]) +
            "</td><td>" +
            e[1].c +
            "</td><td>" +
            e[1].a +
            "</td></tr>",
        )
        .join("") +
      "</table>"
    );
  });
  const g2 = (x) => m[x] || { c: 0, a: 0 },
    pk = (f) => keys.reduce((b, x) => (g2(x)[f] > g2(b)[f] ? x : b), keys[0]),
    lb = (x) => (byH ? x + ":00" : x);
  const seg =
    '<div class="seg"><button data-m="hour"' +
    (byH ? ' class="on"' : "") +
    '>حسب الساعة</button><button data-m="day"' +
    (byH ? "" : ' class="on"') +
    ">حسب اليوم</button></div>";
  const ins = keys.length
    ? '<p class="note" dir="rtl">🔥 أعلى ' +
      (byH ? "ساعة" : "يوم") +
      " في <bdi>Calls</bdi>: <b><bdi>" +
      lb(pk("c")) +
      "</bdi></b> (<bdi>" +
      g2(pk("c")).c +
      "</bdi>) · أعلى " +
      (byH ? "ساعة" : "يوم") +
      " في <bdi>Answers</bdi>: <b><bdi>" +
      lb(pk("a")) +
      "</bdi></b> (<bdi>" +
      g2(pk("a")).a +
      "</bdi>)</p>"
    : "";
  $("ch2").innerHTML =
    seg +
    ins +
    (keys.length
      ? bars(
          keys.map((x) => (byH ? x + ":00" : x.slice(5))),
          keys.map((x) => g(x).c),
          keys.map((x) => g(x).a),
          byH
            ? "حسب الساعة (" +
                (days.length > 1
                  ? "إجمالي " + days.length + " أيام"
                  : days[0]) +
                ")"
            : "حسب اليوم",
          "ch2",
        )
      : '<p class="note">مفيش بيانات ساعات في الملف.</p>');
}
const tip = $("tip");
function showTip(e) {
  const h = e.target.closest && e.target.closest(".hit");
  if (!h) {
    tip.style.display = "none";
    return;
  }
  tip.innerHTML = (TIPS[h.dataset.c] || [])[+h.dataset.i] || "";
  tip.style.display = "block";
  const r = tip.getBoundingClientRect();
  let x = e.clientX + 14,
    y = e.clientY + 14;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
  if (x < 8) x = 8;
  if (y + r.height > innerHeight - 8)
    y = Math.max(8, e.clientY - r.height - 14);
  tip.style.left = x + "px";
  tip.style.top = y + "px";
}
["ch1", "ch2"].forEach((i) => {
  const c = $(i);
  c.addEventListener("mousemove", showTip);
  c.addEventListener("click", showTip);
  c.addEventListener("mouseleave", () => (tip.style.display = "none"));
});
$("ch2").addEventListener("click", (e) => {
  const b = e.target.closest("[data-m]");
  if (b) {
    tmode = b.dataset.m;
    render();
  }
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".hit")) tip.style.display = "none";
});
addEventListener("scroll", () => (tip.style.display = "none"), true);
["fAns", "ag", "d1", "d2", "q"].forEach((i) =>
  $(i).addEventListener("input", render),
);

// CSV export
$("csv").onclick = () => {
  const t =
    "\ufeffExt,Name,Calls,Answers,Rate,AvgCallTime_min\n" +
    L_last.map((o) =>
      [
        o.ext,
        '"' + (o.name || "").replace(/"/g, '""') + '"',
        o.calls,
        o.answers,
        (o.rate * 100).toFixed(1) + "%",
        (o.avgA / 60).toFixed(2),
      ].join(","),
    ).join("\n");
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(t);
  a.download = "educash-calls.csv";
  a.click();
};

// ---- 5. Agents (users) tab ----
function users() {
  $("urange").textContent = LO + " – " + HI;
  const q = $("uq").value.trim().toLowerCase();
  let h = "<tr><th>الكود</th><th>الاسم</th></tr>";
  for (let e = LO; e <= HI; e++) {
    const n = names[e] || "";
    if (q && !(String(e).includes(q) || n.toLowerCase().includes(q))) continue;
    h +=
      "<tr><td>" +
      e +
      '</td><td><input type="text" data-e="' +
      e +
      '" value="' +
      esc(n) +
      '" placeholder="اكتب الاسم"></td></tr>';
  }
  $("utbl").innerHTML = h;
  $("utbl")
    .querySelectorAll("input")
    .forEach(
      (i) =>
        (i.oninput = () => {
          const v = i.value.trim();
          v ? (names[i.dataset.e] = v) : delete names[i.dataset.e];
          save();
          $("saved").textContent = "✓ تم الحفظ";
          if (rows.length) {
            fillAgents();
            render();
          }
        }),
    );
}
$("uq").oninput = users;
const dump = () =>
  Object.keys(names)
    .sort()
    .map((k) => k + "\t" + names[k])
    .join("\n");
$("cp").onclick = async () => {
  const b = $("bulk");
  b.value = dump();
  b.select();
  try {
    await navigator.clipboard.writeText(b.value);
    $("saved").textContent = "✓ تم النسخ — ابعته لزميلك";
  } catch (e) {
    $("saved").textContent = "✓ النص جاهز — انسخه وابعته";
  }
};
$("ap").onclick = () => {
  let n = 0;
  $("bulk")
    .value.split("\n")
    .forEach((l) => {
      const m = l.trim().match(/^(\d{3})\s*[\t,=:\-]?\s*(.+)$/);
      if (m && +m[1] >= LO && +m[1] <= HI) {
        names[m[1]] = m[2].trim();
        n++;
      }
    });
  save();
  users();
  if (rows.length) {
    fillAgents();
    render();
  }
  $("saved").textContent = "✓ تم تطبيق " + n + " اسم";
};
$("clr").onclick = () => {
  if (confirm("مسح كل الأسماء؟")) {
    names = {};
    save();
    users();
    if (rows.length) {
      fillAgents();
      render();
    }
  }
};
users();
// ---- 6. Call log tab ----
const LG = {
  q: "",
  out: "all",
  ans: "all",
  cv: "all",
  ag: "",
  sk: "time",
  sd: -1,
  page: 1,
  size: 25,
};
const fmtD = (s) => Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
const tkey = (r) =>
  r.d +
  " " +
  (r.t.match(/\d{1,2}:\d{2}(?::\d{2})?/) || [""])[0].padStart(8, "0");
const LV = {
  time: tkey,
  ext: (r) => +r.ext,
  name: (r) => names[r.ext] || "",
  dst: (r) => r.dst,
  dur: (r) => r.dur,
  st: (r) => r.st,
  ans: (r) => (isA(r.dur) ? 1 : 0),
  cv: (r) => (isA(r.dur) ? r.dur : -1),
};
const CVL = { long: "طويلة", ok: "تمام", short: "قصيرة" },
  CVC = { long: "bad", ok: "ok", short: "mid" };
const callK = (r) => {
  if (!isA(r.dur)) return "";
  if (SET.mode === "fixed") {
    const m = r.dur / 60;
    return m > SET.fLong ? "long" : m < SET.fShort ? "short" : "ok";
  }
  const b = TEAM.avgA;
  if (!b) return "ok";
  const q = r.dur / b;
  return q > 1 + SET.pLong / 100
    ? "long"
    : q < 1 - SET.pShort / 100
      ? "short"
      : "ok";
};
const cvChip = (r) => {
  const k = callK(r);
  return k ? '<span class="chip ' + CVC[k] + '">' + CVL[k] + "</span>" : "—";
};
function logFiltered() {
  const q = LG.q.trim().toLowerCase();
  const L = rows.filter(
    (r) =>
      (!LG.ag || r.ext === LG.ag) &&
      (LG.out === "all" || r.st === LG.out) &&
      (LG.ans === "all" || (LG.ans === "y") === isA(r.dur)) &&
      (LG.cv === "all" || callK(r) === LG.cv) &&
      (!q ||
        r.ext.includes(q) ||
        r.dst.toLowerCase().includes(q) ||
        (names[r.ext] || "").toLowerCase().includes(q)),
  );
  const f = LV[LG.sk];
  return L.sort((a, b) => {
    const x = f(a),
      y = f(b);
    return (
      (typeof x === "number"
        ? x - y
        : String(x).localeCompare(String(y), "ar", { numeric: true })) * LG.sd
    );
  });
}
function logRender() {
  if (!rows.length) {
    $("lt").innerHTML = "";
    $("lpg").innerHTML = "";
    $("lcount").textContent =
      "ارفع الملف الأول من تاب النتائج وبعدها هتلاقي السجل هنا.";
    return;
  }
  const L = logFiltered(),
    pages = Math.max(1, Math.ceil(L.length / LG.size));
  LG.page = Math.min(LG.page, pages);
  const part = L.slice((LG.page - 1) * LG.size, LG.page * LG.size);
  const H = [
    ["time", "التاريخ والوقت"],
    ["ext", "الكود"],
    ["name", "الاسم"],
    ["dst", "Dst"],
    ["dur", "المدة (د:ث)"],
    ["st", "النتيجة"],
    ["ans", "Answer"],
    ["cv", "التقييم"],
  ];
  $("lt").innerHTML =
    "<tr>" +
    H.map(
      (h) =>
        '<th aria-sort="' +
        (LG.sk === h[0] ? (LG.sd < 0 ? "descending" : "ascending") : "none") +
        '"><button data-k="' +
        h[0] +
        '">' +
        h[1] +
        (LG.sk === h[0] ? (LG.sd < 0 ? " ▼" : " ▲") : "") +
        "</button></th>",
    ).join("") +
    "</tr>" +
    (part.length
      ? part
          .map((r) => {
            const c =
              r.st === "ANSWERED" ? "ok" : r.st === "FAILED" ? "bad" : "mid";
            return (
              "<tr><td><bdi>" +
              esc(r.t) +
              "</bdi></td><td>" +
              r.ext +
              "</td><td>" +
              esc(names[r.ext] || "—") +
              "</td><td><bdi>" +
              esc(r.dst) +
              '</bdi></td><td title="' +
              r.dur +
              ' ثانية">' +
              fmtD(r.dur) +
              '</td><td><span class="chip ' +
              c +
              '">' +
              esc(r.st || "—") +
              "</span></td><td>" +
              (isA(r.dur) ? "✅" : "—") +
              "</td><td>" +
              cvChip(r) +
              "</td></tr>"
            );
          })
          .join("")
      : '<tr><td colspan="8" class="note">مفيش نتائج بالفلاتر دي.</td></tr>');
  const cn = { long: 0, ok: 0, short: 0 };
  L.forEach((r) => {
    const k = callK(r);
    if (k) cn[k]++;
  });
  $("lcount").textContent =
    "النتائج: " +
    L.length +
    " من " +
    rows.length +
    " مكالمة · 🔴 " +
    cn.long +
    " طويلة · ✅ " +
    cn.ok +
    " تمام · 🟡 " +
    cn.short +
    " قصيرة" +
    (SET.mode === "team"
      ? TEAM.avgA
        ? " · متوسط الفريق " +
          (TEAM.avgA / 60).toFixed(1) +
          " د (تمام بين " +
          ((TEAM.avgA * (1 - SET.pShort / 100)) / 60).toFixed(1) +
          " و " +
          ((TEAM.avgA * (1 + SET.pLong / 100)) / 60).toFixed(1) +
          " د)"
        : ""
      : " · طويلة > " + SET.fLong + " د · قصيرة < " + SET.fShort + " د");
  $("lpg").innerHTML =
    '<button class="act ghost" data-p="1" ' +
    (LG.page <= 1 ? "disabled" : "") +
    ' aria-label="الأولى">«</button><button class="act ghost" data-p="' +
    (LG.page - 1) +
    '" ' +
    (LG.page <= 1 ? "disabled" : "") +
    ' aria-label="السابقة">‹</button><span class="note">صفحة ' +
    LG.page +
    " / " +
    pages +
    '</span><button class="act ghost" data-p="' +
    (LG.page + 1) +
    '" ' +
    (LG.page >= pages ? "disabled" : "") +
    ' aria-label="التالية">›</button><button class="act ghost" data-p="' +
    pages +
    '" ' +
    (LG.page >= pages ? "disabled" : "") +
    ' aria-label="الأخيرة">»</button><select id="lsize" aria-label="عدد الصفوف">' +
    [25, 50, 100]
      .map(
        (n) =>
          '<option value="' +
          n +
          '"' +
          (n === LG.size ? " selected" : "") +
          ">" +
          n +
          " صف</option>",
      )
      .join("") +
    "</select>";
}
["lq", "lag", "lout", "lans", "lcv"].forEach((i) =>
  ["input", "change"].forEach((ev) =>
    $(i).addEventListener(ev, () => {
      LG.q = $("lq").value;
      LG.ag = $("lag").value;
      LG.out = $("lout").value;
      LG.ans = $("lans").value;
      LG.cv = $("lcv").value;
      LG.page = 1;
      logRender();
    }),
  ),
);
$("lt").addEventListener("click", (e) => {
  const b = e.target.closest("[data-k]");
  if (!b) return;
  const k = b.dataset.k;
  LG.sd = LG.sk === k ? -LG.sd : k === "time" ? -1 : 1;
  LG.sk = k;
  LG.page = 1;
  logRender();
});
$("lpg").addEventListener("click", (e) => {
  const b = e.target.closest("[data-p]");
  if (b && !b.disabled) {
    LG.page = +b.dataset.p;
    logRender();
  }
});
$("lpg").addEventListener("change", (e) => {
  if (e.target.id === "lsize") {
    LG.size = +e.target.value;
    LG.page = 1;
    logRender();
  }
});
const lcell = (v) => {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
};
const logOut = () =>
  logFiltered().map((r) => ({
    "Start Time": r.t,
    Src: r.ext,
    Name: names[r.ext] || "",
    Dst: r.dst,
    "Duration (sec)": r.dur,
    Status: r.st,
    Answer: isA(r.dur) ? "Yes" : "No",
    Evaluation: CVL[callK(r)] || "",
  }));
$("lcsv").onclick = () => {
  const o = logOut();
  if (!o.length) return;
  const k = Object.keys(o[0]);
  const t =
    "\ufeff" +
    [k.join(","), ...o.map((r) => k.map((c) => lcell(r[c])).join(","))].join(
      "\r\n",
    );
  const a = document.createElement("a");
  a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(t);
  a.download = "educash-call-log.csv";
  a.click();
};
$("lxls").onclick = () => {
  if (typeof XLSX === "undefined") return;
  const o = logOut();
  if (!o.length) return;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(o), "Call Log");
  XLSX.writeFile(wb, "educash-call-log.xlsx");
};
// ---- 7. PDF report (print → Save as PDF) ----
const fm2 = (x) => (x > 0 ? (x / 60).toFixed(1) + " د" : "—");
function tseries(rs, byH, keys) {
  const m = {};
  rs.forEach((r) => {
    if (byH && r.h < 0) return;
    if (!byH && !r.d) return;
    const k = byH ? r.h : r.d,
      o = m[k] || (m[k] = { c: 0, a: 0 });
    o.c++;
    if (isA(r.dur)) o.a++;
  });
  return {
    keys,
    lb: keys.map((k) => (byH ? k + ":00" : String(k).slice(5))),
    c: keys.map((k) => (m[k] || { c: 0 }).c),
    a: keys.map((k) => (m[k] || { a: 0 }).a),
  };
}
function peakTxt(t, byH) {
  if (!t.keys.length || !Math.max(...t.c)) return "";
  const pk = (f) => t[f].reduce((b, v, i) => (v > t[f][b] ? i : b), 0),
    u = byH ? "ساعة" : "يوم";
  return (
    "<p>🔥 أعلى " +
    u +
    " في <bdi>Calls</bdi>: <b><bdi>" +
    t.lb[pk("c")] +
    "</bdi></b> (<bdi>" +
    t.c[pk("c")] +
    "</bdi>) · أعلى " +
    u +
    " في <bdi>Answers</bdi>: <b><bdi>" +
    t.lb[pk("a")] +
    "</bdi></b> (<bdi>" +
    t.a[pk("a")] +
    "</bdi>)</p>"
  );
}
function buildReport() {
  const L = L_last,
    days = [...new Set(UR.map((r) => r.d).filter(Boolean))].sort();
  const byH = tmode === "hour" || (tmode === "auto" && days.length === 1),
    hs = UR.filter((r) => r.h >= 0).map((r) => r.h);
  const keys = byH
    ? hs.length
      ? Array.from(
          { length: Math.max(...hs) - Math.min(...hs) + 1 },
          (_, i) => Math.min(...hs) + i,
        )
      : []
    : days;
  const today = new Date().toISOString().slice(0, 10);
  const filt =
    "الفترة: <bdi>" +
    (days.length
      ? days[0] + (days.length > 1 ? " → " + days[days.length - 1] : "")
      : "غير محددة") +
    "</bdi> · " +
    ($("fAns").checked ? "ANSWERED فقط" : "كل النتائج") +
    " · Answer = Duration <bdi>" +
    (SET.op === "gte" ? "≥" : ">") +
    " " +
    SET.thr +
    "</bdi> ث";
  const rule =
    SET.mode === "team"
      ? "🔴 طويلة: أكتر من متوسط الفريق بـ " +
        SET.pLong +
        "% · 🟢 أقصر: أقل بـ " +
        SET.pShort +
        "% · بشرط " +
        SET.minAns +
        " Answers على الأقل"
      : "🔴 طويلة: أكتر من " +
        SET.fLong +
        " د · 🟢 أقصر: أقل من " +
        SET.fShort +
        " د · بشرط " +
        SET.minAns +
        " Answers على الأقل";
  const head = (t) =>
    '<div class="rp-h"><div class="rp-logo">EDU<span>CASH</span></div><div style="text-align:left"><b>' +
    t +
    "</b><br><small><bdi>" +
    today +
    "</bdi></small></div></div>";
  const K = (a) =>
    '<div class="rp-k">' +
    a
      .map(
        (x) =>
          "<div><small>" +
          x[0] +
          "</small><b" +
          (x[3] ? ' style="color:' + x[3] + '"' : "") +
          "><bdi>" +
          x[1] +
          "</bdi></b><em>" +
          (x[2] || "&nbsp;") +
          "</em></div>",
      )
      .join("") +
    "</div>";
  const vc = (v) =>
    v.includes("🔴")
      ? "#d6393f"
      : v.includes("🟢") || v.includes("✅")
        ? "#0f9d7a"
        : "#5b6787";
  const CA = "<bdi>Calls</bdi> و <bdi>Answers</bdi>",
    ansSub = (SET.op === "gte" ? "مدة ≥ " : "مدة > ") + SET.thr + " ث";
  const tc = L.reduce((s, o) => s + o.calls, 0),
    ta = L.reduce((s, o) => s + o.answers, 0),
    tas = L.reduce((s, o) => s + o.asecs, 0);
  const lab = (o) =>
    (names[o.ext] ? names[o.ext].split(" ")[0] : o.ext).slice(0, 9);
  const tt = tseries(UR, byH, keys),
    tTitle = CA + (byH ? " حسب الساعة (الفريق)" : " حسب اليوم (الفريق)");
  let out =
    '<div class="rp-page">' +
    head("تقرير أداء الـ Agents") +
    "<p>" +
    filt +
    "</p>" +
    K([
      ["إجمالي Calls", tc, $("fAns").checked ? "ANSWERED فقط" : "كل النتائج"],
      ["إجمالي Answers", ta, ansSub],
      [
        "نسبة الـ Answer",
        (tc ? Math.round((ta / tc) * 100) : 0) + "%",
        "Answers ÷ Calls",
      ],
      ["متوسط زمن المكالمة", fm2(ta ? tas / ta : 0), "للـ Answers فقط"],
    ]) +
    '<table class="rpt"><colgroup><col style="width:5%"><col style="width:8%"><col style="width:21%"><col style="width:10%"><col style="width:11%"><col style="width:10%"><col style="width:20%"><col style="width:15%"></colgroup><tr><th>#</th><th>الكود</th><th class="l">الاسم</th><th>Calls</th><th>Answers</th><th>النسبة</th><th>متوسط زمن المكالمة</th><th>التقييم</th></tr>' +
    L.map(
      (o, i) =>
        "<tr><td>" +
        (i + 1) +
        "</td><td>" +
        o.ext +
        '</td><td class="l"><bdi>' +
        esc(names[o.ext] || "—") +
        "</bdi></td><td>" +
        o.calls +
        "</td><td>" +
        o.answers +
        "</td><td>" +
        Math.round(o.rate * 100) +
        "%</td><td>" +
        fm2(o.avgA) +
        "</td><td>" +
        VERD(o) +
        "</td></tr>",
    ).join("") +
    '<tr class="tot"><td></td><td></td><td class="l">الإجمالي</td><td>' +
    tc +
    "</td><td>" +
    ta +
    "</td><td>" +
    (tc ? Math.round((ta / tc) * 100) : 0) +
    "%</td><td>" +
    fm2(ta ? tas / ta : 0) +
    "</td><td></td></tr></table>" +
    '<p style="color:#5b6787">التقييم: ' +
    rule +
    "</p>" +
    '</div><div class="rp-page">' +
    head("تحليل الفريق") +
    "<p>" +
    filt +
    "</p><div>" +
    bars(
      L.map(lab),
      L.map((o) => o.calls),
      L.map((o) => o.answers),
      "حسب المستخدم",
      "rp",
      1,
    ) +
    (keys.length ? bars(tt.lb, tt.c, tt.a, tTitle, "rp", 1) : "") +
    "</div>" +
    (keys.length ? peakTxt(tt, byH) : "") +
    "</div>";
  const rank = [...L].sort((a, b) => b.answers - a.answers);
  L.forEach((o) => {
    const rs = UR.filter((r) => r.ext === o.ext),
      an = rs.filter((r) => isA(r.dur)).sort((a, b) => b.dur - a.dur);
    const bk = [
      ["أقل من 2 د", (x) => x < 120],
      ["من 2 إلى 5 د", (x) => x >= 120 && x < 300],
      ["من 5 إلى 10 د", (x) => x >= 300 && x < 600],
      ["10 د فأكتر", (x) => x >= 600],
    ].map((b) => [b[0], an.filter((r) => b[1](r.dur)).length]);
    const pct =
        TEAM.avgA && o.avgA ? Math.round((o.avgA / TEAM.avgA - 1) * 100) : null,
      t = tseries(rs, byH, keys);
    out +=
      '<div class="rp-page">' +
      head("تحليل Agent") +
      "<h2><bdi>" +
      (names[o.ext] ? esc(names[o.ext]) : "Agent") +
      '</bdi> <small style="color:#5b6787;font-size:.9rem">(كود <bdi>' +
      o.ext +
      "</bdi>)</small></h2><p>" +
      filt +
      "</p>" +
      K([
        ["Calls", o.calls, $("fAns").checked ? "ANSWERED فقط" : "كل النتائج"],
        ["Answers", o.answers, ansSub],
        ["نسبة الـ Answer", Math.round(o.rate * 100) + "%", "Answers ÷ Calls"],
        ["متوسط زمن المكالمة", fm2(o.avgA), "للـ Answers فقط"],
        [
          "التقييم",
          VERD(o),
          SET.mode === "team" ? "بالنسبة لمتوسط الفريق" : "بحدود ثابتة",
          vc(VERD(o)),
        ],
        [
          "مقارنة بالفريق",
          pct === null ? "—" : (pct > 0 ? "+" : "") + pct + "%",
          "متوسط الفريق " + fm2(TEAM.avgA),
        ],
        ["أطول مكالمة", an.length ? fmtD(an[0].dur) : "—", "د:ث"],
        [
          "الترتيب",
          rank.indexOf(o) + 1 + " من " + L.length,
          "حسب عدد الـ Answers",
        ],
      ]) +
      (keys.length
        ? bars(
            t.lb,
            t.c,
            t.a,
            CA + (byH ? " حسب الساعة" : " حسب اليوم"),
            "rp",
            1,
          ) + peakTxt(t, byH)
        : "") +
      '<div class="two"><div><div class="rp-t">توزيع مدة الـ Answers</div><table class="rpt"><colgroup><col style="width:46%"><col style="width:27%"><col style="width:27%"></colgroup><tr><th class="l">المدة</th><th>العدد</th><th>النسبة</th></tr>' +
      bk
        .map(
          (b) =>
            '<tr><td class="l">' +
            b[0] +
            "</td><td>" +
            b[1] +
            "</td><td>" +
            (an.length ? Math.round((b[1] / an.length) * 100) : 0) +
            "%</td></tr>",
        )
        .join("") +
      '<tr class="tot"><td class="l">الإجمالي</td><td>' +
      an.length +
      "</td><td>" +
      (an.length ? "100%" : "0%") +
      "</td></tr></table></div>" +
      '<div><div class="rp-t">أطول 5 مكالمات</div><table class="rpt"><colgroup><col style="width:9%"><col style="width:41%"><col style="width:30%"><col style="width:20%"></colgroup><tr><th>#</th><th>الوقت</th><th>Dst</th><th>المدة</th></tr>' +
      Array.from({ length: 5 }, (_, i) => {
        const r = an[i];
        return r
          ? "<tr><td>" +
              (i + 1) +
              "</td><td><bdi>" +
              esc(r.t) +
              "</bdi></td><td><bdi>" +
              esc(r.dst) +
              "</bdi></td><td>" +
              fmtD(r.dur) +
              "</td></tr>"
          : "<tr><td>" + (i + 1) + "</td><td>—</td><td>—</td><td>—</td></tr>";
      }).join("") +
      "</table></div></div></div>";
  });
  return out;
}
function exportPDF() {
  if (!L_last.length) return;
  $("report").innerHTML = buildReport();
  document.body.classList.add("printing");
  setTimeout(() => window.print(), 80);
}
addEventListener("afterprint", () => {
  document.body.classList.remove("printing");
  $("report").innerHTML = "";
});
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-pdf]")) exportPDF();
});
syncSet();
