import { Watch } from './../../../node_modules/@aurelia/i18n/node_modules/@aurelia/runtime-html/src/watch';
import { MediaKind, MediaUserData } from "src/core/MediaUserData";
import { WatchState } from "../WatchState";

export class UserDataCache {
	public mediaUserData: Record<string, MediaUserData> = {};

	public has(tmdbId: number, kind: MediaKind): boolean {
		const key = `${kind}-${tmdbId}`;
		return key in this.mediaUserData;
	}

	public get(tmdbId: number, kind: MediaKind): MediaUserData | null {
		const key = `${kind}-${tmdbId}`;
		return this.mediaUserData[key] || null;
	}

	public set(data: MediaUserData): void {
		const key = `${data.kind}-${data.tmdb_id}`;
		this.mediaUserData[key] = data;
	}

	public setMap(data: MediaUserData[]): void {
		this.mediaUserData = {};
		for (const item of data) {
			const key = `${item.kind}-${item.tmdb_id}`;
			this.mediaUserData[key] = item;
		}
	}

	public values(): MediaUserData[] {
		return Object.values(this.mediaUserData);
	}

	public keys(): string[] {
		return Object.keys(this.mediaUserData);
	}

	public size(): number {
		return this.keys().length;
	}

	public getByKey(key: string): MediaUserData | null {
		return this.mediaUserData[key] || null;
	}

	public getWatchState(tmdbId: number, kind: MediaKind): WatchState | null {
		const userData = this.get(tmdbId, kind);
		return userData ? userData.state : WatchState.Unlisted;
	}

}
