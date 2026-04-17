import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TaskService {
  private readonly API = '/api';
  private http = inject(HttpClient);

  getAll(params: Record<string, any> = {}): Observable<any> {
    return this.http.get<any>(`${this.API}/tasks`, { params });
  }
  create(data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/tasks`, data);
  }
  update(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.API}/tasks/${id}`, data);
  }
}
