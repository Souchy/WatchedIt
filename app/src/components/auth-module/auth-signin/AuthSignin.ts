import { ILogger, inject, resolve } from "aurelia";
import { fromState, IStore } from "@aurelia/state";
import { AppState } from "src/core/state/AppState";
import { SupabaseService } from "src/core/services/SupabaseService";
import { UserChangedAction } from "src/core/state/actions/UserChangedAction";
import { Session } from "@supabase/auth-js/dist/module/lib/types";


@inject(IStore, SupabaseService)
export class AuthSignin {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('AuthSignin');

	// @fromState('session', (state: AppState) => state.session)
	// public session!: Session | null;

	private toggled: boolean = false;

	public constructor(private readonly store: IStore<AppState, UserChangedAction>, private supabase: SupabaseService) {
	}


	// public dispose() {
	// }

	// public get isAuthenticated(): boolean {
	// 	return this.session !== null;
	// }

	// public toggleDropdown() {
	// 	this.toggled = !this.toggled;
	// }
	public get toggled_class(): String {
		return this.toggled ? 'show' : '';
	}

	public async signinWithAzure(): Promise<void> {
		this.logger.debug('AuthSignin signinWithAzure called');
		this.toggled = false;
		await this.supabase.signinWith('azure');
	}
	public async signinWithGoogle(): Promise<void> {
		this.logger.debug('AuthSignin signinWithGoogle called');
		this.toggled = false;
		await this.supabase.signinWith('google');
	}
	
}
