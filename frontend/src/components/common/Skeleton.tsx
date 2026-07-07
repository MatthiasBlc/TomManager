interface SkeletonProps {
  className?: string;
}

export function SkeletonText({ className = "h-4 w-full" }: SkeletonProps) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonCard({ className = "" }: SkeletonProps) {
  return (
    <div className={`card bg-base-100 shadow-md ${className}`}>
      <div className="card-body p-4 md:p-6 space-y-3">
        <SkeletonText className="h-5 w-3/4" />
        <SkeletonText className="h-3 w-1/2" />
        <SkeletonText className="h-3 w-1/4" />
      </div>
    </div>
  );
}

export function SkeletonTableDetail() {
  return (
    <div className="space-y-3 md:space-y-4 animate-fade-in">
      <div className="space-y-2 mb-4">
        <SkeletonText className="h-6 w-2/3" />
        <SkeletonText className="h-3 w-1/3" />
        <SkeletonText className="h-3 w-1/2" />
      </div>
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-3 md:p-4 space-y-2">
          <SkeletonText className="h-4 w-1/4" />
          <SkeletonText className="h-3 w-full" />
          <SkeletonText className="h-3 w-5/6" />
        </div>
      </div>
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-3 md:p-4 space-y-2">
          <SkeletonText className="h-4 w-1/3" />
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-2 py-1">
              <SkeletonText className="h-4 w-24" />
              <SkeletonText className="h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SkeletonEventDetail() {
  return (
    <div className="container mx-auto px-4 py-4 md:py-8 space-y-4 md:space-y-6 animate-fade-in">
      <div className="space-y-2">
        <SkeletonText className="h-6 w-2/3 md:h-8" />
        <SkeletonText className="h-3 w-1/2" />
      </div>
      <div className="flex gap-2">
        <SkeletonText className="h-8 w-20 rounded-lg" />
        <SkeletonText className="h-8 w-24 rounded-lg" />
        <SkeletonText className="h-8 w-20 rounded-lg" />
        <SkeletonText className="h-8 w-28 rounded-lg" />
      </div>
      <SkeletonCard />
    </div>
  );
}

export function SkeletonCardGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonBoardGame() {
  return (
    <div className="card bg-base-100 shadow-sm border">
      <div className="card-body p-4">
        <div className="flex gap-3">
          <div className="skeleton w-16 h-16 rounded" />
          <div className="flex-1 space-y-2">
            <SkeletonText className="h-4 w-3/4" />
            <SkeletonText className="h-3 w-1/2" />
            <SkeletonText className="h-4 w-1/4" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SkeletonBoardGameList({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBoardGame key={i} />
      ))}
    </div>
  );
}

export function SkeletonNotification() {
  return (
    <div className="flex items-start gap-2 p-3">
      <div className="skeleton w-6 h-6 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-1">
        <SkeletonText className="h-3 w-4/5" />
        <SkeletonText className="h-3 w-3/5" />
        <SkeletonText className="h-2 w-1/4" />
      </div>
    </div>
  );
}

export function SkeletonNotificationList({ count = 4 }: { count?: number }) {
  return (
    <div className="divide-y divide-base-200">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonNotification key={i} />
      ))}
    </div>
  );
}
