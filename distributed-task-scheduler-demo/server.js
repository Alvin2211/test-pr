const http = require("http");
const fs = require("fs");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const workers = [
  { id: "worker-1", name: "Worker 1", status: "online", lastHeartbeat: Date.now(), currentTask: null, currentTasks: [], completed: 0, color: "#7c83ff" },
  { id: "worker-2", name: "Worker 2", status: "online", lastHeartbeat: Date.now(), currentTask: null, currentTasks: [], completed: 0, color: "#22b8a7" },
  { id: "worker-3", name: "Worker 3", status: "online", lastHeartbeat: Date.now(), currentTask: null, currentTasks: [], completed: 0, color: "#f2a65a" }
];
let tasks = [];
let events = [];
let nextTaskId = 1;
let nextEventId = 1;
let nextWorkerIndex = 0;
let demoPaused = false;

function log(message, type = "info") {
  events.unshift({ id: nextEventId++, time: new Date().toISOString(), message, type });
  events = events.slice(0, 80);
}
function snapshot() {
  return {
    workers: workers.map(w => ({ ...w })),
    tasks: tasks.map(t => ({ ...t })),
    events: events.slice(0, 30),
    metrics: {
      total: tasks.length,
      pending: tasks.filter(t => t.status === "PENDING").length,
      running: tasks.filter(t => t.status === "RUNNING").length,
      completed: tasks.filter(t => t.status === "COMPLETED").length,
      failed: tasks.filter(t => t.status === "FAILED").length,
      onlineWorkers: workers.filter(w => w.status === "online").length,
      reassignments: tasks.reduce((sum, t) => sum + t.reassignments, 0)
    },
    paused: demoPaused
  };
}
const clients = new Set();
function broadcast() {
  const data = JSON.stringify({ type: "state", state: snapshot() });
  for (const ws of clients) if (ws.readyState === 1) ws.send(data);
}
function chooseWorker(excludeId = null) {
  const online = workers.filter(w => w.status === "online" && w.id !== excludeId);
  if (!online.length) return null;
  // Round-robin across available workers, skipping unavailable ones.
  for (let i = 0; i < workers.length; i++) {
    const idx = (nextWorkerIndex + i) % workers.length;
    const candidate = workers[idx];
    if (candidate.status === "online" && candidate.id !== excludeId) {
      nextWorkerIndex = (idx + 1) % workers.length;
      return candidate;
    }
  }
  return online[0];
}
function assignTask(task, excludeId = null) {
  const worker = chooseWorker(excludeId);
  if (!worker) {
    task.status = "PENDING";
    task.workerId = null;
    log(`Task ${task.id} queued: no workers are currently available.`, "warn");
    return false;
  }
  task.status = "RUNNING";
  task.workerId = worker.id;
  task.startedAt = Date.now();
  task.progress = Math.max(0, task.progress || 0);
  task.attempt += 1;
  if (!worker.currentTasks.includes(task.id)) worker.currentTasks.push(task.id);
  worker.currentTask = task.id;
  log(`Assigned ${task.id} to ${worker.name} (attempt ${task.attempt}).`, "assign");
  return true;
}
function submitTask(label) {
  const task = {
    id: `TASK-${String(nextTaskId++).padStart(3, "0")}`,
    label: label || ["Process dataset", "Generate report", "Resize images", "Aggregate metrics", "Validate records", "Build index"][Math.floor(Math.random() * 6)],
    status: "PENDING",
    workerId: null,
    progress: 0,
    duration: 9000 + Math.floor(Math.random() * 9000),
    createdAt: Date.now(),
    startedAt: null,
    attempt: 0,
    reassignments: 0
  };
  tasks.unshift(task);
  log(`Client submitted ${task.id}: ${task.label}.`, "info");
  assignTask(task);
  broadcast();
}
function failWorker(workerId) {
  const worker = workers.find(w => w.id === workerId);
  if (!worker || worker.status === "offline") return;
  worker.status = "offline";
  worker.lastHeartbeat = Date.now();
  log(`${worker.name} stopped responding. Heartbeat timeout detected.`, "danger");

  // A worker may own multiple tasks. Requeue every running task assigned to it,
  // not just the last task stored in currentTask.
  const interruptedTasks = tasks.filter(t => t.status === "RUNNING" && t.workerId === worker.id);
  worker.currentTask = null;
  worker.currentTasks = [];
  for (const task of interruptedTasks) {
    task.status = "PENDING";
    task.workerId = null;
    task.progress = 0;
    task.startedAt = null;
    task.reassignments += 1;
    log(`${task.id} marked unfinished and returned to the queue.`, "warn");
  }
  for (const task of interruptedTasks) assignTask(task, worker.id);
  broadcast();
}
function recoverWorker(workerId) {
  const worker = workers.find(w => w.id === workerId);
  if (!worker) return;
  worker.status = "online";
  worker.lastHeartbeat = Date.now();
  worker.currentTask = null;
  worker.currentTasks = [];
  log(`${worker.name} rejoined the cluster and is sending heartbeats.`, "success");
  const pending = tasks.filter(t => t.status === "PENDING").slice().reverse();
  for (const task of pending) {
    if (!workers.some(w => w.status === "online")) break;
    assignTask(task);
  }
  broadcast();
}
function resetDemo() {
  tasks = [];
  events = [];
  nextTaskId = 1;
  nextEventId = 1;
  nextWorkerIndex = 0;
  demoPaused = false;
  workers.forEach(w => {
    w.status = "online";
    w.lastHeartbeat = Date.now();
    w.currentTask = null;
    w.currentTasks = [];
    w.completed = 0;
  });
  log("Demo reset. All workers are online and ready.", "success");
  broadcast();
}
function handleAction(action) {
  switch (action.type) {
    case "submit":
      submitTask(action.label);
      break;
    case "submitBatch":
      for (let i = 0; i < Math.min(8, Math.max(1, Number(action.count) || 3)); i++) submitTask();
      break;
    case "failWorker":
      failWorker(action.workerId);
      break;
    case "recoverWorker":
      recoverWorker(action.workerId);
      break;
    case "pause":
      demoPaused = !demoPaused;
      log(demoPaused ? "Task progress paused." : "Task progress resumed.", "info");
      broadcast();
      break;
    case "reset":
      resetDemo();
      break;
    default:
      break;
  }
}
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const fullPath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403); return res.end("Forbidden");
  }
  fs.readFile(fullPath, (err, data) => {
    if (err) { res.writeHead(404); return res.end("Not found"); }
    const ext = path.extname(fullPath);
    const type = ext === ".html" ? "text/html" : ext === ".css" ? "text/css" : ext === ".js" ? "text/javascript" : "application/octet-stream";
    res.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
    res.end(data);
  });
});
const wss = new WebSocketServer({ server });
wss.on("connection", ws => {
  clients.add(ws);
  ws.send(JSON.stringify({ type: "state", state: snapshot() }));
  ws.on("message", raw => {
    try { handleAction(JSON.parse(raw.toString())); } catch (e) { log("Could not process dashboard action.", "danger"); broadcast(); }
  });
  ws.on("close", () => clients.delete(ws));
});
setInterval(() => {
  if (demoPaused) return;
  const now = Date.now();
  let changed = false;
  for (const worker of workers) {
    if (worker.status === "online") worker.lastHeartbeat = now;
  }
  for (const task of tasks) {
    if (task.status !== "RUNNING" || !task.workerId) continue;
    const worker = workers.find(w => w.id === task.workerId);
    if (!worker || worker.status !== "online") continue;
    const elapsed = now - task.startedAt;
    task.progress = Math.min(100, Math.floor((elapsed / task.duration) * 100));
    if (task.progress >= 100) {
      task.status = "COMPLETED";
      worker.completed += 1;
      worker.currentTasks = (worker.currentTasks || []).filter(id => id !== task.id);
      worker.currentTask = worker.currentTasks.length ? worker.currentTasks[worker.currentTasks.length - 1] : null;
      task.workerId = null;
      log(`${task.id} completed successfully.`, "success");
      changed = true;
    }
  }
  // Dispatch queued work to idle online workers.
  for (const task of tasks.filter(t => t.status === "PENDING").slice().reverse()) {
    const idle = workers.some(w => w.status === "online" && !(w.currentTasks || []).length);
    if (!idle) break;
    assignTask(task);
    changed = true;
  }
  if (changed || tasks.some(t => t.status === "RUNNING")) broadcast();
}, 500);

log("Scheduler started. Waiting for client tasks.", "success");
server.listen(PORT, () => console.log(`Distributed Task Scheduler demo running at http://localhost:${PORT}`));
