import { bindable } from "aurelia";
import { IRouteViewModel } from '@aurelia/router';
import { PersonCast } from "@leandrowkz/tmdb";


export class CastList implements IRouteViewModel {
	
	@bindable 
	public cast: PersonCast[] = [];
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
		this.max = Math.min(this.max, this.cast.length);
	}

	public get isShowMoreVisible(): boolean {
		return this.max < this.cast.length;
	}

}
