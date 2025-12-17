
/**
 * Completed -> unlisted
 * Unlisted -> watching, completed, plan-to-watch
 * Watching -> unlisted, completed, on-hold, dropped
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
export class WatchStateButton {
	public setWatchState: WatchState;
	public iconClass: string;
	public ariaLabel: string;
}

export const SetPlanToWatchButton: WatchStateButton = {
	setWatchState: WatchState.PlanToWatch,
	iconClass: 'fi fi-rr-bookmark',
	ariaLabel: 'Mark as Plan to Watch',
};
export const SetWatchingButton: WatchStateButton = {
	setWatchState: WatchState.Watching,
	iconClass: 'fi fi-rr-play-circle',
	ariaLabel: 'Mark as Watching',
};
export const SetCompletedButton: WatchStateButton = {
	setWatchState: WatchState.Completed,
	iconClass: 'fi fi-rr-check-circle',
	ariaLabel: 'Mark as Completed',
};
export const SetOnHoldButton: WatchStateButton = {
	setWatchState: WatchState.OnHold,
	iconClass: 'fi fi-rr-pause-circle',
	ariaLabel: 'Mark as On Hold',
};
export const SetDroppedButton: WatchStateButton = {
	setWatchState: WatchState.Dropped,
	iconClass: 'fi fi-rr-circle-trash',
	ariaLabel: 'Mark as Dropped',
};
export const WatchStateButtonMap: Map<WatchState, WatchStateButton> = new Map([
	[WatchState.PlanToWatch, SetPlanToWatchButton],
	[WatchState.Watching, SetWatchingButton],
	[WatchState.Completed, SetCompletedButton],
	[WatchState.OnHold, SetOnHoldButton],
	[WatchState.Dropped, SetDroppedButton],
]);
export const AvailableButtonsPerWatchState: Record<WatchState, WatchStateButton[]> = {
	[WatchState.Unlisted]: [SetWatchingButton, SetCompletedButton, SetPlanToWatchButton],
	[WatchState.PlanToWatch]: [SetWatchingButton, SetCompletedButton, SetDroppedButton],
	[WatchState.Watching]: [SetOnHoldButton, SetCompletedButton, SetDroppedButton],
	[WatchState.Completed]: [],
	[WatchState.OnHold]: [SetWatchingButton, SetCompletedButton, SetPlanToWatchButton],
	[WatchState.Dropped]: [SetWatchingButton, SetCompletedButton, SetPlanToWatchButton],
};

export const ResetPlanToWatchButton: WatchStateButton = {
	setWatchState: WatchState.Unlisted,
	iconClass: 'fi fi-sr-bookmark',
	ariaLabel: 'Currently marked as Plan to watch. Mark as Unlisted',
};
export const ResetWatchingButton: WatchStateButton = {
	setWatchState: WatchState.Unlisted,
	iconClass: 'fi fi-sr-play-circle',
	ariaLabel: 'Currently marked as Watching. Mark as Unlisted',
};
export const ResetCompletedButton: WatchStateButton = {
	setWatchState: WatchState.Unlisted,
	iconClass: 'fi fi-sr-check-circle',
	ariaLabel: 'Currently marked as Completed. Mark as Unlisted',
};
export const ResetOnHoldButton: WatchStateButton = {
	setWatchState: WatchState.Unlisted,
	iconClass: 'fi fi-sr-pause-circle',
	ariaLabel: 'Currently marked as On Hold. Mark as Unlisted',
};
export const ResetDroppedButton: WatchStateButton = {
	setWatchState: WatchState.Unlisted,
	iconClass: 'fi fi-sr-circle-trash',
	ariaLabel: 'Currently marked as Dropped. Mark as Unlisted',
};
export const ResetButtonMap: Map<WatchState, WatchStateButton> = new Map([
	[WatchState.PlanToWatch, ResetPlanToWatchButton],
	[WatchState.Watching, ResetWatchingButton],
	[WatchState.Completed, ResetCompletedButton],
	[WatchState.OnHold, ResetOnHoldButton],
	[WatchState.Dropped, ResetDroppedButton],
]);
