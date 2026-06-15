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


/* ==========================================================
CONSULTA 3
Análisis de categorías con tickets vencidos

Técnica:
GROUP BY + HAVING + agregaciones condicionales + prioridad predominante

Objetivo:
Para cada categoría con más de 3 tickets registrados, calcular:
total de tickets, tickets vencidos, porcentaje de vencidos,
tickets cerrados, horas promedio de resolución y prioridad
más frecuente asignada.

Adaptación:
La consulta original estaba diseñada para PostgreSQL usando
FILTER condicional y MODE(). En SQL Server se adapta usando
SUM(CASE WHEN ... THEN 1 ELSE 0 END) para el FILTER condicional
y OUTER APPLY + TOP 1 + GROUP BY para obtener la prioridad
predominante.

Regla SLA aplicada:
Alta  = 24 horas
Media = 72 horas
Baja  = 120 horas
========================================================== */

WITH tickets_calculados AS (
    SELECT
        t.id_ticket,
        t.id_categoria,

        CASE
            WHEN UPPER(LTRIM(RTRIM(t.prioridad))) IN ('ALTA', 'CRITICA', 'CRÍTICA') THEN 'Alta'
            WHEN UPPER(LTRIM(RTRIM(t.prioridad))) = 'MEDIA' THEN 'Media'
            WHEN UPPER(LTRIM(RTRIM(t.prioridad))) = 'BAJA' THEN 'Baja'
            ELSE 'Media'
        END AS prioridad_normalizada,

        CASE
            WHEN UPPER(LTRIM(RTRIM(t.prioridad))) IN ('ALTA', 'CRITICA', 'CRÍTICA') THEN 24
            WHEN UPPER(LTRIM(RTRIM(t.prioridad))) = 'MEDIA' THEN 72
            WHEN UPPER(LTRIM(RTRIM(t.prioridad))) = 'BAJA' THEN 120
            ELSE 72
        END AS sla_horas,

        t.estado,
        t.fecha_creacion,
        t.fecha_actualizacion,

        DATEADD(
            HOUR,
            CASE
                WHEN UPPER(LTRIM(RTRIM(t.prioridad))) IN ('ALTA', 'CRITICA', 'CRÍTICA') THEN 24
                WHEN UPPER(LTRIM(RTRIM(t.prioridad))) = 'MEDIA' THEN 72
                WHEN UPPER(LTRIM(RTRIM(t.prioridad))) = 'BAJA' THEN 120
                ELSE 72
            END,
            t.fecha_creacion
        ) AS fecha_limite_calculada
    FROM Tickets t
    WHERE t.fecha_creacion IS NOT NULL
),
resumen_categoria AS (
    SELECT
        c.id_categoria,
        c.nombre AS categoria,

        COUNT(tc.id_ticket) AS total_tickets,

        SUM(
            CASE
                WHEN UPPER(tc.estado) NOT IN ('CERRADO', 'RESUELTO', 'CANCELADO')
                 AND GETDATE() > tc.fecha_limite_calculada
                THEN 1 ELSE 0
            END
        ) AS tickets_vencidos,

        CAST(
            SUM(
                CASE
                    WHEN UPPER(tc.estado) NOT IN ('CERRADO', 'RESUELTO', 'CANCELADO')
                     AND GETDATE() > tc.fecha_limite_calculada
                    THEN 1 ELSE 0
                END
            ) * 100.0 / NULLIF(COUNT(tc.id_ticket), 0)
            AS DECIMAL(6,2)
        ) AS porcentaje_vencidos,

        SUM(
            CASE
                WHEN UPPER(tc.estado) IN ('CERRADO', 'RESUELTO')
                THEN 1 ELSE 0
            END
        ) AS tickets_cerrados,

        CAST(
            AVG(
                CASE
                    WHEN UPPER(tc.estado) IN ('CERRADO', 'RESUELTO')
                     AND tc.fecha_actualizacion IS NOT NULL
                    THEN DATEDIFF(HOUR, tc.fecha_creacion, tc.fecha_actualizacion) * 1.0
                END
            ) AS DECIMAL(10,2)
        ) AS horas_promedio_resolucion

    FROM Categorias c
    INNER JOIN tickets_calculados tc
        ON tc.id_categoria = c.id_categoria
    GROUP BY
        c.id_categoria,
        c.nombre
    HAVING COUNT(tc.id_ticket) > 3
)
SELECT
    rc.id_categoria,
    rc.categoria,
    rc.total_tickets,
    rc.tickets_vencidos,
    rc.porcentaje_vencidos,
    rc.tickets_cerrados,
    rc.horas_promedio_resolucion,
    ISNULL(pp.prioridad_predominante, 'Sin prioridad') AS prioridad_predominante,

    CASE
        WHEN rc.porcentaje_vencidos >= 50 THEN 'Categoría crítica'
        WHEN rc.porcentaje_vencidos >= 25 THEN 'Requiere seguimiento'
        WHEN rc.tickets_vencidos = 0 THEN 'Sin vencimientos'
        ELSE 'Controlada'
    END AS evaluacion_categoria

FROM resumen_categoria rc
OUTER APPLY (
    SELECT TOP 1
        tc2.prioridad_normalizada AS prioridad_predominante
    FROM tickets_calculados tc2
    WHERE tc2.id_categoria = rc.id_categoria
    GROUP BY tc2.prioridad_normalizada
    ORDER BY
        COUNT(*) DESC,
        CASE tc2.prioridad_normalizada
            WHEN 'Alta' THEN 3
            WHEN 'Media' THEN 2
            WHEN 'Baja' THEN 1
            ELSE 0
        END DESC
) pp
ORDER BY
    rc.porcentaje_vencidos DESC,
    rc.total_tickets DESC,
    rc.categoria ASC;
GO



/* ==========================================================
CONSULTA 4
Evolución semanal de tickets con LAG y acumulado

Técnica:
Window Functions: SUM() OVER + LAG()

Objetivo:
Mostrar, para las últimas 12 semanas, cuántos tickets se crearon
por semana agrupados por estado, el acumulado corrido por estado
y la variación respecto a la semana anterior.

Adaptación:
La consulta original menciona tickets y estados_ticket.
En el modelo real de TicketFlow en SQL Server, el estado del ticket
se almacena directamente en la tabla Tickets mediante la columna estado.
========================================================== */

WITH numeros AS (
    SELECT 0 AS n UNION ALL
    SELECT 1 UNION ALL
    SELECT 2 UNION ALL
    SELECT 3 UNION ALL
    SELECT 4 UNION ALL
    SELECT 5 UNION ALL
    SELECT 6 UNION ALL
    SELECT 7 UNION ALL
    SELECT 8 UNION ALL
    SELECT 9 UNION ALL
    SELECT 10 UNION ALL
    SELECT 11
),
semanas AS (
    SELECT
        DATEADD(
            WEEK,
            -n,
            DATEADD(WEEK, DATEDIFF(WEEK, 0, GETDATE()), 0)
        ) AS semana_inicio
    FROM numeros
),
estados AS (
    SELECT DISTINCT
        LTRIM(RTRIM(estado)) AS estado
    FROM Tickets
    WHERE estado IS NOT NULL
),
tickets_por_semana AS (
    SELECT
        DATEADD(WEEK, DATEDIFF(WEEK, 0, t.fecha_creacion), 0) AS semana_inicio,
        LTRIM(RTRIM(t.estado)) AS estado,
        COUNT(*) AS tickets_creados_semana
    FROM Tickets t
    WHERE t.fecha_creacion >= DATEADD(
        WEEK,
        -11,
        DATEADD(WEEK, DATEDIFF(WEEK, 0, GETDATE()), 0)
    )
    GROUP BY
        DATEADD(WEEK, DATEDIFF(WEEK, 0, t.fecha_creacion), 0),
        LTRIM(RTRIM(t.estado))
),
base_evolucion AS (
    SELECT
        s.semana_inicio,
        e.estado,
        ISNULL(tps.tickets_creados_semana, 0) AS tickets_creados_semana
    FROM semanas s
    CROSS JOIN estados e
    LEFT JOIN tickets_por_semana tps
        ON tps.semana_inicio = s.semana_inicio
       AND tps.estado = e.estado
),
evolucion AS (
    SELECT
        semana_inicio,
        estado,
        tickets_creados_semana,

        SUM(tickets_creados_semana) OVER (
            PARTITION BY estado
            ORDER BY semana_inicio ASC
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS acumulado_por_estado,

        LAG(tickets_creados_semana, 1, 0) OVER (
            PARTITION BY estado
            ORDER BY semana_inicio ASC
        ) AS tickets_semana_anterior
    FROM base_evolucion
)
SELECT
    semana_inicio,
    estado,
    tickets_creados_semana,
    acumulado_por_estado,
    tickets_semana_anterior,
    tickets_creados_semana - tickets_semana_anterior AS variacion_vs_semana_anterior,

    CASE
        WHEN tickets_creados_semana - tickets_semana_anterior > 0 THEN 'Aumentó'
        WHEN tickets_creados_semana - tickets_semana_anterior < 0 THEN 'Disminuyó'
        ELSE 'Sin variación'
    END AS tendencia_semanal

FROM evolucion
ORDER BY
    semana_inicio DESC,
    estado ASC;
GO