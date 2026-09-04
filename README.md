# Finanzas App V11

Basada en V10.

Cambios V11:
- En cada tarjeta se muestran abajo, en pequeño, sus fechas:
  - Tarjeta de crédito/departamental: Día de corte + Día de pago.
  - Kueski: solamente Día de pago.
- El formulario de nueva tarjeta adapta los campos según el producto.
- Kueski no solicita fecha de corte.
- No requiere cambios en supabase.sql: usa `cut_day` y `due_day` ya existentes.
