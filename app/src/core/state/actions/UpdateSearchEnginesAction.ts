import { AppState, SearchEngine } from "../AppState";
import { MediaUserData } from "src/core/MediaUserData";

export const UpdateSearchEnginesActionName = "updateSearchEngines";

export class UpdateSearchEnginesAction {
	public readonly type = UpdateSearchEnginesActionName;
	constructor(public searchEngines: SearchEngine[]) { }
}

export function UpdateSearchEnginesHandler(currentState: AppState, action: UpdateSearchEnginesAction): AppState {
	if (action.type !== UpdateSearchEnginesActionName) return currentState;
	currentState.searchEngines = action.searchEngines;
	return currentState;
}
