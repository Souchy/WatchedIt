import { MovieResultItem, PaginatedResponse, TMDB, TMDBError } from '@lorenzopant/tmdb';
import { resolve, ILogger } from 'aurelia';

export class TrendingMovies {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('TrendingMovies');
	private readonly tmdb = resolve(TMDB);

	private searchingPromise: Promise<any> | null = null;
	// private movies: PaginatedResponse<MovieResultItem> | null = null;
	private nowPlaying: PaginatedResponse<MovieResultItem> | null = null;
	private topRated: PaginatedResponse<MovieResultItem> | null = null
	private popular: PaginatedResponse<MovieResultItem> | null = null;
	private upcoming: PaginatedResponse<MovieResultItem> | null = null;

	created() {
		this.searchingPromise = this.searchMovies();
	}
	bound() {
		
	}

	async searchMovies() {
		try {
			// this.movies = await tmdb.search.movies({ query: 'Fight Club' });
			this.nowPlaying = await this.tmdb.movie_lists.now_playing();
			this.topRated = await this.tmdb.movie_lists.top_rated();
			this.popular = await this.tmdb.movie_lists.popular();
			this.upcoming = await this.tmdb.movie_lists.upcoming();

			this.logger.debug('Now Playing Movies:', this.nowPlaying);
			this.logger.debug('Top Rated Movies:', this.topRated);
			this.logger.debug('Popular Movies:', this.popular);
			this.logger.debug('Upcoming Movies:', this.upcoming);
		} catch (error) {
			if (error instanceof TMDBError) {
				this.logger.error('TMDB Error:', error.message);
				this.logger.error('HTTP Status:', error.http_status_code);
				this.logger.error('TMDB Status Code:', error.tmdb_status_code);
			} else {
				this.logger.error('Unknown error:', error);
			}
		}
	}

}
