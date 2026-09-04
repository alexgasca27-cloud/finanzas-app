# Finanzas App V11

Basada en V10.

Cambios V11:
- En cada tarjeta se muestran abajo, en pequeño, sus fechas:
  - Tarjeta de crédito/departamental: Día de corte + Día de pago.
  - Kueski: solamente Día de pago.
- El formulario de nueva tarjeta adapta los campos según el producto.
- Kueski no solicita fecha de corte.
- No requiere cambios en supabase.sql: usa `cut_day` y `due_day` ya existentes.


V12: agrega financiamiento Kueski de 1 a 12 quincenas. Al registrar una compra con método Kueski se puede elegir el número de quincenas; el detalle calcula el importe por quincena y el próximo pago según la regla de fechas de Kueski. Ejecuta el bloque V12 de supabase.sql en el SQL Editor antes de probar compras Kueski.
