import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('accessToken') || localStorage.getItem('token');

  if (token) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
        ...(req.method === 'GET' ? { 'Cache-Control': 'no-cache' } : {})
      }
    });
  }

  return next(req);
};
