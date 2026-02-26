// src/components/History.jsx
import { useEffect } from "react";

/**
 * History modal component.
 * Expects history items that may contain:
 * - action, summary, project_id, changed_at
 * - changes: [{ key, label, before, after }]
 * - before, after (raw json)
 * - user / username / actor / changed_by / changed_by_email
 */
export default function History({
  open,
  onClose,
  history,
  histPage,
  setHistPage,
  refreshHistory,
  undo,
  redo,
}) {
  useEffect(() => {
    if (!open) return;
    // optional: close on ESC
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const getActor = (h) =>
    h?.username ??
    h?.user ??
    h?.actor ??
    h?.changed_by ??
    h?.changed_by_email ??
    h?.changedBy ??
    h?.changedByEmail ??
    "";

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal modal--sm" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">History</div>
          <div className="spacer" />
          <button className="btn btn--sm" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="modal-body">
          <div className="history-actions">
            <button className="btn btn--sm" onClick={undo}>
              Undo
            </button>
            <button className="btn btn--sm" onClick={redo}>
              Redo
            </button>
            <div className="spacer" />
            <div className="pill pill--sm">Showing {history?.items?.length || 0}</div>
          </div>

          <div className="history-list">
            {(history?.items || []).map((h) => {
              const actor = getActor(h);

              return (
                <div key={h.id} className="history-item">
                  <div className="history-item__top">
                    <div className="history-left">
                      <span className={`badge badge--${(h.action || "").toLowerCase()}`}>
                        {(h.action || "").toUpperCase()}
                      </span>

                      <div className="history-title">{h.summary || `Project #${h.project_id}`}</div>

                      <div className="history-subtle">
                        Entry #{h.id} • Project #{h.project_id}
                        {actor ? ` • ${actor}` : ""}
                        {h.changed_at ? ` • ${h.changed_at}` : ""}
                      </div>
                    </div>

                    <div className="history-right">
                      <div className="pill pill--sm">{(h.changes || []).length} change(s)</div>
                    </div>
                  </div>

                  {(h.changes || []).length ? (
                    <div className="change-list">
                      {(h.changes || []).slice(0, 6).map((c) => (
                        <div key={c.key} className="change-row">
                          <div className="change-label">{c.label || c.key}</div>
                          <div className="change-values">
                            <div className="change-before">{c.before || ""}</div>
                            <div className="change-arrow">→</div>
                            <div className="change-after">{c.after || ""}</div>
                          </div>
                        </div>
                      ))}
                      {(h.changes || []).length > 6 ? (
                        <div className="history-subtle">
                          + {(h.changes || []).length - 6} more…
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="history-subtle">No field-level differences detected.</div>
                  )}

                  <details className="history-details">
                    <summary>View raw details</summary>
                    <div className="history-raw-grid">
                      <div>
                        <div className="subtle subtle--xs">Before</div>
                        <pre className="history-item__pre history-pre--wrap">
                          {h.before ? JSON.stringify(h.before, null, 2) : ""}
                        </pre>
                      </div>
                      <div>
                        <div className="subtle subtle--xs">After</div>
                        <pre className="history-item__pre history-pre--wrap">
                          {h.after ? JSON.stringify(h.after, null, 2) : ""}
                        </pre>
                      </div>
                    </div>
                  </details>
                </div>
              );
            })}
          </div>

          <div className="history-pager">
            <button
              className="btn btn--sm"
              disabled={histPage <= 1}
              onClick={async () => {
                const p = histPage - 1;
                setHistPage(p);
                await refreshHistory(p);
              }}
            >
              ← Prev
            </button>

            <div className="pill pill--sm">Page: {histPage}</div>

            <button
              className="btn btn--sm"
              disabled={(history?.items || []).length < 25}
              onClick={async () => {
                const p = histPage + 1;
                setHistPage(p);
                await refreshHistory(p);
              }}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}