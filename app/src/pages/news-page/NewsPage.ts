

import { route } from '@aurelia/router';
import { MovieNowPlayingResponse, MoviePopularResponse, MovieTopRatedResponse, MovieUpcomingResponse, TMDB, TMDBResponseError, TrendingResponse, TVShowPopularResponse, TVShowsAPI } from '@leandrowkz/tmdb';
import { resolve, ILogger } from 'aurelia';

@route({
	id: 'news',
	path: ['news'],
	title: 'News',
})
export class NewsPage {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('NewsPage');
	private readonly tmdb = resolve(TMDB);

	private searchingPromise: Promise<any> | null = null;
	private popularShows: TVShowPopularResponse | null = null;
	private nowPlaying: MovieNowPlayingResponse | null = null;
	private topRated: MovieTopRatedResponse | null = null
	private popular: MoviePopularResponse | null = null;
	private upcoming: MovieUpcomingResponse | null = null;
	private trending: TrendingResponse | null = null;


	created() {
		this.searchingPromise = this.searchMovies();
	}
	bound() {

	}

	async searchMovies() {
		try {
			this.trending = await this.tmdb.trending.getTrending('all', 'week');

			// this.movies = await tmdb.search.movies({ query: 'Fight Club' });
			let nowPlaying = await this.tmdb.movies.nowPlaying();
			this.topRated = await this.tmdb.movies.topRated();
			this.popular = await this.tmdb.movies.popular();
			this.upcoming = await this.tmdb.movies.upcoming({
				region: 'US',
			});
			this.upcoming.results = this.upcoming.results.filter(m => {
				// Filter out movies that have already been released
				const releaseDate = new Date(m.release_date);
				const today = new Date();
				return releaseDate >= today;
			});
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
