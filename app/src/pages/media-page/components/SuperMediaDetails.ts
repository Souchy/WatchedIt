import { INavigationOptions, Params, RouteNode } from "@aurelia/router";
import { fromState } from "@aurelia/state";
import { TMDB, TVShow, TMDBResponseList, TVShowItem, TVShowCreditsResponse, Movie, MovieItem, MovieCreditsResponse, MoviesAPI, TVShowsAPI, TVSeason, TVSeasonsAPI, TVShowWatchProvidersResponse, MovieWatchProvidersResponse, Video } from "@leandrowkz/tmdb";
import { Session } from "@supabase/supabase-js";
import { ILogger, resolve } from "aurelia";
import { GenresMap } from "src/core/Genres";
import { MediaKind, MediaUserData } from "src/core/MediaUserData";
import { SupabaseService } from "src/core/services/SupabaseService";
import { AppState, SearchEngine } from "src/core/state/AppState";
import { UserDataCache } from "src/core/state/UserDataCache";
import { isMainMediaKind } from "src/core/Types";
import { AvailableButtonsPerWatchState, ResetButtonMap, WatchState, WatchStateButton } from "src/core/WatchState";
import rightBarHtml from '../components/right-bar/RightBar.html?raw';
import stateControlsHtml from '../components/state-controls/StateControls.html?raw';
import sectionMediaHtml from '../components/section-media/SectionMedia.html?raw';
import './right-bar/RightBar.scss'
import './section-media/SectionMedia.scss'
import './state-controls/StateControls.scss'

export enum SectionMediasTab {
	Trailers = "Trailers",
	Teasers = "Teasers",
	AllVideos = "AllVideos",
	Posters = "Posters",
	Backdrops = "Backdrops"
}

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
	@fromState((state: AppState) => state.mediaUserDataCache)
	protected userDataCache!: UserDataCache;
	@fromState((state: AppState) => state.searchEngines)
	protected appSearchEngines!: SearchEngine[];

	mediaId: number;
	seasonId: number;
	media: T;
	similar: TMDBResponseList<(MovieItem | TVShowItem)[]> | null;
	credits: MovieCreditsResponse | TVShowCreditsResponse | null;
	providers: MovieWatchProvidersResponse | TVShowWatchProvidersResponse | null;
	videos: Video[] = [];
	activeMediaTab: SectionMediasTab = SectionMediasTab.Trailers;

	//#region Properties
	abstract get mediaKind(): MediaKind;
	abstract get api(): MoviesAPI | TVShowsAPI;

	abstract get posterUrl(): string;
	abstract get backdropUrl(): string;
	abstract get title(): string;
	abstract get releaseDate(): string;
	abstract get releaseYear(): string;
	abstract get overview(): string;

	public get locale() {
		return "CA"; // "US"
	}
	public get videoTrailers() {
		return this.videos.filter(v => v.type === "Trailer");
	}
	public get videoTeasers() {
		return this.videos.filter(v => v.type as string === "Teaser");
	}
	public get allVideos() {
		return this.videos;
	}
	public get networkLogoPath(): string | null {
		if (isMainMediaKind(this.mediaKind) && this.mediaKind === MediaKind.TVShow) {
			const tvShow = this.media as TVShow;
			if (tvShow.networks && tvShow.networks.length > 0) {
				return `https://image.tmdb.org/t/p/original${tvShow.networks[0].logo_path}`;
			}
		}
		return null;
	}
	public get searchEngines() {
		const codedTitle = encodeURIComponent(this.title);
		return this.appSearchEngines.map(engine => {
			let url = engine.url
				.replace('%n', this.mediaId.toString())
				.replace("%t", this.mediaKind === MediaKind.TVShow ? "tv" : "movie")
				.replace('%s', codedTitle + (engine.includeYear ? ' ' + this.releaseYear : ''));
			return {
				name: engine.name,
				url,
			}
		});
	}
	//#endregion

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

		await this.fetchMoreSimilar();

		await this.fetchCredits();
		// this.credits.cast.sort((a, b) => a.order - b.order);
		this.credits.crew.sort((a, b) => b.popularity - a.popularity);
		this.super_logger.debug('Loaded Media credits:', this.credits);

		this.providers = await this.api.watchProviders(this.mediaId);
		this.super_logger.debug('Loaded Media watch providers:', this.providers);
		this.providers.results = this.providers.results[this.locale];

		await this.fetchVideos();
	}

	//#region Components templates
	public get rightBarTemplate() {
		// return import('../components/right-bar/RightBar.html?raw').then(m => m.default);
		return rightBarHtml;
	}
	public get stateControlsTemplate() {
		// return import('../components/state-controls/StateControls.html?raw').then(m => m.default);
		return stateControlsHtml;
	}
	public get sectionMediaTemplate() {
		// return import('../components/section-media/SectionMedia.html?raw').then(m => m.default);
		return sectionMediaHtml;
	}
	//#endregion


	//#region Fetching data
	public async fetchDetails() {
		this.media = await this.api.details(this.mediaId, {
			append_to_response: [
				"credits",
				"videos",
				"images",
				"keywords",
				"created_by"
			] as any
		}) as T;
	}
	public async fetchCredits() {
		this.credits = 'credits' in this.media
			? (this.media as any).credits
			: await this.api.credits(this.mediaId);
	}
	public async fetchVideos() {
		const videos = 'videos' in this.media
			? this.media.videos as { results: Video[] }
			: await this.api.videos(this.mediaId);
		this.videos = videos.results.sort((a: Video, b: Video) => {
			return new Date(a.published_at).getTime() - new Date(b.published_at).getTime();
		});
	}
	public async fetchMoreSimilar() {
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
	//#endregion

	// Dynamically set the document title
	private setDocumentTitle() {
		document.title = this.title + ' (' + this.releaseYear + ')'; // - Watchedit';
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
		return this.userDataCache.getWatchState(this.media.id, this.mediaKind);
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
