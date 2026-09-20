import { createSelector } from 'reselect';
import { AppState } from '@app/shared/interface';

const selectMain = (state: AppState) => state.main;

const assetsListSelector = createSelector(selectMain, (state) => state.assetsList);

export const selectAssetsList = () => assetsListSelector;
