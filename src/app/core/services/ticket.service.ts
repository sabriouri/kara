import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly API = '/api';
  private http = inject(HttpClient);

  getAll(params: Record<string, any> = {}): Observable<any> {
    return this.http.get<any>(`${this.API}/tickets`, { params });
  }
  getById(id: string): Observable<any> {
    return this.http.get<any>(`${this.API}/tickets/${id}`);
  }
  create(data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/tickets`, data);
  }
  update(id: string, data: any): Observable<any> {
    return this.http.patch<any>(`${this.API}/tickets/${id}`, data);
  }
  delete(id: string): Observable<any> {
    return this.http.delete<any>(`${this.API}/tickets/${id}`);
  }
  addComment(id: string, data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/tickets/${id}/comments`, data);
  }
}
