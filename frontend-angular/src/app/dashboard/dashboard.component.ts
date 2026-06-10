import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TicketService } from '../tickets/services/ticket.service';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="layout">
      <header>
        <span>TicketFlow</span>
        <div class="nav">
          <button (click)="irTickets()">Gestionar Tickets</button>
          <span>{{ usuario.nombre }}</span>
          <button (click)="logout()">Salir</button>
        </div>
      </header>

      <main>
        <h2 class="animate__animated animate__fadeInDown">Dashboard</h2>

        <!-- Por estado -->
        <div class="seccion">
          <h3 class="animate__animated animate__fadeIn">Tickets por estado</h3>
          <div class="tarjetas">
            <div class="tarjeta animate__animated animate__fadeInUp"
                 *ngFor="let e of stats.porEstado; let i = index"
                 [style.animationDelay]="i * 0.15 + 's'"
                 [style.borderColor]="e.estado === 'Abierto' ? '#3498db' : e.estado === 'Cerrado' ? '#2ecc71' : '#f39c12'">
              <div class="numero">{{ e.total }}</div>
              <div class="label">{{ e.estado }}</div>
            </div>
          </div>
        </div>

        <!-- Por prioridad -->
        <div class="seccion">
          <h3 class="animate__animated animate__fadeIn" style="animation-delay:0.2s">Tickets por prioridad</h3>
          <div class="tarjetas">
            <div class="tarjeta animate__animated animate__fadeInUp"
                 *ngFor="let p of stats.porPrioridad; let i = index"
                 [style.animationDelay]="(i * 0.15 + 0.3) + 's'"
                 [style.borderColor]="p.prioridad === 'Alta' ? '#e74c3c' : p.prioridad === 'Media' ? '#f39c12' : '#2ecc71'">
              <div class="numero">{{ p.total }}</div>
              <div class="label">{{ p.prioridad }}</div>
            </div>
          </div>
        </div>

        <!-- Por categoría -->
        <div class="seccion">
          <h3 class="animate__animated animate__fadeIn" style="animation-delay:0.4s">Tickets por categoría</h3>
          <div class="tarjetas">
            <div class="tarjeta animate__animated animate__fadeInUp"
                 *ngFor="let c of stats.porCategoria; let i = index"
                 [style.animationDelay]="(i * 0.15 + 0.6) + 's'">
              <div class="numero">{{ c.total }}</div>
              <div class="label">{{ c.nombre }}</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    * { box-sizing: border-box; }
    .layout { min-height: 100vh; background: #f5f5f5; font-family: sans-serif; }

    header {
      background: #333; color: white;
      padding: 0 2rem; height: 52px;
      display: flex; align-items: center; justify-content: space-between;
    }
    header span { font-weight: 600; }
    .nav { display: flex; align-items: center; gap: 12px; font-size: 14px; }
    .nav button {
      background: none; border: 1px solid #fff;
      color: white; padding: 4px 12px;
      border-radius: 6px; cursor: pointer;
    }

    main { padding: 2rem; }
    h2 { margin: 0 0 1.5rem; font-size: 22px; }
    h3 { margin: 0 0 1rem; font-size: 16px; color: #555; }

    .seccion { margin-bottom: 2rem; }

    .tarjetas { display: flex; gap: 1rem; flex-wrap: wrap; }
    .tarjeta {
      background: white; border-radius: 12px;
      padding: 1.5rem 2rem; min-width: 140px;
      border-left: 4px solid #333;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      text-align: center;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .tarjeta:hover {
      transform: translateY(-4px);
      box-shadow: 0 6px 16px rgba(0,0,0,0.12);
    }
    .numero { font-size: 36px; font-weight: 700; color: #333; }
    .label { font-size: 14px; color: #888; margin-top: 4px; }
  `]
})
export class DashboardComponent implements OnInit {
  usuario: any = {};
  stats: any = { porEstado: [], porPrioridad: [], porCategoria: [] };

  constructor(
    private ticketSvc: TicketService,
    private auth: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.usuario = this.auth.getUsuario();
    if (this.usuario.rol === 3) this.router.navigate(['/tickets']);
    
    setTimeout(() => {
        this.ticketSvc.getEstadisticas().subscribe({
            next: (data) => this.stats = data,
            error: (err) => console.error('error estadisticas:', err)
        });
    }, 100);
}



  irTickets() { this.router.navigate(['/tickets']); }
  logout() { this.auth.logout(); }
}