"use client";

export function SkeletonLoader() {
  return (
    <div className="min-h-screen bg-black">
      {/* Header Skeleton */}
      <div className="h-16 bg-gradient-to-b from-black via-black/50 to-transparent relative z-10">
        <div className="max-w-[2000px] mx-auto px-4 md:px-8 h-full flex items-center justify-between">
          {/* Logo skeleton */}
          <div className="h-8 w-32 bg-zinc-800/60 rounded animate-pulse" />

          {/* Nav items skeleton */}
          <div className="hidden md:flex gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-5 w-16 bg-zinc-800/60 rounded animate-pulse" />
            ))}
          </div>

          {/* Profile skeleton */}
          <div className="h-8 w-8 bg-zinc-800/60 rounded-full animate-pulse" />
        </div>
      </div>

      {/* Featured Slider Skeleton */}
      <div className="relative w-full h-[60vh] md:h-[75vh] lg:h-[85vh] bg-zinc-950">
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 animate-shimmer" />

        {/* Content overlay skeleton */}
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 lg:p-16 bg-gradient-to-t from-black via-black/80 to-transparent">
          <div className="max-w-2xl space-y-4">
            {/* Title */}
            <div className="h-12 w-3/4 bg-zinc-800/80 rounded animate-pulse" />
            {/* Description lines */}
            <div className="space-y-2">
              <div className="h-4 w-full bg-zinc-800/60 rounded animate-pulse" />
              <div className="h-4 w-5/6 bg-zinc-800/60 rounded animate-pulse" />
            </div>
            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <div className="h-12 w-32 bg-zinc-700/80 rounded animate-pulse" />
              <div className="h-12 w-32 bg-zinc-800/80 rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>

      {/* Content Rows Skeleton */}
      <div className="pt-8 pb-12 space-y-8 bg-black">
        {[1, 2, 3, 4].map((row) => (
          <div key={row} className="px-4 md:px-8">
            {/* Row Title */}
            <div className="h-7 w-56 bg-zinc-800/60 rounded mb-4 animate-pulse" />

            {/* Row Items */}
            <div className="flex gap-2 overflow-hidden">
              {[1, 2, 3, 4, 5, 6, 7].map((item) => (
                <div
                  key={item}
                  className="flex-shrink-0 w-32 sm:w-40 md:w-48 aspect-[2/3] bg-zinc-900/80 rounded overflow-hidden"
                  style={{
                    animationDelay: `${item * 75}ms`,
                  }}
                >
                  <div className="w-full h-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-800 animate-shimmer" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ModalSkeletonLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-6xl max-h-[90vh] bg-zinc-950 rounded-lg overflow-hidden shadow-2xl border border-zinc-800/50">
        {/* Hero Section Skeleton */}
        <div className="relative w-full aspect-video bg-zinc-900">
          <div className="w-full h-full bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900 animate-shimmer" />

          {/* Hero content overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 bg-gradient-to-t from-zinc-950 via-zinc-950/90 to-transparent">
            <div className="space-y-3">
              {/* Title */}
              <div className="h-10 w-2/3 bg-zinc-800/80 rounded animate-pulse" />
              {/* Meta info */}
              <div className="flex gap-3">
                <div className="h-5 w-16 bg-zinc-800/60 rounded animate-pulse" />
                <div className="h-5 w-20 bg-zinc-800/60 rounded animate-pulse" />
                <div className="h-5 w-24 bg-zinc-800/60 rounded animate-pulse" />
              </div>
              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <div className="h-10 w-28 bg-zinc-700/80 rounded animate-pulse" />
                <div className="h-10 w-10 bg-zinc-800/80 rounded-full animate-pulse" />
                <div className="h-10 w-10 bg-zinc-800/80 rounded-full animate-pulse" />
              </div>
            </div>
          </div>

          {/* Close button skeleton */}
          <div className="absolute top-4 right-4 h-10 w-10 bg-zinc-800/80 rounded-full animate-pulse" />
        </div>

        {/* Content Section Skeleton */}
        <div className="p-6 md:p-8 space-y-6 bg-zinc-950 overflow-y-auto max-h-[50vh]">
          {/* Tabs */}
          <div className="flex gap-6 border-b border-zinc-800/60 pb-3">
            <div className="h-6 w-20 bg-zinc-800/60 rounded animate-pulse" />
            <div className="h-6 w-24 bg-zinc-800/50 rounded animate-pulse" />
            <div className="h-6 w-28 bg-zinc-800/50 rounded animate-pulse" />
          </div>

          {/* Overview text skeleton */}
          <div className="space-y-2">
            <div className="h-4 w-full bg-zinc-800/50 rounded animate-pulse" />
            <div className="h-4 w-full bg-zinc-800/50 rounded animate-pulse" />
            <div className="h-4 w-3/4 bg-zinc-800/50 rounded animate-pulse" />
          </div>

          {/* Content Grid */}
          <div>
            <div className="h-6 w-40 bg-zinc-800/60 rounded mb-4 animate-pulse" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((item) => (
                <div
                  key={item}
                  className="aspect-[2/3] bg-zinc-900/80 rounded overflow-hidden"
                  style={{
                    animationDelay: `${item * 50}ms`,
                  }}
                >
                  <div className="w-full h-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-800 animate-shimmer" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
