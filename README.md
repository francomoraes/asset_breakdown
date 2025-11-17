# 📊 Asset Portfolio Tracker API

A RESTful API for finance portfolio management and asset tracking with real-time market data integration.

## 🌐 Live Demo

- **API Base URL:** Work in progress 🚧
- **Postman Collection:** [Test the API](link-to-your-postman-collection)
- **Health Check:** `GET /health`

## ✨ Features

### 🔐 Authentication & Security

- JWT-based authentication with secure password hashing
- Rate limiting (100 req/15min general, 5 req/5min auth)
- CORS protection and security headers (Helmet)
- User isolation - each user sees only their own data

### 📈 Portfolio Management

- **Multi-asset support** - Stocks, REITs, ETFs, Bonds, Crypto
- **Multi-currency tracking** - USD, BRL with automatic conversion
- **Buy/Sell operations** with automatic P&L calculation
- **Asset categorization** by classes and types
- **Target allocation** vs actual allocation tracking

### 📊 Real-time Data

- **Yahoo Finance integration** for live market prices (15min delay)
- **Automatic price updates** with caching
- **Currency conversion** with real-time exchange rates (15min delay)
- **Performance metrics** calculation

### 📁 Data Management

- **CSV import/export** for bulk operations (data replacement)
- **Portfolio summary** with allocation breakdown
- **Asset performance** analytics

### 🛠️ Developer Experience

- **TypeScript** for type safety
- **Structured logging** with Winston
- **API testing** with Postman collection
- **Error handling** with detailed logging
- **Environment-based** configuration

## 🏗️ Architecture

### Tech Stack

- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL with TypeORM
- **Authentication**: JWT + bcrypt
- **Validation**: Zod schemas
- **Logging**: Winston
- **Security**: Helmet + CORS + Rate limiting
- **Testing**: Newman + Postman

### Project Structure

```bash
src/
├── controllers/ # Request handlers
├── services/ # Business logic
├── models/ # Database entities
├── middlewares/ # Custom middleware
├── routes/ # API routes
├── dtos/ # Data validation schemas
├── config/ # App configuration
└── utils/ # Helper functions
```

## 🚀 Quick Start

### Prerequisites

- Node.js 22
- PostgreSQL database
- Environment variables configured

### Installation

```bash
# Clone repository
git clone https://github.com/francomoraes/asset_breakdown.git
cd asset_breakdown

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your database URL and JWT secret

# Run database migrations and seed
npm run seed

# Start development server
npm run start
```

### Environment Variables

```bash
DB_HOST=db_host
DB_PORT=db_port
DB_USER=db_user
DB_PASS=db_pass
DB_NAME=db_name
PORT=port_number
JWT_SECRET=jwt_secret_key
FRONTEND_URL=frontend_url
NODE_ENV=development_or_production
```

## 📡 API Endpoints

### Authentication

```
POST /api/auth/register  # Create new user
POST /api/auth/login     # User login
```

### Portfolio Management

```
GET    /api/assets                    # List user assets
POST   /api/assets/{symbol}/buy       # Buy asset
PUT    /api/assets/{symbol}/sell      # Sell asset
PUT    /api/assets/{id}               # Update asset
DELETE /api/assets/{id}               # Delete asset
GET    /api/assets/export             # Export to CSV
```

### Asset Configuration

```
GET    /api/asset-type               # List asset types
POST   /api/asset-type               # Create asset type
PATCH  /api/asset-type/{id}          # Update asset type
DELETE /api/asset-type/{id}          # Delete asset type
```

### Portfolio Analytics

```
GET /api/summary                     # Portfolio summary
GET /api/summary/overview            # Currency overview
```

### Data Import

```
GET  /api/csv-template               # Download CSV template
POST /api/upload-csv                 # Import CSV data
```

## 🧪 Testing

### API Testing with Newman

```bash
# Install Newman
npm install -g newman

# Run all tests
npm run test:api:full

# Run specific test suites
npm run test:api:auth     # Authentication tests
npm run test:api:assets   # Asset management tests
```

### 📊 Example Usage

**Buy an Asset**

```bash
// Buy 10 shares of AAPL
POST /api/assets/AAPL/buy
{
  "quantity": 10,
  "priceCents": 15000,  // $150.00
  "type": "Stocks",
  "institution": "Interactive Brokers",
  "currency": "USD"
}
```

**Portfolio Summary Response**

```bash
{
  "totalValue": 50000.00,
  "totalInvested": 45000.00,
  "totalGainLoss": 5000.00,
  "gainLossPercentage": 11.11,
  "allocations": [
    {
      "assetType": "Stocks",
      "targetPercentage": 60.0,
      "currentPercentage": 65.5,
      "value": 32750.00
    }
  ]
}
```

## 🌐 Live Demo

- **API Base URL:** `https://asset-breakdown-api.onrender.com/api`
- **Environment:** Demo (rate limited, test data only)

### Quick Test

```bash
curl https://asset-breakdown-api.onrender.com/api/assets
# Expected: {"error":"Authorization header missing"}

<div align="center">
by Franco Moraes

<a href="www.linkedin.com/in/francomoraes" target="blank"><img alt="LinkedIn" src="https://img.shields.io/badge/LinkedIn-Connect-blue"></a>
<a href="www.linkedin.com/in/francomoraes" target="blank"><img alt="Portfolio" src="https://img.shields.io/badge/Portfolio-Visit-green"></a>
<a href="www.github.com/in/francomoraes" target="blank"><img alt="API" src="https://img.shields.io/badge/Github-Visit-black"></a>

</div>
```
