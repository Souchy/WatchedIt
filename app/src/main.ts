import Aurelia, { AppTask, ConsoleSink, IContainer, LoggerConfiguration, LogLevel, Registration } from 'aurelia';
import { RouteNode, RouterConfiguration, Transition } from '@aurelia/router';
import { MyApp } from './my-app';
import { TrendingMovies } from './pages/trending-movies/TrendingMovies';
import * as SouchyAu from 'souchy.au';
import 'souchy.au/styles.css';
import { MovieMini } from './components/movie-mini/MovieMini';
import { MovieList } from './components/movie-list/MovieList';
import { HomePage } from './pages/home-page/HomePage';
import { MoviePage } from './pages/media-page/movie-page/MoviePage';
import { MissingPage } from './pages/missing-page';
import { AboutPage } from './pages/about-page';
import { WelcomePage } from './pages/welcome-page';
import { TMDB, TVShowsAPI } from '@leandrowkz/tmdb';
import { GenresMap } from './core/Genres';
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { StateDefaultConfiguration, IStore, IStoreRegistry } from '@aurelia/state';
import { initialState } from './core/state/AppState';
import { appStateHandler } from './core/state/AppHandler';
import { SupabaseService } from './core/services/SupabaseService';
import { AuthModule } from './components/auth-module/AuthModule';
import { AuthSignin } from './components/auth-module/auth-signin/AuthSignin';
import { Navbar } from './components/navbar/Navbar';
import { CallbackPage } from './pages/callback/CallbackPage';
import { TvShowPage } from './pages/media-page/tvshow-page/TvShowPage';
import { MyListPage } from './pages/my-list-page/MyListPage';
import { CastList } from './components/cast-list/CastList';
import { CrewList } from './components/crew-list/CrewList';
import { PersonPage } from './pages/person-page/PersonPage';
import { NewsPage } from './pages/news-page/NewsPage';
import { I18N } from '@aurelia/i18n';
import { SeasonList } from './pages/media-page/tvshow-page/season-list/SeasonList';
import { SearchEngines } from './pages/settings-page/search-engines/SearchEngines';
import { AppStorageLoader } from './core/state/AppStateStorage';

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_KEY, {
  auth: {
    // debug: true,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: {
      getItem: (key: string) => {
        return localStorage.getItem(key);
      },
      setItem: (key: string, value: string) => {
        localStorage.setItem(key, value);
      },
      removeItem: (key: string) => {
        localStorage.removeItem(key);
      }
    }
  },
});
const tmdb = new TMDB({ apiKey: import.meta.env.VITE_TMDB_API_KEY });

// Fetch TMDB genres
const genresMap = new GenresMap();
const localGenresMap = localStorage.getItem('tmdb_genres');
if (localGenresMap) {
  const parsed = JSON.parse(localGenresMap) as GenresMap;
  genresMap.movies = parsed.movies;
  genresMap.tv = parsed.tv;
} else {
  const movieGenres = await tmdb.genres.movie();
  const tvGenres = await tmdb.genres.tv();
  movieGenres.genres.forEach(g => genresMap.movies[g.id] = g.name);
  tvGenres.genres.forEach(g => genresMap.tv[g.id] = g.name);
  localStorage.setItem('tmdb_genres', JSON.stringify(genresMap));
}


const au = new Aurelia();
let i18n: I18N | null = null;

// Logger for development
if (import.meta.env.VITE_NODE_ENV !== 'production') {
  let logger = LoggerConfiguration.create({
    level: LogLevel.debug,
    colorOptions: 'colors',
    sinks: [ConsoleSink]
  });
  au.register(logger);
}


// Router
// au.register(RouterConfiguration.customize({}));
au.register(RouterConfiguration.customize({
  useNavigationModel: true,
  useUrlFragmentHash: false,
  // activeClass: "toggled",
  historyStrategy: 'push',     // Browser history
  // buildTitle(tr: Transition) {
  //   // Use the I18N to translate the titles using the keys from data.i18n.
  //   i18n ??= au.container.get(I18N);
  //   // const root = tr.routeTree.root;
  //   const child = tr.routeTree.root.children[0];
  //   return `${i18n.tr(child.data.i18n as string)}`;
  // },
  // buildTitle: (tr: Transition) => {
  //   const root = tr.routeTree.root;
  //   const baseTitle = root.context.routeConfigContext.config.title;
  //   const titlePart = root.children.map(c => c.title).join(' - ');
  //   return `${baseTitle} - ${titlePart}`;
  // },
  basePath: '/',
}));

//  Load initial state
AppStorageLoader.loadSearchEngines(initialState);

// Services
au.register(StateDefaultConfiguration.init(initialState, appStateHandler));
au.register(Registration.instance(TMDB, tmdb));
au.register(Registration.instance(SupabaseClient, supabase));
au.register(Registration.singleton(SupabaseService, SupabaseService));
au.register(Registration.instance(GenresMap, genresMap));
// au.register(Registration.singleton(AppStateStorage, AppStateStorage));
// Components
au.register(SouchyAu);
au.register(MoviePage, HomePage, MissingPage, AboutPage, WelcomePage, CallbackPage, TvShowPage, MyListPage, PersonPage, NewsPage);
au.register(TrendingMovies, MovieList, MovieMini, AuthModule, AuthSignin, Navbar, CastList, CrewList, SeasonList, SearchEngines);


await au.app(MyApp).start();
