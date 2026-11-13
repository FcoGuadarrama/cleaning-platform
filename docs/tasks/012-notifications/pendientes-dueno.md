# Notificaciones: lo que le toca al dueño

Tarea 012 · rama `feature/notifications` · 2026-11-13. Diseño en `docs/adr/0011-in-app-notifications-and-push.md`.

## 1. Activar push en teléfonos reales
Hoy las push solo se escriben en el log del servidor: la app no registra el teléfono hasta que exista un proyecto de EAS.

- [ ] Correr `eas init` en `apps/mobile-client` (crea el project id y lo guarda en `app.json`).
- [ ] Subir a EAS las credenciales de Apple (APNs) y de Google (FCM).
- [ ] Hacer un build de desarrollo y probar en un teléfono físico (en simulador y en web no hay push).
- [ ] En el servidor, poner `PUSH_PROVIDER=expo`.
- [ ] Opcional: `EXPO_ACCESS_TOKEN`, solo si activas la seguridad reforzada de push en Expo.

## 2. Confirmar valores propuestos
Son propuestas reversibles; se cambian por configuración sin tocar código.

| Valor | Propuesta | Variable |
|---|---|---|
| Hora del recordatorio de visita | 18:00 del día anterior (hora de CDMX) | `VISIT_REMINDER_LOCAL_TIME` |
| Cuánto se guardan los avisos en la bandeja | 90 días | `NOTIFICATION_RETENTION_DAYS` |

- [ ] Confirmar o ajustar la hora del recordatorio. Si alguien reserva después de esa hora una visita para el día
      siguiente, recibe la confirmación y el recordatorio.
- [ ] Confirmar o ajustar los días de retención.
- [ ] Revisar los textos de cada aviso (tabla en `docs/tasks/012-notifications.md`).

## 3. Revisión visual en el teléfono
La campana del panel web ya se revisó en el navegador; las pantallas móviles no.

- [ ] Campana con contador en Inicio (cliente y personal).
- [ ] Bandeja de Notificaciones: abrir un aviso, "Marcar todo como leído", "Ver anteriores".
- [ ] Cuenta → Notificaciones: permiso del teléfono e interruptores por categoría.
- [ ] Tocar una push te lleva a la visita, Mi suscripción o Ganancias.

## 4. Aprobar el PR
- [ ] Revisar la rama `feature/notifications` y aprobar que se abra el PR contra `main`.

## Para tener en cuenta
- Expo puede avisar días después que un teléfono ya no existe; eso todavía no se revisa. Solo se desactivan los
  teléfonos que Expo rechaza al momento del envío.
- Las push pasan por los servidores de Expo: los textos incluyen el nombre de la persona de limpieza y la hora, nunca
  la dirección.
- No hay correo ni WhatsApp; siguen como decisión abierta.
- La prueba local dejó la reserva 225 (pagada) y la 226 (apartada por una transferencia SPEI de prueba, se libera
  sola en 24 h).
- Expo reporta 10 paquetes con parches más nuevos de SDK 58; ya estaban así antes de esta tarea.
