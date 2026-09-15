import { Suspense } from "react";
import { CollectionsView } from "./collections-view";

export default function CollectionsPage() {
  return (
    <Suspense>
      <CollectionsView />
    </Suspense>
  );
}
