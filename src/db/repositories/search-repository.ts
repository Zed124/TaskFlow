import type { TaskStatus } from "@/domain/task";
import type { SqlExecutor } from "../executor";
import { toFtsQuery } from "../sql";

/** Markers wrapped around matched text in snippets (private-use characters never typed by users). */
export const HIT_START = "\u{E000}";
export const HIT_END = "\u{E001}";

export type SearchHit =
  | {
      kind: "task";
      id: string;
      title: string;
      snippet: string;
      status: TaskStatus;
      archived: boolean;
      parentTitle: string | null;
    }
  | { kind: "project"; id: string; title: string; snippet: string; archived: boolean }
  | { kind: "category"; id: string; title: string }
  | { kind: "note"; id: string; taskId: string; taskTitle: string; snippet: string };

type HitRow = {
  entity_type: "task" | "project" | "category" | "note";
  entity_id: string;
  task_id: string | null;
  title_hl: string;
  snippet: string;
  rank: number;
  task_title: string | null;
  task_status: TaskStatus | null;
  task_archived: string | null;
  parent_title: string | null;
  project_archived: string | null;
  note_task_title: string | null;
  note_task_deleted: string | null;
};

export function createSearchRepository(db: SqlExecutor) {
  return {
    /** Ranked global search across tasks, projects, categories and timeline notes. */
    async search(text: string, limit = 30): Promise<SearchHit[]> {
      const query = toFtsQuery(text);
      if (!query) return [];
      const rows = await db.select<HitRow>(
        `SELECT s.entity_type, s.entity_id, s.task_id,
           highlight(search_index, 3, ?, ?) AS title_hl,
           snippet(search_index, 4, ?, ?, '…', 12) AS snippet,
           bm25(search_index, 0, 0, 0, 8.0, 1.0) AS rank,
           t.title AS task_title, t.status AS task_status, t.archived_at AS task_archived,
           pt.title AS parent_title,
           p.archived_at AS project_archived,
           nt.title AS note_task_title, nt.deleted_at AS note_task_deleted
         FROM search_index s
         LEFT JOIN tasks t ON s.entity_type = 'task' AND t.id = s.entity_id
         LEFT JOIN tasks pt ON pt.id = t.parent_id
         LEFT JOIN projects p ON s.entity_type = 'project' AND p.id = s.entity_id
         LEFT JOIN tasks nt ON s.entity_type = 'note' AND nt.id = s.task_id
         WHERE search_index MATCH ?
         ORDER BY rank
         LIMIT ?`,
        [HIT_START, HIT_END, HIT_START, HIT_END, query, limit],
      );

      const hits: SearchHit[] = [];
      for (const r of rows) {
        switch (r.entity_type) {
          case "task":
            if (r.task_status === null) break;
            hits.push({
              kind: "task",
              id: r.entity_id,
              title: r.title_hl,
              snippet: r.snippet,
              status: r.task_status,
              archived: r.task_archived !== null,
              parentTitle: r.parent_title,
            });
            break;
          case "project":
            hits.push({
              kind: "project",
              id: r.entity_id,
              title: r.title_hl,
              snippet: r.snippet,
              archived: r.project_archived !== null,
            });
            break;
          case "category":
            hits.push({ kind: "category", id: r.entity_id, title: r.title_hl });
            break;
          case "note":
            // Notes on deleted tasks stay in history but are not search results.
            if (r.task_id && r.note_task_title !== null && r.note_task_deleted === null) {
              hits.push({
                kind: "note",
                id: r.entity_id,
                taskId: r.task_id,
                taskTitle: r.note_task_title,
                snippet: r.snippet,
              });
            }
            break;
        }
      }
      return hits;
    },
  };
}

export type SearchRepository = ReturnType<typeof createSearchRepository>;
