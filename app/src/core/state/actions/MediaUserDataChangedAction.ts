import { WatchState } from "src/core/WatchState";
import { AppState } from "../AppState";
import { createDefaultMediaUserData, MediaKind, MediaUserData } from "src/core/MediaUserData";

export const MediaUserDataChangedActionName = "mediaUserDataChanged";

export class MediaUserDataChangedAction {
	public readonly type = MediaUserDataChangedActionName;
	constructor(public tmdb_id: number, public kind: MediaKind, public mediaUserData: Partial<MediaUserData>) { }
}

export function MediaUserDataChangedHandler(currentState: AppState, action: MediaUserDataChangedAction): AppState {
	if (action.type !== MediaUserDataChangedActionName) return currentState;
	// if (action.tmdb_id === null) {
	// 	return currentState;
	// }

	const existingOrNewData = currentState.mediaUserDataMap[action.tmdb_id] 
		|| createDefaultMediaUserData(currentState.session.user.id, action.tmdb_id, action.kind);

	let updatedData = {
		...existingOrNewData,
		updated_at: new Date().toISOString(),
		...action.mediaUserData,
	} satisfies MediaUserData;

	console.log('MediaUserDataChangedHandler - updatedData:', updatedData);	

	currentState.mediaUserDataMap[action.tmdb_id] = updatedData;
	return currentState;
}
