'use client';

import { use } from 'react';
import { ContactProfile } from "@/components/contacts/contact-profile";
import type { PageProps } from "@/lib/types";

export default function ContactDetailsPage({ params }: PageProps<{ contactId: string }>) {
  const { contactId } = use(params);
  return (
    <ContactProfile contactId={contactId} />
  );
}
