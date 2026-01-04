import { ILogger, inject, resolve } from "aurelia";
import { fromState, IStore } from "@aurelia/state";
import { AppState } from "src/core/state/AppState";
import { SupabaseService } from "src/core/services/SupabaseService";
import { UserChangedAction } from "src/core/state/actions/UserChangedAction";
import { Session } from "@supabase/auth-js/dist/module/lib/types";


@inject(IStore, SupabaseService)
export class Navbar {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('Navbar');

	// @fromState('session', (state: AppState) => state.session)
	// public session!: Session | null;

	// public constructor(private readonly store: IStore<AppState, UserChangedAction>, private supabase: SupabaseService) {
	// }


	// public dispose() {
	// }

	// public get isAuthenticated(): boolean {
	// 	return this.session !== null;
	// }

}
