"use strict";

const STATUS_ORDER = ["已投递", "笔试", "面试", "offer", "已拒", "搁置"];
const STATUS_CLASS = {
  "已投递": "st-applied",
  "笔试": "st-written",
  "面试": "st-interview",
  "offer": "st-offer",
  "已拒": "st-rejected",
  "搁置": "st-shelved",
};

const state = {
  apps: [],
  view: "table",
  q: "",
  status: "",
  channel: "",
  sortKey: "updated_at",
  sortAsc: false,
  editingAppId: null,
  editingEventId: null,
};

const $ = (id) => document.getElementById(id);

async function api(path, options) {
  const resp = await fetch(path, options);
  if (!resp.ok) {
    let msg = "操作失败";
    try { msg = (await resp.json()).error || msg; } catch (_) { /* keep default */ }
    alert(msg);
    throw new Error(msg);
  }
  return resp.json();
}

async function load() {
  state.apps = await api("/api/applications");
  render();
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function todayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatEventTime(s) {
  const d = new Date(s);
  if (isNaN(d)) return s;
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((day - today) / 864e5);
  const label = diff === 0 ? "今天" : diff === 1 ? "明天" : diff === 2 ? "后天" : `${d.getMonth() + 1}/${d.getDate()}`;
  return `${label} ${hm}`;
}

function formatDateTime(s) {
  const d = new Date(s);
  if (isNaN(d)) return s || "";
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function filtered() {
  const q = state.q.trim().toLowerCase();
  const rows = state.apps.filter((a) => {
    if (state.status && a.status !== state.status) return false;
    if (state.channel && a.channel !== state.channel) return false;
    if (q && ![a.company, a.position, a.city, a.notes].join(" ").toLowerCase().includes(q)) return false;
    return true;
  });
  const k = state.sortKey;
  const dir = state.sortAsc ? 1 : -1;
  rows.sort((x, y) => {
    const xv = x[k] || "";
    const yv = y[k] || "";
    return xv < yv ? -dir : xv > yv ? dir : 0;
  });
  return rows;
}

function render() {
  renderStats();
  renderTodo();
  renderChannelFilter();
  renderViewChrome();
  if (state.view === "table") renderTable(); else renderKanban();
}

function renderViewChrome() {
  $("table-view").hidden = state.view !== "table";
  $("kanban-view").hidden = state.view !== "kanban";
  $("view-table-btn").classList.toggle("active", state.view === "table");
  $("view-kanban-btn").classList.toggle("active", state.view === "kanban");
}

function renderStats() {
  const total = state.apps.length;
  const counts = Object.fromEntries(STATUS_ORDER.map((s) => [s, 0]));
  let recent = 0;
  const now = Date.now();
  for (const a of state.apps) {
    counts[a.status] = (counts[a.status] || 0) + 1;
    if (now - new Date(a.created_at).getTime() < 7 * 864e5) recent++;
  }
  const offerRate = total ? Math.round((counts["offer"] / total) * 100) + "%" : "—";
  const cards = [
    { label: "总投递", value: total, key: "" },
    ...STATUS_ORDER.map((s) => ({ label: s, value: counts[s], key: s })),
    { label: "本周新增", value: recent, key: null },
    { label: "offer率", value: offerRate, key: null },
  ];
  $("stats-bar").innerHTML = cards.map((c) => `
    <button class="stat-card ${c.key && state.status === c.key ? "active" : ""}"
            data-key="${c.key ?? ""}" ${c.key === null ? "disabled" : ""}>
      <span class="stat-value">${c.value}</span>
      <span class="stat-label">${c.label}</span>
    </button>`).join("");
  $("stats-bar").querySelectorAll(".stat-card").forEach((el) => {
    el.addEventListener("click", () => {
      const key = el.dataset.key;
      state.status = state.status === key ? "" : key;
      $("status-filter").value = state.status;
      render();
    });
  });
}

function renderTodo() {
  const list = $("todo-list");
  const now = Date.now();
  const weekEnd = now + 7 * 864e5;
  const items = [];
  for (const a of state.apps) {
    for (const e of a.events) {
      const t = new Date(e.event_time).getTime();
      if (!isNaN(t) && t >= now && t <= weekEnd) items.push({ app: a, event: e, time: t });
    }
  }
  items.sort((x, y) => x.time - y.time);
  if (!items.length) {
    list.innerHTML = `<li class="empty">未来 7 天暂无笔试/面试</li>`;
    return;
  }
  list.innerHTML = items.map(({ app: a, event: e, time }) => {
    const remain = time - now;
    const cls = remain < 24 * 3600e3 ? "due-24" : remain < 72 * 3600e3 ? "due-72" : "";
    return `<li class="todo-item ${cls}" data-app-id="${a.id}">
      <div class="todo-time">${formatEventTime(e.event_time)}</div>
      <div class="todo-main">
        <span class="todo-company">${escapeHtml(a.company)}</span>
        <span class="todo-type">${escapeHtml(e.type)}</span>
      </div>
    </li>`;
  }).join("");
  list.querySelectorAll(".todo-item").forEach((el) =>
    el.addEventListener("click", () => openModal(Number(el.dataset.appId))));
}

function renderChannelFilter() {
  const sel = $("channel-filter");
  const channels = [...new Set(state.apps.map((a) => a.channel).filter(Boolean))].sort();
  sel.innerHTML = `<option value="">全部渠道</option>` +
    channels.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  sel.value = channels.includes(state.channel) ? state.channel : "";
  state.channel = sel.value;
}

function renderTable() {
  const rows = filtered();
  $("empty-hint").hidden = rows.length > 0;
  $("table-body").innerHTML = rows.map((a) => `
    <tr data-id="${a.id}">
      <td>${escapeHtml(a.company)}</td>
      <td>${escapeHtml(a.position)}</td>
      <td>${escapeHtml(a.city)}</td>
      <td>${escapeHtml(a.channel)}</td>
      <td>${escapeHtml(a.applied_date)}</td>
      <td><span class="badge ${STATUS_CLASS[a.status] || ""}">${escapeHtml(a.status)}</span></td>
      <td>${formatDateTime(a.updated_at)}</td>
    </tr>`).join("");
  $("table-body").querySelectorAll("tr").forEach((tr) =>
    tr.addEventListener("click", () => openModal(Number(tr.dataset.id))));
  document.querySelectorAll("#table-view th[data-sort]").forEach((th) => {
    th.textContent = th.textContent.replace(/ [▲▼]$/, "");
    if (th.dataset.sort === state.sortKey) th.textContent += state.sortAsc ? " ▲" : " ▼";
  });
}

function renderKanban() {
  const rows = filtered();
  $("kanban-view").innerHTML = STATUS_ORDER.map((s) => {
    const cards = rows.filter((a) => a.status === s);
    return `<div class="kanban-col" data-status="${s}">
      <div class="kanban-col-header">
        <span class="badge ${STATUS_CLASS[s]}">${s}</span>
        <span class="count">${cards.length}</span>
      </div>
      <div class="kanban-cards">
        ${cards.map((a) => `
          <div class="kanban-card" draggable="true" data-id="${a.id}">
            <div class="card-company">${escapeHtml(a.company)}</div>
            <div class="card-position">${escapeHtml(a.position)}</div>
            <div class="card-meta">${escapeHtml([a.city, a.applied_date ? a.applied_date.slice(5) : ""].filter(Boolean).join(" · "))}</div>
          </div>`).join("")}
      </div>
    </div>`;
  }).join("");

  $("kanban-view").querySelectorAll(".kanban-card").forEach((card) => {
    card.addEventListener("click", () => openModal(Number(card.dataset.id)));
    card.addEventListener("dragstart", (e) => {
      card.classList.add("dragging");
      e.dataTransfer.setData("text/plain", card.dataset.id);
      e.dataTransfer.effectAllowed = "move";
    });
    card.addEventListener("dragend", () => card.classList.remove("dragging"));
  });
  $("kanban-view").querySelectorAll(".kanban-col").forEach((col) => {
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("drag-over"); });
    col.addEventListener("dragleave", () => col.classList.remove("drag-over"));
    col.addEventListener("drop", async (e) => {
      e.preventDefault();
      col.classList.remove("drag-over");
      const id = Number(e.dataTransfer.getData("text/plain"));
      const app = state.apps.find((a) => a.id === id);
      const newStatus = col.dataset.status;
      if (app && app.status !== newStatus) {
        await api(`/api/applications/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...app, status: newStatus }),
        });
        await load();
      }
    });
  });
}

function openModal(appId) {
  state.editingAppId = appId ?? null;
  const form = $("app-form");
  form.reset();
  form.elements.status.innerHTML = STATUS_ORDER.map((s) => `<option value="${s}">${s}</option>`).join("");

  const app = appId ? state.apps.find((a) => a.id === appId) : null;
  $("modal-title").textContent = app ? "编辑投递" : "新建投递";
  if (app) {
    for (const f of ["company", "position", "city", "channel", "applied_date", "status", "link", "notes"]) {
      form.elements[f].value = app[f] || "";
    }
  } else {
    form.elements.applied_date.value = todayLocal();
    form.elements.status.value = "已投递";
  }
  $("record-delete-btn").hidden = !app;
  $("events-section").hidden = !app;
  resetEventForm();
  if (app) renderEventsList(app);
  $("modal-overlay").hidden = false;
  form.elements.company.focus();
}

function closeModal() {
  $("modal-overlay").hidden = true;
  state.editingAppId = null;
  state.editingEventId = null;
}

function resetEventForm() {
  state.editingEventId = null;
  $("event-form").reset();
  $("event-submit-btn").textContent = "添加进展";
  $("event-cancel-btn").hidden = true;
}

function renderEventsList(app) {
  const list = $("events-list");
  if (!app.events.length) {
    list.innerHTML = `<li class="empty">暂无进展，可在下方添加笔试/面试安排。</li>`;
    return;
  }
  list.innerHTML = app.events.map((e) => `
    <li class="event-item" data-id="${e.id}">
      <span class="event-time">${formatEventTime(e.event_time)}</span>
      <span class="event-type">${escapeHtml(e.type)}</span>
      <span class="event-notes">${escapeHtml(e.notes)}</span>
      <span class="event-actions">
        <button type="button" data-act="edit">编辑</button>
        <button type="button" data-act="del" class="danger">删除</button>
      </span>
    </li>`).join("");
  list.querySelectorAll(".event-item button").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const li = btn.closest(".event-item");
      const ev = app.events.find((e) => e.id === Number(li.dataset.id));
      if (!ev) return;
      if (btn.dataset.act === "del") {
        if (!confirm(`删除这条进展（${ev.type} ${formatEventTime(ev.event_time)}）？`)) return;
        await api(`/api/events/${ev.id}`, { method: "DELETE" });
        await reloadAndRefreshEvents(app.id);
      } else {
        state.editingEventId = ev.id;
        const f = $("event-form");
        f.elements.type.value = ev.type;
        f.elements.event_time.value = ev.event_time;
        f.elements.notes.value = ev.notes;
        $("event-submit-btn").textContent = "保存进展";
        $("event-cancel-btn").hidden = false;
      }
    }));
}

async function reloadAndRefreshEvents(appId) {
  await load();
  const app = state.apps.find((a) => a.id === appId);
  if (app) renderEventsList(app);
}

function init() {
  $("view-table-btn").addEventListener("click", () => { state.view = "table"; render(); });
  $("view-kanban-btn").addEventListener("click", () => { state.view = "kanban"; render(); });
  $("search-input").addEventListener("input", (e) => { state.q = e.target.value; render(); });
  $("status-filter").innerHTML = `<option value="">全部状态</option>` +
    STATUS_ORDER.map((s) => `<option value="${s}">${s}</option>`).join("");
  $("status-filter").addEventListener("change", (e) => { state.status = e.target.value; render(); });
  $("channel-filter").addEventListener("change", (e) => { state.channel = e.target.value; render(); });
  $("add-btn").addEventListener("click", () => openModal(null));
  $("modal-cancel").addEventListener("click", closeModal);
  $("modal-overlay").addEventListener("click", (e) => { if (e.target === $("modal-overlay")) closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("modal-overlay").hidden) closeModal(); });

  document.querySelectorAll("#table-view th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (state.sortKey === key) state.sortAsc = !state.sortAsc;
      else { state.sortKey = key; state.sortAsc = key === "company"; }
      renderTable();
    });
  });

  $("app-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const payload = {};
    for (const name of ["company", "position", "city", "channel", "applied_date", "status", "link", "notes"]) {
      payload[name] = f.elements[name].value.trim();
    }
    if (!payload.company || !payload.position) { alert("公司和岗位为必填项"); return; }
    if (state.editingAppId) {
      await api(`/api/applications/${state.editingAppId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
    } else {
      await api("/api/applications", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
    }
    closeModal();
    await load();
  });

  $("record-delete-btn").addEventListener("click", async () => {
    const app = state.apps.find((a) => a.id === state.editingAppId);
    if (!app) return;
    if (!confirm(`确定删除「${app.company} - ${app.position}」及其全部进展记录？`)) return;
    await api(`/api/applications/${app.id}`, { method: "DELETE" });
    closeModal();
    await load();
  });

  $("event-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.editingAppId) return;
    const f = e.target;
    const payload = {
      type: f.elements.type.value.trim(),
      event_time: f.elements.event_time.value,
      notes: f.elements.notes.value.trim(),
    };
    if (!payload.type || !payload.event_time) { alert("进展类型和时间必填"); return; }
    if (state.editingEventId) {
      await api(`/api/events/${state.editingEventId}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
    } else {
      await api(`/api/applications/${state.editingAppId}/events`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
    }
    const appId = state.editingAppId;
    resetEventForm();
    await reloadAndRefreshEvents(appId);
  });

  $("event-cancel-btn").addEventListener("click", resetEventForm);

  load();
}

document.addEventListener("DOMContentLoaded", init);
