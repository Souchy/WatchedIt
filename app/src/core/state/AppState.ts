import { Session, User } from "@supabase/supabase-js";
import { MediaUserData } from "../MediaUserData";
import { UserChangedAction } from "./actions/UserChangedAction";

export interface AppState {
	session: Session | null;
	mediaUserDataMap: Record<number, MediaUserData> | null;
}

export const initialState: AppState = {
	session: null,
	mediaUserDataMap: null,
};
