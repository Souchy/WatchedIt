import { ILogger, inject, resolve } from "aurelia";
import { fromState, IStore } from "@aurelia/state";
import { AppState } from "src/core/state/AppState";
import { SupabaseService } from "src/core/services/SupabaseService";
import { UserChangedAction } from "src/core/state/actions/UserChangedAction";
import { Session } from "@supabase/auth-js/dist/module/lib/types";


@inject(IStore, SupabaseService)
export class AuthModule {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('AuthModule');

	@fromState('default', (state: AppState) => state.session)
	public session!: Session | null;

	public constructor(private readonly store: IStore<AppState, UserChangedAction>, private supabase: SupabaseService) {
		// this.store.subscribe(this);
	}

	// public handleStateChange(state: AppState, prevState: AppState): void {
	// 	this.logger.debug('AuthModule handleStateChange:', state, prevState);
	// }

	public dispose() {
		// this.store.unsubscribe(this);
	}

	public get isAuthenticated(): boolean {
		return this.session !== null;
	}

	// State to track whether the dropdown is open
	public menuOpen = false;

	// Toggle visibility of the dropdown menu
	toggleMenu(): void {
		this.menuOpen = !this.menuOpen;
	}

}
