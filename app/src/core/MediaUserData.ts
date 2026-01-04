import { WatchState } from "./WatchState";

export interface MediaUserData {
	created_at: string;
	updated_at: string;
	state: WatchState;
	completed_episodes: number;
	rating?: number | null;
	watch_start_date?: string | null;
	watch_completed_date?: string | null;
}

export function createDefaultMediaUserData(): MediaUserData {
	return {
		created_at: new Date().toISOString(),
		updated_at: new Date().toISOString(),
		state: WatchState.Unlisted,
		completed_episodes: 0,
	};
}
