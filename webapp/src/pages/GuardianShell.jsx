import { useEffect, useState } from "react";
import { Bell, LogOut, Menu, Search, Share2, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import Logo from "../components/Logo";
import { clearGuardianSession, getGuardianSession } from "../lib/guardian";

export default function GuardianShell({ children, active = "home" }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const session = getGuardianSession();

  useEffect(() => {
    if (!session) navigate("/guardian", { replace: true });
  }, [navigate, session]);

  if (!session) return null;

  function logout() {
    clearGuardianSession();
    navigate("/guardian", { replace: true });
  }

  return (
    <main className="guardian-screen guardian-app-screen">
      <div className="guardian-phone-frame guardian-app-frame">
        <header className="guardian-topbar">
          <button aria-label="Menu" onClick={() => setMenuOpen(true)}><Menu size={26} /></button>
          <div className="guardian-topbar-actions">
            <button aria-label="Notifications"><Bell size={22} /></button>
            <button aria-label="Share" onClick={() => navigator.share?.({ title: "SafeTrak", text: `SafeTrak status for ${session.name || session.cardId}` }).catch(() => {})}><Share2 size={21} /></button>
            <button aria-label="Search"><Search size={22} /></button>
          </div>
        </header>

        <div className="guardian-content">{children}</div>

        <nav className="guardian-bottom-nav">
          <Link className={active === "home" ? "active" : ""} to="/guardian/home">Home</Link>
          <Link className={active === "history" ? "active" : ""} to="/guardian/history">History</Link>
        </nav>

        {menuOpen && (
          <div className="guardian-menu-backdrop" onMouseDown={(e) => e.target === e.currentTarget && setMenuOpen(false)}>
            <aside className="guardian-menu-panel">
              <div className="guardian-menu-head"><Logo className="guardian-menu-logo" /><button onClick={() => setMenuOpen(false)}><X size={22} /></button></div>
              <div className="guardian-menu-student"><span>Signed in for</span><strong>{session.name || "Student"}</strong><small>{session.cardId}</small></div>
              <Link to="/guardian/home" onClick={() => setMenuOpen(false)}>Home</Link>
              <Link to="/guardian/history" onClick={() => setMenuOpen(false)}>Card history</Link>
              <button className="guardian-logout" onClick={logout}><LogOut size={18} /> Log out</button>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
