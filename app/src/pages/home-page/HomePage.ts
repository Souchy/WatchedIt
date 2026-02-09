import { route } from "@aurelia/router";
import { all, ILogger, inject, IObservation, observable, resolve } from "aurelia";
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
	public tmdbData!: TMDBDataCache;

	private watchingData: Array<UserMediaDetails> = [];
	private planToWatchData: Array<UserMediaDetails> = [];

	public constructor(private readonly store: IStore<AppState, AppAction>) {
		// this.logger.debug('HomePage constructor', store, supabase);
	}

	bound() {
		this.logger.debug('HomePage created');
		this.observation.watch(this.mediaUserDataCache, (cache) => cache.mediaUserData, this.mediaUserDataCacheChanged.bind(this));
		this.mediaUserDataCacheChanged(undefined, this.mediaUserDataCache.mediaUserData);
	}

	public async get_bulk_items(tmdbIds: number[], kind: MediaKind): Promise<MediaDetails[] | undefined> {
		if (tmdbIds.length === 0) {
			return [];
		}

		// Determine endpoint based on MediaKind
		const endpoint = kind === MediaKind.Movie
			? 'https://watched-it-six.vercel.app/api/get_bulk_movies'
			: 'https://watched-it-six.vercel.app/api/get_bulk_tv_series';

		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ ids: tmdbIds }),
			});

			if (!response.ok) {
				this.logger.error(`API error: ${response.status} ${response.statusText}`);
				return [];
			}

			const items: any[] = await response.json();
			this.logger.debug(`Fetched ${items.length} items from ${endpoint}`, items.length);
			return items;
		} catch (err) {
			this.logger.error('API fetch error:', err);
			return undefined;
		}
	}

	public async getOrFetch(tmdbId: number, kind: MediaKind): Promise<MediaDetails> {
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
	async mediaUserDataCacheChanged(previous: Record<string, MediaUserData> | undefined, current: Record<string, MediaUserData> | undefined) {
		if (!current || !this.mediaUserDataCache) {
			return;
		}
		this.logger.debug('HomePage mediaUserDataCache changed:', previous ? Object.keys(previous).length : -1, Object.keys(current).length);

		if (this.watchingData.length > 0 && this.planToWatchData.length > 0) {
			return;
		}

		const values = this.mediaUserDataCache.values();
		let stateCount: Record<string, number> = {
			[WatchState.Watching]: 0,
			[WatchState.PlanToWatch]: 0,
		};
		let userItemData = new Map<WatchState, Array<UserMediaDetails>>([
			[WatchState.Watching, []],
			[WatchState.PlanToWatch, []]
		]);
		let movieIds: number[] = [];
		let tvIds: number[] = [];
		for (const mud of values) {
			if (mud != undefined && isMainMediaKind(mud.kind) && (mud.state === WatchState.Watching || mud.state === WatchState.PlanToWatch)) {
				if (stateCount[mud.state] >= 20) {
					continue;
				}
				let itemData = this.tmdbData.get(mud.tmdb_id, mud.kind);
				if (itemData != null) {
					userItemData.get(mud.state)!.push({
						...mud,
						details: itemData,
					});
				} else if (mud.kind === MediaKind.Movie) {
					movieIds.push(mud.tmdb_id);
				} else if (mud.kind === MediaKind.TVShow) {
					tvIds.push(mud.tmdb_id);
				}
				stateCount[mud.state]++;
			}
		}
		let tvItems = await this.get_bulk_items(tvIds, MediaKind.TVShow);
		if (tvItems === undefined) {
			tvItems = await Promise.all(tvIds.map(id => this.getOrFetch(id, MediaKind.TVShow)));
		}
		let movieItems = await this.get_bulk_items(movieIds, MediaKind.Movie);
		if (movieItems === undefined) {
			movieItems = await Promise.all(movieIds.map(id => this.getOrFetch(id, MediaKind.Movie)));
		}
		const allItems = new Map<MediaKind, any[]>([
			[MediaKind.Movie, movieItems],
			[MediaKind.TVShow, tvItems],
		]);
		for (const kind of allItems.keys()) {
			for (const item of allItems.get(kind) || []) {
				const mud = this.mediaUserDataCache.get(item.id, kind)!;
				userItemData.get(mud.state)!.push({
					...mud,
					details: item,
				});
			}
		}
		this.watchingData = userItemData.get(WatchState.Watching)!.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
		this.planToWatchData = userItemData.get(WatchState.PlanToWatch)!.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
		this.logger.debug(`HomePage updated watchingData (${this.watchingData.length}) and planToWatchData (${this.planToWatchData.length})`);
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
