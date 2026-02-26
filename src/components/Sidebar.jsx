// src/components/Sidebar.jsx
import { NavLink } from "react-router-dom";

export default function Sidebar({ logoSrc, userEmail, onLogout }) {
  return (
    <aside className="sidebar card">
      <div className="sidebar__top card-inner">
        <img className="sidebar__logo" src={logoSrc} alt="Geolabs" />
        <div className="sidebar__brand">
          <div className="sidebar__title">Geolabs, Inc.</div>
          <div className="subtle">Database Portal</div>
        </div>
      </div>

      <div className="sidebar__divider" />

      <nav className="sidebar__nav">
        <SideItem to="/" label="Dashboard" />
        <SideItem to="/projects" label="Projects & Proposals" />
        <SideItem to="/ocr" label="OCR Lookup" />
      </nav>

      {/* pinned bottom */}
      <div className="sidebar__footer">
        <div className="sidebar-user">
          <div className="sidebar-user__label">Signed in as</div>
          <div className="sidebar-user__email" title={userEmail}>
            {userEmail}
          </div>

          <button className="btn btn--sm btn-danger sidebar-user__logout" onClick={onLogout}>
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}

function SideItem({ to, label }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) => `sideitem ${isActive ? "is-active" : ""}`}
    >
      <span className="sideitem__label">{label}</span>
      <span className="sideitem__arrow">→</span>
    </NavLink>
  );
}