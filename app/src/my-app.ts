import { route } from '@aurelia/router';
import { HomePage } from './pages/home-page/HomePage';
import { AboutPage } from './pages/about-page';
import { MoviePage } from './pages/movie-page/MoviePage';
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
    // {
    //   path: ['', 'home'],
    //   id: 'home', title: 'Home',
    //   viewport: 'default',
    //   component: import('./pages/home-page/HomePage'),
    //   // routes: [
    //   //   MoviePage
    //   // ]
    // },
    // {
    //   path: 'about',
    //   id: 'about', title: 'About',
    //   viewport: 'default',
    //   component: import('./pages/about-page'),
    // },
    // {
    //   path: 'movie/:id',
    //   id: 'movie', title: 'Movie',
    //   viewport: 'default',
    //   component: import('./pages/movie-page/movie-page'),
    // },
  ],
  fallback: MissingPage,
})
export class MyApp {
}
