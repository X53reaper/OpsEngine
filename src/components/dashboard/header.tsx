"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  text: string;
  time: string;
  read: boolean;
}

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/operator/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-20 h-16 flex items-center justify-between px-6 bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="text-sm font-sans text-muted-foreground">{title}</div>

      <div className="flex items-center gap-3">
        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(!notifOpen)}
            className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <Bell size={18} className="text-foreground/70" />
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-accent text-white text-[10px] rounded-full flex items-center justify-center font-bold font-sans">
                {unread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-11 w-80 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="font-sans font-semibold text-sm text-foreground">Notifications</span>
                <button onClick={() => setNotifOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              </div>
              <ul className="divide-y divide-border max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <li className="px-4 py-6 text-center">
                    <p className="text-xs text-muted-foreground font-sans">No notifications</p>
                  </li>
                ) : (
                  notifications.map((n) => (
                    <li
                      key={n.id}
                      className={cn("px-4 py-3", !n.read && "bg-[#8b501a]/5")}
                    >
                      <p className={cn("text-xs font-sans leading-relaxed", !n.read ? "text-foreground font-medium" : "text-muted-foreground")}>
                        {n.text}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1 font-sans">{n.time}</p>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center">
            <span className="text-primary-foreground text-xs font-bold font-sans">OP</span>
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-sans font-medium text-foreground leading-tight">Operator</div>
            <div className="text-xs text-muted-foreground font-sans leading-tight">Safari Zetu</div>
          </div>
        </div>
      </div>
    </header>
  );
}
