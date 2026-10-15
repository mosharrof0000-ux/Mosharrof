const SESSIONS_KEY = "mosharrof_chat_sessions_v1";
const ACTIVE_SESSION_KEY = "mosharrof_active_session_v1";
const STORE_KEY = "mosharrof_chat_v1";
const DELETED_KEY = "mosharrof_deleted_chat_ids_v1";
function deletedIds() {
  try { const ids = JSON.parse(localStorage.getItem(DELETED_KEY) || "[]"); return new Set(Array.isArray(ids) ? ids : []); }
  catch { return new Set(); }
}
function installDeleteGuard() {
  if (Storage.prototype.__mosharrofHistoryDeleteGuard) return;
  const originalSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function(key, value) {
    if (key === SESSIONS_KEY) {
      try {
        const removed = deletedIds();
        const sessions = JSON.parse(String(value));
        if (Array.isArray(sessions)) value = JSON.stringify(sessions.filter((item) => !removed.has(item.id)));
      } catch {}
    }
    return originalSetItem.call(this, key, value);
  };
  Storage.prototype.__mosharrofHistoryDeleteGuard = true;
}
function markDeleted(id) {
  const removed = deletedIds(); removed.add(id);
  try { localStorage.setItem(DELETED_KEY, JSON.stringify(Array.from(removed))); } catch {}
  persist(readSessions().filter((item) => item.id !== id));
}


function readSessions() {
  try {
    const value = JSON.parse(localStorage.getItem(SESSIONS_KEY) || "[]");
    const removed = deletedIds();
    return Array.isArray(value) ? value.filter((item) => item && item.id && Array.isArray(item.messages) && !removed.has(item.id)) : [];
  } catch { return []; }
}
function activeId() { try { return localStorage.getItem(ACTIVE_SESSION_KEY); } catch { return null; } }
function generatedTitle(item) {
  const messages = Array.isArray(item.messages) ? item.messages : [];
  const first = messages.find((message) => message && message.role === "user" && String(message.text || "").trim());
  if (!first) return "নতুন চ্যাট";
  const title = String(first.text).replace(/\s+/g, " ").trim();
  return title.length > 42 ? title.slice(0, 41) + "…" : title;
}
function titleOf(item) { return String(item.title || "").trim() || generatedTitle(item); }
function timeOf(item) { return String(item.lastActiveAt || item.openedAt || ""); }
function persist(sessions) {
  try { localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions)); return true; }
  catch { notify("ইতিহাস সংরক্ষণে সমস্যা হয়েছে"); return false; }
}
function notify(message) {
  const toast = document.getElementById("toast");
  if (toast) { toast.textContent = message; toast.classList.add("show"); setTimeout(() => toast.classList.remove("show"), 2200); }
}
function addStyles() {
  if (document.getElementById("mosharrof-history-organ-style")) return;
  const style = document.createElement("style");
  style.id = "mosharrof-history-organ-style";
  style.textContent = [
    "#drawerLeft{display:flex;flex-direction:column;overflow:hidden}",
    "#drawerLeft .history-tools{display:flex;flex:1;min-height:0;flex-direction:column}",
    "#drawerLeft .history-list{display:flex;flex:1;min-height:72px;max-height:none;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}",
    "#drawerLeft .history-list.history-shut{display:none}",
    "#drawerLeft .history-tools.history-shut{flex:0 0 auto}",
    "#drawerLeft .history-tools.history-shut>.history-search,#drawerLeft .history-tools.history-shut>.history-new{display:none}",
    "#drawerLeft .nav{flex:0 1 auto;max-height:35vh;overflow-y:auto;min-height:0}",
    "#drawerLeft .history-item small,#sessionMeta{display:none!important}",
    ".history-heading{display:flex;align-items:center;gap:6px;padding:4px 2px;color:var(--muted);font-size:11px;font-weight:700}",
    ".history-shutter,.history-archive-toggle{display:flex;align-items:center;gap:5px;min-height:32px;padding:5px 7px;border:1px solid var(--border);border-radius:8px;color:var(--muted);font-size:11px}",
    ".history-shutter{flex:1;text-align:left}.history-archive-toggle{flex:none}",
    ".history-shutter svg{width:14px;height:14px;transition:transform .18s ease}",
    ".history-shutter[aria-expanded=false] svg{transform:rotate(-90deg)}",
    ".history-item.history-pinned:before{content:'📌';font-size:11px;flex:none}",
    ".history-item.history-archived{opacity:.7}",
    ".history-action-menu{position:fixed;z-index:10020;min-width:172px;max-width:calc(100vw - 24px);padding:6px;background:#202123;border:1px solid rgba(255,255,255,.18);border-radius:12px;box-shadow:0 12px 36px rgba(0,0,0,.55);display:flex;flex-direction:column;gap:2px}",
    ".history-action-menu button{width:100%;padding:10px 12px;border-radius:8px;text-align:left;font-size:13px;color:#f5f5f5}",
    ".history-action-menu button:hover,.history-action-menu button:focus-visible{background:#343434;outline:none}",
    ".history-action-menu button.danger{color:#ff8b8b}",
    ".chat-scroll.history-conversation-collapsed .messages{display:none}"
  ].join("\n");
  document.head.appendChild(style);
}
function closeActionMenu() { document.getElementById("historyActionMenu")?.remove(); }
function saveAction(item, action) {
  const sessions = readSessions();
  const current = sessions.find((entry) => entry.id === item.id);
  if (!current) return;
  action(current, sessions);
  persist(sessions);
}
function showActionMenu(item, anchor, x, y, onRefresh) {
  closeActionMenu();
  const menu = document.createElement("div");
  menu.id = "historyActionMenu"; menu.className = "history-action-menu"; menu.setAttribute("role", "menu");
  const actions = [
    { label: item.pinned ? "পিন সরান" : "পিন করুন", run() { saveAction(item, (current) => { current.pinned = !current.pinned; }); onRefresh(); } },
    { label: "নাম পরিবর্তন করুন", run() { const value = window.prompt("ইতিহাসের নতুন নাম লিখুন", titleOf(item)); if (value && value.trim()) { saveAction(item, (current) => { current.title = value.trim(); }); onRefresh(); } } },
    { label: item.archived ? "আর্কাইভ থেকে ফেরান" : "আর্কাইভ করুন", run() { saveAction(item, (current) => { current.archived = !current.archived; }); onRefresh(); } },
    { label: "শেয়ার করুন", run() {
      const text = titleOf(item) + "\n\n" + item.messages.map((message) => (message.role === "user" ? "আপনি" : "MOSHARROF AI") + ": " + String(message.text || "")).join("\n\n");
      if (navigator.share) navigator.share({ title: titleOf(item), text }).catch(() => {});
      else if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => notify("কথোপকথন কপি হয়েছে"), () => notify("শেয়ার করা যায়নি"));
      else window.prompt("কথোপকথন কপি করুন", text);
    }},
    { label: "ডিলিট করুন", danger: true, run() {
      if (!window.confirm("এই কথোপকথনটি স্থায়ীভাবে মুছে ফেলবেন?")) return;
      if (item.id === activeId()) document.getElementById("historyNewChat")?.click();
      markDeleted(item.id);
      onRefresh(); notify("ইতিহাস মুছে ফেলা হয়েছে");
    }}
  ];
  actions.forEach((action) => {
    const button = document.createElement("button");
    button.type = "button"; button.textContent = action.label; button.setAttribute("role", "menuitem");
    if (action.danger) button.className = "danger";
    button.addEventListener("click", () => { closeActionMenu(); action.run(); });
    menu.appendChild(button);
  });
  document.body.appendChild(menu);
  const rect = anchor.getBoundingClientRect(), left = typeof x === "number" ? x : rect.left, top = typeof y === "number" ? y : rect.bottom;
  menu.style.left = Math.max(8, Math.min(left, window.innerWidth - 184)) + "px";
  menu.style.top = Math.max(8, Math.min(top, window.innerHeight - 250)) + "px";
  setTimeout(() => {
    document.addEventListener("pointerdown", function outside(event) {
      if (!menu.contains(event.target)) { menu.remove(); document.removeEventListener("pointerdown", outside); }
    });
  }, 0);
}
export function initializeHistoryUi() {
  const drawer = document.getElementById("drawerLeft");
  if (!drawer || drawer.dataset.historyOrganReady === "true") return;
  drawer.dataset.historyOrganReady = "true"; installDeleteGuard(); addStyles();
  const tools = drawer.querySelector(".history-tools"), list = drawer.querySelector("#historyList"), search = drawer.querySelector("#historySearch");
  if (!tools || !list || !search) return;
  const heading = tools.querySelector(".history-heading");
  if (heading) heading.innerHTML = '<button class="history-shutter" id="historyShutter" type="button" aria-expanded="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" fill="none" stroke="currentColor" stroke-width="2"/></svg><span>আগের চ্যাট</span></button><button class="history-archive-toggle" id="historyArchiveToggle" type="button">আর্কাইভ</button>';
  const historySmall = document.getElementById("historyBtn")?.querySelector("small");
  if (historySmall) historySmall.textContent = "ইতিহাস খুলুন বা বন্ধ করুন";
  let showArchived = false, scheduled = false;
  function refresh() {
    const sessions = readSessions(), byId = new Map(sessions.map((item) => [item.id, item]));
    const buttons = Array.from(list.querySelectorAll(".history-item")), used = new Set();
    buttons.forEach((button) => {
      let item = byId.get(button.dataset.sessionId);
      if (!item) {
        const visibleTitle = button.querySelector("span")?.textContent.trim() || "";
        item = sessions.filter((candidate) => !used.has(candidate.id)).find((candidate) => titleOf(candidate) === visibleTitle || generatedTitle(candidate) === visibleTitle);
        if (item) button.dataset.sessionId = item.id;
      }
      if (!item) { button.hidden = true; return; }
      used.add(item.id);
      const title = button.querySelector("span"); if (title) title.textContent = titleOf(item);
      button.classList.toggle("history-pinned", !!item.pinned); button.classList.toggle("history-archived", !!item.archived);
      button.hidden = !!item.archived !== showArchived;
      if (!button.dataset.historyActionsReady) {
        button.dataset.historyActionsReady = "true";
        const originalClick = button.onclick;
        button.onclick = function(event) {
          if (button.__historyLongPressed) { button.__historyLongPressed = false; event.preventDefault(); return; }
          if (originalClick) originalClick.call(this, event);
        };
        let timer = null;
        button.addEventListener("pointerdown", () => {
          button.__historyLongPressed = false;
          timer = setTimeout(() => { button.__historyLongPressed = true; showActionMenu(byId.get(button.dataset.sessionId) || item, button, undefined, undefined, scheduleRefresh); }, 550);
        });
        ["pointerup", "pointerleave", "pointercancel"].forEach((type) => button.addEventListener(type, () => clearTimeout(timer)));
        button.addEventListener("contextmenu", (event) => { event.preventDefault(); button.__historyLongPressed = true; showActionMenu(byId.get(button.dataset.sessionId) || item, button, event.clientX, event.clientY, scheduleRefresh); });
      }
    });
    const sorted = buttons.filter((button) => !button.hidden).sort((a, b) => {
      const left = byId.get(a.dataset.sessionId), right = byId.get(b.dataset.sessionId);
      return (right?.pinned ? 1 : 0) - (left?.pinned ? 1 : 0) || timeOf(right || {}).localeCompare(timeOf(left || {}));
    });
    const current = Array.from(list.children), desired = sorted.concat(buttons.filter((button) => button.hidden));
    if (current.length !== desired.length || current.some((node, index) => node !== desired[index])) desired.forEach((node) => list.appendChild(node));
    const archiveButton = document.getElementById("historyArchiveToggle");
    if (archiveButton) archiveButton.textContent = showArchived ? "সক্রিয় ইতিহাস" : "আর্কাইভ";
  }
  function scheduleRefresh() { if (scheduled) return; scheduled = true; setTimeout(() => { scheduled = false; refresh(); }, 0); }
  list.addEventListener("click", (event) => {
    const button = event.target.closest(".history-item");
    if (!button || button.__historyLongPressed) return;
    if (button.classList.contains("active")) setTimeout(() => document.querySelector(".chat-scroll")?.classList.toggle("history-conversation-collapsed"), 0);
    else document.querySelector(".chat-scroll")?.classList.remove("history-conversation-collapsed");
  }, true);
  document.getElementById("historyShutter")?.addEventListener("click", (event) => {
    const button = event.currentTarget, open = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", open ? "false" : "true");
    list.classList.toggle("history-shut", open); tools.classList.toggle("history-shut", open);
  });
  document.getElementById("historyArchiveToggle")?.addEventListener("click", () => { showArchived = !showArchived; refresh(); });
  search.addEventListener("input", scheduleRefresh);
  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(list, { childList: true, subtree: true });
  refresh();
}
