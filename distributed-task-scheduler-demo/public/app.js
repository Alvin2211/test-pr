const $ = (id) => document.getElementById(id);
const workerColors = { "worker-1": "#7c83ff", "worker-2": "#22b8a7", "worker-3": "#f2a65a" };
let socket;
let latestState = null;
let reconnectTimer;

function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${location.host}`);
  socket.addEventListener("open", () => {
    $("connectionText").textContent = "Connected to scheduler";
    if (reconnectTimer) clearTimeout(reconnectTimer);
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "state") render(message.state);
  });
  socket.addEventListener("close", () => {
    $("connectionText").textContent = "Disconnected · reconnecting";
    reconnectTimer = setTimeout(connect, 1200);
  });
}
function send(action) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(action));
  else alert("Scheduler is reconnecting. Please try again in a moment.");
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}
function render(state) {
  latestState = state;
  const m = state.metrics;
  $("metricTotal").textContent = m.total;
  $("metricRunning").textContent = m.running;
  $("metricCompleted").textContent = m.completed;
  $("metricReassignments").textContent = m.reassignments;
  $("onlineBadge").textContent = `${m.onlineWorkers} ONLINE`;
  $("taskCount").textContent = `${m.total} task${m.total === 1 ? "" : "s"}`;
  $("pause").innerHTML = state.paused ? "<span>▶</span> Resume task progress" : "<span>Ⅱ</span> Pause task progress";
  renderWorkers(state.workers, state.tasks);
  renderTasks(state.tasks, state.workers);
  renderEvents(state.events);
}
function renderWorkers(workers, tasks) {
  $("workers").innerHTML = workers.map(w => {
    const assignedTasks = tasks.filter(t => t.status === "RUNNING" && t.workerId === w.id);
    const online = w.status === "online";
    return `<div class="worker-card ${online ? "" : "offline"}">
      <div class="worker-top">
        <div class="worker-avatar" style="background:${workerColors[w.id]}">${w.id.split("-")[1].toUpperCase()}</div>
        <div><div class="worker-name">${esc(w.name)}</div><div class="worker-state"><i class="worker-status-dot"></i>${online ? (assignedTasks.length ? `Executing · ${assignedTasks.length} task${assignedTasks.length === 1 ? "" : "s"}` : "Available") : "Offline"}</div></div>
      </div>
      <div class="worker-task">${assignedTasks.length ? assignedTasks.map(t => `Running <strong>${esc(t.id)}</strong>`).join("<br>") : online ? "No active task" : "Heartbeat missed"}</div>
      <div class="worker-stats">Completed: <strong>${w.completed}</strong> · Heartbeat: ${online ? "healthy" : "stopped"}</div>
      <div class="worker-actions">${online
        ? `<button class="mini-btn" onclick="send({type:'failWorker',workerId:'${w.id}'})">Simulate failure</button>`
        : `<button class="mini-btn recover" onclick="send({type:'recoverWorker',workerId:'${w.id}'})">Recover worker</button>`}</div>
    </div>`;
  }).join("");
  $("failureButtons").innerHTML = workers.map(w => `<button class="failure-btn" onclick="send({type:'failWorker',workerId:'${w.id}'})" ${w.status !== "online" ? "disabled" : ""}>${w.name.replace("Worker ", "W")} offline</button>`).join("");
}
function renderTasks(tasks, workers) {
  const sorted = [...tasks].sort((a,b) => b.createdAt - a.createdAt);
  if (!sorted.length) {
    $("taskRows").innerHTML = '<tr><td colspan="5" class="empty">No tasks yet. Submit a task to begin.</td></tr>';
    return;
  }
  $("taskRows").innerHTML = sorted.slice(0, 15).map(t => {
    const worker = workers.find(w => w.id === t.workerId);
    const statusClass = {PENDING:"pending",RUNNING:"running",COMPLETED:"completed",FAILED:"failed"}[t.status] || "pending";
    return `<tr>
      <td class="task-id">${esc(t.id)}${t.reassignments ? `<div style="font-size:8px;color:#d98928;margin-top:4px">↻ reassigned ${t.reassignments}×</div>` : ""}</td>
      <td class="task-label" title="${esc(t.label)}">${esc(t.label)}</td>
      <td>${worker ? esc(worker.name) : "—"}</td>
      <td><div class="progress-wrap"><div class="progress-track"><div class="progress-fill" style="width:${t.progress}%"></div></div><span class="progress-num">${t.status === "COMPLETED" ? "100" : t.progress}%</span></div></td>
      <td><span class="task-badge status-${statusClass}">${t.status}</span></td>
    </tr>`;
  }).join("");
}
function renderEvents(events) {
  if (!events.length) {
    $("events").innerHTML = '<div class="empty">Waiting for scheduler events…</div>';
    return;
  }
  const icons = {info:"↗",assign:"⇢",success:"✓",warn:"↻",danger:"!"};
  $("events").innerHTML = events.map(e => {
    const time = new Date(e.time).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit",second:"2-digit"});
    return `<div class="event ${e.type}"><div class="event-marker">${icons[e.type] || "•"}</div><div><div class="event-copy">${esc(e.message)}</div><div class="event-time">${time}</div></div></div>`;
  }).join("");
}
$("addTask").addEventListener("click", () => send({type:"submit"}));
$("addBatch").addEventListener("click", () => send({type:"submitBatch",count:5}));
$("reset").addEventListener("click", () => send({type:"reset"}));
$("pause").addEventListener("click", () => send({type:"pause"}));
connect();
