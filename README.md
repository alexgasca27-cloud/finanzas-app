# Finanzas App V19

Actualización sobre V18:
- Las tarjetas departamentales ahora soportan compras a meses sin intereses.
- Al seleccionar método Departamental aparece selector de 1, 3, 6, 9, 12, 18 o 24 meses.
- Las compras departamentales con más de 1 mes se muestran en el detalle como MSI, con mensualidad, progreso y calendario.
- Kueski mantiene su lógica independiente de 1 a 12 quincenas.
- Tarjetas de crédito mantienen su lógica MSI.
- No requiere cambios adicionales en Supabase; usa `card_installments` ya existente.
