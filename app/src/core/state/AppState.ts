import { Session } from "@supabase/supabase-js";
import { TMDBDataCache } from "./TMDBDataCache";
import { UserDataCache } from "./UserDataCache";

export class AppState {
	session: Session | null = null;
	mediaUserDataCache: UserDataCache = new UserDataCache();
	tmdbDataCache: TMDBDataCache = new TMDBDataCache();
	searchEngines: SearchEngine[] = [
		{
			name: 'Google',
			url: `https://www.google.com/search?q=%s`,
			includeYear: true,
		},
	];
}

export const initialState: AppState = new AppState();

export interface SearchEngine {
	name: string;
	url: string;
	includeYear?: boolean;
}
