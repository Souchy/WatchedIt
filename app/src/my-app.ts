import { route } from '@aurelia/router';
import { HomePage } from './pages/home-page/HomePage';
import { AboutPage } from './pages/about-page';
import { MoviePage } from './pages/movie-page/MoviePage';
import { MissingPage } from './pages/missing-page';
import { IStore } from '@aurelia/state';
import { ILogger, inject, resolve } from 'aurelia';
import { AppState } from './core/state/AppState';
import { AppAction } from './core/state/AppHandler';
import { SupabaseService } from './core/services/SupabaseService';
import { CallbackPage } from './pages/callback/CallbackPage';
import { TVShowPage } from './pages/tvshow-page/TVShowPage';
import { SearchPage } from './pages/search-page/SearchPage';

@route({
  routes: [
    HomePage,
    {
      path: 'about',
      component: AboutPage,
      title: 'About',
    },
    MoviePage,
    TVShowPage,
    SearchPage,
    CallbackPage
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
@inject(IStore, SupabaseService)
export class MyApp {
  private logger = resolve(ILogger).scopeTo('MyApp');

  public constructor(private readonly store: IStore<AppState, AppAction>, private supabase: SupabaseService) {
  }

  async attached() {
    // TODO: Sign in silently if possible
    this.logger.trace('MyApp activated', this.store, this.supabase);
    // await this.supabase.supabaseClient.auth.signInWithOAuth

    // let res = await this.supabase.supabaseClient.auth.signInWithOAuth({
    //   provider: 'azure',
    //   options: {
    //     redirectTo: window.location.origin,
    //   }
    // });
    // this.logger.debug('Supabase OAuth Sign-In Result:', res);

    // await this.supabase.fetchMediaUserDataMap();
  }

  // public dispose() {
  //   this.supabase.dispose();
  // }

}
