# Operación de staging

Este entorno ejecuta PostgreSQL 17, la API NestJS y la web Next.js desde imágenes
construidas a partir del mismo commit. Solo la web publica un puerto en loopback; un
proxy con TLS debe ser el único punto expuesto fuera de la máquina.

## Preparación

Requisitos del host:

- Docker Engine con Compose v2;
- `curl` para el smoke test;
- espacio persistente y monitorizado para el volumen de PostgreSQL y los backups;
- un proxy HTTPS delante de `127.0.0.1:3101` para cualquier acceso remoto.

Crear el archivo de secretos, que está ignorado por Git:

```bash
cp .env.staging.example .env.staging
chmod 600 .env.staging
```

Sustituir todos los valores `replace-with`. Las contraseñas incluidas en las dos URL
de PostgreSQL deben coincidir con `POSTGRES_ADMIN_PASSWORD` y
`POSTGRES_APP_PASSWORD`; si contienen caracteres reservados de una URL deben
codificarse. Generar `JWT_SECRET` con al menos 32 caracteres aleatorios.

SMTP es opcional y no forma parte del gate actual. Sin proveedor, la web desactiva el
envío y ofrece la descarga PDF. No se deben inventar valores SMTP para staging.

## Despliegue y actualización

Desde el commit que se quiere desplegar:

```bash
./scripts/staging-up.sh
```

El comando construye las dos imágenes, espera PostgreSQL, aplica todas las migraciones
pendientes antes de arrancar la API, espera los healthchecks y comprueba `/acceso`.
Una actualización usa el mismo comando. Las migraciones son forward-only; antes de una
actualización con cambios de esquema se debe crear y verificar un backup.

En un entorno destinado a evaluación, cargar o verificar los datos demo con:

```bash
./scripts/seed-demo.sh
```

El seed es idempotente y se ejecuta dentro de la red privada del stack. Sus credenciales
y el recorrido guiado están en [Probar el producto](07_probar_producto.md).

Comprobaciones operativas:

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml ps
docker compose --env-file .env.staging -f docker-compose.staging.yml logs --tail=200 api web
curl --fail http://127.0.0.1:3101/acceso
```

La API no publica puertos al host. Su healthcheck usa `/v1/health/ready`, que verifica
también una consulta real a PostgreSQL. Los logs JSON de la API incluyen el request ID;
las respuestas devuelven `x-request-id` para correlación.

## Backup y ensayo de restauración

Crear un dump en formato custom con permisos `0600`:

```bash
backup_file="$(./scripts/backup-database.sh)"
echo "$backup_file"
```

El directorio `backups/` está ignorado por Git. Hay que copiar los dumps a un destino
cifrado fuera del host y aplicar una política de retención.

Ensayar el backup sin modificar la base activa:

```bash
./scripts/restore-drill.sh "$backup_file"
```

El ensayo crea `pastagansa_restore_drill`, restaura el dump, compara el número de
migraciones aplicadas, comprueba tablas críticas y elimina siempre esa base temporal.
Debe ejecutarse después de cada cambio de esquema y periódicamente en staging.

## Restauración real

Una restauración real es destructiva y requiere una ventana de mantenimiento:

1. confirmar el archivo, fecha, tamaño y ubicación externa del dump;
2. detener `web` y `api`, manteniendo `postgres` activo;
3. crear primero una copia final de la base dañada para análisis;
4. recrear la base `pastagansa` con propietario `pastagansa_admin`;
5. ejecutar `pg_restore --exit-on-error --no-owner --no-acl`;
6. reaplicar los grants del rol `pastagansa_app` y ejecutar `prisma migrate deploy`;
7. arrancar API/web y completar healthcheck más los dos recorridos E2E.

No automatizamos esos pasos destructivos para evitar que un error de ruta o entorno
sobrescriba la base activa. El `restore-drill` es el mecanismo automatizado seguro.

## Parada y rollback

```bash
docker compose --env-file .env.staging -f docker-compose.staging.yml down
```

`down` conserva el volumen. No usar `down -v` en staging. Para volver al código anterior,
cambiar al commit conocido, reconstruir con `staging-up.sh` y verificar compatibilidad de
su binario con el esquema ya migrado. Si no es compatible, restaurar el backup mediante
el procedimiento de mantenimiento anterior.
