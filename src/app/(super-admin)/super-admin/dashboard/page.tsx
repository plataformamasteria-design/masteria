'use client';

import { redirect } from 'next/navigation';

export default function DashboardPage() {
  // Redirect to parent super-admin page
  redirect('/super-admin');
  return null;
}
