// src/components/DataTable.jsx
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Excel-like editing:
 * - Click cell to edit (single click)
 * - Enter commits + moves down
 * - Tab commits + moves right
 * - Shift+Tab commits + moves left
 * - Arrow keys move without needing mouse (commits if editing)
 * - Escape cancels edit (revert)
 *
 * No “Saving…” UI (you asked to remove it).
 */
function DataTable({ items, fields, onCellCommit, pushToast }) {
  const cols = useMemo(() => {
    // Always include id? Keep visible if you want; for now, keep it hidden from edit columns.
    // If you want to display id, add it here.
    return Array.isArray(fields) && fields.length ? fields : [];
  }, [fields]);

  const [editing, setEditing] = useState(null); // { r: rowIndex, c: colIndex, id, key }
  const [draft, setDraft] = useState("");

  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const startEdit = useCallback(
    (rowIndex, colIndex) => {
      const row = items[rowIndex];
      const key = cols[colIndex];
      if (!row || !key) return;

      const current = row[key] ?? "";
      setEditing({ r: rowIndex, c: colIndex, id: row.id, key });
      setDraft(String(current));
    },
    [items, cols]
  );

  const stopEdit = useCallback(() => {
    setEditing(null);
    setDraft("");
  }, []);

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  const moveTo = useCallback(
    (nextR, nextC) => {
      if (!items.length || !cols.length) return;
      const r = clamp(nextR, 0, items.length - 1);
      const c = clamp(nextC, 0, cols.length - 1);
      startEdit(r, c);
    },
    [items.length, cols.length, startEdit]
  );

  const commit = useCallback(
    async ({ move }) => {
      if (!editing) return;

      const { r, id, key } = editing;
      const before = String(items?.[r]?.[key] ?? "");
      const after = String(draft ?? "");

      // If unchanged, just move
      if (before === after) {
        if (move) moveTo(move.r, move.c);
        else stopEdit();
        return;
      }

      try {
        await onCellCommit(id, key, after);
        if (move) moveTo(move.r, move.c);
        else stopEdit();
      } catch (e) {
        pushToast?.("Error", String(e));
        // keep editing so user can fix
      }
    },
    [editing, draft, items, onCellCommit, moveTo, stopEdit, pushToast]
  );

  const cancel = useCallback(() => {
    // revert and stop
    stopEdit();
  }, [stopEdit]);

  const onCellKeyDown = useCallback(
    async (e) => {
      if (!editing) return;

      const { r, c } = editing;

      // Excel-ish keys
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        await commit({ move: { r: r + 1, c } });
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        const dir = e.shiftKey ? -1 : 1;
        await commit({ move: { r, c: c + dir } });
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        await commit({ move: { r: r + 1, c } });
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        await commit({ move: { r: r - 1, c } });
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        await commit({ move: { r, c: c + 1 } });
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        await commit({ move: { r, c: c - 1 } });
        return;
      }
    },
    [editing, commit, cancel]
  );

  const prettyLabel = (k) => k.replaceAll("_", " ").toUpperCase();

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {cols.map((k) => (
              <th key={k}>{prettyLabel(k)}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {(items || []).map((row, rowIndex) => (
            <tr key={row.id ?? rowIndex}>
              {cols.map((key, colIndex) => {
                const isEditing =
                  editing && editing.r === rowIndex && editing.c === colIndex;

                const value = row?.[key] ?? "";

                return (
                  <td
                    key={`${row.id ?? rowIndex}-${key}`}
                    className={isEditing ? "td-editing" : ""}
                    onMouseDown={(e) => {
                      // prevent text selection + keep it snappy
                      e.preventDefault();
                      startEdit(rowIndex, colIndex);
                    }}
                  >
                    {isEditing ? (
                      <div className="cell-edit">
                        <input
                          ref={inputRef}
                          className="cell-input"
                          value={draft}
                          onChange={(e) => setDraft(e.target.value)}
                          onKeyDown={onCellKeyDown}
                          onBlur={() => {
                            // blur commits but stays on same cell
                            commit({ move: null });
                          }}
                        />
                      </div>
                    ) : (
                      <span className="cell-text">{String(value || "")}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default memo(DataTable);