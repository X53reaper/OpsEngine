"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, X, Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type MediaStatus = "approved" | "pending" | "rejected";

const mediaStatusStyles: Record<MediaStatus, string> = {
  approved: "bg-[#1d9e75]/10 text-[#1d9e75]",
  pending: "bg-[#8b501a]/10 text-[#8b501a]",
  rejected: "bg-[#ba1a1a]/10 text-[#ba1a1a]",
};

const initialMedia = [
  { id: "m1", url: "/images/lodge-1.jpg", listing: "Hwange Bush Camp", status: "approved" as MediaStatus, isHero: true },
  { id: "m2", url: "/images/lodge-2.jpg", listing: "Victoria Falls View Lodge", status: "approved" as MediaStatus, isHero: true },
  { id: "m3", url: "/images/lodge-3.jpg", listing: "Mana Pools Tented Camp", status: "pending" as MediaStatus, isHero: false },
  { id: "m4", url: "/images/lodge-1.jpg", listing: "Hwange Bush Camp", status: "approved" as MediaStatus, isHero: false },
  { id: "m5", url: "/images/lodge-2.jpg", listing: "Victoria Falls View Lodge", status: "approved" as MediaStatus, isHero: false },
  { id: "m6", url: "/images/lodge-3.jpg", listing: "Hwange Bush Camp", status: "rejected" as MediaStatus, isHero: false },
  { id: "m7", url: "/images/lodge-1.jpg", listing: "Matobo Hills Retreat", status: "pending" as MediaStatus, isHero: false },
  { id: "m8", url: "/images/lodge-2.jpg", listing: "Mana Pools Tented Camp", status: "approved" as MediaStatus, isHero: false },
];

type Filter = "all" | "approved" | "pending" | "rejected";

export function MediaPage() {
  const [filter, setFilter] = useState<Filter>("all");
  const [media, setMedia] = useState(initialMedia);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedListing, setSelectedListing] = useState(listings[0].title);

  const onDrop = useCallback(
    (files: File[]) => {
      const newMedia = files.map((f) => ({
        id: Math.random().toString(36).slice(2),
        url: URL.createObjectURL(f),
        listing: selectedListing,
        status: "pending" as MediaStatus,
        isHero: false,
      }));
      setMedia((p) => [...p, ...newMedia]);
      setShowUpload(false);
    },
    [selectedListing]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxSize: 10 * 1024 * 1024,
  });

  const filters: Array<{ label: string; value: Filter }> = [
    { label: "All", value: "all" },
    { label: "Approved", value: "approved" },
    { label: "Pending", value: "pending" },
    { label: "Rejected", value: "rejected" },
  ];

  const filtered = filter === "all" ? media : media.filter((m) => m.status === filter);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Upload modal */}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-serif font-bold text-foreground">Upload Photos</h3>
              <button onClick={() => setShowUpload(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="block text-xs font-sans font-semibold text-foreground mb-1.5 uppercase tracking-wider">Attach to Listing</label>
              <select
                value={selectedListing}
                onChange={(e) => setSelectedListing(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30"
              >
                {listings.map((l) => (
                  <option key={l.id}>{l.title}</option>
                ))}
              </select>
            </div>
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                isDragActive ? "border-[#8b501a] bg-[#8b501a]/5" : "border-border hover:border-[#8b501a]/50"
              )}
            >
              <input {...getInputProps()} />
              <Upload size={28} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-sans font-semibold text-foreground">Drop photos here or click to browse</p>
              <p className="text-xs text-muted-foreground font-sans mt-1">JPG, PNG, WEBP — max 10MB each</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-3xl font-serif italic text-foreground">Media Library</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 bg-[#8b501a] text-white px-4 py-2.5 rounded-xl text-sm font-sans font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          <Upload size={15} /> Upload Photos
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-sans font-semibold transition-all",
              filter === f.value
                ? "bg-[#172c1c] text-white"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            )}
          >
            {f.label}
            <span className={cn("ml-1.5 text-[10px]", filter === f.value ? "text-white/60" : "text-muted-foreground")}>
              {f.value === "all" ? media.length : media.filter((m) => m.status === f.value).length}
            </span>
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-8">
        {filtered.map((item) => (
          <div key={item.id} className="relative group rounded-xl overflow-hidden aspect-square border border-border shadow-sm">
            <img src={item.url} alt={item.listing} className="w-full h-full object-cover" />

            {/* Hero badge */}
            {item.isHero && (
              <div className="absolute top-2 left-2 flex items-center gap-1 bg-[#8b501a]/90 backdrop-blur-sm text-white text-[9px] font-sans font-bold px-1.5 py-0.5 rounded-full">
                <Star size={8} fill="white" /> Hero
              </div>
            )}

            {/* Status badge */}
            <div className={cn("absolute top-2 right-2 text-[9px] font-sans font-bold px-1.5 py-0.5 rounded-full uppercase", mediaStatusStyles[item.status])}>
              {item.status}
            </div>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
              <button className="bg-white/90 text-foreground p-2 rounded-lg hover:bg-white transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                </svg>
              </button>
              <button
                onClick={() => setMedia((p) => p.filter((m) => m.id !== item.id))}
                className="bg-[#ba1a1a]/90 text-white p-2 rounded-lg hover:bg-[#ba1a1a] transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Listing name */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
              <p className="text-white text-[9px] font-sans truncate">{item.listing}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
