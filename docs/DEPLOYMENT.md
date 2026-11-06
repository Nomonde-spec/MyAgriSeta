# Deployment

## Local development

### Backend

```bash
cd server
npm install
cp .env.example .env
npm start
```

### Mobile

```bash
cd mobile
cp .env.example .env
npm install
npm run dev
```

## Production guidance

- Use environment variables instead of hardcoded secrets.
- Run the backend behind HTTPS and a reverse proxy.
- Configure CORS to only accept trusted domains.
- Configure Neon with `DATABASE_URL` and an explicitly managed `JWT_SECRET`; production startup rejects missing values.
- Complete versioned database migrations, backups, multi-instance cache consistency, durable session revocation, and a production privacy/security review before deployment.
- Use EAS or a native build pipeline for app distribution.
