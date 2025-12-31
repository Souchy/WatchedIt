import { IRouteContext, route } from "@aurelia/router";
import { MovieItem, TMDB } from "@leandrowkz/tmdb";
import { bindable, ILogger, resolve } from "aurelia";
import { GenresMap } from "src/core/Genres";
import { AvailableButtonsPerWatchState, ResetButtonMap, SetPlanToWatchButton, WatchState, WatchStateButton } from "src/core/WatchState";
import { MoviePage } from "src/pages/movie-page/MoviePage";


// @route({
// 	routes: [
// 		MoviePage
// 	],
// })
export class MovieMini {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('MovieMini');
	private readonly parentCtx: IRouteContext = resolve(IRouteContext).parent;
	private readonly tmdb = resolve(TMDB);
	private readonly genresMap = resolve(GenresMap);

	@bindable public movie: MovieItem;

	private _watchState: WatchState | null = null;

	bound() {
		if (this._watchState === null) {
			let state = localStorage.getItem(`movie_${this.movie.id}_watchState`);
			state ??= WatchState[WatchState.Unlisted];
			this._watchState = WatchState[state];
		}
	}

	public get id(): number {
		return this.movie.id;
	}
	public get posterUrl(): string {
		if (this.movie.poster_path) {
			return `https://image.tmdb.org/t/p/w200${this.movie.poster_path}`;
		}
		return '';
	}

	public get title(): string {
		return this.movie.title;
	}

	public get releaseDate(): string {
		return this.movie.release_date;
	}

	public get releaseYear(): string {
		return this.movie.release_date ? this.movie.release_date.split('-')[0] : 'N/A';
	}

	public get overview(): string {
		return this.movie.overview;
	}

	public get watchState(): WatchState {
		// if (this._watchState === null) {
		// 	let state = localStorage.getItem(`movie_${this.movie.id}_watchState`);
		// 	this.logger.error(`Loading watch state for movie ID: ${this.movie.id} from localStorage ${state}`);
		// 	state ??= WatchState[WatchState.Unlisted];
		// 	// this._watchState = WatchState[state];
		// 	return WatchState[state];
		// }
		return this._watchState;
	}
	public set watchState(value: WatchState) {
		this.logger.debug(`Watch state changed to: ${value} for movie ID: ${this.movie.id}`);
		this._watchState = value;
		if (value === WatchState.Unlisted) {
			localStorage.removeItem(`movie_${this.movie.id}_watchState`);
			return;
		}
		localStorage.setItem(`movie_${this.movie.id}_watchState`, WatchState[value]);
	}

	public get genres(): string {
		return this.movie.genre_ids.map(id => this.genresMap.movies[id]).join(', ');
	}

	public get availableWatchStateButtons(): WatchStateButton[] {
		// this.logger.warn(`Loading watch state for movie ID: ${this.movie.id} : ${this._watchState}`);
		return AvailableButtonsPerWatchState[this.watchState];
	}
	public get resetWatchStateButton(): WatchStateButton | undefined {
		return ResetButtonMap.get(this.watchState);
	}

	private clickWatchStateButton(btn: WatchStateButton) {
		this.watchState = btn.setWatchState;
	}

	private get state1(): WatchStateButton {
		return SetPlanToWatchButton;
	}

	private get bootstrapclass(): string {
		return 'bi bi-pencil-square';
	}
	private get ficlass(): string {
		return 'fi fi-rr-plus-circle';
	}

}
