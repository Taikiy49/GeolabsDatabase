export default function Topbar({ title, subtitle, right }) {
  return (
    <header className="topbar">
      <div className="card">
        <div className="card-inner row">
          <div className="topbar__text">
            <h1 className="h1">{title}</h1>
            {subtitle ? <div className="subtle">{subtitle}</div> : null}
          </div>
          <div className="spacer" />
          {right}
        </div>
      </div>
    </header>
  );
}
