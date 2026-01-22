import { AuthChangeEvent, Provider, Subscription, SupabaseClient } from "@supabase/supabase-js";
import { ILogger, inject, resolve } from "aurelia";
import { MediaKind, MediaUserData, TvShowSeasonLink } from "../MediaUserData";
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

	public async fetchMediaUserDataMap(): Promise<void> {
		let session = this.store.getState().session;
		if (!session) {
			this.logger.warn('No active session found while fetching media user data map.');
			return null;
		}

		this.logger.debug(`Fetching media user data for user (${session.user.email}).`);
		const { data, error } = await this.supabaseClient
			// .from('media_user_data')
			// .select('*')
			.from('media_user_data_season')
			.select('*')
			.eq('user_id', session.user.id)
			.order('updated_at', { ascending: false })
			;

		if (error) {
			this.logger.error(`Error fetching media user (${session.user.id}) data:`, error);
			return null;
		}
		if (!data) {
			this.logger.debug(`No media user data found for the user (${session.user.id}).`);
			return null;
		}
		// Dispatch to store
		this.store.dispatch(new MediaUserDataMapChangedAction(data as MediaUserData[]));
	}

	public async updateMediaUserData(mediaId: number, kind: MediaKind, mediaUserData: Partial<MediaUserData>): Promise<boolean> {
		// const sessionRes = await this.supabaseClient.auth.getSession();
		let session = this.store.getState().session; // sessionRes?.data.session;
		if (!session) {
			this.logger.warn('No active session found while updating media user data.');
			return false;
		}

		// save optimistically to state
		const previousData = this.store.getState().mediaUserDataCache.get(mediaId, kind);
		this.store.dispatch(new MediaUserDataChangedAction(mediaId, kind, mediaUserData));
		const updatedData = this.store.getState().mediaUserDataCache.get(mediaId, kind);

		if (updatedData.kind === MediaKind.TVSeason && mediaUserData.tmdb_show_id !== undefined && mediaUserData.tmdb_season_number !== undefined) {
			this.logger.debug('Updating TvSeason link data for media user data:', updatedData);
			// update or insert into tv season link table
			const tvSeasonLink: TvShowSeasonLink = {
				tmdb_season_id: mediaUserData.tmdb_id,
				tmdb_show_id: mediaUserData.tmdb_show_id,
				tmdb_season_number: mediaUserData.tmdb_season_number,
			};
			const { data: linkData, error: linkError } = await this.supabaseClient
				.from('tv_show_season_link')
				.upsert(tvSeasonLink, { onConflict: 'tmdb_season_id' });
				// .insert(tvSeasonLink);

			if (linkError) {
				this.logger.error('Error updating TvSeason link data for media user data:', linkError);
			} else {
				this.logger.debug('Updated TvSeason link data for media user data:', linkData);
			}
		}

		// delete fields that should not be sent to this table
		delete updatedData.tmdb_season_number;
		delete updatedData.tmdb_show_id;
		// auto-complete suggested those too:
		// delete updatedData.created_at; // remove created_at for upsert
		// delete updatedData.updated_at; // remove updated_at for upsert

		// update db
		const { data, error } = await this.supabaseClient
			.from('media_user_data')
			.upsert({
				...updatedData,
				user_id: session.user.id,
				tmdb_id: mediaId,
				kind: kind,
			}, { onConflict: 'user_id,tmdb_id,kind' });

		// On error, rollback state change
		if (error) {
			this.store.dispatch(new MediaUserDataChangedAction(mediaId, kind, previousData));
			this.logger.error('Error updating media user data:', error);
		}
		return Boolean(!error);
	}

}
