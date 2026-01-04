import { IRouteContext, route } from "@aurelia/router";
import { createStateMemoizer, fromState } from "@aurelia/state";
import { MovieItem, TMDB, TVShow, TVShowItem } from "@leandrowkz/tmdb";
import { bindable, ILogger, observable, resolve } from "aurelia";
import { GenresMap } from "src/core/Genres";
import { createDefaultMediaUserData, MediaUserData } from "src/core/MediaUserData";
import { SupabaseService } from "src/core/services/SupabaseService";
import { AppState } from "src/core/state/AppState";
import { AvailableButtonsPerWatchState, ResetButtonMap, SetPlanToWatchButton, WatchState, WatchStateButton } from "src/core/WatchState";
import { MoviePage } from "src/pages/movie-page/MoviePage";


export class MovieMini {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('MovieMini');
	private readonly parentCtx: IRouteContext = resolve(IRouteContext).parent;
	private readonly tmdb = resolve(TMDB);
	private readonly genresMap = resolve(GenresMap);
	private readonly supabase = resolve(SupabaseService);

	@bindable public movie: MovieItem;
	@bindable public tvshow: TVShow;

	@fromState((state: AppState) => state.mediaUserDataMap)
	public dataMap!: Record<number, MediaUserData> | null;

	bound() {
	}

	//region Getters
	public get media(): MovieItem | TVShow {
		return this.movie || this.tvshow;
	}
	public get id(): number {
		return this.media.id;
	}
	public get overview(): string {
		return this.media.overview;
	}
	public get title(): string {
		return this.movie.title || this.tvshow.name || 'N/A';
	}
	public get posterUrl(): string {
		return this.media.poster_path ? `https://image.tmdb.org/t/p/w200${this.media.poster_path}` : 'N/A';
	}
	public get releaseDate(): string {
		return this.movie.release_date || this.tvshow.first_air_date || 'N/A';
	}
	public get releaseYear(): string {
		return (this.releaseDate && this.releaseDate.length >= 4)
			? this.releaseDate.substring(0, 4)
			: 'N/A';
	}
	public get genres(): string {
		if (this.movie) {
			return this.movie.genre_ids.map(id => this.genresMap.movies[id]).join(', ');
		}
		if (this.tvshow) {
			return this.tvshow.genre_ids?.map(id => this.genresMap.tv[id]).join(', ') || '';
		}
		return '';
	}
	//#endregion

	//#region State properties
	public get availableWatchStateButtons(): WatchStateButton[] {
		return AvailableButtonsPerWatchState[this.watchState];
	}
	public get resetWatchStateButton(): WatchStateButton | null {
		return ResetButtonMap.get(this.watchState);
	}
	public get watchState(): WatchState {
		return this.dataMap && this.dataMap[this.media.id]
			? this.dataMap[this.media.id].state
			: WatchState.Unlisted;
	}
	public set watchState(value: WatchState) {
		this.logger.debug(`Watch state changed to: ${value} for movie ID: ${this.media.id}`);
		this.supabase.updateMediaUserData(this.media.id, {
			state: value,
		}).then(success => {
			this.logger.debug(`Supabase updateMediaUserData completed for movie ID: ${this.media.id} with success: ${success} and value: ${value}`);
		});
	}
	//#endregion

	//#region Actions
	private clickWatchStateButton(btn: WatchStateButton) {
		this.watchState = btn.setWatchState;
	}
	public incrementEpisodesCompleted(): void {
		// const currentData = this.state.getMediaUserDataOrDefault(this.tvshow.id);
		const currentData = this.dataMap[this.tvshow.id] || createDefaultMediaUserData();
		let updatedData: Partial<MediaUserData> = {
			completed_episodes: currentData.completed_episodes + 1,
		};

		if (updatedData.completed_episodes >= this.tvshow.number_of_episodes) {
			updatedData.completed_episodes = this.tvshow.number_of_episodes;
			updatedData.state = WatchState.Completed;
			updatedData.watch_completed_date = new Date().toISOString();
		}

		this.supabase.updateMediaUserData(this.tvshow.id, updatedData);
	}
	//#endregion

}
