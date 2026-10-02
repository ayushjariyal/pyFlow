import { useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLiveActivity } from "../hooks/useLiveActivity";
import { Icon } from "./Icon";

const ITEMS = [
  { key: "dashboard", label: "Dashboard", to: "/" },
  { key: "jobs", label: "Jobs", to: "/jobs" },
  { key: "workflows", label: "Workflows", to: "/workflows" },
] as const;

type NavKey = (typeof ITEMS)[number]["key"];

function activeKey(pathname: string): NavKey {
  if (pathname.startsWith("/jobs")) return "jobs";
  if (pathname.startsWith("/workflows")) return "workflows";
  return "dashboard";
}

export function Navbar() {
  const { pathname } = useLocation();
  const active = activeKey(pathname);
  const { running, online } = useLiveActivity(5000);

  // The highlight slides between tabs, so it's positioned from the measured
  // box of the active link rather than styled on the link itself.
  const tabs = useRef<Partial<Record<NavKey, HTMLAnchorElement | null>>>({});
  const tabList = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = tabs.current[active];
      if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    // Tab widths shift once the web font replaces the fallback.
    const observer = new ResizeObserver(measure);
    if (tabList.current) observer.observe(tabList.current);
    return () => observer.disconnect();
  }, [active]);

  const liveLabel = !online ? "API offline" : running ? `${running} running` : "Workers idle";

  return (
    <header className="site-header">
      <nav className="site-nav">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Icon name="flow-arrow" weight="bold" />
          </span>
          Job Platform
        </Link>
        <div className="nav-tabs" ref={tabList}>
          <div
            className="nav-indicator"
            style={indicator ?? { left: 3, width: 0 }}
          />
          {ITEMS.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              ref={(el) => {
                tabs.current[item.key] = el;
              }}
              className="nav-tab"
              aria-current={item.key === active ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="live-pill">
          <span className={`live-dot${online && running ? " is-live" : ""}`} />
          {liveLabel}
        </div>
      </nav>
      <div className="site-header-rule" />
    </header>
  );
}
