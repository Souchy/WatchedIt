import { AuthChangeEvent, Provider, Subscription, SupabaseClient } from "@supabase/supabase-js";
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

	private authUnsubscribe: Subscription | null = null;

	public constructor(private readonly store: IStore<AppState, AppAction>) {
		this.logger.debug('SupabaseService constructor', store, this.supabaseClient);
		// Sync auth state changes to the store
		const { data } = this.supabaseClient.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
			this.logger.debug(`Supabase Auth State Changed: ${event}`, session);
			const oldUserId: string | undefined = store.getState().session?.user.id;
			this.store.dispatch(new UserChangedAction(session));
			if (session && event === 'SIGNED_IN' && oldUserId !== session.user.id) {
				this.logger.debug(`Supabase Auth signed_in: activating auth-refresh`);
				this.supabaseClient.auth.startAutoRefresh();
				this.fetchMediaUserDataMap();
			} 
			else if (!session && event === 'SIGNED_OUT') {
				// Handle sign-out if needed
				this.logger.debug(`Supabase Auth signed_out, stopping auth-refresh, `);
				this.supabaseClient.auth.stopAutoRefresh();
				this.authUnsubscribe?.unsubscribe();
				this.authUnsubscribe = null;
			}
		});
		this.authUnsubscribe = data.subscription;
	}

	public async signinWith(provider: Provider): Promise<void> {
		let redirect_uri = window.location.origin; // + "/callback"; // 
		// let redirect_uri = "https://ymgzzslmtldzmaqwkbqx.supabase.co/auth/v1/callback"; // http://localhost:9000 // + '/auth/callback';
		this.logger.debug('Sign In with Azure OAuth button clicked, redirect_uri:', redirect_uri);

		const usePopup = false;

		let res = await this.supabaseClient.auth.signInWithOAuth({
			provider: provider,
			options: {
				redirectTo: redirect_uri,
				skipBrowserRedirect: usePopup,
				// scopes: 'email' // Needed for Supabase to get user email to create a user record
				scopes: 'email profile openid offline_access User.Read ProfilePhoto.Read.All', // Add necessary scopes explicitly
				// scopes: 'email openid User.Read ProfilePhoto.Read.All', // Add necessary scopes explicitly
			}
		});
		this.logger.debug('Supabase OAuth Sign-In Result:', res);

		if (usePopup)
			window.open(res.data.url, '_blank', 'width=500,height=600');
	}

	public async fetchMediaUserDataMap(): Promise<Record<number, MediaUserData> | null> {
		let session = this.store.getState().session;
		if (!session) {
			this.logger.warn('No active session found while fetching media user data map.');
			return null;
		}

		this.logger.debug(`Fetching media user data for user (${session.user.email}).`);
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
			mediaUserDataMap[item.tmdb_id] = item satisfies MediaUserData;
			// mediaUserDataMap[item.tmdb_id] = {
			// 	created_at: item.created_at,
			// 	updated_at: item.updated_at,
			// 	state: item.state,
			// 	completed_episodes: item.completed_episodes,
			// 	rating: item.rating,
			// 	watch_start_date: item.watch_start_date,
			// 	watch_completed_date: item.watch_completed_date,
			// } satisfies MediaUserData;
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
		this.store.dispatch(new MediaUserDataChangedAction(mediaId, mediaUserData));
		const updatedData = this.store.getState().mediaUserDataMap[mediaId];

		// update db
		const { data, error } = await this.supabaseClient
			.from('media-user-data')
			.upsert({
				user_id: session.user.id,
				tmdb_id: mediaId,
				...updatedData,
				// ...mediaUserData,
			}, { onConflict: 'user_id,tmdb_id' });

		// On error, rollback state change
		if (error) {
			this.store.dispatch(new MediaUserDataChangedAction(mediaId, previousData));
			this.logger.error('Error updating media user data:', error);
		}
		return Boolean(!error);
	}

	public detaching() {
		this.logger.debug('SupabaseService detaching, unsubscribing from auth changes');
		// this.authUnsubscribe?.unsubscribe();
		// this.authUnsubscribe = null;
	}
	public dispose() {
		this.logger.debug('SupabaseService disposing, unsubscribing from auth changes');
		// this.authUnsubscribe?.unsubscribe();
		// this.authUnsubscribe = null;
	}

}
