import { SupabaseClient } from "@supabase/supabase-js";
import { ILogger, inject, resolve } from "aurelia";
import { MediaUserData } from "../MediaUserData";
import { IStore } from "@aurelia/state";
import { AppState } from "../state/AppState";
import { AppAction } from "../state/AppHandler";
import { UserChangedAction } from "../state/actions/UserChangedAction";
import { MediaUserDataMapChangedAction } from "../state/actions/MediaUserDataMapChangedAction";
import { MediaUserDataChangedAction } from "../state/actions/MediaUserDataChangedAction";

@inject(IStore)
export class SupabaseService {
	public supabaseClient: SupabaseClient = resolve(SupabaseClient);
	private logger: ILogger = resolve(ILogger).scopeTo("SupabaseService");

	private readonly authUnsubscribe;

	public constructor(private readonly store: IStore<AppState, AppAction>) {
		this.logger.debug('SupabaseService constructor', store, this.supabaseClient);
		// Sync auth state changes to the store
		this.authUnsubscribe = this.supabaseClient.auth.onAuthStateChange((event, session) => {
			this.logger.debug(`Supabase Auth State Changed: ${event}`, session);
			this.store.dispatch(new UserChangedAction(session));
		});
	}

	public async signinWithAzure(): Promise<void> {
		const redirect_uri = window.location.origin; // "https://ymgzzslmtldzmaqwkbqx.supabase.co/auth/v1/callback"; // + '/auth/callback'; // http://localhost:9000
		this.logger.debug('Sign In with Azure button clicked, redirect_uri:', redirect_uri);
		// window.location.href = 'http://localhost:3000/auth/azure';

		let res = await this.supabaseClient.auth.signInWithOAuth({
			provider: 'azure',
			options: {
				redirectTo: redirect_uri,
				skipBrowserRedirect: true
			}
		});
		this.logger.debug('Supabase OAuth Sign-In Result:', res);

		// redirectInPopup(data.url)
		window.open(res.data.url, '_blank', 'width=500,height=600');
	}

	public async fetchMediaUserDataMap(): Promise<Record<number, MediaUserData> | null> {
		// const sessionRes = await this.supabaseClient.auth.getSession();
		let session = this.store.getState().session; // sessionRes?.data.session;
		if (!session) {
			this.logger.warn('No active session found while fetching media user data map.');
			return null;
		}

		const { data, error } = await this.supabaseClient
			.from('media-user-data')
			.select('*')
			.eq('user_id', session.user.id);

		if (error) {
			this.logger.error(`Error fetching media user (${session.user.id}) data:`, error);
			return null;
		}
		if (!data) {
			this.logger.debug(`No media user data found for the user (${session.user.id}).`);
			return null;
		}
		const mediaUserDataMap: Record<number, MediaUserData> = {};
		for (const item of data) {
			mediaUserDataMap[item.tmdb_id] = {
				createdAt: item.created_at,
				updatedAt: item.updated_at,
				state: item.state,
				completedEpisodes: item.completed_episodes,
				rating: item.rating,
				watchStartDate: item.watch_start_date,
				watchCompletedDate: item.watch_completed_date,
			};
		}
		this.store.dispatch(new MediaUserDataMapChangedAction(mediaUserDataMap));
		return mediaUserDataMap;
	}

	public async updateMediaUserData(mediaId: number, mediaUserData: Partial<MediaUserData>): Promise<boolean> {
		// const sessionRes = await this.supabaseClient.auth.getSession();
		let session = this.store.getState().session; // sessionRes?.data.session;
		if (!session) {
			this.logger.warn('No active session found while updating media user data.');
			return false;
		}

		// save optimistically to state
		const previousData = this.store.getState().mediaUserDataMap[mediaId] || null;
		this.store.dispatch(new MediaUserDataChangedAction(mediaId, mediaUserData as MediaUserData));

		// update db
		const { data, error } = await this.supabaseClient
			.from('media-user-data')
			.upsert({
				user_id: session.user.id,
				tmdb_id: mediaId,
				...mediaUserData,
			}, { onConflict: 'user_id,tmdb_id' });
		if (error) {
			// rollback the state change?
			this.store.dispatch(new MediaUserDataChangedAction(mediaId, previousData));
			this.logger.error('Error updating media user data:', error);
			return false;
		}
		return true;
	}

	public dispose() {
		this.authUnsubscribe.data.subscription.unsubscribe();
	}

}
