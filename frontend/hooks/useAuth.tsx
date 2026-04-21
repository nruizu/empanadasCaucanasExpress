"use client";

import useAuthFromContext from "@/context/AuthContext";

export default function useAuth() {
  return useAuthFromContext();
}