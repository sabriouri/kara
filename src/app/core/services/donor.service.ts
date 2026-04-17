import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DonorService {
  private readonly API = '/api';
  private http = inject(HttpClient);

  create(data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/donors`, data);
  }
}
