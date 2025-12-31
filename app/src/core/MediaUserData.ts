import { WatchState } from "./WatchState";

export interface MediaUserData {
	createdAt: string;
	updatedAt: string;
	state: WatchState;
	completedEpisodes: number;
	rating?: number | null;
	watchStartDate?: string | null;
	watchCompletedDate?: string | null;
}
