import { MovieNowPlayingResponse, MoviePopularResponse, MovieTopRatedResponse, MovieUpcomingResponse, TMDB, TMDBResponseError, TVShowPopularResponse, TVShowsAPI } from '@leandrowkz/tmdb';
import { resolve, ILogger } from 'aurelia';

export class TrendingMovies {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('TrendingMovies');
	private readonly tmdb = resolve(TMDB);

	private searchingPromise: Promise<any> | null = null;
	private popularShows: TVShowPopularResponse | null = null;
	private nowPlaying: MovieNowPlayingResponse | null = null;
	private topRated: MovieTopRatedResponse | null = null
	private popular: MoviePopularResponse | null = null;
	private upcoming: MovieUpcomingResponse | null = null;


	created() {
		this.searchingPromise = this.searchMovies();
	}
	bound() {

	}

	async searchMovies() {
		try {
			// this.movies = await tmdb.search.movies({ query: 'Fight Club' });
			let nowPlaying = await this.tmdb.movies.nowPlaying();
			this.topRated = await this.tmdb.movies.topRated();
			this.popular = await this.tmdb.movies.popular();
			this.upcoming = await this.tmdb.movies.upcoming();
			// nowPlaying.results = nowPlaying.results.slice(0, 2);
			this.nowPlaying = nowPlaying;

			this.logger.trace('Now Playing Movies:', this.nowPlaying);
			this.logger.trace('Top Rated Movies:', this.topRated);
			this.logger.trace('Popular Movies:', this.popular);
			this.logger.trace('Upcoming Movies:', this.upcoming);

			this.popularShows = await this.tmdb.tvShows.popular();
			this.logger.trace('Popular TV Shows:', this.popularShows);
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
