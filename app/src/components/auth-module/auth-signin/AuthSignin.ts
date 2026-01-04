import { ILogger, inject, resolve } from "aurelia";
import { IStore } from "@aurelia/state";
import { SupabaseService } from "src/core/services/SupabaseService";

@inject(IStore, SupabaseService)
export class AuthSignin {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('AuthSignin');
	private supabase: SupabaseService = resolve(SupabaseService);

	private readonly providers = [
		{
			name: 'azure',
			displayName: 'Microsoft',
			iconClass: 'fi fi-brands-microsoft',
			disabled: false,
		},
		{
			name: 'github',
			displayName: 'GitHub',
			iconClass: 'fi fi-brands-github',
			disabled: false,
		},
		{
			name: 'google',
			displayName: 'Google',
			iconClass: 'fi fi-brands-google',
			disabled: true,
		}
	];

}
