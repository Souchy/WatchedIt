import { INavigationOptions, Params, RouteNode } from "@aurelia/router";
import { fromState } from "@aurelia/state";
import { TMDB, TVShow, TMDBResponseList, TVShowItem, TVShowCreditsResponse, Movie, MovieItem, MovieCreditsResponse, MoviesAPI, TVShowsAPI, TVSeason, TVSeasonsAPI } from "@leandrowkz/tmdb";
import { Session } from "@supabase/supabase-js";
import { ILogger, resolve } from "aurelia";
import { GenresMap } from "src/core/Genres";
import { MediaKind, MediaUserData } from "src/core/MediaUserData";
import { SupabaseService } from "src/core/services/SupabaseService";
import { AppState } from "src/core/state/AppState";
import { AvailableButtonsPerWatchState, ResetButtonMap, WatchState, WatchStateButton } from "src/core/WatchState";

export interface ISuperMediaDetails<T extends Movie | TVShow | TVSeason> extends INavigationOptions {
	mediaId: number;
	media: T;
	similar: TMDBResponseList<(MovieItem | TVShowItem)[]> | null;
	credits: MovieCreditsResponse | TVShowCreditsResponse | null;

	get mediaKind(): MediaKind;
	get api(): MoviesAPI | TVShowsAPI | TVSeasonsAPI;


	get posterUrl(): string;
	get backdropUrl(): string;
	get title(): string;
	get releaseDate(): string;
	get releaseYear(): string;
	get overview(): string;
}

export abstract class SuperMediaDetails<T extends Movie | TVShow | TVSeason> implements ISuperMediaDetails<T> {

	private readonly super_logger: ILogger = resolve(ILogger).scopeTo('SuperMediaDetails');
	protected readonly tmdb = resolve(TMDB);
	protected readonly supabase = resolve(SupabaseService);
	protected readonly genresMap = resolve(GenresMap);
	@fromState((state: AppState) => state.session)
	protected session: Session | null = null;
	@fromState((state: AppState) => state.mediaUserDataMap)
	protected dataMap!: Record<number, MediaUserData> | null;

	mediaId: number;
	seasonId: number;
	media: T;
	similar: TMDBResponseList<(MovieItem | TVShowItem)[]> | null;
	credits: MovieCreditsResponse | TVShowCreditsResponse | null;

	abstract get mediaKind(): MediaKind;
	abstract get api(): MoviesAPI | TVShowsAPI;

	abstract get posterUrl(): string;
	abstract get backdropUrl(): string;
	abstract get title(): string;
	abstract get releaseDate(): string;
	abstract get releaseYear(): string;
	abstract get overview(): string;

	canLoad(params: Params) {
		this.mediaId = parseInt(params.id ?? '');
		this.seasonId = parseInt(params.seasonId ?? '');
		this.super_logger.debug('Media ID from route params:', this.mediaId);
		return !!this.mediaId;
	}

	async loading?(params: Params, next: RouteNode, current: RouteNode | null): Promise<void> {
		// this.mediaId = parseInt(params.id ?? '');
		// this.seasonId = parseInt(params.seasonId ?? '');
		await this.fetchDetails();
		this.setDocumentTitle();
		this.super_logger.debug('Loaded Media details:', this.media);
		await this.moreSimilar();
		await this.fetchCredits();
		// this.credits.cast.sort((a, b) => a.order - b.order);
		this.credits.crew.sort((a, b) => b.popularity - a.popularity);
		this.super_logger.debug('Loaded Media credits:', this.credits);
		// next.title = this.title + ' (' + this.releaseYear + ') - Watchedit';
		// current.title = this.title + ' (' + this.releaseYear + ') - Watchedit';
	}

	public async fetchDetails() {
		this.media = await this.api.details(this.mediaId) as T;
	}
	public async fetchCredits() {
		this.credits = await this.api.credits(this.mediaId);
	}

	// Dynamically set the document title
	private setDocumentTitle() {
		document.title = this.title + ' (' + this.releaseYear + ')'; // - Watchedit';
	}

	public async moreSimilar() {
		if (!this.similar) {
			this.similar = await this.api.recommendations(this.mediaId); // similar(this.mediaId);
			this.super_logger.debug('Loaded similar Medias:', this.similar);
			return;
		}
		const nextPage = this.similar.page + 1;
		const newSimilar = await this.api.recommendations(this.mediaId, { page: nextPage }); // similar(this.mediaId, { page: nextPage });
		this.similar.results.push(...newSimilar.results);
		this.similar.page = newSimilar.page;
		this.similar.total_pages = newSimilar.total_pages;
		this.similar.total_results = newSimilar.total_results;
		this.super_logger.debug('Loaded more similar Medias, page', nextPage, ':', newSimilar);
	}

	//#region State properties
	public get availableWatchStateButtons(): WatchStateButton[] {
		if (!this.session)
			return [];
		return AvailableButtonsPerWatchState[this.watchState];
	}
	public get resetWatchStateButton(): WatchStateButton | null {
		return ResetButtonMap.get(this.watchState);
	}
	public get watchState(): WatchState {
		if (!this.media)
			return WatchState.Unlisted;
		return this.dataMap && this.dataMap[this.media.id]
			? this.dataMap[this.media.id].state
			: WatchState.Unlisted;
	}
	public set watchState(value: WatchState) {
		if (!this.media)
			return;
		this.super_logger.debug(`Watch state changed to: ${value} for media ID: ${this.media.id}`);
		this.supabase.updateMediaUserData(this.media.id, this.mediaKind, {
			state: value,
		}).then(success => {
			this.super_logger.debug(`Supabase updateMediaUserData completed for kind ${this.mediaKind}, ID: ${this.media.id} with success: ${success} and watchstate: ${value}`);
		});
	}
	//#endregion

	//#region Actions
	private clickWatchStateButton(btn: WatchStateButton) {
		this.watchState = btn.setWatchState;
	}
	//#endregion
}
