# Uberzinho V2

Aplicativo estilo Uber, mobile-first, com backend em Node.js, frontend em React e mapa em tempo real.

## O que já vem pronto

- cadastro e login com JWT
- perfis: passageiro, motorista e admin
- painel mobile para passageiro, motorista e admin
- mapa em tempo real com Leaflet + OpenStreetMap
- Socket.IO para corrida e localização ao vivo
- fluxo completo da corrida:
  - solicitar
  - aceitar
  - chegar
  - iniciar
  - concluir
  - cancelar
- status online/offline do motorista
- atualização de localização do motorista em tempo real
- cálculo simples de preço e distância
- histórico de corridas
- painel admin com métricas básicas
- PostgreSQL com auto-bootstrap de tabelas e seed demo opcional
- estrutura pronta para GitHub + Railway

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express + Socket.IO
- Banco: PostgreSQL
- Mapa: Leaflet
- Realtime: WebSocket com Socket.IO
- Auth: JWT + bcrypt

## Rodar localmente

1. Crie um PostgreSQL local.
2. Copie `.env.example` para `.env`.
3. Ajuste `DATABASE_URL`.
4. Rode:

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:8080`

## Seed demo

Com `DEMO_SEED=true`, na primeira inicialização são criados usuários de teste:

- admin@uberzinho.local / 123456
- passageiro@uberzinho.local / 123456
- motorista@uberzinho.local / 123456

## Build

```bash
npm install
npm run build
npm start
```

## Deploy no Railway

### Serviços recomendados
- 1 serviço web para a aplicação
- 1 banco PostgreSQL

### Variáveis de ambiente
- `PORT`
- `CLIENT_URL`
- `JWT_SECRET`
- `DATABASE_URL`
- `APP_NAME`
- `MAP_DEFAULT_LAT`
- `MAP_DEFAULT_LNG`
- `MAP_DEFAULT_CITY`
- `DEMO_SEED`

## Estrutura

- `server/` backend e realtime
- `client/` app mobile-first
- `server/sql/schema.sql` bootstrap do banco

## Próximos upgrades bons

- gateway de pagamento
- notificações push
- avaliação passageiro/motorista
- documentos do motorista
- cupons
- chat em tempo real
- cálculo de rota com provedor externo
