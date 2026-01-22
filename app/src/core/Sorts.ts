import { MediaKindDetails, MediaKindItem } from "./Types";

export type FilterMediaType = MediaKindItem | MediaKindDetails

export type FilterSort = {
	value: string;
	label: string;
	function: (a: FilterMediaType, b: FilterMediaType) => number;
};
export const filterSorts: FilterSort[] = [
	{
		value: 'popularity',
		label: 'Popularity',
		function: (a: FilterMediaType & { details: { popularity: number } }, b: FilterMediaType & { details: { popularity: number } }) => {
			return (b.details.popularity! - a.details.popularity!);
		}
	},
	{
		value: 'vote_average',
		label: 'Average Vote',
		function: (a: FilterMediaType & { details: { vote_average: number } }, b: FilterMediaType & { details: { vote_average: number } }) => {
			return (b.details.vote_average! - a.details.vote_average!);
		}
	},
	{
		value: 'release_date',
		label: 'Release Date',
		function: (a: FilterMediaType & { details: { first_air_date?: string; release_date?: string } }, b: FilterMediaType & { details: { first_air_date?: string; release_date?: string } }) => {
			const dateA = 'first_air_date' in a.details ? a.details.first_air_date : a.details.release_date;
			const dateB = 'first_air_date' in b.details ? b.details.first_air_date : b.details.release_date;
			return (dateB || '').localeCompare(dateA || '');
		}
	},
]
