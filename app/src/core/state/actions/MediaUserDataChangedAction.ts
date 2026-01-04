import { WatchState } from "src/core/WatchState";
import { AppState } from "../AppState";
import { createDefaultMediaUserData, MediaUserData } from "src/core/MediaUserData";

export const MediaUserDataChangedActionName = "mediaUserDataChanged";

export class MediaUserDataChangedAction {
	public readonly type = MediaUserDataChangedActionName;
	constructor(public tmdb_id: number /* | null */, public mediaUserData: Partial<MediaUserData>) { }
}

export function MediaUserDataChangedHandler(currentState: AppState, action: MediaUserDataChangedAction): AppState {
	if (action.type !== MediaUserDataChangedActionName) return currentState;
	// if (action.tmdb_id === null) {
	// 	return currentState;
	// }

	const existingOrNewData = currentState.mediaUserDataMap[action.tmdb_id] || createDefaultMediaUserData();

	let updatedData = {
		...existingOrNewData,
		updated_at: new Date().toISOString(),
		...action.mediaUserData,
	} satisfies MediaUserData;

	console.log('MediaUserDataChangedHandler - updatedData:', updatedData);	

	currentState.mediaUserDataMap[action.tmdb_id] = updatedData;
	return currentState;
	// return {
	// 	...currentState,
	// 	mediaUserDataMap: {
	// 		...currentState.mediaUserDataMap,
	// 		[action.id]: {
	// 			...existingOrNewData,
	// 			...action.mediaUserData,
	// 		},
	// 	},
	// } satisfies AppState;
}
