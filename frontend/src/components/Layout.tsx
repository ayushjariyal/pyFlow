import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "./Navbar";

export function Layout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <div className="app-shell">
      {/* Ambient backdrop: two slow-drifting glows and a faded grid. */}
      <div className="ambient" aria-hidden="true">
        <div className="ambient-orb-1" />
        <div className="ambient-orb-2" />
        <div className="ambient-grid" />
      </div>
      <Navbar />
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
