import { AppState } from "../AppState";
import { MediaUserData } from "src/core/MediaUserData";

export const MediaUserDataChangedActionName = "mediaUserDataChanged";

export class MediaUserDataChangedAction {
	public readonly type = MediaUserDataChangedActionName;
	constructor(public id: number | null, public mediaUserData: MediaUserData | null) { }
}

export function MediaUserDataChangedHandler(currentState: AppState, action: MediaUserDataChangedAction): AppState {
	if (action.type !== MediaUserDataChangedActionName) return currentState;
	if (action.id === null) {
		return currentState;
	}
	return {
		...currentState,
		mediaUserDataMap: {
			...currentState.mediaUserDataMap,
			[action.id]: action.mediaUserData,
		},
	};
}
