import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class InboxService {
  private readonly API = '/api';
  private http = inject(HttpClient);

  getAll(params: Record<string, any> = {}): Observable<any> {
    return this.http.get<any>(`${this.API}/conversations`, { params });
  }
  getStats(): Observable<any> {
    return this.http.get<any>(`${this.API}/conversations/stats/summary`);
  }
  sync(): Observable<any> {
    return this.http.post<any>(`${this.API}/conversations/sync`, {});
  }
  getById(id: string): Observable<any> {
    return this.http.get<any>(`${this.API}/conversations/${id}`);
  }
  updateStatus(id: string, status: string): Observable<any> {
    return this.http.put<any>(`${this.API}/conversations/${id}/status`, { status });
  }
  reply(id: string, data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/conversations/${id}/reply`, data);
  }
  linkDonor(id: string, donorId: string): Observable<any> {
    return this.http.post<any>(`${this.API}/conversations/${id}/link-donor`, { donorId });
  }
  createDonor(id: string, data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/conversations/${id}/create-donor`, data);
  }
  searchDonors(params: Record<string, any> = {}): Observable<any> {
    return this.http.get<any>(`${this.API}/conversations/donors/search`, { params });
  }
}
