"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { DEFAULT_TRACK } from "@/lib/questions";

interface SidebarState {
  selectedTrack: string | null;
  selectTrack: (track: string | null) => void;
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarState | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [selectedTrack, selectTrack] = useState<string | null>(DEFAULT_TRACK);
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <SidebarContext.Provider value={{ selectedTrack, selectTrack, pickerOpen, setPickerOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarState {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
  return ctx;
}
