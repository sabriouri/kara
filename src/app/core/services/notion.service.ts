import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotionService {
  private readonly API = '/api';
  private http = inject(HttpClient);

  getAll(params: Record<string, any> = {}): Observable<any> {
    return this.http.get<any>(`${this.API}/notion`, { params });
  }
  getTags(): Observable<any> {
    return this.http.get<any>(`${this.API}/notion/meta/tags`);
  }
  getById(id: string): Observable<any> {
    return this.http.get<any>(`${this.API}/notion/${id}`);
  }
  create(data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/notion`, data);
  }
  update(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.API}/notion/${id}`, data);
  }
  delete(id: string): Observable<any> {
    return this.http.delete<any>(`${this.API}/notion/${id}`);
  }
}
