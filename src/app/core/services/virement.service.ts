import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class VirementService {
  private readonly API = '/api';
  private http = inject(HttpClient);

  getPaymentSources(): Observable<any> {
    return this.http.get<any>(`${this.API}/virements/payment-sources`);
  }

  validate(data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/virements/validate`, data);
  }
}
