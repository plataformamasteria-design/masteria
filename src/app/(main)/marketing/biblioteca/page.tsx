"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BibliotecaRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/marketing/criativos?tab=biblioteca");
  }, [router]);
  return null;
}

