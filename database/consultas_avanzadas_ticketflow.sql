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

/* ==========================================================
CONSULTA 2
Carga de trabajo y tasa de resolución por técnico

Técnica:
Subconsultas correlacionadas múltiples + cálculo de ratio

Objetivo:
Para cada técnico/agente del sistema, calcular cuántos tickets
tiene activos, cuántos ha resuelto históricamente, el total de
tickets asignados y su tasa de resolución porcentual.

Adaptación:
El documento original menciona asignacion_ticket y estados_ticket,
pero en el modelo real restaurado de TicketFlow esa información
está dentro de la tabla Tickets mediante id_usuario_asignado y estado.
========================================================== */

SELECT
    u.id_usuario,
    u.nombre AS tecnico,
    u.email,
    r.nombre AS rol,

    /* Tickets activos asignados actualmente */
    (
        SELECT COUNT(*)
        FROM Tickets t1
        WHERE t1.id_usuario_asignado = u.id_usuario
          AND UPPER(t1.estado) NOT IN ('CERRADO', 'RESUELTO', 'CANCELADO')
    ) AS tickets_activos_asignados,

    /* Tickets cerrados o resueltos históricamente */
    (
        SELECT COUNT(*)
        FROM Tickets t2
        WHERE t2.id_usuario_asignado = u.id_usuario
          AND UPPER(t2.estado) IN ('CERRADO', 'RESUELTO')
    ) AS tickets_resueltos_historicos,

    /* Total de tickets asignados al técnico */
    (
        SELECT COUNT(*)
        FROM Tickets t3
        WHERE t3.id_usuario_asignado = u.id_usuario
    ) AS total_tickets_asignados,

    /* Tickets activos de prioridad alta */
    (
        SELECT COUNT(*)
        FROM Tickets t4
        WHERE t4.id_usuario_asignado = u.id_usuario
          AND UPPER(t4.estado) NOT IN ('CERRADO', 'RESUELTO', 'CANCELADO')
          AND UPPER(t4.prioridad) IN ('ALTA', 'CRITICA', 'CRÍTICA')
    ) AS tickets_altos_activos,

    /* Tasa de resolución porcentual */
    CAST(
        CASE
            WHEN (
                SELECT COUNT(*)
                FROM Tickets t5
                WHERE t5.id_usuario_asignado = u.id_usuario
            ) = 0 THEN 0
            ELSE
                (
                    (
                        SELECT COUNT(*)
                        FROM Tickets t6
                        WHERE t6.id_usuario_asignado = u.id_usuario
                          AND UPPER(t6.estado) IN ('CERRADO', 'RESUELTO')
                    ) * 100.0
                )
                /
                (
                    SELECT COUNT(*)
                    FROM Tickets t7
                    WHERE t7.id_usuario_asignado = u.id_usuario
                )
        END AS DECIMAL(6,2)
    ) AS tasa_resolucion_porcentaje,

    /* Clasificación operacional */
    CASE
        WHEN (
            SELECT COUNT(*)
            FROM Tickets t8
            WHERE t8.id_usuario_asignado = u.id_usuario
              AND UPPER(t8.estado) NOT IN ('CERRADO', 'RESUELTO', 'CANCELADO')
        ) >= 5 THEN 'Sobrecargado'

        WHEN (
            SELECT COUNT(*)
            FROM Tickets t9
            WHERE t9.id_usuario_asignado = u.id_usuario
              AND UPPER(t9.estado) NOT IN ('CERRADO', 'RESUELTO', 'CANCELADO')
        ) BETWEEN 2 AND 4 THEN 'Carga media'

        WHEN (
            SELECT COUNT(*)
            FROM Tickets t10
            WHERE t10.id_usuario_asignado = u.id_usuario
        ) = 0 THEN 'Sin tickets asignados'

        ELSE 'Carga baja'
    END AS estado_carga

FROM Usuarios u
INNER JOIN Roles r
    ON r.id_rol = u.id_rol
WHERE
    u.activo = 1
    AND (
        UPPER(r.nombre) IN ('AGENTE', 'TECNICO', 'TÉCNICO')
        OR EXISTS (
            SELECT 1
            FROM Tickets tx
            WHERE tx.id_usuario_asignado = u.id_usuario
        )
    )
ORDER BY
    tickets_activos_asignados DESC,
    tasa_resolucion_porcentaje DESC,
    tecnico ASC;
GO
