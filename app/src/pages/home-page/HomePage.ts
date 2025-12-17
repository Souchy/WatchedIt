import { route } from "@aurelia/router";
import { ILogger, resolve } from "aurelia";
import { MoviePage } from "../movie-page/movie-page";


// @route({
// 	id: 'home',
// 	path: ['', 'home'],
// 	title: 'Home',
// 	routes: [
// 		MoviePage
// 	],
// })
// @route({
// 	routes: [
// 		MoviePage
// 	],
// })
export class HomePage {
	private readonly logger: ILogger = resolve(ILogger).scopeTo('HomePage');


}
