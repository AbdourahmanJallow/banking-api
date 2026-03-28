.PHONY: help docker-up docker-down docker-logs docker-shell \
        db-migrate db-seed db-studio db-backup db-restore \
        redis-cli nginx-logs test coverage clean rebuild

help:
	@echo "=== Banking API - Docker Commands ==="
	@echo ""
	@echo "Development:"
	@echo "  make docker-up         - Start all services"
	@echo "  make docker-down       - Stop all services"
	@echo "  make docker-logs       - View service logs"
	@echo "  make docker-shell      - Shell into API container"
	@echo ""
	@echo "Database:"
	@echo "  make db-migrate        - Run Prisma migrations"
	@echo "  make db-seed           - Seed sample data"
	@echo "  make db-studio         - Open Prisma Studio"
	@echo "  make db-backup         - Backup PostgreSQL database"
	@echo "  make db-restore FILE=backup.sql - Restore database from backup"
	@echo "  make db-reset          - Drop and recreate schema (dev only)"
	@echo ""
	@echo "Redis:"
	@echo "  make redis-cli         - Access Redis CLI"
	@echo "  make redis-flush       - Clear all Redis data"
	@echo ""
	@echo "Nginx:"
	@echo "  make nginx-logs        - View Nginx logs"
	@echo ""
	@echo "Testing:"
	@echo "  make test              - Run all tests"
	@echo "  make test-watch        - Run tests in watch mode"
	@echo "  make coverage          - Run tests with coverage"
	@echo ""
	@echo "Maintenance:"
	@echo "  make logs              - View all service logs"
	@echo "  make ps                - Show running containers"
	@echo "  make clean             - Remove containers and volumes"
	@echo "  make rebuild           - Rebuild Docker image"
	@echo "  make prune             - Clean up Docker resources"
	@echo ""

# Docker commands
docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

docker-logs-api:
	docker compose logs -f api

docker-logs-db:
	docker compose logs -f postgres

docker-logs-redis:
	docker compose logs -f redis

docker-logs-nginx:
	docker compose logs -f nginx

nginx-logs:
	docker compose logs -f nginx

docker-shell:
	docker compose exec api sh

docker-ps:
	docker compose ps

# Database commands
db-migrate:
	docker compose exec api npm run db:migrate

db-seed:
	docker compose exec api npm run db:seed

db-studio:
	docker compose exec api npm run db:studio

db-backup:
	@mkdir -p backups
	@docker compose exec postgres pg_dump -U postgres banking | gzip > backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz
	@echo "Database backed up to backups/backup_$(date +%Y%m%d_%H%M%S).sql.gz"

db-restore:
	@if [ -z "$(FILE)" ]; then \
		echo "Usage: make db-restore FILE=backup.sql"; \
		exit 1; \
	fi
	docker compose exec -T postgres psql -U postgres banking < $(FILE)
	@echo "Database restored from $(FILE)"

db-reset:
	@echo "Resetting database (development only)..."
	docker compose exec postgres psql -U postgres -d banking -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	docker compose exec api npm run db:migrate
	@echo "Database reset completed"

db-shell:
	docker compose exec postgres psql -U postgres -d banking

# Redis commands
redis-cli:
	docker compose exec redis redis-cli -a redis123

redis-flush:
	docker compose exec redis redis-cli -a redis123 FLUSHALL
	@echo "Redis cache cleared"

redis-monitor:
	docker compose exec redis redis-cli -a redis123 MONITOR

# Testing
test:
	docker compose exec api npm test

test-watch:
	docker compose exec api npm run test:watch

test-coverage:
	docker compose exec api npm run test:coverage

test-unit:
	docker compose exec api npm run test:unit

test-integration:
	docker compose exec api npm run test:integration

# Cleanup & Maintenance
logs:
	docker compose logs -f --tail=100

ps:
	docker compose ps

stats:
	docker stats

clean:
	docker compose down -v
	@echo "All containers and volumes removed"

prune:
	docker system prune -a -f
	@echo "Docker system pruned"

clean-volumes:
	docker volume prune -f
	@echo "Unused volumes removed"

# Utility commands
exec:
	@if [ -z "$(CMD)" ]; then \
		echo "Usage: make exec CMD='npm run ...'\n"; \
		exit 1; \
	fi
	docker compose exec api $(CMD)

inspect:
	docker compose ps
	docker stats --no-stream
	@echo "\nContainer details:"
	docker inspect banking-api-app | grep -E "\"IPAddress\"|\"Gateway\"|\"MacAddress\"" | head -6

# Health check
health:
	@echo "Checking service health..."
	@echo "API: $$(curl -s http://localhost:5000/health || echo 'DOWN')"
	@echo "Database: $$(docker compose exec postgres pg_isready -U postgres -d banking 2>/dev/null && echo 'UP' || echo 'DOWN')"
	@echo "Redis: $$(docker-compose exec redis redis-cli -a redis123 ping 2>/dev/null || echo 'DOWN')"

# SSH key generation for Docker
generate-jwt-secret:
	@openssl rand -base64 32
