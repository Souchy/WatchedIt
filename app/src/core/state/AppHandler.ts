import { AppState } from "./AppState";
import { MediaUserDataChangedAction, MediaUserDataChangedActionName, MediaUserDataChangedHandler } from "./actions/MediaUserDataChangedAction";
import { MediaUserDataMapChangedAction, MediaUserDataMapChangedActionName, MediaUserDataMapChangedHandler } from "./actions/MediaUserDataMapChangedAction";
import { UpdateSearchEnginesAction, UpdateSearchEnginesActionName, UpdateSearchEnginesHandler } from "./actions/UpdateSearchEnginesAction";
import { UserChangedAction, UserChangedActionName, UserChangedHandler } from "./actions/UserChangedAction";

export type AppAction =
	| UserChangedAction
	| MediaUserDataMapChangedAction
	| MediaUserDataChangedAction
	| UpdateSearchEnginesAction

export function appStateHandler(state: AppState, action: AppAction): AppState {
	switch (action.type) {
		case UserChangedActionName:
			return UserChangedHandler(state, action satisfies UserChangedAction);
		case MediaUserDataChangedActionName:
			return MediaUserDataChangedHandler(state, action satisfies MediaUserDataChangedAction);
		case MediaUserDataMapChangedActionName:
			return MediaUserDataMapChangedHandler(state, action satisfies MediaUserDataMapChangedAction);
		case UpdateSearchEnginesActionName:
			return UpdateSearchEnginesHandler(state, action satisfies UpdateSearchEnginesAction);
		default:
			return state;
	}
}
