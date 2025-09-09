"use client";

import { useIdentify } from "@veltdev/react";

export default function VeltAuth() {
  // Replace with your actual user data
  const user = {
    userId: "user123",
    organizationId: "org123",
    name: "Test User",
    email: "test@example.com",
    photoUrl: "https://i.pravatar.cc/300",
    color: "#FF5733",
    textColor: "#FFFFFF",
  };

  useIdentify(user);

  return null; // This component doesn't render anything
}