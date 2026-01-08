import { route } from "@aurelia/router";
import { ILogger, inject, observable, resolve, watch } from "aurelia";
import { MoviePage } from "../movie-page/MoviePage";
import { AppState } from "src/core/state/AppState";
import { AppAction } from "src/core/state/AppHandler";
import { SupabaseService } from "src/core/services/SupabaseService";
import { fromState, IStore } from "@aurelia/state";
import { Session } from "@supabase/supabase-js";
import { WatchState, WatchStateButtonMap } from "src/core/WatchState";
import { MediaKind, MediaUserData } from "src/core/MediaUserData";
import { LanguageCode, Movie, MovieItem, TMDB, TMDBResponseList, TVShow, TVShowItem } from "@leandrowkz/tmdb";
import { FilterSort, filterSorts, MediaUserDataKind } from "../search-page/SearchPage";

export class MyListSearchFilters {
	query: string = '';
	format: MediaKind | 'all' = 'all';
	language?: LanguageCode = 'en-US';
	include_adult: boolean = false;
	year?: number;
	list: WatchState | 'all' = 'all'; // Add | string to allow any custom list?
}
export const WatchStateFilterOptions: Array<{ value: WatchState | 'all'; label: string }> = [
	{ value: 'all', label: 'All' },
	{ value: WatchState.Watching, label: 'Watching' },
	{ value: WatchState.PlanToWatch, label: 'Plan to Watch' },
	{ value: WatchState.Completed, label: 'Completed' },
	{ value: WatchState.OnHold, label: 'On Hold' },
	{ value: WatchState.Dropped, label: 'Dropped' },
];
export const FormatOptions: Array<{ value: MediaKind | 'all'; label: string }> = [
	{ value: 'all', label: 'All' },
	{ value: MediaKind.Movie, label: 'Movie' },
	{ value: MediaKind.TVShow, label: 'TV Show' },
];
type Media = MediaUserData & { details: (TVShowItem | MovieItem) };

// export type FilterSort = {
// 	value: string;
// 	label: string;
// 	function: (a: Media, b: Media) => number;
// };
// export const filterSorts: FilterSort[] = [
// 	{
// 		value: 'popularity',
// 		label: 'Popularity',
// 		function: (a: Media, b: Media) => {
// 			return (b.details.popularity! - a.details.popularity!);
// 		}
// 	},
// 	{
// 		value: 'vote_average',
// 		label: 'Average Vote',
// 		function: (a: Media, b: Media) => {
// 			return (b.details.vote_average! - a.details.vote_average!);
// 		}
// 	},
// 	{
// 		value: 'release_date',
// 		label: 'Release Date',
// 		function: (a: Media, b: Media) => {
// 			const dateA = 'first_air_date' in a.details ? a.details.first_air_date : a.details.release_date;
// 			const dateB = 'first_air_date' in b.details ? b.details.first_air_date : b.details.release_date;
// 			return (dateB || '').localeCompare(dateA || '');
// 		}
// 	},
// ]

@route({
	id: 'mylist',
	path: ['mylist'],
	title: 'My List',
})
@watch('filter.query', 'search', { flush: 'async' })
@watch('filter.format', 'search', { flush: 'async' })
@watch('filter.language', 'search', { flush: 'async' })
@watch('filter.include_adult', 'search', { flush: 'async' })
@watch('filter.year', 'search', { flush: 'async' })
@watch('filter.list', 'search', { flush: 'async' })
// @inject(IStore)
export class MyListPage {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('MyListPage');
	private readonly supabase: SupabaseService = resolve(SupabaseService);
	private readonly tmdb: TMDB = resolve(TMDB);

	@fromState((state: AppState) => state.session)
	public session!: Session | null;
	@fromState((state: AppState) => state.mediaUserDataMap)
	@observable
	public mediaUserDataMap!: Record<string, MediaUserData> | null;
	@fromState((state: AppState) => state.tmdbData)
	public tmdbData!: Map<string, Movie | TVShow>;

	// Filtering and Sorting
	private filter: MyListSearchFilters = new MyListSearchFilters();
	private filterSortBy: FilterSort = filterSorts[0];
	private debounceTimeout: NodeJS.Timeout | null = null;

	// Cached TMDB data and filtered results
	// private tmdbData = new Map<string, Movie | TVShow>();
	// private filteredMediaUserDataCache: TMDBResponseList<MediaUserData[]> = null;
	private filteredMediaUserDataCache: TMDBResponseList<Array<Media>> | null = null;


	// Load initial data
	attached() {
		this.mediaUserDataMapChanged({}, this.mediaUserDataMap);
		// this.search();
	}

	public get foundCount() {
		return this.filteredMediaUserDataCache?.results.length ?? 0;
	}

	public get watchStateOptions() {
		return WatchStateFilterOptions;
	}
	public get formatOptions() {
		return FormatOptions;
	}

	/**
	 * When the mediaUserDataMap changes, fetch TMDB details for each media item
	 */
	async mediaUserDataMapChanged(previous: Record<string, MediaUserData>, current: Record<string, MediaUserData>) {
		if (!this.mediaUserDataMap) {
			return;
		}
		this.logger.debug('MediaUserDataMap changed:', Object.keys(previous).length, Object.keys(this.mediaUserDataMap).length);

		// TOD: Fetch in order of the user's filtered list? And asynchronously to not block UI
		const keys = Object.keys(this.mediaUserDataMap);
		this.logger.debug(`Fetching TMDB details for ${keys.length} media items...`);

		// Limit to first 20 for now
		// for (const key of keys) { 
		// // for (const key of keys.slice(0, 100)) {
		// 	if (this.tmdbData.has(key)) continue;
		// 	const item = this.mediaUserDataMap[key];
		// 	if (!item) {
		// 		this.logger.warn(`mediaUserDataMapChanged: item for key ${key} is null or undefined, skipping.`);
		// 		continue;
		// 	}

		// 	const api = item.kind === MediaKind.Movie ? this.tmdb.movies : this.tmdb.tvShows;
		// 	let mediaDetails = await api.details(item.tmdb_id);
		// 	this.tmdbData.set(key, mediaDetails);
		// 	// api.details(item.tmdb_id).then((mediaDetails) => {
		// 	// 	this.tmdbData.set(key, mediaDetails);
		// 	// 	// this.logger.debug(`fetched TMDB details for ${item.kind === MediaKind.Movie ? 'Movie' : 'TV Show'} ID ${item.tmdb_id}:`, mediaDetails);
		// 	// }).catch((error) => {
		// 	// 	this.logger.error(`error fetching TMDB details for ${item.kind === MediaKind.Movie ? 'Movie' : 'TV Show'} ID ${item.tmdb_id}:`, error);
		// 	// });
		// 	// await new Promise(r => setTimeout(r, 40 / 1000)); // small delay to avoid rate limits
		// }

		this.logger.debug('Completed fetching TMDB details for media items.');
		this.search();
	}

	private searchCancelled = false;
	async search() {
		// if (!this.filter.query || this.filter.query.trim() === '') {
		// 	this.filteredMediaUserDataCache = null;
		// 	return;
		// }
		this.logger.debug('Searching with filters:', this.filter);
		// Clear the previous timer
		if (this.debounceTimeout) {
			this.searchCancelled = true;
			clearTimeout(this.debounceTimeout);
		}
		// Start a new debounce timer
		this.debounceTimeout = setTimeout(async () => {
			this.searchCancelled = false;
			this.filteredMediaUserDataCache = null;
			await this.searchMore(); // Call the search function
		}, 300); // Wait 300ms after the user stops typing
	}

	public async searchMore() {
		if (!this.mediaUserDataMap) {
			this.logger.warn('No media user data map available for searching.');
			return;
		}

		this.logger.debug(`Searching more through ${Object.keys(this.mediaUserDataMap).length} media user data items with filters:`, this.filter);
		const page = this.filteredMediaUserDataCache ? this.filteredMediaUserDataCache.page + 1 : 1;

		// let filteredItems: TMDBResponseList<Array<MediaUserData & { details: (TVShow | Movie) }>>
		// 	= { page: page, results: [], total_pages: page, total_results: 0 };
		this.filteredMediaUserDataCache = { page: page, results: [], total_pages: page, total_results: 0 };

		const keys = Object.keys(this.mediaUserDataMap);
		for (const key of keys) {
			if (this.searchCancelled)
				return;
			const item = this.mediaUserDataMap[key];
			if (!item) {
				this.logger.warn(`searchMore: item for key ${key} is null or undefined, skipping.`);
				continue;
			}
			if (!item.kind && item.kind !== MediaKind.Movie && item.kind !== MediaKind.TVShow) {
				this.logger.warn(`searchMore: item for key ${key} has invalid kind (${item.kind}), skipping.`);
				continue;
			}
			if (item.state == WatchState.Unlisted) {
				continue;
			}
			// Apply filters
			if (this.filter.format !== 'all' && item.kind != this.filter.format) {
				continue;
			}
			if (this.filter.list !== 'all' && item.state != this.filter.list) {
				continue;
			}
			let details = this.tmdbData.get(key); //item.tmdb_id);
			if (!details) {
				const api = item.kind === MediaKind.Movie ? this.tmdb.movies : this.tmdb.tvShows;
				details = await api.details(item.tmdb_id);
				this.tmdbData.set(key, details);
			}
			// if (this.filter.language && details.original_language !== this.filter.language) {
			// 	continue;
			// }
			if (this.filter.year) {
				const releaseYear = item.kind === MediaKind.Movie
					? (details as Movie).release_date ? new Date((details as Movie).release_date).getFullYear() : null
					: (details as TVShow).first_air_date ? new Date((details as TVShow).first_air_date).getFullYear() : null;
				if (releaseYear !== this.filter.year) {
					continue;
				}
			}
			if (this.filter.query && this.filter.query.trim() !== '') {
				const queryLower = this.filter.query.toLowerCase();
				const title = item.kind === MediaKind.Movie
					? (details as Movie).title || ''
					: (details as TVShow).name || '';
				// const overview = details.overview || '';
				if (!title.toLowerCase().includes(queryLower)) { // && !overview.toLowerCase().includes(queryLower)) {
					continue;
				}
			}
			if (this.searchCancelled)
				return;
			// If all filters pass, add to results
			this.filteredMediaUserDataCache.results.push({
				...item,
				details: details,
			});
		}
		this.filteredMediaUserDataCache.results.sort(this.filterSortBy.function);
		this.logger.debug(`Search found ${this.filteredMediaUserDataCache.results.length} items after filtering.`);
		// this.filteredMediaUserDataCache = filteredItems;
	}

}
