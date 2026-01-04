import { Session } from "@supabase/supabase-js";
import { MediaUserData } from "../MediaUserData";

export class AppState {
	session: Session | null = null;
	mediaUserDataMap: Record<number, MediaUserData> = {};
}

export const initialState: AppState = new AppState();
// {
// 	session: null,
// 	mediaUserDataMap: {},
// };
