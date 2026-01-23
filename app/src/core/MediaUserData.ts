import { WatchState } from "./WatchState";

export interface MediaUserData {
	// Primary keys
	user_id: string;
	tmdb_id: number; // Movie ID, TVShow ID, or Season ID. seasons do have an id! but tmdb doesnt use it to fetch details.
	kind: MediaKind;
	// Data
	created_at: string;
	updated_at: string;
	state: WatchState;
	rating?: number | null;
	watch_start_date?: string | null;
	watch_completed_date?: string | null;

	like: boolean;
	dislike: boolean;

	// Tv Season specific
	completed_episodes: number;
	tmdb_show_id?: number;
	tmdb_season_number?: number;
}

export enum MediaKind {
	Movie = 0,
	TVShow = 1,
	People = 2,
	TVSeason = 3,
}
export namespace MediaKind {
	export function toString(kind: MediaKind | 'all'): string {
		console.log('MediaKind.toString called with kind:', kind);
		switch (kind) {
			case MediaKind.Movie:
				return 'Movie';
			case MediaKind.TVShow:
				return 'TV Show';
			case MediaKind.People:
				return 'People';
			case MediaKind.TVSeason:
				return 'TV Season';
			default:
				return 'all';
		}
	}
	export function fromString(kind: string | null): MediaKind | 'all' {
		switch (kind?.toLowerCase()) {
			case 'movie':
				return MediaKind.Movie;
			case 'tvshow':
			case 'tv show':
				return MediaKind.TVShow;
			case 'people':
				return MediaKind.People;
			case 'tvseason':
			case 'tv season':
				return MediaKind.TVSeason;
			default:
				return 'all';
		}
	}
}

export function createDefaultMediaUserData(userId: string, tmdbId: number, kind: MediaKind): MediaUserData {
	return {
		user_id: userId,
		tmdb_id: tmdbId,
		kind: kind,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		state: WatchState.Unlisted,
		completed_episodes: 0,
		like: false,
		dislike: false,
	};
}

export interface TvShowSeasonLink {
	tmdb_show_id: number;
	tmdb_season_id: number;
	tmdb_season_number?: number;
}
