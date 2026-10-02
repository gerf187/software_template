import { useState } from "react";
import { NavLink } from "react-router-dom";
import Button from "../components/Button.jsx";
import GlobaleSuche from "../components/GlobaleSuche.jsx";

export default function Sidebar({ brand, subtitle, logo, groups, user, onLogout }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button className="sidebar-toggle" onClick={() => setOpen(!open)}>
        Menü
      </button>
      <aside className={`sidebar${open ? " sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          {logo ? (
            <img className="sidebar-brand-logo" src={logo} alt={brand} />
          ) : (
            <div className="sidebar-brand-name">{brand}</div>
          )}
          {subtitle && <div className="sidebar-brand-subtitle">{subtitle}</div>}
        </div>

        <GlobaleSuche />

        <nav className="sidebar-nav">
          {groups.map((group) => (
            <div key={group.label} className="sidebar-group">
              <div className="sidebar-group-label">{group.label}</div>
              {group.items.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.to}
                  className={({ isActive }) =>
                    "sidebar-item" + (isActive ? " sidebar-item-active" : "")
                  }
                  onClick={() => setOpen(false)}
                >
                  {item.icon && <item.icon className="sidebar-item-icon" />}
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {user && (
          <div className="sidebar-user">
            <div className="sidebar-user-name">{user.name}</div>
            <div className="sidebar-user-role">{user.role}</div>
            <Button variant="secondary" onClick={onLogout}>
              Abmelden
            </Button>
          </div>
        )}
      </aside>
    </>
  );
}
