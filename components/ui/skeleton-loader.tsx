"use client";

export function SkeletonLoader() {
  return (
    <div className="min-h-screen bg-black">
      {/* Header Skeleton */}
      <div className="h-16 bg-gradient-to-b from-black to-transparent" />

      {/* Featured Slider Skeleton */}
      <div className="relative w-full h-[60vh] md:h-[75vh] lg:h-[85vh] bg-gray-900/50 animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 animate-shimmer" />
      </div>

      {/* Content Rows Skeleton */}
      <div className="pt-8 pb-12 space-y-8">
        {[1, 2, 3, 4].map((row) => (
          <div key={row} className="px-4 md:px-8">
            {/* Row Title */}
            <div className="h-6 w-48 bg-gray-800 rounded mb-4 animate-pulse" />

            {/* Row Items */}
            <div className="flex gap-2 overflow-hidden">
              {[1, 2, 3, 4, 5, 6, 7].map((item) => (
                <div
                  key={item}
                  className="flex-shrink-0 w-32 sm:w-40 md:w-48 aspect-[2/3] bg-gray-800 rounded animate-pulse"
                  style={{
                    animationDelay: `${item * 100}ms`,
                  }}
                >
                  <div className="w-full h-full bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 animate-shimmer rounded" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 animate-in fade-in duration-300">
      <div className="w-full max-w-6xl bg-black rounded-lg overflow-hidden shadow-2xl">
        {/* Hero Section Skeleton */}
        <div className="relative w-full aspect-video bg-gray-900 animate-pulse">
          <div className="w-full h-full bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 animate-shimmer" />
        </div>

        {/* Content Section Skeleton */}
        <div className="p-6 md:p-10 space-y-6">
          {/* Tabs */}
          <div className="flex gap-8 border-b border-gray-800 pb-3">
            <div className="h-6 w-24 bg-gray-800 rounded animate-pulse" />
            <div className="h-6 w-24 bg-gray-800 rounded animate-pulse" />
            <div className="h-6 w-24 bg-gray-800 rounded animate-pulse" />
          </div>

          {/* Content Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((item) => (
              <div
                key={item}
                className="aspect-[2/3] bg-gray-800 rounded animate-pulse"
                style={{
                  animationDelay: `${item * 50}ms`,
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
