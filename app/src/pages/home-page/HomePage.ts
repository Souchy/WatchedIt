import { route } from "@aurelia/router";
import { ILogger, inject, resolve } from "aurelia";
import { MoviePage } from "../movie-page/MoviePage";
import { IStore } from "@aurelia/state";
import { AppState } from "src/core/state/AppState";
import { AppAction } from "src/core/state/AppHandler";
import { SupabaseService } from "src/core/services/SupabaseService";


@route({
	id: 'home',
	path: ['', 'home'],
	title: 'Home',
	// routes: [
	// 	MoviePage
	// ],
})
// @route({
// 	routes: [
// 		MoviePage
// 	],
// })
@inject(IStore, SupabaseService)
export class HomePage {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('HomePage');

	public constructor(private readonly store: IStore<AppState, AppAction>, private supabase: SupabaseService) {
		this.logger.debug('HomePage constructor', store, supabase);
	}

}
