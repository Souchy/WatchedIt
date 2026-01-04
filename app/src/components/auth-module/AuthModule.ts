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

	public get userImage() {
		return this.session?.user.user_metadata?.avatar_url ?? 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
	}
	public get userName() {
		let username = this.session?.user.user_metadata?.preferred_username;
		if (username) {
			if (username.includes('@')) {
				username = username.split('@')[0];
			}
			return username;
		}
		return this.session?.user.user_metadata?.full_name ?? this.session?.user.email;
	}

	public get isAuthenticated(): boolean {
		return this.session !== null;
	}

	public clickSignout(): void {
		this.logger.debug('Sign Out button clicked');
		this.supabase.supabaseClient.auth.signOut().then(({ error }) => {
			if (error) {
				this.logger.error('Error during sign out:', error.message);
			} else {
				this.logger.debug('Sign out successful');
			}
		});
	}

}
