"use client";

import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import {
  Plus,
  BadgeCheck,
  Eye,
  Edit,
  Trash2,
  BarChart2,
  Pause,
  X,
  Upload,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  TrendingUp,
  TrendingDown,
  Loader2,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

interface Listing {
  id: string;
  title: string;
  location?: string;
  category?: string;
  pricePerNight?: number;
  status: string;
  isVerified?: boolean;
  imageUrl?: string;
  views?: number;
  enquiries?: number;
  bookings?: number;
}

type ListingStatus = "active" | "pending" | "draft" | "paused";

const statusColors: Record<string, string> = {
  active: "bg-[#1d9e75]/10 text-[#1d9e75]",
  pending: "bg-[#8b501a]/10 text-[#8b501a]",
  draft: "bg-border/60 text-muted-foreground",
  paused: "bg-[#ba1a1a]/10 text-[#ba1a1a]",
};

// Multi-step form
const STEPS = [
  "Basic Details",
  "Itinerary",
  "Inclusions",
  "Media",
  "Availability",
  "Review & Submit",
];

// Sortable image component
function SortableImage({
  id,
  url,
  isCover,
  onRemove,
}: {
  id: string;
  url: string;
  isCover: boolean;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group aspect-square rounded-lg overflow-hidden border border-border">
      <img src={url} alt="upload" className="w-full h-full object-cover" />
      {isCover && (
        <div className="absolute top-1.5 left-1.5 bg-[#8b501a] text-white text-[10px] font-sans font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
          <svg width="9" height="9" viewBox="0 0 12 12" fill="white">
            <path d="M6 1l1.39 2.82L10.5 4.27l-2.25 2.19.53 3.09L6 8.02 3.22 9.55l.53-3.09L1.5 4.27l3.11-.45L6 1z" />
          </svg>
          Cover
        </div>
      )}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1.5 right-8 opacity-0 group-hover:opacity-100 cursor-grab bg-black/50 rounded p-0.5 transition-opacity"
      >
        <GripVertical size={12} className="text-white" />
      </div>
      <button
        onClick={() => onRemove(id)}
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 bg-black/50 rounded p-0.5 transition-opacity hover:bg-[#ba1a1a]"
      >
        <X size={12} className="text-white" />
      </button>
    </div>
  );
}

function CreateListingModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [uploadedImages, setUploadedImages] = useState<{ id: string; url: string }[]>([]);
  const [inclusions, setInclusions] = useState<string[]>(["Meals", "Game Drives", "Transfers"]);
  const [exclusions, setExclusions] = useState<string[]>(["Flights", "Visas"]);
  const [newIncl, setNewIncl] = useState("");
  const [newExcl, setNewExcl] = useState("");
  const [itinerary, setItinerary] = useState([
    { title: "Arrival & Welcome", description: "Arrive at camp and enjoy a welcome dinner under the stars.", activities: ["Airport transfer", "Welcome dinner"] },
  ]);

  const sensors = useSensors(useSensor(PointerSensor));

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newImages = acceptedFiles.map((f) => ({
        id: Math.random().toString(36).slice(2),
        url: URL.createObjectURL(f),
      }));
      setUploadedImages((prev) => [...prev, ...newImages]);
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [], "image/webp": [] },
    maxSize: 10 * 1024 * 1024,
  });

  const handleDragEnd = (event: { active: { id: string }; over?: { id: string } }) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setUploadedImages((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over!.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const addTag = (type: "incl" | "excl", val: string) => {
    if (!val.trim()) return;
    if (type === "incl") {
      setInclusions((p) => [...p, val.trim()]);
      setNewIncl("");
    } else {
      setExclusions((p) => [...p, val.trim()]);
      setNewExcl("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8">
      <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <h2 className="text-xl font-serif italic text-foreground">Create New Listing</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-1 mb-3">
            {STEPS.map((s, i) => (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "w-5 h-5 rounded-full text-[10px] font-bold font-sans flex items-center justify-center",
                    i < step ? "bg-[#1d9e75] text-white" : i === step ? "bg-[#8b501a] text-white" : "bg-border text-muted-foreground"
                  )}
                >
                  {i < step ? "✓" : i + 1}
                </div>
              </div>
            ))}
          </div>
          <div className="h-1 bg-secondary rounded-full">
            <div
              className="h-1 bg-[#8b501a] rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            {STEPS.map((s, i) => (
              <span key={s} className={cn("text-[9px] font-sans hidden sm:block", i === step ? "text-[#8b501a] font-semibold" : "text-muted-foreground")}>
                {s}
              </span>
            ))}
          </div>
          <p className="text-sm font-sans font-semibold text-foreground mt-2 sm:hidden">Step {step + 1}: {STEPS[step]}</p>
        </div>

        {/* Step content */}
        <div className="px-6 py-6 space-y-4 min-h-64">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-sans font-semibold text-foreground mb-1.5 uppercase tracking-wider">Listing Title</label>
                <input className="w-full border border-border rounded-lg px-3 py-2.5 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30 focus:border-[#8b501a]" placeholder="e.g. Hwange Luxury Bush Camp" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-sans font-semibold text-foreground mb-1.5 uppercase tracking-wider">Category</label>
                  <select className="w-full border border-border rounded-lg px-3 py-2.5 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30">
                    <option>Lodge</option>
                    <option>Camp</option>
                    <option>Safari</option>
                    <option>Activity</option>
                    <option>Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-sans font-semibold text-foreground mb-1.5 uppercase tracking-wider">Price Per Night (USD)</label>
                  <input type="number" className="w-full border border-border rounded-lg px-3 py-2.5 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30" placeholder="650" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-sans font-semibold text-foreground mb-1.5 uppercase tracking-wider">Destination</label>
                  <select className="w-full border border-border rounded-lg px-3 py-2.5 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30">
                    <option>Hwange National Park</option>
                    <option>Victoria Falls</option>
                    <option>Mana Pools</option>
                    <option>Matobo Hills</option>
                    <option>Great Zimbabwe</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-sans font-semibold text-foreground mb-1.5 uppercase tracking-wider">Province</label>
                  <select className="w-full border border-border rounded-lg px-3 py-2.5 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30">
                    <option>Matabeleland North</option>
                    <option>Matabeleland South</option>
                    <option>Mashonaland West</option>
                    <option>Mashonaland East</option>
                    <option>Masvingo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-sans font-semibold text-foreground mb-1.5 uppercase tracking-wider">Short Description (150 chars)</label>
                <textarea rows={2} maxLength={150} className="w-full border border-border rounded-lg px-3 py-2.5 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30 resize-none" placeholder="A brief, compelling description of your property..." />
              </div>
              <div>
                <label className="block text-xs font-sans font-semibold text-foreground mb-1.5 uppercase tracking-wider">Full Description</label>
                <textarea rows={4} className="w-full border border-border rounded-lg px-3 py-2.5 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30 resize-none" placeholder="Describe your property in detail..." />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground font-sans">Build your day-by-day itinerary. Drag to reorder days.</p>
              {itinerary.map((day, idx) => (
                <div key={idx} className="border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <GripVertical size={14} className="text-muted-foreground cursor-grab" />
                    <span className="text-xs font-sans font-bold text-[#8b501a] uppercase tracking-wider">Day {idx + 1}</span>
                    {itinerary.length > 1 && (
                      <button onClick={() => setItinerary((prev) => prev.filter((_, i) => i !== idx))} className="ml-auto text-muted-foreground hover:text-[#ba1a1a]">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <input defaultValue={day.title} className="w-full border border-border rounded-lg px-3 py-2 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30" placeholder="Day title" />
                  <textarea defaultValue={day.description} rows={2} className="w-full border border-border rounded-lg px-3 py-2 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30 resize-none" placeholder="Day description" />
                </div>
              ))}
              <button
                onClick={() => setItinerary((prev) => [...prev, { title: "", description: "", activities: [] }])}
                className="w-full border-2 border-dashed border-border rounded-xl py-3 text-sm font-sans text-muted-foreground hover:border-[#8b501a] hover:text-[#8b501a] transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={16} /> Add Day
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-sans font-bold text-foreground mb-3 uppercase tracking-wider">Inclusions</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {inclusions.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 bg-[#1d9e75]/10 text-[#1d9e75] text-xs font-sans font-medium px-2.5 py-1 rounded-full">
                      {tag}
                      <button onClick={() => setInclusions((p) => p.filter((t) => t !== tag))}>
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newIncl} onChange={(e) => setNewIncl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag("incl", newIncl)} className="flex-1 border border-border rounded-lg px-3 py-2 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30" placeholder="e.g. All meals" />
                  <button onClick={() => addTag("incl", newIncl)} className="bg-[#1d9e75] text-white px-3 py-2 rounded-lg text-sm font-sans hover:opacity-90">Add</button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-sans font-bold text-foreground mb-3 uppercase tracking-wider">Exclusions</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {exclusions.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 bg-[#ba1a1a]/10 text-[#ba1a1a] text-xs font-sans font-medium px-2.5 py-1 rounded-full">
                      {tag}
                      <button onClick={() => setExclusions((p) => p.filter((t) => t !== tag))}>
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input value={newExcl} onChange={(e) => setNewExcl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag("excl", newExcl)} className="flex-1 border border-border rounded-lg px-3 py-2 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30" placeholder="e.g. International flights" />
                  <button onClick={() => addTag("excl", newExcl)} className="bg-[#ba1a1a] text-white px-3 py-2 rounded-lg text-sm font-sans hover:opacity-90">Add</button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
                  isDragActive ? "border-[#8b501a] bg-[#8b501a]/5" : "border-border hover:border-[#8b501a]/50"
                )}
              >
                <input {...getInputProps()} />
                <Upload size={28} className="mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-sans font-semibold text-foreground">Drag your photos here or click to browse</p>
                <p className="text-xs text-muted-foreground font-sans mt-1">JPG, PNG, WEBP — max 10MB each</p>
              </div>

              {uploadedImages.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-sans text-muted-foreground">{uploadedImages.length} of 20 photos added</p>
                    <p className="text-xs font-sans text-muted-foreground">Drag to reorder — first is cover</p>
                  </div>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={uploadedImages.map((i) => i.id)} strategy={rectSortingStrategy}>
                      <div className="grid grid-cols-4 gap-2">
                        {uploadedImages.map((img, idx) => (
                          <SortableImage
                            key={img.id}
                            id={img.id}
                            url={img.url}
                            isCover={idx === 0}
                            onRemove={(id) => setUploadedImages((p) => p.filter((i) => i.id !== id))}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground font-sans">Set your availability and pricing for the next 12 months.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-sans font-semibold text-foreground mb-1.5 uppercase tracking-wider">Minimum Night Stay</label>
                  <select className="w-full border border-border rounded-lg px-3 py-2.5 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30">
                    {[1, 2, 3, 4, 5, 7].map((n) => (
                      <option key={n}>{n} nights</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-sans font-semibold text-foreground mb-1.5 uppercase tracking-wider">Peak Season Price</label>
                  <input type="number" className="w-full border border-border rounded-lg px-3 py-2.5 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30" placeholder="950" />
                </div>
              </div>
              <div className="border border-border rounded-xl p-4 bg-secondary/30">
                <p className="text-xs font-sans text-muted-foreground mb-3">Click dates to toggle availability. Green = available, Red = blocked.</p>
                <div className="grid grid-cols-7 gap-1 text-center">
                  {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                    <div key={d} className="text-[10px] font-sans font-bold text-muted-foreground py-1">{d}</div>
                  ))}
                  {Array.from({ length: 35 }).map((_, i) => {
                    const dayNum = i - 1;
                    const isValid = dayNum >= 0 && dayNum < 31;
                    const isBlocked = [4, 5, 11, 12, 18, 19].includes(dayNum);
                    return (
                      <button
                        key={i}
                        className={cn(
                          "aspect-square rounded text-[11px] font-sans font-medium transition-colors",
                          !isValid && "invisible",
                          isValid && isBlocked && "bg-[#ba1a1a]/15 text-[#ba1a1a]",
                          isValid && !isBlocked && "hover:bg-[#1d9e75]/10 text-foreground"
                        )}
                      >
                        {isValid ? dayNum + 1 : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-[#1d9e75]/10 flex items-center justify-center mx-auto">
                <BadgeCheck size={32} className="text-[#1d9e75]" />
              </div>
              <h3 className="text-xl font-serif italic text-foreground">Ready to Submit</h3>
              <p className="text-sm text-muted-foreground font-sans max-w-sm mx-auto leading-relaxed">
                Your listing details are complete. Once submitted, our team will review your listing within 24 hours before it goes live.
              </p>
              <div className="text-xs text-muted-foreground font-sans bg-secondary rounded-xl p-4 text-left space-y-1">
                <div className="flex justify-between"><span>Category:</span><span className="font-semibold text-foreground">Lodge</span></div>
                <div className="flex justify-between"><span>Price per night:</span><span className="font-semibold text-foreground">$650</span></div>
                <div className="flex justify-between"><span>Itinerary days:</span><span className="font-semibold text-foreground">{itinerary.length}</span></div>
                <div className="flex justify-between"><span>Photos uploaded:</span><span className="font-semibold text-foreground">{uploadedImages.length}</span></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <button
            onClick={() => step > 0 ? setStep((s) => s - 1) : onClose()}
            className="flex items-center gap-2 text-sm font-sans text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={15} /> {step === 0 ? "Cancel" : "Back"}
          </button>
          <button
            onClick={() => step < STEPS.length - 1 ? setStep((s) => s + 1) : onClose()}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-sans font-semibold transition-all",
              step === STEPS.length - 1
                ? "bg-[#1d9e75] text-white hover:opacity-90"
                : "bg-[#8b501a] text-white hover:opacity-90"
            )}
          >
            {step === STEPS.length - 1 ? "Submit for Review" : "Continue"} <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ListingStatus | "all">("all");
  const [showCreate, setShowCreate] = useState(false);

  const fetchListings = useCallback(async () => {
    try {
      const res = await fetch("/api/operator/listings");
      if (!res.ok) throw new Error("Failed to load listings");
      const data = await res.json();
      setListings(data.listings ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const filters: Array<{ label: string; value: ListingStatus | "all"; count: number }> = [
    { label: "All", value: "all", count: listings.length },
    { label: "Active", value: "active", count: listings.filter((l) => l.status === "active").length },
    { label: "Pending Approval", value: "pending", count: listings.filter((l) => l.status === "pending").length },
    { label: "Draft", value: "draft", count: listings.filter((l) => l.status === "draft").length },
    { label: "Paused", value: "paused", count: listings.filter((l) => l.status === "paused").length },
  ];

  const filtered = activeFilter === "all" ? listings : listings.filter((l) => l.status === activeFilter);

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-5xl mx-auto text-center py-20">
        <p className="text-sm text-muted-foreground font-sans mb-3">{error}</p>
        <button onClick={fetchListings} className="text-sm font-sans text-[#8b501a] hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {showCreate && <CreateListingModal onClose={() => setShowCreate(false)} />}

      {/* Header */}
      <div className="flex items-start justify-between">
        <h1 className="text-3xl font-serif italic text-foreground">Your Properties</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#8b501a] text-white px-4 py-2.5 rounded-xl text-sm font-sans font-semibold hover:opacity-90 transition-opacity shadow-sm"
        >
          <Plus size={16} /> Create New Listing
        </button>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setActiveFilter(f.value)}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-sans font-semibold transition-all",
              activeFilter === f.value
                ? "bg-[#172c1c] text-white"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            )}
          >
            {f.label}
            <span className={cn("text-[10px] font-bold", activeFilter === f.value ? "text-white/70" : "text-muted-foreground")}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Listings */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border rounded-2xl">
          <p className="text-xl font-serif italic text-foreground mb-2">Your first listing is waiting to be created.</p>
          <p className="text-muted-foreground text-sm font-sans mb-6 max-w-sm mx-auto leading-relaxed">
            Add your property to reach travellers from around the world.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[#8b501a] text-white px-4 py-2.5 rounded-xl text-sm font-sans font-semibold hover:opacity-90 transition-opacity mx-auto"
          >
            <Plus size={16} /> Create Your First Listing
          </button>
        </div>
      ) : (
        <div className="space-y-4 pb-8">
          {filtered.map((listing) => (
            <div key={listing.id} className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="sm:flex">
                {/* Image */}
                <div className="sm:w-64 sm:flex-shrink-0 h-48 sm:h-auto relative">
                  {listing.imageUrl ? (
                    <img src={listing.imageUrl} alt={listing.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-secondary flex items-center justify-center min-h-[192px]">
                      <span className="text-xs text-muted-foreground font-sans">No image</span>
                    </div>
                  )}
                  {listing.isVerified && (
                    <div className="absolute top-3 left-3 flex items-center gap-1 bg-[#172c1c]/80 backdrop-blur-sm text-white text-[10px] font-sans font-bold px-2 py-1 rounded-full">
                      <BadgeCheck size={11} /> Verified
                    </div>
                  )}
                  <div className={cn("absolute top-3 right-3 text-[10px] font-sans font-bold px-2 py-1 rounded-full uppercase tracking-wide", statusColors[listing.status] ?? statusColors.draft)}>
                    {listing.status}
                  </div>
                  {listing.pricePerNight != null && (
                    <div className="absolute bottom-3 right-3 bg-[#172c1c]/80 backdrop-blur-sm text-white text-sm font-serif font-bold px-2 py-1 rounded-lg">
                      ${listing.pricePerNight}<span className="text-white/60 text-[10px] font-sans font-normal">/night</span>
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 p-5">
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <h3 className="font-serif font-bold text-lg text-foreground leading-tight">{listing.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-xs font-sans mb-4">{listing.location ?? listing.category ?? ""}</p>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 mb-4 border-t border-border pt-3">
                    <div className="text-center">
                      <div className="text-sm font-serif font-bold text-foreground">{listing.views ?? 0}</div>
                      <div className="text-[10px] text-muted-foreground font-sans uppercase tracking-wider">Views</div>
                    </div>
                    <div className="w-px h-8 bg-border" />
                    <div className="text-center">
                      <div className="text-sm font-serif font-bold text-foreground">{listing.enquiries ?? 0}</div>
                      <div className="text-[10px] text-muted-foreground font-sans uppercase tracking-wider">Enquiries</div>
                    </div>
                    <div className="w-px h-8 bg-border" />
                    <div className="text-center">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-serif font-bold text-foreground">{listing.bookings ?? 0}</span>
                        <TrendingUp size={11} className="text-[#1d9e75]" />
                      </div>
                      <div className="text-[10px] text-muted-foreground font-sans uppercase tracking-wider">Bookings</div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button className="flex items-center gap-1.5 text-xs font-sans font-semibold px-3 py-1.5 rounded-lg bg-[#172c1c] text-white hover:opacity-90 transition-opacity">
                      <Edit size={12} /> Edit
                    </button>
                    <button className="flex items-center gap-1.5 text-xs font-sans font-semibold px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <Eye size={12} /> Preview
                    </button>
                    <button className="flex items-center gap-1.5 text-xs font-sans font-semibold px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <BarChart2 size={12} /> Analytics
                    </button>
                    <button className="flex items-center gap-1.5 text-xs font-sans font-semibold px-3 py-1.5 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <Pause size={12} /> Pause
                    </button>
                    <button className="flex items-center gap-1.5 text-xs font-sans font-semibold px-3 py-1.5 rounded-lg bg-[#ba1a1a]/10 text-[#ba1a1a] hover:bg-[#ba1a1a]/20 transition-colors ml-auto">
                      <Trash2 size={12} /> Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
