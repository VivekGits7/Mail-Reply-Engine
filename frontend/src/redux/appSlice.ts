import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface AppState {
  sidebarOpen: boolean;
}

const initialState: AppState = {
  sidebarOpen: false,
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
  },
});

export const { toggleSidebar, setSidebarOpen } = appSlice.actions;
export default appSlice.reducer;
