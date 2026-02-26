export default function Toast({ toasts, dismiss }) {
  return (
    <div className="toast-wrap">
      {(toasts || []).map((t) => (
        <div key={t.id} className="toast" onClick={() => dismiss(t.id)} role="button" tabIndex={0}>
          <strong>{t.title}</strong>
          <p>{t.message}</p>
        </div>
      ))}
    </div>
  );
}
