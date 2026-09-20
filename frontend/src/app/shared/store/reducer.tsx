import produce from 'immer';
import { ActionType, createReducer } from 'typesafe-actions';

import { SharedStateType } from '../interface';
import * as actions from './actions';

type Action = ActionType<typeof actions>;

const initialState: SharedStateType = {
  isLoaded: false,
};

const reducer = createReducer<SharedStateType, Action>(initialState).handleAction(
  actions.setIsLoaded,
  (state, action) =>
    produce(state, (nexState) => {
      nexState.isLoaded = action.payload;
    }),
);
export { reducer as SharedReducer };
