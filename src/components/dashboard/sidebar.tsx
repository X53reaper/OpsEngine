"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Home,
  ImageIcon,
  Calendar,
  MessageCircle,
  DollarSign,
  Star,
  Images,
  User,
  Settings,
  LogOut,
  TreePine,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "reserve", label: "My Reserve", icon: Home },
  { id: "listings", label: "My Listings", icon: ImageIcon },
  { id: "bookings", label: "Bookings", icon: Calendar },
  { id: "enquiries", label: "Enquiries", icon: MessageCircle },
  { id: "earnings", label: "Earnings", icon: DollarSign },
  { id: "reviews", label: "Reviews", icon: Star },
  { id: "media", label: "Media Library", icon: Images },
  { id: "profile", label: "Residency Profile", icon: User },
  { id: "settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

function useEnquiryCount() {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/operator/enquiries/count");
      if (res.ok) {
        const data = await res.json();
        setCount(data.count ?? 0);
      }
    } catch {
      // Silently fail — badge stays at last known count
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return count;
}

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const enquiryCount = useEnquiryCount();

  return (
    <aside className="hidden lg:flex flex-col w-60 min-h-screen bg-[#172c1c] fixed left-0 top-0 bottom-0 z-30">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#8b501a] flex items-center justify-center flex-shrink-0">
            <TreePine size={16} className="text-white" />
          </div>
          <div>
            <div className="text-white font-serif font-bold text-base leading-tight">Safari Zetu</div>
            <div className="text-white/50 text-[10px] font-sans uppercase tracking-widest">Operator Portal</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <ul className="space-y-0.5">
          {navItems.map(({ id, label, icon: Icon }) => (
            <li key={id}>
              <button
                onClick={() => onNavigate(id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-sans transition-all",
                  currentPage === id
                    ? "bg-[#8b501a] text-white font-medium"
                    : "text-white/70 hover:bg-white/8 hover:text-white"
                )}
              >
                <Icon size={17} className="flex-shrink-0" />
                {label}
                {id === "enquiries" && enquiryCount > 0 && (
                  <span className="ml-auto bg-[#8b501a] text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] px-1">
                    {enquiryCount}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bottom operator info */}
      <div className="px-4 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-full bg-[#8b501a] flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold font-sans">OP</span>
          </div>
          <div className="min-w-0">
            <div className="text-white text-sm font-medium font-sans truncate">Operator</div>
            <div className="text-white/50 text-xs font-sans truncate">Safari Zetu</div>
          </div>
        </div>
        <button className="w-full flex items-center gap-2 text-white/50 hover:text-white text-xs py-1.5 transition-colors font-sans">
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

// Mobile bottom navigation
interface MobileNavProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const mobileNavItems = [
  { id: "reserve", label: "Reserve", icon: Home },
  { id: "listings", label: "Listings", icon: ImageIcon },
  { id: "bookings", label: "Bookings", icon: Calendar },
  { id: "enquiries", label: "Enquiries", icon: MessageCircle },
  { id: "profile", label: "Profile", icon: User },
];

export function MobileNav({ currentPage, onNavigate }: MobileNavProps) {
  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#172c1c] border-t border-white/10 px-2 py-2">
      <ul className="flex items-center justify-around">
        {mobileNavItems.map(({ id, label, icon: Icon }) => (
          <li key={id}>
            <button
              onClick={() => onNavigate(id)}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-1.5 rounded-lg transition-all",
                currentPage === id ? "text-[#8b501a]" : "text-white/50 hover:text-white"
              )}
            >
              <Icon size={20} />
              <span className="text-[10px] font-sans">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
