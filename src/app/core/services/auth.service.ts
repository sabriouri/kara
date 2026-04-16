import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { User, AuthResponse } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = '/api';

  private _user = signal<User | null>(null);
  private _loading = signal<boolean>(true);

  readonly user = this._user.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly isAuthenticated = computed(() => !!this._user());

  constructor(private http: HttpClient, private router: Router) {
    this.checkSession();
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/auth/login`, { email, password }).pipe(
      tap(res => {
        const { user, accessToken, refreshToken } = res.data;
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('token', accessToken);
        this._user.set(user);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('token');
    this._user.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('accessToken') || localStorage.getItem('token');
  }

  private checkSession(): void {
    const token = this.getToken();
    if (!token) { this._loading.set(false); return; }

    this.http.get<{ data: { user: User } }>(`${this.API}/auth/me`).subscribe({
      next: res => {
        this._user.set(res.data.user);
        this._loading.set(false);
      },
      error: () => {
        this.logout();
        this._loading.set(false);
      }
    });
  }
}
