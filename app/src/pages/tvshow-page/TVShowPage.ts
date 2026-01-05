import { ILogger, resolve } from "aurelia";
import { IRouteViewModel, Params, route, RouteNode } from '@aurelia/router';
import { Movie, TMDB, TMDBResponseList, TVShow, TVShowItem } from "@leandrowkz/tmdb";


@route({
	id: 'tv',
	path: ['tv/:id'],
	title: 'TV Show',
})
export class TVShowPage implements IRouteViewModel {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('TVShowPage');
	private readonly tmdb = resolve(TMDB);

	private tvshowId: number;
	private tvshow: TVShow;
	private similar: TMDBResponseList<TVShowItem[]> | null = null;


	canLoad(params: Params) {
		this.tvshowId = parseInt(params.id ?? '');
		this.logger.debug('TV Show ID from route params:', this.tvshowId);
		return !!this.tvshowId;
	}
	async loading?(params: Params, next: RouteNode, current: RouteNode | null): Promise<void> {
		this.tvshowId = parseInt(params.id ?? '');
		this.tvshow = await this.tmdb.tvShows.details(this.tvshowId);
		this.logger.debug('Loaded TV show details:', this.tvshow);
		await this.moreSimilar();
	}

	public async moreSimilar() {
		if (!this.similar) {
			this.similar = await this.tmdb.tvShows.recommendations(this.tvshowId); // similar(this.tvshowId);
			this.logger.debug('Loaded similar TV shows:', this.similar);
			return;
		}
		const nextPage = this.similar.page + 1;
		const newSimilar = await this.tmdb.tvShows.recommendations(this.tvshowId, { page: nextPage }); // similar(this.tvshowId, { page: nextPage });
		this.similar.results.push(...newSimilar.results);
		this.similar.page = newSimilar.page;
		this.similar.total_pages = newSimilar.total_pages;
		this.similar.total_results = newSimilar.total_results;
		this.logger.debug('Loaded more similar TV shows, page', nextPage, ':', newSimilar);
	}

	public get posterUrl(): string {
		if (this.tvshow.poster_path) {
			return `https://image.tmdb.org/t/p/w200${this.tvshow.poster_path}`;
		}
		return '';
	}

	public get title(): string {
		return this.tvshow.name;
	}

	public get releaseDate(): string {
		return this.tvshow.first_air_date;
	}

	public get releaseYear(): string {
		return this.tvshow.first_air_date ? this.tvshow.first_air_date.split('-')[0] : 'N/A';
	}

	public get overview(): string {
		return this.tvshow.overview;
	}

}
