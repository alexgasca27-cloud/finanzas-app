# Finanzas App V22

- Estado de cuenta para tarjetas tradicionales.
- Próximo pago con monto.
- Botón “Tarjeta pagada”.
- El pago se registra como salida real de dinero y reduce el Disponible de la app.
- Libera crédito por el monto pagado.
- El periodo no se reinicia artificialmente a cero: las compras posteriores al corte permanecen como deuda del periodo actual.
- Una vez pagado, el estado se muestra como “✓ Pagado”.
- No requiere SQL nuevo.


## V23 · Ahorro dinámico
- Metas con monto objetivo, aportación programada y frecuencia mensual/quincenal.
- Fecha estimada calculada automáticamente desde el ahorro acumulado y la aportación programada.
- Aportaciones extraordinarias actualizan el saldo y la fecha estimada.
- Historial de aportaciones por meta.
- No requiere fecha objetivo manual.
- Requiere ejecutar la sección V23 del `supabase.sql` una vez.


V25 — PWA instalable
- Finanzas App funciona como PWA instalable desde Android/Chrome y iPhone/Safari.
- Incluye manifest, iconos y service worker.
- La instalación mantiene el inicio de sesión y la app se abre en modo independiente.
- Las operaciones con Supabase siguen usando la red; el caché solo cubre la interfaz.

V26 — Duo/Familiar real
- Los movimientos personales solo son visibles para su creador.
- Los movimientos marcados como Compartido son visibles para todos los integrantes del espacio.
- La invitación genera un enlace único de 7 días y abre Gmail con el correo listo para enviar.
- El invitado inicia sesión con Google usando el correo invitado y queda unido automáticamente al espacio.
- Al aceptar, el tablero compartido se selecciona automáticamente.
