import { AppState } from "./AppState";
import { MediaUserDataChangedAction, MediaUserDataChangedActionName, MediaUserDataChangedHandler } from "./actions/MediaUserDataChangedAction";
import { MediaUserDataMapChangedAction, MediaUserDataMapChangedActionName, MediaUserDataMapChangedHandler } from "./actions/MediaUserDataMapChangedAction";
import { UserChangedAction, UserChangedActionName, UserChangedHandler } from "./actions/UserChangedAction";

export type AppAction =
	| UserChangedAction
	| MediaUserDataMapChangedAction
	| MediaUserDataChangedAction;

export function appStateHandler(state: AppState, action: AppAction): AppState {
	switch (action.type) {
		case UserChangedActionName:
			return UserChangedHandler(state, action satisfies UserChangedAction);
		case MediaUserDataChangedActionName:
			return MediaUserDataChangedHandler(state, action satisfies MediaUserDataChangedAction);
		case MediaUserDataMapChangedActionName:
			return MediaUserDataMapChangedHandler(state, action satisfies MediaUserDataMapChangedAction);
		default:
			return state;
	}
}
