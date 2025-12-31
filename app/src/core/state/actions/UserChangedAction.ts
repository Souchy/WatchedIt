import { AppState } from "../AppState";
import { Session } from "@supabase/supabase-js";

export const UserChangedActionName = "userChanged";

export class UserChangedAction {
	public readonly type = UserChangedActionName;
	constructor(public readonly session: Session | null) { }
}

export function UserChangedHandler(currentState: AppState, action: UserChangedAction): AppState {
	if (action.type !== UserChangedActionName) return currentState;
	if (currentState.session === action.session) {
		return currentState;
	}
	return {
		...currentState,
		session: action.session,
	};
}
