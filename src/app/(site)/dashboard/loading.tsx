import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="mt-3 h-5 w-80" />
      <Skeleton className="mt-8 h-56 w-full rounded-2xl" />
    </div>
  );
}
