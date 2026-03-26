import { memo, useCallback, useMemo, useRef, useState, useEffect } from "react";
import "../styles/DataTable.css";

const DATE_FIELDS = new Set(["date", "report_date"]);

function formatDisplayValue(key, value) {
  if (value == null) return "";
  const s = String(value).trim();
  if (!s) return "";

  if (DATE_FIELDS.has(key)) {
    return s.replaceAll("-", "/");
  }

  return s;
}

function parseSortableDate(value) {
  if (value == null) return null;

  const s = String(value).trim();
  if (!s) return null;

  const clean = s.split("T")[0].split(" ")[0].trim();

  let m = clean.match(/^(\d{1,2})[/ -](\d{1,2})[/ -](\d{4})$/);
  if (m) {
    const month = Number(m[1]);
    const day = Number(m[2]);
    const year = Number(m[3]);

    if (
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      !Number.isInteger(year) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }

    return year * 10000 + month * 100 + day;
  }

  m = clean.match(/^(\d{4})[/ -](\d{1,2})[/ -](\d{1,2})$/);
  if (m) {
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);

    if (
      !Number.isInteger(month) ||
      !Number.isInteger(day) ||
      !Number.isInteger(year) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }

    return year * 10000 + month * 100 + day;
  }

  return null;
}

function compareValues(a, b, key, dir) {
  const multiplier = dir === "desc" ? -1 : 1;

  const aRaw = a?.[key] ?? "";
  const bRaw = b?.[key] ?? "";

  if (DATE_FIELDS.has(key)) {
    const aDate = parseSortableDate(aRaw);
    const bDate = parseSortableDate(bRaw);

    if (aDate == null && bDate == null) return 0;
    if (aDate == null) return 1;
    if (bDate == null) return -1;

    if (aDate < bDate) return -1 * multiplier;
    if (aDate > bDate) return 1 * multiplier;
    return 0;
  }

  const aStr = String(aRaw).trim().toLowerCase();
  const bStr = String(bRaw).trim().toLowerCase();

  if (!aStr && !bStr) return 0;
  if (!aStr) return 1;
  if (!bStr) return -1;

  return aStr.localeCompare(bStr, undefined, { numeric: true }) * multiplier;
}

function getCellClassName(key, isEditing) {
  const classes = ["dt-cell"];

  if (key === "project_name") {
    classes.push("dt-cell--project");
  }

  if (DATE_FIELDS.has(key)) {
    classes.push("dt-cell--date");
  }

  if (isEditing) {
    classes.push("td-editing");
  }

  return classes.join(" ");
}

function AutoSizeTextarea({ value, onChange, onBlur, onKeyDown, inputRef }) {
  useEffect(() => {
    const el = inputRef?.current;
    if (!el) return;

    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, inputRef]);

  return (
    <textarea
      ref={inputRef}
      className="cell-input cell-input--editing"
      value={value}
      rows={1}
      onChange={onChange}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    />
  );
}

function DataTable({ items, fields, onCellCommit, pushToast }) {
  const cols = useMemo(() => {
    return Array.isArray(fields) && fields.length ? fields : [];
  }, [fields]);

  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState("");
  const [sort, setSort] = useState({ key: "date", dir: "desc" });
  const inputRefs = useRef({});

  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  const sortedItems = useMemo(() => {
    const arr = Array.isArray(items) ? [...items] : [];
    if (!sort?.key) return arr;

    arr.sort((a, b) => compareValues(a, b, sort.key, sort.dir));
    return arr;
  }, [items, sort]);

  const focusCell = useCallback((r, c) => {
    const refKey = `${r}-${c}`;
    const el = inputRefs.current[refKey];
    if (el) {
      el.focus();
      const len = el.value?.length ?? 0;
      if (typeof el.setSelectionRange === "function") {
        el.setSelectionRange(len, len);
      }
    }
  }, []);

  const beginEdit = useCallback(
    (rowIndex, colIndex) => {
      const row = sortedItems[rowIndex];
      const key = cols[colIndex];
      if (!row || !key) return;

      const current = row[key] ?? "";
      setEditing({ r: rowIndex, c: colIndex, id: row.id, key });
      setDraft(String(current));

      setTimeout(() => focusCell(rowIndex, colIndex), 0);
    },
    [sortedItems, cols, focusCell]
  );

  const stopEdit = useCallback(() => {
    setEditing(null);
    setDraft("");
  }, []);

  const commit = useCallback(
    async ({ move } = {}) => {
      if (!editing) return true;

      const { r, id, key } = editing;
      const before = String(sortedItems?.[r]?.[key] ?? "");
      const after = String(draft ?? "");

      try {
        if (before !== after) {
          await onCellCommit(id, key, after);
        }

        if (move) {
          const nextR = clamp(move.r, 0, sortedItems.length - 1);
          const nextC = clamp(move.c, 0, cols.length - 1);
          beginEdit(nextR, nextC);
        } else {
          stopEdit();
        }

        return true;
      } catch (e) {
        pushToast?.("Error", String(e));
        return false;
      }
    },
    [
      editing,
      sortedItems,
      draft,
      onCellCommit,
      cols.length,
      beginEdit,
      stopEdit,
      pushToast,
    ]
  );

  const toggleSort = useCallback((key) => {
    setSort((prev) => {
      if (prev.key === key) {
        return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
      }
      return {
        key,
        dir: DATE_FIELDS.has(key) ? "desc" : "asc",
      };
    });
  }, []);

  const prettyLabel = (k) => k.replaceAll("_", " ").toUpperCase();

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {cols.map((k) => {
              const isSorted = sort.key === k;
              const arrow = isSorted ? (sort.dir === "asc" ? " ▲" : " ▼") : "";

              return (
                <th
                  key={k}
                  onClick={() => toggleSort(k)}
                  className="dt-th-sortable"
                  title={`Sort by ${prettyLabel(k)}`}
                >
                  {prettyLabel(k)}
                  {arrow}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {sortedItems.map((row, rowIndex) => (
            <tr key={row.id ?? rowIndex}>
              {cols.map((key, colIndex) => {
                const isEditing =
                  editing &&
                  editing.r === rowIndex &&
                  editing.c === colIndex;

                const displayValue = formatDisplayValue(key, row?.[key] ?? "");
                const isProjectName = key === "project_name";
                const refKey = `${rowIndex}-${colIndex}`;

                return (
                  <td
                    key={`${row.id ?? rowIndex}-${key}`}
                    className={getCellClassName(key, isEditing)}
                  >
                    {isEditing ? (
                      <AutoSizeTextarea
                        inputRef={{
                          get current() {
                            return inputRefs.current[refKey];
                          },
                          set current(el) {
                            inputRefs.current[refKey] = el;
                          },
                        }}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={async () => {
                          await commit();
                        }}
                        onKeyDown={async (e) => {
                          const r = rowIndex;
                          const c = colIndex;

                          if (e.key === "Escape") {
                            e.preventDefault();
                            stopEdit();
                            return;
                          }

                          if (e.key === "Enter" && !e.shiftKey) {
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
                            const input = e.currentTarget;
                            const atEnd =
                              input.selectionStart === input.value.length &&
                              input.selectionEnd === input.value.length;

                            if (atEnd) {
                              e.preventDefault();
                              await commit({ move: { r: r + 1, c } });
                            }
                            return;
                          }

                          if (e.key === "ArrowUp") {
                            const input = e.currentTarget;
                            const atStart =
                              input.selectionStart === 0 &&
                              input.selectionEnd === 0;

                            if (atStart) {
                              e.preventDefault();
                              await commit({ move: { r: r - 1, c } });
                            }
                            return;
                          }
                        }}
                      />
                    ) : (
                      <span
                        className={`cell-text ${
                          isProjectName ? "cell-text--project" : ""
                        }`}
                        title={displayValue}
                        data-tooltip={displayValue}
                        onClick={() => beginEdit(rowIndex, colIndex)}
                      >
                        {displayValue}
                      </span>
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