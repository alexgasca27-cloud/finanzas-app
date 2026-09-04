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
