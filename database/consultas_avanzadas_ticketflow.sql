/* ==========================================================
1) Vista operacional de tickets con estado de tiempo
Técnica: JOIN múltiple + CASE + DATEDIFF + DATEADD
Objetivo:
Mostrar una vista completa de los tickets de TicketFlow,
incluyendo categoría, prioridad, estado, usuario creador,
técnico asignado, rol del técnico, días/horas abierto,
fecha límite calculada y estado de cumplimiento.

Adaptación:
La consulta original estaba planteada para PostgreSQL.
Como el proyecto funcional usa SQL Server, se adapta EXTRACT
a DATEDIFF y se calcula una fecha límite según prioridad.

Regla SLA aplicada:
Alta  = 24 horas
Media = 72 horas
Baja  = 120 horas
========================================================== */

WITH tickets_base AS (
    SELECT
        t.id_ticket,
        t.titulo,
        c.nombre AS categoria,

        CASE
            WHEN UPPER(t.prioridad) IN ('ALTA', 'CRITICA', 'CRÍTICA') THEN 'Alta'
            WHEN UPPER(t.prioridad) = 'MEDIA' THEN 'Media'
            WHEN UPPER(t.prioridad) = 'BAJA' THEN 'Baja'
            ELSE 'Media'
        END AS prioridad_operacional,

        CASE
            WHEN UPPER(t.prioridad) IN ('ALTA', 'CRITICA', 'CRÍTICA') THEN 3
            WHEN UPPER(t.prioridad) = 'MEDIA' THEN 2
            WHEN UPPER(t.prioridad) = 'BAJA' THEN 1
            ELSE 2
        END AS nivel_prioridad,

        CASE
            WHEN UPPER(t.prioridad) IN ('ALTA', 'CRITICA', 'CRÍTICA') THEN 24
            WHEN UPPER(t.prioridad) = 'MEDIA' THEN 72
            WHEN UPPER(t.prioridad) = 'BAJA' THEN 120
            ELSE 72
        END AS sla_horas,

        t.estado,
        creador.nombre AS creado_por,
        rol_creador.nombre AS rol_creador,

        ISNULL(asignado.nombre, 'Sin asignar') AS tecnico_asignado,
        ISNULL(rol_asignado.nombre, 'Sin rol asignado') AS rol_tecnico,

        t.fecha_creacion,
        t.fecha_actualizacion
    FROM Tickets t
    INNER JOIN Categorias c
        ON c.id_categoria = t.id_categoria
    INNER JOIN Usuarios creador
        ON creador.id_usuario = t.id_usuario_creador
    INNER JOIN Roles rol_creador
        ON rol_creador.id_rol = creador.id_rol
    LEFT JOIN Usuarios asignado
        ON asignado.id_usuario = t.id_usuario_asignado
    LEFT JOIN Roles rol_asignado
        ON rol_asignado.id_rol = asignado.id_rol
),
tickets_calculados AS (
    SELECT
        *,
        DATEDIFF(DAY, fecha_creacion, GETDATE()) AS dias_abierto,
        DATEDIFF(HOUR, fecha_creacion, GETDATE()) AS horas_abierto,
        DATEADD(HOUR, sla_horas, fecha_creacion) AS fecha_limite_calculada
    FROM tickets_base
)
SELECT
    id_ticket,
    titulo,
    categoria,
    prioridad_operacional AS prioridad,
    estado,
    creado_por,
    rol_creador,
    tecnico_asignado,
    rol_tecnico,
    fecha_creacion,
    fecha_actualizacion,
    dias_abierto,
    horas_abierto,
    sla_horas,
    fecha_limite_calculada,

    CASE
        WHEN UPPER(estado) IN ('CERRADO', 'RESUELTO') THEN 0
        ELSE DATEDIFF(HOUR, GETDATE(), fecha_limite_calculada)
    END AS horas_restantes_o_vencidas,

    CASE
        WHEN UPPER(estado) IN ('CERRADO', 'RESUELTO') THEN 'CERRADO'
        WHEN GETDATE() > fecha_limite_calculada THEN 'VENCIDO'
        ELSE 'EN TIEMPO'
    END AS estado_tiempo,

    CASE
        WHEN UPPER(estado) IN ('CERRADO', 'RESUELTO') THEN 'Finalizado'
        WHEN GETDATE() > fecha_limite_calculada THEN 'Requiere atención inmediata'
        WHEN DATEDIFF(HOUR, GETDATE(), fecha_limite_calculada) <= 8 THEN 'Próximo a vencer'
        ELSE 'Dentro del SLA'
    END AS observacion_operacional

FROM tickets_calculados
ORDER BY
    nivel_prioridad DESC,
    fecha_creacion ASC;
GO