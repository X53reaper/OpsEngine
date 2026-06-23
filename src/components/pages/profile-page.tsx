"use client";

import { useState, useEffect, useCallback } from "react";
import { BadgeCheck, Shield, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface OperatorProfile {
  name: string;
  businessName: string;
  email: string;
  phone: string;
  province: string;
  memberSince: string;
  ztaNumber: string;
  ztaStatus: string;
  accountStatus: string;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="font-sans font-semibold text-sm text-foreground uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function FormField({
  label,
  value,
  readOnly,
  type = "text",
  placeholder,
}: {
  label: string;
  value?: string;
  readOnly?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-sans font-semibold text-foreground mb-1.5 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          type={type}
          defaultValue={value}
          readOnly={readOnly}
          placeholder={placeholder}
          className={cn(
            "w-full border border-border rounded-xl px-4 py-2.5 text-sm font-sans bg-background focus:outline-none transition-all",
            readOnly
              ? "bg-secondary text-muted-foreground cursor-not-allowed"
              : "focus:ring-2 focus:ring-[#8b501a]/30 focus:border-[#8b501a] text-foreground"
          )}
        />
      </div>
    </div>
  );
}

export function ProfilePage() {
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/operator/profile");
      if (!res.ok) throw new Error("Failed to load profile");
      const data = await res.json();
      setProfile(data.profile ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (loading) {
    return (
      <div className="p-6 max-w-3xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-3xl mx-auto text-center py-20">
        <p className="text-sm text-muted-foreground font-sans mb-3">{error}</p>
        <button onClick={fetchProfile} className="text-sm font-sans text-[#8b501a] hover:underline">Retry</button>
      </div>
    );
  }

  const p = profile ?? { name: "Operator", businessName: "Safari Zetu", email: "", phone: "", province: "", memberSince: "", ztaNumber: "", ztaStatus: "Pending", accountStatus: "Active" };
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <h1 className="text-3xl font-serif italic text-foreground">Residency Profile</h1>

      {/* Account Status Banner */}
      <div className="bg-[#1d9e75]/8 border border-[#1d9e75]/20 rounded-2xl p-4 flex items-start gap-3">
        <BadgeCheck size={20} className="text-[#1d9e75] flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-sans font-semibold text-sm text-foreground">Verified Operator</div>
          <div className="text-xs text-muted-foreground font-sans mt-0.5">
            Your residency is active. Member since {p.memberSince}. ZTA License #{p.ztaNumber} — verified.
          </div>
        </div>
        <div className="ml-auto flex-shrink-0">
          <span className="bg-[#1d9e75]/10 text-[#1d9e75] text-[10px] font-sans font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
            Active
          </span>
        </div>
      </div>

      {/* Business Information */}
      <Section title="Business Information">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FormField label="Business Name" value={p.businessName} readOnly />
            <p className="text-[10px] text-muted-foreground font-sans mt-1">Business name cannot be changed after verification. Contact support to request a change.</p>
          </div>
          <FormField label="Email Address" value={p.email} type="email" />
          <FormField label="Phone Number" value={p.phone} />
          <FormField label="Province / Location" value={p.province} />
          <FormField label="ZTA License Number" value={p.ztaNumber} readOnly />
          <div className="sm:col-span-2">
            <label className="block text-xs font-sans font-semibold text-foreground mb-1.5 uppercase tracking-wider">Business Description</label>
            <textarea
              rows={4}
              defaultValue="Hwange Wild Escapes offers premium safari experiences in Zimbabwe's most iconic wilderness areas. With over 10 years of guiding experience, we specialise in intimate, high-impact wildlife encounters that leave our guests transformed."
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30 focus:border-[#8b501a] resize-none leading-relaxed"
            />
          </div>
        </div>
      </Section>

      {/* Profile Media */}
      <Section title="Profile Media">
        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <div className="text-xs font-sans font-semibold text-foreground uppercase tracking-wider mb-3">Business Logo</div>
            <div className="border-2 border-dashed border-border rounded-xl h-32 flex flex-col items-center justify-center gap-2 hover:border-[#8b501a]/50 transition-colors cursor-pointer group">
              <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center group-hover:bg-[#8b501a] transition-colors">
                <span className="text-primary-foreground font-bold font-sans text-lg">{p.name?.charAt(0) ?? "O"}</span>
              </div>
              <span className="text-xs text-muted-foreground font-sans">Click to upload logo</span>
            </div>
          </div>
          <div>
            <div className="text-xs font-sans font-semibold text-foreground uppercase tracking-wider mb-3">Cover Photo</div>
            <div className="border-2 border-dashed border-border rounded-xl h-32 overflow-hidden relative group cursor-pointer">
              <img src="/images/zimbabwe-landscape.jpg" alt="cover" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="text-white text-xs font-sans font-semibold">Change Cover</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* Contact Details */}
      <Section title="Contact Details">
        <div className="grid sm:grid-cols-2 gap-4">
          <FormField label="Website URL" value="https://hwangewild.co.zw" type="url" />
          <FormField label="WhatsApp Number" value="+263 77 234 5678" />
          <div className="sm:col-span-2">
            <FormField label="Physical Address" value="Plot 14, Hwange Safari Area, Matabeleland North, Zimbabwe" />
          </div>
        </div>
      </Section>

      {/* Payout Information */}
      <Section title="Payout Information">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <div className="text-xs font-sans font-semibold text-foreground uppercase tracking-wider mb-1.5">Bank Account</div>
            <div className="border border-border rounded-xl px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm font-mono text-foreground">**** **** **** 4821</span>
              <Shield size={14} className="text-muted-foreground" />
            </div>
          </div>
          <div>
            <div className="text-xs font-sans font-semibold text-foreground uppercase tracking-wider mb-1.5">Payout Method</div>
            <select className="w-full border border-border rounded-xl px-4 py-2.5 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30">
              <option>Bank Transfer</option>
              <option>EcoCash</option>
              <option>OneMoney</option>
            </select>
          </div>
        </div>
        <button className="mt-4 text-xs font-sans font-semibold text-[#8b501a] hover:underline flex items-center gap-1.5">
          <Shield size={12} /> Edit Payout Details
        </button>
      </Section>

      {/* Account Status */}
      <Section title="Account Status">
        <div className="space-y-4">
          {[
            { label: "Residency Status", value: p.accountStatus, badge: "bg-[#1d9e75]/10 text-[#1d9e75]", icon: <BadgeCheck size={14} className="text-[#1d9e75]" /> },
            { label: "ZTA Verification", value: p.ztaStatus, badge: "bg-[#1d9e75]/10 text-[#1d9e75]", icon: <BadgeCheck size={14} className="text-[#1d9e75]" /> },
            { label: "Member Since", value: p.memberSince, badge: "bg-secondary text-muted-foreground", icon: null },
          ].map(({ label, value, badge, icon }) => (
            <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <span className="text-sm font-sans text-muted-foreground">{label}</span>
              <div className="flex items-center gap-2">
                {icon}
                <span className={cn("text-xs font-sans font-bold px-2.5 py-1 rounded-full", badge)}>{value}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Save */}
      <div className="flex justify-end gap-3">
        <button className="px-5 py-2.5 text-sm font-sans font-semibold text-muted-foreground hover:text-foreground transition-colors">
          Discard Changes
        </button>
        <button className="px-6 py-2.5 bg-[#172c1c] text-white rounded-xl text-sm font-sans font-semibold hover:opacity-90 transition-opacity shadow-sm">
          Save Profile
        </button>
      </div>
    </div>
  );
}
