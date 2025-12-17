
/**
 * Completed -> unlisted
 * Unlisted -> watching, completed, plan-to-watch
 * Watching -> unlisted, completed, 					// on-hold, dropped
 * On-Hold -> unlisted, watching, completed, 			// dropped
 * Dropped -> unlisted, watching, completed,            // plan-to-watch
 * Plan to Watch -> unlisted, watching, completed
 */
export enum WatchState {
	Unlisted,
	PlanToWatch,
	Watching,
	Completed,
	OnHold,
	Dropped,
}
