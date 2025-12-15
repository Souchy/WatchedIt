import { MovieResultItem, PaginatedResponse } from "@lorenzopant/tmdb";
import { bindable, ILogger, resolve } from "aurelia";

export class MovieList {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('MovieList');

	@bindable movies: PaginatedResponse<MovieResultItem> | null = null;

	bound() {
		this.logger.debug('MovieList bound with movies:', this.movies);
	}
	
}
