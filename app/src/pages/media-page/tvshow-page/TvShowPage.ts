import { ILogger, resolve } from "aurelia";
import { IRouteViewModel, route } from '@aurelia/router';
import { TVShow } from "@leandrowkz/tmdb";
import { MediaKind } from "src/core/MediaUserData";
import { SuperMediaDetails } from "../components/SuperMediaDetails";

@route({
	id: 'tv',
	path: ['tv/:id'],
	title: 'TV Show',
})
export class TvShowPage extends SuperMediaDetails<TVShow> implements IRouteViewModel {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('TvShowPage');

	public get mediaKind(): MediaKind {
		return MediaKind.TVShow;
	}

	public get api() {
		return this.tmdb.tvShows;
	}

	public get posterUrl(): string {
		if (this.media.poster_path) {
			return `https://image.tmdb.org/t/p/w200${this.media.poster_path}`;
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
		return this.media.name;
	}

	public get releaseDate(): string {
		return this.media.first_air_date;
	}

	public get releaseYear(): string {
		return this.media.first_air_date ? this.media.first_air_date.split('-')[0] : 'N/A';
	}

	public get overview(): string {
		return this.media.overview;
	}

}
