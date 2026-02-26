export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = "Confirm",
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onMouseDown={onCancel}>
      <div className="modal modal--sm" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">{title}</div>
          <div className="spacer" />
          <button className="btn" onClick={onCancel}>Close</button>
        </div>

        <div className="modal-body">
          <div className="modal-message">{message}</div>
        </div>

        <div className="modal-footer">
          <div className="spacer" />
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
}
