import { ILogger, inject, resolve } from "aurelia";
import { fromState, IStore } from "@aurelia/state";
import { AppState } from "src/core/state/AppState";
import { SupabaseService } from "src/core/services/SupabaseService";
import { UserChangedAction } from "src/core/state/actions/UserChangedAction";
import { Session } from "@supabase/auth-js/dist/module/lib/types";


@inject(IStore, SupabaseService)
export class AuthSignin {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('AuthSignin');
	private supabase: SupabaseService = resolve(SupabaseService);

	public async signinWithAzure(): Promise<void> {
		this.logger.debug('AuthSignin signinWithAzure called');
		await this.supabase.signinWith('azure');
	}
	public async signinWithGoogle(): Promise<void> {
		this.logger.debug('AuthSignin signinWithGoogle called');
		await this.supabase.signinWith('google');
	}
	
}
