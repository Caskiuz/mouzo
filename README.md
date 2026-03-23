# MOUZO - Plataforma de Delivery

> Conectando negocios locales con la comunidad de San Cristóbal, Venezuela

[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![MySQL](https://img.shields.io/badge/mysql-8.0%2B-blue.svg)](https://www.mysql.com/)

## 🚀 Stack Tecnológico

- **Frontend**: React Native + Expo SDK 54
- **Backend**: Express.js + TypeScript (Node 18+)
- **Base de Datos**: MySQL (Aiven Cloud) + Drizzle ORM
- **SMS / Auth**: Twilio Verify
- **Emails**: Resend
- **IA / OCR**: Google Gemini 1.5 Flash
- **Push Notifications**: Expo Notifications
- **Mapas**: Google Maps (react-native-maps)

## 🎨 Diseño

- **Colores**: Paleta crema cálida (#E8B4A8, #D4A89C, #F5F1EB)
- **Modo Oscuro**: Automático con soporte completo
- **Tema**: Cálido y acogedor, inspirado en comida casera venezolana

## 📋 Requisitos

- Node.js 18+
- MySQL 8.0+ (o cuenta Aiven)
- npm
- Android Studio + SDK (para builds Android)

## 🛠️ Instalación

```bash
git clone https://github.com/Caskiuz/mouzo.git
cd mouzo
npm install
cp .env.example .env.local
# Editar .env.local con tus credenciales
npm run db:push
```

## 🔧 Variables de Entorno

```env
# Base de Datos (Aiven)
DATABASE_URL=mysql://user:password@host:port/defaultdb?ssl-mode=REQUIRED
DB_HOST=
DB_PORT=
DB_USER=
DB_PASSWORD=
DB_NAME=defaultdb

# JWT
JWT_SECRET=
REFRESH_SECRET=

# App
NODE_ENV=development
PORT=5000
FRONTEND_URL=http://localhost:8081
BACKEND_URL=http://localhost:5000
EXPO_PUBLIC_BACKEND_URL=https://tu-backend.onrender.com

# Google Maps + Gemini
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
GEMINI_API_KEY=

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_VERIFY_SERVICE_SID=

# Pago Móvil MOUZO (cuenta receptora)
MOUZO_PAGO_MOVIL_PHONE=
MOUZO_PAGO_MOVIL_BANK=
MOUZO_PAGO_MOVIL_CEDULA=

# Comisiones (%)
NEMY_COMMISSION=15
BUSINESS_COMMISSION=100
DRIVER_COMMISSION=100

# Resend (Opcional)
RESEND_API_KEY=
```

## 🚀 Desarrollo

```bash
# Backend
npm run server:dev

# Frontend
npm run expo:dev
```

## 📊 Base de Datos

El schema completo está en `shared/schema-mysql.ts`

```bash
# Aplicar cambios al schema
npm run db:push

# Backup
mysqldump -u root -p defaultdb > backup.sql
```

### Migraciones manuales
```bash
# Ejecutar contra Aiven
mysql --host=<host> --port=<port> --user=avnadmin --password=<pass> --ssl-mode=REQUIRED defaultdb < migrations/<archivo>.sql
```

## 🏗️ Estructura del Proyecto

```
MOUZO/
├── client/                        # Frontend React Native
│   ├── components/                # Componentes reutilizables
│   ├── screens/                   # Pantallas de la app
│   ├── contexts/                  # Context API
│   ├── navigation/                # RootStackNavigator
│   ├── constants/theme.ts         # Design system
│   └── lib/query-client.ts        # API client
├── server/                        # Backend Express
│   ├── routes/                    # Rutas API
│   ├── digitalPaymentService.ts   # Pagos digitales + OCR
│   ├── autoVerificationService.ts # Anti-fraude
│   ├── payoutService.ts           # Sistema de payouts
│   ├── partnerLevelService.ts     # Niveles de partner
│   ├── fundReleaseService.ts      # Liberación de fondos
│   └── server.ts                  # Servidor principal
├── shared/
│   └── schema-mysql.ts            # Schema Drizzle ORM
└── migrations/                    # SQL migrations manuales
```

## 💳 Sistema de Pagos

MOUZO opera en Venezuela donde Stripe no está disponible. El sistema de pagos es 100% manual coordinado por el admin.

### Métodos soportados
- **Pago Móvil** (método principal)
- **Binance Pay**
- **Zinli**
- **Zelle**
- **Efectivo** (contra entrega)

### Comisiones
- MOUZO: 15% de markup sobre precio base de productos
- Negocio: 100% del precio base
- Repartidor: 100% de la tarifa de entrega

### Flujo de Pago
1. Cliente realiza pedido y paga vía Pago Móvil (u otro método)
2. Cliente sube comprobante → OCR con Gemini extrae datos automáticamente
3. Admin verifica el comprobante (anti-fraude automático)
4. Negocio prepara y repartidor recoge
5. Repartidor marca entregado → Cliente confirma recepción
6. Al confirmar el cliente se crean los **payouts** (negocio + repartidor)
7. Admin transfiere manualmente y marca payout como pagado

### Cuentas de Pago (`payment_accounts`)
Cada usuario (negocio/repartidor) registra sus cuentas destino en `PaymentWalletSetupScreen`. El admin las usa para saber a dónde transferir.

### Anti-fraude
- Deduplicación de comprobantes por referencia
- Bloqueo automático tras 3 intentos fraudulentos en 7 días
- Log en `audit_logs`

## 📱 Funcionalidades

### Clientes
- Explorar negocios y productos
- Realizar pedidos con múltiples métodos de pago
- Seguimiento en tiempo real con mapa (estilo Uber)
- Confirmar entrega para liberar fondos
- Chat con repartidor
- Sistema de propinas

### Negocios
- Panel de gestión de pedidos
- Control de productos y categorías
- Modo saturado / Menú 86
- Niveles de partner (Bronze → Silver → Gold → Platinum)
- Estadísticas de ventas

### Repartidores
- Asignación automática de pedidos
- Navegación integrada
- Historial de entregas y ganancias
- Cuentas de cobro registradas

### Administradores
- Panel de control completo
- Verificación de comprobantes de pago
- Gestión de payouts pendientes
- Métricas de pagos digitales
- Gestión de usuarios y disputas

## 🔐 Seguridad

- Autenticación por teléfono (Twilio Verify OTP)
- JWT con refresh tokens
- Rate limiting
- RBAC (customer / business_owner / delivery_driver / admin / super_admin)
- Anti-fraude con bloqueo automático
- Auditoría de acciones críticas en `audit_logs`

## 📦 Build Android

```bash
# Prebuild (regenera carpeta android/)
npx expo prebuild --platform android --clean

# Compilar APK release (solo arm64-v8a para evitar límite de rutas en Windows)
cd android
gradlew assembleRelease

# APK generado en:
# android/app/build/outputs/apk/release/app-release.apk
```

> **Nota Windows**: `gradle.properties` tiene `reactNativeArchitectures=arm64-v8a` para evitar el error de rutas >260 caracteres.

## 🧪 Testing

```bash
npm run lint
npm run check:types
```

## 📄 Licencia

Propietario — MOUZO © 2026

---

**Hecho con ❤️ en San Cristóbal, Venezuela**
