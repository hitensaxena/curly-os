import { Suspense } from "react";
import { SearchView } from "@/components/search/SearchView";

export const dynamic = "force-dynamic";

// useSearchParams (in SearchView) needs a Suspense boundary.
export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchView />
    </Suspense>
  );
}
