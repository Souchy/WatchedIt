import { ILogger, resolve } from "aurelia";
import { IRouteViewModel, Params, route, RouteNode } from '@aurelia/router';
import { GenreCode, MovieItem, PeopleCombinedCreditsResponse, Person, PersonItem, TMDB, TMDBResponseList, TVShowItem } from "@leandrowkz/tmdb";
import { MediaUserDataKind } from "../search-page/SearchPage";
import { MediaKind } from "src/core/MediaUserData";


// type MediaItem = (MovieItem | TVShowItem);
type Media = MediaUserDataKind & { details: (TVShowItem | MovieItem) };

@route({
	id: 'person',
	path: ['person/:id'],
	title: 'Person',
})
export class PersonPage implements IRouteViewModel {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('PersonPage');
	private readonly tmdb = resolve(TMDB);

	private personId: number;
	private person: Person;
	private credits: PeopleCombinedCreditsResponse | null = null;
	public bestKnownFor: Map<number, Media> = new Map();
	public bestKnownForList: Media[];
	public bestKnownForListMax: number;

	public castMap: Map<number, Media> = new Map();
	public castList: Media[];
	public castListMax: number;

	public crewMap: Map<number, Media> = new Map();
	public crewList: Media[];
	public crewListMax: number;

	canLoad(params: Params) {
		this.personId = parseInt(params.id ?? '');
		this.logger.debug('Person ID from route params:', this.personId);
		return !!this.personId;
	}
	async loading?(params: Params, next: RouteNode, current: RouteNode | null): Promise<void> {
		this.personId = parseInt(params.id ?? '');
		this.person = await this.tmdb.people.details(this.personId);
		this.logger.debug('Loaded person details:', this.person);
		this.credits = await this.tmdb.people.combinedCredits(this.personId);
		this.logger.debug('Loaded person combined credits:', this.credits);

		// As Cast or Crew, get best known for movies
		this.bestKnownFor = new Map();
		this.bestKnownForList = [];
		this.bestKnownForListMax = 0;
		this.castMap = new Map();
		this.castList = [];
		this.castListMax = 0;
		this.crewMap = new Map();
		this.crewList = [];
		this.crewListMax = 0;
		if (this.credits) {
			this.credits.cast.forEach(item => {
				// if(item.media_type == 'tv' && item.character?.toLowerCase().includes('self') && item.genre_ids.findIndex(genre => genre as number == 10767) != -1) {
				// 	// Skip reality TV shows
				// 	return;
				// }
				// Remove TV shows with genre Talk (10767) or News (10763)
				if(item.genre_ids.findIndex(genre => genre as number == 10767 || genre as number == 10763) != -1)
					return;
				// if(!item.character?.toLowerCase().includes('self'))
				// 	return;
				if (!this.bestKnownFor.has(item.id)) {
					const media = {
						kind: item.media_type == 'movie' ? MediaKind.Movie : MediaKind.TVShow,
						details: item
					};
					this.bestKnownFor.set(item.id, media);
					this.castMap.set(item.id, media);
					this.castList.push(media);
				}
			});
			this.credits.crew.forEach(item => {
				if (!this.bestKnownFor.has(item.id)) {
					const media = {
						kind: item.media_type == 'movie' ? MediaKind.Movie : MediaKind.TVShow,
						details: item
					};
					this.bestKnownFor.set(item.id, media);
					this.crewMap.set(item.id, media);
					this.crewList.push(media);
				}
			});
			this.bestKnownForList = Array.from(this.bestKnownFor.values()).sort((a, b) => b.details.popularity - a.details.popularity);
			// this.castList = this.castList.sort((a, b) => a.details["order"] - b.details["order"]);
			this.castList = this.castList.sort((a, b) => b.details.popularity - a.details.popularity);
			// this.castList = this.castList.sort((a, b) => b.details.vote_count - a.details.vote_count);
			// this.castList = this.castList.sort((a, b) => b.details.vote_count * b.details.popularity - a.details.vote_count * a.details.popularity);
			// this.crewList = this.crewList.sort((a, b) => b.details.vote_count - a.details.vote_count);
			this.crewList = this.crewList.sort((a, b) => b.details.popularity - a.details.popularity);
		}
		this.showMoreCredits();
		this.showMoreCast();
		this.showMoreCrew();
	}

	public showMoreCredits() {
		this.bestKnownForListMax += 15;
		this.bestKnownForListMax = Math.min(this.bestKnownForListMax, this.bestKnownForList.length);
	}

	public get isShowMoreCreditsVisible(): boolean {
		return this.bestKnownForListMax < this.bestKnownForList.length;
	}


	public showMoreCast() {
		this.castListMax += 15;
		this.castListMax = Math.min(this.castListMax, this.castList.length);
	}

	public get isShowMoreCastVisible(): boolean {
		return this.castListMax < this.castList.length;
	}

	public showMoreCrew() {
		this.crewListMax += 15;
		this.crewListMax = Math.min(this.crewListMax, this.crewList.length);
	}

	public get isShowMoreCrewVisible(): boolean {
		return this.crewListMax < this.crewList.length;
	}

	public get posterUrl(): string {
		if (this.person.profile_path) {
			return `https://image.tmdb.org/t/p/w200${this.person.profile_path}`;
		}
		return '';
	}

	public get title(): string {
		return this.person.name;
	}

	public get birthday(): string {
		return this.person.birthday ?? 'N/A';
	}

	public get birthYear(): string {
		return this.person.birthday ? this.person.birthday.split('-')[0] : 'N/A';
	}

	public get overview(): string {
		return this.person.biography;
	}

}
