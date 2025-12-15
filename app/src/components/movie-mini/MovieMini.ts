import { MovieResultItem } from "@lorenzopant/tmdb";
import { bindable, ILogger, resolve } from "aurelia";


export class MovieMini {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('MovieMini');
	@bindable public movie: MovieResultItem;

	bound() {

	}

	public get posterUrl(): string {
		if (this.movie.poster_path) {
			return `https://image.tmdb.org/t/p/w200${this.movie.poster_path}`;
		}
		return '';
	}

	public get title(): string {
		return this.movie.title ;
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

}
