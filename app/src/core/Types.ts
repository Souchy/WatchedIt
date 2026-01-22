import { ignore } from './../../node_modules/@aurelia/i18n/node_modules/@aurelia/kernel/src/di.resolvers';
import { Movie, MovieItem, Person, PersonItem, TMDB, TVSeason, TVSeasonItem, TVShow, TVShowItem } from "@leandrowkz/tmdb";
import { MediaKind, MediaUserData } from "./MediaUserData";
import { MediaUserDataKind } from "src/pages/search-page/SearchPage";
import { resolve } from "aurelia";

export type MediaDetails = Movie | TVShow | Person | TVSeason;
export type MediaItem = MovieItem | TVShowItem | PersonItem | TVSeasonItem;
export type MainMediaItem = MovieItem | TVShowItem;
export type MainMediaDetails = Movie | TVShow;

export type UserMediaDetails = MediaUserData & { details: MediaDetails };
export type UserMediaItem = MediaUserData & { details: MediaItem };

export type MediaKindDetails = MediaUserDataKind & { details: MediaDetails };
export type MediaKindItem = MediaUserDataKind & { details: MediaItem };


// export class MediaApiService {
// 	private readonly tmdb: TMDB = resolve(TMDB);

// }

export function getMediaApi(tmdb: TMDB, kind: MediaKind) {
	switch (kind) {
		case MediaKind.Movie: // Movie
			return tmdb.movies;
		case MediaKind.TVShow: // TV Show
			return tmdb.tvShows;
		case MediaKind.People: // People
			return tmdb.people;
		case MediaKind.TVSeason: // TV Season
			return tmdb.tvSeasons;
		default:
			throw new Error(`Unknown MediaKind: ${kind}`);
	}
}

export function getMainMediaApi(tmdb: TMDB, kind: MediaKind) {
	switch (kind) {
		case MediaKind.Movie: // Movie
			return tmdb.movies;
		case MediaKind.TVShow: // TV Show
			return tmdb.tvShows;
		// case MediaKind.People: // People
		// 	return tmdb.people;
		// case MediaKind.TVSeason: // TV Season
		// 	return tmdb.tvSeasons;
		default:
			throw new Error(`Unknown MediaKind: ${kind}`);
	}
}

export function isMainMediaKind(kind: MediaKind): boolean {
	return kind === MediaKind.Movie || kind === MediaKind.TVShow;
}
