"use client";

import { useState, useEffect, useCallback } from "react";
import { Send, X, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Enquiry {
  id: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  reply_message?: string | null;
  replied_at?: string | null;
  listing?: { id: string; title: string; pricePerNight?: number } | null;
  operator?: { id: string; name: string; email: string } | null;
  user?: { id: string; name: string; email: string; country?: string } | null;
}

type EnquiryStatus = "new" | "responded" | "closed" | "converted";

const statusStyles: Record<string, { dot: string; label: string; pill: string }> = {
  new: { dot: "bg-[#8b501a]", label: "New", pill: "bg-[#8b501a]/10 text-[#8b501a]" },
  responded: { dot: "bg-[#1d9e75]", label: "Responded", pill: "bg-[#1d9e75]/10 text-[#1d9e75]" },
  closed: { dot: "bg-border", label: "Closed", pill: "bg-secondary text-muted-foreground" },
  converted: { dot: "bg-[#1d9e75]", label: "Converted", pill: "bg-[#1d9e75]/10 text-[#1d9e75]" },
};

type Filter = "all" | EnquiryStatus;

export function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Enquiry | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const fetchEnquiries = useCallback(async () => {
    try {
      const res = await fetch("/api/operator/enquiries");
      if (!res.ok) throw new Error("Failed to load enquiries");
      const data = await res.json();
      setEnquiries(data.enquiries ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load enquiries");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnquiries();
  }, [fetchEnquiries]);

  const filtered = filter === "all" ? enquiries : enquiries.filter((e) => e.status === filter);
  const unread = enquiries.filter((e) => e.status === "new").length;

  const filters: Array<{ label: string; value: Filter }> = [
    { label: "All", value: "all" },
    { label: "New", value: "new" },
    { label: "Responded", value: "responded" },
    { label: "Closed", value: "closed" },
  ];

  const handleSendReply = async () => {
    if (!selected || !reply.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/operator/enquiries/${selected.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply.trim() }),
      });
      if (!res.ok) throw new Error("Failed to send reply");
      setReply("");
      await fetchEnquiries();
      const updated = enquiries.find((e) => e.id === selected.id);
      if (updated) setSelected({ ...updated, status: "responded", reply_message: reply.trim(), replied_at: new Date().toISOString() });
    } catch {
      // Silently fail — user can retry
    } finally {
      setSending(false);
    }
  };

  const handleClose = async () => {
    if (!selected) return;
    try {
      await fetch(`/api/operator/enquiries/${selected.id}/close`, { method: "POST" });
      await fetchEnquiries();
      setSelected(null);
    } catch {
      // Silently fail
    }
  };

  const handleConvert = async () => {
    if (!selected) return;
    try {
      await fetch(`/api/operator/enquiries/${selected.id}/convert`, { method: "POST" });
      await fetchEnquiries();
      setSelected(null);
    } catch {
      // Silently fail
    }
  };

  const getGuestName = (enq: Enquiry) => enq.user?.name ?? "Traveller";
  const getGuestInitials = (enq: Enquiry) => {
    const name = getGuestName(enq);
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
  };
  const getListingTitle = (enq: Enquiry) => enq.listing?.title ?? "Listing";
  const getTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[calc(100vh-64px)] items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-muted-foreground font-sans mb-3">{error}</p>
          <button onClick={fetchEnquiries} className="text-sm font-sans text-[#8b501a] hover:underline">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left panel */}
      <div className={cn("flex flex-col border-r border-border bg-card", selected ? "hidden lg:flex w-80 flex-shrink-0" : "flex w-full lg:w-80 lg:flex-shrink-0")}>
        {/* Header */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2 mb-4">
            <h1 className="text-xl font-serif italic text-foreground">Enquiries</h1>
            {unread > 0 && (
              <span className="bg-[#8b501a] text-white text-[10px] font-bold font-sans rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                {unread}
              </span>
            )}
          </div>
          <div className="flex gap-1 flex-wrap">
            {filters.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-sans font-semibold transition-all",
                  filter === f.value
                    ? "bg-[#172c1c] text-white"
                    : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <ul className="flex-1 overflow-y-auto divide-y divide-border">
          {filtered.length === 0 ? (
            <li className="px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground font-sans">No enquiries found</p>
            </li>
          ) : (
            filtered.map((enq) => (
              <li key={enq.id}>
                <button
                  onClick={() => setSelected(enq)}
                  className={cn(
                    "w-full text-left px-5 py-4 hover:bg-secondary/40 transition-colors",
                    selected?.id === enq.id && "bg-[#8b501a]/8 border-r-2 border-r-[#8b501a]"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary text-xs font-bold font-sans">
                          {getGuestInitials(enq)}
                        </span>
                      </div>
                      <div className={cn("absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-card", statusStyles[enq.status]?.dot ?? statusStyles.new.dot)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <span className="text-sm font-sans font-semibold text-foreground truncate">{getGuestName(enq)}</span>
                        <span className="text-[10px] text-muted-foreground font-sans flex-shrink-0">{getTimeAgo(enq.createdAt)}</span>
                      </div>
                      <div className="text-xs text-[#8b501a] font-sans font-medium mb-0.5 truncate">{getListingTitle(enq)}</div>
                      <p className="text-xs text-muted-foreground font-sans line-clamp-1 leading-relaxed">{enq.message}</p>
                    </div>
                  </div>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Right panel — thread */}
      {selected ? (
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {/* Thread header */}
          <div className="px-6 py-4 border-b border-border bg-card flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <h2 className="font-serif font-bold text-foreground">{getGuestName(selected)}</h2>
                {selected.user?.country && (
                  <span className="text-xs text-muted-foreground font-sans">({selected.user.country})</span>
                )}
                <span className={cn("text-[10px] font-sans font-bold px-2 py-0.5 rounded-full uppercase", statusStyles[selected.status]?.pill ?? statusStyles.new.pill)}>
                  {statusStyles[selected.status]?.label ?? selected.status}
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-sans">
                Enquiry about <span className="text-[#8b501a] font-semibold">{getListingTitle(selected)}</span> · {getTimeAgo(selected.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {selected.status !== "closed" && selected.status !== "converted" && (
                <button onClick={handleClose} className="hidden lg:block text-xs font-sans text-muted-foreground hover:text-foreground transition-colors">
                  Mark Closed
                </button>
              )}
              {selected.status !== "converted" && (
                <button onClick={handleConvert} className="flex items-center gap-1.5 bg-[#1d9e75] text-white text-xs font-sans font-semibold px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity">
                  Convert to Booking <ArrowRight size={12} />
                </button>
              )}
              <button onClick={() => setSelected(null)} className="lg:hidden text-muted-foreground hover:text-foreground p-1">
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Listing summary card */}
            {selected.listing && (
              <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                <div className="w-16 h-12 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-sans text-muted-foreground">IMG</span>
                </div>
                <div>
                  <div className="text-sm font-serif font-bold text-foreground">{selected.listing.title}</div>
                  <div className="text-xs text-muted-foreground font-sans">
                    Zimbabwe{selected.listing.pricePerNight ? ` · From $${selected.listing.pricePerNight}/night` : ""}
                  </div>
                </div>
              </div>
            )}

            {/* Traveller message */}
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold font-sans text-foreground">
                  {getGuestInitials(selected)}
                </span>
              </div>
              <div className="flex-1 max-w-xl">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-sans font-semibold text-foreground">{getGuestName(selected)}</span>
                  <span className="text-xs text-muted-foreground font-sans">{getTimeAgo(selected.createdAt)}</span>
                </div>
                <div className="bg-card border border-border rounded-xl rounded-tl-sm px-4 py-3">
                  <p className="text-sm font-sans text-foreground leading-relaxed">{selected.message}</p>
                </div>
              </div>
            </div>

            {/* Operator reply */}
            {selected.reply_message && (
              <div className="flex gap-3 flex-row-reverse">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold font-sans text-primary-foreground">OP</span>
                </div>
                <div className="flex-1 max-w-xl">
                  <div className="flex items-center gap-2 mb-1.5 flex-row-reverse">
                    <span className="text-sm font-sans font-semibold text-foreground">You</span>
                    {selected.replied_at && (
                      <span className="text-xs text-muted-foreground font-sans">{getTimeAgo(selected.replied_at)}</span>
                    )}
                  </div>
                  <div className="bg-[#172c1c] rounded-xl rounded-tr-sm px-4 py-3">
                    <p className="text-sm font-sans text-white/90 leading-relaxed">
                      {selected.reply_message}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Reply area */}
          {selected.status !== "closed" && selected.status !== "converted" && (
            <div className="border-t border-border bg-card px-6 py-4">
              <div className="flex gap-3 items-end">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  rows={3}
                  placeholder="Write your reply..."
                  className="flex-1 border border-border rounded-xl px-4 py-3 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30 focus:border-[#8b501a] resize-none leading-relaxed"
                />
                <button
                  onClick={handleSendReply}
                  disabled={!reply.trim() || sending}
                  className="flex-shrink-0 bg-[#8b501a] text-white p-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <button onClick={handleClose} className="text-xs font-sans text-muted-foreground hover:text-[#ba1a1a] transition-colors">Mark as Closed</button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-secondary/20">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-border/50 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-muted-foreground font-sans text-sm">Select an enquiry to view the thread</p>
          </div>
        </div>
      )}
    </div>
  );
}
