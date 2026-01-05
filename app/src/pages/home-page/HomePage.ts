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
@inject(IStore)
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

	bound() {
		this.logger.debug('HomePage created');
		this.mediaUserDataMapChanged({}, this.mediaUserDataMap);
	}

	/**
	 * When the mediaUserDataMap changes, update the watching and plan to watch lists details
	 */
	async mediaUserDataMapChanged(previous: Record<string, MediaUserData>, current: Record<string, MediaUserData>) {
		if (!current) {
			return;
		}
		this.logger.debug('HomePage mediaUserDataMap changed:', Object.keys(current).length);

		this.logger.debug(`HomePage fetching details for watching and planned media: ${this.watching.length}`);

		if (this.watchingData.length > 0 && this.planToWatchData.length > 0) {
			return;
		}

		this.watchingData = await Promise.all(this.watching.map(async item => {
			const api = item.kind === MediaKind.Movie ? this.tmdb.movies : this.tmdb.tvShows;
			let mediaDetails = await api.details(item.tmdb_id);
			return {
				...item,
				details: mediaDetails,
			};
		}));
		// this.watchingData = this.watchingData.sort((a, b) => {
		// 	return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
		// });
		this.planToWatchData = await Promise.all(this.planToWatch.map(async item => {
			const api = item.kind === MediaKind.Movie ? this.tmdb.movies : this.tmdb.tvShows;
			let mediaDetails = await api.details(item.tmdb_id);
			return {
				...item,
				details: mediaDetails,
			};
		}));
		// this.planToWatchData = this.planToWatchData.sort((a, b) => {
		// 	return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
		// });

		// this.logger.debug('Fetched watching data:', this.watchingData);
		// this.logger.debug('Fetched plan to watch data:', this.planToWatchData);
	}

	public get watching() {
		const values = Object.values(this.mediaUserDataMap);
		const max = Math.min(values.length, 20); // TODO: Limit here and make a page with all watching medias
		return values
			.filter(mud => mud?.state === WatchState.Watching)
			.sort((a, b) => {
				return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
			})
			// .slice(0, max)
			|| [];
	}

	public get planToWatch() {
		const values = Object.values(this.mediaUserDataMap);
		const max = Math.min(values.length, 20); // TODO: Limit here and make a page with all  planned to watch medias
		return values
			.filter(mud => mud?.state === WatchState.PlanToWatch)
			.sort((a, b) => {
				return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
			})
			// .slice(0, max)
			|| [];
	}

}
