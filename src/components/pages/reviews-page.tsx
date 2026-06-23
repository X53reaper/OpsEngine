"use client";

import { useState, useEffect, useCallback } from "react";
import { ThumbsUp, Edit2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Review {
  id: string;
  reviewer: string;
  country?: string;
  rating: number;
  listing?: string;
  date: string;
  excerpt: string;
  reply?: string | null;
}

function StarRow({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 12 12" fill={i < rating ? "#8b501a" : "#e4e2e1"}>
          <path d="M6 1l1.39 2.82L10.5 4.27l-2.25 2.19.53 3.09L6 8.02 3.22 9.55l.53-3.09L1.5 4.27l3.11-.45L6 1z" />
        </svg>
      ))}
    </div>
  );
}

export function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replying, setReplying] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    try {
      const res = await fetch("/api/operator/reviews");
      if (!res.ok) throw new Error("Failed to load reviews");
      const data = await res.json();
      setReviews(data.reviews ?? []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / totalReviews).toFixed(1)
    : "0.0";

  const ratingBreakdown = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((r) => r.rating === stars).length,
    pct: totalReviews > 0 ? Math.round((reviews.filter((r) => r.rating === stars).length / totalReviews) * 100) : 0,
  }));

  if (loading) {
    return (
      <div className="p-6 max-w-4xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center py-20">
        <p className="text-sm text-muted-foreground font-sans mb-3">{error}</p>
        <button onClick={fetchReviews} className="text-sm font-sans text-[#8b501a] hover:underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <h1 className="text-3xl font-serif italic text-foreground">Reviews</h1>

      {/* Overall rating */}
      <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          {/* Big rating */}
          <div className="text-center flex-shrink-0">
            <div className="text-6xl font-serif font-bold text-foreground leading-none">{avgRating}</div>
            <StarRow rating={Math.round(parseFloat(avgRating))} />
            <div className="text-xs text-muted-foreground font-sans mt-1">{totalReviews} reviews</div>
          </div>

          <div className="w-px h-16 bg-border hidden sm:block" />

          {/* Breakdown */}
          <div className="flex-1 space-y-2 w-full">
            {ratingBreakdown.map(({ stars, count, pct }) => (
              <div key={stars} className="flex items-center gap-3">
                <div className="flex items-center gap-1 w-16 flex-shrink-0">
                  <span className="text-xs font-sans text-foreground font-medium">{stars}</span>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="#8b501a">
                    <path d="M6 1l1.39 2.82L10.5 4.27l-2.25 2.19.53 3.09L6 8.02 3.22 9.55l.53-3.09L1.5 4.27l3.11-.45L6 1z" />
                  </svg>
                </div>
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-2 bg-[#8b501a] rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-muted-foreground font-sans w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Review cards */}
      <div className="space-y-4 pb-8">
        {reviews.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground font-sans">No reviews yet</p>
          </div>
        ) : (
          reviews.map((review) => (
          <div key={review.id} className="bg-card border border-border rounded-2xl shadow-sm p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-border flex items-center justify-center flex-shrink-0">
                  <span className="text-primary text-xs font-bold font-sans">
                    {review.reviewer.split(" ")[0][0]}
                  </span>
                </div>
                <div>
                  <div className="font-sans font-semibold text-sm text-foreground flex items-center gap-1.5">
                    {review.reviewer} <span>{review.flag}</span>
                    <span className="text-muted-foreground font-normal text-xs">· {review.country}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StarRow rating={review.rating} />
                    <span className="text-[10px] text-muted-foreground font-sans">{review.date}</span>
                  </div>
                </div>
              </div>
              <div className="text-xs text-[#8b501a] font-sans font-medium flex-shrink-0">{review.listing}</div>
            </div>

            <p className="text-sm font-sans text-foreground leading-relaxed mb-3">{review.excerpt}</p>

            <div className="flex items-center gap-3">
              <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-sans transition-colors">
                <ThumbsUp size={12} /> Helpful
              </button>
            </div>

            {/* Reply section */}
            {review.replied && review.reply ? (
              <div className="mt-3 border-t border-border pt-3">
                <div className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-primary-foreground font-sans">TM</span>
                  </div>
                  <div className="flex-1 bg-secondary rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-sans font-semibold text-foreground">Your reply</span>
                      <button className="text-muted-foreground hover:text-foreground transition-colors">
                        <Edit2 size={11} />
                      </button>
                    </div>
                    <p className="text-xs font-sans text-foreground leading-relaxed">{review.reply}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-3 border-t border-border pt-3">
                {replying === review.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={replyDraft[review.id] || ""}
                      onChange={(e) => setReplyDraft((p) => ({ ...p, [review.id]: e.target.value }))}
                      rows={3}
                      placeholder="Write a thoughtful public reply..."
                      className="w-full border border-border rounded-xl px-3 py-2.5 text-sm font-sans bg-background focus:outline-none focus:ring-2 focus:ring-[#8b501a]/30 focus:border-[#8b501a] resize-none leading-relaxed"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setReplying(null)}
                        className="text-xs font-sans text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5"
                      >
                        Cancel
                      </button>
                      <button className="bg-[#172c1c] text-white text-xs font-sans font-semibold px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity">
                        Post Reply
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setReplying(review.id)}
                    className="text-xs font-sans font-semibold text-[#8b501a] hover:underline"
                  >
                    Reply to this review
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
