import { route } from '@aurelia/router';
import { HomePage } from './pages/home-page/HomePage';
import { AboutPage } from './pages/about-page';
import { MoviePage } from './pages/movie-page/movie-page';
import { MissingPage } from './pages/missing-page';

@route({
  routes: [
    HomePage,
    {
      path: 'about',
      component: AboutPage,
      title: 'About',
    },
    MoviePage
  ],
  // fallback: MissingPage,
})
export class MyApp {
}
