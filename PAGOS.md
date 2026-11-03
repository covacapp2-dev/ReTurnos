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
src/services/subscription.ts                  → invocación desde React
src/pages/SubscriptionPage.tsx                → botón y retorno del pago
```

## Pasos para activar

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

Con la Supabase CLI instalada y logueada:

```bash
npx supabase login
npx supabase link --project-id rwlncdnzhgzovjldbczv
npx supabase functions deploy create-checkout
npx supabase functions deploy payment-webhook
```

### 4. Avisos de Mercado Pago (webhook)

En el panel de Mercado Pago → tu aplicación → **Webhooks** → agregar:

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
3. Al pagar vuelve a `/subscription?payment=success`
4. El webhook activa la suscripción → la página se recarga y muestra **Activo**

## Mientras no haya credenciales

El botón muestra el mensaje:
*"Los pagos con Mercado Pago todavía no están configurados en el servidor."*
(tal cual lo devuelve la Edge Function), sin romper nada.
