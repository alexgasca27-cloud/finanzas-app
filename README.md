# Finanzas App V5 — Individual / Duo / Familiar

1. En Supabase > SQL Editor ejecuta TODO `supabase.sql`.
2. Si muestra "Success. No rows returned", está correcto.
3. Reemplaza en GitHub `index.html`, `style.css` y `app.js`.
4. Recarga la app.

Esta versión agrega la base del sistema de espacios financieros:
- Individual
- Duo
- Familiar
- Integrantes con cuentas propias
- Invitaciones almacenadas en Supabase
- Datos ligados a un espacio compartido
- RLS por espacio
- Creación automática de espacio individual si no existe

Importante: el envío real de correo y la aceptación automática de invitaciones se implementarán con una Edge Function en la siguiente etapa. No se expone ninguna clave privada en el frontend.


## V6 — Lógica financiera base
Añade saldo acumulado, distingue salidas reales de compras a crédito, y calcula la deuda de cada tarjeta a partir de compras y pagos. MSI y Kueski por quincenas quedan para la siguiente capa.
