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

	const existingData = currentState.mediaUserDataCache.get(action.tmdb_id, action.kind);
	const existingOrNewData = existingData || createDefaultMediaUserData(currentState.session!.user.id, action.tmdb_id, action.kind);

	let updatedData = {
		...existingOrNewData,
		updated_at: new Date().toISOString(),
		...action.mediaUserData,
	} satisfies MediaUserData;

	// console.log('MediaUserDataChangedHandler - updatedData:', updatedData);	

	currentState.mediaUserDataCache.set(updatedData);
	return currentState;
}
