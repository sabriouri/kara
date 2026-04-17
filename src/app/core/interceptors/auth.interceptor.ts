import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Ne pas intercepter les appels vers des APIs externes
  if (!req.url.startsWith('/api')) {
    return next(req);
  }

  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      }
    });
  }

  return next(req);
};
