import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { AppDrawer } from "@/components/navigation/AppDrawer";

interface DrawerContextType {
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
}

const DrawerContext = createContext<DrawerContextType | undefined>(undefined);

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);
  const toggleDrawer = useCallback(() => setIsDrawerOpen((prev) => !prev), []);

  const value = useMemo(() => ({
    isDrawerOpen,
    openDrawer,
    closeDrawer,
    toggleDrawer
  }), [isDrawerOpen, openDrawer, closeDrawer, toggleDrawer]);

  return (
    <DrawerContext.Provider value={value}>
      {children}
      <AppDrawer visible={isDrawerOpen} onClose={closeDrawer} />
    </DrawerContext.Provider>
  );
}

export function useDrawer() {
  const context = useContext(DrawerContext);
  if (context === undefined) {
    throw new Error("useDrawer must be used within a DrawerProvider");
  }
  return context;
}
