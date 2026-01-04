import { MovieItem, TMDBResponseList, TVShowItem } from "@leandrowkz/tmdb";
import { bindable, ILogger, resolve } from "aurelia";

export class MovieList {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('MovieList');

	@bindable movies: TMDBResponseList<MovieItem[]> | null = null;
	@bindable shows: TMDBResponseList<TVShowItem[]> | null = null;
	
}
