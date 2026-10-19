"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_TRACK } from "@/lib/questions";

const DOCK_KEY = "intervue_tracks_dock_open";

interface SidebarState {
  selectedTrack: string | null;
  selectTrack: (track: string | null) => void;
  /** The overlay drawer (phones, tablets, and every page except Home). */
  pickerOpen: boolean;
  setPickerOpen: (open: boolean) => void;
  /** The docked panel on wide screens, shown on Home. Remembered between visits. */
  dockOpen: boolean;
  setDockOpen: (open: boolean) => void;
  /** True at the `lg` breakpoint and wider. */
  isDesktop: boolean;
}

const SidebarContext = createContext<SidebarState | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [selectedTrack, selectTrack] = useState<string | null>(DEFAULT_TRACK);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dockOpen, setDockOpenState] = useState(true);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(DOCK_KEY) === "false") setDockOpenState(false);
    } catch {
      // storage blocked: the dock simply starts open
    }
    if (typeof window.matchMedia !== "function") return;
    const query = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  function setDockOpen(open: boolean) {
    setDockOpenState(open);
    try {
      window.localStorage.setItem(DOCK_KEY, String(open));
    } catch {
      // ignore
    }
  }

  return (
    <SidebarContext.Provider value={{ selectedTrack, selectTrack, pickerOpen, setPickerOpen, dockOpen, setDockOpen, isDesktop }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar(): SidebarState {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used inside SidebarProvider");
  return ctx;
}
