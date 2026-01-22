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
