import { Session } from "@supabase/supabase-js";
import { MediaUserData } from "../MediaUserData";
import { Movie, TVShow } from "@leandrowkz/tmdb";

export class AppState {
	session: Session | null = null;
	mediaUserDataMap: Record<number, MediaUserData> = {};
	tmdbData: Map<string, Movie | TVShow> = new Map();
}

export const initialState: AppState = new AppState();
// {
// 	session: null,
// 	mediaUserDataMap: {},
// };
