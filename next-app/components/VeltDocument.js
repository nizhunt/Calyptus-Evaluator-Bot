"use client";

import { useSetDocument } from "@veltdev/react";

export default function VeltDocument() {
  useSetDocument("screen-recording-app", {
    documentName: "Screen Recording Session",
  });

  return null; // This component doesn't render anything
}