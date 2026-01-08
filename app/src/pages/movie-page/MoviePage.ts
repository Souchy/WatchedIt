import { ILogger, resolve } from "aurelia";
import { IRouteViewModel, Params, route, RouteNode } from '@aurelia/router';
import { Movie, MovieCreditsResponse, MovieItem, TMDB, TMDBResponseList } from "@leandrowkz/tmdb";


@route({
	id: 'movie',
	path: ['movie/:id'],
	title: 'Movie',
})
export class MoviePage implements IRouteViewModel {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('MoviePage');
	private readonly tmdb = resolve(TMDB);

	private movieId: number;
	private movie: Movie;
	private similar: TMDBResponseList<MovieItem[]> | null = null;
	private credits: MovieCreditsResponse | null = null;

	canLoad(params: Params) {
		this.movieId = parseInt(params.id ?? '');
		this.logger.debug('Movie ID from route params:', this.movieId);
		return !!this.movieId;
	}
	async loading?(params: Params, next: RouteNode, current: RouteNode | null): Promise<void> {
		this.movieId = parseInt(params.id ?? '');
		this.movie = await this.tmdb.movies.details(this.movieId);
		this.logger.debug('Loaded movie details:', this.movie);
		await this.moreSimilar();
		this.credits = await this.tmdb.movies.credits(this.movieId);
		// this.credits.cast.sort((a, b) => a.order - b.order);
		this.credits.crew.sort((a, b) => b.popularity - a.popularity);
		this.logger.debug('Loaded movie credits:', this.credits);
	}
	
	public async moreSimilar() {
		if (!this.similar) {
			this.similar = await this.tmdb.movies.recommendations(this.movieId);
			this.logger.debug('Loaded similar movies:', this.similar);
			return;
		}
		const nextPage = this.similar.page + 1;
		const newSimilar = await this.tmdb.movies.recommendations(this.movieId, { page: nextPage });
		this.similar.results.push(...newSimilar.results);
		this.similar.page = newSimilar.page;
		this.similar.total_pages = newSimilar.total_pages;
		this.similar.total_results = newSimilar.total_results;
		this.logger.debug('Loaded more similar movies, page', nextPage, ':', newSimilar);
	}

	public get posterUrl(): string {
		if (this.movie.poster_path) {
			return `https://image.tmdb.org/t/p/w200${this.movie.poster_path}`;
		}
		return '';
	}
	public get backdropUrl(): string {
		if (this.movie.backdrop_path) {
			return `https://image.tmdb.org/t/p/original${this.movie.backdrop_path}`;
		}
		return '';
	}

	public get title(): string {
		return this.movie.title;
	}

	public get releaseDate(): string {
		return this.movie.release_date;
	}

	public get releaseYear(): string {
		return this.movie.release_date ? this.movie.release_date.split('-')[0] : 'N/A';
	}

	public get overview(): string {
		return this.movie.overview;
	}

}
