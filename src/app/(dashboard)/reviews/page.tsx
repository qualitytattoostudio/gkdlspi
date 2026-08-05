'use client';

import React, { useState, useEffect } from 'react';
import Script from 'next/script';
import { NeuCard } from '@/components/neu/NeuCard';
import { StatCard } from '@/components/neu/StatCard';
import { Star, MessageSquare, ThumbsUp } from 'lucide-react';

const REVIEWS_DATA = {
  rating: 4.9,
  reviews: 331,
  reviews_tags: [
    "water tank cleaning",
    "sanitising house",
    "bathroom cleaning",
    "restroom cleaning",
    "polite staff",
    "deep cleaning",
    "window cleaning",
    "kitchen cleaning",
    "satisfactory work",
    "punctual team"
  ],
  reviews_data: [
    {
      author_title: "Saravanan B",
      review_text: "Had a good Deep Cleaning Service from Vyess FMS",
      review_rating: 5,
      review_datetime_utc: "08/02/2026 11:26:23",
      owner_answer: "A heartfelt thank you for your wonderful appreciation and 5-star rating. We are delighted to know that you consider us the best house cleaning service. Your support means a lot to us, and we look forward to welcoming and serving you again soon."
    },
    {
      author_title: "uma priyanga",
      review_text: "Service good",
      review_rating: 5,
      review_datetime_utc: "07/26/2026 08:33:23",
      owner_answer: "A heartfelt thank you for your wonderful appreciation and 5-star rating. We are delighted to know that you consider us the best house cleaning service. Your support means a lot to us, and we look forward to welcoming and serving you again soon."
    },
    {
      author_title: "Gautham G",
      review_text: "Very neat,clean & prompt service!",
      review_rating: 5,
      review_datetime_utc: "07/21/2026 16:04:06",
      owner_answer: "A heartfelt thank you for your wonderful appreciation and 5-star rating. We are delighted to know that you consider us the best house cleaning service. Your support means a lot to us, and we look forward to welcoming and serving you again soon."
    },
    {
      author_title: "Saraswathi",
      review_text: "Toilet cleaning staff do his work very smart. Now Toilet looks like New Toilet.",
      review_rating: 5,
      review_datetime_utc: "07/19/2026 12:09:27",
      owner_answer: "A heartfelt thank you for your wonderful appreciation for toilet cleaning and 5-star rating. We are delighted to know that you consider us the best house cleaning service. Your support means a lot to us, and we look forward to welcoming and serving you again soon."
    },
    {
      author_title: "Saro Hawaii",
      review_text: "I recommend Vyess. Their services is clean, affordable and perfect. 🙂",
      review_rating: 5,
      review_datetime_utc: "07/18/2026 12:44:39",
      owner_answer: "A heartfelt thank you for your wonderful appreciation and 5-star rating. We are delighted to know that you consider us the best house cleaning service. Your support means a lot to us, and we look forward to welcoming and serving you again soon."
    },
    {
      author_title: "lakshmanan natarajan",
      review_text: "Pest control work done as per requirement",
      review_rating: 5,
      review_datetime_utc: "07/13/2026 09:11:24",
      owner_answer: "A heartfelt thank you for your wonderful appreciation for pest control and 5-star rating. We are delighted to know that you consider us the best house cleaning service. Your support means a lot to us, and we look forward to welcoming and serving you again soon."
    },
    {
      author_title: "Arun Kumar",
      review_text: "Very professional team and punctual. Did a great job with the deep cleaning of our newly constructed house.",
      review_rating: 5,
      review_datetime_utc: "06/28/2026 14:22:10",
      owner_answer: "Thank you Arun for your 5-star review! We always strive for perfection in post-construction deep cleaning."
    },
    {
      author_title: "Karthik Raj",
      review_text: "Water tank cleaning was done perfectly with high pressure washers.",
      review_rating: 5,
      review_datetime_utc: "06/15/2026 10:05:30",
      owner_answer: "Thank you for the wonderful feedback! High-pressure cleaning is our specialty."
    }
  ]
};

export default function ReviewsPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-neu-fg">Customer Reviews & Feedback</h2>
          <p className="text-neu-muted text-sm">Synchronized with Google My Business reviews for VYESS Housekeeping And Facility Service.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <StatCard title="Overall Rating" value={REVIEWS_DATA.rating} suffix=" / 5.0" icon={Star} />
        <StatCard title="Total Reviews" value={REVIEWS_DATA.reviews} icon={MessageSquare} />
        <StatCard title="Positive Feedback" value={98} suffix="%" icon={ThumbsUp} />
      </div>

      <NeuCard className="p-6">
        <h3 className="font-display font-bold text-neu-fg mb-4">Customer Highlights</h3>
        <div className="flex flex-wrap gap-2">
          {REVIEWS_DATA.reviews_tags.map((tag, idx) => (
            <span key={idx} className="bg-neu-bg text-neu-accent font-medium text-xs px-3 py-1.5 rounded-full shadow-neu-small border border-white">
              {tag}
            </span>
          ))}
        </div>
      </NeuCard>

      <div className="mt-8">
        <h3 className="font-display font-bold text-neu-fg mb-4">Live Customer Reviews</h3>
        {/* Elfsight Widget Container - only rendered on client to prevent hydration mismatch */}
        <div className="min-h-[400px]">
          {mounted && (
            <>
              <Script src="https://elfsightcdn.com/platform.js" strategy="lazyOnload" />
              <div className="elfsight-app-6a01ba84-efb5-4d45-b71e-bd99eff82c1f" data-elfsight-app-lazy="true"></div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
