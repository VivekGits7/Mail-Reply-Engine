import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface AppState {
  sidebarOpen: boolean;
  // The dashboard section currently in view, kept in sync by a scroll-spy
  // observer so the sidebar can highlight it without waiting for a click.
  activeSection: string;
}

const initialState: AppState = {
  sidebarOpen: false,
  activeSection: 'overview',
};

const appSlice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },
    setActiveSection: (state, action: PayloadAction<string>) => {
      state.activeSection = action.payload;
    },
  },
  selectors: {
    selectActiveSection: (state) => state.activeSection,
  },
});

export const { toggleSidebar, setSidebarOpen, setActiveSection } = appSlice.actions;
export const { selectActiveSection } = appSlice.selectors;
export default appSlice.reducer;
