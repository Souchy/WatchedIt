import { Movie, Person, TMDB, TVSeason, TVShow } from "@leandrowkz/tmdb";
import { MediaKind } from "../MediaUserData";
import { getMainMediaApi, MediaDetails } from "../Types";
import { resolve } from "aurelia";


export class TMDBDataCache {
	
	public tmdbData: Record<string, MediaDetails> = {};

	public get(tmdbId: number, kind: MediaKind): MediaDetails | null {
		const key = `${kind}-${tmdbId}`;
		return this.tmdbData[key] || null;
	}

	public set(data: MediaDetails, kind: MediaKind): void {
		const key = `${kind}-${data.id}`;
		this.tmdbData[key] = data;
	}

	public getByKey(key: string): MediaDetails | null {
		return this.tmdbData[key] || null;
	}

	public setByKey(key: string, data: MediaDetails): void {
		this.tmdbData[key] = data;
	}

	public values(): MediaDetails[] {
		return Object.values(this.tmdbData);
	}

	public keys(): string[] {
		return Object.keys(this.tmdbData);
	}

	public has(tmdbId: number, kind: MediaKind): boolean {
		const key = `${kind}-${tmdbId}`;
		return key in this.tmdbData;
	}

}
