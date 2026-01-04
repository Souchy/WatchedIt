import { IRouteContext, route } from "@aurelia/router";
import { createStateMemoizer, fromState } from "@aurelia/state";
import { Movie, MovieItem, TMDB, TVShow, TVShowItem } from "@leandrowkz/tmdb";
import { Session } from "@supabase/supabase-js";
import { bindable, ILogger, observable, resolve } from "aurelia";
import { GenresMap } from "src/core/Genres";
import { createDefaultMediaUserData, MediaKind, MediaUserData } from "src/core/MediaUserData";
import { SupabaseService } from "src/core/services/SupabaseService";
import { AppState } from "src/core/state/AppState";
import { AvailableButtonsPerWatchState, ResetButtonMap, SetPlanToWatchButton, WatchState, WatchStateButton } from "src/core/WatchState";
import { MoviePage } from "src/pages/movie-page/MoviePage";
import { TVShowPage } from "src/pages/tvshow-page/TVShowPage";

export class MovieMini {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('MovieMini');
	private readonly parentCtx: IRouteContext = resolve(IRouteContext).parent;
	private readonly tmdb = resolve(TMDB);
	private readonly genresMap = resolve(GenresMap);
	private readonly supabase = resolve(SupabaseService);
	private readonly movieRoute: typeof MoviePage = MoviePage;
	private readonly tvshowRoute: typeof TVShowPage = TVShowPage;

	@bindable public movie: MovieItem | Movie | null = null;
	@bindable public tvshow: TVShowItem | TVShow | null = null;

	@fromState((state: AppState) => state.session)
	public session: Session | null = null;
	@fromState((state: AppState) => state.mediaUserDataMap)
	public dataMap!: Record<number, MediaUserData> | null;

	bound() {
		this.logger.trace('MovieMini bound with media:', this.media);
	}

	//region Getters
	public get route() {
		return this.movie ? this.movieRoute : this.tvshowRoute;
	}
	public get media(): MovieItem | TVShowItem {
		return this.movie || this.tvshow;
	}
	public get mediaKind(): MediaKind {
		return this.movie ? MediaKind.Movie : MediaKind.TVShow;
	}
	public get id(): number {
		return this.media.id;
	}
	public get overview(): string {
		return this.media.overview;
	}
	public get title(): string {
		return this.movie?.title || this.tvshow?.name || 'N/A';
	}
	public get posterUrl(): string {
		return this.media.poster_path ? `https://image.tmdb.org/t/p/w200${this.media.poster_path}` : 'N/A';
	}
	public get releaseDate(): string {
		return this.movie?.release_date || this.tvshow?.first_air_date || 'N/A';
	}
	public get releaseYear(): string {
		return (this.releaseDate && this.releaseDate.length >= 4)
			? this.releaseDate.substring(0, 4)
			: 'N/A';
	}
	public get genres(): string {
		if (this.movie) {
			if (!this.movie.genre_ids) {
				let movie = this.movie as Movie;
				return movie.genres.map(g => g.name).join(', ');
			}
			return this.movie.genre_ids.map(id => this.genresMap.movies[id]).join(', ');
		}
		if (this.tvshow) {
			if (!this.tvshow.genre_ids) {
				let tvshow = this.tvshow as TVShow;
				return tvshow.genres.map(g => g.name).join(', ');
			}
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
		this.supabase.updateMediaUserData(this.media.id, this.mediaKind, {
			state: value,
		}).then(success => {
			this.logger.debug(`Supabase updateMediaUserData completed for kind ${this.mediaKind}, ID: ${this.media.id} with success: ${success} and watchstate: ${value}`);
		});
	}
	//#endregion

	//#region Actions
	private clickWatchStateButton(btn: WatchStateButton) {
		this.watchState = btn.setWatchState;
	}
	public async incrementEpisodesCompleted(): Promise<void> {
		const currentDataEpisodes = this.dataMap[this.tvshow.id].completed_episodes || 0;
		let updatedData: Partial<MediaUserData> = {
			completed_episodes: currentDataEpisodes + 1,
		};

		const tvshowDetails = await this.tmdb.tvShows.details(this.tvshow.id);

		if (updatedData.completed_episodes! >= tvshowDetails.number_of_episodes) {
			updatedData.completed_episodes = tvshowDetails.number_of_episodes;
			updatedData.state = WatchState.Completed;
			updatedData.watch_completed_date = new Date().toISOString();
		}

		this.supabase.updateMediaUserData(this.tvshow.id, this.mediaKind, updatedData);
	}
	//#endregion

}
