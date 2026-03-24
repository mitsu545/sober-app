"use strict";
const WEEKLY_LIMIT = 5;
const WEEKLY_GOAL  = 3;

const REGRET_COSTS = [
  ["🤢","頭痛・だるさで午前中のパフォーマンスが約40%低下（Harvard調査）"],
  ["💸","1回の飲酒コストは酒代+翌日の生産性損失で実質2倍以上"],
  ["😴","深い睡眠が失われ、翌朝の集中力・記憶力が顕著に低下する"],
  ["🧠","前頭前野の働きが最大30%低下し、さらに飲みたくなる悪循環を生む"],
  ["📈","週3日以上の飲酒は肝臓の脂肪蓄積を加速し、肝臓年齢が15歳老ける"],
  ["🫀","飲酒翌日は心拍数が平均8%上昇し、心臓への慢性的な負担を作る"],
  ["💊","アルコールは翌日の気力・やる気を根本から奪う睡眠破壊物質"],
  ["🧬","1回の飲酒で腸内善玉菌が最大24時間ダメージを受ける（腸脳相関）"],
  ["💧","利尿作用で脱水し、翌朝の肌・頭皮・目が劣化する"],
  ["⏰","飲酒後の睡眠は浅く、実質的な休息時間が約30%減少する"],
];

const MILESTONES = [
  {weeks:1, icon:"🌱",label:"1週間",desc:"節酒習慣のスタート"},
  {weeks:2, icon:"💧",label:"2週間",desc:"睡眠の質が改善し始める"},
  {weeks:4, icon:"⚡",label:"1ヶ月",desc:"仕事パフォーマンスが上がる"},
  {weeks:8, icon:"🏔️",label:"2ヶ月",desc:"肝機能が目に見えて改善"},
  {weeks:12,icon:"🌟",label:"3ヶ月",desc:"習慣が完全に書き換わる"},
  {weeks:26,icon:"👑",label:"半年", desc:"人生の質が根本から変わる"},
];

function getDogSVG(stage) {
  const ext = stage === 5 ? 'jpg' : 'png';
  const w   = stage >= 4 ? 160 : 130;
  const h   = stage >= 4 ? 110 : 130;
  return `<img src="dog${stage}.${ext}" width="${w}" height="${h}" style="object-fit:contain;filter:drop-shadow(0 4px 12px rgba(0,0,0,0.4))" alt="柴犬 stage ${stage}">`;
}

// ─── STATE ───────────────────────────────────────────────────
const STATE_KEY = "wb_state_v3";
let state = {
  startDate:null, dailyCost:600, log:{}, urges:[], tactics:[],
  currentTab:"home", historyMonthOffset:0, bestStreak:0, bestWeeks:0,
};

// ─── ★ タイムゾーンバグ修正：常にローカル日付を使う ──────────
function localDateStr(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const todayKey = () => localDateStr(new Date());

function daysAgoKey(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateStr(d);
}

// ─── PERF: メモ化 ────────────────────────────────────────────
let _gwCache = {v:0, h:""};
function goalWeeks() {
  const h = JSON.stringify(state.log);
  if (_gwCache.h === h) return _gwCache.v;
  let c = 0;
  for (let i = 0; i >= -52; i--) {
    const s = weekStats(getWeekDays(i));
    if (s.drank < WEEKLY_LIMIT && (s.sober + s.drank) >= 3) c++;
  }
  _gwCache = {v:c, h};
  return c;
}

// ─── PERSISTENCE ─────────────────────────────────────────────
function saveState() {
  try {
    const streak = calcStreak();
    if (streak > (state.bestStreak || 0)) state.bestStreak = streak;
    const gw = goalWeeks();
    if (gw > (state.bestWeeks || 0)) state.bestWeeks = gw;
    localStorage.setItem(STATE_KEY, JSON.stringify({
      startDate:  state.startDate ? state.startDate.toISOString() : null,
      dailyCost:  state.dailyCost, log:state.log, urges:state.urges,
      tactics:    state.tactics, bestStreak:state.bestStreak, bestWeeks:state.bestWeeks,
    }));
    _gwCache.h = "";
  } catch(e) { console.warn("Save failed:", e); }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d.startDate)  state.startDate  = new Date(d.startDate);
    if (d.dailyCost)  state.dailyCost  = Number(d.dailyCost);
    if (d.log)        state.log        = d.log;
    if (d.urges)      state.urges      = d.urges;
    if (d.tactics)    state.tactics    = d.tactics;
    if (d.bestStreak) state.bestStreak = d.bestStreak;
    if (d.bestWeeks)  state.bestWeeks  = d.bestWeeks;
  } catch(e) { console.warn("Load failed:", e); }
}

function exportData() {
  const raw = localStorage.getItem(STATE_KEY) || "{}";
  const ta  = document.getElementById("backup-text");
  if (ta) ta.value = raw;
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(raw)
      .then(() => alert("コピーしました！\niPhoneの「メモ」アプリに貼り付けて保存してください。"))
      .catch(() => { if (ta) ta.select(); alert("テキストエリアの文字を手動でコピーしてください。"); });
  } else {
    if (ta) { ta.select(); try { document.execCommand("copy"); alert("コピーしました！"); } catch(e2) { alert("手動でコピーしてください。"); } }
  }
}

function importData() {
  const ta = document.getElementById("backup-text");
  const raw = ta?.value?.trim();
  if (!raw) { alert("テキストが空です。"); return; }
  if (!confirm("現在のデータを上書きします。よろしいですか？")) return;
  try {
    JSON.parse(raw);
    localStorage.setItem(STATE_KEY, raw);
    loadState(); closeModal(); renderContent();
    alert("復元しました！");
  } catch(e) { alert("データが壊れています。"); }
}

// ─── HELPERS ─────────────────────────────────────────────────
function getWeekDays(offset = 0) {
  const days = [];
  const now = new Date();
  const mon = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7) + offset * 7);
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + i);
    days.push(localDateStr(d));
  }
  return days;
}

function weekStats(days) {
  return {
    drank: days.filter(d => state.log[d] === "drank").length,
    sober: days.filter(d => state.log[d] === "sober").length,
  };
}

function totalStats() {
  const sober = Object.values(state.log).filter(v => v === "sober").length;
  return { sober, saved: sober * state.dailyCost };
}

function calcStreak() {
  let streak = 0;
  const ts = state.log[todayKey()];
  let startDaysAgo = (!ts) ? 1 : (ts === "drank") ? -1 : 0;
  if (startDaysAgo < 0) return 0;
  for (let i = startDaysAgo; i < 365; i++) {
    const k = daysAgoKey(i);
    if (state.log[k] === "sober") streak++;
    else break;
  }
  return streak;
}

function getDogStage() {
  const drankCount = getWeekDays(0).filter(d => state.log[d] === "drank").length;
  if (drankCount >= WEEKLY_LIMIT) return 5;
  const k1 = daysAgoKey(1);
  const k2 = daysAgoKey(2);
  const recovered = (state.log[k1] === "sober" && state.log[k2] === "sober");
  const base = Math.min(4, drankCount);
  return recovered ? Math.max(0, base - 1) : base;
}

function getWeekDrinks() {
  return getWeekDays(0).filter(d => state.log[d] === "drank").length;
}

function getDaysUntilRecovery() {
  const today = todayKey();
  const k1 = daysAgoKey(1);
  if (state.log[today] === "sober" && state.log[k1] === "sober") return 0;
  if (state.log[today] === "sober") return 1;
  return 2;
}

function checkDangerZone() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  document.getElementById("danger-banner")?.classList.toggle("show", h >= 18 && h < 19.5);
}

// ─── MODAL ────────────────────────────────────────────────────
function openModal(type) {
  const mc = document.getElementById("modal-container");
  let content = "";
  if (type === 'setup') {
    content = `<h3 class="tab-title">⚙️ セットアップ</h3>
      <p class="section-desc">基本情報を設定してください。</p>
      <div class="col">
        <div><label class="label-sm">開始日</label><input type="date" id="setup-date" class="inp" value="${state.startDate ? localDateStr(state.startDate) : todayKey()}"></div>
        <div><label class="label-sm">1日の酒代（平均）</label><input type="number" id="setup-cost" class="inp" value="${state.dailyCost}"></div>
        <button class="btn-cyan" onclick="saveSetup()">保存する</button>
      </div>`;
  } else if (type === 'recovery') {
    content = `<h3 class="tab-title">📝 飲酒の記録</h3>
      <p class="section-desc">飲んでしまった状況を記録して、次回の対策を立てましょう。</p>
      <div class="col">
        <div><label class="label-sm">どんな状況でしたか？（原因）</label><textarea id="rec-situation" class="inp" style="height:80px" placeholder="例：仕事で疲れて駅前のコンビニに寄った"></textarea></div>
        <div><label class="label-sm">次はどうしますか？（対策）</label><textarea id="rec-action" class="inp" style="height:80px" placeholder="例：炭酸水を買って帰る、別の道を通る"></textarea></div>
        <button class="btn-red" style="background:var(--red);color:white" onclick="logToday('drank')">記録を保存</button>
      </div>`;
  } else if (type === 'backup') {
    content = `<h3 class="tab-title">💾 バックアップ・復元</h3>
      <p class="section-desc">データをテキスト形式で保存・復元できます。</p>
      <textarea id="backup-text" class="inp" style="height:120px;font-size:10px;margin-bottom:16px"></textarea>
      <div class="row2">
        <button class="btn-gray" onclick="exportData()">コピー</button>
        <button class="btn-cyan" onclick="importData()">復元</button>
      </div>`;
  } else if (type === 'tactic') {
    content = `<h3 class="tab-title">🛡️ 新しい対策</h3>
      <div class="col">
        <div><label class="label-sm">状況</label><textarea id="tac-situation" class="inp" style="height:80px"></textarea></div>
        <div><label class="label-sm">行動</label><textarea id="tac-action" class="inp" style="height:80px"></textarea></div>
        <button class="btn-cyan" onclick="saveTactic()">登録する</button>
      </div>`;
  }
  
  mc.innerHTML = `<div class="overlay" onclick="if(event.target===this)closeModal()">
    <div class="sheet">
      <div style="display:flex;justify-content:flex-end;margin-bottom:10px">
        <button onclick="closeModal()" style="font-size:24px;color:var(--muted)">×</button>
      </div>
      ${content}
    </div>
  </div>`;
}

function closeModal() {
  document.getElementById("modal-container").innerHTML = "";
}

function saveSetup() {
  const date = document.getElementById("setup-date").value;
  const cost = document.getElementById("setup-cost").value;
  if (!date || !cost) return;
  state.startDate = new Date(date);
  state.dailyCost = Number(cost);
  saveState();
  closeModal();
  renderContent();
}

function saveTactic() {
  const sit = document.getElementById("tac-situation").value.trim();
  const act = document.getElementById("tac-action").value.trim();
  if (!sit || !act) return;
  state.tactics.push({ date:todayKey(), situation:sit, action:act, attempts:[] });
  saveState();
  closeModal();
  renderContent();
}

// ─── LOGGING ──────────────────────────────────────────────────
function logToday(val) {
  const k = todayKey();
  state.log[k] = val;
  if (val === "drank") {
    const sit = document.getElementById("rec-situation")?.value?.trim();
    const act = document.getElementById("rec-action")?.value?.trim();
    if (sit && act) {
      state.tactics.push({ date:k, situation:sit, action:act, attempts:[] });
    }
    // 飲んだ場合はコミットメントをリセット
    localStorage.removeItem("wb_commit_" + k);
  }
  saveState();
  closeModal();
  renderContent();
  if (val === "drank" && getDogStage() === 5) {
    showDeathScreen();
  }
}

function undoToday() {
  if (!confirm("今日の記録を取り消しますか？")) return;
  delete state.log[todayKey()];
  saveState();
  renderContent();
}

function morningCommit() {
  localStorage.setItem("wb_commit_" + todayKey(), "1");
  renderContent();
}

function showDeathScreen() {
  const ds = document.getElementById("death-screen");
  const dc = document.getElementById("death-content");
  dc.innerHTML = `
    <div style="font-size:80px;margin-bottom:20px">💀</div>
    <h2 style="color:var(--red);font-size:24px;margin-bottom:16px">柴犬が倒れました</h2>
    <p style="color:var(--muted);line-height:1.8;margin-bottom:30px">今週の飲酒上限を超えました。<br>柴犬を休ませてあげてください。<br>来週の月曜日に復活します。</p>
    <button class="btn-gray" onclick="document.getElementById('death-screen').classList.remove('show')">閉じる</button>
  `;
  ds.classList.add("show");
}

// ─── ROUTING ─────────────────────────────────────────────────
function switchTab(tab) {
  state.currentTab = tab;
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("nav-" + tab).classList.add("active");
  document.getElementById("content").scrollTop = 0;
  renderContent();
}

function renderContent() {
  const el = document.getElementById("content");
  const map = { home:renderHome, savings:renderSavings, tactics:renderTactics, history:renderHistory };
  el.innerHTML = (map[state.currentTab] || renderHome)();
}

// ─── HOME TAB ────────────────────────────────────────────────
function renderHome() {
  if (!state.startDate) {
    return `<div style="text-align:center;padding:80px 20px">
      <div style="font-size:80px;margin-bottom:20px;filter:drop-shadow(0 0 20px rgba(34,211,238,.3))">🐕</div>
      <h2 style="font-family:'Noto Serif JP',serif;font-size:24px;margin-bottom:16px;line-height:1.5">ワタベさん専用<br>節酒トラッカー</h2>
      <p style="color:var(--muted);font-size:14px;line-height:1.8;margin-bottom:40px">柴犬と一緒に節酒を続けましょう。<br>飲むたびに柴犬が元気をなくします。</p>
      <button class="btn-cyan" onclick="openModal('setup')">今すぐセットアップ →</button>
    </div>`;
  }

  const weekDrinks  = getWeekDrinks();
  const dogStage    = getDogStage();
  const remaining   = WEEKLY_LIMIT - weekDrinks;
  const isDead      = dogStage === 5;
  const todayLogged = state.log[todayKey()];
  const streak      = calcStreak();
  const {saved}     = totalStats();
  const thisWeek    = getWeekDays(0);
  const todayIdx    = (new Date().getDay() + 6) % 7;
  const dayNames    = ["月","火","水","木","金","土","日"];
  const hour        = new Date().getHours();
  const isMorning   = hour >= 5 && hour < 12;
  const committed   = localStorage.getItem("wb_commit_" + todayKey()) === "1";
  const daysToRecover = getDaysUntilRecovery();

  const dogBg = isDead ? "linear-gradient(135deg,#1a0a0a,#0d0505)"
    : dogStage >= 3 ? "linear-gradient(135deg,#1a0d0a,#120800)"
    : dogStage >= 1 ? "linear-gradient(135deg,#1a1a0a,#120d00)"
    : "linear-gradient(135deg,#0a1a0a,#061206)";
  const dogBorder = isDead?"#3D1515":dogStage>=3?"#3D2010":dogStage>=1?"#3D3010":"#1A3D1A";
  const stageNames = ["元気いっぱい","普通","疲れ気味","ぐったり","瀕死","💀 今週終了"];
  const stageColors= ["var(--green)","#86d368","var(--amber)","#f97316","var(--red)","#6B7280"];
  const dots = Array.from({length:WEEKLY_LIMIT},(_,i)=>{
    const filled=i<(WEEKLY_LIMIT-weekDrinks);
    return `<div class="dog-pip ${filled?(i<WEEKLY_LIMIT-WEEKLY_GOAL?"alive":"warned"):"dead"}"></div>`;
  }).join("");

  const weekCells = thisWeek.map((d,i)=>{
    const s=state.log[d],isToday=i===todayIdx;
    let cls="week-cell";
    if(s==="sober")cls+=" sober";else if(s==="drank")cls+=" drank";else if(isToday)cls+=" today";else cls+=" empty";
    return `<div><div class="week-cell-label" style="color:${isToday?"var(--cyan)":"var(--muted)"}">${dayNames[i]}</div><div class="${cls}">${s==="sober"?"○":s==="drank"?"×":""}</div></div>`;
  }).join("");

  const streakCard = streak>0?`
    <div class="card" style="display:flex;align-items:center;gap:16px;border:1px solid rgba(245,158,11,${streak>=7?.6:.3});background:linear-gradient(135deg,rgba(245,158,11,.08),rgba(245,158,11,.02))">
      <div style="font-size:44px;line-height:1">🔥</div>
      <div style="flex:1">
        <p style="font-size:11px;letter-spacing:2px;color:var(--amber);text-transform:uppercase;font-weight:700;margin-bottom:4px">連続クリア</p>
        <div style="display:flex;align-items:baseline;gap:4px">
          <span style="font-family:'Noto Serif JP',serif;font-size:40px;font-weight:700;color:var(--amber);line-height:1">${streak}</span>
          <span style="font-size:16px;color:var(--dim);font-weight:600">日連続</span>
        </div>
        <p style="font-size:12px;color:var(--muted);margin-top:4px;font-weight:600">${streak>=30?"🏆 1ヶ月超え！":streak>=14?"⚡ 2週間突破！":streak>=7?"🌟 1週間達成！":"この記録を守り続けよう"}</p>
      </div>
    </div>`:"";

  const morningCard=(!todayLogged&&isMorning&&!committed)?`
    <div class="card" style="border:1px solid rgba(34,211,238,.45);background:linear-gradient(135deg,rgba(34,211,238,.1),rgba(34,211,238,.02))">
      <p style="font-size:11px;letter-spacing:2px;color:var(--cyan);text-transform:uppercase;font-weight:700;margin-bottom:10px">☀️ 朝のコミットメント</p>
      <p style="font-size:15px;font-weight:700;margin-bottom:6px">今日、飲まないと宣言しますか？</p>
      <p style="font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:16px">朝に宣言するだけで夕方の衝動が40%抑制されます（Gollwitzer研究）。</p>
      <button class="btn-cyan" style="padding:14px;font-size:15px" onclick="morningCommit()">✊ 今日は飲まない！と宣言する</button>
    </div>`:"";

  const commitBanner = committed
    ? '<div class="card" style="border:1px solid rgba(245,158,11,.4);background:rgba(245,158,11,.05);text-align:center;padding:12px"><p style="font-size:12px;color:var(--amber);font-weight:700;letter-spacing:1px;text-transform:uppercase">✊ 今日は飲まないと宣言済み — ミッション実行中</p></div>'
    : '';
  const drankNote = todayLogged === "drank"
    ? '<p style="font-size:12px;color:var(--muted);margin-top:8px;line-height:1.6">原因と対策が「作戦タブ」に記録されました。<br>明日はまた新しいスタートです。</p>'
    : '';
  const _tcBorder  = committed ? "rgba(245,158,11,.4)"  : "rgba(34,211,238,.3)";
  const _tcBg      = committed ? "rgba(245,158,11,.03)" : "rgba(34,211,238,.03)";
  const _tcColor   = committed ? "var(--amber)" : "var(--cyan)";
  const _lgBg      = todayLogged === "sober" ? "rgba(34,211,238,.06)" : "rgba(239,68,68,.06)";
  const _lgBorder  = todayLogged === "sober" ? "rgba(34,211,238,.3)"  : "rgba(239,68,68,.3)";
  const _lgColor   = todayLogged === "sober" ? "var(--cyan)" : "var(--red)";
  const _lgIcon    = todayLogged === "sober" ? "✅" : "📝";
  const _lgMsg     = todayLogged === "sober" ? "休肝達成！素晴らしい選択です。" : "データを記録しました。";
  const todayCard = !todayLogged
    ? '<div class="card" style="border:1px solid '+_tcBorder+';background:linear-gradient(180deg,var(--bg2),'+_tcBg+')">'
      + '<p style="font-size:14px;font-weight:700;color:'+_tcColor+';margin-bottom:16px;text-align:center">今日のミッションはクリアしましたか？</p>'
      + '<div class="row2">'
      + "<button class=\"btn-cyan\" style=\"padding:16px;font-size:16px\" onclick=\"logToday('sober')\">✓ 休肝達成</button>"
      + "<button class=\"btn-red\" style=\"padding:16px;font-size:14px\" onclick=\"openModal('recovery')\">飲んでしまった</button>"
      + '</div></div>'
    : '<div class="card" style="text-align:center;position:relative;background:'+_lgBg+';border:1px solid '+_lgBorder+'">'
      + '<button onclick="undoToday()" style="position:absolute;top:14px;right:14px;font-size:12px;font-weight:600;color:var(--muted);background:var(--bg3);padding:6px 12px;border-radius:8px;border:1px solid var(--border)">↩ 取消</button>'
      + '<p style="font-size:32px;margin-bottom:8px;margin-top:8px">'+_lgIcon+'</p>'
      + '<p style="color:'+_lgColor+';font-weight:700;font-size:16px">'+_lgMsg+'</p>'
      + drankNote + '</div>';

  const _deadBlock = isDead
    ? '<div style="margin-top:14px;background:rgba(239,68,68,.1);border-radius:10px;padding:12px;text-align:center;border:1px solid rgba(239,68,68,.3)"><p style="font-size:13px;color:var(--red);font-weight:700">今週の飲酒上限に達しました</p><p style="font-size:12px;color:var(--muted);margin-top:4px">月曜日になると柴犬が復活します</p></div>'
    : weekDrinks>=WEEKLY_GOAL
      ? '<div style="margin-top:14px;background:rgba(245,158,11,.08);border-radius:10px;padding:10px;text-align:center"><p style="font-size:12px;color:var(--amber);font-weight:600">⚠ 目標の週'+WEEKLY_GOAL+'回を超えています。あと'+remaining+'回で柴犬が倒れます。</p></div>'
      : '';

  return `<div class="col">
    <div class="dog-card" style="background:${dogBg};border:1px solid ${dogBorder}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <p class="label-sm" style="margin:0;color:${stageColors[dogStage]}">🐕 柴犬の状態</p>
        <span style="font-size:12px;font-weight:700;color:${stageColors[dogStage]}">${stageNames[dogStage]}</span>
      </div>
      <div class="dog-svg-wrap">${getDogSVG(dogStage)}</div>
      <div class="dog-meter">${dots}</div>
      <div style="margin-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div style="background:rgba(0,0,0,.3);border-radius:10px;padding:10px;text-align:center">
          <p style="font-size:10px;color:var(--muted);font-weight:600;margin-bottom:4px">今週あと</p>
          <p style="font-size:22px;font-weight:700;color:${remaining<=1?"var(--red)":remaining<=2?"var(--amber)":"var(--cyan)"}">${isDead?"0":remaining}<span style="font-size:13px;color:var(--muted)"> 回</span></p>
        </div>
        <div style="background:rgba(0,0,0,.3);border-radius:10px;padding:10px;text-align:center">
          <p style="font-size:10px;color:var(--muted);font-weight:600;margin-bottom:4px">回復まで</p>
          <p style="font-size:${daysToRecover===0?"16px":"18px"};font-weight:700;color:${daysToRecover===0?"var(--green)":"var(--amber)"}">${daysToRecover===0?"回復中":daysToRecover+"日飲まない"}</p>
        </div>
      </div>
      ${_deadBlock}
    </div>
    <div class="card" style="background:linear-gradient(135deg,#0c1a2e,#091526);border:1px solid #0e3a5c">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <p class="label-sm" style="margin:0">今週の記録</p>
        <span style="font-size:12px;font-weight:700;color:var(--green)">節約累計 ¥${saved.toLocaleString()}</span>
      </div>
      <div class="week-grid">${weekCells}</div>
    </div>
    ${streakCard}${morningCard}${commitBanner}${todayCard}
    <div id="home-urge-section">
      ${renderUrgeSection()}
    </div>
  </div>`;
}

// ─── SAVINGS TAB ─────────────────────────────────────────────
function renderSavings() {
  const {sober,saved}=totalStats(), daily=state.dailyCost;
  const monthly=Math.round(daily*30*(7-WEEKLY_GOAL)/7), yearly=Math.round(daily*365*(7-WEEKLY_GOAL)/7);
  let goals=[];try{goals=JSON.parse(localStorage.getItem("wb_saving_goals")||"[]");}catch(e){}
  const goalCards=goals.map((g,i)=>{
    const pct=Math.min((saved/g.amount)*100,100), daysLeft=Math.max(0,Math.ceil((g.amount-saved)/daily));
    return `<div class="card" style="border:1px solid rgba(34,211,238,.2)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div style="display:flex;align-items:center;gap:12px"><span style="font-size:32px">${g.icon}</span><div><p style="font-weight:700;font-size:15px">${g.name}</p><p style="font-size:11px;color:var(--muted);margin-top:2px">目標 ¥${g.amount.toLocaleString()}</p></div></div><button onclick="removeGoal(${i})" style="font-size:20px;color:var(--dim);padding:4px 8px">×</button></div><div style="background:var(--bg3);border-radius:8px;height:10px;margin-bottom:10px;overflow:hidden"><div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#22d3ee,#34d399);border-radius:8px;transition:width .8s"></div></div><div style="display:flex;justify-content:space-between"><span style="font-size:13px;font-weight:700;color:var(--cyan)">¥${saved.toLocaleString()} <span style="font-size:11px;color:var(--muted)">/ ¥${g.amount.toLocaleString()}</span></span><span style="font-size:12px;font-weight:600;color:var(--muted)">${pct>=100?"🎉 達成！":"あと"+daysLeft+"日"}</span></div></div>`;
  }).join("");
  const ICONS=["✈️","🍖","📈","🌿","📷","🎮","🏋️","🎁","💻","🛒"];
  const iconSel=localStorage.getItem("wb_icon_sel")||"✈️";
  const iconPicker=ICONS.map(ic=>`<span onclick="selectIcon(this,event)" data-ic="${ic}" style="font-size:24px;cursor:pointer;padding:6px;border-radius:10px;background:${ic===iconSel?"rgba(34,211,238,.2)":"transparent"};border:1px solid ${ic===iconSel?"var(--cyan)":"transparent"}">${ic}</span>`).join("");
  return `<div class="col"><h3 class="tab-title">💰 資産（投資原資）</h3>
    <div class="card" style="background:linear-gradient(135deg,#0c1a2e,#091526);border:1px solid #0e3a5c;text-align:center">
      <p class="label-sm">節酒によって生み出した資金</p>
      <p style="font-family:'Noto Serif JP',serif;font-size:52px;font-weight:700;color:var(--green);line-height:1;margin-top:8px">¥${saved.toLocaleString()}</p>
      <div style="background:rgba(255,255,255,.05);padding:8px 16px;border-radius:14px;margin-top:14px;display:inline-block"><p style="font-size:13px;color:var(--muted);font-weight:600">休肝 <strong style="color:var(--text)">${sober}</strong>日 × <strong style="color:var(--text)">¥${daily}</strong>/日</p></div>
      <div style="border-top:1px dashed #1e3a5f;margin-top:24px;padding-top:20px"><p style="font-size:11px;color:var(--muted);margin-bottom:12px;font-weight:600">週${WEEKLY_GOAL}日以下を継続した場合の節約予測</p>
        <div class="row2"><div style="background:var(--bg3);border-radius:12px;padding:14px"><p style="font-size:11px;color:var(--muted);margin-bottom:6px;font-weight:600">月間</p><p style="font-size:20px;font-weight:700;color:var(--cyan)">¥${monthly.toLocaleString()}</p></div><div style="background:var(--bg3);border-radius:12px;padding:14px"><p style="font-size:11px;color:var(--muted);margin-bottom:6px;font-weight:600">年間</p><p style="font-size:20px;font-weight:700;color:var(--amber)">¥${yearly.toLocaleString()}</p></div></div>
      </div>
    </div>
    ${goals.length>0?goalCards:`<p style="font-size:13px;color:var(--muted);text-align:center;margin:8px 0;font-weight:600">下から目標を追加しましょう</p>`}
    <div class="card" style="border:1px solid rgba(245,158,11,.3)"><p style="font-size:14px;font-weight:700;color:var(--amber);margin-bottom:14px">＋ 投資・購入目標を追加</p><div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">${iconPicker}</div><input id="goal-name" class="inp" placeholder="目標名（例：NISA・スペアリブ食材）" style="margin-bottom:10px"><input id="goal-amount" class="inp" type="number" placeholder="目標金額（円）" style="margin-bottom:14px"><button class="btn-cyan" onclick="addGoal()">目標を設定する</button></div>
  </div>`;
}
function selectIcon(el,e){e.stopPropagation();localStorage.setItem("wb_icon_sel",el.getAttribute("data-ic"));renderContent();}
function addGoal(){const name=document.getElementById("goal-name")?.value?.trim();const amount=Number(document.getElementById("goal-amount")?.value);const icon=localStorage.getItem("wb_icon_sel")||"✈️";if(!name||!amount)return;let goals=[];try{goals=JSON.parse(localStorage.getItem("wb_saving_goals")||"[]");}catch(e){}goals.push({name,amount,icon});localStorage.setItem("wb_saving_goals",JSON.stringify(goals));renderContent();}
function removeGoal(idx){let goals=[];try{goals=JSON.parse(localStorage.getItem("wb_saving_goals")||"[]");}catch(e){}goals.splice(idx,1);localStorage.setItem("wb_saving_goals",JSON.stringify(goals));renderContent();}

// ─── TACTICS TAB ─────────────────────────────────────────────
function renderTactics() {
  const tactics=(state.tactics||[]).slice().reverse(), total=state.tactics.length;
  function isRepeat(s){if(!s)return false;const kws=["LINE","迎え","コンビニ","駅","疲れ","仕事","残業","家","ストック","休日","動画"];for(const kw of kws){if((state.tactics||[]).filter(t=>t.situation&&t.situation.includes(kw)).length>=2&&s.includes(kw))return true;}return false;}
  const cards=tactics.length>0?tactics.map((t,ri)=>{
    const oi=total-1-ri, num=String(total-ri).padStart(3,"0"), rep=isRepeat(t.situation);
    const attempts=t.attempts||[];
    const tot=attempts.length, wins=attempts.filter(a=>a.effective===true).length;
    const rate=tot>0?Math.round((wins/tot)*100):null;
    const rc=rate===null?"var(--muted)":rate>=70?"var(--green)":rate>=40?"var(--amber)":"var(--red)";
    const dots=attempts.map((a,ai)=>`<span onclick="toggleAttempt(${oi},${ai})" style="font-size:18px;line-height:1;cursor:pointer">${a.effective===true?"✅":a.effective===false?"❌":"⬜"}</span>`).join("");
    return `<div class="card" style="border:1px solid ${tot>0&&wins/tot>=0.5?"rgba(52,211,153,0.35)":"rgba(34,211,238,0.15)"}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <span class="label-sm" style="background:var(--bg3);padding:2px 8px;border-radius:6px;color:var(--dim)">#${num}</span>
          ${rep?`<span style="background:rgba(239,68,68,.1);color:var(--red);font-size:10px;padding:2px 8px;border-radius:6px;font-weight:700">⚠️ 頻出パターン</span>`:""}
          <span style="font-size:11px;color:var(--muted);font-weight:600">${t.date}</span>
        </div>
        <button onclick="removeTactic(${oi})" style="color:var(--dim);padding:4px;font-size:18px">×</button>
      </div>
      <div style="margin-bottom:14px"><p style="font-size:11px;color:var(--muted);margin-bottom:4px;font-weight:700;letter-spacing:1px">SITUATION</p><p style="font-size:15px;font-weight:700;line-height:1.5">${t.situation}</p></div>
      <div style="margin-bottom:16px;background:rgba(255,255,255,.03);padding:12px;border-radius:10px;border-left:3px solid var(--cyan)"><p style="font-size:11px;color:var(--cyan);margin-bottom:4px;font-weight:700;letter-spacing:1px">TACTIC</p><p style="font-size:14px;font-weight:600;line-height:1.5">${t.action}</p></div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid var(--border)">
        <div style="display:flex;gap:8px;align-items:center">${dots}<button onclick="addAttempt(${oi})" style="background:var(--bg3);border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:16px;color:var(--muted)">+</button></div>
        <div style="text-align:right">
          <p style="font-size:10px;color:var(--muted);margin-bottom:2px;font-weight:600">有効率</p>
          <p style="font-size:16px;font-weight:700;color:${rc}">${rate===null?"--":rate+"%"}</p>
        </div>
      </div>
    </div>`;
  }).join(""):"";
  return `<div class="col"><h3 class="tab-title">🛡️ 対策（IF-THENプラン）</h3>
    <div class="card" style="border:1px solid rgba(34,211,238,.3);background:linear-gradient(135deg,rgba(34,211,238,.05),transparent)">
      <p style="font-size:13px;color:var(--muted);line-height:1.6;margin-bottom:16px">「〇〇のとき（状況）、✕✕する（行動）」と決めておくと、脳の自動操縦を防げます。</p>
      <button class="btn-cyan" onclick="openModal('tactic')">＋ 新しい対策を登録</button>
    </div>
    ${cards}
  </div>`;
}
function removeTactic(i){if(!confirm("削除しますか？"))return;state.tactics.splice(i,1);saveState();renderContent();}
function addAttempt(i){state.tactics[i].attempts=state.tactics[i].attempts||[];state.tactics[i].attempts.push({date:todayKey(),effective:null});saveState();renderContent();}
function toggleAttempt(ti,ai){const a=state.tactics[ti].attempts[ai];if(a.effective===null)a.effective=true;else if(a.effective===true)a.effective=false;else a.effective=null;saveState();renderContent();}

// ─── HISTORY TAB ─────────────────────────────────────────────
function renderHistory() {
  const now=new Date();
  const target=new Date(now.getFullYear(),now.getMonth()+state.historyMonthOffset,1);
  const Y=target.getFullYear(),M=target.getMonth();
  const start=new Date(Y,M,1),end=new Date(Y,M+1,0);
  const startDay=(start.getDay()+6)%7,lastDate=end.getDate();
  const days=[];for(let i=0;i<startDay;i++)days.push(null);for(let i=1;i<=lastDate;i++)days.push(i);
  const monthLabel=`${Y}年 ${M+1}月`;
  const grid=days.map(d=>{
    if(!d)return `<div class="hist-cell empty" style="aspect-ratio:1;background:rgba(30,41,59,.2);border-radius:8px"></div>`;
    const k=`${Y}-${String(M+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`,s=state.log[k];
    let style="aspect-ratio:1;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;";
    if(s==="sober") style += "background:var(--cyan);color:var(--bg);";
    else if(s==="drank") style += "background:var(--red);color:white;";
    else style += "background:var(--bg3);color:var(--muted);";
    return `<div style="${style}">${d}</div>`;
  }).join("");
  
  const sober=Object.keys(state.log).filter(k=>k.startsWith(`${Y}-${String(M+1).padStart(2,"0")}`)&&state.log[k]==="sober").length;
  const drank=Object.keys(state.log).filter(k=>k.startsWith(`${Y}-${String(M+1).padStart(2,"0")}`)&&state.log[k]==="drank").length;
  const milestones=MILESTONES.map(m=>{
    const {sober:totalSober}=totalStats(),totalWeeks=Math.floor(totalSober/WEEKLY_GOAL),pct=Math.min((totalWeeks/m.weeks)*100,100);
    return `<div style="margin-bottom:16px"><div style="display:flex;justify-content:space-between;margin-bottom:6px"><span style="font-size:13px;font-weight:700">${m.icon} ${m.label} <span style="font-size:11px;color:var(--muted);font-weight:600">(${m.desc})</span></span><span style="font-size:11px;color:var(--muted);font-weight:700">${Math.round(pct)}%</span></div><div style="background:var(--bg3);height:6px;border-radius:3px;overflow:hidden"><div style="width:${pct}%;height:100%;background:var(--cyan);border-radius:3px"></div></div></div>`;
  }).join("");
  
  return `<div class="col"><h3 class="tab-title">📅 記録・マイルストーン</h3>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <button onclick="changeMonth(-1)" style="padding:8px 12px;background:var(--bg3);border-radius:8px">◀</button>
        <p style="font-weight:700;font-size:17px;letter-spacing:1px">${monthLabel}</p>
        <button onclick="changeMonth(1)" style="padding:8px 12px;background:var(--bg3);border-radius:8px">▶</button>
      </div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-bottom:20px">
        ${["月","火","水","木","金","土","日"].map(d=>`<div style="text-align:center;font-size:10px;color:var(--muted);font-weight:700;padding-bottom:8px">${d}</div>`).join("")}
        ${grid}
      </div>
      <div class="row2"><div style="text-align:center"><p class="label-sm">休肝日数</p><p style="font-size:20px;font-weight:700;color:var(--cyan)">${sober} <span style="font-size:12px;color:var(--muted)">日</span></p></div><div style="text-align:center"><p class="label-sm">飲酒日数</p><p style="font-size:20px;font-weight:700;color:var(--red)">${drank} <span style="font-size:12px;color:var(--muted)">日</span></p></div></div>
    </div>
    <div class="card"><p style="font-size:11px;letter-spacing:2px;color:var(--amber);text-transform:uppercase;margin-bottom:16px;font-weight:700">🏆 ロードマップ</p>${milestones}</div>
    <div class="card" style="border:1px dashed var(--border);background:transparent"><p style="font-size:14px;font-weight:700;margin-bottom:12px">⚙️ 設定・バックアップ</p><button class="btn-cyan" style="background:var(--bg3);color:var(--text);border:1px solid var(--border);margin-bottom:10px" onclick="openModal('backup')">データのバックアップ・復元</button><button class="btn-red" style="background:transparent;border:1px solid rgba(239,68,68,.3);color:var(--red);font-size:12px" onclick="resetAll()">全データをリセット</button></div>
  </div>`;
}
function changeMonth(v){state.historyMonthOffset+=v;renderContent();}
function resetAll(){if(confirm("全てのデータを消去します。よろしいですか？")){localStorage.clear();location.reload();}}

// ─── MINDFUL PAUSE (URGE SURFING) ───────────────────────────
let urgeTimer=300,urgeInterval=null,urgeRunning=false,urgeRegretIdx=0;

function renderUrgeSection() {
  if (!urgeRunning && urgeTimer === 300) {
    return `<button onclick="startUrge()" class="card" style="display:flex;align-items:center;gap:16px;width:100%;text-align:left;border:1px solid rgba(34,211,238,.3);background:linear-gradient(135deg,rgba(34,211,238,.08),rgba(34,211,238,.02));cursor:pointer;border-radius:24px;padding:20px">
      <div style="width:48px;height:48px;background:var(--cyan);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 0 15px rgba(34,211,238,.4)">🧘</div>
      <div><p style="font-weight:700;font-size:15px">マインドフル・ポーズ</p><p style="font-size:12px;color:var(--cyan);margin-top:4px;font-weight:600">飲酒欲求を「観察」する5分間</p></div>
    </button>`;
  }

  const R=58,circ=2*Math.PI*R,elapsed=300-urgeTimer,offset=circ-((elapsed/300)*circ);
  const min=Math.floor(urgeTimer/60),sec=String(urgeTimer%60).padStart(2,"0");
  const col=urgeTimer<=0?"var(--green)":"var(--cyan)";
  const regret = REGRET_COSTS[urgeRegretIdx];
  
  return `<div class="card" style="text-align:center;padding:28px 20px;border:2px solid ${col};border-radius:24px;background:rgba(2,11,24,.8)">
    <div style="position:relative;width:140px;height:140px;margin:0 auto 20px">
      <svg width="140" height="140" viewBox="0 0 140 140" style="transform:rotate(-90deg)">
        <circle cx="70" cy="70" r="${R}" fill="none" stroke="var(--bg3)" stroke-width="10"/>
        <circle id="urge-arc" cx="70" cy="70" r="${R}" fill="none" stroke="${col}" stroke-width="10" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round" style="transition:stroke-dashoffset 1s linear"/>
      </svg>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%)">
        <p id="urge-time" style="font-size:32px;font-weight:700;font-family:monospace;color:${col}">${min}:${sec}</p>
      </div>
    </div>
    <div style="min-height:80px;display:flex;flex-direction:column;justify-content:center;margin-bottom:20px">
      <p id="urge-phase" style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--text)">${urgeTimer > 0 ? "衝動の波を静かに観察中..." : "🎉 波を乗り越えました"}</p>
      <div style="background:rgba(239,68,68,.1);padding:12px;border-radius:12px;border:1px solid rgba(239,68,68,.2)">
        <p style="font-size:11px;color:var(--red);font-weight:700;margin-bottom:4px">⚠️ 飲酒の損失</p>
        <p style="font-size:13px;line-height:1.5;font-weight:600">${regret[0]} ${regret[1]}</p>
      </div>
    </div>
    <div class="row2">
      ${urgeTimer > 0 ? `<button class="btn-gray" onclick="stopUrge()" style="padding:12px;border-radius:12px">中断</button>` : `<button class="btn-cyan" onclick="resetUrge()" style="padding:12px;border-radius:12px">完了</button>`}
    </div>
  </div>`;
}

function startUrge() {
  if(urgeRunning) return;
  urgeRunning = true;
  urgeTimer = 300;
  urgeRegretIdx = Math.floor(Math.random() * REGRET_COSTS.length);
  renderContent();
  urgeInterval = setInterval(() => {
    urgeTimer--;
    if (urgeTimer % 15 === 0) { // 15秒ごとにデメリットを切り替え
      urgeRegretIdx = Math.floor(Math.random() * REGRET_COSTS.length);
    }
    if (urgeTimer <= 0) {
      clearInterval(urgeInterval);
      urgeRunning = false;
    }
    const section = document.getElementById("home-urge-section");
    if (section) section.innerHTML = renderUrgeSection();
  }, 1000);
}

function stopUrge() {
  clearInterval(urgeInterval);
  urgeRunning = false;
  urgeTimer = 300;
  renderContent();
}

function resetUrge() {
  urgeTimer = 300;
  renderContent();
}

// ─── SWIPE ───────────────────────────────────────────────────
let _swipeX=null;
document.addEventListener("touchstart",e=>{if(state.currentTab==="history")_swipeX=e.touches[0].clientX;},{passive:true});
document.addEventListener("touchend",e=>{if(state.currentTab!=="history"||_swipeX===null)return;const dx=e.changedTouches[0].clientX-_swipeX;_swipeX=null;if(Math.abs(dx)>60)changeMonth(dx<0?-1:1);},{passive:true});

let _lastVis=Date.now();
document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible"){const now=Date.now();if(now-_lastVis>60000){renderContent();checkDangerZone();}_lastVis=now;}});

window._mainScriptLoaded = true;
document.addEventListener('DOMContentLoaded', function() {
  try { loadState(); } catch(e) { console.error(e); }
  try { renderContent(); checkDangerZone(); setInterval(checkDangerZone, 60000); } catch(e) { console.error(e); }
});
