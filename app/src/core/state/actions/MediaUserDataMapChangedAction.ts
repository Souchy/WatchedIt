import { AppState } from "../AppState";
import { MediaUserData } from "src/core/MediaUserData";

export const MediaUserDataMapChangedActionName = "mediaUserDataMapChanged";

export class MediaUserDataMapChangedAction {
	public readonly type = MediaUserDataMapChangedActionName;
	constructor(public mediaUserDataMap: Record<number, MediaUserData> | null) { }
}

export function MediaUserDataMapChangedHandler(currentState: AppState, action: MediaUserDataMapChangedAction): AppState {
	if (action.type !== MediaUserDataMapChangedActionName) return currentState;
	return {
		...currentState,
		mediaUserDataMap: action.mediaUserDataMap,
	};
}
