import { WatchState } from "./WatchState";

export interface MediaUserData {
	user_id: string;
	tmdb_id: number;
	created_at: string;
	updated_at: string;
	kind: MediaKind;
	state: WatchState;
	completed_episodes: number;
	rating?: number | null;
	watch_start_date?: string | null;
	watch_completed_date?: string | null;
}

export enum MediaKind {
	Movie = 0,
	TVShow = 1,
	People = 2,
}

export function createDefaultMediaUserData(userId: string, tmdbId: number, kind: MediaKind): MediaUserData {
	return {
		user_id: userId,
		tmdb_id: tmdbId,
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		kind: kind,
		state: WatchState.Unlisted,
		completed_episodes: 0,
	};
}
