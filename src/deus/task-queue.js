// task-queue.js
// Deus Protocol v1 - task model
const TASK_TYPES = { PERCEIVE: "perceive", RELAY: "relay", STORE: "store", EXECUTE: "execute", SPREAD: "spread" };

class Task {
  constructor(type, params) {
    this.id = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
    this.type = type;
    this.params = params || {};
    this.status = "pending";
    this.created = Date.now();
    this.completed = null;
    this.result = null;
  }
  toJSON() { return { id: this.id, type: this.type, params: this.params, status: this.status, created: this.created, completed: this.completed, result: this.result }; }
}

class TaskQueue {
  constructor() { this.tasks = []; this.history = []; }
  enqueue(type, params) { const t = new Task(type, params); this.tasks.push(t); return t; }
  dequeue() { return this.tasks.shift() || null; }
  complete(taskId, result) {
    const idx = this.tasks.findIndex(t => t.id === taskId);
    if (idx < 0) return false;
    const t = this.tasks[idx];
    t.status = "completed"; t.completed = Date.now(); t.result = result;
    this.history.push(t); this.tasks.splice(idx, 1); return true;
  }
  fail(taskId, error) {
    const idx = this.tasks.findIndex(t => t.id === taskId);
    if (idx < 0) return false;
    const t = this.tasks[idx];
    t.status = "failed"; t.completed = Date.now(); t.result = { error };
    this.history.push(t); this.tasks.splice(idx, 1); return true;
  }
  pending() { return this.tasks.length; }
  stats() { return { pending: this.tasks.length, history: this.history.length, recent: this.history.slice(-5).map(t => ({ id: t.id, type: t.type, status: t.status })) }; }
}

module.exports = { Task, TaskQueue, TASK_TYPES };