# Digital Banking Backend System

## Overview

This project implements a simplified digital banking backend designed to simulate the architecture used in modern fintech systems. The system provides secure account management, internal money transfers, and double-entry ledger accounting.

The goal of this project is to demonstrate real-world financial backend engineering practices including:

- transactional consistency
- ledger-based accounting
- secure authentication
- idempotent APIs
- audit logging

The system is implemented using **Node.js, TypeScript, PostgreSQL, and Prisma ORM**.

---

# System Architecture

The application follows a **modular monolithic architecture**.

Each domain of the system is separated into modules but deployed as a single application.

Modules include:

- Authentication Service
- User Service
- Account Service
- Transaction Service
- Ledger Service
- Notification Service
- Admin Service

System Flow:

Client → API → Controllers → Services → Repository Layer → PostgreSQL

---

# Core Features

## Authentication

Users can securely register and log in.

Capabilities:

- user registration
- JWT authentication
- password hashing
- session validation

---

## Account Management

Each user may create and manage one or more bank accounts.

Capabilities:

- create account
- view account details
- retrieve account balance
- view account transaction history

---

## Internal Money Transfers

Users can transfer funds between accounts within the system.

Transfer Process:

1. validate sender balance
2. create transaction record
3. create ledger debit entry
4. create ledger credit entry
5. update account balances
6. commit database transaction

All transfers execute within a **database transaction** to ensure consistency.

---

## Double Entry Ledger

Every financial operation produces two ledger entries:

Debit entry → sender account
Credit entry → receiver account

This ensures financial integrity and enables full auditing of all system transactions.

---

## Idempotent Payment Requests

The system supports idempotency keys to prevent duplicate transactions caused by network retries.

Each transfer request can include an `Idempotency-Key` header.

Duplicate keys will return the previous response instead of creating a new transaction.

---

## Audit Logging

Sensitive operations are recorded in the audit log system including:

- authentication attempts
- transfers
- administrative actions

Audit logs allow system administrators to track activity and detect fraud.

---

# Security Features

The system implements several security mechanisms:

- password hashing using bcrypt
- JWT authentication tokens
- request validation
- database transaction safety
- API rate limiting
- audit logs for sensitive operations

---

# Technology Stack

Backend:

Node.js
TypeScript
Express / NestJS

Database:

PostgreSQL
Prisma ORM

Infrastructure:

Docker
Redis (optional caching)
RabbitMQ (optional messaging)

---

# Database Design

Core tables:

users
accounts
transactions
ledger_entries
audit_logs
idempotency_keys

The ledger_entries table implements double-entry accounting.

---

# API Endpoints

Authentication

POST /auth/register
POST /auth/login

Accounts

POST /accounts
GET /accounts
GET /accounts/:id

Transactions

POST /transactions/transfer
GET /transactions/:id

Admin

GET /admin/users
GET /admin/transactions

---

# Swagger Documentation

This project exposes OpenAPI documentation using Swagger UI.

After starting the server:

- Swagger UI: http://localhost:3000/api-docs
- OpenAPI JSON: http://localhost:3000/api-docs.json

The API endpoints are documented under the `/api/v1` base path and include
JWT bearer authentication for protected routes.

---

# Deployment

The application can be deployed using Docker and hosted on cloud platforms such as:

- AWS
- Render
- Railway

---

# Future Improvements

Planned enhancements include:

- fraud detection engine
- scheduled transfers
- webhook notifications
- multi-currency support
- payment gateway integration

---

# Project Goal

This project demonstrates the backend infrastructure behind modern digital banking systems and fintech platforms such as Stripe, Paystack, and modern neobanks.
