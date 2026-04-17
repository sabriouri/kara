import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly API = '/api';
  private http = inject(HttpClient);

  getAll(): Observable<any> {
    return this.http.get<any>(`${this.API}/users`);
  }
}
