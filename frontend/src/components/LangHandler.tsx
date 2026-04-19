"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";

export function LangHandler() {
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
