# Pagos de suscripción — ReTurnos

Cobro mensual automático por país:

| Zona | Proveedor | Precio |
|---|---|---|
| Argentina | Mercado Pago (Checkout Pro) | **$15.000 ARS / mes** |
| Resto del mundo | PayPal (Orders API) | **US$10 / mes** |

La detección se hace en el navegador (zona horaria / idioma) y el usuario ve el botón
correspondiente en **Configuración → Suscripción**.

## Arquitectura

- **Frontend** llama a la Edge Function `create-checkout` (autenticada con el JWT del usuario).
- **Edge Function** crea la preferencia/orden de pago con los secretos y devuelve la URL de pago.
- El proveedor avisa a la Edge Function **`payment-webhook`**, que deja
  `businesses.subscription_status = 'active'` (con service role, sin pasar por RLS).
- **Ninguna credencial viaja al navegador.**

## Archivos

```
supabase/functions/create-checkout/index.ts   → crea el link de pago
supabase/functions/payment-webhook/index.ts   → recibe los avisos y activa la suscripción
supabase/functions/confirm-payment/index.ts   → respaldo: verifica el pago al volver de la pasarela
src/services/subscription.ts                  → invocación desde React
src/pages/SubscriptionPage.tsx                → botón y retorno del pago
```

### ¿Cómo se activa la suscripción?

Hay **dos caminos** (cualquiera de los dos sirve):

1. **Webhook**: MercadoPago manda el aviso a la URL `notification_url` que ya va
   dentro de cada preferencia de pago (`payment-webhook`), y PayPal a la URL que
   registres en su panel. `payment-webhook` deja la suscripción activa 30 días.
2. **Respaldo**: cuando el usuario vuelve a `/subscription?payment=success`,
   el frontend llama a `confirm-payment`, que consulta el pago directamente a la
   API del proveedor y lo activa. Sirve si el webhook no llega.

Además `payment-webhook` valida que el pago sea `approved` y de **$15.000 ARS o más**
antes de activar.

## Estado actual

- [x] Secretos de MercadoPago cargados (`MP_ACCESS_TOKEN`, `SITE_URL`)
- [x] Funciones desplegadas: `create-checkout`, `payment-webhook`, `confirm-payment`
- [ ] Probar un pago real desde Configuración → Suscripción
- [ ] PayPal (falta client id/secret)

## Pasos para activar (cuando quede PayPal / cambiar credenciales)

### 1. Sacar las credenciales

**Mercado Pago** (cuenta Argentina)
1. <https://www.mercadopago.com.ar/developers/panel/app> → Crear aplicación
2. Copiar el **Access Token** (Producción o Test)

**PayPal**
1. <https://developer.paypal.com/dashboard/applications> → Create App
2. Copiar **Client ID** y **Secret**
3. Empezar en sandbox; para producción, marcar `PAYPAL_ENV=live`

### 2. Cargar los secretos en Supabase

Supabase Dashboard → tu proyecto → **Settings → Edge Functions → Secrets**:

```
MP_ACCESS_TOKEN=APP_USR-...
PAYPAL_CLIENT_ID=AX...
PAYPAL_CLIENT_SECRET=...
PAYPAL_ENV=sandbox            # o "live"
SITE_URL=https://re-turnos.vercel.app
```

(Si querés validar la firma de Mercado Pago, agregá también `MP_WEBHOOK_SECRET`
y para PayPal `PAYPAL_WEBHOOK_ID`.)

### 3. Desplegar las funciones

```bash
npx supabase secrets set --project-ref rwlncdnzhgzovjldbczv MP_ACCESS_TOKEN=...
npx supabase functions deploy create-checkout payment-webhook confirm-payment \
  --project-ref rwlncdnzhgzovjldbczv
```

(`payment-webhook` se despliega con `--no-verify-jwt` para que el proveedor pueda avisar.)

### 4. Avisos de Mercado Pago (webhook)

**No hace falta registrarlo a mano**: la URL del webhook ya viaja en cada preferencia
de pago (`notification_url`), así que MercadoPago avisa solo.

Si igual querés el webhook a nivel cuenta (para todos los pagos), agregalo en
panel → tu aplicación → **Webhooks**:

```
https://rwlncdnzhgzovjldbczv.supabase.co/functions/v1/payment-webhook?provider=mercadopago
```

Evento: **Pagos** (`payment`).

### 5. Webhook de PayPal (opcional pero recomendado)

PayPal Dashboard → tu app → **Webhooks** → agregar la misma URL
(`.../payment-webhook?provider=paypal`) con el evento
**PAYMENT.CAPTURE.COMPLETED**, y copiar el **Webhook ID** al secreto `PAYPAL_WEBHOOK_ID`.

## Flujo del usuario

1. Configuración → Suscripción → **Pagar con Mercado Pago** / **Pay with PayPal**
2. Se abre la pasarela en otra pestaña
3. Al pagar vuelve a `/subscription?payment=success&payment_id=...`
4. El frontend llama a `confirm-payment` (y/o llega el webhook) → la suscripción
   queda **Activa** por 30 días

## Sin credenciales

Si falta algún secreto, la Edge Function devuelve:
*"Los pagos con Mercado Pago todavía no están configurados en el servidor."*
y el botón lo muestra, sin romper nada. **MercadoPago ya está configurado.**
