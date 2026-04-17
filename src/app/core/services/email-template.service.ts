import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class EmailTemplateService {
  private readonly API = '/api';
  private http = inject(HttpClient);

  getAll(): Observable<any> {
    return this.http.get<any>(`${this.API}/email-templates`);
  }
  create(data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/email-templates`, data);
  }
  update(id: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.API}/email-templates/${id}`, data);
  }
  delete(id: string): Observable<any> {
    return this.http.delete<any>(`${this.API}/email-templates/${id}`);
  }
}
