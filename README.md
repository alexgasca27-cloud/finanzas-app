# Finanzas App V20

Incluye todo lo de V19 y agrega:
- Editar tarjetas desde su detalle.
- Modificar nombre, límite de crédito y fechas de corte/pago.
- Kueski: solo día de pago.
- Tarjeta de crédito/departamental: día de corte y día de pago.
- Eliminar tarjeta con confirmación.
- Al eliminar una tarjeta, sus movimientos se conservan como historial y quedan desvinculados de la tarjeta (por la relación ON DELETE SET NULL).

No requiere SQL nuevo.
