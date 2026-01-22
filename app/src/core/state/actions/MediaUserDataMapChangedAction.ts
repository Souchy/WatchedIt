import { AppState } from "../AppState";
import { MediaUserData } from "src/core/MediaUserData";

export const MediaUserDataMapChangedActionName = "mediaUserDataMapChanged";

export class MediaUserDataMapChangedAction {
	public readonly type = MediaUserDataMapChangedActionName;
	constructor(public mediaUserDatas: MediaUserData[]) { }
}

export function MediaUserDataMapChangedHandler(currentState: AppState, action: MediaUserDataMapChangedAction): AppState {
	if (action.type !== MediaUserDataMapChangedActionName) return currentState;
	currentState.mediaUserDataCache.setMap(action.mediaUserDatas);
	return currentState;
}
