import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent)
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: 'dashboard',      loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'wells',          loadComponent: () => import('./pages/wells/wells.component').then(m => m.WellsComponent) },
      { path: 'wells/tranches', loadComponent: () => import('./pages/tranches/tranches.component').then(m => m.TranchesComponent) },
      { path: 'wells/:id',      loadComponent: () => import('./pages/wells/well-detail/well-detail.component').then(m => m.WellDetailComponent) },
      { path: 'tranches/:id',   loadComponent: () => import('./pages/tranches/tranche-detail/tranche-detail.component').then(m => m.TrancheDetailComponent) },
      { path: 'mensualisations',    loadComponent: () => import('./pages/mensualisations/mensualisations.component').then(m => m.MensualisationsComponent) },
      { path: 'mensualisations/:id', loadComponent: () => import('./pages/mensualisations/mensual-detail/mensual-detail.component').then(m => m.MensualDetailComponent) },
      { path: 'orphans',        loadComponent: () => import('./pages/orphans/orphans.component').then(m => m.OrphansComponent) },
      { path: 'tickets',        loadComponent: () => import('./pages/tickets/tickets.component').then(m => m.TicketsComponent) },
      { path: 'tickets/:id',    loadComponent: () => import('./pages/tickets/ticket-detail/ticket-detail.component').then(m => m.TicketDetailComponent) },
      { path: 'notion',         loadComponent: () => import('./pages/notion/notion.component').then(m => m.NotionComponent) },
      { path: 'aqiqas',         loadComponent: () => import('./pages/aqiqas/aqiqas.component').then(m => m.AqiqasComponent) },
      { path: 'inbox',          loadComponent: () => import('./pages/inbox/inbox.component').then(m => m.InboxComponent) },
      { path: 'email-templates',loadComponent: () => import('./pages/email-templates/email-templates.component').then(m => m.EmailTemplatesComponent) },
      { path: 'virements',      loadComponent: () => import('./pages/virements/virements.component').then(m => m.VirementsComponent) },
      { path: 'projects',       loadComponent: () => import('./pages/projects/projects.component').then(m => m.ProjectsComponent) },
      { path: 'projects/:id',   loadComponent: () => import('./pages/projects/project-detail/project-detail.component').then(m => m.ProjectDetailComponent) },
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
