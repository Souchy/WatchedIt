import { IRouter, Params, route, RouteNode } from "@aurelia/router";
import { ILogger, inject, observable, resolve, watch } from "aurelia";
import { MoviePage } from "../media-page/movie-page/MoviePage";
import { AppState } from "src/core/state/AppState";
import { AppAction } from "src/core/state/AppHandler";
import { SupabaseService } from "src/core/services/SupabaseService";
import { fromState, IStore } from "@aurelia/state";
import { Session } from "@supabase/supabase-js";
import { WatchState } from "src/core/WatchState";
import { MediaKind, MediaUserData } from "src/core/MediaUserData";
import { LanguageCode, Movie, MovieItem, SearchMoviesFilters, SearchMultiSearchFilters, SearchMultiSearchResponse, SearchTVShowsFilters, TMDB, TMDBResponseList, TVShow, TVShowItem } from "@leandrowkz/tmdb";
import { MediaKindDetails, MediaKindItem } from "src/core/Types";
import { UserDataCache } from "src/core/state/UserDataCache";
import { FilterSort, filterSorts } from "src/core/Sorts";
import { Filters } from "@leandrowkz/tmdb/build/src/types/filters";

export class Range {
	min: number | null = null;
	max: number | null = null;
	public check(value: number): boolean {
		if (this.min !== null && value < this.min) {
			return false;
		}
		if (this.max !== null && value > this.max) {
			return false;
		}
		return true;
	}
}

export type MediaUserDataKind = Pick<MediaUserData, 'kind'>;

// type Media = MediaUserDataKind & { details: (TVShowItem | MovieItem) };


export class TMDBSearchFilters {
	query: string = '';
	format: MediaKind | 'all' = 'all';
	language?: LanguageCode = 'en-US';
	include_adult: boolean = false;
	year?: number | undefined = undefined;
	genres: string[] = [];
	keywords: string[] = [];
}

@route({
	id: 'search',
	path: ['search'],
	title: 'Search',
})
@inject(IStore)
@watch('filter.query', 'search', { flush: 'async' })
@watch('filter.format', 'search', { flush: 'async' })
@watch('filter.language', 'search', { flush: 'async' })
@watch('filter.include_adult', 'search', { flush: 'async' })
@watch('filter.year', 'search', { flush: 'async' })
@watch('filter.genres', 'search', { flush: 'async' })
@watch('filter.keywords', 'search', { flush: 'async' })
export class SearchPage {
	MediaKind = MediaKind; // make enum available to the template
	private readonly logger: ILogger = resolve(ILogger).scopeTo('SearchPage');
	private readonly supabase: SupabaseService = resolve(SupabaseService);
	private readonly tmdb: TMDB = resolve(TMDB);
	private readonly router = resolve(IRouter);

	@fromState((state: AppState) => state.session)
	public session!: Session | null;
	// @fromState((state: AppState) => state.mediaUserDataCache)
	// @observable
	// public mediaUserDataCache!: UserDataCache | null;

	private searchEle: HTMLInputElement | null = null;

	// #region Values
	// private searchQuery: string = '';
	// private filterYear: number | undefined = undefined;
	// private filterIncludeAdult: boolean = true;
	// private filterFormat: MediaKind | 'all' = 'all'; // 'all' | 'tvshow' | 'movie' = 'all'; // tv show, movie, tv short, special, ova, ona, music

	// // private filterYear: Range = new Range();
	// private filterSeason: 'winter' | 'spring' | 'summer' | 'fall' | undefined = undefined;
	// private filterAiringStatus: 'airing' | 'finished' | 'not_yet_aired' | 'cancelled' | undefined = undefined;
	// private filterEpisodeCount: Range = new Range();
	// private filterCountryOfOrigin: string | undefined = undefined;
	// private filterGenres: string[] = [];
	// // private filterSortBy: 'popularity' | 'release_date' | 'revenue' | 'primary_release_date' | 'original_title' | 'vote_average' | 'vote_count' = 'popularity';
	// #endregion Values
	private filterSortBy: FilterSort = filterSorts[0];
	private filter: TMDBSearchFilters = new TMDBSearchFilters();
	private debounceTimeout: NodeJS.Timeout | null = null;

	readonly kindMatcher = (a: MediaKind | 'all', b: MediaKind | 'all') => {
		return a === b;
	}

	// private results: TMDBResponseList<Array<MediaUserDataKind & { details: (TVShowItem | MovieItem) }>> | null = null;
	private results: TMDBResponseList<Array<MediaKindItem>> | null = null;


	public bound() {
		// we have to be bound so that the UI updates when we set the filter.
		this.fromQueryString();
		this.search();
	}

	public attached() {
		// if (this.filter.query !== '')
		this.searchEle.focus();
	}

	public resetFilter() {
		this.filter = new TMDBSearchFilters();
	}

	public search() {
		this.updateUrl();
		this.results = null;
		// Clear the previous timer
		if (this.debounceTimeout) {
			clearTimeout(this.debounceTimeout);
		}
		// Start a new debounce timer
		this.debounceTimeout = setTimeout(() => {
			this.loadMore(); // Call the search function
		}, 300); // Wait 300ms after the user stops typing
	}

	// Update URL when filters change, WITHOUT creating a history entry
	private updateUrl(): void {
		const qs = this.toQueryString();
		this.router.load("search", {
			historyStrategy: 'replace',
			queryParams: qs ? Object.fromEntries(qs) : {},
		})
	}
	// Convert filters -> query string
	private toQueryString(): URLSearchParams {
		const sp = new URLSearchParams();
		if (this.filter.query)
			sp.set('query', this.filter.query);
		if (this.filter.format !== 'all') {
			// this.logger.debug('Adding format to query string filter:', this.filter.format, MediaKind.toString(this.filter.format), MediaKind[this.filter.format]);
			sp.set('format', MediaKind[this.filter.format]);
		}
		for (const genre of this.filter.genres)
			sp.append('genres', genre);
		for (const keyword of this.filter.keywords)
			sp.append('keywords', keyword);
		if (this.filter.year !== undefined)
			sp.set('year', String(this.filter.year));
		if (this.filter.include_adult)
			sp.set('adult', String(this.filter.include_adult));
		// if (this.filter.language) sp.set('language', this.filter.language);

		this.logger.debug('Update url filter string params:', Object.fromEntries(sp));
		return sp;
	}
	private fromQueryString(): void {
		const sp = new URLSearchParams(window.location.search);
		this.logger.debug('SearchPage loading with url search filter:', Object.fromEntries(sp));
		this.filter.query = sp.get('query') || '';
		// this.logger.debug('Parsed filter format:', sp.get('format'), MediaKind.fromString(sp.get('format')));
		this.filter.format = MediaKind.fromString(sp.get('format'));
		this.filter.genres = sp.getAll('genres');
		this.filter.keywords = sp.getAll('keywords');
		this.filter.year = sp.get('year') ? parseInt(sp.get('year') as string) : undefined;
		this.filter.include_adult = sp.get('adult') === 'true';
		this.filter.language = (sp.get('language') as LanguageCode) || 'en-US';
		this.logger.debug('Loading with filter:', this.filter);
	}

	public get includeMovies(): boolean {
		return this.filter.format === 'all' || this.filter.format == MediaKind.Movie;
	}
	public get includeTVShows(): boolean {
		return this.filter.format === 'all' || this.filter.format == MediaKind.TVShow;
	}

	private async loadMore() {
		if (!this.filter.query || this.filter.query.trim() === '') {
			this.discoverMore();
			return;
		}

		const nextPage = (this.results?.page || 0) + 1;
		this.logger.debug('Searching more, page', nextPage, this.filter.query, this.filter.format, this.includeMovies, this.includeTVShows);

		let tvFilter: SearchTVShowsFilters = {
			query: this.filter.query,
			page: nextPage,
			include_adult: this.filter.include_adult,
			language: this.filter.language,
			first_air_date_year: this.filter.year,
		};
		// if (this.filter.year)
		// 	tvFilter.first_air_date_year = this.filter.year;
		let tvs = this.includeTVShows ? await this.tmdb.search.tvShows(tvFilter) : { page: 1, results: [], total_pages: 1, total_results: 0 };

		let movieFilter: SearchMoviesFilters = {
			query: this.filter.query,
			page: nextPage,
			include_adult: this.filter.include_adult,
			language: this.filter.language,
			primary_release_year: this.filter.year,
		};
		let movies = this.includeMovies ? await this.tmdb.search.movies(movieFilter) : { page: 1, results: [], total_pages: 1, total_results: 0 };

		this.receiveResults(nextPage, movies, tvs);
	}

	private async discoverMore() {
		const nextPage = (this.results?.page || 0) + 1;
		this.logger.debug('Searching more, page', nextPage, this.filter.query, this.filter.format, this.includeMovies, this.includeTVShows);

		// this.tmdb.discover.movies({
		// 	sort_by: 'popularity.desc',
		// 	page: 1,
		// 	primary_release_year: 2020,
		// 	"primary_release_date.gte": '2020-01-01',
		// 	"primary_release_date.lte": '2020-12-31',
		// 	with_genres: ['28', '12'],
		// 	with_people: ['500', '600'],
		// 	with_cast: ['500', '600'],
		// 	with_crew: ['500', '600'],
		// })
		// this.tmdb.discover.movies({
		// 	with_keywords: ['science-fiction'],
		// })
		let tvResults = this.includeTVShows ? await this.tmdb.discover.tv({
			sort_by: 'popularity.desc',
			page: nextPage,
			include_adult: this.filter.include_adult,
			first_air_date_year: this.filter.year,
		} as Filters) : { page: 1, results: [], total_pages: 1, total_results: 0 };

		let movies = this.includeMovies ? await this.tmdb.discover.movies({
			sort_by: 'popularity.desc',
			page: nextPage,
			include_adult: this.filter.include_adult,
			primary_release_year: this.filter.year,
		}) : { page: 1, results: [], total_pages: 1, total_results: 0 };

		this.receiveResults(nextPage, movies, tvResults);
	}

	private async receiveResults(nextPage: number, movies: TMDBResponseList<MovieItem[]>, tvs: TMDBResponseList<TVShowItem[]>) {
		const tvResults = tvs.results.map(tvshow => {
			return {
				kind: MediaKind.TVShow,
				details: tvshow,
			} satisfies MediaKindItem;
		})
		const movieResults = movies.results.map(movie => {
			return {
				kind: MediaKind.Movie,
				details: movie,
			} satisfies MediaKindItem;
		});
		const newResults = [...tvResults, ...movieResults]
			.sort(this.filterSortBy.function);

		if (!this.results) {
			this.results = {
				page: tvs.page,
				results: [
					...newResults
				],
				total_pages: tvs.total_pages,
				total_results: tvs.total_results + movies.total_results,
			};
		} else {
			this.results.results.push(...newResults);
			this.results.page = nextPage;
			this.results.total_pages = tvs.total_pages;
			this.results.total_results += tvs.total_results + movies.total_results;
		}
	}

}
