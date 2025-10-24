"use client";

import Image from "next/image";
import { useState } from "react";
import { Play } from "lucide-react";

interface ContentCardProps {
  id: string;
  tmdbId: number;
  title: string;
  posterPath: string | null;
  rating?: number;
  type: "movie" | "tv" | "anime";
}

export function ContentCard({ id, tmdbId, title, posterPath, rating, type }: ContentCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="group relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 transition-all duration-300 hover:scale-105 hover:z-10 cursor-pointer">
      {/* Poster Image */}
      {posterPath && !imageError ? (
        <Image
          src={posterPath}
          alt={title}
          fill
          className="object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
          <span className="text-4xl font-bold text-gray-600 text-center px-4">
            {title.charAt(0)}
          </span>
        </div>
      )}

      {/* Hover Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
        {/* Play Button */}
        <div className="flex items-center justify-center mb-2">
          <button className="w-12 h-12 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-colors">
            <Play className="w-6 h-6 text-black ml-1" fill="currentColor" />
          </button>
        </div>

        {/* Title */}
        <h3 className="text-white font-semibold text-sm line-clamp-2 text-center">
          {title}
        </h3>

        {/* Rating */}
        {rating && (
          <div className="flex items-center justify-center mt-1">
            <span className="text-yellow-400 text-xs">★ {rating.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Type Badge */}
      <div className="absolute top-2 right-2 px-2 py-1 bg-black/80 rounded text-xs font-semibold text-white uppercase">
        {type}
      </div>
    </div>
  );
}
