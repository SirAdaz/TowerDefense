# TowerDefense

Tower defense simple dans le navigateur : un chemin, une seule tourelle à améliorer (dégâts, portée, cadence), des vagues sans fin, un record. Solo, hors ligne, sans compte.

## Lancer

```bash
docker compose up -d --build      # Vite (rechargement à chaud) sur http://localhost:5180
docker compose exec app npm run ci # lint, types, tests, build
docker compose down
```

Build de production servi par nginx : `docker compose --profile prod up -d --build web` puis http://localhost:5181.

Rien ne s'installe sur la machine : Node et les dépendances sont dans l'image.

## Documentation

- [docs/README.md](docs/README.md) : index et état des phases.
- [docs/product/SPECS.md](docs/product/SPECS.md) : règles et chiffres d'équilibrage.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) : découpage logique / rendu / interface.
- [docs/DECISIONS.md](docs/DECISIONS.md) : décisions datées (dont l'exception de stack).
