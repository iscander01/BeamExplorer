import { createAction } from 'typesafe-actions';

export const setIsLoaded = createAction('@@SHARED/SET_IS_LOADED')<boolean>();
