import { route } from "@aurelia/router";
import { ILogger, inject, IObservation, observable, resolve } from "aurelia";
import { MoviePage } from "../media-page/movie-page/MoviePage";
import { AppState, SearchEngine } from "src/core/state/AppState";
import { AppAction } from "src/core/state/AppHandler";
import { SupabaseService } from "src/core/services/SupabaseService";
import { fromState, IStore } from "@aurelia/state";
import { Session } from "@supabase/supabase-js";
import { WatchState } from "src/core/WatchState";
import { MediaKind, MediaUserData } from "src/core/MediaUserData";
import { Movie, TMDB, TVShow } from "@leandrowkz/tmdb";
import { UserDataCache } from "src/core/state/UserDataCache";
import { TMDBDataCache } from "src/core/state/TMDBDataCache";
import { getMainMediaApi, getMediaApi, isMainMediaKind, MediaDetails, UserMediaDetails } from "src/core/Types";
import { time } from "console";

@route({
	id: 'settings',
	path: ['settings'],
	title: 'Settings',
})
@inject(IStore)
export class SettingsPage {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('SettingsPage');
	private readonly supabase: SupabaseService = resolve(SupabaseService);

}
