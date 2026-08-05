import { create } from 'zustand'

interface AppState {
  isSidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (isOpen: boolean) => void
  
  activeOfficeId: string | null
  setActiveOfficeId: (id: string | null) => void
  
  // Toasts can be added here, but usually a separate hook or library is better
}

export const useAppStore = create<AppState>((set) => ({
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (isOpen) => set({ isSidebarOpen: isOpen }),
  
  activeOfficeId: null,
  setActiveOfficeId: (id) => set({ activeOfficeId: id }),
}))
