import { route } from "@aurelia/router";
import { ILogger, inject, IObservation, observable, resolve } from "aurelia";
import { MoviePage } from "../media-page/movie-page/MoviePage";
import { AppState } from "src/core/state/AppState";
import { AppAction } from "src/core/state/AppHandler";
import { SupabaseService } from "src/core/services/SupabaseService";
import { fromState, IStore } from "@aurelia/state";
import { Session } from "@supabase/supabase-js";
import { WatchState } from "src/core/WatchState";
import { MediaKind, MediaUserData } from "src/core/MediaUserData";
import { Movie, TMDB, TVShow } from "@leandrowkz/tmdb";
import { UserDataCache } from "src/core/state/UserDataCache";
import { TMDBDataCache } from "src/core/state/TMDBDataCache";
import { getMainMediaApi, getMediaApi, isMainMediaKind, MediaDetails, UserMediaDetails } from "src/core/Types";

@route({
	id: 'home',
	path: ['', 'home'],
	title: 'Home',
})
@inject(IStore)
export class HomePage {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('HomePage');
	private readonly supabase: SupabaseService = resolve(SupabaseService);
	private readonly tmdb: TMDB = resolve(TMDB);
	private readonly observation = resolve(IObservation);

	@fromState((state: AppState) => state.session)
	public session!: Session | null;
	// @fromState((state: AppState) => state.mediaUserDataCache.mediaUserData)
	// @observable
	// public mediaUserDataCache!: Record<string, MediaUserData> | null;
	@fromState((state: AppState) => state.mediaUserDataCache)
	public mediaUserDataCache!: UserDataCache; // | null;
	@fromState((state: AppState) => state.tmdbDataCache)
	public tmdbData!: TMDBDataCache | null;

	private watchingData: Array<UserMediaDetails> = [];
	private planToWatchData: Array<UserMediaDetails> = [];

	public constructor(private readonly store: IStore<AppState, AppAction>) {
		// this.logger.debug('HomePage constructor', store, supabase);
	}

	bound() {
		this.logger.debug('HomePage created');
		this.observation.watch(this.mediaUserDataCache, (cache) => cache.mediaUserData, this.mediaUserDataCacheChanged.bind(this));
		this.mediaUserDataCacheChanged(null, this.mediaUserDataCache.mediaUserData);
	}

	public async getOrFetch(tmdbId: number, kind: MediaKind) {
		let details = this.tmdbData.get(tmdbId, kind);
		if (!details) {
			const api = getMainMediaApi(this.tmdb, kind);
			details = await api.details(tmdbId);
			this.tmdbData.set(details, kind);
			this.logger.trace(`HomePage: TMDBDataCache Fetched ${MediaKind[kind]} ID ${tmdbId}`);
		} else {
			this.logger.trace(`HomePage: TMDBDataCache hit for ${MediaKind[kind]} ID ${tmdbId}`);
		}
		return details;
	}

	/**
	 * When the mediaUserDataCache changes, update the watching and plan to watch lists details
	 */
	async mediaUserDataCacheChanged(previous: Record<string, MediaUserData>, current: Record<string, MediaUserData>) {
		if (!current) {
			return;
		}
		this.logger.debug('HomePage mediaUserDataCache changed:', previous ? Object.keys(previous).length : -1, Object.keys(current).length);
		// this.logger.debug(`HomePage fetching details for watching and planned media: ${this.getWatching().length}`);

		if (this.watchingData.length > 0 && this.planToWatchData.length > 0) {
			return;
		}

		this.watchingData = await Promise.all(this.getWatching().map(async item => {
			let details = await this.getOrFetch(item.tmdb_id, item.kind);
			return {
				...item,
				details,
			} satisfies UserMediaDetails;
		}));
		this.planToWatchData = await Promise.all(this.getPlanToWatch().map(async item => {
			let details = await this.getOrFetch(item.tmdb_id, item.kind);
			return {
				...item,
				details,
			} satisfies UserMediaDetails;
		}));
	}

	public getWatching() {
		if (!this.mediaUserDataCache)
			return [];
		const values = this.mediaUserDataCache.values(); // Object.values(this.mediaUserDataCache);
		const max = Math.min(values.length, 20); // TODO: Limit here and make a page with all watching medias
		return values
			.filter(mud => mud != undefined && isMainMediaKind(mud.kind) && mud?.state === WatchState.Watching)
			.sort((a, b) => {
				return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
			})
			// .slice(0, max)
			|| [];
	}

	public getPlanToWatch() {
		if (!this.mediaUserDataCache)
			return [];
		const values = this.mediaUserDataCache.values(); //Object.values(this.mediaUserDataCache);
		const max = Math.min(values.length, 20); // TODO: Limit here and make a page with all  planned to watch medias
		return values
			.filter(mud => mud != undefined && isMainMediaKind(mud.kind) && mud?.state === WatchState.PlanToWatch)
			.sort((a, b) => {
				return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
			})
			// .slice(0, max)
			|| [];
	}

}
