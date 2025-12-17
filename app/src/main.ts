import Aurelia, { ConsoleSink, LoggerConfiguration, LogLevel, Registration } from 'aurelia';
import { RouterConfiguration } from '@aurelia/router';
import { MyApp } from './my-app';
import { TrendingMovies } from './pages/trending-movies/TrendingMovies';
import { RelatedMovies } from './pages/related-movies/RelatedMovies';
import * as SouchyAu from 'souchy.au';
import 'souchy.au/styles.css';
import { MovieMini } from './components/movie-mini/MovieMini';
import { MovieList } from './components/movie-list/MovieList';
import { HomePage } from './pages/home-page/HomePage';
import { MoviePage } from './pages/movie-page/MoviePage';
import { MissingPage } from './pages/missing-page';
import { AboutPage } from './pages/about-page';
import { WelcomePage } from './pages/welcome-page';
import { TMDB } from '@leandrowkz/tmdb';
import { GenresMap } from './core/Genres';

const tmdb = new TMDB({ apiKey: import.meta.env.VITE_TMDB_API_KEY });

const genresMap = new GenresMap();
const localGenresMap = localStorage.getItem('tmdb_genres');
if(localGenresMap) {
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
// let i18n: I18N | null = null;

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
  basePath: '/',
}));

// Components
au.register(SouchyAu);
au.register(Registration.instance(TMDB, tmdb));
au.register(Registration.instance(GenresMap, genresMap));
au.register(MoviePage, HomePage, MissingPage, AboutPage, WelcomePage);
au.register(TrendingMovies, RelatedMovies, MovieList, MovieMini);


await au.app(MyApp).start();
