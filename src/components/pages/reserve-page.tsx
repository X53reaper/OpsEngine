"use client";

import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  ArrowRight,
  MessageCircle,
  Calendar,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";

interface ReservePageProps {
  onNavigate: (page: string) => void;
}

function StatCard({
  label,
  value,
  link,
  linkLabel,
  highlight,
  trend,
  trendValue,
  onNavigate,
  page,
}: {
  label: string;
  value: string | number;
  link?: string;
  linkLabel?: string;
  highlight?: boolean;
  trend?: "up" | "down";
  trendValue?: string;
  onNavigate?: (page: string) => void;
  page?: string;
}) {
  return (
    <div className={cn("bg-card rounded-xl border p-5 shadow-sm", highlight && "border-[#8b501a]/30")}>
      <div className="text-xs text-muted-foreground font-sans uppercase tracking-wider mb-2">{label}</div>
      <div className={cn("text-3xl font-serif font-bold", highlight ? "text-[#8b501a]" : "text-foreground")}>{value}</div>
      {trend && trendValue && (
        <div className={cn("flex items-center gap-1 mt-1 text-xs font-sans", trend === "up" ? "text-[#1d9e75]" : "text-[#ba1a1a]")}>
          {trend === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trendValue}
        </div>
      )}
      {link && onNavigate && page && (
        <button
          onClick={() => onNavigate(page)}
          className="mt-3 text-xs font-sans text-[#8b501a] hover:underline flex items-center gap-1 font-medium"
        >
          {linkLabel} <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2.5">
        <p className="text-xs font-sans font-semibold text-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <p key={p.name} className="text-xs font-sans" style={{ color: p.color }}>
            {p.name === "revenue" ? `$${p.value.toLocaleString()}` : `${p.value} enquiries`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export function ReservePage({ onNavigate }: ReservePageProps) {
  const today = format(new Date(), "EEEE, d MMMM yyyy");
  const revenueChange = (((stats.thisMonthRevenue - stats.lastMonthRevenue) / stats.lastMonthRevenue) * 100).toFixed(1);

  const getHour = new Date().getHours();
  const greeting = getHour < 12 ? "Good morning" : getHour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-serif italic text-foreground">Your Reserve</h1>
          <p className="text-muted-foreground font-sans text-sm mt-0.5">{operator.businessName}</p>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm text-muted-foreground font-sans">{today}</p>
        </div>
      </div>

      {/* Greeting banner */}
      <div className="relative rounded-2xl overflow-hidden h-44">
        <img
          src="/images/zimbabwe-landscape.jpg"
          alt="Zimbabwe landscape"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#172c1c]/85 via-[#172c1c]/60 to-transparent" />
        <div className="relative z-10 p-6 h-full flex flex-col justify-end">
          <h2 className="text-2xl font-serif italic text-white">
            {greeting}, {operator.name.split(" ")[0]}
          </h2>
          <p className="text-white/80 text-sm font-sans mt-1">
            {stats.activeListings} active listings &nbsp;·&nbsp;{" "}
            <span className="text-[#f0b060] font-semibold">{stats.newEnquiries} new enquiries today</span>
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Listings"
          value={stats.activeListings}
          linkLabel="Manage Listings"
          page="listings"
          onNavigate={onNavigate}
        />
        <StatCard
          label="New Enquiries"
          value={stats.newEnquiries}
          highlight={stats.newEnquiries > 0}
          linkLabel="View Enquiries"
          page="enquiries"
          onNavigate={onNavigate}
        />
        <StatCard
          label="Upcoming Bookings"
          value={stats.upcomingBookings}
          linkLabel="View Calendar"
          page="bookings"
          onNavigate={onNavigate}
        />
        <StatCard
          label="This Month Revenue"
          value={`$${stats.thisMonthRevenue.toLocaleString()}`}
          trend={parseFloat(revenueChange) >= 0 ? "up" : "down"}
          trendValue={`${Math.abs(parseFloat(revenueChange))}% vs last month`}
          onNavigate={onNavigate}
          page="earnings"
        />
      </div>

      {/* Enquiries + Bookings row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Enquiries */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <MessageCircle size={15} className="text-[#8b501a]" />
              <h3 className="font-sans font-semibold text-sm text-foreground">Recent Enquiries</h3>
            </div>
            <button
              onClick={() => onNavigate("enquiries")}
              className="text-xs text-[#8b501a] hover:underline font-sans font-medium flex items-center gap-1"
            >
              View All <ArrowRight size={11} />
            </button>
          </div>
          <ul className="divide-y divide-border">
            {recentEnquiries.map((enq) => (
              <li key={enq.id} className="px-5 py-3.5 hover:bg-secondary/50 cursor-pointer transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-sans font-semibold text-foreground">{enq.traveller}</span>
                      <span className="text-xs">{enq.flag}</span>
                    </div>
                    <div className="text-xs text-[#8b501a] font-sans mb-1">{enq.listing}</div>
                    <p className="text-xs text-muted-foreground font-sans line-clamp-1 leading-relaxed">{enq.preview}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        enq.status === "new" ? "bg-[#8b501a]" : "bg-[#1d9e75]"
                      )}
                    />
                    <span className="text-[10px] text-muted-foreground font-sans whitespace-nowrap">{enq.time}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Upcoming Bookings */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-[#8b501a]" />
              <h3 className="font-sans font-semibold text-sm text-foreground">Upcoming Bookings</h3>
            </div>
            <button
              onClick={() => onNavigate("bookings")}
              className="text-xs text-[#8b501a] hover:underline font-sans font-medium flex items-center gap-1"
            >
              View Calendar <ArrowRight size={11} />
            </button>
          </div>
          <ul className="divide-y divide-border">
            {upcomingBookings.map((bk) => (
              <li key={bk.id} className="px-5 py-3.5 hover:bg-secondary/50 cursor-pointer transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm font-sans font-semibold text-foreground">{bk.guest}</span>
                      <span className="text-xs">{bk.flag}</span>
                    </div>
                    <div className="text-xs text-muted-foreground font-sans">{bk.listing}</div>
                    <div className="text-xs text-muted-foreground font-sans mt-0.5">
                      {format(new Date(bk.checkIn), "d MMM yyyy")} · {bk.nights} nights
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={cn(
                        "text-[10px] font-sans font-bold px-2 py-0.5 rounded-full uppercase tracking-wide",
                        bk.status === "confirmed"
                          ? "bg-[#1d9e75]/10 text-[#1d9e75]"
                          : "bg-[#8b501a]/10 text-[#8b501a]"
                      )}
                    >
                      {bk.status}
                    </span>
                    <span className="text-sm font-serif font-bold text-foreground">${bk.value.toLocaleString()}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-5">
        <h3 className="font-sans font-semibold text-sm text-foreground mb-4">Revenue & Enquiries — Last 6 Months</h3>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={revenueData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e4e2e1" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fontFamily: "Manrope, sans-serif", fill: "#4e6451" }} axisLine={false} tickLine={false} />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fontFamily: "Manrope, sans-serif", fill: "#4e6451" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fontFamily: "Manrope, sans-serif", fill: "#4e6451" }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: 11, fontFamily: "Manrope, sans-serif", paddingTop: "12px" }}
              formatter={(value) => (value === "revenue" ? "Revenue" : "Enquiries")}
            />
            <Bar yAxisId="left" dataKey="revenue" fill="#8b501a" radius={[4, 4, 0, 0]} maxBarSize={40} />
            <Line yAxisId="right" type="monotone" dataKey="enquiries" stroke="#1d9e75" strokeWidth={2} dot={{ fill: "#1d9e75", r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Reviews + Listing performance */}
      <div className="grid lg:grid-cols-2 gap-6 pb-8">
        {/* Recent Reviews */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="font-sans font-semibold text-sm text-foreground">Recent Reviews</h3>
            <button
              onClick={() => onNavigate("reviews")}
              className="text-xs text-[#8b501a] hover:underline font-sans font-medium flex items-center gap-1"
            >
              All Reviews <ArrowRight size={11} />
            </button>
          </div>
          <ul className="divide-y divide-border">
            {recentReviews.map((rev) => (
              <li key={rev.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <svg key={i} width="11" height="11" viewBox="0 0 12 12" fill={i < rev.rating ? "#8b501a" : "#e4e2e1"}>
                            <path d="M6 1l1.39 2.82L10.5 4.27l-2.25 2.19.53 3.09L6 8.02 3.22 9.55l.53-3.09L1.5 4.27l3.11-.45L6 1z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground font-sans">{rev.listing}</span>
                    </div>
                    <p className="text-xs text-foreground font-sans leading-relaxed line-clamp-2">{rev.excerpt}</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-xs font-sans font-semibold text-foreground">{rev.reviewer}</span>
                      <span className="text-xs">{rev.flag}</span>
                      <span className="text-xs text-muted-foreground font-sans">· {rev.date}</span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Listing Performance */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="font-sans font-semibold text-sm text-foreground">Listing Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-sans">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-muted-foreground font-semibold uppercase tracking-wider">Listing</th>
                  <th className="text-right px-3 py-3 text-muted-foreground font-semibold uppercase tracking-wider">Views</th>
                  <th className="text-right px-3 py-3 text-muted-foreground font-semibold uppercase tracking-wider">Enq.</th>
                  <th className="text-right px-5 py-3 text-muted-foreground font-semibold uppercase tracking-wider">Bkgs.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listings.filter(l => l.status === "active").map((lst) => (
                  <tr key={lst.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-semibold text-foreground truncate max-w-[140px]">{lst.title}</div>
                      <div className="text-muted-foreground text-[10px]">${lst.pricePerNight}/night</div>
                    </td>
                    <td className="text-right px-3 py-3.5 text-foreground">{lst.views}</td>
                    <td className="text-right px-3 py-3.5 text-foreground">{lst.enquiries}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <span className="text-foreground">{lst.bookings}</span>
                        <TrendingUp size={11} className="text-[#1d9e75]" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
