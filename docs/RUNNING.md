# Correr la app en local con Docker

Un comando levanta todo: MySQL, la API, el dashboard web y el cliente Expo en modo web.

## Requisitos

- Docker Desktop encendido, con Docker Compose 2.23 o más reciente (`docker compose version`).
- `git` y `openssl` (ya vienen en macOS).

No necesitas Node, pnpm, Python ni uv en tu máquina: todo se instala dentro de las imágenes.

## Levantar todo

Desde la raíz del repo:

```sh
./scripts/dev-stack.sh
```

La primera vez tarda unos minutos porque construye las imágenes. Al arrancar imprime algo así:

```
  Web dashboard  http://localhost:37748
  Expo web       http://localhost:39748
  API docs       http://localhost:35748/docs
  MySQL          127.0.0.1:33748 (db app, user app)
  Admin login    admin@admin.com / <contraseña>
```

Los puertos cambian en cada worktree, así que usa los que imprima el script. Quedan guardados en `.env.worktree`
junto con la contraseña del admin. Ese archivo se genera solo y nunca se sube a Git.

Para detenerlo, presiona `Ctrl+C`.

### Qué pasa al arrancar

1. Se crea `.env.worktree` si no existe, o se le agregan las variables que le falten.
2. Arranca MySQL.
3. La API aplica las migraciones y arranca.
4. Se crea el usuario `admin@admin.com`. Si ya existe, no se toca.
5. Arrancan el dashboard web y Expo web.

### Cambios en vivo

Con el comando de arriba, lo que edites en `apps/` o `packages/` se copia a los contenedores:

- API: se recarga sola. Si agregas una migración en `apps/api/alembic`, el contenedor se reinicia y la aplica.
- Dashboard web: Vite actualiza el navegador.
- Expo web: Metro recompila y recarga.

Si cambias `pnpm-lock.yaml` o `apps/api/uv.lock`, la imagen correspondiente se reconstruye sola.

## Otros comandos

| Comando | Qué hace |
| --- | --- |
| `./scripts/dev-stack.sh up -d` | Levanta todo en segundo plano. No copia cambios en vivo. |
| `./scripts/dev-stack.sh up --ios` | Manda un build de desarrollo para iPhone a EAS y luego levanta todo. Se combina con `-d`. |
| `./scripts/dev-stack.sh eas <comando>` | Corre cualquier comando de EAS CLI dentro de Docker, por ejemplo `eas login`. |
| `./scripts/dev-stack.sh down` | Detiene y borra los contenedores. Los datos de MySQL se conservan. |
| `./scripts/dev-stack.sh logs` | Muestra los logs de todos los servicios. |
| `./scripts/dev-stack.sh logs api` | Muestra los logs de un servicio: `api`, `web`, `mobile`, `mysql` o `admin`. |
| `./scripts/dev-stack.sh ps` | Lista los contenedores y su estado. |

Si tienes pnpm instalado, `pnpm stack` es lo mismo que `./scripts/dev-stack.sh`.

## Probar en un celular

Docker solo corre la versión web de Expo. Para Expo Go en un teléfono, corre el cliente desde tu máquina
con el stack levantado:

```sh
pnpm install
EXPO_PUBLIC_API_URL=http://<IP-de-tu-Mac>:<API_PORT> pnpm --filter @repo/mobile-client start
```

`API_PORT` está en `.env.worktree`. El puerto de la API solo escucha en `127.0.0.1`, así que para que el
teléfono lo alcance tendrías que cambiar ese mapeo en `docker-compose.yml`.

## Build de desarrollo para iPhone (EAS)

Un development build es la app compilada con su propio cliente de desarrollo, en lugar de Expo Go. EAS la compila
en la nube de Expo. El CLI corre dentro de Docker, así que no necesitas instalar `eas-cli`.

Necesitas una membresía activa del Apple Developer Program y una cuenta de Expo. La primera vez:

```sh
./scripts/dev-stack.sh eas login
./scripts/dev-stack.sh eas device:create
./scripts/dev-stack.sh up --ios
```

1. `eas login` guarda la sesión en el volumen de Docker `expo-home`. No hay que repetirlo.
2. `eas device:create` muestra un QR. Ábrelo en el iPhone para registrarlo en el perfil ad hoc.
3. `up --ios` manda el build y después levanta el stack. La primera vez EAS te pregunta si crea el proyecto en tu
   cuenta de Expo, qué bundle identifier usar y tu Apple ID para generar el certificado y el perfil. El ID del
   proyecto y el bundle identifier quedan en `apps/mobile-client/app.json`; súbelos a Git.

El script no espera a que el build termine, porque tarda varios minutos. Imprime el link a la página del build en
expo.dev, y ahí aparece el QR de instalación cuando acaba. Escanéalo con la cámara del iPhone.

Después activa el modo desarrollador en el iPhone: Ajustes > Privacidad y seguridad > Modo de desarrollador.
Enciéndelo, deja que se reinicie y, al volver, confirma con Activar y tu código.

`--ios` es opcional porque cada build cuenta contra la cuota de tu plan de Expo. Solo necesitas uno nuevo cuando
cambian dependencias nativas, permisos o `app.json`; los cambios de JavaScript llegan por Metro sin recompilar.

Para mandar solo el build y esperar el QR en la terminal, sin levantar el stack:

```sh
./scripts/dev-stack.sh eas build --platform ios --profile development
```

El development build carga el JavaScript desde Metro. Metro y la API en Docker solo escuchan en `127.0.0.1`, así
que el iPhone todavía no los alcanza; por ahora corre Metro desde tu máquina como en la sección anterior. Con
`expo-dev-client` instalado, `expo start` abre en modo development build. Presiona `s` para cambiar a Expo Go.

## Correr los tests de la API

Los tests usan la misma MySQL del worktree, en la base `app_test`:

```sh
docker compose --env-file .env.worktree up -d mysql
set -a && . ./.env.worktree && set +a
cd apps/api && uv sync && uv run pytest
```

Para esto sí necesitas `uv` en tu máquina.

## Problemas comunes

**"port is already allocated".** Otro proceso usa uno de los puertos de `.env.worktree`. Puede ser una API
o un Vite corriendo fuera de Docker. Detenlo o cambia el puerto en `.env.worktree` y vuelve a levantar.

**El dashboard o Expo no ven dependencias nuevas.** Reconstruye las imágenes:

```sh
./scripts/dev-stack.sh down
./scripts/dev-stack.sh
```

El script siempre corre con `--build`, así que basta con reiniciarlo.

**No sé la contraseña del admin.** Está en `.env.worktree`, en `ADMIN_PASSWORD`. Si la cambias ahí después de
que el admin ya existe, no se actualiza: el arranque deja intacto al admin existente.

**Quiero empezar con la base vacía.** Esto borra todos los datos locales del worktree y no se puede deshacer:

```sh
docker compose --env-file .env.worktree --profile app down -v
```

Los agentes tienen prohibido correr este comando (ver `AGENTS.md`); hazlo tú solo si de verdad quieres perder los datos.
