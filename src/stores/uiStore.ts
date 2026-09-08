import { create } from 'zustand';

type CalendarView = 'day' | 'week' | 'month';

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
  currentView: CalendarView;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebarCollapsed: () => void;
  toggleMobileMenu: () => void;
  setMobileMenuOpen: (open: boolean) => void;
  setCurrentView: (view: CalendarView) => void;
}

function getIsDesktop(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(min-width: 1024px)').matches;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: getIsDesktop(),
  sidebarCollapsed: false,
  mobileMenuOpen: false,
  currentView: 'week',
  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebarCollapsed: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  toggleMobileMenu: () =>
    set((state) => ({ mobileMenuOpen: !state.mobileMenuOpen })),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  setCurrentView: (view) => set({ currentView: view }),
}));
