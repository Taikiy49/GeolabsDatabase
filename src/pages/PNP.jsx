// src/pages/PNP.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import Topbar from "../components/Topbar";
import DataTable from "../components/DataTable";
import History from "../components/History"; // ✅ NEW
import { apiGet, apiSend } from "../api/client";
import "../styles/PNP.css";

const FIELDS = [
  "date",
  "client",
  "project_name",
  "pr_number",
  "work_order_number",
  "report_date",
  "invoice_number",
  "principal_engineer",
];

export default function Projects({ pushToast }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);

  const [data, setData] = useState({
    items: [],
    total: 0,
    page: 1,
    page_size: 25,
  });

  // Inline add row
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({
    date: "",
    client: "",
    project_name: "",
    pr_number: "",
    work_order_number: "",
    report_date: "",
    invoice_number: "",
    principal_engineer: "",
  });

  // History modal
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState({
    items: [],
    total: 0,
    page: 1,
    page_size: 25,
  });
  const [histPage, setHistPage] = useState(1);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil((data.total || 0) / pageSize)),
    [data.total, pageSize]
  );

  const refresh = useCallback(
    async (nextPage = page, nextQ = q) => {
      try {
        const qs = new URLSearchParams({
          q: nextQ,
          page: String(nextPage),
          page_size: String(pageSize),
        });
        const res = await apiGet(`/api/projects?${qs.toString()}`);
        setData(res);
      } catch (e) {
        pushToast?.("Error", String(e));
        console.error(e);
      }
    },
    [page, q, pageSize, pushToast]
  );

  const refreshHistory = useCallback(
    async (nextPage = histPage) => {
      try {
        const qs = new URLSearchParams({
          page: String(nextPage),
          page_size: "25",
        });
        const res = await apiGet(`/api/projects/history?${qs.toString()}`);
        setHistory(res);
      } catch (e) {
        pushToast?.("Error", String(e));
        console.error(e);
      }
    },
    [histPage, pushToast]
  );

  useEffect(() => {
    refresh(1, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = useCallback(async () => {
    setPage(1);
    await refresh(1, q);
  }, [q, refresh]);

  const openHistory = useCallback(async () => {
    setHistoryOpen(true);
    setHistPage(1);
    await refreshHistory(1);
  }, [refreshHistory]);

  const undo = useCallback(async () => {
    try {
      const res = await apiSend(`/api/projects/undo`, "POST");
      pushToast("Undo", `Undid ${res?.undid?.action || "change"}`);
      await refresh(page, q);
      if (historyOpen) await refreshHistory(histPage);
    } catch (e) {
      pushToast("Error", String(e));
    }
  }, [pushToast, refresh, page, q, historyOpen, refreshHistory, histPage]);

  const redo = useCallback(async () => {
    try {
      const res = await apiSend(`/api/projects/redo`, "POST");
      pushToast("Redo", `Redid ${res?.redid?.action || "change"}`);
      await refresh(page, q);
      if (historyOpen) await refreshHistory(histPage);
    } catch (e) {
      pushToast("Error", String(e));
    }
  }, [pushToast, refresh, page, q, historyOpen, refreshHistory, histPage]);

  // Ctrl/Cmd+Z undo, Ctrl/Cmd+Y redo, Ctrl/Cmd+Shift+Z redo
  useEffect(() => {
    const handler = (e) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (!mod) return;

      const k = e.key.toLowerCase();

      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((k === "z" && e.shiftKey) || k === "y") {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handler, { passive: false });
    return () => window.removeEventListener("keydown", handler);
  }, [undo, redo]);

  // Save one cell (PATCH)
  const onCellCommit = useCallback(
    async (rowId, field, value) => {
      try {
        const payload = { [field]: value };
        const updated = await apiSend(`/api/projects/${rowId}`, "PATCH", payload);

        setData((prev) => ({
          ...prev,
          items: prev.items.map((r) => (r.id === rowId ? updated : r)),
        }));

        if (historyOpen) await refreshHistory(histPage);
      } catch (e) {
        pushToast("Error", String(e));
        throw e;
      }
    },
    [historyOpen, histPage, refreshHistory, pushToast]
  );

  function resetNewRow() {
    setNewRow({
      date: "",
      client: "",
      project_name: "",
      pr_number: "",
      work_order_number: "",
      report_date: "",
      invoice_number: "",
      principal_engineer: "",
    });
  }

  async function createRow() {
    try {
      const payload = {};
      for (const k of FIELDS) payload[k] = String(newRow[k] || "").trim();

      const created = await apiSend(`/api/projects`, "POST", payload);
      pushToast("Created", `Added record #${created.id}`);

      setAdding(false);
      resetNewRow();

      await refresh(page, q);
      if (historyOpen) await refreshHistory(histPage);
    } catch (e) {
      pushToast("Error", String(e));
    }
  }

  return (
    <>
      <Topbar
        title="Projects & Proposals"
        subtitle="Click a cell to edit. Ctrl/Cmd+Z undo • Ctrl/Cmd+Y redo"
        right={
          <div className="topbar-actions">
            <button className="btn btn--sm" onClick={undo} title="Ctrl/Cmd+Z">
              Undo
            </button>
            <button className="btn btn--sm" onClick={redo} title="Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z">
              Redo
            </button>

            <input
              className="input input--sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  await onSearch();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setQ("");
                  setPage(1);
                  await refresh(1, "");
                }
              }}
              placeholder="Search client, PR, WO, invoice, engineer..."
            />

            <button className="btn btn--sm" onClick={onSearch}>
              Search
            </button>

            <button className="btn btn--sm" onClick={openHistory}>
              History
            </button>

            {!adding ? (
              <button className="btn btn-primary btn--sm" onClick={() => setAdding(true)}>
                + Add
              </button>
            ) : (
              <button
                className="btn btn--sm"
                onClick={() => {
                  setAdding(false);
                  resetNewRow();
                }}
              >
                Cancel Add
              </button>
            )}
          </div>
        }
      />

      <div className="page">
        <div className="projects-toolbar">
          <div className="pill pill--sm">Total: {data.total ?? 0}</div>
          <div className="pill pill--sm">
            Page: {page} / {totalPages}
          </div>
          <div className="spacer" />

          <button
            className="btn btn--sm"
            disabled={page <= 1}
            onClick={async () => {
              const p = page - 1;
              setPage(p);
              await refresh(p, q);
            }}
          >
            ← Prev
          </button>

          <button
            className="btn btn--sm"
            disabled={page >= totalPages}
            onClick={async () => {
              const p = page + 1;
              setPage(p);
              await refresh(p, q);
            }}
          >
            Next →
          </button>
        </div>

        {adding ? (
          <div className="addrow">
            <div className="addrow__title">Add New Row</div>

            <div className="addrow__grid">
              {FIELDS.map((k) => (
                <div key={k} className="addrow__field">
                  <div className="addrow__label">{k.replaceAll("_", " ")}</div>
                  <input
                    className="input input--sm"
                    value={newRow[k]}
                    onChange={(e) => setNewRow((p) => ({ ...p, [k]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div className="addrow__actions">
              <button className="btn btn-primary btn--sm" onClick={createRow}>
                Save New Row
              </button>
              <button
                className="btn btn--sm"
                onClick={() => {
                  setAdding(false);
                  resetNewRow();
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <DataTable items={data.items} fields={FIELDS} onCellCommit={onCellCommit} pushToast={pushToast} />
      </div>

      {/* ✅ now it's clean */}
      <History
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        histPage={histPage}
        setHistPage={setHistPage}
        refreshHistory={refreshHistory}
        undo={undo}
        redo={redo}
      />
    </>
  );
}