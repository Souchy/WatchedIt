import { Session } from "@supabase/supabase-js";
import { MediaUserData } from "../MediaUserData";
import { Movie, TVShow } from "@leandrowkz/tmdb";
import { TMDBDataCache } from "./TMDBDataCache";
import { UserDataCache } from "./UserDataCache";

export class AppState {
	session: Session | null = null;
	mediaUserDataCache: UserDataCache = new UserDataCache();
	tmdbDataCache: TMDBDataCache = new TMDBDataCache();
}

export const initialState: AppState = new AppState();
