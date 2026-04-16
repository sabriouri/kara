import { Component, signal, computed, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { PoleService } from '../../core/services/pole.service';
import { LucideAngularModule } from 'lucide-angular';

// ── Interfaces ────────────────────────────────────────────────────────────────

interface StatusItem  { projectStatus: string; _count: { id: number }; }
interface CountryItem { country: string;        _count: { id: number }; }

interface WellsStats {
  total:           number;
  totalAmount:     number;
  paidAmount:      number;
  remainingAmount: number;
  byStatus:        StatusItem[];
  byCountry:       CountryItem[];
}

interface WeatherState {
  code:      number;
  temp:      number;
  icon:      string;
  label:     string;
  animClass: string;
  color:     string;
  isNight:   boolean;
}


// ── Quick actions per pole ────────────────────────────────────────────────────

const POLE_QUICK_ACTIONS: Record<string, { label: string; sub: string; path: string; icon: string; color: string }[]> = {
  rd: [
    { label: 'Puits',          sub: 'Gestion des projets',  path: '/wells',           icon: 'droplets',      color: '#3b82f6' },
    { label: 'Mensualisations', sub: 'Suivi paiements',     path: '/mensualisations', icon: 'euro',          color: '#8b5cf6' },
    { label: 'Tranches',       sub: 'Gestion tranches',     path: '/wells/tranches',  icon: 'layers',        color: '#f59e0b' },
    { label: 'Orphelins',      sub: 'Parrainages',          path: '/orphans',         icon: 'users',         color: '#ec4899' },
    { label: 'Aqiqas',         sub: 'Sacrifices',           path: '/aqiqas',          icon: 'heart',         color: '#10b981' },
    { label: 'Messagerie',     sub: 'Boîte de réception',   path: '/inbox',           icon: 'mail',          color: '#06b6d4' },
  ],
  marketing: [
    { label: 'Tickets',    sub: 'Gestion tickets',    path: '/tickets',  icon: 'ticket',        color: '#ef4444' },
    { label: 'Projets',    sub: 'Suivi projets',      path: '/projects', icon: 'folder-kanban', color: '#3b82f6' },
    { label: 'Notion',     sub: 'Base connaissance',  path: '/notion',   icon: 'book-open',     color: '#8b5cf6' },
    { label: 'Messagerie', sub: 'Boîte de réception', path: '/inbox',    icon: 'mail',          color: '#06b6d4' },
  ],
  compta: [
    { label: 'Virements',  sub: 'Gestion virements',  path: '/virements', icon: 'landmark',      color: '#10b981' },
    { label: 'Tickets',    sub: 'Support',            path: '/tickets',   icon: 'ticket',        color: '#ef4444' },
    { label: 'Projets',    sub: 'Suivi projets',      path: '/projects',  icon: 'folder-kanban', color: '#3b82f6' },
  ],
  projet: [
    { label: 'Projets',    sub: 'Gestion projets',    path: '/projects', icon: 'folder-kanban', color: '#f59e0b' },
    { label: 'Tickets',    sub: 'Support',            path: '/tickets',  icon: 'ticket',        color: '#ef4444' },
    { label: 'Notion',     sub: 'Base connaissance',  path: '/notion',   icon: 'book-open',     color: '#8b5cf6' },
  ],
  social: [
    { label: 'Orphelins',  sub: 'Parrainages',        path: '/orphans',  icon: 'users',         color: '#ec4899' },
    { label: 'Aqiqas',     sub: 'Sacrifices',         path: '/aqiqas',   icon: 'heart',         color: '#10b981' },
    { label: 'Tickets',    sub: 'Support',            path: '/tickets',  icon: 'ticket',        color: '#ef4444' },
    { label: 'Projets',    sub: 'Suivi projets',      path: '/projects', icon: 'folder-kanban', color: '#3b82f6' },
  ],
};

// ── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly API = '/api';

  // ── Pole ──────────────────────────────────────────────────────────────────
  currentPole = computed(() => this.poleService.currentPoleId());

  quickActions = computed(() => POLE_QUICK_ACTIONS[this.currentPole()] ?? []);

  poleName = computed(() => {
    const names: Record<string, string> = {
      rd:        'Relation Donateur',
      marketing: 'Marketing',
      compta:    'Comptabilité',
      projet:    'Pôle Projet',
      social:    'Social France',
    };
    return names[this.currentPole()] ?? 'Dashboard';
  });

  // ── Data signals ──────────────────────────────────────────────────────────
  wellsStats = signal<WellsStats | null>(null);
  loading    = signal(true);
  mounted    = signal(false);
  weather    = signal<WeatherState | null>(null);

  // ── Static labels ─────────────────────────────────────────────────────────
  readonly greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  })();

  readonly today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  readonly statusMap: Record<string, { label: string; color: string }> = {
    PLANIFIE:            { label: 'Planifié',        color: '#f59e0b' },
    EN_TRAVAUX:          { label: 'En travaux',      color: '#3b82f6' },
    TERMINE:             { label: 'Terminé',         color: '#10b981' },
    TRANCHE_1_INAUGUREE: { label: 'Tranche 1',       color: '#ec4899' },
    TRANCHE_2_INAUGUREE: { label: 'Tranche 2',       color: '#f97316' },
    TRANCHE_3_INAUGUREE: { label: 'Tranche 3',       color: '#8b5cf6' },
    EN_ATTENTE:          { label: 'En attente',      color: '#64748b' },
    MEDIAS_ATTENDUS:     { label: 'Médias att.',     color: '#06b6d4' },
    MEDIAS_RECUS:        { label: 'Médias reçus',    color: '#0891b2' },
    PRET_A_LIVRER:       { label: 'Prêt livraison',  color: '#7c3aed' },
    LIVRE:               { label: 'Livré',           color: '#16a34a' },
    ARCHIVE:             { label: 'Archivé',         color: '#94a3b8' },
  };

  constructor(
    private http: HttpClient,
    public auth: AuthService,
    private router: Router,
    private poleService: PoleService,
  ) {
    effect(() => {
      const poleId = this.currentPole();
      this.loading.set(true);
      this.loadDataForPole(poleId);
    });
  }

  ngOnInit(): void {
    this.loadWeather();
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  loadDataForPole(_poleId: string): void {
    this.wellsStats.set(null);

    this.http.get<any>(`${this.API}/wells/stats`).subscribe({
      next: res => {
        this.wellsStats.set(res.data ?? res);
        this.loading.set(false);
        setTimeout(() => this.mounted.set(true), 50);
      },
      error: () => {
        this.loading.set(false);
        setTimeout(() => this.mounted.set(true), 50);
      },
    });
  }

  // ── Weather ───────────────────────────────────────────────────────────────

  private loadWeather(): void {
    const url = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=48.958&longitude=2.957'
      + '&current=weather_code,temperature_2m,is_day'
      + '&timezone=Europe%2FParis';

    this.http.get<any>(url).subscribe({
      next: res => {
        const c = res?.current;
        if (!c) return;
        const code    = c.weather_code ?? 0;
        const temp    = Math.round(c.temperature_2m ?? 0);
        const isNight = c.is_day === 0;
        this.weather.set({
          code, temp, isNight,
          ...this.resolveWeather(code, isNight),
        });
      },
      error: () => { /* silencieux – icône par défaut dans le template */ },
    });
  }

  private resolveWeather(code: number, isNight: boolean): {
    icon: string; label: string; animClass: string; color: string;
  } {
    if (code === 0) {
      return isNight
        ? { icon: 'moon-star',       label: 'Nuit claire',           animClass: 'weather-pulse', color: '#a78bfa' }
        : { icon: 'sun',             label: 'Ciel dégagé',           animClass: 'weather-spin',  color: '#fbbf24' };
    }
    if (code === 1) {
      return isNight
        ? { icon: 'moon',            label: 'Nuit dégagée',          animClass: 'weather-float', color: '#c4b5fd' }
        : { icon: 'sun-dim',         label: 'Peu nuageux',           animClass: 'weather-spin',  color: '#fcd34d' };
    }
    if (code === 2) {
      return isNight
        ? { icon: 'cloud-moon',      label: 'Partiellement nuageux', animClass: 'weather-float', color: '#93c5fd' }
        : { icon: 'cloud-sun',       label: 'Partiellement nuageux', animClass: 'weather-float', color: '#60a5fa' };
    }
    if (code === 3)              return { icon: 'cloudy',           label: 'Couvert',             animClass: 'weather-float', color: '#94a3b8' };
    if ([45,48].includes(code))  return { icon: 'cloud-fog',        label: 'Brouillard',          animClass: 'weather-float', color: '#94a3b8' };
    if ([51,53,55].includes(code)) return { icon: 'cloud-drizzle',  label: 'Bruine',              animClass: 'weather-drip',  color: '#7dd3fc' };
    if ([56,57].includes(code))  return { icon: 'cloud-drizzle',    label: 'Bruine verglaçante',  animClass: 'weather-drip',  color: '#bfdbfe' };
    if ([61,63,65].includes(code)) return { icon: 'cloud-rain',     label: 'Pluie',               animClass: 'weather-drip',  color: '#38bdf8' };
    if ([66,67].includes(code))  return { icon: 'cloud-hail',       label: 'Pluie verglaçante',   animClass: 'weather-drip',  color: '#bae6fd' };
    if ([71,73,75].includes(code)) return { icon: 'cloud-snow',     label: 'Neige',               animClass: 'weather-snow',  color: '#e0f2fe' };
    if (code === 77)             return { icon: 'snowflake',         label: 'Grains de neige',     animClass: 'weather-snow',  color: '#bfdbfe' };
    if ([80,81,82].includes(code)) return { icon: 'cloud-rain-wind', label: 'Averses',            animClass: 'weather-drip',  color: '#38bdf8' };
    if ([85,86].includes(code))  return { icon: 'cloud-snow',       label: 'Averses de neige',    animClass: 'weather-snow',  color: '#e0f2fe' };
    if (code === 95)             return { icon: 'cloud-lightning',   label: 'Orage',               animClass: 'weather-flash', color: '#fde68a' };
    if ([96,99].includes(code))  return { icon: 'cloud-hail',       label: 'Orage avec grêle',    animClass: 'weather-flash', color: '#fde68a' };
    return { icon: 'sun', label: 'Météo', animClass: 'weather-spin', color: '#fbbf24' };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  paidPct(): number {
    const s = this.wellsStats();
    if (!s || !s.totalAmount) return 0;
    return Math.round((s.paidAmount / s.totalAmount) * 100);
  }

  statusPct(item: StatusItem): number {
    const s = this.wellsStats();
    if (!s || !s.total) return 0;
    return Math.round((item._count.id / s.total) * 100);
  }

  countryPct(item: CountryItem): number {
    const s = this.wellsStats();
    if (!s || !s.total) return 0;
    return Math.round((item._count.id / s.total) * 100);
  }

  getStatusInfo(key: string): { label: string; color: string } {
    return this.statusMap[key] ?? { label: key.replace(/_/g, ' '), color: '#64748b' };
  }

  navigate(path: string): void {
    this.router.navigate([path]);
  }

  fmt(n: number): string {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n ?? 0);
  }

  fmtN(n: number): string {
    return new Intl.NumberFormat('fr-FR').format(n ?? 0);
  }
}
