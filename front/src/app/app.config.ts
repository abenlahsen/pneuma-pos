import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { pendingRequestsInterceptor } from './core/interceptors/pending-requests.interceptor';
import { requestTimeoutInterceptor } from './core/interceptors/request-timeout.interceptor';
import { devLatencyInterceptor } from './core/interceptors/dev-latency.interceptor';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([
        authInterceptor,
        pendingRequestsInterceptor,
        requestTimeoutInterceptor,
        // Après le suivi et le délai maximum, pour qu'ils voient l'attente simulée.
        ...(environment.production ? [] : [devLatencyInterceptor]),
      ]),
    ),
  ],
};
