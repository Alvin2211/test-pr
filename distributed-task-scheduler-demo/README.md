# Distributed Task Scheduler — Working Demo

A local, interactive demonstration of the project described in the NPTEL Distributed Systems report.

## What it demonstrates

- **Master–Worker architecture:** a central scheduler dispatches client tasks to worker nodes.
- **Task queue and states:** `PENDING`, `RUNNING`, and `COMPLETED`.
- **Heartbeat monitoring:** online workers send periodic heartbeat updates.
- **Failure detection:** the demo control simulates a missed heartbeat / worker crash.
- **Automatic task reassignment:** if a worker fails while running a task, the task is returned to the queue and assigned to another available worker.
- **Live dashboard:** task progress, worker state, event log, completion count and reassignment count update over WebSockets.

## Requirements

- Node.js 18 or later
- npm
- Internet access for the first `npm install` (to download the `ws` dependency)

## Run on Windows (PowerShell)

1. Extract the ZIP file.
2. Open PowerShell in the extracted `distributed-task-scheduler-demo` folder.
3. Run:

   ```powershell
   npm install
   npm start
   ```

4. Open **http://localhost:3000** in your browser.

Stop the server with `Ctrl+C`.

## Recommended demonstration flow

1. Click **Submit a task** a few times, or **Submit batch of 5 tasks**.
2. Watch tasks get assigned to Worker 1, Worker 2 and Worker 3.
3. Find a worker that says **Executing** and click **Simulate failure** on that worker.
4. Point out the event stream: heartbeat timeout detected → task returned to queue → task reassigned.
5. Watch the reassignment counter increase and the task continue on another worker.
6. Click **Recover worker** to bring the worker back online.
7. Click **Reset demonstration** to restore the initial state.

## Important scope note

This is a **working local simulation / proof of concept** for demonstration. Worker nodes are represented by independent logical worker records inside one Node.js process; the UI simulates their task execution and heartbeats. It is not yet a production-grade distributed deployment with separate machines/processes, persistent storage, durable queues, or consensus/replicated scheduler leadership. Present it accurately as a prototype that demonstrates the core scheduling and recovery behavior.

## Project structure

```text
distributed-task-scheduler-demo/
├── server.js
├── package.json
├── README.md
└── public/
    ├── index.html
    ├── styles.css
    └── app.js
```
