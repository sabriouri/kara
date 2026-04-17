import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AqiqaService {
  private readonly API = '/api';
  private http = inject(HttpClient);

  getStats(): Observable<any> {
    return this.http.get<any>(`${this.API}/aqiqas/stats`);
  }
  getAll(params: Record<string, any> = {}): Observable<any> {
    return this.http.get<any>(`${this.API}/aqiqas`, { params });
  }
  update(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.API}/aqiqas/${id}`, data);
  }
  getReport(id: string): Observable<Blob> {
    return this.http.get(`${this.API}/aqiqas/${id}/report`, { responseType: 'blob' });
  }
}
