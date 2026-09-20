import { createSelector } from 'reselect';

import { AppState } from '../interface';

const selectShared = (state: AppState) => state.shared;

const isLoadedSelector = createSelector(selectShared, (state) => state.isLoaded);

export const selectIsLoaded = () => isLoadedSelector;
