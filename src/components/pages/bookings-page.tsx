"use client";

import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, getDay, addMonths, subMonths } from "date-fns";
import { List, CalendarDays, ChevronLeft, ChevronRight, X, Mail, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Booking {
  id: string;
  guest: string;
  listing?: string;
  checkIn: string;
  nights: number;
  value: number;
  status: string;
}

type BookingStatus = "confirmed" | "pending" | "cancelled";

const statusColors: Record<string, string> = {
  confirmed: "bg-[#1d9e75]/10 text-[#1d9e75]",
  pending: "bg-[#8b501a]/10 text-[#8b501a]",
  cancelled: "bg-[#ba1a1a]/10 text-[#ba1a1a]",
};

const calendarColors: Record<string, string> = {
  confirmed: "bg-[#1d9e75]/20 text-[#1d9e75] border-[#1d9e75]/30",
  pending: "bg-[#8b501a]/20 text-[#8b501a] border-[#8b501a]/30",
  cancelled: "bg-[#ba1a1a]/20 text-[#ba1a1a] border-[#ba1a1a]/30",
};

function BookingDrawer({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" />
      <div
        className="relative bg-card w-full max-w-md h-full shadow-2xl border-l border-border overflow-y-auto flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <h3 className="font-serif font-bold text-foreground">Booking Details</h3>
            <p className="text-xs text-muted-foreground font-sans">{booking.id}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1">
          <div className="flex items-center gap-3">
            <span className={cn("text-xs font-sans font-bold px-3 py-1.5 rounded-full uppercase tracking-wide", statusColors[booking.status] ?? statusColors.pending)}>
              {booking.status}
            </span>
            <span className="text-sm font-serif font-bold text-foreground">${booking.value.toLocaleString()}</span>
          </div>

          <div className="bg-secondary rounded-xl p-4">
            <div className="text-xs font-sans font-bold text-muted-foreground uppercase tracking-wider mb-3">Guest Information</div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-sm font-bold font-sans">
                  {booking.guest.split(" ").map((n) => n[0]).join("")}
                </span>
              </div>
              <div>
                <div className="font-sans font-semibold text-foreground text-sm">{booking.guest}</div>
                <div className="text-xs text-muted-foreground font-sans">guest@email.com</div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-xs font-sans font-bold text-muted-foreground uppercase tracking-wider">Booking Details</div>
            {[
              { label: "Listing", value: booking.listing ?? "N/A" },
              { label: "Check-in", value: booking.checkIn },
              { label: "Duration", value: `${booking.nights} nights` },
              { label: "Gross Value", value: `$${booking.value.toLocaleString()}` },
              { label: "Platform Fee (12%)", value: `-$${Math.round(booking.value * 0.12).toLocaleString()}` },
              { label: "Your Net", value: `$${Math.round(booking.value * 0.88).toLocaleString()}` },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-start justify-between text-sm font-sans">
                <span className="text-muted-foreground">{label}</span>
                <span className={cn("font-semibold text-foreground text-right", label === "Your Net" && "text-[#1d9e75]")}>
                  {value}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-border space-y-2">
          <button className="w-full flex items-center justify-center gap-2 bg-[#172c1c] text-white py-2.5 rounded-xl text-sm font-sans font-semibold hover:opacity-90">
            <Mail size={15} /> Message Guest
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarView({ bookings, onSelect }: { bookings: Booking[]; onSelect: (b: Booking) => void }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = (getDay(monthStart) + 6) % 7;

  const getBookingsForDay = (date: Date) => {
    return bookings.filter((b) => {
      const checkIn = new Date(b.checkIn);
      const checkOut = new Date(new Date(b.checkIn).setDate(checkIn.getDate() + b.nights));
      return date >= checkIn && date < checkOut;
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <button onClick={() => setCurrentMonth((m) => subMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <ChevronLeft size={16} className="text-muted-foreground" />
        </button>
        <h3 className="font-serif font-bold text-foreground text-lg">{format(currentMonth, "MMMM yyyy")}</h3>
        <button onClick={() => setCurrentMonth((m) => addMonths(m, 1))} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <ChevronRight size={16} className="text-muted-foreground" />
        </button>
      </div>

      <div className="grid grid-cols-7 border-b border-border">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-2.5 text-center text-[11px] font-sans font-bold text-muted-foreground uppercase tracking-wider">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="border-b border-r border-border min-h-24 p-1" />
        ))}
        {days.map((day) => {
          const dayBookings = getBookingsForDay(day);
          const isToday = format(day, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
          return (
            <div key={day.toISOString()} className={cn("border-b border-r border-border min-h-24 p-1.5", isToday && "bg-[#8b501a]/5")}>
              <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-sans font-semibold mb-1", isToday ? "bg-[#8b501a] text-white" : "text-foreground")}>
                {format(day, "d")}
              </div>
              <div className="space-y-0.5">
                {dayBookings.slice(0, 2).map((b) => (
                  <button key={b.id} onClick={() => onSelect(b)} className={cn("w-full text-left text-[9px] font-sans font-semibold px-1.5 py-0.5 rounded truncate border", calendarColors[b.status] ?? calendarColors.pending)}>
                    {b.guest.split(" ")[0]}
                  </button>
                ))}
                {dayBookings.length > 2 && <p className="text-[9px] text-muted-foreground font-sans px-1">+{dayBookings.length - 2} more</p>}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 px-5 py-3 border-t border-border">
        {(["confirmed", "pending", "cancelled"] as const).map((s) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={cn("w-2.5 h-2.5 rounded-sm border", calendarColors[s])} />
            <span className="text-[11px] font-sans text-muted-foreground capitalize">{s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "calendar">("list");
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch("/api/operator/bookings");
      if (!res.ok) throw new Error("Failed to load bookings");
      const data = await res.json();
      setBookings(data.bookings ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-6xl mx-auto text-center py-20">
        <p className="text-sm text-muted-foreground font-sans mb-3">{error}</p>
        <button onClick={fetchBookings} className="text-sm font-sans text-[#8b501a] hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {selectedBooking && <BookingDrawer booking={selectedBooking} onClose={() => setSelectedBooking(null)} />}

      <div className="flex items-start justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-serif italic text-foreground">Bookings</h1>
        <div className="flex items-center gap-1 bg-secondary rounded-xl p-1">
          <button onClick={() => setView("list")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-sans font-medium transition-all", view === "list" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <List size={14} /> List
          </button>
          <button onClick={() => setView("calendar")} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-sans font-medium transition-all", view === "calendar" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            <CalendarDays size={14} /> Calendar
          </button>
        </div>
      </div>

      {view === "calendar" ? (
        <div className="pb-8">
          <CalendarView bookings={bookings} onSelect={setSelectedBooking} />
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden pb-8">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reference</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Guest</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Listing</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Check-in</th>
                  <th className="text-center px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Nights</th>
                  <th className="text-right px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Value</th>
                  <th className="text-center px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bookings.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-muted-foreground">No bookings yet</td></tr>
                ) : (
                  bookings.map((booking) => (
                    <tr key={booking.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-4"><span className="font-mono text-xs text-muted-foreground">{booking.id}</span></td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-primary font-sans">{booking.guest.split(" ").map((n) => n[0]).join("")}</span>
                          </div>
                          <span className="font-semibold text-foreground text-sm">{booking.guest}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 hidden lg:table-cell"><span className="text-sm text-foreground">{booking.listing ?? "N/A"}</span></td>
                      <td className="px-4 py-4 hidden md:table-cell"><span className="text-sm text-foreground">{booking.checkIn}</span></td>
                      <td className="px-4 py-4 text-center hidden lg:table-cell"><span className="text-sm text-foreground">{booking.nights}</span></td>
                      <td className="px-4 py-4 text-right"><span className="font-serif font-bold text-foreground">${booking.value.toLocaleString()}</span></td>
                      <td className="px-4 py-4 text-center">
                        <span className={cn("text-[10px] font-sans font-bold px-2.5 py-1 rounded-full uppercase tracking-wide", statusColors[booking.status] ?? statusColors.pending)}>
                          {booking.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button onClick={() => setSelectedBooking(booking)} className="text-xs font-sans font-semibold text-[#8b501a] hover:underline">View</button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
