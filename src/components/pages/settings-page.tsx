"use client";

import { Bell, Lock, Globe, CreditCard, AlertTriangle } from "lucide-react";

function Toggle({ label, description, defaultChecked = false }: { label: string; description?: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
      <div>
        <div className="text-sm font-sans font-semibold text-foreground">{label}</div>
        {description && <div className="text-xs text-muted-foreground font-sans mt-0.5">{description}</div>}
      </div>
      <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 mt-0.5">
        <input type="checkbox" defaultChecked={defaultChecked} className="sr-only peer" />
        <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#172c1c]" />
      </label>
    </div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-border">
        <Icon size={15} className="text-[#8b501a]" />
        <h3 className="font-sans font-semibold text-sm text-foreground uppercase tracking-wider">{title}</h3>
      </div>
      <div className="px-6">{children}</div>
    </div>
  );
}

export function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6 pb-12">
      <h1 className="text-3xl font-serif italic text-foreground">Settings</h1>

      <Section title="Notifications" icon={Bell}>
        <Toggle label="New Enquiries" description="Get notified when a traveller sends a new enquiry" defaultChecked />
        <Toggle label="Booking Confirmations" description="Receive updates when a booking is confirmed" defaultChecked />
        <Toggle label="Reviews Received" description="Get notified when a guest leaves a review" defaultChecked />
        <Toggle label="Listing Status Changes" description="Notifications when your listings are approved or rejected" defaultChecked />
        <Toggle label="Weekly Performance Summary" description="A weekly email digest of your listing performance" />
        <Toggle label="Marketing & Promotions" description="News about Safari Zetu features and promotions" />
      </Section>

      <Section title="Security" icon={Lock}>
        <div className="py-4 space-y-3">
          <div>
            <label className="block text-xs font-sans font-semibold text-foreground mb-1.5 uppercase tracking-wider">Current Password</label>
            <input type="password" className="w-full border border-border rounded-xl px-4 py-2.5 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30" placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-xs font-sans font-semibold text-foreground mb-1.5 uppercase tracking-wider">New Password</label>
            <input type="password" className="w-full border border-border rounded-xl px-4 py-2.5 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30" placeholder="••••••••" />
          </div>
          <button className="bg-[#172c1c] text-white px-4 py-2 rounded-xl text-sm font-sans font-semibold hover:opacity-90 transition-opacity">
            Update Password
          </button>
        </div>
        <Toggle label="Two-Factor Authentication" description="Add an extra layer of security to your account" />
        <Toggle label="Login Notifications" description="Get notified of new sign-ins to your account" defaultChecked />
      </Section>

      <Section title="Language & Region" icon={Globe}>
        <div className="py-4 grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-sans font-semibold text-foreground mb-1.5 uppercase tracking-wider">Language</label>
            <select className="w-full border border-border rounded-xl px-4 py-2.5 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30">
              <option>English (UK)</option>
              <option>English (US)</option>
              <option>Shona</option>
              <option>Ndebele</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-sans font-semibold text-foreground mb-1.5 uppercase tracking-wider">Currency Display</label>
            <select className="w-full border border-border rounded-xl px-4 py-2.5 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30">
              <option>USD ($)</option>
              <option>ZWL (Z$)</option>
              <option>GBP (£)</option>
              <option>EUR (€)</option>
            </select>
          </div>
        </div>
      </Section>

      <Section title="Billing" icon={CreditCard}>
        <div className="py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-sans font-semibold text-foreground">Current Plan</div>
              <div className="text-xs text-muted-foreground font-sans">Professional Operator · 12% platform commission</div>
            </div>
            <span className="bg-[#1d9e75]/10 text-[#1d9e75] text-xs font-sans font-bold px-2.5 py-1 rounded-full">Active</span>
          </div>
        </div>
      </Section>

      <Section title="Danger Zone" icon={AlertTriangle}>
        <div className="py-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-sm font-sans font-semibold text-foreground">Pause All Listings</div>
              <div className="text-xs text-muted-foreground font-sans mt-0.5">Temporarily hide all your listings from the marketplace</div>
            </div>
            <button className="flex-shrink-0 border border-[#8b501a] text-[#8b501a] text-xs font-sans font-semibold px-3.5 py-1.5 rounded-lg hover:bg-[#8b501a]/5 transition-colors">
              Pause All
            </button>
          </div>
          <div className="flex items-start justify-between gap-4 pt-2 border-t border-border">
            <div>
              <div className="text-sm font-sans font-semibold text-[#ba1a1a]">Close Account</div>
              <div className="text-xs text-muted-foreground font-sans mt-0.5">Permanently delete your operator account and all data</div>
            </div>
            <button className="flex-shrink-0 border border-[#ba1a1a] text-[#ba1a1a] text-xs font-sans font-semibold px-3.5 py-1.5 rounded-lg hover:bg-[#ba1a1a]/5 transition-colors">
              Close Account
            </button>
          </div>
        </div>
      </Section>
    </div>
  );
}
