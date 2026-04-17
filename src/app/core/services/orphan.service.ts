import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OrphanService {
  private readonly API = '/api';
  private http = inject(HttpClient);

  getAll(params: Record<string, any> = {}): Observable<any> {
    return this.http.get<any>(`${this.API}/orphans`, { params });
  }
  getStats(): Observable<any> {
    return this.http.get<any>(`${this.API}/orphans/stats`);
  }
  getWaitlist(params: Record<string, any> = {}): Observable<any> {
    return this.http.get<any>(`${this.API}/orphans/waitlist/list`, { params });
  }
  getOhmeStatus(): Observable<any> {
    return this.http.get<any>(`${this.API}/orphans/ohme/status`);
  }
  syncOhme(): Observable<any> {
    return this.http.post<any>(`${this.API}/orphans/ohme/sync-all`, {});
  }
  getFiles(id: string): Observable<any> {
    return this.http.get<any>(`${this.API}/orphans/${id}/files`);
  }
  update(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.API}/orphans/${id}`, data);
  }
  suspend(id: string, reason: string): Observable<any> {
    return this.http.post<any>(`${this.API}/orphans/${id}/suspend`, { reason });
  }
  reactivate(id: string): Observable<any> {
    return this.http.post<any>(`${this.API}/orphans/${id}/reactivate`, {});
  }
  assign(id: string, sponsorId: string, waitlistId: string | null): Observable<any> {
    return this.http.post<any>(`${this.API}/orphans/${id}/assign`, { sponsorId, waitlistId });
  }
  create(data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/orphans`, data);
  }
  createWaitlist(data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/orphans/waitlist`, data);
  }
  updateWaitlist(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.API}/orphans/waitlist/${id}`, data);
  }
  deleteWaitlist(id: string): Observable<any> {
    return this.http.delete<any>(`${this.API}/orphans/waitlist/${id}`);
  }
}
