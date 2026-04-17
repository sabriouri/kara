import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class InstalmentService {
  private readonly API = '/api';
  private http = inject(HttpClient);

  getStats(): Observable<any> {
    return this.http.get<any>(`${this.API}/instalments/stats`);
  }

  getAll(params: Record<string, any> = {}): Observable<any> {
    return this.http.get<any>(`${this.API}/instalments`, { params });
  }

  syncIraiser(): Observable<any> {
    return this.http.post<any>(`${this.API}/instalments/sync-iraiser`, {});
  }

  syncGocardless(): Observable<any> {
    return this.http.post<any>(`${this.API}/instalments/sync-gocardless`, {});
  }

  getSyncHistory(): Observable<any> {
    return this.http.get<any>(`${this.API}/instalments/sync-history`);
  }

  getDuplicates(): Observable<any> {
    return this.http.get<any>(`${this.API}/instalments/duplicates`);
  }

  mergeDuplicates(keepId: string, removeId: string): Observable<any> {
    return this.http.post<any>(`${this.API}/instalments/merge`, { keepId, removeId });
  }
}
