# Finanzas App V22

- Estado de cuenta para tarjetas tradicionales.
- Próximo pago con monto.
- Botón “Tarjeta pagada”.
- El pago se registra como salida real de dinero y reduce el Disponible de la app.
- Libera crédito por el monto pagado.
- El periodo no se reinicia artificialmente a cero: las compras posteriores al corte permanecen como deuda del periodo actual.
- Una vez pagado, el estado se muestra como “✓ Pagado”.
- No requiere SQL nuevo.
