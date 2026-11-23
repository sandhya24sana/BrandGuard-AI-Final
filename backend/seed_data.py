"""Compatibility entry point; BrandGuard no longer ships or inserts sample data."""

from database import init_db


def seed_database():
    raise RuntimeError("Demo seeding has been removed. Database initialization creates schema only.")


if __name__ == "__main__":
    init_db()
    print("Database schema initialized. No brand or demo records were inserted.")
