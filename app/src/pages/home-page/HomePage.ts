import { route } from "@aurelia/router";
import { ILogger, inject, observable, resolve } from "aurelia";
import { MoviePage } from "../movie-page/MoviePage";
import { AppState } from "src/core/state/AppState";
import { AppAction } from "src/core/state/AppHandler";
import { SupabaseService } from "src/core/services/SupabaseService";
import { fromState, IStore } from "@aurelia/state";
import { Session } from "@supabase/supabase-js";
import { WatchState } from "src/core/WatchState";
import { MediaKind, MediaUserData } from "src/core/MediaUserData";
import { Movie, TMDB, TVShow } from "@leandrowkz/tmdb";


@route({
	id: 'home',
	path: ['', 'home'],
	title: 'Home',
})
@inject(IStore, SupabaseService)
export class HomePage {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('HomePage');
	private readonly supabase: SupabaseService = resolve(SupabaseService);
	private readonly tmdb: TMDB = resolve(TMDB);

	@fromState((state: AppState) => state.session)
	public session!: Session | null;
	@fromState((state: AppState) => state.mediaUserDataMap)
	@observable
	public mediaUserDataMap!: Record<string, MediaUserData> | null;

	private watchingData: Array<MediaUserData & { details: Movie | TVShow }> = [];
	private planToWatchData: Array<MediaUserData & { details: Movie | TVShow }> = [];

	public constructor(private readonly store: IStore<AppState, AppAction>) {
		// this.logger.debug('HomePage constructor', store, supabase);
	}

	/**
	 * When the mediaUserDataMap changes, update the watching and plan to watch lists details
	 */
	async mediaUserDataMapChanged(previous: Record<string, MediaUserData>, current: Record<string, MediaUserData>) {
		this.logger.debug('HomePage mediaUserDataMap changed:', Object.keys(this.mediaUserDataMap).length);
		if (!current) {
			return;
		}	

		this.logger.debug(`HomePage fetching details for watching and planned media: ${this.watching.length}`);

		this.watchingData = await Promise.all(this.watching.map(async item => {
			const api = item.kind === MediaKind.Movie ? this.tmdb.movies : this.tmdb.tvShows;
			let mediaDetails = await api.details(item.tmdb_id);
			return {
				...item,
				details: mediaDetails,
			};
		}));
		this.planToWatchData = await Promise.all(this.planToWatch.map(async item => {
			const api = item.kind === MediaKind.Movie ? this.tmdb.movies : this.tmdb.tvShows;
			let mediaDetails = await api.details(item.tmdb_id);
			return {
				...item,
				details: mediaDetails,
			};
		}));

		// this.logger.debug('Fetched watching data:', this.watchingData);
		// this.logger.debug('Fetched plan to watch data:', this.planToWatchData);
	}

	public get watching() {
		return Object.values(this.mediaUserDataMap).filter(mud => mud?.state === WatchState.Watching) || [];
	}

	public get planToWatch() {
		return Object.values(this.mediaUserDataMap).filter(mud => mud?.state === WatchState.PlanToWatch) || [];
	}

}
