import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WellService {
  private readonly API = '/api';
  private http = inject(HttpClient);

  getAll(params: Record<string, any> = {}): Observable<any> {
    return this.http.get<any>(`${this.API}/wells`, { params });
  }

  getById(id: string): Observable<any> {
    return this.http.get<any>(`${this.API}/wells/${id}`);
  }

  getStats(): Observable<any> {
    return this.http.get<any>(`${this.API}/wells/stats`);
  }

  create(data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/wells/create`, data);
  }

  bulkImport(wells: any[]): Observable<any> {
    return this.http.post<any>(`${this.API}/wells/bulk-import`, { wells });
  }

  update(id: string, data: any): Observable<any> {
    return this.http.patch<any>(`${this.API}/wells/${id}`, data);
  }

  addComment(id: string, content: string): Observable<any> {
    return this.http.post<any>(`${this.API}/wells/${id}/comments`, { content });
  }
}
