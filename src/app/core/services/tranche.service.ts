import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TrancheService {
  private readonly API = '/api';
  private http = inject(HttpClient);

  getAll(params: Record<string, any> = {}): Observable<any> {
    return this.http.get<any>(`${this.API}/tranches`, { params });
  }

  getById(id: string): Observable<any> {
    return this.http.get<any>(`${this.API}/tranches/${id}`);
  }

  create(data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/tranches`, data);
  }

  update(id: string, data: any): Observable<any> {
    return this.http.patch<any>(`${this.API}/tranches/${id}`, data);
  }

  updateStatus(id: string, status: string): Observable<any> {
    return this.http.put<any>(`${this.API}/tranches/${id}/status`, { status });
  }

  addWells(id: string, wellIds: string[]): Observable<any> {
    return this.http.put<any>(`${this.API}/tranches/${id}/wells/add`, { wellIds });
  }

  getAvailableWells(country: string): Observable<any> {
    return this.http.get<any>(`${this.API}/tranches/wells/available`, { params: { country } });
  }
}
