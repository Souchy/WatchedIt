import { fromState, IStore } from "@aurelia/state";
import { ILogger, inject, resolve } from "aurelia";
import { UpdateSearchEnginesAction } from "src/core/state/actions/UpdateSearchEnginesAction";
import { AppAction } from "src/core/state/AppHandler";
import { AppState, SearchEngine } from "src/core/state/AppState";
import { AppStorageLoader } from "src/core/state/AppStateStorage";
// import { AppStateStorage } from "src/core/state/AppStateStorage";

@inject(IStore)
export class SearchEngines {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('SearchEngines');

	@fromState((state: AppState) => state.searchEngines)
	protected searchEngines!: SearchEngine[];

	private saveTimeout: number | null = null;

	public constructor(private readonly store: IStore<AppState, UpdateSearchEnginesAction>) {
	}

	public addSearchEngine() {
		this.searchEngines.push({
			name: 'New Search Engine',
			url: 'https://example.com/search?q=%s',
			includeYear: false,
		});
		this.saveSearchEngines(true);
	}

	public removeSearchEngine(index: number) {
		if (index > -1) {
			this.searchEngines.splice(index, 1);
		}
		this.saveSearchEngines(true);
	}

	public saveSearchEngines(immediate: boolean = false) {
		this.store.dispatch(new UpdateSearchEnginesAction(this.searchEngines));

		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
			this.saveTimeout = null;
		}
		// debounce saving to localStorage
		if (immediate) {
			// this.storage.saveSearchEngines();
			AppStorageLoader.saveSearchEngines(this.searchEngines);
		} else {
			this.saveTimeout = window.setTimeout(() => {
				// this.storage.saveSearchEngines();
				AppStorageLoader.saveSearchEngines(this.searchEngines);
				this.saveTimeout = null;
			}, 500);
		}
	}

}
