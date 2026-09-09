# PastaGansa

ERP SaaS para facturación, compras, contabilidad y fiscalidad española. El repositorio
contiene el API NestJS y la aplicación web Next.js en un monorepo npm.

## Probarlo en local

Requisitos: Node.js 22 o posterior y Docker.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
docker compose up -d postgres
npm install
npm run db:generate
npm run db:deploy
npm run dev
```

Abre `http://localhost:3001`, crea una cuenta y la aplicación te llevará a la empresa
creada. El API queda en `http://localhost:3000`, con OpenAPI en
`http://localhost:3000/docs`.

## Verificación

```bash
npm run lint
npm run build
npm test
npm run test:integration
```

Las pruebas de integración requieren PostgreSQL y todas las migraciones aplicadas.
Consulta [la guía del API](apps/api/README.md) para el detalle funcional y
[el plan de producto usable](docs/05_plan_producto_usable.md) para el orden activo de
entrega.
