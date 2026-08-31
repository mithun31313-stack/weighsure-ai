import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { api, type AppNotification } from "../lib/api";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const data = await api.get<AppNotification[]>("/notifications");
      setNotifications(data);
    } catch {
      /* ignore — e.g. not logged in yet */
    }
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  async function markRead(id: number) {
    await api.post(`/notifications/${id}/read`);
    setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  async function markAllRead() {
    await api.post("/notifications/read-all");
    setNotifications((ns) => ns.map((n) => ({ ...n, is_read: true })));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center h-9 w-9 rounded-md text-steel-light hover:bg-white/5 hover:text-white transition-colors"
        aria-label="Notifications"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-brass text-white text-[10px] font-semibold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-surface-raised border border-hairline rounded-lg shadow-xl overflow-hidden z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-hairline">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-ink-light font-medium hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 && (
              <div className="px-4 py-6 text-center text-xs text-steel">No notifications yet.</div>
            )}
            {notifications.map((n) => (
              <Link
                key={n.id}
                to={n.link ?? "#"}
                onClick={() => {
                  if (!n.is_read) markRead(n.id);
                  setOpen(false);
                }}
                className={`block px-4 py-3 border-b border-hairline last:border-0 hover:bg-surface transition-colors ${
                  n.is_read ? "" : "bg-warn-bg/40"
                }`}
              >
                <div className="text-xs font-medium text-ink">{n.title}</div>
                {n.body && <div className="text-[11px] text-steel mt-0.5">{n.body}</div>}
                <div className="text-[10px] text-steel-light mt-1 font-mono">
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
