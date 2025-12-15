import { route } from '@aurelia/router';

@route({
  routes: [
    {
      path: ['', 'welcome'],
      component: import('./pages/welcome-page'),
      title: 'Welcome',
    },
    {
      path: 'about',
      component: import('./pages/about-page'),
      title: 'About',
    },
  ],
  fallback: import('./pages/missing-page'),
})
export class MyApp {
}
