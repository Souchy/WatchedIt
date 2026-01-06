import { route } from "@aurelia/router";
import { ILogger, inject, observable, resolve, watch } from "aurelia";
import { MoviePage } from "../movie-page/MoviePage";
import { AppState } from "src/core/state/AppState";
import { AppAction } from "src/core/state/AppHandler";
import { SupabaseService } from "src/core/services/SupabaseService";
import { fromState, IStore } from "@aurelia/state";
import { Session } from "@supabase/supabase-js";
import { WatchState } from "src/core/WatchState";
import { MediaKind, MediaUserData } from "src/core/MediaUserData";
import { LanguageCode, Movie, MovieItem, SearchMoviesFilters, SearchMultiSearchFilters, SearchMultiSearchResponse, SearchTVShowsFilters, TMDB, TMDBResponseList, TVShow, TVShowItem } from "@leandrowkz/tmdb";

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

type Media = MediaUserDataKind & { details: (TVShowItem | MovieItem) };

export type FilterSort = {
	value: string;
	label: string;
	function: (a: Media, b: Media) => number;
};
export const filterSorts: FilterSort[] = [
	{
		value: 'popularity',
		label: 'Popularity',
		function: (a: Media, b: Media) => {
			return (b.details.popularity! - a.details.popularity!);
		}
	},
	{
		value: 'vote_average',
		label: 'Average Vote',
		function: (a: Media, b: Media) => {
			return (b.details.vote_average! - a.details.vote_average!);
		}
	},
	{
		value: 'release_date',
		label: 'Release Date',
		function: (a: Media, b: Media) => {
			const dateA = 'first_air_date' in a.details ? a.details.first_air_date : a.details.release_date;
			const dateB = 'first_air_date' in b.details ? b.details.first_air_date : b.details.release_date;
			return (dateB || '').localeCompare(dateA || '');
		}
	},
]

export class TMDBSearchFilters {
	query: string = '';
	format: MediaKind | 'all' = 'all';
	language?: LanguageCode = 'en-US';
	include_adult: boolean = false;
	year?: number;
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
export class SearchPage {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('SearchPage');
	private readonly supabase: SupabaseService = resolve(SupabaseService);
	private readonly tmdb: TMDB = resolve(TMDB);

	@fromState((state: AppState) => state.session)
	public session!: Session | null;
	@fromState((state: AppState) => state.mediaUserDataMap)
	@observable
	public mediaUserDataMap!: Record<string, MediaUserData> | null;

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


	private results: TMDBResponseList<Array<MediaUserDataKind & { details: (TVShowItem | MovieItem) }>> | null = null;


	public constructor(private readonly store: IStore<AppState, AppAction>) {
	}

	public attached() {
		this.searchEle.focus();
	}

	public resetFilter() {
		this.filter = new TMDBSearchFilters();
	}

	public search() {
		if (!this.filter.query || this.filter.query.trim() === '') {
			this.results = null;
			return;
		}
		// Clear the previous timer
		if (this.debounceTimeout) {
			clearTimeout(this.debounceTimeout);
		}
		// Start a new debounce timer
		this.debounceTimeout = setTimeout(() => {
			this.results = null;
			this.searchMore(); // Call the search function
		}, 300); // Wait 300ms after the user stops typing
	}

	private async searchMore() {
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
		const tvResults = tvs.results.map(tvshow => {
			return {
				kind: MediaKind.TVShow,
				details: tvshow,
			};
		})

		let movieFilter: SearchMoviesFilters = {
			query: this.filter.query,
			page: nextPage,
			include_adult: this.filter.include_adult,
			language: this.filter.language,
			primary_release_year: this.filter.year,
		};
		let movies = this.includeMovies ? await this.tmdb.search.movies(movieFilter) : { page: 1, results: [], total_pages: 1, total_results: 0 };
		const movieResults = movies.results.map(movie => {
			return {
				kind: MediaKind.Movie,
				details: movie,
			};
		});

		const newResults = [...tvResults, ...movieResults].sort(this.filterSortBy.function);

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


	public get includeMovies(): boolean {
		return this.filter.format === 'all' || this.filter.format == MediaKind.Movie;
	}
	public get includeTVShows(): boolean {
		return this.filter.format === 'all' || this.filter.format == MediaKind.TVShow;
	}

}
