import { ILogger, resolve } from "aurelia";
import { IRouteViewModel, Params, route, RouteNode } from '@aurelia/router';
import { TVSeason, TVShow } from "@leandrowkz/tmdb";
import { MediaKind } from "src/core/MediaUserData";
import { SuperMediaDetails } from "../components/SuperMediaDetails";

@route({
	id: 'season',
	path: ['tv/:id/:seasonId'],
	// title: 'TV Show',
})
export class SeasonPage extends SuperMediaDetails<TVSeason> implements IRouteViewModel {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('SeasonPage');

	private tvshow: TVShow | null = null;

	public get mediaKind(): MediaKind {
		return MediaKind.TVShow;
	}

	public get api() {
		return this.tmdb.tvShows;
	}

	public async fetchDetails() {
		this.media = await this.tmdb.tvSeasons.details(this.mediaId, this.seasonId);
		this.tvshow = await this.tmdb.tvShows.details(this.mediaId);
		// this.tmdb.tvShows.seas
	}

	public get posterUrl(): string {
		if (this.media.poster_path) {
			return `https://image.tmdb.org/t/p/w200${this.media.poster_path}`;
		}
		return '';
	}

	public get backdropUrl(): string {
		if (this.tvshow && this.tvshow.backdrop_path) {
			return `https://image.tmdb.org/t/p/original${this.tvshow.backdrop_path}`;
		}
		return '';
	}

	public get title(): string {
		return this.media.name;
	}

	public get releaseDate(): string {
		return this.media.air_date;
	}

	public get releaseYear(): string {
		return this.media.air_date ? this.media.air_date.split('-')[0] : 'N/A';
	}

	public get rating() {
		return (this.media as any).vote_average;
	}

	public get overview(): string {
		return this.media.overview;
	}

}
