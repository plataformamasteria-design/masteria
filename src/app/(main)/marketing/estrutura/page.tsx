"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EstruturaRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/marketing/campanhas?tab=estrutura");
  }, [router]);
  return null;
}

