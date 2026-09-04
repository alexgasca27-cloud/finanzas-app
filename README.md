# Finanzas App V16

Incluye:
- Todo lo de V15.
- MSI para compras con Tarjeta de crédito.
- Opciones: compra normal, 3, 6, 9, 12, 18 o 24 meses sin intereses.
- El total de la compra ocupa crédito desde el momento de la compra.
- El dinero disponible no disminuye por la compra a crédito; disminuye cuando se registra el pago de la tarjeta.
- Cálculo de mensualidad.
- Calendario de mensualidades futuras según día de corte y día de pago.
- Identificación de MSI en movimientos recientes y detalle de tarjeta.

Antes de usar MSI, ejecutar el `supabase.sql` completo en Supabase. Es seguro porque usa `IF NOT EXISTS` y agrega únicamente la columna/constraint necesarios.


V16.1: cache-bust de app.js y campo MSI resaltado para tarjetas de crédito.
