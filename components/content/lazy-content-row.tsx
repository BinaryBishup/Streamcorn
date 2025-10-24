"use client";

import { useEffect, useRef, useState } from "react";
import { ContentRow } from "./content-row";

interface LazyContentRowProps {
  title: string;
  items: any[];
  onItemClick?: (item: any) => void;
}

export function LazyContentRow({ title, items, onItemClick }: LazyContentRowProps) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "200px", // Load content 200px before it enters viewport
      }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="min-h-[300px]">
      {isVisible ? (
        <ContentRow title={title} items={items} onItemClick={onItemClick} />
      ) : (
        <div className="animate-pulse">
          <div className="h-8 bg-gray-800 rounded w-48 mb-4 mx-4 md:mx-16" />
          <div className="flex gap-2 px-4 md:px-16">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-32 sm:w-40 md:w-48 aspect-[2/3] bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
