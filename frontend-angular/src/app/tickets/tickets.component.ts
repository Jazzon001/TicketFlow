import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth/auth.service';
import { TicketService } from './services/ticket.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="layout">

      <div *ngIf="mensaje"
           class="animate__animated animate__fadeInDown toast"
           [style.background]="mensaje.startsWith('✗') ? '#e74c3c' : '#2ecc71'">
          {{ mensaje }}
      </div>

      <header>
        <span>TicketFlow</span>
        <div class="user">
          <button *ngIf="!esCliente" (click)="irDashboard()">Dashboard</button>
          {{ usuario.nombre }} &nbsp;|&nbsp;
          <button (click)="logout()">Salir</button>
        </div>
      </header>

      <main>
        <!-- Formulario nuevo ticket -->
        <div class="card">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0">Nuevo ticket</h3>
            <button (click)="mostrarFormTicket = !mostrarFormTicket"
                style="padding: 6px 16px; background:#333; color:white; border:none; border-radius:8px; cursor:pointer;">
                {{ mostrarFormTicket ? 'Ocultar' : 'Nuevo ticket' }}
            </button>
          </div>
          <div *ngIf="mostrarFormTicket" class="form-card" style="margin-top:1rem;">
            <input [(ngModel)]="form.titulo" placeholder="Título" />
            <input [(ngModel)]="form.descripcion" placeholder="Descripción" />
            <select [(ngModel)]="form.prioridad">
              <option value="Alta">Alta</option>
              <option value="Media">Media</option>
              <option value="Baja">Baja</option>
            </select>
            <select [(ngModel)]="form.id_categoria">
              <option value="1">Soporte Técnico</option>
              <option value="2">Facturación</option>
              <option value="3">Consulta General</option>
            </select>
            <button (click)="crearTicket()">Crear ticket</button>
          </div>
        </div>

        <!-- Solo administrador -->
        <div class="card" *ngIf="esAdmin">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0">Crear usuario</h3>
            <button (click)="mostrarFormUsuario = !mostrarFormUsuario"
                style="padding: 6px 16px; background:#333; color:white; border:none; border-radius:8px; cursor:pointer;">
                {{ mostrarFormUsuario ? 'Ocultar' : 'Nuevo usuario' }}
            </button>
          </div>
          <div *ngIf="mostrarFormUsuario" class="form-card" style="margin-top:1rem;">
            <input [(ngModel)]="formUsuario.nombre" placeholder="Nombre" />
            <input [(ngModel)]="formUsuario.email" placeholder="Email" />
            <input type="password" [(ngModel)]="formUsuario.password" placeholder="Contraseña" />
            <select [(ngModel)]="formUsuario.id_rol">
              <option value="1">Administrador</option>
              <option value="2">Agente</option>
              <option value="3">Cliente</option>
            </select>
            <button (click)="crearUsuario()">Crear usuario</button>
          </div>
        </div>

        <!-- Lista de tickets -->
        <div class="card">
          <h3>Tickets</h3>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
    <h3 style="margin:0">Tickets</h3>
    <button (click)="mostrarCerrados = !mostrarCerrados"
        style="padding: 6px 16px; background:#333; color:white; border:none; border-radius:8px; cursor:pointer;">
        {{ mostrarCerrados ? 'Ocultar cerrados' : 'Ver cerrados' }}
    </button>
</div>
          <p *ngIf="cargando">Cargando...</p>
          <p *ngIf="!cargando && tickets.length === 0">No hay tickets.</p>
          <table *ngIf="tickets.length > 0">
            <thead>
              <tr>
                <th>#</th>
                <th>Título</th>
                <th>Categoría</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Creado por</th>
                <th>Asignado a</th>
                <th>Acciones</th>
                <th *ngIf="esAdmin">Asignar</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let t of ticketsFiltrados">
                <td>{{ t.id_ticket }}</td>
                <td>{{ t.titulo }}</td>
                <td>{{ t.categoria }}</td>
                <td>
                  <span class="badge" [class]="'p-' + t.prioridad.toLowerCase()">
                    {{ t.prioridad }}
                  </span>
                </td>
                <td>{{ t.estado }}</td>
                <td>{{ t.creado_por }}</td>
                <td>{{ t.asignado_a || 'Sin asignar' }}</td>
                <td>
                  <select *ngIf="!esCliente" (change)="cambiarEstado(t.id_ticket, $event)">
                    <option value="">-- Estado --</option>
                    <option value="Abierto">Abierto</option>
                    <option value="En Progreso">En Progreso</option>
                    <option value="Cerrado">Cerrado</option>
                  </select>
                  <span *ngIf="esCliente">{{ t.estado }}</span>
                </td>
                <td *ngIf="esAdmin">
                  <select (change)="asignarTicket(t.id_ticket, $event)">
                    <option value="">-- Agente --</option>
                    <option *ngFor="let a of agentes" [value]="a.id_usuario">
                      {{ a.nombre }}
                    </option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Panel auditoría solo admin -->
        <div class="card" *ngIf="esAdmin">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3>Auditoría</h3>
            <button (click)="toggleAuditoria()" style="padding: 6px 16px; background:#333; color:white; border:none; border-radius:8px; cursor:pointer;">
              {{ mostrarAuditoria ? 'Ocultar' : 'Ver auditoría' }}
            </button>
          </div>
          <table *ngIf="mostrarAuditoria && auditoria.length > 0" style="margin-top:1rem;">
            <thead>
              <tr>
                <th>#</th>
                <th>Tabla</th>
                <th>Acción</th>
                <th>Registro</th>
                <th>Usuario</th>
                <th>Fecha</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let a of auditoria">
                <td>{{ a.id_auditoria }}</td>
                <td>{{ a.tabla_afectada }}</td>
                <td>
                  <span class="badge"
                        [style.background]="a.accion === 'INSERT' ? '#e5f5e5' : a.accion === 'DELETE' ? '#ffe5e5' : '#fff3cd'"
                        [style.color]="a.accion === 'INSERT' ? '#276227' : a.accion === 'DELETE' ? '#c0392b' : '#856404'">
                    {{ a.accion }}
                  </span>
                </td>
                <td>{{ a.id_registro }}</td>
                <td>{{ a.usuario }}</td>
                <td>{{ a.fecha | date:'dd/MM/yyyy HH:mm' }}</td>
                <td>{{ a.detalle }}</td>
              </tr>
            </tbody>
          </table>
          <p *ngIf="mostrarAuditoria && auditoria.length === 0">No hay registros.</p>
        </div>
      </main>
    </div>
  `,
  styles: [`
    * { box-sizing: border-box; }
    .layout { min-height: 100vh; background: #f5f5f5; font-family: sans-serif; }

    .toast {
      position: fixed; top: 70px; right: 24px;
      color: white; padding: 12px 24px;
      border-radius: 10px; font-size: 14px; font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 999;
    }

    header {
      background: #333; color: white;
      padding: 0 2rem; height: 52px;
      display: flex; align-items: center; justify-content: space-between;
    }
    header span { font-weight: 600; }
    header button { background: none; border: 1px solid #fff; color: white; padding: 4px 12px; border-radius: 6px; cursor: pointer; }
    .user { font-size: 14px; display: flex; align-items: center; gap: 12px; }

    main { padding: 1.5rem 2rem; display: flex; flex-direction: column; gap: 1rem; }

    .card { background: white; border-radius: 12px; padding: 1.5rem; }
    h3 { margin: 0 0 1rem; font-size: 16px; }

    .form-card { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
    input, select {
      padding: 8px 12px; border: 1px solid #ddd;
      border-radius: 8px; font-size: 14px; flex: 1; min-width: 150px;
    }
    .form-card button {
      padding: 9px 20px; background: #333; color: white;
      border: none; border-radius: 8px; cursor: pointer; font-size: 14px;
    }

    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #eee; color: #888; font-weight: 500; }
    td { padding: 10px 12px; border-bottom: 1px solid #f0f0f0; }

    .badge { padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
    .p-alta { background: #ffe5e5; color: #c0392b; }
    .p-media { background: #fff3cd; color: #856404; }
    .p-baja { background: #e5f5e5; color: #276227; }

    td select { padding: 5px 8px; font-size: 13px; min-width: 120px; }
  `]
})
export class TicketsComponent implements OnInit {
  tickets: any[] = [];
  cargando = true;
  usuario: any = {};
  esCliente = false;
  esAdmin = false;
  agentes: any[] = [];
  auditoria: any[] = [];
  mostrarAuditoria = false;
  mostrarFormTicket = false;
  mostrarFormUsuario = false;
  mensaje = '';

  form = { titulo: '', descripcion: '', prioridad: 'Media', id_categoria: '1' };
  formUsuario = { nombre: '', email: '', password: '', id_rol: 3 };

  constructor(
    private ticketSvc: TicketService,
    private auth: AuthService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit() {
    this.usuario = this.auth.getUsuario();
    this.esAdmin = this.usuario.rol === 1;
    this.esCliente = this.usuario.rol === 3;
    if (this.esAdmin) this.cargarAgentes();
    this.cargarTickets();
  }

  mostrarMensaje(texto: string) {
    this.mensaje = texto;
    setTimeout(() => this.mensaje = '', 3000);
  }

  irDashboard() { this.router.navigate(['/dashboard']); }
  logout() { this.auth.logout(); }

  cargarTickets() {
    this.cargando = true;
    this.ticketSvc.getTickets().subscribe({
      next: (data) => { this.tickets = data; this.cargando = false; },
      error: () => { this.cargando = false; }
    });
  }

  crearTicket() {
    if (!this.form.titulo) return;
    this.ticketSvc.crearTicket(this.form).subscribe({
      next: () => {
        this.form = { titulo: '', descripcion: '', prioridad: 'Media', id_categoria: '1' };
        this.mostrarFormTicket = false;
        this.cargarTickets();
        this.mostrarMensaje('✓ Ticket creado correctamente');
      }
    });
  }

  cambiarEstado(id: number, event: any) {
    const estado = event.target.value;
    if (!estado) return;
    this.ticketSvc.actualizarEstado(id, estado).subscribe({
      next: () => {
        const ticket = this.tickets.find(t => t.id_ticket === id);
        if (ticket) ticket.estado = estado;
        event.target.value = '';
        this.mostrarMensaje('✓ Estado actualizado correctamente');
      },
      error: () => this.mostrarMensaje('✗ Error al actualizar el estado')
    });
  }

  cargarAgentes() {
    this.ticketSvc.getAgentes().subscribe({
      next: (data) => this.agentes = data,
      error: (err) => console.error('error agentes:', err)
    });
  }

  asignarTicket(id_ticket: number, event: any) {
    const id_agente = event.target.value;
    if (!id_agente) return;
    this.ticketSvc.asignarTicket(id_ticket, Number(id_agente)).subscribe({
      next: () => {
        this.cargarTickets();
        event.target.value = '';
        this.mostrarMensaje('✓ Ticket asignado correctamente');
      },
      error: (err) => console.error('error asignando:', err)
    });
  }

  crearUsuario() {
    if (!this.formUsuario.nombre || !this.formUsuario.email) return;
    this.http.post('http://localhost:3000/api/auth/registro', this.formUsuario).subscribe({
      next: () => {
        this.mostrarMensaje('✓ Usuario creado correctamente');
        this.mostrarFormUsuario = false;
        this.formUsuario = { nombre: '', email: '', password: '', id_rol: 3 };
      },
      error: (err) => this.mostrarMensaje('✗ ' + err.error.error)
    });
  }

  cargarAuditoria() {
    this.ticketSvc.getAuditoria().subscribe({
      next: (data) => this.auditoria = data
    });
  }

  toggleAuditoria() {
    this.mostrarAuditoria = !this.mostrarAuditoria;
    if (this.mostrarAuditoria) this.cargarAuditoria();
  }

mostrarCerrados = false;

get ticketsFiltrados() {
    if (this.mostrarCerrados) return this.tickets;
    return this.tickets.filter(t => t.estado !== 'Cerrado');
}

}