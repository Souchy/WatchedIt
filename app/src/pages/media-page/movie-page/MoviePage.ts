import { ILogger, resolve } from "aurelia";
import { IRouteViewModel, route } from '@aurelia/router';
import { Movie, MoviesAPI, TVShowsAPI } from "@leandrowkz/tmdb";
import { MediaKind } from "src/core/MediaUserData";
import { SuperMediaDetails } from "../components/SuperMediaDetails";

@route({
	id: 'movie',
	path: ['movie/:id'],
	// title: 'Movie',
})
export class MoviePage extends SuperMediaDetails<Movie> implements IRouteViewModel {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('MoviePage');

	public get mediaKind(): MediaKind {
		return MediaKind.Movie;
	}

	public get api(): MoviesAPI | TVShowsAPI {
		return this.tmdb.movies;
	}

	public get posterUrl(): string {
		if (this.media.poster_path) {
			return `https://image.tmdb.org/t/p/w300${this.media.poster_path}`;
		}
		return '';
	}
	public get backdropUrl(): string {
		if (this.media.backdrop_path) {
			return `https://image.tmdb.org/t/p/original${this.media.backdrop_path}`;
		}
		return '';
	}

	public get title(): string {
		return this.media.title;
	}

	public get releaseDate(): string {
		return this.media.release_date;
	}

	public get releaseYear(): string {
		return this.media.release_date ? this.media.release_date.split('-')[0] : 'N/A';
	}

	public get rating() {
		return this.media.vote_average;
	}

	public get overview(): string {
		return this.media.overview;
	}

}
