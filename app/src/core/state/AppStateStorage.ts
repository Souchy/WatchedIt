import { fromState } from "@aurelia/state";
import { AppState, SearchEngine } from "./AppState";
import { ILogger, resolve } from "@aurelia/kernel";

// export class AppStateStorage {
// 	private readonly logger: ILogger = resolve(ILogger).scopeTo('AppStateStorage');

// 	@fromState((state: AppState) => state)
// 	public state!: AppState;

// 	@fromState((state: AppState) => state.searchEngines)
// 	protected searchEngines!: SearchEngine[];

// 	public saveSearchEngines() {
// 		this.logger.debug('Saving search engines to localStorage', this.state);
// 		// localStorage.setItem('appState.searchEngines', JSON.stringify(this.searchEngines));
// 		AppStorageLoader.saveSearchEngines(this.searchEngines);
// 		this.logger.info('Search engines saved to localStorage', this.searchEngines);
// 	}
// }

export namespace AppStorageLoader {
	export function loadSearchEngines(initialState: AppState) {
		const json = localStorage.getItem('appState.searchEngines');
		if (json == undefined || json == 'undefined') {
			console.debug('No search engines found in localStorage.');
			saveSearchEngines(initialState.searchEngines);
			return;
		}
		console.debug('Loaded search engines json from localStorage:', json);
		if (json) {
			try {
				const parsed = JSON.parse(json);
				if (Array.isArray(parsed) && parsed.length > 0) {
					initialState.searchEngines = parsed;
				}
			} catch (error) {
				console.error('Error parsing search engines from localStorage:', error);
			}
		}
	}

	export function saveSearchEngines(searchEngines: SearchEngine[]) {
		const json = JSON.stringify(searchEngines);
		localStorage.setItem('appState.searchEngines', json);
		console.info('Search engines saved to localStorage', json);
	}

	export function loadState(): AppState {
		const stateJson = localStorage.getItem('appState');
		if (stateJson) {
			try {
				const state: AppState = JSON.parse(stateJson);
				return state;
			} catch (error) {
				console.error('Error parsing app state from localStorage:', error);
				return new AppState();
			}
		}
		return new AppState();
	}

	export function saveState(state: AppState) {
		localStorage.setItem('appState', JSON.stringify(state));
		return;
	}
}
