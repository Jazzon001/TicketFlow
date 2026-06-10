import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private api = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  getTickets() {
    return this.http.get<any[]>(`${this.api}/tickets`);
  }

  crearTicket(data: any) {
    return this.http.post(`${this.api}/tickets`, data);
  }

  actualizarEstado(id: number, estado: string) {
    return this.http.put(`${this.api}/tickets/${id}/estado`, { estado });
  }

getAgentes() {
    return this.http.get<any[]>('http://localhost:3000/api/auth/agentes');
}

asignarTicket(id: number, id_agente: number) {
    return this.http.put(`${this.api}/tickets/${id}/asignar`, { id_agente });
}

getAuditoria() {
    return this.http.get<any[]>('http://localhost:3000/api/tickets/auditoria');
}

getEstadisticas() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : '';
    return this.http.get<any>('http://localhost:3000/api/tickets/estadisticas', {
        headers: { Authorization: `Bearer ${token}` }
    });
}

}

