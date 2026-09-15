import { Suspense } from "react";
import { ContactsView } from "./contacts-view";

export default function ContactsPage() {
  return (
    <Suspense>
      <ContactsView />
    </Suspense>
  );
}
