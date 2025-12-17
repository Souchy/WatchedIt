import { MovieNowPlayingResponse, MoviePopularResponse, MovieTopRatedResponse, MovieUpcomingResponse, TMDB, TMDBResponseError } from '@leandrowkz/tmdb';
import { resolve, ILogger } from 'aurelia';

export class TrendingMovies {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('TrendingMovies');
	private readonly tmdb = resolve(TMDB);

	private searchingPromise: Promise<any> | null = null;
	private nowPlaying: MovieNowPlayingResponse | null = null;
	private topRated: MovieTopRatedResponse | null = null
	private popular: MoviePopularResponse| null = null;
	private upcoming: MovieUpcomingResponse | null = null;

	created() {
		this.searchingPromise = this.searchMovies();
	}
	bound() {
		
	}

	async searchMovies() {
		try {
			// this.movies = await tmdb.search.movies({ query: 'Fight Club' });
			this.nowPlaying = await this.tmdb.movies.nowPlaying();
			this.topRated = await this.tmdb.movies.topRated();
			this.popular = await this.tmdb.movies.popular();
			this.upcoming = await this.tmdb.movies.upcoming();

			this.logger.debug('Now Playing Movies:', this.nowPlaying);
			this.logger.debug('Top Rated Movies:', this.topRated);
			this.logger.debug('Popular Movies:', this.popular);
			this.logger.debug('Upcoming Movies:', this.upcoming);
		} catch (error) {
			if (error instanceof TMDBResponseError) {
				this.logger.error('TMDB Error:', error.message);
				this.logger.error('HTTP Status:', error.statusCode);
				this.logger.error('TMDB Status Code:', error.statusMessage);
			} else {
				this.logger.error('Unknown error:', error);
			}
		}
	}

}
