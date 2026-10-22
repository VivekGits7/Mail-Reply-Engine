import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { UserRole, type UserData } from '@/types';

interface AuthState {
  user: UserData | null;
  token: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<{ token: string; user: UserData }>) => {
      state.token = action.payload.token;
      state.user = action.payload.user;
    },
    updateUser: (state, action: PayloadAction<UserData>) => {
      state.user = action.payload;
    },
    logoutUser: () => initialState,
  },
  selectors: {
    selectIsAuthenticated: (state) => Boolean(state.token),
    selectUser: (state) => state.user,
    selectIsAdmin: (state) => state.user?.role === UserRole.HR_ADMIN,
    selectHasComplaintsAccess: (state) => Boolean(state.user?.complaints_access),
  },
});

export const { setCredentials, updateUser, logoutUser } = authSlice.actions;
export const { selectIsAuthenticated, selectUser, selectIsAdmin, selectHasComplaintsAccess } = authSlice.selectors;
export default authSlice.reducer;
