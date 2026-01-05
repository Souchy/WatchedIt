import { route } from "@aurelia/router";
import { ILogger, inject, observable, resolve } from "aurelia";
import { MoviePage } from "../movie-page/MoviePage";
import { AppState } from "src/core/state/AppState";
import { AppAction } from "src/core/state/AppHandler";
import { SupabaseService } from "src/core/services/SupabaseService";
import { fromState, IStore } from "@aurelia/state";
import { Session } from "@supabase/supabase-js";
import { WatchState } from "src/core/WatchState";
import { MediaKind, MediaUserData } from "src/core/MediaUserData";
import { Movie, MovieItem, SearchMultiSearchFilters, SearchMultiSearchResponse, TMDB, TMDBResponseList, TVShow, TVShowItem } from "@leandrowkz/tmdb";

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
export type FilterSort = {
	value: string;
	label: string;
	function: (a: MovieItem | TVShowItem, b: MovieItem | TVShowItem) => number;
};
const filterSorts: FilterSort[] = [
	{
		value: 'popularity',
		label: 'Popularity',
		function: (a: MovieItem | TVShowItem, b: MovieItem | TVShowItem) => {
			return (b.popularity! - a.popularity!);
		}
	},
	{
		value: 'vote_average',
		label: 'Average Vote',
		function: (a: MovieItem | TVShowItem, b: MovieItem | TVShowItem) => {
			return (b.vote_average! - a.vote_average!);
		}
	},
	{
		value: 'release_date',
		label: 'Release Date',
		function: (a: MovieItem | TVShowItem, b: MovieItem | TVShowItem) => {
			const dateA = 'first_air_date' in a ? a.first_air_date : a.release_date;
			const dateB = 'first_air_date' in b ? b.first_air_date : b.release_date;
			return (dateB || '').localeCompare(dateA || '');
		}
	},
]

@route({
	id: 'search',
	path: ['search'],
	title: 'Search',
})
@inject(IStore)
export class SearchPage {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('SearchPage');
	private readonly supabase: SupabaseService = resolve(SupabaseService);
	private readonly tmdb: TMDB = resolve(TMDB);

	@fromState((state: AppState) => state.session)
	public session!: Session | null;
	@fromState((state: AppState) => state.mediaUserDataMap)
	@observable
	public mediaUserDataMap!: Record<string, MediaUserData> | null;


	private searchQuery: string = '';
	private filterYear: number | undefined = undefined;
	private filterIncludeAdult: boolean = true;
	private filterFormat: MediaKind | 'all' = 'all'; // 'all' | 'tvshow' | 'movie' = 'all'; // tv show, movie, tv short, special, ova, ona, music

	// private filterYear: Range = new Range();
	private filterSeason: 'winter' | 'spring' | 'summer' | 'fall' | undefined = undefined;
	private filterAiringStatus: 'airing' | 'finished' | 'not_yet_aired' | 'cancelled' | undefined = undefined;
	private filterEpisodeCount: Range = new Range();
	private filterCountryOfOrigin: string | undefined = undefined;
	private filterGenres: string[] = [];
	// private filterSortBy: 'popularity' | 'release_date' | 'revenue' | 'primary_release_date' | 'original_title' | 'vote_average' | 'vote_count' = 'popularity';
	private filterSortBy: FilterSort = filterSorts[0];


	// private results: Array<Movie | TVShow> = [];
	// private results: SearchMultiSearchResponse | null = null;
	private results: TMDBResponseList<Array<MediaUserDataKind & { details: (TVShowItem | MovieItem) }>> | null = null;


	public constructor(private readonly store: IStore<AppState, AppAction>) {
	}

	public async search() {
		// let res = await this.tmdb.search.multiSearch(this.query);

		this.results = null;
		await this.searchMore();

		this.logger.debug('Search results:', this.results);
	}

	public get includeMovies(): boolean {
		return this.filterFormat === 'all' || this.filterFormat == MediaKind.Movie;
	}
	public get includeTVShows(): boolean {
		return this.filterFormat === 'all' || this.filterFormat == MediaKind.TVShow;
	}


	public async searchMore() {
		const nextPage = (this.results?.page || 0) + 1;
		this.logger.debug('Searching more, page', nextPage, this.searchQuery, this.filterFormat, this.includeMovies, this.includeTVShows);

		let tvs = this.includeTVShows ? await this.tmdb.search.tvShows({
			query: this.searchQuery,
			page: nextPage,
			// first_air_date_year: this.filterYear,
			include_adult: this.filterIncludeAdult,
			language: 'en-US',
		}) : { page: 1, results: [], total_pages: 1, total_results: 0 };
		const tvResults = tvs.results.map(tvshow => {
			return {
				kind: MediaKind.TVShow,
				details: tvshow,
			};
		})

		let movies = this.includeMovies ? await this.tmdb.search.movies({
			query: this.searchQuery,
			page: nextPage,
			// primary_release_year: this.filterYear,
			include_adult: this.filterIncludeAdult,
			language: 'en-US',
		}) : { page: 1, results: [], total_pages: 1, total_results: 0 };
		const movieResults = movies.results.map(movie => {
			return {
				kind: MediaKind.Movie,
				details: movie,
			};
		});

		const newResults = [...tvResults, ...movieResults].sort((a, b) => this.filterSortBy.function(a.details, b.details));

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

	// public get query(): SearchMultiSearchFilters {
	// 	return {
	// 		query: this.searchQuery,
	// 		page: 1,
	// 	};
	// }

}
