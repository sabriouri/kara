import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ProjectService {
  private readonly API = '/api';
  private http = inject(HttpClient);

  getAll(): Observable<any> {
    return this.http.get<any>(`${this.API}/projects`);
  }
  getById(id: string): Observable<any> {
    return this.http.get<any>(`${this.API}/projects/${id}`);
  }
  create(data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/projects`, data);
  }
  delete(id: string): Observable<any> {
    return this.http.delete<any>(`${this.API}/projects/${id}`);
  }
  createMilestone(projectId: string, data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/projects/${projectId}/milestones`, data);
  }
  updateMilestone(projectId: string, milestoneId: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.API}/projects/${projectId}/milestones/${milestoneId}`, data);
  }
  deleteMilestone(projectId: string, milestoneId: string): Observable<any> {
    return this.http.delete<any>(`${this.API}/projects/${projectId}/milestones/${milestoneId}`);
  }
  updateTask(projectId: string, milestoneId: string, taskId: string, data: any): Observable<any> {
    return this.http.put<any>(`${this.API}/projects/${projectId}/milestones/${milestoneId}/tasks/${taskId}`, data);
  }
  createTask(projectId: string, milestoneId: string, data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/projects/${projectId}/milestones/${milestoneId}`, data);
  }
  addMember(projectId: string, data: any): Observable<any> {
    return this.http.post<any>(`${this.API}/projects/${projectId}/members`, data);
  }
  removeMember(projectId: string, memberId: string): Observable<any> {
    return this.http.delete<any>(`${this.API}/projects/${projectId}/members/${memberId}`);
  }
}
