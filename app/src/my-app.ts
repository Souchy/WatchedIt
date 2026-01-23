import { route } from '@aurelia/router';
import { HomePage } from './pages/home-page/HomePage';
import { AboutPage } from './pages/about-page';
import { MoviePage } from './pages/media-page/movie-page/MoviePage';
import { MissingPage } from './pages/missing-page';
import { IStore } from '@aurelia/state';
import { ILogger, inject, resolve } from 'aurelia';
import { AppState } from './core/state/AppState';
import { AppAction } from './core/state/AppHandler';
import { SupabaseService } from './core/services/SupabaseService';
import { SearchPage } from './pages/search-page/SearchPage';
import { TvShowPage } from './pages/media-page/tvshow-page/TvShowPage';
import { MyListPage } from './pages/my-list-page/MyListPage';
import { PersonPage } from './pages/person-page/PersonPage';
import { NewsPage } from './pages/news-page/NewsPage';
import { SeasonPage } from './pages/media-page/season-page/SeasonPage';
import { SettingsPage } from './pages/settings-page/SettingsPage';

@route({
  routes: [
    HomePage,
    {
      path: 'about',
      component: AboutPage,
      title: 'About',
    },
    SettingsPage,
    MoviePage,
    TvShowPage,
    PersonPage,
    SearchPage,
    MyListPage,
    NewsPage,
    SeasonPage,
  ],
  fallback: MissingPage,
})
@inject(IStore, SupabaseService)
export class MyApp {
  private logger = resolve(ILogger).scopeTo('MyApp');

  public constructor(private readonly store: IStore<AppState, AppAction>, private supabase: SupabaseService) {
  }

}
