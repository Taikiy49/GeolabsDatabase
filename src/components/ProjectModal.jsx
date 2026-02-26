import { useEffect, useMemo, useState } from "react";

const FIELDS = [
  { key: "date", label: "Date (e.g., 1/30/26)" },
  { key: "client", label: "Client" },
  { key: "project_name", label: "Project Name" },
  { key: "pr_number", label: "PR Number" },
  { key: "work_order_number", label: "Work Order Number" },
  { key: "report_date", label: "Report Date" },
  { key: "invoice_number", label: "Invoice Number" },
  { key: "principal_engineer", label: "Principal Engineer" },
];

export default function ProjectModal({ open, mode, initial, onClose, onSave }) {
  const isEdit = mode === "edit";

  const defaults = useMemo(() => {
    const obj = {};
    FIELDS.forEach((f) => (obj[f.key] = ""));
    return obj;
  }, []);

  const [form, setForm] = useState(defaults);

  useEffect(() => {
    if (open) setForm({ ...defaults, ...(initial || {}) });
  }, [open, initial, defaults]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-dot" />
          <div className="modal-title">{isEdit ? "Edit Project" : "Add Project"}</div>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Close</button>
        </div>

        <div className="modal-body">
          <div className="grid grid--tight">
            {FIELDS.map((f) => (
              <div key={f.key} className="field">
                <div className="field__label subtle">{f.label}</div>
                <input
                  className="input input--full"
                  value={form[f.key] ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.label}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="modal-footer">
          <div className="subtle">Tip: keep formats consistent (PR / Work Order).</div>
          <div className="spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(form)}>
            {isEdit ? "Save Changes" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
