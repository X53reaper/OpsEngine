"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RevenueEntry {
  month: string;
  revenue: number;
  enquiries: number;
}

interface PayoutEntry {
  id: string;
  date: string;
  amount: number;
  status: string;
  method: string;
}

interface BookingRevenue {
  id: string;
  guest: string;
  checkIn: string;
  nights: number;
  value: number;
  status: string;
}

const payoutStatusStyles: Record<string, string> = {
  paid: "bg-[#1d9e75]/10 text-[#1d9e75]",
  pending: "bg-[#8b501a]/10 text-[#8b501a]",
  processing: "bg-border text-muted-foreground",
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2.5">
        <p className="text-xs font-sans font-semibold text-foreground mb-1">{label}</p>
        <p className="text-xs font-sans text-[#8b501a]">${payload[0]?.value?.toLocaleString()}</p>
      </div>
    );
  }
  return null;
};

export function EarningsPage() {
  const [revenueData, setRevenueData] = useState<RevenueEntry[]>([]);
  const [payoutHistory, setPayoutHistory] = useState<PayoutEntry[]>([]);
  const [bookings, setBookings] = useState<BookingRevenue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEarnings = useCallback(async () => {
    try {
      const res = await fetch("/api/operator/earnings");
      if (!res.ok) throw new Error("Failed to load earnings");
      const data = await res.json();
      setRevenueData(data.revenue ?? []);
      setPayoutHistory(data.payouts ?? []);
      setBookings(data.bookings ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load earnings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const totalEarned = bookings.filter((b) => b.status === "confirmed").reduce((sum, b) => sum + b.value, 0);
  const thisMonth = revenueData.length > 0 ? revenueData[revenueData.length - 1]?.revenue ?? 0 : 0;
  const pending = payoutHistory.filter((p) => p.status === "pending").reduce((sum, p) => sum + p.amount, 0);
  const confirmedBookings = bookings.filter((b) => b.status === "confirmed");
  const avgBookingValue = confirmedBookings.length > 0
    ? Math.round(confirmedBookings.reduce((sum, b) => sum + b.value, 0) / confirmedBookings.length)
    : 0;

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
        <button onClick={fetchEarnings} className="text-sm font-sans text-[#8b501a] hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-serif italic text-foreground">Earnings</h1>
        <button className="flex items-center gap-2 border border-border px-3.5 py-2 rounded-xl text-sm font-sans font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all">
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Earned (All Time)", value: `$${totalEarned.toLocaleString()}` },
          { label: "This Month", value: `$${thisMonth.toLocaleString()}`, highlight: true },
          { label: "Pending Payouts", value: `$${pending.toLocaleString()}`, amber: true },
          { label: "Average Booking Value", value: `$${avgBookingValue.toLocaleString()}` },
        ].map(({ label, value, highlight, amber }) => (
          <div key={label} className={cn("bg-card border rounded-xl p-5 shadow-sm", highlight && "border-[#1d9e75]/20", amber && "border-[#8b501a]/20")}>
            <div className="text-xs text-muted-foreground font-sans uppercase tracking-wider mb-2">{label}</div>
            <div className={cn("text-2xl font-serif font-bold", highlight ? "text-[#1d9e75]" : amber ? "text-[#8b501a]" : "text-foreground")}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue chart */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-5">
        <h3 className="font-sans font-semibold text-sm text-foreground mb-4">Monthly Revenue</h3>
        {revenueData.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={revenueData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e2e1" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fontFamily: "Manrope, sans-serif", fill: "#4e6451" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fontFamily: "Manrope, sans-serif", fill: "#4e6451" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="revenue" fill="#8b501a" radius={[5, 5, 0, 0]} maxBarSize={50} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[240px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground font-sans">No revenue data yet</p>
          </div>
        )}
      </div>

      {/* Payout history */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-sans font-semibold text-sm text-foreground">Payout History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payoutHistory.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-sm text-muted-foreground">No payouts yet</td>
                </tr>
              ) : (
                payoutHistory.map((p) => (
                  <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-foreground">{p.date}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <span className="font-serif font-bold text-foreground">${p.amount.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={cn("text-[10px] font-sans font-bold px-2.5 py-1 rounded-full uppercase tracking-wide", payoutStatusStyles[p.status] ?? payoutStatusStyles.processing)}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-muted-foreground text-xs">{p.method}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking revenue breakdown */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden pb-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-sans font-semibold text-sm text-foreground">Booking Revenue Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="border-b border-border bg-secondary/40">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ref</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Guest</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Dates</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Gross</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Platform Fee</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {confirmedBookings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-muted-foreground">No confirmed bookings yet</td>
                </tr>
              ) : (
                confirmedBookings.map((b) => {
                  const fee = Math.round(b.value * 0.12);
                  const net = b.value - fee;
                  return (
                    <tr key={b.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs text-muted-foreground">{b.id}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-foreground font-semibold">{b.guest}</span>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell text-muted-foreground text-xs">
                        {b.checkIn} · {b.nights}n
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <span className="font-serif font-bold text-foreground">${b.value.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right hidden lg:table-cell">
                        <span className="text-[#ba1a1a] text-sm">-${fee.toLocaleString()}</span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="font-serif font-bold text-[#1d9e75]">${net.toLocaleString()}</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
