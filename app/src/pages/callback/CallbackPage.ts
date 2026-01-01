import { route } from "@aurelia/router";
import { ILogger, inject, resolve } from "aurelia";
import { MoviePage } from "../movie-page/MoviePage";
import { IStore } from "@aurelia/state";
import { AppState } from "src/core/state/AppState";
import { AppAction } from "src/core/state/AppHandler";
import { SupabaseService } from "src/core/services/SupabaseService";


@route({
	id: 'callback',
	path: ['callback'],
	title: 'Callback',
})
@inject(IStore, SupabaseService)
export class CallbackPage {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('CallbackPage');

	public constructor(private readonly store: IStore<AppState, AppAction>, private supabase: SupabaseService) {
		this.logger.debug('CallbackPage constructor', store, supabase);
	}

	async attached() {
		this.logger.debug(`CallbackPage attached, processing OAuth callback... at ${window.location.href}`);
		const { data, error } = await this.supabase.supabaseClient.auth.exchangeCodeForSession(window.location.href);

		if (error) {
			console.error('Error exchanging code:', error);
		} else {
			console.log('Logged in successfully:', data);
			// Redirect user to the home/dashboard page
			window.location.href = '/home';
		}
	}
}

