import { TVSeasonItem, TVShow } from "@leandrowkz/tmdb";
import { bindable } from "aurelia";

export class SeasonList {
	// @bindable
	// public tvshowid: string = '';
	// @bindable
	// public seasons: TVSeasonItem[] = [];
	@bindable
	public show: TVShow;;
	@bindable
	public size: number = 100; // px width for poster

	public max: number = 0;

	bound() {
		this.showMore();
	}

	public get columnStyle() {
		return `repeat(auto-fill, minmax(${this.size}px, 1fr))`;
	}

	public showMore() {
		this.max += 15;
		this.max = Math.min(this.max, this.seasons.length);
	}

	public get isShowMoreVisible(): boolean {
		return this.max < this.seasons.length;
	}

	public get seasons(): TVSeasonItem[] {
		return this.show.seasons ?? [];
	}
}
