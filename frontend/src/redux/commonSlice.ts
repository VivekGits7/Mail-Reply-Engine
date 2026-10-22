import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface CommonState {
  uploadProgress: number;
}

const initialState: CommonState = {
  uploadProgress: 0,
};

const commonSlice = createSlice({
  name: 'common',
  initialState,
  reducers: {
    setUploadProgress: (state, action: PayloadAction<number>) => {
      state.uploadProgress = action.payload;
    },
  },
});

export const { setUploadProgress } = commonSlice.actions;
export default commonSlice.reducer;
