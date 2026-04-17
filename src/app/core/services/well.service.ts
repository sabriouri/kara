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

  addComment(id: string, data: string | Record<string, any>): Observable<any> {
    const body = typeof data === 'string' ? { content: data } : data;
    return this.http.post<any>(`${this.API}/wells/${id}/comments`, body);
  }

  getComments(id: string): Observable<any> {
    return this.http.get<any>(`${this.API}/wells/${id}/comments`);
  }

  updateComment(wellId: string, commentId: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.API}/wells/${wellId}/comments/${commentId}`, data);
  }

  deleteComment(wellId: string, commentId: string): Observable<any> {
    return this.http.delete<any>(`${this.API}/wells/${wellId}/comments/${commentId}`);
  }
}
