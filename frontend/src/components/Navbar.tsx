import { NavLink } from "react-router-dom";

const linkBase =
  "rounded-md px-3 py-2 text-sm font-medium transition-colors";

function navClass({ isActive }: { isActive: boolean }) {
  return `${linkBase} ${
    isActive
      ? "bg-slate-900 text-white"
      : "text-slate-600 hover:bg-slate-200 hover:text-slate-900"
  }`;
}

export function Navbar() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <span className="text-lg font-bold text-slate-900">
          ⚙️ Job Platform
        </span>
        <div className="flex items-center gap-1">
          <NavLink to="/" end className={navClass}>
            Dashboard
          </NavLink>
          <NavLink to="/jobs" className={navClass}>
            Jobs
          </NavLink>
          <NavLink to="/workflows" className={navClass}>
            Workflows
          </NavLink>
        </div>
      </nav>
    </header>
  );
}
