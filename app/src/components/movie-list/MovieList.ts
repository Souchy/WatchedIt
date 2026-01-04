import { Movie, MovieItem, TMDBResponseList, TVShow, TVShowItem } from "@leandrowkz/tmdb";
import { bindable, ILogger, resolve } from "aurelia";
import { MediaUserData } from "src/core/MediaUserData";

export class MovieList {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('MovieList');

	@bindable movies: TMDBResponseList<MovieItem[]> | null = null;
	@bindable shows: TMDBResponseList<TVShowItem[]> | null = null;
	@bindable medias: Array<MediaUserData & { details: Movie | TVShow }> | null = null;
	
}
