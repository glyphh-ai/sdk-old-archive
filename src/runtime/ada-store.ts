/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * runtime/ada-store.ts — ADA'S RECORDS ON THIS DEVICE (Node-only; his order,
 * 2026-10-01). An org's "local" Ada model keeps its records on a device the
 * org registered; the server reaches them over the attach relay and runs the
 * kernel itself. This is that device's side: a ROW STORE and nothing more —
 * no kernel, no model config, no calibration. Those live on the server.
 *
 * The CLI and the desktop run the same table, so both can hold models. The
 * database is injected: `node:sqlite` by default, or a host's own driver with
 * the same shape (better-sqlite3 matches it).
 */

import type { AttachHandler } from "./attach.js";

export interface SqlStatement {
  run(...params: unknown[]): unknown;
  get(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
}

export interface SqlDatabase {
  exec(sql: string): unknown;
  prepare(sql: string): SqlStatement;
}

export type OpenSqlDatabase = (path: string) => SqlDatabase | Promise<SqlDatabase>;

export const ADA_METHODS = ["ada.rows", "ada.append", "ada.page", "ada.update", "ada.delete", "ada.drop"] as const;
const MAX_ROWS = 5000;
const STORES = new Set(["wins", "vetoes"]);
const MODEL_ID = /^am_[0-9a-f]{12}$/;

interface Row { seq: number; id: string; store: string; situation: string; outcome: string; author: string; ts: number }

const openNodeSqlite: OpenSqlDatabase = (path) => {
  const builtin = (process as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule?.("node:sqlite") as
    | { DatabaseSync: new (path: string) => SqlDatabase }
    | undefined;
  if (!builtin) throw new Error("this Node has no node:sqlite (22.13+); pass a SQLite driver to openAdaStore");
  return new builtin.DatabaseSync(path);
};

function record(r: Row): Record<string, unknown> {
  return { seq: Number(r.seq), id: r.id, store: r.store, situation: JSON.parse(r.situation), outcome: r.outcome, author: r.author, ts: Number(r.ts) };
}

function obj(params: unknown): Record<string, unknown> {
  if (!params || typeof params !== "object" || Array.isArray(params)) throw new Error("params must be an object");
  return params as Record<string, unknown>;
}

function modelId(p: Record<string, unknown>): string {
  const id = p.model_id;
  if (typeof id !== "string" || !MODEL_ID.test(id)) throw new Error("model_id is required");
  return id;
}

function int(value: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? Math.min(value, max) : fallback;
}

/** The ada.* handlers over one SQLite file at `path`, ready for an attach host's table. */
export async function openAdaStore(path: string, open: OpenSqlDatabase = openNodeSqlite): Promise<Record<string, AttachHandler>> {
  const db = await open(path);
  db.exec(`CREATE TABLE IF NOT EXISTS ada_records (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    id TEXT NOT NULL UNIQUE,
    model_id TEXT NOT NULL,
    store TEXT NOT NULL,
    situation TEXT NOT NULL,
    outcome TEXT NOT NULL,
    author TEXT NOT NULL,
    ts REAL NOT NULL
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS ada_records_model ON ada_records (model_id, seq)");
  const cols = "seq, id, store, situation, outcome, author, ts";

  return {
    "ada.rows": async (params) => {
      const p = obj(params);
      const id = modelId(p);
      const rows = db.prepare(`SELECT ${cols} FROM ada_records WHERE model_id = ? AND seq > ? ORDER BY seq LIMIT ?`)
        .all(id, int(p.since, 0), int(p.limit, MAX_ROWS, MAX_ROWS)) as Row[];
      const top = db.prepare("SELECT coalesce(max(seq), 0) AS top FROM ada_records WHERE model_id = ?").get(id) as { top: number };
      return { rows: rows.map(record), max_seq: Number(top.top) };
    },
    "ada.append": async (params) => {
      const p = obj(params);
      const id = modelId(p);
      const row = obj(p.row);
      if (typeof row.id !== "string" || !STORES.has(String(row.store))) throw new Error("row needs an id and a store (wins or vetoes)");
      db.prepare("INSERT INTO ada_records (id, model_id, store, situation, outcome, author, ts) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(row.id, id, row.store, JSON.stringify(row.situation), String(row.outcome), String(row.author), Number(row.ts));
      const seq = db.prepare("SELECT seq FROM ada_records WHERE id = ?").get(row.id) as { seq: number };
      return { seq: Number(seq.seq) };
    },
    "ada.page": async (params) => {
      const p = obj(params);
      const id = modelId(p);
      const store = typeof p.store === "string" && STORES.has(p.store) ? p.store : null;
      const where = store ? "model_id = ? AND store = ?" : "model_id = ?";
      const args = store ? [id, store] : [id];
      const rows = db.prepare(`SELECT ${cols} FROM ada_records WHERE ${where} ORDER BY seq DESC LIMIT ? OFFSET ?`)
        .all(...args, int(p.limit, 50, 500), int(p.offset, 0)) as Row[];
      const total = db.prepare(`SELECT count(*) AS n FROM ada_records WHERE ${where}`).get(...args) as { n: number };
      return { records: rows.map(record), total: Number(total.n) };
    },
    "ada.update": async (params) => {
      const p = obj(params);
      const id = modelId(p);
      const res = db.prepare("UPDATE ada_records SET situation = coalesce(?, situation), outcome = coalesce(?, outcome) WHERE model_id = ? AND id = ?")
        .run(p.situation == null ? null : JSON.stringify(p.situation), p.outcome == null ? null : String(p.outcome), id, String(p.id)) as { changes: number };
      return { ok: Number(res.changes) > 0 };
    },
    "ada.delete": async (params) => {
      const p = obj(params);
      const res = db.prepare("DELETE FROM ada_records WHERE model_id = ? AND id = ?").run(modelId(p), String(p.id)) as { changes: number };
      return { ok: Number(res.changes) > 0 };
    },
    "ada.drop": async (params) => {
      const res = db.prepare("DELETE FROM ada_records WHERE model_id = ?").run(modelId(obj(params))) as { changes: number };
      return { deleted: Number(res.changes) };
    },
  };
}
