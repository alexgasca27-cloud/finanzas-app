# Finanzas App v3

Primera versión funcional sobre GitHub Pages + Supabase.

## 1. Base de datos
En Supabase abre SQL Editor y ejecuta `supabase.sql` completo.

Esto crea:
- perfiles
- movimientos
- tarjetas/créditos
- conceptos
- metas de ahorro
- RLS por usuario
- conceptos iniciales

## 2. GitHub Pages
Reemplaza en tu repositorio los archivos:
- index.html
- style.css
- app.js
- supabase.sql

No es necesario subir `.env`.

## 3. Supabase Auth
Ya utiliza:
- Google

Redirect URL:
https://alexgasca27-cloud.github.io/finanzas-app/

## 4. Seguridad
La clave incluida en `app.js` es la publishable key de Supabase, diseñada para uso público en frontend. Nunca coloques aquí una Secret key/service_role, contraseña de base de datos o API privada de IA.

## 5. Estado de esta versión
Esta versión implementa la primera base funcional:
- login Google
- dashboard
- ingresos/gastos
- conceptos
- tarjetas
- metas de ahorro
- resumen mensual
- edición/eliminación durante 24 h en interfaz
- clasificación personal/compartido
- separación de compra con crédito frente a salida real de dinero

La siguiente fase debe construir la lógica financiera completa:
- ciclos de tarjeta y pagos
- MSI
- Kueski por quincenas
- pagos que liberan crédito sin reiniciar el saldo incorrectamente
- Duo/Familiar y reparto por persona
- saldo acumulado entre meses
- estados de cuenta
- alertas de vencimientos
- calificador mensual más avanzado
- IA mediante backend/Edge Function, nunca exponiendo la API key en el navegador.
